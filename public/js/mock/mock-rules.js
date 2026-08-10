/**
 * MediCore RCM — MOCK RULES (Claim Rule Engine + การบริหารกฎโดยโรงพยาบาล)
 * ------------------------------------------------------------
 * SRS FR-03/FR-04 · BR-01 (เลือกกฎตามวันที่รับบริการ + ช่วงมีผล + กองทุน + ประเภทบริการ)
 *                   BR-02 (กฎ Active ห้ามแก้ทับ ต้อง Clone เป็น Version ใหม่)
 *                   BR-05 (กฎระงับส่ง/ผลสูง ต้องผ่าน Maker–Checker)
 *
 * ⭐ RUL-DRG-007 v3 ตั้งใจให้ author = U-005 (Rule Editor)
 *    เพื่อสาธิตว่า persona นั้นกด "เปิดใช้" กฎของตัวเองไม่ได้
 */

const RULE_LIFECYCLE = ['DRAFT', 'REVIEW', 'APPROVED', 'ACTIVE', 'RETIRED'];

const MOCK_RULES = [
    {
        id: 'RUL-DRG-007', name: 'ราคาที่เบิกต้องไม่เกินราคาใน Drug Catalogue',
        category: 'ราคาและค่าใช้จ่าย', status: 'ACTIVE', version: 3,
        author: 'U-005', approver: 'U-008',
        funds: ['UC', 'OFC', 'SSS', 'LGO'], services: ['OPD', 'IPD', 'PP'],
        effective_from: '2569-07-20', effective_to: null,
        severity: 'ERROR', action: 'FIX', maps_to_nhso: 'P124',
        doc_id: 'DOC-NHSO-2569-012', doc_ref: 'ข้อ 4.2 หน้า 18',
        desc: 'ตรวจราคาต่อหน่วยของทุกรายการในแฟ้ม 7 เทียบกับ Drug Catalogue ที่มีผล ณ วันที่รับบริการ',
        conditions: [
            { join: '',    field: 'แฟ้ม 7 · หมวดค่าใช้จ่าย (BILLGRCS)', op: 'อยู่ในชุด', value: '03, 04' },
            { join: 'AND', field: 'แฟ้ม 7 · ราคาที่เบิกต่อหน่วย',        op: 'มากกว่า',  value: 'ราคาใน Drug Catalogue (STDCODE เดียวกัน)' },
            { join: 'AND', field: 'ส่วนต่างต่อรายการ',                  op: 'มากกว่า',  value: '0 บาท' },
        ],
        kpi: { hit: 38, true_issue: 92, override: 5, false_positive: 8, prevented: 184500 },
    },
    {
        id: 'RUL-ELG-004', name: 'Approve Code (OFC) / เลขปิดสิทธิ (UCS) ต้องตรงฐานข้อมูล',
        category: 'สิทธิและการปิดสิทธิ', status: 'ACTIVE', version: 1,
        author: 'U-004', approver: 'U-008',
        funds: ['OFC', 'UC'], services: ['OPD', 'IPD'],
        effective_from: '2569-06-01', effective_to: null,
        severity: 'ERROR', action: 'BLOCK', maps_to_nhso: 'C305',
        doc_id: 'DOC-NHSO-2569-008', doc_ref: 'ข้อ 3.4',
        desc: 'เทียบเลขอนุมัติ/เลขปิดสิทธิที่บันทึกใน HIS กับฐานข้อมูลหน่วยบริการก่อนส่งเบิก',
        conditions: [
            { join: '',    field: 'แฟ้ม 1 · ประเภทสิทธิ',        op: 'อยู่ในชุด',  value: 'OFC, UCS' },
            { join: 'AND', field: 'Approve Code / เลขปิดสิทธิ', op: 'ไม่ตรงกับ', value: 'ฐานข้อมูลหน่วยบริการ' },
        ],
        kpi: { hit: 21, true_issue: 95, override: 2, false_positive: 5, prevented: 142800 },
    },
    {
        id: 'RUL-CDX-009', name: 'รหัสหัตถการต้องสอดคล้องกับการวินิจฉัยหลัก',
        category: 'Coding', status: 'ACTIVE', version: 2,
        author: 'U-005', approver: 'U-008',
        funds: ['UC', 'OFC', 'SSS', 'LGO', 'EMS'], services: ['OPD', 'IPD'],
        effective_from: '2569-05-15', effective_to: null,
        severity: 'ERROR', action: 'FIX', maps_to_nhso: 'P061',
        doc_id: 'DOC-NHSO-2569-019', doc_ref: 'ข้อ 5.2',
        desc: 'ตรวจความสัมพันธ์ระหว่างแฟ้ม 5 (Diagnosis) กับแฟ้ม 6 (Procedure) ตามตารางคู่ที่ สปสช. ประกาศ',
        conditions: [
            { join: '',    field: 'แฟ้ม 6 · รหัสหัตถการ', op: 'มีค่า',        value: '—' },
            { join: 'AND', field: 'คู่ Dx–Proc',         op: 'ไม่อยู่ในตาราง', value: 'ตารางคู่ที่ประกาศ' },
        ],
        kpi: { hit: 44, true_issue: 78, override: 14, false_positive: 22, prevented: 96200 },
    },
    {
        id: 'RUL-EMR-003', name: 'เคสอุบัติเหตุฉุกเฉินต้องมีแฟ้ม 9 (AER) ครบ',
        category: 'ความครบของข้อมูล', status: 'ACTIVE', version: 2,
        author: 'U-004', approver: 'U-008',
        funds: ['EMS', 'UC'], services: ['OPD', 'IPD'],
        effective_from: '2569-04-01', effective_to: null,
        severity: 'ERROR', action: 'BLOCK', maps_to_nhso: 'P208',
        doc_id: 'DOC-NHSO-2569-015', doc_ref: 'ข้อ 2.3',
        desc: 'บังคับให้มีเวลารับแจ้ง พิกัดจุดเกิดเหตุ และประเภทการนำส่ง ก่อนอนุญาตให้ส่งเบิกกองทุนฉุกเฉิน',
        conditions: [
            { join: '',    field: 'กองทุน',                      op: 'เท่ากับ',   value: 'EMS / อุบัติเหตุฉุกเฉิน' },
            { join: 'AND', field: 'แฟ้ม 9 · เวลารับแจ้ง',        op: 'ว่าง',      value: '—' },
            { join: 'OR',  field: 'แฟ้ม 9 · พิกัดจุดเกิดเหตุ',   op: 'ว่าง',      value: '—' },
        ],
        kpi: { hit: 12, true_issue: 88, override: 8, false_positive: 12, prevented: 58400 },
    },
    {
        id: 'RUL-DOC-002', name: 'เอกสารประกอบต้องครบตามประเภทเคส',
        category: 'เอกสาร', status: 'ACTIVE', version: 2,
        author: 'U-004', approver: 'U-008',
        funds: ['UC', 'OFC', 'SSS', 'LGO'], services: ['OPD', 'IPD', 'PP'],
        effective_from: '2569-03-01', effective_to: null,
        severity: 'WARNING', action: 'WARN', maps_to_nhso: null,
        doc_id: 'DOC-INT-2569-004', doc_ref: 'ข้อ 2.1',
        desc: 'ตรวจรายการเอกสารที่ต้องมีตามประเภทเคสและรายการที่ขอเบิก',
        conditions: [
            { join: '',    field: 'รายการเอกสารที่ต้องมี', op: 'ไม่ครบ', value: 'ตามประเภทเคส' },
        ],
        kpi: { hit: 63, true_issue: 71, override: 19, false_positive: 29, prevented: 41200 },
    },
    {
        id: 'RUL-CLN-011', name: 'ยากลุ่มพิเศษต้องมีความเห็นแพทย์ผู้เชี่ยวชาญ',
        category: 'Clinical', status: 'ACTIVE', version: 1,
        author: 'U-006', approver: 'U-008',
        funds: ['UC', 'OFC'], services: ['IPD'],
        effective_from: '2569-02-01', effective_to: null,
        severity: 'WARNING', action: 'APPROVE', maps_to_nhso: null,
        doc_id: 'DOC-INT-2569-002', doc_ref: 'ระเบียบภายใน ข้อ 5',
        desc: 'บังคับให้ Medical Reviewer รับรองก่อนส่งเบิกเมื่อมีการใช้ยากลุ่มพิเศษที่มูลค่าสูง',
        conditions: [
            { join: '',    field: 'แฟ้ม 7 · STDCODE', op: 'อยู่ในชุด', value: 'รายการยากลุ่มพิเศษ' },
            { join: 'AND', field: 'มูลค่ารวมของรายการ', op: 'มากกว่า',  value: '10,000 บาท' },
        ],
        kpi: { hit: 9, true_issue: 100, override: 0, false_positive: 0, prevented: 88600 },
    },
    {
        id: 'RUL-DRG-015', name: 'จำนวนยาต่อครั้งต้องไม่เกินเกณฑ์แนะนำ',
        category: 'ราคาและค่าใช้จ่าย', status: 'ACTIVE', version: 1,
        author: 'U-005', approver: 'U-008',
        funds: ['UC', 'LGO'], services: ['OPD'],
        effective_from: '2569-06-15', effective_to: null,
        severity: 'WARNING', action: 'WARN', maps_to_nhso: null,
        doc_id: 'DOC-NHSO-2569-021', doc_ref: 'ข้อ 6.1',
        desc: 'แจ้งเตือนเมื่อจำนวนยาต่อครั้งเกินเกณฑ์ที่ประกาศ โดยไม่ปิดกั้นการส่งเบิก',
        conditions: [
            { join: '',    field: 'แฟ้ม 7 · จำนวนหน่วย', op: 'มากกว่า', value: 'เกณฑ์ต่อครั้งของ STDCODE นั้น' },
        ],
        kpi: { hit: 87, true_issue: 46, override: 41, false_positive: 54, prevented: 12400 },
    },
    {
        id: 'RUL-IPD-006', name: 'จำนวนวันนอนต้องสอดคล้องกับวันจำหน่ายและวันลากลับบ้าน',
        category: 'ความครบของข้อมูล', status: 'REVIEW', version: 1,
        author: 'U-005', approver: null,
        funds: ['UC', 'OFC', 'SSS'], services: ['IPD'],
        effective_from: '2569-09-01', effective_to: null,
        severity: 'ERROR', action: 'FIX', maps_to_nhso: 'C112',
        doc_id: 'DOC-NHSO-2569-024', doc_ref: 'ข้อ 7.1',
        desc: 'ตรวจความสอดคล้องของแฟ้ม 14 (IPD) กับแฟ้ม 15 (LVD) ก่อนรองรับ IPD ในเฟส Go-Live 16 ก.ย. 2569',
        conditions: [
            { join: '',    field: 'แฟ้ม 14 · จำนวนวันนอน',            op: 'ไม่เท่ากับ', value: 'วันจำหน่าย − วันรับไว้ − วันลากลับบ้าน' },
        ],
        kpi: { hit: 0, true_issue: 0, override: 0, false_positive: 0, prevented: 0 },
    },
    {
        id: 'RUL-ELG-008', name: 'วันที่รับบริการต้องอยู่ในช่วงสิทธิที่ตรวจสอบได้',
        category: 'สิทธิและการปิดสิทธิ', status: 'DRAFT', version: 1,
        author: 'U-004', approver: null,
        funds: ['UC'], services: ['OPD', 'PP'],
        effective_from: '2569-09-01', effective_to: null,
        severity: 'ERROR', action: 'FIX', maps_to_nhso: 'P208',
        doc_id: 'DOC-NHSO-2569-015', doc_ref: 'ข้อ 2.3',
        desc: 'ร่างที่สร้างจากผลตีกลับซ้ำ — ตรวจว่าวันที่รับบริการอยู่ในช่วงสิทธิที่ยืนยันได้',
        conditions: [
            { join: '',    field: 'วันที่รับบริการ', op: 'อยู่นอกช่วง', value: 'ช่วงสิทธิที่ตรวจสอบได้' },
        ],
        kpi: { hit: 0, true_issue: 0, override: 0, false_positive: 0, prevented: 0 },
    },
    {
        id: 'RUL-DRG-004', name: 'ราคาที่เบิกต้องไม่เกิน Drug Catalogue (ฉบับก่อน)',
        category: 'ราคาและค่าใช้จ่าย', status: 'RETIRED', version: 1,
        author: 'U-005', approver: 'U-008',
        funds: ['UC'], services: ['OPD'],
        effective_from: '2568-10-01', effective_to: '2569-07-19',
        severity: 'WARNING', action: 'WARN', maps_to_nhso: 'P124',
        doc_id: 'DOC-NHSO-2568-044', doc_ref: 'ข้อ 4.1',
        desc: 'กฎรุ่นแรก — ครอบคลุมเฉพาะกองทุน UC และเป็นแค่คำเตือน จึงมีเคสหลุดไปถูกตีกลับ',
        conditions: [
            { join: '',    field: 'แฟ้ม 7 · ราคาที่เบิก', op: 'มากกว่า', value: 'ราคาใน Drug Catalogue' },
        ],
        kpi: { hit: 15, true_issue: 60, override: 33, false_positive: 40, prevented: 18200 },
    },

    /* ══ กฎฝั่งส่งต่อผู้ป่วย — ธงใน mock-referrals.js ทุกตัวอ้างกลับมาที่ 3 กฎนี้ ══ */
    {
        id: 'RUL-REF-001', name: 'การให้บริการต้องอยู่ในขอบเขต วงเงิน และอายุของใบส่งตัว',
        category: 'การส่งต่อและตามจ่าย', status: 'ACTIVE', version: 2,
        author: 'U-004', approver: 'U-008',
        funds: ['UC', 'OFC', 'SSS', 'LGO'], services: ['OPD', 'IPD'],
        effective_from: '2569-04-01', effective_to: null,
        severity: 'ERROR', action: 'BLOCK', maps_to_nhso: null,
        doc_id: 'DOC-INT-2569-031', doc_ref: 'ข้อ 4.1–4.3',
        desc: 'ตรวจ 3 อย่างพร้อมกันก่อนอนุมัติตามจ่าย — วันที่ให้บริการยังอยู่ในอายุใบส่งตัว · '
            + 'หัตถการที่ทำจริงอยู่ในขอบเขตที่อนุมัติ · ยอดเรียกเก็บไม่เกินวงเงินและจำนวนครั้ง',
        conditions: [
            { join: '',   field: 'วันที่ให้บริการ',      op: 'หลังจาก',    value: 'วันหมดอายุใบส่งตัว' },
            { join: 'OR', field: 'หัตถการที่ทำจริง',    op: 'ไม่อยู่ใน',   value: 'ขอบเขตที่อนุมัติ' },
            { join: 'OR', field: 'ยอดเรียกเก็บสะสม',    op: 'มากกว่า',    value: 'วงเงินที่อนุมัติ' },
        ],
        kpi: { hit: 12, true_issue: 91, override: 3, false_positive: 9, prevented: 318400 },
    },
    {
        id: 'RUL-REF-002', name: 'ใบส่งตัวต้องมีเลขอนุมัติและมีใบตอบกลับครบ',
        category: 'การส่งต่อและตามจ่าย', status: 'ACTIVE', version: 1,
        author: 'U-004', approver: 'U-008',
        funds: ['UC', 'OFC'], services: ['OPD', 'IPD'],
        effective_from: '2569-04-01', effective_to: null,
        severity: 'ERROR', action: 'FIX', maps_to_nhso: 'C305',
        doc_id: 'DOC-INT-2569-031', doc_ref: 'ข้อ 3.2 และ 6.1',
        desc: 'ใบส่งตัวต้องมี Approve Code (OFC) หรือเลขปิดสิทธิ (UCS) ที่ตรงฐานข้อมูล '
            + 'ยกเว้นกรณีฉุกเฉินที่ขอเลขย้อนหลังภายใน 24 ชม. · และต้องมีใบตอบกลับภายใน 15 วันหลังให้บริการ',
        conditions: [
            { join: '',    field: 'เลขอนุมัติบนใบส่งตัว', op: 'ไม่มีค่า',  value: '—' },
            { join: 'AND', field: 'ประเภทการส่งต่อ',      op: 'ไม่ใช่',    value: 'ฉุกเฉิน (ขอย้อนหลังได้ 24 ชม.)' },
            { join: 'OR',  field: 'ใบตอบกลับ',            op: 'เกินกำหนด', value: '15 วันหลังให้บริการ' },
        ],
        kpi: { hit: 18, true_issue: 89, override: 4, false_positive: 11, prevented: 96700 },
    },
    {
        id: 'RUL-REF-003', name: 'ห้ามเรียกเก็บซ้ำซ้อนและต้องยื่นภายในกำหนด',
        category: 'การส่งต่อและตามจ่าย', status: 'ACTIVE', version: 1,
        author: 'U-007', approver: 'U-008',
        funds: ['UC', 'OFC', 'SSS', 'LGO', 'EMS'], services: ['OPD', 'IPD'],
        effective_from: '2569-05-01', effective_to: null,
        severity: 'ERROR', action: 'BLOCK', maps_to_nhso: null,
        doc_id: 'DOC-INT-2569-031', doc_ref: 'ข้อ 5.1–5.4',
        desc: 'รายการส่งต่อหนึ่งรายการเรียกเก็บได้ทางเดียวเท่านั้น — เรียกเก็บต้นทาง หรือ ส่งเบิก สปสช. '
            + 'และต้องยื่นภายในกำหนดของระเบียบ · เตือนรายการที่ให้บริการเสร็จแล้วแต่ยังไม่มีใบเรียกเก็บ',
        conditions: [
            { join: '',   field: 'ช่องทางเรียกเก็บ',        op: 'มีมากกว่า', value: '1 ช่องทางในรายการเดียว' },
            { join: 'OR', field: 'วันที่ยื่นเรียกเก็บ',      op: 'หลังจาก',   value: 'กำหนดยื่นตามระเบียบ' },
            { join: 'OR', field: 'รายการที่ให้บริการเสร็จ', op: 'ยังไม่มี',  value: 'ใบเรียกเก็บ' },
        ],
        kpi: { hit: 9, true_issue: 94, override: 1, false_positive: 6, prevented: 130900 },
    },

    /* ══════════════════════════════════════════════════════
       กฎที่ถอดตรงจาก NHSO Digital Platform Overview (23 มิ.ย. 2569)
       ทั้ง 4 ข้อนี้อ้างหน้าเอกสารได้ ไม่ได้อนุมานเอง
       ══════════════════════════════════════════════════════ */
    {
        id: 'RUL-FIL-001', name: 'ต้องส่งแฟ้มครบตามกองทุนที่เบิก',
        category: 'ชุดข้อมูลมาตรฐาน', status: 'ACTIVE', version: 1,
        author: 'U-005', approver: 'U-008',
        funds: ['UC', 'OFC', 'SSS', 'LGO', 'EMS'], services: ['OPD', 'IPD', 'PP'],
        effective_from: '2569-08-01', effective_to: null,
        severity: 'ERROR', action: 'BLOCK', maps_to_nhso: null,
        doc_id: 'DOC-NHSO-2566-001', doc_ref: 'ตารางกองทุน × แฟ้ม หน้า 14–16',
        origin_doc: 'NHSO Digital Platform Overview · 23 มิ.ย. 2569 · น.14–16',
        desc: 'ประกาศกำหนดว่าแต่ละกองทุนต้องส่งแฟ้มใดบ้าง (12 กองทุน × 15 แฟ้ม) '
            + 'แฟ้ม 1–8 และ 14 บังคับเมื่อกองทุนครอบคลุม · แฟ้มกลุ่มเฉพาะ 9–13, 15 '
            + 'บังคับเมื่อเข้าเงื่อนไขของเคส เช่น อุบัติเหตุฉุกเฉิน ตั้งครรภ์ ผู้พิการ ลากลับบ้าน',
        conditions: [
            { join: '',    field: 'กองทุนที่เบิก',            op: 'กำหนดชุดแฟ้ม', value: 'ตารางกองทุน × แฟ้ม (12 กองทุน)' },
            { join: 'AND', field: 'แฟ้มที่ส่งมาในชุดข้อมูล',  op: 'ไม่ครบตาม',     value: 'แฟ้มบังคับของกองทุนนั้น' },
        ],
        kpi: { hit: 13, true_issue: 100, override: 0, false_positive: 0, prevented: 268400 },
    },
    {
        id: 'RUL-FIL-002', name: 'ฟิลด์บังคับ (ต้องระบุ) ต้องครบทุกแฟ้มที่ส่ง',
        category: 'ชุดข้อมูลมาตรฐาน', status: 'ACTIVE', version: 1,
        author: 'U-005', approver: 'U-008',
        funds: ['UC', 'OFC', 'SSS', 'LGO', 'EMS'], services: ['OPD', 'IPD', 'PP'],
        effective_from: '2569-08-01', effective_to: null,
        severity: 'ERROR', action: 'FIX', maps_to_nhso: null,
        doc_id: 'DOC-NHSO-2566-001', doc_ref: 'ตารางจำนวนฟิลด์รายแฟ้ม หน้า 12',
        origin_doc: 'NHSO Digital Platform Overview · 23 มิ.ย. 2569 · น.12',
        desc: 'ชุดข้อมูลมาตรฐานมี 160 Data Points แบ่งเป็นบังคับ 72 · มีเงื่อนไข 16 · อื่น ๆ 72 '
            + 'ฟิลด์บังคับต้องมีค่าครบทุกแฟ้มที่ส่ง มิฉะนั้นจะไม่ผ่านการตรวจสอบเบื้องต้น',
        conditions: [
            { join: '',    field: 'ฟิลด์ประเภท "ต้องระบุ (Y)"', op: 'มีค่าว่าง', value: 'อย่างน้อย 1 ฟิลด์' },
            { join: 'OR',  field: 'ฟิลด์ประเภท "ระบุ/ไม่ระบุ"', op: 'เข้าเงื่อนไขแต่ว่าง', value: '16 ฟิลด์เงื่อนไข' },
        ],
        kpi: { hit: 27, true_issue: 96, override: 3, false_positive: 4, prevented: 158200 },
    },
    {
        id: 'RUL-SET-001', name: 'กลุ่มบริการชุดที่ 2 ยังส่งผ่าน Platform ใหม่ไม่ได้',
        category: 'ขอบเขตการใช้งาน', status: 'ACTIVE', version: 1,
        author: 'U-004', approver: 'U-008',
        funds: ['UC', 'OFC', 'SSS', 'LGO', 'EMS'], services: ['OPD', 'IPD'],
        effective_from: '2569-08-01', effective_to: null,
        severity: 'WARNING', action: 'WARN', maps_to_nhso: null,
        doc_id: 'DOC-NHSO-2569-024', doc_ref: 'กลุ่มบริการชุดที่ 2 หน้า 13',
        origin_doc: 'NHSO Digital Platform Overview · 23 มิ.ย. 2569 · น.13',
        desc: 'บำบัดทดแทนไต (CKD) · ผู้ติดเชื้อ HIV/เอดส์ · วัณโรค (TB) ยังไม่ได้ประกาศ'
            + 'ชุดข้อมูลมาตรฐาน — ต้องคงช่องทางเดิมไว้ อย่าเพิ่งย้ายมาส่งผ่าน NHSO Digital Platform',
        conditions: [
            { join: '',   field: 'รหัสวินิจฉัย/กลุ่มบริการ', op: 'อยู่ในชุด', value: 'CKD, HIV/AIDS, TB' },
            { join: 'AND', field: 'ช่องทางส่งเบิกที่เลือก',  op: 'เท่ากับ',   value: 'NHSO Digital Platform' },
        ],
        kpi: { hit: 6, true_issue: 100, override: 0, false_positive: 0, prevented: 84300 },
    },
    {
        id: 'RUL-VIS-001', name: 'ต้องปิดสิทธิและปิด Visit เป็น Complete ก่อนส่งเบิก',
        category: 'สิทธิและการปิดสิทธิ', status: 'ACTIVE', version: 1,
        author: 'U-004', approver: 'U-008',
        funds: ['UC', 'OFC', 'SSS', 'LGO', 'EMS'], services: ['OPD', 'IPD', 'PP'],
        effective_from: '2569-08-01', effective_to: null,
        severity: 'ERROR', action: 'BLOCK', maps_to_nhso: null,
        doc_id: 'DOC-NHSO-2569-008', doc_ref: 'เส้นทาง 7 ขั้น ขั้นที่ 4 หน้า 7',
        origin_doc: 'NHSO Digital Platform Overview · 23 มิ.ย. 2569 · น.7',
        desc: 'เส้นทางการทำงานกำหนดให้ปิดสิทธิ (เป๋าตัง / ระบบ สปสช.) และปิด Visit ให้ได้สถานะ '
            + 'Complete ก่อน จึงจะเชื่อม API ส่งเบิกได้ · สถานะ Waiting และ Incomplete ยังส่งไม่ได้',
        conditions: [
            { join: '',   field: 'สถานะการปิด Visit', op: 'ไม่เท่ากับ', value: 'Complete' },
            { join: 'OR', field: 'สถานะการปิดสิทธิ',  op: 'เท่ากับ',    value: 'ยังไม่ปิดสิทธิ' },
        ],
        kpi: { hit: 13, true_issue: 98, override: 2, false_positive: 2, prevented: 112600 },
    },

    /* ══════════════════════════════════════════════════════
       กฎงานผู้ป่วยใน — ใช้โดยหน้า ipd-audit (ตรวจแฟ้มผู้ป่วยใน)
       ตรรกะการยิงกฎแต่ละข้ออยู่ที่ MockIpd._ruleHit() ใน mock-ipd.js
       ⚠️ PVT (ประกันชีวิต/สุขภาพเอกชน) ใส่ได้เฉพาะกฎที่ไม่อ้าง สปสช.
       ══════════════════════════════════════════════════════ */
    {
        id: 'RUL-IPD-016', name: 'ต้องส่งแฟ้ม 15 (LVD) เมื่อผู้ป่วยในมีการลากลับบ้าน',
        category: 'ความครบของข้อมูล', status: 'ACTIVE', version: 1,
        author: 'U-005', approver: 'U-008',
        funds: ['UC', 'OFC', 'SSS', 'LGO'], services: ['IPD'],
        effective_from: '2569-07-01', effective_to: null,
        severity: 'ERROR', action: 'FIX', maps_to_nhso: 'C112',
        doc_id: 'DOC-NHSO-2566-001', doc_ref: 'ตารางกองทุน × แฟ้ม หน้า 14–16 (แฟ้ม 15 มีเงื่อนไข)',
        origin_doc: 'NHSO Digital Platform Overview · 23 มิ.ย. 2569 · น.9, น.12',
        desc: 'แฟ้ม 15 (NHSO LVD) เป็นแฟ้มมีเงื่อนไข — ส่งเฉพาะกรณีผู้ป่วยในลากลับบ้าน '
            + 'ถ้ามีวันลาแต่ไม่ส่งแฟ้ม 15 จำนวนวันนอนที่เบิกจะไม่ตรงกับแฟ้ม 14 และถูกตีกลับด้วย C112',
        conditions: [
            { join: '',    field: 'จำนวนวันลากลับบ้าน',  op: 'มากกว่า',  value: '0 วัน' },
            { join: 'AND', field: 'แฟ้มที่ส่งในชุดข้อมูล', op: 'ไม่มี',    value: 'แฟ้ม 15 (NHSO LVD)' },
        ],
        kpi: { hit: 7, true_issue: 100, override: 0, false_positive: 0, prevented: 96200 },
    },
    {
        id: 'RUL-IPD-017', name: 'ต้องระบุการวินิจฉัยหลักและจัดกลุ่ม DRG ได้ก่อนส่งเบิก',
        category: 'Coding', status: 'ACTIVE', version: 1,
        author: 'U-005', approver: 'U-008',
        funds: ['UC', 'OFC', 'SSS', 'LGO', 'EMS'], services: ['IPD'],
        effective_from: '2569-07-01', effective_to: null,
        severity: 'ERROR', action: 'BLOCK', maps_to_nhso: null,
        doc_id: 'DOC-INT-2569-041', doc_ref: 'ระเบียบงานเวชระเบียน ข้อ 2.1',
        desc: 'ผู้ป่วยในจ่ายตามกลุ่มวินิจฉัยโรคร่วม — ถ้าไม่มีการวินิจฉัยหลัก (PDx) '
            + 'หรือรหัสที่บันทึกจัดกลุ่ม DRG ไม่ได้ จะคำนวณค่าชดเชยไม่ได้เลย ต้องระงับส่ง',
        conditions: [
            { join: '',   field: 'การวินิจฉัยหลัก (PDx)', op: 'ไม่มีค่า', value: '—' },
            { join: 'OR', field: 'ผลการจัดกลุ่ม DRG',      op: 'ไม่มีค่า', value: '—' },
        ],
        kpi: { hit: 11, true_issue: 100, override: 0, false_positive: 0, prevented: 412000 },
    },
    {
        id: 'RUL-IPD-018', name: 'วันนอนเกินจุดตัดบนของกลุ่ม DRG ต้องมีเหตุผลทางการแพทย์',
        category: 'ความครบของข้อมูล', status: 'ACTIVE', version: 1,
        author: 'U-005', approver: 'U-008',
        funds: ['UC', 'OFC', 'SSS', 'LGO'], services: ['IPD'],
        effective_from: '2569-07-01', effective_to: null,
        severity: 'WARNING', action: 'APPROVE', maps_to_nhso: null,
        doc_id: 'DOC-INT-2569-041', doc_ref: 'ระเบียบงานเวชระเบียน ข้อ 4.3',
        desc: 'เคสที่นอนนานกว่าจุดตัดบน (high outlier) ได้ค่าชดเชยเพิ่มก็จริง '
            + 'แต่ต้องมีบันทึกเหตุผลทางการแพทย์ประกอบ ไม่งั้นเสี่ยงถูกเรียกคืนตอน Audit',
        conditions: [
            { join: '',    field: 'จำนวนวันนอนที่เบิกได้',   op: 'มากกว่า', value: 'จุดตัดบนของกลุ่ม DRG' },
            { join: 'AND', field: 'บันทึกเหตุผลทางการแพทย์', op: 'ไม่มีค่า', value: '—' },
        ],
        kpi: { hit: 9, true_issue: 78, override: 18, false_positive: 22, prevented: 74800 },
    },
    {
        id: 'RUL-IPD-019', name: 'ใบสรุปการจำหน่ายต้องมีและลงนามแพทย์ผู้รักษา',
        category: 'เอกสารประกอบ', status: 'ACTIVE', version: 1,
        author: 'U-004', approver: 'U-008',
        funds: ['UC', 'OFC', 'SSS', 'LGO', 'EMS', 'PVT'], services: ['IPD'],
        effective_from: '2569-07-01', effective_to: null,
        severity: 'ERROR', action: 'FIX', maps_to_nhso: null,
        doc_id: 'DOC-INT-2569-041', doc_ref: 'ระเบียบงานเวชระเบียน ข้อ 3.1',
        desc: 'ทุกกองทุนบังคับใบสรุปการจำหน่ายที่ลงนามแพทย์ผู้รักษา — เป็นเอกสารที่ผู้ตรวจสอบ'
            + 'ของทุกกองทุนขอเป็นอันดับแรก และเป็นฐานของการให้รหัสโรค',
        conditions: [
            { join: '',   field: 'ใบสรุปการจำหน่าย',        op: 'ไม่พบ',    value: 'ในแฟ้มผู้ป่วยใน' },
            { join: 'OR', field: 'ลายเซ็นแพทย์ผู้รักษา',    op: 'ไม่มีค่า', value: '—' },
        ],
        kpi: { hit: 24, true_issue: 97, override: 2, false_positive: 3, prevented: 186300 },
    },
    {
        id: 'RUL-IPD-020', name: 'ประกันสังคม — ต้องมีหลักฐานสิทธิตามบัตรรับรองสิทธิหรือเกณฑ์ฉุกเฉิน',
        category: 'สิทธิและการปิดสิทธิ', status: 'ACTIVE', version: 1,
        author: 'U-004', approver: 'U-008',
        funds: ['SSS'], services: ['IPD'],
        effective_from: '2569-07-01', effective_to: null,
        severity: 'ERROR', action: 'FIX', maps_to_nhso: null,
        doc_id: 'DOC-INT-2569-042', doc_ref: 'เงื่อนไขกองทุนประกันสังคม ข้อ 1.2',
        desc: 'ผู้ประกันตนต้องเข้ารักษาที่สถานพยาบาลตามบัตรรับรองสิทธิ '
            + 'กรณีฉุกเฉินนอกสถานพยาบาลตามสิทธิเบิกได้เฉพาะ 72 ชั่วโมงแรก '
            + 'จึงต้องมีหลักฐานการตรวจสอบสิทธิ ณ วันรับไว้เก็บไว้ในแฟ้มทุกราย',
        conditions: [
            { join: '',   field: 'หลักฐานการตรวจสอบสิทธิ ณ วันรับไว้', op: 'ไม่พบ', value: 'ในแฟ้มผู้ป่วยใน' },
            { join: 'OR', field: 'สถานพยาบาลที่รับไว้',               op: 'ไม่ตรงกับ', value: 'บัตรรับรองสิทธิ' },
        ],
        kpi: { hit: 8, true_issue: 88, override: 6, false_positive: 12, prevented: 58400 },
    },
    {
        id: 'RUL-IPD-021', name: 'กรมบัญชีกลาง — ต้องมีเลขอนุมัติเบิกจ่ายตรงก่อนส่งเบิกผู้ป่วยใน',
        category: 'สิทธิและการปิดสิทธิ', status: 'ACTIVE', version: 1,
        author: 'U-004', approver: 'U-008',
        /* เฉพาะ OFC — เลข Approve Code เป็นกลไกของระบบเบิกจ่ายตรงกรมบัญชีกลาง
           ฝั่ง อปท. ใช้การตรวจสอบสิทธิคนละกลไก จึงไม่รวมไว้ในกฎข้อนี้ */
        funds: ['OFC'], services: ['IPD'],
        effective_from: '2569-07-01', effective_to: null,
        severity: 'ERROR', action: 'BLOCK', maps_to_nhso: 'C305',
        doc_id: 'DOC-NHSO-2569-008', doc_ref: 'ข้อ 3.4',
        desc: 'สิทธิเบิกจ่ายตรงต้องมีเลขอนุมัติ (Approve Code) ที่ตรงกับฐานข้อมูลหน่วยบริการ '
            + 'ถ้าไม่ตรงหรือไม่มี จะได้ C305 กลับมาแล้ววนแก้ — ตรวจตั้งแต่ก่อนส่งจึงตัดวงจรนี้ได้',
        conditions: [
            { join: '',   field: 'เลขอนุมัติ / Approve Code', op: 'ไม่มีค่า',  value: '—' },
            { join: 'OR', field: 'เลขอนุมัติที่บันทึกใน HIS',  op: 'ไม่ตรงกับ', value: 'ฐานข้อมูลหน่วยบริการ' },
        ],
        kpi: { hit: 16, true_issue: 94, override: 3, false_positive: 6, prevented: 224500 },
    },
    {
        id: 'RUL-IPD-022', name: 'ประกันเอกชน — ต้องมีใบเรียกร้องค่าสินไหม กรมธรรม์ และหนังสือยินยอม',
        category: 'เอกสารประกอบ', status: 'ACTIVE', version: 1,
        author: 'U-004', approver: 'U-008',
        funds: ['PVT'], services: ['IPD'],
        effective_from: '2569-07-01', effective_to: null,
        severity: 'ERROR', action: 'FIX', maps_to_nhso: null,
        doc_id: 'DOC-INT-2569-043', doc_ref: 'เงื่อนไขการเรียกเก็บบริษัทประกัน ข้อ 2.1–2.4',
        desc: 'การเรียกเก็บบริษัทประกันไม่ผ่านชุดข้อมูลมาตรฐาน สปสช. แต่ใช้ชุดเอกสารของบริษัท '
            + 'ขาดเอกสารข้อใดข้อหนึ่ง บริษัทจะตีกลับทั้งรายการและนับอายุความใหม่',
        conditions: [
            { join: '',   field: 'ใบเรียกร้องค่าสินไหมทดแทน',    op: 'ไม่พบ', value: 'หรือยังไม่ลงนามผู้เอาประกัน' },
            { join: 'OR', field: 'สำเนากรมธรรม์ / เลขกรมธรรม์',  op: 'ไม่พบ', value: '—' },
            { join: 'OR', field: 'หนังสือยินยอมเปิดเผยข้อมูล',   op: 'ไม่พบ', value: '—' },
        ],
        kpi: { hit: 14, true_issue: 92, override: 4, false_positive: 8, prevented: 143700 },
    },

    /* ══════════════════════════════════════════════════════
       กฎที่ "เขียนไว้แล้วแต่ยังเปิดใช้ไม่ได้" — รอเอกสารอ้างอิง

       ⚠️ ต่อท้ายอาร์เรย์เท่านั้น — claim-rules.js เลือกกฎแรกเป็นค่าเริ่มต้นของหน้า
          แทรกไว้ข้างบนแล้ว RUL-DRG-007 (สมอเดโม Maker–Checker) จะไม่ใช่หน้าแรกอีก

       ทุกข้อ status:'DRAFT' + blocked_by ชี้ไป IPD_SOURCES ใน mock-ipd.js
       → MockIpd.rulesFor() กรอง ACTIVE อยู่แล้ว จึงยังไม่ยิงกับเคสใด
       → ตรรกะการยิงเขียนไว้ครบใน MockIpd._ruleHit() แล้ว
          พอได้เอกสารมา เปลี่ยน status เป็น 'ACTIVE' ข้อเดียวก็ทำงานทันที

       นี่คือคำตอบรูปธรรมของคำถาม "ได้คู่มือ DRG มาแล้วเอามาตรวจจับอะไรได้บ้าง"
       ══════════════════════════════════════════════════════ */
    {
        id: 'RUL-IPD-023', name: 'รหัสที่บันทึกต้องจัดกลุ่ม DRG ได้ตรงกับที่ระบุในเวชระเบียน',
        category: 'Coding', status: 'DRAFT', version: 1,
        author: 'U-005', approver: null,
        funds: ['UC', 'OFC', 'SSS', 'LGO', 'EMS'], services: ['IPD'],
        effective_from: null, effective_to: null,
        severity: 'ERROR', action: 'FIX', maps_to_nhso: null,
        blocked_by: 'D4',
        doc_id: 'DOC-DRG-MANUAL', doc_ref: 'ตารางจับคู่ Dx–DRG (รอเอกสาร)',
        desc: 'จัดกลุ่มซ้ำจากรหัสที่บันทึกจริงแล้วเทียบกับกลุ่มที่ระบุไว้ในแฟ้ม '
            + 'ถ้าไม่ตรงแปลว่าให้รหัสผิดหรือระบุกลุ่มผิด ซึ่งกระทบค่าชดเชยโดยตรง',
        conditions: [
            { join: '',    field: 'กลุ่ม DRG ที่จัดได้จาก PDx/SDx/Proc', op: 'ไม่ตรงกับ', value: 'กลุ่มที่ระบุในแฟ้ม 14' },
        ],
        kpi: { hit: 0, true_issue: 0, override: 0, false_positive: 0, prevented: 0 },
    },
    {
        id: 'RUL-IPD-024', name: 'เตือนเมื่อการวินิจฉัยร่วมที่เพิ่มทำให้ RW ขยับขึ้นผิดปกติ',
        category: 'Coding', status: 'DRAFT', version: 1,
        author: 'U-005', approver: null,
        funds: ['UC', 'OFC', 'SSS', 'LGO'], services: ['IPD'],
        effective_from: null, effective_to: null,
        severity: 'WARNING', action: 'APPROVE', maps_to_nhso: null,
        blocked_by: 'D4',
        doc_id: 'DOC-DRG-MANUAL', doc_ref: 'ตาราง RW รายกลุ่ม (รอเอกสาร)',
        desc: 'คัดกรองการให้รหัสเกินจริง (upcoding) — เทียบ RW ของกลุ่มที่ได้กับกลุ่มที่ได้'
            + 'เมื่อตัด SDx ที่ไม่มีหลักฐานสนับสนุนออก ส่วนต่างที่สูงผิดปกติต้องมีผู้ทบทวนรับรอง',
        conditions: [
            { join: '',    field: 'RW เมื่อรวม SDx ทั้งหมด',        op: 'มากกว่า', value: 'RW เมื่อนับเฉพาะ SDx ที่มีผลตรวจรองรับ' },
            { join: 'AND', field: 'ส่วนต่าง RW',                     op: 'มากกว่า', value: 'เกณฑ์ที่โรงพยาบาลกำหนด' },
        ],
        kpi: { hit: 0, true_issue: 0, override: 0, false_positive: 0, prevented: 0 },
    },
    {
        id: 'RUL-IPD-025', name: 'เตือนเมื่อการวินิจฉัยหลักที่เลือกให้ RW ต่ำกว่าที่รหัสในแฟ้มรองรับ',
        category: 'Coding', status: 'DRAFT', version: 1,
        author: 'U-005', approver: null,
        funds: ['UC', 'OFC', 'SSS', 'LGO'], services: ['IPD'],
        effective_from: null, effective_to: null,
        severity: 'WARNING', action: 'WARN', maps_to_nhso: null,
        blocked_by: 'D4',
        doc_id: 'DOC-DRG-MANUAL', doc_ref: 'ตาราง RW รายกลุ่ม (รอเอกสาร)',
        desc: 'อีกด้านของ RUL-IPD-024 — จับการให้รหัสต่ำกว่าที่ควร (downcoding) '
            + 'ซึ่งทำให้โรงพยาบาลเสียรายได้ที่ควรได้ ไม่ใช่เรื่องทุจริตแต่เป็นเรื่องคุณภาพการให้รหัส',
        conditions: [
            { join: '',    field: 'RW ของกลุ่มที่ได้จาก PDx ที่เลือก', op: 'น้อยกว่า', value: 'RW ของกลุ่มที่ได้จาก PDx อื่นที่แฟ้มรองรับ' },
        ],
        kpi: { hit: 0, true_issue: 0, override: 0, false_positive: 0, prevented: 0 },
    },
    {
        id: 'RUL-IPD-026', name: 'วันนอนต้องอยู่ในจุดตัดจริงของกลุ่ม DRG ตามคู่มือ',
        category: 'ความครบของข้อมูล', status: 'DRAFT', version: 1,
        author: 'U-005', approver: null,
        funds: ['UC', 'OFC', 'SSS', 'LGO'], services: ['IPD'],
        effective_from: null, effective_to: null,
        severity: 'WARNING', action: 'APPROVE', maps_to_nhso: null,
        blocked_by: 'D4',
        doc_id: 'DOC-DRG-MANUAL', doc_ref: 'ตารางจุดตัดวันนอน (รอเอกสาร)',
        desc: 'ฉบับที่ใช้จุดตัดจริงจากคู่มือ — จะมาแทน RUL-IPD-018 ที่ตอนนี้ใช้จุดตัดจำลอง '
            + 'จุดตัดที่ผิดทำให้จับ outlier ผิดตัวทั้งสองทาง',
        conditions: [
            { join: '',   field: 'วันนอนที่เบิกได้', op: 'อยู่นอกช่วง', value: 'จุดตัดล่าง–บนของกลุ่มตามคู่มือ' },
        ],
        kpi: { hit: 0, true_issue: 0, override: 0, false_positive: 0, prevented: 0 },
    },
    {
        id: 'RUL-IPD-027', name: 'ค่าห้องและค่าอาหารต้องไม่เกินเพดานของกองทุน',
        category: 'ราคาและค่าใช้จ่าย', status: 'DRAFT', version: 1,
        author: 'U-004', approver: null,
        funds: ['OFC', 'LGO'], services: ['IPD'],
        effective_from: null, effective_to: null,
        severity: 'ERROR', action: 'FIX', maps_to_nhso: null,
        blocked_by: 'D6',
        doc_id: 'DOC-FUND-OFC', doc_ref: 'อัตราค่าห้องและค่าอาหาร (รอเอกสาร)',
        desc: 'ส่วนที่เกินเพดานต้องให้ผู้ป่วยรับผิดชอบและต้องมีหนังสือยินยอม '
            + 'ถ้าส่งเบิกทั้งจำนวนจะถูกตัดตอนตรวจสอบและกลายเป็นลูกหนี้ค้าง',
        conditions: [
            { join: '',    field: 'ค่าห้อง/ค่าอาหารต่อวัน (BILLGRCS 02)', op: 'มากกว่า', value: 'เพดานตามประกาศของกองทุน' },
            { join: 'AND', field: 'หนังสือยินยอมส่วนเกิน',                op: 'ไม่พบ',   value: 'ในแฟ้มผู้ป่วยใน' },
        ],
        kpi: { hit: 0, true_issue: 0, override: 0, false_positive: 0, prevented: 0 },
    },
    {
        id: 'RUL-IPD-028', name: 'ต้องยื่นภายในกำหนดจริงของแต่ละกองทุน',
        category: 'ขอบเขตการใช้งาน', status: 'DRAFT', version: 1,
        author: 'U-004', approver: null,
        funds: ['UC', 'OFC', 'SSS', 'LGO', 'EMS', 'PVT'], services: ['IPD'],
        effective_from: null, effective_to: null,
        severity: 'ERROR', action: 'BLOCK', maps_to_nhso: null,
        blocked_by: 'D5',
        doc_id: 'DOC-FUND-DUE', doc_ref: 'กำหนดเวลายื่นรายกองทุน (รอเอกสาร)',
        desc: 'ตอนนี้ระบบใช้ 30 วันเท่ากันทุกกองทุนเพราะยังไม่มีประกาศฉบับจริง '
            + 'ซึ่งไม่ตรงความจริง — แต่ละกองทุนกำหนดคนละกรอบเวลาและนับตั้งต้นคนละจุด '
            + 'เลยกำหนดแล้วเรียกเก็บไม่ได้เลย ไม่ใช่แค่ช้า',
        conditions: [
            { join: '',    field: 'วันที่ยื่นเรียกเก็บ', op: 'หลังจาก', value: 'กำหนดยื่นตามประกาศของกองทุนนั้น' },
        ],
        kpi: { hit: 0, true_issue: 0, override: 0, false_positive: 0, prevented: 0 },
    },
    {
        id: 'RUL-IPD-029', name: 'UCEP — เกิน 72 ชั่วโมงต้องย้ายไปใช้สิทธิหลักของผู้ป่วย',
        category: 'สิทธิและการปิดสิทธิ', status: 'DRAFT', version: 1,
        author: 'U-004', approver: null,
        funds: ['EMS'], services: ['IPD'],
        effective_from: null, effective_to: null,
        severity: 'ERROR', action: 'FIX', maps_to_nhso: null,
        blocked_by: 'D8',
        doc_id: 'DOC-FUND-UCEP', doc_ref: 'เงื่อนไข 72 ชั่วโมง (รอเอกสาร)',
        desc: 'สิทธิ UCEP ครอบคลุมเฉพาะช่วงวิกฤต 72 ชั่วโมงแรก '
            + 'ส่วนที่เกินต้องเบิกจากสิทธิหลัก และต้องมีหลักฐานการประสานย้ายผู้ป่วย',
        conditions: [
            { join: '',    field: 'ระยะเวลานับจากรับไว้', op: 'มากกว่า', value: '72 ชั่วโมง' },
            { join: 'AND', field: 'การเปลี่ยนสิทธิผู้จ่าย', op: 'ไม่พบ',   value: 'ในระเบียนการนอน' },
        ],
        kpi: { hit: 0, true_issue: 0, override: 0, false_positive: 0, prevented: 0 },
    },
];

