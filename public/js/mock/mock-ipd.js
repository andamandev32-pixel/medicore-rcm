/**
 * MediCore RCM — MOCK IPD (งานผู้ป่วยใน: ติดตามระหว่างนอน + ตรวจแฟ้มก่อนส่งเบิก)
 * ------------------------------------------------------------
 * โมดูลนี้เติมช่วงที่หายไปของเส้นงาน — เดิมทั้งระบบเป็น OPD-centric
 * เส้นงานที่โมดูลนี้ครอบ:
 *   รับไว้เป็นผู้ป่วยใน → ติดตามระหว่างนอน → จำหน่าย → ตรวจแฟ้ม/ประเมินตามเงื่อนไขกองทุน
 *   → ผ่าน → ต่อคิวส่งเบิกที่ claim-worklist / nhso-submit ของเดิม
 *
 * ⚠️ ต้องโหลด "หลัง" mock-nhso.js และ mock-claims.js
 *    — fileCheck() เรียก MockNhso.checkFiles() และเคสที่จำหน่ายแล้วฉายจากตาราง claims
 *
 * ⚠️ ความถูกต้องของข้อมูล — โปรดอ่านก่อนนำไปนำเสนอ
 *    ค่า RW / trim point / ALOS / อัตราจ่ายต่อ RW และเงื่อนไขรายกองทุนในไฟล์นี้
 *    "ยังไม่ได้ถอดจากเอกสารฉบับจริง" — ไม่มีคู่มือ Thai DRG หรือประกาศอัตราจ่าย
 *    อยู่ใน doc/ (มีแค่เอกสาร NHSO Digital Platform 2 ฉบับ)
 *    จึงตั้ง verified:false ไว้ทั้งหมด และทุกหน้าจอที่แสดงค่าเหล่านี้
 *    ต้องขึ้นป้าย "รอยืนยัน" — แบบเดียวกับที่ mock-nhso.js ทำกับรหัสสถานะ สปสช.
 *    เมื่อได้เอกสารจริงมาให้แทนที่ทั้งชุด แล้วเปลี่ยน verified เป็น true
 *
 * วันอ้างอิง: 6 ส.ค. 2569 (MockDB.TODAY) · วันที่ทั้งไฟล์เป็น พ.ศ.
 */

/** ป้ายมาตรฐานสำหรับค่าที่ยังยืนยันกับเอกสารไม่ได้ — ล้อ NHSO_UNVERIFIED_NOTE */
const IPD_UNVERIFIED_NOTE = 'รอยืนยัน — ค่าจำลอง ยังไม่ได้ถอดจากคู่มือ Thai DRG / ประกาศอัตราจ่ายฉบับจริง';


/* ══════════════════════════════════════════════════════════
   1. หอผู้ป่วย · สถานะการนอน · สถานะการตรวจแฟ้ม
   ══════════════════════════════════════════════════════════ */

const IPD_WARDS = [
    { key: 'MED-2', label: 'อายุรกรรมชาย ชั้น 2',  type: 'MED', beds: 30 },
    { key: 'MED-3', label: 'อายุรกรรมหญิง ชั้น 3', type: 'MED', beds: 30 },
    { key: 'SUR-4', label: 'ศัลยกรรม ชั้น 4',      type: 'SUR', beds: 26 },
    { key: 'OBG-5', label: 'สูติ-นรีเวช ชั้น 5',    type: 'OBG', beds: 22 },
    { key: 'PED-6', label: 'กุมารเวช ชั้น 6',       type: 'PED', beds: 18 },
    { key: 'ICU-1', label: 'ไอซียูรวม ชั้น 1',      type: 'ICU', beds: 10 },
];

/** สถานะการนอน — badge ต้องเป็นคลาสที่ ds-components.css มีอยู่จริง */
const IPD_STAY_STATUS = [
    { key: 'ADMITTED',     label: 'กำลังนอน',        badge: 'in-progress', open: true },
    { key: 'LEAVE',        label: 'ลากลับบ้าน',       badge: 'waiting',     open: true },
    { key: 'DISCHARGED',   label: 'จำหน่ายแล้ว',      badge: 'completed',   open: false },
    { key: 'REFERRED_OUT', label: 'ส่งต่อออก',        badge: 'scheduled',   open: false },
    { key: 'DEAD',         label: 'เสียชีวิต',        badge: 'danger',      open: false },
];

/** สถานะคิวตรวจแฟ้ม — ใช้เป็น pill ของหน้า ipd-audit */
const IPD_AUDIT_STATUS = [
    { key: 'NOT_READY', label: 'ยังไม่จำหน่าย', badge: 'inactive' },
    { key: 'PENDING',   label: 'รอตรวจ',        badge: 'pending' },
    { key: 'IN_REVIEW', label: 'กำลังตรวจ',      badge: 'in-progress' },
    { key: 'RETURNED',  label: 'ตีกลับให้แก้',   badge: 'danger' },
    { key: 'CLEARED',   label: 'ผ่าน — ส่งเบิกได้', badge: 'completed' },
];

/** DISCHT — ประเภทการจำหน่าย (โครงสร้างแฟ้ม 14) */
const IPD_DISCHARGE_TYPE = [
    { code: '1', label: 'จำหน่ายปกติ' },
    { code: '2', label: 'ส่งต่อไปสถานพยาบาลอื่น' },
    { code: '3', label: 'ไม่สมัครใจอยู่รักษา' },
    { code: '4', label: 'หนีกลับ' },
    { code: '8', label: 'เสียชีวิต' },
];

/** DISCHS — สถานะผู้ป่วยเมื่อจำหน่าย (โครงสร้างแฟ้ม 14) */
const IPD_DISCHARGE_STATUS = [
    { code: '1', label: 'หายหรือทุเลา' },
    { code: '2', label: 'อาการไม่ดีขึ้น' },
    { code: '3', label: 'เสียชีวิต' },
];

/** สถานะของแต่ละข้อในรายการตรวจ — 3 สถานะ ต่างจาก checklist แบบ done/ไม่ done ของ mock-tasks */
const IPD_CHECK_STATE = {
    OK:      { label: 'ครบ',        chip: 'sip-chip-success', icon: 'check' },
    MISSING: { label: 'ไม่ครบ',      chip: 'sip-chip-danger',  icon: 'x' },
    NA:      { label: 'ไม่เกี่ยวข้อง', chip: 'sip-chip-muted',   icon: 'minus' },
};


/* ══════════════════════════════════════════════════════════
   2. กองทุน 6 กองทุน + เงื่อนไขตรวจแฟ้มผู้ป่วยในรายกองทุน

   ต่อยอดจาก CLAIM_FUNDS (mock-claims.js) — เพิ่ม PVT ที่ไม่ผ่าน NHSO
   nhsoFund ชี้ไปที่ key ของ NHSO_FUND_FILES (mock-nhso.js) เพื่อใช้ checkFiles()
   ══════════════════════════════════════════════════════════ */

const IPD_FUNDS = [
    { key: 'UC',  label: 'บัตรทอง (UC)',              short: 'บัตรทอง',    payer: 'สปสช.',
      nhso: true,  nhsoFund: 'IP' },
    { key: 'OFC', label: 'ข้าราชการ (กรมบัญชีกลาง)',  short: 'ข้าราชการ',  payer: 'กรมบัญชีกลาง',
      nhso: true,  nhsoFund: 'IP' },
    { key: 'SSS', label: 'ประกันสังคม',                short: 'ประกันสังคม', payer: 'สำนักงานประกันสังคม',
      nhso: true,  nhsoFund: 'IP' },
    { key: 'LGO', label: 'พนักงานส่วนท้องถิ่น (อปท.)', short: 'อปท.',       payer: 'สปสช. (แทน อปท.)',
      nhso: true,  nhsoFund: 'IP' },
    { key: 'EMS', label: 'เจ็บป่วยฉุกเฉินวิกฤต (UCEP)', short: 'UCEP',       payer: 'สปสช.',
      nhso: true,  nhsoFund: 'IP' },
    { key: 'PVT', label: 'ประกันชีวิต / สุขภาพเอกชน',  short: 'ประกันเอกชน', payer: 'บริษัทประกัน',
      nhso: false, nhsoFund: null },
];

/**
 * เงื่อนไขการตรวจแฟ้มผู้ป่วยในของแต่ละกองทุน — หัวใจของหน้า ipd-audit
 * แต่ละคีย์กลายเป็นรายการติ๊กบนหน้าจอ 1 ข้อ (ดู MockIpd.fundCheckItems)
 *
 * ⚠️ verified:false ทุกกองทุน — เนื้อหาด้านล่างเรียบเรียงจากความเข้าใจทั่วไป
 *    ยังไม่ได้เทียบกับประกาศ/คู่มือฉบับจริงของแต่ละกองทุน
 *    ต้องให้เจ้าหน้าที่ที่รับผิดชอบกองทุนนั้นตรวจก่อนใช้อ้างอิง
 */
