const express  = require('express');
const router   = express.Router();
const { pool } = require('../database/connection');
const { validateClaim } = require('../services/claim-validator');
const { suggestForClaim } = require('../services/claim-suggester');

// ============================================================
// /api/reference — ข้อมูลอ้างอิงมาตรฐานการเบิกจ่าย (อ่านอย่างเดียว)
//
// ตาราง ref_* โหลดโดย seed-reference.js / load-tmt.js เท่านั้น
// จึงมีแต่ GET — endpoint เขียนในอนาคตต้องเป็น ADMIN (ดู policy.js)
//
// ทุก GET เป็น public: ข้อมูลคือมาตรฐานที่ราชการเผยแพร่อยู่แล้ว และหน้าต้นแบบ
// (claim-*/nhso-*/ipd-*) ตั้งใจไม่ล็อกอิน — mock-refdata.js ดึงไป hydrate
//
// ไม่มี path param — gateway.js allowlist เทียบ path เต็มตรง ๆ เท่านั้น
// รูปแบบ response ตามมาตรฐานโปรเจค: array ดิบ · error → 500 { error }
// ============================================================

/* คอลัมน์ provenance ที่ส่งให้ทุกชุด — หน้าเว็บใช้ขึ้นป้าย "ยืนยันแล้ว/รอยืนยัน"
   DATE ต้อง format เป็น string ใน SQL — ถ้าปล่อยเป็น Date object แล้ว serialize
   เป็น ISO จะเหลื่อม timezone ไปหนึ่งวัน (DATE เที่ยงคืนเวลาไทย → UTC ถอยหลัง 7 ชม.) */
const D = col => `DATE_FORMAT(${col}, '%Y-%m-%d') AS ${col.replace(/^.*\./, '')}`;
const PROV = `source_doc, source_ref, ${D('source_date')}, verified`;

