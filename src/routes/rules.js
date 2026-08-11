const express  = require('express');
const router   = express.Router();
const { pool } = require('../database/connection');
const { runRules, checkerKeys } = require('../services/rule-runner');

// ============================================================
// /api/rules — คลังกฎของโรงพยาบาล (อ่านอย่างเดียวในรอบนี้)
//
// หน้าจอสร้าง/แก้/อนุมัติกฎ (maker-checker) ยังไม่เปิดในรอบนี้ —
// ข้อมูลเข้าผ่าน npm run seed:rules เท่านั้น · endpoint เขียนในอนาคตต้องเป็น ADMIN
//
// ⚠️ ห้ามใช้ path param กับ endpoint สาธารณะ — gateway.js เทียบ req.path
//    แบบตรงตัวทั้งเส้น ('/rules/RUL-x' จะไม่ match allowlist แล้วโดน 401)
//    จึงรับพารามิเตอร์ผ่าน query string ทั้งหมด
//
// รูปแบบ response ตามมาตรฐานโปรเจค: array ดิบ · error → 500 { error }
// ============================================================

const D = col => `DATE_FORMAT(${col}, '%Y-%m-%d') AS ${col.replace(/^.*\./, '')}`;

/* กฎ 1 แถวพร้อมขอบเขต + สถานะว่าตรวจอัตโนมัติได้จริงไหม */
const RULE_SELECT = `
    rv.rule_code, rv.version, rv.status, rv.severity, rv.action,
    rv.maps_to_nhso, rv.nhso_system, rv.check_key, rv.params_json,
    rv.blocked_by, rv.doc_id, rv.doc_ref, rv.origin_doc,
    rv.author_ref, rv.approver_ref, ${D('rv.effective_from')}, ${D('rv.effective_to')},
    rv.note, rv.verified,
    rd.name, rd.category, rd.description_th,
    ds.status AS blocker_status, ds.title AS blocker_title,
    doc.title AS doc_title, doc.status AS doc_status,
    (SELECT GROUP_CONCAT(p.payer_key ORDER BY p.payer_key)
       FROM rule_version_payers p WHERE p.rule_version_id = rv.rule_version_id) AS payers,
    (SELECT GROUP_CONCAT(s.service_type ORDER BY s.service_type)
       FROM rule_version_services s WHERE s.rule_version_id = rv.rule_version_id) AS services`;

const RULE_FROM = `
    FROM rule_versions rv
    JOIN rule_definitions rd  ON rd.rule_code = rv.rule_code
    LEFT JOIN ref_doc_sources ds  ON ds.doc_id = rv.blocked_by
    LEFT JOIN ref_doc_sources doc ON doc.doc_id = rv.doc_id`;

/**
 * สถานะการตรวจของกฎ — ต้องตรงกับตรรกะใน rule-runner
 * ใช้ให้หน้าจอขึ้นป้ายได้โดยไม่ต้องรันกฎก่อน
 */
function execState(r) {
    if (r.blocked_by && r.blocker_status !== 'PRESENT') return 'BLOCKED_BY_DOC';
    if (!r.check_key) return 'NOT_IMPLEMENTED';
    return 'EXECUTABLE';
}
const shape = r => ({
    ...r,
    payers:   r.payers   ? r.payers.split(',')   : [],
    services: r.services ? r.services.split(',') : [],
    exec_state: execState(r),
});