const IPD_FUND_RULES = {
    UC: {
        verified: false,
        preAuth: { required: false,
                   label: 'การอนุมัติล่วงหน้า',
                   note: 'ผู้ป่วยในทั่วไปไม่ต้องขออนุมัติล่วงหน้า ยกเว้นกลุ่มโรค/หัตถการที่ประกาศกำหนด' },
        submitDue: { days: 30, from: 'วันจำหน่าย',
                     note: 'ยื่นข้อมูลภายใน 30 วันนับจากวันจำหน่าย' },
        channel: 'NHSO Digital Platform — แฟ้ม 1–8, 14 และ 15 (เมื่อมีการลากลับบ้าน)',
        payment: { drg: true, note: 'จ่ายตามระบบกลุ่มวินิจฉัยโรคร่วม (DRG) ตามอัตราต่อ RW ที่ประกาศ' },
        docs: [
            { key: 'admission_note',    label: 'ใบรับผู้ป่วยใน (Admission note)' },
            { key: 'discharge_summary', label: 'ใบสรุปการจำหน่าย ลงนามแพทย์ผู้รักษา' },
            { key: 'charge_summary',    label: 'ใบสรุปค่ารักษาพยาบาล' },
            { key: 'id_copy',           label: 'สำเนาบัตรประชาชน / เอกสารแสดงตน' },
            { key: 'dx_support',        label: 'ผลตรวจสนับสนุนการวินิจฉัยหลัก' },
        ],
        limits: ['ค่าห้อง/ค่าอาหารเบิกได้ตามอัตราห้องสามัญ ส่วนเกินผู้ป่วยรับผิดชอบ'],
    },

    OFC: {
        verified: false,
        preAuth: { required: true,
                   label: 'เลขอนุมัติ / Approve Code',
                   note: 'ระบบเบิกจ่ายตรง — ต้องมีเลขอนุมัติที่ตรงกับฐานข้อมูลหน่วยบริการ '
                       + '(ไม่ตรง = NHSO ตอบกลับ C305 ตามกฎ RUL-ELG-004)' },
        submitDue: { days: 30, from: 'วันจำหน่าย',
                     note: 'ยื่นภายใน 30 วันนับจากวันจำหน่าย' },
        channel: 'NHSO Digital Platform (เบิกจ่ายตรงกรมบัญชีกลาง) — แฟ้ม 1–8, 14, 15',
        payment: { drg: true, note: 'จ่ายตาม DRG อัตราต่อ RW ของกรมบัญชีกลาง' },
        docs: [
            { key: 'admission_note',    label: 'ใบรับผู้ป่วยใน (Admission note)' },
            { key: 'discharge_summary', label: 'ใบสรุปการจำหน่าย ลงนามแพทย์ผู้รักษา' },
            { key: 'charge_summary',    label: 'ใบสรุปค่ารักษาพยาบาล แยกหมวดค่าใช้จ่าย' },
            { key: 'approve_code',      label: 'หลักฐานเลขอนุมัติ / การยืนยันสิทธิเบิกจ่ายตรง' },
            { key: 'room_upgrade',      label: 'หนังสือยินยอมกรณีใช้ห้องพิเศษเกินสิทธิ' },
        ],
        limits: ['ห้องพิเศษเบิกได้ไม่เกินอัตราที่กรมบัญชีกลางกำหนด ส่วนเกินผู้ป่วยรับผิดชอบ',
                 'ยานอกบัญชียาหลักต้องมีเหตุผลทางการแพทย์กำกับ'],
    },

    SSS: {
        verified: false,
        preAuth: { required: false,
                   label: 'สถานพยาบาลตามบัตรรับรองสิทธิ',
                   note: 'ต้องเป็นสถานพยาบาลตามบัตรรับรองสิทธิ หรือเข้าเกณฑ์ฉุกเฉิน '
                       + '(เบิกได้ 72 ชั่วโมงแรก แล้วต้องย้ายกลับสถานพยาบาลตามสิทธิ)' },
        submitDue: { days: 30, from: 'วันจำหน่าย',
                     note: 'ยื่นภายใน 30 วันนับจากวันจำหน่าย' },
        channel: 'NHSO Digital Platform — แฟ้ม 1–8, 14, 15',
        payment: { drg: true, note: 'จ่ายตาม DRG อัตราต่อ RW ของกองทุนประกันสังคม' },
        docs: [
            { key: 'admission_note',    label: 'ใบรับผู้ป่วยใน (Admission note)' },
            { key: 'discharge_summary', label: 'ใบสรุปการจำหน่าย ลงนามแพทย์ผู้รักษา' },
            { key: 'charge_summary',    label: 'ใบสรุปค่ารักษาพยาบาล' },
            { key: 'sss_card',          label: 'สำเนาบัตรรับรองสิทธิ / การตรวจสอบสิทธิ ณ วันรับไว้' },
            { key: 'med_cert',          label: 'ใบรับรองแพทย์ (กรณีต้องใช้สิทธิเงินทดแทนการขาดรายได้)' },
        ],
        limits: ['กรณีคลอดบุตรและทันตกรรมมีเงื่อนไข/เพดานแยกจากผู้ป่วยในทั่วไป',
                 'กรณีฉุกเฉินนอกสถานพยาบาลตามสิทธิ เบิกได้เฉพาะ 72 ชั่วโมงแรก'],
    },

    LGO: {
        verified: false,
        preAuth: { required: true,
                   label: 'การตรวจสอบสิทธิ อปท.',
                   note: 'ตรวจสอบสิทธิพนักงานส่วนท้องถิ่นและผู้มีสิทธิร่วมก่อนรับไว้ '
                       + 'เงื่อนไขส่วนใหญ่อิงระเบียบเดียวกับกรมบัญชีกลาง' },
        submitDue: { days: 30, from: 'วันจำหน่าย',
                     note: 'ยื่นภายใน 30 วันนับจากวันจำหน่าย' },
        channel: 'NHSO Digital Platform (สปสช. บริหารแทน อปท.) — แฟ้ม 1–8, 14, 15',
        payment: { drg: true, note: 'จ่ายตาม DRG อัตราต่อ RW ของกองทุน อปท.' },
        docs: [
            { key: 'admission_note',    label: 'ใบรับผู้ป่วยใน (Admission note)' },
            { key: 'discharge_summary', label: 'ใบสรุปการจำหน่าย ลงนามแพทย์ผู้รักษา' },
            { key: 'charge_summary',    label: 'ใบสรุปค่ารักษาพยาบาล' },
            { key: 'lgo_verify',        label: 'หลักฐานการตรวจสอบสิทธิ อปท. ณ วันรับไว้' },
            { key: 'room_upgrade',      label: 'หนังสือยินยอมกรณีใช้ห้องพิเศษเกินสิทธิ' },
        ],
        limits: ['เพดานค่าห้อง/ค่าอาหารอิงระเบียบเดียวกับกรมบัญชีกลาง'],
    },

    EMS: {
        verified: false,
        preAuth: { required: true,
                   label: 'เกณฑ์คัดแยกฉุกเฉินวิกฤต',
                   note: 'ต้องมีผลคัดแยกว่าเข้าเกณฑ์ฉุกเฉินวิกฤต (สีแดง) จึงเข้าเงื่อนไข UCEP '
                       + 'ถ้าไม่เข้าเกณฑ์ ต้องกลับไปใช้สิทธิหลักของผู้ป่วย' },
        submitDue: { days: 30, from: 'วันจำหน่าย',
                     note: 'ยื่นภายใน 30 วันนับจากวันจำหน่าย' },
        channel: 'NHSO Digital Platform — แฟ้ม 1–9, 14, 15 (ต้องมีแฟ้ม 9 AER)',
        payment: { drg: false, note: 'ช่วง 72 ชั่วโมงแรกจ่ายตามอัตรา UCEP หลังจากนั้นกลับสู่สิทธิหลัก' },
        docs: [
            { key: 'triage_form',       label: 'แบบบันทึกการคัดแยกระดับความฉุกเฉิน' },
            { key: 'er_note',           label: 'บันทึกการรักษาห้องฉุกเฉิน' },
            { key: 'admission_note',    label: 'ใบรับผู้ป่วยใน (Admission note)' },
            { key: 'discharge_summary', label: 'ใบสรุปการจำหน่าย ลงนามแพทย์ผู้รักษา' },
            { key: 'transfer_doc',      label: 'หลักฐานการประสานย้ายผู้ป่วยเมื่อพ้นภาวะวิกฤต' },
        ],
        limits: ['ครอบคลุมเฉพาะ 72 ชั่วโมงแรกนับจากรับไว้ ส่วนที่เกินเบิกจากสิทธิหลัก',
                 'ต้องส่งแฟ้ม 9 (NHSO AER) ครบถ้วน'],
    },

    PVT: {
        verified: false,
        preAuth: { required: true,
                   label: 'การอนุมัติล่วงหน้า (Pre-authorization)',
                   note: 'บริษัทประกันส่วนใหญ่ต้องแจ้งและได้รับอนุมัติวงเงินก่อนหรือภายใน 24 ชม. '
                       + 'หลังรับไว้ — ไม่แจ้ง = เสี่ยงถูกปฏิเสธทั้งรายการ' },
        submitDue: { days: 30, from: 'วันจำหน่าย',
                     note: 'ยื่นตามเงื่อนไขกรมธรรม์ โดยทั่วไปภายใน 30 วันนับจากวันจำหน่าย' },
        channel: 'ยื่นตรงต่อบริษัทประกัน — ไม่ผ่าน NHSO Digital Platform',
        payment: { drg: false, note: 'จ่ายตามค่าใช้จ่ายจริงภายใต้เพดานกรมธรรม์ ไม่ใช่ระบบ DRG' },
        docs: [
            { key: 'policy_doc',        label: 'สำเนากรมธรรม์ / บัตรสมาชิก + เลขกรมธรรม์' },
            { key: 'claim_form',        label: 'ใบเรียกร้องค่าสินไหมทดแทน กรอกครบและลงนามผู้เอาประกัน' },
            { key: 'med_cert',          label: 'ใบรับรองแพทย์ระบุการวินิจฉัยและระยะเวลารักษา' },
            { key: 'consent',           label: 'หนังสือยินยอมเปิดเผยข้อมูลทางการแพทย์' },
            { key: 'charge_summary',    label: 'ใบแจ้งหนี้/ใบเสร็จรับเงิน แยกหมวดค่าใช้จ่าย' },
            { key: 'discharge_summary', label: 'ใบสรุปการจำหน่าย ลงนามแพทย์ผู้รักษา' },
        ],
        limits: ['วงเงินและความคุ้มครองเป็นไปตามกรมธรรม์รายฉบับ',
                 'โรคที่เป็นก่อนทำประกัน / ระยะรอคอย อาจไม่ได้รับความคุ้มครอง',
                 'ไม่ต้องส่งชุดข้อมูลมาตรฐาน 15 แฟ้มของ สปสช.'],
    },
};


/* ══════════════════════════════════════════════════════════
   2C. ทะเบียนเอกสารอ้างอิง

   ล้อธรรมเนียมของ mock-nhso.js ที่ประกาศ [D2]/[D3] ไว้ในหัวไฟล์ แล้วอ้าง [D2 น.12]
   ในคอมเมนต์ทุกค่าคงที่ — ต่างกันที่ทำเป็น "ข้อมูล" ด้วย เพื่อให้หน้าจอเรนเดอร์ได้ว่า
   ตอนนี้ขาดเอกสารฉบับไหน และขาดแล้วตรวจอะไรไม่ได้บ้าง

   status  MISSING = ยังไม่มีไฟล์ในโปรเจค · PRESENT = มีแล้วและถอดข้อมูลได้
   provides[] = คีย์ของตาราง/ค่าที่เอกสารฉบับนั้นค้ำอยู่ ใช้ผูกกับ MockIpd.refReady()
   ══════════════════════════════════════════════════════════ */

/** สิ่งที่เอกสารแต่ละฉบับค้ำ — ใช้เป็นคีย์กลางระหว่าง IPD_SOURCES กับตารางอ้างอิง */
const IPD_PROVIDES = [
    { key: 'drgTable',     label: 'ตารางกลุ่ม DRG (รหัส · RW · ALOS)' },
    { key: 'trimPoint',    label: 'จุดตัดวันนอน (trim point)' },
    { key: 'adjRwFormula', label: 'สูตรปรับ AdjRW กรณี outlier' },
    { key: 'mdc',          label: 'รายการกลุ่มโรคหลัก (MDC)' },
    { key: 'fundRate',     label: 'อัตราจ่ายต่อ 1 RW รายกองทุน' },
    { key: 'fundRule',     label: 'เงื่อนไขการเบิกจ่ายรายกองทุน' },
    { key: 'fundFiles',    label: 'เมทริกซ์กองทุน × แฟ้มที่ต้องส่ง' },
    { key: 'fundList',     label: 'รายชื่อสิทธิ์/กองทุนที่รองรับ' },
];

const IPD_SOURCES = [
    /* ── ยังไม่มีในโปรเจค — ต้องหามาใส่ doc/ แล้วเปลี่ยน status เป็น PRESENT ── */
    {
        id: 'D4', kind: 'MANUAL', status: 'MISSING',
        title: 'คู่มือการจัดกลุ่มวินิจฉัยโรคร่วม (Thai DRG) ฉบับที่โรงพยาบาลใช้',
        issuer: 'สำนักงานกลางสารสนเทศบริการสุขภาพ (สกส.)',
        file: null, pageUnit: 'น.',
        provides: ['drgTable', 'trimPoint', 'adjRwFormula', 'mdc'],
        note: 'ต้องเป็นเวอร์ชันเดียวกับ Grouper ที่ใช้จริง — RW ต่างเวอร์ชันให้ผลต่างกัน',
    },
    {
        id: 'D5', kind: 'ANNOUNCE', status: 'MISSING',
        title: 'ประกาศอัตราจ่ายต่อน้ำหนักสัมพัทธ์ (บาท/RW) กรณีผู้ป่วยใน',
        issuer: 'สำนักงานหลักประกันสุขภาพแห่งชาติ',
        file: null, pageUnit: 'น.', funds: ['UC', 'LGO', 'EMS'],
        provides: ['fundRate'],
        note: 'ประกาศใหม่ทุกปีงบประมาณ — ต้องเก็บทุกฉบับพร้อมช่วงมีผล ไม่ใช่ทับของเดิม',
    },
    {
        id: 'D6', kind: 'ANNOUNCE', status: 'MISSING',
        title: 'หลักเกณฑ์และอัตราค่ารักษาพยาบาลผู้ป่วยใน สิทธิเบิกจ่ายตรง',
        issuer: 'กรมบัญชีกลาง กระทรวงการคลัง',
        file: null, pageUnit: 'น.', funds: ['OFC', 'LGO'],
        provides: ['fundRate', 'fundRule'],
        note: 'ค้ำทั้งอัตราจ่ายและเพดานค่าห้อง/ค่าอาหาร',
    },
    {
        id: 'D7', kind: 'ANNOUNCE', status: 'MISSING',
        title: 'หลักเกณฑ์การจ่ายประโยชน์ทดแทนกรณีประสบอันตรายหรือเจ็บป่วย',
        issuer: 'สำนักงานประกันสังคม',
        file: null, pageUnit: 'น.', funds: ['SSS'],
        provides: ['fundRate', 'fundRule'],
    },
    {
        id: 'D8', kind: 'ANNOUNCE', status: 'MISSING',
        title: 'หลักเกณฑ์ วิธีการ และเงื่อนไขการกำหนดค่าใช้จ่ายกรณีฉุกเฉินวิกฤต (UCEP)',
        issuer: 'สถาบันการแพทย์ฉุกเฉินแห่งชาติ / สปสช.',
        file: null, pageUnit: 'น.', funds: ['EMS'],
        provides: ['fundRule'],
        note: 'ค้ำเงื่อนไข 72 ชั่วโมงแรกและเกณฑ์คัดแยกฉุกเฉินวิกฤต',
    },

    /* ── มีอยู่จริงแล้วใน doc/ — ถอดข้อมูลไปใช้แล้วบางส่วน ── */
    {
        id: 'D2', kind: 'DATASET', status: 'PRESENT',
        title: 'NHSO Digital Platform Overview (23 มิ.ย. 2569)',
        issuer: 'สำนักงานหลักประกันสุขภาพแห่งชาติ',
        file: 'doc/2. NHSO.Digital.Platform.Overview.23.06.2569.pdf', pageUnit: 'น.',
        provides: ['fundFiles'],
        note: 'เมทริกซ์กองทุน × แฟ้ม อยู่หน้า 14–16 ถอดไว้แล้วที่ NHSO_FUND_FILES',
    },
    {
        id: 'D3', kind: 'DATASET', status: 'PRESENT',
        title: 'โครงการ NHSO Digital Platform Communication V4 (3 ส.ค. 2569)',
        issuer: 'สำนักงานหลักประกันสุขภาพแห่งชาติ',
        file: 'doc/โครงการ NHSO Digital Platform_Commu_03082026_V4.pdf', pageUnit: 'สไลด์',
        provides: ['fundList'],
        note: 'รายชื่อสิทธิ์ที่รองรับรายเฟสอยู่สไลด์ 6 · ผู้ป่วยในเข้าเฟส 3 (16 ก.ย. 2569)',
    },
];

const IPD_SOURCE_TONE = {
    PRESENT: { chip: 'sip-chip-success', label: 'มีเอกสารแล้ว' },
    PARTIAL: { chip: 'sip-chip-amber',   label: 'มีบางส่วน' },
    MISSING: { chip: 'sip-chip-danger',  label: 'ยังไม่มีเอกสาร' },
};


/* ══════════════════════════════════════════════════════════
   3. ระบบ DRG

   ⚠️ ทั้งบล็อกนี้เป็นค่าจำลอง (verified:false) — ที่มาอ้างไว้เป็น [D4]/[D5]…
      ซึ่งยังมีสถานะ MISSING ทั้งหมด
      เมื่อได้เอกสารมาแล้วให้แทนค่าและตั้ง verified:true รายแถว
      (หรือใช้แท็บ "นำเข้า" ในหน้า ipd-reference.html ซึ่งตั้งให้อัตโนมัติ)

   ⭐ ทุกตารางในบล็อกนี้มี version + ช่วงมีผล + ที่มา เพราะ
      RW เปลี่ยนตามเวอร์ชัน Grouper และอัตราจ่ายประกาศใหม่ทุกปี
      เคสที่จำหน่ายปีก่อนต้องคำนวณด้วยค่าของปีนั้น ไม่ใช่ค่าล่าสุด
      (รูปทรงเดียวกับ MOCK_RULES / MOCK_DOCS ที่ระบบใช้อยู่แล้ว)
   ══════════════════════════════════════════════════════════ */

/** เวอร์ชัน Grouper ที่บังคับใช้แต่ละช่วง — เลือกตามวันจำหน่าย */
const IPD_DRG_VERSIONS = [
    {
        code: 'TDRG-6.3', label: 'Thai DRG version 6.3',
        effective_from: '2566-10-01', effective_to: null,
        source: 'D4', srcRef: null, verified: false,
        note: 'เวอร์ชันตัวอย่าง — ต้องตั้งให้ตรงกับ Grouper ที่โรงพยาบาลใช้จริง',
    },
];

