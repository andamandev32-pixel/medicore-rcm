// ============================================================
// Policy layer — ตารางสิทธิ์กลางของทั้ง API
//
// ทำไมรวมไว้ที่เดียวแทนกระจาย requireRole ตาม router:
//   เพราะมีตารางเดียวจึงเขียนเทสต์เดินทุก route ที่ mount จริง แล้วยืนยันว่า
//   ไม่มี route ไหนหลุดการจัดประเภทได้ (scripts/check-policy.js)
//   ถ้าไม่มีเทสต์ตัวนั้น การใส่ requireRole ตาม router จะดีกว่าเพราะ grep ง่ายกว่า
//   — ตารางนี้จึงมีค่าก็ต่อเมื่อ check-policy ยังรันอยู่
//
// requireRole ที่ใส่ในแต่ละ router เป็นชั้นที่สองและเป็นเอกสารในตัวไฟล์
// ทุกอันต้องแคบกว่าหรือเท่ากับกฎในตารางนี้
//
// ลำดับสำคัญ: match แรกชนะ กฎเฉพาะต้องมาก่อนกฎกว้าง
// เทียบกับ req.path (Express ตัด '/api' ออกแล้ว ไม่มี query string)
// ห้ามเทียบ req.originalUrl เพราะมี query string ติดมา เปิดช่องให้เล่นกับ pattern
// ============================================================

const ADMIN  = 'ADMIN';
const DOCTOR = 'DOCTOR';
const NURSE  = 'NURSE';
const PHARM  = 'PHARMACIST';
const AIDE   = 'NURSE_AIDE';
const FIN    = 'FINANCE';

// ผู้ปฏิบัติงานที่เขียนข้อมูล "คลินิก" ได้
// ⚠️ ไม่มี FINANCE ในนี้โดยตั้งใจ — เจ้าหน้าที่การเงินไม่ควรแก้การลงรหัส/ค่าใช้จ่ายของเคส
const STAFF = [DOCTOR, NURSE, PHARM, ADMIN];
// ทุกคนที่ล็อกอิน (รวมผู้ช่วยและการเงิน — อ่านได้ แต่เขียนไม่ได้)
// FINANCE ต้องอยู่ในนี้ ไม่งั้นใช้ /auth/me · /auth/logout ไม่ได้เลย = ล็อกอินไม่ได้จริง
const ANY   = [DOCTOR, NURSE, PHARM, AIDE, ADMIN, FIN];
// ผู้ที่เขียน/ยืนยัน "เอกสารการเงิน" ได้ — ตั้งหนี้ รับเงิน ตัดยอด ตัดจำหน่าย
const FIN_STAFF = [FIN, ADMIN];

