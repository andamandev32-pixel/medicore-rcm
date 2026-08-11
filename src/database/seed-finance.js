/**
 * seed-finance.js — เติมลูกหนี้ค่ารักษาพยาบาลรายบุคคลตัวอย่าง
 * รัน: npm run seed:finance   (ต้อง npm run migrate ก่อน · seed:ipd ก่อนได้ยิ่งดี)
 *
 * สร้างครบวงจร: บันทึกส่ง (ar_batches + ar_items) → บันทึกรับ (ar_receipts +
 * ar_allocations) → ปรับปรุงยอด (ar_adjustments) เพื่อให้หน้า fin-ar / fin-receipt
 * มีข้อมูลจริงให้กดดูตั้งแต่เปิดครั้งแรก
 *
 * ⚠️ ห้ามใช้ Math.random() — ตัวเลขต้องเท่าเดิมทุกครั้งที่ seed ไม่งั้นภาพหน้าจอ
 *    ที่ใช้นำเสนอจะเปลี่ยนไปทุกรอบ ใช้ FNV-1a ของ (คีย์งวด + คีย์กองทุน + ลำดับ)
 *    เป็นตัวสุ่มแทน — วิธีเดียวกับ MockFinance ฝั่ง browser
 *
 * Idempotent แบบ "insert เฉพาะที่ยังไม่มี": ดูจาก sent_ref / statement_no ที่ตั้งชื่อ
 * ตายตัวต่อชุด — ชุดไหนมีแล้วข้ามทั้งชุด (ไม่ทับของที่ผู้ใช้แก้ผ่านหน้าจอ)
 * ล้างข้อมูลเดโมทั้งหมด: npm run seed:finance -- --reset
 *
 * วันที่ในไฟล์นี้เป็น ค.ศ. ตามธรรมเนียม DB · period_key เป็น YYMM พ.ศ. ตามที่ สปสช. ออกให้
 */
const mysql = require('mysql2/promise');
const path  = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

/* ── ตัวสุ่มที่ให้ค่าเดิมเสมอ (FNV-1a → [0,1)) ────────── */
function rand(seed) {
    let h = 2166136261;
    const s = String(seed);
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return (h >>> 0) / 4294967296;
}
const pick = (arr, seed) => arr[Math.floor(rand(seed) * arr.length) % arr.length];
const money = (v, step) => Math.round(v / step) * step;

/* ── งวดที่ทำข้อมูลให้ ────────────────────────────────
   sent_date ห่างกันพอให้ตกคนละถังอายุหนี้ — หน้าทะเบียนจะได้มีของครบทั้ง 4 ถัง
   (0–30 / 31–60 / 61–90 / 90+ นับจากวันส่งเบิกเทียบวันนี้) */
const PERIODS = [
    // งวดเก่าสุดตั้งใจให้เหลือค้างไม่กี่เคส — เคสพวกนี้คือของจริงที่โดนตัดจำหน่ายทีหลัง
    { key: '6903', sent: '2026-04-08', paidRatio: 0.94, label: 'มี.ค. 69' },
    { key: '6905', sent: '2026-06-05', paidRatio: 0.95, label: 'พ.ค. 69' },
    { key: '6906', sent: '2026-07-05', paidRatio: 0.82, label: 'มิ.ย. 69' },
    { key: '6907', sent: '2026-08-05', paidRatio: 0.38, label: 'ก.ค. 69' },
];

/* ── กองทุนที่ตั้งเบิกได้เป็นรายเคส ─────────────────────
   fund_key ตรงกับคีย์แถวใน FIN_UC_ROWS / FIN_SSO_ROWS (public/js/mock/mock-finance.js)
   ยอดรายเคสจึงบวกกลับขึ้นไปเป็นแถวเดียวกับที่หน้า exec-finance แสดงได้

   ⚠️ ไม่มี uc_cap / sso_cap ในนี้โดยตั้งใจ — เงินเหมาจ่ายรายหัวไม่มีลูกหนี้รายบุคคล
      (จ่ายตามจำนวนประชากรขึ้นทะเบียน ไม่ได้ผูกกับเคสไหน) */
