/**
 * MediCore RCM — MOCK NHSO
 * ------------------------------------------------------------
 * เนื้อหาทั้งหมดในไฟล์นี้ถอดจากเอกสาร สปสช. 2 ฉบับ
 *   [D3] doc/โครงการ NHSO Digital Platform_Commu_03082026_V4.pdf
 *        (V4 · 3 ส.ค. 2569 · 46 สไลด์) — เอกสารสื่อสาร/ขึ้นระบบ ฉบับใหม่กว่า
 *   [D2] doc/2. NHSO.Digital.Platform.Overview.23.06.2569.pdf
 *        (23 มิ.ย. 2569 · 29 หน้า) — ภาพรวมสถาปัตยกรรม + สเปกชุดข้อมูลมาตรฐาน
 *
 * ทุกค่าคงที่ด้านล่างอ้างที่มาไว้ในคอมเมนต์เป็น [D2 น.12] / [D3 สไลด์ 4]
 *
 * ⚠️ ชื่อสถานะ รหัสแฟ้ม รหัสข้อผิดพลาด และข้อความ ต้องตรงกับของจริง
 *    ความน่าเชื่อถือของการนำเสนออยู่ตรงที่ผู้ฟังจำหน้าจอ สปสช. ได้
 *
 * ⚠️ verified: false = ยังยืนยันกับเอกสารไม่ได้ (เนื้อหาส่วนใหญ่ของ D3 อยู่ในภาพสไลด์
 *    ที่ดึงข้อความไม่ได้) ต้องขึ้นป้าย "รอยืนยัน" บนหน้าจอทุกจุดที่แสดงค่านั้น
 *    D2 ระบุว่า สปสช. จะรวบรวม "Error ที่พบบ่อย" เผยแพร่ [D2 น.8] — เมื่อได้มาให้แทนที่
 */

/** ป้ายมาตรฐานสำหรับค่าที่ยังยืนยันกับเอกสารไม่ได้ */
const NHSO_UNVERIFIED_NOTE = 'รอยืนยันกับ สปสช. — ยังไม่พบในเนื้อความเอกสารที่ตรวจสอบได้';

/* ══════════════════════════════════════════════════════════
   1. ขั้นตอนการทำงาน 6 ขั้น (popup "ดูขั้นตอนการทำงาน" บนหน้าแรก NHSO)
   ══════════════════════════════════════════════════════════ */
const NHSO_STATUS_PIPELINE = [
    {
        key: 'AWAIT_SUBMIT', label: 'รอส่งเบิก', by: 'หน่วยบริการ', icon: 'upload',
        desc: 'รายการรอส่งเบิกจะถูกดำเนินการโดยหน่วยบริการ โดยจะประกอบด้วยสถานะย่อย 3 สถานะ',
        sub: [
            { code: '1000', label: 'กำลังตรวจสอบเบื้องต้น', verified: false },
            { code: '1100', label: 'รอส่งเบิก',             verified: false },
            { code: '4103', label: 'ยกเลิกและรอส่งใหม่',     verified: false },
        ],
    },
    {
        key: 'AWAIT_PROCESS', label: 'รอประมวลผล', by: 'สปสช.', icon: 'cpu',
        desc: 'สปสช. นำข้อมูลไปประมวลผลตามเงื่อนไขที่ประกาศ',
        sub: [{ code: null, label: 'รอประมวลผล', verified: true }],
    },
    {
        key: 'IN_AUDIT', label: 'อยู่กระบวนการ Audit', by: 'สปสช.', icon: 'search-check',
        desc: 'ตรวจสอบก่อนจ่าย (Rules 3D) โดยเจ้าหน้าที่หน่วยบริการและ สปสช.',
        sub: [{ code: null, label: 'อยู่กระบวนการ Audit', verified: true }],
    },
    {
        /* [D2 น.23–24] แดชบอร์ดจริงของ สปสช. แยกกลุ่ม "รอแก้ไข" เป็น 5 สถานะย่อย */
        key: 'AWAIT_FIX', label: 'รอแก้ไข', by: 'หน่วยบริการ', icon: 'wrench',
        desc: 'รายการที่ไม่ผ่าน ต้องแก้ไขที่ HIS แล้วส่งเข้ามาใหม่ (หน้าจอ สปสช. เป็นแบบอ่านอย่างเดียว)',
        sub: [
            { code: null,   label: 'ไม่ผ่านการตรวจสอบเบื้องต้น', verified: true },
            { code: null,   label: 'ส่งเบิกไม่สำเร็จ',            verified: true },
            { code: null,   label: 'รอยืนยัน Authen',            verified: true },
            { code: null,   label: 'ไม่ผ่านการประมวลผล',          verified: true },
            { code: null,   label: 'รอชี้แจงความผิดปกติ',         verified: true },
            { code: '3101', label: 'ขอยกเลิกรายการโดยหน่วยบริการ', verified: false },
        ],
    },
    {
        key: 'AWAIT_PAY', label: 'รอจ่ายเงิน', by: 'สปสช.', icon: 'banknote',
        desc: 'เข้าสู่ Statement · ประมวลผลเพื่อกำหนดจ่าย คำนวณยอด เตรียมโอนเงิน',
        sub: [{ code: null, label: 'รอจ่ายเงิน', verified: true }],
    },
    {
        key: 'PAID', label: 'ออกรายงานการจ่ายเงิน', by: 'สปสช.', icon: 'receipt',
        desc: 'โอนเงินชดเชยเข้าบัญชีหน่วยบริการ และออก Statement Report',
        sub: [{ code: null, label: 'ออกรายงานการจ่ายเงินแล้ว', verified: true }],
    },
];

/**
 * [D2 น.23–24] โมเดล "2 ถัง" — ทุกรายการ ณ เวลาหนึ่งเป็นลูกของฝั่งใดฝั่งหนึ่งเสมอ
 * หน้าแรกของ NHSO Digital Platform แบ่งหน้าจอด้วยเกณฑ์นี้เป็นอันดับแรก
 * ถังของหน่วยบริการ = เวลาที่โรงพยาบาลคุมได้เอง → เป็นที่ที่ระบบเราสร้างมูลค่า
 */
const NHSO_OWNER_BUCKETS = [
    { key: 'PROVIDER', label: 'รายการรอดำเนินการโดย หน่วยบริการ', short: 'หน่วยบริการ',
      by: 'หน่วยบริการ', tone: 'navy',  icon: 'hospital',
      stages: ['AWAIT_SUBMIT', 'AWAIT_FIX'],
      note: 'เวลาที่โรงพยาบาลควบคุมได้เอง — ยิ่งค้างนาน ยิ่งกระทบกระแสเงินสด' },
    { key: 'NHSO', label: 'รายการรอดำเนินการโดย สปสช.', short: 'สปสช.',
      by: 'สปสช.', tone: 'blue', icon: 'landmark',
      stages: ['AWAIT_PROCESS', 'IN_AUDIT', 'AWAIT_PAY', 'PAID'],
      note: 'อยู่ระหว่างการประมวลผล/ตรวจสอบ/จ่ายเงินของ สปสช.' },
];

/**
 * [D2 น.23–24] ทุกวิดเจ็ตบนหน้าจอ สปสช. แสดง 2 ยอดคู่กันเสมอ "X / Y บาท"
 * ยอดเรียกเก็บ = ฟ้า · ยอดชดเชย = เขียว
 */
const NHSO_AMOUNT_LEGEND = [
    { key: 'billed',       label: 'ยอดเรียกเก็บ', tone: 'blue',  cls: 'amt-billed' },
    { key: 'compensated',  label: 'ยอดชดเชย',    tone: 'green', cls: 'amt-comp' },
];

