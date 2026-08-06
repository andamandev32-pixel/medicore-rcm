/**
 * MediCore RCM — MOCK ADMIN (ผู้ใช้ สิทธิ์ Mapping Integration Config Audit)
 * ------------------------------------------------------------
 * บทบาททั้ง 9 มาจาก SRS §2 · เมทริกซ์สิทธิ์สะท้อน BR-05
 * (ผู้สร้างกฎไม่ควรอนุมัติกฎของตนเอง — Rule Editor ไม่มีสิทธิ์ APPROVE_RULE)
 *
 * โหลดไฟล์นี้ในทุกหน้าที่ต้องแสดง "ชื่อผู้รับผิดชอบ" จากรหัส U-xxx
 */

const MOCK_ROLES = [
    { key: 'EXEC',     label: 'ผู้บริหาร/เจ้าของกระบวนการ', duty: 'กำหนดเป้าหมาย นโยบาย ตัวชี้วัด และอนุมัติขอบเขต' },
    { key: 'OFFICER',  label: 'Claim Officer',            duty: 'ตรวจรายการ แก้ไข ประสานงาน บันทึก Reject และเสนอปรับกฎ' },
    { key: 'EDITOR',   label: 'Rule Editor',              duty: 'สร้าง/แก้ไข Draft Rule และทดสอบย้อนหลัง' },
    { key: 'MED',      label: 'Medical Reviewer',         duty: 'รับรองเงื่อนไขด้านการแพทย์และเหตุผล Clinical' },
    { key: 'FIN',      label: 'Financial Reviewer',       duty: 'รับรองราคา วงเงิน รายการค่าใช้จ่าย และผลกระทบทางการเงิน' },
    { key: 'APPROVER', label: 'Rule Approver',            duty: 'อนุมัติ Version กฎก่อนเปิดใช้' },
    { key: 'SOURCE',   label: 'หน่วยบริการต้นทาง',        duty: 'รับ Task แก้ข้อมูล/เอกสารและตอบกลับ' },
    { key: 'ADMIN',    label: 'System Admin',             duty: 'จัดการการเชื่อมต่อ สิทธิผู้ใช้ และค่าระบบ' },
    { key: 'AUDITOR',  label: 'Auditor',                  duty: 'อ่านข้อมูลและประวัติย้อนหลังโดยแก้ไขไม่ได้' },
];

/** ความสามารถที่ใช้ทำเมทริกซ์สิทธิ์ */
const MOCK_CAPS = [
    { key: 'VIEW_CASE',    label: 'อ่านเคส' },
    { key: 'EDIT_CASE',    label: 'แก้เคส' },
    { key: 'WRITE_RULE',   label: 'เขียนกฎ' },
    { key: 'APPROVE_RULE', label: 'อนุมัติกฎ' },
    { key: 'OVERRIDE',     label: 'Override' },
    { key: 'CONFIG',       label: 'ตั้งค่าระบบ' },
    { key: 'VIEW_AUDIT',   label: 'ดู Audit' },
];

/** true = มีสิทธิ์ · ช่องว่าง = ไม่มี */
const MOCK_ROLE_CAPS = {
    EXEC:     { VIEW_CASE: 1,                                                          VIEW_AUDIT: 1 },
    OFFICER:  { VIEW_CASE: 1, EDIT_CASE: 1 },
    EDITOR:   { VIEW_CASE: 1,               WRITE_RULE: 1 },
    MED:      { VIEW_CASE: 1, EDIT_CASE: 1,                    OVERRIDE: 1 },
    FIN:      { VIEW_CASE: 1, EDIT_CASE: 1,                    OVERRIDE: 1 },
    APPROVER: { VIEW_CASE: 1,                 APPROVE_RULE: 1, OVERRIDE: 1 },
    SOURCE:   { VIEW_CASE: 1, EDIT_CASE: 1 },
    ADMIN:    { VIEW_CASE: 1,                                               CONFIG: 1, VIEW_AUDIT: 1 },
    AUDITOR:  { VIEW_CASE: 1,                                                          VIEW_AUDIT: 1 },
};

