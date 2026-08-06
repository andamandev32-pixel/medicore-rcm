const express  = require('express');
const router   = express.Router();
const { pool } = require('../database/connection');
const { requireRole } = require('../middleware/auth');
const { bumpTokenVersion } = require('../middleware/revocation');
const { auditLog } = require('../services/audit-log');

// ============================================================
// /api/settings — master data + จัดการผู้ใช้
//
// ด่านจริงอยู่ที่ middleware/policy.js แล้ว (GET = ทุกคน, เขียน = ADMIN)
// requireRole ที่นี่เป็นชั้นที่สองและเป็นเอกสารในตัวไฟล์
// ============================================================

// ─────────────────────────────────────────────
// GET /api/settings/departments
// ─────────────────────────────────────────────
router.get('/departments', async (req, res) => {
    try {
        const conditions = [];
        const params = [];
        if (req.query.active === '1') conditions.push('is_active = 1');

        const [rows] = await pool.query(
            `SELECT department_id, department_name, is_active
             FROM departments
             ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
             ORDER BY department_name`,
            params
        );
        res.json(rows);
    } catch (err) {
        console.error('[Settings] GET /departments', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// POST /api/settings/departments
// ─────────────────────────────────────────────
router.post('/departments', requireRole('ADMIN'), async (req, res) => {
    try {
        const name = (req.body.department_name || '').trim();
        if (!name) return res.status(400).json({ error: 'กรุณากรอกชื่อหน่วยงาน' });

        const [r] = await pool.query(
            'INSERT INTO departments (department_name, is_active) VALUES (?, 1)',
            [name]
        );
        await auditLog(pool, {
            entity: 'department', entity_id: r.insertId, action: 'CREATE',
            actor: req.user, after: { department_name: name },
        });
        res.status(201).json({ department_id: r.insertId });
    } catch (err) {
        console.error('[Settings] POST /departments', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// PUT /api/settings/departments/:id
// ─────────────────────────────────────────────
router.put('/departments/:id', requireRole('ADMIN'), async (req, res) => {
    try {
        const [[before]] = await pool.query(
            'SELECT department_id, department_name, is_active FROM departments WHERE department_id = ?',
            [req.params.id]
        );
        if (!before) return res.status(404).json({ error: 'ไม่พบหน่วยงานนี้' });

        const name     = (req.body.department_name ?? before.department_name).trim();
        const isActive = req.body.is_active === undefined ? before.is_active : (req.body.is_active ? 1 : 0);

        await pool.query(
            'UPDATE departments SET department_name = ?, is_active = ? WHERE department_id = ?',
            [name, isActive, req.params.id]
        );
        await auditLog(pool, {
            entity: 'department', entity_id: req.params.id, action: 'UPDATE',
            actor: req.user, before, after: { department_name: name, is_active: isActive },
        });
        res.json({ success: true });
    } catch (err) {
        console.error('[Settings] PUT /departments/:id', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/settings/users
// ไม่คืน password_hash เด็ดขาด
// ─────────────────────────────────────────────
router.get('/users', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT u.user_id, u.username, u.full_name, u.license_no, u.is_active,
                    u.created_at,
                    GROUP_CONCAT(r.role_name ORDER BY r.role_name SEPARATOR ',') AS roles
             FROM users u
             LEFT JOIN user_roles ur ON u.user_id = ur.user_id
             LEFT JOIN roles r       ON ur.role_id = r.role_id
             GROUP BY u.user_id
             ORDER BY u.user_id`
        );
        res.json(rows.map(r => ({ ...r, roles: r.roles ? r.roles.split(',') : [] })));
    } catch (err) {
        console.error('[Settings] GET /users', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// POST /api/settings/users/:id/set-active
// body: { is_active: 0|1 }
//
// ปิดบัญชีต้อง bumpTokenVersion ด้วย ไม่งั้น token ที่ออกไปแล้วยังใช้ได้
// จนหมดอายุ 8 ชม. — การ "ปิดบัญชี" จะไม่มีผลจริงจนกว่าจะถึงตอนนั้น
// ─────────────────────────────────────────────
router.post('/users/:id/set-active', requireRole('ADMIN'), async (req, res) => {
    try {
        const isActive = req.body.is_active ? 1 : 0;

        if (Number(req.params.id) === Number(req.user.user_id) && !isActive) {
            return res.status(400).json({ error: 'ปิดบัญชีตัวเองไม่ได้' });
        }

        const [[before]] = await pool.query(
            'SELECT user_id, username, is_active FROM users WHERE user_id = ?',
            [req.params.id]
        );
        if (!before) return res.status(404).json({ error: 'ไม่พบผู้ใช้นี้' });

        await pool.query('UPDATE users SET is_active = ? WHERE user_id = ?', [isActive, req.params.id]);
        await bumpTokenVersion(req.params.id);

        await auditLog(pool, {
            entity: 'user', entity_id: req.params.id,
            action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
            actor: req.user, before, after: { ...before, is_active: isActive },
        });

        res.json({ success: true, is_active: isActive });
    } catch (err) {
        console.error('[Settings] POST /users/:id/set-active', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