/** กลุ่มโรคหลัก (MDC) เท่าที่ชุดข้อมูลจำลองนี้ใช้ — ที่มา [D4] */
const IPD_MDC = [
    { code: '01', label: 'ระบบประสาท' },
    { code: '04', label: 'ระบบหายใจ' },
    { code: '05', label: 'ระบบไหลเวียนโลหิต' },
    { code: '06', label: 'ระบบย่อยอาหาร' },
    { code: '08', label: 'กล้ามเนื้อ กระดูก และเนื้อเยื่อเกี่ยวพัน' },
    { code: '10', label: 'ต่อมไร้ท่อ โภชนาการ และเมตาบอลิซึม' },
    { code: '11', label: 'ไตและทางเดินปัสสาวะ' },
    { code: '14', label: 'การตั้งครรภ์ การคลอด และระยะหลังคลอด' },
    { code: '18', label: 'โรคติดเชื้อและปรสิต' },
];

/**
 * ตาราง DRG — rw = น้ำหนักสัมพัทธ์ · alos = วันนอนเฉลี่ย
 * trimLow / trimHigh = จุดตัดวันนอนที่ทำให้เป็น outlier (นอกช่วงนี้ต้องปรับ RW)
 * pdx / proc = รหัสที่ทำให้จัดเข้ากลุ่มนี้ (ใช้แทน Grouper จริงในต้นแบบ)
 */
const IPD_DRG_TABLE = [
    { drg: '04530', mdc: '04', label: 'ปอดอักเสบ มีโรคร่วม/โรคแทรก',
      rw: 1.4820, alos: 5.8, trimLow: 2, trimHigh: 14, pdx: ['J18.9', 'J15.9'],
      version: 'TDRG-6.3', source: 'D4', srcRef: null, verified: false },
    { drg: '04510', mdc: '04', label: 'ปอดอุดกั้นเรื้อรัง กำเริบ',
      rw: 1.0230, alos: 4.6, trimLow: 1, trimHigh: 12, pdx: ['J44.1', 'J44.9'],
      version: 'TDRG-6.3', source: 'D4', srcRef: null, verified: false },
    { drg: '05450', mdc: '05', label: 'หัวใจล้มเหลว ไม่มีโรคแทรก',
      rw: 0.9812, alos: 4.2, trimLow: 1, trimHigh: 11, pdx: ['I50.0', 'I50.9'],
      version: 'TDRG-6.3', source: 'D4', srcRef: null, verified: false },
    { drg: '05220', mdc: '05', label: 'กล้ามเนื้อหัวใจขาดเลือดเฉียบพลัน',
      rw: 2.6480, alos: 6.4, trimLow: 2, trimHigh: 16, pdx: ['I21.9'],
      version: 'TDRG-6.3', source: 'D4', srcRef: null, verified: false },
    { drg: '01180', mdc: '01', label: 'โรคหลอดเลือดสมอง',
      rw: 2.1560, alos: 7.2, trimLow: 2, trimHigh: 18, pdx: ['I63.9', 'I61.9'],
      version: 'TDRG-6.3', source: 'D4', srcRef: null, verified: false },
    { drg: '06450', mdc: '06', label: 'ผ่าตัดไส้ติ่ง',
      rw: 1.2380, alos: 3.2, trimLow: 1, trimHigh: 9,  pdx: ['K35.8', 'K35.3'],
      version: 'TDRG-6.3', source: 'D4', srcRef: null, verified: false },
    { drg: '06210', mdc: '06', label: 'เลือดออกทางเดินอาหาร',
      rw: 1.1250, alos: 4.0, trimLow: 1, trimHigh: 10, pdx: ['K92.2', 'K29.7'],
      version: 'TDRG-6.3', source: 'D4', srcRef: null, verified: false },
    { drg: '08340', mdc: '08', label: 'ผ่าตัดยึดตรึงกระดูกสะโพก/ต้นขา',
      rw: 3.2140, alos: 8.5, trimLow: 3, trimHigh: 21, pdx: ['S72.0', 'S72.1'],
      version: 'TDRG-6.3', source: 'D4', srcRef: null, verified: false },
    { drg: '10220', mdc: '10', label: 'เบาหวานมีภาวะแทรกซ้อน',
      rw: 0.9120, alos: 4.1, trimLow: 1, trimHigh: 10, pdx: ['E11.9', 'E11.65'],
      version: 'TDRG-6.3', source: 'D4', srcRef: null, verified: false },
    { drg: '11240', mdc: '11', label: 'ติดเชื้อทางเดินปัสสาวะ',
      rw: 0.8450, alos: 3.8, trimLow: 1, trimHigh: 9,  pdx: ['N39.0'],
      version: 'TDRG-6.3', source: 'D4', srcRef: null, verified: false },
    { drg: '11510', mdc: '11', label: 'ไตวายเรื้อรัง ต้องฟอกเลือด',
      rw: 1.7340, alos: 5.5, trimLow: 2, trimHigh: 15, pdx: ['N18.3', 'N18.5'],
      version: 'TDRG-6.3', source: 'D4', srcRef: null, verified: false },
    { drg: '14030', mdc: '14', label: 'คลอดปกติทางช่องคลอด',
      rw: 0.5620, alos: 2.4, trimLow: 1, trimHigh: 6,  pdx: ['O80'],
      version: 'TDRG-6.3', source: 'D4', srcRef: null, verified: false },
    { drg: '14012', mdc: '14', label: 'ผ่าตัดคลอดทางหน้าท้อง',
      rw: 1.0940, alos: 3.6, trimLow: 2, trimHigh: 9,  pdx: ['O82'],
      version: 'TDRG-6.3', source: 'D4', srcRef: null, verified: false },
    { drg: '18110', mdc: '18', label: 'ภาวะติดเชื้อในกระแสเลือด',
      rw: 2.4870, alos: 8.0, trimLow: 2, trimHigh: 20, pdx: ['A41.9'],
      version: 'TDRG-6.3', source: 'D4', srcRef: null, verified: false },
];

/**
 * อัตราจ่ายต่อ 1 RW ของแต่ละกองทุน (บาท) — ในระบบจริงแต่ละกองทุนประกาศคนละอัตรา
 * และประกาศใหม่ทุกปีงบประมาณ จึงเก็บเป็นอาร์เรย์ที่มีช่วงมีผล ไม่ใช่ map ค่าเดียว
 *
 * ⭐ เคสที่จำหน่ายปีก่อนต้องคิดด้วยอัตราของปีนั้น — เลือกด้วย MockIpd.rate(fund, onDate)
 *   เมื่อมีประกาศฉบับใหม่ ให้ "เพิ่มแถว" แล้วปิด effective_to ของแถวเดิม ห้ามแก้ทับ
 *   (BR-02 เดียวกับที่คลังกฎใช้ — ของเก่าต้องคำนวณย้อนได้เสมอ)
 *
 * PVT = rate:null เพราะประกันเอกชนจ่ายตามค่าใช้จ่ายจริงภายใต้เพดานกรมธรรม์ ไม่ใช่ DRG
 * EMS = ช่วง 72 ชม.แรกจ่ายตามอัตรา UCEP — ค่าที่ใส่ไว้เป็นค่าประมาณเพื่อการสาธิตเท่านั้น
 */
const IPD_FUND_RATES = [
    { fund: 'UC',  rate: 8350,  effective_from: '2568-10-01', effective_to: null,
      source: 'D5', srcRef: null, verified: false },
    { fund: 'OFC', rate: 11500, effective_from: '2568-10-01', effective_to: null,
      source: 'D6', srcRef: null, verified: false },
    { fund: 'SSS', rate: 9200,  effective_from: '2568-10-01', effective_to: null,
      source: 'D7', srcRef: null, verified: false },
    { fund: 'LGO', rate: 8350,  effective_from: '2568-10-01', effective_to: null,
      source: 'D6', srcRef: null, verified: false },
    { fund: 'EMS', rate: 10500, effective_from: '2568-10-01', effective_to: null,
      source: 'D8', srcRef: null, verified: false },
    { fund: 'PVT', rate: null,  effective_from: '2568-10-01', effective_to: null,
      source: null, srcRef: null, verified: true,
      reason: 'จ่ายตามค่าใช้จ่ายจริงภายใต้เพดานกรมธรรม์ ไม่ใช่ระบบ DRG' },
];
const IPD_FUND_RATE_NOTE = 'อัตราจ่ายต่อ RW เป็นค่าจำลอง — ต้องแทนด้วยอัตราตามประกาศของแต่ละกองทุน';

/**
 * สูตรปรับ AdjRW กรณีวันนอนหลุดจุดตัด — แยกเป็นข้อมูล ไม่ hardcode ในเมธอด
 * เพื่อให้เปลี่ยนตามคู่มือได้โดยไม่ต้องแก้โค้ด
 *
 * ⚠️ ค่าปัจจุบันเป็น "สูตรจำลอง" ไม่ใช่สูตรตามคู่มือ Thai DRG ฉบับจริง [D4]
 *    low.PRORATE  : AdjRW = RW × (LOS / trimLow) แต่ไม่ต่ำกว่า RW × floor
 *    high.PER_DAY : AdjRW = RW + (RW / ALOS) × (LOS − trimHigh) × factor
 */
const IPD_OUTLIER_RULES = [
    {
        version: 'TDRG-6.3', effective_from: '2566-10-01', effective_to: null,
        source: 'D4', srcRef: null, verified: false,
        low:  { kind: 'PRORATE', floor: 0.3 },
        high: { kind: 'PER_DAY', factor: 0.5 },
    },
];


/* ══════════════════════════════════════════════════════════
   4. รายการตรวจแฟ้มผู้ป่วยใน (เวชระเบียน)

   weight   = น้ำหนักคะแนน · ยิ่งสูงยิ่งกระทบผลตรวจ
   appliesTo= null คือทุกกองทุน · ระบุ array คือเฉพาะกองทุนนั้น
   needs    = เงื่อนไขที่ทำให้ข้อนี้ "ต้องมี" (ไม่เข้าเงื่อนไข → NA อัตโนมัติ)
              proc     = เคสมีหัตถการ
              leaveDay = เคสมีการลากลับบ้าน
              preAuth  = กองทุนนั้นบังคับอนุมัติล่วงหน้า
   ══════════════════════════════════════════════════════════ */

const IPD_CHART_GROUPS = [
    { key: 'REC',  label: 'เวชระเบียน',           icon: 'file-text' },
    { key: 'DX',   label: 'การวินิจฉัย / หัตถการ', icon: 'stethoscope' },
    { key: 'FIN',  label: 'การเงิน',               icon: 'wallet' },
    { key: 'ENT',  label: 'สิทธิ / เอกสารกองทุน',  icon: 'shield-check' },
    { key: 'SIGN', label: 'การลงนาม',              icon: 'pen-line' },
];

const IPD_CHART_SECTIONS = [
    /* — เวชระเบียน — */
    { key: 'admission_note',    group: 'REC',  weight: 3, label: 'ใบรับผู้ป่วยใน (Admission note)' },
    { key: 'history_physical',  group: 'REC',  weight: 3, label: 'ประวัติและการตรวจร่างกายแรกรับ' },
    { key: 'progress_note',     group: 'REC',  weight: 3, label: 'บันทึกความก้าวหน้า (Progress note) ครบทุกวันนอน' },
    { key: 'doctor_order',      group: 'REC',  weight: 2, label: 'คำสั่งการรักษาของแพทย์ครบทุกวัน' },
    { key: 'nurse_note',        group: 'REC',  weight: 2, label: 'บันทึกทางการพยาบาล' },
    { key: 'operative_note',    group: 'REC',  weight: 3, label: 'รายงานการผ่าตัด / หัตถการ', needs: 'proc' },
    { key: 'leave_record',      group: 'REC',  weight: 2, label: 'บันทึกการลากลับบ้าน (วันที่ไป–กลับ)', needs: 'leaveDay' },
    { key: 'discharge_summary', group: 'REC',  weight: 4, label: 'ใบสรุปการจำหน่าย (Discharge summary)' },

    /* — การวินิจฉัย / หัตถการ — */
    { key: 'pdx_recorded',      group: 'DX',   weight: 4, label: 'ระบุการวินิจฉัยหลัก (PDx) ครบถ้วน' },
    { key: 'dx_supported',      group: 'DX',   weight: 3, label: 'มีผลตรวจสนับสนุนการวินิจฉัยหลัก' },
    { key: 'proc_coded',        group: 'DX',   weight: 3, label: 'รหัสหัตถการ (ICD-9-CM) ตรงกับรายงานการผ่าตัด', needs: 'proc' },
    { key: 'drg_groupable',     group: 'DX',   weight: 3, label: 'จัดกลุ่ม DRG ได้จากรหัสที่บันทึก' },
    { key: 'los_consistent',    group: 'DX',   weight: 3, label: 'จำนวนวันนอนสอดคล้องกับวันจำหน่ายและวันลากลับบ้าน' },

    /* — การเงิน — */
    { key: 'charge_summary',    group: 'FIN',  weight: 3, label: 'ใบสรุปค่ารักษาพยาบาลแยกหมวดค่าใช้จ่าย' },
    { key: 'charge_match',      group: 'FIN',  weight: 2, label: 'ค่าใช้จ่ายในแฟ้ม 7 ตรงกับใบสรุป' },
    { key: 'room_charge',       group: 'FIN',  weight: 2, label: 'ค่าห้อง/ค่าอาหาร ตรงกับจำนวนวันนอนที่เบิก' },

    /* — สิทธิ / เอกสารกองทุน — */
    { key: 'id_copy',           group: 'ENT',  weight: 2, label: 'สำเนาบัตรประชาชน / เอกสารแสดงตน' },
    { key: 'right_verified',    group: 'ENT',  weight: 3, label: 'หลักฐานการตรวจสอบสิทธิ ณ วันรับไว้' },
    { key: 'pre_auth',          group: 'ENT',  weight: 3, label: 'หนังสือ/เลขอนุมัติล่วงหน้าตามเงื่อนไขกองทุน', needs: 'preAuth' },
    { key: 'policy_doc',        group: 'ENT',  weight: 3, label: 'สำเนากรมธรรม์ / บัตรสมาชิก + เลขกรมธรรม์', appliesTo: ['PVT'] },
    { key: 'claim_form',        group: 'ENT',  weight: 3, label: 'ใบเรียกร้องค่าสินไหมทดแทน ลงนามผู้เอาประกัน',  appliesTo: ['PVT'] },
    { key: 'consent',           group: 'ENT',  weight: 2, label: 'หนังสือยินยอมเปิดเผยข้อมูลทางการแพทย์',       appliesTo: ['PVT'] },

    /* — การลงนาม — */
    { key: 'sign_doctor',       group: 'SIGN', weight: 4, label: 'ลายเซ็นแพทย์ผู้รักษาในใบสรุปการจำหน่าย' },
    { key: 'sign_coder',        group: 'SIGN', weight: 2, label: 'ลายเซ็นผู้ให้รหัสโรค (Coder)' },
];


