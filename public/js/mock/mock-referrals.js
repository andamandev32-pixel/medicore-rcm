/**
 * MediCore RCM — MOCK REFERRALS (การส่งต่อผู้ป่วยไปรักษาภายนอก)
 * ------------------------------------------------------------
 * ครอบคลุม workflow ที่ SRS §7 กำหนดไว้แต่ยังไม่เคยมีในระบบ:
 *   "เลขอนุมัติ Referral/Pre-auth" — ขอส่งต่อ → ขออนุมัติ → ออกใบส่งตัว
 *   → ถูกเรียกเก็บ/เรียกเก็บ → ตามจ่าย/รับชำระ
 *
 * ⭐ อาร์เรย์เดียว แยกทิศทางด้วย direction (แบบเดียวกับ MOCK_CLAIMS ที่แยกด้วย service_type)
 *      OUT = เราเป็นต้นสังกัด ส่งผู้ป่วยออกไป → ปลายทางเรียกเก็บมาที่เรา → เรา "ตามจ่าย" (AP)
 *      IN  = หน่วยบริการอื่นส่งผู้ป่วยมาที่เรา → เรา "เรียกเก็บ" ต้นทาง/สปสช. (AR)
 *
 * ⭐ ใบเรียกเก็บแยกเป็น MOCK_REFER_BILLS เพราะ 1 การส่งต่อ → N ใบ
 *    และการเรียกเก็บซ้ำซ้อนเกิดที่ระดับใบ (มีทั้ง channel ต้นทาง และ nhso_claim_id)
 *
 * ⚠️ ห้ามเก็บค่าที่คำนวณได้ลง seed — billed / paid / disputed / outstanding / aging
 *    ทั้งหมด derive ผ่าน MockRefer.* เท่านั้น ไม่งั้นตัวเลขบน dashboard กับหน้า
 *    billing จะเพี้ยนกันกลางการนำเสนอ (doc/PAGE-GUIDE.md §7B)
 *
 * วันอ้างอิง: 6 ส.ค. 2569 (MockDB.TODAY) · วันที่ทั้งไฟล์เป็น พ.ศ.
 */

/* ══════════════════════════════════════════════════════════
   1. คำศัพท์ประจำโดเมน
   ══════════════════════════════════════════════════════════ */

const REFER_DIRECTION = [
    { key: 'OUT', label: 'ส่งต่อออก', icon: 'log-out', money: 'AP',
      sub: 'เราเป็นต้นสังกัด — ตามจ่ายปลายทาง', partnerLabel: 'ปลายทางที่ส่งไป' },
    { key: 'IN',  label: 'รับส่งต่อเข้า', icon: 'log-in', money: 'AR',
      sub: 'เรารับรักษา — เรียกเก็บต้นทาง/สปสช.', partnerLabel: 'ต้นทางที่ส่งมา' },
];

const REFER_REASON = {
    OVER_CAP:  { label: 'เกินศักยภาพหน่วยบริการ', chip: 'sip-chip-danger' },
    EMERGENCY: { label: 'ฉุกเฉิน / วิกฤต',        chip: 'sip-chip-danger' },
    APPOINT:   { label: 'นัดหมายเฉพาะทาง',        chip: 'sip-chip-active' },
    EQUIP:     { label: 'ไม่มีเครื่องมือ / เตียงเต็ม', chip: 'sip-chip-amber' },
    PATIENT:   { label: 'ผู้ป่วย/ญาติร้องขอ',      chip: 'sip-chip-muted' },
};

const REFER_SCOPE = {
    OPD_VISIT:  { label: 'ตรวจรักษาผู้ป่วยนอก 1 ครั้ง' },
    OPD_COURSE: { label: 'ผู้ป่วยนอกต่อเนื่องตามคอร์ส' },
    IPD_ADMIT:  { label: 'รับไว้เป็นผู้ป่วยใน' },
    PROC:       { label: 'หัตถการ/ผ่าตัดเฉพาะรายการ' },
    DIAG:       { label: 'ตรวจวินิจฉัยเฉพาะรายการ' },
};

const REFER_URGENCY = {
    EMERGENCY: { label: 'ฉุกเฉิน', chip: 'sip-chip-danger' },
    URGENT:    { label: 'เร่งด่วน', chip: 'sip-chip-amber' },
    ELECTIVE:  { label: 'ตามนัด',  chip: 'sip-chip-muted' },
};

/**
 * ⭐ สรุปทางคลินิก (Clinical Review) — "เหตุผลการส่งต่อ" แบบที่ตัดสินได้
 *    เดิมมีแค่ reason (enum) + refer_note (บรรทัดเดียว) ซึ่งผู้อนุมัติอ่านแล้ว
 *    ยังตอบไม่ได้ว่า "จำเป็นต้องส่งจริงไหม และวงเงินที่ขอสมเหตุผลไหม"
 *    จึงแตกเป็นหัวข้อคงที่ ให้ทุกคำขอเล่าเรื่องด้วยโครงเดียวกัน — หน้าอนุมัติ
 *    (claim-tasks.html) จึงหยิบไปแสดงได้โดยไม่ต้องรู้จักฟิลด์รายตัว
 *
 * ⚠️ key ต้องตรงกับ id ของช่องกรอกใน refer-new.html แบบ fClin + Pascal(key)
 *    เช่น rationale → #fClinRationale — ReferNew.readReview() พึ่งกติกานี้
 */
const REFER_REVIEW_PARTS = [
    { key: 'history',   required: true,  label: 'ประวัติและอาการสำคัญ',
      hint: 'อาการนำ · ระยะเวลาที่เป็น · โรคประจำตัวที่เกี่ยวข้อง' },
    { key: 'findings',  required: true,  label: 'ผลตรวจและสิ่งที่ตรวจพบ',
      hint: 'ผล Lab / ภาพถ่ายรังสี / สัญญาณชีพ ที่ใช้ตัดสินว่าต้องส่งต่อ' },
    { key: 'treatment', required: false, label: 'การรักษาที่ให้ไปแล้วและผลตอบสนอง',
      hint: 'ยาและหัตถการที่ทำที่หน่วยเราแล้ว · ผู้ป่วยตอบสนองอย่างไร' },
    { key: 'rationale', required: true,  label: 'เหตุผลที่ต้องส่งต่อ / ข้อจำกัดของหน่วยเรา',
      hint: 'ทำไมรักษาต่อที่นี่ไม่ได้ — ข้อนี้คือสิ่งที่ผู้อนุมัติใช้ตัดสินวงเงิน' },
    { key: 'request',   required: true,  label: 'สิ่งที่ขอให้ปลายทางดำเนินการ',
      hint: 'ขอบเขตที่ต้องการจริง ๆ — ต้องสอดคล้องกับขอบเขตและวงเงินที่ขอ' },
];

/** สถานะแยกตามทิศทาง — คนละวงจรกันจริง ๆ จึงแยก map */
const REFER_STATUS = {
    OUT: {
        DRAFT:      { label: 'ร่างคำขอส่งต่อ',           badge: 'kbadge-draft' },
        WAIT_APPR:  { label: 'รออนุมัติ',                 badge: 'kbadge-pending' },
        WAIT_EXEC:  { label: 'รอผู้บริหารอนุมัติ',         badge: 'kbadge-alert' },
        APPROVED:   { label: 'อนุมัติแล้ว — ออกใบส่งตัว',  badge: 'kbadge-acked' },
        IN_SERVICE: { label: 'ผู้ป่วยรับบริการปลายทาง',    badge: 'kbadge-progress' },
        BILL_RECV:  { label: 'ได้รับใบเรียกเก็บ',          badge: 'kbadge-alert' },
        SETTLED:    { label: 'ตามจ่ายครบแล้ว',            badge: 'kbadge-done' },
        REJECTED:   { label: 'ไม่อนุมัติ',                badge: 'kbadge-off' },
    },
    IN: {
        RECEIVED:   { label: 'รับผู้ป่วยแล้ว',             badge: 'kbadge-acked' },
        DOC_CHECK:  { label: 'ตรวจใบส่งตัว',              badge: 'kbadge-pending' },
        IN_SERVICE: { label: 'กำลังให้บริการ',            badge: 'kbadge-progress' },
        BILLED:     { label: 'ออกใบเรียกเก็บแล้ว',         badge: 'kbadge-alert' },
        PAID:       { label: 'รับชำระครบแล้ว',            badge: 'kbadge-done' },
        RETURNED:   { label: 'ตีกลับใบส่งตัว',            badge: 'kbadge-off' },
    },
};

/**
 * ⭐ เกณฑ์ยกระดับการอนุมัติ (2 ชั้น)
 *
 * วงเงินที่ผูกพันงบประมาณก้อนใหญ่ ไม่ควรจบที่โต๊ะเจ้าหน้าที่อนุมัติคนเดียว —
 * เกินเกณฑ์นี้ต้องผ่านผู้บริหารอีกขั้น (WAIT_APPR → WAIT_EXEC → APPROVED)
 * ต่ำกว่าเกณฑ์จบที่ชั้นเดียวเหมือนเดิม เพื่อไม่ให้ผู้บริหารจมกับงานประจำ
 *
 * ⚠️ ตัวเลขอยู่ที่นี่ที่เดียว ทุกหน้า derive จาก MockRefer.needsExec()
 *    ห้าม hardcode 250000 ซ้ำในหน้าใด (PAGE-GUIDE §7B)
 */
const REFER_APPROVAL = {
    EXEC_THRESHOLD: 250000,
    EXEC_ROLE: /EXEC/i,      // หาผู้บริหารจาก roles ของ MockAdmin ไม่ผูกรหัสผู้ใช้ตายตัว
};

/**
 * ⭐ ธงความเสี่ยง — คู่ขนานกับ rule_results[] ของเคลม
 *    maps_to_nhso ทำให้หน้าส่งต่อพูดได้ว่า "ถ้าไม่แก้ จะได้ C305 กลับมา"
 *    แล้วคลิกข้ามไปดูข้อความจริงบน nhso-case.html ได้ทันที
 */
const REFER_RISK = {
    'REF-EXPIRED':   { label: 'ใบส่งตัวหมดอายุ',                    level: 'ERROR',   rule_id: 'RUL-REF-001', maps_to_nhso: null },
    'REF-SCOPE':     { label: 'หัตถการเกินขอบเขตที่อนุมัติ',          level: 'ERROR',   rule_id: 'RUL-REF-001', maps_to_nhso: null },
    'REF-NOAUTH':    { label: 'ไม่มีเลขอนุมัติ / เลขไม่ตรง',          level: 'ERROR',   rule_id: 'RUL-REF-002', maps_to_nhso: 'C305' },
    'REF-OVERCAP':   { label: 'ยอดเรียกเก็บเกินวงเงินที่อนุมัติ',      level: 'ERROR',   rule_id: 'RUL-REF-001', maps_to_nhso: null },
    'REF-DUP':       { label: 'เรียกเก็บซ้ำซ้อน (ทั้งต้นทางและ สปสช.)', level: 'ERROR',   rule_id: 'RUL-REF-003', maps_to_nhso: null },
    'REF-LATE':      { label: 'เกินกำหนดยื่นเรียกเก็บ',              level: 'ERROR',   rule_id: 'RUL-REF-003', maps_to_nhso: null },
    'REF-UNBILLED':  { label: 'ภาระผูกพันที่ยังไม่มีใบเรียกเก็บ',      level: 'WARNING', rule_id: 'RUL-REF-003', maps_to_nhso: null },
    'REF-NOCOUNTER': { label: 'ยังไม่มีใบตอบกลับ (counter-referral)',  level: 'WARNING', rule_id: 'RUL-REF-002', maps_to_nhso: null },
    'REF-EMERG-OK':  { label: 'ฉุกเฉิน — ยกเว้นการขออนุมัติล่วงหน้า',  level: 'INFO',    rule_id: 'RUL-REF-002', maps_to_nhso: null },
};

/** กลุ่มโรคจากตัวอักษรแรกของ ICD-10 — ใช้ทำ donut ภาพรวมโรคที่ส่งออก */
const REFER_DX_GROUP = {
    I: 'หัวใจและหลอดเลือด', C: 'มะเร็ง', N: 'ไตและทางเดินปัสสาวะ',
    G: 'ประสาทและสมอง',    S: 'อุบัติเหตุ', H: 'ตาและหู', K: 'ทางเดินอาหาร',
    E: 'ต่อมไร้ท่อ/เมตาบอลิก', J: 'ระบบหายใจ', M: 'กระดูกและข้อ',
};

const REFER_BILL_STATUS = {
    /* AP — ใบที่ปลายทางส่งมาเรียกเก็บเรา */
    RECEIVED:  { label: 'ได้รับใบเรียกเก็บ', badge: 'kbadge-pending' },
    VERIFYING: { label: 'กำลังตรวจสอบ',      badge: 'kbadge-progress' },
    APPROVED:  { label: 'อนุมัติจ่ายแล้ว',    badge: 'kbadge-acked' },
    DISPUTED:  { label: 'โต้แย้งบางรายการ',   badge: 'kbadge-alert' },
    PAID:      { label: 'จ่ายครบแล้ว',       badge: 'kbadge-done' },
    REJECTED:  { label: 'ปฏิเสธการจ่าย',      badge: 'kbadge-off' },
    /* AR — ใบที่เราออกไปเรียกเก็บ */
    DRAFT:     { label: 'ร่างใบเรียกเก็บ',    badge: 'kbadge-draft' },
    SENT:      { label: 'ส่งเรียกเก็บแล้ว',   badge: 'kbadge-pending' },
    PARTIAL:   { label: 'รับชำระบางส่วน',    badge: 'kbadge-progress' },
    OVERDUE:   { label: 'เกินกำหนดชำระ',     badge: 'kbadge-alert' },
    DENIED:    { label: 'ถูกปฏิเสธ',         badge: 'kbadge-off' },
};

const REFER_CHANNEL = {
    DEST_HOSPITAL:   'ปลายทางเรียกเก็บมาที่เรา',
    ORIGIN_HOSPITAL: 'เรียกเก็บ รพ.ต้นทาง (ตามจ่าย)',
    NHSO_DIRECT:     'ส่งเบิก สปสช. โดยตรง',
    FUND_CENTRAL:    'เบิกกองทุนเฉพาะ',
};

/**
 * ปลายทางที่เราส่งผู้ป่วยออกไป — เป็นชุดคนละชุดกับ NHSO_PROVIDERS
 * (NHSO_PROVIDERS คือหน่วยบริการของเราเอง ถ้าเอามาเป็นปลายทาง กราฟ "ส่งไปที่ไหน" จะไร้ความหมาย)
 */
const MOCK_REFER_PROVIDERS = [
    { code: '13777', name: 'โรงพยาบาลราชวิถี',              level: 'ตติยภูมิ',      province: 'กรุงเทพมหานคร', mou: true,  avg_settle_days: 38 },
    { code: '13778', name: 'โรงพยาบาลจุฬาลงกรณ์ สภากาชาดไทย', level: 'ตติยภูมิ',      province: 'กรุงเทพมหานคร', mou: true,  avg_settle_days: 45 },
    { code: '13781', name: 'สถาบันโรคทรวงอก',                level: 'ตติยภูมิเฉพาะทาง', province: 'นนทบุรี',      mou: true,  avg_settle_days: 41 },
    { code: '13782', name: 'สถาบันมะเร็งแห่งชาติ',           level: 'ตติยภูมิเฉพาะทาง', province: 'กรุงเทพมหานคร', mou: true,  avg_settle_days: 52 },
    { code: '13760', name: 'โรงพยาบาลเลิดสิน',              level: 'ตติยภูมิ',      province: 'กรุงเทพมหานคร', mou: true,  avg_settle_days: 36 },
    { code: '13765', name: 'โรงพยาบาลนพรัตนราชธานี',        level: 'ตติยภูมิ',      province: 'กรุงเทพมหานคร', mou: false, avg_settle_days: 63 },
    { code: '11749', name: 'โรงพยาบาลตากสิน',               level: 'ทุติยภูมิ',     province: 'กรุงเทพมหานคร', mou: true,  avg_settle_days: 34 },
    { code: '41208', name: 'โรงพยาบาลเอกชนคู่สัญญา บางกะปิ',  level: 'เอกชนคู่สัญญา',  province: 'กรุงเทพมหานคร', mou: false, avg_settle_days: 71 },
];


/* ══════════════════════════════════════════════════════════
   2. รายการส่งต่อที่เขียนมือ — คือตัวเดโม
   ══════════════════════════════════════════════════════════ */
