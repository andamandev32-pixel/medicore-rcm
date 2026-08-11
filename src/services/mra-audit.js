/**
 * mra-audit.js — คิดคะแนนคุณภาพการบันทึกเวชระเบียนตามเกณฑ์ MRA (สปสช.)
 *
 * เกณฑ์ฉบับ 2563 ผู้ป่วยใน: 12 องค์ประกอบ
 *   7 องค์ประกอบบังคับทุกเคส · 5 องค์ประกอบเฉพาะเคสที่เข้าเงื่อนไข
 *   เกณฑ์ย่อยข้อละ 1 คะแนน
 *
 * ⭐ กฎการให้คะแนนที่พลาดบ่อย: องค์ประกอบ/เกณฑ์ที่เคสไม่เข้าเงื่อนไข = N/A
 *    ต้อง "ตัดออกจากตัวหาร" ไม่ใช่ให้ 0 คะแนน
 *    (เคสไม่ได้ผ่าตัดแล้วโดนหักเพราะไม่มี operative note = คะแนนผิดความจริง)
 *
 * ⭐ องค์ประกอบที่ยังไม่มีเกณฑ์ย่อยในฐานข้อมูล (รอถอดจากคู่มือฉบับจริง)
 *    จะคิดแบบ "ระดับองค์ประกอบ" 1 คะแนน และติดธง criteria_pending
 *    เพื่อให้หน้าจอบอกได้ว่าคะแนนนี้ยังไม่ละเอียดเท่าคู่มือ
 */

/** โหลดเกณฑ์ของเวอร์ชันหนึ่ง (ค่าเริ่มต้น = ฉบับที่บังคับใช้ล่าสุด) */
async function loadCriteria(pool, versionCode) {
    let version = versionCode;
    if (!version) {
        const [[v]] = await pool.query(
            `SELECT version_code FROM ref_mra_versions WHERE is_active = 1
             ORDER BY effective_from DESC LIMIT 1`
        );
        version = v ? v.version_code : null;
    }
    if (!version) return { version: null, components: [], criteria: [] };

    const [components] = await pool.query(
        `SELECT component_key, seq, name_th, name_en, always_required, needs, max_score, verified
         FROM ref_mra_components WHERE version_code = ? AND is_active = 1 ORDER BY seq`,
        [version]
    );
    const [criteria] = await pool.query(
        `SELECT component_key, criterion_no, text_th, score
         FROM ref_mra_criteria WHERE version_code = ? AND is_active = 1
         ORDER BY component_key, criterion_no`,
        [version]
    );
    return { version, components, criteria };
}

/**
 * คิดคะแนนจากเกณฑ์ + ผลตรวจที่บันทึกไว้
 *
 * @param {object} arg
 *   components  แถวจาก ref_mra_components
 *   criteria    แถวจาก ref_mra_criteria
 *   items       ผลตรวจ [{component_key, criterion_no, state:'OK'|'MISSING'|'NA'}]
 *   context     เงื่อนไขของเคส {proc, consult, anesthesia, labour, rehab}
 */
function scoreAudit({ components = [], criteria = [], items = [], context = {} }) {
    const byComp = new Map();
    for (const c of criteria) {
        if (!byComp.has(c.component_key)) byComp.set(c.component_key, []);
        byComp.get(c.component_key).push(c);
    }
    const stateOf = new Map();
    for (const it of items) stateOf.set(`${it.component_key}/${it.criterion_no || 0}`, it.state);

    let got = 0, max = 0;
    const detail = [];

    for (const comp of components) {
        const applicable = comp.always_required ? true : !!context[comp.needs];
        const rows = byComp.get(comp.component_key) || [];
        const entry = {
            component_key: comp.component_key,
            name_th: comp.name_th,
            applicable,
            criteria_pending: rows.length === 0,     // ยังไม่ได้ถอดเกณฑ์ย่อยจากคู่มือ
            got: 0, max: 0, missing: [],
        };

        if (!applicable) { detail.push(entry); continue; }

        if (rows.length) {
            for (const r of rows) {
                const st = stateOf.get(`${comp.component_key}/${r.criterion_no}`) || 'MISSING';
                if (st === 'NA') continue;           // N/A ตัดออกจากตัวหาร
                entry.max += Number(r.score) || 1;
                if (st === 'OK') entry.got += Number(r.score) || 1;
                else entry.missing.push({ criterion_no: r.criterion_no, text_th: r.text_th });
            }
        } else {
            /* ยังไม่มีเกณฑ์ย่อย → คิดระดับองค์ประกอบ 1 คะแนน */
            const st = stateOf.get(`${comp.component_key}/0`) || 'MISSING';
            if (st !== 'NA') {
                entry.max = 1;
                if (st === 'OK') entry.got = 1;
                else entry.missing.push({ criterion_no: 0, text_th: comp.name_th });
            }
        }

        got += entry.got; max += entry.max;
        detail.push(entry);
    }

    return {
        got, max,
        pct: max > 0 ? Math.round((got / max) * 10000) / 100 : null,
        components: detail,
        pending_components: detail.filter(d => d.applicable && d.criteria_pending).length,
    };
}

/** เงื่อนไขของเคสจากข้อมูล admission — ใช้ตัดสินว่าองค์ประกอบไหนเข้าเกณฑ์ */
function contextFromAdmission({ procedures = [], leave_days = 0, payer = null, flags = {} } = {}) {
    return {
        proc: (procedures || []).length > 0,
        consult: !!flags.consult,
        anesthesia: !!flags.anesthesia,
        labour: !!flags.labour,
        rehab: !!flags.rehab,
        leaveDay: Number(leave_days) > 0,
        payer,
    };
}

module.exports = { loadCriteria, scoreAudit, contextFromAdmission };