const MOCK_USERS = [
    { id: 'U-001', name: 'นพ.ธนวัฒน์ ศรีสุวรรณ',  username: 'exec01',      dept: 'ฝ่ายบริหาร',        roles: ['EXEC'],            active: 1, last_login: '2569-08-06T07:40' },
    { id: 'U-002', name: 'คุณวีระ ทองอินทร์',      username: 'sysadmin',    dept: 'ศูนย์คอมพิวเตอร์',  roles: ['ADMIN'],           active: 1, last_login: '2569-08-06T08:12' },
    { id: 'U-003', name: 'คุณศิริพร ตันติวงศ์',     username: 'claim02',     dept: 'ศูนย์จัดเก็บรายได้', roles: ['OFFICER'],         active: 1, last_login: '2569-08-05T17:22' },
    { id: 'U-004', name: 'คุณพิมพ์ชนก วงศ์อนันต์',  username: 'claim01',     dept: 'ศูนย์จัดเก็บรายได้', roles: ['OFFICER', 'EDITOR'], active: 1, last_login: '2569-08-06T08:30' },
    { id: 'U-005', name: 'คุณกิตติพงษ์ แสนดี',     username: 'ruleedit01',  dept: 'ศูนย์จัดเก็บรายได้', roles: ['EDITOR'],          active: 1, last_login: '2569-08-06T08:05' },
    { id: 'U-006', name: 'พญ.ชลธิชา ภักดีวงศ์',    username: 'medrev01',    dept: 'องค์กรแพทย์',       roles: ['MED'],             active: 1, last_login: '2569-08-05T15:48' },
    { id: 'U-007', name: 'คุณอรทัย เจริญพร',       username: 'finrev01',    dept: 'ฝ่ายการเงิน',       roles: ['FIN'],             active: 1, last_login: '2569-08-06T09:02' },
    { id: 'U-008', name: 'คุณสุรชัย มั่นคงดี',      username: 'ruleappr01',  dept: 'ศูนย์จัดเก็บรายได้', roles: ['APPROVER'],        active: 1, last_login: '2569-08-04T11:15' },
    { id: 'U-009', name: 'คุณนภาพร ใจงาม',        username: 'source01',    dept: 'เวชระเบียน',        roles: ['SOURCE'],          active: 1, last_login: '2569-08-06T08:44' },
    { id: 'U-010', name: 'คุณเบญจมาศ สุขใจ',      username: 'auditor01',   dept: 'ตรวจสอบภายใน',      roles: ['AUDITOR'],         active: 1, last_login: '2569-08-01T13:30' },
    { id: 'U-011', name: 'คุณธเนศ พูลผล',         username: 'source02',    dept: 'ห้องยา',            roles: ['SOURCE'],          active: 0, last_login: '2569-06-18T10:05' },
];


/* ══════════════════════════════════════════════════════════
   Mapping — ผูกกับงานก่อน UAT ข้อ 5 (Drug & Service Catalogue)
   ══════════════════════════════════════════════════════════ */
const MOCK_MAPPING_KINDS = [
    { key: 'DRUG',    label: 'Drug Catalogue' },
    { key: 'SERVICE', label: 'Service – Procedure' },
    { key: 'RIGHT',   label: 'รหัสสิทธิ – กองทุน' },
];