const MOCK_REFERRALS_SEED = [

/* ─── ⭐ เคสหลัก: ใบส่งตัวหมดอายุ + ปลายทางทำเกินขอบเขต + เกินวงเงิน ─── */
{
    id: 'REF-OUT-2569-0007', direction: 'OUT', claim_id: null,
    hn: '00131204', an: null,
    patient: 'นายบุญส่ง ทองสุข', age: 67, gender: 'M',
    nid_masked: '3-1015-xxxxx-42-7', fund: 'UC', right_no: 'UC69-0031204',
    partner_code: '13777', partner_name: 'โรงพยาบาลราชวิถี',
    partner_level: 'ตติยภูมิ', partner_province: 'กรุงเทพมหานคร',
    dx: [
        { code: 'N18.5', name: 'Chronic kidney disease, stage 5', type: 'หลัก' },
        { code: 'I10',   name: 'Essential (primary) hypertension', type: 'ร่วม' },
    ],
    proc_planned: [{ code: '39.95', name: 'Hemodialysis' }],
    proc_actual:  [
        { code: '39.95', name: 'Hemodialysis',                    date: '2569-06-20' },
        { code: '54.98', name: 'Peritoneal dialysis (CAPD)',      date: '2569-07-02' },
    ],
    reason: 'OVER_CAP', urgency: 'URGENT', doctor: 'นพ.ธนกฤต วงศ์สถาพร',
    refer_note: 'ผู้ป่วย CKD stage 5 ต้องการบำบัดทดแทนไตต่อเนื่อง เกินศักยภาพหน่วยบริการ',
    letter_no: 'นส.11812/2569/0308', auth_no: 'UCS-69-004128', auth_type: 'CLOSE_RIGHT',
    auth_source: 'สปสช.', issued_at: '2569-05-21', expires_at: '2569-07-20',
    scope: 'OPD_COURSE', scope_note: 'ฟอกเลือดด้วยเครื่องไตเทียม ไม่เกิน 12 ครั้ง',
    visit_limit: 12, visit_used: 15, cap_amount: 96000,
    approver: 'พญ.สุนิสา เจริญพงศ์', approved_at: '2569-05-21T14:20',
    refer_date: '2569-05-21', service_date_from: '2569-05-24', service_date_to: '2569-07-28',
    service_type: 'OPD', est_amount: 96000,
    reimbursable: true, reimburse_channel: 'FUND_CENTRAL',
    counter_received: false, counter_sent: false, counter_at: null,
    risk_score: 94,
    risk_flags: [
        { code: 'REF-EXPIRED', level: 'ERROR', label: 'ใบส่งตัวหมดอายุ',
          detail: 'ใบส่งตัวหมดอายุ 20 ก.ค. 2569 แต่ยังมีการให้บริการถึง 28 ก.ค. 2569',
          evidence: { 'เลขที่ใบส่งตัว': 'นส.11812/2569/0308', 'วันหมดอายุ': '20 ก.ค. 2569',
                      'วันให้บริการล่าสุด': '28 ก.ค. 2569', 'เกินมา': '8 วัน' },
          maps_to_nhso: null, amount_at_risk: 24000, rule_id: 'RUL-REF-001' },
        { code: 'REF-SCOPE', level: 'ERROR', label: 'หัตถการเกินขอบเขตที่อนุมัติ',
          detail: 'อนุมัติเฉพาะฟอกเลือด (39.95) แต่ปลายทางทำ CAPD (54.98) ด้วย',
          evidence: { 'ขอบเขตที่อนุมัติ': 'ฟอกเลือดด้วยเครื่องไตเทียม ไม่เกิน 12 ครั้ง',
                      'หัตถการที่ทำจริง': '39.95 Hemodialysis + 54.98 CAPD',
                      'รายการนอกขอบเขต': '54.98 Peritoneal dialysis' },
          maps_to_nhso: null, amount_at_risk: 38000, rule_id: 'RUL-REF-001' },
        { code: 'REF-OVERCAP', level: 'ERROR', label: 'ยอดเรียกเก็บเกินวงเงินที่อนุมัติ',
          detail: 'เรียกเก็บ 148,000 บาท เกินวงเงินที่อนุมัติ 96,000 บาท',
          evidence: { 'วงเงินที่อนุมัติ': '96,000 บาท', 'ยอดที่ถูกเรียกเก็บ': '148,000 บาท',
                      'ส่วนเกิน': '52,000 บาท', 'จำนวนครั้งที่อนุมัติ': '12 ครั้ง',
                      'จำนวนครั้งที่ใช้จริง': '15 ครั้ง' },
          maps_to_nhso: null, amount_at_risk: 52000, rule_id: 'RUL-REF-001' },
    ],
    documents: [
        { name: 'ใบส่งตัวผู้ป่วย',        type: 'ใบส่งตัว',   status: 'FOUND',   by: 'นพ.ธนกฤต วงศ์สถาพร', date: '2569-05-21' },
        { name: 'สำเนาบัตรประชาชน/สิทธิ',  type: 'สิทธิ',      status: 'FOUND',   by: 'ระบบ HIS',           date: '2569-05-21' },
        { name: 'ใบรับรองแพทย์',          type: 'เวชระเบียน', status: 'FOUND',   by: 'นพ.ธนกฤต วงศ์สถาพร', date: '2569-05-21' },
        { name: 'ใบตอบกลับจากปลายทาง',    type: 'ใบตอบกลับ',  status: 'MISSING', by: '—',                  date: null },
        { name: 'ใบแจ้งหนี้ปลายทาง',      type: 'ใบแจ้งหนี้',  status: 'FOUND',   by: 'รพ.ราชวิถี',          date: '2569-07-31' },
    ],
    timeline: [
        { at: '2569-05-21T10:12', tone: 'info',    title: 'บันทึกคำขอส่งต่อ',       by: 'นพ.ธนกฤต วงศ์สถาพร', note: 'เหตุผล: เกินศักยภาพหน่วยบริการ' },
        { at: '2569-05-21T14:20', tone: 'success', title: 'อนุมัติและออกใบส่งตัว',   by: 'พญ.สุนิสา เจริญพงศ์', note: 'วงเงิน 96,000 บาท · 12 ครั้ง · หมดอายุ 20 ก.ค. 2569' },
        { at: '2569-07-31T09:40', tone: 'warning', title: 'ได้รับใบเรียกเก็บจากปลายทาง', by: 'งานการเงิน',      note: 'RBL-2569-0011 · 148,000 บาท' },
        { at: '2569-08-01T11:05', tone: 'danger',  title: 'ตรวจพบ 3 ประเด็น',        by: 'Rule Engine',        note: 'หมดอายุ · เกินขอบเขต · เกินวงเงิน — เสี่ยง 52,000 บาท' },
    ],
    task_ids: ['TSK-000153'], owner: 'U-007', due_at: '2569-08-08T16:00', status: 'BILL_RECV',
},

/* ─── ✅ วงจรใหม่ — ทำถูกทุกขั้น ตามจ่ายจบเรียบร้อย ─── */
{
    id: 'REF-OUT-2569-0021', direction: 'OUT', claim_id: null,
    hn: '00127755', an: null,
    patient: 'นางอารีย์ พูนผล', age: 59, gender: 'F',
    nid_masked: '3-1009-xxxxx-18-2', fund: 'OFC', right_no: 'OFC69-0027755',
    partner_code: '13782', partner_name: 'สถาบันมะเร็งแห่งชาติ',
    partner_level: 'ตติยภูมิเฉพาะทาง', partner_province: 'กรุงเทพมหานคร',
    dx: [{ code: 'C50.9', name: 'Malignant neoplasm of breast, unspecified', type: 'หลัก' }],
    proc_planned: [{ code: '85.43', name: 'Unilateral radical mastectomy' }],
    proc_actual:  [{ code: '85.43', name: 'Unilateral radical mastectomy', date: '2569-06-14' }],
    reason: 'OVER_CAP', urgency: 'URGENT', doctor: 'นพ.ปิยะ ศรีสุวรรณ',
    refer_note: 'ต้องผ่าตัดและรับเคมีบำบัดที่สถาบันเฉพาะทาง',
    letter_no: 'นส.11812/2569/0361', auth_no: 'OFC-69-118240', auth_type: 'APPROVE_CODE',
    auth_source: 'กรมบัญชีกลาง', issued_at: '2569-06-02', expires_at: '2569-09-02',
    scope: 'PROC', scope_note: 'ผ่าตัดเต้านมและการรักษาต่อเนื่องหลังผ่าตัด',
    visit_limit: 6, visit_used: 4, cap_amount: 220000,
    approver: 'พญ.สุนิสา เจริญพงศ์', approved_at: '2569-06-02T09:30',
    refer_date: '2569-06-02', service_date_from: '2569-06-12', service_date_to: '2569-06-28',
    service_type: 'IPD', est_amount: 210000,
    reimbursable: true, reimburse_channel: 'FUND_CENTRAL',
    counter_received: true, counter_sent: false, counter_at: '2569-07-04',
    risk_score: 12, risk_flags: [],
    documents: [
        { name: 'ใบส่งตัวผู้ป่วย',       type: 'ใบส่งตัว',   status: 'FOUND', by: 'นพ.ปิยะ ศรีสุวรรณ', date: '2569-06-02' },
        { name: 'สำเนาบัตรประชาชน/สิทธิ', type: 'สิทธิ',      status: 'FOUND', by: 'ระบบ HIS',          date: '2569-06-02' },
        { name: 'ใบรับรองแพทย์',         type: 'เวชระเบียน', status: 'FOUND', by: 'นพ.ปิยะ ศรีสุวรรณ', date: '2569-06-02' },
        { name: 'ใบตอบกลับจากปลายทาง',   type: 'ใบตอบกลับ',  status: 'FOUND', by: 'สถาบันมะเร็งฯ',      date: '2569-07-04' },
        { name: 'ใบแจ้งหนี้ปลายทาง',     type: 'ใบแจ้งหนี้',  status: 'FOUND', by: 'สถาบันมะเร็งฯ',      date: '2569-07-06' },
        { name: 'หลักฐานการโอนเงิน',     type: 'การเงิน',    status: 'FOUND', by: 'งานการเงิน',        date: '2569-07-25' },
    ],
    timeline: [
        { at: '2569-06-02T08:40', tone: 'info',    title: 'บันทึกคำขอส่งต่อ',      by: 'นพ.ปิยะ ศรีสุวรรณ',  note: '' },
        { at: '2569-06-02T09:30', tone: 'success', title: 'อนุมัติและออกใบส่งตัว',  by: 'พญ.สุนิสา เจริญพงศ์', note: 'วงเงิน 220,000 บาท' },
        { at: '2569-07-04T15:10', tone: 'success', title: 'รับใบตอบกลับจากปลายทาง', by: 'เวชระเบียน',        note: 'เวชระเบียนครบถ้วน' },
        { at: '2569-07-25T14:00', tone: 'success', title: 'ตามจ่ายครบถ้วน',        by: 'งานการเงิน',        note: '206,400 บาท — อยู่ในวงเงิน' },
    ],
    task_ids: [], owner: 'U-007', due_at: null, status: 'SETTLED',
},

/* ─── ⭐ ตัวที่กดอนุมัติสดในเดโม (ผูกกับ TSK-000151) ─── */
{
    id: 'REF-OUT-2569-0033', direction: 'OUT', claim_id: null,
    hn: '00134890', an: null,
    patient: 'นายวิชัย ตั้งมั่น', age: 71, gender: 'M',
    nid_masked: '3-1021-xxxxx-06-1', fund: 'UC', right_no: 'UC69-0034890',
    partner_code: '13781', partner_name: 'สถาบันโรคทรวงอก',
    partner_level: 'ตติยภูมิเฉพาะทาง', partner_province: 'นนทบุรี',
    dx: [
        { code: 'I25.1', name: 'Atherosclerotic heart disease of native coronary artery', type: 'หลัก' },
        { code: 'E11.9', name: 'Type 2 diabetes mellitus without complications',           type: 'ร่วม' },
    ],
    proc_planned: [{ code: '36.06', name: 'Insertion of non-drug-eluting coronary artery stent' }],
    proc_actual:  [],
    reason: 'OVER_CAP', urgency: 'URGENT', doctor: 'นพ.ธนกฤต วงศ์สถาพร',
    attending_doctor: 'พญ.ชลธิชา ภักดีวงศ์', clinic_dept: 'คลินิกโรคหัวใจ · อายุรกรรม',
    refer_note: 'ผล CAG พบเส้นเลือดหัวใจตีบ 3 เส้น ต้องทำ PCI ที่สถาบันเฉพาะทาง',
    clinical_review: {
        history:   'ผู้ป่วยชายไทย 71 ปี เจ็บแน่นหน้าอกขณะออกแรงมา 3 เดือน ระยะหลังเดินได้ไม่ถึง 100 เมตร '
                 + 'ก็ต้องหยุดพัก (CCS class III) มีโรคเบาหวานชนิดที่ 2 และไขมันในเลือดสูงร่วมด้วย '
                 + 'อยู่ในการดูแลของ พญ.ชลธิชา ภักดีวงศ์ คลินิกโรคหัวใจ ตั้งแต่ ก.พ. 2569',
        findings:  'EKG พบ ST depression ที่ lead V4–V6 ขณะมีอาการ · Troponin-I 0.04 ng/mL (ไม่สูง) · '
                 + 'EF 48% จาก Echo (4 ส.ค. 2569) · ผลสวนหัวใจ CAG 4 ส.ค. 2569 พบตีบ LAD 90%, LCx 75%, RCA 80% '
                 + '— ลักษณะ 3-vessel disease',
        treatment: 'ให้ ASA 81 mg, Clopidogrel 75 mg, Atorvastatin 40 mg, Isosorbide dinitrate และ Metoprolol '
                 + 'ปรับขนาดเต็มที่แล้ว 6 สัปดาห์ อาการเจ็บหน้าอกยังกำเริบสัปดาห์ละ 2–3 ครั้ง ไม่ตอบสนองต่อยา',
        rationale: 'จำเป็นต้องทำ PCI ใส่ขดลวด แต่หน่วยบริการเราไม่มีห้องสวนหัวใจและไม่มีอายุรแพทย์หัวใจ'
                 + 'สาขาหัตถการประจำการ จึงเกินศักยภาพที่จะทำเองได้ · ปล่อยไว้เสี่ยงกล้ามเนื้อหัวใจตายเฉียบพลัน',
        request:   'ขอให้สถาบันโรคทรวงอกสวนหัวใจและใส่ขดลวดขยายหลอดเลือด (36.06) ตามผล CAG เดิม '
                 + 'ไม่เกิน 2 ครั้ง (ทำ staged PCI ได้) และส่งใบตอบกลับพร้อมสรุปยาต้านเกล็ดเลือดที่ต้องใช้ต่อ',
    },
    /* หมวดที่แพทย์กด "ดึงข้อมูลจาก HIS" มาใส่ — ที่เหลือพิมพ์เอง
       ผู้อนุมัติเห็นรายการนี้บน claim-tasks.html จะได้รู้ว่าอะไรมาจากระบบ อะไรมาจากคน */
    review_sources: [
        { key: 'lab',       label: 'ผลตรวจทางห้องปฏิบัติการ',        source: 'ระบบห้องปฏิบัติการ (LIS)', target: 'findings',  at: '2569-08-05T13:10' },
        { key: 'imaging',   label: 'ผลตรวจทางรังสีและภาพวินิจฉัย',    source: 'ระบบรังสีวิทยา (RIS/PACS)', target: 'findings',  at: '2569-08-05T13:10' },
        { key: 'medication', label: 'ยาที่ได้รับปัจจุบัน',            source: 'ห้องยา',                    target: 'treatment', at: '2569-08-05T13:12' },
    ],
    reviewed_by: 'U-004', reviewer_name: 'คุณพิมพ์ชนก วงศ์อนันต์', reviewed_at: '2569-08-05T16:05',
    review_note: 'ตรวจสิทธิ UC ยังใช้ได้ · เอกสาร CAG และใบรับรองแพทย์ครบ · '
               + 'เทียบอัตราตามจ่ายกับสถาบันโรคทรวงอกแล้ว วงเงิน 185,000 บาท อยู่ในกรอบ — เสนออนุมัติ',
    letter_no: null, auth_no: null, auth_type: null, auth_source: null,
    issued_at: null, expires_at: null,
    scope: 'PROC', scope_note: 'สวนหัวใจและใส่ขดลวดขยายหลอดเลือด',
    visit_limit: 2, visit_used: 0, cap_amount: 185000,
    approver: null, approved_at: null,
    refer_date: '2569-08-05', service_date_from: null, service_date_to: null,
    service_type: 'IPD', est_amount: 185000,
    reimbursable: true, reimburse_channel: 'FUND_CENTRAL',
    counter_received: false, counter_sent: false, counter_at: null,
    risk_score: 45, risk_flags: [],
    documents: [
        { name: 'ใบส่งตัวผู้ป่วย',       type: 'ใบส่งตัว',   status: 'PENDING', by: '—',                  date: null },
        { name: 'สำเนาบัตรประชาชน/สิทธิ', type: 'สิทธิ',      status: 'FOUND',   by: 'ระบบ HIS',           date: '2569-08-05' },
        { name: 'ใบรับรองแพทย์',         type: 'เวชระเบียน', status: 'FOUND',   by: 'นพ.ธนกฤต วงศ์สถาพร', date: '2569-08-05' },
        { name: 'ผลตรวจสวนหัวใจ (CAG)',  type: 'ผลตรวจ',     status: 'FOUND',   by: 'ห้องสวนหัวใจ',        date: '2569-08-04' },
    ],
    timeline: [
        { at: '2569-08-05T13:22', tone: 'info',    title: 'บันทึกคำขอส่งต่อ', by: 'นพ.ธนกฤต วงศ์สถาพร',
          note: 'เขียนสรุปทางคลินิกครบ 5 หัวข้อ · เจ้าของไข้ พญ.ชลธิชา ภักดีวงศ์ · ประเมิน 185,000 บาท' },
        { at: '2569-08-05T16:05', tone: 'success', title: 'เจ้าหน้าที่ตรวจทานคำขอ', by: 'คุณพิมพ์ชนก วงศ์อนันต์',
          note: 'ตรวจสิทธิ เอกสาร และอัตราตามจ่ายครบ — เสนออนุมัติ' },
        { at: '2569-08-05T16:10', tone: 'warning', title: 'ส่งขออนุมัติ',     by: 'คุณพิมพ์ชนก วงศ์อนันต์', note: 'TSK-000151 · Maker–Checker: ผู้ขอไม่อนุมัติเอง' },
    ],
    task_ids: ['TSK-000151'], owner: 'U-004', due_at: '2569-08-07T16:00', status: 'WAIT_APPR',
},

/* ══════════════════════════════════════════════════════════════════════════
   ⭐ ร่างคำขอส่งต่อ (DRAFT) — ยังไม่ได้ส่งขออนุมัติ
   จุดประสงค์: ให้ปุ่ม "ส่งขออนุมัติที่เลือก" บน refer-worklist มีของให้ส่งจริง
   ด่านที่ ReferList.submitSelected() ใช้คือ direction==='OUT' && ไม่มีธง ERROR
   && ไม่มี auth_no && status!=='WAIT_APPR' — สามแถวแรกผ่าน แถวสุดท้ายติดธง
   ⚠️ ห้ามใส่ auth_no/letter_no/expires_at ให้ร่าง — เลขพวกนี้ออกตอนอนุมัติ
      เท่านั้น (MockRefer.applyTaskDecision) ถ้าใส่ไว้ล่วงหน้าจะติดด่าน
      "มีเลขอนุมัติแล้ว" แล้วส่งขออนุมัติไม่ได้อีกเลย
   ══════════════════════════════════════════════════════════════════════════ */

/* ─── ร่างที่ 1: พร้อมส่ง — ฟอกเลือดต่อเนื่อง กองทุน UC ─── */
{
    id: 'REF-OUT-2569-0061', direction: 'OUT', claim_id: null,
    hn: '00136721', an: null,
    patient: 'นางสมพร ใจดีมั่น', age: 58, gender: 'F',
    nid_masked: '3-1042-xxxxx-18-2', fund: 'UC', right_no: 'UC69-0036721',
    partner_code: '13777', partner_name: 'โรงพยาบาลราชวิถี',
    partner_level: 'ตติยภูมิ', partner_province: 'กรุงเทพมหานคร',
    dx: [
        { code: 'N18.4', name: 'Chronic kidney disease, stage 4',                  type: 'หลัก' },
        { code: 'E11.2', name: 'Type 2 diabetes mellitus with kidney complications', type: 'ร่วม' },
    ],
    proc_planned: [{ code: '39.95', name: 'Hemodialysis' }],
    proc_actual:  [],
    reason: 'OVER_CAP', urgency: 'URGENT', doctor: 'พญ.กมลชนก แสงเพชร',
    attending_doctor: 'พญ.กมลชนก แสงเพชร', clinic_dept: 'คลินิกโรคไต · อายุรกรรม',
    refer_note: 'ไตเสื่อมระยะ 4 ต้องเตรียมบำบัดทดแทนไต หน่วยบริการไม่มีหน่วยไตเทียม',
    clinical_review: {
        history:   'หญิงไทย 58 ปี เบาหวานชนิดที่ 2 มา 14 ปี ควบคุมได้ไม่ดี (HbA1c 8.6%) '
                 + '3 เดือนหลังมีอาการบวมที่ขาทั้งสองข้าง เหนื่อยง่าย ปัสสาวะเป็นฟอง '
                 + 'ติดตามที่คลินิกโรคไตกับ พญ.กมลชนก แสงเพชร ทุก 1 เดือน',
        findings:  'eGFR ลดจาก 28 เหลือ 19 mL/min/1.73m² ใน 3 เดือน · Creatinine 3.1 mg/dL · '
                 + 'Urine protein/creatinine ratio 2.8 g/g · K 5.4 mEq/L · Hb 9.2 g/dL',
        treatment: 'ให้ ARB ขนาดสูงสุดที่ทนได้ · จำกัดโปรตีนและโซเดียม · แก้ภาวะซีดด้วย EPO '
                 + 'ค่าไตยังทรุดต่อเนื่อง เข้าเกณฑ์เตรียมบำบัดทดแทนไต',
        rationale: 'ต้องเริ่มฟอกเลือดด้วยเครื่องไตเทียมต่อเนื่อง แต่หน่วยบริการเราไม่มีหน่วยไตเทียม '
                 + 'และไม่มีอายุรแพทย์โรคไตประจำ จึงเกินศักยภาพ',
        request:   'ขอให้โรงพยาบาลราชวิถีทำ Hemodialysis (39.95) ต่อเนื่อง ไม่เกิน 24 ครั้ง '
                 + 'พร้อมเตรียมเส้นฟอกเลือดถาวร และส่งผลติดตามกลับทุกเดือน',
    },
    reviewed_by: null, reviewer_name: null, reviewed_at: null, review_note: '',
    letter_no: null, auth_no: null, auth_type: null, auth_source: null,
    issued_at: null, expires_at: null,
    scope: 'OPD_COURSE', scope_note: 'ฟอกเลือดด้วยเครื่องไตเทียม ไม่เกิน 24 ครั้ง',
    visit_limit: 24, visit_used: 0, cap_amount: 108000,
    approver: null, approved_at: null,
    refer_date: '2569-08-06', service_date_from: null, service_date_to: null,
    service_type: 'OPD', est_amount: 108000,
    reimbursable: true, reimburse_channel: 'FUND_CENTRAL',
    counter_received: false, counter_sent: false, counter_at: null,
    risk_score: 20, risk_flags: [],
    documents: [
        { name: 'ใบส่งตัวผู้ป่วย',       type: 'ใบส่งตัว',   status: 'PENDING', by: '—',                 date: null },
        { name: 'สำเนาบัตรประชาชน/สิทธิ', type: 'สิทธิ',      status: 'FOUND',   by: 'ระบบ HIS',          date: '2569-08-06' },
        { name: 'ใบรับรองแพทย์',         type: 'เวชระเบียน', status: 'FOUND',   by: 'พญ.กมลชนก แสงเพชร', date: '2569-08-06' },
        { name: 'ผลตรวจการทำงานของไต',   type: 'ผลตรวจ',     status: 'FOUND',   by: 'ห้องปฏิบัติการ',     date: '2569-08-05' },
    ],
    timeline: [
        { at: '2569-08-06T08:45', tone: 'info', title: 'บันทึกคำขอส่งต่อ', by: 'พญ.กมลชนก แสงเพชร',
          note: 'เหตุผล: เกินศักยภาพหน่วยบริการ · ประเมิน 108,000 บาท' },
    ],
    task_ids: [], owner: 'U-004', due_at: '2569-08-09T16:00', status: 'DRAFT',
},

/* ─── ร่างที่ 2: พร้อมส่ง — กองทุน OFC (อนุมัติแล้วจะได้เลขจากกรมบัญชีกลาง) ─── */
{
    id: 'REF-OUT-2569-0062', direction: 'OUT', claim_id: null,
    hn: '00137004', an: null,
    patient: 'นายประเสริฐ คงเจริญ', age: 64, gender: 'M',
    nid_masked: '3-1007-xxxxx-53-9', fund: 'OFC', right_no: 'OFC69-0037004',
    partner_code: '13781', partner_name: 'สถาบันโรคทรวงอก',
    partner_level: 'ตติยภูมิเฉพาะทาง', partner_province: 'นนทบุรี',
    dx: [
        { code: 'I35.0', name: 'Nonrheumatic aortic (valve) stenosis', type: 'หลัก' },
        { code: 'I50.0', name: 'Congestive heart failure',             type: 'ร่วม' },
    ],
    proc_planned: [{ code: '35.21', name: 'Open and other replacement of aortic valve with tissue graft' }],
    proc_actual:  [],
    reason: 'EQUIP', urgency: 'URGENT', doctor: 'นพ.อนุชา ทวีสุข',
    attending_doctor: 'พญ.ชลธิชา ภักดีวงศ์', clinic_dept: 'คลินิกโรคหัวใจ · อายุรกรรม',
    refer_note: 'ลิ้นหัวใจเอออร์ติกตีบรุนแรง ต้องผ่าตัดเปลี่ยนลิ้นหัวใจ ไม่มีห้องผ่าตัดหัวใจ',
    clinical_review: {
        history:   'ชายไทย 64 ปี เหนื่อยง่ายเวลาออกแรงมา 6 เดือน มีหน้ามืดคล้ายจะเป็นลม 2 ครั้ง '
                 + 'ระยะหลังนอนราบไม่ได้ ต้องหนุนหมอน 2 ใบ · เจ้าของไข้คือ พญ.ชลธิชา ภักดีวงศ์ '
                 + 'ใบส่งต่อเขียนโดย นพ.อนุชา ทวีสุข ซึ่งเป็นแพทย์เวรที่รับผู้ป่วยรอบล่าสุด',
        findings:  'ฟังได้ ejection systolic murmur grade 4/6 ที่ aortic area · Echo (4 ส.ค. 2569) '
                 + 'พบ aortic valve area 0.7 cm², mean gradient 52 mmHg — เข้าเกณฑ์ severe AS · EF 42% · '
                 + 'ภาพรังสีทรวงอกพบหัวใจโตและน้ำท่วมปอดเล็กน้อย',
        treatment: 'ให้ยาขับปัสสาวะและควบคุมภาวะหัวใจล้มเหลวจนอาการคงที่ '
                 + 'แต่ severe AS ที่มีอาการแล้วรักษาด้วยยาอย่างเดียวไม่ได้ ต้องผ่าตัดเปลี่ยนลิ้นหัวใจ',
        rationale: 'หน่วยบริการเราไม่มีห้องผ่าตัดหัวใจและเครื่องปอดหัวใจเทียม ไม่มีศัลยแพทย์หัวใจ '
                 + 'จึงผ่าตัดเองไม่ได้ · severe AS ที่มีอาการมีอัตราตาย 50% ใน 2 ปีถ้าไม่ผ่าตัด',
        request:   'ขอให้สถาบันโรคทรวงอกผ่าตัดเปลี่ยนลิ้นหัวใจเอออร์ติกด้วยลิ้นเนื้อเยื่อ (35.21) '
                 + 'และรับไว้เป็นผู้ป่วยในจนพ้นระยะพักฟื้น',
    },
    reviewed_by: null, reviewer_name: null, reviewed_at: null, review_note: '',
    letter_no: null, auth_no: null, auth_type: null, auth_source: null,
    issued_at: null, expires_at: null,
    scope: 'IPD_ADMIT', scope_note: 'ผ่าตัดเปลี่ยนลิ้นหัวใจเอออร์ติกและนอนพักฟื้น',
    visit_limit: 1, visit_used: 0, cap_amount: 420000,
    approver: null, approved_at: null,
    refer_date: '2569-08-06', service_date_from: null, service_date_to: null,
    service_type: 'IPD', est_amount: 398000,
    reimbursable: true, reimburse_channel: 'FUND_CENTRAL',
    counter_received: false, counter_sent: false, counter_at: null,
    risk_score: 28, risk_flags: [],
    documents: [
        { name: 'ใบส่งตัวผู้ป่วย',       type: 'ใบส่งตัว',   status: 'PENDING', by: '—',              date: null },
        { name: 'สำเนาบัตรประชาชน/สิทธิ', type: 'สิทธิ',      status: 'FOUND',   by: 'ระบบ HIS',       date: '2569-08-06' },
        { name: 'ใบรับรองแพทย์',         type: 'เวชระเบียน', status: 'FOUND',   by: 'นพ.อนุชา ทวีสุข', date: '2569-08-06' },
        { name: 'ผลตรวจหัวใจด้วยคลื่นเสียง (Echo)', type: 'ผลตรวจ', status: 'FOUND', by: 'ห้องตรวจหัวใจ', date: '2569-08-04' },
    ],
    timeline: [
        { at: '2569-08-06T09:15', tone: 'info', title: 'บันทึกคำขอส่งต่อ', by: 'นพ.อนุชา ทวีสุข',
          note: 'เหตุผล: ไม่มีเครื่องมือ / เตียงเต็ม · ประเมิน 398,000 บาท' },
    ],
    task_ids: [], owner: 'U-004', due_at: '2569-08-08T16:00', status: 'DRAFT',
},

/* ─── ร่างที่ 3: พร้อมส่ง — ฉุกเฉิน มีธงระดับ INFO (ไม่บล็อก hasError ดูเฉพาะ ERROR) ─── */
{
    id: 'REF-OUT-2569-0063', direction: 'OUT', claim_id: null,
    hn: '00137255', an: 'AN690812',
    patient: 'นายเอกชัย รุ่งเรือง', age: 46, gender: 'M',
    nid_masked: '1-1055-xxxxx-31-6', fund: 'SSS', right_no: 'SSS69-0037255',
    partner_code: '13765', partner_name: 'โรงพยาบาลนพรัตนราชธานี',
    partner_level: 'ตติยภูมิ', partner_province: 'กรุงเทพมหานคร',
    dx: [
        { code: 'S06.5', name: 'Traumatic subdural haemorrhage', type: 'หลัก' },
        { code: 'S02.0', name: 'Fracture of vault of skull',     type: 'ร่วม' },
    ],
    proc_planned: [{ code: '01.24', name: 'Other craniotomy' }],
    proc_actual:  [],
    reason: 'EMERGENCY', urgency: 'EMERGENCY', doctor: 'นพ.กิตติ ชัยวัฒน์',
    attending_doctor: 'นพ.กิตติ ชัยวัฒน์', clinic_dept: 'ห้องฉุกเฉิน',
    refer_note: 'อุบัติเหตุจราจร เลือดออกใต้เยื่อหุ้มสมอง ส่งต่อทันทีจากห้องฉุกเฉิน',
    /* ⚠️ ต้องเขียนครบทุกหัวข้อบังคับ ไม่งั้นติดด่าน reviewComplete() ของ
       ReferList.submitSelected() แล้วร่างนี้จะส่งขออนุมัติไม่ได้ ผิดจากที่คอมเมนต์
       หัวกลุ่มบอกไว้ว่า "สามแถวแรกผ่าน" — ฉุกเฉินก็ต้องระบุสิ่งที่ขอจากปลายทาง */
    clinical_review: {
        history:   'ชายไทย 46 ปี ประสบอุบัติเหตุจักรยานยนต์ชนเสาไฟ ไม่สวมหมวกนิรภัย '
                 + 'ถึงห้องฉุกเฉิน 02:10 น. GCS แรกรับ E2V2M4 = 8 และลดลงเหลือ 7 ใน 20 นาที',
        findings:  'CT สมองไม่ฉีดสี (02:35 น.) พบ acute subdural hematoma ซีกขวา หนา 12 มม. '
                 + 'midline shift 7 มม. และกะโหลกร้าวบริเวณ vault ขวา · ม่านตาขวาเริ่มโตกว่าซ้าย',
        treatment: 'ใส่ท่อช่วยหายใจ ให้ 3% NaCl ลดความดันในกะโหลก ยกหัวสูง 30 องศา '
                 + 'ให้ยากันชักป้องกัน และประคองความดันเลือดให้ MAP > 80 mmHg',
        rationale: 'ต้องผ่าตัดเปิดกะโหลกระบายเลือดภายในชั่วโมงแรก แต่หน่วยบริการเราไม่มี'
                 + 'ประสาทศัลยแพทย์และไม่มีหอผู้ป่วยวิกฤตประสาท ส่งต่อทันทีตามเกณฑ์ UCEP',
        request:   'ขอให้โรงพยาบาลนพรัตนราชธานีผ่าตัดเปิดกะโหลกระบายเลือด (01.24) เป็นการฉุกเฉิน '
                 + 'และรับไว้ดูแลในหอผู้ป่วยวิกฤต · ขออนุมัติย้อนหลังภายใน 72 ชั่วโมงตามเกณฑ์ UCEP',
    },
    reviewed_by: null, reviewer_name: null, reviewed_at: null, review_note: '',
    letter_no: null, auth_no: null, auth_type: null, auth_source: null,
    issued_at: null, expires_at: null,
    scope: 'IPD_ADMIT', scope_note: 'ผ่าตัดสมองฉุกเฉินและดูแลในหอผู้ป่วยวิกฤต',
    visit_limit: 1, visit_used: 0, cap_amount: 265000,
    approver: null, approved_at: null,
    refer_date: '2569-08-06', service_date_from: null, service_date_to: null,
    service_type: 'IPD', est_amount: 265000,
    reimbursable: true, reimburse_channel: 'DEST_HOSPITAL',
    counter_received: false, counter_sent: false, counter_at: null,
    risk_score: 35,
    risk_flags: [
        { code: 'REF-EMERG-OK', level: 'INFO', label: 'ฉุกเฉิน — ยกเว้นการขออนุมัติล่วงหน้า',
          detail: 'ส่งต่อฉุกเฉินตามเกณฑ์ UCEP ให้ขออนุมัติย้อนหลังภายใน 72 ชั่วโมง',
          evidence: { 'เวลาส่งต่อ': '6 ส.ค. 2569 02:40', 'ช่องทาง': 'ห้องฉุกเฉิน',
                      'กำหนดขออนุมัติย้อนหลัง': 'ภายใน 9 ส.ค. 2569' },
          maps_to_nhso: null, amount_at_risk: 0, rule_id: 'RUL-REF-002' },
    ],
    documents: [
        { name: 'ใบส่งตัวผู้ป่วย',      type: 'ใบส่งตัว',   status: 'PENDING', by: '—',              date: null },
        { name: 'สำเนาบัตรประชาชน/สิทธิ', type: 'สิทธิ',     status: 'FOUND',   by: 'ระบบ HIS',       date: '2569-08-06' },
        { name: 'บันทึกส่งต่อฉุกเฉิน',   type: 'เวชระเบียน', status: 'FOUND',   by: 'ห้องฉุกเฉิน',     date: '2569-08-06' },
        { name: 'ผล CT สมอง',          type: 'ผลตรวจ',     status: 'FOUND',   by: 'ห้องรังสีวิทยา',  date: '2569-08-06' },
    ],
    timeline: [
        { at: '2569-08-06T02:55', tone: 'info', title: 'บันทึกคำขอส่งต่อ', by: 'นพ.กิตติ ชัยวัฒน์',
          note: 'เหตุผล: ฉุกเฉิน / วิกฤต · ส่งต่อไปแล้วจากห้องฉุกเฉิน' },
    ],
    task_ids: [], owner: 'U-004', due_at: '2569-08-09T16:00', status: 'DRAFT',
},

/* ─── ร่างที่ 4: ⛔ ส่งไม่ได้ — ส่งผู้ป่วยไปก่อนได้เลขอนุมัติ (ธงระดับ ERROR) ─── */
{
    id: 'REF-OUT-2569-0064', direction: 'OUT', claim_id: null,
    hn: '00137418', an: null,
    patient: 'นางบุญเรือน พิทักษ์ไทย', age: 72, gender: 'F',
    nid_masked: '3-1063-xxxxx-90-3', fund: 'UC', right_no: 'UC69-0037418',
    partner_code: '41208', partner_name: 'โรงพยาบาลเอกชนคู่สัญญา บางกะปิ',
    partner_level: 'เอกชนคู่สัญญา', partner_province: 'กรุงเทพมหานคร',
    dx: [
        { code: 'M17.1', name: 'Other primary gonarthrosis',  type: 'หลัก' },
        { code: 'I10',   name: 'Essential (primary) hypertension', type: 'ร่วม' },
    ],
    proc_planned: [{ code: '81.54', name: 'Total knee replacement' }],
    proc_actual:  [],
    reason: 'APPOINT', urgency: 'ELECTIVE', doctor: 'นพ.สุรชัย มั่นคง',
    refer_note: 'ข้อเข่าเสื่อมรุนแรง นัดผ่าตัดเปลี่ยนข้อเข่าที่ รพ.คู่สัญญา',
    letter_no: null, auth_no: null, auth_type: null, auth_source: null,
    issued_at: null, expires_at: null,
    scope: 'PROC', scope_note: 'ผ่าตัดเปลี่ยนข้อเข่าเทียมข้างขวา',
    visit_limit: 1, visit_used: 0, cap_amount: 85000,
    approver: null, approved_at: null,
    refer_date: '2569-08-04', service_date_from: null, service_date_to: null,
    service_type: 'IPD', est_amount: 85000,
    reimbursable: true, reimburse_channel: 'DEST_HOSPITAL',
    counter_received: false, counter_sent: false, counter_at: null,
    risk_score: 78,
    risk_flags: [
        { code: 'REF-NOAUTH', level: 'ERROR', label: 'ไม่มีเลขอนุมัติ / เลขไม่ตรง',
          detail: 'นัดผ่าตัดกับปลายทางไว้แล้วตั้งแต่ 4 ส.ค. 2569 ทั้งที่ยังไม่ได้ขออนุมัติวงเงิน — ' +
                  'ถ้าปลายทางลงมือก่อน จะเรียกเก็บมาโดยไม่มีเลขอนุมัติรองรับ',
          evidence: { 'วันที่นัดปลายทาง': '12 ส.ค. 2569', 'สถานะคำขอ': 'ยังเป็นร่าง ไม่เคยส่งขออนุมัติ',
                      'เลขอนุมัติ': 'ยังไม่มี', 'วงเงินที่จะเสี่ยง': '85,000 บาท' },
          maps_to_nhso: 'C305', amount_at_risk: 85000, rule_id: 'RUL-REF-002' },
    ],
    documents: [
        { name: 'ใบส่งตัวผู้ป่วย',       type: 'ใบส่งตัว',   status: 'PENDING', by: '—',             date: null },
        { name: 'สำเนาบัตรประชาชน/สิทธิ', type: 'สิทธิ',      status: 'FOUND',   by: 'ระบบ HIS',      date: '2569-08-04' },
        { name: 'ใบรับรองแพทย์',         type: 'เวชระเบียน', status: 'MISSING', by: '—',             date: null },
        { name: 'ผลเอกซเรย์ข้อเข่า',      type: 'ผลตรวจ',     status: 'FOUND',   by: 'ห้องรังสีวิทยา', date: '2569-08-03' },
    ],
    timeline: [
        { at: '2569-08-04T14:30', tone: 'info',   title: 'บันทึกคำขอส่งต่อ', by: 'นพ.สุรชัย มั่นคง',
          note: 'เหตุผล: นัดหมายเฉพาะทาง · ประเมิน 85,000 บาท' },
        { at: '2569-08-05T10:20', tone: 'danger', title: 'ตรวจพบ 1 ประเด็น', by: 'Rule Engine',
          note: 'นัดปลายทางไว้แล้วแต่ยังไม่ได้ขออนุมัติ — เสี่ยง 85,000 บาท' },
    ],
    task_ids: [], owner: 'U-004', due_at: '2569-08-07T16:00', status: 'DRAFT',
},

/* ══════════════════════════════════════════════════════════════════════════
   ⭐ รอผู้บริหารอนุมัติ (WAIT_EXEC) — ผ่านชั้นเจ้าหน้าที่แล้ว แต่วงเงินเกินเกณฑ์
   สองแถวนี้มีไว้ให้หน้า exec-approve.html มีของให้ตัดสินตั้งแต่เปิดครั้งแรก
   ⚠️ ยังไม่มี auth_no/letter_no — เลขออกตอนผู้บริหารอนุมัติเท่านั้น
      และต้องมี ops_approver ครบ ไม่งั้นผู้บริหารตามไม่ได้ว่าใครอนุมัติชั้นแรก
   ══════════════════════════════════════════════════════════════════════════ */

/* ─── รอผู้บริหาร 1: ปลูกถ่ายไขกระดูก — วงเงินสูงสุดในคิว ─── */
{
    id: 'REF-OUT-2569-0071', direction: 'OUT', claim_id: null,
    hn: '00138110', an: null,
    patient: 'นางสาวปิยะดา วัฒนกุล', age: 29, gender: 'F',
    nid_masked: '1-1077-xxxxx-24-8', fund: 'UC', right_no: 'UC69-0038110',
    partner_code: '13778', partner_name: 'โรงพยาบาลจุฬาลงกรณ์ สภากาชาดไทย',
    partner_level: 'ตติยภูมิ', partner_province: 'กรุงเทพมหานคร',
    dx: [
        { code: 'C92.0', name: 'Acute myeloblastic leukaemia',            type: 'หลัก' },
        { code: 'D70',   name: 'Agranulocytosis',                          type: 'ร่วม' },
    ],
    proc_planned: [{ code: '41.02', name: 'Allogeneic bone marrow transplant with purging' }],
    proc_actual:  [],
    reason: 'OVER_CAP', urgency: 'URGENT', doctor: 'นพ.อนุชา ทวีสุข',
    attending_doctor: 'พญ.ชลธิชา ภักดีวงศ์', clinic_dept: 'คลินิกโลหิตวิทยา · อายุรกรรม',
    refer_note: 'ผู้ป่วย AML หลังให้เคมีบำบัดครบ ต้องปลูกถ่ายไขกระดูกจากผู้บริจาคที่เข้ากันได้',
    clinical_review: {
        history:   'หญิงไทย 29 ปี วินิจฉัย AML เมื่อ ก.พ. 2569 ให้เคมีบำบัดสูตร 7+3 ครบ 2 รอบ '
                 + 'เข้าสู่ระยะสงบ (CR1) แต่จัดอยู่ในกลุ่มเสี่ยงสูงจากผล cytogenetics',
        findings:  'ไขกระดูก blast < 5% · FLT3-ITD positive (กลุ่มเสี่ยงสูง) · '
                 + 'HLA ตรงกับพี่สาว 10/10 · ECOG 1 · การทำงานของตับและไตปกติ',
        treatment: 'เคมีบำบัด induction + consolidation ครบตามแผน · ให้เลือดและเกล็ดเลือดสนับสนุน '
                 + 'ควบคุมภาวะติดเชื้อได้ดี ไม่มีภาวะแทรกซ้อนรุนแรง',
        rationale: 'กลุ่มเสี่ยงสูงมีโอกาสกลับเป็นซ้ำสูงมากถ้าไม่ปลูกถ่าย และหน่วยบริการเรา '
                 + 'ไม่มีหน่วยปลูกถ่ายไขกระดูกและห้องแยกความดันบวก จึงทำเองไม่ได้',
        request:   'ขอให้โรงพยาบาลจุฬาลงกรณ์ทำ Allogeneic BMT จากพี่สาว (41.02) '
                 + 'ครอบคลุมการเตรียมผู้ป่วย การปลูกถ่าย และดูแลหลังปลูกถ่าย 100 วันแรก',
    },
    reviewed_by: 'U-004', reviewer_name: 'คุณพิมพ์ชนก วงศ์อนันต์', reviewed_at: '2569-08-05T15:40',
    review_note: 'ตรวจสิทธิและหนังสือยินยอมครบ · ยืนยันปลายทางมีคิวปลูกถ่ายเดือน ก.ย. 2569',
    letter_no: null, auth_no: null, auth_type: null, auth_source: null,
    issued_at: null, expires_at: null,
    scope: 'IPD_ADMIT', scope_note: 'ปลูกถ่ายไขกระดูกและดูแลหลังปลูกถ่าย 100 วันแรก',
    visit_limit: 1, visit_used: 0, cap_amount: 1250000,
    approver: null, approved_at: null,
    ops_approver: 'U-008', ops_approved_at: '2569-08-06T08:20',
    ops_approve_note: 'ความจำเป็นทางคลินิกชัดเจน ปลายทางมีศักยภาพ — เกินอำนาจอนุมัติของเจ้าหน้าที่',
    refer_date: '2569-08-05', service_date_from: null, service_date_to: null,
    service_type: 'IPD', est_amount: 1180000,
    reimbursable: true, reimburse_channel: 'FUND_CENTRAL',
    counter_received: false, counter_sent: false, counter_at: null,
    risk_score: 40, risk_flags: [],
    documents: [
        { name: 'ใบส่งตัวผู้ป่วย',        type: 'ใบส่งตัว',   status: 'PENDING', by: '—',                 date: null },
        { name: 'สำเนาบัตรประชาชน/สิทธิ',  type: 'สิทธิ',      status: 'FOUND',   by: 'ระบบ HIS',          date: '2569-08-05' },
        { name: 'ใบรับรองแพทย์',          type: 'เวชระเบียน', status: 'FOUND',   by: 'พญ.ชลธิชา ภักดีวงศ์', date: '2569-08-05' },
        { name: 'ผลตรวจไขกระดูกและ HLA',  type: 'ผลตรวจ',     status: 'FOUND',   by: 'ห้องปฏิบัติการ',     date: '2569-08-03' },
        { name: 'หนังสือยินยอมรับการรักษา', type: 'เวชระเบียน', status: 'FOUND',   by: 'เวชระเบียน',        date: '2569-08-05' },
    ],
    timeline: [
        { at: '2569-08-05T13:05', tone: 'info',    title: 'บันทึกคำขอส่งต่อ', by: 'นพ.อนุชา ทวีสุข',
          note: 'เหตุผล: เกินศักยภาพหน่วยบริการ · ประเมิน 1,180,000 บาท' },
        { at: '2569-08-05T15:40', tone: 'info',    title: 'เจ้าหน้าที่ตรวจทานแล้ว', by: 'คุณพิมพ์ชนก วงศ์อนันต์',
          note: 'ตรวจสิทธิและหนังสือยินยอมครบ' },
        { at: '2569-08-05T16:00', tone: 'warning', title: 'ส่งขออนุมัติ', by: 'คุณพิมพ์ชนก วงศ์อนันต์',
          note: 'TSK-000161 · Maker–Checker: ผู้ขอไม่อนุมัติเอง' },
        { at: '2569-08-06T08:20', tone: 'warning', title: 'อนุมัติชั้นเจ้าหน้าที่ — ส่งต่อผู้บริหาร', by: 'คุณสุรชัย มั่นคงดี',
          note: 'วงเงิน 1,250,000 บาท เกินเกณฑ์ 250,000 บาท · TSK-000162 ถึง นพ.ธนวัฒน์ ศรีสุวรรณ' },
    ],
    task_ids: ['TSK-000161', 'TSK-000162'], owner: 'U-001', due_at: '2569-08-09T16:00', status: 'WAIT_EXEC',
},

/* ─── รอผู้บริหาร 2: ผ่าตัดกระดูกสันหลัง — เกินเกณฑ์ไม่มาก แต่ปลายทางเป็นเอกชน ─── */
{
    id: 'REF-OUT-2569-0072', direction: 'OUT', claim_id: null,
    hn: '00138347', an: null,
    patient: 'นายมานพ เรืองศรี', age: 55, gender: 'M',
    nid_masked: '3-1088-xxxxx-61-2', fund: 'SSS', right_no: 'SSS69-0038347',
    partner_code: '41208', partner_name: 'โรงพยาบาลเอกชนคู่สัญญา บางกะปิ',
    partner_level: 'เอกชนคู่สัญญา', partner_province: 'กรุงเทพมหานคร',
    dx: [
        { code: 'M48.0', name: 'Spinal stenosis',                    type: 'หลัก' },
        { code: 'M51.1', name: 'Lumbar disc disorder with radiculopathy', type: 'ร่วม' },
    ],
    proc_planned: [{ code: '81.08', name: 'Lumbar and lumbosacral fusion, posterior technique' }],
    proc_actual:  [],
    reason: 'EQUIP', urgency: 'ELECTIVE', doctor: 'นพ.กิตติ ชัยวัฒน์',
    attending_doctor: 'นพ.กิตติ ชัยวัฒน์', clinic_dept: 'คลินิกกระดูกและข้อ',
    refer_note: 'โพรงกระดูกสันหลังตีบรุนแรง เดินได้ไม่เกิน 50 เมตร ต้องผ่าตัดเชื่อมข้อกระดูก',
    clinical_review: {
        history:   'ชายไทย 55 ปี ปวดหลังร้าวลงขาทั้งสองข้างมา 2 ปี อาการแย่ลงต่อเนื่อง '
                 + '6 เดือนหลังเดินได้ไม่เกิน 50 เมตรต้องหยุดพัก เริ่มมีอาการชาและอ่อนแรง',
        findings:  'MRI: central canal stenosis ระดับ L3-L5 รุนแรง กดทับรากประสาททั้งสองข้าง · '
                 + 'EMG ยืนยันการบาดเจ็บของรากประสาท L5 · กำลังกล้ามเนื้อขาขวา 4/5',
        treatment: 'กายภาพบำบัด 6 เดือน · ยาแก้ปวดกลุ่ม NSAIDs และ gabapentin · '
                 + 'ฉีดยาสเตียรอยด์เข้าโพรงประสาท 2 ครั้ง อาการดีขึ้นชั่วคราวแล้วกลับมาเหมือนเดิม',
        rationale: 'รักษาแบบไม่ผ่าตัดครบทุกทางแล้วไม่ได้ผล และเริ่มมีอาการทางระบบประสาท '
                 + 'หน่วยบริการเราไม่มีเครื่องมือผ่าตัดเชื่อมข้อกระดูกสันหลังและทีมประสาทศัลยแพทย์',
        request:   'ขอให้ปลายทางทำ Lumbar fusion L3-L5 (81.08) พร้อมอุปกรณ์ยึดตรึง '
                 + 'และกายภาพบำบัดหลังผ่าตัดจนกลับมาเดินได้',
    },
    reviewed_by: 'U-004', reviewer_name: 'คุณพิมพ์ชนก วงศ์อนันต์', reviewed_at: '2569-08-05T11:15',
    review_note: 'ตรวจแล้วรักษาแบบไม่ผ่าตัดครบตามเกณฑ์ · ปลายทางเป็นเอกชนคู่สัญญา อัตรายังไม่เคยเทียบ',
    letter_no: null, auth_no: null, auth_type: null, auth_source: null,
    issued_at: null, expires_at: null,
    scope: 'PROC', scope_note: 'ผ่าตัดเชื่อมข้อกระดูกสันหลังระดับ L3-L5 พร้อมอุปกรณ์ยึดตรึง',
    visit_limit: 1, visit_used: 0, cap_amount: 385000,
    approver: null, approved_at: null,
    ops_approver: 'U-008', ops_approved_at: '2569-08-06T08:35',
    ops_approve_note: 'ข้อบ่งชี้ครบ แต่ปลายทางเป็นเอกชนและอัตราสูงกว่าโรงพยาบาลรัฐ — ขอความเห็นผู้บริหาร',
    refer_date: '2569-08-05', service_date_from: null, service_date_to: null,
    service_type: 'IPD', est_amount: 372000,
    reimbursable: true, reimburse_channel: 'DEST_HOSPITAL',
    counter_received: false, counter_sent: false, counter_at: null,
    risk_score: 52,
    risk_flags: [
        { code: 'REF-NOCOUNTER', level: 'WARNING', label: 'ยังไม่มีใบตอบกลับ (counter-referral)',
          detail: 'ปลายทางเป็นเอกชนคู่สัญญาที่ยังไม่มี MOU อัตราค่าบริการ — ควรตกลงอัตราก่อนส่งตัว',
          evidence: { 'ปลายทาง': 'โรงพยาบาลเอกชนคู่สัญญา บางกะปิ', 'สถานะ MOU': 'ยังไม่มี',
                      'ระยะเวลาตามจ่ายเฉลี่ย': '71 วัน', 'อัตราที่เสนอ': '385,000 บาท' },
          maps_to_nhso: null, amount_at_risk: 0, rule_id: 'RUL-REF-002' },
    ],
    documents: [
        { name: 'ใบส่งตัวผู้ป่วย',       type: 'ใบส่งตัว',   status: 'PENDING', by: '—',              date: null },
        { name: 'สำเนาบัตรประชาชน/สิทธิ', type: 'สิทธิ',      status: 'FOUND',   by: 'ระบบ HIS',       date: '2569-08-05' },
        { name: 'ใบรับรองแพทย์',         type: 'เวชระเบียน', status: 'FOUND',   by: 'นพ.กิตติ ชัยวัฒน์', date: '2569-08-05' },
        { name: 'ผล MRI กระดูกสันหลัง',  type: 'ผลตรวจ',     status: 'FOUND',   by: 'ห้องรังสีวิทยา',   date: '2569-07-30' },
    ],
    timeline: [
        { at: '2569-08-05T10:30', tone: 'info',    title: 'บันทึกคำขอส่งต่อ', by: 'นพ.กิตติ ชัยวัฒน์',
          note: 'เหตุผล: ไม่มีเครื่องมือ / เตียงเต็ม · ประเมิน 372,000 บาท' },
        { at: '2569-08-05T11:15', tone: 'info',    title: 'เจ้าหน้าที่ตรวจทานแล้ว', by: 'คุณพิมพ์ชนก วงศ์อนันต์',
          note: 'ปลายทางเป็นเอกชนคู่สัญญา อัตรายังไม่เคยเทียบ' },
        { at: '2569-08-05T11:40', tone: 'warning', title: 'ส่งขออนุมัติ', by: 'คุณพิมพ์ชนก วงศ์อนันต์',
          note: 'TSK-000163 · Maker–Checker: ผู้ขอไม่อนุมัติเอง' },
        { at: '2569-08-06T08:35', tone: 'warning', title: 'อนุมัติชั้นเจ้าหน้าที่ — ส่งต่อผู้บริหาร', by: 'คุณสุรชัย มั่นคงดี',
          note: 'วงเงิน 385,000 บาท เกินเกณฑ์ 250,000 บาท · TSK-000164 ถึง นพ.ธนวัฒน์ ศรีสุวรรณ' },
    ],
    task_ids: ['TSK-000163', 'TSK-000164'], owner: 'U-001', due_at: '2569-08-08T16:00', status: 'WAIT_EXEC',
},

/* ─── ภาระผูกพันที่ยังไม่มีใบเรียกเก็บ 25 วัน ─── */
{
    id: 'REF-OUT-2569-0028', direction: 'OUT', claim_id: null,
    hn: '00129301', an: null,
    patient: 'นางสาวจิราพร แสงทอง', age: 34, gender: 'F',
    nid_masked: '1-1098-xxxxx-77-4', fund: 'SSS', right_no: 'SSS69-0029301',
    partner_code: '13760', partner_name: 'โรงพยาบาลเลิดสิน',
    partner_level: 'ตติยภูมิ', partner_province: 'กรุงเทพมหานคร',
    dx: [{ code: 'M51.1', name: 'Lumbar and other intervertebral disc disorders with radiculopathy', type: 'หลัก' }],
    proc_planned: [{ code: '80.51', name: 'Excision of intervertebral disc' }],
    proc_actual:  [{ code: '80.51', name: 'Excision of intervertebral disc', date: '2569-07-14' }],
    reason: 'EQUIP', urgency: 'ELECTIVE', doctor: 'นพ.สุรชัย มั่นคง',
    refer_note: 'ต้องผ่าตัดหมอนรองกระดูก ไม่มีเครื่องมือที่หน่วยบริการ',
    letter_no: 'นส.11812/2569/0402', auth_no: 'SSS-69-330914', auth_type: 'PREAUTH',
    auth_source: 'สำนักงานประกันสังคม', issued_at: '2569-07-08', expires_at: '2569-10-08',
    scope: 'PROC', scope_note: 'ผ่าตัดหมอนรองกระดูกสันหลังส่วนเอว',
    visit_limit: 3, visit_used: 2, cap_amount: 62000,
    approver: 'พญ.สุนิสา เจริญพงศ์', approved_at: '2569-07-08T10:15',
    refer_date: '2569-07-08', service_date_from: '2569-07-12', service_date_to: '2569-07-18',
    service_type: 'IPD', est_amount: 38000,
    reimbursable: false, reimburse_channel: null,
    counter_received: true, counter_sent: false, counter_at: '2569-07-22',
    risk_score: 58,
    risk_flags: [
        { code: 'REF-UNBILLED', level: 'WARNING', label: 'ภาระผูกพันที่ยังไม่มีใบเรียกเก็บ',
          detail: 'ผู้ป่วยรับบริการเสร็จตั้งแต่ 18 ก.ค. 2569 ผ่านมา 19 วันยังไม่ได้รับใบเรียกเก็บจากปลายทาง',
          evidence: { 'วันที่ให้บริการเสร็จ': '18 ก.ค. 2569', 'จำนวนวันที่ผ่านมา': '19 วัน',
                      'มูลค่าประเมิน': '38,000 บาท', 'สถานะใบเรียกเก็บ': 'ยังไม่ได้รับ' },
          maps_to_nhso: null, amount_at_risk: 38000, rule_id: 'RUL-REF-003' },
    ],
    documents: [
        { name: 'ใบส่งตัวผู้ป่วย',       type: 'ใบส่งตัว',   status: 'FOUND',   by: 'นพ.สุรชัย มั่นคง', date: '2569-07-08' },
        { name: 'สำเนาบัตรประชาชน/สิทธิ', type: 'สิทธิ',      status: 'FOUND',   by: 'ระบบ HIS',        date: '2569-07-08' },
        { name: 'ใบตอบกลับจากปลายทาง',   type: 'ใบตอบกลับ',  status: 'FOUND',   by: 'รพ.เลิดสิน',       date: '2569-07-22' },
        { name: 'ใบแจ้งหนี้ปลายทาง',     type: 'ใบแจ้งหนี้',  status: 'MISSING', by: '—',               date: null },
    ],
    timeline: [
        { at: '2569-07-08T09:05', tone: 'info',    title: 'บันทึกคำขอส่งต่อ',      by: 'นพ.สุรชัย มั่นคง',   note: '' },
        { at: '2569-07-08T10:15', tone: 'success', title: 'อนุมัติและออกใบส่งตัว',  by: 'พญ.สุนิสา เจริญพงศ์', note: 'วงเงิน 62,000 บาท' },
        { at: '2569-07-22T11:30', tone: 'success', title: 'รับใบตอบกลับจากปลายทาง', by: 'เวชระเบียน',        note: '' },
        { at: '2569-08-06T08:00', tone: 'warning', title: 'ยังไม่ได้รับใบเรียกเก็บ', by: 'Rule Engine',       note: 'ผ่านมา 19 วัน — ภาระผูกพัน 38,000 บาทยังไม่ถูกบันทึก' },
    ],
    task_ids: [], owner: 'U-007', due_at: '2569-08-12T16:00', status: 'IN_SERVICE',
},

/* ─── ฉุกเฉิน ไม่มีเลขอนุมัติล่วงหน้า แต่ถูกต้องตามระเบียบ (พิสูจน์ว่ากฎไม่ยิงมั่ว) ─── */
{
    id: 'REF-OUT-2569-0040', direction: 'OUT', claim_id: null,
    hn: '00136612', an: null,
    patient: 'นายเอกชัย พงษ์ไพบูลย์', age: 48, gender: 'M',
    nid_masked: '3-1030-xxxxx-91-8', fund: 'UC', right_no: 'UC69-0036612',
    partner_code: '13765', partner_name: 'โรงพยาบาลนพรัตนราชธานี',
    partner_level: 'ตติยภูมิ', partner_province: 'กรุงเทพมหานคร',
    dx: [{ code: 'S06.5', name: 'Traumatic subdural haemorrhage', type: 'หลัก' }],
    proc_planned: [{ code: '01.31', name: 'Incision of cerebral meninges' }],
    proc_actual:  [{ code: '01.31', name: 'Incision of cerebral meninges', date: '2569-07-26' }],
    reason: 'EMERGENCY', urgency: 'EMERGENCY', doctor: 'นพ.กิตติ ชัยวัฒน์',
    refer_note: 'อุบัติเหตุจราจร เลือดออกใต้เยื่อหุ้มสมอง ส่งต่อฉุกเฉินเวลา 02:15 น.',
    letter_no: 'นส.11812/2569/0455', auth_no: 'UCS-69-007733', auth_type: 'CLOSE_RIGHT',
    auth_source: 'สปสช.', issued_at: '2569-07-26', expires_at: '2569-08-26',
    scope: 'IPD_ADMIT', scope_note: 'ผ่าตัดสมองฉุกเฉินและรับไว้เป็นผู้ป่วยใน',
    visit_limit: 1, visit_used: 1, cap_amount: 320000,
    approver: 'นพ.กิตติ ชัยวัฒน์ (อนุมัติย้อนหลังตามระเบียบฉุกเฉิน)', approved_at: '2569-07-26T09:00',
    refer_date: '2569-07-26', service_date_from: '2569-07-26', service_date_to: '2569-08-02',
    service_type: 'IPD', est_amount: 296000,
    reimbursable: true, reimburse_channel: 'FUND_CENTRAL',
    counter_received: true, counter_sent: false, counter_at: '2569-08-04',
    risk_score: 22,
    risk_flags: [
        { code: 'REF-EMERG-OK', level: 'INFO', label: 'ฉุกเฉิน — ยกเว้นการขออนุมัติล่วงหน้า',
          detail: 'ส่งต่อฉุกเฉินนอกเวลาราชการ ขอเลขอนุมัติย้อนหลังภายใน 24 ชม. ถูกต้องตามระเบียบ',
          evidence: { 'เวลาส่งต่อ': '26 ก.ค. 2569 02:15 น.', 'เวลาขอเลขอนุมัติ': '26 ก.ค. 2569 09:00 น.',
                      'ระยะเวลา': '6 ชม. 45 นาที (ไม่เกิน 24 ชม.)', 'ผลการตรวจ': 'ผ่าน' },
          maps_to_nhso: null, amount_at_risk: 0, rule_id: 'RUL-REF-002' },
    ],
    documents: [
        { name: 'ใบส่งตัวผู้ป่วย',       type: 'ใบส่งตัว',   status: 'FOUND', by: 'นพ.กิตติ ชัยวัฒน์', date: '2569-07-26' },
        { name: 'บันทึกส่งต่อฉุกเฉิน',    type: 'เวชระเบียน', status: 'FOUND', by: 'ห้องฉุกเฉิน',       date: '2569-07-26' },
        { name: 'ใบตอบกลับจากปลายทาง',   type: 'ใบตอบกลับ',  status: 'FOUND', by: 'รพ.นพรัตน์ฯ',       date: '2569-08-04' },
    ],
    timeline: [
        { at: '2569-07-26T02:15', tone: 'danger',  title: 'ส่งต่อฉุกเฉิน',        by: 'ห้องฉุกเฉิน',       note: 'อุบัติเหตุจราจร — ส่ง รพ.นพรัตน์ฯ' },
        { at: '2569-07-26T09:00', tone: 'success', title: 'ขอเลขอนุมัติย้อนหลัง',  by: 'นพ.กิตติ ชัยวัฒน์', note: 'ภายใน 24 ชม. ตามระเบียบฉุกเฉิน' },
        { at: '2569-08-04T10:20', tone: 'success', title: 'รับใบตอบกลับจากปลายทาง', by: 'เวชระเบียน',       note: '' },
    ],
    task_ids: [], owner: 'U-005', due_at: '2569-08-20T16:00', status: 'IN_SERVICE',
},

/* ─── ⭐ รับเข้า: เรียกเก็บซ้ำซ้อน ทั้งต้นทางและ สปสช. ─── */
{
    id: 'REF-IN-2569-0044', direction: 'IN', claim_id: null,
    hn: '00138204', an: 'AN690812',
    patient: 'นางบุญเรือน ศรีทอง', age: 63, gender: 'F',
    nid_masked: '3-1044-xxxxx-30-5', fund: 'UC', right_no: 'UC69-0038204',
    partner_code: '05412', partner_name: 'รพ.สต. บ้านหนองบัว',
    partner_level: 'ปฐมภูมิ', partner_province: 'กรุงเทพมหานคร',
    dx: [{ code: 'J18.9', name: 'Pneumonia, unspecified organism', type: 'หลัก' }],
    proc_planned: [{ code: '96.04', name: 'Insertion of endotracheal tube' }],
    proc_actual:  [{ code: '96.04', name: 'Insertion of endotracheal tube', date: '2569-06-18' }],
    reason: 'OVER_CAP', urgency: 'URGENT', doctor: 'นพ.อนุชา ทวีสุข',
    refer_note: 'ปอดอักเสบรุนแรง ต้องใส่ท่อช่วยหายใจ',
    letter_no: 'นส.05412/2569/0119', auth_no: 'UCS-69-005511', auth_type: 'CLOSE_RIGHT',
    auth_source: 'สปสช.', issued_at: '2569-06-17', expires_at: '2569-09-17',
    scope: 'IPD_ADMIT', scope_note: 'รับไว้เป็นผู้ป่วยในและรักษาภาวะปอดอักเสบ',
    visit_limit: 1, visit_used: 1, cap_amount: 88000,
    approver: 'ผอ.รพ.สต. บ้านหนองบัว', approved_at: '2569-06-17T16:40',
    refer_date: '2569-06-17', service_date_from: '2569-06-17', service_date_to: '2569-06-26',
    service_type: 'IPD', est_amount: 74500,
    reimbursable: true, reimburse_channel: 'ORIGIN_HOSPITAL',
    counter_received: false, counter_sent: true, counter_at: '2569-06-28',
    risk_score: 88,
    risk_flags: [
        { code: 'REF-DUP', level: 'ERROR', label: 'เรียกเก็บซ้ำซ้อน (ทั้งต้นทางและ สปสช.)',
          detail: 'ออกใบเรียกเก็บไปที่ รพ.สต. บ้านหนองบัว แล้ว และยังส่งเบิก สปสช. ในเคส CLM-2569-0055 ด้วย',
          evidence: { 'ใบเรียกเก็บต้นทาง': 'RBL-2569-0022 · 74,500 บาท',
                      'เคสที่ส่งเบิก สปสช.': 'CLM-2569-0055',
                      'ช่องทางที่ถูกต้อง': 'เลือกอย่างใดอย่างหนึ่งเท่านั้น',
                      'มูลค่าที่เสี่ยงถูกเรียกคืน': '74,500 บาท' },
          maps_to_nhso: null, amount_at_risk: 74500, rule_id: 'RUL-REF-003' },
    ],
    documents: [
        { name: 'ใบส่งตัวจากต้นทาง',     type: 'ใบส่งตัว',   status: 'FOUND', by: 'รพ.สต. บ้านหนองบัว', date: '2569-06-17' },
        { name: 'สำเนาบัตรประชาชน/สิทธิ', type: 'สิทธิ',      status: 'FOUND', by: 'ระบบ HIS',          date: '2569-06-17' },
        { name: 'Discharge Summary',     type: 'เวชระเบียน', status: 'FOUND', by: 'เวชระเบียน',        date: '2569-06-26' },
        { name: 'ใบตอบกลับที่ส่งให้ต้นทาง', type: 'ใบตอบกลับ', status: 'FOUND', by: 'เวชระเบียน',        date: '2569-06-28' },
    ],
    timeline: [
        { at: '2569-06-17T17:20', tone: 'info',    title: 'รับผู้ป่วยส่งต่อ',      by: 'ห้องฉุกเฉิน',  note: 'จาก รพ.สต. บ้านหนองบัว' },
        { at: '2569-06-28T09:15', tone: 'success', title: 'ส่งใบตอบกลับให้ต้นทาง',  by: 'เวชระเบียน',   note: '' },
        { at: '2569-07-02T10:00', tone: 'info',    title: 'ออกใบเรียกเก็บต้นทาง',   by: 'งานการเงิน',   note: 'RBL-2569-0022 · 74,500 บาท' },
        { at: '2569-08-06T08:00', tone: 'danger',  title: 'ตรวจพบการเรียกเก็บซ้ำซ้อน', by: 'Rule Engine', note: 'มีทั้งใบเรียกเก็บต้นทางและเคสส่งเบิก สปสช. CLM-2569-0055' },
    ],
    task_ids: [], owner: 'U-007', due_at: '2569-08-09T16:00', status: 'BILLED',
},

/* ─── ⭐ รับเข้า: ใบส่งตัวไม่มีเลขอนุมัติ → ผูกกับเคสที่ได้ C305 กลับมาจริง ─── */
{
    id: 'REF-IN-2569-0051', direction: 'IN', claim_id: 'CLM-2569-0007',
    hn: '00119872', an: null,
    patient: 'นายประสิทธิ์ แก้วมณี', age: 58, gender: 'M',
    nid_masked: '3-1002-xxxxx-55-9', fund: 'OFC', right_no: 'OFC69-0019872',
    partner_code: '22415', partner_name: 'คลินิกชุมชนอบอุ่น เขตบางกะปิ',
    partner_level: 'ปฐมภูมิ', partner_province: 'กรุงเทพมหานคร',
    dx: [{ code: 'K21.0', name: 'Gastro-oesophageal reflux disease with oesophagitis', type: 'หลัก' }],
    proc_planned: [{ code: '45.13', name: 'Other endoscopy of small intestine' }],
    proc_actual:  [{ code: '45.13', name: 'Other endoscopy of small intestine', date: '2569-07-14' }],
    reason: 'APPOINT', urgency: 'ELECTIVE', doctor: 'นพ.วรพล อินทรสุวรรณ',
    refer_note: 'ส่งมาส่องกล้องทางเดินอาหารส่วนบน',
    letter_no: 'นส.22415/2569/0077', auth_no: null, auth_type: null, auth_source: null,
    issued_at: '2569-07-10', expires_at: '2569-10-10',
    scope: 'DIAG', scope_note: 'ส่องกล้องทางเดินอาหารส่วนบน',
    visit_limit: 1, visit_used: 1, cap_amount: 12000,
    approver: null, approved_at: null,
    refer_date: '2569-07-10', service_date_from: '2569-07-14', service_date_to: '2569-07-14',
    service_type: 'OPD', est_amount: 5240,
    reimbursable: true, reimburse_channel: 'NHSO_DIRECT',
    counter_received: false, counter_sent: true, counter_at: '2569-07-16',
    risk_score: 91,
    risk_flags: [
        { code: 'REF-NOAUTH', level: 'ERROR', label: 'ไม่มีเลขอนุมัติ / เลขไม่ตรง',
          detail: 'ใบส่งตัวจากต้นทางไม่มี Approve Code (OFC) — ส่งเบิกไปแล้วได้ C305 กลับมาจริงบนเคส CLM-2569-0007',
          evidence: { 'เลขที่ใบส่งตัว': 'นส.22415/2569/0077', 'Approve Code (OFC)': 'ไม่มี',
                      'สิทธิ': 'OFC (ข้าราชการ)', 'เคสที่ส่งเบิก': 'CLM-2569-0007',
                      'รหัสที่ สปสช. ตอบกลับ': 'C305', 'มูลค่าที่ถูกตัด': '1,860 บาท' },
          maps_to_nhso: 'C305', amount_at_risk: 1860, rule_id: 'RUL-REF-002' },
    ],
    documents: [
        { name: 'ใบส่งตัวจากต้นทาง',     type: 'ใบส่งตัว',   status: 'UNREADABLE', by: 'คลินิกชุมชนอบอุ่นฯ', date: '2569-07-10' },
        { name: 'สำเนาบัตรประชาชน/สิทธิ', type: 'สิทธิ',      status: 'FOUND',      by: 'ระบบ HIS',          date: '2569-07-14' },
        { name: 'ผลส่องกล้อง',           type: 'ผลตรวจ',     status: 'FOUND',      by: 'ห้องส่องกล้อง',      date: '2569-07-14' },
        { name: 'ใบตอบกลับที่ส่งให้ต้นทาง', type: 'ใบตอบกลับ', status: 'FOUND',      by: 'เวชระเบียน',        date: '2569-07-16' },
    ],
    timeline: [
        { at: '2569-07-14T08:30', tone: 'info',   title: 'รับผู้ป่วยส่งต่อ',       by: 'เวชระเบียน',  note: 'ใบส่งตัวไม่ระบุ Approve Code' },
        { at: '2569-07-16T10:00', tone: 'success', title: 'ส่งใบตอบกลับให้ต้นทาง',  by: 'เวชระเบียน',  note: '' },
        { at: '2569-07-18T09:00', tone: 'info',   title: 'ส่งเบิก สปสช. โดยตรง',   by: 'ระบบ',        note: 'เคส CLM-2569-0007' },
        { at: '2569-07-30T14:22', tone: 'danger', title: 'สปสช. ตอบกลับ C305',     by: 'NHSO',        note: 'Approve Code (OFC) ไม่ตรงฐานข้อมูลหน่วยบริการ' },
    ],
    task_ids: [], owner: 'U-009', due_at: '2569-08-08T12:00', status: 'BILLED',
},

/* ─── รับเข้า: เกินกำหนดยื่นเรียกเก็บ ─── */
{
    id: 'REF-IN-2569-0038', direction: 'IN', claim_id: null,
    hn: '00125517', an: 'AN690644',
    patient: 'นายสมพงษ์ ไกรทอง', age: 55, gender: 'M',
    nid_masked: '3-1017-xxxxx-24-3', fund: 'UC', right_no: 'UC69-0025517',
    partner_code: '10731', partner_name: 'โรงพยาบาลนำร่อง เขตสุขภาพที่ 4',
    partner_level: 'ทุติยภูมิ', partner_province: 'ปทุมธานี',
    dx: [{ code: 'S72.0', name: 'Fracture of neck of femur', type: 'หลัก' }],
    proc_planned: [{ code: '79.35', name: 'Open reduction of fracture with internal fixation, femur' }],
    proc_actual:  [{ code: '79.35', name: 'Open reduction of fracture with internal fixation, femur', date: '2569-06-04' }],
    reason: 'OVER_CAP', urgency: 'URGENT', doctor: 'นพ.สุรชัย มั่นคง',
    refer_note: 'กระดูกสะโพกหักจากการหกล้ม ต้องผ่าตัดยึดตรึงภายใน',
    letter_no: 'นส.10731/2569/0233', auth_no: 'UCS-69-004902', auth_type: 'CLOSE_RIGHT',
    auth_source: 'สปสช.', issued_at: '2569-06-02', expires_at: '2569-09-02',
    scope: 'PROC', scope_note: 'ผ่าตัดยึดตรึงกระดูกต้นขาส่วนคอ',
    visit_limit: 2, visit_used: 1, cap_amount: 92000,
    approver: 'ผอ.รพ.นำร่อง เขตสุขภาพที่ 4', approved_at: '2569-06-02T11:00',
    refer_date: '2569-06-02', service_date_from: '2569-06-02', service_date_to: '2569-06-11',
    service_type: 'IPD', est_amount: 18400,
    reimbursable: true, reimburse_channel: 'ORIGIN_HOSPITAL',
    counter_received: false, counter_sent: true, counter_at: '2569-06-14',
    risk_score: 86,
    risk_flags: [
        { code: 'REF-LATE', level: 'ERROR', label: 'เกินกำหนดยื่นเรียกเก็บ',
          detail: 'ให้บริการเสร็จ 11 มิ.ย. 2569 กำหนดยื่นภายใน 30 ก.ค. 2569 ปัจจุบันยังไม่ได้ส่งเรียกเก็บ',
          evidence: { 'วันที่ให้บริการเสร็จ': '11 มิ.ย. 2569', 'กำหนดยื่นตามระเบียบ': '30 ก.ค. 2569',
                      'สถานะปัจจุบัน': 'ยังไม่ได้ส่งเรียกเก็บ', 'เกินกำหนดมา': '7 วัน',
                      'มูลค่าที่เสี่ยงเสียสิทธิ': '18,400 บาท' },
          maps_to_nhso: null, amount_at_risk: 18400, rule_id: 'RUL-REF-003' },
    ],
    documents: [
        { name: 'ใบส่งตัวจากต้นทาง',     type: 'ใบส่งตัว',   status: 'FOUND',   by: 'รพ.นำร่องฯ',  date: '2569-06-02' },
        { name: 'สำเนาบัตรประชาชน/สิทธิ', type: 'สิทธิ',      status: 'FOUND',   by: 'ระบบ HIS',   date: '2569-06-02' },
        { name: 'Discharge Summary',     type: 'เวชระเบียน', status: 'FOUND',   by: 'เวชระเบียน', date: '2569-06-11' },
        { name: 'ใบเรียกเก็บที่ออกแล้ว',  type: 'ใบแจ้งหนี้',  status: 'MISSING', by: '—',          date: null },
    ],
    timeline: [
        { at: '2569-06-02T12:40', tone: 'info',    title: 'รับผู้ป่วยส่งต่อ',      by: 'ห้องฉุกเฉิน', note: 'จาก รพ.นำร่อง เขตสุขภาพที่ 4' },
        { at: '2569-06-14T09:30', tone: 'success', title: 'ส่งใบตอบกลับให้ต้นทาง',  by: 'เวชระเบียน',  note: '' },
        { at: '2569-08-06T08:00', tone: 'danger',  title: 'เกินกำหนดยื่นเรียกเก็บ',  by: 'Rule Engine', note: 'กำหนด 30 ก.ค. 2569 — เสี่ยงเสียสิทธิ 18,400 บาท' },
    ],
    task_ids: [], owner: 'U-007', due_at: '2569-08-07T12:00', status: 'IN_SERVICE',
},

/* ─── รับเข้า: ยังไม่ได้ส่งใบตอบกลับ 21 วัน ─── */
{
    id: 'REF-IN-2569-0057', direction: 'IN', claim_id: null,
    hn: '00140118', an: null,
    patient: 'นางสาวปิยะนุช บุญเรือง', age: 29, gender: 'F',
    nid_masked: '1-1055-xxxxx-63-0', fund: 'UC', right_no: 'UC69-0040118',
    partner_code: '11812', partner_name: 'ศูนย์บริการสาธารณสุข 12 (กทม.)',
    partner_level: 'ปฐมภูมิ', partner_province: 'กรุงเทพมหานคร',
    dx: [{ code: 'H25.9', name: 'Age-related cataract, unspecified', type: 'หลัก' }],
    proc_planned: [{ code: '13.41', name: 'Phacoemulsification and aspiration of cataract' }],
    proc_actual:  [{ code: '13.41', name: 'Phacoemulsification and aspiration of cataract', date: '2569-07-16' }],
    reason: 'EQUIP', urgency: 'ELECTIVE', doctor: 'พญ.กมลชนก แสงเพชร',
    refer_note: 'ส่งมาผ่าตัดต้อกระจกด้วยคลื่นเสียงความถี่สูง',
    letter_no: 'นส.11812/2569/0388', auth_no: 'UCS-69-006240', auth_type: 'CLOSE_RIGHT',
    auth_source: 'สปสช.', issued_at: '2569-07-12', expires_at: '2569-10-12',
    scope: 'PROC', scope_note: 'ผ่าตัดต้อกระจกพร้อมใส่เลนส์แก้วตาเทียม',
    visit_limit: 2, visit_used: 1, cap_amount: 26000,
    approver: 'ผอ.ศูนย์บริการสาธารณสุข 12', approved_at: '2569-07-12T13:20',
    refer_date: '2569-07-12', service_date_from: '2569-07-16', service_date_to: '2569-07-16',
    service_type: 'OPD', est_amount: 21800,
    reimbursable: true, reimburse_channel: 'ORIGIN_HOSPITAL',
    counter_received: false, counter_sent: false, counter_at: null,
    risk_score: 54,
    risk_flags: [
        { code: 'REF-NOCOUNTER', level: 'WARNING', label: 'ยังไม่มีใบตอบกลับ (counter-referral)',
          detail: 'ให้บริการเสร็จ 16 ก.ค. 2569 ผ่านมา 21 วันยังไม่ได้ส่งใบตอบกลับให้ต้นทาง — เวชระเบียนไม่ครบจะส่งเบิกไม่ผ่าน',
          evidence: { 'วันที่ให้บริการ': '16 ก.ค. 2569', 'จำนวนวันที่ผ่านมา': '21 วัน',
                      'กำหนดตามระเบียบ': 'ภายใน 15 วัน', 'สถานะใบตอบกลับ': 'ยังไม่ได้ส่ง' },
          maps_to_nhso: null, amount_at_risk: 21800, rule_id: 'RUL-REF-002' },
    ],
    documents: [
        { name: 'ใบส่งตัวจากต้นทาง',     type: 'ใบส่งตัว',   status: 'FOUND',   by: 'ศูนย์บริการสาธารณสุข 12', date: '2569-07-12' },
        { name: 'สำเนาบัตรประชาชน/สิทธิ', type: 'สิทธิ',      status: 'FOUND',   by: 'ระบบ HIS',              date: '2569-07-16' },
        { name: 'ใบสรุปการผ่าตัด',       type: 'เวชระเบียน', status: 'FOUND',   by: 'ห้องผ่าตัด',             date: '2569-07-16' },
        { name: 'ใบตอบกลับที่ส่งให้ต้นทาง', type: 'ใบตอบกลับ', status: 'MISSING', by: '—',                     date: null },
    ],
    timeline: [
        { at: '2569-07-16T08:10', tone: 'info',    title: 'รับผู้ป่วยส่งต่อ', by: 'เวชระเบียน',  note: '' },
        { at: '2569-07-16T14:30', tone: 'success', title: 'ให้บริการเสร็จสิ้น', by: 'ห้องผ่าตัด',  note: 'ผ่าตัดต้อกระจกสำเร็จ' },
        { at: '2569-08-06T08:00', tone: 'warning', title: 'ยังไม่ได้ส่งใบตอบกลับ', by: 'Rule Engine', note: 'ผ่านมา 21 วัน (กำหนด 15 วัน) — TSK-000156' },
    ],
    task_ids: ['TSK-000156'], owner: 'U-009', due_at: '2569-08-08T16:00', status: 'IN_SERVICE',
},

/* ─── ✅ รับเข้า: ครบถ้วน เรียกเก็บ สปสช. ตรง รับชำระครบ ─── */
{
    id: 'REF-IN-2569-0060', direction: 'IN', claim_id: null,
    hn: '00141903', an: 'AN690755',
    patient: 'นายธนา ประเสริฐศรี', age: 44, gender: 'M',
    nid_masked: '3-1061-xxxxx-12-6', fund: 'UC', right_no: 'UC69-0041903',
    partner_code: '10670', partner_name: 'โรงพยาบาลกลาง',
    partner_level: 'ทุติยภูมิ', partner_province: 'กรุงเทพมหานคร',
    dx: [{ code: 'K35.8', name: 'Acute appendicitis, other and unspecified', type: 'หลัก' }],
    proc_planned: [{ code: '47.09', name: 'Other appendectomy' }],
    proc_actual:  [{ code: '47.09', name: 'Other appendectomy', date: '2569-05-22' }],
    reason: 'EMERGENCY', urgency: 'URGENT', doctor: 'นพ.อนุชา ทวีสุข',
    refer_note: 'ไส้ติ่งอักเสบเฉียบพลัน ส่งมาผ่าตัดด่วน',
    letter_no: 'นส.10670/2569/0512', auth_no: 'UCS-69-003877', auth_type: 'CLOSE_RIGHT',
    auth_source: 'สปสช.', issued_at: '2569-05-22', expires_at: '2569-08-22',
    scope: 'IPD_ADMIT', scope_note: 'ผ่าตัดไส้ติ่งและรับไว้เป็นผู้ป่วยใน',
    visit_limit: 1, visit_used: 1, cap_amount: 48000,
    approver: 'ผอ.โรงพยาบาลกลาง', approved_at: '2569-05-22T03:40',
    refer_date: '2569-05-22', service_date_from: '2569-05-22', service_date_to: '2569-05-26',
    service_type: 'IPD', est_amount: 42600,
    reimbursable: true, reimburse_channel: 'NHSO_DIRECT',
    counter_received: false, counter_sent: true, counter_at: '2569-05-28',
    risk_score: 8, risk_flags: [],
    documents: [
        { name: 'ใบส่งตัวจากต้นทาง',     type: 'ใบส่งตัว',   status: 'FOUND', by: 'โรงพยาบาลกลาง', date: '2569-05-22' },
        { name: 'สำเนาบัตรประชาชน/สิทธิ', type: 'สิทธิ',      status: 'FOUND', by: 'ระบบ HIS',      date: '2569-05-22' },
        { name: 'Discharge Summary',     type: 'เวชระเบียน', status: 'FOUND', by: 'เวชระเบียน',    date: '2569-05-26' },
        { name: 'ใบตอบกลับที่ส่งให้ต้นทาง', type: 'ใบตอบกลับ', status: 'FOUND', by: 'เวชระเบียน',    date: '2569-05-28' },
        { name: 'หลักฐานการรับชำระ',     type: 'การเงิน',    status: 'FOUND', by: 'งานการเงิน',    date: '2569-07-10' },
    ],
    timeline: [
        { at: '2569-05-22T02:50', tone: 'info',    title: 'รับผู้ป่วยส่งต่อ',      by: 'ห้องฉุกเฉิน', note: 'จากโรงพยาบาลกลาง' },
        { at: '2569-05-28T10:00', tone: 'success', title: 'ส่งใบตอบกลับให้ต้นทาง',  by: 'เวชระเบียน',  note: '' },
        { at: '2569-06-05T09:00', tone: 'info',    title: 'ส่งเบิก สปสช. โดยตรง',  by: 'ระบบ',        note: 'RBL-2569-0031' },
        { at: '2569-07-10T15:20', tone: 'success', title: 'รับชำระครบถ้วน',        by: 'งานการเงิน',  note: '42,600 บาท' },
    ],
    task_ids: [], owner: 'U-005', due_at: null, status: 'PAID',
},
];


