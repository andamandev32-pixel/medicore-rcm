// ============================================================
// API Gateway — default deny
//
// ทุก request ที่ขึ้นต้นด้วย /api ต้องมี JWT ที่ถูกต้อง ยกเว้นรายการใน PUBLIC
// เดิมแต่ละ router รับผิดชอบ auth เอง แล้ว 24 จาก 30 ไฟล์ไม่ได้ทำ — การปฏิเสธ
// เป็นค่าเริ่มต้นแปลว่า router ที่เพิ่มใหม่ในอนาคตปลอดภัยโดยอัตโนมัติ
// ============================================================
const { requireAuth } = require('./auth');

// allowlist ต้องระบุ path เต็มตรง ๆ — ห้าม prefix match เพราะจะเปิดกว้างเกินตั้งใจ
// path ที่เทียบคือ req.path ซึ่ง Express ตัด '/api' ออกให้แล้ว
// ⚠️ ทุกรายการที่นี่ต้องมีกฎ { public: true } คู่กันใน middleware/policy.js
const PUBLIC = [
    { method: 'POST', path: '/auth/login' },
    // render.yaml healthCheckPath ชี้มาที่นี่ — ถ้าโดนบล็อก Render จะ restart วนไม่จบ
    { method: 'GET',  path: '/health' },
    // ข้อมูลอ้างอิงมาตรฐาน (อ่านอย่างเดียว) — มาตรฐานราชการเผยแพร่อยู่แล้ว
    // และหน้าต้นแบบที่ hydrate (mock-refdata.js) ตั้งใจไม่ล็อกอิน
    { method: 'GET',  path: '/reference/error-codes' },
    { method: 'GET',  path: '/reference/files' },
    { method: 'GET',  path: '/reference/file-fields' },
    { method: 'GET',  path: '/reference/fund-files' },
    { method: 'GET',  path: '/reference/drg' },
    { method: 'GET',  path: '/reference/drg-versions' },
    { method: 'GET',  path: '/reference/tmt' },
    { method: 'GET',  path: '/reference/icd10' },
    { method: 'GET',  path: '/reference/icd9' },
    { method: 'GET',  path: '/reference/meta' },
    // ตรวจเคลมกับกฎมาตรฐาน — stateless ไม่เขียน DB (ดูเหตุผลใน routes/reference.js)
    { method: 'POST', path: '/reference/validate' },
];

// log  = บันทึกว่าจะบล็อกอะไร แต่ปล่อยผ่าน (ใช้ตอน rollout ดูว่ามี caller ไหนตกหล่น)
// deny = บังคับจริง
const MODE = process.env.AUTH_ENFORCE || 'deny';

function isPublic(req) {
    return PUBLIC.some(r => r.method === req.method && r.path === req.path);
}

function gateway(req, res, next) {
    if (isPublic(req)) return next();

    if (MODE === 'log') {
        if (!req.headers.authorization) {
            console.warn(`[gateway:log] จะถูกบล็อก: ${req.method} ${req.baseUrl}${req.path}`);
        }
        return next();
    }

    return requireAuth(req, res, next);
}

module.exports = { gateway, PUBLIC, MODE };
