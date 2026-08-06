/* ────────────────────────────────────────────────────────
   ตามจ่าย / เรียกเก็บการส่งต่อ (Referral AP–AR)

   หน้านี้ทำงานที่ระดับ "ใบเรียกเก็บ" ไม่ใช่ระดับรายการส่งต่อ
   เพราะ 1 การส่งต่อ → N ใบ และการโต้แย้ง/เรียกเก็บซ้ำซ้อนเกิดที่ระดับใบ
   ยอดทุกตัว derive จาก MockRefer — ต้องตรงกับ refer-dashboard และ claim-dashboard
   ──────────────────────────────────────────────────────── */

const ReferBilling = {

    state: { dir: 'all', flag: 'all', selected: new Set() },

    init() {
        MockSession.mountBanner('demoBanner');

        const p = new URLSearchParams(location.search);
        if (p.get('dir'))  this.state.dir  = p.get('dir');
        if (p.get('flag')) this.state.flag = p.get('flag');
        this._focusRefer = p.get('refer');
        this._focusBill  = p.get('bill');

        this.fillFilters();
        this.renderSeg();
        this.render();
    },

    reload() { this.state.selected.clear(); this.render(); showToast('รีเฟรชข้อมูลแล้ว'); },

    /* ── ตัวกรอง ── */

    fillFilters() {
        const partners = [...new Set(MockRefer.all().map(r => r.partner_name))].sort();
        document.getElementById('fPartner').insertAdjacentHTML('beforeend',
            partners.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join(''));

        document.getElementById('fStatus').insertAdjacentHTML('beforeend',
            Object.entries(REFER_BILL_STATUS).map(([k, v]) =>
                `<option value="${esc(k)}">${esc(v.label)}</option>`).join(''));

        document.getElementById('fChannel').insertAdjacentHTML('beforeend',
            Object.entries(REFER_CHANNEL).map(([k, v]) =>
                `<option value="${esc(k)}">${esc(v)}</option>`).join(''));
    },

    renderSeg() {
        const segs = [
            { key: 'OUT', label: 'ตามจ่ายปลายทาง (AP)', n: MockRefer.billsByDir('OUT').length },
            { key: 'IN',  label: 'เรียกเก็บ (AR)',       n: MockRefer.billsByDir('IN').length },
            { key: 'all', label: 'ทั้งหมด',              n: MockRefer.allBills().length },
        ];
        document.getElementById('segDir').innerHTML = segs.map(s => `
            <button class="ds-seg ${s.key === this.state.dir ? 'active' : ''}"
                    onclick="ReferBilling.setDir('${esc(s.key)}')">${esc(s.label)} (${s.n})</button>`).join('');
    },

    setDir(key)  { this.state.dir = key; this.state.selected.clear(); this.renderSeg(); this.render(); },
    setFlag(key) { this.state.flag = this.state.flag === key ? 'all' : key; this.render(); },
    setStatus()  { this.state.flag = this.state.flag === 'OPEN' ? 'all' : 'OPEN'; this.render(); },

    /** ธงระดับใบ — คำนวณจากตัวใบเองและรายการส่งต่อที่ผูกอยู่ */
    billFlags(b) {
        const r = MockRefer.byId(b.refer_id) || {};
        const out = [];
        if (b.nhso_claim_id && b.channel === 'ORIGIN_HOSPITAL')
            out.push({ code: 'DUP', label: 'เรียกเก็บซ้ำซ้อน', tone: 'sip-chip-danger',
                       detail: `เรียกเก็บต้นทางและส่งเบิก สปสช. (${b.nhso_claim_id}) พร้อมกัน` });
        if (MockRefer.billOutOfScope(b) > 0)
            out.push({ code: 'SCOPE', label: 'มีรายการนอกขอบเขต', tone: 'sip-chip-danger',
                       detail: `มูลค่านอกขอบเขต ${MockFmt.baht(MockRefer.billOutOfScope(b))} บาท` });
        if (r.cap_amount && MockRefer.sumBilled(r) > r.cap_amount)
            out.push({ code: 'OVERCAP', label: 'เกินวงเงิน', tone: 'sip-chip-danger',
                       detail: `เรียกเก็บรวมเกินวงเงินที่อนุมัติ ${MockFmt.baht(r.cap_amount)} บาท` });
        if (this.isLate(b))
            out.push({ code: 'LATE', label: 'เกินกำหนดยื่น', tone: 'sip-chip-danger',
                       detail: `กำหนดยื่น ${MockFmt.dateTH(b.filing_deadline)}` });
        if (MockRefer.billOutstand(b) > 0 && MockTone.sla(b.due_at) === 'over')
            out.push({ code: 'OVERDUE', label: 'เกินกำหนดชำระ', tone: 'sip-chip-amber',
                       detail: `กำหนดชำระ ${MockFmt.dateTH(b.due_at)}` });
        return out;
    },

    /** เกินกำหนดยื่น = ยังไม่ส่ง (AR) หรือส่งหลังกำหนด */
    isLate(b) {
        if (!b.filing_deadline) return false;
        const dl = MockFmt.toDate(b.filing_deadline); if (!dl) return false;
        if (b.direction === 'IN' && !b.sent_at) return MockDB.TODAY > dl;
        const sent = MockFmt.toDate(b.sent_at || b.bill_date);
        return sent ? sent > dl : false;
    },

    /**
     * มุมมองที่ต้องแสดงเป็น "รายการส่งต่อ" ไม่ใช่ "ใบเรียกเก็บ"
     * เพราะประเด็นคือ *ยังไม่มีใบ* — ถ้านับที่ระดับใบจะได้ 0 เสมอ
     * แล้วตัวเลขจะขัดกับธงบนหน้าทะเบียน
     */
    REFERRAL_VIEWS: {
        UNBILLED: { label: 'ยังไม่มีใบเรียกเก็บ', chip: 'sip-chip-amber',
                    rows: () => MockRefer.unbilled() },
        LATE:     { label: 'เกินกำหนดยื่น',      chip: 'sip-chip-danger',
                    rows: () => MockRefer.overdueFiling() },
    },

    agingKey(b) {
        const d = MockRefer.billAge(b);
        return d <= 30 ? '0-30' : d <= 60 ? '31-60' : d <= 90 ? '61-90' : '90+';
    },

    visible() {
        const kw      = document.getElementById('searchBox').value.trim().toLowerCase();
        const partner = document.getElementById('fPartner').value;
        const status  = document.getElementById('fStatus').value;
        const channel = document.getElementById('fChannel').value;
        const aging   = document.getElementById('fAging').value;

        return MockRefer.billsByDir(this.state.dir === 'all' ? null : this.state.dir).filter(b => {
            const r = MockRefer.byId(b.refer_id) || {};
            if (partner !== 'all' && r.partner_name !== partner) return false;
            if (status  !== 'all' && b.status !== status) return false;
            if (channel !== 'all' && b.channel !== channel) return false;
            if (aging   !== 'all' && this.agingKey(b) !== aging) return false;

            if (this.state.flag === 'OPEN' && MockRefer.billOutstand(b) <= 0) return false;
            if (['DUP', 'SCOPE', 'OVERCAP'].includes(this.state.flag) &&
                !this.billFlags(b).some(f => f.code === this.state.flag)) return false;
            /* UNBILLED / LATE เป็นเรื่องของรายการส่งต่อ ไม่ใช่ใบ — จัดการแยกใน render()
               (รายการที่เกินกำหนดยื่นส่วนใหญ่คือรายการที่ยังไม่เคยออกใบเลย) */
            if (this.REFERRAL_VIEWS[this.state.flag]) return false;

            if (kw && !(`${b.id} ${b.bill_no} ${r.patient || ''} ${r.partner_name || ''} ${b.refer_id}`)
                        .toLowerCase().includes(kw)) return false;
            return true;
        });
    },

    /* ── แสดงผล ── */

    render() {
        const tbody = document.getElementById('rows');
        const np    = MockRefer.netPosition();

        const view = this.REFERRAL_VIEWS[this.state.flag];
        if (view) {
            const rows = view.rows();
            tbody.innerHTML = rows.length ? rows.map(r => `
                <tr style="cursor:pointer" onclick="location.href='refer-case.html?id=${encodeURIComponent(r.id)}'">
                    <td></td>
                    <td class="td-sub">—</td>
                    <td class="td-sub">${esc(r.id)}</td>
                    <td class="td-name">${esc(r.patient)}
                        <div class="td-sub">${esc(r.partner_name)}</div></td>
                    <td class="td-sub">${esc(REFER_CHANNEL[r.reimburse_channel] || '—')}</td>
                    <td class="td-sub">${esc(MockFmt.dateTH(r.service_date_to))}</td>
                    <td class="td-sub">—</td>
                    <td style="text-align:right" class="td-sub">${esc(MockFmt.baht(r.est_amount))}<div class="td-sub">ประเมิน</div></td>
                    <td style="text-align:right">—</td><td style="text-align:right">—</td>
                    <td style="text-align:right"><strong>${esc(MockFmt.baht(r.est_amount))}</strong></td>
                    <td class="td-sub">—</td>
                    <td><span class="sip-chip ${esc(view.chip)}">${esc(view.label)}</span></td>
                    <td>${MockRefer.statusHtml(r)}</td>
                    <td></td>
                </tr>`).join('')
                : `<tr><td colspan="15" class="ds-empty">ไม่พบรายการ${esc(view.label)}</td></tr>`;
            document.getElementById('rowCount').textContent =
                `${rows.length} รายการส่งต่อ (${view.label})`;
        } else {
            const rows = this.visible();
            tbody.innerHTML = rows.length ? rows.map(b => {
                const r     = MockRefer.byId(b.refer_id) || {};
                const total = MockRefer.billTotal(b);
                const rest  = MockRefer.billOutstand(b);
                const flags = this.billFlags(b);

                return `
                <tr style="cursor:pointer" onclick="location.href='refer-case.html?id=${encodeURIComponent(b.refer_id)}'">
                    <td onclick="event.stopPropagation()">
                        <input type="checkbox" ${this.state.selected.has(b.id) ? 'checked' : ''}
                               onclick="ReferBilling.toggle('${esc(b.id)}', this)">
                    </td>
                    <td class="td-sub" style="white-space:nowrap">${esc(b.id)}
                        <div class="td-sub">${esc(b.bill_no)}</div></td>
                    <td class="td-sub" style="white-space:nowrap">${esc(b.refer_id)}</td>
                    <td class="td-name">${esc(r.patient || '—')}
                        <div class="td-sub">${esc(r.partner_name || '—')}</div></td>
                    <td class="td-sub">${esc(REFER_CHANNEL[b.channel] || b.channel)}
                        ${b.nhso_claim_id ? `<div class="td-sub">+ ${esc(b.nhso_claim_id)}</div>` : ''}</td>
                    <td class="td-sub" style="white-space:nowrap">${esc(MockFmt.dateTH(b.bill_date))}</td>
                    <td style="white-space:nowrap">${rest > 0
                        ? MockTone.slaHtml(b.due_at) : `<span class="td-sub">${esc(MockFmt.dateTH(b.due_at))}</span>`}</td>
                    <td style="text-align:right;white-space:nowrap">${esc(MockFmt.baht(total))}</td>
                    <td style="text-align:right">${esc(MockFmt.baht(b.approved_amount))}</td>
                    <td style="text-align:right;${b.disputed_amount ? 'color:var(--status-danger);font-weight:700' : ''}">${
                        esc(MockFmt.baht(b.disputed_amount))}</td>
                    <td style="text-align:right;white-space:nowrap"><strong>${esc(MockFmt.baht(rest))}</strong></td>
                    <td class="td-sub" style="white-space:nowrap">${esc(MockRefer.billAge(b))} วัน</td>
                    <td style="white-space:nowrap">${flags.length
                        ? flags.map(f => `<span class="sip-chip ${esc(f.tone)}" title="${esc(f.detail)}">${esc(f.label)}</span>`).join(' ')
                        : '<span class="sip-chip sip-chip-success">ปกติ</span>'}</td>
                    <td>${MockRefer.billStatusHtml(b)}</td>
                    <td style="white-space:nowrap" onclick="event.stopPropagation()">
                        <button class="ds-icon-btn" title="ตรวจใบเรียกเก็บ" onclick="ReferBilling.openVerify('${esc(b.id)}')">
                            <i data-lucide="search-check" class="icon-sm"></i></button>
                        <button class="ds-icon-btn neutral" title="พิมพ์ใบนี้" onclick="ReferBilling.printBill('${esc(b.id)}')">
                            <i data-lucide="printer" class="icon-sm"></i></button>
                    </td>
                </tr>`;
            }).join('')
            : '<tr><td colspan="15" class="ds-empty">ไม่พบใบเรียกเก็บตามเงื่อนไข</td></tr>';
            document.getElementById('rowCount').textContent = rows.length + ' ใบ';
        }

        /* KPI — สถานะการเงินรวมทั้งระบบ ไม่ผูกกับตัวกรอง เพื่อให้ตรงกับ dashboard */
        const all = MockRefer.allBills();
        document.getElementById('kpiPending').textContent  = MockFmt.int(
            all.filter(b => MockRefer.billOutstand(b) > 0).length);
        document.getElementById('kpiAp').textContent       = MockFmt.baht(np.ap);
        document.getElementById('kpiAr').textContent       = MockFmt.baht(np.ar);
        /* นับที่ระดับรายการส่งต่อ ไม่ใช่ใบ — ต้องตรงกับธง REF-LATE บนหน้าทะเบียนและ dashboard
           แล้วบวกใบที่ยื่นจริงแต่ยื่นช้า (คนละกรณีกัน จึงรวมเป็น set ของ refer_id) */
        const lateIds = new Set(MockRefer.overdueFiling().map(r => r.id));
        all.filter(b => this.isLate(b)).forEach(b => lateIds.add(b.refer_id));
        document.getElementById('kpiLate').textContent     = MockFmt.int(lateIds.size);
        document.getElementById('kpiDup').textContent      = MockFmt.int(MockRefer.doubleBilled().length);
        document.getElementById('kpiUnbilled').textContent = MockFmt.int(MockRefer.unbilled().length);

        this.renderAging();
        refreshIcons();   // ⚠️ ต้องเรียกทุกครั้งหลัง innerHTML
    },

    renderAging() {
        const dir = this.state.dir === 'all' ? null : this.state.dir;
        document.getElementById('agingScope').textContent =
            dir ? MockRefer.dirMeta(dir).label : 'ทั้งสองทิศทาง';

        const cur = document.getElementById('fAging').value;
        document.getElementById('agingGrid').innerHTML = MockRefer.agingBuckets(dir).map(b => `
            <div class="sip-kpi ${b.key === '90+' && b.amount ? 'critical' : ''}"
                 style="cursor:pointer" onclick="ReferBilling.setAging('${esc(b.key)}')">
                <i data-lucide="${b.key === '0-30' ? 'clock' : b.key === '90+' ? 'alert-octagon' : 'hourglass'}"
                   class="sip-kpi-icon icon-lg"></i>
                <div class="sip-kpi-value">${esc(MockFmt.baht(b.amount))}</div>
                <div class="sip-kpi-label">${esc(b.label)} · ${esc(b.count)} ใบ${
                    b.key === cur ? ' (กรองอยู่)' : ''}</div>
            </div>`).join('');
    },

    setAging(key) {
        const el = document.getElementById('fAging');
        el.value = el.value === key ? 'all' : key;
        this.render();
    },

    /* ── เลือกหลายใบ ── */

    toggle(id, el) {
        if (el.checked) this.state.selected.add(id); else this.state.selected.delete(id);
    },

    toggleAll(el) {
        const rows = this.visible();
        if (el.checked) rows.forEach(b => this.state.selected.add(b.id));
        else rows.forEach(b => this.state.selected.delete(b.id));
        this.render();
    },

    /* ── ตรวจใบเรียกเก็บรายบรรทัด ── */

    openVerify(billId) {
        const b = MockRefer.billById(billId); if (!b) return;
        const r = MockRefer.byId(b.refer_id) || {};
        const flags = this.billFlags(b);

        Drawer.open({
            title: `ตรวจใบเรียกเก็บ — ${b.id}`,
            contentHtml: `
                <div class="ds-note" style="margin-bottom:12px">
                    <i data-lucide="file-text" class="icon-sm"></i>
                    ${esc(b.bill_no)} · ${esc(MockFmt.dateTH(b.bill_date))} · ${esc(r.partner_name || '')}<br>
                    <span class="td-sub">${esc(r.patient || '')} · ขอบเขต ${esc(MockRefer.scopeLabel(r))} ·
                    วงเงินที่อนุมัติ ${esc(MockFmt.baht(r.cap_amount))} บาท ·
                    ใบส่งตัวมีผลถึง ${esc(MockFmt.dateTH(r.expires_at))}</span>
                </div>
                ${flags.length ? `<div class="sip-banner sip-banner-danger" style="margin-bottom:12px">
                    <i data-lucide="alert-triangle" class="icon-sm"></i>
                    <span>${flags.map(f => esc(f.label) + ' — ' + esc(f.detail)).join('<br>')}</span>
                </div>` : ''}
                <div class="ds-section-label">เลือกรายการที่อนุมัติจ่าย — ที่ไม่ติ๊กจะถูกบันทึกเป็นการโต้แย้ง</div>
                <div class="table-responsive">
                <table class="data-table compact">
                    <thead><tr><th style="width:1%">จ่าย</th><th>รายการ</th>
                        <th style="width:1%;text-align:right">จำนวนเงิน</th><th style="width:1%">ขอบเขต</th></tr></thead>
                    <tbody>${(b.items || []).map((it, i) => `<tr>
                        <td><input type="checkbox" class="vItem" data-i="${i}" data-amt="${it.amount}"
                                   ${it.in_scope === false ? '' : 'checked'} onchange="ReferBilling.recalcVerify()"></td>
                        <td>${esc(it.name)}${it.note ? `<div class="td-sub">${esc(it.note)}</div>` : ''}</td>
                        <td style="text-align:right">${esc(MockFmt.baht(it.amount))}</td>
                        <td>${it.in_scope === false
                            ? '<span class="sip-chip sip-chip-danger">นอกขอบเขต</span>'
                            : '<span class="sip-chip sip-chip-success">ในขอบเขต</span>'}</td>
                    </tr>`).join('')}</tbody>
                </table>
                </div>
                <div class="sip-banner sip-banner-info" style="margin-top:12px">
                    <i data-lucide="calculator" class="icon-sm"></i>
                    <span>อนุมัติจ่าย <strong id="vApproved">0</strong> บาท ·
                          โต้แย้ง <strong id="vDisputed">0</strong> บาท</span>
                </div>
                <div class="sip-field">
                    <label class="sip-label">เหตุผลการโต้แย้ง (ถ้ามี)</label>
                    <textarea class="sip-textarea" id="vReason" rows="3">${
                        esc(MockRefer.billOutOfScope(b) ? 'รายการนอกขอบเขตใบส่งตัวและเกินจำนวนครั้งที่อนุมัติ' : '')}</textarea>
                </div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                         <button class="btn btn-save" onclick="ReferBilling.saveVerify('${esc(b.id)}')">บันทึกผลตรวจ</button>`,
            onOpen: () => { refreshIcons(); ReferBilling.recalcVerify(); },
        });
    },

    recalcVerify() {
        let ok = 0, no = 0;
        document.querySelectorAll('.vItem').forEach(el => {
            const amt = Number(el.dataset.amt) || 0;
            if (el.checked) ok += amt; else no += amt;
        });
        document.getElementById('vApproved').textContent = MockFmt.baht(ok);
        document.getElementById('vDisputed').textContent = MockFmt.baht(no);
    },

    saveVerify(billId) {
        const keep = [...document.querySelectorAll('.vItem')].filter(e => e.checked).map(e => e.dataset.i);
        const res  = MockRefer.verifyBill(billId, {
            approvedCodes: keep,
            reason: document.getElementById('vReason').value.trim(),
            by: MockSession.userId(),
            byName: MockSession.user().full_name,
        });
        Drawer.close();
        showToast(res.disputed
            ? `บันทึกแล้ว — อนุมัติจ่าย ${MockFmt.baht(res.approved)} บาท · โต้แย้ง ${MockFmt.baht(res.disputed)} บาท`
            : `อนุมัติจ่ายทั้งใบ ${MockFmt.baht(res.approved)} บาท`);
        this.render();
    },

    /** อนุมัติจ่ายหลายใบ — บล็อกใบที่ยังมีธง ERROR เหมือนด่านก่อนส่งเบิกของหน้าเคลม */
    async approveSelected() {
        const ids = [...this.state.selected];
        if (!ids.length) { showToast('ยังไม่ได้เลือกใบเรียกเก็บ', 'warning'); return; }

        const bills   = ids.map(i => MockRefer.billById(i)).filter(Boolean);
        const blocked = bills.filter(b => this.billFlags(b).some(f => f.tone === 'sip-chip-danger'));
        const ready   = bills.filter(b => !this.billFlags(b).some(f => f.tone === 'sip-chip-danger'));

        if (blocked.length) {
            Drawer.open({
                title: 'ยังอนุมัติจ่ายไม่ได้',
                contentHtml: `
                    <div class="sip-banner sip-banner-danger">
                        <i data-lucide="x-circle" class="icon-sm"></i>
                        มี ${blocked.length} ใบที่ยังมีประเด็นค้าง — จ่ายไปแล้วเรียกคืนยาก
                        ${ready.length ? `· อีก ${ready.length} ใบพร้อมจ่าย` : ''}
                    </div>
                    <table class="data-table compact"><thead><tr>
                        <th>เลขที่ใบ</th><th>คู่สัญญา</th><th style="text-align:right">ยอด</th><th>ประเด็น</th>
                    </tr></thead><tbody>${blocked.map(b => {
                        const r = MockRefer.byId(b.refer_id) || {};
                        return `<tr>
                            <td class="td-sub">${esc(b.id)}</td>
                            <td class="td-sub">${esc(r.partner_name || '')}</td>
                            <td style="text-align:right">${esc(MockFmt.baht(MockRefer.billTotal(b)))}</td>
                            <td>${this.billFlags(b).map(f => `<span class="sip-chip ${esc(f.tone)}">${esc(f.label)}</span>`).join(' ')}</td>
                        </tr>`;
                    }).join('')}</tbody></table>
                    <div class="ds-note"><i data-lucide="shield-check" class="icon-sm"></i>
                        เปิดใบทีละใบเพื่อตรวจรายบรรทัด แล้วโต้แย้งเฉพาะส่วนที่อยู่นอกขอบเขต —
                        ไม่ใช่ปฏิเสธทั้งใบหรือจ่ายทั้งใบ</div>`,
                footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>
                    ${ready.length ? `<button class="btn btn-save"
                        onclick="Drawer.close(); ReferBilling.doApprove(${JSON.stringify(ready.map(b => b.id)).replace(/"/g, '&quot;')})">
                        อนุมัติจ่าย ${ready.length} ใบที่พร้อม</button>` : ''}`,
                onOpen: () => refreshIcons(),
            });
            return;
        }

        this.doApprove(ready.map(b => b.id));
    },

    async doApprove(ids) {
        const bills = ids.map(i => MockRefer.billById(i)).filter(Boolean);
        if (!bills.length) return;
        const total = bills.reduce((a, b) => a + MockRefer.billOutstand(b), 0);

        const ok = await Drawer.confirm({
            title: `อนุมัติจ่าย ${bills.length} ใบ?`,
            message: `ยอดรวม ${MockFmt.baht(total)} บาท — ระบบจะบันทึกผู้อนุมัติและเวลาลง Audit Trail`,
            lines: bills.slice(0, 6).map(b => {
                const r = MockRefer.byId(b.refer_id) || {};
                return `${b.id} · ${r.partner_name || ''} · ${MockFmt.baht(MockRefer.billTotal(b))} บาท`;
            }),
            confirmText: 'อนุมัติจ่าย', danger: false,
        });
        if (!ok) return;

        bills.forEach(b => MockRefer.verifyBill(b.id, {
            approvedCodes: (b.items || []).map((_, i) => String(i)),
            notes: 'อนุมัติจ่ายทั้งใบจากหน้าตามจ่าย/เรียกเก็บ',
            by: MockSession.userId(), byName: MockSession.user().full_name,
        }));

        this.state.selected.clear();
        showToast(`อนุมัติจ่าย ${bills.length} ใบ รวม ${MockFmt.baht(total)} บาทแล้ว`);
        this.render();
    },

    /* ── ใบพิมพ์ ── */

    printBill(billId) {
        const b = MockRefer.billById(billId);
        if (!b) { showToast('ไม่พบใบเรียกเก็บ', 'error'); return; }
        location.href = 'refer-case.html?id=' + encodeURIComponent(b.refer_id);
    },

    buildReport() {
        const C = DocParts.CELL;
        const warnings = [];
        const rows = this.REFERRAL_VIEWS[this.state.flag] ? [] : this.visible();

        const th = (t, w) => `<th style="${C}font-size:11px;font-weight:700;text-align:center;`
                           + `${w ? 'width:' + w + ';' : ''}">${DocParts.esc(t)}</th>`;

        const body = rows.map((b, i) => {
            const r = MockRefer.byId(b.refer_id) || {};
            return `<tr>
                <td style="${C}text-align:center;">${i + 1}</td>
                <td style="${C}">${DocParts.esc(b.bill_no)}</td>
                <td style="${C}text-align:center;">${DocParts.esc(b.direction === 'OUT' ? 'ตามจ่าย' : 'เรียกเก็บ')}</td>
                <td style="${C}">${DocParts.esc(r.partner_name || '')}</td>
                <td style="${C}">${DocParts.esc(r.patient || '')}</td>
                <td style="${C}text-align:center;">${DocParts.esc(MockFmt.dateTH(b.bill_date))}</td>
                <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(MockRefer.billTotal(b)))}</td>
                <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(b.approved_amount))}</td>
                <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(b.disputed_amount))}</td>
                <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(MockRefer.billOutstand(b)))}</td>
                <td style="${C}text-align:center;">${DocParts.esc(MockRefer.billAge(b))}</td>
                <td style="${C}text-align:center;" class="${DocPrint.miss(
                    (REFER_BILL_STATUS[b.status] || {}).label, 'สถานะของ ' + b.id, warnings)}">
                    ${DocParts.esc((REFER_BILL_STATUS[b.status] || {}).label || '')}</td>
            </tr>`;
        }).join('');

        const np = MockRefer.netPosition();
        const fields = [
            ['ทิศทาง', this.state.dir === 'all' ? 'ทั้งสองทิศทาง' : MockRefer.dirMeta(this.state.dir).label],
            ['จำนวนใบ', rows.length + ' ใบ'],
            ['ยอดตามจ่ายค้าง (AP)', MockFmt.baht(np.ap) + ' บาท'],
            ['ยอดเรียกเก็บค้าง (AR)', MockFmt.baht(np.ar) + ' บาท'],
            ['สถานะสุทธิ', MockFmt.baht(np.net) + ' บาท'],
            ['ผู้พิมพ์', MockSession.user().full_name],
        ];

        const aging = MockRefer.agingBuckets(this.state.dir === 'all' ? null : this.state.dir);
        const agingRows = aging.map(a => `<tr>
            <td style="${C}">${DocParts.esc(a.label)}</td>
            <td style="${C}text-align:center;">${DocParts.esc(a.count)}</td>
            <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(a.amount))}</td>
        </tr>`).join('');

        const html = `<div style="color:#000;font-size:12px;">
            ${DocParts.docHead({ title: 'รายงานยอดพึงรับ–พึงจ่ายจากการส่งต่อผู้ป่วย', formCode: 'REF-AR/2569', fields })}

            <div style="font-weight:700;margin:10px 0 4px">1. สรุปอายุหนี้คงค้าง</div>
            <table style="width:60%;border-collapse:collapse;">
                <thead><tr>${th('ช่วงอายุหนี้')}${th('จำนวนใบ', '70px')}${th('ยอดคงค้าง', '110px')}</tr></thead>
                <tbody>${agingRows}</tbody>
            </table>

            <div style="font-weight:700;margin:12px 0 4px">2. รายละเอียดใบเรียกเก็บ</div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>
                    ${th('ที่', '28px')}${th('เลขที่ใบ', '96px')}${th('ประเภท', '56px')}${th('คู่สัญญา', '18%')}
                    ${th('ผู้ป่วย')}${th('วันที่', '64px')}${th('ยอด', '66px')}${th('อนุมัติ', '66px')}
                    ${th('โต้แย้ง', '60px')}${th('คงค้าง', '66px')}${th('อายุ', '38px')}${th('สถานะ', '76px')}
                </tr></thead>
                <tbody>${DocParts.fillRows(body, 16, 12)}</tbody>
            </table>

            ${DocParts.signatureBlock(['ลงชื่อ ผู้จัดทำ', 'ลงชื่อ หัวหน้าฝ่ายการเงิน'])}
            ${DocParts.footer(fields)}
        </div>`;

        return { html: DocParts.toPrintBorders(html), warnings };
    },

    openPrint() {
        if (this.REFERRAL_VIEWS[this.state.flag]) {
            showToast('สลับกลับไปมุมมองใบเรียกเก็บก่อนพิมพ์', 'warning'); return;
        }
        if (!this.visible().length) { showToast('ยังไม่มีรายการให้พิมพ์', 'warning'); return; }
        const { html, warnings } = this.buildReport();
        DocPrint.preview({ title: 'ตัวอย่างก่อนพิมพ์ — ยอดพึงรับ–พึงจ่ายจากการส่งต่อ', html, warnings });
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.ReferBilling = ReferBilling;
document.addEventListener('DOMContentLoaded', () => ReferBilling.init());
