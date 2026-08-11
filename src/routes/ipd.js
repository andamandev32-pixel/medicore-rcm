const express  = require('express');
const router   = express.Router();
const { pool } = require('../database/connection');
const { requireRole } = require('../middleware/auth');
const { auditLog, readAuditLog, assertRev, activeOnly } = require('../services/audit-log');
const { validateClaim, normCode } = require('../services/claim-validator');
const { suggestForClaim } = require('../services/claim-suggester');
const { buildIpdCases } = require('../services/nhso-16files');
const { runRules } = require('../services/rule-runner');
const { loadCriteria, scoreAudit, contextFromAdmission } = require('../services/mra-audit');

// ============================================================
// /api/ipd — ผู้ป่วยในจริง (แทน MockDB('ipd_stays') ฝั่ง browser)
//
// โครงตามแม่แบบ routes/registry.js: dynamic WHERE / transaction / audit /
// soft delete / optimistic lock (rev)
//
// การลงรหัส (dx/หัตถการ/ค่าใช้จ่าย) เป็น replace-set: client ส่งชุดเต็ม
// ระบบลบของเดิมแล้ว insert ใหม่ใต้ธุรกรรมเดียว + rev ของแม่ขยับ — ง่ายและ
// ตรวจสอบได้ (before/after ทั้งชุดอยู่ใน audit_log)
//
// POST /admissions/:id/validate = จุดเดียวที่หน้าจอใช้ตรวจกับ rule engine
// ประกอบ payload จากข้อมูลจริงใน DB ฝั่งเซิร์ฟเวอร์ — client ไม่ต้องประกอบเอง
// ============================================================

const STAFF = ['DOCTOR', 'NURSE', 'PHARMACIST', 'ADMIN'];