// code ต้องมี และต้องต่างกันทุกแถว — มันเป็นส่วนหนึ่งของเลขเคส (case_ref)
// ถ้าไม่มี เลขเคสของทุกกองทุนใน payer+งวดเดียวกันจะซ้ำกันหมด (UC-6907-001 โผล่ 4 คน)
// แล้วการค้นหาเลขเคสจะคืนคนละคนมาปนกัน
const FUNDS = [
    { payer: 'UC',  fund_key: 'uc_ipd',          code: 'IP', type: 'IPD', per: 13800, n: 14, step: 100,
      subfund: 'กองทุนผู้ป่วยใน (IP)' },
    { payer: 'UC',  fund_key: 'uc_opd',          code: 'OP', type: 'OPD', per: 920,   n: 22, step: 10,
      subfund: 'กองทุนผู้ป่วยนอก' },
    { payer: 'UC',  fund_key: 'uc_ucep',         code: 'UE', type: 'IPD', per: 28600, n: 3,  step: 100,
      subfund: 'UCEP วิกฤติฉุกเฉิน' },
    { payer: 'UC',  fund_key: 'uc_ckd',          code: 'CK', type: 'OPD', per: 18400, n: 4,  step: 50,
      subfund: 'กองทุนไตวายเรื้อรัง' },
    { payer: 'SSS', fund_key: 'sso_adjrw_main',  code: 'AJ', type: 'IPD', per: 15400, n: 8,  step: 100,
      subfund: 'ประกันสังคม — ชดเชยผู้ป่วยใน AdjRW' },
    { payer: 'SSS', fund_key: 'sso_extra_opd',   code: 'EX', type: 'OPD', per: 1240,  n: 12, step: 10,
      subfund: 'ประกันสังคม — นอกเหนือเหมาจ่าย OPD' },
];

const FUND_LABEL = {
    uc_ipd: 'ยอดผู้ป่วยใน', uc_opd: 'กองทุนผู้ป่วยนอก',
    uc_ucep: 'เบิกชดเชย Ucep วิกฤติฉุกเฉิน', uc_ckd: 'กองทุนไตวายเรื้อรัง',
    sso_adjrw_main: 'เบิกชดเชยผู้ป่วยใน AdjRW. (Main)',
    sso_extra_opd:  'เบิกชดเชยนอกเหนือเหมาจ่าย OPD',
};

/* ── คลังชื่อสำหรับเคสจำลอง ───────────────────────────
   ⚠️ ชื่อสมมติทั้งหมด ไม่ใช่ผู้ป่วยจริง

   ⚠️ ต้องแยกชื่อชาย/หญิง แล้วเลือกคำนำหน้าตามกลุ่ม — ถ้าสุ่มคำนำหน้ากับชื่อ
      แยกกัน จะได้ "นายวิภา" / "นางวิชัย" ซึ่งคนไทยอ่านแล้วสะดุดทันที
      หน้าจอชุดนี้ใช้นำเสนอผู้บริหารโรงพยาบาล ชื่อต้องดูเป็นชื่อจริง */
const NAMES_M = ['สมชาย', 'ธนกร', 'ปรีชา', 'วิชัย', 'บุญมี', 'ไพโรจน์', 'มานพ',
                 'เจริญ', 'สุรชัย', 'ณรงค์', 'สมพงษ์', 'ประยูร', 'ทองใบ'];
const NAMES_F = ['สมหญิง', 'วิภา', 'อนงค์', 'จันทร์เพ็ญ', 'สุนีย์', 'กาญจนา',
                 'ศิริพร', 'อรทัย', 'พเยาว์', 'มาลี', 'รัตนา'];
const LAST  = ['ทองดี', 'แสงทอง', 'จันทร์เพ็ญ', 'ศรีสุข', 'บุญเรือง', 'วงศ์อารีย์', 'พรหมมา',
               'ใจดี', 'สุขสวัสดิ์', 'เพ็ชรรัตน์', 'มั่นคง', 'อารีรักษ์', 'แซ่ลิ้ม', 'ทรัพย์เจริญ',
               'ยิ้มแย้ม', 'ก้อนแก้ว', 'ดวงจันทร์', 'สายทอง', 'ปานทอง', 'ชูเกียรติ'];

function nameOf(seed) {
    const male = rand(seed + 'g') < 0.5;
    const title = male ? 'นาย' : (rand(seed + 'ms') < 0.5 ? 'นาง' : 'นางสาว');
    const first = pick(male ? NAMES_M : NAMES_F, seed + 'f');
    return `${title}${first} ${pick(LAST, seed + 'l')}`;
}

/** วันที่ + n วัน — คืนรูป YYYY-MM-DD */
function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

