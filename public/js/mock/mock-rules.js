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
};

MockDB.register('rules', MOCK_RULES);

window.RULE_LIFECYCLE      = RULE_LIFECYCLE;
window.MOCK_RULES          = MOCK_RULES;
window.MOCK_RULE_VERSIONS  = MOCK_RULE_VERSIONS;
window.MOCK_RULE_TEMPLATES = MOCK_RULE_TEMPLATES;
window.MOCK_RULE_TESTS     = MOCK_RULE_TESTS;
window.MockRules           = MockRules;