// ─────────────────────────────────────────────
// GET /api/reference/error-codes?system=&code=&category=&q=&verified=&limit=
// ─────────────────────────────────────────────
router.get('/error-codes', async (req, res) => {
    try {
        const { system, code, category, q, verified } = req.query;
        const conditions = ['is_active = 1'];
        const params = [];

        if (system)   { conditions.push('system = ?');   params.push(system); }
        if (code)     { conditions.push('code = ?');     params.push(code); }
        if (category) { conditions.push('category = ?'); params.push(category); }
        if (verified === '0' || verified === '1') { conditions.push('verified = ?'); params.push(verified); }
        if (q) {
            conditions.push('(code LIKE ? OR description_th LIKE ?)');
            params.push(`%${q}%`, `%${q}%`);
        }

        const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
        const [rows] = await pool.query(
            `SELECT system, code, category, level, file_no, description_th, fix_guidance_th,
                    ${D('effective_from')}, ${D('effective_to')}, ${PROV}
             FROM ref_error_codes
             WHERE ${conditions.join(' AND ')}
             ORDER BY system, code
             LIMIT ?`,
            [...params, limit]
        );
        res.json(rows);
    } catch (err) {
        console.error('[Reference] GET /error-codes', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/reference/files — โครงสร้าง 15 แฟ้ม (รูปทรงเดียวกับ NHSO_FILES ฝั่ง mock)
// ─────────────────────────────────────────────
router.get('/files', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT file_no, group_key, name_th, name_en, description_th, origin,
                    req_count, cond_count, opt_count, field_count,
                    condition_key, condition_label, mapping_status, ${PROV}
             FROM ref_claim_files WHERE is_active = 1 ORDER BY file_no`
        );
        res.json(rows);
    } catch (err) {
        console.error('[Reference] GET /files', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/reference/file-fields?file_no=&requirement=
// (ตารางรายฟิลด์ — เติมข้อมูลเมื่อได้ spec รายฟิลด์จาก สปสช.)
// ─────────────────────────────────────────────
router.get('/file-fields', async (req, res) => {
    try {
        const { file_no, requirement } = req.query;
        const conditions = ['is_active = 1'];
        const params = [];
        if (file_no)     { conditions.push('file_no = ?');     params.push(file_no); }
        if (requirement) { conditions.push('requirement = ?'); params.push(requirement); }

        const [rows] = await pool.query(
            `SELECT file_no, seq, field_code, name_th, requirement, data_type, note, ${PROV}
             FROM ref_claim_file_fields
             WHERE ${conditions.join(' AND ')}
             ORDER BY file_no, seq`,
            params
        );
        res.json(rows);
    } catch (err) {
        console.error('[Reference] GET /file-fields', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/reference/fund-files?fund=
// ประกอบเป็น [{fund_key, label_th, files:[{file_no, requirement}]}] ฝั่งเซิร์ฟเวอร์
// — รูปทรงเดียวกับ NHSO_FUND_FILES ที่หน้าเว็บใช้อยู่
// ─────────────────────────────────────────────
router.get('/fund-files', async (req, res) => {
    try {
        const params = [];
        let where = 'f.is_active = 1 AND m.is_active = 1';
        if (req.query.fund) { where += ' AND f.fund_key = ?'; params.push(req.query.fund); }

        const [rows] = await pool.query(
            `SELECT f.fund_key, f.label_th, f.sort_order, f.verified AS fund_verified,
                    m.file_no, m.requirement
             FROM ref_funds f
             JOIN ref_fund_file_matrix m ON m.fund_key = f.fund_key
             WHERE ${where}
             ORDER BY f.sort_order, m.file_no`,
            params
        );

        const byFund = new Map();
        for (const r of rows) {
            if (!byFund.has(r.fund_key)) {
                byFund.set(r.fund_key, {
                    fund_key: r.fund_key, label_th: r.label_th,
                    verified: r.fund_verified, files: [],
                });
            }
            byFund.get(r.fund_key).files.push({ file_no: r.file_no, requirement: r.requirement });
        }
        res.json([...byFund.values()]);
    } catch (err) {
        console.error('[Reference] GET /fund-files', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/reference/drg-versions
// ─────────────────────────────────────────────
router.get('/drg-versions', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT version_code, label, ${D('effective_from')}, ${D('effective_to')}, ${PROV}
             FROM ref_drg_versions WHERE is_active = 1
             ORDER BY effective_from DESC`
        );
        res.json(rows);
    } catch (err) {
        console.error('[Reference] GET /drg-versions', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/reference/drg?version=&mdc=&drg=&q=&verified=&limit=
// ─────────────────────────────────────────────
router.get('/drg', async (req, res) => {
    try {
        const { version, mdc, drg, q, verified } = req.query;
        const conditions = ['d.is_active = 1'];
        const params = [];

        if (version) { conditions.push('d.version_code = ?'); params.push(version); }
        if (mdc)     { conditions.push('d.mdc = ?');          params.push(mdc); }
        if (drg)     { conditions.push('d.drg_code = ?');     params.push(drg); }
        if (verified === '0' || verified === '1') { conditions.push('d.verified = ?'); params.push(verified); }
        if (q) {
            conditions.push('(d.drg_code LIKE ? OR d.description_th LIKE ? OR d.pdx_codes LIKE ?)');
            params.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }

        const limit = Math.min(parseInt(req.query.limit) || 200, 500);
        const [rows] = await pool.query(
            `SELECT d.version_code, d.drg_code, d.mdc, md.label_th AS mdc_label,
                    d.description_th, d.rw, d.alos, d.trim_low, d.trim_high, d.pdx_codes,
                    d.source_doc, d.source_ref, d.source_date, d.verified
             FROM ref_drg d
             LEFT JOIN ref_mdc md ON md.mdc = d.mdc
             WHERE ${conditions.join(' AND ')}
             ORDER BY d.version_code, d.drg_code
             LIMIT ?`,
            [...params, limit]
        );
        res.json(rows);
    } catch (err) {
        console.error('[Reference] GET /drg', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/reference/tmt?tmt_id= | q= (อย่างน้อย 2 ตัวอักษร) &level=&limit=
// เพดานต่ำกว่าชุดอื่น — ตารางใหญ่และเป็น endpoint สาธารณะ กันโหลดทั้งตาราง
// ─────────────────────────────────────────────
router.get('/tmt', async (req, res) => {
    try {
        const { tmt_id, q, level } = req.query;
        if (!tmt_id && (!q || String(q).trim().length < 2)) {
            return res.status(400).json({ error: 'ต้องระบุ tmt_id หรือ q อย่างน้อย 2 ตัวอักษร' });
        }

        const conditions = ['is_active = 1'];
        const params = [];
        if (tmt_id) { conditions.push('tmt_id = ?'); params.push(tmt_id); }
        else        { conditions.push('(fsn LIKE ? OR tmt_id LIKE ?)'); params.push(`%${q.trim()}%`, `${q.trim()}%`); }
        if (level)  { conditions.push('level = ?'); params.push(level); }

        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const [rows] = await pool.query(
            `SELECT tmt_id, level, fsn, manufacturer, strength, dosage_form, unit_of_use,
                    ref_price, price_source, release_version, ${PROV}
             FROM ref_tmt_drugs
             WHERE ${conditions.join(' AND ')}
             ORDER BY fsn
             LIMIT ?`,
            [...params, limit]
        );
        res.json(rows);
    } catch (err) {
        console.error('[Reference] GET /tmt', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/reference/icd10?code= | q= (อย่างน้อย 2 ตัวอักษร) &limit=
// GET /api/reference/icd9?code=  | q= (อย่างน้อย 2 ตัวอักษร) &limit=
// ใช้ตรวจว่ารหัสมีจริง + autocomplete ช่องลงรหัสหน้า IPD
// code เทียบผ่าน code_key (ตัดจุด) — พิมพ์ 'J18.9' หรือ 'J189' ได้เหมือนกัน
// เพดานต่ำเหมือน /tmt — ตารางเต็มมีหลักหมื่นแถวและเป็น endpoint สาธารณะ
// ─────────────────────────────────────────────
const icdKey = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function icdHandler(table, extraCols) {
    return async (req, res) => {
        try {
            const { code, q } = req.query;
            if (!code && (!q || String(q).trim().length < 2)) {
                return res.status(400).json({ error: 'ต้องระบุ code หรือ q อย่างน้อย 2 ตัวอักษร' });
            }

            const conditions = ['is_active = 1'];
            const params = [];
            if (code) { conditions.push('code_key = ?'); params.push(icdKey(code)); }
            else {
                const term = String(q).trim();
                conditions.push('(code_key LIKE ? OR term_en LIKE ? OR term_th LIKE ?)');
                params.push(`${icdKey(term)}%`, `%${term}%`, `%${term}%`);
            }

            const limit = Math.min(parseInt(req.query.limit) || 50, 100);
            const [rows] = await pool.query(
                `SELECT code, code_key, term_en, term_th, ${extraCols}, ${PROV}
                 FROM ${table}
                 WHERE ${conditions.join(' AND ')}
                 ORDER BY code
                 LIMIT ?`,
                [...params, limit]
            );
            res.json(rows);
        } catch (err) {
            console.error(`[Reference] GET /${table.replace('ref_', '')}`, err);
            res.status(500).json({ error: err.message });
        }
    };
}

router.get('/icd10', icdHandler('ref_icd10', 'sex_limit'));
router.get('/icd9',  icdHandler('ref_icd9',  'operative'));

// ─────────────────────────────────────────────
// GET /api/reference/meta — จำนวนแถว + % ที่ทวนแล้ว + ประวัติการโหลดล่าสุด
// ใช้ขึ้นแดชบอร์ดความครอบคลุมของข้อมูลอ้างอิง (แคตตาล็อก 652 รหัสโหลดถึงไหนแล้ว)
// ─────────────────────────────────────────────
router.get('/meta', async (req, res) => {
    try {
        const counts = {};
        const TABLES = {
            error_codes: 'ref_error_codes',
            claim_files: 'ref_claim_files',
            fund_file_matrix: 'ref_fund_file_matrix',
            drg: 'ref_drg',
            tmt: 'ref_tmt_drugs',
            icd10: 'ref_icd10',
            icd9: 'ref_icd9',
        };
        for (const [key, table] of Object.entries(TABLES)) {
            const [[r]] = await pool.query(
                `SELECT COUNT(*) AS total, COALESCE(SUM(verified), 0) AS verified
                 FROM ${table} WHERE is_active = 1`
            );
            counts[key] = { total: r.total, verified: Number(r.verified) };
        }

        const [releases] = await pool.query(
            `SELECT release_version, release_date, row_count, loaded_at
             FROM ref_tmt_releases ORDER BY loaded_at DESC LIMIT 5`
        );
        const [loads] = await pool.query(
            `SELECT entity_id AS dataset, note, created_at
             FROM audit_log WHERE entity = 'reference' AND action = 'LOAD'
             ORDER BY log_id DESC LIMIT 10`
        );
        res.json({ counts, tmt_releases: releases, recent_loads: loads });
    } catch (err) {
        console.error('[Reference] GET /meta', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// POST /api/reference/validate — ตรวจเคลม 1 เคสกับกฎมาตรฐาน (stateless, ไม่บันทึกอะไร)
//
// body: {
//   fund_key: 'IP',                          // บังคับ — ดูรายการที่ /fund-files
//   flags: { emergency, prenatal, newborn, psych, disability, leaveDay },
//   files_present: [1,2,3,...],              // เลขแฟ้มที่มีในชุดข้อมูล
//   patient: { name, birth_date, sex, cid, hn, an },
//   admission: { admit_date, discharge_date, los, leave_days? },
//   diagnosis: { pdx, sdx? },                // pdx: string หรือ array · sdx: ['I10'] หรือ [{code}]
//   procedures: [{ code, date? }],           // หัตถการ ICD-9-CM (รับ string ตรง ๆ ก็ได้)
//   drugs: [{ tmt_id, price, qty }],
//   charges: { total?, items?: [{ billgrcs, name?, amount, qty? }] },
//   drg: { code, version? },                 // ไม่ระบุ version = เลือกตามวันจำหน่าย (BR-02)
// }
// ทุก section ยกเว้น fund_key เป็น optional — ตรวจเท่าที่ส่งมา
// ผลลัพธ์: { fund, summary, issues[], suggestions[] } — suggestions ไม่กระทบ PASS/FAIL
// เป็น public เพราะอ่านอย่างเดียวเชิงคำนวณ ไม่แตะข้อมูลเคส ไม่เขียนอะไรลง DB
// ─────────────────────────────────────────────
router.post('/validate', async (req, res) => {
    try {
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ error: 'ต้องส่ง JSON body' });
        }
        const result = await validateClaim(pool, req.body);
        // ชั้นเสนอแนะ — แยก array ไม่ปนกับ issues และไม่มีผลต่อ PASS/FAIL
        result.suggestions = await suggestForClaim(pool, req.body, result.fund);
        result.summary.suggestions = result.suggestions.length;
        res.json(result);
    } catch (err) {
        if (err.status === 400) return res.status(400).json({ error: err.message });
        console.error('[Reference] POST /validate', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
