/* ────────────────────────────────────────────────────────
   ส่งเบิก NHSO — รายการส่งเบิก

   หน้านี้จงใจให้หน้าตาใกล้เคียงหน้าจอจริงของ NHSO Digital Platform
   เพื่อให้เจ้าหน้าที่ที่เคยใช้ระบบ สปสช. จำได้ทันที
   สิ่งที่เพิ่มเข้ามาคือคอลัมน์เดียว: "ตรวจก่อนส่ง (ระบบเรา)"
   ที่บอกล่วงหน้าว่าเคสนี้จะติดรหัสอะไร — คือทั้งหมดของข้อเสนอนี้
   ──────────────────────────────────────────────────────── */

const NhsoSubmit = {

    state: { stage: 'all', sub: 'all', selected: new Set(), advanced: false },

    init() {
        MockSession.mountBanner('demoBanner');

        const p = new URLSearchParams(location.search);
        if (p.get('stage')) this.state.stage = p.get('stage');

        this.fillFilters();
        this.renderBuckets();
        this.renderStepper();
        if (p.get('filter') === 'files') this.setFileFilter();
        else this.render();
    },

    fillFilters() {
        const cases = MockNhso.cases();
        const funds = [...new Set(cases.map(c => c.fund))].sort();
        document.getElementById('fFund').insertAdjacentHTML('beforeend',
            funds.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join(''));

        /* สิทธิหลัก/สิทธิย่อย ตามที่หน้าจอ สปสช. ใช้ (UCS / SSS / WEL) */
        const rights = [...new Set(cases.map(c => c.nhso.main_right))].sort();
        document.getElementById('fRight').insertAdjacentHTML('beforeend',
            rights.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join(''));
    },

    /* ══════════ 2 ถัง — ตอนนี้งานอยู่ที่ใคร ══════════ */

    renderBuckets() {
        document.getElementById('amountLegend').innerHTML = NHSO_AMOUNT_LEGEND.map(a =>
            `<span class="sip-chip sip-chip-muted">
                <span class="ds-dot ds-dot-${esc(a.tone)}"></span> ${esc(a.label)}</span>`).join(' ');

        const buckets = MockNhso.bucketStats();
        const total   = buckets.reduce((a, b) => a + b.count, 0) || 1;

        document.getElementById('ownerBuckets').innerHTML = buckets.map(b => `
            <div class="clinical-card" style="cursor:pointer" onclick="NhsoSubmit.setStage('${esc(b.stages[0].key)}')">
                <div class="section-header" style="padding:0;border:none;margin-bottom:6px">
                    <div class="card-title"><i data-lucide="${b.icon}" class="mi"></i> ${esc(b.label)}</div>
                    <div class="section-actions">
                        <span class="sip-chip sip-chip-muted">${Math.round(b.count / total * 100)}%</span></div>
                </div>
                <div style="font-size:26px;font-weight:800;color:var(--brand-navy)">
                    ${MockFmt.int(b.count)} <span style="font-size:13px;font-weight:600">รายการ</span></div>
                <div style="margin:4px 0 8px">
                    <span class="ds-amt ds-amt-billed">${MockFmt.baht(b.billed)}</span>
                    <span class="td-sub"> / </span>
                    <span class="ds-amt ds-amt-comp">${MockFmt.baht(b.compensated)}</span>
                    <span class="td-sub"> บาท</span>
                </div>
                <div class="td-sub" style="margin-bottom:8px">${esc(b.note)}</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px">
                    ${b.stages.map(s => `<span class="sip-chip sip-chip-muted">
                        ${esc(s.label)} <strong>${s.count}</strong></span>`).join('')}
                </div>
            </div>`).join('');
    },

    /* ══════════ แถบขั้นตอน ══════════ */

    renderStepper() {
        const stats = MockNhso.stageStats();
        const curIdx = this.state.stage === 'all' ? -1 : MockNhso.stageIndex(this.state.stage);

        const all = `<span class="ds-step ${this.state.stage === 'all' ? 'active' : ''}"
            style="cursor:pointer" onclick="NhsoSubmit.setStage('all')">ทั้งหมด (${MockNhso.cases().length})</span>`;

        document.getElementById('stageStepper').innerHTML = all + stats.map((s, i) => {
            const cls = this.state.stage === s.key ? 'active' : (curIdx > -1 && i < curIdx ? 'completed' : '');
            return `<span class="ds-step ${cls}" style="cursor:pointer" onclick="NhsoSubmit.setStage('${esc(s.key)}')"
                       title="${esc(s.desc)} · ดำเนินการโดย ${esc(s.by)} · ยอดเรียกเก็บ ${
                           esc(MockFmt.baht(s.billed))} / ยอดชดเชย ${esc(MockFmt.baht(s.compensated))} บาท">
                       ${esc(s.label)} <strong>(${s.count})</strong></span>`;
        }).join('');
        refreshIcons();
    },

    setStage(key) {
        this.state.stage = key;
        this.state.sub   = 'all';
        this.renderStepper();
        this.render();
    },

    setSub(label) { this.state.sub = label; this.render(); },

    renderSubBar() {
        const bar = document.getElementById('subBar');
        const st  = NHSO_STATUS_PIPELINE.find(s => s.key === this.state.stage);
        if (!st || st.sub.length < 2) { bar.innerHTML = ''; return; }

        const rows = MockNhso.byStage(st.key);
        bar.innerHTML = `<div class="ds-segbar">
            <button class="ds-seg ${this.state.sub === 'all' ? 'active' : ''}"
                onclick="NhsoSubmit.setSub('all')">ทั้งหมด (${rows.length})</button>
            ${st.sub.map(s => {
                const n = rows.filter(c => c.nhso.sub_status === s.label).length;
                return `<button class="ds-seg ${this.state.sub === s.label ? 'active' : ''}"
                    onclick="NhsoSubmit.setSub('${esc(s.label)}')">
                    ${s.code ? `<strong>${esc(s.code)}</strong> · ` : ''}${esc(s.label)} (${n})</button>`;
            }).join('')}
        </div>`;
    },

    /* ══════════ ตาราง ══════════ */

    /** ค่าจากช่องกรอก — คืน '' ถ้าไม่มี element (กันหน้าเก่าพัง) */
    _v(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; },

    toggleAdvanced() {
        this.state.advanced = !this.state.advanced;
        document.getElementById('advBox').style.display = this.state.advanced ? '' : 'none';
        document.getElementById('advBtnText').textContent =
            this.state.advanced ? 'ซ่อนการค้นหาขั้นสูง' : 'เพิ่มการค้นหาขั้นสูง';
        refreshIcons();
    },

    clearFilters() {
        ['fSeq', 'fInvoice', 'fHn', 'fAn', 'fRef', 'fUid', 'fFrom', 'fTo', 'searchBox']
            .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        ['fRight', 'fFiles', 'fFund', 'fService']
            .forEach(id => { const el = document.getElementById(id); if (el) el.selectedIndex = 0; });
        this.render();
    },

    /** ลัดจาก KPI "ส่งแฟ้มไม่ครบ" — เปิดขั้นสูงแล้วตั้งค่าให้เลย */
    setFileFilter() {
        if (!this.state.advanced) this.toggleAdvanced();
        document.getElementById('fFiles').value = 'incomplete';
        this.render();
    },

    visible() {
        const kw    = this._v('searchBox').toLowerCase();
        const fund  = this._v('fFund')    || 'all';
        const svc   = this._v('fService') || 'all';
        const right = this._v('fRight')   || 'all';
        const files = this._v('fFiles')   || 'all';
        const seq   = this._v('fSeq'),  inv = this._v('fInvoice');
        const hn    = this._v('fHn'),   an  = this._v('fAn');
        const ref   = this._v('fRef'),  uid = this._v('fUid');
        const from  = this._v('fFrom'), to  = this._v('fTo');

        const has = (v, q) => !q || String(v || '').toLowerCase().includes(q.toLowerCase());

        return MockNhso.cases().filter(c => {
            const n = c.nhso;
            if (this.state.stage !== 'all' && n.stage !== this.state.stage) return false;
            if (this.state.sub   !== 'all' && n.sub_status !== this.state.sub) return false;
            if (fund  !== 'all' && c.fund !== fund) return false;
            /* หน้าจอจริงจับ OP กับ PP ไว้ด้วยกันเป็น "OP/PP" */
            if (svc === 'OPD' && !['OPD', 'PP'].includes(c.service_type)) return false;
            if (svc === 'PP'  && c.service_type !== 'PP')  return false;
            if (svc === 'IPD' && c.service_type !== 'IPD') return false;
            if (right !== 'all' && n.main_right !== right) return false;

            if (files !== 'all') {
                const ok = MockClaims.fileCheck(c).ok;
                if (files === 'incomplete' && ok) return false;
                if (files === 'complete'  && !ok) return false;
            }

            if (!has(n.seq, seq) || !has(n.invoice_no, inv)) return false;
            if (!has(c.hn, hn)   || !has(c.an, an))          return false;
            if (!has(n.ref_no, ref) || !has(n.uid, uid))     return false;
            if (from && c.service_date < from) return false;
            if (to   && c.service_date > to)   return false;

            if (kw && !(`${n.seq} ${n.invoice_no} ${c.hn} ${c.an || ''} ${c.patient} `
                      + `${n.ref_no || ''} ${n.uid || ''}`).toLowerCase().includes(kw)) return false;
            return true;
        });
    },

    render() {
        this.renderSubBar();
        const rows  = this.visible();
        const tbody = document.getElementById('rows');

        document.getElementById('stageTitle').textContent =
            this.state.stage === 'all' ? 'รายการทั้งหมด' : MockNhso.stageLabel(this.state.stage);

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="14" class="ds-empty">ไม่พบรายการตามเงื่อนไขที่ค้นหา</td></tr>';
        } else {
            tbody.innerHTML = rows.map(c => {
                const n = c.nhso;
                const codes = MockClaims.predictedCodes(c);
                const errs  = (n.errors || []).map(e => e.code);
                const fc    = MockClaims.fileCheck(c);

                /* รหัสที่ยังยืนยันกับเอกสารไม่ได้ ต้องขึ้นดอกจันเสมอ */
                const mark = k => MockClaims.codeVerified(k) ? '' : '<sup title="'
                    + esc(NHSO_UNVERIFIED_NOTE) + '">*</sup>';

                /* คอลัมน์ชี้ขาด: ถ้า NHSO ตอบกลับมาแล้วให้โชว์ของจริง
                   ถ้ายังไม่ส่ง ให้โชว์สิ่งที่กฎเราทำนายไว้ */
                let pre;
                if (errs.length) {
                    pre = errs.map(k => `<span class="sip-chip sip-chip-danger">${esc(k)}${mark(k)}</span>`).join(' ')
                        + '<div class="td-sub">สปสช. ตอบกลับแล้ว</div>';
                } else if (codes.length) {
                    pre = codes.map(k => `<span class="sip-chip sip-chip-danger" title="${esc(NHSO_ERR_TEXT[k] || '')}">คาดว่าจะติด ${esc(k)}${mark(k)}</span>`).join(' ')
                        + '<div class="td-sub">ตรวจพบก่อนส่ง</div>';
                } else if (!fc.ok) {
                    pre = '<span class="sip-chip sip-chip-danger">แฟ้มไม่ครบ</span>'
                        + '<div class="td-sub">RUL-FIL-001</div>';
                } else {
                    pre = '<span class="sip-chip sip-chip-success">พร้อมส่ง</span>';
                }

                const vc = MockNhso.visitClose(c.visit_close) || {};

                return `<tr style="cursor:pointer" onclick="NhsoSubmit.open(${esc(n.seq)})">
                    <td onclick="event.stopPropagation()">
                        <input type="checkbox" ${this.state.selected.has(c.id) ? 'checked' : ''}
                               onclick="NhsoSubmit.toggle('${esc(c.id)}', this)"></td>
                    <td class="td-sub" style="white-space:nowrap">${esc(n.seq)}
                        <div class="td-sub">${esc(n.invoice_no)}</div></td>
                    <td class="td-sub">${esc(c.hn)}
                        <div class="td-sub">${esc(c.an || '—')}</div></td>
                    <td class="td-name">${esc(c.patient)}
                        <div class="td-sub" style="font-family:var(--font-mono,monospace);font-size:10.5px">${
                            esc(n.uid || '—')}</div></td>
                    <td class="td-sub" style="white-space:nowrap">${esc(n.main_right)}
                        <div class="td-sub">${esc(n.sub_right)}</div></td>
                    <td class="td-sub">${esc(c.provider)}</td>
                    <td class="td-sub" style="white-space:nowrap">${esc(MockFmt.dateTH(c.service_date))}
                        <div class="td-sub">ปิด Visit: ${esc(vc.label || '—')}</div></td>
                    <td class="td-sub">${esc(c.service_type === 'IPD' ? 'IP' : c.service_type === 'OPD' ? 'OP' : 'PP')}</td>
                    <td style="text-align:right;white-space:nowrap">
                        <span class="ds-amt ds-amt-billed">${esc(MockFmt.baht(c.amount_claimed))}</span>
                        <div class="ds-amt ds-amt-comp">${esc(MockFmt.baht(n.compensated || 0))}</div></td>
                    <td style="white-space:nowrap">
                        <span class="status-badge ${esc(MockNhso.stageBadge(n.stage))}">${
                            n.status_code ? esc(n.status_code) + ' · ' : ''}${esc(n.sub_status)}</span></td>
                    <td style="white-space:nowrap">${fc.ok
                        ? `<span class="sip-chip sip-chip-success">${fc.required.length} แฟ้ม</span>`
                        : `<span class="sip-chip sip-chip-danger" title="ขาด ${esc(MockNhso.fileNames(fc.missing))}">ขาด ${fc.missing.length}</span>`}</td>
                    <td style="white-space:nowrap">${pre}</td>
                    <td class="td-sub" style="white-space:nowrap">${esc(n.ref_no || '—')}
                        <div class="td-sub">${esc(n.prev_ref || '—')}</div></td>
                    <td style="white-space:nowrap" onclick="event.stopPropagation()">
                        <button class="ds-icon-btn" title="เรียกดู" onclick="NhsoSubmit.open(${esc(n.seq)})">
                            <i data-lucide="eye" class="icon-sm"></i></button>
                        <button class="ds-icon-btn edit" title="ชี้แจงรายการก่อนส่งเบิก"
                            onclick="NhsoSubmit.openClarify('${esc(c.id)}')">
                            <i data-lucide="file-plus-2" class="icon-sm"></i></button>
                    </td>
                </tr>`;
            }).join('');
        }

        const all   = MockNhso.cases();
        const await_ = MockNhso.byStage('AWAIT_SUBMIT');
        const fix    = MockNhso.byStage('AWAIT_FIX');
        const pay    = MockNhso.byStage('AWAIT_PAY');
        const clean  = all.filter(c =>
            !MockClaims.predictedCodes(c).length && MockClaims.fileCheck(c).ok).length;

        const pair = rows.reduce((a, c) => ({
            billed: a.billed + c.amount_claimed,
            comp:   a.comp   + (c.nhso.compensated || 0),
        }), { billed: 0, comp: 0 });

        document.getElementById('rowCount').innerHTML = `${rows.length} รายการ ·
            <span class="ds-amt ds-amt-billed">${esc(MockFmt.baht(pair.billed))}</span> /
            <span class="ds-amt ds-amt-comp">${esc(MockFmt.baht(pair.comp))}</span> บาท`;
        document.getElementById('kpiAwait').textContent = MockFmt.int(await_.length);
        document.getElementById('kpiFix').textContent   = MockFmt.int(fix.length);
        document.getElementById('kpiPay').textContent   = MockFmt.baht(
            pay.reduce((a, c) => a + c.amount_claimed, 0), { short: true });
        document.getElementById('kpiFiles').textContent = MockFmt.int(MockClaims.filesIncomplete().length);
        document.getElementById('kpiPre').textContent   = all.length
            ? Math.round((clean / all.length) * 100) + '%' : '0%';

        this.renderBulkBar();
        refreshIcons();
    },

    /** ปุ่มกลุ่มชุดเดียวกับหน้าจอ สปสช. — โผล่เมื่อเลือกรายการแล้ว */
    renderBulkBar() {
        const bar = document.getElementById('bulkBar');
        const n = this.state.selected.size;
        if (!n) { bar.style.display = 'none'; bar.innerHTML = ''; return; }
        bar.style.display = '';
        bar.innerHTML = `
            <span class="ds-bulk-count">เลือกไว้ ${n} รายการ</span>
            <button class="btn btn-primary btn-sm" onclick="NhsoSubmit.submitSelected()">
                <i data-lucide="send" class="icon-sm"></i> ส่งยืนยันและเบิกรายการที่เลือก</button>
            <button class="btn btn-outline btn-sm" onclick="NhsoSubmit.bulk('cancel')">
                <i data-lucide="undo-2" class="icon-sm"></i> ส่งยืนยันตรวจสอบและยกเลิกรายการส่งเบิก</button>
            <button class="btn btn-outline btn-sm" onclick="NhsoSubmit.bulk('edit')">
                <i data-lucide="pencil" class="icon-sm"></i> แก้ไขข้อมูล</button>
            <button class="btn btn-danger btn-sm" onclick="NhsoSubmit.bulk('delete')">
                <i data-lucide="trash-2" class="icon-sm"></i> ลบข้อมูลที่เลือก</button>
            <button class="btn btn-ghost btn-sm" onclick="NhsoSubmit.clearSelection()">ล้างการเลือก</button>`;
    },

    clearSelection() { this.state.selected.clear(); this.render(); },

    /**
     * ปุ่มกลุ่มในต้นแบบยังไม่เปลี่ยนสถานะจริง — แจ้งให้ชัดว่าเป็นเดโม
     * เมื่อผูก backend ให้แทนที่ด้วย fetch ไปยัง endpoint ของ สปสช.
     */
    bulk(kind) {
        const label = { cancel: 'ส่งยืนยันตรวจสอบและยกเลิกรายการส่งเบิก',
                        edit: 'แก้ไขข้อมูล', delete: 'ลบข้อมูลที่เลือก' }[kind] || kind;
        showToast(`${label} — ${this.state.selected.size} รายการ (โหมดสาธิต ยังไม่เปลี่ยนสถานะจริง)`, 'warning');
    },

    toggle(id, el) {
        if (el.checked) this.state.selected.add(id); else this.state.selected.delete(id);
        this.renderBulkBar();
        refreshIcons();
    },

    toggleAll(el) {
        const rows = this.visible();
        if (el.checked) rows.forEach(c => this.state.selected.add(c.id));
        else rows.forEach(c => this.state.selected.delete(c.id));
        this.render();
    },

    open(seq) { location.href = 'nhso-case.html?seq=' + encodeURIComponent(seq); },

    /* ══════════ Drawer A — ขั้นตอนการทำงาน (จำลอง popup ของ NHSO) ══════════ */

    openSteps() {
        const buckets = MockNhso.bucketStats();
        const mark = o => MockNhso.unverified(o)
            ? `<sup title="${esc(NHSO_UNVERIFIED_NOTE)}">*</sup>` : '';

        Drawer.open({
            title: 'ขั้นตอนการทำงาน',
            contentHtml: `
                <div class="ds-stepper" style="margin-bottom:16px">
                    ${MockNhso.stageStats().map(s => `<span class="ds-step">${esc(s.label)}</span>`).join('')}
                </div>

                ${buckets.map(b => `
                <div class="ds-section-label">${esc(b.label)} —
                    ${b.count} รายการ ·
                    <span class="ds-amt ds-amt-billed">${esc(MockFmt.baht(b.billed))}</span> /
                    <span class="ds-amt ds-amt-comp">${esc(MockFmt.baht(b.compensated))}</span> บาท</div>
                ${b.stages.map(s => `
                    <div class="section-card" style="margin-bottom:10px">
                        <div class="section-header">
                            <div class="section-title" style="font-size:13px">
                                ${esc(s.label)}
                                <span class="ds-pane-count">${s.count} รายการ</span>
                            </div>
                            <div class="section-actions">
                                <span class="sip-chip ${s.by === 'สปสช.' ? 'sip-chip-ack' : 'sip-chip-active'}">
                                    ดำเนินการโดย ${esc(s.by)}</span>
                            </div>
                        </div>
                        <div class="td-sub" style="margin-bottom:8px">${esc(s.desc)}</div>
                        <div style="display:flex;flex-wrap:wrap;gap:6px">
                            ${s.sub.map(x => `<span class="sip-chip sip-chip-muted">${
                                x.code ? `<strong>${esc(x.code)}</strong>${mark(x)} · ` : ''}${esc(x.label)}${
                                x.code ? '' : mark(x)}</span>`).join('')}
                        </div>
                    </div>`).join('')}`).join('')}

                <div class="ds-section-label" style="margin-top:14px">รหัสกิจกรรมในประวัติรายการ</div>
                <table class="ds-table-grid">
                    <thead><tr><th style="width:16%">รหัส</th><th style="width:28%">สถานะ</th><th>คำอธิบาย</th></tr></thead>
                    <tbody>${NHSO_ACTIVITY_CODES.map(a => `<tr>
                        <td class="c"><strong>${esc(a.code)}</strong>${mark(a)}</td>
                        <td class="l">${esc(a.label)}</td>
                        <td class="l" style="font-size:11px">${esc(a.desc)}</td>
                    </tr>`).join('')}</tbody>
                </table>

                <div class="ds-warn">
                    <i data-lucide="alert-triangle" class="icon-sm"></i>
                    <span><strong>* รอยืนยัน</strong> — ${esc(NHSO_UNVERIFIED_NOTE)}<br>
                    ชื่อสถานะ (ไม่มีดอกจัน) ยืนยันกับเอกสารได้แล้ว ส่วนรหัสตัวเลขถอดจากภาพหน้าจอ
                    เอกสาร Overview 23 มิ.ย. 2569 น.8 ระบุว่า สปสช. จะเผยแพร่แคตตาล็อก
                    "Error ที่พบบ่อย" พร้อมแนวทางแก้ไข — เมื่อได้มาจะแทนที่ทั้งชุด</span>
                </div>
                <div class="ds-note">
                    <i data-lucide="info" class="icon-sm"></i>
                    ที่มา: NHSO Digital Platform Communication V4 (3 ส.ค. 2569) และ
                    NHSO Digital Platform Overview (23 มิ.ย. 2569) น.22–24
                </div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    /* ══════════ Drawer B — ชี้แจงรายการก่อนส่งเบิก ══════════ */

    openClarify(id) {
        const c = MockClaims.byId(id); if (!c) return;
        Drawer.open({
            title: 'ชี้แจงรายการก่อนส่งเบิก — SEQ ' + c.nhso.seq,
            contentHtml: `
                <table class="ds-table-grid">
                    <tbody>
                        <tr><td class="l" style="width:32%">ผู้รับบริการ</td><td class="l">${esc(c.patient)} · HN ${esc(c.hn)}</td></tr>
                        <tr><td class="l">วันที่รับบริการ</td><td class="l">${esc(MockFmt.dateTH(c.service_date))}</td></tr>
                        <tr><td class="l">สถานะรายการ</td><td class="l">${
                            c.nhso.status_code ? esc(c.nhso.status_code) + ' — ' : ''}${esc(c.nhso.sub_status)}</td></tr>
                    </tbody>
                </table>

                <label class="sip-checkbox" style="margin:12px 0">
                    <input type="checkbox" id="clChk" onchange="NhsoSubmit.toggleClarify(this)">
                    ต้องการแนบเอกสารชี้แจงรายการก่อนส่งเบิก
                </label>

                <div id="clBody" style="display:none">
                    <div class="sip-field">
                        <label class="sip-label">ประเภทเอกสารชี้แจง</label>
                        <select class="sip-select" id="clType">
                            <option>หนังสือชี้แจงเหตุผลการเบิก</option>
                            <option>ความเห็นแพทย์ผู้รักษา</option>
                            <option>เอกสารรับรองราคา / ใบเสนอราคา</option>
                            <option>เอกสารยืนยันสิทธิ</option>
                        </select>
                    </div>
                    <div class="sip-field">
                        <label class="sip-label">ไฟล์แนบ</label>
                        <div class="ds-block"><i data-lucide="paperclip" class="icon-sm"></i>
                            เลือกไฟล์ (PDF / JPG ไม่เกิน 10 MB) — <span class="td-sub">โหมดต้นแบบ ยังไม่ผูกที่เก็บไฟล์จริง</span></div>
                    </div>
                    <div class="sip-field">
                        <label class="sip-label">คำชี้แจง</label>
                        <textarea class="sip-textarea" id="clNote" rows="4"
                            placeholder="อธิบายเหตุผลประกอบการเบิกให้เจ้าหน้าที่ สปสช. พิจารณา..."></textarea>
                    </div>
                </div>

                <div class="ds-note">
                    <i data-lucide="info" class="icon-sm"></i>
                    การแนบเอกสารชี้แจงตั้งแต่ก่อนส่ง ช่วยลดรอบ "ขอเอกสารเพิ่มเติม" ในขั้นตรวจสอบก่อนจ่าย
                </div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                         <button class="btn btn-save" onclick="NhsoSubmit.saveClarify('${esc(id)}')">บันทึกคำชี้แจง</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    toggleClarify(el) { document.getElementById('clBody').style.display = el.checked ? '' : 'none'; },

    saveClarify(id) {
        const on = document.getElementById('clChk').checked;
        if (!on) { showToast('ยังไม่ได้เลือกแนบเอกสารชี้แจง', 'warning'); return; }
        const type = document.getElementById('clType').value;
        const note = document.getElementById('clNote').value.trim();
        if (!note) { showToast('กรุณากรอกคำชี้แจง', 'warning'); return; }

        const c = MockClaims.byId(id);
        MockDB.patch('claims', id, {
            documents: [...(c.documents || []), {
                name: type, type: 'ชี้แจง', status: 'FOUND',
                by: MockSession.user().full_name, date: '2569-08-06' }],
            timeline: [...(c.timeline || []), {
                at: '2569-08-06T09:00', tone: 'info', title: 'แนบเอกสารชี้แจงรายการก่อนส่งเบิก',
                by: MockSession.user().full_name, note: `${type} · ${note}` }],
        });
        Drawer.close();
        showToast('บันทึกคำชี้แจงแล้ว');
        this.render();
    },

    /* ══════════ ส่งเบิก ══════════ */

    async submitSelected() {
        const ids = [...this.state.selected];
        if (!ids.length) { showToast('ยังไม่ได้เลือกรายการ', 'warning'); return; }

        const rows    = ids.map(i => MockClaims.byId(i)).filter(Boolean);
        const notReady = rows.filter(c => c.nhso.stage !== 'AWAIT_SUBMIT' && c.nhso.stage !== 'AWAIT_FIX');
        if (notReady.length) {
            showToast(`มี ${notReady.length} รายการที่อยู่ระหว่างดำเนินการฝั่ง สปสช. แล้ว`, 'warning');
            return;
        }

        /* ปิด Visit ไม่เป็น Complete = ส่งเบิกไม่ได้ตามเส้นทาง 7 ขั้น ขั้นที่ 4 */
        const notClosed = rows.filter(c => c.visit_close !== 'COMPLETE');
        if (notClosed.length) {
            showToast(`มี ${notClosed.length} รายการที่ยังปิด Visit ไม่เป็น Complete — ส่งเบิกไม่ได้ (RUL-VIS-001)`, 'warning');
            return;
        }

        /* แฟ้มไม่ครบตามกองทุน = ไม่ผ่านการตรวจสอบเบื้องต้นแน่นอน */
        const badFiles = rows.filter(c => !MockClaims.fileCheck(c).ok);
        if (badFiles.length) {
            Drawer.open({
                title: 'ยังส่งไม่ได้ — แฟ้มไม่ครบตามกองทุน',
                contentHtml: `
                    <div class="sip-banner sip-banner-danger">
                        <i data-lucide="file-x" class="icon-sm"></i>
                        ประกาศ สปสช. กำหนดแฟ้มที่ต้องส่งของแต่ละกองทุนไว้ชัดเจน
                        ${badFiles.length} รายการนี้ยังส่งแฟ้มไม่ครบ จะไม่ผ่านการตรวจสอบเบื้องต้น
                    </div>
                    <table class="data-table compact"><thead><tr>
                        <th>SEQ</th><th>ผู้ป่วย</th><th>กองทุน</th><th>แฟ้มที่ยังขาด</th>
                    </tr></thead><tbody>${badFiles.map(c => {
                        const r = MockClaims.fileCheck(c);
                        return `<tr>
                            <td class="td-sub">${esc(c.nhso.seq)}</td>
                            <td>${esc(c.patient)}</td>
                            <td class="td-sub">${esc(r.fundLabel)}</td>
                            <td><span class="sip-chip sip-chip-danger">${esc(MockNhso.fileNames(r.missing))}</span></td>
                        </tr>`;
                    }).join('')}</tbody></table>
                    <div class="ds-note"><i data-lucide="link" class="icon-sm"></i>
                        แฟ้มที่ขาดส่วนใหญ่มาจาก Mapping ที่ยังไม่เสร็จ — ดูงานก่อน UAT ข้อ 5</div>`,
                footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>
                             <button class="btn btn-navy" onclick="Drawer.close();location.href='nhso-import.html?tab=fundfile'">
                                 ดูตารางแฟ้มตามกองทุน</button>`,
                onOpen: () => refreshIcons(),
            });
            return;
        }

        const risky = rows.filter(c => MockClaims.predictedCodes(c).length);
        if (risky.length) {
            Drawer.open({
                title: 'ยังไม่ควรส่ง — ระบบคาดว่าจะถูกตีกลับ',
                contentHtml: `
                    <div class="sip-banner sip-banner-danger">
                        <i data-lucide="x-circle" class="icon-sm"></i>
                        มี ${risky.length} รายการที่กฎตรวจพบประเด็นค้าง ถ้าส่งไปตอนนี้จะได้รหัสข้อผิดพลาดกลับมา
                        และต้องเสียเวลาอีกหนึ่งรอบส่ง
                    </div>
                    <table class="data-table compact"><thead><tr>
                        <th>SEQ</th><th>ผู้ป่วย</th><th>รหัสที่คาดว่าจะติด</th><th>มูลค่าเสี่ยง</th><th>ผู้รับผิดชอบ</th>
                    </tr></thead><tbody>${risky.map(c => `<tr>
                        <td class="td-sub">${esc(c.nhso.seq)}</td>
                        <td>${esc(c.patient)}</td>
                        <td>${MockClaims.predictedCodes(c).map(k =>
                            `<span class="sip-chip sip-chip-danger">${esc(k)}</span>`).join(' ')}</td>
                        <td style="text-align:right">${esc(MockFmt.baht(c.amount_at_risk))}</td>
                        <td class="td-sub">${esc(MockAdmin.userName(c.owner))}</td>
                    </tr>`).join('')}</tbody></table>
                    <div class="ds-note"><i data-lucide="shield-check" class="icon-sm"></i>
                        นี่คือรอบที่ระบบตัดออกไปจากวงจรเดิม — แก้ให้จบก่อน แล้วส่งครั้งเดียวผ่าน</div>`,
                footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>
                             <button class="btn btn-navy" onclick="Drawer.close();location.href='claim-worklist.html?result=FIX'">
                                 ไปที่คิวแก้ไข</button>`,
                onOpen: () => refreshIcons(),
            });
            return;
        }

        const ok = await Drawer.confirm({
            title: `ส่งเบิก ${rows.length} รายการไปยัง สปสช.?`,
            message: 'ระบบจะสร้างไฟล์ตาม Standard Dataset แล้วส่งผ่าน API — สถานะจะเปลี่ยนเป็น "รอประมวลผล"',
            lines: rows.slice(0, 6).map(c => `SEQ ${c.nhso.seq} · ${c.patient} · ${MockFmt.baht(c.amount_claimed)} บาท`),
            confirmText: 'ส่งเบิก', danger: false,
        });
        if (!ok) return;

        const upload = 'A6908' + String(700000 + rows.length * 13);
        rows.forEach(c => MockDB.patch('claims', c.id, {
            nhso: { ...c.nhso, stage: 'AWAIT_PROCESS', status_code: null, sub_status: 'รอประมวลผล',
                    upload_id: upload, ref_no: c.nhso.ref_no || 'E6908' + String(10000000 + c.nhso.seq),
                    errors: [],
                    history: [...(c.nhso.history || []),
                        { at: '2569-08-06T09:00', code: 'F000', status: 'กำลังนำเข้าไฟล์',
                          act: `อัปโหลดไฟล์ ประกอบด้วย ${upload}.json`, by: c.provider },
                        { at: '2569-08-06T09:05', code: 'F001', status: 'กำลังตรวจสอบเบื้องต้น',
                          act: 'กำลังนำไฟล์มาตรวจสอบความเชื่อมโยง / ตรวจสอบเงื่อนไขความสมบูรณ์และเงื่อนไขตามประกาศ', by: 'NHSO' }] },
            timeline: [...(c.timeline || []), { at: '2569-08-06T09:00', tone: 'info',
                title: 'ส่งเบิกไปยัง NHSO', by: MockSession.user().full_name, note: 'UploadID ' + upload }],
        }));

        this.state.selected.clear();
        showToast(`ส่งเบิก ${rows.length} รายการแล้ว · UploadID ${upload}`);
        this.renderStepper();
        this.render();
    },

    /* ══════════ เส้นทาง 7 ขั้นฝั่งหน่วยบริการ ══════════ */

    toggleSteps7() {
        const body = document.getElementById('steps7Body');
        const btn  = document.getElementById('steps7Btn');
        const show = body.style.display === 'none';
        body.style.display = show ? '' : 'none';
        btn.innerHTML = show
            ? '<i data-lucide="chevron-up" class="icon-sm"></i> ซ่อน'
            : '<i data-lucide="chevron-down" class="icon-sm"></i> แสดง';
        if (show && !body.dataset.done) { body.innerHTML = this.steps7Html(); body.dataset.done = '1'; }
        refreshIcons();
    },

    steps7Html() {
        const closeMix = MockNhso.cases().reduce((a, c) => {
            a[c.visit_close] = (a[c.visit_close] || 0) + 1; return a;
        }, {});

        return `
        <div class="td-sub" style="margin-bottom:12px">
            มุมของหน่วยบริการ — เส้นทางนี้เกิดขึ้นก่อน Business Journey ฝั่งระบบ ·
            ขั้นที่ทำเครื่องหมายไว้คือขั้นที่ระบบเราเข้าไปช่วย
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:stretch">
            ${NHSO_JOURNEY_7STEP.map(s => `
                <div style="flex:1 1 190px;min-width:170px;padding:12px;border-radius:10px;
                     border:1px solid var(--brand-border);
                     ${s.ours ? 'background:var(--primary-bg);border-color:var(--primary)' : 'background:var(--surface)'}">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                        <span class="sip-chip sip-chip-muted">${s.no}</span>
                        <i data-lucide="${s.icon}" class="icon-sm"></i>
                    </div>
                    <div style="font-size:12.5px;font-weight:700">${esc(s.label)}</div>
                    <div class="ds-hint">${esc(s.sub)}</div>
                    ${s.ours ? '<div class="sip-chip sip-chip-active" style="margin-top:6px">ระบบเราช่วยตรงนี้</div>' : ''}
                </div>`).join('')}
        </div>

        <div class="ds-note" style="margin-top:12px">
            <i data-lucide="info" class="icon-sm"></i> ${esc(NHSO_JOURNEY_NOTE)}
        </div>

        <div class="ds-section-label" style="margin-top:14px">
            ขั้นที่ 4 — สถานะการปิด Visit ของรายการในระบบตอนนี้</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${NHSO_VISIT_CLOSE.map(v => `
                <span class="sip-chip ${v.submittable ? 'sip-chip-success' : 'sip-chip-danger'}">
                    ${esc(v.label)} · ${esc(v.th)} — <strong>${closeMix[v.key] || 0}</strong> รายการ
                    ${v.submittable ? '' : ' (ส่งเบิกไม่ได้)'}</span>`).join('')}
        </div>`;
    },

    /* ══════════ Business Journey ══════════ */

    toggleJourney() {
        const body = document.getElementById('journeyBody');
        const btn  = document.getElementById('journeyBtn');
        const show = body.style.display === 'none';
        body.style.display = show ? '' : 'none';
        btn.innerHTML = show
            ? '<i data-lucide="chevron-up" class="icon-sm"></i> ซ่อน'
            : '<i data-lucide="chevron-down" class="icon-sm"></i> แสดง';
        if (show && !body.dataset.done) { body.innerHTML = this.journeyHtml(); body.dataset.done = '1'; }
        refreshIcons();
    },

    TONE: {
        navy:  { bg: 'var(--brand-navy)',       fg: '#fff' },
        blue:  { bg: 'var(--primary-bg)',       fg: 'var(--primary-dark)' },
        green: { bg: 'var(--status-success-soft)', fg: 'var(--status-success-strong)' },
        amber: { bg: 'var(--brand-amber-100)',  fg: 'var(--brand-amber-600)' },
    },

    journeyHtml() {
        return NHSO_JOURNEY.map(lane => {
            const t = this.TONE[lane.tone] || this.TONE.blue;
            const steps = lane.steps.map(s => `
                <div style="flex:0 0 auto;min-width:130px;max-width:190px;padding:10px 12px;border-radius:10px;
                     background:${t.bg};color:${t.fg};border:1px solid var(--brand-border);
                     ${s.strong ? 'box-shadow:var(--sip-shadow-2);font-weight:700;' : ''}">
                    <div style="font-size:12px;font-weight:700">${esc(s.label)}</div>
                    ${s.sub ? `<div style="font-size:10px;opacity:.8;margin-top:2px">${esc(s.sub)}</div>` : ''}
                </div>`).join('<div style="align-self:center;color:var(--brand-border-strong)">→</div>');

            const pass = lane.pass ? `
                <div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px">
                    <span class="sip-chip sip-chip-success">✓ ผ่าน</span>
                    <span>${esc(lane.pass)}</span>
                </div>` : '';
            const fail = lane.fail ? `
                <div style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px;flex-wrap:wrap">
                    <span class="sip-chip sip-chip-danger">✕ ไม่ผ่าน</span>
                    <span class="sip-chip sip-chip-amber">Error</span>
                    ${lane.fail.map(f => `<span>${esc(f)}</span>`).join('<span style="color:var(--brand-border-strong)">→</span>')}
                </div>` : '';

            return `<div style="padding:14px 0;border-bottom:1px solid var(--brand-border)">
                <div class="ds-section-label" style="margin-bottom:8px">${esc(lane.lane)}</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:stretch">${steps}</div>
                ${pass}${fail}
            </div>`;
        }).join('') + `
        <div class="ds-note" style="margin-top:12px">
            <i data-lucide="lightbulb" class="icon-sm"></i>
            สังเกตวงจร "Error → ตรวจสอบหน้าจอ NHSO → หน่วยบริการแก้ไขที่ HIS → ส่งใหม่"
            — <strong>ระบบเราตัดวงจรนี้ทิ้ง</strong> ด้วยการรันกฎชุดเดียวกันตั้งแต่ก่อนกดส่ง
        </div>`;
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.NhsoSubmit = NhsoSubmit;
document.addEventListener('DOMContentLoaded', () => NhsoSubmit.init());
