/* ────────────────────────────────────────────────────────
   บันทึกรับเงินโอน และตัดยอดลูกหนี้รายบุคคล

   ลำดับงานที่หน้านี้บังคับ (ตรงกับ src/routes/finance.js):
     1. สร้างใบบันทึกรับ  → สถานะ DRAFT · กรอกวันเงินเข้า/งวด/สิทธิ/ยอดตาม Statement
     2. ตัดยอดลงรายเคส    → เลือกเคสที่ยังค้าง ใส่ยอดรับ/ยอดเรียกคืน (แก้ได้ตลอดตอน DRAFT)
     3. ยืนยัน            → ยอดที่ตัดต้องเท่ายอดตาม Statement เป๊ะ แล้วจึงมีผลกับทะเบียนลูกหนี้

   ⚠️ ยอดที่เอาไปตัดลูกหนี้คือ "ยอดตาม Statement" (gross) ไม่ใช่เงินสุทธิที่เข้าบัญชี
      เพราะมีค่าธรรมเนียม/ภาษีหัก ณ ที่จ่ายคั่นอยู่ — ถ้าตัดด้วยยอดสุทธิ ลูกหนี้จะค้าง
      ค่าธรรมเนียมทิ้งไว้ทุกใบตลอดไป
   ──────────────────────────────────────────────────────── */

