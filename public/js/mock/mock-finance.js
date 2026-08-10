/**
 * MediCore RCM — MOCK FINANCE (สรุปยอดเงินโอนรายเดือน)
 * ------------------------------------------------------------
 * ผังตารางลอกจากแบบฟอร์มกระดาษที่ รพ. ใช้จริง:
 *   "สรุปรายงานยอดเงินโอนสิทธิประกันสังคม และสิทธิหลักประกันสุขภาพแห่งชาติ ประจำเดือน …"
 *   สองบล็อก · หัวตาราง 2 ชั้น · แต่ละกลุ่มคอลัมน์แยก "ราย" กับ "จำนวนเงิน"
 *
 * ต้องโหลดหลัง mock-core.js · mock-nhso.js (อ่าน MOCK_NHSO_RECON เป็นหมุดยึด)
 *
 * ⚠️ ตัวเลขทุกตัวเป็นข้อมูลสมมติ — หน้าจอที่ใช้ไฟล์นี้ต้องติดป้าย MOCKUP เสมอ
 *
 * ทำไมต้อง generate ไม่ใช่พิมพ์ตาราง 12 เดือนทิ้งไว้
 *   1. 12 เดือน × 2 บล็อก × 20 แถว × 8 ช่อง = 3,840 ตัวเลขที่ต้องกระทบยอดกันเอง
 *      พิมพ์มือเมื่อไรก็เพี้ยนเมื่อนั้น
 *   2. PAGE-GUIDE §7B — ห้าม hardcode ตัวเลขที่คำนวณได้
 *
 * ทำไมห้ามใช้ Math.random()
 *   ตัวเลขต้องเท่าเดิมทุกครั้งที่ re-render ไม่งั้นตารางกับกราฟบนหน้าเดียวกันจะไม่ตรงกัน
 *   จึงใช้ FNV-1a hash ของ (คีย์งวด + คีย์แถว) เป็นตัวสุ่มแทน — ผลลัพธ์คงที่ตลอดกาล
 */

/* ══════════════════════════════════════════════════════════
   1. งวดเวลา — 12 เดือนย้อนหลังนับจาก MockDB.TODAY
      คีย์งวดใช้รูปแบบเดียวกับ สปสช. : YYMM พ.ศ. (6902 = ปี 2569 เดือน 02)
      ตาม NHSO_REPORT_NAMING ใน mock-nhso.js
   ══════════════════════════════════════════════════════════ */

/** ชื่อเดือนเต็ม — หัวรายงานใช้ "ประจำเดือน มิถุนายน 2569" ไม่ใช่ตัวย่อ */
const FIN_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                         'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

/** เรียงใหม่→เก่า (index 0 = เดือนปัจจุบันที่ยังไม่ปิดงวด) */
const FIN_PERIODS = (function () {
    const out = [];
    let y = MockDB.TODAY.getFullYear() + 543;      // TODAY เก็บเป็น ค.ศ. — แปลงเป็น พ.ศ.
    let m = MockDB.TODAY.getMonth() + 1;
    for (let i = 0; i < 12; i++) {
        out.push({
            key:   String(y % 100).padStart(2, '0') + String(m).padStart(2, '0'),
            y, m, idx: i,
            label: FIN_MONTHS_FULL[m - 1] + ' ' + y,           // 'มิถุนายน 2569'
            short: MockFmt.MONTHS[m - 1] + String(y % 100),    // 'มิ.ย.69'
            recon: MockFmt.MONTHS[m - 1] + ' ' + (y % 100),    // 'มิ.ย. 69' — คีย์เทียบ MOCK_NHSO_RECON
            open:  i === 0,                                     // เดือนปัจจุบัน ยังไม่ปิดงวด
        });
        m--; if (m === 0) { m = 12; y--; }
    }
    return out;
})();

/** ปีงบประมาณไทย 1 ต.ค. – 30 ก.ย. — งวดเดือน ต.ค.–ธ.ค. นับเป็นปีงบถัดไป */
function FIN_FISCAL_YEAR_OF(p) { return p.m >= 10 ? p.y + 1 : p.y; }

