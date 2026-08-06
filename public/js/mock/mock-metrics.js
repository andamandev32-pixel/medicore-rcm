/**
 * MediCore RCM — MOCK METRICS (แนวโน้มและตัวชี้วัด)
 * ------------------------------------------------------------
 * SRS §15 · ตัวชี้วัด 6 มิติ
 *
 * ⚠️ ตัวเลข "ก่อน–หลัง" ในไฟล์นี้เป็นตัวอย่างเพื่ออธิบายรูปแบบผลลัพธ์
 *    ไม่ใช่ค่าเป้าหมายที่รับรองล่วงหน้า — ตรงกับที่ระบุไว้ใน Executive Summary
 *    ทุกหน้าที่แสดงตัวเลขชุดนี้ต้องแสดงคำกำกับด้วยเสมอ
 */

const METRIC_DISCLAIMER =
    'ตัวเลขก่อน–หลังเป็นตัวอย่างเพื่ออธิบายรูปแบบผลลัพธ์ มิใช่ค่าเป้าหมายที่รับรองล่วงหน้า '
  + 'ค่าจริงจะกำหนดหลังวิเคราะห์ข้อมูลย้อนหลัง ปริมาณเคส และขอบเขต Pilot ของโรงพยาบาล';

/** 12 เดือนย้อนหลัง — เส้นแบ่งคือเดือนที่เริ่มใช้ระบบ (พ.ค. 2569) */
const MOCK_TREND = {
    labels: ['ก.ย.68', 'ต.ค.68', 'พ.ย.68', 'ธ.ค.68', 'ม.ค.69', 'ก.พ.69',
             'มี.ค.69', 'เม.ย.69', 'พ.ค.69', 'มิ.ย.69', 'ก.ค.69', 'ส.ค.69'],
    reject_rate:  [12.4, 12.1, 12.8, 11.9, 12.2, 11.6, 11.8, 11.2, 10.1, 8.6, 7.4, 7.0],
    first_pass:   [77.8, 78.2, 77.1, 78.6, 78.0, 79.2, 79.0, 80.4, 83.1, 86.7, 89.2, 90.4],
    started_at:   'พ.ค.69',
};

/** มูลค่าที่ระบบดักได้ก่อนส่ง (บาท/สัปดาห์) — 10 สัปดาห์ล่าสุด */
const MOCK_WEEKLY_PREVENTED = {
    labels: ['W22', 'W23', 'W24', 'W25', 'W26', 'W27', 'W28', 'W29', 'W30', 'W31'],
    values: [18400, 24100, 31800, 28900, 36200, 41500, 38700, 44200, 47800, 52100],
};

/** ตารางก่อน–หลัง (SRS §15 + Executive Summary หน้า 4) */
const MOCK_BEFORE_AFTER = [
    { key: 'reject',    metric: 'Reject Rate', sub: 'อัตราเคลมถูกตีกลับ',
      how: 'จำนวนเคส Reject ÷ จำนวนเคสที่ส่งทั้งหมด × 100',
      before: '12%', after: '7%', dir: 'down',
      impact: 'Reject ลดลง 5 จุดเปอร์เซ็นต์ หรือประมาณ 42% จากฐานเดิม สะท้อนว่าพบและแก้ประเด็นได้ก่อนส่งมากขึ้น' },
    { key: 'firstpass', metric: 'First-pass Acceptance', sub: 'ผ่านตั้งแต่ส่งครั้งแรก',
      how: 'จำนวนเคสที่ผ่านครั้งแรก ÷ จำนวนเคสที่ส่งทั้งหมด × 100',
      before: '78%', after: '90%', dir: 'up',
      impact: 'ลดการแก้ไขและส่งซ้ำ ทำให้วงจรรับชำระสั้นลง และลดงานติดตามย้อนหลังของหน่วย Claim' },
    { key: 'time',      metric: 'เวลาตรวจเฉลี่ยต่อเคส', sub: 'ประสิทธิภาพการทำงาน',
      how: 'เวลาตั้งแต่เปิดตรวจจนยืนยันพร้อมส่ง ÷ จำนวนเคสที่ตรวจ',
      before: '18 นาที', after: '10 นาที', dir: 'down',
      impact: 'ลดลง 8 นาทีต่อเคส เพราะระบบชี้ประเด็น กฎ และเอกสารอ้างอิงให้ตรวจในจุดเดียว' },
    { key: 'sla',       metric: 'งานเกิน SLA', sub: 'การประสานงาน',
      how: 'จำนวน Task ที่เกินกำหนด ÷ Task ทั้งหมด × 100',
      before: '22%', after: '8%', dir: 'down',
      impact: 'เห็น Owner และงานค้างชัดเจน ช่วยเร่งแก้ไขก่อนถึงรอบส่ง Claim และลดเคสตกหล่น' },
    { key: 'money',     metric: 'มูลค่าความเสี่ยงที่ป้องกันได้', sub: 'ผลทางการเงิน',
      how: 'มูลค่ารายการเสี่ยงที่ระบบพบ และได้รับการแก้ไขก่อนส่ง โดยมีหลักฐานตรวจสอบ',
      before: 'ไม่สามารถระบุได้', after: '450,000 บาท / ไตรมาส', dir: 'up',
      impact: 'แสดงมูลค่าที่ได้รับการป้องกันพร้อมรายการอ้างอิง เพื่อใช้ประเมินความคุ้มค่าและจัดลำดับกฎที่ควรพัฒนา' },
];

