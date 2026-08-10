/**
 * MediCore RCM — MOCK KPI (ทะเบียนตัวชี้วัดของทั้งระบบ)
 * ------------------------------------------------------------
 * ⭐ นิยาม KPI อยู่ที่นี่ "ที่เดียว" — เดิมกระจายอยู่ในอาร์เรย์ KPI ของ
 *    claim-dashboard.js กับ refer-dashboard.js ซึ่งลอกกันมาเกือบทั้งดุ้น
 *
 * ทำไมต้องรวม: ตัวเลขบนการ์ดกับจำนวนแถวในหน้าปลายทางต้องกระทบยอดกันได้
 * (PAGE-GUIDE §7B) ถ้าแยกกันเขียนเมื่อไร กด "เคสความเสี่ยงสูง 13" แล้วไปเจอ
 * 47 เคสในหน้า Worklist ทันที — คำถามแรกในห้องประชุมคือ "ตัวเลขไหนจริง"
 *
 * แต่ละนิยามมี 2 ด้านที่ต้องตรงกันเสมอ
 *   value(rows, ctx)  → ตัวเลขที่โชว์บนการ์ด — เรียกตัวช่วยกลางเดิม (ห้ามคำนวณซ้ำ)
 *   pick(base, ctx)   → แถวจริงที่ประกอบเป็นตัวเลขนั้น — drawer และหน้าปลายทางใช้ชุดนี้
 * เพิ่ม KPI ใหม่ต้องเขียนทั้งคู่ ไม่งั้น drawer จะโชว์เลขที่ไม่มีรายการรองรับ
 *
 * ลำดับโหลด: หลัง mock ของโดเมนที่ตัวเองอ้างถึง (claims / ipd / referrals / tasks)
 * หน้าไหนโหลด mock ไม่ครบก็ยังปลอดภัย — fromUrl() ห่อ try/catch คืน null (fail-open)
 */