/** ปีงบที่เลือกดูได้ (เรียงใหม่→เก่า) */
const FIN_FISCAL_YEARS = [...new Set(FIN_PERIODS.map(FIN_FISCAL_YEAR_OF))].sort((a, b) => b - a);


/* ══════════════════════════════════════════════════════════
   2. หัวตาราง — กลุ่มคอลัมน์ 2 ชั้น ตรงตามฟอร์มกระดาษ
      ฝั่งประกันสังคมเรียกช่องที่ 3 ว่า "ยอดเงินโอน"
      ฝั่งหลักประกันสุขภาพเรียกว่า "รายรับ" — คำต่างกันบนฟอร์มจริง ห้ามรวบเป็นคำเดียว
   ══════════════════════════════════════════════════════════ */
const FIN_COL_GROUPS = [
    { key: 'billed',    label: 'ตั้งเบิก',        money: 'ค่าใช้จ่ายใน รพ.' },
    { key: 'processed', label: 'ประมวลผลจ่าย',    money: 'จำนวนเงิน' },
    { key: 'received',  label: 'ยอดเงินโอน',      money: 'จำนวนเงิน', ucLabel: 'รายรับ' },
    { key: 'open',      label: 'คงค้าง',          money: 'จำนวนเงิน' },
];


/* ══════════════════════════════════════════════════════════
   3. ผังแถว — ลอกจากฟอร์มกระดาษบรรทัดต่อบรรทัด

   level 0 = แถวหลัก (มีเลขลำดับ) · level 1 = แถวย่อย (ย่อหน้า ไม่มีเลข)
   แถวหลักที่มี parent ย่อยอยู่ใต้ = "แถวรวม" ห้าม generate เอง ต้องเป็นผลบวกของลูก

   w   = น้ำหนักส่วนแบ่งของยอดตั้งเบิกทั้งบล็อก (normalize ในโค้ด ผลรวมจึงตรงเป๊ะเสมอ)
   per = ค่าใช้จ่ายเฉลี่ยต่อราย (บาท) — ใช้แปลงจำนวนเงินเป็นช่อง "ราย"
   cap = true → เงินเหมาจ่ายรายหัว จ่ายเต็มตามงวด ไม่มีการปฏิเสธรายข้อ
   ══════════════════════════════════════════════════════════ */

/** สิทธิประกันสังคม — 7 หัวข้อ (ข้อ 6 และ 7 เป็นแถวรวมของรายการย่อย) */
const FIN_SSO_ROWS = [
    { no: 1, key: 'sso_cap',        label: 'รายได้เหมาจ่ายรายหัว',                              w: .42,  per: 320,   cap: true },
    { no: 2, key: 'sso_adjrw_main', label: 'เบิกชดเชยผู้ป่วยใน AdjRW. (Main)',                   w: .22,  per: 15400 },
    { no: 3, key: 'sso_adjrw_supra',label: 'เบิกชดเชยผู้ป่วยใน AdjRW. (Supra)',                  w: .06,  per: 42800 },
    { no: 4, key: 'sso_risk26',     label: 'เบิกชดเชยค่าบริการทางการแพทย์ภาระเสี่ยง (26 โรคเรื้อรัง)', w: .07, per: 2150 },
    { no: 5, key: 'sso_labhiv',     label: 'เบิกชดเชยค่า Lab HIV',                               w: .01,  per: 1080 },

    { no: 6, key: 'sso_extra',      label: 'เบิกชดเชยนอกเหนือเหมาจ่าย', children: [
        { key: 'sso_extra_ipd', label: 'เบิกชดเชยนอกเหนือเหมาจ่าย IPD', w: .09, per: 8600 },
        { key: 'sso_extra_opd', label: 'เบิกชดเชยนอกเหนือเหมาจ่าย OPD', w: .05, per: 1240 },
    ] },

    { no: 7, key: 'sso_special',    label: 'เบิกชดเชยโครงการพิเศษ', children: [
        { key: 'sso_cancer_ipd', label: 'เบิกชดเชยโครงการ SSO Cancer Care IPD',            w: .030, per: 38500 },
        { key: 'sso_cancer_opd', label: 'เบิกชดเชยโครงการ SSO Cancer Care OPD',            w: .015, per: 12400 },
        { key: 'sso_cardio',     label: 'เบิกชดเชยหัตถการโรคหัวใจและหลอดเลือด (Package)',  w: .020, per: 96000 },
        { key: 'sso_crrt',       label: 'เบิกชดเชยล้างไตต่อเนื่อง CRRT',                    w: .015, per: 24800 },
        { key: 'sso_osa',        label: 'เบิกชดเชยโรคหยุดหายใจขณะนอนหลับ',                  w: .005, per: 18200 },
    ] },
];