/* ── เคสหมุดจาก MOCK_NHSO_AR_LINES (mock-nhso.js) ─────
   3 เคสนี้เขียนมือไว้ฝั่ง browser อยู่แล้วเพื่อสาธิต "1 เคส หลายงวด หลายกองทุน
   และมียอดเรียกคืน" — ใส่ลง DB ด้วยตัวเลขชุดเดียวกันเป๊ะ หน้า mock กับหน้าที่ต่อ
   API จริงจะได้เล่าเรื่องเดียวกัน ไม่ใช่คนละตัวเลข */
const ANCHORS = [
    { fund_key: 'uc_opd', case_ref: 'CLM-2569-0031', patient_name: 'นางสมหญิง ทองดี',
      hn: '00147203', billed: 4820, service_date: '2026-07-08', type: 'OPD',
      pays: [{ half: 1, subfund: 'กองทุนผู้ป่วยนอก',              paid: 3200 },
             { half: 2, subfund: 'บริการสร้างเสริมสุขภาพฯ (PP)',   paid: 980 }] },
    { fund_key: 'uc_opd', case_ref: 'CLM-2569-0042', patient_name: 'นายประยูร แสงทอง',
      hn: '00149871', billed: 12400, service_date: '2026-07-19', type: 'OPD',
      note: 'เรียกคืนบางส่วนจากผลตรวจ Audit',
      pays: [{ half: 2, subfund: 'กองทุนผู้ป่วยนอก', paid: 9600, clawback: 1240 }] },
    { fund_key: 'uc_ipd', case_ref: 'CLM-2569-0055', patient_name: 'นางวิภา จันทร์เพ็ญ',
      hn: '00151640', billed: 38600, service_date: '2026-07-24', type: 'IPD',
      note: 'รอ Statement งวดถัดไปสำหรับส่วนที่เหลือ',
      pays: [{ half: 2, subfund: 'กองทุนผู้ป่วยใน (IP)', paid: 31200 }] },
];
const ANCHOR_PERIOD = '6907';

/* ══════════════════════════════════════════════════════
   สร้างรายเคสของ 1 ชุดส่ง
   ══════════════════════════════════════════════════════ */
function buildItems(p, f) {
    const items = [];

    // เคสหมุดของงวดนี้มาก่อน เพื่อให้อยู่ต้นตารางและหาเจอง่ายตอนสาธิต
    if (p.key === ANCHOR_PERIOD) {
        ANCHORS.filter(a => a.fund_key === f.fund_key).forEach(a => {
            items.push({
                case_ref: a.case_ref, hn: a.hn, patient_name: a.patient_name,
                service_date: a.service_date, service_type: a.type,
                billed_amt: a.billed, note: a.note || null, anchor: a,
            });
        });
    }

    for (let i = 0; i < f.n; i++) {
        const seed = `${p.key}/${f.fund_key}/${i}`;
        const amt  = money(f.per * (0.55 + rand(seed + 'a') * 1.05), f.step);
        const day  = 1 + Math.floor(rand(seed + 'd') * 26);

        items.push({
            // code ของกองทุนต้องอยู่ในเลขเคส ไม่งั้นเลขซ้ำข้ามกองทุน (ดูคอมเมนต์ที่ FUNDS)
            case_ref: `${f.payer}-${p.key}-${f.code}${String(i + 1).padStart(3, '0')}`,
            hn: String(100000 + Math.floor(rand(seed + 'h') * 60000)).padStart(8, '0'),
            patient_name: nameOf(seed),
            // วันรับบริการอยู่ในเดือนของงวด — ย้อนจากวันส่งเบิกไป 1 เดือน
            service_date: addDays(p.sent, -35 + day),
            service_type: f.type,
            billed_amt: Math.max(f.step, amt),
            note: null,
        });
    }
    return items;
}

/**
 * ตัดสินว่าเคสนี้ได้เงินเท่าไร — คืน { paid, clawback, half } หรือ null ถ้ายังไม่ได้เลย
 *
 * เคสหมุดใช้ตัวเลขที่เขียนไว้ตายตัว ไม่ผ่านตัวสุ่ม
 */