const MockKpi = {

    /** จำนวนแถวสูงสุดที่ drawer แสดง — เกินกว่านี้ขึ้นบรรทัดบอกว่าเหลืออีกเท่าไร */
    CAP: 20,

    /* ══════════════════════════════════════════════════════════
       1. แหล่งข้อมูลตั้งต้น — ตัวกรองของหน้า Dashboard ถูกใส่ที่นี่ที่เดียว
          ctx = { fund, dir } · def.global = true แปลว่าไม่สนตัวกรองของหน้า
       ══════════════════════════════════════════════════════════ */
    SOURCES: {
        claims(ctx) {
            const f = ctx.fund;
            return MockClaims.all().filter(c => !f || f === 'all' || c.fund === f);
        },
        referrals(ctx) {
            const f = ctx.fund;
            const d = ctx.dir && ctx.dir !== 'all' ? ctx.dir : null;
            return MockRefer.byDir(d).filter(r => !f || f === 'all' || r.fund === f);
        },
        bills()  { return MockRefer.allBills(); },
        stays()  { return MockIpd.all(); },
        tasks()  { return MockTasks.all(); },
    },

    /** แถวจริงที่ประกอบเป็นตัวเลขของ KPI ตัวนี้ */
    rows(def, ctx) {
        const d = typeof def === 'string' ? this.byKey(def) : def;
        if (!d) return [];
        const c = d.global ? {} : (ctx || {});
        return d.pick(this.SOURCES[d.source](c), c) || [];
    },

    /** ตัวเลขที่โชว์บนการ์ด */
    value(def, ctx) {
        const d = typeof def === 'string' ? this.byKey(def) : def;
        if (!d) return '—';
        return d.value(this.rows(d, ctx), d.global ? {} : (ctx || {}));
    },

    forPage(page) { return this.DEFS.filter(d => d.page === page); },
    byKey(key)    { return this.DEFS.find(d => d.key === key) || null; },
    idOf(def, r)  { return r[def.idKey || 'id']; },

    /* ══════════════════════════════════════════════════════════
       2. ?kpi=<key> — หน้าปลายทางกรองด้วยชุด id เดียวกับที่ drawer แสดง
          ตัวกรองของ Dashboard เดินทางมากับ URL (&fund= / &dir=) แถวจึงตรงกันเป๊ะ
       ══════════════════════════════════════════════════════════ */

    _url: undefined,        // undefined = ยังไม่ได้อ่าน · null = ไม่มี ?kpi=

    /**
     * อ่าน ?kpi= จาก URL แล้วคืนชุด id ที่หน้าปลายทางต้องกรอง
     * fail-open โดยตั้งใจ — key แปลก ๆ หรือ mock ที่ต้องใช้ไม่ได้โหลดในหน้านั้น
     * ต้องได้รายการเต็มไม่ใช่จอขาว (เหตุผลเดียวกับที่หน้าต้นแบบไม่ gate — PAGE-GUIDE §7B)
     */
    fromUrl() {
        if (this._url !== undefined) return this._url;
        this._url = null;
        try {
            const p   = new URLSearchParams(location.search);
            const key = p.get('kpi');
            if (!key) return this._url;

            const def = this.byKey(key);
            if (!def) { console.warn('[MockKpi] ไม่รู้จัก kpi:', key); return this._url; }

            const ctx  = { fund: p.get('fund') || 'all', dir: p.get('dir') || 'all' };
            const rows = this.rows(def, ctx);

            this._url = {
                def, key, ctx,
                label: def.label,
                count: rows.length,
                ids:   new Set(rows.map(r => this.idOf(def, r))),
            };
        } catch (err) {
            console.warn('[MockKpi] fromUrl', err);
            this._url = null;
        }
        return this._url;
    },

    /** true = แถวนี้อยู่ในชุดที่ ?kpi= กรองไว้ (ไม่มี ?kpi= → ผ่านหมด) */
    keep(row) {
        const k = this.fromUrl();
        if (!k || !row) return true;
        return k.ids.has(row[k.def.idKey || 'id']);
    },

    /** แถบบอกว่ารายการถูกกรองอยู่ — ถ้าไม่บอก ผู้ใช้จะคิดว่าข้อมูลหาย */
    mountBanner(elId) {
        const el = document.getElementById(elId); if (!el) return;
        const k  = this.fromUrl();
        if (!k) { el.innerHTML = ''; return; }

        el.innerHTML = `
            <div class="sip-banner sip-banner-info" style="margin-bottom:12px">
                <i data-lucide="filter" class="icon-sm"></i>
                <span>กรองจากตัวชี้วัด <strong>${MockEsc(k.label)}</strong> ·
                      ${MockEsc(MockFmt.int(k.count))} รายการ</span>
                <button class="btn btn-outline btn-sm" style="margin-left:auto"
                        onclick="MockKpi.clearFilter()">ล้างตัวกรอง</button>
            </div>`;
        if (window.refreshIcons) refreshIcons();
    },

    clearFilter() { location.href = location.pathname; },

    /* ══════════════════════════════════════════════════════════
       3. ตัวช่วยสร้างคอลัมน์ที่ใช้ซ้ำหลาย KPI
       ══════════════════════════════════════════════════════════ */
    _user(id) { return window.MockAdmin ? MockAdmin.userName(id) : (id || '—'); },

    COL: {
        claimId:  { h: 'เลขที่เคส', nowrap: true, get: c => c.id, sub: c => 'HN ' + c.hn },
        patient:  { h: 'ผู้ป่วย', get: c => c.patient,
                    sub: c => `${c.age} ปี · ${c.gender === 'F' ? 'หญิง' : 'ชาย'}` },
        fund:     { h: 'กองทุน', html: c => `<span class="sip-chip sip-chip-muted">${MockEsc(c.fund)}</span>` },
        result:   { h: 'ผลตรวจ', html: c => MockTone.resultBadgeHtml(c.result) },
    },
};


/* ══════════════════════════════════════════════════════════
   4. นิยาม KPI
      ข้อความ how / fields / scopeNote / label ยกมาจากของเดิมทั้งหมด
      — ชุดคำเดียวกันนี้ถูกใช้บนสไลด์นำเสนอด้วย ห้ามเรียบเรียงใหม่
   ══════════════════════════════════════════════════════════ */