const FinReceipt = {

    state: { period: 'all', payer: 'all' },

    receipts: [], open: [], sum: null,
    /** ใบที่กำลังแก้ + บรรทัดตัดยอดที่ยังไม่บันทึก */
    edit: null,

    /* ══════════ วงจรชีวิต ══════════ */

    async init() {
        MockSession.mountBanner('demoBanner');
        await FinData.probe();
        this.fillFilters();
        this.renderSource();
        await this.reload();
    },

    fillFilters() {
        document.getElementById('fPeriod').innerHTML =
            '<option value="all">ทุกงวด</option>'
            + AR_PERIODS.map(p => `<option value="${esc(p.key)}">งวด ${esc(p.label)}</option>`).join('');
        document.getElementById('fPayer').innerHTML =
            '<option value="all">ทุกสิทธิ</option>'
            + Object.entries(AR_PAYER_LABEL)
                .map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('');

        // โหมดต้นแบบสร้างใบจริงไม่ได้ — ปิดปุ่มไว้ดีกว่าให้กดแล้วเด้ง error
        const b = document.getElementById('btnNew');
        if (!FinData.live) {
            b.disabled = true;
            b.title = 'โหมดต้นแบบบันทึกจริงไม่ได้ — ต้องเข้าสู่ระบบและมีเซิร์ฟเวอร์';
        }
    },

    renderSource() {
        document.getElementById('sourceNote').innerHTML = FinData.live
            ? `<div class="sip-mock-note" style="border-color:var(--status-success-border);
                    background:var(--status-success-bg)">
                 <span class="sip-mock-tag" style="background:var(--status-success-strong)">ข้อมูลจริง</span>
                 <span>บันทึกรับและตัดยอดในหน้านี้มีผลกับทะเบียนลูกหนี้จริง</span>
               </div>`
            : `<div class="sip-mock-note">
                 <span class="sip-mock-tag">MOCKUP</span>
                 <span>โหมดต้นแบบ — ดูรูปแบบการทำงานได้ แต่สร้างใบบันทึกรับและตัดยอดจริงไม่ได้
                       (เข้าสู่ระบบเมื่อมีเซิร์ฟเวอร์เพื่อใช้งานจริง)</span>
               </div>`;
    },

    async reload() {
        this.state.period = document.getElementById('fPeriod').value || 'all';
        this.state.payer  = document.getElementById('fPayer').value  || 'all';
        const q = { period: this.state.period, payer: this.state.payer };

        const [receipts, sum, open] = await Promise.all([
            FinData.receipts(q),
            FinData.summary(q),
            FinData.list({ ...q, only_open: '1', limit: 200 }),
        ]);
        this.receipts = receipts;
        this.sum = sum;
        this.open = open;

        document.getElementById('asOf').textContent =
            (this.state.period === 'all' ? 'ทุกงวด'
                : 'งวด ' + (AR_PERIODS.find(x => x.key === this.state.period) || {}).label)
            + ' · ' + (this.state.payer === 'all' ? 'ทุกสิทธิ' : AR_PAYER_LABEL[this.state.payer]);

        this.renderKpi();
        this.renderReceipts();
        this.renderOpen();
        refreshIcons();
    },

    /* ══════════ KPI ══════════ */

    renderKpi() {
        const t = this.sum.total;
        const drafts = this.receipts.filter(r => r.status === 'DRAFT');
        const gross = this.receipts.filter(r => r.status === 'CONFIRMED')
            .reduce((a, r) => a + Number(r.gross_amt), 0);

        const tile = (icon, value, label, hint, danger) =>
            `<div class="sip-kpi${danger ? ' critical' : ''}" style="cursor:default">
                <i data-lucide="${esc(icon)}" class="sip-kpi-icon icon-md"></i>
                <div class="sip-kpi-value">${esc(value)}</div>
                <div class="sip-kpi-label">${esc(label)}</div>
                <div class="ds-hint" style="margin-top:2px">${esc(hint)}</div>
            </div>`;

        document.getElementById('kpiWrap').innerHTML = `<div class="ds-kpi-grid">
            ${tile('receipt', MockFmt.baht(gross, { short: true }), 'รับตาม Statement (ยืนยันแล้ว)',
                   MockFmt.int(this.receipts.length - drafts.length) + ' ใบ')}
            ${tile('file-clock', MockFmt.int(drafts.length), 'ใบที่ยังเป็นร่าง',
                   drafts.length ? 'ยังไม่มีผลกับทะเบียนลูกหนี้' : 'ไม่มีใบค้างร่าง', drafts.length > 0)}
            ${tile('banknote', MockFmt.baht(t.net_received, { short: true }), 'ตัดเข้าลูกหนี้แล้วสุทธิ',
                   t.clawback ? 'หักเรียกคืน ' + MockFmt.baht(t.clawback) : 'ไม่มียอดเรียกคืน')}
            ${tile('alert-circle', MockFmt.baht(t.outstanding, { short: true }), 'ลูกหนี้คงค้าง',
                   MockFmt.int(t.open_cases) + ' ราย', t.outstanding > 0)}
        </div>`;
    },

    /* ══════════ ตารางใบบันทึกรับ ══════════ */

    renderReceipts() {
        const head = `<thead><tr>
            <th style="width:95px">เลขที่ใบรับ</th>
            <th style="width:100px">วันเงินเข้า</th>
            <th style="width:65px">งวด</th>
            <th style="width:120px">สิทธิ</th>
            <th style="min-width:190px">Statement / อ้างอิงธนาคาร</th>
            <th class="num" style="width:115px">ยอดตาม Statement</th>
            <th class="num" style="width:110px">เงินเข้าบัญชี</th>
            <th class="num" style="width:110px">ตัดลงเคสแล้ว</th>
            <th style="width:110px">สถานะ</th>
        </tr></thead>`;

        if (!this.receipts.length) {
            document.getElementById('rcTable').innerHTML = head
                + `<tbody><tr><td colspan="9" class="c" style="padding:26px">
                     <span class="td-sub">ยังไม่มีใบบันทึกรับในงวดนี้</span></td></tr></tbody>`;
            document.getElementById('rowNote').textContent = 'ไม่พบรายการ';
            return;
        }

        const body = this.receipts.map(r => {
            const alloc = Number(r.allocated_amt);
            const diff = Number(r.gross_amt) - alloc;
            const draft = r.status === 'DRAFT';
            return `<tr style="cursor:pointer" onclick="FinReceipt.openReceipt(${esc(r.receipt_id)})">
                <td class="l"><b>${esc(r.receipt_no)}</b></td>
                <td class="c">${esc(MockFmt.dateTH(r.received_date))}</td>
                <td class="c">${esc(r.period_key)}</td>
                <td class="l">${esc(AR_PAYER_LABEL[r.payer] || r.payer)}</td>
                <td class="l"><span class="td-sub">${esc(r.statement_no || '—')}
                    ${r.bank_ref ? ' · ' + esc(r.bank_ref) : ''}</span></td>
                <td class="num"><span class="ds-amt ds-amt-billed">${esc(MockFmt.baht(r.gross_amt))}</span></td>
                <td class="num">${esc(MockFmt.baht(r.net_amt))}</td>
                <td class="num">${alloc
                    ? `<span class="ds-amt ds-amt-comp">${esc(MockFmt.baht(alloc))}</span>`
                    : '<span class="td-sub">—</span>'}
                    ${Math.abs(diff) > 0.01
                        ? `<div class="ds-hint" style="color:var(--status-warning-strong)">
                             ยังไม่ตัด ${esc(MockFmt.baht(diff))}</div>` : ''}</td>
                <td class="c"><span class="kbadge ${draft ? 'kbadge-draft' : 'kbadge-done'}">
                    ${draft ? 'ร่าง' : 'ยืนยันแล้ว'}</span></td>
            </tr>`;
        }).join('');

        document.getElementById('rcTable').innerHTML = head + `<tbody>${body}</tbody>`;
        document.getElementById('rowNote').textContent = `${MockFmt.int(this.receipts.length)} ใบ`;
    },

    /* ══════════ ตารางเคสที่ยังค้าง ══════════ */

    renderOpen() {
        const head = `<thead><tr>
            <th style="min-width:130px">เลขเคส</th>
            <th style="min-width:170px">ผู้ป่วย</th>
            <th style="min-width:170px">กองทุน</th>
            <th style="width:65px">งวด</th>
            <th class="num" style="width:105px">พึงรับ</th>
            <th class="num" style="width:105px">รับแล้ว</th>
            <th class="num" style="width:105px">คงค้าง</th>
            <th style="width:80px">อายุหนี้</th>
        </tr></thead>`;

        if (!this.open.length) {
            document.getElementById('openTable').innerHTML = head
                + `<tbody><tr><td colspan="8" class="c" style="padding:26px">
                     <span class="td-sub">ไม่มีเคสค้างในตัวกรองนี้ — ตัดยอดครบแล้ว</span>
                   </td></tr></tbody>`;
            return;
        }

        /* เรียงค้างนานสุดขึ้นก่อน — งานติดตามหนี้เริ่มจากตัวที่เสี่ยงพ้นกำหนดที่สุด */
        const rows = [...this.open].sort((a, b) => b.age_days - a.age_days).slice(0, 40);

        const body = rows.map(r => `<tr>
            <td class="l"><b>${esc(r.case_ref)}</b></td>
            <td class="l">${esc(r.patient_name || '—')}</td>
            <td class="l">${esc(AR_FUND_LABEL[r.fund_key] || r.fund_key)}</td>
            <td class="c">${esc(r.period_key)}</td>
            <td class="num">${esc(MockFmt.baht(r.billed_adj))}</td>
            <td class="num">${r.net_received ? esc(MockFmt.baht(r.net_received)) : '<span class="td-sub">—</span>'}</td>
            <td class="num"><span style="color:var(--status-warning-strong);font-weight:600">
                ${esc(MockFmt.baht(r.outstanding))}</span></td>
            <td class="c">${esc(MockFmt.int(r.age_days))} วัน</td>
        </tr>`).join('');

        const more = this.open.length > rows.length
            ? `<tr><td colspan="8" class="c"><span class="td-sub">
                 และอีก ${MockFmt.int(this.open.length - rows.length)} ราย —
                 ดูครบที่หน้าทะเบียนลูกหนี้</span></td></tr>` : '';

        document.getElementById('openTable').innerHTML = head + `<tbody>${body}${more}</tbody>`;
    },

    /* ══════════ สร้างใบบันทึกรับ ══════════ */

    openNew() {
        const today = new Date().toISOString().slice(0, 10);
        const periods = AR_PERIODS.map(p =>
            `<option value="${esc(p.key)}">งวด ${esc(p.label)} (${esc(p.key)})</option>`).join('');

        Drawer.open({
            title: 'บันทึกรับเงินโอนใหม่',
            width: '520px',
            contentHtml: `
                <div class="ds-note" style="display:block;margin-bottom:12px">
                    กรอก <b>ยอดตาม Statement</b> ให้ตรงกับหนังสือแจ้งโอน — ยอดนี้คือตัวที่จะเอาไป
                    ตัดลูกหนี้ · ค่าธรรมเนียมกรอกแยก ระบบจะคิดเงินเข้าบัญชีให้เอง
                </div>
                <div class="sip-field">
                    <label class="ds-section-label">วันที่เงินเข้าบัญชี</label>
                    <input type="date" class="sip-input" id="nDate" value="${esc(today)}" style="width:100%">
                </div>
                <div class="sip-field-row">
                    <div class="sip-field">
                        <label class="ds-section-label">งวด Statement</label>
                        <select class="sip-select" id="nPeriod" style="width:100%">${periods}</select>
                    </div>
                    <div class="sip-field">
                        <label class="ds-section-label">สิทธิ</label>
                        <select class="sip-select" id="nPayer" style="width:100%">
                            ${Object.entries(AR_PAYER_LABEL).map(([k, v]) =>
                                `<option value="${esc(k)}">${esc(v)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="sip-field">
                    <label class="ds-section-label">เลขที่ Statement / REP</label>
                    <input class="sip-input" id="nStmt" style="width:100%" placeholder="เช่น OP_10670_6907_01_00">
                </div>
                <div class="sip-field">
                    <label class="ds-section-label">เลขอ้างอิงรายการเดินบัญชี</label>
                    <input class="sip-input" id="nBank" style="width:100%">
                </div>
                <div class="sip-field-row">
                    <div class="sip-field">
                        <label class="ds-section-label">ยอดตาม Statement</label>
                        <input type="number" step="0.01" class="sip-input" id="nGross" style="width:100%" value="0">
                    </div>
                    <div class="sip-field">
                        <label class="ds-section-label">ค่าธรรมเนียม / หัก ณ ที่จ่าย</label>
                        <input type="number" step="0.01" class="sip-input" id="nFee" style="width:100%" value="0">
                    </div>
                </div>
                <div class="sip-field">
                    <label class="ds-section-label">หมายเหตุ</label>
                    <input class="sip-input" id="nNote" style="width:100%">
                </div>`,
            footerHtml: `
                <button class="btn btn-outline btn-sm" onclick="Drawer.close()">ยกเลิก</button>
                <button class="btn btn-primary btn-sm" onclick="FinReceipt.saveNew()">
                    <i data-lucide="save" class="icon-sm"></i> สร้างใบร่าง</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    async saveNew() {
        const v = id => document.getElementById(id).value;
        const gross = Number(v('nGross')) || 0;
        if (gross <= 0) { DSToast.error('ยอดตาม Statement ต้องมากกว่า 0'); return; }

        try {
            const r = await FinData.createReceipt({
                received_date: v('nDate'), period_key: v('nPeriod'), payer: v('nPayer'),
                statement_no: v('nStmt') || null, bank_ref: v('nBank') || null,
                channel: 'โอนเข้าบัญชี',
                gross_amt: gross, fee_amt: Number(v('nFee')) || 0,
                note: v('nNote') || null,
            });
            DSToast.success(`สร้างใบร่าง ${r.receipt_no} แล้ว — ขั้นถัดไปคือตัดยอดลงรายเคส`);
            Drawer.close();
            await this.reload();
            await this.openReceipt(r.receipt_id);
        } catch (e) {
            DSToast.error(e.message);
        }
    },

    /* ══════════ ใบบันทึกรับ 1 ใบ + ตัดยอด ══════════ */

    async openReceipt(id) {
        const r = await FinData.receipt(id);
        if (!r) { DSToast.error('ไม่พบใบบันทึกรับนี้'); return; }

        /* บรรทัดตัดยอดที่กำลังแก้ — เริ่มจากที่บันทึกไว้แล้ว
           เก็บใน state ไม่ใช่ใน DOM เพราะต้องคิดผลต่างสด ๆ ทุกครั้งที่พิมพ์ */
        this.edit = {
            receipt: r,
            lines: (r.allocations || []).map(a => ({
                ar_item_id: a.ar_item_id, case_ref: a.case_ref, patient_name: a.patient_name,
                subfund: a.subfund || '', paid_amt: Number(a.paid_amt),
                clawback_amt: Number(a.clawback_amt),
            })),
        };

        Drawer.open({
            title: `ใบบันทึกรับ ${r.receipt_no}`,
            width: '860px',
            contentHtml: '<div id="rcPane"></div>',
            onOpen: () => this.renderPane(),
        });
    },

    /** ผลต่างระหว่างยอดตาม Statement กับยอดที่ตัดลงเคสแล้ว */
    _diff() {
        const e = this.edit;
        const alloc = e.lines.reduce((a, l) => a + (Number(l.paid_amt) || 0) - (Number(l.clawback_amt) || 0), 0);
        return { alloc, diff: Number(e.receipt.gross_amt) - alloc };
    },

    renderPane() {
        const e = this.edit;
        const r = e.receipt;
        const draft = r.status === 'DRAFT';
        const { alloc, diff } = this._diff();
        const matched = Math.abs(diff) <= 0.01;

        const kv = (k, v) => `<div style="display:flex;justify-content:space-between;gap:12px;
            padding:4px 0;border-bottom:1px dashed var(--border-subtle)">
            <span class="ds-hint">${esc(k)}</span><span>${v}</span></div>`;

        const lines = e.lines.length ? e.lines.map((l, i) => `<tr>
            <td class="l"><b>${esc(l.case_ref)}</b>
                <div class="ds-hint">${esc(l.patient_name || '')}</div></td>
            <td class="l">${draft
                ? `<input class="sip-input" style="width:100%" value="${esc(l.subfund)}"
                        placeholder="กองทุนย่อยที่จ่าย"
                        oninput="FinReceipt.setLine(${i},'subfund',this.value)">`
                : esc(l.subfund || '—')}</td>
            <td class="num">${draft
                ? `<input type="number" step="0.01" class="sip-input" style="width:100px;text-align:right"
                        value="${esc(l.paid_amt)}"
                        oninput="FinReceipt.setLine(${i},'paid_amt',this.value)">`
                : esc(MockFmt.baht(l.paid_amt))}</td>
            <td class="num">${draft
                ? `<input type="number" step="0.01" class="sip-input" style="width:100px;text-align:right"
                        value="${esc(l.clawback_amt)}"
                        oninput="FinReceipt.setLine(${i},'clawback_amt',this.value)">`
                : (Number(l.clawback_amt) ? '−' + esc(MockFmt.baht(l.clawback_amt)) : '<span class="td-sub">—</span>')}</td>
            <td class="num">${esc(MockFmt.baht((Number(l.paid_amt) || 0) - (Number(l.clawback_amt) || 0)))}</td>
            <td class="c">${draft
                ? `<button class="btn btn-outline btn-sm" onclick="FinReceipt.dropLine(${i})"
                        title="เอาบรรทัดนี้ออก">&times;</button>` : ''}</td>
        </tr>`).join('')
        : `<tr><td colspan="6" class="c" style="padding:18px">
             <span class="td-sub">ยังไม่ได้ตัดยอดลงเคสไหน — กด "เพิ่มเคส" ด้านล่าง</span></td></tr>`;

        document.getElementById('rcPane').innerHTML = `
            <div style="margin-bottom:12px">
                ${kv('วันที่เงินเข้าบัญชี', esc(MockFmt.dateTH(r.received_date)))}
                ${kv('งวด / สิทธิ', esc(r.period_key) + ' · ' + esc(AR_PAYER_LABEL[r.payer] || r.payer))}
                ${kv('Statement', esc(r.statement_no || '—'))}
                ${kv('อ้างอิงธนาคาร', esc(r.bank_ref || '—'))}
                ${kv('ยอดตาม Statement', '<b>' + esc(MockFmt.baht(r.gross_amt)) + '</b>')}
                ${kv('ค่าธรรมเนียม / หัก ณ ที่จ่าย', esc(MockFmt.baht(r.fee_amt)))}
                ${kv('เงินเข้าบัญชีจริง', esc(MockFmt.baht(r.net_amt)))}
                ${kv('สถานะ', `<span class="kbadge ${draft ? 'kbadge-draft' : 'kbadge-done'}">
                    ${draft ? 'ร่าง — ยังไม่มีผลกับทะเบียนลูกหนี้' : 'ยืนยันแล้ว'}</span>`)}
            </div>

            <!-- แถบผลต่าง: ตัวเดียวที่บอกว่ายืนยันได้หรือยัง — ต้องเห็นตลอดเวลาที่แก้ -->
            <div class="${matched ? 'ds-note' : 'ds-warn'}" style="display:block">
                <div style="display:flex;justify-content:space-between">
                    <span>ตัดลงเคสแล้ว <b>${esc(MockFmt.baht(alloc))}</b>
                        จากยอดตาม Statement ${esc(MockFmt.baht(r.gross_amt))}</span>
                    <b>${matched ? 'ยอดตรงกัน — ยืนยันได้'
                        : (diff > 0 ? 'ยังตัดไม่ครบ ' : 'ตัดเกินไป ') + esc(MockFmt.baht(Math.abs(diff)))}</b>
                </div>
            </div>

            <table class="ds-table-grid" style="margin-top:10px"><thead><tr>
                <th style="min-width:160px">เคส</th>
                <th style="min-width:150px">กองทุนย่อยที่จ่าย</th>
                <th class="num" style="width:115px">ยอดรับ</th>
                <th class="num" style="width:115px">ยอดเรียกคืน</th>
                <th class="num" style="width:105px">สุทธิ</th>
                <th style="width:44px"></th>
            </tr></thead><tbody>${lines}</tbody></table>

            ${draft ? `
                <div class="section-actions" style="margin-top:12px">
                    <button class="btn btn-outline btn-sm" onclick="FinReceipt.pickCase()">
                        <i data-lucide="plus" class="icon-sm"></i> เพิ่มเคส</button>
                    <button class="btn btn-outline btn-sm" onclick="FinReceipt.autoFill()">
                        <i data-lucide="wand-2" class="icon-sm"></i> เติมอัตโนมัติจากเคสค้างนานสุด</button>
                </div>
                <div class="section-actions" style="margin-top:14px;border-top:1px solid var(--border-subtle);
                        padding-top:14px">
                    <button class="btn btn-outline btn-sm" onclick="FinReceipt.saveLines()">
                        <i data-lucide="save" class="icon-sm"></i> บันทึกการตัดยอด</button>
                    <button class="btn btn-primary btn-sm" onclick="FinReceipt.confirm()"
                        ${matched && e.lines.length ? '' : 'disabled'}
                        title="${matched ? '' : 'ยอดที่ตัดต้องเท่ายอดตาม Statement ก่อน'}">
                        <i data-lucide="check" class="icon-sm"></i> ยืนยันใบรับ</button>
                    <button class="btn btn-outline btn-sm" style="margin-left:auto"
                        onclick="FinReceipt.remove()">ลบใบร่างนี้</button>
                </div>`
            : `<div class="ds-note" style="display:block;margin-top:12px">
                 ใบที่ยืนยันแล้วแก้ไม่ได้ — ยอดถูกนำไปคิดคงค้างในทะเบียนลูกหนี้แล้ว
                 ถ้าลงผิดให้ออกใบใหม่หรือใช้การปรับปรุงยอดที่หน้าทะเบียนลูกหนี้
               </div>`}`;

        refreshIcons();
    },

    setLine(i, field, value) {
        this.edit.lines[i][field] = field === 'subfund' ? value : (Number(value) || 0);
        // วาดใหม่เฉพาะแถบผลต่าง/สุทธิ ไม่วาดทั้งแผงเพราะจะทำให้ช่องที่กำลังพิมพ์เสียโฟกัส
        if (field !== 'subfund') this._refreshTotals();
    },

    _refreshTotals() {
        const { alloc, diff } = this._diff();
        const matched = Math.abs(diff) <= 0.01;
        const box = document.querySelector('#rcPane .ds-note, #rcPane .ds-warn');
        if (box) {
            box.className = (matched ? 'ds-note' : 'ds-warn');
            box.style.display = 'block';
            box.innerHTML = `<div style="display:flex;justify-content:space-between">
                <span>ตัดลงเคสแล้ว <b>${esc(MockFmt.baht(alloc))}</b>
                    จากยอดตาม Statement ${esc(MockFmt.baht(this.edit.receipt.gross_amt))}</span>
                <b>${matched ? 'ยอดตรงกัน — ยืนยันได้'
                    : (diff > 0 ? 'ยังตัดไม่ครบ ' : 'ตัดเกินไป ') + esc(MockFmt.baht(Math.abs(diff)))}</b></div>`;
        }
        const btn = document.querySelector('#rcPane button[onclick="FinReceipt.confirm()"]');
        if (btn) btn.disabled = !(matched && this.edit.lines.length);
    },

    dropLine(i) { this.edit.lines.splice(i, 1); this.renderPane(); },

    /** เลือกเคสจากรายการที่ยังค้าง — กรองสิทธิ/งวดให้ตรงกับใบรับไว้ก่อน */
    pickCase() {
        const r = this.edit.receipt;
        const used = new Set(this.edit.lines.map(l => l.ar_item_id));
        const cands = this.open
            .filter(c => c.payer === r.payer && !used.has(c.ar_item_id))
            .sort((a, b) => b.age_days - a.age_days)
            .slice(0, 60);

        if (!cands.length) { DSToast.info('ไม่มีเคสค้างของสิทธินี้ให้เลือกเพิ่ม'); return; }

        Drawer.open({
            title: 'เลือกเคสที่จะตัดยอด',
            width: '640px',
            contentHtml: `
                <div class="ds-hint" style="margin-bottom:8px">
                    เฉพาะเคสค้างของ ${esc(AR_PAYER_LABEL[r.payer] || r.payer)} · เรียงค้างนานสุดก่อน</div>
                <table class="ds-table-grid"><thead><tr>
                    <th>เคส</th><th>กองทุน</th><th style="width:60px">งวด</th>
                    <th class="num" style="width:100px">คงค้าง</th>
                    <th style="width:70px">อายุ</th><th style="width:60px"></th>
                </tr></thead><tbody>
                ${cands.map(c => `<tr>
                    <td class="l"><b>${esc(c.case_ref)}</b>
                        <div class="ds-hint">${esc(c.patient_name || '')}</div></td>
                    <td class="l">${esc(AR_FUND_LABEL[c.fund_key] || c.fund_key)}</td>
                    <td class="c">${esc(c.period_key)}</td>
                    <td class="num">${esc(MockFmt.baht(c.outstanding))}</td>
                    <td class="c">${esc(MockFmt.int(c.age_days))} ว.</td>
                    <td class="c"><button class="btn btn-primary btn-sm"
                        onclick="FinReceipt.addCase(${esc(c.ar_item_id)})">เลือก</button></td>
                </tr>`).join('')}
                </tbody></table>`,
        });
    },

    /**
     * เพิ่มเคสเข้าใบ — ตั้งยอดเริ่มต้นเป็น "น้อยกว่าระหว่างยอดคงค้างกับเงินที่ยังไม่ได้ตัด"
     * เพื่อไม่ให้ตัดเกินยอดตาม Statement ตั้งแต่ยังไม่ได้แก้อะไร
     */
    addCase(itemId) {
        const c = this.open.find(x => String(x.ar_item_id) === String(itemId));
        if (!c) return;
        const { diff } = this._diff();
        const fund = AR_FUNDS.find(f => f.fund_key === c.fund_key);

        this.edit.lines.push({
            ar_item_id: c.ar_item_id, case_ref: c.case_ref, patient_name: c.patient_name,
            subfund: fund ? fund.subfund : '',
            paid_amt: Math.max(0, Math.min(c.outstanding, diff > 0 ? diff : c.outstanding)),
            clawback_amt: 0,
        });
        Drawer.close();
        this.renderPane();
    },

    /**
     * เติมอัตโนมัติ — ไล่ตัดเคสค้างนานสุดก่อนจนเงินหมด (FIFO ตามอายุหนี้)
     * เป็นตัวช่วยตั้งต้นเท่านั้น ผู้ใช้ต้องตรวจก่อนยืนยันเสมอ เพราะ Statement จริง
     * ระบุมาแล้วว่าเงินก้อนไหนเป็นของเคสไหน
     */
    autoFill() {
        const r = this.edit.receipt;
        const used = new Set(this.edit.lines.map(l => l.ar_item_id));
        let left = this._diff().diff;
        if (left <= 0) { DSToast.info('ยอดตัดครบแล้ว ไม่มีเงินเหลือให้กระจาย'); return; }

        const cands = this.open
            .filter(c => c.payer === r.payer && !used.has(c.ar_item_id))
            .sort((a, b) => b.age_days - a.age_days);

        let added = 0;
        for (const c of cands) {
            if (left <= 0.01) break;
            const take = Math.min(c.outstanding, left);
            if (take <= 0) continue;
            const fund = AR_FUNDS.find(f => f.fund_key === c.fund_key);
            this.edit.lines.push({
                ar_item_id: c.ar_item_id, case_ref: c.case_ref, patient_name: c.patient_name,
                subfund: fund ? fund.subfund : '',
                paid_amt: Math.round(take * 100) / 100, clawback_amt: 0,
            });
            left -= take;
            added++;
        }

        if (!added) { DSToast.info('ไม่มีเคสค้างของสิทธินี้ให้เติม'); return; }
        DSToast.success(`เติม ${added} เคสให้แล้ว — ตรวจกองทุนย่อยกับยอดให้ตรง Statement ก่อนยืนยัน`);
        this.renderPane();
    },

    async saveLines() {
        const e = this.edit;
        try {
            const res = await FinData.allocate(e.receipt.receipt_id, e.receipt.rev, e.lines.map(l => ({
                ar_item_id: l.ar_item_id, subfund: l.subfund || null,
                paid_amt: Number(l.paid_amt) || 0, clawback_amt: Number(l.clawback_amt) || 0,
            })));
            DSToast.success(`บันทึกการตัดยอด ${res.lines} บรรทัดแล้ว`);
            // rev เดินหน้าไปแล้ว — ต้องอ่านใบใหม่ ไม่งั้นบันทึกครั้งถัดไปจะติด STALE_REV
            await this.openReceipt(e.receipt.receipt_id);
            await this.reload();
        } catch (err) {
            DSToast.error(err.message);
        }
    },

    async confirm() {
        const e = this.edit;
        const ok = await Drawer.confirm({
            title: `ยืนยันใบบันทึกรับ ${e.receipt.receipt_no}?`,
            message: 'ยืนยันแล้วยอดจะไปตัดลูกหนี้จริงและแก้ใบนี้ไม่ได้อีก',
            lines: [`ตัดลงเคส ${e.lines.length} บรรทัด`,
                    `ยอดรวม ${MockFmt.baht(this._diff().alloc)} บาท`],
            confirmText: 'ยืนยัน',
            // ⚠️ Drawer.confirm ตั้ง danger เป็น true เมื่อไม่ส่งค่ามา (opts.danger !== false)
            //    นี่เป็นการยืนยันเชิงบวก ไม่ใช่การทำลาย ต้องส่ง false ไม่งั้นกล่องขึ้นสีแดง
            danger: false,
        });
        if (!ok) return;

        try {
            // บันทึกบรรทัดล่าสุดก่อนเสมอ — ผู้ใช้อาจแก้ช่องแล้วยังไม่กดบันทึก
            await FinData.allocate(e.receipt.receipt_id, e.receipt.rev, e.lines.map(l => ({
                ar_item_id: l.ar_item_id, subfund: l.subfund || null,
                paid_amt: Number(l.paid_amt) || 0, clawback_amt: Number(l.clawback_amt) || 0,
            })));
            await FinData.confirmReceipt(e.receipt.receipt_id);
            DSToast.success('ยืนยันแล้ว — ยอดตัดเข้าทะเบียนลูกหนี้เรียบร้อย');
            Drawer.close();
            await this.reload();
        } catch (err) {
            if (err.code === 'ALLOCATION_MISMATCH') {
                DSToast.error(err.message);
            } else {
                DSToast.error(err.message);
            }
        }
    },

    async remove() {
        const e = this.edit;
        const ok = await Drawer.confirm({
            title: `ลบใบร่าง ${e.receipt.receipt_no}?`,
            message: 'ใบร่างที่ยังไม่ยืนยันลบได้ — ประวัติยังอยู่ใน audit log',
            confirmText: 'ลบ', danger: true,
        });
        if (!ok) return;
        try {
            await FinData.deleteReceipt(e.receipt.receipt_id, 'ลบจากหน้าบันทึกรับ');
            DSToast.success('ลบใบร่างแล้ว');
            Drawer.close();
            await this.reload();
        } catch (err) {
            DSToast.error(err.message);
        }
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.FinReceipt = FinReceipt;
document.addEventListener('DOMContentLoaded', () => FinReceipt.init());