const MOCK_MAPPINGS = [
    { kind: 'DRUG', his_code: 'DRG-11482', name: 'ยาสารอาหารทางเส้นเลือดที่ใช้ที่ รพ.', stdcode: '338139', billgrcs: '03', price_his: 690, price_std: 420, status: 'MISMATCH', updated: '2569-07-28' },
    { kind: 'DRUG', his_code: 'DRG-10077', name: 'ยาแก้ปวดกลุ่ม NSAIDs',                stdcode: '331002', billgrcs: '03', price_his: 14,  price_std: 14,  status: 'OK',       updated: '2569-06-12' },
    { kind: 'DRUG', his_code: 'DRG-10233', name: 'ยาลดไขมันในเลือด',                    stdcode: '332201', billgrcs: '03', price_his: 22,  price_std: 22,  status: 'OK',       updated: '2569-06-12' },
    { kind: 'DRUG', his_code: 'DRG-13901', name: 'ยาปฏิชีวนะฉีด (กลุ่มพิเศษ)',           stdcode: '338201', billgrcs: '03', price_his: 2100, price_std: 2100, status: 'OK',      updated: '2569-07-02' },
    { kind: 'DRUG', his_code: 'DRG-14556', name: 'ยาพ่นขยายหลอดลม',                     stdcode: '335710', billgrcs: '03', price_his: 490, price_std: 490, status: 'OK',       updated: '2569-07-02' },
    { kind: 'DRUG', his_code: 'DRG-15012', name: 'ยาต้านการแข็งตัวของเลือดชนิดใหม่',     stdcode: '—',      billgrcs: '03', price_his: 1850, price_std: null, status: 'MISSING', updated: '—' },
    { kind: 'SERVICE', his_code: 'SVC-2201', name: 'ค่าห้องตรวจผู้ป่วยนอก',      stdcode: '210045', billgrcs: '01', price_his: 150,  price_std: 150,  status: 'OK',      updated: '2569-05-30' },
    { kind: 'SERVICE', his_code: 'SVC-6108', name: 'ค่าหัตถการส่องกล้องทางเดินอาหาร', stdcode: '620118', billgrcs: '09', price_his: 3200, price_std: 3200, status: 'OK',      updated: '2569-05-30' },
    { kind: 'SERVICE', his_code: 'SVC-6220', name: 'ค่าเครื่องช่วยหายใจ',        stdcode: '620551', billgrcs: '09', price_his: 4800, price_std: 4800, status: 'OK',      updated: '2569-06-20' },
    { kind: 'SERVICE', his_code: 'SVC-5510', name: 'ค่าเอกซเรย์คอมพิวเตอร์สมอง',  stdcode: '551020', billgrcs: '11', price_his: 4800, price_std: 4600, status: 'MISMATCH', updated: '2569-07-19' },
    { kind: 'SERVICE', his_code: 'SVC-8100', name: 'ค่าบริการการแพทย์ฉุกเฉิน',    stdcode: '810001', billgrcs: '14', price_his: 3200, price_std: 3200, status: 'OK',      updated: '2569-07-19' },
    { kind: 'RIGHT', his_code: 'RGT-UC',  name: 'สิทธิหลักประกันสุขภาพแห่งชาติ (บัตรทอง)', stdcode: 'UC',  billgrcs: '—', price_his: null, price_std: null, status: 'OK',      updated: '2569-04-01' },
    { kind: 'RIGHT', his_code: 'RGT-OFC', name: 'สิทธิข้าราชการ (กรมบัญชีกลาง)',          stdcode: 'OFC', billgrcs: '—', price_his: null, price_std: null, status: 'OK',      updated: '2569-04-01' },
    { kind: 'RIGHT', his_code: 'RGT-SSS', name: 'สิทธิประกันสังคม',                      stdcode: 'SSS', billgrcs: '—', price_his: null, price_std: null, status: 'MISSING', updated: '—' },
    { kind: 'RIGHT', his_code: 'RGT-LGO', name: 'สิทธิพนักงานส่วนท้องถิ่น (อปท.)',        stdcode: 'LGO', billgrcs: '—', price_his: null, price_std: null, status: 'OK',      updated: '2569-04-01' },
    { kind: 'RIGHT', his_code: 'RGT-EMS', name: 'สิทธิการแพทย์ฉุกเฉิน',                  stdcode: 'EMS', billgrcs: '—', price_his: null, price_std: null, status: 'MISMATCH', updated: '2569-07-19' },
];

