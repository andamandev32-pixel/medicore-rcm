const jwt = require('jsonwebtoken');

// ค่า fallback มีไว้ให้ dev/sandbox เท่านั้น — ถ้าใช้ค่านี้ใน production ใครก็ตามที่เห็น repo
// จะปลอม token ระดับ ADMIN ได้ จึงต้องหยุดตั้งแต่ตอน start ไม่ใช่ปล่อยผ่านเงียบ ๆ
const DEV_SECRET = 'medicore_secret_key_2026';
const JWT_SECRET = process.env.JWT_SECRET || DEV_SECRET;

if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEV_SECRET) {
    console.error('[auth] ปฏิเสธการเริ่มระบบ: NODE_ENV=production แต่ไม่ได้ตั้ง JWT_SECRET');
    process.exit(1);
}
if (JWT_SECRET === DEV_SECRET) {
    console.warn('[auth] ⚠ ใช้ JWT_SECRET ค่า dev — ห้ามใช้กับข้อมูลผู้ป่วยจริง (ตั้ง env JWT_SECRET)');
}

// ─────────────────────────────────────────────
// requireAuth — ตรวจสอบ JWT ทุก request
// ใช้: router.get('/path', requireAuth, handler)
// ─────────────────────────────────────────────
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อน' });
    }

    const token = authHeader.split(' ')[1];
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ error: 'Token ไม่ถูกต้อง', code: 'INVALID_TOKEN' });
    }
}

// ─────────────────────────────────────────────
// requireRole(...roles) — ตรวจสอบสิทธิ์
// ใช้: router.post('/path', requireAuth, requireRole('DOCTOR','ADMIN'), handler)
// ─────────────────────────────────────────────
// ยึด active_role ตัวเดียว ไม่ดู roles[]
//
// เดิมยอมรับถ้า role อยู่ใน roles[] ด้วย ซึ่งทำให้การสลับบทบาท "ลดสิทธิ์ไม่ได้"
// — superuser ที่ถือครบ 4 role สลับเป็นพยาบาลแล้วยังสั่งยาแทนแพทย์ได้ ปุ่มสลับ
// จึงเป็นแค่การเปลี่ยนป้ายชื่อ ไม่ใช่การเปลี่ยนสิทธิ์
//
// อีกเหตุผลคือ audit: med-admin.js เขียน actor_role ลง log เป็น role เดียว
// ถ้าบังคับด้วย union แต่ log บันทึกตัวเดียว log จะใช้เป็นหลักฐานไม่ได้
//
// ไม่มีความเสี่ยงยกระดับสิทธิ์ เพราะ /auth/switch-role ตรวจ roles[] ก่อนออก
// token ใหม่อยู่แล้ว การแคบลงตรงนี้มีแต่ลดสิทธิ์
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'ไม่ได้เข้าสู่ระบบ' });

        const hasRole = allowedRoles.includes(req.user.active_role);

        if (!hasRole) {
            return res.status(403).json({
                error: `ไม่มีสิทธิ์ดำเนินการ (ต้องการ: ${allowedRoles.join(' หรือ ')})`,
                code: 'FORBIDDEN',
            });
        }
        next();
    };
}

// ─────────────────────────────────────────────
// optionalAuth — ดึง user ถ้ามี token (ไม่ block ถ้าไม่มี)
//   token ผิด/หมดอายุ จะไม่ block เหมือนกัน แต่ **ต้องไม่เงียบ**:
//   ตั้ง req.authError ไว้ให้ handler ตัดสินใจ + log เพื่อให้จับ session หมดอายุได้
//   (เดิมใช้ `catch {}` ทำให้ token หมดอายุแยกไม่ออกจาก "ไม่ได้ส่ง token" —
//    พยาบาลที่ session หมดอายุยังเขียนบันทึกต่อได้โดยระบบเข้าใจว่าเป็น anonymous)
// ─────────────────────────────────────────────
function optionalAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
        try {
            req.user = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            req.authError = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
            console.warn(`[auth] optionalAuth: ${req.authError} — ${req.method} ${req.originalUrl}`);
        }
    }
    next();
}

module.exports = { requireAuth, requireRole, optionalAuth, JWT_SECRET };