MockKpi.DEFS = [

/* ────────── claim-dashboard · เคลมผู้ป่วยนอก ────────── */

{   page: 'claim-dashboard', key: 'queue', icon: 'inbox', label: 'เคสรอส่งเบิก',
    source: 'claims',
    pick: base => base.filter(c => c.nhso && c.nhso.stage === 'AWAIT_SUBMIT')
                      .sort((a, b) => String(a.service_date).localeCompare(String(b.service_date))),
    value: rows => MockFmt.int(rows.length),
    cols: [
        MockKpi.COL.claimId, MockKpi.COL.patient,
        { h: 'วันรับบริการ', nowrap: true, get: c => MockFmt.dateTH(c.service_date) },
        MockKpi.COL.fund,
        { h: 'ยอดเรียกเก็บ', align: 'r', get: c => MockFmt.baht(c.amount_claimed) },
        MockKpi.COL.result,
    ],
    rowHref: c => `claim-case.html?id=${encodeURIComponent(c.id)}`,
    drill:   ctx => 'claim-worklist.html?kpi=queue' + MockKpi._fund(ctx),
    how: 'นับเคสที่สถานะฝั่ง สปสช. = "รอส่งเบิก"',
    fields: ['claims[].nhso.stage === "AWAIT_SUBMIT"'] },

{   page: 'claim-dashboard', key: 'risk', icon: 'alert-triangle', critical: true,
    label: 'เคสความเสี่ยงสูง (70+)',
    source: 'claims',
    pick: base => base.filter(c => c.risk_score >= 70 && c.result !== 'PASS')
                      .sort((a, b) => (b.risk_score - a.risk_score)
                                   || (b.amount_at_risk - a.amount_at_risk)),
    value: rows => MockFmt.int(rows.length),
    cols: [
        MockKpi.COL.claimId, MockKpi.COL.patient, MockKpi.COL.fund,
        { h: 'มูลค่าเสี่ยง', align: 'r', get: c => MockFmt.baht(c.amount_at_risk) },
        { h: 'คะแนน', align: 'r', get: c => c.risk_score },
        MockKpi.COL.result,
    ],
    rowHref: c => `claim-case.html?id=${encodeURIComponent(c.id)}`,
    drill:   ctx => 'claim-worklist.html?kpi=risk' + MockKpi._fund(ctx),
    how: 'นับเคสที่คะแนนความเสี่ยง ≥ 70 และผลตรวจไม่ใช่ "ผ่าน"',
    fields: ['claims[].risk_score >= 70', 'claims[].result !== "PASS"'] },

{   page: 'claim-dashboard', key: 'money', icon: 'wallet', label: 'มูลค่าเสี่ยงที่ตรวจพบ (บาท)',
    source: 'claims',
    pick: base => base.filter(c => (c.amount_at_risk || 0) > 0)
                      .sort((a, b) => b.amount_at_risk - a.amount_at_risk),
    value: rows => MockFmt.baht(rows.reduce((a, c) => a + (c.amount_at_risk || 0), 0)),
    cols: [
        MockKpi.COL.claimId, MockKpi.COL.patient, MockKpi.COL.fund, MockKpi.COL.result,
        { h: 'มูลค่าเสี่ยง (บาท)', align: 'r', get: c => MockFmt.baht(c.amount_at_risk) },
    ],
    totalOf: c => c.amount_at_risk || 0,
    totalLabel: 'รวมมูลค่าเสี่ยงที่ตรวจพบ',
    rowHref: c => `claim-case.html?id=${encodeURIComponent(c.id)}`,
    drill:   ctx => 'claim-worklist.html?kpi=money' + MockKpi._fund(ctx),
    how: 'ผลรวมของมูลค่าที่เสี่ยงถูกตัดจากทุกเคสที่ยังไม่ปิดประเด็น',
    fields: ['Σ claims[].amount_at_risk'] },

{   page: 'claim-dashboard', key: 'first', icon: 'shield-check', label: 'First-pass Acceptance',
    source: 'claims', global: true,
    /* ตัวหารคือ "เคสที่ส่งแล้ว" ทั้งหมด — เรียงให้เคสที่ฉุดอัตราลง (รอแก้ไข) ขึ้นก่อน */
    pick: base => base.filter(c => c.nhso && c.nhso.stage !== 'AWAIT_SUBMIT')
                      .sort((a, b) => (a.nhso.stage === 'AWAIT_FIX' ? 0 : 1)
                                    - (b.nhso.stage === 'AWAIT_FIX' ? 0 : 1)),
    value: () => MockFmt.pct(MockClaims.firstPassRate(), 1),
    subline: rows => {
        const clean = rows.filter(c => c.nhso.stage !== 'AWAIT_FIX').length;
        return `ผ่านตั้งแต่ส่งครั้งแรก ${MockFmt.int(clean)} จาก ${MockFmt.int(rows.length)} เคสที่ส่งแล้ว`;
    },
    cols: [
        MockKpi.COL.claimId, MockKpi.COL.patient, MockKpi.COL.fund,
        { h: 'สถานะฝั่ง สปสช.', get: c => MockNhso.stageLabel(c.nhso.stage) },
        { h: 'ผ่านครั้งแรก', html: c => c.nhso.stage === 'AWAIT_FIX'
            ? '<span class="sip-chip sip-chip-danger">ต้องแก้แล้วส่งซ้ำ</span>'
            : '<span class="sip-chip sip-chip-success">ผ่าน</span>' },
    ],
    rowHref: c => `claim-case.html?id=${encodeURIComponent(c.id)}`,
    drill:   () => 'claim-worklist.html?kpi=first',
    how: 'เคสที่ส่งแล้วไม่เคยเข้าสถานะ "รอแก้ไข" ÷ เคสที่ส่งทั้งหมด × 100',
    fields: ['claims[].nhso.stage !== "AWAIT_SUBMIT" (ตัวหาร)',
             'claims[].nhso.stage !== "AWAIT_FIX" (ตัวตั้ง)'],
    scopeNote: () => MockClaims.all().length + ' เคสทั้งระบบ (ไม่ตามตัวกรองกองทุน)' },

{   page: 'claim-dashboard', key: 'sla', icon: 'clock', label: 'งานเกิน SLA',
    source: 'tasks', global: true, idKey: 'id',
    pick: () => MockTasks.overSla().slice()
                    .sort((a, b) => String(a.due_at).localeCompare(String(b.due_at))),
    value: rows => MockFmt.int(rows.length),
    cols: [
        { h: 'เลขที่งาน', nowrap: true, get: t => t.id },
        { h: 'เรื่อง', get: t => t.title, sub: t => MockTasks.kindLabel(t.kind) },
        { h: 'ผู้รับผิดชอบ', get: t => MockKpi._user(t.owner) },
        { h: 'กำหนดเสร็จ', nowrap: true, get: t => MockFmt.dateTimeTH(t.due_at) },
        { h: 'เลยกำหนด', html: t => MockTone.slaHtml(t.due_at) },
    ],
    rowHref: t => `claim-tasks.html?id=${encodeURIComponent(t.id)}`,
    drill:   () => 'claim-tasks.html?kpi=sla',
    taskBox: 'sla',        /* กล่องงานของ claim-tasks ที่ให้ผลชุดเดียวกันเป๊ะ */
    how: 'นับ Task ที่ยังไม่ปิดและเลยกำหนดเสร็จแล้ว',
    fields: ['tasks[].status !== "DONE"', 'tasks[].due_at < วันนี้'],
    scopeNote: () => MockTasks.all().length + ' งานทั้งระบบ (ไม่ตามตัวกรองกองทุน)' },

{   page: 'claim-dashboard', key: 'reject', icon: 'undo-2', label: 'มูลค่าถูกตัดจ่าย (บาท)',
    source: 'claims',
    pick: base => base.filter(c => (c.amount_rejected || 0) > 0)
                      .sort((a, b) => b.amount_rejected - a.amount_rejected),
    value: rows => MockFmt.baht(rows.reduce((a, c) => a + (c.amount_rejected || 0), 0)),
    cols: [
        MockKpi.COL.claimId, MockKpi.COL.patient, MockKpi.COL.fund,
        { h: 'รหัสที่ถูกตีกลับ', html: c => MockClaims.predictedCodes(c)
            .map(k => `<span class="sip-chip sip-chip-danger">${MockEsc(k)}</span>`).join(' ')
            || '<span class="td-sub">—</span>' },
        { h: 'ถูกตัดจ่าย (บาท)', align: 'r', get: c => MockFmt.baht(c.amount_rejected) },
    ],
    totalOf: c => c.amount_rejected || 0,
    totalLabel: 'รวมมูลค่าที่ถูกตัดจ่าย',
    rowHref: c => `claim-case.html?id=${encodeURIComponent(c.id)}`,
    drill:   ctx => 'claim-worklist.html?kpi=reject' + MockKpi._fund(ctx),
    how: 'ผลรวมของยอดที่ สปสช. ตัดจ่ายจริงหลังการ Audit',
    fields: ['Σ claims[].amount_rejected'] },

/* ────────── claim-dashboard · ฝั่งผู้ป่วยใน ──────────
   ตัวเลขสองตัวนี้ต้องตรงกับ ipd-worklist และ ipd-audit เป๊ะ
   value() เรียก MockIpd.stats() ตัวเดิม — pick() แค่คืนแถวชุดเดียวกันที่ stats() นับ */

{   page: 'claim-dashboard', key: 'ipdFiles', icon: 'folder-x', critical: true,
    label: 'แฟ้มผู้ป่วยในไม่ครบ',
    source: 'stays', global: true,
    pick: base => base.filter(s => !MockIpd.statusOf(s.status).open)
                      .filter(s => { const f = MockIpd.fileCheck(s); return f.nhso && f.missing.length; }),
    value: () => MockFmt.int(MockIpd.stats().filesShort),
    cols: [
        { h: 'AN', nowrap: true, get: s => s.an, sub: s => 'HN ' + s.hn },
        { h: 'ผู้ป่วย', get: s => s.patient },
        { h: 'กองทุน', get: s => (MockIpd.fund(s.fund) || {}).short || s.fund },
        { h: 'สถานะ', get: s => MockIpd.statusOf(s.status).label },
        { h: 'แฟ้มที่ยังขาด', get: s => MockNhso.fileNames(MockIpd.fileCheck(s).missing) },
    ],
    rowHref: s => `ipd-audit.html?an=${encodeURIComponent(s.an)}`,
    drill:   () => 'ipd-worklist.html?kpi=ipdFiles',
    how: 'นับเคสผู้ป่วยในที่จำหน่ายแล้วและยังส่งแฟ้มไม่ครบตามที่กองทุนนั้นบังคับ — '
       + 'เคสที่ยังนอนอยู่ไม่นับ เพราะยังไม่ถึงกำหนดส่งแฟ้ม',
    fields: ['ipd_stays[].status = จำหน่ายแล้ว / ส่งต่อออก / เสียชีวิต',
             'MockIpd.fileCheck(stay).missing.length > 0'],
    scopeNote: () => MockIpd.all().length + ' AN (ไม่ตามตัวกรองกองทุน)' },

{   page: 'claim-dashboard', key: 'ipdVar', icon: 'scale',
    label: 'ส่วนต่างจากประมาณการ DRG (บาท)',
    source: 'stays', global: true,
    unverified: window.IPD_UNVERIFIED_NOTE,     /* ⚠️ ต้องโหลดหลัง mock-ipd.js ไม่งั้น * หายเงียบ */
    pick: base => base.filter(s => MockIpd.variance(s) != null)
                      .sort((a, b) => MockIpd.variance(b) - MockIpd.variance(a)),
    value: () => MockFmt.baht(MockIpd.stats().variance),
    /* กองทุนที่ไม่จ่ายตาม DRG ให้ estimate() = null → ไม่มีส่วนต่างให้คิด
       ต้องบอกว่าตัดออกกี่ AN ไม่งั้นผู้อ่านจะนึกว่าตารางแสดงไม่ครบ */
    subline: rows => {
        const skip = MockIpd.all().length - rows.length;
        return skip > 0
            ? `คิดจาก ${MockFmt.int(rows.length)} AN — ไม่รวม ${MockFmt.int(skip)} AN `
            + 'ที่กองทุนไม่จ่ายตาม DRG จึงไม่มีประมาณการรับให้เทียบ'
            : `คิดจาก ${MockFmt.int(rows.length)} AN ทั้งหมด`;
    },
    cols: [
        { h: 'AN', nowrap: true, get: s => s.an, sub: s => 'HN ' + s.hn },
        { h: 'ผู้ป่วย', get: s => s.patient },
        { h: 'กองทุน', get: s => (MockIpd.fund(s.fund) || {}).short || s.fund },
        { h: 'ค่าใช้จ่ายจริง', align: 'r', get: s => MockFmt.baht(MockIpd.cost(s)) },
        { h: 'ประมาณการรับ', align: 'r', get: s => MockFmt.baht(MockIpd.estimate(s)) },
        { h: 'ส่วนต่าง (บาท)', align: 'r', get: s => MockFmt.baht(MockIpd.variance(s)) },
    ],
    totalOf: s => MockIpd.variance(s) || 0,
    totalLabel: 'รวมส่วนต่างจากประมาณการ DRG',
    rowHref: s => `ipd-audit.html?an=${encodeURIComponent(s.an)}`,
    drill:   () => 'ipd-worklist.html?kpi=ipdVar',
    how: 'ผลรวมของ (ค่าใช้จ่ายจริง − ประมาณการรับตาม DRG) ทุก AN — '
       + 'ค่าบวกแปลว่าโรงพยาบาลรับภาระส่วนเกิน',
    fields: ['Σ MockIpd.cost(stay)',
             '− Σ MockIpd.estimate(stay)  = AdjRW × อัตราจ่ายต่อ RW ของกองทุน'],
    scopeNote: () => MockIpd.all().length + ' AN (ไม่ตามตัวกรองกองทุน)' },

/* ────────── claim-dashboard · ฝั่งส่งต่อผู้ป่วย ──────────
   ตัวเลขสองตัวนี้ต้องตรงกับ refer-dashboard และ refer-billing เป๊ะ */

{   page: 'claim-dashboard', key: 'referAp', icon: 'ambulance', critical: true,
    label: 'ยอดตามจ่ายส่งต่อค้าง (บาท)',
    source: 'bills', global: true,
    pick: base => base.filter(b => b.direction === 'OUT' && MockRefer.billOutstand(b) > 0)
                      .sort((a, b) => MockRefer.billOutstand(b) - MockRefer.billOutstand(a)),
    value: () => MockFmt.baht(MockRefer.netPosition().ap),
    cols: MockKpiBillCols(),
    totalOf: b => MockRefer.billOutstand(b),
    totalLabel: 'รวมยอดคงค้างที่เราต้องตามจ่าย',
    rowHref: b => `refer-billing.html?bill=${encodeURIComponent(b.id)}`,
    drill:   () => 'refer-billing.html?kpi=referAp',
    how: 'ผลรวมยอดคงค้างของใบเรียกเก็บที่ปลายทางส่งมาให้เราตามจ่าย (ยอดใบ − จ่ายแล้ว − โต้แย้ง)',
    fields: ['Σ refer_bills[direction="OUT"].items[].amount',
             '− Σ refer_bills[].paid_amount', '− Σ refer_bills[].disputed_amount'],
    scopeNote: () => MockRefer.out().length + ' รายการส่งต่อออก (ไม่ตามตัวกรองกองทุน)' },

{   page: 'claim-dashboard', key: 'referDoc', icon: 'file-warning', label: 'ใบส่งตัวที่มีปัญหา',
    source: 'referrals', global: true,
    pick: () => MockRefer.openRisks().slice()
                    .sort((a, b) => MockRefer.amountAtRisk(b) - MockRefer.amountAtRisk(a)),
    value: rows => MockFmt.int(rows.length),
    cols: MockKpiReferCols(),
    rowHref: r => `refer-case.html?id=${encodeURIComponent(r.id)}`,
    drill:   () => 'refer-worklist.html?kpi=referDoc',
    how: 'นับรายการส่งต่อที่ยังมีธงระดับ ERROR ค้าง (หมดอายุ · เกินขอบเขต · ไม่มีเลขอนุมัติ · เกินวงเงิน · ซ้ำซ้อน)',
    fields: ['referrals[].risk_flags[].level === "ERROR"'],
    scopeNote: () => MockRefer.all().length + ' รายการส่งต่อ (ไม่ตามตัวกรองกองทุน)' },


/* ────────── refer-dashboard · ภาพรวมการส่งต่อ ────────── */

{   page: 'refer-dashboard', key: 'total', icon: 'inbox', label: 'รายการส่งต่อในงวด',
    source: 'referrals',
    pick: base => base.slice(),
    value: rows => MockFmt.int(rows.length),
    cols: MockKpiReferCols(true),
    rowHref: r => `refer-case.html?id=${encodeURIComponent(r.id)}`,
    drill:   ctx => 'refer-worklist.html?kpi=total' + MockKpi._fund(ctx) + MockKpi._dir(ctx),
    how: 'นับรายการส่งต่อทั้งหมดในขอบเขตที่กรองอยู่',
    fields: ['referrals[] ตามทิศทางและกองทุนที่เลือก'] },

{   page: 'refer-dashboard', key: 'out', icon: 'log-out', label: 'ส่งต่อออก (เราตามจ่าย)',
    source: 'referrals',
    pick: base => base.filter(r => r.direction === 'OUT'),
    value: rows => MockFmt.int(rows.length),
    cols: MockKpiReferCols(true),
    rowHref: r => `refer-case.html?id=${encodeURIComponent(r.id)}`,
    drill:   ctx => 'refer-worklist.html?kpi=out' + MockKpi._fund(ctx),
    how: 'นับรายการที่เราเป็นต้นสังกัดและส่งผู้ป่วยออกไปรักษาที่อื่น',
    fields: ['referrals[].direction === "OUT"'] },

{   page: 'refer-dashboard', key: 'in', icon: 'log-in', label: 'รับส่งต่อเข้า (เราเรียกเก็บ)',
    source: 'referrals',
    pick: base => base.filter(r => r.direction === 'IN'),
    value: rows => MockFmt.int(rows.length),
    cols: MockKpiReferCols(true),
    rowHref: r => `refer-case.html?id=${encodeURIComponent(r.id)}`,
    drill:   ctx => 'refer-worklist.html?kpi=in' + MockKpi._fund(ctx),
    how: 'นับรายการที่หน่วยบริการอื่นส่งผู้ป่วยมารักษาที่เรา',
    fields: ['referrals[].direction === "IN"'] },

{   page: 'refer-dashboard', key: 'ap', icon: 'arrow-up-from-line', critical: true,
    label: 'ยอดตามจ่ายค้าง (บาท)',
    source: 'bills', global: true,
    pick: base => base.filter(b => b.direction === 'OUT' && MockRefer.billOutstand(b) > 0)
                      .sort((a, b) => MockRefer.billOutstand(b) - MockRefer.billOutstand(a)),
    value: () => MockFmt.baht(MockRefer.netPosition().ap),
    cols: MockKpiBillCols(),
    totalOf: b => MockRefer.billOutstand(b),
    totalLabel: 'รวมยอดคงค้างที่เราต้องตามจ่าย',
    rowHref: b => `refer-billing.html?bill=${encodeURIComponent(b.id)}`,
    drill:   () => 'refer-billing.html?kpi=ap',
    how: 'ผลรวมยอดคงค้างของใบเรียกเก็บที่ปลายทางส่งมา (ยอดใบ − จ่ายแล้ว − โต้แย้ง)',
    fields: ['Σ refer_bills[direction="OUT"].items[].amount',
             '− Σ refer_bills[].paid_amount', '− Σ refer_bills[].disputed_amount'],
    scopeNote: () => MockRefer.billsByDir('OUT').length + ' ใบเรียกเก็บ (ทั้งระบบ ไม่ตามตัวกรอง)' },

{   page: 'refer-dashboard', key: 'ar', icon: 'arrow-down-to-line',
    label: 'ยอดเรียกเก็บค้าง (บาท)',
    source: 'bills', global: true,
    pick: base => base.filter(b => b.direction === 'IN' && MockRefer.billOutstand(b) > 0)
                      .sort((a, b) => MockRefer.billOutstand(b) - MockRefer.billOutstand(a)),
    value: () => MockFmt.baht(MockRefer.netPosition().ar),
    cols: MockKpiBillCols(),
    totalOf: b => MockRefer.billOutstand(b),
    totalLabel: 'รวมยอดคงค้างที่เรารอรับชำระ',
    rowHref: b => `refer-billing.html?bill=${encodeURIComponent(b.id)}`,
    drill:   () => 'refer-billing.html?kpi=ar',
    how: 'ผลรวมยอดคงค้างของใบที่เราออกไปเรียกเก็บต้นทาง/สปสช.',
    fields: ['Σ refer_bills[direction="IN"].items[].amount', '− paid − disputed'],
    scopeNote: () => MockRefer.billsByDir('IN').length + ' ใบเรียกเก็บ (ทั้งระบบ ไม่ตามตัวกรอง)' },

{   page: 'refer-dashboard', key: 'net', icon: 'scale', label: 'สถานะสุทธิ AR − AP (บาท)',
    source: 'bills', global: true,
    /* ใบที่ยังค้างทั้งสองทิศทาง — ฝั่ง AP ลงเครื่องหมายลบ ผลรวมจึงเท่ากับ net พอดี */
    pick: base => base.filter(b => MockRefer.billOutstand(b) > 0)
                      .sort((a, b) => MockRefer.billOutstand(b) - MockRefer.billOutstand(a)),
    value: () => MockFmt.baht(MockRefer.netPosition().net),
    subline: () => {
        const np = MockRefer.netPosition();
        return `ยอดที่เราพึงรับ ${MockFmt.baht(np.ar)} บาท − ยอดที่เราพึงจ่าย ${MockFmt.baht(np.ap)} บาท`;
    },
    cols: [
        { h: 'เลขที่ใบ', nowrap: true, get: b => b.bill_no, sub: b => b.id },
        { h: 'ทิศทาง', html: b => b.direction === 'IN'
            ? '<span class="sip-chip sip-chip-success">เรียกเก็บ (AR)</span>'
            : '<span class="sip-chip sip-chip-danger">ตามจ่าย (AP)</span>' },
        { h: 'คู่สัญญา', get: b => MockKpiPartner(b) },
        { h: 'คงค้าง (บาท)', align: 'r',
          get: b => MockFmt.baht((b.direction === 'IN' ? 1 : -1) * MockRefer.billOutstand(b)) },
    ],
    totalOf: b => (b.direction === 'IN' ? 1 : -1) * MockRefer.billOutstand(b),
    totalLabel: 'สถานะสุทธิ (AR − AP)',
    rowHref: b => `refer-billing.html?bill=${encodeURIComponent(b.id)}`,
    drill:   () => 'refer-billing.html',
    how: 'ยอดที่เราพึงรับ ลบ ยอดที่เราพึงจ่าย — ติดลบแปลว่าเราเป็นลูกหนี้สุทธิ',
    fields: ['netPosition().ar − netPosition().ap'],
    scopeNote: () => 'ทั้งระบบ ไม่ตามตัวกรอง' },

{   page: 'refer-dashboard', key: 'flag', icon: 'file-warning', critical: true,
    label: 'ใบส่งตัวที่มีปัญหา',
    source: 'referrals', global: true,
    pick: () => MockRefer.openRisks().slice()
                    .sort((a, b) => MockRefer.amountAtRisk(b) - MockRefer.amountAtRisk(a)),
    value: rows => MockFmt.int(rows.length),
    cols: MockKpiReferCols(),
    rowHref: r => `refer-case.html?id=${encodeURIComponent(r.id)}`,
    drill:   () => 'refer-worklist.html?kpi=flag',
    how: 'นับรายการที่ยังมีธงระดับ ERROR ค้าง (หมดอายุ · เกินขอบเขต · ไม่มีเลขอนุมัติ · เกินวงเงิน · ซ้ำซ้อน)',
    fields: ['referrals[].risk_flags[].level === "ERROR"'],
    scopeNote: () => 'ทั้งระบบ ไม่ตามตัวกรอง' },

{   page: 'refer-dashboard', key: 'rate', icon: 'shield-check', label: 'อัตราใบส่งตัวสมบูรณ์',
    source: 'referrals', global: true,
    /* ตัวหารคือรายการทั้งหมด — เรียงให้รายการที่มีธง ERROR (ตัวที่ฉุดอัตราลง) ขึ้นก่อน */
    pick: () => MockRefer.all().slice()
                    .sort((a, b) => (MockRefer.hasError(a) ? 0 : 1) - (MockRefer.hasError(b) ? 0 : 1)),
    value: () => MockFmt.pct(MockRefer.docCompletionRate(), 1),
    subline: rows => {
        const clean = rows.filter(r => !MockRefer.hasError(r)).length;
        return `สมบูรณ์ ${MockFmt.int(clean)} จาก ${MockFmt.int(rows.length)} รายการส่งต่อ`;
    },
    cols: MockKpiReferCols(),
    rowHref: r => `refer-case.html?id=${encodeURIComponent(r.id)}`,
    drill:   () => 'refer-worklist.html?kpi=rate',
    how: '(รายการทั้งหมด − รายการที่มีธง ERROR) ÷ รายการทั้งหมด × 100',
    fields: ['referrals[].length (ตัวหาร)', 'openRisks().length (ตัวลบ)'],
    scopeNote: () => 'ทั้งระบบ ไม่ตามตัวกรอง' },

];


