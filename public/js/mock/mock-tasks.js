/**
 * MediCore RCM — MOCK TASKS (Workflow / SLA / Approval / Override)
 * ------------------------------------------------------------
 * SRS FR-07 · BR-04 (Override ต้องมีผู้ทำ เวลา เหตุผล หลักฐาน)
 *              BR-05 (กฎระงับส่ง/ผลสูง ต้องผ่าน Maker–Checker)
 *
 * ทุก task ผูกกับเคสด้วย claim_id หรือกับกฎด้วย rule_id — ห้ามลอยเดี่ยว
 */

const TASK_KINDS = [
    { key: 'FIX_CASE',     label: 'แก้ไขข้อมูลเคส',  icon: 'wrench' },
    { key: 'REVIEW_MED',   label: 'ตรวจทางการแพทย์', icon: 'stethoscope' },
    { key: 'REVIEW_FIN',   label: 'ตรวจการเงิน',     icon: 'wallet' },
    { key: 'APPROVE_RULE', label: 'อนุมัติกฎ',       icon: 'git-branch' },
    { key: 'OVERRIDE',     label: 'ขอ Override',     icon: 'shield-alert' },
    { key: 'DOC',          label: 'ขอเอกสารเพิ่มเติม', icon: 'paperclip' },
    /* งานฝั่งส่งต่อผู้ป่วย — ใช้กล่องงานและกลไก Maker–Checker เดิมทั้งหมด */
    { key: 'APPROVE_REFER', label: 'อนุมัติส่งต่อ/วงเงิน',  icon: 'ambulance' },
    { key: 'VERIFY_BILL',   label: 'ตรวจใบเรียกเก็บส่งต่อ', icon: 'receipt' },
];

const TASK_STATUS = {
    OPEN:      { label: 'รอดำเนินการ', badge: 'kbadge-pending' },
    ACK:       { label: 'รับงานแล้ว',   badge: 'kbadge-acked' },
    PROGRESS:  { label: 'กำลังทำ',      badge: 'kbadge-progress' },
    WAIT_INFO: { label: 'รอข้อมูลเพิ่ม', badge: 'kbadge-alert' },
    DONE:      { label: 'ปิดงานแล้ว',   badge: 'kbadge-done' },
    RETURNED:  { label: 'ตีกลับ',       badge: 'kbadge-alert' },
};

const TASK_PRIORITY = {
    HIGH:   { label: 'สูง',  chip: 'sip-chip-danger' },
    NORMAL: { label: 'ปกติ', chip: 'sip-chip-muted' },
    LOW:    { label: 'ต่ำ',  chip: 'sip-chip-muted' },
};