/** ประวัติเวอร์ชัน — พิสูจน์ BR-02 ว่ากฎ Active ไม่เคยถูกแก้ทับ */
const MOCK_RULE_VERSIONS = {
    'RUL-DRG-007': [
        { version: 3, status: 'ACTIVE',  author: 'U-005', approver: 'U-008', effective_from: '2569-07-20',
          note: 'ขยายให้ครอบคลุม BILLGRCS 03 และเปลี่ยนระดับผลจาก "แจ้งเตือน" เป็น "ต้องแก้ไข"' },
        { version: 2, status: 'RETIRED', author: 'U-005', approver: 'U-008', effective_from: '2569-03-01',
          note: 'เพิ่มกองทุน OFC/SSS/LGO แต่ยังไม่ครอบคลุมหมวดยาสารอาหารทางเส้นเลือด' },
        { version: 1, status: 'RETIRED', author: 'U-004', approver: 'U-008', effective_from: '2568-10-01',
          note: 'รุ่นแรก — เฉพาะกองทุน UC ระดับแจ้งเตือน' },
    ],
    'RUL-CDX-009': [
        { version: 2, status: 'ACTIVE',  author: 'U-005', approver: 'U-008', effective_from: '2569-05-15',
          note: 'ปรับตารางคู่ Dx–Proc ตามประกาศฉบับใหม่ ลด False Positive จาก 34% เหลือ 22%' },
        { version: 1, status: 'RETIRED', author: 'U-005', approver: 'U-008', effective_from: '2569-01-10', note: 'รุ่นแรก' },
    ],
    'RUL-DOC-002': [
        { version: 2, status: 'ACTIVE',  author: 'U-004', approver: 'U-008', effective_from: '2569-03-01', note: 'เพิ่มรายการเอกสารของกองทุน OFC' },
        { version: 1, status: 'RETIRED', author: 'U-004', approver: 'U-008', effective_from: '2568-11-01', note: 'รุ่นแรก' },
    ],
    'RUL-EMR-003': [
        { version: 2, status: 'ACTIVE',  author: 'U-004', approver: 'U-008', effective_from: '2569-04-01', note: 'เพิ่มการตรวจพิกัดจุดเกิดเหตุ' },
        { version: 1, status: 'RETIRED', author: 'U-004', approver: 'U-008', effective_from: '2568-12-01', note: 'รุ่นแรก' },
    ],
};

