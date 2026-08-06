/* ────────────────────────────────────────────────────────
   รายละเอียดเคส (Claim Case Detail) — SRS §10

   สิ่งที่หน้านี้ต้องพิสูจน์ให้ผู้บริหารเห็น
     BR-03  ผลตรวจทุกข้อย้อนกลับได้ถึง Rule Code/Version + ข้อมูลที่ใช้ตัดสิน
     BR-04  Override ต้องมีผู้ทำ เวลา เหตุผล หลักฐาน
     BR-05  กฎระดับระงับส่งต้องผ่าน Maker–Checker
   ──────────────────────────────────────────────────────── */

const CaseView = {

    state: { id: null, filter: 'all', tab: 'overview' },

    init() {
        const p = new URLSearchParams(location.search);
        this.state.id = p.get('id');
        if (p.get('filter')) this.state.filter = p.get('filter');

        this.fillFunds();
        this.renderPills();
        this.renderList();

        const first = this.visible()[0];
        this.select(this.state.id || (first ? first.id : null));
    },

    reload() { this.select(this.state.id); showToast('ยกเลิกการแก้ไขแล้ว', 'info'); },

    current() { return this.state.id ? MockClaims.byId(this.state.id) : null; },

    /* ══════════ คอลัมน์ซ้าย ══════════ */

    fillFunds() {
        const funds = [...new Set(MockClaims.all().map(c => c.fund))].sort();
        document.getElementById('fFund').insertAdjacentHTML('beforeend',
            funds.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join(''));
    },

    FILTERS: [
        { key: 'all',     label: 'ทั้งหมด' },
        { key: 'FIX',     label: 'ต้องแก้ไข' },
        { key: 'APPROVE', label: 'ต้องอนุมัติ' },
        { key: 'mine',    label: 'ของฉัน' },
    ],

    matchFilter(c, key) {
        if (key === 'all')  return true;
        if (key === 'mine') return c.owner === MockSession.userId();
        if (key === 'FIX')  return c.result === 'FIX' || c.result === 'BLOCK';
        return c.result === key;
    },

    renderPills() {
        document.getElementById('pillTabs').innerHTML = this.FILTERS.map(f => {
            const n = MockClaims.all().filter(c => this.matchFilter(c, f.key)).length;
            return `<button class="ds-pilltab ${f.key === this.state.filter ? 'active' : ''}"
                        onclick="CaseView.setFilter('${f.key}')">
                        ${esc(f.label)} <span class="tab-count">${n}</span></button>`;
        }).join('');
    },

    setFilter(key) {
        this.state.filter = key;
        this.renderPills();
        this.renderList();
        refreshIcons();
    },

    visible() {
        const kw   = (document.getElementById('listSearch').value || '').trim().toLowerCase();
        const fund = document.getElementById('fFund').value;
        return MockClaims.all().filter(c => {
            if (!this.matchFilter(c, this.state.filter)) return false;
            if (fund !== 'all' && c.fund !== fund) return false;
            if (kw && !(`${c.id} ${c.hn} ${c.patient}`).toLowerCase().includes(kw)) return false;
            return true;
        });
    },

    renderList() {
        const rows = this.visible();
        document.getElementById('listCount').textContent = rows.length + ' รายการ';
        document.getElementById('listContainer').innerHTML = rows.length
            ? rows.map(c => `
                <div class="ds-list-card ${c.id === this.state.id ? 'active' : ''}"
                     onclick="CaseView.select('${esc(c.id)}')">
                    <div class="ds-list-card-top">
                        <span class="td-sub">${esc(c.id)}</span>
                        ${MockTone.resultChipHtml(c.result)}
                    </div>
                    <div class="ds-list-card-name">${esc(c.patient)}</div>
                    <div class="ds-list-card-detail">
                        HN ${esc(c.hn)} · ${esc(MockFmt.dateTH(c.service_date))} ·
                        ${esc(c.fund)} · ${esc(MockFmt.baht(c.amount_claimed))} บาท
                    </div>
                </div>`).join('')
            : '<div class="ds-empty">ไม่พบเคสตามเงื่อนไข</div>';
        refreshIcons();
    },

    toggleLeft() { document.getElementById('shell').classList.toggle('left-collapsed'); },

    /* ══════════ เลือกเคส ══════════ */

    select(id) {
        this.state.id = id;
        const c = this.current();

        document.getElementById('emptyState').style.display = c ? 'none' : '';
        document.getElementById('detailWrap').style.display = c ? '' : 'none';
        if (!c) { this.renderList(); return; }

        history.replaceState(null, '', 'claim-case.html?id=' + encodeURIComponent(id));

        MockSession.mountBanner('demoBanner');
        this.renderContext(c);
        this.renderOverview(c);
        this.renderRules(c);
        this.renderEvidence(c);
        this.renderDocs(c);
        this.renderTimeline(c);
        this.renderNhso(c);
        this.renderActions(c);
        this.renderList();
        refreshIcons();
    },

    renderContext(c) {
        document.getElementById('ctxAvatar').textContent = c.patient.replace(/^(นาย|นาง|นางสาว|ด\.ช\.|ด\.ญ\.)/, '').trim().charAt(0);
        document.getElementById('ctxName').textContent   = c.patient;
        document.getElementById('ctxChip').innerHTML     = MockTone.resultChipHtml(c.result);
        document.getElementById('ctxMeta').innerHTML = `
            <span>รหัสเคส: ${esc(c.id)}</span>
            <span>HN ${esc(c.hn)}${c.an ? ' · AN ' + esc(c.an) : ''}</span>
            <span>วันที่รับบริการ: ${esc(MockFmt.dateTH(c.service_date))}</span>
            <span>กองทุน: ${esc(c.fund)} · ${esc(c.service_type)}</span>
            <span>มูลค่า: ${esc(MockFmt.baht(c.amount_claimed))} บาท</span>`;

        const codes = MockClaims.predictedCodes(c);
        const alert = document.getElementById('ctxAlert');
        if (c.result === 'BLOCK' || c.result === 'FIX') {
            alert.style.display = '';
            document.getElementById('ctxAlertLabel').textContent =
                c.result === 'BLOCK' ? 'ระงับส่ง' : 'ต้องแก้ไขก่อนส่ง';
            document.getElementById('ctxAlertText').textContent = codes.length
                ? `ถ้าส่งตอนนี้จะได้ ${codes.join(', ')} กลับมา`
                : 'มีประเด็นค้างที่ต้องแก้ก่อนส่งเบิก';
        } else {
            alert.style.display = 'none';
        }
    },

    showAlert() { this.switchTab('rules'); },

    switchTab(key, btn) {
        this.state.tab = key;
        document.querySelectorAll('.ds-tab').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        else {
            const i = ['overview', 'rules', 'evidence', 'docs', 'timeline', 'nhso'].indexOf(key);
            document.querySelectorAll('.ds-tab')[i].classList.add('active');
        }
        document.querySelectorAll('.ds-tab-content').forEach(el => el.classList.remove('active'));
        const map = { overview: 'tabOverview', rules: 'tabRules', evidence: 'tabEvidence',
                      docs: 'tabDocs', timeline: 'tabTimeline', nhso: 'tabNhso' };
        document.getElementById(map[key]).classList.add('active');
        refreshIcons();
    },

    /* ══════════ แท็บ 1 — ภาพรวม ══════════ */

    renderOverview(c) {
        const kv = o => Object.entries(o).map(([k, v]) =>
            `<div style="display:flex;justify-content:space-between;gap:12px;padding:4px 0;
                 border-bottom:1px dashed var(--brand-border);font-size:12px">
                <span style="color:var(--text-muted)">${esc(k)}</span>
                <strong style="text-align:right">${esc(v)}</strong></div>`).join('');

        /* ความพร้อมส่งเบิก 5 ขั้น — คำนวณจากข้อมูลจริงของเคส ไม่ hardcode */
        const docsOk  = !(c.documents || []).some(d => d.status !== 'FOUND');
        const codeOk  = !(c.rule_results || []).some(r => r.rule_id.startsWith('RUL-CDX'));
        const ruleOk  = c.result === 'PASS';
        const steps = [
            { label: 'ข้อมูลครบ',    ok: true },
            { label: 'Coding ถูกต้อง', ok: codeOk },
            { label: 'เอกสารครบ',    ok: docsOk },
            { label: 'ผ่านกฎ',      ok: ruleOk },
            { label: 'พร้อมส่ง',     ok: ruleOk && docsOk },
        ];
        let hitActive = false;
        const stepper = steps.map(s => {
            if (s.ok) return `<span class="ds-step completed"><i data-lucide="check" class="icon-sm"></i> ${esc(s.label)}</span>`;
            if (!hitActive) { hitActive = true; return `<span class="ds-step active">${esc(s.label)}</span>`; }
            return `<span class="ds-step">${esc(s.label)}</span>`;
        }).join('');

        const chargeTotal = (c.charges || []).reduce((a, x) => a + x.qty * x.price, 0);

        document.getElementById('tabOverview').innerHTML = `
            <div class="cards-row">
                <div class="clinical-card">
                    <div class="card-title"><i data-lucide="user" class="mi"></i> ผู้ป่วยและสิทธิ</div>
                    ${kv({ 'ชื่อ-สกุล': c.patient, 'HN': c.hn, 'AN': c.an || '—',
                           'อายุ / เพศ': `${c.age} ปี · ${c.gender === 'F' ? 'หญิง' : 'ชาย'}`,
                           'กองทุน': c.fund, 'ประเภทบริการ': c.service_type })}
                </div>
                <div class="clinical-card">
                    <div class="card-title"><i data-lucide="stethoscope" class="mi"></i> ข้อมูลบริการ</div>
                    ${kv({ 'หน่วยบริการ': c.provider, 'รหัสหน่วยบริการ': c.provider_code,
                           'วันที่รับบริการ': MockFmt.dateTH(c.service_date) })}
                    <div style="margin-top:10px">
                        <div class="ds-section-label">การวินิจฉัย</div>
                        ${(c.dx || []).map(d => `<div style="font-size:12px;padding:2px 0">
                            <span class="sip-chip sip-chip-active">${esc(d.code)}</span>
                            ${esc(d.name)} <span class="td-sub">(${esc(d.type)})</span></div>`).join('')
                          || '<div class="ds-empty-sm">ไม่มีข้อมูล</div>'}
                        <div class="ds-section-label" style="margin-top:8px">หัตถการ</div>
                        ${(c.proc || []).map(d => `<div style="font-size:12px;padding:2px 0">
                            <span class="sip-chip sip-chip-muted">${esc(d.code)}</span> ${esc(d.name)}</div>`).join('')
                          || '<div class="ds-empty-sm">ไม่มีข้อมูล</div>'}
                    </div>
                </div>
            </div>

            <div class="cards-row">
                <div class="clinical-card">
                    <div class="card-title"><i data-lucide="wallet" class="mi"></i> สรุปค่าใช้จ่าย</div>
                    ${kv({ 'ยอดขอเบิก': MockFmt.baht(c.amount_claimed) + ' บาท',
                           'มูลค่าที่เสี่ยงถูกตัด': MockFmt.baht(c.amount_at_risk) + ' บาท',
                           'ยอดที่ถูกตัดจริง': MockFmt.baht(c.amount_rejected) + ' บาท',
                           'รวมรายการค่าใช้จ่าย': MockFmt.baht(chargeTotal) + ' บาท' })}
                    <div class="card-footer">รายละเอียดรายรายการอยู่ในแท็บ "หลักฐาน"</div>
                </div>
                <div class="clinical-card">
                    <div class="card-title"><i data-lucide="gauge" class="mi"></i> ความพร้อมส่งเบิก</div>
                    <div style="display:flex;align-items:center;gap:10px;margin:6px 0 14px">
                        <span style="font-size:32px;font-weight:800;color:var(--brand-navy)">${esc(c.risk_score)}</span>
                        <span class="td-sub">คะแนนความเสี่ยง (0–100)</span>
                    </div>
                    <div class="ds-stepper">${stepper}</div>
                    <div class="card-footer">ขั้นที่ยังไม่ผ่านคือสิ่งที่ต้องปิดก่อนกดส่งเบิก</div>
                </div>
            </div>`;
    },

    /* ══════════ แท็บ 2 — ผลกฎ ══════════ */

    renderRules(c) {
        const rr = c.rule_results || [];
        const badge = document.getElementById('ruleBadge');
        const bad = rr.filter(r => r.result !== 'PASS').length;
        badge.style.display = bad ? '' : 'none';
        badge.textContent = bad;

        document.getElementById('tabRules').innerHTML = rr.length ? `
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="shield-check" class="mi"></i>
                        ผลการตรวจด้วยกฎ <span class="ds-pane-count">${rr.length} ข้อ</span></div>
                </div>
                <div class="table-responsive">
                <table class="data-table compact">
                    <thead><tr>
                        <th style="width:1%">รหัสกฎ</th><th style="width:1%">Ver</th>
                        <th style="width:1%">ผล</th><th style="width:1%">ระดับ</th>
                        <th>ข้อความ</th>
                        <th style="width:1%">จะได้รหัสอะไรที่ NHSO</th>
                        <th style="width:1%">เอกสารอ้างอิง</th><th style="width:1%"></th>
                    </tr></thead>
                    <tbody>${rr.map((r, i) => `<tr>
                        <td class="td-sub" style="white-space:nowrap">${esc(r.rule_id)}</td>
                        <td class="td-sub">v${esc(r.version)}</td>
                        <td>${MockTone.resultBadgeHtml(r.result)}</td>
                        <td><span class="sip-chip ${esc(MockTone.severityChip[r.severity] || 'sip-chip-muted')}">${
                            esc(MockTone.severityLabel[r.severity] || r.severity)}</span></td>
                        <td>${esc(r.message)}</td>
                        <td style="white-space:nowrap">${r.maps_to_nhso
                            ? `<span class="sip-chip sip-chip-danger" title="${esc(NHSO_ERR_TEXT[r.maps_to_nhso] || '')}">${esc(r.maps_to_nhso)}</span>`
                            : '<span class="td-sub">—</span>'}</td>
                        <td class="td-sub" style="white-space:nowrap">${r.doc_id
                            ? `<a href="claim-knowledge.html?doc=${encodeURIComponent(r.doc_id)}">${esc(r.doc_ref || r.doc_id)}</a>`
                            : '—'}</td>
                        <td style="white-space:nowrap">
                            <button class="ds-icon-btn" title="ดูรายละเอียดกฎ"
                                onclick="location.href='claim-rules.html?rule=${encodeURIComponent(r.rule_id)}'">
                                <i data-lucide="external-link" class="icon-sm"></i></button>
                            ${r.result !== 'PASS' ? `
                            <button class="ds-icon-btn edit" title="ขอ Override"
                                onclick="CaseView.openOverride(${i})">
                                <i data-lucide="shield-alert" class="icon-sm"></i></button>` : ''}
                        </td>
                    </tr>`).join('')}</tbody>
                </table>
                </div>
            </div>
            ${rr.some(r => r.maps_to_nhso) ? `
            <div class="sip-banner sip-banner-info">
                <i data-lucide="info" class="icon-sm"></i>
                <span>กฎเหล่านี้จำลองเงื่อนไขเดียวกับที่ สปสช. ใช้ตรวจ — ต่างกันแค่เรายิงก่อนส่ง
                จึงยังแก้ทันโดยไม่เสียรอบส่งเบิก</span>
            </div>` : ''}
            ${c.result === 'BLOCK' ? `
            <div class="sip-banner sip-banner-warning">
                <i data-lucide="user-check" class="icon-sm"></i>
                <span><strong>กฎระดับ "ระงับส่ง"</strong> — ต้องผ่านการอนุมัติแบบ Maker–Checker
                ผู้เสนอกับผู้อนุมัติต้องเป็นคนละคน (BR-05)</span>
            </div>` : ''}`
            : `<div class="sip-banner sip-banner-success">
                   <i data-lucide="check-circle-2" class="icon-sm"></i>
                   ผ่านกฎทั้งหมด — ไม่พบประเด็นที่ต้องแก้ไขก่อนส่งเบิก</div>`;
    },

    /* ══════════ แท็บ 3 — หลักฐาน (BR-03) ══════════ */

    renderEvidence(c) {
        const rr = c.rule_results || [];
        const snapshots = rr.filter(r => r.evidence).map(r => `
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="microscope" class="mi"></i>
                        ${esc(r.rule_id)} v${esc(r.version)}</div>
                    <div class="section-actions">
                        ${MockTone.resultBadgeHtml(r.result)}
                        <button class="btn btn-ghost btn-sm" onclick="CaseView.copyEvidence('${esc(r.rule_id)}')">
                            <i data-lucide="copy" class="icon-sm"></i> คัดลอก JSON</button>
                    </div>
                </div>
                <table class="ds-table-grid">
                    <thead><tr><th style="width:38%">ข้อมูลที่ใช้ตัดสิน</th><th>ค่า ณ เวลาที่ตรวจ</th></tr></thead>
                    <tbody>${Object.entries(r.evidence).map(([k, v]) =>
                        `<tr><td class="l">${esc(k)}</td><td class="l"><strong>${esc(v)}</strong></td></tr>`).join('')}
                    </tbody>
                </table>
            </div>`).join('');

        const charges = (c.charges || []).length ? `
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="receipt" class="mi"></i>
                        รายการค่าใช้จ่าย (แฟ้ม 7 — NHSO CHAD)</div>
                </div>
                <div class="table-responsive">
                <table class="data-table compact">
                    <thead><tr>
                        <th style="width:1%">แฟ้ม</th><th style="width:1%">Seq</th>
                        <th style="width:1%">BILLGRCS</th><th style="width:1%">STDCODE</th>
                        <th>รายการ</th><th style="width:1%;text-align:right">จำนวน</th>
                        <th style="width:1%;text-align:right">ราคาที่เบิก</th>
                        <th style="width:1%;text-align:right">ราคา Catalogue</th>
                        <th style="width:1%;text-align:right">ส่วนต่าง</th>
                    </tr></thead>
                    <tbody>${c.charges.map(x => {
                        const diff = x.catalogue_price == null ? null : (x.price - x.catalogue_price);
                        const bad  = diff != null && diff > 0;
                        return `<tr ${bad ? 'style="background:var(--status-danger-soft)"' : ''}>
                            <td class="td-sub">${esc(x.file)}</td>
                            <td class="td-sub">${esc(x.seq)}</td>
                            <td class="td-sub">${esc(x.billgrcs)}</td>
                            <td class="td-sub">${esc(x.stdcode)}</td>
                            <td>${esc(x.name)}</td>
                            <td style="text-align:right">${esc(x.qty)}</td>
                            <td style="text-align:right">${esc(MockFmt.baht(x.price))}</td>
                            <td style="text-align:right">${x.catalogue_price == null ? '—' : esc(MockFmt.baht(x.catalogue_price))}</td>
                            <td style="text-align:right">${diff == null ? '—'
                                : bad ? `<strong style="color:var(--status-danger)">+${esc(MockFmt.baht(diff))}</strong>`
                                      : esc(MockFmt.baht(diff))}</td>
                        </tr>`;
                    }).join('')}</tbody>
                </table>
                </div>
            </div>` : '';

        document.getElementById('tabEvidence').innerHTML = (snapshots || charges)
            ? `<div class="ds-note" style="margin-bottom:12px">
                   <i data-lucide="shield" class="icon-sm"></i>
                   ทุกผลตรวจย้อนกลับได้ถึงรหัสกฎ เวอร์ชัน และค่าที่ใช้ตัดสิน ณ เวลานั้น (BR-03)
               </div>${snapshots}${charges}`
            : '<div class="ds-empty">ยังไม่มีหลักฐานประกอบสำหรับเคสนี้</div>';
    },

    copyEvidence(ruleId) {
        const c = this.current();
        const r = (c.rule_results || []).find(x => x.rule_id === ruleId);
        if (!r) return;
        const json = JSON.stringify({ claim_id: c.id, rule_id: r.rule_id, version: r.version,
                                      result: r.result, maps_to_nhso: r.maps_to_nhso, evidence: r.evidence }, null, 2);
        if (navigator.clipboard) navigator.clipboard.writeText(json).catch(() => {});
        showToast('คัดลอก snapshot ของหลักฐานแล้ว');
    },

    /* ══════════ แท็บ 4 — เอกสาร ══════════ */

    DOC_TONE: {
        FOUND:      { chip: 'sip-chip-success', label: 'พบ' },
        MISSING:    { chip: 'sip-chip-danger',  label: 'ไม่พบ' },
        UNREADABLE: { chip: 'sip-chip-amber',   label: 'อ่านไม่ได้' },
        PENDING:    { chip: 'sip-chip-ack',     label: 'รอยืนยัน' },
    },

    renderDocs(c) {
        const docs = c.documents || [];
        document.getElementById('tabDocs').innerHTML = docs.length ? `
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="paperclip" class="mi"></i>
                        เอกสารประกอบการเบิก
                        <span class="ds-pane-count">${docs.filter(d => d.status === 'FOUND').length}/${docs.length} ครบ</span></div>
                    <div class="section-actions">
                        <button class="btn btn-outline btn-sm" onclick="showToast('โหมดต้นแบบ — ยังไม่ผูกที่เก็บไฟล์จริง','info')">
                            <i data-lucide="upload" class="icon-sm"></i> แนบเอกสาร</button>
                    </div>
                </div>
                <div class="table-responsive">
                <table class="data-table compact">
                    <thead><tr><th>ชื่อเอกสาร</th><th style="width:1%">ประเภท</th>
                        <th style="width:1%">สถานะ</th><th style="width:1%">ผู้จัดทำ</th><th style="width:1%">วันที่</th></tr></thead>
                    <tbody>${docs.map(d => {
                        const t = this.DOC_TONE[d.status] || this.DOC_TONE.PENDING;
                        return `<tr>
                            <td class="td-name">${esc(d.name)}</td>
                            <td class="td-sub">${esc(d.type)}</td>
                            <td><span class="sip-chip ${t.chip}">${esc(t.label)}</span></td>
                            <td class="td-sub">${esc(d.by)}</td>
                            <td class="td-sub">${esc(d.date ? MockFmt.dateTH(d.date) : '—')}</td>
                        </tr>`;
                    }).join('')}</tbody>
                </table>
                </div>
            </div>`
            : '<div class="ds-empty">ยังไม่มีเอกสารประกอบ</div>';
    },

    /* ══════════ แท็บ 5 — Timeline ══════════ */

    renderTimeline(c) {
        const tl = c.timeline || [];
        document.getElementById('tabTimeline').innerHTML = tl.length ? `
            <div class="section-card">
                <div class="section-header"><div class="section-title">
                    <i data-lucide="history" class="mi"></i> ลำดับเหตุการณ์ของเคส</div></div>
                <div class="ds-timeline">${tl.map(e => `
                    <div class="ds-timeline-item ${esc(e.tone || '')}">
                        <strong>${esc(e.title)}</strong>
                        ${e.by ? ` โดย ${esc(e.by)}` : ''}
                        ${e.note ? `<div class="td-sub">${esc(e.note)}</div>` : ''}
                        <span class="ds-timeline-time">${esc(MockFmt.dateTimeTH(e.at))}</span>
                    </div>`).join('')}</div>
            </div>`
            : '<div class="ds-empty">ยังไม่มีประวัติ</div>';
    },

    /* ══════════ แท็บ 6 — สถานะ NHSO ══════════ */

    renderNhso(c) {
        const n = c.nhso;
        if (!n) { document.getElementById('tabNhso').innerHTML = '<div class="ds-empty">เคสนี้ยังไม่มีข้อมูลฝั่ง NHSO</div>'; return; }

        const cur = MockNhso.stageIndex(n.stage);
        const stepper = NHSO_STATUS_PIPELINE.map((s, i) => {
            const cls = i < cur ? 'completed' : i === cur ? 'active' : '';
            return `<span class="ds-step ${cls}">${i < cur
                ? '<i data-lucide="check" class="icon-sm"></i> ' : ''}${esc(s.label)}</span>`;
        }).join('');

        const errs = (n.errors || []).length ? `
            <div class="section-card">
                <div class="section-header"><div class="section-title">
                    <i data-lucide="alert-octagon" class="mi"></i> รหัสที่ สปสช. ตอบกลับ</div></div>
                <div class="table-responsive">
                <table class="data-table compact">
                    <thead><tr><th style="width:1%">รหัส</th><th style="width:1%">ระดับ</th>
                        <th style="width:1%">ขั้นที่พบ</th><th>ข้อความ</th></tr></thead>
                    <tbody>${n.errors.map(e => `<tr>
                        <td><span class="sip-chip ${e.level === 'ERROR' ? 'sip-chip-danger' : 'sip-chip-amber'}">${esc(e.code)}</span></td>
                        <td class="td-sub">${esc(e.level)}</td>
                        <td class="td-sub">${e.group === 'PROCESS' ? 'ประมวลผลไฟล์' : 'ตรวจสอบขั้นต้น'}</td>
                        <td style="font-size:11px">${esc(e.text)}</td>
                    </tr>`).join('')}</tbody>
                </table>
                </div>
            </div>` : '';

        const predicted = MockClaims.predictedCodes(c);

        document.getElementById('tabNhso').innerHTML = `
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="hospital" class="mi"></i> สถานะบน NHSO Digital Platform</div>
                    <div class="section-actions">
                        <button class="btn btn-outline btn-sm"
                            onclick="location.href='nhso-case.html?seq=${encodeURIComponent(n.seq)}'">
                            <i data-lucide="external-link" class="icon-sm"></i> เปิดในหน้าส่งเบิก</button>
                    </div>
                </div>
                <div class="ds-stepper" style="margin-bottom:14px">${stepper}</div>
                <table class="ds-table-grid">
                    <tbody>
                        <tr><td class="l" style="width:28%">สถานะรายการ</td><td class="l">
                            ${n.status_code ? `<strong>${esc(n.status_code)}</strong> — ` : ''}${esc(n.sub_status)}</td></tr>
                        <tr><td class="l">SEQ</td><td class="l">${esc(n.seq)}</td></tr>
                        <tr><td class="l">หมายเลขอ้างอิง</td><td class="l">${esc(n.ref_no || '— (ยังไม่ได้ส่ง)')}</td></tr>
                        <tr><td class="l">UploadID</td><td class="l">${esc(n.upload_id || '—')}</td></tr>
                        <tr><td class="l">รหัสโครงการพิเศษ</td><td class="l">${esc(n.special_project || '—')}</td></tr>
                    </tbody>
                </table>
            </div>
            ${predicted.length && !(n.errors || []).length ? `
            <div class="sip-banner sip-banner-warning">
                <i data-lucide="alert-triangle" class="icon-sm"></i>
                <span>ยังไม่ได้ส่ง — แต่ระบบคาดว่าจะได้รหัส <strong>${esc(predicted.join(', '))}</strong>
                กลับมาถ้าส่งทั้งอย่างนี้ ควรปิดประเด็นให้จบก่อน</span>
            </div>` : ''}
            ${errs}`;
    },

    /* ══════════ แผงขวา ══════════ */

    renderActions(c) {
        const users = MockAdmin.users().filter(u => u.active).map(u =>
            `<option value="${esc(u.id)}" ${u.id === c.owner ? 'selected' : ''}>${esc(u.name)}</option>`).join('');
        const tasks = MockTasks.forClaim(c.id);

        document.getElementById('actionPane').innerHTML = `
            <div class="sip-field">
                <label class="sip-label">ผู้รับผิดชอบ</label>
                <select class="sip-select" id="wOwner">${users}</select>
            </div>
            <div class="sip-field">
                <label class="sip-label">กำหนดเสร็จ</label>
                <input class="sip-input" id="wDue" type="date" value="2026-08-10">
            </div>
            <div class="sip-field">
                <label class="sip-label">บันทึกการแก้ไข</label>
                <textarea class="sip-textarea" id="wNote" rows="5"
                    placeholder="สิ่งที่แก้ไข / เหตุผล / เอกสารที่แนบเพิ่ม..."></textarea>
            </div>
            <label class="sip-checkbox" style="margin-bottom:12px">
                <input type="checkbox" id="wEvidence"> แนบหลักฐานการแก้ไขแล้ว
            </label>

            ${c.result === 'BLOCK' ? `
            <div class="sip-banner sip-banner-warning" style="margin-bottom:12px">
                <i data-lucide="user-check" class="icon-sm"></i>
                <span>กฎระดับ <strong>ระงับส่ง</strong> — ต้องอนุมัติแบบ Maker–Checker ก่อนจึงจะส่งเบิกได้</span>
            </div>` : ''}

            <div class="ds-section-label">งานที่ผูกกับเคสนี้</div>
            ${tasks.length ? tasks.map(t => `
                <div class="ds-list-card" onclick="location.href='claim-tasks.html?id=${encodeURIComponent(t.id)}'">
                    <div class="ds-list-card-top">
                        <span class="td-sub">${esc(t.id)}</span>
                        <span class="kbadge ${esc(MockTasks.statusBadge(t.status))}">${esc(MockTasks.statusLabel(t.status))}</span>
                    </div>
                    <div class="ds-list-card-name" style="font-size:12px">${esc(t.title)}</div>
                    <div class="ds-list-card-detail">
                        ${esc(MockAdmin.userName(t.owner))} · ${MockTone.slaHtml(t.due_at)}
                    </div>
                </div>`).join('')
              : '<div class="ds-empty-sm">ยังไม่มีงานที่มอบหมาย</div>'}

            <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-outline btn-sm" onclick="CaseView.openPrint()">
                    <i data-lucide="printer" class="icon-sm"></i> พิมพ์ใบสรุปเคส</button>
                ${c.result !== 'PASS' ? `
                <button class="btn btn-danger btn-sm" onclick="CaseView.openOverride(0)">
                    <i data-lucide="shield-alert" class="icon-sm"></i> ขอ Override</button>` : ''}
            </div>`;
        refreshIcons();
    },

    saveWork() {
        const c = this.current(); if (!c) return;
        const note = document.getElementById('wNote').value.trim();
        if (!note) { showToast('กรุณาบันทึกสิ่งที่แก้ไข', 'warning'); return; }

        MockDB.patch('claims', c.id, {
            owner: document.getElementById('wOwner').value,
            timeline: [...(c.timeline || []), {
                at: '2569-08-06T09:00', tone: 'info', title: 'บันทึกการแก้ไข',
                by: MockSession.user().full_name,
                note: note + (document.getElementById('wEvidence').checked ? ' · แนบหลักฐานแล้ว' : ''),
            }],
        });
        showToast('บันทึกแล้ว');
        this.select(c.id);
    },

    async saveAndRecheck() {
        const c = this.current(); if (!c) return;
        const note = document.getElementById('wNote').value.trim();
        if (!note) { showToast('กรุณาบันทึกสิ่งที่แก้ไขก่อนตรวจซ้ำ', 'warning'); return; }

        const ok = await Drawer.confirm({
            title: 'ตรวจซ้ำด้วยกฎชุดปัจจุบัน?',
            message: 'ระบบจะรันกฎที่มีผล ณ วันที่รับบริการอีกครั้ง แล้วอัปเดตผลตรวจของเคสนี้',
            lines: [`${c.id} · ${c.patient}`, `กฎที่จะใช้: ตามวันที่รับบริการ ${MockFmt.dateTH(c.service_date)}`],
            confirmText: 'ตรวจซ้ำ', danger: false,
        });
        if (!ok) return;

        MockDB.patch('claims', c.id, {
            result: 'PASS', risk_score: Math.max(5, c.risk_score - 55),
            amount_at_risk: 0, rule_results: [],
            owner: document.getElementById('wOwner').value,
            timeline: [...(c.timeline || []), {
                at: '2569-08-06T09:00', tone: 'info',    title: 'บันทึกการแก้ไข', by: MockSession.user().full_name, note },
                { at: '2569-08-06T09:01', tone: 'success', title: 'ตรวจซ้ำ — ผ่านกฎทั้งหมด',
                  by: 'Rule Engine', note: 'ประเด็นเดิมถูกปิดแล้ว พร้อมส่งเบิก' }],
        });
        showToast('ตรวจซ้ำแล้ว — เคสนี้พร้อมส่งเบิก');
        this.select(c.id);
    },

    /* ══════════ Override (BR-04) ══════════ */

    openOverride(idx) {
        const c = this.current(); if (!c) return;
        const r = (c.rule_results || [])[idx] || (c.rule_results || [])[0];
        if (!r) { showToast('เคสนี้ไม่มีผลกฎที่ต้อง Override', 'info'); return; }

        const approvers = MockAdmin.users().filter(u =>
            u.active && u.roles.some(k => MockAdmin.can(k, 'APPROVE_RULE') || MockAdmin.can(k, 'OVERRIDE')))
            .map(u => `<option value="${esc(u.id)}">${esc(u.name)} — ${esc(MockAdmin.roleLabel(u.roles[0]))}</option>`).join('');

        Drawer.open({
            title: 'ขอ Override — ' + r.rule_id,
            contentHtml: `
                <div class="sip-banner sip-banner-danger" style="margin-bottom:14px">
                    <i data-lucide="shield-alert" class="icon-sm"></i>
                    <span>การ Override ต้องบันทึก <strong>ผู้ดำเนินการ เวลา เหตุผล และหลักฐาน</strong>
                    ทุกครั้ง และตรวจย้อนหลังได้ (BR-04)</span>
                </div>
                <table class="ds-table-grid">
                    <tbody>
                        <tr><td class="l" style="width:34%">กฎ</td><td class="l">${esc(r.rule_id)} v${esc(r.version)}</td></tr>
                        <tr><td class="l">ประเด็น</td><td class="l">${esc(r.message)}</td></tr>
                        <tr><td class="l">ผลถ้าไม่แก้</td><td class="l">${r.maps_to_nhso
                            ? `จะได้รหัส <strong>${esc(r.maps_to_nhso)}</strong> กลับมาจาก สปสช.` : 'ไม่กระทบรหัสฝั่ง สปสช.'}</td></tr>
                    </tbody>
                </table>
                <div class="sip-field">
                    <label class="sip-label">ประเภทเหตุผล *</label>
                    <select class="sip-select" id="oType">
                        <option value="">— เลือก —</option>
                        <option>มีเอกสารรับรองจากแพทย์ประกอบ</option>
                        <option>เป็นข้อยกเว้นตามประกาศที่มีผลในช่วงเวลานั้น</option>
                        <option>ข้อมูลต้นทางถูกต้องแล้ว กฎตรวจเกินจริง (False Positive)</option>
                        <option>ผู้ป่วยมีเหตุจำเป็นเฉพาะราย</option>
                    </select>
                </div>
                <div class="sip-field">
                    <label class="sip-label">เหตุผลโดยละเอียด *</label>
                    <textarea class="sip-textarea" id="oReason" rows="4"
                        placeholder="อธิบายเหตุผลให้ผู้อนุมัติและผู้ตรวจสอบย้อนหลังเข้าใจได้..."></textarea>
                </div>
                <div class="sip-field">
                    <label class="sip-label">หลักฐานประกอบ *</label>
                    <input class="sip-input" id="oEvidence" placeholder="ชื่อเอกสาร / เลขที่หนังสือ / ลิงก์">
                </div>
                <div class="sip-field">
                    <label class="sip-label">ผู้อนุมัติ *</label>
                    <select class="sip-select" id="oApprover">
                        <option value="">— เลือกผู้อนุมัติ —</option>${approvers}
                    </select>
                </div>
                <div class="ds-note">
                    <i data-lucide="users" class="icon-sm"></i>
                    ผู้ขอกับผู้อนุมัติต้องเป็นคนละคน — ระบบจะบันทึกทั้งสองชื่อไว้ใน Audit Trail
                </div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                         <button class="btn btn-danger" onclick="CaseView.saveOverride('${esc(r.rule_id)}')">
                             ยื่นขอ Override</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    async saveOverride(ruleId) {
        const type     = document.getElementById('oType').value;
        const reason   = document.getElementById('oReason').value.trim();
        const evidence = document.getElementById('oEvidence').value.trim();
        const approver = document.getElementById('oApprover').value;

        if (!type || !reason || !evidence || !approver) {
            showToast('ต้องกรอกเหตุผล หลักฐาน และผู้อนุมัติให้ครบ (BR-04)', 'warning');
            return;
        }
        if (approver === MockSession.userId()) {
            showToast('ผู้ขอกับผู้อนุมัติต้องเป็นคนละคน (Maker–Checker)', 'error');
            return;
        }

        const c = this.current();
        const ok = await Drawer.confirm({
            title: 'ยืนยันการยื่นขอ Override?',
            message: 'ระบบจะบันทึกเหตุผลและหลักฐานลง Audit Trail ซึ่งลบไม่ได้',
            lines: [`กฎ ${ruleId}`, `ผู้ขอ: ${MockSession.user().full_name}`,
                    `ผู้อนุมัติ: ${MockAdmin.userName(approver)}`],
            confirmText: 'ยื่นขอ Override', danger: true,
        });
        if (!ok) return;

        const t = MockTasks.create({
            claim_id: c.id, rule_id: ruleId, kind: 'OVERRIDE',
            title: `ขอ Override ${ruleId} — ${type}`,
            owner: approver, due_at: '2569-08-07T16:00', priority: 'HIGH',
            detail: `${reason}\nหลักฐาน: ${evidence}`,
        });

        MockDB.patch('claims', c.id, {
            timeline: [...(c.timeline || []), {
                at: '2569-08-06T09:00', tone: 'warning', title: 'ยื่นขอ Override',
                by: MockSession.user().full_name,
                note: `${ruleId} · ${type} · หลักฐาน: ${evidence} · ส่งให้ ${MockAdmin.userName(approver)} อนุมัติ`,
            }],
        });

        Drawer.close();
        showToast(`ยื่นขอ Override แล้ว — ${t.id} รอ ${MockAdmin.userName(approver)} อนุมัติ`);
        this.select(c.id);
    },

    /* ══════════ ใบพิมพ์ ══════════ */

    buildDoc() {
        const c = this.current();
        const C = DocParts.CELL;
        const warnings = [];

        const fields = [
            ['รหัสเคส', c.id],
            ['HN / AN', `${c.hn}${c.an ? ' / ' + c.an : ''}`],
            ['ผู้ป่วย', c.patient],
            ['วันที่รับบริการ', MockFmt.dateTH(c.service_date)],
            ['กองทุน', c.fund],
            ['ผู้จัดทำ', MockSession.user().full_name],
        ];

        const chargeRows = (c.charges || []).map((x, i) => `<tr>
            <td style="${C}text-align:center;">${i + 1}</td>
            <td style="${C}text-align:center;">${DocParts.esc(x.file)}</td>
            <td style="${C}text-align:center;">${DocParts.esc(x.seq)}</td>
            <td style="${C}text-align:center;">${DocParts.esc(x.billgrcs)}</td>
            <td style="${C}text-align:center;">${DocParts.esc(x.stdcode)}</td>
            <td style="${C}">${DocParts.esc(x.name)}</td>
            <td style="${C}text-align:right;">${DocParts.esc(x.qty)}</td>
            <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(x.price))}</td>
            <td style="${C}text-align:right;">${DocParts.esc(x.catalogue_price == null ? '' : MockFmt.baht(x.catalogue_price))}</td>
        </tr>`).join('');

        const ruleRows = (c.rule_results || []).map((r, i) => `<tr>
            <td style="${C}text-align:center;">${i + 1}</td>
            <td style="${C}">${DocParts.esc(r.rule_id)} v${DocParts.esc(r.version)}</td>
            <td style="${C}text-align:center;">${DocParts.esc(MockTone.resultLabel[r.result])}</td>
            <td style="${C}">${DocParts.esc(r.message)}</td>
            <td style="${C}text-align:center;">${DocParts.esc(r.maps_to_nhso || '')}</td>
            <td style="${C}" class="${DocPrint.miss(r.doc_ref, 'เอกสารอ้างอิงของ ' + r.rule_id, warnings)}">
                ${DocParts.esc(r.doc_ref || '')}</td>
        </tr>`).join('');

        const th = (t, w) => `<th style="${C}font-size:11px;font-weight:700;text-align:center;`
                           + `${w ? 'width:' + w + ';' : ''}">${DocParts.esc(t)}</th>`;

        const html = `<div style="color:#000;font-size:12px;">
            ${DocParts.docHead({ title: 'ใบสรุปเคสก่อนส่งเบิก', formCode: 'CLM-01/2569', fields })}

            <div style="font-weight:700;margin:10px 0 4px">1. รายการค่าใช้จ่าย (แฟ้ม 7 — NHSO CHAD)</div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>${th('ที่', '30px')}${th('แฟ้ม', '38px')}${th('Seq', '42px')}${th('BILLGRCS', '62px')}
                    ${th('STDCODE', '62px')}${th('รายการ')}${th('จำนวน', '48px')}${th('ราคาเบิก', '66px')}${th('ราคา Catalogue', '76px')}</tr></thead>
                <tbody>${DocParts.fillRows(chargeRows, 8, 9)}</tbody>
            </table>

            <div style="font-weight:700;margin:12px 0 4px">2. ผลการตรวจด้วยกฎ</div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>${th('ที่', '30px')}${th('รหัสกฎ', '110px')}${th('ผล', '62px')}
                    ${th('ประเด็น')}${th('รหัส NHSO', '62px')}${th('เอกสารอ้างอิง', '18%')}</tr></thead>
                <tbody>${DocParts.fillRows(ruleRows, 6, 6)}</tbody>
            </table>

            <div style="margin-top:10px;font-size:12px">
                ยอดขอเบิกรวม <strong>${DocParts.esc(MockFmt.baht(c.amount_claimed))}</strong> บาท ·
                มูลค่าที่เสี่ยงถูกตัด <strong>${DocParts.esc(MockFmt.baht(c.amount_at_risk))}</strong> บาท ·
                ผลตรวจโดยรวม <strong>${DocParts.esc(MockTone.resultLabel[c.result])}</strong>
            </div>

            ${DocParts.signatureBlock(['ลงชื่อ ผู้ตรวจสอบเคลม', 'ลงชื่อ ผู้อนุมัติ'])}
            ${DocParts.footer(fields)}
        </div>`;

        return { html: DocParts.toPrintBorders(html), warnings };
    },

    openPrint() {
        if (!this.current()) { showToast('เลือกเคสก่อน', 'warning'); return; }
        const { html, warnings } = this.buildDoc();
        DocPrint.preview({ title: 'ตัวอย่างก่อนพิมพ์ — ใบสรุปเคสก่อนส่งเบิก', html, warnings });
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.CaseView = CaseView;
document.addEventListener('DOMContentLoaded', () => CaseView.init());