const MOCK_MAPPING_TONE = {
    OK:       { chip: 'sip-chip-success', label: 'ตรงกัน' },
    MISMATCH: { chip: 'sip-chip-danger',  label: 'ไม่ตรงกัน' },
    MISSING:  { chip: 'sip-chip-amber',   label: 'ยังไม่ผูก' },
};


/* ══════════════════════════════════════════════════════════
   Integration
   ══════════════════════════════════════════════════════════ */
const MOCK_INTEGRATIONS = [
    { name: 'HIS — ระบบสารสนเทศโรงพยาบาล', kind: 'Database View', endpoint: 'vw_claim_export (read-only)',
      status: 'active',   last: '2569-08-06T08:30', note: 'อ่านอย่างเดียว — ไม่แก้ข้อมูลต้นทาง (BR-08)' },
    { name: 'NHSO Digital Platform',      kind: 'REST API',      endpoint: 'https://api.nhso.go.th/dp/v2',
      status: 'active',   last: '2569-08-06T08:31', note: 'Test Environment · Client ID nhso-cli-11812-8f2a' },
    { name: 'e-Claim (ระบบเดิม)',          kind: 'File / SFTP',   endpoint: 'sftp://eclaim/outbox',
      status: 'inactive', last: '2569-07-31T23:50', note: 'ใช้คู่ขนานระหว่าง Parallel Run' },
    { name: 'ระบบบัญชีลูกหนี้',            kind: 'File Export',   endpoint: '/exports/ar/*.csv',
      status: 'active',   last: '2569-08-05T22:10', note: 'ส่งออกยอดพึงรับรายงวด' },
];

const MOCK_INTEGRATION_LOG = [
    { at: '2569-08-06T08:31', tone: 'success', title: 'ดึงข้อมูลจาก HIS สำเร็จ',  note: '128 รายการ · แฟ้ม 1–8' },
    { at: '2569-08-06T08:31', tone: 'info',    title: 'ส่งไฟล์เข้า NHSO (API)',   note: 'UploadID A69080600095001 · F001 กำลังตรวจสอบขั้นต้น' },
    { at: '2569-08-05T21:39', tone: 'warning', title: 'ตรวจพบ 5 รายการไม่ผ่าน',   note: 'UploadID A69080500091120 · P124 ×3, P061 ×2' },
    { at: '2569-08-05T21:38', tone: 'success', title: 'ส่งไฟล์เข้า NHSO (API)',   note: 'UploadID A69080500091120 · 412 รายการ' },
    { at: '2569-08-05T22:10', tone: 'info',    title: 'ส่งออกยอดพึงรับให้ระบบบัญชี', note: 'งวด ก.ค. 2569 · 9,884 รายการ' },
    { at: '2569-07-31T23:50', tone: 'danger',  title: 'หยุดใช้ช่องทาง e-Claim เดิม', note: 'เข้าสู่ Parallel Run เต็มรูปแบบ' },
];


/* ══════════════════════════════════════════════════════════
   Configuration
   ══════════════════════════════════════════════════════════ */
