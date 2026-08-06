/**
 * MediCore RCM — MOCK REJECTS (Reject Feedback Loop)
 * ------------------------------------------------------------
 * SRS FR-08 · เปลี่ยนผลตีกลับเป็นกฎของโรงพยาบาล
 *
 * ทุกแถวต้องบอกได้ว่า "มีกฎครอบคลุมแล้วหรือยัง"
 * แถวที่ยังไม่มีกฎคือรายการงานของ Rule Editor ในสัปดาห์ถัดไป
 */

const REJECT_GROUPS = [
    { key: 'PREVALIDATE', label: 'ไม่ผ่านการตรวจสอบขั้นต้น' },
    { key: 'PROCESS',     label: 'ไม่ผ่านการประมวลผล' },
    { key: 'AUDIT',       label: 'ตัดจ่ายหลัง Audit' },
];

const MOCK_REJECT_BATCHES = [
    { id: 'RJB-2569-07', period: 'ก.ค. 2569', imported: '2569-08-02T09:15', rows: 412, amount: 684200, by: 'U-004' },
    { id: 'RJB-2569-06', period: 'มิ.ย. 2569', imported: '2569-07-03T09:40', rows: 388, amount: 612800, by: 'U-004' },
    { id: 'RJB-2569-05', period: 'พ.ค. 2569', imported: '2569-06-04T10:05', rows: 455, amount: 741500, by: 'U-003' },
];

/** สาเหตุการตีกลับ เรียงตามมูลค่า — ใช้ทำ Pareto */
const MOCK_REJECT_CAUSES = [
    { code: 'P124', group: 'PREVALIDATE', cause: 'ราคาที่เบิกไม่ตรง Drug Catalogue',
      count: 118, amount: 214600, rule: 'RUL-DRG-007', dept: 'เภสัชกรรม / ศูนย์จัดเก็บรายได้' },
    { code: 'C305', group: 'PROCESS', cause: 'Approve Code / เลขปิดสิทธิ ไม่ตรงฐานข้อมูล',
      count: 74, amount: 168400, rule: 'RUL-ELG-004', dept: 'เวชระเบียน' },
    { code: 'P061', group: 'PREVALIDATE', cause: 'รหัสหัตถการไม่สอดคล้องการวินิจฉัย',
      count: 66, amount: 121900, rule: 'RUL-CDX-009', dept: 'เวชระเบียน / Coder' },
    { code: 'A210', group: 'AUDIT', cause: 'ค่าห้องพิเศษเกินเกณฑ์ที่กองทุนกำหนด',
      count: 41, amount: 96800, rule: null, dept: 'การเงิน' },
    { code: 'P208', group: 'PREVALIDATE', cause: 'วันที่รับบริการอยู่นอกช่วงสิทธิ',
      count: 33, amount: 52400, rule: null, dept: 'เวชระเบียน' },
    { code: 'P312', group: 'PREVALIDATE', cause: 'เอกสารประกอบการเบิกไม่ครบ',
      count: 28, amount: 41200, rule: 'RUL-DOC-002', dept: 'เวชระเบียน' },
    { code: 'C112', group: 'PROCESS', cause: 'จำนวนวันนอนไม่สอดคล้องวันจำหน่าย/ลากลับบ้าน',
      count: 22, amount: 38600, rule: 'RUL-IPD-006', dept: 'หอผู้ป่วย / เวชระเบียน' },
    { code: 'A144', group: 'AUDIT', cause: 'รายการที่ไม่มีข้อบ่งชี้ทางคลินิกรองรับ',
      count: 18, amount: 31400, rule: null, dept: 'องค์กรแพทย์' },
    { code: 'P177', group: 'PREVALIDATE', cause: 'แฟ้ม 9 (AER) ไม่ครบสำหรับเคสฉุกเฉิน',
      count: 14, amount: 24100, rule: 'RUL-EMR-003', dept: 'ห้องฉุกเฉิน' },
    { code: 'C420', group: 'PROCESS', cause: 'รหัสหน่วยบริการต้นสังกัด (CUP) ไม่ตรงกับสิทธิ',
      count: 11, amount: 18700, rule: null, dept: 'ศูนย์จัดเก็บรายได้' },
];

