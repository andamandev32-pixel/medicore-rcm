const express  = require('express');
const router   = express.Router();
const { pool } = require('../database/connection');
const { requireRole } = require('../middleware/auth');
const { nextId } = require('../database/id-gen');
const { auditLog, readAuditLog, assertRev, activeOnly } = require('../services/audit-log');

// ============================================================
// /api/registry — โมดูลตัวอย่าง "ทะเบียนรายการ"
//
// ไฟล์นี้คือแม่แบบของทุกโมดูลในโปรเจค — คัดลอกไปแล้วเปลี่ยนชื่อตาราง/ฟิลด์
// สาธิตครบ: dynamic WHERE / transaction / audit / soft delete / optimistic lock
//
// รูปแบบ response (ต้องเหมือนกันทุก route ในโปรเจค):
//   GET list  → res.json(rows)           array ดิบ ไม่มี envelope
//   GET one   → res.json(row) หรือ 404 { error }
//   POST      → 201 { <id> }
//   PUT/DELETE→ { success: true }
//   error     → 500 { error: err.message }
// ============================================================

const SELECT_COLS = `
    r.registry_item_id, r.item_code, r.item_name, r.department_id,
    r.priority, r.detail, r.status, r.rev,
    r.confirmed_by, r.confirmed_at, r.created_by, r.created_at, r.updated_at,
    d.department_name,
    uc.full_name AS created_by_name,
    uf.full_name AS confirmed_by_name`;

const FROM_JOIN = `
    FROM registry_items r
    LEFT JOIN departments d ON r.department_id = d.department_id
    LEFT JOIN users uc      ON r.created_by    = uc.user_id
    LEFT JOIN users uf      ON r.confirmed_by  = uf.user_id`;

