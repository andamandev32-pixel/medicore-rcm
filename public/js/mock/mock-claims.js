/**
 * MediCore RCM — MOCK CLAIMS (แกนข้อมูลของทั้งต้นแบบ)
 * ------------------------------------------------------------
 * ทุกหน้าดึงเคสจากที่นี่ที่เดียว — Worklist, Case Detail, Dashboard,
 * Task Inbox, Reject Analysis และหน้า NHSO ทั้งหมดฉายจากอาร์เรย์ชุดนี้
 * (ไม่มี MOCK_NHSO_SUBMISSIONS แยก — nhso-submit.js ฉาย MOCK_CLAIMS ที่มี .nhso)
 *
 * ⭐ ฟิลด์ที่สำคัญที่สุดคือ rule_results[].maps_to_nhso
 *    ทำให้หน้าเคสพูดได้ว่า "ถ้าไม่แก้ จะได้ P124 กลับมา"
 *    และหน้า NHSO พูดได้ว่า "เราตรวจพบ P124 ตั้งแต่ก่อนส่ง"
 *    string เดียวกัน สองหน้าจอ เรื่องเดียว
 *
 * ⭐ เคสคู่แฝดที่ตั้งใจเพาะไว้ — เป็นสไลด์ที่ 8 ของ deck
 *    CLM-2569-0042  วงจรใหม่ : กฎเราจับได้ก่อนส่ง แก้จบใน 4 ชม. ยังไม่เคยส่งพัง
 *    CLM-2569-0007  วงจรเดิม : ส่งไปแล้ว NHSO ตอบ P124+L205+C305 วนแก้ 14 วัน
 *
 * วันอ้างอิง: 6 ส.ค. 2569 (MockDB.TODAY) · วันที่ทั้งไฟล์เป็น พ.ศ.
 */

/* ── ข้อความ error/warning จริงจากหน้าจอ NHSO Digital Platform ──
   คัดจาก doc/โครงการ NHSO Digital Platform_Commu_03082026_V4.pdf (3 ส.ค. 2569)
   ห้ามแก้ถ้อยคำ — ความน่าเชื่อถือของการนำเสนออยู่ตรงที่มันตรงกับของจริง

   ⚠️ รหัสทั้งชุดนี้ยังยืนยันกับเนื้อความเอกสารไม่ได้ (อยู่ในภาพสไลด์ที่ดึงข้อความไม่ได้)
      → ทุกหน้าที่แสดงรหัสเหล่านี้ต้องขึ้นป้าย "รอยืนยัน"
      เอกสาร Overview 23 มิ.ย. 2569 น.8 ระบุว่า สปสช. จะรวบรวม "Error ที่พบบ่อย"
      พร้อมแนวทางแก้ไขเผยแพร่ — เมื่อได้แคตตาล็อกจริงมาให้แทนที่ทั้งชุด */
const NHSO_ERR_TEXT = {
    P124: 'พบสาเหตุส่งเบิก ไม่เท่ากับ ราคา Drug Catalogue รบกวนตรวจสอบ แฟ้ม 7 Seq.690014144 '
        + 'หมวดค่าใช้จ่าย ยาสารอาหารทางเส้นเลือดที่ใช้ที่ รพ. (BILLGRCS = 03) STDCODE 338139 '
        + 'รบกวนตรวจสอบข้อมูลพร้อมแก้ไขข้อมูลแล้วส่งเข้ามาใหม่อีกครั้ง',
    L205: 'แฟ้ม 7 Seq.690014144 หมวดค่าใช้จ่าย ยาสารอาหารทางเส้นเลือดที่ใช้ที่ รพ. '
        + '(BILLGRCS = 03) CODESYS 001 ผ่านขั้นตอนการหาข้อมูลยา รพ.',
    C305: 'Approve Code (OFC)/เลขปิดสิทธิ (UCS) ที่บันทึกเบิกในโปรแกรม e-Claim '
        + 'ไม่ตรงกันฐานข้อมูลของหน่วยบริการ',
    P061: 'ไม่พบรหัสหัตถการที่สอดคล้องกับการวินิจฉัยหลัก รบกวนตรวจสอบ แฟ้ม 6 '
        + 'และแก้ไขข้อมูลแล้วส่งเข้ามาใหม่อีกครั้ง',
    P208: 'วันที่รับบริการอยู่นอกช่วงสิทธิที่ตรวจสอบได้ รบกวนตรวจสอบแฟ้ม 1 '
        + 'และยืนยันสิทธิก่อนส่งเบิกอีกครั้ง',
    C112: 'จำนวนวันนอนที่ส่งเบิกไม่สอดคล้องกับวันที่จำหน่ายในแฟ้ม 14 '
        + 'กรุณาตรวจสอบข้อมูลผู้ป่วยในและการลากลับบ้าน (แฟ้ม 15)',
};

/** รหัส error ที่ยืนยันกับเนื้อความเอกสารได้ — ตอนนี้ยังไม่มีสักตัว */
const NHSO_ERR_VERIFIED = new Set();

const NHSO_PROVIDERS = [
    { name: 'ศูนย์บริการสาธารณสุข 12 (กทม.)', code: '11812' },
    { name: 'โรงพยาบาลกลาง',                  code: '10670' },
    { name: 'คลินิกชุมชนอบอุ่น เขตบางกะปิ',    code: '22415' },
    { name: 'โรงพยาบาลนำร่อง เขตสุขภาพที่ 4',  code: '10731' },
    { name: 'รพ.สต. บ้านหนองบัว',              code: '05412' },
];

const CLAIM_FUNDS   = ['UC', 'OFC', 'SSS', 'LGO', 'EMS'];
const CLAIM_OWNERS  = ['U-004', 'U-005', 'U-006', 'U-007', 'U-009'];

/**
 * [D2 น.26] คอลัมน์ "สิทธิหลัก / สิทธิย่อย" ของ Transaction Report ตัวจริง
 * สิทธิหลักบนหน้าจอ สปสช. คือ UCS / SSS / WEL — ไม่ใช่ชื่อกองทุนภายในของเรา
 */
const CLAIM_RIGHT_MAP = {
    UC:  { main: 'UCS', subs: ['89', '91'] },
    OFC: { main: 'WEL', subs: ['S1', 'S51'] },
    SSS: { main: 'SSS', subs: ['D1', '89'] },
    LGO: { main: 'WEL', subs: ['91'] },
    EMS: { main: 'UCS', subs: ['S51'] },
};

/* ══════════════════════════════════════════════════════════
   เคสที่เขียนมือ — ใช้เดโมและใช้ทำสไลด์
   ══════════════════════════════════════════════════════════ */
