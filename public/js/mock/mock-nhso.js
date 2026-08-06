/**
 * MediCore RCM — MOCK NHSO
 * ------------------------------------------------------------
 * เนื้อหาทั้งหมดในไฟล์นี้ถอดจากเอกสารส่งเคลมรุ่นล่าสุด
 *   doc/โครงการ NHSO Digital Platform_Commu_03082026_V4.pdf  (V4 · 3 ส.ค. 2569 · 46 สไลด์)
 *
 * ⚠️ ชื่อสถานะ รหัสแฟ้ม รหัสข้อผิดพลาด และข้อความ ต้องตรงกับของจริง
 *    ความน่าเชื่อถือของการนำเสนออยู่ตรงที่ผู้ฟังจำหน้าจอ สปสช. ได้
 *    ตรงไหนที่เอกสารไม่ได้ระบุรหัสตัวเลข จะไม่แต่งขึ้นเอง (ใส่ code: null)
 */

/* ══════════════════════════════════════════════════════════
   1. ขั้นตอนการทำงาน 6 ขั้น (popup "ดูขั้นตอนการทำงาน" บนหน้าแรก NHSO)
   ══════════════════════════════════════════════════════════ */
const NHSO_STATUS_PIPELINE = [
    {
        key: 'AWAIT_SUBMIT', label: 'รอส่งเบิก', by: 'หน่วยบริการ', icon: 'upload',
        desc: 'รายการรอส่งเบิกจะถูกดำเนินการโดยหน่วยบริการ โดยจะประกอบด้วยสถานะย่อย 3 สถานะ',
        sub: [
            { code: '1000', label: 'กำลังตรวจสอบขั้นต้น' },
            { code: '1100', label: 'รอส่งเบิก' },
            { code: '4103', label: 'ยกเลิกและรอส่งใหม่' },
        ],
    },
    {
        key: 'AWAIT_PROCESS', label: 'รอประมวลผล', by: 'สปสช.', icon: 'cpu',
        desc: 'สปสช. นำข้อมูลไปประมวลผลตามเงื่อนไขที่ประกาศ',
        sub: [{ code: null, label: 'รอประมวลผล' }],
    },
    {
        key: 'IN_AUDIT', label: 'อยู่กระบวนการ Audit', by: 'สปสช.', icon: 'search-check',
        desc: 'ตรวจสอบก่อนจ่าย (Rules 3D) โดยเจ้าหน้าที่หน่วยบริการและ สปสช.',
        sub: [{ code: null, label: 'อยู่กระบวนการ Audit' }],
    },
    {
        key: 'AWAIT_FIX', label: 'รอแก้ไข', by: 'หน่วยบริการ', icon: 'wrench',
        desc: 'รายการที่ไม่ผ่าน ต้องแก้ไขที่ HIS แล้วส่งเข้ามาใหม่',
        sub: [
            { code: null, label: 'ไม่ผ่านการตรวจสอบขั้นต้น' },
            { code: null, label: 'ไม่ผ่านการประมวลผล' },
            { code: '3101', label: 'ขอยกเลิกรายการโดยหน่วยบริการ' },
        ],
    },
    {
        key: 'AWAIT_PAY', label: 'รอจ่ายเงิน', by: 'สปสช.', icon: 'banknote',
        desc: 'เข้าสู่ Statement · ประมวลผลเพื่อกำหนดจ่าย คำนวณยอด เตรียมโอนเงิน',
        sub: [{ code: null, label: 'รอจ่ายเงิน' }],
    },
    {
        key: 'PAID', label: 'ออกรายงานการจ่ายเงิน', by: 'สปสช.', icon: 'receipt',
        desc: 'โอนเงินชดเชยเข้าบัญชีหน่วยบริการ และออก Statement Report',
        sub: [{ code: null, label: 'ออกรายงานการจ่ายเงินแล้ว' }],
    },
];

