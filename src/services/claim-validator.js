/**
 * claim-validator.js — เครื่องตรวจเคลมก่อนส่ง (rule engine ชั้น deterministic)
 *
 * ตรวจข้อมูลเคลม 1 เคสกับตารางอ้างอิงมาตรฐาน ref_* แล้วคืนรายการประเด็น
 * พร้อม "รหัสติด C จริง" ที่จะได้กลับมาถ้าส่งโดยไม่แก้ — ทุกข้อความ error
 * มาจาก ref_error_codes (ไม่ hardcode) จึงอัปเดตตามแคตตาล็อกเสมอ
 *
 * หลักการ: ตรวจเท่าที่ส่งมา — ส่วนไหนของ claim ไม่ได้ให้มา ข้ามชั้นนั้น
 * (ผู้เรียกจึงใช้ตรวจบางมิติได้ เช่น ตรวจเฉพาะราคายา)
 *
 * ชั้นที่ตรวจ (ดูรายงานวิเคราะห์ประกอบ):
 *   FILES    แฟ้มครบตามกองทุน (เมทริกซ์ ref_fund_file_matrix — กฎ RUL-FIL-001)
 *   PATIENT  ข้อมูลผู้ป่วยพื้นฐาน + เลขบัตร ปชช. checksum (C101–C121)
 *   DX       การวินิจฉัย (C201, C202, C206)
 *   DRUG     ยาเทียบ TMT/Drug Catalogue (C562, C195, C303)
 *   CHARGE   ค่าใช้จ่าย (C301)
 *   DRG      จัดกลุ่ม/trim point (C210 + คำเตือน outlier)
 */