function decidePayment(p, f, item, idx) {
    if (item.anchor) return null;                    // จัดการแยกในลูปหลัก (มีได้หลายบรรทัด)

    const seed = `${p.key}/${f.fund_key}/${idx}/pay`;
    const r = rand(seed);
    const half = rand(seed + 'h') < 0.5 ? 1 : 2;     // Statement งวด 1–15 หรือ 16–31

    if (r < p.paidRatio) {
        // จ่ายเต็ม — บางเคสโดนเรียกคืนบางส่วนจากผลตรวจ audit ภายหลัง
        const claw = rand(seed + 'c') < 0.05
            ? money(item.billed_amt * (0.08 + rand(seed + 'cv') * 0.12), f.step) : 0;
        return { paid: item.billed_amt, clawback: claw, half };
    }
    // ที่เหลือแบ่งเป็น "จ่ายบางส่วน" กับ "ยังไม่ได้เลย" ตามสัดส่วนของช่วงที่ยังไม่จ่าย
    // ⚠️ ห้ามใช้ค่าคงที่ (เช่น +0.16) — งวดที่ paidRatio สูงจะไม่เหลือเคสค้างจริงเลย
    //    แล้วเคสสำหรับสาธิต "ตัดจำหน่ายหนี้" จะหายไปทั้งหมด
    if (r < p.paidRatio + (1 - p.paidRatio) * 0.45) {
        // จ่ายบางส่วน — ที่เหลือค้างรอ Statement งวดถัดไป
        return { paid: money(item.billed_amt * (0.55 + rand(seed + 'p') * 0.30), f.step), clawback: 0, half };
    }
    return null;                                      // ยังไม่ได้เงิน
}

/* ══════════════════════════════════════════════════════ */

async function reset(conn) {
    // ลบตามลำดับลูก→แม่ เพราะมี FK · ลบเฉพาะแถวที่ seed สร้าง (ดูจาก sent_ref/statement_no)
    await conn.query(
        `DELETE a FROM ar_adjustments a JOIN ar_items i ON a.ar_item_id = i.ar_item_id
         JOIN ar_batches b ON i.batch_id = b.batch_id WHERE b.sent_ref LIKE 'DEMO-%'`);
    await conn.query(
        `DELETE al FROM ar_allocations al JOIN ar_receipts r ON al.receipt_id = r.receipt_id
         WHERE r.statement_no LIKE 'DEMO-%'`);
    await conn.query(`DELETE FROM ar_receipts WHERE statement_no LIKE 'DEMO-%'`);
    await conn.query(
        `DELETE i FROM ar_items i JOIN ar_batches b ON i.batch_id = b.batch_id
         WHERE b.sent_ref LIKE 'DEMO-%'`);
    await conn.query(`DELETE FROM ar_batches WHERE sent_ref LIKE 'DEMO-%'`);
    console.log('   ล้างข้อมูลเดโมเดิมแล้ว');
}