/* ══════════════════════════════════════════════════════════
   5. ระเบียนการนอน (MOCK_IPD_STAYS)

   แบ่งเป็น 2 ส่วนที่ต่อกันเป็นเส้นงานเดียว
     (ก) เคสที่ยังนอน / จำหน่ายแล้วแต่ยังไม่ผ่านการตรวจแฟ้ม — เขียนมือ ยังไม่มี claim_id
     (ข) เคสที่ผ่านการตรวจแล้ว — ฉายจากตาราง claims ที่ service_type === 'IPD'
         ⭐ ไม่เขียนซ้ำ เพื่อให้ตัวเลข "ส่งเบิกแล้ว" ของโมดูล IPD กับ Claim ตรงกันเสมอ

   ⚠️ เลข AN แบ่งช่วงกันชัดเจน ห้ามใช้ปนกัน
        6905xx–6907xx = ของฝั่ง claims (เขียนมือ + ที่สร้างจากสูตร 'AN6907' + 2 หลัก)
        6912xx        = เคสเขียนมือของโมดูล IPD
      ถ้า AN ซ้ำกัน ipd-admit.html?an= / ipd-audit.html?an= จะเปิดผิดคน

   ใช้ LCG แบบ seed คงที่เหมือน mock-claims.js — ห้ามใช้ Math.random
   ══════════════════════════════════════════════════════════ */

