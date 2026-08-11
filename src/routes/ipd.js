const express  = require('express');
const router   = express.Router();
const { pool } = require('../database/connection');
const { requireRole } = require('../middleware/auth');
const { auditLog, readAuditLog, assertRev, activeOnly } = require('../services/audit-log');
const { validateClaim, normCode } = require('../services/claim-validator');
const { suggestForClaim } = require('../services/claim-suggester');

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
router.post('/admissions/:id/validate', async (req, res) => {
    try {
        const adm = await loadAdmission(pool, req.params.id);
        if (!adm) return res.status(404).json({ error: 'ไม่พบ admission นี้' });

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
        const claim = {
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

        const result = await validateClaim(pool, claim);
        result.suggestions = await suggestForClaim(pool, claim, result.fund);
        result.summary.suggestions = result.suggestions.length;
        result.claim = claim;   // ให้หน้าจอ/ผู้ตรวจเห็นว่า engine ตรวจจากข้อมูลชุดไหน
        res.json(result);
    } catch (err) {
        if (err.status === 400) return res.status(400).json({ error: err.message });
        console.error('[IPD] POST /admissions/:id/validate', err);
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
