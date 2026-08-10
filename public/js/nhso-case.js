/* ────────────────────────────────────────────────────────
   ส่งเบิก NHSO — รายละเอียดรายการที่นำเข้า

   แท็บและ sub-tab เรียงตรงตามหน้าจอจริงของ NHSO Digital Platform:
     ข้อมูลทั่วไป · ข้อมูลหน่วยบริการ · วินิจฉัยโรค/หัตถการ ·
     รายละเอียดค่าใช้จ่าย · Master Cup · ผลการตรวจสอบ · ประวัติการส่งเบิก

   สิ่งเดียวที่เพิ่มจากของ สปสช. คือแบนเนอร์บนสุด — บอกว่าระบบเราตรวจพบรหัสนี้
   ตั้งแต่ก่อนส่ง พร้อมลิงก์กลับไปที่เคสใน Claim Control Tower
   ──────────────────────────────────────────────────────── */

const NhsoCase = {

    state: { seq: null, filter: 'all', tab: 'general', sub: 'claimcase' },

    TABS: [
        { key: 'general',  label: 'ข้อมูลทั่วไป',        icon: 'user' },
        { key: 'provider', label: 'ข้อมูลหน่วยบริการ',    icon: 'hospital' },
        { key: 'dx',       label: 'วินิจฉัยโรค/หัตถการ',  icon: 'stethoscope' },
        { key: 'charge',   label: 'รายละเอียดค่าใช้จ่าย', icon: 'receipt' },
        { key: 'cup',      label: 'Master Cup',          icon: 'network' },
        { key: 'check',    label: 'ผลการตรวจสอบ',        icon: 'shield-alert' },
        { key: 'history',  label: 'ประวัติการส่งเบิก',    icon: 'history' },
    ],

    SUBTABS: [
        { key: 'claimcase', label: 'กรณีที่ขอเบิก' },
        { key: 'prenatal',  label: 'ประวัติการตั้งครรภ์/คลอดทารก' },
        { key: 'cmhs',      label: 'บริการผู้ป่วยจิตเวชเรื้อรัง' },
        { key: 'disability',label: 'บริการผู้พิการ' },
        { key: 'files',     label: 'ดูข้อมูลไฟล์แนบ' },
    ],

    init() {
        const p = new URLSearchParams(location.search);
        this.state.seq = p.get('seq');

        this.renderPills();
        this.renderList();
        const first = this.visible()[0];
        this.select(this.state.seq || (first ? first.nhso.seq : null));
    },

    current() { return this.state.seq ? MockNhso.bySeq(this.state.seq) : null; },

    /* ══════════ ซ้าย ══════════ */

    renderPills() {
        const stats = MockNhso.stageStats();
        const all   = MockNhso.cases().length;
        document.getElementById('pillTabs').innerHTML =
            `<button class="ds-pilltab ${this.state.filter === 'all' ? 'active' : ''}"
                onclick="NhsoCase.setFilter('all')">ทั้งหมด <span class="tab-count">${all}</span></button>` +
            stats.filter(s => s.count).map(s => `
                <button class="ds-pilltab ${this.state.filter === s.key ? 'active' : ''}"
                    onclick="NhsoCase.setFilter('${esc(s.key)}')">
                    ${esc(s.label)} <span class="tab-count">${s.count}</span></button>`).join('');
    },

    setFilter(k) { this.state.filter = k; this.renderPills(); this.renderList(); refreshIcons(); },

    visible() {
        const kw = (document.getElementById('listSearch').value || '').trim().toLowerCase();
        return MockNhso.cases().filter(c => {
            if (this.state.filter !== 'all' && c.nhso.stage !== this.state.filter) return false;
            if (kw && !(`${c.nhso.seq} ${c.hn} ${c.patient} ${c.nhso.ref_no || ''}`).toLowerCase().includes(kw)) return false;
            return true;
        });
    },

    renderList() {
        const rows = this.visible();
        document.getElementById('listCount').textContent = rows.length + ' รายการ';
        document.getElementById('listContainer').innerHTML = rows.length
            ? rows.map(c => `
                <div class="ds-list-card ${String(c.nhso.seq) === String(this.state.seq) ? 'active' : ''}"
                     onclick="NhsoCase.select(${esc(c.nhso.seq)})">
                    <div class="ds-list-card-top">
                        <span class="td-sub">SEQ ${esc(c.nhso.seq)}</span>
                        ${(c.nhso.errors || []).length
                            ? `<span class="sip-chip sip-chip-danger">${esc(c.nhso.errors.length)} ข้อผิดพลาด</span>`
                            : `<span class="sip-chip sip-chip-muted">${esc(c.nhso.sub_status)}</span>`}
                    </div>
                    <div class="ds-list-card-name">${esc(c.patient)}</div>
                    <div class="ds-list-card-detail">HN ${esc(c.hn)} · ${esc(MockFmt.dateTH(c.service_date))} ·
                        ${esc(MockFmt.baht(c.amount_claimed))} บาท</div>
                </div>`).join('')
            : '<div class="ds-empty">ไม่พบรายการ</div>';
        refreshIcons();
    },

    toggleLeft() { document.getElementById('shell').classList.toggle('left-collapsed'); },

    /* ══════════ เลือกรายการ ══════════ */

    select(seq) {
        this.state.seq = seq;
        const c = this.current();
        document.getElementById('emptyState').style.display = c ? 'none' : '';
        document.getElementById('detailWrap').style.display = c ? '' : 'none';
        if (!c) { this.renderList(); return; }

        history.replaceState(null, '', 'nhso-case.html?seq=' + encodeURIComponent(seq));

        this.renderContext(c);
        this.renderPreBanner(c);
        this.renderRefStrip(c);
        this.renderTabBar();
        this.renderTab(c);
        this.renderList();
        refreshIcons();
    },

    renderContext(c) {
        const n = c.nhso;
        document.getElementById('ctxAvatar').textContent =
            c.patient.replace(/^(นาย|นาง|นางสาว|ด\.ช\.|ด\.ญ\.)/, '').trim().charAt(0);
        document.getElementById('ctxName').textContent = c.patient;
        document.getElementById('ctxChip').innerHTML =
            `<span class="status-badge ${esc(MockNhso.stageBadge(n.stage))}">${
                n.status_code ? esc(n.status_code) + ' · ' : ''}${esc(n.sub_status)}</span>`;
        document.getElementById('ctxMeta').innerHTML = `
            <span>SEQ ${esc(n.seq)}</span>
            <span>HN ${esc(c.hn)}${c.an ? ' · AN ' + esc(c.an) : ''}</span>
            <span>หน่วยบริการ: ${esc(c.provider)} (${esc(c.provider_code)})</span>
            <span>วันที่รับบริการ: ${esc(MockFmt.dateTimeTH(c.service_date + 'T07:40'))}</span>
            <span>บริการ: ${esc(c.service_type === 'IPD' ? 'IP' : c.service_type === 'OPD' ? 'OP/PP' : 'PP')}</span>`;

        const errs = n.errors || [];
        const alert = document.getElementById('ctxAlert');
        if (errs.length) {
            alert.style.display = '';
            document.getElementById('ctxAlertText').textContent =
                `พบ ${errs.length} รายการ — ${errs.map(e => e.code).join(', ')}`;
        } else { alert.style.display = 'none'; }
    },

    /* ⭐ แบนเนอร์จุดขาย — วางบนหน้าจอที่เลียนแบบ สปสช. เอง */
    renderPreBanner(c) {
        const el = document.getElementById('preBanner');
        const errs  = (c.nhso.errors || []).map(e => e.code);
        const codes = MockClaims.predictedCodes(c);
        const caught = errs.filter(k => codes.includes(k));

        if (caught.length) {
            const rr = (c.rule_results || []).find(r => r.maps_to_nhso === caught[0]);
            el.innerHTML = `<div class="sip-banner sip-banner-info" style="margin-bottom:12px">
                <i data-lucide="shield-check" class="icon-sm"></i>
                <span>ระบบ <strong>Claim Control Tower</strong> ตรวจพบ
                <strong>${esc(caught.join(', '))}</strong> ด้วยกฎ ${esc(rr ? rr.rule_id + ' v' + rr.version : '')}
                ตั้งแต่ก่อนส่งเบิก — <a href="claim-case.html?id=${encodeURIComponent(c.id)}">เปิดเคส ${esc(c.id)}</a></span>
            </div>`;
        } else if (codes.length && c.nhso.stage === 'AWAIT_SUBMIT') {
            el.innerHTML = `<div class="sip-banner sip-banner-warning" style="margin-bottom:12px">
                <i data-lucide="alert-triangle" class="icon-sm"></i>
                <span>ยังไม่ได้ส่ง — ระบบเราคาดว่าจะได้ <strong>${esc(codes.join(', '))}</strong> กลับมา
                ควรปิดประเด็นก่อน · <a href="claim-case.html?id=${encodeURIComponent(c.id)}">เปิดเคส ${esc(c.id)}</a></span>
            </div>`;
        } else if (!errs.length && c.nhso.stage !== 'AWAIT_SUBMIT') {
            el.innerHTML = `<div class="sip-banner sip-banner-success" style="margin-bottom:12px">
                <i data-lucide="check-circle-2" class="icon-sm"></i>
                <span>ผ่านการตรวจก่อนส่งของระบบเรา และผ่านฝั่ง สปสช. ในรอบแรก (First-pass)</span>
            </div>`;
        } else { el.innerHTML = ''; }
    },

    renderRefStrip(c) {
        const n = c.nhso;
        const fc = MockClaims.fileCheck(c);
        const vc = MockNhso.visitClose(c.visit_close) || {};

        document.getElementById('refStrip').innerHTML = `
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">
                <span class="sip-chip sip-chip-muted">หมายเลขอ้างอิง ${esc(n.ref_no || '—')}</span>
                ${n.prev_ref ? `<span class="sip-chip sip-chip-amber"
                    title="รายการนี้เคยส่งแล้วถูกตีกลับ — เลขอ้างอิงเดิม">
                    รายการก่อนหน้า ${esc(n.prev_ref)}</span>` : ''}
                <span class="sip-chip sip-chip-muted">UID: ${esc(n.uid || '—')}</span>
                <span class="sip-chip sip-chip-muted">Invoice No.: ${esc(n.invoice_no || '—')}</span>
                <span class="sip-chip sip-chip-muted">UploadID: ${esc(n.upload_id || '—')}</span>
                <span class="sip-chip sip-chip-muted">รหัสโครงการพิเศษ: ${esc(n.special_project || '—')}</span>
                <span class="sip-chip ${vc.submittable ? 'sip-chip-success' : 'sip-chip-danger'}"
                      title="เส้นทาง 7 ขั้น ขั้นที่ 4 — ต้องเป็น Complete จึงส่งเบิกได้">
                    ปิด Visit: ${esc(vc.label || '—')}</span>
            </div>
            ${this.fileStripHtml(fc)}`;
    },

    /**
     * แถบ "แฟ้มที่ต้องส่งสำหรับกองทุนนี้"
     * เมทริกซ์กองทุน × แฟ้ม ของประกาศ สปสช. — ตรวจครบ/ขาดได้ทันทีตั้งแต่ก่อนส่ง
     */
    fileStripHtml(fc) {
        if (!fc || !fc.inScope.length) return '';
        const chip = no => {
            const f = MockNhso.file(no);
            const cond = MockNhso.fileCondition(no);
            const name = `${no} ${f ? f.en.replace(/^NHSO /, '') : ''}`;
            if (fc.missing.includes(no))
                return `<span class="sip-chip sip-chip-danger" title="${esc(f ? f.th : '')} — ยังไม่ได้ส่ง">
                    ✕ ${esc(name)}</span>`;
            if (fc.notApplicable.includes(no))
                return `<span class="sip-chip sip-chip-muted" style="opacity:.55"
                    title="ไม่เข้าเงื่อนไข ${esc(cond ? cond.label : '')}">– ${esc(name)}</span>`;
            return `<span class="sip-chip sip-chip-success" title="${esc(f ? f.th : '')}">✓ ${esc(name)}</span>`;
        };

        return `
        <div class="${fc.ok ? 'ds-note' : 'ds-warn'}" style="margin-bottom:14px">
            <i data-lucide="${fc.ok ? 'files' : 'file-x'}" class="icon-sm"></i>
            <span>
                <strong>แฟ้มที่ต้องส่งสำหรับ ${esc(fc.fundLabel)}</strong>
                — ครบ ${fc.required.length - fc.missing.length}/${fc.required.length} แฟ้ม
                ${fc.ok ? '' : ` · <strong>ขาด ${esc(MockNhso.fileNames(fc.missing))}</strong>
                    (กฎ <a href="claim-rules.html?rule=RUL-FIL-001">RUL-FIL-001</a>)`}
                <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">
                    ${fc.inScope.map(chip).join('')}
                </div>
            </span>
        </div>`;
    },

    renderTabBar() {
        const errs = (this.current().nhso.errors || []).length;
        document.getElementById('tabBar').innerHTML = this.TABS.map(t => `
            <button class="ds-tab ${t.key === this.state.tab ? 'active' : ''}"
                onclick="NhsoCase.switchTab('${t.key}')">
                <i data-lucide="${t.icon}" class="mi"></i> ${esc(t.label)}
                ${t.key === 'check' && errs ? `<span class="tab-notif">${errs}</span>` : ''}
            </button>`).join('');
    },

    switchTab(key) {
        this.state.tab = key;
        this.renderTabBar();
        this.renderTab(this.current());
        refreshIcons();
    },

    setSub(key) { this.state.sub = key; this.renderTab(this.current()); refreshIcons(); },

    /* ══════════ เนื้อหาแท็บ ══════════ */

    renderTab(c) {
        const fn = {
            general:  () => this.tabGeneral(c),
            provider: () => this.tabProvider(c),
            dx:       () => this.tabDx(c),
            charge:   () => this.tabCharge(c),
            cup:      () => this.tabCup(c),
            check:    () => this.tabCheck(c),
            history:  () => this.tabHistory(c),
        }[this.state.tab];
        document.getElementById('tabContent').innerHTML = fn ? fn() : '';
    },

    _grid(rows) {
        return `<table class="ds-table-grid"><tbody>${rows.map(([k, v]) =>
            `<tr><td class="l" style="width:30%">${esc(k)}</td><td class="l">${esc(v)}</td></tr>`).join('')}
        </tbody></table>`;
    },

    tabGeneral(c) {
        const sub = `<div class="ds-segbar" style="margin-bottom:14px">${this.SUBTABS.map(s => `
            <button class="ds-seg ${s.key === this.state.sub ? 'active' : ''}"
                onclick="NhsoCase.setSub('${s.key}')">${esc(s.label)}</button>`).join('')}</div>`;

        let body = '';
        if (this.state.sub === 'claimcase') {
            const n = c.nhso;
            const vc = MockNhso.visitClose(c.visit_close) || {};
            const fc = MockClaims.fileCheck(c);
            body = this._grid([
                ['ชื่อ-สกุล', c.patient],
                ['HN', c.hn], ['AN', c.an || '—'],
                ['อายุ / เพศ', `${c.age} ปี · ${c.gender === 'F' ? 'หญิง' : 'ชาย'}`],
                ['SEQ (Visit)', n.seq],
                ['Invoice No.', n.invoice_no || '—'],
                ['UID', n.uid || '—'],
                ['วันที่รับบริการ', MockFmt.dateTH(c.service_date)],
                ['ประเภทบริการ', c.service_type === 'IPD' ? 'ผู้ป่วยใน (IP)' : c.service_type === 'PP' ? 'ส่งเสริมสุขภาพ (PP)' : 'ผู้ป่วยนอก (OP)'],
                ['สิทธิหลัก / สิทธิย่อย', `${n.main_right} / ${n.sub_right}`],
                ['กองทุนภายในของเรา', c.fund],
                ['หน่วยบริการประจำ', n.home_provider + ' (' + n.home_provider_code + ')'],
                ['Model', n.model],
                ['กรณีที่ขอเบิก', fc.fundLabel],
                ['สถานะการปิด Visit', `${vc.label} — ${vc.th}`
                    + (vc.submittable ? '' : ' (ยังส่งเบิกไม่ได้)')],
                ['ยอดเรียกเก็บ', MockFmt.baht(c.amount_claimed) + ' บาท'],
                ['ยอดชดเชย', MockFmt.baht(n.compensated || 0) + ' บาท'
                    + (n.compensated ? '' : ' (ยังไม่ทราบผลจนกว่า สปสช. จะประมวลผล)')],
            ]);
        } else if (this.state.sub === 'files') {
            const docs = c.documents || [];
            body = docs.length ? `<div class="table-responsive"><table class="data-table compact">
                <thead><tr><th>ชื่อไฟล์/เอกสาร</th><th style="width:1%">ประเภท</th>
                    <th style="width:1%">สถานะ</th><th style="width:1%">ผู้จัดทำ</th><th style="width:1%">วันที่</th></tr></thead>
                <tbody>${docs.map(d => `<tr>
                    <td class="td-name">${esc(d.name)}</td>
                    <td class="td-sub">${esc(d.type)}</td>
                    <td><span class="sip-chip ${d.status === 'FOUND' ? 'sip-chip-success'
                        : d.status === 'MISSING' ? 'sip-chip-danger' : 'sip-chip-amber'}">${
                        esc({ FOUND: 'พบ', MISSING: 'ไม่พบ', UNREADABLE: 'อ่านไม่ได้', PENDING: 'รอยืนยัน' }[d.status] || d.status)}</span></td>
                    <td class="td-sub">${esc(d.by)}</td>
                    <td class="td-sub">${esc(d.date ? MockFmt.dateTH(d.date) : '—')}</td>
                </tr>`).join('')}</tbody></table></div>`
                : '<div class="ds-empty">ไม่มีไฟล์แนบ</div>';
        } else {
            const label = (this.SUBTABS.find(s => s.key === this.state.sub) || {}).label;
            const fileNo = { prenatal: '10, 11', cmhs: '12', disability: '13' }[this.state.sub];
            body = `<div class="ds-empty">ไม่มีข้อมูล${esc(label)}สำหรับรายการนี้
                <div class="td-sub" style="margin-top:6px">แฟ้มที่เกี่ยวข้อง: ${esc(fileNo)} ตาม Standard Dataset</div></div>`;
        }
        return sub + body;
    },

    tabProvider(c) {
        return this._grid([
            ['ชื่อหน่วยบริการ', c.provider],
            ['รหัสหน่วยบริการ', c.provider_code],
            ['ประเภทหน่วยบริการ', c.provider_code.startsWith('054') ? 'โรงพยาบาลส่งเสริมสุขภาพตำบล'
                                : c.provider_code.startsWith('224') ? 'คลินิกชุมชนอบอุ่น' : 'หน่วยบริการประจำ/รับส่งต่อ'],
            ['แฟ้มที่เกี่ยวข้อง', '2 (NHSO Provider) · 3 (NHSO Practitioner)'],
            ['สถานะการขึ้นทะเบียน', 'ขึ้นทะเบียนแล้ว'],
            ['Source ID', MOCK_NHSO_API.source_id],
        ]);
    },

    tabDx(c) {
        const dxRows = (c.dx || []).map(d => `<tr>
            <td class="c">${esc(d.code)}</td><td class="l">${esc(d.name)}</td><td class="c">${esc(d.type)}</td></tr>`).join('');
        const pRows = (c.proc || []).map(d => `<tr>
            <td class="c">${esc(d.code)}</td><td class="l">${esc(d.name)}</td>
            <td class="c">${esc(MockFmt.dateTH(d.date))}</td></tr>`).join('');
        return `
            <div class="ds-section-label">การวินิจฉัยโรค (แฟ้ม 5 — NHSO Diagnosis)</div>
            <table class="ds-table-grid">
                <thead><tr><th style="width:14%">รหัส ICD-10</th><th>คำวินิจฉัย</th><th style="width:14%">ประเภท</th></tr></thead>
                <tbody>${dxRows || '<tr><td colspan="3" class="c">ไม่มีข้อมูล</td></tr>'}</tbody>
            </table>
            <div class="ds-section-label">การทำหัตถการ (แฟ้ม 6 — NHSO Procedure)</div>
            <table class="ds-table-grid">
                <thead><tr><th style="width:14%">รหัส ICD-9-CM</th><th>หัตถการ</th><th style="width:16%">วันที่ทำ</th></tr></thead>
                <tbody>${pRows || '<tr><td colspan="3" class="c">ไม่มีข้อมูล</td></tr>'}</tbody>
            </table>`;
    },

    tabCharge(c) {
        const groups = {};
        (c.charges || []).forEach(x => { (groups[x.billgrcs] = groups[x.billgrcs] || []).push(x); });
        const GRP = { '01': 'ค่าห้องและค่าบริการผู้ป่วยนอก', '02': 'ค่าห้องและค่าอาหารผู้ป่วยใน',
                      '03': 'ค่ายาและสารอาหารทางเส้นเลือด', '06': 'ค่าตรวจทางห้องปฏิบัติการ',
                      '09': 'ค่าหัตถการและวิสัญญี', '11': 'ค่าตรวจวินิจฉัยทางรังสีวิทยา',
                      '13': 'ค่าบริการสร้างเสริมสุขภาพ', '14': 'ค่าบริการการแพทย์ฉุกเฉิน' };

        const total = (c.charges || []).reduce((a, x) => a + x.qty * x.price, 0);
        const over  = (c.charges || []).reduce((a, x) =>
            a + (x.catalogue_price != null && x.price > x.catalogue_price ? (x.price - x.catalogue_price) * x.qty : 0), 0);

        const body = Object.entries(groups).map(([g, rows]) => `
            <div class="ds-section-label">BILLGRCS ${esc(g)} — ${esc(GRP[g] || 'หมวดค่าใช้จ่าย')}</div>
            <table class="ds-table-grid">
                <thead><tr>
                    <th style="width:7%">แฟ้ม</th><th style="width:7%">Seq</th><th style="width:11%">STDCODE</th>
                    <th>รายการ</th><th style="width:8%">จำนวน</th><th style="width:12%">ราคาที่เบิก</th>
                    <th style="width:13%">ราคา Drug/Service Catalogue</th><th style="width:10%">ส่วนต่าง</th>
                </tr></thead>
                <tbody>${rows.map(x => {
                    const diff = x.catalogue_price == null ? null : x.price - x.catalogue_price;
                    const bad = diff != null && diff > 0;
                    return `<tr ${bad ? 'style="background:var(--status-danger-soft)"' : ''}>
                        <td class="c">${esc(x.file)}</td><td class="c">${esc(x.seq)}</td>
                        <td class="c">${esc(x.stdcode)}</td><td class="l">${esc(x.name)}</td>
                        <td class="r">${esc(x.qty)}</td>
                        <td class="r">${esc(MockFmt.baht(x.price))}</td>
                        <td class="r">${x.catalogue_price == null ? '—' : esc(MockFmt.baht(x.catalogue_price))}</td>
                        <td class="r">${diff == null ? '—' : bad
                            ? `<strong style="color:var(--status-danger)">+${esc(MockFmt.baht(diff))}</strong>`
                            : esc(MockFmt.baht(diff))}</td>
                    </tr>`;
                }).join('')}</tbody>
            </table>`).join('');

        return `${body || '<div class="ds-empty">ไม่มีรายการค่าใช้จ่าย</div>'}
            <div class="cards-row">
                <div class="clinical-card">
                    <div class="card-title">สรุปยอด (แฟ้ม 8 — NHSO CHA)</div>
                    ${this._grid([['ยอดรวมรายการค่าใช้จ่าย', MockFmt.baht(total) + ' บาท'],
                                  ['ยอดขอเบิก', MockFmt.baht(c.amount_claimed) + ' บาท'],
                                  ['ยอดที่ถูกตัดจ่าย', MockFmt.baht(c.amount_rejected) + ' บาท']])}
                </div>
                <div class="clinical-card">
                    <div class="card-title">ส่วนต่างจาก Catalogue</div>
                    <div style="font-size:30px;font-weight:800;color:${over > 0 ? 'var(--status-danger)' : 'var(--status-success)'}">
                        ${esc(MockFmt.baht(over))} <span style="font-size:14px">บาท</span></div>
                    <div class="card-footer">${over > 0
                        ? 'ส่วนต่างนี้คือสาเหตุของรหัส P124 — ต้องแก้ราคาใน HIS ให้ตรง Catalogue ก่อนส่ง'
                        : 'ทุกรายการตรงกับราคาใน Catalogue'}</div>
                </div>
            </div>`;
    },

    tabCup(c) {
        return `${this._grid([
            ['หน่วยบริการประจำ (CUP)', c.provider],
            ['รหัส CUP', c.provider_code],
            ['หน่วยบริการปฐมภูมิ', c.provider_code.startsWith('054') ? c.provider : '—'],
            ['สิทธิที่ตรวจสอบได้', c.fund],
            ['สถานะการปิดสิทธิ', c.fund === 'UC' ? 'ปิดสิทธิผ่านเป๋าตัง / ระบบ สปสช. แล้ว'
                              : c.fund === 'OFC' ? 'ใช้ Approve Code กรมบัญชีกลาง' : 'ตรวจสอบสิทธิผ่านระบบกลาง'],
            ['ช่วงสิทธิที่มีผล', '1 ต.ค. 2568 – 30 ก.ย. 2569'],
        ])}
        <div class="ds-note"><i data-lucide="info" class="icon-sm"></i>
            ข้อมูลหน่วยบริการประจำใช้ตัดสินว่ารายการนี้เบิกจากกองทุนใด และมีผลต่อรหัส C305
            เมื่อเลขปิดสิทธิ/Approve Code ไม่ตรงกับฐานข้อมูล</div>`;
    },

    /* ⭐ แท็บที่สำคัญที่สุด — เลียนแบบหน้าจอ "ผลการตรวจสอบ" ของ สปสช. */
    tabCheck(c) {
        const errs = c.nhso.errors || [];
        const pre  = errs.filter(e => e.group === 'PREVALIDATE');
        const proc = errs.filter(e => e.group === 'PROCESS');
        const predicted = MockClaims.predictedCodes(c);

        const block = (title, tone, icon, rows, note) => rows.length ? `
            <div class="section-card">
                <div class="sip-banner sip-banner-${tone}" style="margin-bottom:12px">
                    <i data-lucide="${icon}" class="icon-sm"></i>
                    <strong>${esc(title)}</strong>
                    <span class="sip-chip sip-chip-${tone === 'danger' ? 'danger' : 'amber'}" style="margin-left:auto">${rows.length}</span>
                </div>
                ${note ? `<div class="td-sub" style="margin-bottom:8px">${esc(note)}</div>` : ''}
                <div class="table-responsive"><table class="data-table compact">
                    <thead><tr><th style="width:1%">รหัส</th><th>ข้อความจากระบบ สปสช.</th>
                        <th style="width:1%">แฟ้ม</th><th style="width:1%">Seq</th>
                        <th style="width:1%">BILLGRCS</th><th style="width:1%">STDCODE</th>
                        <th style="width:1%">กฎของเราที่ดักไว้</th></tr></thead>
                    <tbody>${rows.map(e => {
                        const rr = (c.rule_results || []).find(r => r.maps_to_nhso === e.code);
                        return `<tr>
                            <td><span class="sip-chip ${e.level === 'ERROR' ? 'sip-chip-danger' : 'sip-chip-amber'}">${esc(e.code)}${
                                MockClaims.codeVerified(e.code) ? ''
                                : `<sup title="${esc(NHSO_UNVERIFIED_NOTE)}">*</sup>`}</span></td>
                            <td style="font-size:11px;line-height:1.6">${esc(e.text)}</td>
                            <td class="td-sub">${esc(e.file)}</td>
                            <td class="td-sub">${esc(e.seq)}</td>
                            <td class="td-sub">${esc(e.billgrcs)}</td>
                            <td class="td-sub">${esc(e.stdcode)}</td>
                            <td style="white-space:nowrap">${rr
                                ? `<a href="claim-rules.html?rule=${encodeURIComponent(rr.rule_id)}"
                                     class="sip-chip sip-chip-success">${esc(rr.rule_id)} v${esc(rr.version)}</a>`
                                : '<span class="sip-chip sip-chip-danger">ยังไม่มีกฎครอบคลุม</span>'}</td>
                        </tr>`;
                    }).join('')}</tbody>
                </table></div>
            </div>` : '';

        const clarify = `
            <div class="section-card">
                <div class="section-title" style="margin-bottom:10px">
                    <i data-lucide="file-plus-2" class="mi"></i> ชี้แจงรายการก่อนส่งเบิก</div>
                <label class="sip-checkbox">
                    <input type="checkbox" ${(c.documents || []).some(d => d.type === 'ชี้แจง') ? 'checked disabled' : ''}
                        onchange="NhsoSubmitClarify('${esc(c.id)}')">
                    ต้องการแนบเอกสารชี้แจงรายการก่อนส่งเบิก
                </label>
                ${(c.documents || []).filter(d => d.type === 'ชี้แจง').map(d =>
                    `<div class="ds-block" style="margin-top:8px"><i data-lucide="paperclip" class="icon-sm"></i>
                        ${esc(d.name)} · แนบโดย ${esc(d.by)} · ${esc(MockFmt.dateTH(d.date))}</div>`).join('')}
            </div>`;

        const empty = !errs.length ? (predicted.length ? `
            <div class="sip-banner sip-banner-warning">
                <i data-lucide="alert-triangle" class="icon-sm"></i>
                <span>ยังไม่มีผลตอบกลับจาก สปสช. (รายการยังไม่ถูกส่ง) — แต่กฎของเราตรวจพบแล้วว่า
                จะได้ <strong>${esc(predicted.join(', '))}</strong> ถ้าส่งทั้งอย่างนี้</span>
            </div>
            <div class="table-responsive"><table class="data-table compact">
                <thead><tr><th style="width:1%">รหัสที่คาดว่าจะติด</th><th>ประเด็นที่กฎเราตรวจพบ</th>
                    <th style="width:1%">กฎ</th><th style="width:1%">เอกสารอ้างอิง</th></tr></thead>
                <tbody>${(c.rule_results || []).filter(r => r.maps_to_nhso).map(r => `<tr>
                    <td><span class="sip-chip sip-chip-danger">${esc(r.maps_to_nhso)}${
                        MockClaims.codeVerified(r.maps_to_nhso) ? ''
                        : `<sup title="${esc(NHSO_UNVERIFIED_NOTE)}">*</sup>`}</span></td>
                    <td>${esc(r.message)}</td>
                    <td class="td-sub">${esc(r.rule_id)} v${esc(r.version)}</td>
                    <td class="td-sub">${esc(r.doc_ref || '—')}</td>
                </tr>`).join('')}</tbody>
            </table></div>`
            : `<div class="sip-banner sip-banner-success">
                   <i data-lucide="check-circle-2" class="icon-sm"></i>
                   ไม่พบข้อผิดพลาดจากการตรวจสอบ</div>`) : '';

        /* กฎที่มาจากประกาศโดยตรง ตรวจได้ตั้งแต่ก่อนส่ง ไม่ต้องรอ สปสช. ตอบ */
        const fc = MockClaims.fileCheck(c);
        const vc = MockNhso.visitClose(c.visit_close) || {};
        const preFlight = (!fc.ok || !vc.submittable) ? `
            <div class="section-card">
                <div class="sip-banner sip-banner-danger" style="margin-bottom:12px">
                    <i data-lucide="shield-alert" class="icon-sm"></i>
                    <strong>ประเด็นที่ขัดกับประกาศ สปสช. โดยตรง — ตรวจได้ก่อนส่ง</strong>
                </div>
                <div class="table-responsive"><table class="data-table compact">
                    <thead><tr><th style="width:1%">กฎ</th><th>ประเด็น</th>
                        <th style="width:1%">ที่มา</th></tr></thead>
                    <tbody>
                    ${!fc.ok ? `<tr>
                        <td><a href="claim-rules.html?rule=RUL-FIL-001"
                               class="sip-chip sip-chip-danger">RUL-FIL-001</a></td>
                        <td>กองทุน “${esc(fc.fundLabel)}” ต้องส่ง ${fc.required.length} แฟ้ม
                            แต่ยังขาด <strong>${esc(MockNhso.fileNames(fc.missing))}</strong></td>
                        <td class="td-sub">Overview 23 มิ.ย. 2569 น.14–16</td></tr>` : ''}
                    ${!vc.submittable ? `<tr>
                        <td><a href="claim-rules.html?rule=RUL-VIS-001"
                               class="sip-chip sip-chip-danger">RUL-VIS-001</a></td>
                        <td>สถานะการปิด Visit เป็น <strong>${esc(vc.label)}</strong>
                            (${esc(vc.th)}) — ต้องเป็น Complete จึงส่งเบิกได้</td>
                        <td class="td-sub">Overview 23 มิ.ย. 2569 น.7</td></tr>` : ''}
                    </tbody>
                </table></div>
            </div>` : '';

        const legend = `
            <div class="ds-note">
                <i data-lucide="info" class="icon-sm"></i>
                <span><strong>*</strong> ${esc(NHSO_UNVERIFIED_NOTE)} —
                สปสช. แจ้งว่าจะเผยแพร่แคตตาล็อก “Error ที่พบบ่อย” พร้อมแนวทางแก้ไข
                (Overview 23 มิ.ย. 2569 น.8) เมื่อได้มาจะแทนที่รหัสทั้งชุด</span>
            </div>`;

        return preFlight
            + empty
            + block('ERROR — ปัญหาที่พบจากการตรวจสอบเบื้องต้น', 'danger', 'x-circle',
                    pre.filter(e => e.level === 'ERROR'),
                    'รายการนี้จะถูกส่งกลับให้หน่วยบริการแก้ไขที่ HIS แล้วส่งเข้ามาใหม่ '
                  + '(หน้าจอ สปสช. แก้ไขข้อมูลไม่ได้)')
            + block('WARNING — สามารถยืนยันส่งเบิกได้', 'warning', 'alert-triangle',
                    pre.filter(e => e.level === 'WARNING'),
                    'ไม่ปิดกั้นการส่งเบิก แต่ควรตรวจสอบความถูกต้องก่อน')
            + block('ปัญหาที่พบจากการประมวลผลไฟล์', 'danger', 'x-circle', proc,
                    'พบหลังผ่านการตรวจสอบเบื้องต้นแล้ว — ต้องแก้ไขและส่งใหม่')
            + clarify
            + ((errs.length || predicted.length) ? legend : '');
    },

    tabHistory(c) {
        const h = c.nhso.history || [];
        const rows = h.length ? h.slice().reverse().map((x, i) => `<tr>
            <td class="c">${h.length - i}</td>
            <td class="c" style="white-space:nowrap">${esc(MockFmt.dateTimeTH(x.at))}</td>
            <td class="l"><strong>${esc(x.code)}</strong> — ${esc(x.status)}</td>
            <td class="l" style="font-size:11px">${esc(x.act)}</td>
            <td class="l">${esc(x.by)}</td>
        </tr>`).join('') : '<tr><td colspan="5" class="c">ยังไม่มีประวัติการส่งเบิก</td></tr>';

        /* ไทม์ไลน์ฝั่งระบบเรา — ให้เห็นว่าจำนวนรอบต่างกันแค่ไหน */
        const days = h.length >= 2
            ? Math.round((MockFmt.toDate(h[h.length - 1].at) - MockFmt.toDate(h[0].at)) / 864e5) : 0;

        return `
            <table class="ds-table-grid">
                <thead><tr><th style="width:6%">ที่</th><th style="width:18%">วันที่/เวลา</th>
                    <th style="width:24%">สถานะ</th><th>กิจกรรม</th><th style="width:18%">ผู้ทำรายการ</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            ${h.length ? `
            <div class="cards-row">
                <div class="clinical-card">
                    <div class="card-title"><i data-lucide="repeat" class="mi"></i> จำนวนรอบการส่ง</div>
                    <div style="font-size:30px;font-weight:800;color:var(--status-danger)">
                        ${h.filter(x => x.code === 'F000').length} <span style="font-size:14px">ครั้ง</span></div>
                    <div class="card-footer">ทุกครั้งที่ส่งใหม่คือหนึ่งรอบที่รายได้ถูกเลื่อนออกไป</div>
                </div>
                <div class="clinical-card">
                    <div class="card-title"><i data-lucide="calendar-clock" class="mi"></i> ระยะเวลารวม</div>
                    <div style="font-size:30px;font-weight:800;color:var(--status-danger)">
                        ${days} <span style="font-size:14px">วัน</span></div>
                    <div class="card-footer">ตั้งแต่ส่งครั้งแรกจนถึงเหตุการณ์ล่าสุด</div>
                </div>
            </div>
            <div class="sip-banner sip-banner-info">
                <i data-lucide="lightbulb" class="icon-sm"></i>
                <span>เทียบกับเคส <a href="claim-case.html?id=CLM-2569-0042">CLM-2569-0042</a>
                ที่กฎเดียวกันดักได้ตั้งแต่ก่อนส่ง — ปิดประเด็นภายใน 4 ชั่วโมง และยังไม่เคยส่งพังสักครั้ง</span>
            </div>` : ''}`;
    },
};

/* ผูกจากแท็บผลการตรวจสอบ — เปิด drawer ชี้แจงชุดเดียวกับหน้ารายการส่งเบิก */
function NhsoSubmitClarify(id) {
    location.href = 'nhso-submit.html?stage=' + encodeURIComponent(
        (MockClaims.byId(id) || { nhso: {} }).nhso.stage || 'AWAIT_SUBMIT');
}

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.NhsoCase = NhsoCase;
document.addEventListener('DOMContentLoaded', () => NhsoCase.init());