/** รหัสกิจกรรมในตาราง "ประวัติรายการ" ของหน้าจอ NHSO */
const NHSO_ACTIVITY_CODES = [
    { code: 'F000', label: 'กำลังนำเข้าไฟล์',
      desc: 'อัปโหลดไฟล์เข้าสู่ระบบ ประกอบด้วยชื่อไฟล์ที่นำเข้า' },
    { code: 'F001', label: 'กำลังตรวจสอบขั้นต้น',
      desc: 'กำลังนำไฟล์มาตรวจสอบความเชื่อมโยง / ตรวจสอบเงื่อนไขความสมบูรณ์และเงื่อนไขตามประกาศเบื้องต้นที่สามารถตรวจสอบได้' },
    { code: 'F002', label: 'ตรวจสอบขั้นต้นเสร็จสิ้น',
      desc: 'ระบบประมวลผลไฟล์ทั้งหมดเสร็จสิ้นแล้ว สามารถตรวจสอบระเบียบรายการได้' },
];

const NHSO_STAGE_LABEL = NHSO_STATUS_PIPELINE
    .reduce((a, s) => { a[s.key] = s.label; return a; }, {});

/** ป้ายสถานะ → คลาส .status-badge */
const NHSO_STAGE_BADGE = {
    AWAIT_SUBMIT: 'pending', AWAIT_PROCESS: 'waiting', IN_AUDIT: 'in-progress',
    AWAIT_FIX: 'danger', AWAIT_PAY: 'scheduled', PAID: 'completed',
};


/* ══════════════════════════════════════════════════════════
   2. Standard Dataset — 15 แฟ้ม 5 กลุ่มข้อมูลหลัก
   (ที่มา: ประกาศ สปสช. — โครงสร้างแฟ้มข้อมูลมาตรฐานเพื่อการเบิกจ่ายชดเชย)
   ══════════════════════════════════════════════════════════ */
const NHSO_FILE_GROUPS = [
    { key: 'MASTER',   label: 'ข้อมูลหลัก',       hint: 'ใครรักษาใครที่ไหน',      icon: 'users' },
    { key: 'CLINICAL', label: 'ข้อมูลการรักษา',   hint: 'เป็นอะไรรักษาอย่างไร',   icon: 'stethoscope' },
    { key: 'FINANCE',  label: 'ข้อมูลการเงิน',    hint: 'คิดเงินเท่าไหร่',         icon: 'wallet' },
    { key: 'SPECIFIC', label: 'กลุ่มเฉพาะ/กรณีพิเศษ', hint: 'บริการเฉพาะกลุ่ม',   icon: 'heart-pulse' },
    { key: 'ADMISSION',label: 'ผู้ป่วยใน',        hint: 'Admissions',             icon: 'bed' },
];