/** รายการตีกลับรายเคส — เชื่อมกับ MOCK_CLAIMS ผ่าน claim_id */
const MOCK_REJECTS = (function build() {
    let _s = 690802;
    const rnd = () => (_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const pick = a => a[Math.floor(rnd() * a.length)];

    const seed = [
        { id: 'RJ-000101', batch: 'RJB-2569-07', claim_id: 'CLM-2569-0007', code: 'P124',
          amount: 810, appealed: false, resolved: false },
        { id: 'RJ-000102', batch: 'RJB-2569-07', claim_id: 'CLM-2569-0007', code: 'C305',
          amount: 1050, appealed: true, resolved: false },
        { id: 'RJ-000103', batch: 'RJB-2569-07', claim_id: 'CLM-2569-0019', code: 'A210',
          amount: 4800, appealed: false, resolved: true },
    ];

    const claims = MOCK_CLAIMS.filter(c => c.nhso && ['AWAIT_FIX', 'PAID', 'IN_AUDIT'].includes(c.nhso.stage));
    const gen = [];
    for (let i = 0; i < 32; i++) {
        const cause = pick(MOCK_REJECT_CAUSES);
        const c = pick(claims) || MOCK_CLAIMS[0];
        gen.push({
            id: 'RJ-' + String(200 + i * 3).padStart(6, '0'),
            batch: pick(MOCK_REJECT_BATCHES).id,
            claim_id: c.id, code: cause.code,
            amount: Math.round(cause.amount / cause.count * (0.6 + rnd() * 0.9)),
            appealed: rnd() < 0.18, resolved: rnd() < 0.35,
        });
    }
    return [...seed, ...gen];
})();

const MockRejects = {

    all()      { return MockDB.all('rejects'); },
    causes()   { return MOCK_REJECT_CAUSES; },

    causeOf(code) { return MOCK_REJECT_CAUSES.find(c => c.code === code) || null; },

    byGroup(g) { return g === 'all' ? this.all()
        : this.all().filter(r => (this.causeOf(r.code) || {}).group === g); },

    /** Pareto — เรียงตามมูลค่าและคำนวณ % สะสม */
    pareto() {
        const rows = MOCK_REJECT_CAUSES.slice().sort((a, b) => b.amount - a.amount);
        const total = rows.reduce((a, r) => a + r.amount, 0) || 1;
        let acc = 0;
        return rows.map(r => {
            acc += r.amount;
            return { ...r, pct: (r.amount / total) * 100, cum: (acc / total) * 100 };
        });
    },

    /** สาเหตุที่ยังไม่มีกฎครอบคลุม — คืองานถัดไปของ Rule Editor */
    uncovered() { return MOCK_REJECT_CAUSES.filter(c => !c.rule); },

    totalAmount() { return MOCK_REJECT_CAUSES.reduce((a, c) => a + c.amount, 0); },
    totalCount()  { return MOCK_REJECT_CAUSES.reduce((a, c) => a + c.count, 0); },

    /** มูลค่าที่ป้องกันได้แล้วด้วยกฎที่มีอยู่ */
    coveredAmount() { return MOCK_REJECT_CAUSES.filter(c => c.rule).reduce((a, c) => a + c.amount, 0); },

    /** แนวโน้มรายเดือน — จำนวนและมูลค่า */
    trend: {
        labels: ['ก.พ.69', 'มี.ค.69', 'เม.ย.69', 'พ.ค.69', 'มิ.ย.69', 'ก.ค.69'],
        count:  [512, 498, 471, 455, 388, 412],
        amount: [812000, 795000, 768000, 741500, 612800, 684200],
    },
};

MockDB.register('rejects', MOCK_REJECTS);

window.REJECT_GROUPS       = REJECT_GROUPS;
window.MOCK_REJECT_BATCHES = MOCK_REJECT_BATCHES;
window.MOCK_REJECT_CAUSES  = MOCK_REJECT_CAUSES;
window.MOCK_REJECTS        = MOCK_REJECTS;
window.MockRejects         = MockRejects;