/* วันจาก DATETIME ค.ศ. → 'YYYY-MM-DD' (string ตรง ๆ กัน timezone เหลื่อม) */
const dateOnly = v => {
    if (!v) return null;
    if (v instanceof Date) {
        const y = v.getFullYear(), m = String(v.getMonth() + 1).padStart(2, '0'),
              d = String(v.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return String(v).slice(0, 10);
};

const parseJson = (v, fallback) => {
    if (v == null) return fallback;
    if (typeof v === 'object') return v;                    // mysql2 คืน JSON เป็น object อยู่แล้ว
    try { return JSON.parse(v); } catch { return fallback; }
};

/* DATETIME format เป็น string ใน SQL — ปล่อยเป็น Date object แล้ว serialize
   จะเหลื่อม timezone (เที่ยงคืนเวลาไทย → UTC ถอยหลัง 7 ชม.) เหมือนเหตุผลใน reference.js */
const SELECT_COLS = `
    a.admission_id, a.an, a.hn, a.patient_name, a.cid,
    DATE_FORMAT(a.birth_date, '%Y-%m-%d') AS birth_date, a.sex, a.payer,
    a.ward, a.bed,
    DATE_FORMAT(a.admit_at, '%Y-%m-%dT%H:%i') AS admit_at,
    DATE_FORMAT(a.discharge_at, '%Y-%m-%dT%H:%i') AS discharge_at,
    a.discharge_type, a.discharge_status,
    a.leave_days, a.drg_code, a.files_sent, a.file_ctx,
    a.status, a.rev, a.created_at, a.updated_at`;

/* ── โหลด admission + ตารางลูกครบชุด (ใช้ทั้ง GET /:id และ validate) ── */
async function loadAdmission(connOrPool, id) {
    const [[adm]] = await connOrPool.query(
        `SELECT ${SELECT_COLS} FROM ipd_admissions a
         WHERE a.admission_id = ? AND ${activeOnly('a')}`, [id]);
    if (!adm) return null;
    const [dx] = await connOrPool.query(
        `SELECT dx_type, seq, code, name FROM ipd_diagnoses
         WHERE admission_id = ? ORDER BY dx_type = 'PDX' DESC, seq`, [id]);
    const [procs] = await connOrPool.query(
        `SELECT seq, code, name, DATE_FORMAT(proc_date, '%Y-%m-%d') AS proc_date
         FROM ipd_procedures WHERE admission_id = ? ORDER BY seq`, [id]);
    const [charges] = await connOrPool.query(
        `SELECT seq, billgrcs, name, amount, qty FROM ipd_charges
         WHERE admission_id = ? ORDER BY seq`, [id]);
    adm.files_sent = parseJson(adm.files_sent, []);
    adm.file_ctx   = parseJson(adm.file_ctx, {});
    adm.pdx        = dx.find(d => d.dx_type === 'PDX') || null;
    adm.sdx        = dx.filter(d => d.dx_type === 'SDX');
    adm.procedures = procs;
    adm.charges    = charges;
    return adm;
}

// ─────────────────────────────────────────────
// GET /api/ipd/admissions?status=&q=&limit=
// ─────────────────────────────────────────────
router.get('/admissions', async (req, res) => {
    try {
        const conditions = [activeOnly('a')];
        const params = [];
        if (req.query.status && req.query.status !== 'all') {
            conditions.push('a.status = ?'); params.push(req.query.status);
        }
        if (req.query.q) {
            conditions.push('(a.an LIKE ? OR a.hn LIKE ? OR a.patient_name LIKE ?)');
            params.push(`%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`);
        }
        const limit = Math.min(parseInt(req.query.limit) || 200, 500);
        const [rows] = await pool.query(
            `SELECT ${SELECT_COLS},
                    (SELECT code FROM ipd_diagnoses d WHERE d.admission_id = a.admission_id
                      AND d.dx_type = 'PDX' LIMIT 1) AS pdx_code,
                    (SELECT COUNT(*) FROM ipd_diagnoses d WHERE d.admission_id = a.admission_id
                      AND d.dx_type = 'SDX') AS sdx_count,
                    (SELECT COUNT(*) FROM ipd_procedures p WHERE p.admission_id = a.admission_id) AS proc_count,
                    (SELECT COALESCE(SUM(amount), 0) FROM ipd_charges c WHERE c.admission_id = a.admission_id) AS charge_total
             FROM ipd_admissions a
             WHERE ${conditions.join(' AND ')}
             ORDER BY a.admit_at DESC
             LIMIT ?`,
            [...params, limit]
        );
        rows.forEach(r => { r.files_sent = parseJson(r.files_sent, []); r.file_ctx = parseJson(r.file_ctx, {}); });
        res.json(rows);
    } catch (err) {
        console.error('[IPD] GET /admissions', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/ipd/admissions/:id — admission + dx + หัตถการ + ค่าใช้จ่ายครบชุด
// ─────────────────────────────────────────────
router.get('/admissions/:id', async (req, res) => {
    try {
        const adm = await loadAdmission(pool, req.params.id);
        if (!adm) return res.status(404).json({ error: 'ไม่พบ admission นี้' });
        res.json(adm);
    } catch (err) {
        console.error('[IPD] GET /admissions/:id', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/ipd/admissions/:id/history
// ─────────────────────────────────────────────
router.get('/admissions/:id/history', async (req, res) => {
    try {
        res.json(await readAuditLog(pool, 'ipd_admission', req.params.id));
    } catch (err) {
        console.error('[IPD] GET /admissions/:id/history', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// POST /api/ipd/admissions
// body: { an, hn, patient_name, cid?, birth_date?, sex?, payer?, ward?, bed?,
//         admit_at, discharge_at?, discharge_type?, discharge_status?,
//         leave_days?, drg_code?, files_sent?, file_ctx? }
// ─────────────────────────────────────────────
router.post('/admissions', requireRole(...STAFF), async (req, res) => {
    const b = req.body || {};
    const an = String(b.an || '').trim();
    if (!an || !String(b.hn || '').trim() || !String(b.patient_name || '').trim() || !b.admit_at) {
        return res.status(400).json({ error: 'ต้องระบุ an, hn, patient_name, admit_at' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [r] = await conn.query(
            `INSERT INTO ipd_admissions
                 (an, hn, patient_name, cid, birth_date, sex, payer, ward, bed,
                  admit_at, discharge_at, discharge_type, discharge_status, leave_days,
                  drg_code, files_sent, file_ctx, status, created_by, updated_by, rev)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, 0)`,
            [an, String(b.hn).trim(), String(b.patient_name).trim(),
             b.cid || null, b.birth_date || null, b.sex || null, b.payer || null,
             b.ward || null, b.bed || null, b.admit_at, b.discharge_at || null,
             b.discharge_type || null, b.discharge_status || null, Number(b.leave_days) || 0,
             b.drg_code || null,
             JSON.stringify(Array.isArray(b.files_sent) ? b.files_sent : []),
             JSON.stringify(b.file_ctx && typeof b.file_ctx === 'object' ? b.file_ctx : {}),
             req.user.user_id, req.user.user_id]
        );
        await auditLog(conn, {
            entity: 'ipd_admission', entity_id: r.insertId, action: 'CREATE',
            actor: req.user, after: { an, hn: b.hn, patient_name: b.patient_name },
        });
        await conn.commit();
        res.status(201).json({ admission_id: r.insertId, an });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: `AN ${an} มีอยู่แล้ว`, code: 'DUP_AN' });
        }
        console.error('[IPD] POST /admissions', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ─────────────────────────────────────────────
// PUT /api/ipd/admissions/:id — แก้ข้อมูลทั่วไปของ admission (ไม่แตะตารางลูก)
// body: { rev, ...ฟิลด์ที่แก้ }
// ─────────────────────────────────────────────
router.put('/admissions/:id', requireRole(...STAFF), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[before]] = await conn.query(
            `SELECT * FROM ipd_admissions WHERE admission_id = ? AND is_deleted = 0 FOR UPDATE`,
            [req.params.id]);
        if (!before) { await conn.rollback(); return res.status(404).json({ error: 'ไม่พบ admission นี้' }); }
        assertRev(before, req.body.rev);

        const pick = (k, cur) => req.body[k] !== undefined ? req.body[k] : cur;
        const fields = {
            hn: pick('hn', before.hn), patient_name: pick('patient_name', before.patient_name),
            cid: pick('cid', before.cid), birth_date: pick('birth_date', before.birth_date),
            sex: pick('sex', before.sex), payer: pick('payer', before.payer),
            ward: pick('ward', before.ward), bed: pick('bed', before.bed),
            admit_at: pick('admit_at', before.admit_at), discharge_at: pick('discharge_at', before.discharge_at),
            discharge_type: pick('discharge_type', before.discharge_type),
            discharge_status: pick('discharge_status', before.discharge_status),
            leave_days: Number(pick('leave_days', before.leave_days)) || 0,
            drg_code: pick('drg_code', before.drg_code),
            files_sent: req.body.files_sent !== undefined
                ? JSON.stringify(Array.isArray(req.body.files_sent) ? req.body.files_sent : [])
                : before.files_sent,
            file_ctx: req.body.file_ctx !== undefined
                ? JSON.stringify(req.body.file_ctx || {})
                : before.file_ctx,
        };
        await conn.query(
            `UPDATE ipd_admissions SET hn=?, patient_name=?, cid=?, birth_date=?, sex=?, payer=?,
                 ward=?, bed=?, admit_at=?, discharge_at=?, discharge_type=?, discharge_status=?,
                 leave_days=?, drg_code=?, files_sent=?, file_ctx=?, updated_by=?, rev=rev+1
             WHERE admission_id = ?`,
            [...Object.values(fields), req.user.user_id, req.params.id]);

        await auditLog(conn, {
            entity: 'ipd_admission', entity_id: req.params.id, action: 'UPDATE',
            actor: req.user,
            before: { drg_code: before.drg_code, discharge_at: before.discharge_at, leave_days: before.leave_days },
            after:  { drg_code: fields.drg_code, discharge_at: fields.discharge_at, leave_days: fields.leave_days },
        });
        await conn.commit();
        res.json({ success: true, rev: Number(before.rev) + 1 });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'STALE_REV') return res.status(409).json({ error: err.message, code: 'STALE_REV' });
        console.error('[IPD] PUT /admissions/:id', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

/* ── replace-set ตารางลูกใต้ธุรกรรม — ใช้ร่วมระหว่าง /coding และ /charges ── */
async function replaceSet(conn, req, id, work, auditPayload) {
    const [[before]] = await conn.query(
        `SELECT * FROM ipd_admissions WHERE admission_id = ? AND is_deleted = 0 FOR UPDATE`, [id]);
    if (!before) { const e = new Error('ไม่พบ admission นี้'); e.status = 404; throw e; }
    assertRev(before, req.body.rev);
    await work(before);
    await conn.query(
        `UPDATE ipd_admissions SET updated_by = ?, rev = rev + 1 WHERE admission_id = ?`,
        [req.user.user_id, id]);
    await auditLog(conn, { entity: 'ipd_admission', entity_id: id, actor: req.user, ...auditPayload });
    return Number(before.rev) + 1;
}

// ─────────────────────────────────────────────
// PUT /api/ipd/admissions/:id/coding — บันทึกการลงรหัสทั้งชุด (replace-set)
// body: { rev, pdx: {code, name} | null, sdx: [{code, name}], procedures: [{code, name, date}] }
// ─────────────────────────────────────────────
router.put('/admissions/:id/coding', requireRole(...STAFF), async (req, res) => {
    const b = req.body || {};
    const pdx = b.pdx && b.pdx.code ? b.pdx : null;
    const sdx = (Array.isArray(b.sdx) ? b.sdx : []).filter(d => d && d.code);
    const procs = (Array.isArray(b.procedures) ? b.procedures : []).filter(p => p && p.code);

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [beforeDx] = await conn.query(
            `SELECT dx_type, code FROM ipd_diagnoses WHERE admission_id = ?`, [req.params.id]);
        const [beforeProc] = await conn.query(
            `SELECT code FROM ipd_procedures WHERE admission_id = ?`, [req.params.id]);

        const rev = await replaceSet(conn, req, req.params.id, async () => {
            await conn.query(`DELETE FROM ipd_diagnoses WHERE admission_id = ?`, [req.params.id]);
            await conn.query(`DELETE FROM ipd_procedures WHERE admission_id = ?`, [req.params.id]);
            const dxRows = [];
            if (pdx) dxRows.push([req.params.id, 'PDX', 0, String(pdx.code).trim(),
                                  normCode(pdx.code), pdx.name || null]);
            sdx.forEach((d, i) => dxRows.push([req.params.id, 'SDX', i + 1, String(d.code).trim(),
                                               normCode(d.code), d.name || null]));
            if (dxRows.length) {
                await conn.query(
                    `INSERT INTO ipd_diagnoses (admission_id, dx_type, seq, code, code_key, name)
                     VALUES ?`, [dxRows]);
            }
            if (procs.length) {
                await conn.query(
                    `INSERT INTO ipd_procedures (admission_id, seq, code, code_key, name, proc_date)
                     VALUES ?`,
                    [procs.map((p, i) => [req.params.id, i, String(p.code).trim(), normCode(p.code),
                                          p.name || null, p.date || null])]);
            }
        }, {
            action: 'CODING',
            before: { dx: beforeDx, procedures: beforeProc.map(p => p.code) },
            after:  { pdx: pdx?.code || null, sdx: sdx.map(d => d.code), procedures: procs.map(p => p.code) },
        });

        await conn.commit();
        res.json({ success: true, rev });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'STALE_REV') return res.status(409).json({ error: err.message, code: 'STALE_REV' });
        if (err.status === 404) return res.status(404).json({ error: err.message });
        console.error('[IPD] PUT /admissions/:id/coding', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ─────────────────────────────────────────────
// PUT /api/ipd/admissions/:id/charges — บันทึกค่าใช้จ่ายทั้งชุด (replace-set)
// body: { rev, items: [{billgrcs, name, amount, qty?}] }
// ─────────────────────────────────────────────
router.put('/admissions/:id/charges', requireRole(...STAFF), async (req, res) => {
    const items = (Array.isArray(req.body?.items) ? req.body.items : [])
        .filter(it => it && it.amount != null);

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [beforeRows] = await conn.query(
            `SELECT billgrcs, name, amount FROM ipd_charges WHERE admission_id = ?`, [req.params.id]);

        const rev = await replaceSet(conn, req, req.params.id, async () => {
            await conn.query(`DELETE FROM ipd_charges WHERE admission_id = ?`, [req.params.id]);
            if (items.length) {
                await conn.query(
                    `INSERT INTO ipd_charges (admission_id, seq, billgrcs, name, amount, qty)
                     VALUES ?`,
                    [items.map((it, i) => [req.params.id, i, it.billgrcs || null, it.name || null,
                                           Number(it.amount) || 0,
                                           it.qty != null ? Number(it.qty) : null])]);
            }
        }, {
            action: 'CHARGES',
            before: { items: beforeRows },
            after:  { items: items.map(it => ({ billgrcs: it.billgrcs, amount: it.amount })) },
        });

        await conn.commit();
        res.json({ success: true, rev });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'STALE_REV') return res.status(409).json({ error: err.message, code: 'STALE_REV' });
        if (err.status === 404) return res.status(404).json({ error: err.message });
        console.error('[IPD] PUT /admissions/:id/charges', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ─────────────────────────────────────────────
// POST /api/ipd/admissions/:id/validate — ตรวจเคสนี้กับ rule engine + ชั้นเสนอแนะ
//
// ประกอบ payload จากข้อมูลจริงใน DB (อ่านอย่างเดียว ไม่บันทึกอะไร)
// เคสผู้ป่วยในตรวจกับกองทุน NHSO 'IP' เสมอ — payer (UC/OFC/...) เป็นสิทธิผู้ป่วย
// ไม่ใช่ fund_key · เคส PVT ไม่ผ่าน NHSO: ตรวจได้แต่ชั้น FILES จะไม่สื่อความหมาย
// ─────────────────────────────────────────────
/* ── ประกอบ payload สำหรับ rule engine จาก admission ที่โหลดครบชุดแล้ว ── */
function buildClaimFromAdmission(adm) {
    const admitDate = dateOnly(adm.admit_at);
    const dischDate = dateOnly(adm.discharge_at);
    // เคสยังนอนอยู่ นับวันนอนถึงวันนี้ (เหมือน MockIpd.los)
    const endDate = dischDate || dateOnly(new Date());
    let los = null;
    if (admitDate && endDate) {
        const ms = Date.parse(endDate) - Date.parse(admitDate);
        los = Math.round(ms / 86400000) + 1 - (Number(adm.leave_days) || 0);
    }

    const total = adm.charges.reduce((s, c) => s + Number(c.amount || 0), 0);
    return {
        fund_key: 'IP',
        flags: adm.file_ctx,
        files_present: adm.files_sent,
        patient: {
            name: adm.patient_name, birth_date: adm.birth_date, sex: adm.sex,
            cid: adm.cid, hn: adm.hn, an: adm.an,
        },
        admission: {
            admit_date: admitDate, discharge_date: dischDate,
            los, leave_days: Number(adm.leave_days) || 0,
        },
        diagnosis: {
            pdx: adm.pdx ? adm.pdx.code : null,
            sdx: adm.sdx.map(d => d.code),
        },
        procedures: adm.procedures.map(p => ({ code: p.code, date: p.proc_date })),
        charges: adm.charges.length
            ? { total: Number(total.toFixed(2)),
                items: adm.charges.map(c => ({ billgrcs: c.billgrcs, name: c.name,
                                               amount: Number(c.amount), qty: c.qty != null ? Number(c.qty) : undefined })) }
            : undefined,
        drg: adm.drg_code ? { code: adm.drg_code } : undefined,
    };
}

/** ผลตรวจเวชระเบียน/เอกสารของ admission (ถ้าเคยบันทึกไว้) — ใช้ป้อนให้ rule-runner */
async function loadAuditRows(id) {
    const [[audit]] = await pool.query(
        `SELECT audit_id, mra_version, rev FROM ipd_audits
         WHERE admission_id = ? AND is_deleted = 0`, [id]);
    if (!audit) return { audit: null, chartItems: [], fundChecks: [] };
    const [chartItems] = await pool.query(
        `SELECT component_key, criterion_no, state, note FROM ipd_chart_audit_items
         WHERE audit_id = ? ORDER BY component_key, criterion_no`, [audit.audit_id]);
    const [fundChecks] = await pool.query(
        `SELECT check_key, state, note FROM ipd_fund_checks
         WHERE audit_id = ? ORDER BY check_key`, [audit.audit_id]);
    return { audit, chartItems, fundChecks };
}

async function validateAdmission(id) {
    const adm = await loadAdmission(pool, id);
    if (!adm) return null;
    const claim = buildClaimFromAdmission(adm);
    const result = await validateClaim(pool, claim);
    result.suggestions = await suggestForClaim(pool, claim, result.fund);
    result.summary.suggestions = result.suggestions.length;
    result.claim = claim;   // ให้หน้าจอ/ผู้ตรวจเห็นว่า engine ตรวจจากข้อมูลชุดไหน

    /* ── รันคลังกฎของโรงพยาบาลต่อจากกฎมาตรฐาน ──
       ป้อนผลตรวจเวชระเบียน/เอกสารที่บันทึกไว้เข้าไปด้วย ไม่งั้น checker
       ที่ต้องใช้ข้อมูลพวกนี้จะได้ SKIPPED ตลอด (ตามสัญญาใน rule-runner) */
    const { chartItems, fundChecks } = await loadAuditRows(id);
    result.rules = await runRules(pool, {
        claim,
        validation: result,
        suggestions: result.suggestions,
        as_of: claim.admission.discharge_date || claim.admission.admit_date || null,
        payer_key: adm.payer || null,
        service_type: 'IPD',
        mraItems: chartItems.length ? chartItems : null,
        fundChecks: fundChecks.length ? fundChecks : null,
    });
    result.summary.rule_hits = result.rules.summary.hits;
    result.summary.rule_coverage_pct = result.rules.summary.coverage_pct;
    return result;
}

router.post('/admissions/:id/validate', async (req, res) => {
    try {
        const result = await validateAdmission(req.params.id);
        if (!result) return res.status(404).json({ error: 'ไม่พบ admission นี้' });
        res.json(result);
    } catch (err) {
        if (err.status === 400) return res.status(400).json({ error: err.message });
        console.error('[IPD] POST /admissions/:id/validate', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/ipd/admissions/:id/audit
// ผลตรวจเวชระเบียนตามเกณฑ์ MRA + เอกสารตามสิทธิ พร้อมตัวเกณฑ์ที่บังคับใช้
// เคสที่ยังไม่เคยตรวจก็คืนโครงเกณฑ์ให้ (ผู้ใช้จะได้เห็นว่าต้องตรวจอะไรบ้าง)
// ─────────────────────────────────────────────
router.get('/admissions/:id/audit', async (req, res) => {
    try {
        const adm = await loadAdmission(pool, req.params.id);
        if (!adm) return res.status(404).json({ error: 'ไม่พบ admission นี้' });

        const { audit, chartItems, fundChecks } = await loadAuditRows(req.params.id);
        const { version, components, criteria } = await loadCriteria(pool, audit && audit.mra_version);
        const context = contextFromAdmission({
            procedures: adm.procedures, leave_days: adm.leave_days,
            payer: adm.payer, flags: adm.file_ctx || {},
        });
        const score = scoreAudit({ components, criteria, items: chartItems, context });

        /* เอกสารที่สิทธินี้บังคับ + สถานะที่บันทึกไว้ */
        const [payerDocs] = await pool.query(
            `SELECT check_key, label_th, required, seq FROM ref_payer_docs
             WHERE payer_key = ? AND is_active = 1 ORDER BY seq`, [adm.payer || '']);
        const fundState = new Map(fundChecks.map(f => [f.check_key, f]));

        res.json({
            admission_id: Number(req.params.id), an: adm.an, payer: adm.payer,
            audit: audit ? { audit_id: audit.audit_id, mra_version: audit.mra_version, rev: audit.rev } : null,
            mra_version: version,
            context,
            score,
            components: components.map(c => ({
                ...c,
                applicable: c.always_required ? true : !!context[c.needs],
                criteria: criteria.filter(x => x.component_key === c.component_key),
                criteria_pending: !criteria.some(x => x.component_key === c.component_key),
                items: chartItems.filter(i => i.component_key === c.component_key),
            })),
            fund_checks: payerDocs.map(d => ({
                ...d,
                state: (fundState.get(d.check_key) || {}).state || 'MISSING',
                note: (fundState.get(d.check_key) || {}).note || null,
            })),
        });
    } catch (err) {
        console.error('[IPD] GET /admissions/:id/audit', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// PUT /api/ipd/admissions/:id/audit  (STAFF)
// body: { rev?, mra_version?, chart_items:[{component_key, criterion_no?, state, note?}],
//         fund_checks:[{check_key, state, note?}] }
//
// replace-set ทั้งชุดใต้ธุรกรรมเดียว — แบบเดียวกับ /coding และ /charges
// คะแนนคำนวณจากเกณฑ์ในฐานข้อมูล ไม่รับคะแนนจาก client (กันตัวเลขปลอม)
// ─────────────────────────────────────────────
router.put('/admissions/:id/audit', requireRole('DOCTOR', 'NURSE', 'PHARMACIST', 'ADMIN'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[adm]] = await conn.query(
            `SELECT admission_id, an, payer, leave_days, file_ctx FROM ipd_admissions
             WHERE admission_id = ? AND is_deleted = 0 FOR UPDATE`, [req.params.id]);
        if (!adm) { await conn.rollback(); return res.status(404).json({ error: 'ไม่พบ admission นี้' }); }

        const [[existing]] = await conn.query(
            `SELECT audit_id, rev FROM ipd_audits WHERE admission_id = ? AND is_deleted = 0 FOR UPDATE`,
            [req.params.id]);
        if (existing) assertRev(existing, req.body.rev);

        const { version, components, criteria } = await loadCriteria(conn, req.body.mra_version);
        const [procs] = await conn.query(
            'SELECT seq FROM ipd_procedures WHERE admission_id = ?', [req.params.id]);
        const context = contextFromAdmission({
            procedures: procs, leave_days: adm.leave_days,
            payer: adm.payer, flags: parseJson(adm.file_ctx, {}),
        });

        const chartItems = Array.isArray(req.body.chart_items) ? req.body.chart_items : [];
        const fundItems  = Array.isArray(req.body.fund_checks) ? req.body.fund_checks : [];
        const STATES = ['OK', 'MISSING', 'NA'];
        const clean = s => (STATES.includes(String(s || '').toUpperCase()) ? String(s).toUpperCase() : 'MISSING');

        const score = scoreAudit({ components, criteria, items: chartItems.map(i => ({
            component_key: i.component_key, criterion_no: i.criterion_no || 0, state: clean(i.state),
        })), context });

        const fundApplicable = fundItems.filter(f => clean(f.state) !== 'NA');
        const fundPct = fundApplicable.length
            ? Math.round((fundApplicable.filter(f => clean(f.state) === 'OK').length / fundApplicable.length) * 10000) / 100
            : null;

        let auditId;
        if (existing) {
            auditId = existing.audit_id;
            await conn.query(
                `UPDATE ipd_audits SET mra_version = ?, chart_score = ?, chart_max = ?, chart_pct = ?,
                     fund_pct = ?, note = ?, updated_by = ?, rev = rev + 1
                 WHERE audit_id = ?`,
                [version, score.got, score.max, score.pct, fundPct, req.body.note || null,
                 req.user.user_id, auditId]);
            await conn.query('DELETE FROM ipd_chart_audit_items WHERE audit_id = ?', [auditId]);
            await conn.query('DELETE FROM ipd_fund_checks       WHERE audit_id = ?', [auditId]);
        } else {
            const [ins] = await conn.query(
                `INSERT INTO ipd_audits (admission_id, mra_version, chart_score, chart_max, chart_pct,
                     fund_pct, note, created_by, updated_by, rev)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
                [req.params.id, version, score.got, score.max, score.pct, fundPct,
                 req.body.note || null, req.user.user_id, req.user.user_id]);
            auditId = ins.insertId;
        }

        for (const i of chartItems) {
            if (!i.component_key) continue;
            await conn.query(
                `INSERT INTO ipd_chart_audit_items (audit_id, component_key, criterion_no, state, note)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE state = VALUES(state), note = VALUES(note)`,
                [auditId, i.component_key, i.criterion_no || 0, clean(i.state), i.note || null]);
        }
        for (const f of fundItems) {
            if (!f.check_key) continue;
            await conn.query(
                `INSERT INTO ipd_fund_checks (audit_id, check_key, state, note)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE state = VALUES(state), note = VALUES(note)`,
                [auditId, f.check_key, clean(f.state), f.note || null]);
        }

        await auditLog(conn, {
            entity: 'ipd_admission', entity_id: req.params.id, action: 'AUDIT',
            actor: req.user,
            after: { mra_version: version, chart_pct: score.pct, fund_pct: fundPct,
                     items: chartItems.length, fund_checks: fundItems.length },
            note: `ตรวจเวชระเบียนตามเกณฑ์ ${version || '-'}`,
        });

        await conn.commit();
        res.json({ success: true, audit_id: auditId,
                   rev: existing ? Number(existing.rev) + 1 : 0, score, fund_pct: fundPct });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'STALE_REV') return res.status(409).json({ error: err.message, code: 'STALE_REV' });
        console.error('[IPD] PUT /admissions/:id/audit', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ─────────────────────────────────────────────
// POST /api/ipd/import — นำเข้า 16 แฟ้ม (ส่วนผู้ป่วยใน) แล้วตรวจกับ engine ทันที (FR-01)
//
// body: { files: { IPD: "<เนื้อไฟล์>", PAT?, INS?, IDX?, IOP?, CHA? }, dry_run? }
// เนื้อไฟล์เป็นข้อความ (UI อ่านด้วย FileReader) — คั่น | หรือ , หรือ tab ก็ได้
//
// upsert ด้วย AN: มีแล้ว = อัปเดต admission + แทนที่ dx/หัตถการ/ค่าใช้จ่ายทั้งชุด
// (นำเข้าไฟล์เดิมซ้ำปลอดภัย — BR-08: ระบบไม่เขียนอะไรกลับ HIS)
// dry_run: แปลง+ตรวจอย่างเดียว ไม่เขียน DB — ให้หน้างานดูผลก่อนนำเข้าจริง
// ─────────────────────────────────────────────
router.post('/import', requireRole(...STAFF), async (req, res) => {
    let parsed;
    try {
        parsed = buildIpdCases((req.body && req.body.files) || {});
    } catch (err) {
        return res.status(err.status || 400).json({ error: err.message });
    }
    const dryRun = !!(req.body && req.body.dry_run);
    const results = [];

    try {
        for (const c of parsed.cases) {
            let admissionId = null;
            let action = 'DRY_RUN';

            if (!dryRun) {
                const conn = await pool.getConnection();
                try {
                    await conn.beginTransaction();
                    const [[exists]] = await conn.query(
                        `SELECT admission_id FROM ipd_admissions WHERE an = ? AND is_deleted = 0 FOR UPDATE`,
                        [c.an]);

                    if (exists) {
                        admissionId = exists.admission_id;
                        action = 'UPDATED';
                        await conn.query(
                            `UPDATE ipd_admissions SET hn=?, patient_name=?, cid=?, birth_date=?, sex=?,
                                 payer=COALESCE(?, payer), ward=?, admit_at=?, discharge_at=?,
                                 discharge_type=?, discharge_status=?, leave_days=?, drg_code=?,
                                 files_sent=?, file_ctx=?, updated_by=?, rev=rev+1
                             WHERE admission_id = ?`,
                            [c.hn, c.patient_name, c.cid, c.birth_date, c.sex, c.payer, c.ward,
                             c.admit_at, c.discharge_at, c.discharge_type, c.discharge_status,
                             c.leave_days, c.drg_code, JSON.stringify(c.files_sent),
                             JSON.stringify(c.file_ctx), req.user.user_id, admissionId]);
                        await conn.query(`DELETE FROM ipd_diagnoses WHERE admission_id = ?`, [admissionId]);
                        await conn.query(`DELETE FROM ipd_procedures WHERE admission_id = ?`, [admissionId]);
                        await conn.query(`DELETE FROM ipd_charges WHERE admission_id = ?`, [admissionId]);
                    } else {
                        action = 'CREATED';
                        const [r] = await conn.query(
                            `INSERT INTO ipd_admissions
                                 (an, hn, patient_name, cid, birth_date, sex, payer, ward,
                                  admit_at, discharge_at, discharge_type, discharge_status, leave_days,
                                  drg_code, files_sent, file_ctx, status, created_by, updated_by, rev)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, 0)`,
                            [c.an, c.hn, c.patient_name, c.cid, c.birth_date, c.sex, c.payer, c.ward,
                             c.admit_at, c.discharge_at, c.discharge_type, c.discharge_status,
                             c.leave_days, c.drg_code, JSON.stringify(c.files_sent),
                             JSON.stringify(c.file_ctx), req.user.user_id, req.user.user_id]);
                        admissionId = r.insertId;
                    }

                    const dxRows = [];
                    if (c.pdx) dxRows.push([admissionId, 'PDX', 0, c.pdx.code, normCode(c.pdx.code), c.pdx.name]);
                    c.sdx.forEach((d, i) => dxRows.push([admissionId, 'SDX', i + 1, d.code, normCode(d.code), d.name]));
                    if (dxRows.length) {
                        await conn.query(
                            `INSERT INTO ipd_diagnoses (admission_id, dx_type, seq, code, code_key, name) VALUES ?`,
                            [dxRows]);
                    }
                    if (c.proc.length) {
                        await conn.query(
                            `INSERT INTO ipd_procedures (admission_id, seq, code, code_key, name, proc_date) VALUES ?`,
                            [c.proc.map((p, i) => [admissionId, i, p.code, normCode(p.code), p.name, p.date])]);
                    }
                    if (c.charges.length) {
                        await conn.query(
                            `INSERT INTO ipd_charges (admission_id, seq, billgrcs, name, amount, qty) VALUES ?`,
                            [c.charges.map((ch, i) => [admissionId, i, ch.billgrcs, ch.name, ch.amount, ch.qty])]);
                    }

                    await auditLog(conn, {
                        entity: 'ipd_admission', entity_id: admissionId, action: 'IMPORT',
                        actor: req.user,
                        after: { an: c.an, source: '16files', action,
                                 dx: dxRows.length, proc: c.proc.length, charges: c.charges.length },
                    });
                    await conn.commit();
                } catch (e) {
                    await conn.rollback();
                    throw e;
                } finally {
                    conn.release();
                }
            }

            /* ต่อท่อเข้า rule engine ทันที — ผลตรวจติดไปกับผลนำเข้าเป็นรายเคส */
            let validation = null;
            if (admissionId) {
                validation = await validateAdmission(admissionId);
            } else {
                const claim = buildClaimFromAdmission({
                    ...c, charges: c.charges, procedures: c.proc.map(p => ({ code: p.code, proc_date: p.date })),
                    sdx: c.sdx, pdx: c.pdx, files_sent: c.files_sent, file_ctx: c.file_ctx,
                    admit_at: c.admit_at.replace(' ', 'T'), discharge_at: c.discharge_at ? c.discharge_at.replace(' ', 'T') : null,
                });
                validation = await validateClaim(pool, claim);
                validation.suggestions = await suggestForClaim(pool, claim, validation.fund);
                validation.summary.suggestions = validation.suggestions.length;
            }

            results.push({
                an: c.an, patient_name: c.patient_name, action,
                admission_id: admissionId,
                summary: validation ? validation.summary : null,
                issues: validation ? validation.issues : [],
                suggestions: validation ? validation.suggestions : [],
            });
        }

        res.json({
            dry_run: dryRun,
            imported: results.filter(r => r.action === 'CREATED').length,
            updated:  results.filter(r => r.action === 'UPDATED').length,
            cases: results,
            skipped: parsed.skipped,
        });
    } catch (err) {
        console.error('[IPD] POST /import', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// DELETE /api/ipd/admissions/:id — soft delete
// ─────────────────────────────────────────────
router.delete('/admissions/:id', requireRole(...STAFF), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[before]] = await conn.query(
            `SELECT admission_id, an, patient_name FROM ipd_admissions
             WHERE admission_id = ? AND is_deleted = 0 FOR UPDATE`, [req.params.id]);
        if (!before) { await conn.rollback(); return res.status(404).json({ error: 'ไม่พบ admission นี้' }); }

        await conn.query(
            `UPDATE ipd_admissions SET is_deleted = 1, deleted_by = ?, deleted_at = NOW(), rev = rev + 1
             WHERE admission_id = ?`, [req.user.user_id, req.params.id]);
        await auditLog(conn, {
            entity: 'ipd_admission', entity_id: req.params.id, action: 'DELETE',
            actor: req.user, before, note: req.body?.reason || null,
        });
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        console.error('[IPD] DELETE /admissions/:id', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

module.exports = router;