const NHSO_FILES = [
    { no: 1,  group: 'MASTER',    th: 'แฟ้มข้อมูลทั่วไป',                     en: 'NHSO Patient',      desc: 'ข้อมูลทั่วไปของผู้เข้ารับบริการ',                        fields: 28, mapping: 'DONE' },
    { no: 2,  group: 'MASTER',    th: 'แฟ้มข้อมูลสถานพยาบาล',                 en: 'NHSO Provider',     desc: 'ข้อมูลสถานพยาบาลที่ให้บริการผู้เข้ารับบริการ',            fields: 14, mapping: 'DONE' },
    { no: 3,  group: 'MASTER',    th: 'แฟ้มข้อมูลผู้ให้บริการ',                en: 'NHSO Practitioner', desc: 'ข้อมูลผู้ให้บริการสุขภาพของหน่วยบริการ',                 fields: 11, mapping: 'DONE' },
    { no: 4,  group: 'CLINICAL',  th: 'แฟ้มข้อมูลการรับบริการผู้ป่วยนอก',       en: 'NHSO OPD',          desc: 'ข้อมูลการรับบริการผู้ป่วยนอก (OPD)',                    fields: 32, mapping: 'DONE' },
    { no: 5,  group: 'CLINICAL',  th: 'แฟ้มข้อมูลวินิจฉัยโรคของผู้เข้ารับบริการ', en: 'NHSO Diagnosis',    desc: 'ข้อมูลวินิจฉัยโรคของผู้เข้ารับบริการ',                    fields: 9,  mapping: 'DONE' },
    { no: 6,  group: 'CLINICAL',  th: 'แฟ้มข้อมูลการทำหัตถการของผู้เข้ารับบริการ', en: 'NHSO Procedure',    desc: 'ข้อมูลการทำหัตถการของผู้เข้ารับบริการ',                   fields: 10, mapping: 'PARTIAL' },
    { no: 7,  group: 'FINANCE',   th: 'แฟ้มข้อมูลรายละเอียดค่าใช้จ่ายรายรายการ', en: 'NHSO CHAD',         desc: 'ข้อมูลรายละเอียดค่าใช้จ่ายรายรายการตามรหัสมาตรฐาน',       fields: 18, mapping: 'PARTIAL' },
    { no: 8,  group: 'FINANCE',   th: 'แฟ้มข้อมูลรายละเอียดทางการเงิน',        en: 'NHSO CHA',          desc: 'ข้อมูลรายละเอียดทางการเงินของผู้เข้ารับบริการ',           fields: 22, mapping: 'DONE' },
    { no: 9,  group: 'SPECIFIC',  th: 'แฟ้มข้อมูลอุบัติเหตุฉุกเฉินฯ',           en: 'NHSO AER',          desc: 'ข้อมูลอุบัติเหตุฉุกเฉินและรับส่งเพื่อรักษา',              fields: 16, mapping: 'TODO' },
    { no: 10, group: 'SPECIFIC',  th: 'แฟ้มข้อมูลประวัติการตั้งครรภ์ฯ',         en: 'NHSO Prenatal',     desc: 'ข้อมูลประวัติการตั้งครรภ์สำหรับหญิงตั้งครรภ์',            fields: 13, mapping: 'PARTIAL' },
    { no: 11, group: 'SPECIFIC',  th: 'แฟ้มข้อมูลประวัติการคลอดของทารก',       en: 'NHSO Newborn',      desc: 'ข้อมูลประวัติการคลอดของทารกที่เข้ารับบริการ',             fields: 15, mapping: 'PARTIAL' },
    { no: 12, group: 'SPECIFIC',  th: 'แฟ้มข้อมูลการให้บริการผู้ป่วยจิตเวชฯ',    en: 'NHSO CMHS',         desc: 'ข้อมูลการให้บริการผู้ป่วยจิตเวชเรื้อรังในชุมชน',           fields: 12, mapping: 'TODO' },
    { no: 13, group: 'SPECIFIC',  th: 'แฟ้มข้อมูลการให้บริการผู้พิการ',          en: 'NHSO Disability',   desc: 'ข้อมูลการให้บริการผู้พิการที่เข้ารับบริการ',              fields: 11, mapping: 'TODO' },
    { no: 14, group: 'ADMISSION', th: 'แฟ้มข้อมูลการให้บริการผู้ป่วยใน',        en: 'NHSO IPD',          desc: 'ข้อมูลการให้บริการผู้ป่วยในที่เข้ารับบริการ',             fields: 34, mapping: 'PARTIAL' },
    { no: 15, group: 'ADMISSION', th: 'แฟ้มข้อมูลผู้ป่วยในกรณีมีการลากลับบ้าน',  en: 'NHSO LVD',          desc: 'ข้อมูลผู้ป่วยในกรณีมีการลากลับบ้าน (Leave day)',          fields: 7,  mapping: 'TODO' },
];

const NHSO_MAPPING_TONE = {
    DONE:    { chip: 'sip-chip-success', label: 'ครบแล้ว' },
    PARTIAL: { chip: 'sip-chip-amber',   label: 'ยังไม่ครบ' },
    TODO:    { chip: 'sip-chip-danger',  label: 'ยังไม่เริ่ม' },
};


/* ══════════════════════════════════════════════════════════
   3. Business Journey (สไลด์ 5 ของเอกสาร V4)
   ══════════════════════════════════════════════════════════ */