const MOCK_TASKS = [
    {
        id: 'TSK-000118', kind: 'FIX_CASE', title: 'แก้ราคายาให้ตรง Drug Catalogue (STDCODE 338139)',
        claim_id: 'CLM-2569-0042', rule_id: 'RUL-DRG-007',
        assigner: 'U-004', owner: 'U-009', dept: 'เวชระเบียน',
        created: '2569-07-28T09:32', due_at: '2569-08-07T16:00',
        status: 'PROGRESS', priority: 'HIGH', escalated: false,
        detail: 'ราคาที่บันทึกใน HIS 690 บาท/หน่วย สูงกว่า Drug Catalogue 420 บาท/หน่วย '
              + 'ถ้าส่งเบิกไปจะได้รหัส P124 กลับมา ให้แก้ที่ HIS แล้วยืนยันกลับ',
        checklist: [
            { text: 'ตรวจสอบราคาในตาราง Drug Catalogue ล่าสุด', done: true },
            { text: 'แก้ราคาในระบบ HIS',                        done: true },
            { text: 'แนบหลักฐานการแก้ไข',                        done: false },
            { text: 'ยืนยันกลับให้ Claim Officer',                done: false },
        ],
        timeline: [
            { at: '2569-07-28T09:32', tone: 'info',    title: 'มอบหมายงาน',   by: 'U-004', note: 'กำหนดเสร็จ 7 ส.ค. 2569' },
            { at: '2569-07-28T13:10', tone: '',        title: 'รับงาน',        by: 'U-009', note: '' },
            { at: '2569-08-05T10:20', tone: 'warning', title: 'ขอข้อมูลเพิ่ม', by: 'U-009', note: 'ขอตาราง Drug Catalogue ฉบับที่มีผล 20 ก.ค. 2569' },
            { at: '2569-08-05T14:02', tone: 'success', title: 'ได้รับข้อมูลแล้ว', by: 'U-004', note: 'ส่งลิงก์ DOC-NHSO-2569-012' },
        ],
        overrides: [],
    },
    {
        id: 'TSK-000091', kind: 'FIX_CASE', title: 'แก้ Approve Code (OFC) ให้ตรงฐานข้อมูล',
        claim_id: 'CLM-2569-0007', rule_id: 'RUL-ELG-004',
        assigner: 'U-004', owner: 'U-009', dept: 'เวชระเบียน',
        created: '2569-07-29T08:15', due_at: '2569-08-04T12:00',
        status: 'WAIT_INFO', priority: 'HIGH', escalated: true,
        detail: 'NHSO ตอบกลับ C305 — Approve Code (OFC) ที่บันทึก OFC-69-114872 '
              + 'ไม่ตรงกับฐานข้อมูลหน่วยบริการที่พบ OFC-69-114827 ต้องยืนยันเลขที่ถูกต้องกับกรมบัญชีกลาง',
        checklist: [
            { text: 'ตรวจสอบเลข Approve Code ในเอกสารต้นทาง', done: true },
            { text: 'ประสานกรมบัญชีกลางเพื่อยืนยันเลขที่ถูกต้อง', done: false },
            { text: 'แก้ไขใน HIS และส่งเบิกใหม่',              done: false },
        ],
        timeline: [
            { at: '2569-07-29T08:15', tone: 'info',    title: 'มอบหมายงาน',            by: 'U-004', note: '' },
            { at: '2569-07-29T09:00', tone: '',        title: 'รับงาน',                 by: 'U-009', note: '' },
            { at: '2569-08-04T12:01', tone: 'danger',  title: 'เกิน SLA — ยกระดับอัตโนมัติ', by: 'ระบบ',  note: 'แจ้งหัวหน้าหน่วยบริการต้นทาง' },
            { at: '2569-08-05T09:40', tone: 'warning', title: 'รอข้อมูลจากกรมบัญชีกลาง',   by: 'U-009', note: 'ส่งเรื่องแล้ว รอตอบกลับ' },
        ],
        overrides: [],
    },
    {
        id: 'TSK-000124', kind: 'REVIEW_MED', title: 'รับรองการใช้ยาปฏิชีวนะกลุ่มพิเศษ',
        claim_id: 'CLM-2569-0055', rule_id: 'RUL-CLN-011',
        assigner: 'U-004', owner: 'U-006', dept: 'องค์กรแพทย์',
        created: '2569-08-05T14:05', due_at: '2569-08-06T17:00',
        status: 'ACK', priority: 'HIGH', escalated: false,
        detail: 'ยาปฏิชีวนะฉีดกลุ่มพิเศษ มูลค่า 12,600 บาท ต้องมีความเห็นแพทย์ผู้เชี่ยวชาญ '
              + 'ประกอบก่อนส่งเบิกตามระเบียบภายใน ข้อ 5',
        checklist: [
            { text: 'ทบทวนข้อบ่งชี้ทางคลินิก',      done: true },
            { text: 'บันทึกความเห็นในเวชระเบียน',   done: false },
            { text: 'แนบใบความเห็นแพทย์ผู้เชี่ยวชาญ', done: false },
        ],
        timeline: [
            { at: '2569-08-05T14:05', tone: 'info', title: 'มอบหมายงาน', by: 'U-004', note: '' },
            { at: '2569-08-05T15:30', tone: '',     title: 'รับงาน',      by: 'U-006', note: '' },
        ],
        overrides: [{
            at: '2569-08-05T15:48', by: 'U-006', role: 'Medical Reviewer',
            reason: 'มีความเห็นแพทย์ผู้เชี่ยวชาญประกอบและข้อบ่งชี้ชัดเจน',
            evidence: 'ใบความเห็นแพทย์ผู้เชี่ยวชาญ (รอแนบไฟล์)', approver: 'U-008',
        }],
    },
    {
        id: 'TSK-000127', kind: 'FIX_CASE', title: 'เพิ่มรหัสหัตถการให้สอดคล้องกับการวินิจฉัย',
        claim_id: 'CLM-2569-0066', rule_id: 'RUL-CDX-009',
        assigner: 'U-004', owner: 'U-009', dept: 'เวชระเบียน',
        created: '2569-08-02T15:25', due_at: '2569-08-05T16:00',
        status: 'OPEN', priority: 'NORMAL', escalated: true,
        detail: 'Dx หลัก J45.9 กับ Proc 93.94 ยังไม่มีรหัสรองรับการเบิกยาพ่น ถ้าส่งจะได้ P061',
        checklist: [
            { text: 'ทบทวนรหัสหัตถการที่ถูกต้อง', done: false },
            { text: 'บันทึกเพิ่มในแฟ้ม 6',        done: false },
        ],
        timeline: [
            { at: '2569-08-02T15:25', tone: 'info',   title: 'มอบหมายงาน', by: 'U-004', note: '' },
            { at: '2569-08-05T16:01', tone: 'danger', title: 'เกิน SLA — ยกระดับอัตโนมัติ', by: 'ระบบ', note: '' },
        ],
        overrides: [],
    },
    {
        id: 'TSK-000131', kind: 'DOC', title: 'ขอข้อมูลแฟ้ม 9 (AER) ให้ครบ — เวลารับแจ้ง/จุดเกิดเหตุ',
        claim_id: 'CLM-2569-0071', rule_id: 'RUL-EMR-003',
        assigner: 'U-004', owner: 'U-006', dept: 'ห้องฉุกเฉิน',
        created: '2569-08-03T22:45', due_at: '2569-08-06T12:00',
        status: 'PROGRESS', priority: 'HIGH', escalated: false,
        detail: 'เคสอุบัติเหตุฉุกเฉินต้องมีแฟ้ม 9 (NHSO AER) ครบ — ขาดเวลารับแจ้งและพิกัดจุดเกิดเหตุ '
              + 'แบบบันทึกการรับส่งผู้ป่วยที่แนบมาอ่านไม่ออก',
        checklist: [
            { text: 'ติดต่อหน่วย EMS เพื่อขอแบบบันทึกฉบับชัดเจน', done: true },
            { text: 'บันทึกเวลารับแจ้งและพิกัดในระบบ',           done: false },
        ],
        timeline: [
            { at: '2569-08-03T22:45', tone: 'info', title: 'มอบหมายงาน', by: 'U-004', note: '' },
            { at: '2569-08-04T08:10', tone: '',     title: 'รับงาน',      by: 'U-006', note: '' },
        ],
        overrides: [],
    },
    {
        id: 'TSK-000136', kind: 'APPROVE_RULE', title: 'อนุมัติเปิดใช้ RUL-DRG-007 v3',
        claim_id: null, rule_id: 'RUL-DRG-007',
        assigner: 'U-005', owner: 'U-008', dept: 'ศูนย์จัดเก็บรายได้',
        created: '2569-08-05T16:10', due_at: '2569-08-08T17:00',
        status: 'OPEN', priority: 'HIGH', escalated: false,
        detail: 'กฎตรวจราคาเทียบ Drug Catalogue ปรับให้ครอบคลุม BILLGRCS 03 '
              + 'ผ่านการทดสอบย้อนหลัง 1,240 เคส · Hit 38 · True Issue 92% · False Positive 8%',
        checklist: [
            { text: 'ทบทวนผลทดสอบย้อนหลัง',     done: true },
            { text: 'ตรวจวันที่มีผลและขอบเขตกองทุน', done: false },
            { text: 'อนุมัติและกำหนดวันเปิดใช้',    done: false },
        ],
        timeline: [
            { at: '2569-08-05T16:10', tone: 'accent', title: 'ส่งขออนุมัติ', by: 'U-005', note: 'Maker–Checker: ผู้เขียนกฎอนุมัติเองไม่ได้' },
        ],
        overrides: [],
    },

    /* ══ งานฝั่งส่งต่อผู้ป่วย — ใช้กล่องงานและกลไก Maker–Checker เดียวกับข้างบน ══ */
    {
        id: 'TSK-000151', kind: 'APPROVE_REFER',
        title: 'อนุมัติส่งต่อ นายวิชัย ตั้งมั่น → สถาบันโรคทรวงอก',
        claim_id: null, rule_id: null, refer_id: 'REF-OUT-2569-0033',
        assigner: 'U-004', owner: 'U-008', dept: 'ศูนย์จัดเก็บรายได้',
        created: '2569-08-05T16:10', due_at: '2569-08-07T16:00',
        status: 'OPEN', priority: 'HIGH', escalated: false,
        detail: 'ผล CAG พบเส้นเลือดหัวใจตีบ 3 เส้น ขอส่งต่อทำ PCI ที่สถาบันเฉพาะทาง · '
              + 'วงเงินที่ขอ 185,000 บาท · ขอบเขต: หัตถการ/ผ่าตัดเฉพาะรายการ',
        checklist: [
            { text: 'ตรวจศักยภาพและความพร้อมของปลายทาง', done: true },
            { text: 'ตรวจวงเงินและอัตราตามจ่าย',          done: false },
            { text: 'ตรวจสิทธิและเลขอนุมัติ',             done: false },
            { text: 'อนุมัติและออกใบส่งตัว',              done: false },
        ],
        timeline: [
            { at: '2569-08-05T16:10', tone: 'accent', title: 'ส่งขออนุมัติ', by: 'U-004',
              note: 'Maker–Checker: ผู้ขอส่งต่ออนุมัติเองไม่ได้ (BR-05)' },
        ],
        overrides: [],
    },
    {
        id: 'TSK-000153', kind: 'VERIFY_BILL',
        title: 'ตรวจใบเรียกเก็บ 148,000 บาท จาก รพ.ราชวิถี (เกินขอบเขตใบส่งตัว)',
        claim_id: null, rule_id: null, refer_id: 'REF-OUT-2569-0007',
        assigner: 'U-004', owner: 'U-007', dept: 'ฝ่ายการเงิน',
        created: '2569-08-01T11:20', due_at: '2569-08-05T16:00',
        status: 'PROGRESS', priority: 'HIGH', escalated: true,
        detail: 'ใบส่งตัวหมดอายุ 20 ก.ค. · ปลายทางทำ CAPD นอกขอบเขต · '
              + 'ยอดเรียกเก็บเกินวงเงินที่อนุมัติ 52,000 บาท — ต้องสรุปว่าจะจ่ายหรือโต้แย้งส่วนใด',
        checklist: [
            { text: 'กระทบยอดใบเรียกเก็บกับใบส่งตัว',   done: true },
            { text: 'แยกรายการที่อยู่นอกขอบเขต',        done: true },
            { text: 'สรุปยอดที่จะโต้แย้งและแจ้งปลายทาง', done: false },
        ],
        timeline: [
            { at: '2569-08-01T11:20', tone: 'danger', title: 'มอบหมายให้ตรวจใบเรียกเก็บ', by: 'U-004', note: 'RBL-2569-0011' },
            { at: '2569-08-05T16:01', tone: 'danger', title: 'เกิน SLA — ยกระดับอัตโนมัติ', by: 'ระบบ', note: 'แจ้งหัวหน้าฝ่ายการเงิน' },
        ],
        overrides: [],
    },
    {
        id: 'TSK-000156', kind: 'DOC',
        title: 'ส่งใบตอบกลับ (counter-referral) ให้ ศูนย์บริการสาธารณสุข 12',
        claim_id: null, rule_id: null, refer_id: 'REF-IN-2569-0057',
        assigner: 'U-007', owner: 'U-009', dept: 'เวชระเบียน',
        created: '2569-08-06T08:05', due_at: '2569-08-08T16:00',
        status: 'OPEN', priority: 'NORMAL', escalated: false,
        detail: 'ผ่าตัดต้อกระจกเสร็จตั้งแต่ 16 ก.ค. ผ่านมา 21 วันยังไม่ได้ส่งใบตอบกลับ '
              + '(ระเบียบกำหนด 15 วัน) — เวชระเบียนไม่ครบจะส่งเบิกไม่ผ่าน',
        checklist: [
            { text: 'สรุปผลการรักษาและคำแนะนำ', done: false },
            { text: 'ออกใบตอบกลับและส่งต้นทาง',  done: false },
        ],
        timeline: [
            { at: '2569-08-06T08:05', tone: 'warning', title: 'สร้างงานจากธง REF-NOCOUNTER', by: 'Rule Engine', note: '' },
        ],
        overrides: [],
    },

    {
        id: 'TSK-000140', kind: 'REVIEW_FIN', title: 'ทบทวนรายการค่าห้องพิเศษที่ถูกตัดจ่าย',
        claim_id: 'CLM-2569-0019', rule_id: null,
        assigner: 'U-004', owner: 'U-007', dept: 'ฝ่ายการเงิน',
        created: '2569-07-31T09:00', due_at: '2569-08-02T16:00',
        status: 'DONE', priority: 'NORMAL', escalated: false,
        detail: 'NHSO ตัดค่าห้องพิเศษส่วนเกิน 4,800 บาท — ทบทวนว่าควรอุทธรณ์หรือรับผลตัดจ่าย',
        checklist: [
            { text: 'ตรวจสอบเกณฑ์ค่าห้องของกองทุน OFC', done: true },
            { text: 'สรุปความเห็นและบันทึกผล',           done: true },
        ],
        timeline: [
            { at: '2569-07-31T09:00', tone: 'info',    title: 'มอบหมายงาน', by: 'U-004', note: '' },
            { at: '2569-08-01T11:00', tone: '',        title: 'รับงาน',      by: 'U-007', note: '' },
            { at: '2569-08-02T15:20', tone: 'success', title: 'ปิดงาน',      by: 'U-007', note: 'รับผลตัดจ่าย — ผู้ป่วยเลือกห้องพิเศษเอง ไม่เข้าเกณฑ์อุทธรณ์' },
        ],
        overrides: [],
    },
    {
        id: 'TSK-000133', kind: 'FIX_CASE', title: 'ตรวจทานคิวเคสที่คาดว่าจะติด P124 ก่อนรอบส่งเบิกสัปดาห์นี้',
        claim_id: 'CLM-2569-0042', rule_id: 'RUL-DRG-007',
        assigner: 'U-003', owner: 'U-004', dept: 'ศูนย์จัดเก็บรายได้',
        created: '2569-08-05T09:00', due_at: '2569-08-08T16:00',
        status: 'PROGRESS', priority: 'HIGH', escalated: false,
        detail: 'รวบรวมเคสที่กฎ RUL-DRG-007 ตรวจพบส่วนต่างราคา แล้วประสานหน่วยบริการต้นทาง '
              + 'ให้แก้ที่ HIS ก่อนรอบส่งเบิกวันศุกร์ — เป้าหมายคือส่งรอบเดียวผ่านทั้งชุด',
        checklist: [
            { text: 'ดึงรายการเคสที่ติดกฎ RUL-DRG-007 จาก Worklist', done: true },
            { text: 'มอบหมายงานแก้ไขให้หน่วยบริการต้นทาง',            done: true },
            { text: 'ติดตามงานที่ใกล้ครบ SLA',                        done: false },
            { text: 'ตรวจซ้ำและยืนยันพร้อมส่งทั้งชุด',                 done: false },
        ],
        timeline: [
            { at: '2569-08-05T09:00', tone: 'info', title: 'มอบหมายงาน', by: 'U-003', note: 'ก่อนรอบส่งเบิกวันศุกร์' },
            { at: '2569-08-05T09:20', tone: '',     title: 'รับงาน',      by: 'U-004', note: '' },
        ],
        overrides: [],
    },
    {
        id: 'TSK-000142', kind: 'OVERRIDE', title: 'ขอ Override คำเตือนจำนวนยาเกินเกณฑ์',
        claim_id: 'CLM-2569-0038', rule_id: 'RUL-DRG-015',
        assigner: 'U-004', owner: 'U-008', dept: 'ศูนย์จัดเก็บรายได้',
        created: '2569-08-06T08:20', due_at: '2569-08-06T16:00',
        status: 'OPEN', priority: 'NORMAL', escalated: false,
        detail: 'ผู้ป่วยอยู่พื้นที่ห่างไกล แพทย์สั่งยา 30 วันตามรอบนัด 2 เดือน '
              + 'ขอ Override คำเตือน RUL-DRG-015 พร้อมแนบบันทึกแพทย์',
        checklist: [
            { text: 'ตรวจสอบเหตุผลและหลักฐานประกอบ', done: false },
            { text: 'อนุมัติ / ปฏิเสธ พร้อมบันทึกเหตุผล', done: false },
        ],
        timeline: [
            { at: '2569-08-06T08:20', tone: 'warning', title: 'ยื่นขอ Override', by: 'U-004', note: 'ต้องมีเหตุผลและหลักฐานตาม BR-04' },
        ],
        overrides: [],
    },
];