async function seed() {
    const conn = await mysql.createConnection({
        host:     process.env.DB_HOST || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 3306,
        user:     process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'medicore_rcm',
    });

    let batches = 0, items = 0, receipts = 0, allocs = 0, adjusts = 0, skipped = 0;

    try {
        if (process.argv.includes('--reset')) await reset(conn);

        /* ── admission จริงในระบบ ใช้ผูก ar_items.admission_id ─────
           ทำให้หน้าทะเบียนลูกหนี้กดทะลุไปหน้าผู้ป่วยในได้จริง ไม่ใช่เลขลอย ๆ */
        const [adms] = await conn.query(
            `SELECT a.admission_id, a.an, a.hn, a.patient_name, a.payer,
                    DATE_FORMAT(COALESCE(a.discharge_at, a.admit_at), '%Y-%m-%d') AS svc_date,
                    COALESCE((SELECT SUM(c.amount) FROM ipd_charges c
                              WHERE c.admission_id = a.admission_id), 0) AS charge_total
             FROM ipd_admissions a
             WHERE a.is_deleted = 0 AND a.payer IN ('UC','SSS')`);
        const admByPayer = { UC: [], SSS: [] };
        adms.forEach(a => { if (Number(a.charge_total) > 0) admByPayer[a.payer].push(a); });

        let seqNo = 1;
        const nextNo = (prefix) => prefix + String(seqNo++).padStart(4, '0');

        for (const p of PERIODS) {
            /* ยอดที่ตัดได้ของงวดนี้ รวบไว้ออกใบรับทีเดียวต่อ (payer × ครึ่งเดือน) */
            const pending = {};   // `${payer}/${half}` → [{ ar_item_id, subfund, paid, clawback }]

            for (const f of FUNDS) {
                const sent_ref = `DEMO-${p.key}-${f.fund_key}`;

                const [[exists]] = await conn.query(
                    'SELECT batch_id FROM ar_batches WHERE sent_ref = ?', [sent_ref]);
                if (exists) { skipped++; continue; }

                const batchItems = buildItems(p, f);

                /* งวดล่าสุด: แนบ admission จริงเข้าไปในกองทุนผู้ป่วยในของแต่ละสิทธิ */
                const linkTo = (p.key === ANCHOR_PERIOD && (f.fund_key === 'uc_ipd' || f.fund_key === 'sso_adjrw_main'))
                    ? admByPayer[f.payer] : [];
                linkTo.forEach(a => batchItems.push({
                    case_ref: `AN-${a.an}`, hn: a.hn, patient_name: a.patient_name,
                    service_date: a.svc_date, service_type: 'IPD',
                    billed_amt: Number(a.charge_total), admission_id: a.admission_id,
                    note: 'ยอดพึงรับจากค่ารักษาที่บันทึกไว้ในระบบผู้ป่วยใน',
                }));

                await conn.beginTransaction();
                try {
                    const batch_no = nextNo('SB');
                    const [br] = await conn.query(
                        `INSERT INTO ar_batches
                             (batch_no, period_key, payer, fund_key, sent_date, sent_ref, channel, note,
                              status, confirmed_at, rev)
                         VALUES (?, ?, ?, ?, ?, ?, 'e-Claim', ?, 'CONFIRMED', ?, 1)`,
                        [batch_no, p.key, f.payer, f.fund_key, p.sent, sent_ref,
                         `${FUND_LABEL[f.fund_key]} งวด ${p.label} (ข้อมูลเดโม)`, p.sent]);
                    const batchId = br.insertId;
                    batches++;

                    for (let i = 0; i < batchItems.length; i++) {
                        const it = batchItems[i];
                        const [ir] = await conn.query(
                            `INSERT INTO ar_items
                                 (batch_id, seq, case_ref, hn, patient_name, service_date,
                                  service_type, billed_amt, admission_id, note)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [batchId, i, it.case_ref, it.hn, it.patient_name, it.service_date,
                             it.service_type, it.billed_amt, it.admission_id || null, it.note || null]);
                        items++;

                        if (it.anchor) {
                            it.anchor.pays.forEach(pay => {
                                const k = `${f.payer}/${pay.half}`;
                                (pending[k] ||= []).push({
                                    ar_item_id: ir.insertId, subfund: pay.subfund,
                                    paid: pay.paid, clawback: pay.clawback || 0,
                                });
                            });
                            continue;
                        }

                        const pay = decidePayment(p, f, it, i);
                        if (pay) {
                            const k = `${f.payer}/${pay.half}`;
                            (pending[k] ||= []).push({
                                ar_item_id: ir.insertId, subfund: f.subfund,
                                paid: pay.paid, clawback: pay.clawback,
                            });
                        }
                    }

                    await conn.query(
                        `INSERT INTO audit_log (entity, entity_id, action, actor_id, actor_role, note)
                         VALUES ('ar_batch', ?, 'CONFIRM', NULL, NULL, 'seed-finance')`, [batchId]);

                    await conn.commit();
                } catch (e) { await conn.rollback(); throw e; }
            }

            /* ── ออกใบบันทึกรับของงวดนี้ ────────────────────
               1 ใบ = 1 รอบจ่ายของ 1 สิทธิ (ครึ่งเดือน) ตามที่ สปสช. จ่ายจริง
               gross ต้องเท่ากับผลรวมที่ตัดลงเคสเป๊ะ ไม่งั้น /confirm จะปฏิเสธ
               (ALLOCATION_MISMATCH) — ที่นี่คำนวณจากบรรทัดตัดยอด ไม่ได้ตั้งเอง */
            for (const [k, lines] of Object.entries(pending)) {
                if (!lines.length) continue;
                const [payer, half] = k.split('/');
                const statement_no = `DEMO-STM-${p.key}-${payer}-${half}`;

                const [[dup]] = await conn.query(
                    'SELECT receipt_id FROM ar_receipts WHERE statement_no = ?', [statement_no]);
                if (dup) continue;

                const gross = lines.reduce((a, l) => a + l.paid - l.clawback, 0);
                // ค่าธรรมเนียมโอน — ทำให้ "ยอดตาม Statement" กับ "เงินเข้าบัญชี" ต่างกันจริง
                const fee = Math.round(gross * 0.0002 * 100) / 100;
                const received_date = addDays(p.sent, half === '1' ? 12 : 26);

                await conn.beginTransaction();
                try {
                    const receipt_no = nextNo('RC');
                    const [rr] = await conn.query(
                        `INSERT INTO ar_receipts
                             (receipt_no, received_date, period_key, payer, statement_no, channel,
                              bank_ref, gross_amt, fee_amt, net_amt, note, status, confirmed_at, rev)
                         VALUES (?, ?, ?, ?, ?, 'โอนเข้าบัญชี', ?, ?, ?, ?, ?, 'CONFIRMED', ?, 1)`,
                        [receipt_no, received_date, p.key, payer, statement_no,
                         `TR${p.key}${payer}${half}`, gross, fee, gross - fee,
                         `Statement งวด ${p.label} (${half === '1' ? '1–15' : '16–31'}) — ข้อมูลเดโม`,
                         received_date]);
                    receipts++;

                    for (let i = 0; i < lines.length; i++) {
                        const l = lines[i];
                        await conn.query(
                            `INSERT INTO ar_allocations
                                 (receipt_id, ar_item_id, seq, subfund, paid_amt, clawback_amt)
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [rr.insertId, l.ar_item_id, i, l.subfund, l.paid, l.clawback]);
                        allocs++;
                    }

                    await conn.query(
                        `INSERT INTO audit_log (entity, entity_id, action, actor_id, actor_role, note)
                         VALUES ('ar_receipt', ?, 'CONFIRM', NULL, NULL, 'seed-finance')`, [rr.insertId]);

                    await conn.commit();
                } catch (e) { await conn.rollback(); throw e; }
            }
        }

        /* ── ปรับปรุงยอด: ตัดจำหน่ายหนี้เก่าที่ตามไม่ได้แล้ว ────
           เอาเฉพาะงวดเก่าสุดที่ยังค้าง — เป็นภาพจริงของงานติดตามหนี้
           (ไม่ตัดงวดใหม่ เพราะยังอยู่ในกรอบเวลาที่ตามได้) */
        const [stale] = await conn.query(
            `SELECT i.ar_item_id, i.billed_amt, i.case_ref
             FROM ar_items i
             JOIN ar_batches b ON i.batch_id = b.batch_id
             LEFT JOIN ar_allocations a ON a.ar_item_id = i.ar_item_id
             WHERE b.sent_ref LIKE 'DEMO-6903-%' AND a.alloc_id IS NULL
               AND NOT EXISTS (SELECT 1 FROM ar_adjustments j
                               WHERE j.ar_item_id = i.ar_item_id AND j.is_deleted = 0)
             LIMIT 3`);
        for (const s of stale) {
            await conn.query(
                `INSERT INTO ar_adjustments (ar_item_id, adjust_date, kind, amount, reason)
                 VALUES (?, '2026-07-31', 'WRITE_OFF', ?, ?)`,
                [s.ar_item_id, s.billed_amt,
                 'พ้นกรอบเวลายื่นอุทธรณ์ 1 ปี — ตัดจำหน่ายตามมติที่ประชุมการเงิน (ข้อมูลเดโม)']);
            await conn.query(
                `INSERT INTO audit_log (entity, entity_id, action, actor_id, actor_role, note)
                 VALUES ('ar_item', ?, 'ADJUST', NULL, NULL, 'seed-finance')`, [s.ar_item_id]);
            adjusts++;
        }

        console.log(`✅ seed-finance: ชุดส่ง ${batches} · ลูกหนี้ ${items} ราย · ใบรับ ${receipts} `
                  + `· ตัดยอด ${allocs} บรรทัด · ปรับปรุง ${adjusts} รายการ`
                  + (skipped ? ` · มีอยู่แล้วข้าม ${skipped} ชุด` : ''));

        const [[sum]] = await conn.query(
            `SELECT COUNT(*) AS n,
                    COALESCE(SUM(i.billed_amt),0) AS billed,
                    COALESCE(SUM(al.net),0) AS received
             FROM ar_items i
             JOIN ar_batches b ON i.batch_id = b.batch_id AND b.status = 'CONFIRMED' AND b.is_deleted = 0
             LEFT JOIN (SELECT ar_item_id, SUM(paid_amt - clawback_amt) AS net
                        FROM ar_allocations GROUP BY ar_item_id) al ON al.ar_item_id = i.ar_item_id`);
        const fmt = v => Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2 });
        console.log(`   ในทะเบียนตอนนี้: ${sum.n} ราย · พึงรับ ${fmt(sum.billed)} · `
                  + `รับแล้ว ${fmt(sum.received)} · คงค้าง ${fmt(sum.billed - sum.received)} บาท`);
    } catch (err) {
        console.error('❌ seed-finance ล้มเหลว:', err.message);
        process.exit(1);
    } finally {
        await conn.end();
    }
}

seed();