/** ตรวจเลขบัตรประชาชนไทย 13 หลัก (mod 11) */
function validThaiCid(cid) {
    const s = String(cid || '').replace(/[- ]/g, '');
    if (!/^\d{13}$/.test(s)) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(s[i]) * (13 - i);
    return (11 - (sum % 11)) % 10 === Number(s[12]);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** รับได้ทั้ง ค.ศ. และ พ.ศ. — คืน ms หรือ null ถ้า format ผิด */
function toTime(v) {
    const s = String(v || '').trim();
    if (!DATE_RE.test(s)) return null;
    let y = parseInt(s.slice(0, 4), 10);
    if (y > 2400) y -= 543;
    const t = Date.parse(`${y}${s.slice(4)}T00:00:00Z`);
    return isNaN(t) ? null : t;
}

/** Pdx ที่ไม่เหมาะกับผู้ป่วยใน ตามนิยาม C206 */
function pdxNotForIpd(pdx) {
    const p = String(pdx || '').toUpperCase();
    return /^Z13/.test(p) || p === 'Z76.3' || /^[VWXY]/.test(p);
}

/**
 * @param {object} pool  mysql2 pool
 * @param {object} claim ดูรูปแบบใน routes/reference.js (ทุก section ยกเว้น fund_key เป็น optional)
 * @returns {Promise<{fund:object, summary:object, issues:Array}>}
 */
async function validateClaim(pool, claim) {
    const issues = [];
    const layers = [];
    // สะสมรหัสที่จะใช้ก่อน แล้วค่อยดึงข้อความจริงจาก ref_error_codes ทีเดียวตอนจบ
    const add = (layer, severity, code, rule, detail) =>
        issues.push({ layer, severity, code: code || null, rule: rule || null, detail: detail || null });

    /* ── กองทุน (บังคับ) ── */
    const [[fund]] = await pool.query(
        `SELECT fund_key, label_th FROM ref_funds WHERE fund_key = ? AND is_active = 1`,
        [claim.fund_key]
    );
    if (!fund) {
        const e = new Error(`ไม่รู้จักกองทุน "${claim.fund_key || ''}" — ดูรายการที่ GET /api/reference/fund-files`);
        e.status = 400;
        throw e;
    }

    /* ── FILES — แฟ้มครบตามเมทริกซ์กองทุน ── */
    if (Array.isArray(claim.files_present)) {
        layers.push('FILES');
        const present = new Set(claim.files_present.map(Number));
        const flags = claim.flags || {};
        const [need] = await pool.query(
            `SELECT m.file_no, m.requirement, f.name_th, f.condition_key, f.condition_label
             FROM ref_fund_file_matrix m JOIN ref_claim_files f ON f.file_no = m.file_no
             WHERE m.fund_key = ? AND m.is_active = 1 ORDER BY m.file_no`,
            [fund.fund_key]
        );
        const inScope = new Set(need.map(n => n.file_no));
        for (const n of need) {
            const required = n.requirement === 'REQUIRED' || (n.condition_key && flags[n.condition_key]);
            if (required && !present.has(n.file_no)) {
                add('FILES', 'ERROR', null, 'RUL-FIL-001',
                    `ขาดแฟ้ม ${n.file_no} (${n.name_th})` +
                    (n.condition_key ? ` — บังคับเพราะเข้าเงื่อนไข "${n.condition_label}"` : ''));
            }
        }
        for (const no of present) {
            if (!inScope.has(no)) {
                add('FILES', 'INFO', null, 'RUL-FIL-001',
                    `แฟ้ม ${no} ไม่อยู่ในขอบเขตกองทุน ${fund.fund_key} — จะไม่ถูกใช้ประมวลผล`);
            }
        }
    }

    /* ── PATIENT ── */
    if (claim.patient && typeof claim.patient === 'object') {
        layers.push('PATIENT');
        const p = claim.patient;
        if (!String(p.name || '').trim())            add('PATIENT', 'ERROR', 'C101');
        if (toTime(p.birth_date) == null)            add('PATIENT', 'ERROR', 'C102', null, `birth_date="${p.birth_date || ''}"`);
        if (!['M', 'F', '1', '2'].includes(String(p.sex || '').toUpperCase()))
                                                     add('PATIENT', 'ERROR', 'C103', null, `sex="${p.sex || ''}"`);
        const cid = String(p.cid || '').trim();
        if (!cid)                                    add('PATIENT', 'ERROR', 'C104');
        else if (!/^\d{13}$/.test(cid))              add('PATIENT', 'ERROR', 'C116', null, `cid ยาว ${cid.length} หลัก`);
        else if (!validThaiCid(cid))                 add('PATIENT', 'ERROR', 'C104', null, 'checksum เลขบัตรไม่ผ่าน');
        if (!String(p.hn || '').trim())              add('PATIENT', 'ERROR', 'C105');
        if (fund.fund_key === 'IP' && !String(p.an || '').trim())
                                                     add('PATIENT', 'ERROR', 'C106');
    }

    /* ── ADMISSION (วันเวลา) ── */
    if (claim.admission && typeof claim.admission === 'object') {
        layers.push('ADMISSION');
        const a = claim.admission;
        const admit = toTime(a.admit_date), disch = toTime(a.discharge_date);
        const birth = claim.patient ? toTime(claim.patient.birth_date) : null;
        if (a.admit_date && admit == null)  add('ADMISSION', 'ERROR', 'C107', null, `admit_date="${a.admit_date}"`);
        if (admit != null && disch != null && admit > disch) add('ADMISSION', 'ERROR', 'C121');
        if (admit != null && birth != null && admit < birth) add('ADMISSION', 'ERROR', 'C120');
    }

    /* ── DX — การวินิจฉัย ── */
    if (claim.diagnosis && typeof claim.diagnosis === 'object') {
        layers.push('DX');
        const d = claim.diagnosis;
        const pdxList = Array.isArray(d.pdx) ? d.pdx : (d.pdx ? [d.pdx] : []);
        if (!pdxList.length)     add('DX', 'ERROR', 'C201');
        if (pdxList.length > 1)  add('DX', 'ERROR', 'C202', null, `pdx ${pdxList.length} รหัส: ${pdxList.join(', ')}`);
        if (pdxList.length === 1 && fund.fund_key === 'IP' && pdxNotForIpd(pdxList[0]))
                                 add('DX', 'ERROR', 'C206', null, `Pdx=${pdxList[0]}`);
    }

    /* ── DRUG — เทียบ TMT / Drug Catalogue ── */
    if (Array.isArray(claim.drugs) && claim.drugs.length) {
        layers.push('DRUG');
        const ids = [...new Set(claim.drugs.map(d => String(d.tmt_id || '').trim()).filter(Boolean))];
        const found = new Map();
        if (ids.length) {
            const [rows] = await pool.query(
                `SELECT tmt_id, fsn, ref_price FROM ref_tmt_drugs
                 WHERE tmt_id IN (?) AND is_active = 1`, [ids]
            );
            rows.forEach(r => found.set(r.tmt_id, r));
        }
        claim.drugs.forEach((d, i) => {
            const id = String(d.tmt_id || '').trim();
            const label = `รายการยา #${i + 1}` + (id ? ` (TMT ${id})` : '');
            if (!(Number(d.qty) > 0)) add('DRUG', 'ERROR', 'C303', null, label);
            if (!id) { add('DRUG', 'ERROR', 'C562', null, `${label} — ไม่ระบุรหัสยา`); return; }
            const ref = found.get(id);
            if (!ref) { add('DRUG', 'ERROR', 'C562', null, `${label} — ไม่พบใน Drug Catalogue`); return; }
            if (ref.ref_price != null && d.price != null
                && Math.abs(Number(d.price) - Number(ref.ref_price)) > 0.005) {
                add('DRUG', 'ERROR', 'C195', null,
                    `${label} ${ref.fsn.slice(0, 60)} — เบิก ${Number(d.price).toFixed(2)} ≠ ราคาอ้างอิง ${Number(ref.ref_price).toFixed(2)} (platform ใหม่ = P124)`);
            }
        });
    }

    /* ── CHARGE ── */
    if (claim.charges && typeof claim.charges === 'object' && claim.charges.total != null) {
        layers.push('CHARGE');
        if (!(Number(claim.charges.total) > 0)) add('CHARGE', 'ERROR', 'C301', null, `total=${claim.charges.total}`);
    }

    /* ── DRG — จัดกลุ่ม + trim point ── */
    if (claim.drg && typeof claim.drg === 'object' && claim.drg.code) {
        layers.push('DRG');
        const version = claim.drg.version
            || (await pool.query(
                   `SELECT version_code FROM ref_drg_versions WHERE is_active = 1
                    ORDER BY effective_from DESC LIMIT 1`))[0][0]?.version_code;
        const [[row]] = await pool.query(
            `SELECT drg_code, description_th, rw, alos, trim_low, trim_high, verified
             FROM ref_drg WHERE version_code = ? AND drg_code = ? AND is_active = 1`,
            [version, String(claim.drg.code)]
        );
        if (!row) {
            add('DRG', 'ERROR', 'C210', null, `DRG ${claim.drg.code} ไม่พบในตาราง ${version || '(ไม่มีเวอร์ชัน)'}`);
        } else {
            const los = Number(claim.admission?.los);
            if (isFinite(los) && row.trim_high != null && los > row.trim_high) {
                add('DRG', 'WARNING', null, 'ENG-DRG-TRIM',
                    `วันนอน ${los} เกินจุดตัดบน ${row.trim_high} ของ ${row.drg_code} (${row.description_th}) — ต้องคิด AdjRW แบบ outlier สูง`);
            }
            if (isFinite(los) && row.trim_low != null && los < row.trim_low) {
                add('DRG', 'WARNING', null, 'ENG-DRG-TRIM',
                    `วันนอน ${los} ต่ำกว่าจุดตัดล่าง ${row.trim_low} ของ ${row.drg_code} — ต้องคิด AdjRW แบบ outlier ต่ำ`);
            }
            if (!row.verified) {
                add('DRG', 'INFO', null, 'ENG-DRG-SRC',
                    `ตาราง DRG ที่ใช้ยังเป็นค่าจำลอง (รอตารางจริงจาก สกส.) — ผล trim เป็นการประมาณ`);
            }
        }
    }

    /* ── เติมข้อความจริง + ที่มา จาก ref_error_codes ── */
    const codes = [...new Set(issues.map(i => i.code).filter(Boolean))];
    const codeMap = new Map();
    if (codes.length) {
        const [rows] = await pool.query(
            `SELECT code, description_th, category, verified, source_doc
             FROM ref_error_codes WHERE system = 'ECLAIM' AND code IN (?)`, [codes]
        );
        rows.forEach(r => codeMap.set(r.code, r));
    }
    for (const it of issues) {
        const ref = it.code ? codeMap.get(it.code) : null;
        it.message  = ref ? ref.description_th
                    : it.detail || 'ไม่ผ่านเงื่อนไขกฎของระบบ';
        it.category = ref ? ref.category : null;
        it.verified = ref ? !!ref.verified : null;
        it.source   = ref ? ref.source_doc : null;
    }

    const count = sev => issues.filter(i => i.severity === sev).length;
    return {
        fund: { fund_key: fund.fund_key, label_th: fund.label_th },
        summary: {
            result: count('ERROR') ? 'FAIL' : 'PASS',
            errors: count('ERROR'), warnings: count('WARNING'), info: count('INFO'),
            layers_checked: layers,
        },
        issues,
    };
}

module.exports = { validateClaim, validThaiCid };