// ─────────────────────────────────────────────
// GET /api/rules?status=&payer=&service=&code=&category=&q=&limit=
// ไม่ระบุ status = เอาเฉพาะฉบับล่าสุดของแต่ละกฎ
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { status, payer, service, code, category, q } = req.query;
        const cond = ['rv.is_active = 1', 'rd.is_active = 1'];
        const params = [];

        if (status && status !== 'all') { cond.push('rv.status = ?');   params.push(status); }
        if (code)     { cond.push('rv.rule_code = ?');  params.push(code); }
        if (category) { cond.push('rd.category = ?');   params.push(category); }
        if (payer) {
            cond.push(`EXISTS (SELECT 1 FROM rule_version_payers p
                               WHERE p.rule_version_id = rv.rule_version_id AND p.payer_key = ?)`);
            params.push(payer);
        }
        if (service) {
            cond.push(`EXISTS (SELECT 1 FROM rule_version_services s
                               WHERE s.rule_version_id = rv.rule_version_id AND s.service_type = ?)`);
            params.push(service);
        }
        if (q) { cond.push('(rv.rule_code LIKE ? OR rd.name LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
        /* ไม่เจาะจงกฎ/สถานะ = แสดงฉบับล่าสุดของแต่ละกฎ ไม่งั้นรายการจะซ้ำหลายฉบับ */
        if (!code && !status) {
            cond.push(`rv.version = (SELECT MAX(v2.version) FROM rule_versions v2
                                     WHERE v2.rule_code = rv.rule_code AND v2.is_active = 1)`);
        }

        const limit = Math.min(parseInt(req.query.limit) || 200, 500);
        const [rows] = await pool.query(
            `SELECT ${RULE_SELECT} ${RULE_FROM}
             WHERE ${cond.join(' AND ')}
             ORDER BY rv.rule_code, rv.version DESC
             LIMIT ?`,
            [...params, limit]
        );
        res.json(rows.map(shape));
    } catch (err) {
        console.error('[Rules] GET /', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/rules/versions?code=  — ทุกฉบับของกฎหนึ่ง (BR-02 ไล่ดูย้อนหลังได้)
// ─────────────────────────────────────────────
router.get('/versions', async (req, res) => {
    try {
        if (!req.query.code) return res.status(400).json({ error: 'ต้องระบุ code' });
        const [rows] = await pool.query(
            `SELECT ${RULE_SELECT} ${RULE_FROM}
             WHERE rv.rule_code = ? AND rv.is_active = 1
             ORDER BY rv.version DESC`,
            [req.query.code]
        );
        res.json(rows.map(shape));
    } catch (err) {
        console.error('[Rules] GET /versions', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/rules/conditions?code=&version=
// เงื่อนไขเชิงเอกสาร (ให้คนอ่าน) — ไม่ใช่สิ่งที่ระบบ execute
// ─────────────────────────────────────────────
router.get('/conditions', async (req, res) => {
    try {
        if (!req.query.code) return res.status(400).json({ error: 'ต้องระบุ code' });
        const params = [req.query.code];
        let verCond = `rv.version = (SELECT MAX(v2.version) FROM rule_versions v2
                                     WHERE v2.rule_code = rv.rule_code AND v2.is_active = 1)`;
        if (req.query.version) { verCond = 'rv.version = ?'; params.push(req.query.version); }

        const [rows] = await pool.query(
            `SELECT rv.rule_code, rv.version, c.seq, c.join_op, c.field, c.op, c.value
             FROM rule_conditions c
             JOIN rule_versions rv ON rv.rule_version_id = c.rule_version_id
             WHERE rv.rule_code = ? AND ${verCond}
             ORDER BY c.seq`,
            params
        );
        res.json(rows);
    } catch (err) {
        console.error('[Rules] GET /conditions', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/rules/templates
// ─────────────────────────────────────────────
router.get('/templates', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT template_key, icon, name_th, description_th, maps_to_nhso, check_key, seq
             FROM rule_templates WHERE is_active = 1 ORDER BY seq`
        );
        const known = new Set(checkerKeys());
        res.json(rows.map(r => ({ ...r, implemented: !!r.check_key && known.has(r.check_key) })));
    } catch (err) {
        console.error('[Rules] GET /templates', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/rules/coverage
// ⭐ ตัวเลขที่ต้องโชว์แทนคำว่า "ผ่านกฎทั้งหมด" — บอกว่าคลังกฎตรวจอัตโนมัติได้จริงกี่ข้อ
// ─────────────────────────────────────────────
router.get('/coverage', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT rv.rule_code, rv.version, rv.status, rv.check_key, rv.blocked_by,
                    rd.name, rd.category, ds.status AS blocker_status
             FROM rule_versions rv
             JOIN rule_definitions rd ON rd.rule_code = rv.rule_code
             LEFT JOIN ref_doc_sources ds ON ds.doc_id = rv.blocked_by
             WHERE rv.is_active = 1 AND rd.is_active = 1
               AND rv.version = (SELECT MAX(v2.version) FROM rule_versions v2
                                 WHERE v2.rule_code = rv.rule_code AND v2.is_active = 1)
             ORDER BY rv.rule_code`
        );
        const known = new Set(checkerKeys());
        const byRule = rows.map(r => {
            let state = execState(r);
            /* check_key ที่ไม่มีในโค้ด = คลังกฎกับ registry ไม่ตรงกัน ต้องเห็นชัด */
            if (state === 'EXECUTABLE' && !known.has(r.check_key)) state = 'MISSING_CHECKER';
            return { rule_code: r.rule_code, name: r.name, category: r.category,
                     status: r.status, check_key: r.check_key, exec_state: state };
        });
        const active = byRule.filter(r => r.status === 'ACTIVE');
        const n = (arr, s) => arr.filter(r => r.exec_state === s).length;

        res.json({
            checkers_available: checkerKeys(),
            total: byRule.length,
            active: {
                total: active.length,
                executable: n(active, 'EXECUTABLE'),
                not_implemented: n(active, 'NOT_IMPLEMENTED'),
                blocked_by_doc: n(active, 'BLOCKED_BY_DOC'),
                missing_checker: n(active, 'MISSING_CHECKER'),
                pct: active.length ? Math.round((n(active, 'EXECUTABLE') / active.length) * 100) : 0,
            },
            rules: byRule,
        });
    } catch (err) {
        console.error('[Rules] GET /coverage', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// POST /api/rules/run — รันกฎกับเคสหนึ่ง (stateless เหมือน /reference/validate)
// body: { claim, as_of?, payer_key?, service_type?, mra_items?, fund_checks? }
// ─────────────────────────────────────────────
router.post('/run', async (req, res) => {
    try {
        const b = req.body || {};
        if (!b.claim || typeof b.claim !== 'object') {
            return res.status(400).json({ error: 'ต้องส่ง claim ใน body' });
        }
        const result = await runRules(pool, {
            claim: b.claim,
            as_of: b.as_of || null,
            payer_key: b.payer_key || null,
            service_type: b.service_type || null,
            mraItems: b.mra_items || null,
            fundChecks: b.fund_checks || null,
        });
        res.json(result);
    } catch (err) {
        console.error('[Rules] POST /run', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