const NHSO_JOURNEY = [
    {
        lane: 'ผู้ป่วย – หน่วยบริการ', tone: 'navy',
        steps: [
            { label: 'คนไข้',              icon: 'user' },
            { label: 'ตรวจสอบสิทธิ์',       icon: 'search' },
            { label: 'ให้บริการ',           icon: 'stethoscope' },
            { label: 'ปิดสิทธิ์',           icon: 'lock', sub: 'เป๋าตัง · ปิดสิทธิ สปสช.' },
            { label: 'เจ้าหน้าที่ส่งเบิกเคลม', icon: 'upload', strong: true },
            { label: 'ช่องทางส่งข้อมูล',     icon: 'monitor', sub: 'HIS / HIS-FDH', strong: true },
        ],
    },
    {
        lane: 'NHSO — รับข้อมูล & ตรวจสอบ', tone: 'blue',
        steps: [
            { label: 'Pre-Validate',  sub: 'ตรวจสอบข้อมูลเบื้องต้น', strong: true },
            { label: 'ส่งเบิก',        sub: 'Auto / Manual' },
            { label: 'ประมวลผล',      sub: 'ตามเงื่อนไขประกาศ' },
        ],
        pass: 'ไปยังขั้นตอนถัดไป',
        fail: ['ตรวจสอบหน้าจอ NHSO', 'หน่วยบริการแก้ไขที่ HIS', 'ส่งใหม่'],
    },
    {
        lane: 'NHSO — คุณภาพ', tone: 'green',
        steps: [
            { label: 'ตรวจสอบก่อนจ่าย', sub: 'Rules 3D — เจ้าหน้าที่ (หน่วยบริการ / สปสช.)', strong: true },
        ],
        pass: 'เข้าสู่ Statement',
        fail: ['ขอเอกสารเพิ่มเติม', 'แก้ไข', 'ส่งใหม่'],
    },
    {
        lane: 'Statement & จ่าย', tone: 'amber',
        steps: [
            { label: 'Statement',        sub: 'ตรวจสอบ & สร้าง Statement — ดึง Statement Report' },
            { label: 'ประมวลผลเพื่อกำหนดจ่าย', sub: 'คำนวณยอด — เตรียมโอนเงิน' },
            { label: 'โอนเงินชดเชย',      sub: 'เข้าบัญชีหน่วยบริการ' },
        ],
    },
];


/* ══════════════════════════════════════════════════════════
   4. Roadmap ของ NHSO (สไลด์ 6) — ใช้ทำ Gantt ในสไลด์ 17
   ══════════════════════════════════════════════════════════ */
const NHSO_ROADMAP = [
    {
        phase: 'Phase 1 · MVP 1', status: 'DONE', when: 'เสร็จสิ้น — พ.ค. 2568',
        units: '289 หน่วยบริการ',
        detail: ['ศูนย์บริการสาธารณสุข (กทม.)', 'คลินิกชุมชนอบอุ่น (กทม.)'],
        patients: ['ผู้ป่วยนอก (OPD)', 'ส่งเสริมสุขภาพ (PP)'],
        rights: ['UC (บัตรทอง)'],
    },
    {
        phase: 'Phase 2 · MVP 2 Drop 1', status: 'ACTIVE', when: 'เม.ย. 2569 — ดำเนินการอยู่',
        units: '~9,000 หน่วยบริการ',
        detail: ['รพ.สต. ทั่วประเทศ',
                 'รพ.สต. ถ่ายโอน + สิทธิข้าราชการกรมบัญชีกลาง 5,185 หน่วย เริ่มใช้ระบบแล้ว',
                 'รพ.สต. ไม่ถ่ายโอน 4,714 หน่วย'],
        patients: ['ผู้ป่วยนอก (OPD)', 'ส่งเสริมสุขภาพ (PP)'],
        rights: ['UC (บัตรทอง)', 'ข้าราชการ กบก.', 'LGO (อปท.)', 'OFC BKK', 'รฟท.', 'ขสมก.'],
    },
    {
        phase: 'Phase 3 · MVP 2 Drop 2', status: 'NEXT', when: 'Go-Live เป้าหมาย 16 ก.ย. 2569',
        units: '308 หน่วยบริการ',
        detail: ['รพ. นำร่อง 7 แห่ง', 'รพ. รัฐ + เอกชน (กทม. & ต่างจังหวัด)'],
        patients: ['ผู้ป่วยนอก (OPD)', 'ส่งเสริมสุขภาพ (PP)', 'ผู้ป่วยใน (IPD) — เพิ่มใหม่'],
        rights: ['UC (บัตรทอง)', 'ข้าราชการ กบก.', 'ประกันสังคม', 'สปสช.', 'ครูเอกชน',
                 'การแพทย์ฉุกเฉิน', 'LGO (อปท.)', 'OFC BKK', 'รฟท.', 'ขสมก.'],
    },
];

const NHSO_GOLIVE = { label: 'Go-Live เป้าหมาย', date: '16 ก.ย. 2569', iso: '2569-09-16' };


/* ══════════════════════════════════════════════════════════
   5. งานที่ต้องเตรียมก่อน UAT (สไลด์ 7 — Pre Tasks ช่วง Hand Shake)
   ══════════════════════════════════════════════════════════ */