/** สิทธิหลักประกันสุขภาพแห่งชาติ — 5 หัวข้อ (ข้อ 5 เป็นแถวรวมของ 6 กองทุนย่อย) */
const FIN_UC_ROWS = [
    { no: 1, key: 'uc_cap',   label: 'รายได้เหมาจ่ายรายหัว',            w: .38, per: 245,   cap: true },
    { no: 2, key: 'uc_ipd',   label: 'ยอดผู้ป่วยใน',                    w: .27, per: 13800 },
    { no: 3, key: 'uc_opd',   label: 'กองทุนผู้ป่วยนอก',                w: .16, per: 920 },
    { no: 4, key: 'uc_ucep',  label: 'เบิกชดเชย Ucep วิกฤติฉุกเฉิน',    w: .03, per: 28600 },

    { no: 5, key: 'uc_funds', label: 'การโอนเงินสิทธิหลักประกันสุขภาพแต่ละกองทุน', children: [
        { key: 'uc_dmht',  label: 'บริการควบคุมป้องกันและรักษาโรค DM/HT',   w: .035, per: 1150 },
        { key: 'uc_ckd',   label: 'กองทุนไตวายเรื้อรัง',                     w: .055, per: 18400 },
        { key: 'uc_hiv',   label: 'กองทุนเอดส์',                             w: .025, per: 6200 },
        { key: 'uc_pp',    label: 'กองทุนสร้างเสริมสุขภาพและป้องกันโรค',     w: .030, per: 480 },
        { key: 'uc_thal',  label: 'Thalassemia',                             w: .008, per: 9800 },
        { key: 'uc_tb',    label: 'วัณโรค',                                  w: .007, per: 5400 },
    ] },
];


/* ══════════════════════════════════════════════════════════
   4. ถังกองทุนของกราฟแท่งซ้อน

   6 ถังพอดีกับ DSChart.PALETTE ที่มี 6 สี — เกินกว่านี้สีจะวนซ้ำ
   แล้วผู้อ่านแยกไม่ออกว่าแท่งไหนเป็นกองทุนอะไร
   ══════════════════════════════════════════════════════════ */
const FIN_CHART_FUNDS = [
    { key: 'sso_cap',     label: 'ปกส. — เหมาจ่ายรายหัว',      rows: ['sso_cap'] },
    { key: 'sso_ipd',     label: 'ปกส. — ผู้ป่วยใน AdjRW',      rows: ['sso_adjrw_main', 'sso_adjrw_supra'] },
    { key: 'sso_other',   label: 'ปกส. — นอกเหนือเหมาจ่าย/โครงการพิเศษ',
      rows: ['sso_risk26', 'sso_labhiv', 'sso_extra_ipd', 'sso_extra_opd',
             'sso_cancer_ipd', 'sso_cancer_opd', 'sso_cardio', 'sso_crrt', 'sso_osa'] },
    { key: 'uc_cap',      label: 'บัตรทอง — เหมาจ่ายรายหัว',    rows: ['uc_cap'] },
    { key: 'uc_service',  label: 'บัตรทอง — ผู้ป่วยใน/นอก/UCEP', rows: ['uc_ipd', 'uc_opd', 'uc_ucep'] },
    { key: 'uc_disease',  label: 'บัตรทอง — กองทุนเฉพาะโรค',
      rows: ['uc_dmht', 'uc_ckd', 'uc_hiv', 'uc_pp', 'uc_thal', 'uc_tb'] },
];