/** Template สำเร็จรูปที่ผู้ได้รับสิทธิ์สร้างกฎเองได้โดยไม่ต้องเขียนโค้ด (FR-04) */
const MOCK_RULE_TEMPLATES = [
    { key: 'REQUIRED',  icon: 'check-square',  name: 'ตรวจความครบของฟิลด์',
      desc: 'บังคับให้ฟิลด์ที่เลือกต้องมีค่าก่อนส่งเบิก', maps: null },
    { key: 'RANGE',     icon: 'sliders',       name: 'ตรวจช่วงค่า',
      desc: 'ค่าต้องอยู่ในช่วงที่กำหนด เช่น จำนวนวันนอน จำนวนหน่วยยา', maps: null },
    { key: 'DXPROC',    icon: 'git-merge',     name: 'ตรวจความสัมพันธ์ Dx – Proc',
      desc: 'รหัสหัตถการต้องสอดคล้องกับการวินิจฉัยตามตารางคู่', maps: 'P061' },
    { key: 'CATALOGUE', icon: 'tag',           name: 'ตรวจราคาเทียบ Drug Catalogue',
      desc: 'ราคาที่เบิกต้องไม่เกินราคาในแคตตาล็อกที่มีผล ณ วันที่รับบริการ', maps: 'P124' },
    { key: 'APPROVE',   icon: 'key-round',     name: 'ตรวจเลขปิดสิทธิ / Approve Code',
      desc: 'เลขที่บันทึกต้องตรงกับฐานข้อมูลหน่วยบริการ', maps: 'C305' },
    { key: 'DOCS',      icon: 'paperclip',     name: 'ตรวจเอกสารแนบ',
      desc: 'เอกสารที่ต้องมีตามประเภทเคสต้องครบก่อนส่ง', maps: null },
];

