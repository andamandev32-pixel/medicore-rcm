// ============================================================
// Revocation — ยกเลิก token ที่ออกไปแล้วได้ภายใน ~60 วินาที
//
// ทางเลือกที่พิจารณา:
//   query DB ทุก request  → ทันใจแต่ +1 query ต่อทุก request และ DB สะดุด
//                            = ล็อกเอาต์ทั้งโรงพยาบาล
//   token สั้น + refresh   → ต้องมี endpoint ใหม่ + refresh loop ฝั่ง client
//   token_version + cache → เลือกอันนี้: 1 คอลัมน์ 1 query ต่อ 60 วิ ค้างไม่เกิน 60 วิ
//
// เมื่อไหร่ที่ต้องการเตะผู้ใช้ออก (ปิดบัญชี/ถอด role/เปลี่ยนรหัส) ให้เรียก
// bumpTokenVersion(userId)
// ============================================================
const { pool } = require('../database/connection');

const TTL_MS = 60 * 1000;

let cache = new Map();      // user_id → { tv, is_active }
let lastRefresh = 0;
let refreshing = null;

async function refresh() {
    const [rows] = await pool.query('SELECT user_id, token_version, is_active FROM users');
    const next = new Map();
    for (const r of rows) {
        next.set(String(r.user_id), { tv: r.token_version | 0, is_active: !!r.is_active });
    }
    cache = next;
    lastRefresh = Date.now();
}

async function ensureFresh() {
    if (Date.now() - lastRefresh < TTL_MS) return;
    if (refreshing) return refreshing;
    refreshing = refresh()
        .catch(err => {
            // ตั้งใจไม่ fail closed: DB สะดุดชั่วขณะไม่ควรล็อกทั้งหอออกกลางเวร
            // ยอมให้ snapshot ค้างต่ออีกระยะ แลกกับความพร้อมใช้งาน
            // (ถ้า snapshot ว่างเปล่าเพราะ refresh แรกล้มเหลว ตัว middleware
            //  จะปล่อยผ่าน — เท่ากับพฤติกรรมก่อนมีระบบนี้ ไม่แย่ลง)
            console.error('[revocation] refresh ล้มเหลว ใช้ snapshot เดิมต่อ:', err.message);
            lastRefresh = Date.now();   // กันยิงรัวตอน DB ล่ม
        })
        .finally(() => { refreshing = null; });
    return refreshing;
}

// middleware — ใช้ต่อจาก gateway (ต้องมี req.user แล้ว)
async function checkRevoked(req, res, next) {
    if (!req.user || req.user.user_id == null) return next();

    try {
        await ensureFresh();
    } catch { /* ensureFresh กลืน error ไว้แล้ว */ }

    const row = cache.get(String(req.user.user_id));
    if (!row) return next();          // ยังไม่มี snapshot → ไม่ตัดสิน

    if (!row.is_active) {
        return res.status(401).json({ error: 'บัญชีถูกปิดใช้งาน', code: 'TOKEN_REVOKED' });
    }
    // token เก่าที่ออกก่อน bump จะมี tv ต่ำกว่า (token ที่ไม่มี tv ถือเป็น 0)
    if ((req.user.tv | 0) !== row.tv) {
        return res.status(401).json({ error: 'สิทธิ์เปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่', code: 'TOKEN_REVOKED' });
    }
    return next();
}

// เรียกเมื่อปิดบัญชี / เปลี่ยน role / เปลี่ยนรหัสผ่าน
async function bumpTokenVersion(userId) {
    await pool.query('UPDATE users SET token_version = token_version + 1 WHERE user_id = ?', [userId]);
    lastRefresh = 0;   // บังคับ refresh รอบหน้า
}

async function currentTokenVersion(userId) {
    const [[row]] = await pool.query('SELECT token_version FROM users WHERE user_id = ?', [userId]);
    return row ? (row.token_version | 0) : 0;
}

module.exports = { checkRevoked, bumpTokenVersion, currentTokenVersion };