// ─────────────────────────────────────────────
// GET /api/registry?status=&priority=&department_id=&q=&limit=
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { status, priority, department_id, q } = req.query;

        // dynamic WHERE builder — pattern มาตรฐานของโปรเจค
        // activeOnly() ต้องมีเสมอ ไม่งั้นแถวที่ลบไปแล้วจะโผล่กลับมา
        const conditions = [activeOnly('r')];
        const params = [];

        if (status && status !== 'all')   { conditions.push('r.status = ?');        params.push(status); }
        if (priority && priority !== 'all'){ conditions.push('r.priority = ?');     params.push(priority); }
        if (department_id)                { conditions.push('r.department_id = ?'); params.push(department_id); }
        if (q) {
            conditions.push('(r.item_name LIKE ? OR r.item_code LIKE ?)');
            params.push(`%${q}%`, `%${q}%`);
        }

        const limit = Math.min(parseInt(req.query.limit) || 200, 500);

        const [rows] = await pool.query(
            `SELECT ${SELECT_COLS} ${FROM_JOIN}
             WHERE ${conditions.join(' AND ')}
             ORDER BY CASE r.priority WHEN 'URGENT' THEN 0 ELSE 1 END, r.registry_item_id DESC
             LIMIT ?`,
            [...params, limit]
        );
        res.json(rows);
    } catch (err) {
        console.error('[Registry] GET /', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/registry/:id
// ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT ${SELECT_COLS} ${FROM_JOIN}
             WHERE r.registry_item_id = ? AND ${activeOnly('r')}`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'ไม่พบรายการนี้' });
        res.json(rows[0]);
    } catch (err) {
        console.error('[Registry] GET /:id', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/registry/:id/history — ประวัติการแก้ไข
// ─────────────────────────────────────────────
router.get('/:id/history', async (req, res) => {
    try {
        const rows = await readAuditLog(pool, 'registry_item', req.params.id);
        res.json(rows);
    } catch (err) {
        console.error('[Registry] GET /:id/history', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// POST /api/registry
// body: { item_name, department_id?, priority?, detail? }
//
// ใช้ transaction เพราะ gen เลขที่ + insert + audit ต้องสำเร็จหรือล้มพร้อมกัน
// (ถ้า audit หลุดออกนอก transaction จะมี log ของแถวที่ไม่มีจริง)
// ─────────────────────────────────────────────
router.post('/', requireRole('DOCTOR', 'NURSE', 'PHARMACIST', 'ADMIN'), async (req, res) => {
    const { item_name, department_id, priority, detail } = req.body;
    if (!item_name || !String(item_name).trim()) {
        return res.status(400).json({ error: 'กรุณากรอกชื่อรายการ' });
    }
    if (priority && !['ROUTINE', 'URGENT'].includes(priority)) {
        return res.status(400).json({ error: 'priority ต้องเป็น ROUTINE หรือ URGENT' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const code = await nextId(conn, {
            table: 'registry_items', column: 'item_code', prefix: 'RG', pad: 3,
        });

        const [r] = await conn.query(
            `INSERT INTO registry_items
                 (item_code, item_name, department_id, priority, detail,
                  status, created_by, updated_by, rev)
             VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, 0)`,
            [
                code, String(item_name).trim(), department_id || null,
                priority || 'ROUTINE', detail || null,
                req.user.user_id, req.user.user_id,
            ]
        );

        await auditLog(conn, {
            entity: 'registry_item', entity_id: r.insertId, action: 'CREATE',
            actor: req.user,
            after: { item_code: code, item_name, department_id: department_id || null, priority: priority || 'ROUTINE' },
        });

        await conn.commit();
        res.status(201).json({ registry_item_id: r.insertId, item_code: code });
    } catch (err) {
        await conn.rollback();
        console.error('[Registry] POST /', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ─────────────────────────────────────────────
// PUT /api/registry/:id
// body: { rev, item_name?, department_id?, priority?, detail? }
//
// rev บังคับ — กันสองคนเปิดหน้าเดียวกันแล้วเขียนทับกันเงียบ ๆ
// ยืนยันแล้วห้ามแก้เนื้อหา (ต้องสร้างรายการใหม่แทน)
// ─────────────────────────────────────────────
router.put('/:id', requireRole('DOCTOR', 'NURSE', 'PHARMACIST', 'ADMIN'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // FOR UPDATE: ล็อกแถวไว้จนจบธุรกรรม ไม่งั้นสองคนอ่าน rev เดียวกันได้พร้อมกัน
        // แล้วผ่าน assertRev ทั้งคู่ — การเช็ค rev จะไร้ผล
        const [[before]] = await conn.query(
            `SELECT * FROM registry_items WHERE registry_item_id = ? AND is_deleted = 0 FOR UPDATE`,
            [req.params.id]
        );
        if (!before) {
            await conn.rollback();
            return res.status(404).json({ error: 'ไม่พบรายการนี้' });
        }
        if (before.status === 'CONFIRMED') {
            await conn.rollback();
            return res.status(409).json({ error: 'รายการที่ยืนยันแล้วแก้ไขไม่ได้', code: 'ALREADY_CONFIRMED' });
        }

        assertRev(before, req.body.rev);

        const item_name     = req.body.item_name     !== undefined ? String(req.body.item_name).trim() : before.item_name;
        const department_id = req.body.department_id !== undefined ? (req.body.department_id || null)  : before.department_id;
        const priority      = req.body.priority      !== undefined ? req.body.priority                 : before.priority;
        const detail        = req.body.detail        !== undefined ? (req.body.detail || null)         : before.detail;

        if (!item_name) {
            await conn.rollback();
            return res.status(400).json({ error: 'กรุณากรอกชื่อรายการ' });
        }
        if (!['ROUTINE', 'URGENT'].includes(priority)) {
            await conn.rollback();
            return res.status(400).json({ error: 'priority ต้องเป็น ROUTINE หรือ URGENT' });
        }

        await conn.query(
            `UPDATE registry_items
             SET item_name = ?, department_id = ?, priority = ?, detail = ?,
                 updated_by = ?, rev = rev + 1
             WHERE registry_item_id = ?`,
            [item_name, department_id, priority, detail, req.user.user_id, req.params.id]
        );

        await auditLog(conn, {
            entity: 'registry_item', entity_id: req.params.id, action: 'UPDATE',
            actor: req.user,
            before: { item_name: before.item_name, department_id: before.department_id, priority: before.priority, detail: before.detail },
            after:  { item_name, department_id, priority, detail },
        });

        await conn.commit();
        res.json({ success: true, rev: Number(before.rev) + 1 });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'STALE_REV') {
            return res.status(409).json({ error: err.message, code: 'STALE_REV' });
        }
        console.error('[Registry] PUT /:id', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ─────────────────────────────────────────────
// PUT /api/registry/:id/confirm
// การยืนยัน = รับผิดชอบเนื้อหา จึงจำกัดที่ DOCTOR/ADMIN (ดู policy.js)
// ─────────────────────────────────────────────
router.put('/:id/confirm', requireRole('DOCTOR', 'ADMIN'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[before]] = await conn.query(
            `SELECT registry_item_id, status, rev FROM registry_items
             WHERE registry_item_id = ? AND is_deleted = 0 FOR UPDATE`,
            [req.params.id]
        );
        if (!before) {
            await conn.rollback();
            return res.status(404).json({ error: 'ไม่พบรายการนี้' });
        }
        if (before.status === 'CONFIRMED') {
            await conn.rollback();
            return res.status(409).json({ error: 'รายการนี้ยืนยันไปแล้ว', code: 'ALREADY_CONFIRMED' });
        }

        await conn.query(
            `UPDATE registry_items
             SET status = 'CONFIRMED', confirmed_by = ?, confirmed_at = NOW(),
                 updated_by = ?, rev = rev + 1
             WHERE registry_item_id = ?`,
            [req.user.user_id, req.user.user_id, req.params.id]
        );

        await auditLog(conn, {
            entity: 'registry_item', entity_id: req.params.id, action: 'CONFIRM',
            actor: req.user,
            before: { status: before.status }, after: { status: 'CONFIRMED' },
            note: req.body.note || null,
        });

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        console.error('[Registry] PUT /:id/confirm', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ─────────────────────────────────────────────
// DELETE /api/registry/:id — soft delete
// ไม่ลบจริง เพราะ audit ต้องชี้กลับไปที่แถวได้เสมอ
// ─────────────────────────────────────────────
router.delete('/:id', requireRole('DOCTOR', 'NURSE', 'PHARMACIST', 'ADMIN'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[before]] = await conn.query(
            `SELECT registry_item_id, item_code, item_name, status FROM registry_items
             WHERE registry_item_id = ? AND is_deleted = 0 FOR UPDATE`,
            [req.params.id]
        );
        if (!before) {
            await conn.rollback();
            return res.status(404).json({ error: 'ไม่พบรายการนี้' });
        }

        await conn.query(
            `UPDATE registry_items
             SET is_deleted = 1, deleted_by = ?, deleted_at = NOW(), rev = rev + 1
             WHERE registry_item_id = ?`,
            [req.user.user_id, req.params.id]
        );

        await auditLog(conn, {
            entity: 'registry_item', entity_id: req.params.id, action: 'DELETE',
            actor: req.user, before, note: req.body?.reason || null,
        });

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        console.error('[Registry] DELETE /:id', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

module.exports = router;
