/* ────────────────────────────────────────────────────────
   ทะเบียนลูกหนี้ค่ารักษาพยาบาลรายบุคคล

   ยอดทุกตัวบนหน้านี้มาจาก FinData ตัวเดียว (API จริง หรือ MockAR)
   การ์ด KPI · ถังอายุหนี้ · ตาราง · สรุปรายกองทุน · ใบพิมพ์ จึงกระทบยอดกันเสมอ

   ⚠️ PAGE-GUIDE §7B — ห้าม hardcode ตัวเลขที่คำนวณได้
      ทุกยอดบนการ์ดต้องเป็นผลบวกของแถวที่อยู่ใต้การ์ดในตัวกรองชุดเดียวกัน

   นิยามยอด (ต้องตรงกับ finance.sql และ MockAR._derive() ทั้งสามที่):
      billed_adj   = พึงรับตั้งต้น + ปรับเพิ่ม − ปรับลด
      net_received = รับจริง − เรียกคืน
      outstanding  = billed_adj − net_received − ตัดจำหน่าย
   ──────────────────────────────────────────────────────── */

const FinAR = {

    state: {
        period: 'all', payer: 'all', fund: 'all', service_type: 'all',
        status: 'all', aging: 'all', search: '', only_open: false,
    },

    /** เพดานแถวต่อการโหลด — เกินกว่านี้ต้องบอกผู้ใช้ ห้ามตัดเงียบ ๆ */
    LIMIT: 500,

    rows: [], sum: null,

    KPI: [
        { key: 'billed',       icon: 'file-plus',    label: 'ยอดพึงรับ (ตั้งเบิก)' },
        { key: 'net_received', icon: 'banknote',     label: 'รับแล้วสุทธิ' },
        { key: 'writeoff',     icon: 'eraser',       label: 'ตัดจำหน่าย' },
        { key: 'outstanding',  icon: 'alert-circle', label: 'คงค้าง', critical: true },
    ],

    /* ══════════ วงจรชีวิต ══════════ */

    async init() {
        MockSession.mountBanner('demoBanner');
        await FinData.probe();
        this.fillFilters();
        this.renderSource();
        await this.reload();
    },

    /** ตัวกรองงวด/สิทธิ — สร้างจาก AR_PERIODS ไม่พิมพ์ทิ้งไว้ใน HTML */
    fillFilters() {
        document.getElementById('fPeriod').innerHTML =
            '<option value="all">ทุกงวด</option>'
            + AR_PERIODS.map(p => `<option value="${esc(p.key)}">งวด ${esc(p.label)}</option>`).join('');

        document.getElementById('fPayer').innerHTML =
            '<option value="all">ทุกสิทธิ</option>'
            + Object.entries(AR_PAYER_LABEL)
                .map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('');

        document.getElementById('filterRow').innerHTML = `
            <select class="sip-select" id="fFund" style="width:230px" onchange="FinAR.reload()">
                <option value="all">ทุกกองทุน</option>
                ${Object.entries(AR_FUND_LABEL).map(([k, v]) =>
                    `<option value="${esc(k)}">${esc(v)}</option>`).join('')}
            </select>
            <select class="sip-select" id="fType" style="width:150px" onchange="FinAR.reload()">
                <option value="all">ทุกประเภท</option>
                <option value="IPD">ผู้ป่วยใน</option>
                <option value="OPD">ผู้ป่วยนอก</option>
            </select>
            <input class="sip-input" id="fSearch" style="width:250px"
                   placeholder="ค้นหา เลขเคส / ชื่อผู้ป่วย / HN"
                   oninput="FinAR.searchLater()">
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
                <input type="checkbox" class="sip-checkbox" id="fOpen" onchange="FinAR.reload()">
                <span>เฉพาะที่ยังค้าง</span>
            </label>`;
    },

    /** หน่วงการค้นหา — ไม่ยิง API ทุกตัวอักษร */
    searchLater() {
        clearTimeout(this._t);
        this._t = setTimeout(() => this.reload(), 300);
    },

    _readFilters() {
        const v = id => (document.getElementById(id) || {}).value;
        this.state.period       = v('fPeriod') || 'all';
        this.state.payer        = v('fPayer')  || 'all';
        this.state.fund         = v('fFund')   || 'all';
        this.state.service_type = v('fType')   || 'all';
        this.state.search       = (v('fSearch') || '').trim();
        this.state.only_open    = !!(document.getElementById('fOpen') || {}).checked;
    },

    /** ตัวกรองที่ใช้กับ /summary — ไม่รวมสถานะ/อายุหนี้ เพราะการ์ดต้องพูดถึงทั้งชุดที่เลือก */
    _scopeQuery() {
        const s = this.state;
        return { period: s.period, payer: s.payer, fund: s.fund,
                 service_type: s.service_type, search: s.search };
    },

    async reload() {
        this._readFilters();
        const q = this._scopeQuery();

        const [sum, rows] = await Promise.all([
            FinData.summary(q),
            FinData.list({ ...q, status: this.state.status, aging: this.state.aging,
                           only_open: this.state.only_open ? '1' : '', limit: this.LIMIT }),
        ]);

        this.sum = sum;
        this.rows = rows;

        this.renderAsOf();
        this.renderKpi();
        this.renderAging();
        this.renderStatusSeg();
        this.renderTable();
        this.renderFundTable();
        refreshIcons();
    },

    /* ══════════ ส่วนหัว ══════════ */

    renderAsOf() {
        const p = this.state.period === 'all'
            ? 'ทุกงวด' : 'งวด ' + (AR_PERIODS.find(x => x.key === this.state.period) || {}).label;
        const payer = this.state.payer === 'all' ? 'ทุกสิทธิ' : AR_PAYER_LABEL[this.state.payer];
        document.getElementById('asOf').textContent =
            `${p} · ${payer} · อายุหนี้นับถึง ${MockFmt.dateTH(this._todayBE())}`;
    },

    /** วันนี้แบบ พ.ศ. — โหมดต้นแบบยึด MockDB.TODAY ให้ตรงกับตัวเลขที่ generate ไว้ */
    _todayBE() {
        const d = FinData.live ? new Date() : MockDB.TODAY;
        const p2 = n => String(n).padStart(2, '0');
        return `${d.getFullYear() + 543}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    },

    renderSource() {
        document.getElementById('sourceNote').innerHTML = FinData.live
            ? `<div class="sip-mock-note" style="border-color:var(--status-success-border);
                    background:var(--status-success-bg)">
                 <span class="sip-mock-tag" style="background:var(--status-success-strong)">ข้อมูลจริง</span>
                 <span>ยอดทั้งหน้าอ่านจากตารางลูกหนี้ในฐานข้อมูล (/api/finance) —
                       บันทึกรับและตัดยอดมีผลจริง</span>
               </div>`
            : `<div class="sip-mock-note">
                 <span class="sip-mock-tag">MOCKUP</span>
                 <span>โหมดต้นแบบ — ตัวเลขทั้งหน้าเป็นข้อมูลสมมติเพื่อสาธิตรูปแบบการทำงาน
                       ไม่ใช่ยอดจริงของโรงพยาบาล และบันทึกจริงไม่ได้
                       (เข้าสู่ระบบเมื่อมีเซิร์ฟเวอร์เพื่อใช้ข้อมูลจริง)</span>
               </div>`;
    },

    /* ══════════ KPI ══════════ */

    renderKpi() {
        const t = this.sum.total;
        const pct = v => t.billed ? MockFmt.pct((v / t.billed) * 100) : '—';

        const sub = k =>
              k === 'billed'       ? MockFmt.int(t.cases) + ' ราย'
            : k === 'net_received' ? pct(t.net_received) + ' ของยอดพึงรับ'
                                     + (t.clawback ? ` · หักเรียกคืน ${MockFmt.baht(t.clawback)}` : '')
            : k === 'writeoff'     ? (t.writeoff ? pct(t.writeoff) + ' ของยอดพึงรับ' : 'ไม่มี')
            : pct(t.outstanding) + ' · ' + MockFmt.int(t.open_cases) + ' ราย';

        document.getElementById('kpiWrap').innerHTML =
            `<div class="ds-kpi-grid">${this.KPI.map(m => {
                const danger = m.critical && t.outstanding > 0;
                return `<div class="sip-kpi${danger ? ' critical' : ''}" style="cursor:default">
                    <i data-lucide="${esc(m.icon)}" class="sip-kpi-icon icon-md"></i>
                    <div class="sip-kpi-value">${esc(MockFmt.baht(t[m.key], { short: true }))}</div>
                    <div class="sip-kpi-label">${esc(m.label)}</div>
                    <div class="ds-hint" style="margin-top:2px">${esc(sub(m.key))}</div>
                </div>`;
            }).join('')}</div>`;
    },

    /* ══════════ อายุหนี้ ══════════ */

    renderAging() {
        const tone = { ok: 'var(--status-success-strong)', warn: 'var(--status-warning-strong)',
                       bad: 'var(--status-danger-strong)' };

        const tiles = AR_AGING_META.map(m => {
            const b = this.sum.aging.find(x => x.bucket === m.key) || { cases: 0, amount: 0 };
            const on = this.state.aging === m.key;
            return `<button class="sip-kpi${on ? ' critical' : ''}"
                        style="flex:1;min-width:150px;text-align:left;border-color:${on ? tone[m.tone] : ''}"
                        onclick="FinAR.setAging('${esc(m.key)}')">
                <div class="sip-kpi-value" style="color:${tone[m.tone]}">
                    ${esc(MockFmt.baht(b.amount, { short: true }))}</div>
                <div class="sip-kpi-label">${esc(m.label)}</div>
                <div class="ds-hint" style="margin-top:2px">${esc(MockFmt.int(b.cases))} ราย</div>
            </button>`;
        }).join('');

        const clear = this.state.aging === 'all' ? '' :
            `<button class="btn btn-outline btn-sm" style="margin-top:10px"
                     onclick="FinAR.setAging('all')">
                <i data-lucide="x" class="icon-sm"></i> ล้างตัวกรองอายุหนี้</button>`;

        document.getElementById('agingWrap').innerHTML =
            `<div style="display:flex;gap:10px;flex-wrap:wrap">${tiles}</div>${clear}`;
    },

    setAging(k) {
        this.state.aging = (this.state.aging === k) ? 'all' : k;
        this.reload();
    },

    /* ══════════ แถบสถานะ ══════════ */

    renderStatusSeg() {
        const counts = Object.fromEntries((this.sum.by_status || [])
            .map(s => [s.ar_status, Number(s.cases)]));
        const all = Object.values(counts).reduce((a, b) => a + b, 0);

        const btn = (key, label, n) =>
            `<button class="ds-seg${this.state.status === key ? ' active' : ''}"
                     onclick="FinAR.setStatus('${esc(key)}')">
                ${esc(label)} <span class="ds-hint">(${esc(MockFmt.int(n))})</span></button>`;

        document.getElementById('segStatus').innerHTML =
            btn('all', 'ทั้งหมด', all)
            + Object.entries(AR_STATUS_META)
                .map(([k, m]) => btn(k, m.label, counts[k] || 0)).join('');
    },

    setStatus(k) { this.state.status = k; this.reload(); },

    /* ══════════ ตาราง ══════════ */

    _statusBadge(r) {
        const m = AR_STATUS_META[r.ar_status] || { label: r.ar_status, badge: 'kbadge-draft' };
        return `<span class="kbadge ${esc(m.badge)}">${esc(m.label)}</span>`;
    },

    /** อายุหนี้ — เน้นสีเฉพาะที่เลยกำหนดจริง ไม่ใส่สีทุกแถวจนตาลาย */
    _ageCell(r) {
        if (r.outstanding <= 0) return '<span class="td-sub">—</span>';
        const color = r.age_days > 90 ? 'var(--status-danger-strong)'
                    : r.age_days > 60 ? 'var(--status-warning-strong)' : '';
        return `<span${color ? ` style="color:${color};font-weight:600"` : ''}>`
             + `${esc(MockFmt.int(r.age_days))} วัน</span>`;
    },

    renderTable() {
        const head = `<thead><tr>
            <th style="min-width:130px">เลขเคส</th>
            <th style="min-width:170px">ผู้ป่วย</th>
            <th style="width:90px">HN</th>
            <th style="width:100px">วันรับบริการ</th>
            <th style="min-width:170px">กองทุน</th>
            <th style="width:70px">งวด</th>
            <th class="num" style="width:105px">พึงรับ</th>
            <th class="num" style="width:105px">รับแล้วสุทธิ</th>
            <th class="num" style="width:105px">คงค้าง</th>
            <th style="width:80px">อายุหนี้</th>
            <th style="width:120px">สถานะ</th>
        </tr></thead>`;

        if (!this.rows.length) {
            document.getElementById('arTable').innerHTML = head
                + `<tbody><tr><td colspan="11" class="c" style="padding:26px">
                     <span class="td-sub">ไม่มีลูกหนี้ที่ตรงกับตัวกรองนี้</span></td></tr></tbody>`;
            document.getElementById('rowNote').textContent = 'ไม่พบรายการ';
            return;
        }

        const body = this.rows.map(r => `
            <tr style="cursor:pointer" onclick="FinAR.openCase(${esc(r.ar_item_id)})">
                <td class="l"><b>${esc(r.case_ref)}</b></td>
                <td class="l">${esc(r.patient_name || '—')}</td>
                <td class="l">${esc(r.hn || '—')}</td>
                <td class="c">${esc(r.service_date ? MockFmt.dateTH(r.service_date) : '—')}</td>
                <td class="l">${esc(AR_FUND_LABEL[r.fund_key] || r.fund_key)}</td>
                <td class="c">${esc(r.period_key)}</td>
                <td class="num"><span class="ds-amt ds-amt-billed">${esc(MockFmt.baht(r.billed_adj))}</span></td>
                <td class="num">${r.net_received
                    ? `<span class="ds-amt ds-amt-comp">${esc(MockFmt.baht(r.net_received))}</span>`
                    : '<span class="td-sub">—</span>'}</td>
                <td class="num">${r.outstanding
                    ? `<span class="ds-amt" style="color:var(--status-warning-strong)">
                         ${esc(MockFmt.baht(r.outstanding))}</span>`
                    : '<span class="td-sub">—</span>'}</td>
                <td class="c">${this._ageCell(r)}</td>
                <td class="c">${this._statusBadge(r)}</td>
            </tr>`).join('');

        /* แถวรวมของ "สิ่งที่เห็นอยู่ตรงนี้" — คนละชุดกับการ์ด KPI เมื่อกรองสถานะอยู่
           จึงต้องเขียนกำกับให้ชัด ไม่ปล่อยให้เข้าใจว่าเป็นยอดรวมทั้งหมด */
        const t = this.rows.reduce((a, r) => ({
            billed: a.billed + r.billed_adj,
            recv:   a.recv + r.net_received,
            out:    a.out + r.outstanding,
        }), { billed: 0, recv: 0, out: 0 });

        const total = `<tr class="ds-row-total">
            <td colspan="6" class="c">รวมเฉพาะที่แสดง ${MockFmt.int(this.rows.length)} ราย</td>
            <td class="num">${esc(MockFmt.baht(t.billed))}</td>
            <td class="num">${esc(MockFmt.baht(t.recv))}</td>
            <td class="num">${esc(MockFmt.baht(t.out))}</td>
            <td colspan="2"></td>
        </tr>`;

        document.getElementById('arTable').innerHTML = head + `<tbody>${body}${total}</tbody>`;

        // ชนเพดานต้องบอกตรง ๆ — ห้ามตัดแถวเงียบ ๆ แล้วให้ผู้ใช้เข้าใจว่าเห็นครบ
        const capped = this.rows.length >= this.LIMIT;
        document.getElementById('rowNote').innerHTML = capped
            ? `<span style="color:var(--status-warning-strong)">แสดง ${MockFmt.int(this.LIMIT)}
                 รายการแรกเท่านั้น — กรองงวดหรือกองทุนให้แคบลงเพื่อดูครบ</span>`
            : `แสดง ${MockFmt.int(this.rows.length)} ราย จากทั้งหมด
               ${MockFmt.int(this.sum.total.cases)} รายในตัวกรองนี้`;
    },

    /* ══════════ สรุปรายกองทุน ══════════ */

    renderFundTable() {
        const rows = this.sum.by_fund || [];
        const head = `<thead><tr>
            <th style="min-width:230px">กองทุน</th>
            <th style="width:130px">สิทธิ</th>
            <th class="num" style="width:80px">ราย</th>
            <th class="num" style="width:120px">พึงรับ</th>
            <th class="num" style="width:120px">รับแล้วสุทธิ</th>
            <th class="num" style="width:120px">คงค้าง</th>
            <th class="num" style="width:90px">% ที่ได้รับ</th>
        </tr></thead>`;

        const body = rows.map(f => {
            const pct = f.billed ? (f.net_received / f.billed) * 100 : 0;
            return `<tr>
                <td class="l">${esc(AR_FUND_LABEL[f.fund_key] || f.fund_key)}</td>
                <td class="l">${esc(AR_PAYER_LABEL[f.payer] || f.payer)}</td>
                <td class="num">${esc(MockFmt.int(f.cases))}</td>
                <td class="num">${esc(MockFmt.baht(f.billed))}</td>
                <td class="num">${esc(MockFmt.baht(f.net_received))}</td>
                <td class="num">${Number(f.outstanding)
                    ? `<span style="color:var(--status-warning-strong)">${esc(MockFmt.baht(f.outstanding))}</span>`
                    : '<span class="td-sub">—</span>'}</td>
                <td class="num">${esc(MockFmt.pct(pct))}</td>
            </tr>`;
        }).join('');

        const t = this.sum.total;
        const total = `<tr class="ds-row-total">
            <td colspan="2" class="c">รวม</td>
            <td class="num">${esc(MockFmt.int(t.cases))}</td>
            <td class="num">${esc(MockFmt.baht(t.billed))}</td>
            <td class="num">${esc(MockFmt.baht(t.net_received))}</td>
            <td class="num">${esc(MockFmt.baht(t.outstanding))}</td>
            <td class="num">${esc(MockFmt.pct(t.billed ? (t.net_received / t.billed) * 100 : 0))}</td>
        </tr>`;

        document.getElementById('fundTable').innerHTML = head
            + `<tbody>${body || ''}${rows.length ? total : ''}</tbody>`;
    },

    /* ══════════ รายละเอียดรายเคส ══════════ */

    async openCase(id) {
        const c = await FinData.one(id);
        if (!c) { DSToast.error('ไม่พบลูกหนี้รายนี้'); return; }

        const kv = (k, v) => `<div style="display:flex;justify-content:space-between;gap:12px;
            padding:5px 0;border-bottom:1px dashed var(--border-subtle)">
            <span class="ds-hint">${esc(k)}</span><span>${v}</span></div>`;

        const pays = (c.payments || []).length
            ? (c.payments || []).map(p => `<tr>
                <td class="c">${esc(MockFmt.dateTH(p.received_date))}</td>
                <td class="l">${esc(p.subfund || '—')}</td>
                <td class="l"><span class="td-sub">${esc(p.receipt_no)}</span></td>
                <td class="num">${esc(MockFmt.baht(p.paid_amt))}</td>
                <td class="num">${Number(p.clawback_amt)
                    ? `<span style="color:var(--status-danger-strong)">
                         −${esc(MockFmt.baht(p.clawback_amt))}</span>`
                    : '<span class="td-sub">—</span>'}</td>
              </tr>`).join('')
            : `<tr><td colspan="5" class="c" style="padding:16px">
                 <span class="td-sub">ยังไม่มีการรับชำระ</span></td></tr>`;

        const adjs = (c.adjustments || []).map(a => `<tr>
            <td class="c">${esc(MockFmt.dateTH(a.adjust_date))}</td>
            <td class="l">${esc({ WRITE_OFF: 'ตัดจำหน่าย', REDUCE: 'ปรับลด', INCREASE: 'ปรับเพิ่ม' }[a.kind] || a.kind)}</td>
            <td class="num">${esc(MockFmt.baht(a.amount))}</td>
            <td class="l"><span class="td-sub">${esc(a.reason)}</span></td>
        </tr>`).join('');

        const linkIpd = c.admission_id
            ? `<a class="btn btn-outline btn-sm" href="ipd-worklist.html">
                 <i data-lucide="bed" class="icon-sm"></i> ดูเคสผู้ป่วยใน</a>`
            : '';

        Drawer.open({
            title: `ลูกหนี้ ${c.case_ref}`,
            width: '620px',
            contentHtml: `
                <div style="margin-bottom:14px">
                    ${kv('ผู้ป่วย', esc(c.patient_name || '—'))}
                    ${kv('HN', esc(c.hn || '—'))}
                    ${kv('วันรับบริการ', esc(c.service_date ? MockFmt.dateTH(c.service_date) : '—'))}
                    ${kv('ประเภทบริการ', esc(c.service_type === 'IPD' ? 'ผู้ป่วยใน' : c.service_type))}
                    ${kv('กองทุน', esc(AR_FUND_LABEL[c.fund_key] || c.fund_key))}
                    ${kv('สิทธิ', esc(AR_PAYER_LABEL[c.payer] || c.payer))}
                    ${kv('ชุดส่งเบิก', esc(c.batch_no) + ' · งวด ' + esc(c.period_key)
                         + ' · ส่ง ' + esc(MockFmt.dateTH(c.sent_date)))}
                    ${kv('สถานะ', this._statusBadge(c))}
                </div>

                <!-- สมการยอด: แสดงให้เห็นทุกพจน์ ไม่ใช่แค่ตัวเลขสุดท้าย
                     คนตรวจสอบต้องไล่ได้ว่าคงค้างมาจากไหน -->
                <div class="ds-note" style="display:block;margin-bottom:14px">
                    ${kv('ยอดพึงรับตั้งต้น', esc(MockFmt.baht(c.billed_amt)))}
                    ${Number(c.increase_amt) ? kv('ปรับเพิ่ม', '+' + esc(MockFmt.baht(c.increase_amt))) : ''}
                    ${Number(c.reduce_amt) ? kv('ปรับลด', '−' + esc(MockFmt.baht(c.reduce_amt))) : ''}
                    ${kv('รับจริง', esc(MockFmt.baht(c.paid_amt)))}
                    ${Number(c.clawback_amt) ? kv('เรียกคืน', '−' + esc(MockFmt.baht(c.clawback_amt))) : ''}
                    ${Number(c.writeoff_amt) ? kv('ตัดจำหน่าย', '−' + esc(MockFmt.baht(c.writeoff_amt))) : ''}
                    <div style="display:flex;justify-content:space-between;padding-top:8px;font-weight:700">
                        <span>คงค้าง</span>
                        <span style="color:${c.outstanding > 0 ? 'var(--status-warning-strong)' : 'var(--status-success-strong)'}">
                            ${esc(MockFmt.baht(c.outstanding))}</span>
                    </div>
                </div>

                <div class="section-title" style="margin:6px 0"># ประวัติการรับชำระ</div>
                <div class="ds-hint" style="margin-bottom:6px">
                    1 เคสรับได้หลายงวดและหลายกองทุนย่อย — แต่ละบรรทัดคือเงินก้อนหนึ่งที่ตัดเข้าเคสนี้</div>
                <table class="ds-table-grid"><thead><tr>
                    <th style="width:95px">วันเงินเข้า</th><th>กองทุนย่อยที่จ่าย</th>
                    <th style="width:80px">ใบรับ</th>
                    <th class="num" style="width:95px">รับ</th>
                    <th class="num" style="width:95px">เรียกคืน</th>
                </tr></thead><tbody>${pays}</tbody></table>

                ${adjs ? `<div class="section-title" style="margin:14px 0 6px"># การปรับปรุงยอด</div>
                    <table class="ds-table-grid"><thead><tr>
                        <th style="width:95px">วันที่</th><th style="width:100px">ประเภท</th>
                        <th class="num" style="width:95px">จำนวน</th><th>เหตุผล</th>
                    </tr></thead><tbody>${adjs}</tbody></table>` : ''}`,
            footerHtml: `${linkIpd}
                ${c.outstanding > 0 && FinData.live
                    ? `<button class="btn btn-outline btn-sm" onclick="FinAR.askWriteOff(${esc(c.ar_item_id)}, ${esc(c.outstanding)})">
                         <i data-lucide="eraser" class="icon-sm"></i> ตัดจำหน่ายยอดคงค้าง</button>` : ''}
                <button class="btn btn-primary btn-sm" onclick="Drawer.close()">ปิด</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    /**
     * ตัดจำหน่ายหนี้ — ต้องมีเหตุผลเสมอ (API บังคับ) เพราะเป็นการยอมรับว่าเงินก้อนนี้จะไม่ได้แล้ว
     * ทำได้เฉพาะโหมดต่อฐานข้อมูลจริงและสิทธิ์ ADMIN — ถ้าไม่ผ่านให้ API เป็นคนปฏิเสธ
     *
     * ⚠️ ห้ามใช้ prompt()/confirm() ของเบราว์เซอร์ตรงนี้ — ds-drawer.js เขียนเหตุผลไว้ชัด:
     *    ผู้ใช้ติ๊ก "ไม่ต้องแสดงอีก" ได้ แล้วงานสำคัญจะกลายเป็น "ยืนยันเงียบ"
     *    การตัดหนี้ทิ้งคือรายการที่ต้องตรวจสอบย้อนได้ที่สุดในหน้านี้
     */
    askWriteOff(id, amount) {
        Drawer.open({
            title: 'ตัดจำหน่ายยอดคงค้าง',
            width: '520px',
            contentHtml: `
                <div class="ds-warn" style="display:block;margin-bottom:12px">
                    ตัดจำหน่าย = ยอมรับว่าเงินก้อนนี้จะไม่ได้รับแล้ว ยอดคงค้างจะกลายเป็น 0
                    และรายการนี้จะถูกบันทึกใน audit log พร้อมชื่อผู้ทำ
                </div>
                <div class="sip-field">
                    <label class="ds-section-label">ยอดที่จะตัดจำหน่าย</label>
                    <input type="number" step="0.01" class="sip-input" id="woAmount"
                           style="width:100%" value="${esc(amount)}">
                    <div class="ds-hint">ใส่น้อยกว่ายอดคงค้างได้ ถ้าตัดทิ้งบางส่วน</div>
                </div>
                <div class="sip-field">
                    <label class="ds-section-label">เหตุผล (บังคับ)</label>
                    <input class="sip-input" id="woReason" style="width:100%"
                           placeholder="เช่น พ้นกรอบเวลายื่นอุทธรณ์ — ตามมติที่ประชุมการเงิน">
                </div>`,
            footerHtml: `
                <button class="btn btn-outline btn-sm" onclick="Drawer.close()">ยกเลิก</button>
                <button class="btn btn-primary btn-sm" onclick="FinAR.doWriteOff(${esc(id)})">
                    <i data-lucide="eraser" class="icon-sm"></i> ตัดจำหน่าย</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    async doWriteOff(id) {
        const amount = Number(document.getElementById('woAmount').value) || 0;
        const reason = (document.getElementById('woReason').value || '').trim();
        if (amount <= 0) { DSToast.error('ยอดที่ตัดจำหน่ายต้องมากกว่า 0'); return; }
        if (!reason)     { DSToast.error('ต้องระบุเหตุผลของการตัดจำหน่าย'); return; }

        try {
            await FinData.adjust({
                ar_item_id: id, adjust_date: new Date().toISOString().slice(0, 10),
                kind: 'WRITE_OFF', amount, reason,
            });
            DSToast.success('ตัดจำหน่ายเรียบร้อย');
            // ปิดสองชั้น: กล่องตัดจำหน่าย แล้วแผงรายละเอียดเคสที่ค้างอยู่ใน stack
            Drawer.close();
            Drawer.close();
            await this.reload();
        } catch (e) {
            DSToast.error(e.message);
        }
    },

    /* ══════════ ใบพิมพ์ ══════════ */

    buildDoc() {
        const t = this.sum.total;
        const warnings = [];
        if (!FinData.live) warnings.push('เอกสารนี้พิมพ์จากข้อมูลจำลอง (โหมดต้นแบบ) ห้ามใช้อ้างอิง');
        if (this.rows.length >= this.LIMIT) {
            warnings.push(`แสดงเพียง ${this.LIMIT} รายการแรก — ยอดรวมท้ายตารางไม่ใช่ยอดทั้งงวด`);
        }

        const period = this.state.period === 'all'
            ? 'ทุกงวด' : (AR_PERIODS.find(x => x.key === this.state.period) || {}).label;

        const rowsHtml = this.rows.map((r, i) => `<tr>
            <td style="${DocParts.CELL}text-align:center">${i + 1}</td>
            <td style="${DocParts.CELL}">${DocParts.esc(r.case_ref)}</td>
            <td style="${DocParts.CELL}">${DocParts.esc(r.patient_name || '')}</td>
            <td style="${DocParts.CELL}">${DocParts.esc(r.hn || '')}</td>
            <td style="${DocParts.CELL}">${DocParts.esc(AR_FUND_LABEL[r.fund_key] || r.fund_key)}</td>
            <td style="${DocParts.CELL}text-align:right">${DocParts.esc(MockFmt.baht(r.billed_adj))}</td>
            <td style="${DocParts.CELL}text-align:right">${DocParts.esc(MockFmt.baht(r.net_received))}</td>
            <td style="${DocParts.CELL}text-align:right">${DocParts.esc(MockFmt.baht(r.outstanding))}</td>
            <td style="${DocParts.CELL}text-align:center">${r.outstanding > 0 ? r.age_days : '—'}</td>
        </tr>`).join('');

        const sub = { 'เลขที่': 'AR-' + (this.state.period === 'all' ? 'ALL' : this.state.period),
                      'งวด': period,
                      'สิทธิ': this.state.payer === 'all' ? 'ทุกสิทธิ' : AR_PAYER_LABEL[this.state.payer] };

        const html = DocParts.docHead({
            title: 'ทะเบียนลูกหนี้ค่ารักษาพยาบาลรายบุคคล',
            formCode: 'FIN-AR-01',
            fields: { ...sub, 'พิมพ์เมื่อ': DocParts.nowText() },
        })
        + `<table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead><tr>
                <th style="${DocParts.CELL}width:28px">#</th>
                <th style="${DocParts.CELL}">เลขเคส</th>
                <th style="${DocParts.CELL}">ผู้ป่วย</th>
                <th style="${DocParts.CELL}width:62px">HN</th>
                <th style="${DocParts.CELL}">กองทุน</th>
                <th style="${DocParts.CELL}width:72px">พึงรับ</th>
                <th style="${DocParts.CELL}width:72px">รับแล้ว</th>
                <th style="${DocParts.CELL}width:72px">คงค้าง</th>
                <th style="${DocParts.CELL}width:44px">อายุ</th>
            </tr></thead>
            <tbody>${DocParts.fillRows(rowsHtml, 20, 9)}
                <tr>
                    <td colspan="5" style="${DocParts.CELL}text-align:center;font-weight:700">รวม</td>
                    <td style="${DocParts.CELL}text-align:right;font-weight:700">${MockFmt.baht(t.billed)}</td>
                    <td style="${DocParts.CELL}text-align:right;font-weight:700">${MockFmt.baht(t.net_received)}</td>
                    <td style="${DocParts.CELL}text-align:right;font-weight:700">${MockFmt.baht(t.outstanding)}</td>
                    <td style="${DocParts.CELL}"></td>
                </tr>
            </tbody></table>`
        + DocParts.signatureBlock(['ลงชื่อ ผู้จัดทำ', 'ลงชื่อ หัวหน้างานการเงิน'])
        + DocParts.footer(sub);

        return { html: DocParts.toPrintBorders(html), warnings };
    },

    openPrint() {
        const { html, warnings } = this.buildDoc();
        DocPrint.preview({ title: 'ตัวอย่างก่อนพิมพ์ — ทะเบียนลูกหนี้', html, warnings });
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.FinAR = FinAR;
document.addEventListener('DOMContentLoaded', () => FinAR.init());
