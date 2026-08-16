/**
 * MediClear — MOCK AR (ลูกหนี้ค่ารักษาพยาบาลรายบุคคล)
 * ------------------------------------------------------------
 * ชั้นสำรองของหน้า fin-ar / fin-receipt เมื่อไม่มีเซิร์ฟเวอร์ (โหมดต้นแบบ)
 * คืนข้อมูล "รูปทรงเดียวกับ /api/finance" เป๊ะ — หน้าจอจึงเขียนครั้งเดียวใช้ได้ทั้งสองโหมด
 * ตัวสลับโหมดอยู่ที่ mock-findata.js ไม่ใช่ที่นี่
 *
 * ต้องโหลดหลัง mock-core.js · mock-nhso.js · mock-finance.js
 *
 * ⚠️ ตัวเลขทุกตัวเป็นข้อมูลสมมติ — หน้าที่ใช้ไฟล์นี้ต้องติดป้าย MOCKUP เสมอ
 *
 * ทำไมต้อง generate ไม่ใช่พิมพ์ทิ้งไว้ (เหตุผลเดียวกับ mock-finance.js)
 *   ลูกหนี้หลักร้อยราย × 8 ช่องตัวเลขที่ต้องบวกกันลงตัวทั้งตาราง —
 *   พิมพ์มือเมื่อไรก็เพี้ยนเมื่อนั้น
 *
 * ⚠️ ห้ามใช้ Math.random() — ใช้ FNV-1a ของคีย์แถวแทน ตัวเลขจึงเท่าเดิมทุกครั้ง
 *    ที่ re-render ไม่งั้นการ์ด KPI กับตารางบนหน้าเดียวกันจะไม่ตรงกัน
 *
 * ⚠️ ห้ามเก็บยอดคงค้าง/ยอดรับสะสมลงในแถวที่ generate — ต้องคิดจาก payments[]
 *    ทุกครั้ง (นิยามเดียวกับ finance.sql) ไม่งั้นตัวเลขสองที่จะเพี้ยนจากกัน
 */

/* ══════════════════════════════════════════════════════════
   1. กองทุนที่ตั้งเบิกได้เป็นรายเคส

   ต้องตรงกับ FUNDS ใน src/database/seed-finance.js — โหมด mock กับโหมดต่อ DB
   จะได้เล่าเรื่องเดียวกัน · fund_key ตรงกับคีย์แถวใน FIN_UC_ROWS/FIN_SSO_ROWS
   ยอดรายเคสจึงบวกกลับขึ้นไปเป็นแถวเดียวกับที่หน้า exec-finance แสดง

   ⚠️ ไม่มี uc_cap / sso_cap โดยตั้งใจ — เงินเหมาจ่ายรายหัวจ่ายตามจำนวนประชากร
      ขึ้นทะเบียน ไม่ได้ผูกกับเคสไหน จึงไม่มี "ลูกหนี้รายบุคคล" ให้ตัดยอด
   ══════════════════════════════════════════════════════════ */
const AR_FUNDS = [
    { payer: 'UC',  fund_key: 'uc_ipd',         code: 'IP', type: 'IPD', per: 13800, n: 14, step: 100,
      subfund: 'กองทุนผู้ป่วยใน (IP)' },
    { payer: 'UC',  fund_key: 'uc_opd',         code: 'OP', type: 'OPD', per: 920,   n: 22, step: 10,
      subfund: 'กองทุนผู้ป่วยนอก' },
    { payer: 'UC',  fund_key: 'uc_ucep',        code: 'UE', type: 'IPD', per: 28600, n: 3,  step: 100,
      subfund: 'UCEP วิกฤติฉุกเฉิน' },
    { payer: 'UC',  fund_key: 'uc_ckd',         code: 'CK', type: 'OPD', per: 18400, n: 4,  step: 50,
      subfund: 'กองทุนไตวายเรื้อรัง' },
    { payer: 'SSS', fund_key: 'sso_adjrw_main', code: 'AJ', type: 'IPD', per: 15400, n: 8,  step: 100,
      subfund: 'ประกันสังคม — ชดเชยผู้ป่วยใน AdjRW' },
    { payer: 'SSS', fund_key: 'sso_extra_opd',  code: 'EX', type: 'OPD', per: 1240,  n: 12, step: 10,
      subfund: 'ประกันสังคม — นอกเหนือเหมาจ่าย OPD' },
];