const POLICY = [
    // ── สาธารณะ (ต้องตรงกับ PUBLIC ใน gateway.js) ──
    { m: 'POST', p: /^\/auth\/login$/, public: true },
    { m: 'GET',  p: /^\/health$/,      public: true },

    // ── บัญชีผู้ใช้ตัวเอง ──
    { m: '*', p: /^\/auth\/(me|logout|switch-role)$/, roles: ANY },

    // ── ตั้งค่าระบบ: ADMIN ยกเว้น master data ที่หน้างานต้องอ่าน ──
    //    กฎ GET ต้องมาก่อนกฎ '*' ด้านล่าง (match แรกชนะ)
    { m: 'GET', p: /^\/settings\/(departments|users)(\/|$)/, roles: ANY },
    { m: '*',   p: /^\/settings(\/|$)/,                      roles: [ADMIN] },

    // ── โมดูลตัวอย่าง: ทะเบียนรายการ ──
    //    "ยืนยัน" เป็นการรับผิดชอบทางวิชาชีพ จึงแคบกว่าการแก้ทั่วไป
    //    ต้องอยู่ก่อนกฎ /registry กว้าง
    { m: 'PUT', p: /^\/registry\/[^/]+\/confirm$/, roles: [DOCTOR, ADMIN] },
    { m: 'GET', p: /^\/registry(\/|$)/,            roles: ANY },
    { m: '*',   p: /^\/registry(\/|$)/,            roles: STAFF },

    // ── ข้อมูลอ้างอิงมาตรฐาน: อ่านสาธารณะ (ต้องตรงกับ PUBLIC ใน gateway.js) ──
    //    เป็นมาตรฐานที่ราชการเผยแพร่อยู่แล้ว + หน้าต้นแบบที่ดึงไป hydrate ไม่ล็อกอิน
    //    กฎ '*' ปิดท้ายกันอนาคต: endpoint เขียน (โหลด/แก้ข้อมูลอ้างอิง) ต้องเป็น ADMIN
    { m: 'GET',  p: /^\/reference\/(error-codes|files|file-fields|fund-files|drg|drg-versions|tmt|icd10|icd9|mra|payers|fund-rates|meta)$/, public: true },
    // validate เป็น POST แต่ stateless (คำนวณอย่างเดียว ไม่เขียน DB) — สาธารณะเช่นกัน
    { m: 'POST', p: /^\/reference\/validate$/, public: true },
    { m: '*',    p: /^\/reference(\/|$)/, roles: [ADMIN] },

    // ── คลังกฎ: อ่านสาธารณะ (ต้องตรงกับ PUBLIC ใน gateway.js) ──
    //    หน้าคลังกฎเป็นหน้าต้นแบบที่ไม่ล็อกอิน · /run เป็น POST แต่ stateless
    //    กฎ '*' ปิดท้ายกันอนาคต: การสร้าง/แก้/อนุมัติกฎต้องเป็น ADMIN
    { m: 'GET',  p: /^\/rules\/(versions|conditions|templates|coverage)$/, public: true },
    { m: 'GET',  p: /^\/rules$/,      public: true },
    { m: 'POST', p: /^\/rules\/run$/, public: true },
    { m: '*',    p: /^\/rules(\/|$)/, roles: [ADMIN] },

    // ── ผู้ป่วยใน (admission จริง + การลงรหัส) ──
    //    validate เป็น POST อ่านอย่างเดียวเชิงคำนวณ — เปิดให้ทุก role ที่ล็อกอิน
    //    ต้องอยู่ก่อนกฎ '*' (match แรกชนะ) · การเขียน (ลงรหัส/แก้/ลบ) เป็น STAFF
    { m: 'POST', p: /^\/ipd\/admissions\/[^/]+\/validate$/, roles: ANY },
    { m: 'GET',  p: /^\/ipd(\/|$)/, roles: ANY },
    { m: '*',    p: /^\/ipd(\/|$)/, roles: STAFF },

    // ── การเงิน: บันทึกส่ง–บันทึกรับ + ลูกหนี้รายบุคคล ──
    //    ไม่มี public เลย — เป็นยอดเงินจริงของโรงพยาบาล ไม่ใช่ข้อมูลอ้างอิงที่ราชการเผยแพร่
    //    (หน้าต้นแบบที่ไม่ล็อกอินตกกลับไปใช้ mock เงียบ ๆ ผ่าน mock-findata.js)
    //
    //    อ่านได้ทุก role ที่ล็อกอิน (การเงินต้องเห็นเคส พยาบาลต้องเห็นว่าเคสตัวเองได้เงินยัง)
    //    แต่ "เขียน" ทั้งหมดจำกัดที่ FIN_STAFF — ไม่ใช่ STAFF เพราะการตั้งหนี้/รับเงิน
    //    ไม่ใช่งานของแพทย์หรือพยาบาล และคนที่รับผิดชอบตัวเลขต้องระบุตัวได้ใน audit_log
    //    กฎเฉพาะต้องมาก่อนกฎกว้าง (match แรกชนะ)
    { m: 'PUT',    p: /^\/finance\/(batches|receipts)\/[^/]+\/confirm$/, roles: FIN_STAFF },
    { m: '*',      p: /^\/finance\/adjustments(\/|$)/,                   roles: FIN_STAFF },
    { m: 'GET',    p: /^\/finance(\/|$)/, roles: ANY },
    { m: '*',      p: /^\/finance(\/|$)/, roles: FIN_STAFF },

    // ── ปิดท้าย: อะไรที่ไม่เข้ากฎไหนเลย = ปฏิเสธ ──
    // check-policy.js จะ fail ถ้ามี route ตกมาถึงบรรทัดนี้
    { m: '*', p: /.*/, roles: [], fallthrough: true },
];

function match(method, path) {
    return POLICY.find(r => (r.m === '*' || r.m === method) && r.p.test(path));
}

function policy(req, res, next) {
    const rule = match(req.method, req.path);

    if (rule.public) return next();

    if (rule.fallthrough) {
        console.error(`[policy] ไม่มีกฎครอบคลุม: ${req.method} ${req.baseUrl}${req.path} — ปฏิเสธไว้ก่อน`);
        return res.status(403).json({ error: 'ยังไม่ได้กำหนดสิทธิ์ของเส้นทางนี้', code: 'NO_POLICY' });
    }

    // gateway ทำ authn มาแล้ว แต่กันไว้เผื่อลำดับ mount เปลี่ยน
    if (!req.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อน' });

    if (!rule.roles.includes(req.user.active_role)) {
        return res.status(403).json({
            error: `ไม่มีสิทธิ์ดำเนินการ (ต้องการ: ${rule.roles.join(' หรือ ')})`,
            code: 'FORBIDDEN',
        });
    }
    return next();
}

module.exports = { policy, POLICY, match };