/** ผลทดสอบย้อนหลัง — ต้องรันก่อนขออนุมัติเปิดใช้ */
const MOCK_RULE_TESTS = {
    'RUL-DRG-007': {
        dataset: 'เคสย้อนหลัง 1,240 เคส (ก.พ.–มิ.ย. 2569)', ran_at: '2569-08-05T15:40', ran_by: 'U-005',
        rows: [
            { claim: 'CLM-2569-0007', expect: 'ต้องแก้ไข', actual: 'ต้องแก้ไข', pass: true },
            { claim: 'CLM-2569-0042', expect: 'ต้องแก้ไข', actual: 'ต้องแก้ไข', pass: true },
            { claim: 'CLM-2569-0012', expect: 'ผ่าน',      actual: 'ผ่าน',      pass: true },
            { claim: 'CLM-2569-0029', expect: 'ผ่าน',      actual: 'ผ่าน',      pass: true },
            { claim: 'CLM-2569-0038', expect: 'ผ่าน',      actual: 'แจ้งเตือน', pass: false },
        ],
        summary: { hit: 38, true_issue: 92, override: 5, false_positive: 8 },
    },
};

const MockRules = {
    all()    { return MockDB.all('rules'); },
    byId(id) { return MockDB.byId('rules', id); },
    active() { return this.all().filter(r => r.status === 'ACTIVE'); },
    byStatus(s) { return s === 'all' ? this.all() : this.all().filter(r => r.status === s); },

    versions(id) { return MOCK_RULE_VERSIONS[id] || [{ version: 1, status: 'DRAFT', author: 'U-005',
        approver: null, effective_from: '2569-09-01', note: 'ร่างแรก' }]; },

    /** BR-05 — ผู้เขียนกฎอนุมัติกฎของตัวเองไม่ได้ */
    canActivate(rule) {
        return rule.author !== MockSession.userId()
            && MockAdmin.can(MockSession.current(), 'APPROVE_RULE');
    },

    /** รวมมูลค่าที่กฎทั้งหมดป้องกันไว้ได้ */
    totalPrevented() { return this.active().reduce((a, r) => a + (r.kpi.prevented || 0), 0); },

    nextDraftId(prefix) {
        const n = this.all().filter(r => r.id.startsWith(prefix)).length + 1;
        return `${prefix}-${String(900 + n)}`;
    },

    /**
     * SRS BR-03 / FR-05 — ผลตรวจทุกครั้งต้องย้อนกลับได้ถึงแหล่งอ้างอิง
     * คืน { text, verified } เพื่อให้หน้าจอขึ้นป้าย "รอยืนยัน" ได้ตรงจุด
     */
    origin(rule) {
        if (!rule) return null;
        /* กฎที่ยังรอเอกสารต้องบอกตรง ๆ ว่ายังอ้างอิงไม่ได้
           ⚠️ ต้องเช็กก่อน 2 เงื่อนไขล่าง ไม่งั้นกฎที่ไม่มีทั้ง origin_doc และ maps_to_nhso
              จะตกไปที่บรรทัดสุดท้ายแล้วได้ป้ายเขียว "อ้างหน้าเอกสารได้" ซึ่งตรงข้ามกับความจริง */
        if (rule.blocked_by) {
            const s = (window.IPD_SOURCES || []).find(x => x.id === rule.blocked_by);
            return { text: `รอเอกสาร [${rule.blocked_by}] ${s ? s.title : ''}`.trim(), verified: false };
        }
        if (rule.origin_doc) return { text: rule.origin_doc, verified: true };
        if (rule.maps_to_nhso) {
            return {
                text: 'โครงการ NHSO Digital Platform Communication V4 · 3 ส.ค. 2569 (ภาพหน้าจอ)',
                verified: false,
            };
        }
        return { text: 'ระเบียบ/คู่มือภายในโรงพยาบาล', verified: true };
    },

    /** กฎที่ถอดมาจากเอกสาร สปสช. โดยตรง (อ้างหน้าได้) */
    fromNhsoDoc() { return this.all().filter(r => !!r.origin_doc); },
};

MockDB.register('rules', MOCK_RULES);

window.RULE_LIFECYCLE      = RULE_LIFECYCLE;
window.MOCK_RULES          = MOCK_RULES;
window.MOCK_RULE_VERSIONS  = MOCK_RULE_VERSIONS;
window.MOCK_RULE_TEMPLATES = MOCK_RULE_TEMPLATES;
window.MOCK_RULE_TESTS     = MOCK_RULE_TESTS;
window.MockRules           = MockRules;