const NHSO_PRETASKS = [
    { no: 1, title: 'ขอ Source ID', desc: 'ขึ้นทะเบียน Software Vendor กับ NHSO Digital Platform',
      owner: 'ศูนย์คอมพิวเตอร์ + ผู้พัฒนา', due: '2569-08-22', status: 'DONE' },
    { no: 2, title: 'เชื่อมต่อ API', desc: 'ขอ Client ID / Token สำหรับ Test Environment',
      owner: 'ศูนย์คอมพิวเตอร์', due: '2569-08-29', status: 'PROGRESS' },
    { no: 3, title: 'ตั้งค่า User', desc: 'ผู้ใช้งาน NHSO Portal ครบทุก Role ที่ต้องการ',
      owner: 'ศูนย์จัดเก็บรายได้', due: '2569-08-29', status: 'PROGRESS' },
    { no: 4, title: 'พัฒนาระบบ', desc: 'เชื่อมต่อ HIS → NHSO Platform ตาม Standard Dataset ล่าสุด',
      owner: 'ผู้พัฒนา + ศูนย์คอมพิวเตอร์', due: '2569-09-05', status: 'PROGRESS' },
    { no: 5, title: 'Mapping Drug & Service Catalogue',
      desc: 'ปรับปรุงให้หน่วยบริการส่งรายการตาม Drug / Service Catalog ที่ให้ข้อมูลไว้กับ สปสช.',
      owner: 'เภสัชกรรม + ศูนย์จัดเก็บรายได้', due: '2569-09-05', status: 'TODO' },
];

const NHSO_PRETASK_TONE = {
    DONE:     { badge: 'completed',   label: 'เสร็จแล้ว' },
    PROGRESS: { badge: 'in-progress', label: 'ดำเนินการอยู่' },
    TODO:     { badge: 'pending',     label: 'ยังไม่เริ่ม' },
};


/* ══════════════════════════════════════════════════════════
   6. ประวัติการนำเข้าแฟ้มข้อมูล
   ══════════════════════════════════════════════════════════ */
const MOCK_NHSO_IMPORTS = [
    { upload_id: 'A69080500091120', at: '2569-08-05T21:39', file: 'NHSO_20690805_OPD.json', channel: 'API',
      rows: 412, ok: 407, err: 5,  code: 'F002', status: 'ตรวจสอบขั้นต้นเสร็จสิ้น' },
    { upload_id: 'A69080400088014', at: '2569-08-04T20:12', file: 'NHSO_20690804_OPD.json', channel: 'API',
      rows: 388, ok: 388, err: 0,  code: 'F002', status: 'ตรวจสอบขั้นต้นเสร็จสิ้น' },
    { upload_id: 'A69080300084771', at: '2569-08-03T22:55', file: 'NHSO_20690803_MIX.json', channel: 'API',
      rows: 455, ok: 441, err: 14, code: 'F002', status: 'ตรวจสอบขั้นต้นเสร็จสิ้น' },
    { upload_id: 'A69080200080233', at: '2569-08-02T21:04', file: 'NHSO_20690802_IPD.json', channel: 'Upload',
      rows: 96,  ok: 92,  err: 4,  code: 'F002', status: 'ตรวจสอบขั้นต้นเสร็จสิ้น' },
    { upload_id: 'A69080100077912', at: '2569-08-01T21:18', file: 'NHSO_20690801_PP.json',  channel: 'API',
      rows: 210, ok: 210, err: 0,  code: 'F002', status: 'ตรวจสอบขั้นต้นเสร็จสิ้น' },
    { upload_id: 'A69073100074508', at: '2569-07-31T20:47', file: 'NHSO_20690731_OPD.json', channel: 'API',
      rows: 401, ok: 393, err: 8,  code: 'F002', status: 'ตรวจสอบขั้นต้นเสร็จสิ้น' },
    { upload_id: 'A69080600095001', at: '2569-08-06T08:31', file: 'NHSO_20690806_OPD.json', channel: 'API',
      rows: 128, ok: 0,   err: 0,  code: 'F001', status: 'กำลังตรวจสอบขั้นต้น' },
];

/** การเชื่อมต่อ API (หน้าจอ "นำข้อมูลเข้าด้วย API") */
const MOCK_NHSO_API = {
    source_id:   'SRC-11812-0042',
    client_id:   'nhso-cli-11812-8f2a',
    token:       'eyJhbGciOi••••••••••••••••••••••••4Xq2',
    environment: 'TEST',
    endpoint:    'https://api.nhso.go.th/dp/v2/claims',
    last_sync:   '2569-08-06T08:31',
    vendor:      'MediCore RCM (ขึ้นทะเบียนแล้ว)',
};