/** [D2 น.7] สถานะการปิด Visit ฝั่ง HIS — ต้องเป็น Complete จึงส่งเบิกได้ */
const NHSO_VISIT_CLOSE = [
    { key: 'COMPLETE',   label: 'Complete',   th: 'ปิด Visit ครบถ้วน',      badge: 'completed',  submittable: true },
    { key: 'WAITING',    label: 'Waiting',    th: 'รอข้อมูลเพิ่มเติม',       badge: 'pending',    submittable: false },
    { key: 'INCOMPLETE', label: 'Incomplete', th: 'ข้อมูลไม่ครบ',           badge: 'danger',     submittable: false },
];

/** รหัสกิจกรรมในตาราง "ประวัติรายการ" ของหน้าจอ NHSO */
const NHSO_ACTIVITY_CODES = [
    { code: 'F000', label: 'กำลังนำเข้าไฟล์', verified: false,
      desc: 'อัปโหลดไฟล์เข้าสู่ระบบ ประกอบด้วยชื่อไฟล์ที่นำเข้า' },
    { code: 'F001', label: 'กำลังตรวจสอบเบื้องต้น', verified: false,
      desc: 'กำลังนำไฟล์มาตรวจสอบความเชื่อมโยง / ตรวจสอบเงื่อนไขความสมบูรณ์และเงื่อนไขตามประกาศเบื้องต้นที่สามารถตรวจสอบได้' },
    { code: 'F002', label: 'ตรวจสอบเบื้องต้นเสร็จสิ้น', verified: false,
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
   2. Standard Dataset — 15 แฟ้ม 5 กลุ่มข้อมูลหลัก · 160 Data Points
   ที่มา: ประกาศสำนักงานหลักประกันสุขภาพแห่งชาติ เรื่อง โครงสร้างชุดข้อมูลมาตรฐาน
          สำหรับการจัดทำระบบข้อมูลการให้บริการสาธารณสุข เพื่อขอรับค่าใช้จ่าย
          เพื่อบริการสาธารณสุข กรณีการจ่ายตามรายการบริการ พ.ศ. 2566
          (อาศัยอำนาจตามมาตรา 36 (2) พ.ร.บ.หลักประกันสุขภาพแห่งชาติ พ.ศ. 2545)
   จำนวนฟิลด์รายแฟ้ม: [D2 น.12] · การจัดกลุ่ม 5 กลุ่ม: [D3 สไลด์ 4]
   ══════════════════════════════════════════════════════════ */

const NHSO_DATASET_ANNOUNCE = {
    title: 'ประกาศ สปสช. เรื่อง โครงสร้างชุดข้อมูลมาตรฐานสำหรับการจัดทำระบบข้อมูล'
         + 'การให้บริการสาธารณสุข เพื่อขอรับค่าใช้จ่ายเพื่อบริการสาธารณสุข '
         + 'กรณีการจ่ายตามรายการบริการ พ.ศ. 2566',
    short: 'ประกาศ Standard data set (Fee Schedule) พ.ศ. 2566',
    legal: 'มาตรา 36 (2) พ.ร.บ.หลักประกันสุขภาพแห่งชาติ พ.ศ. 2545',
    source: 'nhso.go.th → หน่วยบริการ → NHSO Digital Platform → ดาวน์โหลด',
    note: 'ต้องอิง Standard Dataset "ฉบับล่าสุด" เสมอ — สปสช. ปรับปรุงเป็นระยะ',
};
const NHSO_FILE_GROUPS = [
    { key: 'MASTER',   label: 'ข้อมูลหลัก',       hint: 'ใครรักษาใครที่ไหน',      icon: 'users' },
    { key: 'CLINICAL', label: 'ข้อมูลการรักษา',   hint: 'เป็นอะไรรักษาอย่างไร',   icon: 'stethoscope' },
    { key: 'FINANCE',  label: 'ข้อมูลการเงิน',    hint: 'คิดเงินเท่าไหร่',         icon: 'wallet' },
    { key: 'SPECIFIC', label: 'กลุ่มเฉพาะ/กรณีพิเศษ', hint: 'บริการเฉพาะกลุ่ม',   icon: 'heart-pulse' },
    { key: 'ADMISSION',label: 'ผู้ป่วยใน',        hint: 'Admissions',             icon: 'bed' },
];

/**
 * req  = ต้องระบุ (Y)      · บังคับ รวมทั้งชุด 72 ฟิลด์
 * cond = ระบุ/ไม่ระบุ (Y/N) · มีเงื่อนไข รวมทั้งชุด 16 ฟิลด์
 * opt  = อื่น ๆ (N)         · รวมทั้งชุด 72 ฟิลด์
 * รวมทั้งหมด 160 Data Points  [D2 น.9, น.12]
 *
 * origin = ที่มาโครงสร้างเดิม [D2 น.13]
 *   แฟ้ม 1–9 อ้างอิงโครงสร้าง 16 แฟ้ม · 10–13 อ้างอิง DMIS · 14–15 อ้างอิงโครงสร้างผู้ป่วยใน
 */
const NHSO_FILES = [
    { no: 1,  group: 'MASTER',    th: 'แฟ้มข้อมูลทั่วไป',                     en: 'NHSO Patient',      desc: 'ข้อมูลทั่วไปของผู้เข้ารับบริการ',                        req: 3, cond: 0,  opt: 15, fields: 18, origin: '16 แฟ้ม', mapping: 'DONE' },
    { no: 2,  group: 'MASTER',    th: 'แฟ้มข้อมูลหน่วยบริการ',                 en: 'NHSO Provider',     desc: 'ข้อมูลหน่วยบริการที่ให้บริการผู้เข้ารับบริการ',            req: 2, cond: 0,  opt: 5,  fields: 7,  origin: '16 แฟ้ม', mapping: 'DONE' },
    { no: 3,  group: 'MASTER',    th: 'แฟ้มข้อมูลผู้ให้บริการ',                en: 'NHSO Practitioner', desc: 'ข้อมูลผู้ให้บริการสุขภาพของหน่วยบริการ',                 req: 3, cond: 0,  opt: 5,  fields: 8,  origin: '16 แฟ้ม', mapping: 'DONE' },
    { no: 4,  group: 'CLINICAL',  th: 'แฟ้มข้อมูลการรับบริการผู้ป่วยนอก',       en: 'NHSO OPD',          desc: 'ข้อมูลการรับบริการผู้ป่วยนอก (OPD)',                    req: 4, cond: 0,  opt: 13, fields: 17, origin: '16 แฟ้ม', mapping: 'DONE' },
    { no: 5,  group: 'CLINICAL',  th: 'แฟ้มข้อมูลวินิจฉัยโรคของผู้เข้ารับบริการ', en: 'NHSO Diagnosis',    desc: 'ข้อมูลวินิจฉัยโรคของผู้เข้ารับบริการ (รหัส ICD-10)',      req: 4, cond: 0,  opt: 2,  fields: 6,  origin: '16 แฟ้ม', mapping: 'DONE' },
    { no: 6,  group: 'CLINICAL',  th: 'แฟ้มข้อมูลการทำหัตถการของผู้เข้ารับบริการ', en: 'NHSO Procedure',    desc: 'ข้อมูลการทำหัตถการของผู้เข้ารับบริการ (รหัส ICD-9-CM)',   req: 4, cond: 0,  opt: 2,  fields: 6,  origin: '16 แฟ้ม', mapping: 'PARTIAL' },
    { no: 7,  group: 'FINANCE',   th: 'แฟ้มข้อมูลรายละเอียดค่าใช้จ่ายรายรายการ', en: 'NHSO CHAD',         desc: 'ข้อมูลรายละเอียดค่าใช้จ่ายรายรายการตามรหัสมาตรฐาน',       req: 8, cond: 1,  opt: 6,  fields: 15, origin: '16 แฟ้ม', mapping: 'PARTIAL' },
    { no: 8,  group: 'FINANCE',   th: 'แฟ้มข้อมูลรายละเอียดทางการเงิน',        en: 'NHSO CHA',          desc: 'ข้อมูลรายละเอียดทางการเงินของผู้เข้ารับบริการ',           req: 7, cond: 0,  opt: 1,  fields: 8,  origin: '16 แฟ้ม', mapping: 'DONE' },
    { no: 9,  group: 'SPECIFIC',  th: 'แฟ้มข้อมูลอุบัติเหตุฉุกเฉินฯ',           en: 'NHSO AER',          desc: 'ข้อมูลอุบัติเหตุ ฉุกเฉิน และรับส่งเพื่อรักษา',            req: 3, cond: 11, opt: 1,  fields: 15, origin: '16 แฟ้ม', mapping: 'TODO' },
    { no: 10, group: 'SPECIFIC',  th: 'แฟ้มข้อมูลประวัติการตั้งครรภ์ฯ',         en: 'NHSO Prenatal',     desc: 'ข้อมูลประวัติการตั้งครรภ์สำหรับหญิงตั้งครรภ์',            req: 5, cond: 0,  opt: 3,  fields: 8,  origin: 'DMIS',    mapping: 'PARTIAL' },
    { no: 11, group: 'SPECIFIC',  th: 'แฟ้มข้อมูลประวัติการคลอดของทารก',       en: 'NHSO Newborn',      desc: 'ข้อมูลประวัติการคลอดของทารกที่เข้ารับบริการ',             req: 4, cond: 2,  opt: 2,  fields: 8,  origin: 'DMIS',    mapping: 'PARTIAL' },
    { no: 12, group: 'SPECIFIC',  th: 'แฟ้มข้อมูลการให้บริการผู้ป่วยจิตเวชฯ',    en: 'NHSO CMHS',         desc: 'ข้อมูลการให้บริการผู้ป่วยจิตเวชเรื้อรังในชุมชน',           req: 6, cond: 0,  opt: 0,  fields: 6,  origin: 'DMIS',    mapping: 'TODO' },
    { no: 13, group: 'SPECIFIC',  th: 'แฟ้มข้อมูลการให้บริการผู้พิการ',          en: 'NHSO Disability',   desc: 'ข้อมูลการให้บริการผู้พิการที่เข้ารับบริการ',              req: 5, cond: 0,  opt: 4,  fields: 9,  origin: 'DMIS',    mapping: 'TODO' },
    { no: 14, group: 'ADMISSION', th: 'แฟ้มข้อมูลการให้บริการผู้ป่วยใน',        en: 'NHSO IPD',          desc: 'ข้อมูลการให้บริการผู้ป่วยในที่เข้ารับบริการ',             req: 9, cond: 2,  opt: 12, fields: 23, origin: 'ผู้ป่วยใน', mapping: 'PARTIAL' },
    { no: 15, group: 'ADMISSION', th: 'แฟ้มข้อมูลผู้ป่วยในกรณีมีการลากลับบ้าน',  en: 'NHSO LVD',          desc: 'ข้อมูลผู้ป่วยในกรณีมีการลากลับบ้าน (Leave day)',          req: 5, cond: 0,  opt: 1,  fields: 6,  origin: 'ผู้ป่วยใน', mapping: 'TODO' },
];

/** ที่มาโครงสร้างเดิมของแต่ละแฟ้ม — ใช้ตอบคำถาม "ของเดิมไปไหน" [D2 น.13] */
const NHSO_FILE_ORIGINS = [
    { key: '16 แฟ้ม',   files: '1–9',   desc: 'อ้างอิงโครงสร้าง 16 แฟ้ม ของระบบ e-Claim เดิม' },
    { key: 'DMIS',      files: '10–13', desc: 'อ้างอิงโครงสร้างระบบ DMIS' },
    { key: 'ผู้ป่วยใน', files: '14–15', desc: 'อ้างอิงโครงสร้างข้อมูลผู้ป่วยในเดิม' },
];

const NHSO_MAPPING_TONE = {
    DONE:    { chip: 'sip-chip-success', label: 'ครบแล้ว' },
    PARTIAL: { chip: 'sip-chip-amber',   label: 'ยังไม่ครบ' },
    TODO:    { chip: 'sip-chip-danger',  label: 'ยังไม่เริ่ม' },
};


/* ══════════════════════════════════════════════════════════
   2B. กองทุนค่าใช้จ่าย × แฟ้มที่ต้องส่ง  [D2 น.14–16]
   "กองทุนค่าใช้จ่ายตามโครงสร้างชุดข้อมูลมาตรฐานการเบิกจ่ายชดเชย"
   → เมทริกซ์นี้แปลงเป็นกฎตรวจก่อนส่งได้ทันที (RUL-FIL-001)
   ══════════════════════════════════════════════════════════ */
const NHSO_FUND_FILES = [
    { key: 'OP',      label: 'บริการผู้ป่วยนอกทั่วไป',                       files: [1,2,3,4,5,6,7,8,9,10,11] },
    { key: 'PP',      label: 'บริการสร้างเสริมสุขภาพและป้องกันโรค (PP)',      files: [1,2,3,4,5,6,7,8,10,11] },
    { key: 'QOF',     label: 'บริการสาธารณสุขเพิ่มเติมสำหรับบริการปฐมภูมิ (QOF)', files: [1,2,4,5,6,7,8] },
    { key: 'LTC',     label: 'บริการสำหรับผู้ที่มีภาวะพึ่งพิงในชุมชน (LTC)',   files: [1,2,4,7,8] },
    { key: 'CMHS',    label: 'บริการผู้ป่วยจิตเวชเรื้อรังในชุมชน',             files: [1,2,3,4,5,7,8,12] },
    { key: 'DMHT',    label: 'ค่าบริการผู้ป่วยโรคเบาหวานและความดันโลหิตสูง',   files: [1,2,3,4,5,6,7,8] },
    { key: 'TTM',     label: 'ค่าบริการแพทย์แผนไทยและการแพทย์ทางเลือก',        files: [1,2,3,4,5,6,7,8] },
    { key: 'REHAB',   label: 'บริการฟื้นฟูสมรรถภาพด้านการแพทย์',              files: [1,2,4,5,6,7,8,13] },
    { key: 'CANCER',  label: 'บริการกลุ่มโรคมะเร็ง',                          files: [1,2,3,4,5,6,7,8] },
    { key: 'TELEMED', label: 'บริการ TeleMed / TeleHealth',                   files: [1,2,3,4,5,7,8] },
    { key: 'AE',      label: 'ค่าบริการกรณีอุบัติเหตุ หรือเจ็บป่วยฉุกเฉิน',     files: [1,2,3,4,5,6,7,8,9] },
    { key: 'IP',      label: 'ค่าบริการสาธารณสุขกรณีผู้ป่วยใน (IP)',           files: [1,2,3,4,5,6,7,8,14,15] },
];

/**
 * แฟ้มที่ "อยู่ในขอบเขตกองทุน แต่ส่งเฉพาะเมื่อเข้าเงื่อนไข"
 * เอกสารจัดแฟ้ม 9–13 ไว้ในกลุ่ม "กลุ่มเฉพาะ / กรณีพิเศษ" และแฟ้ม 15 ระบุชัดว่า
 * "กรณีมีการลากลับบ้าน" → ไม่ใช่ทุก Visit ต้องส่ง  [D2 น.9, น.12 · D3 สไลด์ 4]
 * แฟ้ม 1–8 และ 14 (IP) เป็นแฟ้มบังคับเมื่อกองทุนนั้นครอบคลุม
 */
const NHSO_FILE_CONDITION = {
    9:  { key: 'emergency',  label: 'กรณีอุบัติเหตุ ฉุกเฉิน หรือรับส่งต่อ' },
    10: { key: 'prenatal',   label: 'กรณีหญิงตั้งครรภ์' },
    11: { key: 'newborn',    label: 'กรณีคลอดทารก' },
    12: { key: 'psych',      label: 'กรณีผู้ป่วยจิตเวชเรื้อรังในชุมชน' },
    13: { key: 'disability', label: 'กรณีผู้พิการ' },
    15: { key: 'leaveDay',   label: 'กรณีผู้ป่วยในลากลับบ้าน' },
};

/**
 * [D2 น.13] กลุ่มบริการที่ย้ายเข้าชุดข้อมูลมาตรฐานแล้ว vs ที่ยังดำเนินการอยู่
 * ชุดที่ 2 = ยังส่งผ่าน platform ใหม่ไม่ได้ ต้องคงเส้นทางเดิมไว้
 */
const NHSO_SERVICE_SETS = [
    {
        set: 1, status: 'DONE', badge: 'completed',
        title: 'กลุ่มบริการที่ดำเนินการเสร็จสิ้นแล้ว (ชุดที่ 1)',
        asOf: 'ณ วันที่ 31 มีนาคม 2567',
        items: [
            'ค่าบริการผู้ป่วยนอกทั่วไป',
            'ค่าบริการสร้างเสริมสุขภาพและป้องกันโรค',
            'ค่าบริการเพิ่มเติมสำหรับบริการปฐมภูมิ (QOF)',
            'ค่าบริการผู้ป่วยจิตเวชเรื้อรังในชุมชน',
            'ค่าบริการผู้ป่วยโรคเบาหวานและความดันโลหิตสูง',
            'ค่าบริการแพทย์แผนไทยและการแพทย์ทางเลือก',
            'ค่าบริการฟื้นฟูสมรรถภาพด้านการแพทย์',
            'ค่าบริการกรณีเฉพาะผู้ป่วยระยะสุดท้าย',
            'ค่าบริการกลุ่มโรคมะเร็ง',
            'ค่าบริการ Tele Med',
            'ค่าบริการผู้ป่วยใน',
        ],
    },
    {
        set: 2, status: 'WIP', badge: 'in-progress',
        title: 'กลุ่มบริการที่ยังดำเนินการอยู่ (ชุดที่ 2)',
        asOf: 'ยังไม่ประกาศชุดข้อมูลมาตรฐาน',
        warn: 'ยังส่งผ่าน NHSO Digital Platform ไม่ได้ — ต้องคงช่องทางเดิมไว้จนกว่าจะประกาศ',
        items: [
            'การบริการบำบัดทดแทนไต (CKD)',
            'การให้บริการผู้ป่วยติดเชื้อ HIV และผู้ป่วยโรคเอดส์',
            'การให้บริการผู้ป่วยวัณโรค (TB)',
        ],
    },
];


/* ══════════════════════════════════════════════════════════
   3. Business Journey (สไลด์ 5 ของเอกสาร V4 · [D2 น.22])
   ══════════════════════════════════════════════════════════ */

/**
 * [D2 น.7] "NHSO Digital Platform Journey" — เส้นทางการทำงาน 7 ขั้น
 * ตั้งแต่เตรียมข้อมูลจนถึงการตัดบัญชีลูกหนี้ · มองจากมุมหน่วยบริการ
 * (Business Journey ด้านล่างมองจากมุมระบบ — คนละมุม ใช้คู่กัน)
 */
const NHSO_JOURNEY_7STEP = [
    { no: 1, label: 'จัดเตรียมข้อมูลพื้นฐาน', icon: 'database',
      sub: 'Catalog / Mapping / Token key', ours: true },
    { no: 2, label: 'ตรวจสอบสิทธิก่อนเข้ารับบริการ', icon: 'id-card',
      sub: 'ตรวจก่อนให้บริการ ไม่ใช่หลังให้บริการ' },
    { no: 3, label: 'บันทึกข้อมูลบริการใน HIS ให้ครบถ้วน', icon: 'clipboard-list',
      sub: 'บันทึกครั้งเดียว ไม่ต้องคีย์ซ้ำผ่านโปรแกรมกลาง' },
    { no: 4, label: 'ปิดสิทธิ และปิด Visit', icon: 'lock',
      sub: 'Complete / Waiting / Incomplete', ours: true },
    { no: 5, label: 'เชื่อม API เบิกจ่าย NHSO และประมวลผล', icon: 'plug',
      sub: 'ส่งเบิก Auto / Manual' },
    { no: 6, label: 'ออกรายงานตอบกลับ และออก Statement', icon: 'file-text',
      sub: 'Transaction / Statement / พึงรับ พึงจ่าย' },
    { no: 7, label: 'โอนเงิน และตัดบัญชีลูกหนี้', icon: 'banknote',
      sub: 'เคลียร์บัญชีลูกหนี้เป็นรายบุคคล', ours: true },
];

/** [D2 น.7] หมายเหตุท้ายเส้นทาง — สิทธิข้าราชการมีขั้นตอนเพิ่ม */
const NHSO_JOURNEY_NOTE =
    'กรณีสิทธิข้าราชการ ต้องส่งใบคำขอเบิกก่อนโอนเงิน — เป็นเส้นทางแยกจากสิทธิอื่น';

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

const NHSO_GOLIVE = {
    label: 'Go-Live เป้าหมาย', date: '16 ก.ย. 2569', iso: '2569-09-16',
    scope: 'สำหรับโรงพยาบาลที่พร้อม',
    note: 'เอกสารไม่ได้ระบุวันปิดระบบ e-Claim เดิม และไม่ได้ระบุวันสำรอง '
        + '→ ต้องวางแผน Parallel Run เอง',
};

/**
 * [D2 น.17–20] แผนปฏิบัติการ 4 ปี (พ.ศ. 2567–2570) — ชั้นบริบทเหนือ roadmap ด้านบน
 * ใช้ตอบคำถาม "16 ก.ย. 2569 แล้วยังไงต่อ" — คำตอบคือ 1 ต.ค. 2569 ทุกกองทุนทุกสิทธิ
 *
 * ⚠️ เอกสาร 2 ฉบับให้วันไม่ตรงกัน — D2 (23 มิ.ย. 69) ระบุนำร่อง รพ. 1 ก.ค. 2569
 *    ส่วน D3 (3 ส.ค. 69 · ใหม่กว่า) ระบุ Go-Live 16 ก.ย. 2569
 *    ระบบยึด D3 เป็นหมุดหลัก และเก็บ D2 ไว้เป็นชั้นแผนระยะยาว
 */
const NHSO_MASTERPLAN = {
    title: 'เส้นทางสู่อนาคต: แผนปฏิบัติการ 4 ปี (พ.ศ. 2567 – 2570)',
    subtitle: 'จากจุดเริ่มต้นของการกำหนดมาตรฐาน สู่เป้าหมายการบูรณาการระบบสุขภาพเต็มรูปแบบทั่วประเทศ',
    source: 'NHSO Digital Platform Overview · 23 มิ.ย. 2569 น.17–20',
    phases: [
        {
            phase: 'ระยะที่ 1', when: 'พ.ศ. 2567 – กลางปี 2568', status: 'DONE',
            title: 'วางรากฐานและระบบนำร่อง',
            milestones: [
                'ปี 2567 — ประกาศชุดข้อมูลมาตรฐานการเบิกจ่ายชดเชย (Standard Data Set for Claim)',
                '1 มิถุนายน 2568 — เริ่มทดลองใช้ระบบ นำร่องหน่วยบริการปฐมภูมิบางส่วนใน กทม.',
            ],
        },
        {
            phase: 'ระยะที่ 2', when: 'ปลายปี 2568 – กลางปี 2569', status: 'ACTIVE',
            title: 'การขยายผลครั้งใหญ่ระดับประเทศ',
            milestones: [
                '1 ตุลาคม 2568 — ครอบคลุมพื้นที่ กทม. และหน่วยบริการปฐมภูมิ ทุกกองทุน',
                '1 เมษายน 2569 — เริ่ม รพ.สต. และหน่วยบริการปฐมภูมิ 905 แห่ง',
                '1 พฤษภาคม 2569 — ขยายครอบคลุม รพ.สต. ทั่วประเทศ',
                '1 กรกฎาคม 2569 — นำร่องระดับโรงพยาบาล 1,700 แห่ง (ตามเอกสาร 23 มิ.ย. 69)',
            ],
        },
        {
            phase: 'ระยะที่ 3', when: 'เริ่มปีงบประมาณ 2570 — อ้างอิง 1 ตุลาคม 2569', status: 'NEXT',
            title: 'บูรณาการเต็มรูปแบบ',
            milestones: [
                'ใช้งานจริงกับหน่วยบริการทั้งประเทศ',
                'รองรับการเบิกจ่ายทุกกองทุนสุขภาพอย่างสมบูรณ์',
                'บันทึกข้อมูลใน HIS เพียงครั้งเดียว แล้วเชื่อมโยงเบิกจ่ายได้ทันที',
            ],
        },
    ],
};

/** [D2 น.20] ขอบเขตผู้จ่ายปลายทางเมื่อบูรณาการเต็มรูปแบบ — ไม่ใช่ UC อย่างเดียว */
const NHSO_ALL_PAYERS = [
    'UC (บัตรทอง)', 'ประกันสังคม', 'ข้าราชการ (กรมบัญชีกลาง)',
    'อปท. (LGO)', 'กทม. (OFC BKK)', 'ขสมก.', 'รฟท.', 'ครูเอกชน', 'การแพทย์ฉุกเฉิน',
];

/** [D2 น.5–6] เป้าหมายและวัตถุประสงค์ของ platform — ใช้ตรวจว่าระบบเราเสริมตรงจุด */
const NHSO_OBJECTIVES = [
    { no: 1, label: 'ชุดมาตรฐานการเบิกจ่าย',  desc: 'กำหนด NHSO Standard Dataset ภายใต้ชุดข้อมูลมาตรฐาน' },
    { no: 2, label: 'เชื่อมโยงข้อมูลจาก HIS', desc: 'เชื่อมจากระบบสารสนเทศของหน่วยบริการโดยตรง ไม่ผ่านโปรแกรมกลาง' },
    { no: 3, label: 'ตรวจสอบก่อนเบิกจ่าย',   desc: 'มีระบบช่วยตรวจสอบความถูกต้องของข้อมูลก่อนการเบิกจ่ายจริง', ours: true },
    { no: 4, label: 'จำแนกเบิกจ่ายอัตโนมัติ', desc: 'เบิกจ่ายราย Visit โดยไม่ต้องแยกเบิกตามกองทุนย่อยเอง' },
    { no: 5, label: 'ติดตามได้ทุกขั้นตอน',    desc: 'หน่วยบริการตรวจสอบสถานะการเบิกจ่ายได้ตลอดกระบวนการ', ours: true },
    { no: 6, label: 'Clear บัญชีลูกหนี้',     desc: 'เคลียร์บัญชีลูกหนี้ได้เป็นรายบุคคล', ours: true },
];

/**
 * [D2 น.6 ข้อ 4 · น.27] การจำแนกกองทุนย่อยเป็นหน้าที่ของ platform ไม่ใช่ของโรงพยาบาล
 * → "กองทุนที่ชดเชย" เป็นผลลัพธ์ที่ได้กลับมา ไม่ใช่ค่าที่เราเลือกตอนส่ง
 */
const NHSO_SUBFUND_AUTO = {
    principle: 'เบิกจ่ายราย Visit — ระบบจำแนกกองทุนย่อยให้อัตโนมัติ',
    detail: 'หน่วยบริการส่งข้อมูลการให้บริการเป็นราย Visit ครั้งเดียว '
          + 'NHSO Digital Platform จะจำแนกว่ารายการใดตกกองทุนย่อยใด '
          + 'และแสดงผลกลับมาเป็นคอลัมน์รายกองทุนใน Statement',
    impact: 'ระบบเราจึงต้องเก็บทั้ง "กองทุนที่เราคาดว่าจะเบิก" และ '
          + '"กองทุนที่ สปสช. จำแนกจ่ายจริง" แล้วกระทบยอดกัน',
};

/**
 * [D2 น.2, น.6 ข้อ 6] 1 รายการอาจถูกจ่ายจากหลายกองทุนย่อย คนละเวลากัน
 * เป็นเหตุผลที่การกระทบยอดบัญชีลูกหนี้ทำได้ยากในระบบเดิม
 */
const NHSO_CLEAR_AR = {
    problem: 'หน่วยบริการกระทบยอดบัญชีลำบาก เนื่องจากมีกองทุนย่อยจำนวนมาก '
           + 'และการจ่ายเงินไม่พร้อมกันใน 1 รายการ',
    target: 'Clear บัญชีลูกหนี้ — เคลียร์ได้เป็นรายบุคคล',
    impact: '1 เคส ต้องรองรับการรับชำระหลายงวด หลายกองทุน และยอดเรียกคืน',
};

/** [D3 สไลด์ 9] การเข้าสู่ระบบ NHSO Portal */
const NHSO_PORTAL_LOGIN = {
    method: 'ThaiD',
    otp: 'SMS OTP 6 หลัก',
    desc: 'เข้าสู่ระบบผ่าน ThaiD แล้วใส่รหัส SMS OTP 6 หลัก',
    impact: 'ผู้ใช้ทุกคนต้องมี ThaiD และเบอร์มือถือที่ลงทะเบียนไว้ '
          + '· สคริปต์ล็อกอินหน้าเว็บอัตโนมัติทำไม่ได้ ต้องไปทาง API เท่านั้น',
    roles: 'ต้องตั้งค่าผู้ใช้ให้ครบทุก Role ก่อนเข้า UAT',
};


/* ══════════════════════════════════════════════════════════
   5. งานที่ต้องเตรียมก่อน UAT (สไลด์ 7 — Pre Tasks ช่วง Hand Shake)
   ══════════════════════════════════════════════════════════ */
const NHSO_PRETASKS = [
    { no: 1, title: 'ขอ Source ID', desc: 'ขึ้นทะเบียน Software Vendor กับ NHSO Digital Platform',
      owner: 'ศูนย์คอมพิวเตอร์ + ผู้พัฒนา', due: '2569-08-22', status: 'DONE',
      note: 'ผู้พัฒนาซอฟต์แวร์ต้องขึ้นทะเบียนเอง ไม่ใช่แค่โรงพยาบาล' },
    { no: 2, title: 'เชื่อมต่อ API', desc: 'ขอ Client ID / Token สำหรับ Test Environment',
      owner: 'ศูนย์คอมพิวเตอร์', due: '2569-08-29', status: 'PROGRESS',
      note: '[D2 น.7] Token key เป็นส่วนหนึ่งของ "จัดเตรียมข้อมูลพื้นฐาน" '
          + '· credential ของ Test แยกจาก Production ต้องมีขั้นตอนเลื่อนขึ้น Prod' },
    { no: 3, title: 'ตั้งค่า User', desc: 'ผู้ใช้งาน NHSO Portal ครบทุก Role ที่ต้องการ',
      owner: 'ศูนย์จัดเก็บรายได้', due: '2569-08-29', status: 'PROGRESS',
      note: 'เข้าระบบด้วย ThaiD + SMS OTP 6 หลัก → ผู้ใช้ทุกคนต้องมี ThaiD '
          + 'และเบอร์มือถือที่ลงทะเบียนไว้ก่อน' },
    { no: 4, title: 'พัฒนาระบบ', desc: 'เชื่อมต่อ HIS → NHSO Platform ตาม Standard Dataset ล่าสุด',
      owner: 'ผู้พัฒนา + ศูนย์คอมพิวเตอร์', due: '2569-09-05', status: 'PROGRESS',
      note: 'คำว่า "ล่าสุด" สำคัญ — Standard Dataset เป็นเป้าเคลื่อนที่ '
          + 'ต้องตรวจเวอร์ชันประกาศทุกครั้ง ไม่ตรึงไว้เวอร์ชันเดียว' },
    { no: 5, title: 'Mapping Drug & Service Catalogue',
      desc: 'ปรับปรุงให้หน่วยบริการส่งรายการตาม Drug / Service Catalog ที่ให้ข้อมูลไว้กับ สปสช.',
      owner: 'เภสัชกรรม + ศูนย์จัดเก็บรายได้', due: '2569-09-05', status: 'TODO',
      note: '[D2 น.8] เป็นงานฐานที่ต้องเสร็จก่อน UAT — รหัสในโรงพยาบาลต้องแมปกับ '
          + 'รายการที่ขึ้นทะเบียนไว้กับ สปสช. รายการที่แมปไม่ได้จะเบิกไม่ผ่าน' },
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
    vendor:      'MediClearing (ขึ้นทะเบียนแล้ว)',
};


/* ══════════════════════════════════════════════════════════
   7. รายงาน (สไลด์ 40–45)
   ══════════════════════════════════════════════════════════ */
/** เมนู Reports — รวมจาก [D2 น.27 เมนูซ้าย] + [D3 สไลด์ 40–45] */
const NHSO_REPORT_TYPES = [
    { key: 'TRANSACTION', label: 'Transaction Reports',            desc: 'รายการที่นำเข้าและผลการตรวจสอบรายระเบียน · กรองด้วยวันที่นำเข้า + สถานะข้อมูล' },
    { key: 'STATEMENT',   label: 'Statement Reports',              desc: 'สรุปยอดที่ผ่านการตรวจสอบและเข้าสู่การจ่าย' },
    { key: 'OFC',         label: 'Statement OFC และสิทธิอื่น',      desc: 'แยกตามสิทธิข้าราชการและสิทธิอื่น ๆ — คนละสายกับ Statement หลัก' },
    { key: 'REFER',       label: 'OP Refer Report',                desc: 'รายการผู้ป่วยนอกที่รับส่งต่อระหว่างหน่วยบริการ' },
    { key: 'AR',          label: 'Report พึงรับ พึงจ่าย',           desc: 'กระทบยอดลูกหนี้ค่ารักษาพยาบาลรายงวด' },
];

/** กติกาจริงจากเอกสาร — ต้องขึ้นเป็นแบนเนอร์ให้ผู้ใช้เห็น [D2 น.27 · D3 สไลด์ 41] */
const NHSO_REPORT_PASSWORD_RULE =
    'ไฟล์ที่ดาวน์โหลดถูกตั้งรหัสผ่าน = Username (ตัวอักษรพิมพ์เล็กทั้งหมด) ที่ Log In เข้าระบบ '
  + 'ตามด้วยเลขบัตรประจำตัวประชาชน 5 หลักสุดท้าย  ตัวอย่าง: xxxx12345';

/** [D2 น.27] หมายเหตุบนหน้าจอ Statement Report */
const NHSO_STATEMENT_TAX_NOTE = 'ยอดจ่าย/ยอดขอเบิกที่แสดง เป็นยอดก่อนหักภาษี';

/** [D2 น.26–28] กติกาการตั้งชื่อรายงานและไฟล์ของจริง */
const NHSO_REPORT_NAMING = [
    { key: 'STATEMENT', label: 'ชื่อ Statement',
      pattern: 'OP_<รหัสรายงาน>_<ปีเดือน พ.ศ.>_<ลำดับ>_<rev>',
      sample: 'OP_0012_6902_54_1', note: '6902 = ปี 2569 เดือน 02' },
    { key: 'STATEMENT_FILE', label: 'ชื่อไฟล์ Statement',
      pattern: 'Statement_<ชื่อ Statement>_<รหัสหน่วยบริการ>_<yyyymmdd พ.ศ.>.xlsx',
      sample: 'Statement_OP_0012_6902_54_1_13705_25690225.xlsx' },
    { key: 'TRANSACTION', label: 'ชื่อรายงาน Transaction',
      pattern: 'Trans_<ddmmyyyy ตั้งแต่>_<ddmmyyyy ถึง>',
      sample: 'Trans_01072568_09072568' },
];

/**
 * [D2 น.27] คอลัมน์การเงินของ Statement ตัวจริง
 * "จ่ายเพิ่ม" และ "เรียกคืน" คือส่วนที่ระบบเดิมของเราไม่เคยมี
 */
const NHSO_STATEMENT_COLUMNS = [
    { key: 'billed',      label: 'ยอดเรียกเก็บ',     tone: 'blue'  },
    { key: 'compensated', label: 'จ่ายชดเชย',        tone: 'green' },
    { key: 'extra',       label: 'จ่ายเพิ่ม',         tone: 'green' },
    { key: 'clawback',    label: 'เรียกคืน',          tone: 'red'   },
    { key: 'transferred', label: 'เงินโอนเข้าบัญชี',  tone: 'navy'  },
];

/**
 * amount = ยอดเรียกเก็บ (คงชื่อเดิมไว้ไม่ให้หน้าจอเดิมพัง)
 * comp / extra / clawback / transferred = คอลัมน์การเงินตาม NHSO_STATEMENT_COLUMNS
 * เงินโอนเข้าบัญชี = จ่ายชดเชย + จ่ายเพิ่ม − เรียกคืน
 */
const MOCK_NHSO_REPORTS = [
    { id: 'RPT-TX-690805', type: 'TRANSACTION', name: 'Trans_01082569_05082569', period: 'ส.ค. 2569',
      fund: 'ทุกกองทุน', created: '2569-08-06T06:00', rows: 412, amount: 1284500,
      comp: 1198400, extra: 0, clawback: 0, transferred: 1198400, status: 'READY',
      file: 'Trans_01082569_05082569_11812_25690806.xlsx' },
    { id: 'RPT-TX-690731', type: 'TRANSACTION', name: 'Trans_01072569_31072569', period: 'ก.ค. 2569',
      fund: 'ทุกกองทุน', created: '2569-08-01T06:00', rows: 9884, amount: 28741200,
      comp: 27385600, extra: 0, clawback: 0, transferred: 27385600, status: 'READY',
      file: 'Trans_01072569_31072569_11812_25690801.xlsx' },
    { id: 'RPT-ST-690715', type: 'STATEMENT',   name: 'OP_0012_6907_18_1', period: 'ก.ค. 2569 (1–15)',
      fund: 'UC', created: '2569-07-22T09:00', rows: 4412, amount: 12980400,
      comp: 12402100, extra: 41800, clawback: 96400, transferred: 12347500, status: 'PAID',
      file: 'Statement_OP_0012_6907_18_1_11812_25690722.xlsx' },
    { id: 'RPT-ST-690731', type: 'STATEMENT',   name: 'OP_0012_6907_44_1', period: 'ก.ค. 2569 (16–31)',
      fund: 'UC', created: '2569-08-05T09:00', rows: 4108, amount: 11842700,
      comp: 11208300, extra: 0, clawback: 0, transferred: 11208300, status: 'READY',
      file: 'Statement_OP_0012_6907_44_1_11812_25690805.xlsx' },
    { id: 'RPT-OFC-690731', type: 'OFC',        name: 'OFC_0013_6907_09_1', period: 'ก.ค. 2569',
      fund: 'OFC', created: '2569-08-05T09:00', rows: 884, amount: 3918100,
      comp: 3702400, extra: 12600, clawback: 31200, transferred: 3683800, status: 'READY',
      file: 'Statement_OFC_0013_6907_09_1_11812_25690805.xlsx' },
    { id: 'RPT-OFC-690630', type: 'OFC',        name: 'OFC_0013_6906_07_1', period: 'มิ.ย. 2569',
      fund: 'SSS / LGO / EMS', created: '2569-07-05T09:00', rows: 512, amount: 2244800,
      comp: 2118600, extra: 0, clawback: 18700, transferred: 2099900, status: 'PAID',
      file: 'Statement_OFC_0013_6906_07_1_11812_25690705.xlsx' },
    { id: 'RPT-RF-690731', type: 'REFER',       name: 'OP Refer Report — ก.ค. 2569', period: 'ก.ค. 2569',
      fund: 'ทุกกองทุน', created: '2569-08-05T10:00', rows: 264, amount: 1842300,
      comp: 1704900, extra: 0, clawback: 0, transferred: 1704900, status: 'READY',
      file: 'OPRefer_01072569_31072569_11812_25690805.xlsx' },
    { id: 'RPT-AR-690731', type: 'AR',          name: 'รายงานพึงรับ พึงจ่าย — ก.ค. 2569', period: 'ก.ค. 2569',
      fund: 'ทุกกองทุน', created: '2569-08-05T10:00', rows: 9884, amount: 28741200,
      comp: 27385600, extra: 41800, clawback: 127600, transferred: 27299800, status: 'READY',
      file: 'AR_01072569_31072569_11812_25690805.xlsx' },
    { id: 'RPT-AR-690630', type: 'AR',          name: 'รายงานพึงรับ พึงจ่าย — มิ.ย. 2569', period: 'มิ.ย. 2569',
      fund: 'ทุกกองทุน', created: '2569-07-05T10:00', rows: 9210, amount: 26418900,
      comp: 25102400, extra: 0, clawback: 18700, transferred: 25083700, status: 'PAID',
      file: 'AR_01062569_30062569_11812_25690705.xlsx' },
];

/** ยอดพึงรับ vs ยอดที่จ่ายจริง รายงวด — ใช้ทำกราฟกระทบยอด */
const MOCK_NHSO_RECON = [
    { period: 'มี.ค. 69', expect: 24180000, paid: 22910000 },
    { period: 'เม.ย. 69', expect: 25640000, paid: 24020000 },
    { period: 'พ.ค. 69', expect: 26120000, paid: 24880000 },
    { period: 'มิ.ย. 69', expect: 26418900, paid: 25102400 },
    { period: 'ก.ค. 69', expect: 28741200, paid: 27385600 },
];

/**
 * [D2 น.2, น.6] ตัดบัญชีลูกหนี้รายบุคคล — 1 เคสอาจได้รับชำระหลายงวด หลายกองทุน
 * ตัวอย่างนี้ผูกกับเคสจริงใน MOCK_CLAIMS เพื่อให้กระทบยอดได้ถึงรายคน
 */
const MOCK_NHSO_AR_LINES = [
    { case_id: 'CLM-2569-0031', seq: '690714-0031', patient: 'สมหญิง ทองดี', billed: 4820,
      lines: [
        { period: 'ก.ค. 69 (1–15)', subfund: 'กองทุนผู้ป่วยนอก',                 paid: 3200, at: '2569-07-22' },
        { period: 'ก.ค. 69 (16–31)', subfund: 'บริการสร้างเสริมสุขภาพฯ (PP)',    paid: 980,  at: '2569-08-05' },
      ], clawback: 0 },
    { case_id: 'CLM-2569-0042', seq: '690728-0042', patient: 'ประยูร แสงทอง', billed: 12400,
      lines: [
        { period: 'ก.ค. 69 (16–31)', subfund: 'กองทุนผู้ป่วยนอก',                paid: 9600, at: '2569-08-05' },
      ], clawback: 1240, note: 'เรียกคืนบางส่วนจากผลตรวจ Audit' },
    { case_id: 'CLM-2569-0055', seq: '690731-0055', patient: 'วิภา จันทร์เพ็ญ', billed: 38600,
      lines: [
        { period: 'ก.ค. 69 (16–31)', subfund: 'กองทุนผู้ป่วยใน (IP)',            paid: 31200, at: '2569-08-05' },
      ], clawback: 0, note: 'รอ Statement งวดถัดไปสำหรับส่วนที่เหลือ' },
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

    /**
     * จำนวน + มูลค่า ของแต่ละขั้น — ใช้ทั้ง stepper และ KPI
     * amount คงไว้เพื่อความเข้ากันได้ · billed/compensated คือคู่ยอดตามหน้าจอจริง
     */
    stageStats() {
        return NHSO_STATUS_PIPELINE.map(s => {
            const rows = this.byStage(s.key);
            const billed = rows.reduce((a, c) => a + (c.amount_claimed || 0), 0);
            const compensated = rows.reduce((a, c) => a + this.compensated(c), 0);
            return { ...s, count: rows.length, amount: billed, billed, compensated };
        });
    },

    /** ยอดชดเชยที่ สปสช. จ่ายจริงของเคสหนึ่ง (0 จนกว่าจะถึงขั้นจ่าย) */
    compensated(c) {
        if (!c || !c.nhso) return 0;
        if (typeof c.nhso.compensated === 'number') return c.nhso.compensated;
        return 0;
    },

    /** [D2 น.23–24] สรุปราย "ถัง" — หน่วยบริการ vs สปสช. */
    bucketStats() {
        const stats = this.stageStats();
        return NHSO_OWNER_BUCKETS.map(b => {
            const rows = stats.filter(s => b.stages.includes(s.key));
            return {
                ...b,
                stages: rows,
                count:       rows.reduce((a, s) => a + s.count, 0),
                billed:      rows.reduce((a, s) => a + s.billed, 0),
                compensated: rows.reduce((a, s) => a + s.compensated, 0),
            };
        });
    },

    filesByGroup(g) { return NHSO_FILES.filter(f => f.group === g); },

    file(no) { return NHSO_FILES.find(f => f.no === Number(no)) || null; },

    /** ผลรวมฟิลด์ทั้งชุด — ต้องได้ 72 / 16 / 72 / 160 ตามประกาศ */
    fieldTotals() {
        return NHSO_FILES.reduce((a, f) => ({
            req:   a.req   + f.req,
            cond:  a.cond  + f.cond,
            opt:   a.opt   + f.opt,
            total: a.total + f.fields,
        }), { req: 0, cond: 0, opt: 0, total: 0 });
    },

    /** ความครบของ Mapping เป็น % — ผูกกับ pre-task ข้อ 5 */
    mappingPct() {
        const w = { DONE: 1, PARTIAL: 0.5, TODO: 0 };
        const s = NHSO_FILES.reduce((a, f) => a + w[f.mapping], 0);
        return Math.round((s / NHSO_FILES.length) * 100);
    },

    /* ── กองทุน × แฟ้ม [D2 น.14–16] ─────────────────────── */

    fund(key) { return NHSO_FUND_FILES.find(f => f.key === key) || null; },

    /** แฟ้มที่กองทุนหนึ่งต้องส่ง — คืนเป็น object แฟ้มเต็ม ไม่ใช่แค่เลข */
    requiredFiles(fundKey) {
        const f = this.fund(fundKey);
        return f ? f.files.map(no => this.file(no)).filter(Boolean) : [];
    },

    /**
     * ตรวจว่าเคสส่งแฟ้มครบตามกองทุนหรือยัง — หัวใจของกฎ RUL-FIL-001
     * แฟ้มกลุ่มเฉพาะจะนับเป็น "ต้องส่ง" ก็ต่อเมื่อเคสเข้าเงื่อนไขนั้นจริง
     * @param {string}   fundKey รหัสกองทุนใน NHSO_FUND_FILES
     * @param {number[]} sent    เลขแฟ้มที่ส่งไปแล้ว
     * @param {object}   ctx     ธงเงื่อนไข เช่น { emergency: true, leaveDay: false }
     */
    checkFiles(fundKey, sent, ctx) {
        const need = this.fund(fundKey);
        const has  = (sent || []).map(Number);
        if (!need) {
            return { ok: true, fundLabel: '—', inScope: [], required: [],
                     sent: has, missing: [], notApplicable: [], extra: [] };
        }
        const c = ctx || {};
        const required      = need.files.filter(no => !NHSO_FILE_CONDITION[no] || c[NHSO_FILE_CONDITION[no].key]);
        const notApplicable = need.files.filter(no => !required.includes(no));
        const missing       = required.filter(no => !has.includes(no));
        return {
            ok: missing.length === 0,
            fundLabel: need.label,
            inScope: need.files,
            required, notApplicable, missing,
            sent: has,
            extra: has.filter(no => !need.files.includes(no)),
        };
    },

    /** เงื่อนไขของแฟ้มกลุ่มเฉพาะ — คืน null ถ้าแฟ้มนั้นบังคับเสมอ */
    fileCondition(no) { return NHSO_FILE_CONDITION[Number(no)] || null; },

    /** ชื่อแฟ้มสั้น ๆ สำหรับแสดงในข้อความเตือน เช่น "9 AER, 14 IPD" */
    fileNames(nos) {
        return (nos || []).map(no => {
            const f = this.file(no);
            return f ? `${f.no} ${f.en.replace(/^NHSO /, '')}` : String(no);
        }).join(', ');
    },

    /* ── อื่น ๆ ──────────────────────────────────────────── */

    /** กลุ่มบริการชุดที่ 2 ที่ยังส่งผ่าน platform ใหม่ไม่ได้ */
    pendingServiceSet() { return NHSO_SERVICE_SETS.find(s => s.status === 'WIP') || null; },

    visitClose(key) { return NHSO_VISIT_CLOSE.find(v => v.key === key) || null; },

    /** ค่าที่ยังยืนยันกับเอกสารไม่ได้ → ให้หน้าจอขึ้นป้าย "รอยืนยัน" */
    unverified(o) { return !!o && o.verified === false; },

    arLines() { return MOCK_NHSO_AR_LINES; },
};

MockDB.register('nhso_imports', MOCK_NHSO_IMPORTS);
MockDB.register('nhso_reports', MOCK_NHSO_REPORTS);

window.NHSO_UNVERIFIED_NOTE     = NHSO_UNVERIFIED_NOTE;
window.NHSO_STATUS_PIPELINE     = NHSO_STATUS_PIPELINE;
window.NHSO_OWNER_BUCKETS       = NHSO_OWNER_BUCKETS;
window.NHSO_AMOUNT_LEGEND       = NHSO_AMOUNT_LEGEND;
window.NHSO_VISIT_CLOSE         = NHSO_VISIT_CLOSE;
window.NHSO_ACTIVITY_CODES      = NHSO_ACTIVITY_CODES;
window.NHSO_STAGE_LABEL         = NHSO_STAGE_LABEL;
window.NHSO_STAGE_BADGE         = NHSO_STAGE_BADGE;
window.NHSO_DATASET_ANNOUNCE    = NHSO_DATASET_ANNOUNCE;
window.NHSO_FILE_GROUPS         = NHSO_FILE_GROUPS;
window.NHSO_FILES               = NHSO_FILES;
window.NHSO_FILE_ORIGINS        = NHSO_FILE_ORIGINS;
window.NHSO_FUND_FILES          = NHSO_FUND_FILES;
window.NHSO_FILE_CONDITION      = NHSO_FILE_CONDITION;
window.NHSO_SERVICE_SETS        = NHSO_SERVICE_SETS;
window.NHSO_MAPPING_TONE        = NHSO_MAPPING_TONE;
window.NHSO_JOURNEY             = NHSO_JOURNEY;
window.NHSO_JOURNEY_7STEP       = NHSO_JOURNEY_7STEP;
window.NHSO_JOURNEY_NOTE        = NHSO_JOURNEY_NOTE;
window.NHSO_ROADMAP             = NHSO_ROADMAP;
window.NHSO_MASTERPLAN          = NHSO_MASTERPLAN;
window.NHSO_ALL_PAYERS          = NHSO_ALL_PAYERS;
window.NHSO_OBJECTIVES          = NHSO_OBJECTIVES;
window.NHSO_SUBFUND_AUTO        = NHSO_SUBFUND_AUTO;
window.NHSO_CLEAR_AR            = NHSO_CLEAR_AR;
window.NHSO_PORTAL_LOGIN        = NHSO_PORTAL_LOGIN;
window.NHSO_GOLIVE              = NHSO_GOLIVE;
window.NHSO_PRETASKS            = NHSO_PRETASKS;
window.NHSO_PRETASK_TONE        = NHSO_PRETASK_TONE;
window.MOCK_NHSO_IMPORTS        = MOCK_NHSO_IMPORTS;
window.MOCK_NHSO_API            = MOCK_NHSO_API;
window.NHSO_REPORT_TYPES        = NHSO_REPORT_TYPES;
window.NHSO_REPORT_PASSWORD_RULE= NHSO_REPORT_PASSWORD_RULE;
window.NHSO_STATEMENT_TAX_NOTE  = NHSO_STATEMENT_TAX_NOTE;
window.NHSO_REPORT_NAMING       = NHSO_REPORT_NAMING;
window.NHSO_STATEMENT_COLUMNS   = NHSO_STATEMENT_COLUMNS;
window.MOCK_NHSO_REPORTS        = MOCK_NHSO_REPORTS;
window.MOCK_NHSO_RECON          = MOCK_NHSO_RECON;
window.MOCK_NHSO_AR_LINES       = MOCK_NHSO_AR_LINES;
window.NHSO_REPORT_STATUS       = NHSO_REPORT_STATUS;
window.MockNhso                 = MockNhso;