const MOCK_CONFIG = {
    sla: [
        { kind: 'แก้ไขข้อมูลเคส',      hours: 24, escalate: 'หัวหน้าหน่วยบริการต้นทาง' },
        { kind: 'ตรวจทางการแพทย์',     hours: 48, escalate: 'หัวหน้าองค์กรแพทย์' },
        { kind: 'ตรวจการเงิน',         hours: 24, escalate: 'หัวหน้าฝ่ายการเงิน' },
        { kind: 'อนุมัติกฎ',           hours: 72, escalate: 'ผู้อำนวยการ' },
        { kind: 'ขอ Override',         hours: 8,  escalate: 'Rule Approver' },
    ],
    risk: [
        { level: 'สูง',   range: '70 – 100', action: 'ระงับส่งอัตโนมัติ + แจ้งหัวหน้างาน' },
        { level: 'กลาง',  range: '40 – 69',  action: 'สร้าง Task ให้แก้ไขก่อนส่ง' },
        { level: 'ต่ำ',   range: '0 – 39',   action: 'แจ้งเตือนอย่างเดียว' },
    ],
    retention: [
        { kind: 'Audit Log',            keep: '7 ปี', note: 'ตามนโยบายตรวจสอบภายใน' },
        { kind: 'ข้อมูลเคสและเอกสาร',   keep: '5 ปี', note: 'ตามรอบอุทธรณ์ของกองทุน' },
        { kind: 'ผลการทดสอบกฎ',        keep: '2 ปี', note: '' },
    ],
    ai: [
        { label: 'ให้ AI ค้นหลักเกณฑ์และแสดงแหล่งอ้างอิง (RAG)',  on: true,  locked: false },
        { label: 'ให้ AI เสนอร่างกฎจากผลตีกลับ',                 on: true,  locked: false },
        { label: 'บังคับแสดง Citation ทุกคำตอบ',                 on: true,  locked: true, note: 'BR-06 — ปิดไม่ได้' },
        { label: 'ให้ AI เปิดใช้กฎเองโดยไม่มีผู้อนุมัติ',          on: false, locked: true, note: 'BR-07 — เปิดไม่ได้' },
        { label: 'ให้ AI อนุมัติเคสทางการแพทย์แทนบุคลากร',        on: false, locked: true, note: 'BR-07 — เปิดไม่ได้' },
    ],
};


/* ══════════════════════════════════════════════════════════
   Audit Trail
   ══════════════════════════════════════════════════════════ */
const MOCK_AUDIT = [
    { id: 'AUD-009120', at: '2569-08-06T08:44', actor: 'U-009', action: 'UPDATE_CASE',  entity: 'CLM-2569-0042',
      before: { 'สถานะเอกสาร': 'ไม่ครบ' }, after: { 'สถานะเอกสาร': 'แนบผลตรวจแล้ว' }, ip: '10.20.4.51' },
    { id: 'AUD-009119', at: '2569-08-06T08:31', actor: 'SYSTEM', action: 'IMPORT',      entity: 'A69080600095001',
      before: {}, after: { 'จำนวนรายการ': 128, 'ช่องทาง': 'API' }, ip: '—' },
    { id: 'AUD-009118', at: '2569-08-06T08:12', actor: 'U-002', action: 'LOGIN',        entity: 'sysadmin',
      before: {}, after: {}, ip: '10.20.1.8' },
    { id: 'AUD-009117', at: '2569-08-05T17:22', actor: 'U-003', action: 'EXPORT',       entity: 'RPT-TX-690805',
      before: {}, after: { 'จำนวนแถว': 412 }, ip: '10.20.4.33' },
    { id: 'AUD-009116', at: '2569-08-05T16:40', actor: 'U-008', action: 'APPROVE_RULE', entity: 'RUL-DRG-007 v3',
      before: { 'สถานะ': 'รอทบทวน' }, after: { 'สถานะ': 'อนุมัติแล้ว', 'วันมีผล': '2569-07-20' }, ip: '10.20.4.12' },
    { id: 'AUD-009115', at: '2569-08-05T15:48', actor: 'U-006', action: 'OVERRIDE',     entity: 'CLM-2569-0055',
      before: { 'ผลตรวจ': 'ต้องอนุมัติ' }, after: { 'ผลตรวจ': 'อนุมัติแล้ว', 'เหตุผล': 'มีความเห็นแพทย์ผู้เชี่ยวชาญประกอบ' }, ip: '10.20.7.4' },
    { id: 'AUD-009114', at: '2569-08-05T11:02', actor: 'U-005', action: 'CREATE_RULE',  entity: 'RUL-ELG-004 v2 (ร่าง)',
      before: {}, after: { 'สถานะ': 'ร่าง', 'ที่มา': 'สร้างจากผลตีกลับ C305' }, ip: '10.20.4.19' },
    { id: 'AUD-009113', at: '2569-08-04T11:15', actor: 'U-008', action: 'LOGIN',        entity: 'ruleappr01',
      before: {}, after: {}, ip: '10.20.4.12' },
    { id: 'AUD-009112', at: '2569-08-04T09:30', actor: 'U-002', action: 'CONFIG',       entity: 'SLA — ขอ Override',
      before: { 'ชั่วโมง': 12 }, after: { 'ชั่วโมง': 8 }, ip: '10.20.1.8' },
    { id: 'AUD-009111', at: '2569-08-03T22:55', actor: 'SYSTEM', action: 'IMPORT',      entity: 'A69080300084771',
      before: {}, after: { 'จำนวนรายการ': 455, 'ไม่ผ่าน': 14 }, ip: '—' },
];