/** ตัวชี้วัด 6 มิติตาม SRS §15 */
const MOCK_KPI_DIMENSIONS = [
    { dim: 'คุณภาพ Claim',    items: ['Reject rate', 'มูลค่าถูกตัด', 'First-pass acceptance', 'Resubmission rate'] },
    { dim: 'ประสิทธิภาพงาน',  items: ['เวลาตรวจต่อเคส', 'งานค้าง/เกิน SLA', 'ระยะเวลาปิด Issue'] },
    { dim: 'คุณภาพกฎ',       items: ['Hit Rate', 'True Issue Rate', 'Override Rate', 'False Positive'] },
    { dim: 'ผลทางการเงิน',    items: ['Reject Prevention', 'Financial Impact', 'มูลค่าที่กู้คืน/ป้องกันได้'] },
    { dim: 'การใช้ความรู้',   items: ['จำนวนเอกสารรับรอง', 'อัตราคำตอบมี Citation', 'การใช้ Knowledge Center'] },
    { dim: 'ความยั่งยืน',     items: ['สัดส่วนกฎ/เอกสารที่โรงพยาบาลจัดการเอง', 'จำนวนผู้ดูแลที่ผ่านการอบรม'] },
];

/** แผนส่งมอบ 4 ระยะ (SRS §13) — ใช้ทั้งหน้า Dashboard และสไลด์ 17 */
const MOCK_PHASES = [
    { no: 0, name: 'Discovery & Baseline', status: 'ACTIVE',
      scope: 'ยืนยันกระบวนการ กองทุน ข้อมูล Pain point KPI และ Interface',
      deliver: 'As-is/To-be · Data Dictionary · Interface Spec · Prioritized Backlog · UAT Plan',
      weeks: '4–6 สัปดาห์', start: '2569-08', end: '2569-09' },
    { no: 1, name: 'Foundation & Rule Template', status: 'NEXT',
      scope: 'Integration, Claim Case, Worklist, Dashboard, กฎสำเร็จรูป, Reject import, RAG ชุดเอกสารแรก',
      deliver: 'MVP ใช้งานกับขอบเขตนำร่อง และผลวัด Baseline',
      weeks: '10–14 สัปดาห์', start: '2569-09', end: '2569-12' },
    { no: 2, name: 'Hospital Self-management', status: 'PLAN',
      scope: 'No-code Rule Builder, Back-test, Version/Approval, Knowledge admin, Task/SLA/Escalation',
      deliver: 'โรงพยาบาลสร้าง/ปรับกฎและเอกสารได้เองภายใต้ Governance',
      weeks: '10–12 สัปดาห์', start: '2570-01', end: '2570-03' },
    { no: 3, name: 'AI-assisted Improvement', status: 'PLAN',
      scope: 'อ่าน Clinical text, Coding assist, วิเคราะห์ Reject ซ้ำ, Draft Rule suggestion, Quality monitoring',
      deliver: 'AI ช่วยวิเคราะห์พร้อมหลักฐานและ Human approval',
      weeks: '12–16 สัปดาห์', start: '2570-04', end: '2570-07' },
];

const PHASE_TONE = {
    ACTIVE: { badge: 'in-progress', label: 'กำลังดำเนินการ' },
    NEXT:   { badge: 'scheduled',   label: 'ระยะถัดไป' },
    PLAN:   { badge: 'pending',     label: 'ตามแผน' },
    DONE:   { badge: 'completed',   label: 'เสร็จแล้ว' },
};

/** กฎทางธุรกิจ BR-01..BR-08 (SRS §6) — ใช้ในหน้าผู้ดูแลและสไลด์ธรรมาภิบาล */
const MOCK_BUSINESS_RULES = [
    { code: 'BR-01', text: 'กฎต้องเลือกตามวันที่รับบริการ ช่วงเวลามีผล กองทุน และประเภทบริการ' },
    { code: 'BR-02', text: 'กฎ Active ที่เคยประมวลผลแล้วห้ามแก้ทับ ต้อง Clone เป็น Version ใหม่' },
    { code: 'BR-03', text: 'ทุกผลตรวจต้องย้อนกลับได้ถึง Rule Code/Version และข้อมูลที่ใช้ตัดสิน' },
    { code: 'BR-04', text: 'การ Override ต้องมีผู้ดำเนินการ เวลา เหตุผล และหลักฐานตามระดับความเสี่ยง' },
    { code: 'BR-05', text: 'กฎระงับส่งหรือมีผลสูงต้องผ่าน Maker–Checker/Approval' },
    { code: 'BR-06', text: 'คำตอบ RAG ต้องแสดงแหล่งอ้างอิง และต้องแจ้งเมื่อหลักฐานไม่เพียงพอ' },
    { code: 'BR-07', text: 'AI เสนอแนะได้ แต่ไม่เปิดใช้กฎหรืออนุมัติเคสทางการแพทย์เอง' },
    { code: 'BR-08', text: 'ข้อมูลจาก HIS ต้นทางไม่ถูกแก้โดยระบบ เว้นแต่มี Interface และสิทธิ์ที่โรงพยาบาลอนุมัติเป็นลายลักษณ์อักษร' },
];

window.METRIC_DISCLAIMER      = METRIC_DISCLAIMER;
window.MOCK_TREND             = MOCK_TREND;
window.MOCK_WEEKLY_PREVENTED  = MOCK_WEEKLY_PREVENTED;
window.MOCK_BEFORE_AFTER      = MOCK_BEFORE_AFTER;
window.MOCK_KPI_DIMENSIONS    = MOCK_KPI_DIMENSIONS;
window.MOCK_PHASES            = MOCK_PHASES;
window.PHASE_TONE             = PHASE_TONE;
window.MOCK_BUSINESS_RULES    = MOCK_BUSINESS_RULES;
