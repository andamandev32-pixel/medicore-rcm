/**
 * claim-suggester.js — ชั้นเสนอแนะความครบถ้วนการลงรหัสผู้ป่วยใน (SUGGEST)
 *
 * แยกจาก claim-validator โดยตั้งใจ: validator ตัดสิน PASS/FAIL — suggester
 * ไม่มีสิทธิ์ตัดสิน ผลของมันเป็นได้แค่ "ชวนทบทวน" (severity SUGGESTION/INFO)
 *
 * หลักจริยธรรม (ตามแนว RUL-IPD-024/025 ฝั่ง mock):
 *   - เป้าหมายคือ "ความครบถ้วนของรหัสที่มีเอกสารรองรับ" ไม่ใช่การปั้นรหัสเพิ่ม
 *   - ข้อเสนอที่ทำให้ RW สูงขึ้นต้องกำกับ "ตรวจสอบว่ามีเอกสารรองรับ" เสมอ และไม่ auto-apply
 *   - แสดงเฉพาะส่วนต่าง RW — ไม่คำนวณเป็นเงินบาท ตราบที่ตาราง DRG ยัง verified=0
 *   - แถวไหนอิงข้อมูลจำลอง (verified=0) ติดธง simulated ให้ UI ขึ้นป้าย
 *
 * การจับคู่ DRG ใช้ ref_drg.pdx_codes (ตัวแทน Grouper ในต้นแบบ) — Grouper จริง
 * ต้องใช้ Pdx+Sdx+หัตถการ+อายุ+เพศ+สถานะจำหน่าย เมื่อได้ตารางจริงจาก สกส.
 */
const { normCode, codeList, resolveDrgVersion } = require('./claim-validator');

/**
 * @param {object} pool  mysql2 pool
 * @param {object} claim รูปแบบเดียวกับ validateClaim
 * @param {object} fund  {fund_key, label_th} ที่ validator resolve แล้ว
 * @returns {Promise<Array>} suggestions
 */