/** ป้ายชื่อกองทุนที่ผู้ใช้เห็น — ยกจากแถวบนแบบฟอร์มสรุปยอดเงินโอน
 *
 *  ⚠️ กลุ่ม ofc_/lgo_/ems_/pvt_ ไม่มีอยู่บนแบบฟอร์มสรุปยอดเงินโอน (ฟอร์มนั้นมีแค่
 *     บล็อกประกันสังคมกับบล็อกหลักประกันสุขภาพ) — เป็นคีย์ที่ตั้งขึ้นเพื่อให้ตั้งหนี้
 *     ของสิทธิอื่นได้ ยอดกลุ่มนี้จึงบวกกลับขึ้นหน้า exec-finance ไม่ได้ ต้องดูที่ทะเบียนนี้ */
const AR_FUND_LABEL = {
    uc_ipd: 'ยอดผู้ป่วยใน',
    uc_opd: 'กองทุนผู้ป่วยนอก',
    uc_ucep: 'เบิกชดเชย Ucep วิกฤติฉุกเฉิน',
    uc_ckd: 'กองทุนไตวายเรื้อรัง',
    uc_dmht: 'บริการควบคุมป้องกันและรักษาโรค DM/HT',
    uc_hiv: 'กองทุนเอดส์',
    uc_pp: 'กองทุนสร้างเสริมสุขภาพและป้องกันโรค',
    sso_adjrw_main: 'เบิกชดเชยผู้ป่วยใน AdjRW. (Main)',
    sso_adjrw_supra: 'เบิกชดเชยผู้ป่วยใน AdjRW. (Supra)',
    sso_extra_ipd: 'เบิกชดเชยนอกเหนือเหมาจ่าย IPD',
    sso_extra_opd: 'เบิกชดเชยนอกเหนือเหมาจ่าย OPD',
    ofc_ipd: 'กรมบัญชีกลาง — ผู้ป่วยใน',
    ofc_opd: 'กรมบัญชีกลาง — ผู้ป่วยนอก',
    lgo_ipd: 'อปท. — ผู้ป่วยใน',
    lgo_opd: 'อปท. — ผู้ป่วยนอก',
    ems_ucep: 'สพฉ. — UCEP วิกฤติฉุกเฉิน',
    pvt_self: 'ชำระเงินเอง / คู่สัญญา',
};

const AR_PAYER_LABEL = {
    UC:  'บัตรทอง (สปสช.)',
    SSS: 'ประกันสังคม',
    OFC: 'กรมบัญชีกลาง',
    LGO: 'อปท.',
    EMS: 'UCEP / สพฉ.',
    PVT: 'ชำระเงินเอง',
};

/** กองทุนที่เลือกได้ต่อสิทธิ — หน้าบันทึกส่งใช้จำกัดตัวเลือกให้ตรงสิทธิที่เลือก
 *  ห้ามผูก fund ของสิทธิหนึ่งเข้ากับสิทธิอื่น ยอดจะไปโผล่ผิดแถวบนหน้าสรุป */
const AR_FUND_OPTIONS = {
    UC:  ['uc_ipd', 'uc_opd', 'uc_ucep', 'uc_ckd', 'uc_dmht', 'uc_hiv', 'uc_pp'],
    SSS: ['sso_adjrw_main', 'sso_adjrw_supra', 'sso_extra_ipd', 'sso_extra_opd'],
    OFC: ['ofc_ipd', 'ofc_opd'],
    LGO: ['lgo_ipd', 'lgo_opd'],
    EMS: ['ems_ucep'],
    PVT: ['pvt_self'],
};

/** สถานะลูกหนี้ — คำนวณจากยอด ไม่ใช่ฟิลด์ที่เก็บไว้ (ตรงกับ AR_STATUS ใน routes/finance.js) */
const AR_STATUS_META = {
    OPEN:        { label: 'ยังไม่ได้รับ',   badge: 'kbadge-off' },
    PARTIAL:     { label: 'รับบางส่วน',     badge: 'kbadge-pending' },
    CLEARED:     { label: 'ตัดยอดครบแล้ว',  badge: 'kbadge-done' },
    WRITTEN_OFF: { label: 'ตัดจำหน่าย',     badge: 'kbadge-draft' },
};