/* ══════════════════════════════════════════════════════════
   7. รายงาน (สไลด์ 40–45)
   ══════════════════════════════════════════════════════════ */
const NHSO_REPORT_TYPES = [
    { key: 'TRANSACTION', label: 'Transaction Reports',            desc: 'รายการที่นำเข้าและผลการตรวจสอบรายระเบียน' },
    { key: 'STATEMENT',   label: 'Statement Reports',              desc: 'สรุปยอดที่ผ่านการตรวจสอบและเข้าสู่การจ่าย' },
    { key: 'OFC',         label: 'Statement OFC และสิทธิอื่น',      desc: 'แยกตามสิทธิข้าราชการและสิทธิอื่น ๆ' },
    { key: 'AR',          label: 'Report พึงรับ พึงจ่าย',           desc: 'กระทบยอดลูกหนี้ค่ารักษาพยาบาลรายงวด' },
];

/** กติกาจริงจากเอกสาร — ต้องขึ้นเป็นแบนเนอร์ให้ผู้ใช้เห็น */
const NHSO_REPORT_PASSWORD_RULE =
    'ไฟล์ที่ดาวน์โหลดถูกตั้งรหัสผ่าน = Username (ตัวอักษรพิมพ์เล็กทั้งหมด) ที่ Log In เข้าระบบ '
  + 'ตามด้วยเลขบัตรประจำตัวประชาชน 5 หลักสุดท้าย  ตัวอย่าง: xxxx12345';

const MOCK_NHSO_REPORTS = [
    { id: 'RPT-TX-690805', type: 'TRANSACTION', name: 'Transaction Report — 5 ส.ค. 2569', period: 'ส.ค. 2569',
      fund: 'ทุกกองทุน', created: '2569-08-06T06:00', rows: 412, amount: 1284500, status: 'READY' },
    { id: 'RPT-TX-690731', type: 'TRANSACTION', name: 'Transaction Report — งวด ก.ค. 2569', period: 'ก.ค. 2569',
      fund: 'ทุกกองทุน', created: '2569-08-01T06:00', rows: 9884, amount: 28741200, status: 'READY' },
    { id: 'RPT-ST-690715', type: 'STATEMENT',   name: 'Statement งวดที่ 1/ก.ค. 2569', period: 'ก.ค. 2569 (1–15)',
      fund: 'UC', created: '2569-07-22T09:00', rows: 4412, amount: 12980400, status: 'PAID' },
    { id: 'RPT-ST-690731', type: 'STATEMENT',   name: 'Statement งวดที่ 2/ก.ค. 2569', period: 'ก.ค. 2569 (16–31)',
      fund: 'UC', created: '2569-08-05T09:00', rows: 4108, amount: 11842700, status: 'READY' },
    { id: 'RPT-OFC-690731', type: 'OFC',        name: 'Statement OFC — งวด ก.ค. 2569', period: 'ก.ค. 2569',
      fund: 'OFC', created: '2569-08-05T09:00', rows: 884, amount: 3918100, status: 'READY' },
    { id: 'RPT-OFC-690630', type: 'OFC',        name: 'Statement สิทธิอื่น — งวด มิ.ย. 2569', period: 'มิ.ย. 2569',
      fund: 'SSS / LGO / EMS', created: '2569-07-05T09:00', rows: 512, amount: 2244800, status: 'PAID' },
    { id: 'RPT-AR-690731', type: 'AR',          name: 'รายงานพึงรับ พึงจ่าย — ก.ค. 2569', period: 'ก.ค. 2569',
      fund: 'ทุกกองทุน', created: '2569-08-05T10:00', rows: 9884, amount: 28741200, status: 'READY' },
    { id: 'RPT-AR-690630', type: 'AR',          name: 'รายงานพึงรับ พึงจ่าย — มิ.ย. 2569', period: 'มิ.ย. 2569',
      fund: 'ทุกกองทุน', created: '2569-07-05T10:00', rows: 9210, amount: 26418900, status: 'PAID' },
];