async function suggestForClaim(pool, claim, fund) {
    const out = [];
    const push = (id, kind, severity, message, detail, evidence, simulated) => out.push({
        id, kind, severity, message,
        detail: detail || null,
        evidence: evidence || null,
        simulated: !!simulated,
    });

    const d = claim.diagnosis && typeof claim.diagnosis === 'object' ? claim.diagnosis : null;
    const pdxList = d ? (Array.isArray(d.pdx) ? d.pdx : (d.pdx ? [d.pdx] : [])) : [];
    const pdxKey = pdxList.length === 1 ? normCode(pdxList[0]) : null;
    const sdxKeys = d ? codeList(d.sdx).map(normCode).filter(Boolean) : [];
    const procs = codeList(claim.procedures).filter(Boolean);
    const los = Number(claim.admission?.los);
    const recordedDrg = claim.drg && typeof claim.drg === 'object' ? String(claim.drg.code || '').trim() : '';

    /* ── ตาราง DRG ของเวอร์ชันที่บังคับใช้ (BR-02) — ใช้ทั้ง regroup / bestGroup ── */
    let drgRows = [];
    if (pdxKey || recordedDrg) {
        const version = await resolveDrgVersion(pool, claim);
        if (version) {
            [drgRows] = await pool.query(
                `SELECT drg_code, description_th, rw, verified, pdx_codes
                 FROM ref_drg WHERE version_code = ? AND is_active = 1`, [version]);
        }
    }
    const matches = keys => drgRows.filter(r =>
        String(r.pdx_codes || '').split('|').map(normCode).some(k => k && keys.includes(k)));
    const best = rows => rows.reduce((a, b) => (!a || Number(b.rw) > Number(a.rw)) ? b : a, null);

    const current  = recordedDrg ? drgRows.find(r => normCode(r.drg_code) === normCode(recordedDrg)) : null;
    const regrouped = pdxKey ? best(matches([pdxKey])) : null;
    const reachable = pdxKey ? best(matches([pdxKey, ...sdxKeys])) : null;

    /* ── SUG-DRG-001 — กลุ่มที่จัดได้จาก Pdx ไม่ตรงกับ DRG ที่บันทึก (port RUL-IPD-023) ── */
    if (recordedDrg && regrouped && normCode(regrouped.drg_code) !== normCode(recordedDrg)) {
        push('SUG-DRG-001', 'DRG_REVIEW', 'SUGGESTION',
            `กลุ่มที่จัดได้จากรหัสวินิจฉัยคือ ${regrouped.drg_code} (${regrouped.description_th}) ไม่ตรงกับ DRG ที่บันทึก ${recordedDrg} — ตรวจสอบการจัดกลุ่มก่อนส่ง`,
            `Pdx=${pdxList[0]}`,
            { current_drg: recordedDrg, current_rw: current ? Number(current.rw) : null,
              best_drg: regrouped.drg_code, best_rw: Number(regrouped.rw), rw_delta: null },
            !regrouped.verified || (current && !current.verified));
    }

    /* ── SUG-DRG-002 — Pdx+Sdx เข้ากลุ่มที่ RW สูงกว่าได้ (port RUL-IPD-025 downcoding) ── */
    const baseline = current || regrouped;
    if (baseline && reachable && Number(reachable.rw) > Number(baseline.rw) + 1e-4
        && normCode(reachable.drg_code) !== normCode(baseline.drg_code)) {
        const delta = Number(reachable.rw) - Number(baseline.rw);
        push('SUG-DRG-002', 'DRG_REVIEW', 'SUGGESTION',
            `รหัสวินิจฉัยที่บันทึก (Pdx+Sdx) เข้ากลุ่ม ${reachable.drg_code} (${reachable.description_th}) ที่ RW สูงกว่าได้ +${delta.toFixed(4)} RW — ` +
            `ตรวจสอบว่ามีเอกสารรองรับการวินิจฉัยที่จัดเข้ากลุ่มนี้ก่อนปรับรหัส ห้ามปรับโดยไม่มีหลักฐานในเวชระเบียน`,
            `กลุ่มปัจจุบัน ${baseline.drg_code} RW ${Number(baseline.rw).toFixed(4)}`,
            { current_drg: baseline.drg_code, current_rw: Number(baseline.rw),
              best_drg: reachable.drg_code, best_rw: Number(reachable.rw),
              rw_delta: Number(delta.toFixed(4)) },
            !reachable.verified || !baseline.verified);
    }

    /* ── SUG-CMP-001 — นอนหลายวันแต่ไม่มีโรครองเลย: ชวนทบทวนโรคร่วม/โรคแทรก ── */
    if (pdxKey && !sdxKeys.length && isFinite(los) && los >= 3) {
        push('SUG-CMP-001', 'COMPLETENESS', 'INFO',
            `นอน ${los} วันแต่ยังไม่มีรหัสโรครอง (Sdx) เลย — ทบทวนว่ามีโรคร่วม/โรคแทรกที่แพทย์บันทึกไว้ในเวชระเบียนแต่ยังไม่ได้ให้รหัสหรือไม่`,
            'โรคร่วมที่บันทึกครบมีผลต่อการจัดกลุ่ม DRG ให้ตรงความหนักเบาของเคสจริง');
    }

    /* ── SUG-CMP-002 — กองทุน IP ส่งแต่ยอดสรุป ไม่มีราย item (แฟ้ม 7 CHAD ต้องราย item — C304) ── */
    if (fund?.fund_key === 'IP' && claim.charges && typeof claim.charges === 'object'
        && claim.charges.total != null && !(Array.isArray(claim.charges.items) && claim.charges.items.length)) {
        push('SUG-CMP-002', 'COMPLETENESS', 'INFO',
            'ค่าใช้จ่ายมีแต่ยอดสรุป — แฟ้ม 7 (CHAD) ต้องมีรายละเอียดราย Item ตามหมวด BILLGRCS ไม่งั้นจะติดรหัส C304',
            'แตกยอดสรุปเป็นรายการราย Item ก่อนส่ง');
    }

    /* ── SUG-CMP-003 — มีวินิจฉัยแต่ยังไม่จัดกลุ่ม DRG ── */
    if (pdxKey && !recordedDrg && fund?.fund_key === 'IP') {
        push('SUG-CMP-003', 'COMPLETENESS', 'INFO',
            'ยังไม่ได้จัดกลุ่ม DRG — จัดกลุ่มก่อนส่งเพื่อทราบประมาณการและตรวจ trim point ได้',
            regrouped ? `กลุ่มที่จัดได้จาก Pdx: ${regrouped.drg_code} (${regrouped.description_th})` : null,
            regrouped ? { best_drg: regrouped.drg_code, best_rw: Number(regrouped.rw) } : null,
            regrouped ? !regrouped.verified : false);
    }

    /* ── SUG-CMP-004 — กลุ่มหัตถการแต่ไม่มีรหัส ICD-9-CM (heuristic จากชื่อกลุ่ม) ── */
    const groupForProcCheck = current || regrouped;
    if (!procs.length && groupForProcCheck
        && /ผ่าตัด|หัตถการ/.test(String(groupForProcCheck.description_th || ''))) {
        push('SUG-CMP-004', 'COMPLETENESS', 'INFO',
            `กลุ่ม ${groupForProcCheck.drg_code} (${groupForProcCheck.description_th}) เป็นกลุ่มหัตถการ แต่เคสยังไม่มีรหัส ICD-9-CM — ตรวจสอบว่าบันทึกรหัสหัตถการจาก op note ครบ`,
            null, null, !groupForProcCheck.verified);
    }

    return out;
}

module.exports = { suggestForClaim };