const AR_AGING_META = [
    { key: '0-30',  label: '0–30 วัน',  tone: 'ok' },
    { key: '31-60', label: '31–60 วัน', tone: 'warn' },
    { key: '61-90', label: '61–90 วัน', tone: 'warn' },
    { key: '90+',   label: '90+ วัน',   tone: 'bad' },
];

/* ══════════════════════════════════════════════════════════
   2. งวดที่ทำข้อมูลให้ — ตรงกับ PERIODS ใน seed-finance.js

   วันที่ในไฟล์นี้เป็น พ.ศ. (ชั้น mock ใช้ พ.ศ. ทั้งหมด ตามธรรมเนียมโปรเจค)
   sent ห่างกันพอให้ตกคนละถังอายุหนี้ ทะเบียนจะได้มีของครบทั้ง 4 ถัง
   ══════════════════════════════════════════════════════════ */
const AR_PERIODS = [
    { key: '6903', sent: '2569-04-08', paidRatio: 0.94, label: 'มี.ค. 69' },
    { key: '6905', sent: '2569-06-05', paidRatio: 0.95, label: 'พ.ค. 69' },
    { key: '6906', sent: '2569-07-05', paidRatio: 0.82, label: 'มิ.ย. 69' },
    { key: '6907', sent: '2569-08-05', paidRatio: 0.38, label: 'ก.ค. 69' },
];

/* คลังชื่อสำหรับเคสจำลอง — ⚠️ ชื่อสมมติ ไม่ใช่ผู้ป่วยจริง
   ⚠️ แยกชื่อชาย/หญิงแล้วเลือกคำนำหน้าตามกลุ่ม — สุ่มแยกกันจะได้ "นายวิภา"
      ที่คนไทยอ่านแล้วสะดุด (ต้องตรงกับ seed-finance.js) */
const AR_NAMES_M = ['สมชาย', 'ธนกร', 'ปรีชา', 'วิชัย', 'บุญมี', 'ไพโรจน์', 'มานพ',
                    'เจริญ', 'สุรชัย', 'ณรงค์', 'สมพงษ์', 'ประยูร', 'ทองใบ'];
const AR_NAMES_F = ['สมหญิง', 'วิภา', 'อนงค์', 'จันทร์เพ็ญ', 'สุนีย์', 'กาญจนา',
                    'ศิริพร', 'อรทัย', 'พเยาว์', 'มาลี', 'รัตนา'];
const AR_LAST = ['ทองดี', 'แสงทอง', 'จันทร์เพ็ญ', 'ศรีสุข', 'บุญเรือง', 'วงศ์อารีย์', 'พรหมมา',
                 'ใจดี', 'สุขสวัสดิ์', 'เพ็ชรรัตน์', 'มั่นคง', 'อารีรักษ์', 'แซ่ลิ้ม', 'ทรัพย์เจริญ',
                 'ยิ้มแย้ม', 'ก้อนแก้ว', 'ดวงจันทร์', 'สายทอง', 'ปานทอง', 'ชูเกียรติ'];

/**
 * เคสหมุดจาก MOCK_NHSO_AR_LINES (mock-nhso.js)
 * ยกมาทั้งตัวเลขเพื่อให้หน้าใหม่กับข้อมูลที่เขียนไว้เดิมพูดตรงกัน —
 * สาธิต "1 เคส หลายงวด หลายกองทุน และมียอดเรียกคืน" ที่ NHSO_CLEAR_AR ระบุไว้
 */
const AR_ANCHORS = [
    { fund_key: 'uc_opd', case_ref: 'CLM-2569-0031', patient_name: 'นางสมหญิง ทองดี',
      hn: '00147203', billed: 4820, service_date: '2569-07-08', type: 'OPD',
      pays: [{ half: 1, subfund: 'กองทุนผู้ป่วยนอก',            paid: 3200 },
             { half: 2, subfund: 'บริการสร้างเสริมสุขภาพฯ (PP)', paid: 980 }] },
    { fund_key: 'uc_opd', case_ref: 'CLM-2569-0042', patient_name: 'นายประยูร แสงทอง',
      hn: '00149871', billed: 12400, service_date: '2569-07-19', type: 'OPD',
      note: 'เรียกคืนบางส่วนจากผลตรวจ Audit',
      pays: [{ half: 2, subfund: 'กองทุนผู้ป่วยนอก', paid: 9600, clawback: 1240 }] },
    { fund_key: 'uc_ipd', case_ref: 'CLM-2569-0055', patient_name: 'นางวิภา จันทร์เพ็ญ',
      hn: '00151640', billed: 38600, service_date: '2569-07-24', type: 'IPD',
      note: 'รอ Statement งวดถัดไปสำหรับส่วนที่เหลือ',
      pays: [{ half: 2, subfund: 'กองทุนผู้ป่วยใน (IP)', paid: 31200 }] },
];
const AR_ANCHOR_PERIOD = '6907';