/* ══════════════════════════════════════════════════════════
   3. รายการประกอบที่สร้างจากสูตร — LCG seed คงที่
      ⚠️ seed ต่างจาก mock-claims.js (20690806) โดยตั้งใจ
         ถ้าใช้ seed เดียวกัน สองชุดข้อมูลจะสุ่มได้ค่าที่สัมพันธ์กันจนดูออก
      ⚠️ ห้าม Math.random — ตัวเลขบน dashboard จะเปลี่ยนทุกครั้งที่รีเฟรช
   ══════════════════════════════════════════════════════════ */
const MOCK_REFERRALS = (function buildReferrals() {

    let _s = 20690812;
    const rnd  = () => (_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const pick = a => a[Math.floor(rnd() * a.length)];
    const int  = (a, b) => a + Math.floor(rnd() * (b - a + 1));

    const FIRST_M = ['สมชาย', 'ประเสริฐ', 'วิรัตน์', 'ธีระ', 'สุพจน์', 'มานพ', 'ชูชาติ', 'อดิศักดิ์'];
    const FIRST_F = ['สมศรี', 'ประไพ', 'วันเพ็ญ', 'ลัดดา', 'สุกัญญา', 'พรทิพย์', 'อารีย์', 'นงลักษณ์'];
    const LAST    = ['ใจซื่อ', 'บุญมาก', 'รุ่งเรือง', 'สมบูรณ์', 'ทองดี', 'แสงจันทร์', 'พัฒนา', 'ยิ่งยง',
                     'ศรีสมบัติ', 'วัฒนกุล', 'อินทร์ทอง', 'ชูเกียรติ'];

    /* โรคที่มักถูกส่งต่อจริง — คุมให้ตัวอักษรแรกกระจายครบกลุ่มใน REFER_DX_GROUP */
    const DX_POOL = [
        { code: 'I25.1', name: 'Atherosclerotic heart disease',                 scope: 'PROC',       amt: [120000, 260000] },
        { code: 'I63.9', name: 'Cerebral infarction, unspecified',              scope: 'IPD_ADMIT',  amt: [80000, 190000] },
        { code: 'C34.9', name: 'Malignant neoplasm of bronchus and lung',       scope: 'OPD_COURSE', amt: [90000, 240000] },
        { code: 'C18.9', name: 'Malignant neoplasm of colon, unspecified',      scope: 'PROC',       amt: [110000, 230000] },
        { code: 'N18.5', name: 'Chronic kidney disease, stage 5',               scope: 'OPD_COURSE', amt: [60000, 140000] },
        { code: 'G40.9', name: 'Epilepsy, unspecified',                         scope: 'DIAG',       amt: [12000, 38000] },
        { code: 'S72.0', name: 'Fracture of neck of femur',                     scope: 'PROC',       amt: [55000, 120000] },
        { code: 'H25.9', name: 'Age-related cataract, unspecified',             scope: 'PROC',       amt: [18000, 32000] },
        { code: 'K80.2', name: 'Calculus of gallbladder without cholecystitis', scope: 'PROC',       amt: [42000, 88000] },
        { code: 'E11.2', name: 'Type 2 diabetes mellitus with kidney complications', scope: 'OPD_COURSE', amt: [24000, 66000] },
        { code: 'J44.9', name: 'Chronic obstructive pulmonary disease',         scope: 'IPD_ADMIT',  amt: [35000, 95000] },
        { code: 'M17.9', name: 'Gonarthrosis, unspecified',                     scope: 'PROC',       amt: [95000, 180000] },
    ];

    const REASONS  = ['OVER_CAP', 'OVER_CAP', 'OVER_CAP', 'EQUIP', 'EQUIP', 'APPOINT', 'APPOINT', 'EMERGENCY', 'PATIENT'];
    const FUNDS    = ['UC', 'UC', 'UC', 'OFC', 'OFC', 'SSS', 'LGO'];
    const OWNERS   = ['U-004', 'U-005', 'U-007', 'U-009'];
    const DOCTORS  = ['นพ.ธนกฤต วงศ์สถาพร', 'นพ.ปิยะ ศรีสุวรรณ', 'นพ.สุรชัย มั่นคง',
                      'พญ.กมลชนก แสงเพชร', 'นพ.อนุชา ทวีสุข', 'นพ.กิตติ ชัยวัฒน์'];

    /**
     * สถานะสัมพันธ์กับอายุของรายการ — รายการเก่าย่อมเดินไปถึงขั้นจ่ายเงินแล้ว
     * ผลพลอยได้ที่สำคัญ: งวดเก่าจึงมีใบเรียกเก็บเสมอ กราฟ AP/AR 6 งวดจึงไม่มีแท่งว่าง
     */
    const STATUS_BY_AGE = {
        OUT: { old: ['SETTLED', 'SETTLED', 'BILL_RECV'],
               mid: ['BILL_RECV', 'IN_SERVICE', 'SETTLED'],
               now: ['WAIT_APPR', 'APPROVED', 'IN_SERVICE'] },
        IN:  { old: ['PAID', 'PAID', 'BILLED'],
               mid: ['BILLED', 'IN_SERVICE', 'PAID'],
               now: ['RECEIVED', 'DOC_CHECK', 'IN_SERVICE'] },
    };
    const ageBand = m => (m <= '03' ? 'old' : m <= '06' ? 'mid' : 'now');

    /**
     * เดือนที่ขอส่งต่อ — เริ่ม ม.ค. เพราะใบเรียกเก็บมาหลังให้บริการเสร็จเสมอ
     * ถ้าข้อมูลเริ่มเดือนเดียวกับที่กราฟเริ่ม งวดแรกของกราฟ AP/AR จะว่างเสมอ
     * ⚠️ ความยาวต้องเป็นเลขคี่ ไม่งั้น i%len จะล็อกพาริตีกับ i%2 (ทิศทาง)
     *    แล้วทิศทางหนึ่งจะไม่มีข้อมูลในบางเดือนเลย
     */
    const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '06'];

    const gen = [];
    for (let i = 0; i < 40; i++) {
        const isOut  = i % 2 === 0;
        const dir    = isOut ? 'OUT' : 'IN';
        const male   = rnd() < 0.48;
        const dx     = pick(DX_POOL);
        const reason = pick(REASONS);
        const fund   = pick(FUNDS);
        const month  = MONTHS[i % MONTHS.length];
        const day    = int(2, 26);
        const rdate  = `2569-${month}-${String(day).padStart(2, '0')}`;
        const est    = Math.round(int(dx.amt[0], dx.amt[1]) / 100) * 100;
        const status = pick(STATUS_BY_AGE[dir][ageBand(month)]);
        const approved = !['WAIT_APPR', 'DRAFT'].includes(status);

        /* ปลายทาง = โรงพยาบาลภายนอก · ต้นทาง = หน่วยบริการของเราเอง (NHSO_PROVIDERS) */
        const partner = isOut
            ? pick(MOCK_REFER_PROVIDERS)
            : pick(window.NHSO_PROVIDERS || [{ name: 'หน่วยบริการปฐมภูมิ', code: '00000' }]);

        const svcFrom = `2569-${month}-${String(Math.min(day + 3, 28)).padStart(2, '0')}`;
        const svcTo   = `2569-${month}-${String(Math.min(day + 9, 28)).padStart(2, '0')}`;
        const served  = !['WAIT_APPR', 'APPROVED', 'RECEIVED', 'DOC_CHECK'].includes(status);

        const seq = String(70 + i * 3).padStart(4, '0');

        gen.push({
            id: `REF-${dir}-2569-${seq}`, direction: dir, claim_id: null,
            hn: String(100000 + int(10000, 89999)),
            an: dx.scope === 'IPD_ADMIT' ? 'AN6907' + String(int(10, 99)) : null,
            patient: (male ? 'นาย' : 'นาง') + pick(male ? FIRST_M : FIRST_F) + ' ' + pick(LAST),
            age: int(21, 84), gender: male ? 'M' : 'F',
            nid_masked: `${int(1, 3)}-10${int(10, 99)}-xxxxx-${int(10, 99)}-${int(0, 9)}`,
            fund, right_no: `${fund}69-00${int(10000, 99999)}`,
            partner_code: partner.code, partner_name: partner.name,
            partner_level: partner.level || 'ปฐมภูมิ',
            partner_province: partner.province || 'กรุงเทพมหานคร',
            dx: [{ code: dx.code, name: dx.name, type: 'หลัก' }],
            proc_planned: [], proc_actual: [],
            reason, urgency: reason === 'EMERGENCY' ? 'EMERGENCY' : (rnd() < 0.4 ? 'URGENT' : 'ELECTIVE'),
            doctor: pick(DOCTORS),
            refer_note: '',
            letter_no: approved ? `นส.${partner.code}/2569/${String(int(100, 899))}` : null,
            auth_no:   approved ? (fund === 'OFC' ? `OFC-69-${int(100000, 999999)}` : `UCS-69-${String(int(1000, 9999)).padStart(6, '0')}`) : null,
            auth_type: approved ? (fund === 'OFC' ? 'APPROVE_CODE' : 'CLOSE_RIGHT') : null,
            auth_source: approved ? (fund === 'OFC' ? 'กรมบัญชีกลาง' : 'สปสช.') : null,
            issued_at:  approved ? rdate : null,
            expires_at: approved ? `2569-${String(Math.min(+month + 3, 12)).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null,
            scope: dx.scope, scope_note: dx.name,
            visit_limit: int(1, 6), visit_used: served ? int(1, 4) : 0,
            cap_amount: Math.round(est * 1.15 / 1000) * 1000,
            approver: approved ? 'พญ.สุนิสา เจริญพงศ์' : null,
            approved_at: approved ? rdate + 'T10:00' : null,
            refer_date: rdate,
            service_date_from: served ? svcFrom : null,
            service_date_to:   served ? svcTo   : null,
            service_type: dx.scope === 'IPD_ADMIT' ? 'IPD' : 'OPD',
            est_amount: est,
            reimbursable: rnd() < 0.6,
            reimburse_channel: isOut ? 'FUND_CENTRAL' : (rnd() < 0.55 ? 'ORIGIN_HOSPITAL' : 'NHSO_DIRECT'),
            counter_received: isOut ? served && rnd() < 0.7 : false,
            counter_sent:     isOut ? false : served && rnd() < 0.75,
            counter_at: null,
            risk_score: int(6, 48),
            risk_flags: [],
            documents: [
                { name: isOut ? 'ใบส่งตัวผู้ป่วย' : 'ใบส่งตัวจากต้นทาง', type: 'ใบส่งตัว',
                  status: approved ? 'FOUND' : 'PENDING', by: approved ? partner.name : '—',
                  date: approved ? rdate : null },
                { name: 'สำเนาบัตรประชาชน/สิทธิ', type: 'สิทธิ', status: 'FOUND', by: 'ระบบ HIS', date: rdate },
            ],
            timeline: [
                { at: rdate + 'T09:00', tone: 'info',
                  title: isOut ? 'บันทึกคำขอส่งต่อ' : 'รับผู้ป่วยส่งต่อ',
                  by: 'เวชระเบียน', note: '' },
                ...(approved ? [{ at: rdate + 'T10:00', tone: 'success',
                  title: isOut ? 'อนุมัติและออกใบส่งตัว' : 'ตรวจใบส่งตัวผ่าน',
                  by: 'พญ.สุนิสา เจริญพงศ์', note: '' }] : []),
            ],
            task_ids: [], owner: pick(OWNERS),
            due_at: ['SETTLED', 'PAID'].includes(status) ? null
                  : `2569-08-${String(int(6, 25)).padStart(2, '0')}T16:00`,
            status,
        });
    }

    return [...MOCK_REFERRALS_SEED, ...gen];
})();


/* ══════════════════════════════════════════════════════════
   4. ใบเรียกเก็บ / ใบแจ้งหนี้
      OUT → ปลายทางเรียกเก็บมาที่เรา (AP — เราตามจ่าย)
      IN  → เราออกไปเรียกเก็บ        (AR — เรารับชำระ)
   ══════════════════════════════════════════════════════════ */
const MOCK_REFER_BILLS = (function buildBills() {

    let _s = 20690901;
    const rnd = () => (_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));

    const seed = [
        /* ⭐ ใบของเคสหลัก — มีรายการนอกขอบเขต 2 บรรทัด */
        {
            id: 'RBL-2569-0011', refer_id: 'REF-OUT-2569-0007', direction: 'OUT',
            bill_no: 'RV/2569/07-0884', bill_date: '2569-07-30',
            received_at: '2569-07-31', sent_at: null,
            due_at: '2569-08-30', filing_deadline: '2569-09-28',
            channel: 'DEST_HOSPITAL',
            items: [
                { code: '39.95', name: 'ฟอกเลือดด้วยเครื่องไตเทียม (12 ครั้ง ในขอบเขต)', qty: 12, unit_price: 1800, amount: 21600, in_scope: true,  note: '' },
                { code: '39.95', name: 'ฟอกเลือดด้วยเครื่องไตเทียม (3 ครั้งเกินโควตา)',   qty: 3,  unit_price: 1800, amount: 5400,  in_scope: false, note: 'เกินจำนวนครั้งที่อนุมัติ (12 ครั้ง)' },
                { code: '54.98', name: 'CAPD — ล้างไตทางช่องท้อง',                        qty: 1,  unit_price: 38000, amount: 38000, in_scope: false, note: 'นอกขอบเขตใบส่งตัว' },
                { code: 'DRUG',  name: 'ยาและเวชภัณฑ์',                                   qty: 1,  unit_price: 46200, amount: 46200, in_scope: true,  note: '' },
                { code: 'ROOM',  name: 'ค่าห้องและค่าบริการพยาบาล',                        qty: 1,  unit_price: 36800, amount: 36800, in_scope: true,  note: '' },
            ],
            approved_amount: 0, disputed_amount: 0, paid_amount: 0,
            status: 'VERIFYING', verify_notes: '', verified_by: null, verified_at: null,
            dispute_reason: null, nhso_claim_id: null,
        },
        /* ✅ ใบที่จ่ายจบแล้ว */
        {
            id: 'RBL-2569-0006', refer_id: 'REF-OUT-2569-0021', direction: 'OUT',
            bill_no: 'NCI/2569/07-0142', bill_date: '2569-07-06',
            received_at: '2569-07-08', sent_at: null,
            due_at: '2569-08-06', filing_deadline: '2569-09-04',
            channel: 'DEST_HOSPITAL',
            items: [
                { code: '85.43', name: 'ผ่าตัดเต้านมแบบ Radical mastectomy', qty: 1, unit_price: 128000, amount: 128000, in_scope: true, note: '' },
                { code: 'DRUG',  name: 'ยาเคมีบำบัดและเวชภัณฑ์',            qty: 1, unit_price: 52400,  amount: 52400,  in_scope: true, note: '' },
                { code: 'ROOM',  name: 'ค่าห้องผู้ป่วยใน 9 วัน',            qty: 9, unit_price: 2889,   amount: 26000,  in_scope: true, note: '' },
            ],
            approved_amount: 206400, disputed_amount: 0, paid_amount: 206400,
            status: 'PAID', verify_notes: 'ตรวจครบถ้วน อยู่ในวงเงินและขอบเขต',
            verified_by: 'U-007', verified_at: '2569-07-14T10:30',
            dispute_reason: null, nhso_claim_id: null,
        },
        /* ⭐ ใบที่ทำให้เกิดการเรียกเก็บซ้ำซ้อน */
        {
            id: 'RBL-2569-0022', refer_id: 'REF-IN-2569-0044', direction: 'IN',
            bill_no: 'MC/2569/07-0022', bill_date: '2569-07-02',
            received_at: null, sent_at: '2569-07-02',
            due_at: '2569-08-01', filing_deadline: '2569-08-25',
            channel: 'ORIGIN_HOSPITAL',
            items: [
                { code: '96.04', name: 'ใส่ท่อช่วยหายใจและดูแลทางเดินหายใจ', qty: 1, unit_price: 18500, amount: 18500, in_scope: true, note: '' },
                { code: 'ROOM',  name: 'ค่าห้องผู้ป่วยใน 9 วัน',            qty: 9, unit_price: 3200,  amount: 28800, in_scope: true, note: '' },
                { code: 'DRUG',  name: 'ยาปฏิชีวนะและเวชภัณฑ์',            qty: 1, unit_price: 27200, amount: 27200, in_scope: true, note: '' },
            ],
            approved_amount: 0, disputed_amount: 0, paid_amount: 0,
            status: 'OVERDUE', verify_notes: '', verified_by: null, verified_at: null,
            dispute_reason: null,
            nhso_claim_id: 'CLM-2569-0055',      /* ⭐ มีทั้งเรียกเก็บต้นทางและส่งเบิก สปสช. */
        },
        /* ใบที่ส่งเบิก สปสช. ตรงและรับชำระครบ */
        {
            id: 'RBL-2569-0031', refer_id: 'REF-IN-2569-0060', direction: 'IN',
            bill_no: 'MC/2569/06-0031', bill_date: '2569-06-05',
            received_at: null, sent_at: '2569-06-05',
            due_at: '2569-07-05', filing_deadline: '2569-07-25',
            channel: 'NHSO_DIRECT',
            items: [
                { code: '47.09', name: 'ผ่าตัดไส้ติ่ง',              qty: 1, unit_price: 24000, amount: 24000, in_scope: true, note: '' },
                { code: 'ROOM',  name: 'ค่าห้องผู้ป่วยใน 5 วัน',     qty: 5, unit_price: 2520,  amount: 12600, in_scope: true, note: '' },
                { code: 'DRUG',  name: 'ยาและเวชภัณฑ์',             qty: 1, unit_price: 6000,  amount: 6000,  in_scope: true, note: '' },
            ],
            approved_amount: 42600, disputed_amount: 0, paid_amount: 42600,
            status: 'PAID', verify_notes: '', verified_by: 'U-005', verified_at: '2569-07-10T15:20',
            dispute_reason: null, nhso_claim_id: null,
        },
        /* ใบของเคส C305 — ถูกตัดจ่ายบางส่วน */
        {
            id: 'RBL-2569-0027', refer_id: 'REF-IN-2569-0051', direction: 'IN',
            bill_no: 'MC/2569/07-0027', bill_date: '2569-07-18',
            received_at: null, sent_at: '2569-07-18',
            due_at: '2569-08-17', filing_deadline: '2569-09-11',
            channel: 'NHSO_DIRECT',
            items: [
                { code: '45.13', name: 'ส่องกล้องทางเดินอาหารส่วนบน', qty: 1, unit_price: 3800, amount: 3800, in_scope: true, note: '' },
                { code: 'DRUG',  name: 'ยาและเวชภัณฑ์',              qty: 1, unit_price: 1440, amount: 1440, in_scope: true, note: '' },
            ],
            approved_amount: 3380, disputed_amount: 1860, paid_amount: 3380,
            status: 'PARTIAL', verify_notes: 'สปสช. ตัดจ่าย 1,860 บาท ด้วยรหัส C305',
            verified_by: 'U-009', verified_at: '2569-07-30T14:22',
            dispute_reason: 'Approve Code (OFC) ไม่ตรงฐานข้อมูลหน่วยบริการ', nhso_claim_id: 'CLM-2569-0007',
        },
    ];

    /* บวกวันบนสตริง พ.ศ. — MockFmt.toDate แปลงเป็น ค.ศ. ให้แล้ว */
    const TODAY_S = '2569-08-06';
    const addDays = (bs, n) => {
        const d = MockFmt.toDate(bs); if (!d) return bs;
        d.setDate(d.getDate() + n);
        return `${d.getFullYear() + 543}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    /* ใบเรียกเก็บออกหลังให้บริการเสร็จ 8–28 วัน แต่ต้องไม่เกินวันนี้
       (ใบที่ "ได้รับแล้ว" ลงวันที่ในอนาคตไม่ได้ — และการ clamp ทำให้งวดล่าสุดมีข้อมูลด้วย) */
    const billDate = base => { const s = addDays(base, int(8, 28)); return s > TODAY_S ? TODAY_S : s; };

    /* ใบประกอบสำหรับรายการที่ generate มา — เฉพาะที่สถานะบอกว่ามีใบแล้ว */
    const HAS_BILL = { BILL_RECV: 1, SETTLED: 1, BILLED: 1, PAID: 1 };
    const gen = [];
    let n = 40;

    MOCK_REFERRALS.forEach(r => {
        if (!HAS_BILL[r.status]) return;
        if (seed.some(b => b.refer_id === r.id)) return;

        const isOut  = r.direction === 'OUT';
        const total  = Math.round(r.est_amount * (0.88 + rnd() * 0.2) / 100) * 100;
        const done   = r.status === 'SETTLED' || r.status === 'PAID';
        const svcEnd = r.service_date_to || r.refer_date || '2569-06-01';
        const bdate  = billDate(svcEnd);
        const bmonth = bdate.slice(5, 7);

        gen.push({
            id: `RBL-2569-${String(n++).padStart(4, '0')}`,
            refer_id: r.id, direction: r.direction,
            bill_no: `${isOut ? 'EXT' : 'MC'}/2569/${bmonth}-${String(int(100, 899))}`,
            bill_date: bdate,
            received_at: isOut ? bdate : null,
            sent_at:     isOut ? null  : bdate,
            due_at: addDays(bdate, 30),
            filing_deadline: addDays(svcEnd, 60),
            channel: isOut ? 'DEST_HOSPITAL' : (r.reimburse_channel || 'ORIGIN_HOSPITAL'),
            items: [
                { code: 'SVC',  name: 'ค่าบริการทางการแพทย์', qty: 1, unit_price: Math.round(total * 0.62), amount: Math.round(total * 0.62), in_scope: true, note: '' },
                { code: 'DRUG', name: 'ยาและเวชภัณฑ์',       qty: 1, unit_price: Math.round(total * 0.23), amount: Math.round(total * 0.23), in_scope: true, note: '' },
                { code: 'ROOM', name: 'ค่าห้องและค่าบริการ',  qty: 1, unit_price: Math.round(total * 0.15), amount: Math.round(total * 0.15), in_scope: true, note: '' },
            ],
            approved_amount: done ? total : 0,
            disputed_amount: 0,
            paid_amount:     done ? total : 0,
            status: done ? 'PAID' : (isOut ? 'RECEIVED' : 'SENT'),
            verify_notes: '', verified_by: done ? r.owner : null,
            verified_at: done ? addDays(bdate, 4) + 'T14:00' : null,
            dispute_reason: null, nhso_claim_id: null,
        });

        /* ยื่นเรียกเก็บเป็นงวด — เกิดขึ้นจริงเมื่อการรักษายาวข้ามงวด
           (นี่คือเหตุผลที่ใบเรียกเก็บต้องแยกตาราง 1 การส่งต่อ → N ใบ) */
        if (rnd() < 0.38) {
            const b2date = billDate(addDays(svcEnd, 26));
            const part   = Math.round(total * (0.28 + rnd() * 0.2) / 100) * 100;
            gen.push({
                id: `RBL-2569-${String(n++).padStart(4, '0')}`,
                refer_id: r.id, direction: r.direction,
                bill_no: `${isOut ? 'EXT' : 'MC'}/2569/${b2date.slice(5, 7)}-${String(int(100, 899))}`,
                bill_date: b2date,
                received_at: isOut ? b2date : null,
                sent_at:     isOut ? null   : b2date,
                due_at: addDays(b2date, 30),
                filing_deadline: addDays(svcEnd, 60),
                channel: isOut ? 'DEST_HOSPITAL' : (r.reimburse_channel || 'ORIGIN_HOSPITAL'),
                items: [
                    { code: 'SVC',  name: 'ค่าบริการต่อเนื่อง (งวดที่ 2)', qty: 1, unit_price: Math.round(part * 0.7), amount: Math.round(part * 0.7), in_scope: true, note: '' },
                    { code: 'DRUG', name: 'ยาและเวชภัณฑ์ (งวดที่ 2)',      qty: 1, unit_price: Math.round(part * 0.3), amount: Math.round(part * 0.3), in_scope: true, note: '' },
                ],
                approved_amount: done ? part : 0,
                disputed_amount: 0,
                paid_amount:     done ? part : 0,
                status: done ? 'PAID' : (isOut ? 'RECEIVED' : 'SENT'),
                verify_notes: '', verified_by: done ? r.owner : null,
                verified_at: done ? addDays(b2date, 4) + 'T14:00' : null,
                dispute_reason: null, nhso_claim_id: null,
            });
        }
    });

    return [...seed, ...gen];
})();


/* ══════════════════════════════════════════════════════════
   5. MockRefer — ตัวช่วยที่ทุกหน้าต้องเรียก ห้ามคำนวณซ้ำเอง
      ทุกยอดเงินคำนวณที่นี่ที่เดียว ตัวเลขทุกหน้าจึงกระทบยอดกันได้
   ══════════════════════════════════════════════════════════ */
const MockRefer = {

    all()     { return MockDB.all('referrals'); },
    byId(id)  { return MockDB.byId('referrals', id); },
    out()     { return this.all().filter(r => r.direction === 'OUT'); },
    inbound() { return this.all().filter(r => r.direction === 'IN'); },
    byDir(d)  { return d ? this.all().filter(r => r.direction === d) : this.all(); },

    allBills()          { return MockDB.all('refer_bills'); },
    bills(referId)      { return this.allBills().filter(b => b.refer_id === referId); },
    billById(id)        { return MockDB.byId('refer_bills', id); },
    billsByDir(d)       { return d ? this.allBills().filter(b => b.direction === d) : this.allBills(); },

    /* ── ยอดเงิน — derive ทั้งหมด ไม่มีตัวไหนเก็บใน seed ── */
    billTotal(b)   { return (b.items || []).reduce((a, it) => a + (Number(it.amount) || 0), 0); },
    billOutstand(b) { return Math.max(0, this.billTotal(b) - (b.paid_amount || 0) - (b.disputed_amount || 0)); },
    billOutOfScope(b) { return (b.items || []).filter(it => it.in_scope === false)
                            .reduce((a, it) => a + (Number(it.amount) || 0), 0); },

    sumBilled(r)   { return this.bills(r.id).reduce((a, b) => a + this.billTotal(b), 0); },
    sumPaid(r)     { return this.bills(r.id).reduce((a, b) => a + (b.paid_amount || 0), 0); },
    sumDisputed(r) { return this.bills(r.id).reduce((a, b) => a + (b.disputed_amount || 0), 0); },
    outstanding(r) { return this.bills(r.id).reduce((a, b) => a + this.billOutstand(b), 0); },
    amountAtRisk(r) { return (r.risk_flags || []).reduce((a, f) => a + (Number(f.amount_at_risk) || 0), 0); },

    /** สถานะสุทธิ — คำถามแรกของผู้บริหารเสมอ */
    netPosition() {
        const ap = this.allBills().filter(b => b.direction === 'OUT')
                       .reduce((a, b) => a + this.billOutstand(b), 0);
        const ar = this.allBills().filter(b => b.direction === 'IN')
                       .reduce((a, b) => a + this.billOutstand(b), 0);
        return { ap, ar, net: ar - ap };
    },

    /* ── ธงความเสี่ยง ── */
    flags(r)     { return r.risk_flags || []; },
    hasError(r)  { return this.flags(r).some(f => f.level === 'ERROR'); },
    errorFlags(r) { return this.flags(r).filter(f => f.level === 'ERROR'); },
    /** รายการที่ยังมีธงระดับ ERROR ค้าง — ตัวเลขนี้ต้องตรงกันทุกหน้า */
    openRisks()  { return this.all().filter(r => this.hasError(r)); },
    riskCount(code) { return this.all().filter(r => this.flags(r).some(f => f.code === code)).length; },
    riskPareto() {
        const m = {};
        this.all().forEach(r => this.flags(r).forEach(f => {
            m[f.code] = m[f.code] || { code: f.code, label: f.label, level: f.level, count: 0, amount: 0 };
            m[f.code].count++;
            m[f.code].amount += Number(f.amount_at_risk) || 0;
        }));
        return Object.values(m).sort((a, b) => b.count - a.count);
    },

    unbilled()     { return this.all().filter(r => this.flags(r).some(f => f.code === 'REF-UNBILLED')); },
    doubleBilled() { return this.all().filter(r => this.flags(r).some(f => f.code === 'REF-DUP')); },
    overdueFiling() { return this.all().filter(r => this.flags(r).some(f => f.code === 'REF-LATE')); },

    /** รายการที่ปิดจบแล้ว — ใบส่งตัวหมดอายุหลังจากนี้ไม่เป็นปัญหาอีก */
    isClosed(r) { return ['SETTLED', 'PAID', 'REJECTED', 'RETURNED'].includes(r.status); },

    /**
     * ใบส่งตัวที่หมดอายุแล้วหรือใกล้หมดภายใน N วัน
     * ⚠️ นับเฉพาะรายการที่ยังเปิดอยู่ — ถ้านับรวมรายการที่จ่ายจบแล้ว
     *    ตัวเลข KPI จะพองจนไม่ตรงกับจำนวนธง REF-EXPIRED ที่ผู้ใช้เห็นในตาราง
     */
    expiringSoon(days) {
        const lim = days == null ? 7 : days;
        return this.all().filter(r => {
            if (this.isClosed(r) || !r.expires_at) return false;
            const d = MockFmt.toDate(r.expires_at); if (!d) return false;
            return (d - MockDB.TODAY) / 864e5 <= lim;
        });
    },

    /** อัตราใบส่งตัวสมบูรณ์ — ไม่มีธง ERROR ค้าง */
    docCompletionRate() {
        const all = this.all(); if (!all.length) return 0;
        return ((all.length - this.openRisks().length) / all.length) * 100;
    },

    /* ── ชุดข้อมูลกราฟ ── */

    /** ส่งไปที่ไหน — ผลรวมเท่ากับจำนวนรายการของทิศทางที่กรอง */
    byPartner(dir) {
        const m = {};
        this.byDir(dir).forEach(r => {
            const k = r.partner_code || '—';
            m[k] = m[k] || { code: k, name: r.partner_name, level: r.partner_level, count: 0, amount: 0, paid: 0 };
            m[k].count++;
            m[k].amount += this.sumBilled(r) || r.est_amount || 0;
            m[k].paid   += this.sumPaid(r);
        });
        const prov = {};
        MOCK_REFER_PROVIDERS.forEach(p => prov[p.code] = p);
        return Object.values(m)
            .map(x => ({ ...x, mou: prov[x.code] ? prov[x.code].mou : null,
                         avg_settle_days: prov[x.code] ? prov[x.code].avg_settle_days : null }))
            .sort((a, b) => b.count - a.count);
    },

    /**
     * รายการโรค — ⚠️ นับจาก dx[0] (Dx หลัก) เท่านั้น
     * ถ้านับทั้งอาร์เรย์ ผลรวมจะไม่เท่ากับจำนวนรายการ แล้วตารางกับ donut จะขัดกันเอง
     */
    byDx(dir) {
        const m = {};
        this.byDir(dir).forEach(r => {
            const d = (r.dx || [])[0]; if (!d) return;
            m[d.code] = m[d.code] || { code: d.code, name: d.name, count: 0, amount: 0, partners: {} };
            m[d.code].count++;
            m[d.code].amount += this.sumBilled(r) || r.est_amount || 0;
            m[d.code].partners[r.partner_name] = (m[d.code].partners[r.partner_name] || 0) + 1;
        });
        return Object.values(m).map(x => {
            const top = Object.entries(x.partners).sort((a, b) => b[1] - a[1])[0];
            return { ...x, top_partner: top ? top[0] : '—' };
        }).sort((a, b) => b.count - a.count);
    },

    byDxGroup(dir) {
        const m = {};
        this.byDir(dir).forEach(r => {
            const d = (r.dx || [])[0]; if (!d) return;
            const g = REFER_DX_GROUP[String(d.code)[0]] || 'อื่น ๆ';
            m[g] = (m[g] || 0) + 1;
        });
        return Object.entries(m).map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value);
    },

    byReason(dir) {
        const m = {};
        this.byDir(dir).forEach(r => { m[r.reason] = (m[r.reason] || 0) + 1; });
        return Object.entries(m).map(([k, value]) => ({
            key: k, label: (REFER_REASON[k] || {}).label || k, value,
        })).sort((a, b) => b.value - a.value);
    },

    /** AP vs AR รายงวด 6 เดือน — อิงเดือนของ bill_date */
    monthlyMoney() {
        const months = ['03', '04', '05', '06', '07', '08'];
        const rows = months.map(m => ({
            key: m, label: MockFmt.MONTHS[+m - 1] + '69', ap: 0, ar: 0,
        }));
        this.allBills().forEach(b => {
            const m = String(b.bill_date || '').slice(5, 7);
            const row = rows.find(x => x.key === m); if (!row) return;
            if (b.direction === 'OUT') row.ap += this.billTotal(b);
            else                       row.ar += this.billTotal(b);
        });
        return rows;
    },

    /** อายุหนี้ — นับจากวันที่รับ/ส่งใบ เฉพาะใบที่ยังค้าง */
    agingBuckets(dir) {
        const out = [
            { key: '0-30',  label: '0–30 วัน',  count: 0, amount: 0 },
            { key: '31-60', label: '31–60 วัน', count: 0, amount: 0 },
            { key: '61-90', label: '61–90 วัน', count: 0, amount: 0 },
            { key: '90+',   label: '90+ วัน',   count: 0, amount: 0 },
        ];
        this.billsByDir(dir).forEach(b => {
            const rest = this.billOutstand(b); if (rest <= 0) return;
            const days = this.billAge(b);
            const slot = days <= 30 ? out[0] : days <= 60 ? out[1] : days <= 90 ? out[2] : out[3];
            slot.count++; slot.amount += rest;
        });
        return out;
    },

    billAge(b) {
        const base = b.direction === 'OUT' ? (b.received_at || b.bill_date) : (b.sent_at || b.bill_date);
        const d = MockFmt.toDate(base); if (!d) return 0;
        return Math.max(0, Math.round((MockDB.TODAY - d) / 864e5));
    },

    countByStatus(dir) {
        const m = {};
        this.byDir(dir).forEach(r => { m[r.status] = (m[r.status] || 0) + 1; });
        return m;
    },

    /* ── ป้ายกำกับ ── */
    dirMeta(d)      { return REFER_DIRECTION.find(x => x.key === d) || REFER_DIRECTION[0]; },
    dirLabel(r)     { return this.dirMeta(r.direction).label; },
    partnerLabel(r) { return this.dirMeta(r.direction).partnerLabel; },
    statusMeta(r)   { return (REFER_STATUS[r.direction] || {})[r.status] || { label: r.status, badge: 'kbadge-off' }; },
    statusHtml(r)   { const m = this.statusMeta(r);
                      return `<span class="kbadge ${m.badge}">${MockEsc(m.label)}</span>`; },
    billStatusHtml(b) { const m = REFER_BILL_STATUS[b.status] || { label: b.status, badge: 'kbadge-off' };
                        return `<span class="kbadge ${m.badge}">${MockEsc(m.label)}</span>`; },
    scopeLabel(r)   { return (REFER_SCOPE[r.scope] || {}).label || r.scope || '—'; },
    reasonMeta(r)   { return REFER_REASON[r.reason] || { label: r.reason, chip: 'sip-chip-muted' }; },

    /* ── สรุปทางคลินิกและการตรวจทานก่อนขออนุมัติ ── */

    /** แพทย์ที่เกี่ยวข้อง — เจ้าของไข้กับผู้เขียนใบส่งต่ออาจเป็นคนละคน */
    doctorMeta(r) {
        const writer    = (r && r.doctor) || '';
        const attending = (r && r.attending_doctor) || writer;
        return {
            attending, writer, dept: (r && r.clinic_dept) || '',
            sameCoin: !!writer && attending === writer,
        };
    },

    /** คืนทุกหัวข้อพร้อมข้อความที่กรอกไว้ — หัวข้อที่ว่างก็ยังคืน เพื่อให้เห็นว่าขาดข้อไหน */
    reviewParts(r) {
        const c = (r && r.clinical_review) || {};
        return REFER_REVIEW_PARTS.map(p => ({ ...p, text: String(c[p.key] || '').trim() }));
    },

    reviewMissing(r)  { return this.reviewParts(r).filter(p => p.required && !p.text); },
    reviewComplete(r) { return this.reviewMissing(r).length === 0; },

    /** หมวดที่ดึงมาจาก HIS — ผู้อนุมัติต้องแยกออกว่าอะไรพิมพ์เอง อะไรระบบเติมให้ */
    reviewSources(r)  { return (r && r.review_sources) || []; },

    /** เจ้าหน้าที่ผู้ตรวจทานก่อนส่งขออนุมัติ — คือ maker ของ Maker–Checker (BR-05) */
    reviewer(r) {
        if (!r || !r.reviewed_by) return null;
        return {
            id:   r.reviewed_by,
            name: r.reviewer_name ||
                  (window.MockAdmin ? MockAdmin.userName(r.reviewed_by) : r.reviewed_by),
            at:   r.reviewed_at || null,
            note: r.review_note || '',
        };
    },

    /** ความพร้อมตามจ่าย 5 ขั้น — derive ล้วน ใช้ทำ .ds-stepper */
    readiness(r) {
        const flagged = c => this.flags(r).some(f => f.code === c);
        return [
            { label: 'มีใบส่งตัว',      ok: !!r.letter_no },
            { label: 'มีเลขอนุมัติ',     ok: !!r.auth_no },
            { label: 'ยังไม่หมดอายุ',    ok: !flagged('REF-EXPIRED') },
            { label: 'อยู่ในขอบเขต',     ok: !flagged('REF-SCOPE') },
            { label: 'ไม่เกินวงเงิน',    ok: !flagged('REF-OVERCAP') },
        ];
    },

    /* ── เกณฑ์ยกระดับไปผู้บริหาร (2 ชั้น) ── */

    /** วงเงินเกินเกณฑ์หรือไม่ — ตัวเดียวที่ทุกหน้าใช้ตัดสิน ห้ามเทียบตัวเลขเอง */
    needsExec(r)  { return !!r && r.direction === 'OUT'
                           && Number(r.cap_amount) > REFER_APPROVAL.EXEC_THRESHOLD; },
    /** ส่วนที่เกินเกณฑ์ — ใช้อธิบายผู้บริหารว่าทำไมเรื่องนี้ถึงมาถึงโต๊ะ */
    execExcess(r) { return Math.max(0, Number(r.cap_amount || 0) - REFER_APPROVAL.EXEC_THRESHOLD); },
    /** คิวที่รอผู้บริหารตัดสิน */
    execQueue()   { return this.all().filter(r => r.status === 'WAIT_EXEC'); },

    /** ผู้บริหารที่รับเรื่องได้ — หาโดย role ไม่ผูกรหัสผู้ใช้ และต้องไม่ใช่คนเดิม (BR-05) */
    execApprover(excludeId) {
        if (!window.MockAdmin) return null;
        const pool = MockAdmin.users().filter(u => u.active && u.id !== excludeId);
        const ex   = pool.find(u => (u.roles || []).some(x => REFER_APPROVAL.EXEC_ROLE.test(x)));
        return ex ? ex.id : null;
    },

    /** งานอนุมัติชั้นผู้บริหารที่ยังเปิดอยู่ของรายการนี้ */
    execTask(referId) {
        if (!window.MockTasks) return null;
        return MockTasks.forRefer(referId)
            .find(t => t.kind === 'APPROVE_REFER_EXEC' && t.status !== 'DONE') || null;
    },

    /* ── การกระทำในเดโม ── */

    /** ส่งขออนุมัติ — สร้าง task เข้ากล่องเดิมของ claim-tasks.html */
    requestApproval(id, opts) {
        const r = this.byId(id); if (!r || !window.MockTasks) return null;
        const o = opts || {};
        const t = MockTasks.create({
            kind: 'APPROVE_REFER',
            title: `อนุมัติการส่งต่อ ${r.patient} → ${r.partner_name}`,
            refer_id: r.id,
            owner: o.owner, dept: o.dept || 'งานประกันสุขภาพ',
            due_at: o.due_at || '2569-08-12T16:00',
            priority: o.priority || 'HIGH',
            detail: o.detail || `วงเงินที่ขอ ${MockFmt.baht(r.cap_amount)} บาท · ขอบเขต: ${this.scopeLabel(r)}`,
            checklist: [
                { text: 'ตรวจศักยภาพและความพร้อมของปลายทาง', done: false },
                { text: 'ตรวจวงเงินและอัตราตามจ่าย',          done: false },
                { text: 'ตรวจสิทธิและเลขอนุมัติ',             done: false },
                { text: 'อนุมัติและออกใบส่งตัว',              done: false },
            ],
        });
        MockDB.patch('referrals', id, { status: 'WAIT_APPR' });
        return t;
    },

    /**
     * ยกระดับไปผู้บริหาร — เรียกหลังเจ้าหน้าที่อนุมัติชั้นแรกแล้วแต่วงเงินเกินเกณฑ์
     * ยังไม่ออกเลขอนุมัติในขั้นนี้ เพราะเรื่องยังไม่จบ
     */
    escalateToExec(id, opts) {
        const r = this.byId(id); if (!r || !window.MockTasks) return null;
        const o     = opts || {};
        const owner = o.owner || this.execApprover(o.by);
        if (!owner) return null;

        const t = MockTasks.create({
            kind: 'APPROVE_REFER_EXEC',
            title: `อนุมัติวงเงินระดับผู้บริหาร ${r.patient} → ${r.partner_name}`,
            refer_id: r.id,
            owner, dept: o.dept || 'ฝ่ายบริหาร',
            due_at: o.due_at || '2569-08-14T16:00',
            priority: 'HIGH',
            detail: `วงเงิน ${MockFmt.baht(r.cap_amount)} บาท — เกินเกณฑ์ `
                  + `${MockFmt.baht(REFER_APPROVAL.EXEC_THRESHOLD)} บาท อยู่ `
                  + `${MockFmt.baht(this.execExcess(r))} บาท · ผ่านการอนุมัติชั้นเจ้าหน้าที่แล้ว`,
            checklist: [
                { text: 'ตรวจความจำเป็นทางคลินิกและทางเลือกที่ถูกกว่า', done: false },
                { text: 'ตรวจผลกระทบต่องบตามจ่ายของงวด',              done: false },
                { text: 'ตรวจว่าปลายทางเป็นคู่สัญญาและอัตราสมเหตุผล',   done: false },
                { text: 'อนุมัติวงเงินและออกใบส่งตัว',                 done: false },
            ],
        });

        MockDB.patch('referrals', id, {
            status: 'WAIT_EXEC',
            ops_approver: o.by || null,
            ops_approved_at: '2569-08-06T09:00',
            ops_approve_note: o.note || '',
        });
        return t;
    },

    /**
     * ผู้บริหารตัดสิน 1 รายการ — ใช้จากหน้าอนุมัติแบบหลายรายการ (exec-approve.js)
     * เดินเส้นทางเดียวกับ Tasks.decide() ทุกประการ: ปิดงาน + บันทึก Audit (BR-04)
     * แล้วค่อยให้ applyTaskDecision ออกเลขอนุมัติ — จะได้ไม่มี logic ซ้ำสองที่
     */
    execDecide(referId, approve, reason) {
        const t = this.execTask(referId); if (!t || !window.MockTasks) return null;
        const me = window.MockSession ? MockSession.userId() : t.owner;
        const at = '2569-08-06T09:00';

        MockDB.patch('tasks', t.id, {
            status: approve ? 'DONE' : 'RETURNED',
            overrides: [...(t.overrides || []), {
                at, by: me, role: window.MockSession ? MockSession.roleLabel() : 'ผู้บริหาร',
                reason, evidence: 'บันทึกจากหน้าอนุมัติวงเงินระดับผู้บริหาร', approver: me }],
            timeline: [...(t.timeline || []), {
                at, tone: approve ? 'success' : 'danger',
                title: approve ? 'ผู้บริหารอนุมัติ' : 'ผู้บริหารไม่อนุมัติ', by: me, note: reason }],
        });

        this.applyTaskDecision(MockDB.byId('tasks', t.id), approve, reason);
        return t;
    },

    /** ผลการตัดสินจาก claim-tasks.js — logic ทั้งหมดอยู่ที่นี่ ฝั่งนั้นจึงเรียกบรรทัดเดียว */
    applyTaskDecision(task, approve, reason) {
        const r = this.byId(task.refer_id); if (!r) return;
        const now = '2569-08-06T09:00';
        const by  = window.MockAdmin ? MockAdmin.userName(task.owner) : task.owner;

        /* ชั้นเจ้าหน้าที่อนุมัติผ่าน แต่วงเงินเกินเกณฑ์ → ยังไม่จบ ส่งต่อผู้บริหาร
           ⚠️ ต้องเช็คก่อนบล็อกออกเลขอนุมัติด้านล่าง ไม่งั้นเรื่องจะจบตั้งแต่ชั้นแรก */
        if (task.kind === 'APPROVE_REFER' && approve && this.needsExec(r)) {
            const t = this.escalateToExec(r.id, { by: task.owner, note: reason });
            MockDB.patch('referrals', r.id, {
                timeline: [...(this.byId(r.id).timeline || []), {
                    at: now, tone: 'warning', title: 'อนุมัติชั้นเจ้าหน้าที่ — ส่งต่อผู้บริหาร', by,
                    note: `วงเงิน ${MockFmt.baht(r.cap_amount)} บาท เกินเกณฑ์ `
                        + `${MockFmt.baht(REFER_APPROVAL.EXEC_THRESHOLD)} บาท`
                        + (t ? ` · ${t.id} ถึง ${MockAdmin.userName(t.owner)}` : '')
                        + (reason ? ` · ${reason}` : ''),
                }],
            });
            return;
        }

        if (task.kind === 'APPROVE_REFER' || task.kind === 'APPROVE_REFER_EXEC') {
            const isExec = task.kind === 'APPROVE_REFER_EXEC';
            if (approve) {
                const isOfc = r.fund === 'OFC';
                const num   = String(100000 + (String(r.id).length * 7919) % 899999);
                MockDB.patch('referrals', r.id, {
                    status: 'APPROVED',
                    letter_no:   r.letter_no || `นส.11812/2569/${String(400 + (num % 500))}`,
                    auth_no:     r.auth_no   || (isOfc ? `OFC-69-${num}` : `UCS-69-${num.slice(0, 6)}`),
                    auth_type:   isOfc ? 'APPROVE_CODE' : 'CLOSE_RIGHT',
                    auth_source: isOfc ? 'กรมบัญชีกลาง' : 'สปสช.',
                    issued_at:   '2569-08-06', expires_at: '2569-09-05',
                    approver: by, approved_at: now,
                    exec_approver: isExec ? by : (r.exec_approver || null),
                    timeline: [...(r.timeline || []), {
                        at: now, tone: 'success',
                        title: isExec ? 'ผู้บริหารอนุมัติวงเงิน — ออกใบส่งตัว' : 'อนุมัติและออกใบส่งตัว', by,
                        note: reason || `วงเงิน ${MockFmt.baht(r.cap_amount)} บาท · หมดอายุ 5 ก.ย. 2569`,
                    }],
                });
            } else {
                MockDB.patch('referrals', r.id, {
                    status: 'REJECTED',
                    timeline: [...(r.timeline || []), {
                        at: now, tone: 'danger',
                        title: isExec ? 'ผู้บริหารไม่อนุมัติวงเงิน' : 'ไม่อนุมัติการส่งต่อ',
                        by, note: reason || '',
                    }],
                });
            }
        }

        if (task.kind === 'VERIFY_BILL') {
            MockDB.patch('referrals', r.id, {
                timeline: [...(r.timeline || []), {
                    at: now, tone: approve ? 'success' : 'warning',
                    title: approve ? 'อนุมัติจ่ายใบเรียกเก็บ' : 'โต้แย้งใบเรียกเก็บ',
                    by, note: reason || '',
                }],
            });
        }
    },

    /** ตรวจใบเรียกเก็บรายบรรทัด — คืนยอดที่อนุมัติ/โต้แย้ง */
    verifyBill(billId, opts) {
        const b = this.billById(billId); if (!b) return null;
        const o = opts || {};
        const keep = new Set(o.approvedCodes || []);
        let approved = 0, disputed = 0;
        (b.items || []).forEach((it, i) => {
            const key = `${i}`;
            if (keep.size ? keep.has(key) : it.in_scope !== false) approved += Number(it.amount) || 0;
            else disputed += Number(it.amount) || 0;
        });
        MockDB.patch('refer_bills', billId, {
            approved_amount: approved,
            disputed_amount: disputed,
            status: disputed > 0 ? 'DISPUTED' : 'APPROVED',
            verify_notes: o.notes || '',
            verified_by: o.by || null,
            verified_at: '2569-08-06T09:00',
            dispute_reason: disputed > 0 ? (o.reason || 'รายการนอกขอบเขตใบส่งตัว') : null,
        });

        const r = this.byId(b.refer_id);
        if (r) MockDB.patch('referrals', r.id, {
            timeline: [...(r.timeline || []), {
                at: '2569-08-06T09:00',
                tone: disputed > 0 ? 'warning' : 'success',
                title: disputed > 0 ? 'โต้แย้งใบเรียกเก็บ' : 'อนุมัติจ่ายใบเรียกเก็บ',
                by: o.byName || 'งานการเงิน',
                note: `${b.id} · อนุมัติ ${MockFmt.baht(approved)} บาท` +
                      (disputed > 0 ? ` · โต้แย้ง ${MockFmt.baht(disputed)} บาท` : ''),
            }],
        });
        return { approved, disputed };
    },

    nextId(direction) {
        const n = this.byDir(direction).length + 1;
        return `REF-${direction}-2569-${String(900 + n).padStart(4, '0')}`;
    },
};

MockDB.register('referrals',   MOCK_REFERRALS);
MockDB.register('refer_bills', MOCK_REFER_BILLS);

window.MOCK_REFERRALS       = MOCK_REFERRALS;
window.MOCK_REFER_BILLS     = MOCK_REFER_BILLS;
window.MOCK_REFER_PROVIDERS = MOCK_REFER_PROVIDERS;
window.REFER_DIRECTION      = REFER_DIRECTION;
window.REFER_REASON         = REFER_REASON;
window.REFER_SCOPE          = REFER_SCOPE;
window.REFER_URGENCY        = REFER_URGENCY;
window.REFER_REVIEW_PARTS   = REFER_REVIEW_PARTS;
window.REFER_STATUS         = REFER_STATUS;
window.REFER_APPROVAL       = REFER_APPROVAL;
window.REFER_RISK           = REFER_RISK;
window.REFER_BILL_STATUS    = REFER_BILL_STATUS;
window.REFER_CHANNEL        = REFER_CHANNEL;
window.REFER_DX_GROUP       = REFER_DX_GROUP;
window.MockRefer            = MockRefer;
