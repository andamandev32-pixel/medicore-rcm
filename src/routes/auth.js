const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { pool } = require('../database/connection');
// ใช้ค่าเดียวกับ middleware — ห้ามประกาศ fallback secret ซ้ำที่นี่
// (ของเดิมประกาศซ้ำโดยไม่มี production guard ซึ่งเป็นแบบที่รอดจากการ refactor
//  แล้วเปิดรูกลับมาเงียบ ๆ)
const { JWT_SECRET } = require('../middleware/auth');
const { currentTokenVersion } = require('../middleware/revocation');

const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h'; // 1 shift

// ต้องตรงกับ DS_ROLE_LABEL ใน public/js/ds/ds-navbar.js
const ROLE_LABEL = {
    ADMIN:       'ผู้ดูแลระบบ',
    DOCTOR:      'แพทย์',
    NURSE:       'พยาบาล',
    PHARMACIST:  'เภสัชกร',
    NURSE_AIDE:  'ผู้ช่วยพยาบาล',
};

// ─────────────────────────────────────────────
// POST /api/auth/login
// body: { username, password, role }
// ─────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'กรุณากรอก username และ password' });
    }

    try {
        // 1. ค้นหา user
        const [users] = await pool.query(
            `SELECT u.user_id, u.username, u.password_hash, u.full_name, u.is_active,
                    u.license_no,
                    GROUP_CONCAT(r.role_name ORDER BY r.role_name SEPARATOR ',') AS roles
             FROM users u
             LEFT JOIN user_roles ur ON u.user_id = ur.user_id
             LEFT JOIN roles r       ON ur.role_id = r.role_id
             WHERE u.username = ?
             GROUP BY u.user_id`,
            [username]
        );

        if (!users.length) {
            return res.status(401).json({ error: 'ไม่พบ username นี้ในระบบ' });
        }

        const user = users[0];

        // 2. ตรวจสอบสถานะ
        if (!user.is_active) {
            return res.status(403).json({ error: 'บัญชีนี้ถูกระงับ กรุณาติดต่อผู้ดูแลระบบ' });
        }

        // 3. ตรวจสอบ password
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
        }

        // 4. ตรวจสอบ role ที่เลือก
        const userRoles = user.roles ? user.roles.split(',') : [];
        const activeRole = role && userRoles.includes(role) ? role : userRoles[0];

        if (!activeRole) {
            return res.status(403).json({ error: 'ไม่มีสิทธิ์ในระบบ กรุณาติดต่อผู้ดูแล' });
        }

        // 5. ออก JWT
        // tv = token_version ใช้ยกเลิก token ก่อนหมดอายุ (ดู middleware/revocation.js)
        const payload = {
            user_id:    user.user_id,
            username:   user.username,
            full_name:  user.full_name,
            roles:      userRoles,
            active_role: activeRole,
            license_no: user.license_no,
            tv:         await currentTokenVersion(user.user_id).catch(() => 0),
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        // 6. บันทึก session (optional)
        const expiresAt = new Date(Date.now() + 8 * 3600 * 1000);
        await pool.query(
            `INSERT INTO sessions (session_id, user_id, active_role_id, ip_address, expires_at)
             SELECT UUID(), ?, r.role_id, ?, ?
             FROM roles r WHERE r.role_name = ? LIMIT 1`,
            [user.user_id, req.ip || '127.0.0.1', expiresAt, activeRole]
        ).catch(() => {}); // session logging ไม่ critical

        res.json({
            token,
            user: {
                user_id:    user.user_id,
                username:   user.username,
                full_name:  user.full_name,
                roles:      userRoles,
                active_role: activeRole,
                role_label: ROLE_LABEL[activeRole] || activeRole,
                license_no: user.license_no,
            },
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดของระบบ' });
    }
});

// ─────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────
router.post('/logout', (req, res) => {
    // JWT is stateless — client clears token
    // If using DB sessions, invalidate here
    res.json({ message: 'ออกจากระบบแล้ว' });
});

// ─────────────────────────────────────────────
// GET /api/auth/me   (requires Authorization header)
// ─────────────────────────────────────────────
router.get('/me', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'ไม่พบ token' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({
            user_id:    decoded.user_id,
            username:   decoded.username,
            full_name:  decoded.full_name,
            roles:      decoded.roles,
            active_role: decoded.active_role,
            role_label: ROLE_LABEL[decoded.active_role] || decoded.active_role,
            license_no: decoded.license_no,
        });
    } catch {
        res.status(401).json({ error: 'Token หมดอายุหรือไม่ถูกต้อง' });
    }
});

// ─────────────────────────────────────────────
// POST /api/auth/switch-role
// body: { role }  — เปลี่ยน role ใน session เดิม
// ─────────────────────────────────────────────
router.post('/switch-role', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'ไม่พบ token' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { role } = req.body;

        if (!decoded.roles.includes(role)) {
            return res.status(403).json({ error: 'ไม่มีสิทธิ์ role นี้' });
        }

        // ต้องถอด iat/exp/nbf ออกก่อน sign ใหม่ ไม่งั้น jsonwebtoken จะ throw
        // ("iat" should be a number of seconds / payload already has "exp")
        // ของเดิมส่ง iat: undefined แล้วโดน `catch {}` กลืน — switch-role จึงคืน
        // 401 "Token หมดอายุ" ทุกครั้ง ทั้งที่ token ยังดีอยู่
        const { iat, exp, nbf, ...claims } = decoded;
        const newToken = jwt.sign(
            { ...claims, active_role: role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );

        res.json({
            token: newToken,
            active_role: role,
            role_label: ROLE_LABEL[role] || role,
        });
    } catch (err) {
        console.warn('[auth] switch-role failed:', err.name, err.message);
        if (err.name === 'TokenExpiredError')
            return res.status(401).json({ error: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่', code: 'TOKEN_EXPIRED' });
        res.status(401).json({ error: 'Token ไม่ถูกต้อง', code: 'INVALID_TOKEN' });
    }
});

module.exports = router;
