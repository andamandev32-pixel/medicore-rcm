require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { testConnection } = require('./database/connection');

// Import routes
const authRoutes     = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const registryRoutes = require('./routes/registry');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));   // 15mb: เผื่อรูปแนบ/annotation base64
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check — ต้องอยู่ก่อน gateway และอยู่ใน PUBLIC ของ gateway ด้วย
// (render.yaml healthCheckPath ชี้มาที่นี่ ถ้าโดน 401 บริการจะ restart วนไม่จบ)
app.get('/api/health', async (req, res) => {
    const dbOk = await testConnection();
    res.json({
        status: dbOk ? 'ok' : 'database_error',
        timestamp: new Date().toISOString(),
    });
});

// ── ประตูเดียวของ API ──
//   gateway      = ตัวตน (ไม่มี JWT = ไม่ผ่าน ยกเว้น allowlist)
//   checkRevoked = token ที่ถูกยกเลิกก่อนหมดอายุ (ปิดบัญชี/เปลี่ยน role)
//   policy       = สิทธิ์ (role ไหนทำอะไรได้ ดู middleware/policy.js)
//
// default-deny: router ที่เพิ่มใหม่ในอนาคตปลอดภัยโดยอัตโนมัติ — ถ้าลืมเพิ่มกฎ
// จะได้ 403 NO_POLICY ไม่ใช่เปิดโล่ง ตรวจความครอบคลุมด้วย: npm run check:policy
const { gateway }      = require('./middleware/gateway');
const { checkRevoked } = require('./middleware/revocation');
const { policy }       = require('./middleware/policy');
app.use('/api', gateway, checkRevoked, policy);

// API Routes
// ⚠️ เพิ่ม mount ใหม่ที่นี่ ต้องเพิ่ม 2 ที่คู่กันเสมอ:
//    1) กฎใน src/middleware/policy.js
//    2) รายการใน scripts/check-policy.js (MOUNTS)
app.use('/api/auth',     authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/registry', registryRoutes);

// ไม่มี SPA route — express.static เสิร์ฟ public/*.html ให้อยู่แล้ว
// วางไฟล์ .html ใน public/ ได้เลย ไม่ต้อง register

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🏥 MediCore Starter running on port ${PORT}`);
    console.log(`   http://localhost:${PORT}`);
    testConnection();
});