const MockTasks = {

    all()    { return MockDB.all('tasks'); },
    byId(id) { return MockDB.byId('tasks', id); },

    forClaim(cid) { return this.all().filter(t => t.claim_id === cid); },
    forRule(rid)  { return this.all().filter(t => t.rule_id === rid); },
    forRefer(rid) { return this.all().filter(t => t.refer_id === rid); },

    /** งานที่ต้องผ่านการตัดสิน — เพิ่มชนิดใหม่ที่นี่ที่เดียว กล่อง "รอฉันอนุมัติ" ตามเอง */
    APPROVAL_KINDS: ['APPROVE_RULE', 'OVERRIDE', 'APPROVE_REFER'],

    mine()          { const u = MockSession.userId(); return this.all().filter(t => t.owner === u && t.status !== 'DONE'); },
    toApprove()     { const u = MockSession.userId();
                      return this.all().filter(t => t.owner === u && this.APPROVAL_KINDS.includes(t.kind) && t.status !== 'DONE'); },
    assignedByMe()  { const u = MockSession.userId(); return this.all().filter(t => t.assigner === u); },
    overSla()       { return this.all().filter(t => t.status !== 'DONE' && MockTone.sla(t.due_at) === 'over'); },

    kindLabel(k)   { const x = TASK_KINDS.find(t => t.key === k); return x ? x.label : k; },
    statusLabel(s) { return (TASK_STATUS[s] || {}).label || s; },
    statusBadge(s) { return (TASK_STATUS[s] || {}).badge || 'kbadge-off'; },

    /** สร้างเลขงานถัดไปแบบไม่ชนของเดิม */
    nextId() {
        const max = this.all().reduce((a, t) => Math.max(a, parseInt(String(t.id).replace(/\D/g, ''), 10) || 0), 0);
        return 'TSK-' + String(max + 1).padStart(6, '0');
    },

    /** ใช้จาก Worklist และหน้าเคส — มอบหมายงานจริงในเซสชันสาธิต */
    create({ claim_id, rule_id, refer_id, kind, title, owner, due_at, priority, detail, checklist }) {
        const t = {
            id: this.nextId(), kind: kind || 'FIX_CASE', title,
            claim_id: claim_id || null, rule_id: rule_id || null, refer_id: refer_id || null,
            assigner: MockSession.userId(), owner,
            dept: (MockAdmin.user(owner) || {}).dept || '—',
            created: '2569-08-06T09:00', due_at,
            status: 'OPEN', priority: priority || 'NORMAL', escalated: false,
            detail: detail || '', checklist: checklist || [],
            timeline: [{ at: '2569-08-06T09:00', tone: 'info', title: 'มอบหมายงาน',
                         by: MockSession.userId(), note: 'สร้างจากหน้าจอ (โหมดสาธิต)' }],
            overrides: [],
        };
        MockDB.insert('tasks', t);

        /* ผูกกลับเข้ารายการส่งต่อ
           ปลอดภัยกับหน้าที่ไม่ได้โหลด mock-referrals.js — MockDB.byId คืน null
           เมื่อยังไม่มีการ register ตาราง จึงไม่เกิด load-order dependency ใหม่ */
        if (refer_id) {
            const r = MockDB.byId('referrals', refer_id);
            if (r) MockDB.patch('referrals', refer_id, {
                task_ids: [...(r.task_ids || []), t.id],
                timeline: [...(r.timeline || []), {
                    at: '2569-08-06T09:00', tone: 'warning', title: 'ส่งขออนุมัติ',
                    by: MockAdmin.userName(MockSession.userId()),
                    note: `${t.id} · ${MockAdmin.userName(owner)} · กำหนด ${MockFmt.dateTH(due_at)}`,
                }],
            });
        }

        if (claim_id) {
            const c = MockDB.byId('claims', claim_id);
            if (c) MockDB.patch('claims', claim_id, {
                task_ids: [...(c.task_ids || []), t.id],
                owner,
                timeline: [...(c.timeline || []), {
                    at: '2569-08-06T09:00', tone: 'warning', title: 'มอบหมายงานให้แก้ไข',
                    by: MockAdmin.userName(MockSession.userId()), note: `${t.id} · กำหนด ${MockFmt.dateTH(due_at)}`,
                }],
            });
        }
        return t;
    },
};

MockDB.register('tasks', MOCK_TASKS);

window.TASK_KINDS    = TASK_KINDS;
window.TASK_STATUS   = TASK_STATUS;
window.TASK_PRIORITY = TASK_PRIORITY;
window.MOCK_TASKS    = MOCK_TASKS;
window.MockTasks     = MockTasks;