/** ยอดพึงรับ vs ยอดที่จ่ายจริง รายงวด — ใช้ทำกราฟกระทบยอด */
const MOCK_NHSO_RECON = [
    { period: 'มี.ค. 69', expect: 24180000, paid: 22910000 },
    { period: 'เม.ย. 69', expect: 25640000, paid: 24020000 },
    { period: 'พ.ค. 69', expect: 26120000, paid: 24880000 },
    { period: 'มิ.ย. 69', expect: 26418900, paid: 25102400 },
    { period: 'ก.ค. 69', expect: 28741200, paid: 27385600 },
];

const NHSO_REPORT_STATUS = {
    READY: { badge: 'active',    label: 'พร้อมดาวน์โหลด' },
    PAID:  { badge: 'completed', label: 'จ่ายเงินแล้ว' },
};


/* ══════════════════════════════════════════════════════════
   8. ตัวช่วย
   ══════════════════════════════════════════════════════════ */
const MockNhso = {

    pipeline() { return NHSO_STATUS_PIPELINE; },

    stageLabel(key) { return NHSO_STAGE_LABEL[key] || key || '—'; },
    stageBadge(key) { return NHSO_STAGE_BADGE[key] || 'pending'; },

    stageIndex(key) { return NHSO_STATUS_PIPELINE.findIndex(s => s.key === key); },

    /** เคสทั้งหมดที่มีข้อมูลฝั่ง NHSO (ฉายจาก MOCK_CLAIMS — ไม่มีชุดข้อมูลแยก) */
    cases() { return MockDB.where('claims', c => !!c.nhso); },

    byStage(key) { return this.cases().filter(c => c.nhso.stage === key); },

    bySeq(seq) { return this.cases().find(c => String(c.nhso.seq) === String(seq)) || null; },

    /** จำนวน + มูลค่า ของแต่ละขั้น — ใช้ทั้ง stepper และ KPI */
    stageStats() {
        return NHSO_STATUS_PIPELINE.map(s => {
            const rows = this.byStage(s.key);
            return { ...s, count: rows.length,
                     amount: rows.reduce((a, c) => a + (c.amount_claimed || 0), 0) };
        });
    },

    filesByGroup(g) { return NHSO_FILES.filter(f => f.group === g); },

    /** ความครบของ Mapping เป็น % — ผูกกับ pre-task ข้อ 5 */
    mappingPct() {
        const w = { DONE: 1, PARTIAL: 0.5, TODO: 0 };
        const s = NHSO_FILES.reduce((a, f) => a + w[f.mapping], 0);
        return Math.round((s / NHSO_FILES.length) * 100);
    },
};

MockDB.register('nhso_imports', MOCK_NHSO_IMPORTS);
MockDB.register('nhso_reports', MOCK_NHSO_REPORTS);

window.NHSO_STATUS_PIPELINE     = NHSO_STATUS_PIPELINE;
window.NHSO_ACTIVITY_CODES      = NHSO_ACTIVITY_CODES;
window.NHSO_STAGE_LABEL         = NHSO_STAGE_LABEL;
window.NHSO_STAGE_BADGE         = NHSO_STAGE_BADGE;
window.NHSO_FILE_GROUPS         = NHSO_FILE_GROUPS;
window.NHSO_FILES               = NHSO_FILES;
window.NHSO_MAPPING_TONE        = NHSO_MAPPING_TONE;
window.NHSO_JOURNEY             = NHSO_JOURNEY;
window.NHSO_ROADMAP             = NHSO_ROADMAP;
window.NHSO_GOLIVE              = NHSO_GOLIVE;
window.NHSO_PRETASKS            = NHSO_PRETASKS;
window.NHSO_PRETASK_TONE        = NHSO_PRETASK_TONE;
window.MOCK_NHSO_IMPORTS        = MOCK_NHSO_IMPORTS;
window.MOCK_NHSO_API            = MOCK_NHSO_API;
window.NHSO_REPORT_TYPES        = NHSO_REPORT_TYPES;
window.NHSO_REPORT_PASSWORD_RULE= NHSO_REPORT_PASSWORD_RULE;
window.MOCK_NHSO_REPORTS        = MOCK_NHSO_REPORTS;
window.MOCK_NHSO_RECON          = MOCK_NHSO_RECON;
window.NHSO_REPORT_STATUS       = NHSO_REPORT_STATUS;
window.MockNhso                 = MockNhso;