/* ══════════════════════════════════════════════════════════
   5. MockFinance
   ══════════════════════════════════════════════════════════ */
const MockFinance = {

    /**
     * สัดส่วนขนาดบล็อกประกันสังคมเทียบบล็อกหลักประกันสุขภาพ
     *
     * ⚠️ นี่คือ "ข้อมูลตั้งต้น" ไม่ใช่ค่าที่คำนวณได้ — จงใจไม่ derive จาก MockClaims
     *    เพราะเคสจำลองสุ่มกองทุนแบบกระจายเท่ากัน (mock-claims.js ใช้ pick(CLAIM_FUNDS))
     *    ถ้าเอาอัตราส่วนนั้นมาใช้จะได้ ปกส. ≈ บัตรทอง ซึ่งไม่ตรงกับ รพ. จริงเลย
     *    เมื่อผูก backend ให้แทนด้วยยอดจริงจากทะเบียนผู้มีสิทธิ
     */
    SSO_SHARE: 0.34,

    /** ยอดตั้งเบิกฝั่งบัตรทองเฉลี่ยต่อเดือน — ใช้กับงวดที่ไม่มีหมุดใน MOCK_NHSO_RECON */
    _ucBaseline() {
        if (this.__base != null) return this.__base;
        const r = (typeof MOCK_NHSO_RECON !== 'undefined' && MOCK_NHSO_RECON.length)
            ? MOCK_NHSO_RECON : [{ expect: 26000000, paid: 24700000 }];
        this.__base = r.reduce((a, x) => a + x.expect, 0) / r.length;
        return this.__base;
    },

    /* ── ตัวสุ่มที่ให้ค่าเดิมเสมอ ────────────────────── */

    /** FNV-1a → [0,1) */
    _rand(seed) {
        let h = 2166136261;
        const s = String(seed);
        for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
        return (h >>> 0) / 4294967296;
    },

    /** ตัวคูณแกว่งรอบ 1 — _jit('x', .08) ∈ [0.92, 1.08] */
    _jit(seed, spread) { return 1 + (this._rand(seed) - 0.5) * 2 * spread; },

    /**
     * แบ่ง total ตามน้ำหนัก ให้ผลรวมของจำนวนเต็มเท่ากับ total เป๊ะ
     * เศษจากการปัดยกให้ช่องที่ใหญ่ที่สุด — ตารางการเงินห้ามมีเศษหาย
     */
    _split(total, weights) {
        const sum = weights.reduce((a, w) => a + w, 0) || 1;
        const out = weights.map(w => Math.round(total * w / sum));
        const diff = total - out.reduce((a, v) => a + v, 0);
        if (diff !== 0) {
            let big = 0;
            for (let i = 1; i < out.length; i++) if (out[i] > out[big]) big = i;
            out[big] += diff;
        }
        return out;
    },

    /**
     * แบ่ง total ตามน้ำหนัก โดยห้ามช่องไหนเกินเพดานของตัวเอง
     *
     * จำเป็นเพราะยอดโอนรายแถวห้ามเกินยอดตั้งเบิกของแถวนั้น แต่ผลรวมก็ต้องตรงหมุด
     * สปสช. เป๊ะด้วย — ถ้าใช้ Math.min ตัดทิ้งเฉย ๆ ผลรวมจะขาดไปเงียบ ๆ
     * จึงดันส่วนที่ล้นไปให้แถวที่ยังมีที่ว่าง แล้ววนจนไม่มีใครล้น
     */
    _splitCapped(total, weights, caps) {
        const room = caps.reduce((a, c) => a + c, 0);
        if (total >= room) return caps.slice();          // เต็มเพดานทุกแถว

        const out = new Array(weights.length).fill(0);
        const fixed = new Array(weights.length).fill(false);
        let left = total;

        for (let pass = 0; pass < 12 && left > 0; pass++) {
            const idx = weights.map((w, i) => i).filter(i => !fixed[i] && weights[i] > 0);
            if (!idx.length) break;
            const part = this._split(left, idx.map(i => weights[i]));
            let spilled = false;
            idx.forEach((i, k) => {
                const want = out[i] + part[k];
                if (want >= caps[i]) { left -= caps[i] - out[i]; out[i] = caps[i]; fixed[i] = true; spilled = true; }
                else { left -= part[k]; out[i] = want; }
            });
            if (!spilled) break;
        }

        /* เศษสุดท้ายยกให้แถวที่ยังมีที่ว่างมากที่สุด */
        if (left !== 0) {
            let best = -1;
            out.forEach((v, i) => { if (caps[i] - v > (best < 0 ? -1 : caps[best] - out[best])) best = i; });
            if (best >= 0) out[best] = Math.min(caps[best], out[best] + left);
        }
        return out;
    },

    /* ── งวดเวลา ─────────────────────────────────────── */

    periods()      { return FIN_PERIODS; },
    current()      { return FIN_PERIODS[0]; },
    byKey(key)     { return FIN_PERIODS.find(p => p.key === String(key)) || null; },
    fiscalYears()  { return FIN_FISCAL_YEARS; },

    /** หมุดยึดจาก สปสช. ของงวดนี้ (ถ้ามี) — ทำให้ตัวเลขตรงกับหน้า nhso-reports */
    _anchor(p) {
        if (typeof MOCK_NHSO_RECON === 'undefined') return null;
        return MOCK_NHSO_RECON.find(r => r.period === p.recon) || null;
    },

    /* ── สร้างตัวเลขของ 1 บล็อก ในงวดเดียว ───────────── */

    /**
     * คืนแถวที่ generate แล้ว พร้อมแถวรวม
     * @param {object} p       งวดจาก FIN_PERIODS
     * @param {Array}  defs    FIN_SSO_ROWS หรือ FIN_UC_ROWS
     * @param {number} billedTotal  ยอดตั้งเบิกทั้งบล็อก
     * @param {number|null} receivedTotal  ยอดที่โอนจริงทั้งบล็อก (null = ให้โมเดลคำนวณเอง)
     */
    _block(p, defs, billedTotal, receivedTotal) {
        /* (ก) กระจายยอดตั้งเบิกลงเฉพาะ "แถวใบ" — แถวรวมจะได้จากผลบวกทีหลัง */
        const leaves = [];
        defs.forEach(d => (d.children || [d]).forEach(x => leaves.push({ ...x, cap: x.cap || d.cap })));

        const weights = leaves.map(x => x.w * this._jit(p.key + x.key, 0.10));
        const billed  = this._split(Math.round(billedTotal), weights);

        /* (ข) อัตราที่ผ่านการประมวลผลและได้รับโอนจริง
               - เหมาจ่ายรายหัว: จ่ายเต็มตามงวด ไม่มีการปฏิเสธรายข้อ
               - เดือนที่ยังไม่ปิดงวด: เพิ่งส่งเบิก เงินยังทยอยเข้า → คงค้างสูงเป็นธรรมชาติ */
        const lag = p.open ? 0.34 : (p.idx === 1 ? 0.88 : 1);

        let recv = leaves.map((x, i) => {
            const pr = x.cap ? 1 : 0.93 + this._rand(p.key + x.key + 'p') * 0.055;
            return Math.round(billed[i] * pr * lag);
        });

        /* (ค) ถ้ามีหมุดยึด ให้ผลรวมตรงกับหมุดเป๊ะ โดยไม่มีแถวไหนโอนเกินยอดที่ตั้งเบิก */
        if (receivedTotal != null) {
            recv = this._splitCapped(Math.round(receivedTotal), recv, billed);
        }

        /* (ง) ประมวลผลจ่ายต้องอยู่ระหว่างตั้งเบิกกับยอดโอนเสมอ */
        const rows = leaves.map((x, i) => {
            const b = billed[i];
            const r = recv[i];
            const pcRatio = x.cap ? 1 : 0.94 + this._rand(p.key + x.key + 'c') * 0.05;
            const c = Math.max(r, Math.min(b, Math.round(b * pcRatio)));

            /* ช่อง "ราย" — ใช้อัตราเดียวกับเงิน จำนวนรายจึงลดหลั่นตามกันและไม่ติดลบ */
            const nb = Math.max(1, Math.round(b / x.per));
            const nc = Math.round(nb * (c / (b || 1)));
            const nr = Math.round(nb * (r / (b || 1)));

            return {
                key: x.key, label: x.label,
                billed:    { n: nb,      amt: b },
                processed: { n: nc,      amt: c },
                received:  { n: nr,      amt: r },
                open:      { n: nb - nr, amt: b - r },   // ← คงค้าง = ตั้งเบิก − ยอดโอน (นิยามเดียวทั้งหน้า)
            };
        });

        const pick = k => rows.find(r => r.key === k);
        const zero = () => ({ billed: { n: 0, amt: 0 }, processed: { n: 0, amt: 0 },
                              received: { n: 0, amt: 0 }, open: { n: 0, amt: 0 } });
        const add = (a, b) => {
            FIN_COL_GROUPS.forEach(g => { a[g.key].n += b[g.key].n; a[g.key].amt += b[g.key].amt; });
            return a;
        };

        /* (จ) ประกอบเป็นลำดับที่ผู้อ่านเห็นบนฟอร์ม: แถวหลัก → แถวย่อย */
        const out = [];
        defs.forEach(d => {
            if (!d.children) {
                out.push({ ...pick(d.key), no: d.no, level: 0 });
                return;
            }
            const kids = d.children.map(c => ({ ...pick(c.key), level: 1 }));
            out.push({ ...kids.reduce((a, k) => add(a, k), zero()),
                       key: d.key, label: d.label, no: d.no, level: 0, isGroup: true });
            kids.forEach(k => out.push(k));
        });

        const total = out.filter(r => r.level === 0).reduce((a, r) => add(a, r), zero());
        return { rows: out, total };
    },

    /* ── ตารางของงวดเดียว ────────────────────────────── */

    /** @returns {{period, sso:{rows,total}, uc:{rows,total}, grand}} */
    sheet(periodKey) {
        const p = this.byKey(periodKey) || this.current();
        const a = this._anchor(p);

        /* บัตรทอง — ใช้ยอดจริงจาก MOCK_NHSO_RECON ถ้ามี หน้านี้จะกระทบยอดกับ nhso-reports.html ได้ */
        const ucBilled = a ? a.expect
                           : Math.round(this._ucBaseline() * this._jit(p.key + 'uc', 0.09));
        const ucRecv   = a ? a.paid : null;

        const ssoBilled = Math.round(ucBilled * this.SSO_SHARE * this._jit(p.key + 'sso', 0.07));

        const sso = this._block(p, FIN_SSO_ROWS, ssoBilled, null);
        const uc  = this._block(p, FIN_UC_ROWS,  ucBilled,  ucRecv);

        return { period: p, sso, uc, grand: this._grand(sso.total, uc.total), anchored: !!a };
    },

    _grand(a, b) {
        const g = {};
        FIN_COL_GROUPS.forEach(k => {
            g[k.key] = { n: a[k.key].n + b[k.key].n, amt: a[k.key].amt + b[k.key].amt };
        });
        return g;
    },

    /* ── สะสมทั้งปีงบประมาณ ──────────────────────────── */

    /**
     * รวมทุกงวดในปีงบที่ระบุ (1 ต.ค. – 30 ก.ย.) — คืนรูปเดียวกับ sheet()
     * ใช้แถวเดียวกันบวกกันตรง ๆ ผลรวมจึงยังกระทบยอดได้เหมือนงวดเดียว
     */
    fiscalYear(beYear) {
        const inFY = FIN_PERIODS.filter(p => FIN_FISCAL_YEAR_OF(p) === Number(beYear));
        const sheets = inFY.map(p => this.sheet(p.key));
        if (!sheets.length) return this.sheet(this.current().key);

        const merge = side => {
            const rows = sheets[0][side].rows.map((r, i) => {
                const acc = { ...r };
                FIN_COL_GROUPS.forEach(g => { acc[g.key] = { n: 0, amt: 0 }; });
                sheets.forEach(s => FIN_COL_GROUPS.forEach(g => {
                    acc[g.key].n   += s[side].rows[i][g.key].n;
                    acc[g.key].amt += s[side].rows[i][g.key].amt;
                }));
                return acc;
            });
            const total = {};
            FIN_COL_GROUPS.forEach(g => {
                total[g.key] = rows.filter(r => r.level === 0)
                    .reduce((a, r) => ({ n: a.n + r[g.key].n, amt: a.amt + r[g.key].amt }), { n: 0, amt: 0 });
            });
            return { rows, total };
        };

        const sso = merge('sso'), uc = merge('uc');
        const oldest = inFY[inFY.length - 1], newest = inFY[0];
        return {
            period: {
                key: 'FY' + beYear, fy: Number(beYear), isFY: true,
                label: `ปีงบประมาณ ${beYear} (${oldest.short} – ${newest.short})`,
                short: 'ปีงบ ' + beYear,
                months: inFY.length,
            },
            sso, uc, grand: this._grand(sso.total, uc.total), anchored: false,
        };
    },

    /* ── ชุดข้อมูลกราฟ 12 เดือน (เก่า→ใหม่ ตามแกน X) ── */

    /**
     * @param {'all'|'sso'|'uc'} scope
     * @returns {{labels, byFund, billed, received, expected}}
     */
    series(scope) {
        const sc = scope || 'all';
        const chrono = [...FIN_PERIODS].reverse();
        const sheets = chrono.map(p => this.sheet(p.key));

        const amtOf = (sheet, side, key) => {
            const r = sheet[side].rows.find(x => x.key === key);
            return r ? r.received.amt : 0;
        };

        /* แท่งซ้อน — ใช้ "ยอดที่โอนเข้าจริง" เพราะหัวข้อคือสัดส่วนเงินที่เข้ากระเป๋า */
        const byFund = FIN_CHART_FUNDS.map(f => sheets.map(s =>
            f.rows.reduce((a, k) => a + amtOf(s, k.startsWith('sso') ? 'sso' : 'uc', k), 0)));

        const total = (s, field) => {
            if (sc === 'sso') return s.sso.total[field].amt;
            if (sc === 'uc')  return s.uc.total[field].amt;
            return s.grand[field].amt;
        };
        const billed   = sheets.map(s => total(s, 'billed'));
        const received = sheets.map(s => total(s, 'received'));

        /**
         * ประมาณการพึงรับ = ตั้งเบิก × อัตราที่ได้รับจริงเฉลี่ยย้อนหลัง 3 เดือน
         * (เดือนแรก ๆ ยังไม่มีประวัติ — ใช้ค่าเฉลี่ยของ 3 เดือนแรกที่ปิดงวดแล้วแทน)
         */
        const closed = billed.map((b, i) => (chrono[i].open || !b) ? null : received[i] / b)
                             .filter(v => v != null);
        const seedRate = closed.slice(0, 3).reduce((a, v) => a + v, 0) / Math.max(1, Math.min(3, closed.length));

        const expected = billed.map((b, i) => {
            const hist = [];
            for (let j = Math.max(0, i - 3); j < i; j++) {
                if (!chrono[j].open && billed[j]) hist.push(received[j] / billed[j]);
            }
            const rate = hist.length ? hist.reduce((a, v) => a + v, 0) / hist.length : seedRate;
            return Math.round(b * rate);
        });

        return { labels: chrono.map(p => p.short), byFund, billed, received, expected };
    },

    /* ── ตรวจความสอดคล้อง ────────────────────────────── */

    /**
     * ตรวจข้อบังคับ 4 ข้อของตารางนี้ — เรียกจาก console ก่อนนำเสนอ: MockFinance.audit()
     * PAGE-GUIDE §7B: "ตัวเลข 5 จุดต้องกระทบยอดกันได้"
     */
    audit() {
        const errs = [];
        const eq = (a, b, what) => { if (a !== b) errs.push(`${what}: ${a} ≠ ${b}`); };

        FIN_PERIODS.forEach(p => {
            const s = this.sheet(p.key);
            [['sso', FIN_SSO_ROWS], ['uc', FIN_UC_ROWS]].forEach(([side, defs]) => {
                const B = s[side];

                B.rows.forEach(r => {
                    // 1. คงค้าง = ตั้งเบิก − ยอดโอน
                    eq(r.open.amt, r.billed.amt - r.received.amt, `${p.key}/${side}/${r.key} คงค้าง(เงิน)`);
                    eq(r.open.n,   r.billed.n   - r.received.n,   `${p.key}/${side}/${r.key} คงค้าง(ราย)`);
                    // 2. ตั้งเบิก ≥ ประมวลผลจ่าย ≥ ยอดโอน
                    if (!(r.billed.amt >= r.processed.amt && r.processed.amt >= r.received.amt))
                        errs.push(`${p.key}/${side}/${r.key} ลำดับยอดผิด`);
                });

                // 3. แถวหลักที่มีลูก = ผลรวมของลูก
                defs.filter(d => d.children).forEach(d => {
                    const g = B.rows.find(r => r.key === d.key);
                    const kidSum = d.children.reduce((a, c) =>
                        a + B.rows.find(r => r.key === c.key).billed.amt, 0);
                    eq(g.billed.amt, kidSum, `${p.key}/${side}/${d.key} แถวรวม`);
                });

                // 4. แถว "รวม" = ผลรวมของแถวหลักเท่านั้น
                const top = B.rows.filter(r => r.level === 0)
                    .reduce((a, r) => a + r.billed.amt, 0);
                eq(B.total.billed.amt, top, `${p.key}/${side} แถวรวมท้ายตาราง`);
            });

            // 5. งวดที่มีหมุด สปสช. ต้องตรงกับ MOCK_NHSO_RECON เป๊ะ
            const a = this._anchor(p);
            if (a) {
                eq(s.uc.total.billed.amt,   a.expect, `${p.key} ตั้งเบิก UC เทียบ RECON`);
                eq(s.uc.total.received.amt, a.paid,   `${p.key} รายรับ UC เทียบ RECON`);
            }
        });

        // 6. แท่งซ้อนของแต่ละเดือนต้องรวมได้เท่ายอดโอนรวมของเดือนนั้น
        const s = this.series('all');
        s.labels.forEach((L, i) => {
            const stack = s.byFund.reduce((a, f) => a + f[i], 0);
            eq(stack, s.received[i], `กราฟแท่งซ้อน ${L}`);
        });

        if (errs.length) console.error('MockFinance.audit() ไม่ผ่าน', errs);
        else console.log('MockFinance.audit() ผ่านทั้งหมด ·', FIN_PERIODS.length, 'งวด');
        return { ok: !errs.length, errors: errs };
    },
};


/* ══════════════════════════════════════════════════════════
   6. ลงทะเบียน + เปิดเป็น global
   ══════════════════════════════════════════════════════════ */

/** สรุปรายงวดในรูปแถวตาราง — ให้ MockDB.all('finance') ใช้ได้เหมือนโดเมนอื่น */
MockDB.register('finance', FIN_PERIODS.map(p => {
    const s = MockFinance.sheet(p.key);
    return {
        id: p.key, period: p.label, fy: FIN_FISCAL_YEAR_OF(p),
        billed:   s.grand.billed.amt,
        received: s.grand.received.amt,
        open:     s.grand.open.amt,
    };
}));

window.FIN_MONTHS_FULL  = FIN_MONTHS_FULL;
window.FIN_PERIODS      = FIN_PERIODS;
window.FIN_FISCAL_YEARS = FIN_FISCAL_YEARS;
window.FIN_COL_GROUPS   = FIN_COL_GROUPS;
window.FIN_SSO_ROWS     = FIN_SSO_ROWS;
window.FIN_UC_ROWS      = FIN_UC_ROWS;
window.FIN_CHART_FUNDS  = FIN_CHART_FUNDS;
window.MockFinance      = MockFinance;