const MOCK_CLAIMS_SEED = [

/* ─────────────────────────────────────────────────────────
   ⭐ วงจรใหม่ — ระบบดักได้ก่อนส่ง (ยังไม่เคยส่งพังสักครั้ง)
   ───────────────────────────────────────────────────────── */
{
    id: 'CLM-2569-0042', hn: '00123456', an: null,
    patient: 'นางสมหญิง ใจดี', age: 62, gender: 'F',
    provider: 'ศูนย์บริการสาธารณสุข 12 (กทม.)', provider_code: '11812',
    service_date: '2569-07-28', service_type: 'OPD', fund: 'UC',
    amount_claimed: 4820, amount_at_risk: 1380, amount_rejected: 0,
    risk_score: 78, result: 'FIX', owner: 'U-004', due_at: '2569-08-07T16:00',
    dx: [
        { code: 'E11.9', name: 'Type 2 diabetes mellitus without complications', type: 'หลัก' },
        { code: 'I10',   name: 'Essential (primary) hypertension',               type: 'รอง' },
    ],
    proc: [{ code: '89.52', name: 'Electrocardiogram', date: '2569-07-28' }],
    charges: [
        { file: 7, seq: 12, billgrcs: '03', stdcode: '338139',
          name: 'ยาสารอาหารทางเส้นเลือดที่ใช้ที่ รพ.', qty: 2, price: 690, catalogue_price: 420 },
        { file: 7, seq: 13, billgrcs: '01', stdcode: '210045',
          name: 'ค่าห้องตรวจผู้ป่วยนอก', qty: 1, price: 150, catalogue_price: 150 },
        { file: 7, seq: 14, billgrcs: '06', stdcode: '451220',
          name: 'ค่าตรวจทางห้องปฏิบัติการ — HbA1c', qty: 1, price: 320, catalogue_price: 320 },
    ],
    rule_results: [{
        rule_id: 'RUL-DRG-007', version: 3, result: 'FIX', severity: 'ERROR',
        message: 'ราคาที่เบิกสูงกว่าราคาใน Drug Catalogue (STDCODE 338139) — ส่วนต่าง 270 บาท/หน่วย',
        maps_to_nhso: 'P124',
        doc_id: 'DOC-NHSO-2569-012', doc_ref: 'ข้อ 4.2 หน้า 18',
        evidence: { 'ราคาที่เบิก': '690.00 บาท/หน่วย', 'ราคา Drug Catalogue': '420.00 บาท/หน่วย',
                    'ส่วนต่าง': '270.00 บาท/หน่วย', 'จำนวน': '2 หน่วย',
                    'มูลค่าที่เสี่ยงถูกตัด': '540.00 บาท',
                    'แฟ้ม': '7 (NHSO CHAD)', 'Seq': '12', 'BILLGRCS': '03', 'STDCODE': '338139' },
    }, {
        rule_id: 'RUL-DOC-002', version: 2, result: 'WARN', severity: 'WARNING',
        message: 'ยังไม่พบผลตรวจ HbA1c แนบในเวชระเบียน — แนะนำแนบก่อนส่งเบิก',
        maps_to_nhso: null,
        doc_id: 'DOC-INT-2569-004', doc_ref: 'ข้อ 2.1',
        evidence: { 'เอกสารที่ต้องมี': 'ผลตรวจทางห้องปฏิบัติการ', 'สถานะ': 'ไม่พบ' },
    }],
    documents: [
        { name: 'ใบสรุปการรักษาผู้ป่วยนอก', type: 'เวชระเบียน', status: 'FOUND', by: 'คุณนภาพร ใจงาม', date: '2569-07-28' },
        { name: 'ใบรับรองสิทธิ',            type: 'สิทธิ',      status: 'FOUND', by: 'ระบบ HIS',        date: '2569-07-28' },
        { name: 'ผลตรวจ HbA1c',            type: 'ผลตรวจ',     status: 'MISSING', by: '—',             date: null },
    ],
    timeline: [
        { at: '2569-07-28T09:14', tone: 'info',    title: 'รับข้อมูลเคสจาก HIS',     by: 'ระบบ',          note: 'นำเข้าอัตโนมัติ 15 แฟ้มครบ' },
        { at: '2569-07-28T09:15', tone: 'danger',  title: 'กฎตรวจพบ 1 ข้อผิดพลาด',   by: 'Rule Engine',   note: 'RUL-DRG-007 v3 — ราคาสูงกว่า Drug Catalogue (จะได้ P124)' },
        { at: '2569-07-28T09:32', tone: 'warning', title: 'มอบหมายงานให้แก้ไข',       by: 'คุณพิมพ์ชนก วงศ์อนันต์', note: 'มอบหมาย TSK-000118 · กำหนด 7 ส.ค. 2569' },
    ],
    task_ids: ['TSK-000118'],
    nhso: { seq: 6900123, uid: '019f1232-f6bd-78ee-bc8d-1dfe596e867d',
            upload_id: 'A69062900069418', ref_no: 'E69062900067725', special_project: '—',
            stage: 'AWAIT_SUBMIT', status_code: '1100', sub_status: 'รอส่งเบิก', errors: [] },
},

/* ─────────────────────────────────────────────────────────
   ⭐ วงจรเดิม — ส่งไปแล้วโดนตีกลับ วนอยู่ 14 วัน
   ───────────────────────────────────────────────────────── */
{
    id: 'CLM-2569-0007', hn: '00119872', an: null,
    patient: 'นายประสิทธิ์ แก้วมณี', age: 58, gender: 'M',
    provider: 'ศูนย์บริการสาธารณสุข 12 (กทม.)', provider_code: '11812',
    service_date: '2569-07-14', service_type: 'OPD', fund: 'OFC',
    amount_claimed: 5240, amount_at_risk: 1860, amount_rejected: 1860,
    risk_score: 92, result: 'BLOCK', owner: 'U-009', due_at: '2569-08-04T12:00',
    dx: [{ code: 'K21.0', name: 'Gastro-oesophageal reflux disease with oesophagitis', type: 'หลัก' }],
    proc: [{ code: '45.13', name: 'Other endoscopy of small intestine', date: '2569-07-14' }],
    charges: [
        { file: 7, seq: 12, billgrcs: '03', stdcode: '338139',
          name: 'ยาสารอาหารทางเส้นเลือดที่ใช้ที่ รพ.', qty: 3, price: 690, catalogue_price: 420 },
        { file: 7, seq: 15, billgrcs: '09', stdcode: '620118',
          name: 'ค่าหัตถการส่องกล้องทางเดินอาหารส่วนต้น', qty: 1, price: 3200, catalogue_price: 3200 },
    ],
    rule_results: [{
        rule_id: 'RUL-DRG-007', version: 2, result: 'BLOCK', severity: 'ERROR',
        message: 'ราคาที่เบิกสูงกว่าราคาใน Drug Catalogue (STDCODE 338139) — ตอนส่งยังใช้กฎ v2 ที่ยังไม่ครอบคลุม BILLGRCS 03',
        maps_to_nhso: 'P124',
        doc_id: 'DOC-NHSO-2569-012', doc_ref: 'ข้อ 4.2 หน้า 18',
        evidence: { 'ราคาที่เบิก': '690.00 บาท/หน่วย', 'ราคา Drug Catalogue': '420.00 บาท/หน่วย',
                    'ส่วนต่าง': '270.00 บาท/หน่วย', 'จำนวน': '3 หน่วย',
                    'มูลค่าที่ถูกตัด': '810.00 บาท',
                    'แฟ้ม': '7 (NHSO CHAD)', 'Seq': '12', 'BILLGRCS': '03', 'STDCODE': '338139' },
    }, {
        rule_id: 'RUL-ELG-004', version: 1, result: 'BLOCK', severity: 'ERROR',
        message: 'Approve Code (OFC) ที่บันทึกไม่ตรงกับฐานข้อมูลหน่วยบริการ',
        maps_to_nhso: 'C305',
        doc_id: 'DOC-NHSO-2569-008', doc_ref: 'ข้อ 3.4',
        evidence: { 'Approve Code ที่บันทึก': 'OFC-69-114872', 'ที่พบในฐานข้อมูล': 'OFC-69-114827',
                    'ประเภทสิทธิ': 'ข้าราชการ (OFC)', 'มูลค่าที่ถูกตัด': '1,050.00 บาท' },
    }],
    documents: [
        { name: 'ใบสรุปการรักษาผู้ป่วยนอก', type: 'เวชระเบียน', status: 'FOUND',  by: 'คุณนภาพร ใจงาม', date: '2569-07-14' },
        { name: 'หนังสือรับรองสิทธิข้าราชการ', type: 'สิทธิ',    status: 'FOUND',  by: 'ฝ่ายการเงิน',    date: '2569-07-14' },
        { name: 'รายงานผลส่องกล้อง',         type: 'ผลตรวจ',    status: 'FOUND',  by: 'ห้องส่องกล้อง',  date: '2569-07-15' },
        { name: 'เอกสารชี้แจงรายการก่อนส่งเบิก', type: 'ชี้แจง', status: 'MISSING', by: '—',            date: null },
    ],
    timeline: [
        { at: '2569-07-14T10:02', tone: 'info',    title: 'รับข้อมูลเคสจาก HIS',        by: 'ระบบ',                note: 'นำเข้าอัตโนมัติ' },
        { at: '2569-07-14T10:03', tone: '',        title: 'กฎ v2 ตรวจผ่าน',             by: 'Rule Engine',         note: 'กฎ RUL-DRG-007 v2 ยังไม่ครอบคลุม BILLGRCS 03' },
        { at: '2569-07-15T08:20', tone: 'info',    title: 'ส่งเบิกไปยัง NHSO',           by: 'คุณพิมพ์ชนก วงศ์อนันต์', note: 'UploadID A69061500041207' },
        { at: '2569-07-15T08:21', tone: '',        title: 'F000 — กำลังนำเข้าไฟล์',      by: 'NHSO',                note: '' },
        { at: '2569-07-15T08:26', tone: '',        title: 'F001 — กำลังตรวจสอบขั้นต้น',   by: 'NHSO',                note: '' },
        { at: '2569-07-16T14:05', tone: 'danger',  title: 'ไม่ผ่านการตรวจสอบขั้นต้น',     by: 'NHSO',                note: 'พบ 1 ข้อผิดพลาด — P124' },
        { at: '2569-07-22T11:40', tone: 'warning', title: 'หน่วยบริการแก้ไขที่ HIS',      by: 'คุณนภาพร ใจงาม',      note: 'ปรับราคายาให้ตรง Drug Catalogue' },
        { at: '2569-07-24T09:15', tone: 'info',    title: 'ส่งเบิกใหม่ครั้งที่ 2',        by: 'คุณพิมพ์ชนก วงศ์อนันต์', note: '' },
        { at: '2569-07-28T16:30', tone: 'danger',  title: 'ไม่ผ่านการประมวลผลไฟล์',       by: 'NHSO',                note: 'พบ C305 — Approve Code ไม่ตรงฐานข้อมูล' },
    ],
    task_ids: ['TSK-000091'],
    nhso: { seq: 6900107, uid: '019f0977-2ab4-71c5-9d02-77aa4413ee01',
            upload_id: 'A69062400031885', ref_no: 'E69062400031885', special_project: '—',
            stage: 'AWAIT_FIX', status_code: '4103', sub_status: 'ยกเลิกและรอส่งใหม่',
            errors: [
                { code: 'P124', level: 'ERROR',   group: 'PREVALIDATE', file: 7, seq: 12,
                  billgrcs: '03', stdcode: '338139', text: NHSO_ERR_TEXT.P124 },
                { code: 'L205', level: 'WARNING', group: 'PREVALIDATE', file: 7, seq: 12,
                  billgrcs: '03', stdcode: '338139', text: NHSO_ERR_TEXT.L205 },
                { code: 'C305', level: 'ERROR',   group: 'PROCESS',     file: 1, seq: 1,
                  billgrcs: '—', stdcode: '—',     text: NHSO_ERR_TEXT.C305 },
            ],
            history: [
                { at: '2569-07-15T08:21', code: 'F000', status: 'กำลังนำเข้าไฟล์',       act: 'อัปโหลดไฟล์ ประกอบด้วย A69061500041207.json', by: 'ศูนย์บริการสาธารณสุข 12' },
                { at: '2569-07-15T08:26', code: 'F001', status: 'กำลังตรวจสอบขั้นต้น',   act: 'กำลังนำไฟล์มาตรวจสอบความเชื่อมโยง / ตรวจสอบเงื่อนไขความสมบูรณ์และเงื่อนไขตามประกาศ', by: 'NHSO' },
                { at: '2569-07-16T14:05', code: 'F002', status: 'ไม่ผ่านการตรวจสอบขั้นต้น', act: 'พบ 1 ข้อผิดพลาด (P124)',  by: 'NHSO' },
                { at: '2569-07-24T09:15', code: 'F000', status: 'กำลังนำเข้าไฟล์',       act: 'ส่งเบิกใหม่ ประกอบด้วย A69062400031885.json', by: 'ศูนย์บริการสาธารณสุข 12' },
                { at: '2569-07-28T16:30', code: 'F002', status: 'ไม่ผ่านการประมวลผล',    act: 'พบ 1 ข้อผิดพลาด (C305)',  by: 'NHSO' },
            ] },
},

/* ── เคสประกอบที่เขียนมือ ─────────────────────────────── */
{
    id: 'CLM-2569-0055', hn: '00131204', an: 'AN690712',
    patient: 'นายวิชัย ตั้งมั่น', age: 71, gender: 'M',
    provider: 'โรงพยาบาลกลาง', provider_code: '10670',
    service_date: '2569-07-31', service_type: 'IPD', fund: 'UC',
    amount_claimed: 48600, amount_at_risk: 12400, amount_rejected: 0,
    risk_score: 84, result: 'APPROVE', owner: 'U-006', due_at: '2569-08-06T17:00',
    dx: [
        { code: 'J18.9', name: 'Pneumonia, unspecified organism', type: 'หลัก' },
        { code: 'N18.3', name: 'Chronic kidney disease, stage 3', type: 'ร่วม' },
    ],
    proc: [{ code: '96.71', name: 'Continuous mechanical ventilation < 96 hours', date: '2569-08-01' }],
    charges: [
        { file: 7, seq: 4,  billgrcs: '02', stdcode: '110220', name: 'ค่าห้องผู้ป่วยใน (สามัญ) 5 วัน', qty: 5, price: 1200, catalogue_price: 1200 },
        { file: 7, seq: 9,  billgrcs: '09', stdcode: '620551', name: 'ค่าเครื่องช่วยหายใจ',            qty: 3, price: 4800, catalogue_price: 4800 },
        { file: 7, seq: 21, billgrcs: '03', stdcode: '338201', name: 'ยาปฏิชีวนะฉีด (กลุ่มพิเศษ)',     qty: 6, price: 2100, catalogue_price: 2100 },
    ],
    rule_results: [{
        rule_id: 'RUL-CLN-011', version: 1, result: 'APPROVE', severity: 'WARNING',
        message: 'ยาปฏิชีวนะกลุ่มพิเศษต้องมีความเห็นแพทย์ผู้เชี่ยวชาญประกอบก่อนส่งเบิก',
        maps_to_nhso: null,
        doc_id: 'DOC-INT-2569-002', doc_ref: 'ระเบียบภายใน ข้อ 5',
        evidence: { 'รายการ': 'ยาปฏิชีวนะฉีด (กลุ่มพิเศษ)', 'มูลค่า': '12,600.00 บาท',
                    'ผู้ที่ต้องรับรอง': 'Medical Reviewer' },
    }],
    documents: [
        { name: 'Discharge Summary',        type: 'เวชระเบียน', status: 'FOUND',   by: 'เวชระเบียน',  date: '2569-08-05' },
        { name: 'ใบความเห็นแพทย์ผู้เชี่ยวชาญ', type: 'ความเห็นแพทย์', status: 'PENDING', by: '—',        date: null },
    ],
    timeline: [
        { at: '2569-08-05T14:00', tone: 'info',    title: 'ปิด Visit และรับข้อมูลผู้ป่วยใน', by: 'ระบบ', note: 'แฟ้ม 14 (NHSO IPD)' },
        { at: '2569-08-05T14:01', tone: 'warning', title: 'ต้องอนุมัติก่อนส่ง',              by: 'Rule Engine', note: 'RUL-CLN-011 v1' },
    ],
    task_ids: ['TSK-000124'],
    nhso: { seq: 6900188, uid: '019f2a71-88c1-7304-b1aa-2ce9911d0f42',
            upload_id: null, ref_no: null, special_project: '—',
            stage: 'AWAIT_SUBMIT', status_code: '1000', sub_status: 'กำลังตรวจสอบขั้นต้น', errors: [] },
},
{
    id: 'CLM-2569-0061', hn: '00140033', an: null,
    patient: 'ด.ญ.ปิยะดา ทองสุข', age: 7, gender: 'F',
    provider: 'คลินิกชุมชนอบอุ่น เขตบางกะปิ', provider_code: '22415',
    service_date: '2569-08-01', service_type: 'PP', fund: 'UC',
    amount_claimed: 780, amount_at_risk: 0, amount_rejected: 0,
    risk_score: 12, result: 'PASS', owner: 'U-004', due_at: '2569-08-12T16:00',
    dx: [{ code: 'Z00.1', name: 'Routine child health examination', type: 'หลัก' }],
    proc: [{ code: '99.59', name: 'Other vaccination and inoculation', date: '2569-08-01' }],
    charges: [{ file: 7, seq: 3, billgrcs: '13', stdcode: '710014', name: 'บริการสร้างเสริมสุขภาพและป้องกันโรค', qty: 1, price: 780, catalogue_price: 780 }],
    rule_results: [],
    documents: [{ name: 'สมุดบันทึกสุขภาพเด็ก', type: 'เวชระเบียน', status: 'FOUND', by: 'พยาบาล', date: '2569-08-01' }],
    timeline: [
        { at: '2569-08-01T10:30', tone: 'info',    title: 'รับข้อมูลเคสจาก HIS', by: 'ระบบ', note: '' },
        { at: '2569-08-01T10:31', tone: 'success', title: 'ผ่านกฎทั้งหมด',       by: 'Rule Engine', note: 'ตรวจ 14 กฎ ไม่พบประเด็น' },
    ],
    task_ids: [],
    nhso: { seq: 6900201, uid: '019f2b03-4471-70aa-9c14-88e2a5510bb7',
            upload_id: 'A69080100011203', ref_no: 'E69080100011203', special_project: '—',
            stage: 'AWAIT_PAY', status_code: null, sub_status: 'รอจ่ายเงิน', errors: [] },
},
{
    id: 'CLM-2569-0038', hn: '00127781', an: null,
    patient: 'นางบุญมี สายทอง', age: 66, gender: 'F',
    provider: 'รพ.สต. บ้านหนองบัว', provider_code: '05412',
    service_date: '2569-07-25', service_type: 'OPD', fund: 'LGO',
    amount_claimed: 1420, amount_at_risk: 420, amount_rejected: 0,
    risk_score: 55, result: 'WARN', owner: 'U-004', due_at: '2569-08-09T16:00',
    dx: [{ code: 'M17.1', name: 'Other primary gonarthrosis', type: 'หลัก' }],
    proc: [],
    charges: [{ file: 7, seq: 6, billgrcs: '03', stdcode: '331002', name: 'ยาแก้ปวดกลุ่ม NSAIDs', qty: 30, price: 14, catalogue_price: 14 }],
    rule_results: [{
        rule_id: 'RUL-DRG-015', version: 1, result: 'WARN', severity: 'WARNING',
        message: 'จำนวนยาต่อครั้งเกินเกณฑ์แนะนำ 30 วัน — ตรวจสอบความสอดคล้องกับนัดครั้งถัดไป',
        maps_to_nhso: null,
        doc_id: 'DOC-NHSO-2569-021', doc_ref: 'ข้อ 6.1',
        evidence: { 'จำนวนที่เบิก': '30 หน่วย', 'เกณฑ์แนะนำ': '30 หน่วย/ครั้ง', 'วันนัดถัดไป': 'ไม่พบข้อมูล' },
    }],
    documents: [{ name: 'ใบสั่งยา', type: 'เวชระเบียน', status: 'FOUND', by: 'เภสัชกร', date: '2569-07-25' }],
    timeline: [
        { at: '2569-07-25T13:10', tone: 'info',    title: 'รับข้อมูลเคสจาก HIS', by: 'ระบบ', note: '' },
        { at: '2569-07-25T13:11', tone: 'warning', title: 'พบข้อควรตรวจสอบ 1 รายการ', by: 'Rule Engine', note: 'RUL-DRG-015 v1 (แจ้งเตือน ส่งเบิกได้)' },
    ],
    task_ids: [],
    nhso: { seq: 6900166, uid: '019f1f88-c012-73de-9a55-4413aa27bb90',
            upload_id: null, ref_no: null, special_project: '—',
            stage: 'AWAIT_SUBMIT', status_code: '1100', sub_status: 'รอส่งเบิก', errors: [] },
},
{
    id: 'CLM-2569-0029', hn: '00122009', an: 'AN690655',
    patient: 'นายอนุชา พงษ์ไพศาล', age: 44, gender: 'M',
    provider: 'โรงพยาบาลนำร่อง เขตสุขภาพที่ 4', provider_code: '10731',
    service_date: '2569-07-18', service_type: 'IPD', fund: 'SSS',
    amount_claimed: 32800, amount_at_risk: 0, amount_rejected: 0,
    risk_score: 28, result: 'PASS', owner: 'U-007', due_at: '2569-08-10T16:00',
    dx: [{ code: 'S72.0', name: 'Fracture of neck of femur', type: 'หลัก' }],
    proc: [{ code: '79.35', name: 'Open reduction of fracture with internal fixation, femur', date: '2569-07-19' }],
    charges: [
        { file: 7, seq: 2,  billgrcs: '02', stdcode: '110220', name: 'ค่าห้องผู้ป่วยใน (สามัญ) 6 วัน', qty: 6, price: 1200, catalogue_price: 1200 },
        { file: 7, seq: 11, billgrcs: '09', stdcode: '621188', name: 'ค่าผ่าตัดยึดตรึงกระดูก',        qty: 1, price: 25600, catalogue_price: 25600 },
    ],
    rule_results: [],
    documents: [
        { name: 'Discharge Summary',  type: 'เวชระเบียน', status: 'FOUND', by: 'เวชระเบียน', date: '2569-07-24' },
        { name: 'รายงานการผ่าตัด',    type: 'ผลตรวจ',     status: 'FOUND', by: 'ห้องผ่าตัด',  date: '2569-07-19' },
    ],
    timeline: [
        { at: '2569-07-24T11:00', tone: 'info',    title: 'ปิด Visit และรับข้อมูลผู้ป่วยใน', by: 'ระบบ',        note: '' },
        { at: '2569-07-24T11:01', tone: 'success', title: 'ผ่านกฎทั้งหมด',                  by: 'Rule Engine', note: 'ตรวจ 22 กฎ' },
        { at: '2569-07-25T08:00', tone: 'info',    title: 'ส่งเบิกไปยัง NHSO',               by: 'คุณอรทัย เจริญพร', note: '' },
    ],
    task_ids: [],
    nhso: { seq: 6900141, uid: '019f1a55-7712-7180-8c30-11bb44dd2200',
            upload_id: 'A69072500028841', ref_no: 'E69072500028841', special_project: '—',
            stage: 'IN_AUDIT', status_code: null, sub_status: 'อยู่กระบวนการ Audit', errors: [] },
},
{
    id: 'CLM-2569-0071', hn: '00144512', an: null,
    patient: 'นางสาวจิราพร มีสุข', age: 29, gender: 'F',
    provider: 'โรงพยาบาลกลาง', provider_code: '10670',
    service_date: '2569-08-03', service_type: 'OPD', fund: 'EMS',
    amount_claimed: 8900, amount_at_risk: 3200, amount_rejected: 0,
    risk_score: 88, result: 'BLOCK', owner: 'U-006', due_at: '2569-08-06T12:00',
    dx: [{ code: 'S06.0', name: 'Concussion', type: 'หลัก' }],
    proc: [{ code: '87.03', name: 'Computerized axial tomography of head', date: '2569-08-03' }],
    charges: [
        { file: 7, seq: 5, billgrcs: '11', stdcode: '551020', name: 'ค่าเอกซเรย์คอมพิวเตอร์สมอง', qty: 1, price: 4800, catalogue_price: 4800 },
        { file: 9, seq: 1, billgrcs: '14', stdcode: '810001', name: 'ค่าบริการการแพทย์ฉุกเฉิน',   qty: 1, price: 3200, catalogue_price: 3200 },
    ],
    rule_results: [{
        rule_id: 'RUL-EMR-003', version: 2, result: 'BLOCK', severity: 'ERROR',
        message: 'เคสอุบัติเหตุฉุกเฉินต้องมีแฟ้ม 9 (NHSO AER) ครบถ้วน — ไม่พบเวลารับแจ้งและจุดเกิดเหตุ',
        maps_to_nhso: 'P208',
        doc_id: 'DOC-NHSO-2569-015', doc_ref: 'ข้อ 2.3',
        evidence: { 'แฟ้มที่ตรวจ': '9 (NHSO AER)', 'ฟิลด์ที่ขาด': 'เวลารับแจ้ง, พิกัดจุดเกิดเหตุ',
                    'มูลค่าที่เสี่ยง': '3,200.00 บาท' },
    }],
    documents: [
        { name: 'บันทึกห้องฉุกเฉิน',       type: 'เวชระเบียน', status: 'FOUND',      by: 'ER',  date: '2569-08-03' },
        { name: 'แบบบันทึกการรับส่งผู้ป่วย', type: 'เอกสารเบิก', status: 'UNREADABLE', by: 'EMS', date: '2569-08-03' },
    ],
    timeline: [
        { at: '2569-08-03T22:40', tone: 'info',   title: 'รับข้อมูลเคสจาก HIS', by: 'ระบบ', note: '' },
        { at: '2569-08-03T22:41', tone: 'danger', title: 'ระงับส่ง — ข้อมูลแฟ้ม 9 ไม่ครบ', by: 'Rule Engine', note: 'RUL-EMR-003 v2 (จะได้ P208)' },
    ],
    task_ids: ['TSK-000131'],
    nhso: { seq: 6900215, uid: '019f2c19-0f04-71b2-a3ca-66cc12ee3311',
            upload_id: null, ref_no: null, special_project: 'EMS-2569',
            stage: 'AWAIT_SUBMIT', status_code: '1000', sub_status: 'กำลังตรวจสอบขั้นต้น', errors: [] },
},
{
    id: 'CLM-2569-0019', hn: '00120876', an: 'AN690588',
    patient: 'นางสุนีย์ อ่อนน้อม', age: 74, gender: 'F',
    provider: 'โรงพยาบาลกลาง', provider_code: '10670',
    service_date: '2569-07-05', service_type: 'IPD', fund: 'OFC',
    amount_claimed: 61200, amount_at_risk: 0, amount_rejected: 4800,
    risk_score: 46, result: 'PASS', owner: 'U-007', due_at: '2569-08-02T16:00',
    dx: [{ code: 'I50.0', name: 'Congestive heart failure', type: 'หลัก' }],
    proc: [{ code: '88.72', name: 'Diagnostic ultrasound of heart', date: '2569-07-06' }],
    charges: [
        { file: 7,  seq: 1, billgrcs: '02', stdcode: '110230', name: 'ค่าห้องผู้ป่วยใน (พิเศษ) 8 วัน', qty: 8, price: 2400, catalogue_price: 2400 },
        { file: 15, seq: 1, billgrcs: '02', stdcode: '110900', name: 'วันลากลับบ้าน (Leave day) 1 วัน', qty: 1, price: 0,    catalogue_price: 0 },
    ],
    rule_results: [],
    documents: [
        { name: 'Discharge Summary',    type: 'เวชระเบียน', status: 'FOUND', by: 'เวชระเบียน', date: '2569-07-13' },
        { name: 'บันทึกอนุญาตลากลับบ้าน', type: 'เวชระเบียน', status: 'FOUND', by: 'หอผู้ป่วย',  date: '2569-07-10' },
    ],
    timeline: [
        { at: '2569-07-13T09:00', tone: 'info',    title: 'ปิด Visit และรับข้อมูลผู้ป่วยใน', by: 'ระบบ',   note: 'แฟ้ม 14 + แฟ้ม 15 (ลากลับบ้าน)' },
        { at: '2569-07-14T08:10', tone: 'info',    title: 'ส่งเบิกไปยัง NHSO',               by: 'คุณอรทัย เจริญพร', note: '' },
        { at: '2569-07-30T15:00', tone: 'warning', title: 'ถูกตัดจ่ายบางส่วนหลัง Audit',      by: 'NHSO',   note: 'ตัดค่าห้องพิเศษส่วนเกิน 4,800 บาท' },
        { at: '2569-08-02T10:00', tone: 'success', title: 'ออกรายงานการจ่ายเงิน',             by: 'NHSO',   note: 'Statement งวด ก.ค. 2569' },
    ],
    task_ids: [],
    nhso: { seq: 6900098, uid: '019f0755-11aa-7099-b400-cc2211ff8800',
            upload_id: 'A69071400019902', ref_no: 'E69071400019902', special_project: '—',
            stage: 'PAID', status_code: null, sub_status: 'ออกรายงานการจ่ายเงินแล้ว', errors: [] },
},
{
    id: 'CLM-2569-0066', hn: '00142118', an: null,
    patient: 'นายเกรียงไกร ศรีนวล', age: 51, gender: 'M',
    provider: 'คลินิกชุมชนอบอุ่น เขตบางกะปิ', provider_code: '22415',
    service_date: '2569-08-02', service_type: 'OPD', fund: 'UC',
    amount_claimed: 2340, amount_at_risk: 980, amount_rejected: 0,
    risk_score: 72, result: 'FIX', owner: 'U-009', due_at: '2569-08-05T16:00',
    dx: [{ code: 'J45.9', name: 'Asthma, unspecified', type: 'หลัก' }],
    proc: [{ code: '93.94', name: 'Respiratory medication administered by nebulizer', date: '2569-08-02' }],
    charges: [{ file: 7, seq: 8, billgrcs: '03', stdcode: '335710', name: 'ยาพ่นขยายหลอดลม', qty: 2, price: 490, catalogue_price: 490 }],
    rule_results: [{
        rule_id: 'RUL-CDX-009', version: 2, result: 'FIX', severity: 'ERROR',
        message: 'ไม่พบรหัสหัตถการที่สอดคล้องกับการวินิจฉัยหลัก — แฟ้ม 6 ระบุ 93.94 แต่ยังไม่มีรหัสรองรับการเบิกยาพ่น',
        maps_to_nhso: 'P061',
        doc_id: 'DOC-NHSO-2569-019', doc_ref: 'ข้อ 5.2',
        evidence: { 'Dx หลัก': 'J45.9', 'Proc ที่บันทึก': '93.94', 'แฟ้มที่ตรวจ': '5, 6',
                    'มูลค่าที่เสี่ยง': '980.00 บาท' },
    }],
    documents: [{ name: 'ใบสรุปการรักษาผู้ป่วยนอก', type: 'เวชระเบียน', status: 'FOUND', by: 'พยาบาล', date: '2569-08-02' }],
    timeline: [
        { at: '2569-08-02T15:20', tone: 'info',   title: 'รับข้อมูลเคสจาก HIS', by: 'ระบบ', note: '' },
        { at: '2569-08-02T15:21', tone: 'danger', title: 'ต้องแก้ไข Coding',   by: 'Rule Engine', note: 'RUL-CDX-009 v2 (จะได้ P061)' },
    ],
    task_ids: ['TSK-000127'],
    nhso: { seq: 6900209, uid: '019f2bb1-77ac-72f0-8811-99aa3355dd44',
            upload_id: null, ref_no: null, special_project: '—',
            stage: 'AWAIT_SUBMIT', status_code: '1100', sub_status: 'รอส่งเบิก', errors: [] },
},
{
    id: 'CLM-2569-0012', hn: '00119004', an: null,
    patient: 'นางมาลี พูนทรัพย์', age: 69, gender: 'F',
    provider: 'ศูนย์บริการสาธารณสุข 12 (กทม.)', provider_code: '11812',
    service_date: '2569-07-09', service_type: 'OPD', fund: 'UC',
    amount_claimed: 1980, amount_at_risk: 0, amount_rejected: 0,
    risk_score: 18, result: 'PASS', owner: 'U-004', due_at: '2569-08-01T16:00',
    dx: [{ code: 'E78.5', name: 'Hyperlipidaemia, unspecified', type: 'หลัก' }],
    proc: [],
    charges: [{ file: 7, seq: 7, billgrcs: '03', stdcode: '332201', name: 'ยาลดไขมันในเลือด', qty: 30, price: 22, catalogue_price: 22 }],
    rule_results: [],
    documents: [{ name: 'ใบสรุปการรักษาผู้ป่วยนอก', type: 'เวชระเบียน', status: 'FOUND', by: 'พยาบาล', date: '2569-07-09' }],
    timeline: [
        { at: '2569-07-09T09:40', tone: 'info',    title: 'รับข้อมูลเคสจาก HIS', by: 'ระบบ',        note: '' },
        { at: '2569-07-09T09:41', tone: 'success', title: 'ผ่านกฎทั้งหมด',       by: 'Rule Engine', note: '' },
        { at: '2569-07-10T08:00', tone: 'info',    title: 'ส่งเบิกไปยัง NHSO',    by: 'คุณพิมพ์ชนก วงศ์อนันต์', note: '' },
        { at: '2569-07-26T14:00', tone: 'success', title: 'โอนเงินชดเชยเข้าบัญชี', by: 'NHSO',        note: 'Statement งวด ก.ค. 2569' },
    ],
    task_ids: [],
    nhso: { seq: 6900077, uid: '019f0512-9911-7433-a0bb-5522ee11cc00',
            upload_id: 'A69071000012204', ref_no: 'E69071000012204', special_project: '—',
            stage: 'PAID', status_code: null, sub_status: 'ออกรายงานการจ่ายเงินแล้ว', errors: [] },
},
];