const MOCK_AUDIT_ACTION = {
    LOGIN:        { label: 'เข้าสู่ระบบ',    tone: 'info' },
    IMPORT:       { label: 'นำเข้าข้อมูล',   tone: 'info' },
    EXPORT:       { label: 'ส่งออกข้อมูล',   tone: 'warning' },
    UPDATE_CASE:  { label: 'แก้ไขเคส',      tone: '' },
    CREATE_RULE:  { label: 'สร้างกฎ',       tone: 'accent' },
    APPROVE_RULE: { label: 'อนุมัติกฎ',     tone: 'success' },
    OVERRIDE:     { label: 'Override',      tone: 'danger' },
    CONFIG:       { label: 'แก้ค่าระบบ',    tone: 'warning' },
};


/* ── ตัวช่วย ── */
const MockAdmin = {
    users()      { return MockDB.all('users'); },
    user(id)     { return MockDB.byId('users', id); },
    userName(id) { const u = this.user(id); return u ? u.name : (id || '—'); },
    roleLabel(k) { const r = MOCK_ROLES.find(x => x.key === k); return r ? r.label : k; },
    can(roleKey, cap) { return !!(MOCK_ROLE_CAPS[roleKey] || {})[cap]; },

    mappings(kind) { return MOCK_MAPPINGS.filter(m => !kind || m.kind === kind); },

    /** ความครบของ Mapping เป็น % — ใช้บนหน้าผู้ดูแลและผูกกับงานก่อน UAT ข้อ 5 */
    mappingPct() {
        const w = { OK: 1, MISMATCH: 0.5, MISSING: 0 };
        const s = MOCK_MAPPINGS.reduce((a, m) => a + w[m.status], 0);
        return Math.round((s / MOCK_MAPPINGS.length) * 100);
    },
};

MockDB.register('users', MOCK_USERS);
MockDB.register('audit', MOCK_AUDIT);

window.MOCK_ROLES           = MOCK_ROLES;
window.MOCK_CAPS            = MOCK_CAPS;
window.MOCK_ROLE_CAPS       = MOCK_ROLE_CAPS;
window.MOCK_USERS           = MOCK_USERS;
window.MOCK_MAPPING_KINDS   = MOCK_MAPPING_KINDS;
window.MOCK_MAPPINGS        = MOCK_MAPPINGS;
window.MOCK_MAPPING_TONE    = MOCK_MAPPING_TONE;
window.MOCK_INTEGRATIONS    = MOCK_INTEGRATIONS;
window.MOCK_INTEGRATION_LOG = MOCK_INTEGRATION_LOG;
window.MOCK_CONFIG          = MOCK_CONFIG;
window.MOCK_AUDIT           = MOCK_AUDIT;
window.MOCK_AUDIT_ACTION    = MOCK_AUDIT_ACTION;
window.MockAdmin            = MockAdmin;