/* ══════════════════════════════════════════════════════════
   5. ตัวช่วยที่นิยามข้างบนเรียกใช้
      ประกาศเป็น function declaration จึงถูก hoist ขึ้นไปก่อน DEFS ถูกสร้าง
   ══════════════════════════════════════════════════════════ */

/** ชื่อคู่สัญญาของใบเรียกเก็บ — ต้องวิ่งผ่านรายการส่งต่อที่ใบนั้นผูกอยู่ */
function MockKpiPartner(b) {
    const r = MockRefer.byId(b.refer_id);
    return r ? r.partner_name : '—';
}

/** คอลัมน์มาตรฐานของ "ใบเรียกเก็บ" */
function MockKpiBillCols() {
    return [
        { h: 'เลขที่ใบ', nowrap: true, get: b => b.bill_no, sub: b => b.id },
        { h: 'คู่สัญญา', get: b => MockKpiPartner(b) },
        { h: 'ยอดใบ', align: 'r', get: b => MockFmt.baht(MockRefer.billTotal(b)) },
        { h: 'จ่าย/รับแล้ว', align: 'r', get: b => MockFmt.baht(b.paid_amount || 0) },
        { h: 'โต้แย้ง', align: 'r', get: b => MockFmt.baht(b.disputed_amount || 0) },
        { h: 'คงค้าง (บาท)', align: 'r', get: b => MockFmt.baht(MockRefer.billOutstand(b)) },
        { h: 'สถานะ', html: b => MockRefer.billStatusHtml(b) },
    ];
}