const MOCK_IPD_STAYS = (function buildStays() {

    let _s = 25690806;
    const rnd  = () => (_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const pick = a => a[Math.floor(rnd() * a.length)];
    const int  = (a, b) => a + Math.floor(rnd() * (b - a + 1));

    /* วันอ้างอิงเป็น พ.ศ. — บวก/ลบวันแล้วคืนสตริงรูปแบบเดิม */
    const addDays = (ymd, n) => {
        const d = MockFmt.toDate(ymd);
        if (!d) return ymd;
        d.setDate(d.getDate() + n);
        return `${d.getFullYear() + 543}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const dayDiff = (a, b) => {
        const da = MockFmt.toDate(a), db = MockFmt.toDate(b);
        return (da && db) ? Math.round((db - da) / 864e5) : 0;
    };
    const TODAY_TH = '2569-08-06';

    /**
     * สร้างบันทึกรายวันจากวันรับถึงวันจำหน่าย (หรือถึงวันนี้ถ้ายังนอนอยู่)
     * gaps = ดัชนีวันที่จงใจให้ progress note ขาด เพื่อให้หน้าจอมีอะไรให้จับ
     */
    function buildDaily(admit, until, dayCost, gaps, events) {
        const n = Math.max(1, dayDiff(admit, until) + 1);
        const rows = [];
        for (let i = 0; i < n; i++) {
            const miss = (gaps || []).includes(i);
            rows.push({
                day: i + 1,
                date: addDays(admit, i),
                progress_note: !miss,
                doctor_order: !miss || i === 0,
                nurse_note: true,
                events: (events && events[i]) ? events[i] : [],
                charge_day: i === 0 ? Math.round(dayCost * 1.6) : Math.round(dayCost * (0.7 + rnd() * 0.6)),
                note: miss ? 'ไม่พบบันทึกความก้าวหน้าของวันนี้' : '',
            });
        }
        return rows;
    }

    /** แปลง daily[] เป็นรายการค่าใช้จ่ายรวมรายหมวด (แฟ้ม 7) */
    function buildCharges(daily, los, roomRate, extra) {
        const total = daily.reduce((a, d) => a + d.charge_day, 0);
        const room  = Math.max(1, los) * roomRate;
        const rest  = Math.max(0, total - room - (extra || []).reduce((a, e) => a + e.amount, 0));
        return [
            { billgrcs: '02', name: 'ค่าห้องและค่าอาหารผู้ป่วยใน', amount: room },
            ...(extra || []),
            { billgrcs: '03', name: 'ค่ายาและสารอาหารทางหลอดเลือด', amount: Math.round(rest * 0.45) },
            { billgrcs: '06', name: 'ค่าตรวจทางห้องปฏิบัติการ',     amount: Math.round(rest * 0.30) },
            { billgrcs: '11', name: 'ค่าตรวจวินิจฉัยทางรังสีวิทยา',  amount: Math.round(rest * 0.25) },
        ].filter(c => c.amount > 0);
    }

    /** สร้าง chart_audit เริ่มต้น — ข้อที่อยู่ใน okKeys = ครบ ที่เหลือ = ยังไม่ครบ */
    function chartAudit(okKeys) {
        return IPD_CHART_SECTIONS.map(s => ({
            key: s.key,
            state: okKeys.includes(s.key) ? 'OK' : 'MISSING',
            by: okKeys.includes(s.key) ? 'เวชระเบียน' : null,
            at: null, note: '',
        }));
    }

    /** ข้อที่โรงพยาบาลทำครบเป็นปกติ — ใช้เป็นฐานแล้วค่อยเติม/ตัดรายเคส */
    const BASE_OK = ['admission_note', 'history_physical', 'nurse_note', 'doctor_order',
                     'charge_summary', 'charge_match', 'room_charge',
                     'id_copy', 'right_verified', 'dx_supported', 'sign_coder'];

    function fundChecks(fund, okKeys) {
        const r = IPD_FUND_RULES[fund] || IPD_FUND_RULES.UC;
        const items = [{ key: 'preAuth' }, { key: 'submitDue' }, ...r.docs];
        return items.map(it => ({
            key: it.key,
            state: (okKeys || []).includes(it.key) ? 'OK' : 'MISSING',
            note: '',
        }));
    }

    /* ── (ก) เคสเขียนมือ — ยังนอน / รอตรวจแฟ้ม ───────────── */

    const hand = [];

    /* 1. กำลังนอน · UC · ปอดอักเสบ · progress note ขาด 2 วัน · LOS ยังไม่เกิน trim */
    (function () {
        const admit = '2569-08-01';
        const daily = buildDaily(admit, TODAY_TH, 4200, [3], [[], [], ['ปรับยาปฏิชีวนะตามผลเพาะเชื้อ'], [], [], []]);
        const los   = daily.length;
        hand.push({
            id: 'AN-2569-1201', an: '691201', hn: '00151022',
            patient: 'นางประนอม สุขสวัสดิ์', age: 68, gender: 'F',
            fund: 'UC', ward: 'MED-3', bed: '08',
            admit_at: admit + 'T10:40', discharge_at: null,
            status: 'ADMITTED', discharge_type: null, discharge_status: null,
            leave_days: 0, leave_periods: [],
            pdx: 'J18.9', pdx_name: 'Pneumonia, unspecified organism',
            sdx: [{ code: 'E11.9', name: 'Type 2 diabetes mellitus without complications' }],
            proc: [],
            drg: '04530', drg_confirmed: false,
            daily,
            charges: buildCharges(daily, los, 1200, []),
            chart_audit: chartAudit([...BASE_OK, 'pdx_recorded', 'drg_groupable', 'los_consistent']),
            fund_check: fundChecks('UC', ['preAuth', 'submitDue', 'admission_note', 'charge_summary', 'id_copy']),
            files_sent: [1, 2, 3, 4, 5, 7, 8],
            file_ctx: { emergency: false, prenatal: false, newborn: false, psych: false, disability: false, leaveDay: false },
            audit_status: 'NOT_READY', audit_result: null, audit_score: null, auditor: null, audit_note: '',
            claim_id: null,
            timeline: [
                { at: admit + 'T10:40', tone: 'info', title: 'รับไว้เป็นผู้ป่วยใน', by: 'ห้องฉุกเฉิน', note: 'หอผู้ป่วยอายุรกรรมหญิง ชั้น 3 เตียง 08' },
                { at: '2569-08-04T09:15', tone: 'warning', title: 'ไม่พบบันทึกความก้าวหน้าของวันที่ 4 ส.ค.', by: 'ระบบตรวจสอบ', note: 'แจ้งเตือนระหว่างนอน — แก้ได้ก่อนจำหน่าย' },
            ],
        });
    })();

    /* 2. กำลังนอน · OFC · ผ่าตัดสะโพก · LOS เกิน trim บน · ยังไม่มีเลขอนุมัติ */
    (function () {
        const admit = '2569-07-12';
        const daily = buildDaily(admit, TODAY_TH, 5100, [8, 15],
            [[], ['ผ่าตัดยึดตรึงกระดูกต้นขา'], [], [], [], [], [], [], [], [], [], ['ย้ายออกจากไอซียู']]);
        const los   = daily.length;
        hand.push({
            id: 'AN-2569-1202', an: '691202', hn: '00148890',
            patient: 'นายเสน่ห์ วงศ์อารีย์', age: 79, gender: 'M',
            fund: 'OFC', ward: 'SUR-4', bed: '15',
            admit_at: admit + 'T07:55', discharge_at: null,
            status: 'ADMITTED', discharge_type: null, discharge_status: null,
            leave_days: 0, leave_periods: [],
            pdx: 'S72.0', pdx_name: 'Fracture of neck of femur',
            sdx: [{ code: 'I10', name: 'Essential (primary) hypertension' },
                  { code: 'N18.3', name: 'Chronic kidney disease, stage 3' }],
            proc: [{ code: '79.35', name: 'Open reduction of fracture with internal fixation, femur', date: '2569-07-13' }],
            drg: '08340', drg_confirmed: false,
            daily,
            charges: buildCharges(daily, los, 2400, [{ billgrcs: '09', name: 'ค่าผ่าตัดและหัตถการ', amount: 25600 }]),
            chart_audit: chartAudit([...BASE_OK, 'pdx_recorded', 'operative_note', 'proc_coded', 'drg_groupable']),
            fund_check: fundChecks('OFC', ['submitDue', 'admission_note', 'charge_summary']),
            files_sent: [1, 2, 3, 4, 5, 6, 7, 8],
            file_ctx: { emergency: false, prenatal: false, newborn: false, psych: false, disability: false, leaveDay: false },
            audit_status: 'NOT_READY', audit_result: null, audit_score: null, auditor: null, audit_note: '',
            claim_id: null,
            timeline: [
                { at: admit + 'T07:55', tone: 'info', title: 'รับไว้เป็นผู้ป่วยใน', by: 'ห้องฉุกเฉิน', note: 'กระดูกสะโพกหักจากการหกล้ม' },
                { at: '2569-07-13T13:20', tone: 'success', title: 'ผ่าตัดยึดตรึงกระดูกต้นขา', by: 'ห้องผ่าตัด', note: 'ICD-9-CM 79.35' },
                { at: '2569-08-02T09:00', tone: 'danger', title: 'วันนอนเกินจุดตัดบนของ DRG 08340', by: 'ระบบตรวจสอบ', note: 'ต้องมีบันทึกเหตุผลทางการแพทย์ประกอบ' },
                { at: '2569-08-05T11:30', tone: 'warning', title: 'ยังไม่พบเลขอนุมัติเบิกจ่ายตรง', by: 'ระบบตรวจสอบ', note: 'ไม่แก้ก่อนส่ง จะได้ C305 กลับมา' },
            ],
        });
    })();

    /* 3. ลากลับบ้าน · SSS · หัวใจล้มเหลว — เคสสาธิตแฟ้ม 15 (LVD) */
    (function () {
        const admit = '2569-07-26';
        const daily = buildDaily(admit, TODAY_TH, 3600, [],
            [[], [], [], ['อนุญาตให้ลากลับบ้าน 2 วัน'], [], [], ['กลับเข้ารักษาต่อ']]);
        const los   = daily.length - 2;
        hand.push({
            id: 'AN-2569-1203', an: '691203', hn: '00139455',
            patient: 'นายบรรจง เพ็ชรรัตน์', age: 61, gender: 'M',
            fund: 'SSS', ward: 'MED-2', bed: '21',
            admit_at: admit + 'T15:10', discharge_at: null,
            status: 'LEAVE', discharge_type: null, discharge_status: null,
            leave_days: 2,
            leave_periods: [{ from: '2569-07-29', to: '2569-07-31', reason: 'ญาติขอรับกลับดูแลที่บ้านชั่วคราว' }],
            pdx: 'I50.0', pdx_name: 'Congestive heart failure',
            sdx: [{ code: 'I10', name: 'Essential (primary) hypertension' }],
            proc: [],
            drg: '05450', drg_confirmed: false,
            daily,
            charges: buildCharges(daily, los, 1200, []),
            chart_audit: chartAudit([...BASE_OK, 'pdx_recorded', 'drg_groupable']),
            fund_check: fundChecks('SSS', ['preAuth', 'submitDue', 'admission_note', 'charge_summary', 'sss_card']),
            /* จงใจไม่ส่งแฟ้ม 15 ทั้งที่มีการลากลับบ้าน — เคสสาธิตกฎ RUL-IPD-016 → NHSO C112 */
            files_sent: [1, 2, 3, 4, 5, 7, 8],
            file_ctx: { emergency: false, prenatal: false, newborn: false, psych: false, disability: false, leaveDay: true },
            audit_status: 'NOT_READY', audit_result: null, audit_score: null, auditor: null, audit_note: '',
            claim_id: null,
            timeline: [
                { at: admit + 'T15:10', tone: 'info', title: 'รับไว้เป็นผู้ป่วยใน', by: 'คลินิกอายุรกรรม', note: '' },
                { at: '2569-07-29T10:00', tone: 'warning', title: 'อนุญาตให้ลากลับบ้าน 2 วัน', by: 'นพ.ธนกร ศรีสุข', note: 'ต้องบันทึกในแฟ้ม 15 (NHSO LVD)' },
                { at: '2569-07-31T16:20', tone: 'info', title: 'กลับเข้ารักษาต่อ', by: 'หอผู้ป่วยอายุรกรรมชาย', note: '' },
            ],
        });
    })();

    /* 4. จำหน่ายแล้ว รอตรวจแฟ้ม · PVT ประกันเอกชน — เคสสาธิตกองทุนที่ไม่ผ่าน NHSO */
    (function () {
        const admit = '2569-07-29', disch = '2569-08-02';
        const daily = buildDaily(admit, disch, 6800, [], [[], ['ผ่าตัดไส้ติ่ง'], [], [], []]);
        const los   = daily.length;
        hand.push({
            id: 'AN-2569-1204', an: '691204', hn: '00152761',
            patient: 'นางสาวกมลชนก อารีรักษ์', age: 34, gender: 'F',
            fund: 'PVT', ward: 'SUR-4', bed: '03',
            admit_at: admit + 'T21:05', discharge_at: disch + 'T11:00',
            status: 'DISCHARGED', discharge_type: '1', discharge_status: '1',
            leave_days: 0, leave_periods: [],
            pdx: 'K35.8', pdx_name: 'Acute appendicitis, other and unspecified',
            sdx: [], proc: [{ code: '47.09', name: 'Other appendectomy', date: '2569-07-30' }],
            drg: '06450', drg_confirmed: true,
            daily,
            charges: buildCharges(daily, los, 3800, [{ billgrcs: '09', name: 'ค่าผ่าตัดและหัตถการ', amount: 18400 }]),
            chart_audit: chartAudit([...BASE_OK, 'pdx_recorded', 'operative_note', 'proc_coded',
                                     'drg_groupable', 'los_consistent', 'discharge_summary', 'policy_doc']),
            fund_check: fundChecks('PVT', ['submitDue', 'policy_doc', 'med_cert', 'charge_summary']),
            files_sent: [],
            file_ctx: { emergency: false, prenatal: false, newborn: false, psych: false, disability: false, leaveDay: false },
            audit_status: 'PENDING', audit_result: null, audit_score: null, auditor: null, audit_note: '',
            claim_id: null,
            timeline: [
                { at: admit + 'T21:05', tone: 'info', title: 'รับไว้เป็นผู้ป่วยใน', by: 'ห้องฉุกเฉิน', note: 'ใช้สิทธิประกันสุขภาพเอกชน' },
                { at: '2569-07-30T01:40', tone: 'success', title: 'ผ่าตัดไส้ติ่ง', by: 'ห้องผ่าตัด', note: 'ICD-9-CM 47.09' },
                { at: disch + 'T11:00', tone: 'info', title: 'จำหน่ายกลับบ้าน', by: 'นพ.ปกรณ์ วิทยา', note: 'อาการทุเลา' },
                { at: disch + 'T14:00', tone: 'warning', title: 'ส่งเข้าคิวตรวจแฟ้ม', by: 'ระบบ', note: 'ยังไม่พบใบเรียกร้องค่าสินไหมและหนังสือยินยอม' },
            ],
        });
    })();

    /* 5. จำหน่ายแล้ว ตีกลับให้แก้ · UC · เอกสารสำคัญขาด */
    (function () {
        const admit = '2569-07-20', disch = '2569-07-27';
        const daily = buildDaily(admit, disch, 3900, [2, 5], [[], [], [], [], [], [], [], []]);
        const los   = daily.length;
        hand.push({
            id: 'AN-2569-1205', an: '691205', hn: '00136014',
            patient: 'นายสมพร ทรัพย์เจริญ', age: 57, gender: 'M',
            fund: 'UC', ward: 'MED-2', bed: '11',
            admit_at: admit + 'T08:30', discharge_at: disch + 'T10:15',
            status: 'DISCHARGED', discharge_type: '1', discharge_status: '1',
            leave_days: 0, leave_periods: [],
            pdx: 'K92.2', pdx_name: 'Gastrointestinal haemorrhage, unspecified',
            sdx: [{ code: 'K29.7', name: 'Gastritis, unspecified' }],
            proc: [],
            drg: '06210', drg_confirmed: true,
            daily,
            charges: buildCharges(daily, los, 1200, []),
            chart_audit: chartAudit([...BASE_OK, 'pdx_recorded', 'drg_groupable', 'los_consistent']),
            fund_check: fundChecks('UC', ['preAuth', 'submitDue', 'admission_note', 'charge_summary', 'id_copy']),
            files_sent: [1, 2, 3, 4, 5, 7, 8, 14],
            file_ctx: { emergency: false, prenatal: false, newborn: false, psych: false, disability: false, leaveDay: false },
            audit_status: 'RETURNED', audit_result: 'FIX', audit_score: null,
            auditor: 'U-007', audit_note: 'ไม่พบใบสรุปการจำหน่ายที่ลงนามแพทย์ และบันทึกความก้าวหน้าขาด 2 วัน',
            claim_id: null,
            timeline: [
                { at: admit + 'T08:30', tone: 'info', title: 'รับไว้เป็นผู้ป่วยใน', by: 'คลินิกอายุรกรรม', note: '' },
                { at: disch + 'T10:15', tone: 'info', title: 'จำหน่ายกลับบ้าน', by: 'นพ.ธนกร ศรีสุข', note: '' },
                { at: '2569-07-28T09:40', tone: 'danger', title: 'ตีกลับให้แก้ไข', by: 'คุณอรทัย เจริญพร', note: 'เวชระเบียนไม่ครบ 2 รายการ' },
            ],
        });
    })();

    /* 6. จำหน่ายแล้ว รอตรวจแฟ้ม · EMS · UCEP */
    (function () {
        const admit = '2569-08-02', disch = '2569-08-05';
        const daily = buildDaily(admit, disch, 8200, [], [['รับจากห้องฉุกเฉิน เข้าไอซียู'], [], ['ย้ายออกจากไอซียู'], []]);
        const los   = daily.length;
        hand.push({
            id: 'AN-2569-1206', an: '691206', hn: '00153388',
            patient: 'นายกิตติพงษ์ แซ่ลิ้ม', age: 52, gender: 'M',
            fund: 'EMS', ward: 'ICU-1', bed: '04',
            admit_at: admit + 'T02:15', discharge_at: disch + 'T16:30',
            status: 'DISCHARGED', discharge_type: '1', discharge_status: '1',
            leave_days: 0, leave_periods: [],
            pdx: 'I21.9', pdx_name: 'Acute myocardial infarction, unspecified',
            sdx: [{ code: 'E11.9', name: 'Type 2 diabetes mellitus without complications' }],
            proc: [{ code: '00.66', name: 'Percutaneous transluminal coronary angioplasty', date: '2569-08-02' }],
            drg: '05220', drg_confirmed: true,
            daily,
            charges: buildCharges(daily, los, 6500, [{ billgrcs: '09', name: 'ค่าหัตถการหัวใจและหลอดเลือด', amount: 62000 }]),
            chart_audit: chartAudit([...BASE_OK, 'pdx_recorded', 'operative_note', 'proc_coded',
                                     'drg_groupable', 'los_consistent', 'discharge_summary', 'sign_doctor']),
            fund_check: fundChecks('EMS', ['preAuth', 'submitDue', 'triage_form', 'er_note', 'admission_note']),
            files_sent: [1, 2, 3, 4, 5, 6, 7, 8, 14],
            file_ctx: { emergency: true, prenatal: false, newborn: false, psych: false, disability: false, leaveDay: false },
            audit_status: 'PENDING', audit_result: null, audit_score: null, auditor: null, audit_note: '',
            claim_id: null,
            timeline: [
                { at: admit + 'T02:15', tone: 'danger', title: 'รับไว้เป็นผู้ป่วยในจากภาวะฉุกเฉินวิกฤต', by: 'ห้องฉุกเฉิน', note: 'คัดแยกระดับสีแดง (UCEP)' },
                { at: admit + 'T04:30', tone: 'success', title: 'ทำหัตถการขยายหลอดเลือดหัวใจ', by: 'ห้องสวนหัวใจ', note: 'ICD-9-CM 00.66' },
                { at: disch + 'T16:30', tone: 'info', title: 'จำหน่ายกลับบ้าน', by: 'นพ.วิทยา รุ่งเรือง', note: 'อาการทุเลา' },
            ],
        });
    })();

    /* 7. จำหน่ายแล้ว รอตรวจแฟ้ม · LGO · คลอดผ่าตัด */
    (function () {
        const admit = '2569-07-30', disch = '2569-08-03';
        const daily = buildDaily(admit, disch, 4100, [], [[], ['ผ่าตัดคลอดทางหน้าท้อง'], [], [], []]);
        const los   = daily.length;
        hand.push({
            id: 'AN-2569-1207', an: '691207', hn: '00150907',
            patient: 'นางสาวชนิดา บุญเรือง', age: 28, gender: 'F',
            fund: 'LGO', ward: 'OBG-5', bed: '07',
            admit_at: admit + 'T06:40', discharge_at: disch + 'T09:20',
            status: 'DISCHARGED', discharge_type: '1', discharge_status: '1',
            leave_days: 0, leave_periods: [],
            pdx: 'O82', pdx_name: 'Single delivery by caesarean section',
            sdx: [], proc: [{ code: '74.1', name: 'Low cervical caesarean section', date: '2569-07-31' }],
            drg: '14012', drg_confirmed: true,
            daily,
            charges: buildCharges(daily, los, 1600, [{ billgrcs: '09', name: 'ค่าผ่าตัดคลอด', amount: 14800 }]),
            chart_audit: chartAudit([...BASE_OK, 'pdx_recorded', 'operative_note', 'proc_coded',
                                     'drg_groupable', 'los_consistent', 'discharge_summary', 'sign_doctor', 'pre_auth']),
            fund_check: fundChecks('LGO', ['preAuth', 'submitDue', 'admission_note', 'discharge_summary', 'charge_summary', 'lgo_verify']),
            files_sent: [1, 2, 3, 4, 5, 6, 7, 8, 11, 14],
            file_ctx: { emergency: false, prenatal: true, newborn: true, psych: false, disability: false, leaveDay: false },
            audit_status: 'IN_REVIEW', audit_result: null, audit_score: null, auditor: 'U-007', audit_note: '',
            claim_id: null,
            timeline: [
                { at: admit + 'T06:40', tone: 'info', title: 'รับไว้เป็นผู้ป่วยใน', by: 'ห้องคลอด', note: '' },
                { at: '2569-07-31T08:15', tone: 'success', title: 'ผ่าตัดคลอดทางหน้าท้อง', by: 'ห้องผ่าตัด', note: 'ICD-9-CM 74.1' },
                { at: disch + 'T09:20', tone: 'info', title: 'จำหน่ายกลับบ้าน', by: 'พญ.สุดารัตน์ ทองแท้', note: 'มารดาและทารกปกติ' },
                { at: '2569-08-04T10:00', tone: 'info', title: 'เริ่มตรวจแฟ้ม', by: 'คุณอรทัย เจริญพร', note: '' },
            ],
        });
    })();

    /* ── (ข) เคสที่ผ่านการตรวจแล้ว — ฉายจากตาราง claims ────
       ไม่เขียนซ้ำ เพราะตัวเลข "ผ่านแล้ว/ส่งเบิกแล้ว" ต้องกระทบยอดกับโมดูล Claim
       ทุกเคสที่ service_type === 'IPD' ต้องมี AN คู่กันเสมอ */

    const WARD_BY_MDC = { '01': 'MED-2', '04': 'MED-3', '05': 'MED-2', '06': 'SUR-4',
                          '08': 'SUR-4', '10': 'MED-3', '11': 'MED-2', '14': 'OBG-5', '18': 'ICU-1' };

    const derived = MockDB.all('claims')
        .filter(c => c.service_type === 'IPD')
        .map((c, i) => {
            const pdxCode = (c.dx || []).find(d => d.type === 'หลัก') || (c.dx || [])[0] || {};
            const drgRow  = IPD_DRG_TABLE.find(d => d.pdx.includes(pdxCode.code))
                         || IPD_DRG_TABLE[i % IPD_DRG_TABLE.length];

            /* วันนอนอ่านจากรายการค่าห้อง (BILLGRCS 02) ถ้ามี — ไม่งั้นใช้ ALOS ของ DRG */
            const room = (c.charges || []).find(ch => ch.billgrcs === '02');
            const los  = room ? Math.max(1, room.qty) : Math.max(1, Math.round(drgRow.alos));

            const disch  = c.service_date;
            const admit  = addDays(disch, -(los - 1));
            const dayAvg = Math.round(c.amount_claimed / los);
            const daily  = buildDaily(admit, disch, dayAvg, [], []);
            const leaveDay = !!(c.file_ctx && c.file_ctx.leaveDay);

            const okKeys = IPD_CHART_SECTIONS.map(s => s.key)
                .filter(k => !(k === 'operative_note' && !(c.proc || []).length)
                          && !(k === 'proc_coded'     && !(c.proc || []).length)
                          && !(k === 'leave_record'   && !leaveDay));

            const fr = IPD_FUND_RULES[c.fund] || IPD_FUND_RULES.UC;

            /* ค่าใช้จ่ายต้องรวมได้เท่ากับยอดขอเบิกของเคลม ไม่งั้นตัวเลข "ค่าใช้จ่ายจริง"
               ของโมดูล IPD กับ "ยอดขอเบิก" ของโมดูล Claim จะขัดกันในเคสเดียวกัน
               ส่วนที่รายการย่อยยังไม่ครอบคลุม แยกเป็นบรรทัดเดียวไว้อย่างตรงไปตรงมา */
            const lines   = (c.charges || []).map(ch => ({
                billgrcs: ch.billgrcs, name: ch.name, amount: (ch.qty || 1) * (ch.price || 0),
            }));
            const lineSum = lines.reduce((a, x) => a + x.amount, 0);
            const gap     = c.amount_claimed - lineSum;
            if (gap > 0) lines.push({ billgrcs: '15', name: 'ค่าบริการอื่น ๆ ที่ยังไม่แยกรายการ', amount: gap });

            /* สถานะการตรวจแฟ้มต้องสอดคล้องกับความครบของแฟ้มจริง ไม่ตั้งเป็น CLEARED ดื้อ ๆ
               เคสที่แฟ้มยังไม่ครบ (เช่น แฟ้ม 15 ที่ mapping ยังไม่เสร็จ) ต้องขึ้นเป็น "ตีกลับ"
               ให้ตรงกับที่ Claim Worklist ขึ้นป้าย "แฟ้มไม่ครบ" ในเคสเดียวกัน */
            const check   = MockNhso.checkFiles('IP', c.files_sent, c.file_ctx);
            const cleared = check.ok;

            return {
                id: 'AN-' + String(c.id).slice(4),
                an: String(c.an || ('69' + String(9000 + i))).replace(/^AN/, ''),
                hn: c.hn, patient: c.patient, age: c.age, gender: c.gender,
                fund: c.fund, ward: WARD_BY_MDC[drgRow.mdc] || 'MED-2', bed: String(int(1, 28)).padStart(2, '0'),
                admit_at: admit + 'T09:00', discharge_at: disch + 'T11:00',
                status: 'DISCHARGED', discharge_type: '1', discharge_status: '1',
                leave_days: leaveDay ? 1 : 0,
                leave_periods: leaveDay
                    ? [{ from: addDays(disch, -2), to: addDays(disch, -1), reason: 'ญาติขอรับกลับดูแลที่บ้านชั่วคราว' }]
                    : [],
                pdx: pdxCode.code || null, pdx_name: pdxCode.name || null,
                sdx: (c.dx || []).filter(d => d.type !== 'หลัก'),
                proc: c.proc || [],
                drg: drgRow.drg, drg_confirmed: true,
                daily,
                charges: lines,
                chart_audit: chartAudit(okKeys),
                fund_check: [{ key: 'preAuth' }, { key: 'submitDue' }, ...fr.docs]
                    .map(it => ({ key: it.key, state: 'OK', note: '' })),
                files_sent: c.files_sent || [],
                file_ctx: c.file_ctx || { emergency: false, prenatal: false, newborn: false,
                                          psych: false, disability: false, leaveDay: false },
                audit_status: cleared ? 'CLEARED' : 'RETURNED',
                audit_result: cleared ? 'PASS' : 'FIX',
                audit_score: null,
                auditor: 'U-007',
                audit_note: cleared
                    ? 'ตรวจแฟ้มครบถ้วน ส่งเข้าคิวส่งเบิกแล้ว'
                    : `ยังส่งแฟ้ม ${MockNhso.fileNames(check.missing)} ไม่ได้ `
                    + '— แฟ้มนี้ยัง Mapping กับ HIS ไม่เสร็จ (ดูหน้านำเข้าข้อมูล / 15 แฟ้ม)',
                claim_id: c.id,
                timeline: [
                    { at: admit + 'T09:00', tone: 'info', title: 'รับไว้เป็นผู้ป่วยใน', by: 'ระบบ', note: '' },
                    { at: disch + 'T11:00', tone: 'info', title: 'จำหน่ายผู้ป่วย',      by: 'ระบบ', note: '' },
                    cleared
                        ? { at: disch + 'T15:00', tone: 'success', title: 'ตรวจแฟ้มผ่าน — ส่งเข้าคิวส่งเบิก',
                            by: 'คุณอรทัย เจริญพร', note: 'เชื่อมกับเคลม ' + c.id }
                        : { at: disch + 'T15:00', tone: 'danger', title: 'ตรวจแฟ้มไม่ผ่าน — แฟ้มไม่ครบ',
                            by: 'คุณอรทัย เจริญพร',
                            note: `ขาด ${MockNhso.fileNames(check.missing)} · เคลม ${c.id} ค้างอยู่ในระบบ` },
                ],
            };
        });

    return [...hand, ...derived];
})();


/* ══════════════════════════════════════════════════════════
   6. MockIpd — ตัวคำนวณทั้งหมด

   ⚠️ ทุกตัวเลขบนหน้าจอต้องมาจากที่นี่ ห้ามหน้าไหนคำนวณเองหรือ hardcode
      ไม่งั้น KPI ของ worklist กับตัวนับใน pill จะขัดกันกลางการนำเสนอ
   ══════════════════════════════════════════════════════════ */

const MockIpd = {

    /* ── ข้อมูลดิบ ─────────────────────────────────────── */

    all()      { return MockDB.all('ipd_stays'); },
    byId(id)   { return MockDB.byId('ipd_stays', id); },
    byAn(an)   { return this.all().find(s => String(s.an) === String(an)) || null; },

    /** ยังนอนอยู่ (รวมลากลับบ้าน) — คิวของหน้า ipd-admit */
    admitted() { return this.all().filter(s => this.statusOf(s.status).open); },

    /** จำหน่ายแล้วและเข้าคิวตรวจแฟ้ม — คิวของหน้า ipd-audit */
    toAudit()  { return this.all().filter(s => s.audit_status !== 'NOT_READY'); },

    statusOf(key) { return IPD_STAY_STATUS.find(s => s.key === key) || IPD_STAY_STATUS[0]; },
    auditOf(key)  { return IPD_AUDIT_STATUS.find(s => s.key === key) || IPD_AUDIT_STATUS[0]; },
    ward(key)     { return IPD_WARDS.find(w => w.key === key) || null; },
    fund(key)     { return IPD_FUNDS.find(f => f.key === key) || null; },
    fundRule(key) { return IPD_FUND_RULES[key] || IPD_FUND_RULES.UC; },
    mdc(code)     { return IPD_MDC.find(m => m.code === code) || null; },
    dischargeType(code)   { return IPD_DISCHARGE_TYPE.find(d => d.code === code) || null; },
    dischargeStatus(code) { return IPD_DISCHARGE_STATUS.find(d => d.code === code) || null; },

    /* ── ทะเบียนเอกสารอ้างอิง ──────────────────────────── */

    sources()    { return IPD_SOURCES; },
    source(id)   { return IPD_SOURCES.find(s => s.id === id) || null; },
    provides()   { return IPD_PROVIDES; },

    /** ที่มาของค่าหนึ่ง ๆ → { id, title, status, ok } · ok = อ้างอิงเอกสารจริงได้แล้ว */
    sourceOf(row) {
        if (!row) return null;
        if (row.verified) return { id: row.source || null, title: 'ยืนยันกับเอกสารแล้ว', status: 'PRESENT', ok: true };
        const s = this.source(row.source);
        return s ? { id: s.id, title: s.title, status: s.status, ok: s.status === 'PRESENT' }
                 : { id: null, title: 'ยังไม่ระบุที่มา', status: 'MISSING', ok: false };
    },

    /** สิ่งที่ provides นี้ต้องพึ่ง — มีเอกสารรองรับครบหรือยัง */
    refReady(key) {
        const need = IPD_SOURCES.filter(s => (s.provides || []).includes(key));
        return need.length > 0 && need.every(s => s.status === 'PRESENT');
    },

    /**
     * สรุปสถานะเอกสารทั้งชุด — ใช้เป็น KPI หน้า ipd-reference
     * นับเฉพาะแถวที่ "มีตัวเลขให้ยืนยัน" — แถว PVT ที่ rate เป็น null ไม่ได้อ้างตัวเลขใด
     * จึงไม่ควรถูกนับเป็นค่าที่ยืนยันแล้ว ไม่งั้น % จะดูดีเกินจริง
     */
    sourceStatus() {
        const rows      = IPD_SOURCES;
        const drgRows   = MockDB.all('ipd_drg_rows');
        const rateRows  = MockDB.all('ipd_rate_rows').filter(r => r.rate != null);
        const drgOk     = drgRows.filter(d => d.verified).length;
        const rateOk    = rateRows.filter(r => r.verified).length;
        const denom     = drgRows.length + rateRows.length;
        return {
            total:   rows.length,
            present: rows.filter(s => s.status === 'PRESENT').length,
            missing: rows.filter(s => s.status === 'MISSING').length,
            drgRows:  drgRows.length,  drgVerified:  drgOk,
            rateRows: rateRows.length, rateVerified: rateOk,
            /* % ของค่าอ้างอิงที่ยืนยันกับเอกสารจริงแล้ว */
            verifiedPct: denom ? Math.round(((drgOk + rateOk) / denom) * 100) : 0,
            byProvides: IPD_PROVIDES.map(p => ({ ...p, ready: this.refReady(p.key) })),
        };
    },

    /* ── ตารางอ้างอิงที่รู้จักวันที่ ─────────────────────
       ทุกตัวเลือกตาม "วันจำหน่าย" เพราะผู้ป่วยในส่งเบิกตอนจำหน่าย
       เคสที่ยังนอนอยู่ใช้วันนี้แทน — ตรรกะเดียวกับ rulesFor() (BR-01)
       ─────────────────────────────────────────────────── */

    /** วันที่ใช้อ้างอิงของเคสนั้น — จุดเดียวที่ตัดสิน ห้ามหน้าไหนคิดเอง */
    asOf(stay) {
        if (!stay) return MockDB.TODAY;
        return stay.discharge_at ? (MockFmt.toDate(stay.discharge_at) || MockDB.TODAY) : MockDB.TODAY;
    },

    /**
     * แถวที่มีผล ณ วันที่กำหนด — ใช้ร่วมกันทุกตารางอ้างอิง
     *
     * ⚠️ เรียงจากวันเริ่มมีผลใหม่ไปเก่า แล้วผู้เรียกหยิบตัวแรก
     *    เพราะของจริงมักลืมปิด effective_to ของประกาศฉบับเดิมตอนเพิ่มฉบับใหม่
     *    ถ้าไม่เรียง จะได้อัตราของประกาศเก่าทั้งที่มีฉบับใหม่บังคับใช้แล้ว
     */
    _effective(rows, onDate) {
        const d = onDate instanceof Date ? onDate : (MockFmt.toDate(onDate) || MockDB.TODAY);
        return rows
            .filter(r => (!r.effective_from || MockFmt.toDate(r.effective_from) <= d)
                      && (!r.effective_to   || MockFmt.toDate(r.effective_to)   >= d))
            .sort((a, b) => String(b.effective_from || '').localeCompare(String(a.effective_from || '')));
    },

    /** เวอร์ชัน Grouper ที่บังคับใช้ ณ วันนั้น */
    drgVersion(onDate) {
        return this._effective(IPD_DRG_VERSIONS, onDate)[0] || IPD_DRG_VERSIONS[0] || null;
    },

    /**
     * กลุ่ม DRG — กรองด้วยเวอร์ชันที่บังคับ ณ วันนั้นก่อน
     * ถ้าไม่พบในเวอร์ชันนั้นจึงค่อยหาทั้งตาราง (กันเคสที่ตารางยังไม่ครบทุกเวอร์ชัน)
     */
    drg(code, onDate) {
        if (!code) return null;
        const v = this.drgVersion(onDate);
        const rows = MockDB.all('ipd_drg_rows');
        return (v && rows.find(d => d.drg === code && d.version === v.code))
            || rows.find(d => d.drg === code)
            || null;
    },

    /** ทุกกลุ่ม DRG ที่บังคับใช้ ณ วันนั้น — ใช้ในหน้าตารางอ้างอิง */
    drgTable(onDate) {
        const v = this.drgVersion(onDate);
        const rows = MockDB.all('ipd_drg_rows');
        return v ? rows.filter(d => d.version === v.code) : rows;
    },

    /** อัตราจ่ายต่อ 1 RW ของกองทุน ณ วันนั้น — null = กองทุนนั้นไม่จ่ายตาม DRG */
    rateRow(fundKey, onDate) {
        return this._effective(MockDB.all('ipd_rate_rows').filter(r => r.fund === fundKey), onDate)[0] || null;
    },
    rate(fundKey, onDate) {
        const r = this.rateRow(fundKey, onDate);
        return (r && r.rate != null) ? r.rate : null;
    },

    /** สูตร outlier ที่บังคับใช้ ณ วันนั้น */
    outlierRule(onDate) {
        return this._effective(IPD_OUTLIER_RULES, onDate)[0] || IPD_OUTLIER_RULES[0];
    },

    /**
     * จัดกลุ่ม DRG ใหม่จากรหัสที่บันทึกจริง — "Grouper จำลอง"
     *
     * ⚠️ นี่ไม่ใช่ Grouper จริง เป็นการจับคู่ PDx กับคอลัมน์ pdx[] ในตารางเท่านั้น
     *    Grouper จริงใช้ทั้ง PDx + SDx + Proc + อายุ + เพศ + สถานะจำหน่าย
     *    เมื่อได้คู่มือ [D4] แล้ว ต้องแทนที่ทั้งเมธอดนี้ หรือเรียก Grouper ของโรงพยาบาลผ่าน API
     *    ใช้โดยกฎ RUL-IPD-023 (รหัสไม่ตรงกลุ่ม) ซึ่งยังเป็น DRAFT อยู่
     */
    regroup(stay) {
        if (!stay || !stay.pdx) return null;
        return this.drgTable(this.asOf(stay)).find(d => (d.pdx || []).includes(stay.pdx)) || null;
    },

    /**
     * กลุ่มที่ RW สูงสุดในบรรดารหัสทั้งหมดที่บันทึกไว้ในแฟ้ม (PDx + SDx)
     * ใช้โดยกฎ RUL-IPD-025 เพื่อชี้ว่าเลือก PDx ที่ให้ค่าชดเชยต่ำกว่าที่แฟ้มรองรับหรือไม่
     */
    bestGroup(stay) {
        if (!stay) return null;
        const codes = [stay.pdx, ...(stay.sdx || []).map(d => d.code)].filter(Boolean);
        const rows  = this.drgTable(this.asOf(stay))
            .filter(d => codes.some(c => (d.pdx || []).includes(c)));
        return rows.sort((a, b) => b.rw - a.rw)[0] || null;
    },

    /* ── วันนอน ────────────────────────────────────────── */

    /**
     * วันนอนที่เบิกได้ = (วันจำหน่าย − วันรับ) − วันลากลับบ้าน
     * ถ้ายังไม่จำหน่าย ใช้วันนี้เป็นปลายทาง (LOS ที่เดินอยู่)
     * ⭐ นี่คือตัวเลขที่กฎ RUL-IPD-006 / NHSO C112 ตรวจ
     */
    los(stay) {
        if (!stay) return 0;
        const from = MockFmt.toDate(stay.admit_at);
        const to   = stay.discharge_at ? MockFmt.toDate(stay.discharge_at) : MockDB.TODAY;
        if (!from || !to) return 0;
        const days = Math.floor((to - from) / 864e5) + 1;
        return Math.max(1, days - (stay.leave_days || 0));
    },

    /** LOS เทียบจุดตัดของ DRG — 'low' | 'normal' | 'high' | 'unknown' */
    losBand(stay) {
        const d = this.drgOf(stay);
        if (!d) return 'unknown';
        const l = this.los(stay);
        return l < d.trimLow ? 'low' : l > d.trimHigh ? 'high' : 'normal';
    },

    /* ── DRG ───────────────────────────────────────────── */

    /** แถว DRG ของเคสนี้ตามเวอร์ชันที่บังคับ ณ วันจำหน่าย — ทางเข้าเดียวของทุกหน้า */
    drgOf(stay) { return stay ? this.drg(stay.drg, this.asOf(stay)) : null; },

    /**
     * AdjRW — น้ำหนักสัมพัทธ์หลังปรับด้วยวันนอน
     *
     * ⚠️ ค่าคงที่ของสูตรอ่านจาก IPD_OUTLIER_RULES ไม่ hardcode ที่นี่
     *    เพื่อให้แทนด้วยสูตรจริงจากคู่มือ [D4] ได้โดยไม่ต้องแก้โค้ด
     *    ตอนนี้ยังเป็นสูตรจำลอง (verified:false) — ในระบบจริงการปรับ outlier
     *    มีสูตรและค่าคงที่ที่ประกาศไว้ชัดเจน
     */
    adjRw(stay) {
        const d = this.drgOf(stay);
        if (!d) return null;
        const o = this.outlierRule(this.asOf(stay));
        const l = this.los(stay);
        let v = d.rw;
        if (l < d.trimLow && o.low.kind === 'PRORATE') {
            v = Math.max(d.rw * o.low.floor, d.rw * (l / d.trimLow));
        }
        if (l > d.trimHigh && o.high.kind === 'PER_DAY') {
            v = d.rw + (d.rw / d.alos) * (l - d.trimHigh) * o.high.factor;
        }
        return Math.round(v * 10000) / 10000;
    },

    /** ประมาณการรับ = AdjRW × อัตราต่อ RW ณ วันจำหน่าย (null ถ้ากองทุนไม่จ่ายตาม DRG) */
    estimate(stay) {
        if (!stay) return null;
        const rate = this.rate(stay.fund, this.asOf(stay));
        const arw  = this.adjRw(stay);
        if (rate == null || arw == null) return null;
        return Math.round(arw * rate);
    },

    /** ค่าใช้จ่ายจริงรวมทุกหมวด */
    cost(stay) {
        return (stay && stay.charges || []).reduce((a, c) => a + (Number(c.amount) || 0), 0);
    },

    /** ส่วนต่าง = ค่าใช้จ่ายจริง − ประมาณการรับ (บวก = โรงพยาบาลรับภาระ) */
    variance(stay) {
        const est = this.estimate(stay);
        return est == null ? null : this.cost(stay) - est;
    },

    /** ค่าใช้จ่ายสะสมรายวัน — ใช้วาดกราฟเส้นในหน้า ipd-admit */
    costSeries(stay) {
        let acc = 0;
        return (stay && stay.daily || []).map(d => (acc += d.charge_day));
    },

    /* ── แฟ้ม / เอกสารตามกองทุน ─────────────────────────── */

    /**
     * ตรวจแฟ้มตามกองทุน — ห่อ MockNhso.checkFiles()
     * กองทุนที่ไม่ผ่าน NHSO (PVT) ไม่มีชุดข้อมูล 15 แฟ้ม → คืน nhso:false
     * ให้หน้าจอสลับไปแสดงชุดเอกสารของบริษัทประกันแทน
     */
    fileCheck(stay) {
        const f = this.fund(stay && stay.fund);
        if (!f || !f.nhso) {
            return { nhso: false, ok: true, fundLabel: f ? f.label : '—',
                     inScope: [], required: [], sent: [], missing: [], notApplicable: [], extra: [] };
        }
        const r = MockNhso.checkFiles(f.nhsoFund, stay.files_sent, stay.file_ctx);
        return { nhso: true, ...r };
    },

    /** รายการเงื่อนไขกองทุนพร้อมป้ายชื่อ — 1 แถวต่อ 1 ข้อบนหน้าจอ */
    fundCheckItems(stay) {
        const r = this.fundRule(stay && stay.fund);
        const saved = {};
        (stay && stay.fund_check || []).forEach(c => { saved[c.key] = c; });

        const rows = [
            { key: 'preAuth',   label: r.preAuth.label,
              detail: r.preAuth.note, required: r.preAuth.required },
            { key: 'submitDue', label: `กำหนดยื่นภายใน ${r.submitDue.days} วันนับจาก${r.submitDue.from}`,
              detail: r.submitDue.note, required: true },
            ...r.docs.map(d => ({ key: d.key, label: d.label, detail: '', required: true })),
        ];
        return rows.map(row => ({
            ...row,
            state: saved[row.key] ? saved[row.key].state : 'MISSING',
            note:  saved[row.key] ? saved[row.key].note  : '',
        }));
    },

    /** วันสุดท้ายที่ยื่นได้ตามเงื่อนไขกองทุน — null ถ้ายังไม่จำหน่าย */
    submitDeadline(stay) {
        if (!stay || !stay.discharge_at) return null;
        const r = this.fundRule(stay.fund);
        const d = MockFmt.toDate(stay.discharge_at);
        if (!d) return null;
        d.setDate(d.getDate() + r.submitDue.days);
        return `${d.getFullYear() + 543}-${String(d.getMonth() + 1).padStart(2, '0')}-`
             + `${String(d.getDate()).padStart(2, '0')}T16:00`;
    },

    /* ── รายการตรวจเวชระเบียน ───────────────────────────── */

    /**
     * รายการตรวจที่ใช้กับเคสนี้ พร้อมสถานะปัจจุบัน
     * ข้อที่ไม่เข้าเงื่อนไข (ไม่มีหัตถการ / ไม่มีการลากลับบ้าน / กองทุนไม่บังคับ) → NA
     */
    chartSections(stay) {
        if (!stay) return [];
        const saved = {};
        (stay.chart_audit || []).forEach(c => { saved[c.key] = c; });

        const hasProc  = (stay.proc || []).length > 0;
        const leaveDay = (stay.leave_days || 0) > 0;
        const preAuth  = this.fundRule(stay.fund).preAuth.required;

        return IPD_CHART_SECTIONS
            .filter(s => !s.appliesTo || s.appliesTo.includes(stay.fund))
            .map(s => {
                let applicable = true;
                if (s.needs === 'proc')     applicable = hasProc;
                if (s.needs === 'leaveDay') applicable = leaveDay;
                if (s.needs === 'preAuth')  applicable = preAuth;
                const rec = saved[s.key];
                return {
                    ...s,
                    applicable,
                    state: !applicable ? 'NA' : (rec ? rec.state : 'MISSING'),
                    by:    rec ? rec.by   : null,
                    note:  rec ? rec.note : '',
                };
            });
    },

    /** คะแนนเวชระเบียน — นับเฉพาะข้อที่ใช้กับเคสนี้ */
    chartScore(stay) {
        const rows = this.chartSections(stay).filter(r => r.applicable);
        const max  = rows.reduce((a, r) => a + r.weight, 0);
        const got  = rows.filter(r => r.state === 'OK').reduce((a, r) => a + r.weight, 0);
        return { got, max, pct: max ? Math.round((got / max) * 100) : 100,
                 missing: rows.filter(r => r.state === 'MISSING') };
    },

    /** สรุปคะแนนรายกลุ่ม — ใช้แสดงหัวข้อในแท็บเวชระเบียน */
    chartByGroup(stay) {
        const rows = this.chartSections(stay);
        return IPD_CHART_GROUPS.map(g => {
            const items = rows.filter(r => r.group === g.key);
            const app   = items.filter(r => r.applicable);
            return { ...g, items,
                     ok: app.filter(r => r.state === 'OK').length, total: app.length };
        }).filter(g => g.items.length);
    },

    /* ── กฎที่ใช้กับเคสนี้ ──────────────────────────────── */

    /**
     * กฎที่ตรวจเคสผู้ป่วยในนี้ — BR-01: เลือกตามกองทุน + ประเภทบริการ + ช่วงมีผล
     * แล้วประเมินว่าเคสนี้ "ติด" กฎข้อนั้นจริงหรือไม่
     *
     * วันที่ใช้เทียบช่วงมีผลของกฎ = วันจำหน่าย (เพราะผู้ป่วยในส่งเบิกตอนจำหน่าย)
     * เคสที่ยังนอนอยู่ใช้วันนี้แทน — ถ้าใช้วันรับไว้ เคสที่นอนข้ามช่วงประกาศ
     * จะถูกตรวจด้วยกฎรุ่นเก่าทั้งที่จะส่งเบิกภายใต้กฎรุ่นใหม่
     */
    rulesFor(stay) {
        if (!stay) return [];
        const onDate = stay.discharge_at ? MockFmt.toDate(stay.discharge_at) : MockDB.TODAY;

        return MockDB.all('rules')
            .filter(r => r.status === 'ACTIVE'
                      && (r.services || []).includes('IPD')
                      && (r.funds || []).includes(stay.fund)
                      && (!r.effective_from || MockFmt.toDate(r.effective_from) <= onDate)
                      && (!r.effective_to   || MockFmt.toDate(r.effective_to)   >= onDate))
            .map(r => {
                const hit = this._ruleHit(r, stay);
                return { ...r, hit: !!hit, evidence: hit || null };
            });
    },

    /**
     * ตรรกะการยิงกฎรายข้อ — คืน evidence object เมื่อ "ติด" คืน null เมื่อผ่าน
     * ต้นแบบยังไม่มี rule engine จริง จึงผูกรหัสกฎกับเงื่อนไขตรง ๆ ที่นี่
     */
    _ruleHit(rule, stay) {
        const fc = this.fileCheck(stay);
        const cs = this.chartSections(stay);
        const st = k => { const r = cs.find(x => x.key === k); return r ? r.state : 'NA'; };

        switch (rule.id) {
            case 'RUL-IPD-006':
            case 'RUL-IPD-016': {
                if (!(stay.leave_days > 0)) return null;
                if (fc.nhso && fc.missing.includes(15)) {
                    return { 'วันลากลับบ้าน': `${stay.leave_days} วัน`,
                             'แฟ้มที่ขาด': MockNhso.fileNames([15]),
                             'วันนอนที่เบิกได้': `${this.los(stay)} วัน` };
                }
                return st('leave_record') === 'MISSING'
                    ? { 'วันลากลับบ้าน': `${stay.leave_days} วัน`, 'เอกสารที่ขาด': 'บันทึกการลากลับบ้าน' }
                    : null;
            }
            case 'RUL-IPD-017':
                return (!stay.pdx || !stay.drg)
                    ? { 'การวินิจฉัยหลัก': stay.pdx || 'ยังไม่ระบุ',
                        'กลุ่ม DRG': stay.drg || 'จัดกลุ่มไม่ได้' }
                    : null;
            case 'RUL-IPD-018': {
                if (this.losBand(stay) !== 'high') return null;
                const d = this.drgOf(stay);
                return { 'วันนอนที่เบิกได้': `${this.los(stay)} วัน`,
                         'จุดตัดบนของกลุ่ม': `${d.trimHigh} วัน`,
                         'กลุ่ม DRG': `${d.drg} ${d.label}` };
            }
            case 'RUL-IPD-019':
                return (st('sign_doctor') === 'MISSING' || st('discharge_summary') === 'MISSING')
                    ? { 'ใบสรุปการจำหน่าย': st('discharge_summary') === 'OK' ? 'มี' : 'ไม่พบ',
                        'ลายเซ็นแพทย์ผู้รักษา': st('sign_doctor') === 'OK' ? 'มี' : 'ไม่พบ' }
                    : null;
            case 'RUL-IPD-020': {
                const c = (stay.fund_check || []).find(x => x.key === 'sss_card');
                return (!c || c.state !== 'OK')
                    ? { 'เอกสารที่ขาด': 'สำเนาบัตรรับรองสิทธิ / หลักฐานการตรวจสอบสิทธิ',
                        'ระยะเวลานอน': `${this.los(stay)} วัน` }
                    : null;
            }
            case 'RUL-IPD-021': {
                const c = (stay.fund_check || []).find(x => x.key === 'approve_code');
                return (!c || c.state !== 'OK')
                    ? { 'สิทธิ': 'เบิกจ่ายตรงกรมบัญชีกลาง',
                        'สิ่งที่ขาด': 'เลขอนุมัติ / Approve Code',
                        'ผลถ้าไม่แก้': 'NHSO ตอบกลับ C305' }
                    : null;
            }
            case 'RUL-IPD-022': {
                const need = ['claim_form', 'policy_doc', 'consent'];
                const miss = need.filter(k => {
                    const c = (stay.fund_check || []).find(x => x.key === k);
                    return !c || c.state !== 'OK';
                });
                if (!miss.length) return null;
                const lbl = { claim_form: 'ใบเรียกร้องค่าสินไหมทดแทน',
                              policy_doc: 'สำเนากรมธรรม์/เลขกรมธรรม์',
                              consent: 'หนังสือยินยอมเปิดเผยข้อมูล' };
                return { 'เอกสารที่ขาด': miss.map(k => lbl[k]).join(', '),
                         'ผู้รับเรื่อง': this.fund(stay.fund).payer };
            }
            case 'RUL-FIL-001':
                return (fc.nhso && fc.missing.length)
                    ? { 'กองทุน': fc.fundLabel, 'แฟ้มที่ขาด': MockNhso.fileNames(fc.missing) }
                    : null;

            /* ── กฎที่ยังเป็น DRAFT รอเอกสาร — ตรรกะพร้อมแล้ว รอเปลี่ยนสถานะเป็น ACTIVE ──
               เขียนไว้ล่วงหน้าเพราะถ้าปล่อยให้ตกลง default แล้วเปิดใช้ทีหลัง
               กฎจะกลายเป็นแถวที่ "ผ่านตลอด" เงียบ ๆ และไปเพิ่มตัวหารในหน้าผลกฎโดยไม่มีใครรู้ */

            case 'RUL-IPD-023': {
                /* จัดกลุ่มซ้ำจากรหัสที่บันทึกจริง แล้วเทียบกับกลุ่มที่ระบุไว้ */
                const regrouped = this.regroup(stay);
                if (!regrouped || !stay.drg || regrouped.drg === stay.drg) return null;
                return { 'กลุ่มที่ระบุในแฟ้ม': stay.drg,
                         'กลุ่มที่จัดได้จากรหัสจริง': `${regrouped.drg} ${regrouped.label}`,
                         'การวินิจฉัยหลัก': stay.pdx || 'ยังไม่ระบุ' };
            }
            case 'RUL-IPD-024': {
                /* upcoding — RW ที่ได้เมื่อรวม SDx ทั้งหมด เทียบกับเมื่อนับเฉพาะที่มีผลตรวจรองรับ */
                const d = this.drgOf(stay);
                if (!d || !(stay.sdx || []).length) return null;
                if (st('dx_supported') !== 'MISSING') return null;
                return { 'กลุ่มที่ได้': `${d.drg} · RW ${d.rw.toFixed(4)}`,
                         'การวินิจฉัยร่วมที่บันทึก': (stay.sdx || []).map(x => x.code).join(', '),
                         'ประเด็น': 'ยังไม่มีผลตรวจสนับสนุนการวินิจฉัย — ต้องมีผู้ทบทวนรับรองก่อนส่ง' };
            }
            case 'RUL-IPD-025': {
                /* downcoding — มีรหัสอื่นในแฟ้มที่จัดได้กลุ่มที่ RW สูงกว่ากลุ่มที่เลือก */
                const cur  = this.drgOf(stay);
                const best = this.bestGroup(stay);
                if (!cur || !best || best.rw <= cur.rw) return null;
                return { 'กลุ่มที่เลือก': `${cur.drg} · RW ${cur.rw.toFixed(4)}`,
                         'กลุ่มที่รหัสในแฟ้มรองรับ': `${best.drg} · RW ${best.rw.toFixed(4)}`,
                         'ส่วนต่าง RW': (best.rw - cur.rw).toFixed(4) };
            }
            case 'RUL-IPD-026': {
                const band = this.losBand(stay);
                if (band === 'normal' || band === 'unknown') return null;
                const d = this.drgOf(stay);
                return { 'วันนอนที่เบิกได้': `${this.los(stay)} วัน`,
                         'จุดตัดของกลุ่ม': `${d.trimLow} – ${d.trimHigh} วัน`,
                         'สถานะ': band === 'high' ? 'เกินจุดตัดบน' : 'ต่ำกว่าจุดตัดล่าง' };
            }
            case 'RUL-IPD-027': {
                /* ค่าห้องต่อวันเกินเพดาน — เพดานอ่านจาก IPD_FUND_RULES.roomCap เมื่อได้เอกสารแล้ว */
                const cap = this.fundRule(stay.fund).roomCap;
                if (cap == null) return null;
                const room = (stay.charges || []).find(c => c.billgrcs === '02');
                if (!room) return null;
                const perDay = Math.round(room.amount / Math.max(1, this.los(stay)));
                if (perDay <= cap) return null;
                const consent = (stay.fund_check || []).find(x => x.key === 'room_upgrade');
                if (consent && consent.state === 'OK') return null;
                return { 'ค่าห้อง/ค่าอาหารต่อวัน': MockFmt.baht(perDay) + ' บาท',
                         'เพดานของกองทุน': MockFmt.baht(cap) + ' บาท',
                         'ส่วนเกินรวม': MockFmt.baht((perDay - cap) * this.los(stay)) + ' บาท',
                         'หนังสือยินยอมส่วนเกิน': 'ไม่พบ' };
            }
            case 'RUL-IPD-028': {
                const dl = this.submitDeadline(stay);
                if (!dl) return null;
                const due = MockFmt.toDate(dl);
                if (!due || due >= MockDB.TODAY) return null;
                return { 'วันจำหน่าย': MockFmt.dateTH(stay.discharge_at),
                         'กำหนดยื่นภายใน': MockFmt.dateTH(dl),
                         'สถานะ': MockFmt.countdown(dl) };
            }
            case 'RUL-IPD-029': {
                /* UCEP ครอบคลุมเฉพาะ 72 ชม.แรก */
                const from = MockFmt.toDate(stay.admit_at);
                const to   = stay.discharge_at ? MockFmt.toDate(stay.discharge_at) : MockDB.TODAY;
                if (!from || !to) return null;
                const hours = (to - from) / 36e5;
                if (hours <= 72) return null;
                return { 'ระยะเวลานับจากรับไว้': `${Math.round(hours)} ชั่วโมง`,
                         'สิทธิ UCEP ครอบคลุม': '72 ชั่วโมงแรก',
                         'สิ่งที่ต้องมี': 'หลักฐานการประสานย้ายผู้ป่วยและการเปลี่ยนสิทธิผู้จ่าย' };
            }

            default:
                /* กฎอื่นที่ scope IPD แต่ยังไม่มีตรรกะเฉพาะ — ถือว่าผ่าน */
                return null;
        }
    },

    /* ── การประเมินรวม ─────────────────────────────────── */

    /**
     * ประเมินความพร้อมส่งเบิกของเคสผู้ป่วยใน
     * result ต้องเป็นค่าใน MockTone.RESULTS เท่านั้น เพื่อให้ป้ายสถานะ
     * เหมือนกับ Claim Worklist / Case Detail ทุกหน้า
     */
    assess(stay) {
        if (!stay) return { score: 0, result: 'FIX', reasons: [] };

        const chart   = this.chartScore(stay);
        const files   = this.fileCheck(stay);
        const fundRow = this.fundCheckItems(stay).filter(r => r.required && r.state === 'MISSING');
        const hits    = this.rulesFor(stay).filter(r => r.hit);

        const reasons = [];
        if (files.nhso && files.missing.length) {
            reasons.push({ tone: 'danger',
                text: `ยังไม่ได้ส่งแฟ้ม ${MockNhso.fileNames(files.missing)} ตามที่กองทุน${files.fundLabel}กำหนด` });
        }
        if (!stay.pdx) reasons.push({ tone: 'danger', text: 'ยังไม่ได้ระบุการวินิจฉัยหลัก (PDx)' });
        if (!stay.drg) reasons.push({ tone: 'danger', text: 'จัดกลุ่ม DRG จากรหัสที่บันทึกไม่ได้' });
        fundRow.forEach(r => reasons.push({ tone: 'warning', text: 'เงื่อนไขกองทุน: ' + r.label }));
        chart.missing.forEach(r => reasons.push({ tone: 'warning', text: 'เวชระเบียน: ' + r.label }));
        hits.forEach(r => reasons.push({ tone: r.severity === 'ERROR' ? 'danger' : 'warning',
                                         text: `${r.id} — ${r.name}` }));
        if (this.losBand(stay) === 'high') {
            reasons.push({ tone: 'warning', text: 'วันนอนเกินจุดตัดบนของกลุ่ม DRG — ต้องมีเหตุผลทางการแพทย์ประกอบ' });
        }

        /* คะแนน: เวชระเบียน 60 + แฟ้ม 20 + เงื่อนไขกองทุน 20 */
        const fundItems = this.fundCheckItems(stay).filter(r => r.required);
        const fundPct   = fundItems.length
            ? (fundItems.filter(r => r.state === 'OK').length / fundItems.length) * 100 : 100;
        const filePct   = (!files.nhso || !files.required.length) ? 100
            : ((files.required.length - files.missing.length) / files.required.length) * 100;
        const score = Math.round(chart.pct * 0.6 + filePct * 0.2 + fundPct * 0.2);

        /* ลำดับความรุนแรง: ระงับส่ง → ต้องแก้ไข → ต้องอนุมัติ → แจ้งเตือน → ผ่าน */
        const blocked = (files.nhso && files.missing.length > 0) || !stay.pdx || !stay.drg
                     || hits.some(h => h.action === 'BLOCK');
        const mustFix = hits.some(h => h.severity === 'ERROR') || chart.pct < 80 || fundPct < 80;
        /* ⚠️ ห้ามใช้ "ส่วนต่างจากประมาณการ DRG" มาตัดสินผลตรวจ
           อัตราจ่ายต่อ RW ยังเป็นค่าจำลอง ส่วนต่างจึงยังไม่ใช่ข้อค้นพบที่เชื่อถือได้
           ให้แสดงเป็นข้อมูลประกอบเท่านั้น · เคสวันนอนยาวถูกจับด้วย RUL-IPD-018 อยู่แล้ว */
        const needApprove = hits.some(h => h.action === 'APPROVE');

        const result = blocked ? 'BLOCK'
                     : mustFix ? 'FIX'
                     : needApprove ? 'APPROVE'
                     : score < 100 ? 'WARN'
                     : 'PASS';

        return { score, result, reasons, chart, files, hits,
                 fundMissing: fundRow, fundPct: Math.round(fundPct), filePct: Math.round(filePct) };
    },

    /**
     * ขั้นความพร้อมส่งเบิก 5 ขั้น — คำนวณจากข้อมูลจริงของเคส ไม่ hardcode
     * ใช้เรนเดอร์ .ds-stepper ให้เหมือนหน้า claim-case
     */
    steps(stay) {
        const a = this.assess(stay);
        return [
            { label: 'ข้อมูลรับไว้ครบ',  ok: !!stay.admit_at && !!stay.ward },
            { label: 'จำหน่ายแล้ว',       ok: !this.statusOf(stay.status).open },
            { label: 'ให้รหัสครบ',        ok: !!stay.pdx && !!stay.drg },
            { label: 'เวชระเบียนครบ',     ok: a.chart.pct === 100 },
            { label: 'เอกสารกองทุนครบ',   ok: a.fundPct === 100 && a.filePct === 100 },
        ];
    },

    /* ── สรุปภาพรวมสำหรับ KPI ──────────────────────────── */

    stats(rows) {
        const list = rows || this.all();
        const openRows = list.filter(s => this.statusOf(s.status).open);
        return {
            total:      list.length,
            admitted:   openRows.length,
            losOver:    list.filter(s => this.losBand(s) === 'high').length,
            /* นับเฉพาะเคสที่จำหน่ายแล้ว — เคสที่ยังนอนอยู่ยังไม่ถึงกำหนดส่งแฟ้ม
               ถ้านับรวมด้วย KPI จะสูงค้างตลอดเวลาและกดไปดูก็ยังทำอะไรไม่ได้ */
            filesShort: list.filter(s => !this.statusOf(s.status).open)
                            .filter(s => { const f = this.fileCheck(s); return f.nhso && f.missing.length; }).length,
            pending:    list.filter(s => s.audit_status === 'PENDING').length,
            inReview:   list.filter(s => s.audit_status === 'IN_REVIEW').length,
            returned:   list.filter(s => s.audit_status === 'RETURNED').length,
            cleared:    list.filter(s => s.audit_status === 'CLEARED').length,
            cost:       list.reduce((a, s) => a + this.cost(s), 0),
            estimate:   list.reduce((a, s) => a + (this.estimate(s) || 0), 0),
            variance:   list.reduce((a, s) => a + (this.variance(s) || 0), 0),
            avgLos:     openRows.length
                ? Math.round((openRows.reduce((a, s) => a + this.los(s), 0) / openRows.length) * 10) / 10 : 0,
        };
    },

    /** ค่าที่ยังยืนยันกับเอกสารไม่ได้ → ให้หน้าจอขึ้นป้าย "รอยืนยัน" */
    unverified(o) { return !!o && o.verified === false; },
};

MockDB.register('ipd_stays', MOCK_IPD_STAYS);

/* ตารางอ้างอิงลงทะเบียนเป็นตารางของ MockDB ด้วย เพื่อให้แท็บ "นำเข้า" ในหน้า
   ipd-reference.html แก้ค่าผ่าน MockDB.patch/insert ได้ตามกลไก overlay เดิม
   id ต้องไม่ซ้ำ — DRG ใช้ (เวอร์ชัน + รหัส) · อัตราจ่ายใช้ (กองทุน + วันเริ่มมีผล) */
MockDB.register('ipd_drg_rows',  IPD_DRG_TABLE.map(d => ({ id: `${d.version}/${d.drg}`, ...d })));
MockDB.register('ipd_rate_rows', IPD_FUND_RATES.map(r => ({ id: `${r.fund}/${r.effective_from}`, ...r })));

window.IPD_UNVERIFIED_NOTE  = IPD_UNVERIFIED_NOTE;
window.IPD_WARDS            = IPD_WARDS;
window.IPD_STAY_STATUS      = IPD_STAY_STATUS;
window.IPD_AUDIT_STATUS     = IPD_AUDIT_STATUS;
window.IPD_DISCHARGE_TYPE   = IPD_DISCHARGE_TYPE;
window.IPD_DISCHARGE_STATUS = IPD_DISCHARGE_STATUS;
window.IPD_CHECK_STATE      = IPD_CHECK_STATE;
window.IPD_FUNDS            = IPD_FUNDS;
window.IPD_FUND_RULES       = IPD_FUND_RULES;
window.IPD_SOURCES          = IPD_SOURCES;
window.IPD_SOURCE_TONE      = IPD_SOURCE_TONE;
window.IPD_PROVIDES         = IPD_PROVIDES;
window.IPD_DRG_VERSIONS     = IPD_DRG_VERSIONS;
window.IPD_MDC              = IPD_MDC;
window.IPD_DRG_TABLE        = IPD_DRG_TABLE;
window.IPD_FUND_RATES       = IPD_FUND_RATES;
window.IPD_FUND_RATE_NOTE   = IPD_FUND_RATE_NOTE;
window.IPD_OUTLIER_RULES    = IPD_OUTLIER_RULES;
window.IPD_CHART_GROUPS     = IPD_CHART_GROUPS;
window.IPD_CHART_SECTIONS   = IPD_CHART_SECTIONS;
window.MOCK_IPD_STAYS       = MOCK_IPD_STAYS;
window.MockIpd              = MockIpd;