/* ══════════════════════════════════════════════════════════
   3. MockAR
   ══════════════════════════════════════════════════════════ */
const MockAR = {

    _cache: null,

    /* ── ตัวสุ่มที่ให้ค่าเดิมเสมอ ────────────────────── */

    /** FNV-1a → [0,1) */
    _rand(seed) {
        let h = 2166136261;
        const s = String(seed);
        for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
        return (h >>> 0) / 4294967296;
    },

    _pick(arr, seed) { return arr[Math.floor(this._rand(seed) * arr.length) % arr.length]; },

    _money(v, step) { return Math.round(v / step) * step; },

    _name(seed) {
        const male = this._rand(seed + 'g') < 0.5;
        const title = male ? 'นาย' : (this._rand(seed + 'ms') < 0.5 ? 'นาง' : 'นางสาว');
        const first = this._pick(male ? AR_NAMES_M : AR_NAMES_F, seed + 'f');
        return `${title}${first} ${this._pick(AR_LAST, seed + 'l')}`;
    },

    /** บวกวันบนสตริง พ.ศ. — แปลงเป็น ค.ศ. ชั่วคราวเพราะ Date รับได้แค่ ค.ศ. */
    _addDays(be, n) {
        const ce = (parseInt(be.slice(0, 4), 10) - 543) + be.slice(4);
        const d = new Date(ce + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + n);
        const iso = d.toISOString().slice(0, 10);
        return (parseInt(iso.slice(0, 4), 10) + 543) + iso.slice(4);
    },

    /** จำนวนวันจากวันที่ พ.ศ. ถึง MockDB.TODAY */
    _ageOf(be) {
        const ce = (parseInt(be.slice(0, 4), 10) - 543) + be.slice(4);
        const d = new Date(ce + 'T00:00:00Z');
        return Math.max(0, Math.round((MockDB.TODAY - d) / 864e5));
    },

    /* ── สร้างทะเบียนทั้งชุด (ครั้งเดียวแล้วแคช) ────── */

    /**
     * ตัดสินว่าเคสนี้ได้เงินเท่าไร — คืน { paid, clawback, half } หรือ null
     *
     * ⚠️ ช่วง "จ่ายบางส่วน" ต้องคิดเป็นสัดส่วนของส่วนที่ยังไม่จ่าย ห้ามใช้ค่าคงที่
     *    ไม่งั้นงวดที่ paidRatio สูงจะไม่เหลือเคสค้างจริงเลย (บั๊กที่เคยเจอตอน seed)
     */
    _decidePay(p, f, item, idx) {
        const seed = `${p.key}/${f.fund_key}/${idx}/pay`;
        const r = this._rand(seed);
        const half = this._rand(seed + 'h') < 0.5 ? 1 : 2;

        if (r < p.paidRatio) {
            const claw = this._rand(seed + 'c') < 0.05
                ? this._money(item.billed_amt * (0.08 + this._rand(seed + 'cv') * 0.12), f.step) : 0;
            return { paid: item.billed_amt, clawback: claw, half };
        }
        if (r < p.paidRatio + (1 - p.paidRatio) * 0.45) {
            return { paid: this._money(item.billed_amt * (0.55 + this._rand(seed + 'p') * 0.30), f.step),
                     clawback: 0, half };
        }
        return null;
    },

    _build() {
        if (this._cache) return this._cache;

        const items = [];
        const receipts = [];
        let itemId = 1, receiptId = 1, batchSeq = 1, receiptSeq = 1;

        AR_PERIODS.forEach(p => {
            const pending = {};                     // `${payer}/${half}` → บรรทัดตัดยอด

            AR_FUNDS.forEach(f => {
                const batch_no = 'SB' + String(batchSeq++).padStart(4, '0');
                const rows = [];

                if (p.key === AR_ANCHOR_PERIOD) {
                    AR_ANCHORS.filter(a => a.fund_key === f.fund_key).forEach(a => rows.push({
                        case_ref: a.case_ref, hn: a.hn, patient_name: a.patient_name,
                        service_date: a.service_date, service_type: a.type,
                        billed_amt: a.billed, note: a.note || null, anchor: a,
                    }));
                }

                for (let i = 0; i < f.n; i++) {
                    const seed = `${p.key}/${f.fund_key}/${i}`;
                    const amt = this._money(f.per * (0.55 + this._rand(seed + 'a') * 1.05), f.step);
                    const day = 1 + Math.floor(this._rand(seed + 'd') * 26);
                    rows.push({
                        // code ของกองทุนต้องอยู่ในเลขเคส ไม่งั้นเลขซ้ำข้ามกองทุน
                        case_ref: `${f.payer}-${p.key}-${f.code}${String(i + 1).padStart(3, '0')}`,
                        hn: String(100000 + Math.floor(this._rand(seed + 'h') * 60000)).padStart(8, '0'),
                        patient_name: this._name(seed),
                        service_date: this._addDays(p.sent, -35 + day),
                        service_type: f.type,
                        billed_amt: Math.max(f.step, amt),
                        note: null,
                    });
                }

                rows.forEach((it, i) => {
                    const rec = {
                        ar_item_id: itemId++,
                        case_ref: it.case_ref, hn: it.hn, an: null,
                        patient_name: it.patient_name,
                        service_date: it.service_date, service_type: it.service_type,
                        billed_amt: it.billed_amt,
                        admission_id: null, note: it.note,
                        batch_no, period_key: p.key, payer: f.payer, fund_key: f.fund_key,
                        sent_date: p.sent, sent_ref: `DEMO-${p.key}-${f.fund_key}`,
                        payments: [],        // เติมตอนออกใบรับ — ยอดทุกตัวคิดจากตรงนี้
                        adjustments: [],
                    };
                    items.push(rec);

                    const push = (half, subfund, paid, clawback) => {
                        (pending[`${f.payer}/${half}`] ||= []).push({ rec, subfund, paid, clawback });
                    };

                    if (it.anchor) {
                        it.anchor.pays.forEach(x => push(x.half, x.subfund, x.paid, x.clawback || 0));
                        return;
                    }
                    const pay = this._decidePay(p, f, it, i);
                    if (pay) push(pay.half, f.subfund, pay.paid, pay.clawback);
                });
            });

            /* ใบบันทึกรับของงวดนี้ — 1 ใบ = 1 รอบจ่ายของ 1 สิทธิ (ครึ่งเดือน) */
            Object.entries(pending).forEach(([k, lines]) => {
                if (!lines.length) return;
                const [payer, half] = k.split('/');
                const gross = lines.reduce((a, l) => a + l.paid - l.clawback, 0);
                const fee = Math.round(gross * 0.0002 * 100) / 100;
                const received_date = this._addDays(p.sent, half === '1' ? 12 : 26);
                const receipt_no = 'RC' + String(receiptSeq++).padStart(4, '0');
                const id = receiptId++;

                receipts.push({
                    receipt_id: id, receipt_no, received_date, period_key: p.key, payer,
                    statement_no: `DEMO-STM-${p.key}-${payer}-${half}`,
                    channel: 'โอนเข้าบัญชี', bank_ref: `TR${p.key}${payer}${half}`,
                    gross_amt: gross, fee_amt: fee, net_amt: gross - fee,
                    note: `Statement งวด ${p.label} (${half === '1' ? '1–15' : '16–31'}) — ข้อมูลเดโม`,
                    status: 'CONFIRMED',
                    alloc_count: lines.length, allocated_amt: gross,
                });

                lines.forEach(l => l.rec.payments.push({
                    receipt_id: id, receipt_no, received_date, period_key: p.key,
                    statement_no: `DEMO-STM-${p.key}-${payer}-${half}`,
                    subfund: l.subfund, paid_amt: l.paid, clawback_amt: l.clawback,
                    receipt_status: 'CONFIRMED',
                }));
            });
        });

        /* ตัดจำหน่ายหนี้เก่าที่ตามไม่ได้แล้ว — เฉพาะงวดเก่าสุดที่ยังไม่ได้เงินเลย */
        items.filter(i => i.period_key === '6903' && !i.payments.length).slice(0, 3)
            .forEach(i => i.adjustments.push({
                adjust_id: i.ar_item_id, kind: 'WRITE_OFF', amount: i.billed_amt,
                adjust_date: '2569-07-31',
                reason: 'พ้นกรอบเวลายื่นอุทธรณ์ 1 ปี — ตัดจำหน่ายตามมติที่ประชุมการเงิน (ข้อมูลเดโม)',
            }));

        this._cache = { items: items.map(i => this._derive(i)), receipts };
        return this._cache;
    },

    /**
     * เติมยอดที่คำนวณได้ลงในแถว — นิยามเดียวกับ finance.sql เป๊ะ
     *   billed_adj   = billed + Σ INCREASE − Σ REDUCE
     *   net_received = Σ paid − Σ clawback
     *   outstanding  = billed_adj − net_received − Σ WRITE_OFF
     */
    _derive(i) {
        const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);
        const kind = k => sum(i.adjustments.filter(a => a.kind === k), a => a.amount);

        const paid      = sum(i.payments, p => p.paid_amt);
        const clawback  = sum(i.payments, p => p.clawback_amt);
        const increase  = kind('INCREASE');
        const reduce    = kind('REDUCE');
        const writeoff  = kind('WRITE_OFF');

        const billed_adj   = i.billed_amt + increase - reduce;
        const net_received = paid - clawback;
        const outstanding  = billed_adj - net_received - writeoff;
        const age_days     = this._ageOf(i.sent_date);

        const ar_status = writeoff > 0 && outstanding <= 0 ? 'WRITTEN_OFF'
                        : outstanding <= 0                 ? 'CLEARED'
                        : paid > 0                         ? 'PARTIAL' : 'OPEN';

        const aging = outstanding <= 0 ? null
                    : age_days <= 30 ? '0-30' : age_days <= 60 ? '31-60'
                    : age_days <= 90 ? '61-90' : '90+';

        return { ...i, paid_amt: paid, clawback_amt: clawback,
                 increase_amt: increase, reduce_amt: reduce, writeoff_amt: writeoff,
                 billed_adj, net_received, outstanding, age_days, ar_status, aging };
    },

    /* ── API-shaped accessors (ใช้โดย mock-findata.js) ── */

    /** เทียบเท่า GET /api/finance/ar */
    list(q = {}) {
        const all = this._build().items;
        const s = (q.search || '').trim().toLowerCase();

        const rows = all.filter(r => {
            if (q.period && q.period !== 'all' && r.period_key !== q.period) return false;
            if (q.payer  && q.payer  !== 'all' && r.payer !== q.payer) return false;
            if (q.fund   && q.fund   !== 'all' && r.fund_key !== q.fund) return false;
            if (q.service_type && q.service_type !== 'all' && r.service_type !== q.service_type) return false;
            if (q.status && q.status !== 'all' && r.ar_status !== q.status) return false;
            if (q.aging  && q.aging  !== 'all' && r.aging !== q.aging) return false;
            if (q.only_open && r.outstanding <= 0) return false;
            if (s && ![r.case_ref, r.patient_name, r.hn].some(v => String(v || '').toLowerCase().includes(s)))
                return false;
            return true;
        });

        rows.sort((a, b) => b.outstanding - a.outstanding || a.sent_date.localeCompare(b.sent_date));
        const offset = Number(q.offset) || 0;
        return rows.slice(offset, offset + (Number(q.limit) || 200));
    },

    /** จำนวนแถวทั้งหมดที่ตรงตัวกรอง (ก่อนตัด limit) — หน้าจอใช้บอก "แสดง N จาก M" */
    count(q = {}) { return this.list({ ...q, limit: 1e9, offset: 0 }).length; },

    /** เทียบเท่า GET /api/finance/ar/:id */
    one(id) {
        return this._build().items.find(i => String(i.ar_item_id) === String(id)) || null;
    },

    /** เทียบเท่า GET /api/finance/summary */
    summary(q = {}) {
        const rows = this.list({ ...q, limit: 1e9, offset: 0, status: 'all', aging: 'all' });
        const add = (f) => rows.reduce((a, r) => a + f(r), 0);

        const aging = AR_AGING_META.map(m => {
            const hit = rows.filter(r => r.aging === m.key);
            return { bucket: m.key, cases: hit.length, amount: hit.reduce((a, r) => a + r.outstanding, 0) };
        });

        const group = (keyFn) => {
            const m = new Map();
            rows.forEach(r => {
                const k = keyFn(r);
                const g = m.get(k) || { cases: 0, billed: 0, net_received: 0, outstanding: 0 };
                g.cases++; g.billed += r.billed_adj;
                g.net_received += r.net_received; g.outstanding += r.outstanding;
                m.set(k, g);
            });
            return m;
        };

        const byFund = [...group(r => r.fund_key + '|' + r.payer)].map(([k, v]) => {
            const [fund_key, payer] = k.split('|');
            return { fund_key, payer, ...v };
        }).sort((a, b) => b.outstanding - a.outstanding);

        const byStatus = Object.keys(AR_STATUS_META).map(k => {
            const hit = rows.filter(r => r.ar_status === k);
            return { ar_status: k, cases: hit.length, amount: hit.reduce((a, r) => a + r.outstanding, 0) };
        }).filter(x => x.cases);

        return {
            total: {
                cases: rows.length,
                billed: add(r => r.billed_adj),
                paid: add(r => r.paid_amt),
                clawback: add(r => r.clawback_amt),
                writeoff: add(r => r.writeoff_amt),
                net_received: add(r => r.net_received),
                outstanding: add(r => r.outstanding),
                open_cases: rows.filter(r => r.outstanding > 0).length,
            },
            aging, by_fund: byFund, by_status: byStatus,
        };
    },

    /** เทียบเท่า GET /api/finance/receipts */
    receipts(q = {}) {
        return this._build().receipts.filter(r => {
            if (q.period && q.period !== 'all' && r.period_key !== q.period) return false;
            if (q.payer  && q.payer  !== 'all' && r.payer !== q.payer) return false;
            return true;
        }).sort((a, b) => b.received_date.localeCompare(a.received_date));
    },

    /** เทียบเท่า GET /api/finance/receipts/:id */
    receipt(id) {
        const r = this._build().receipts.find(x => String(x.receipt_id) === String(id));
        if (!r) return null;
        const allocations = [];
        this._build().items.forEach(i => i.payments
            .filter(p => p.receipt_id === r.receipt_id)
            .forEach(p => allocations.push({
                alloc_id: `${r.receipt_id}-${i.ar_item_id}`, ar_item_id: i.ar_item_id,
                subfund: p.subfund, paid_amt: p.paid_amt, clawback_amt: p.clawback_amt,
                case_ref: i.case_ref, hn: i.hn, patient_name: i.patient_name,
                billed_amt: i.billed_amt, service_type: i.service_type,
                batch_no: i.batch_no, billed_period: i.period_key, fund_key: i.fund_key,
            })));
        return { ...r, allocations };
    },

    /** งวดที่มีข้อมูล — ให้หน้าจอสร้าง dropdown */
    periods() { return AR_PERIODS; },

    /**
     * เทียบเท่า GET /api/finance/candidates — เคสที่ยังไม่เคยตั้งเป็นลูกหนี้
     *
     * โหมดต้นแบบไม่มีตาราง admission ให้อ่าน จึง generate ชุดเล็ก ๆ ไว้สาธิตขั้นตอน
     * (โหมดต่อ DB จริงอ่านจาก ipd_admissions ที่ยังไม่มีแถวใน ar_items)
     * ⚠️ ตั้งใจให้เป็นสิทธิที่ยังไม่มีในทะเบียน (OFC/LGO/EMS/PVT) — สะท้อนของจริง
     *    ที่เคสค้างตั้งหนี้มักเป็นสิทธิที่ยังไม่ได้จัดชุดส่ง
     */
    candidates(q = {}) {
        const SET = [
            { an: '690801', payer: 'OFC', per: 121100 },
            { an: '690802', payer: 'PVT', per: 52200 },
            { an: '690803', payer: 'LGO', per: 30600 },
            { an: '690804', payer: 'EMS', per: 121300 },
            { an: '690805', payer: 'OFC', per: 27500 },
            { an: '690806', payer: 'UC',  per: 18400 },
            { an: '690807', payer: 'SSS', per: 22900 },
            { an: '690808', payer: 'UC',  per: 9700 },
        ];
        const s = (q.search || '').trim().toLowerCase();
        return SET
            .map((c, i) => ({
                admission_id: 900 + i, an: c.an,
                hn: String(120000 + Math.floor(this._rand('cand' + i) * 40000)).padStart(8, '0'),
                patient_name: this._name('cand' + i),
                payer: c.payer, drg_code: null, coding_status: 'CONFIRMED',
                service_date: this._addDays('2569-08-06', -20 + i * 2),
                billed_amt: c.per,
            }))
            .filter(c => {
                if (q.payer && q.payer !== 'all' && c.payer !== q.payer) return false;
                if (s && ![c.an, c.hn, c.patient_name].some(v => String(v).toLowerCase().includes(s))) return false;
                return true;
            });
    },

    /* ── ตรวจความสอดคล้อง ────────────────────────────
       เรียกจาก console ก่อนนำเสนอ: MockAR.audit()
       ข้อบังคับชุดเดียวกับที่ /api/finance/summary ต้องผ่าน */
    audit() {
        const errs = [];
        const eq = (a, b, what) => {
            if (Math.abs(a - b) > 0.01) errs.push(`${what}: ${a} ≠ ${b}`);
        };

        const s = this.summary();
        const rows = this._build().items;

        // 1. คงค้าง = พึงรับ − รับสุทธิ − ตัดจำหน่าย (รายแถว)
        rows.forEach(r => eq(r.outstanding, r.billed_adj - r.net_received - r.writeoff_amt,
            `${r.case_ref} คงค้าง`));

        // 2. ยอดรวมบนการ์ด = ผลบวกของแถวทั้งหมด
        eq(s.total.outstanding, rows.reduce((a, r) => a + r.outstanding, 0), 'ยอดคงค้างรวม');

        // 3. ถังอายุหนี้รวมกันต้องเท่ายอดคงค้างรวม
        eq(s.aging.reduce((a, b) => a + b.amount, 0), s.total.outstanding, 'ผลรวมถังอายุหนี้');

        // 4. แยกตามสถานะรวมกันต้องเท่ายอดคงค้างรวม และจำนวนเคสต้องครบ
        eq(s.by_status.reduce((a, b) => a + b.amount, 0), s.total.outstanding, 'ผลรวมตามสถานะ');
        eq(s.by_status.reduce((a, b) => a + b.cases, 0), s.total.cases, 'จำนวนเคสตามสถานะ');

        // 5. แยกตามกองทุนรวมกันต้องเท่ายอดคงค้างรวม
        eq(s.by_fund.reduce((a, b) => a + b.outstanding, 0), s.total.outstanding, 'ผลรวมตามกองทุน');

        // 6. ยอดบนใบรับ = ผลรวมบรรทัดตัดยอดของใบนั้น (กติกาเดียวกับ /confirm ฝั่ง API)
        this._build().receipts.forEach(rc => {
            const lines = this.receipt(rc.receipt_id).allocations;
            eq(rc.gross_amt, lines.reduce((a, l) => a + l.paid_amt - l.clawback_amt, 0),
                `ใบรับ ${rc.receipt_no} ยอดตัดไม่ตรง`);
        });

        // 7. เลขเคสต้องไม่ซ้ำ — เคยพลาดตรงนี้: ลืมใส่ code ของกองทุนในเลขเคส
        //    แล้ว UC-6907-001 กลายเป็นของ 4 คนคนละกองทุน ค้นหาเลขเคสได้คนผิด
        const seen = new Map();
        rows.forEach(r => {
            if (seen.has(r.case_ref)) {
                errs.push(`เลขเคสซ้ำ ${r.case_ref}: `
                    + `${seen.get(r.case_ref)} กับ ${r.patient_name}`);
            } else seen.set(r.case_ref, r.patient_name);
        });

        if (errs.length) console.error('MockAR.audit() ไม่ผ่าน', errs);
        else console.log('MockAR.audit() ผ่านทั้งหมด ·', rows.length, 'ราย ·',
            this._build().receipts.length, 'ใบรับ');
        return { ok: !errs.length, errors: errs };
    },
};


/* ══════════════════════════════════════════════════════════
   4. ลงทะเบียน + เปิดเป็น global
   ══════════════════════════════════════════════════════════ */

MockDB.register('ar_items', MockAR._build().items);

window.AR_FUNDS        = AR_FUNDS;
window.AR_FUND_LABEL   = AR_FUND_LABEL;
window.AR_FUND_OPTIONS = AR_FUND_OPTIONS;
window.AR_PAYER_LABEL  = AR_PAYER_LABEL;
window.AR_STATUS_META  = AR_STATUS_META;
window.AR_AGING_META   = AR_AGING_META;
window.AR_PERIODS      = AR_PERIODS;
window.MockAR          = MockAR;