/* ══════════════════════════════════════════════════════════
   เคสประกอบที่สร้างจากสูตร — เพิ่มปริมาณให้ตารางดูเหมือนใช้งานจริง
   ใช้ LCG แบบ seed คงที่ ทุกครั้งที่โหลดได้ข้อมูลชุดเดิมเป๊ะ
   (ห้ามใช้ Math.random — ตัวเลขบน dashboard จะเปลี่ยนทุกครั้งที่รีเฟรช)
   ══════════════════════════════════════════════════════════ */
const MOCK_CLAIMS = (function buildClaims() {

    let _s = 20690806;
    const rnd  = () => (_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const pick = a => a[Math.floor(rnd() * a.length)];
    const int  = (a, b) => a + Math.floor(rnd() * (b - a + 1));

    const FIRST_M = ['สมชาย', 'ประเสริฐ', 'วิรัตน์', 'ธีระ', 'สุพจน์', 'มานพ', 'ชูชาติ', 'อดิศักดิ์'];
    const FIRST_F = ['สมศรี', 'ประไพ', 'วันเพ็ญ', 'ลัดดา', 'สุกัญญา', 'พรทิพย์', 'อารีย์', 'นงลักษณ์'];
    const LAST    = ['ใจซื่อ', 'บุญมาก', 'รุ่งเรือง', 'สมบูรณ์', 'ทองดี', 'แสงจันทร์', 'พัฒนา', 'ยิ่งยง',
                     'ศรีสมบัติ', 'วัฒนกุล', 'อินทร์ทอง', 'ชูเกียรติ'];

    const DX_POOL = [
        { code: 'I10',   name: 'Essential (primary) hypertension' },
        { code: 'E11.9', name: 'Type 2 diabetes mellitus without complications' },
        { code: 'J06.9', name: 'Acute upper respiratory infection, unspecified' },
        { code: 'K29.7', name: 'Gastritis, unspecified' },
        { code: 'M54.5', name: 'Low back pain' },
        { code: 'N39.0', name: 'Urinary tract infection, site not specified' },
        { code: 'A09',   name: 'Infectious gastroenteritis and colitis' },
        { code: 'H25.9', name: 'Age-related cataract, unspecified' },
    ];

    const CHARGE_POOL = [
        { billgrcs: '01', stdcode: '210045', name: 'ค่าห้องตรวจผู้ป่วยนอก',        unit: 150 },
        { billgrcs: '03', stdcode: '331002', name: 'ยาแก้ปวดกลุ่ม NSAIDs',        unit: 14 },
        { billgrcs: '03', stdcode: '332201', name: 'ยาลดไขมันในเลือด',            unit: 22 },
        { billgrcs: '06', stdcode: '451220', name: 'ค่าตรวจทางห้องปฏิบัติการ',     unit: 320 },
        { billgrcs: '11', stdcode: '551001', name: 'ค่าเอกซเรย์ทรวงอก',           unit: 280 },
        { billgrcs: '09', stdcode: '620110', name: 'ค่าหัตถการทั่วไป',            unit: 900 },
    ];

    /* สัดส่วนผลตรวจให้ใกล้ของจริง: ผ่านเป็นส่วนใหญ่ ที่เหลือกระจาย */
    const RESULT_MIX = ['PASS', 'PASS', 'PASS', 'PASS', 'PASS', 'PASS', 'PASS',
                        'WARN', 'WARN', 'WARN', 'FIX', 'FIX', 'FIX', 'APPROVE', 'BLOCK'];

    const STAGE_BY_RESULT = {
        PASS:    ['AWAIT_PROCESS', 'IN_AUDIT', 'AWAIT_PAY', 'PAID', 'AWAIT_SUBMIT'],
        WARN:    ['AWAIT_SUBMIT', 'AWAIT_PROCESS'],
        /* เคสที่กฎเราจับได้จะค้างที่ "รอส่งเบิก" เป็นหลัก (ยังไม่เคยส่งพัง)
           ส่วนที่อยู่ "รอแก้ไข" คือเคสที่ส่งไปก่อนแล้วโดนตีกลับ — เรื่องที่เราจะเลิกให้เกิด */
        FIX:     ['AWAIT_SUBMIT', 'AWAIT_SUBMIT', 'AWAIT_FIX'],
        APPROVE: ['AWAIT_SUBMIT'],
        BLOCK:   ['AWAIT_SUBMIT', 'AWAIT_FIX', 'AWAIT_FIX'],
    };

    /* ชื่อสถานะย่อยตามแดชบอร์ดจริง [D2 น.23–24] — ต้องตรงกับ NHSO_STATUS_PIPELINE */
    const SUB_BY_STAGE = {
        AWAIT_SUBMIT:  [{ code: '1000', label: 'กำลังตรวจสอบเบื้องต้น' }, { code: '1100', label: 'รอส่งเบิก' }],
        AWAIT_PROCESS: [{ code: null,   label: 'รอประมวลผล' }],
        IN_AUDIT:      [{ code: null,   label: 'อยู่กระบวนการ Audit' }],
        AWAIT_FIX:     [{ code: null,   label: 'ไม่ผ่านการตรวจสอบเบื้องต้น' },
                        { code: null,   label: 'ไม่ผ่านการประมวลผล' },
                        { code: null,   label: 'ส่งเบิกไม่สำเร็จ' },
                        { code: null,   label: 'รอยืนยัน Authen' }],
        AWAIT_PAY:     [{ code: null,   label: 'รอจ่ายเงิน' }],
        PAID:          [{ code: null,   label: 'ออกรายงานการจ่ายเงินแล้ว' }],
    };

    const GEN_RULES = {
        WARN:    { rule_id: 'RUL-DRG-015', version: 1, severity: 'WARNING', maps_to_nhso: null,
                   message: 'จำนวนยาต่อครั้งเกินเกณฑ์แนะนำ — ตรวจสอบความสอดคล้องกับวันนัดถัดไป',
                   doc_id: 'DOC-NHSO-2569-021', doc_ref: 'ข้อ 6.1' },
        FIX:     { rule_id: 'RUL-CDX-009', version: 2, severity: 'ERROR', maps_to_nhso: 'P061',
                   message: 'ไม่พบรหัสหัตถการที่สอดคล้องกับการวินิจฉัยหลัก (แฟ้ม 5/6)',
                   doc_id: 'DOC-NHSO-2569-019', doc_ref: 'ข้อ 5.2' },
        APPROVE: { rule_id: 'RUL-CLN-011', version: 1, severity: 'WARNING', maps_to_nhso: null,
                   message: 'รายการมูลค่าสูง ต้องมีความเห็นผู้ทบทวนก่อนส่งเบิก',
                   doc_id: 'DOC-INT-2569-002', doc_ref: 'ระเบียบภายใน ข้อ 5' },
        BLOCK:   { rule_id: 'RUL-ELG-004', version: 1, severity: 'ERROR', maps_to_nhso: 'C305',
                   message: 'Approve Code (OFC)/เลขปิดสิทธิ (UCS) ไม่ตรงกับฐานข้อมูลหน่วยบริการ',
                   doc_id: 'DOC-NHSO-2569-008', doc_ref: 'ข้อ 3.4' },
    };

    const gen = [];
    for (let i = 0; i < 34; i++) {
        const male   = rnd() < 0.45;
        const result = RESULT_MIX[i % RESULT_MIX.length];
        const prov   = pick(NHSO_PROVIDERS);
        const svc    = rnd() < 0.72 ? 'OPD' : (rnd() < 0.5 ? 'IPD' : 'PP');
        const fund   = pick(CLAIM_FUNDS);
        const day    = int(1, 31);
        const month  = day > 6 ? '07' : '08';
        const sdate  = `2569-${month}-${String(day > 6 ? day : day).padStart(2, '0')}`;

        const nCharge = int(1, 3);
        const charges = [];
        for (let c = 0; c < nCharge; c++) {
            const cp = pick(CHARGE_POOL);
            const qty = cp.unit < 50 ? int(10, 30) : int(1, 3);
            charges.push({ file: 7, seq: int(1, 40), billgrcs: cp.billgrcs, stdcode: cp.stdcode,
                           name: cp.name, qty, price: cp.unit, catalogue_price: cp.unit });
        }
        const claimed = svc === 'IPD'
            ? int(18000, 72000)
            : charges.reduce((a, c) => a + c.qty * c.price, 0) + int(100, 900);

        const rr = GEN_RULES[result];
        const atRisk = (result === 'PASS') ? 0 : Math.round(claimed * (result === 'WARN' ? 0.08 : 0.22));

        const stage = pick(STAGE_BY_RESULT[result]);
        const sub   = pick(SUB_BY_STAGE[stage]);
        const submitted = stage !== 'AWAIT_SUBMIT';

        const dx = pick(DX_POOL);
        const num = String(100 + i * 3).padStart(4, '0');

        gen.push({
            id: `CLM-2569-${num}`,
            hn: String(100000 + int(10000, 89999)),
            an: svc === 'IPD' ? 'AN6907' + String(int(10, 99)) : null,
            patient: (male ? 'นาย' : 'นาง') + pick(male ? FIRST_M : FIRST_F) + ' ' + pick(LAST),
            age: int(18, 84), gender: male ? 'M' : 'F',
            provider: prov.name, provider_code: prov.code,
            service_date: sdate, service_type: svc, fund,
            amount_claimed: claimed,
            amount_at_risk: atRisk,
            amount_rejected: (stage === 'PAID' && rnd() < 0.25) ? Math.round(claimed * 0.06) : 0,
            risk_score: result === 'PASS' ? int(5, 35) : result === 'WARN' ? int(40, 62)
                      : result === 'FIX' ? int(63, 82) : int(80, 95),
            result,
            owner: pick(CLAIM_OWNERS),
            due_at: `2569-08-${String(int(5, 20)).padStart(2, '0')}T16:00`,
            dx: [{ code: dx.code, name: dx.name, type: 'หลัก' }],
            proc: [],
            charges,
            rule_results: rr ? [{
                rule_id: rr.rule_id, version: rr.version, result, severity: rr.severity,
                message: rr.message, maps_to_nhso: rr.maps_to_nhso,
                doc_id: rr.doc_id, doc_ref: rr.doc_ref,
                evidence: { 'มูลค่าที่เสี่ยง': MockFmt.baht(atRisk) + ' บาท',
                            'แฟ้มที่ตรวจ': '5, 6, 7', 'กองทุน': fund, 'วันที่รับบริการ': sdate },
            }] : [],
            documents: [
                { name: svc === 'IPD' ? 'Discharge Summary' : 'ใบสรุปการรักษาผู้ป่วยนอก',
                  type: 'เวชระเบียน', status: 'FOUND', by: 'เวชระเบียน', date: sdate },
                ...(result === 'FIX' || result === 'BLOCK'
                    ? [{ name: 'เอกสารประกอบการเบิก', type: 'เอกสารเบิก', status: 'MISSING', by: '—', date: null }]
                    : []),
            ],
            timeline: [
                { at: sdate + 'T09:00', tone: 'info', title: 'รับข้อมูลเคสจาก HIS', by: 'ระบบ', note: '' },
                { at: sdate + 'T09:01',
                  tone: result === 'PASS' ? 'success' : result === 'WARN' ? 'warning' : 'danger',
                  title: result === 'PASS' ? 'ผ่านกฎทั้งหมด' : 'พบประเด็นต้องดำเนินการ',
                  by: 'Rule Engine', note: rr ? `${rr.rule_id} v${rr.version}` : '' },
                ...(submitted ? [{ at: sdate + 'T14:00', tone: 'info', title: 'ส่งเบิกไปยัง NHSO', by: 'ระบบ', note: '' }] : []),
            ],
            task_ids: [],
            nhso: {
                seq: 6900300 + i * 7,
                uid: `019f${(3000 + i * 13).toString(16)}-mock-70${i}-demo-000000000${i % 10}`,
                upload_id: submitted ? `A6908${String(int(100000, 999999))}` : null,
                ref_no:    submitted ? `E6908${String(int(10000000, 99999999))}` : null,
                special_project: '—',
                stage, status_code: sub.code, sub_status: sub.label,
                errors: (stage === 'AWAIT_FIX' && rr && rr.maps_to_nhso) ? [{
                    code: rr.maps_to_nhso, level: 'ERROR',
                    group: rr.maps_to_nhso === 'C305' ? 'PROCESS' : 'PREVALIDATE',
                    file: 7, seq: charges[0].seq, billgrcs: charges[0].billgrcs, stdcode: charges[0].stdcode,
                    text: NHSO_ERR_TEXT[rr.maps_to_nhso] || rr.message,
                }] : [],
            },
        });
    }

    /* ── เติมฟิลด์ฝั่ง NHSO ที่เอกสารระบุ ให้ทุกเคสด้วยสูตรเดียวกัน ──
       [D2 น.25–26] หน้าจอจริงมี UID, Invoice No., หมายเลขอ้างอิงรายการก่อนหน้า,
       สิทธิหลัก/สิทธิย่อย, Model, หน่วยบริการประจำ และแสดง 2 ยอดคู่กันเสมอ
       [D2 น.7]     ปิด Visit ต้องเป็น Complete จึงส่งเบิกได้
       เขียนเป็น normalizer แทนการไล่แก้ทีละเคส เพื่อให้ทุกเคสสอดคล้องกันเสมอ */

    const FUND_KEY_BY_SERVICE = { OPD: 'OP', IPD: 'IP', PP: 'PP' };

    function enrich(c, i) {
        const n = c.nhso; if (!n) return c;

        const svc     = c.service_type;
        const fundKey = c.fund === 'EMS' ? 'AE' : (FUND_KEY_BY_SERVICE[svc] || 'OP');

        /* เงื่อนไขที่ทำให้ต้องส่งแฟ้มกลุ่มเฉพาะ — ผูกกับข้อมูลของเคสเอง */
        const ctx = {
            emergency:  c.fund === 'EMS',
            prenatal:   false,
            newborn:    false,
            psych:      false,
            disability: false,
            leaveDay:   svc === 'IPD' && n.seq % 3 === 0,
        };

        /* แฟ้มที่ส่งได้จริงวันนี้ = แฟ้มที่ต้องส่ง ลบแฟ้มที่ยัง Mapping ไม่เสร็จ
           → ตัวเลข "แฟ้มไม่ครบ" บนหน้าจอ กระทบยอดกับ Pre-task ข้อ 5 ได้ตรง ๆ */
        const required = MockNhso.checkFiles(fundKey, [], ctx).required;
        const filesSent = required.filter(no => {
            const f = MockNhso.file(no);
            return f && f.mapping !== 'TODO';
        });

        const right = CLAIM_RIGHT_MAP[c.fund] || CLAIM_RIGHT_MAP.UC;
        const home  = NHSO_PROVIDERS[(Number(c.hn) || i) % NHSO_PROVIDERS.length];

        /* ยอดชดเชยจะรู้ก็ต่อเมื่อ สปสช. ประมวลผลแล้ว
           ระหว่าง Audit จะเห็นเฉพาะส่วนที่ผ่านเบื้องต้น = ยอดเรียกเก็บ − ยอดที่เสี่ยง */
        let compensated = 0;
        if (n.stage === 'PAID' || n.stage === 'AWAIT_PAY') {
            compensated = c.amount_claimed - (c.amount_rejected || 0);
        } else if (n.stage === 'IN_AUDIT') {
            compensated = c.amount_claimed - (c.amount_at_risk || 0);
        }

        c.fund_key   = fundKey;
        c.file_ctx   = ctx;
        c.files_sent = filesSent;
        /* ปิด Visit ไม่ครบ = ยังส่งเบิกไม่ได้ — ผูกกับผลตรวจของเราเอง */
        c.visit_close = n.stage === 'AWAIT_SUBMIT' && (c.result === 'BLOCK' || c.result === 'FIX')
            ? 'INCOMPLETE'
            : (n.stage === 'AWAIT_SUBMIT' && c.result === 'APPROVE' ? 'WAITING' : 'COMPLETE');

        n.invoice_no  = `${String(c.service_date).slice(2).replace(/-/g, '')}-${String(n.seq).slice(-4)}`;
        n.prev_ref    = n.stage === 'AWAIT_FIX' && n.ref_no
            ? 'E' + String(Number(String(n.ref_no).slice(1)) - 1).padStart(String(n.ref_no).length - 1, '0')
            : null;
        n.main_right  = right.main;
        n.sub_right   = right.subs[i % right.subs.length];
        n.model       = '1';
        n.home_provider = home.name;
        n.home_provider_code = home.code;
        n.billed      = c.amount_claimed;
        n.compensated = compensated;
        return c;
    }

    return [...MOCK_CLAIMS_SEED, ...gen].map(enrich);
})();


/* ══════════════════════════════════════════════════════════
   ตัวช่วยสำหรับหน้าเคลม — ใช้ร่วมทุกหน้า ห้ามคำนวณซ้ำเอง
   ══════════════════════════════════════════════════════════ */
const MockClaims = {

    all()      { return MockDB.all('claims'); },
    byId(id)   { return MockDB.byId('claims', id); },

    /** จำนวนแยกตามผลตรวจ 5 ระดับ */
    countByResult() {
        const out = {}; MockTone.RESULTS.forEach(r => out[r] = 0);
        this.all().forEach(c => { out[c.result] = (out[c.result] || 0) + 1; });
        return out;
    },

    /** จำนวนแยกตามขั้นสถานะ NHSO */
    countByStage() {
        const out = {};
        this.all().forEach(c => {
            const s = c.nhso && c.nhso.stage; if (!s) return;
            out[s] = (out[s] || 0) + 1;
        });
        return out;
    },

    /** รหัส NHSO ที่เคสนี้จะติดถ้าไม่แก้ (คืน array ไม่ซ้ำ) */
    predictedCodes(c) {
        return [...new Set((c.rule_results || [])
            .filter(r => r.maps_to_nhso).map(r => r.maps_to_nhso))];
    },

    /** เคสที่ยังต้องดำเนินการโดยหน่วยบริการ */
    openCases() {
        return this.all().filter(c => ['FIX', 'APPROVE', 'BLOCK'].includes(c.result));
    },

    /** มูลค่ารวมของเคสตามเงื่อนไข */
    sum(fn, pick) { return this.all().filter(fn).reduce((a, c) => a + (Number(pick(c)) || 0), 0); },

    /** อัตราผ่านครั้งแรก — เคสที่ส่งแล้วไม่เคยเข้าสถานะรอแก้ไข */
    firstPassRate() {
        const submitted = this.all().filter(c => c.nhso && c.nhso.stage !== 'AWAIT_SUBMIT');
        if (!submitted.length) return 0;
        const clean = submitted.filter(c => c.nhso.stage !== 'AWAIT_FIX');
        return (clean.length / submitted.length) * 100;
    },

    /** ผลตรวจแฟ้มตามกองทุนของเคสหนึ่ง [D2 น.14–16] */
    fileCheck(c) {
        if (!c) return null;
        return MockNhso.checkFiles(c.fund_key, c.files_sent, c.file_ctx);
    },

    /** เคสที่ส่งแฟ้มไม่ครบตามกองทุน — ใช้เป็นตัวกรองในหน้า Worklist */
    filesIncomplete() {
        return this.all().filter(c => { const r = this.fileCheck(c); return r && !r.ok; });
    },

    /** รหัส NHSO ตัวนี้ยืนยันกับเอกสารได้หรือยัง */
    codeVerified(code) { return NHSO_ERR_VERIFIED.has(code); },

    /** ยอดเรียกเก็บ / ยอดชดเชย รวมทั้งระบบ — หน้าจอ สปสช. แสดงคู่กันเสมอ */
    amountPair(fn) {
        const rows = this.all().filter(fn || (() => true));
        return {
            billed:      rows.reduce((a, c) => a + (c.amount_claimed || 0), 0),
            compensated: rows.reduce((a, c) => a + MockNhso.compensated(c), 0),
        };
    },
};

MockDB.register('claims', MOCK_CLAIMS);

window.MOCK_CLAIMS        = MOCK_CLAIMS;
window.MockClaims         = MockClaims;
window.NHSO_ERR_TEXT      = NHSO_ERR_TEXT;
window.NHSO_ERR_VERIFIED  = NHSO_ERR_VERIFIED;
window.CLAIM_RIGHT_MAP    = CLAIM_RIGHT_MAP;
window.NHSO_PROVIDERS = NHSO_PROVIDERS;
window.CLAIM_FUNDS    = CLAIM_FUNDS;