/** คอลัมน์มาตรฐานของ "รายการส่งต่อ" · withStatus = โชว์สถานะแทนธง ERROR */
function MockKpiReferCols(withStatus) {
    return [
        { h: 'เลขที่', nowrap: true, get: r => r.id, sub: r => 'HN ' + r.hn },
        { h: 'ผู้ป่วย', get: r => r.patient },
        { h: 'ปลายทาง / ต้นทาง', get: r => r.partner_name },
        withStatus
            ? { h: 'สถานะ', html: r => MockRefer.statusHtml(r) }
            : { h: 'ธงที่ค้าง', html: r => MockRefer.errorFlags(r)
                  .map(f => `<span class="sip-chip sip-chip-danger">${MockEsc(f.label)}</span>`).join(' ')
                  || '<span class="td-sub">—</span>' },
        { h: 'มูลค่าเสี่ยง (บาท)', align: 'r', get: r => MockFmt.baht(MockRefer.amountAtRisk(r)) },
    ];
}

/* ตัวกรองของหน้า Dashboard ต้องเดินทางไปกับ URL ไม่งั้นหน้าปลายทางคำนวณชุด id ได้ไม่เท่ากัน */
MockKpi._fund = function (ctx) {
    const f = ctx && ctx.fund;
    return f && f !== 'all' ? '&fund=' + encodeURIComponent(f) : '';
};
MockKpi._dir = function (ctx) {
    const d = ctx && ctx.dir;
    return d && d !== 'all' ? '&dir=' + encodeURIComponent(d) : '';
};

window.MockKpi = MockKpi;
