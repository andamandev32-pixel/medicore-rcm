/* ────────────────────────────────────────────────────────
   คลังกฎ / สร้างกฎ — SRS §10 · FR-03 / FR-04

   ⭐ จุดสาธิตที่สำคัญที่สุดของหน้านี้
      สลับบทบาทเป็น "Rule Editor" (คุณกิตติพงษ์ = U-005) ซึ่งเป็นผู้เขียน RUL-DRG-007
      แล้วดูว่าปุ่ม "เปิดใช้กฎ" กลายเป็น disabled พร้อมแบนเนอร์ Maker–Checker (BR-05)
      สาธิตธรรมาภิบาลได้ใน 5 วินาที โดยไม่ต้องมี backend
   ──────────────────────────────────────────────────────── */

const Rules = {

    state: { id: null, filter: 'all', tab: 'detail' },

    TABS: [
        { key: 'detail',    label: 'รายละเอียด',   icon: 'info' },
        { key: 'condition', label: 'เงื่อนไข',      icon: 'filter' },
        { key: 'template',  label: 'Template',    icon: 'layout-template' },
        { key: 'version',   label: 'Version',     icon: 'git-branch' },
        { key: 'test',      label: 'ทดสอบย้อนหลัง', icon: 'flask-conical' },
    ],

    init() {
        const p = new URLSearchParams(location.search);
        this.state.id = p.get('rule');
        if (p.get('from') === 'qa') this._fromQa = { doc: p.get('doc'), q: p.get('q') };

        this.fillFunds();
        this.renderPills();
        this.renderList();

        const first = this.visible()[0];
        this.select(this.state.id || (first ? first.id : null));

        if (this._fromQa) this.openBuilder(null, this._fromQa);
    },

    current() { return this.state.id ? MockRules.byId(this.state.id) : null; },

    /* ══════════ ซ้าย ══════════ */

    fillFunds() {
        const funds = [...new Set(MockRules.all().flatMap(r => r.funds))].sort();
        document.getElementById('fFund').insertAdjacentHTML('beforeend',
            funds.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join(''));
    },

    renderPills() {
        const all = MockRules.all().length;
        document.getElementById('pillTabs').innerHTML =
            `<button class="ds-pilltab ${this.state.filter === 'all' ? 'active' : ''}"
                onclick="Rules.setFilter('all')">ทั้งหมด <span class="tab-count">${all}</span></button>` +
            RULE_LIFECYCLE.map(s => {
                const n = MockRules.byStatus(s).length;
                return `<button class="ds-pilltab ${this.state.filter === s ? 'active' : ''}"
                    onclick="Rules.setFilter('${s}')">
                    ${esc(MockTone.lifecycleLabel[s])} <span class="tab-count">${n}</span></button>`;
            }).join('');
    },

    setFilter(k) { this.state.filter = k; this.renderPills(); this.renderList(); refreshIcons(); },

    visible() {
        const kw   = (document.getElementById('listSearch').value || '').trim().toLowerCase();
        const fund = document.getElementById('fFund').value;
        return MockRules.all().filter(r => {
            if (this.state.filter !== 'all' && r.status !== this.state.filter) return false;
            if (fund !== 'all' && r.funds.indexOf(fund) < 0) return false;
            if (kw && !(`${r.id} ${r.name} ${r.category}`).toLowerCase().includes(kw)) return false;
            return true;
        });
    },

    renderList() {
        const rows = this.visible();
        document.getElementById('listCount').textContent = rows.length + ' กฎ';
        document.getElementById('listContainer').innerHTML = rows.length
            ? rows.map(r => `
                <div class="ds-list-card ${r.id === this.state.id ? 'active' : ''}"
                     onclick="Rules.select('${esc(r.id)}')">
                    <div class="ds-list-card-top">
                        <span class="td-sub">${esc(r.id)} · v${esc(r.version)}</span>
                        ${MockTone.lifecycleHtml(r.status)}
                    </div>
                    <div class="ds-list-card-name" style="font-size:12px">${esc(r.name)}</div>
                    <div class="ds-list-card-detail">
                        ${esc(r.category)}${r.maps_to_nhso ? ` · จะดัก ${esc(r.maps_to_nhso)}` : ''}
                    </div>
                </div>`).join('')
            : '<div class="ds-empty">ไม่พบกฎตามเงื่อนไข</div>';
        refreshIcons();
    },

    toggleLeft() { document.getElementById('shell').classList.toggle('left-collapsed'); },

    /* ══════════ เลือกกฎ ══════════ */

    select(id) {
        this.state.id = id;
        const r = this.current();
        document.getElementById('emptyState').style.display = r ? 'none' : '';
        document.getElementById('detailWrap').style.display = r ? '' : 'none';
        if (!r) { this.renderList(); return; }

        history.replaceState(null, '', 'claim-rules.html?rule=' + encodeURIComponent(id));
        MockSession.mountBanner('demoBanner');

        this.renderContext(r);
        this.renderMakerChecker(r);
        this.renderTabBar();
        this.renderTab(r);
        this.renderList();
        refreshIcons();
    },

    renderContext(r) {
        document.getElementById('ctxAvatar').textContent = r.id.split('-')[1] || 'R';
        document.getElementById('ctxName').textContent   = r.name;
        document.getElementById('ctxChip').innerHTML     = MockTone.lifecycleHtml(r.status);
        document.getElementById('ctxMeta').innerHTML = `
            <span>รหัสกฎ: ${esc(r.id)} · v${esc(r.version)}</span>
            <span>กองทุน: ${esc(r.funds.join(', '))}</span>
            <span>บริการ: ${esc(r.services.join(', '))}</span>
            <span>มีผล: ${esc(MockFmt.dateTH(r.effective_from))}${
                r.effective_to ? ' – ' + esc(MockFmt.dateTH(r.effective_to)) : ' เป็นต้นไป'}</span>
            <span>ผู้เขียน: ${esc(MockAdmin.userName(r.author))}</span>`;

        const canAct = MockRules.canActivate(r);
        document.getElementById('ctxActions').innerHTML = `
            <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
                <button class="btn btn-outline btn-sm" onclick="Rules.clone()">
                    <i data-lucide="copy" class="icon-sm"></i> Clone เป็น Version ใหม่</button>
                ${r.status === 'DRAFT' || r.status === 'REVIEW' ? `
                <button class="btn btn-navy btn-sm" onclick="Rules.requestApproval()">
                    <i data-lucide="send" class="icon-sm"></i> ส่งขออนุมัติ</button>` : ''}
                <button class="btn btn-primary btn-sm" ${canAct ? '' : 'disabled'}
                        onclick="Rules.activate()" title="${canAct ? 'เปิดใช้กฎนี้' : 'สิทธิ์ไม่พอ หรือคุณเป็นผู้เขียนกฎนี้'}">
                    <i data-lucide="power" class="icon-sm"></i> ${r.status === 'ACTIVE' ? 'เปิดใช้อยู่' : 'เปิดใช้กฎ'}</button>
            </div>`;
    },

    /** ⭐ แบนเนอร์ Maker–Checker — หัวใจของการสาธิตธรรมาภิบาล */
    renderMakerChecker(r) {
        const el = document.getElementById('makerCheckerBanner');
        const me = MockSession.userId();
        if (r.author === me) {
            el.innerHTML = `<div class="sip-banner sip-banner-danger" style="margin-bottom:12px">
                <i data-lucide="user-x" class="icon-sm"></i>
                <span><strong>คุณเป็นผู้เขียนกฎนี้ — อนุมัติหรือเปิดใช้กฎของตนเองไม่ได้</strong>
                กฎที่ระงับส่งหรือมีผลทางการเงินสูงต้องผ่าน Maker–Checker (BR-05)
                · ผู้อนุมัติที่กำหนดไว้: ${esc(MockAdmin.userName(r.approver) || 'ยังไม่กำหนด')}</span>
            </div>`;
        } else if (!MockAdmin.can(MockSession.current(), 'APPROVE_RULE')) {
            el.innerHTML = `<div class="sip-banner sip-banner-info" style="margin-bottom:12px">
                <i data-lucide="info" class="icon-sm"></i>
                <span>บทบาท <strong>${esc(MockSession.roleLabel())}</strong> ดูและทดสอบกฎได้
                แต่ไม่มีสิทธิ์อนุมัติเปิดใช้ — สลับเป็น Rule Approver เพื่อดูมุมของผู้อนุมัติ</span>
            </div>`;
        } else {
            el.innerHTML = `<div class="sip-banner sip-banner-success" style="margin-bottom:12px">
                <i data-lucide="user-check" class="icon-sm"></i>
                <span>คุณอยู่ในบทบาท <strong>${esc(MockSession.roleLabel())}</strong>
                และไม่ใช่ผู้เขียนกฎนี้ — จึงอนุมัติเปิดใช้ได้ตาม Maker–Checker</span>
            </div>`;
        }
    },

    renderTabBar() {
        document.getElementById('tabBar').innerHTML = this.TABS.map(t => `
            <button class="ds-tab ${t.key === this.state.tab ? 'active' : ''}"
                onclick="Rules.switchTab('${t.key}')">
                <i data-lucide="${t.icon}" class="mi"></i> ${esc(t.label)}</button>`).join('');
    },

    switchTab(k) { this.state.tab = k; this.renderTabBar(); this.renderTab(this.current()); refreshIcons(); },

    renderTab(r) {
        const fn = {
            detail:    () => this.tabDetail(r),
            condition: () => this.tabCondition(r),
            template:  () => this.tabTemplate(r),
            version:   () => this.tabVersion(r),
            test:      () => this.tabTest(r),
        }[this.state.tab];
        document.getElementById('tabContent').innerHTML = fn ? fn() : '';
    },

    /* ══════════ แท็บ ══════════ */

    tabDetail(r) {
        const kpi = r.kpi;
        return `
        <div class="cards-row">
            <div class="clinical-card">
                <div class="card-title"><i data-lucide="info" class="mi"></i> ขอบเขตการใช้กฎ (BR-01)</div>
                <table class="ds-table-grid">
                    <tbody>
                        <tr><td class="l" style="width:38%">หมวด</td><td class="l">${esc(r.category)}</td></tr>
                        <tr><td class="l">กองทุนที่ใช้</td><td class="l">${r.funds.map(f =>
                            `<span class="sip-chip sip-chip-muted">${esc(f)}</span>`).join(' ')}</td></tr>
                        <tr><td class="l">ประเภทบริการ</td><td class="l">${r.services.map(s =>
                            `<span class="sip-chip sip-chip-muted">${esc(s)}</span>`).join(' ')}</td></tr>
                        <tr><td class="l"><strong>วันที่มีผล</strong></td><td class="l">
                            <strong>${esc(MockFmt.dateTH(r.effective_from))}</strong>
                            ${r.effective_to ? ' ถึง ' + esc(MockFmt.dateTH(r.effective_to)) : ' เป็นต้นไป'}</td></tr>
                        <tr><td class="l">ระดับผล</td><td class="l">
                            ${MockTone.resultBadgeHtml(r.action)}
                            <span class="sip-chip ${esc(MockTone.severityChip[r.severity])}">${
                                esc(MockTone.severityLabel[r.severity])}</span></td></tr>
                        <tr><td class="l">รหัสที่ดักไว้ (NHSO)</td><td class="l">${r.maps_to_nhso
                            ? `<span class="sip-chip sip-chip-danger">${esc(r.maps_to_nhso)}${
                                MockClaims.codeVerified(r.maps_to_nhso) ? ''
                                : `<sup title="${esc(NHSO_UNVERIFIED_NOTE)}">*</sup>`}</span>` : '—'}</td></tr>
                        <tr><td class="l">เอกสารอ้างอิง</td><td class="l">
                            <a href="claim-knowledge.html?doc=${encodeURIComponent(r.doc_id)}">${esc(r.doc_ref)}</a></td></tr>
                        ${(() => {
                            const o = MockRules.origin(r);
                            return o ? `<tr><td class="l">ที่มาของกฎ</td><td class="l">
                                ${esc(o.text)}
                                ${o.verified
                                    ? '<span class="sip-chip sip-chip-success">อ้างหน้าเอกสารได้</span>'
                                    : `<span class="sip-chip sip-chip-amber" title="${esc(NHSO_UNVERIFIED_NOTE)}">รอยืนยัน</span>`}
                            </td></tr>` : '';
                        })()}
                    </tbody>
                </table>
                <div class="ds-note"><i data-lucide="calendar-check" class="icon-sm"></i>
                    กฎถูกเลือกใช้ตาม <strong>วันที่รับบริการ</strong> ไม่ใช่วันที่ตรวจ
                    เคสเดือนพฤษภาคมจึงยังถูกตัดสินด้วยกฎรุ่นที่มีผลตอนนั้น</div>
                ${r.origin_doc ? `<div class="ds-note">
                    <i data-lucide="scale" class="icon-sm"></i>
                    กฎนี้ถอดจากประกาศ/เอกสาร สปสช. โดยตรง — ไม่ได้อนุมานเอง จึงอ้างอิงได้ตอนโต้แย้งผลตรวจ
                    (SRS BR-03)</div>` : ''}
            </div>
            <div class="clinical-card">
                <div class="card-title"><i data-lucide="bar-chart-3" class="mi"></i> ตัวชี้วัดคุณภาพกฎ</div>
                <div class="ds-kpi-grid" style="grid-template-columns:1fr 1fr">
                    <div class="sip-kpi"><div class="sip-kpi-value">${MockFmt.int(kpi.hit)}</div>
                        <div class="sip-kpi-label">Hit (30 วัน)</div></div>
                    <div class="sip-kpi"><div class="sip-kpi-value">${MockFmt.pct(kpi.true_issue, 0)}</div>
                        <div class="sip-kpi-label">True Issue Rate</div></div>
                    <div class="sip-kpi ${kpi.false_positive > 30 ? 'critical' : ''}">
                        <div class="sip-kpi-value">${MockFmt.pct(kpi.false_positive, 0)}</div>
                        <div class="sip-kpi-label">False Positive</div></div>
                    <div class="sip-kpi"><div class="sip-kpi-value">${MockFmt.pct(kpi.override, 0)}</div>
                        <div class="sip-kpi-label">Override Rate</div></div>
                </div>
                <div style="margin-top:8px">
                    <div class="ds-section-label">มูลค่าที่ป้องกันไว้ได้</div>
                    <div style="font-size:28px;font-weight:800;color:var(--status-success-strong)">
                        ${esc(MockFmt.baht(kpi.prevented))} <span style="font-size:13px">บาท</span></div>
                </div>
                ${kpi.false_positive > 30 ? `
                <div class="sip-banner sip-banner-warning" style="margin-top:10px">
                    <i data-lucide="alert-triangle" class="icon-sm"></i>
                    <span>False Positive สูงกว่า 30% — ควรปรับ Threshold หรือจำกัดขอบเขต
                    ก่อนที่ผู้ใช้จะเริ่มกด Override เป็นนิสัย</span></div>` : ''}
            </div>
        </div>
        <div class="section-card">
            <div class="section-title" style="margin-bottom:8px"><i data-lucide="file-text" class="mi"></i> คำอธิบาย</div>
            <div style="font-size:13px;line-height:1.7;color:var(--text-secondary)">${esc(r.desc)}</div>
        </div>`;
    },

    tabCondition(r) {
        return `
        <div class="section-card">
            <div class="section-header">
                <div class="section-title"><i data-lucide="filter" class="mi"></i> เงื่อนไขของกฎ</div>
                <div class="section-actions">
                    <button class="btn btn-outline btn-sm" onclick="Rules.openCondition()">
                        <i data-lucide="plus" class="icon-sm"></i> เพิ่มเงื่อนไข</button>
                </div>
            </div>
            ${r.conditions.map((c, i) => `
                <div class="ds-block" style="margin-bottom:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    ${c.join ? `<span class="sip-chip sip-chip-active">${esc(c.join)}</span>`
                             : '<span class="sip-chip sip-chip-muted">ถ้า</span>'}
                    <strong style="color:var(--brand-navy)">${esc(c.field)}</strong>
                    <span class="sip-chip sip-chip-amber">${esc(c.op)}</span>
                    <span>${esc(c.value)}</span>
                </div>`).join('')}
            <div class="ds-block" style="background:var(--status-danger-soft);border-color:var(--status-danger)">
                <i data-lucide="corner-down-right" class="icon-sm"></i>
                <strong>ผลลัพธ์:</strong> ${MockTone.resultBadgeHtml(r.action)}
                ${r.maps_to_nhso ? ` · ถ้าปล่อยผ่านจะได้รหัส <strong>${esc(r.maps_to_nhso)}</strong> กลับมาจาก สปสช.` : ''}
            </div>
        </div>
        <div class="ds-note"><i data-lucide="code" class="icon-sm"></i>
            เงื่อนไขทั้งหมดสร้างจากหน้าจอ ไม่ต้องแก้โปรแกรม — รองรับ AND/OR, ตัวเปรียบเทียบ,
            ตรวจค่าว่าง, ช่วงเวลา, รายการซ้ำ และความสัมพันธ์ข้ามแฟ้ม (FR-03)</div>`;
    },

    tabTemplate(r) {
        return `
        <div class="ds-note" style="margin-bottom:12px">
            <i data-lucide="wand-2" class="icon-sm"></i>
            เลือก Template แล้วกรอกค่า — ได้ร่างกฎใหม่โดยไม่ต้องเขียนโค้ด
            ร่างจะเข้าสถานะ "ร่าง" และต้องผ่านการทดสอบย้อนหลังกับการอนุมัติก่อนเปิดใช้
        </div>
        <div class="cards-row" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">
            ${MOCK_RULE_TEMPLATES.map(t => `
                <div class="card" style="padding:14px">
                    <div class="card-title"><i data-lucide="${t.icon}" class="mi"></i> ${esc(t.name)}</div>
                    <div style="font-size:12px;color:var(--text-muted);line-height:1.6;margin-bottom:10px">
                        ${esc(t.desc)}</div>
                    ${t.maps ? `<div style="margin-bottom:10px">
                        <span class="sip-chip sip-chip-danger">ดัก ${esc(t.maps)}</span></div>` : ''}
                    <button class="btn btn-primary btn-sm btn-block" onclick="Rules.openBuilder('${esc(t.key)}')">
                        <i data-lucide="plus" class="icon-sm"></i> สร้างจาก Template</button>
                </div>`).join('')}
        </div>`;
    },

    tabVersion(r) {
        const vs = MockRules.versions(r.id);
        return `
        <div class="sip-banner sip-banner-info" style="margin-bottom:12px">
            <i data-lucide="lock" class="icon-sm"></i>
            <span><strong>กฎที่เปิดใช้แล้วแก้ในที่เดิมไม่ได้</strong> — ต้อง Clone เป็น Version ใหม่ (BR-02)
            เพื่อให้ตรวจย้อนหลังได้ว่าเคสเมื่อ 6 เดือนก่อนถูกตัดสินด้วยเกณฑ์อะไร</span>
        </div>
        <div class="table-responsive">
        <table class="data-table compact">
            <thead><tr><th style="width:1%">Version</th><th style="width:1%">สถานะ</th>
                <th style="width:1%">ผู้เขียน</th><th style="width:1%">ผู้อนุมัติ</th>
                <th style="width:1%">วันที่มีผล</th><th>บันทึกการเปลี่ยนแปลง</th></tr></thead>
            <tbody>${vs.map(v => `<tr ${v.version === r.version ? 'style="background:var(--primary-bg)"' : ''}>
                <td><strong>v${esc(v.version)}</strong></td>
                <td>${MockTone.lifecycleHtml(v.status)}</td>
                <td class="td-sub">${esc(MockAdmin.userName(v.author))}</td>
                <td class="td-sub">${esc(v.approver ? MockAdmin.userName(v.approver) : '—')}</td>
                <td class="td-sub" style="white-space:nowrap">${esc(MockFmt.dateTH(v.effective_from))}</td>
                <td>${esc(v.note)}</td>
            </tr>`).join('')}</tbody>
        </table></div>
        <div class="ds-note"><i data-lucide="history" class="icon-sm"></i>
            เคสที่รับบริการก่อน ${esc(MockFmt.dateTH(r.effective_from))} จะยังถูกตัดสินด้วย Version เดิม
            — ไม่ใช่ Version ปัจจุบัน</div>`;
    },

    tabTest(r) {
        const t = MOCK_RULE_TESTS[r.id];
        if (!t) {
            return `<div class="section-card">
                <div class="section-title" style="margin-bottom:10px">
                    <i data-lucide="flask-conical" class="mi"></i> ทดสอบย้อนหลัง</div>
                <div class="ds-empty">ยังไม่เคยรันทดสอบกฎนี้
                    <div class="td-sub" style="margin-top:6px">
                        ต้องทดสอบกับข้อมูลย้อนหลังและประเมิน False Positive ก่อนขออนุมัติเปิดใช้ (FR-04)</div></div>
                <div style="text-align:center;margin-top:12px">
                    <select class="sip-select" style="width:280px;display:inline-block" id="testSet">
                        <option>เคสย้อนหลัง 1,240 เคส (ก.พ.–มิ.ย. 2569)</option>
                        <option>เคสย้อนหลัง 30 วันล่าสุด</option>
                        <option>เฉพาะเคสที่เคยถูกตีกลับ</option>
                    </select>
                    <button class="btn btn-navy" style="margin-left:8px" onclick="Rules.runTest()">
                        <i data-lucide="play" class="icon-sm"></i> รันทดสอบ</button>
                </div>
            </div>`;
        }
        const pass = t.rows.filter(x => x.pass).length;
        return `
        <div class="section-card">
            <div class="section-header">
                <div class="section-title"><i data-lucide="flask-conical" class="mi"></i> ผลการทดสอบย้อนหลัง</div>
                <div class="section-actions">
                    <span class="sip-chip sip-chip-muted">${esc(t.dataset)}</span>
                    <button class="btn btn-outline btn-sm" onclick="Rules.runTest()">
                        <i data-lucide="refresh-cw" class="icon-sm"></i> รันใหม่</button>
                </div>
            </div>
            <div class="ds-kpi-grid">
                <div class="sip-kpi"><div class="sip-kpi-value">${t.summary.hit}</div>
                    <div class="sip-kpi-label">Hit</div></div>
                <div class="sip-kpi"><div class="sip-kpi-value">${t.summary.true_issue}%</div>
                    <div class="sip-kpi-label">True Issue Rate</div></div>
                <div class="sip-kpi ${t.summary.false_positive > 30 ? 'critical' : ''}">
                    <div class="sip-kpi-value">${t.summary.false_positive}%</div>
                    <div class="sip-kpi-label">False Positive</div></div>
                <div class="sip-kpi"><div class="sip-kpi-value">${pass}/${t.rows.length}</div>
                    <div class="sip-kpi-label">เคสตัวอย่างที่ตรงตามคาด</div></div>
            </div>
            <div class="table-responsive">
            <table class="data-table compact">
                <thead><tr><th>เคส</th><th style="width:1%">คาดหวัง</th>
                    <th style="width:1%">ผลจริง</th><th style="width:1%">ผ่าน?</th></tr></thead>
                <tbody>${t.rows.map(x => `<tr>
                    <td><a href="claim-case.html?id=${encodeURIComponent(x.claim)}">${esc(x.claim)}</a></td>
                    <td class="td-sub">${esc(x.expect)}</td>
                    <td class="td-sub">${esc(x.actual)}</td>
                    <td>${x.pass ? '<span class="sip-chip sip-chip-success">ตรง</span>'
                                 : '<span class="sip-chip sip-chip-danger">ไม่ตรง</span>'}</td>
                </tr>`).join('')}</tbody>
            </table></div>
            <div class="ds-note"><i data-lucide="clock" class="icon-sm"></i>
                รันเมื่อ ${esc(MockFmt.dateTimeTH(t.ran_at))} โดย ${esc(MockAdmin.userName(t.ran_by))}
                — ต้องรันซ้ำทุกครั้งที่แก้เงื่อนไข ก่อนส่งขออนุมัติ</div>
        </div>`;
    },

    /* ══════════ การกระทำ ══════════ */

    runTest() {
        const el = document.getElementById('tabContent');
        el.innerHTML = `<div class="section-card" style="text-align:center;padding:40px">
            <div class="ds-spinner ds-spinner-lg"></div>
            <div style="margin-top:14px;font-size:13px;color:var(--text-muted)">
                กำลังรันกฎกับข้อมูลย้อนหลัง...</div></div>`;
        setTimeout(() => {
            this.renderTab(this.current());
            refreshIcons();
            showToast('รันทดสอบย้อนหลังเสร็จแล้ว');
        }, 900);
    },

    async clone() {
        const r = this.current();
        const ok = await Drawer.confirm({
            title: 'Clone เป็น Version ใหม่?',
            message: 'ระบบจะสร้าง v' + (r.version + 1) + ' สถานะ "ร่าง" โดยคงกฎเดิมไว้ทั้งหมด',
            lines: [`${r.id} v${r.version} → v${r.version + 1}`, 'กฎเดิมยังใช้ตัดสินเคสย้อนหลังได้ตามปกติ'],
            confirmText: 'Clone', danger: false,
        });
        if (!ok) return;
        showToast(`สร้าง ${r.id} v${r.version + 1} เป็นร่างแล้ว (โหมดสาธิต)`);
    },

    requestApproval() {
        const r = this.current();
        const approvers = MockAdmin.users().filter(u =>
            u.active && u.id !== r.author && u.roles.some(k => MockAdmin.can(k, 'APPROVE_RULE')))
            .map(u => `<option value="${esc(u.id)}">${esc(u.name)} — ${esc(MockAdmin.roleLabel(u.roles[0]))}</option>`).join('');

        Drawer.open({
            title: 'ส่งขออนุมัติเปิดใช้ — ' + r.id,
            contentHtml: `
                <div class="sip-banner sip-banner-info" style="margin-bottom:14px">
                    <i data-lucide="users" class="icon-sm"></i>
                    <span>รายชื่อผู้อนุมัติตัดผู้เขียนกฎ (${esc(MockAdmin.userName(r.author))}) ออกแล้วโดยอัตโนมัติ</span>
                </div>
                <table class="ds-table-grid">
                    <tbody>
                        <tr><td class="l" style="width:32%">กฎ</td><td class="l">${esc(r.id)} v${esc(r.version)} — ${esc(r.name)}</td></tr>
                        <tr><td class="l">ระดับผล</td><td class="l">${esc(MockTone.resultLabel[r.action])}</td></tr>
                        <tr><td class="l">ผลทดสอบย้อนหลัง</td><td class="l">${
                            MOCK_RULE_TESTS[r.id]
                                ? `Hit ${MOCK_RULE_TESTS[r.id].summary.hit} · True Issue ${MOCK_RULE_TESTS[r.id].summary.true_issue}% · False Positive ${MOCK_RULE_TESTS[r.id].summary.false_positive}%`
                                : '<span style="color:var(--status-danger)">ยังไม่ได้ทดสอบ</span>'}</td></tr>
                    </tbody>
                </table>
                <div class="sip-field">
                    <label class="sip-label">ผู้อนุมัติ *</label>
                    <select class="sip-select" id="apUser"><option value="">— เลือก —</option>${approvers}</select>
                </div>
                <div class="sip-field">
                    <label class="sip-label">วันที่ต้องการให้มีผล</label>
                    <input class="sip-input" id="apDate" type="date" value="2026-09-01">
                </div>
                <div class="sip-field">
                    <label class="sip-label">เหตุผลที่ขอเปิดใช้</label>
                    <textarea class="sip-textarea" id="apNote" rows="3">${esc(r.desc)}</textarea>
                </div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                         <button class="btn btn-navy" onclick="Rules.saveApproval()">ส่งขออนุมัติ</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    saveApproval() {
        const who = document.getElementById('apUser').value;
        if (!who) { showToast('กรุณาเลือกผู้อนุมัติ', 'warning'); return; }
        const r = this.current();
        const t = MockTasks.create({
            claim_id: null, rule_id: r.id, kind: 'APPROVE_RULE',
            title: `อนุมัติเปิดใช้ ${r.id} v${r.version}`,
            owner: who, due_at: '2569-08-09T17:00', priority: 'HIGH',
            detail: document.getElementById('apNote').value.trim(),
        });
        MockDB.patch('rules', r.id, { status: 'REVIEW' });
        Drawer.close();
        showToast(`ส่งขออนุมัติแล้ว — ${t.id} รอ ${MockAdmin.userName(who)} พิจารณา`);
        this.select(r.id);
        this.renderPills();
    },

    async activate() {
        const r = this.current();
        if (!MockRules.canActivate(r)) {
            showToast('ผู้เขียนกฎอนุมัติกฎของตนเองไม่ได้ (BR-05)', 'error');
            return;
        }
        const ok = await Drawer.confirm({
            title: 'เปิดใช้กฎนี้?',
            message: 'กฎจะเริ่มตรวจเคสที่รับบริการตั้งแต่วันที่มีผลเป็นต้นไป',
            lines: [`${r.id} v${r.version} — ${r.name}`,
                    `วันที่มีผล: ${MockFmt.dateTH(r.effective_from)}`,
                    `ผู้อนุมัติ: ${MockSession.user().full_name}`],
            confirmText: 'เปิดใช้กฎ', danger: false,
        });
        if (!ok) return;
        MockDB.patch('rules', r.id, { status: 'ACTIVE', approver: MockSession.userId() });
        showToast('เปิดใช้กฎแล้ว — บันทึกลง Audit Trail');
        this.select(r.id);
        this.renderPills();
    },

    openCondition() {
        Drawer.open({
            title: 'เพิ่มเงื่อนไข',
            contentHtml: `
                <div class="sip-field">
                    <label class="sip-label">ตัวเชื่อม</label>
                    <select class="sip-select"><option>AND</option><option>OR</option></select>
                </div>
                <div class="sip-field">
                    <label class="sip-label">ฟิลด์ที่ตรวจ</label>
                    <select class="sip-select">
                        <option>แฟ้ม 7 · ราคาที่เบิกต่อหน่วย</option>
                        <option>แฟ้ม 7 · หมวดค่าใช้จ่าย (BILLGRCS)</option>
                        <option>แฟ้ม 7 · STDCODE</option>
                        <option>แฟ้ม 5 · รหัสวินิจฉัย</option>
                        <option>แฟ้ม 6 · รหัสหัตถการ</option>
                        <option>แฟ้ม 1 · ประเภทสิทธิ</option>
                        <option>แฟ้ม 14 · จำนวนวันนอน</option>
                    </select>
                </div>
                <div class="sip-field">
                    <label class="sip-label">ตัวดำเนินการ</label>
                    <select class="sip-select">
                        <option>เท่ากับ</option><option>ไม่เท่ากับ</option><option>มากกว่า</option>
                        <option>น้อยกว่า</option><option>อยู่ในชุด</option><option>ไม่อยู่ในชุด</option>
                        <option>ว่าง</option><option>ไม่ว่าง</option><option>ไม่ตรงกับ</option>
                    </select>
                </div>
                <div class="sip-field">
                    <label class="sip-label">ค่าที่เปรียบเทียบ</label>
                    <input class="sip-input" placeholder="เช่น ราคาใน Drug Catalogue (STDCODE เดียวกัน)">
                </div>
                <div class="ds-note"><i data-lucide="info" class="icon-sm"></i>
                    หลังเพิ่มเงื่อนไขต้องรันทดสอบย้อนหลังใหม่ก่อนขออนุมัติ</div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                         <button class="btn btn-save" onclick="Drawer.close();showToast('เพิ่มเงื่อนไขในร่างแล้ว (โหมดสาธิต)')">
                             เพิ่มเงื่อนไข</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    /** สร้างร่างกฎจาก Template หรือจากคำตอบใน Knowledge Center */
    openBuilder(templateKey, fromQa) {
        const t = MOCK_RULE_TEMPLATES.find(x => x.key === templateKey);
        const title = fromQa ? 'สร้างร่างกฎจากคำตอบใน Knowledge Center'
                             : 'สร้างร่างกฎจาก Template — ' + (t ? t.name : '');

        Drawer.open({
            title,
            contentHtml: `
                ${fromQa ? `<div class="sip-banner sip-banner-info" style="margin-bottom:14px">
                    <i data-lucide="book-open" class="icon-sm"></i>
                    <span>อ้างอิงจากเอกสาร <strong>${esc(fromQa.doc || '—')}</strong>
                    ที่ค้นได้จาก Knowledge Center — ระบบเติมเอกสารอ้างอิงให้อัตโนมัติ</span></div>` : ''}
                <div class="sip-field">
                    <label class="sip-label">ชื่อกฎ *</label>
                    <input class="sip-input" id="bName" value="${esc(t ? t.name : '')}">
                </div>
                <div class="sip-field-row">
                    <div class="sip-field">
                        <label class="sip-label">หมวด</label>
                        <select class="sip-select" id="bCat">
                            <option>ราคาและค่าใช้จ่าย</option><option>สิทธิและการปิดสิทธิ</option>
                            <option>Coding</option><option>ความครบของข้อมูล</option>
                            <option>เอกสาร</option><option>Clinical</option>
                        </select>
                    </div>
                    <div class="sip-field">
                        <label class="sip-label">ระดับผล</label>
                        <select class="sip-select" id="bAction">
                            <option value="WARN">แจ้งเตือน</option>
                            <option value="FIX" selected>ต้องแก้ไข</option>
                            <option value="APPROVE">ต้องอนุมัติ</option>
                            <option value="BLOCK">ระงับส่ง</option>
                        </select>
                    </div>
                </div>
                <div class="sip-field-row">
                    <div class="sip-field">
                        <label class="sip-label">วันที่เริ่มมีผล</label>
                        <input class="sip-input" id="bFrom" type="date" value="2026-09-01">
                    </div>
                    <div class="sip-field">
                        <label class="sip-label">รหัส NHSO ที่ต้องการดัก</label>
                        <input class="sip-input" id="bMaps" value="${esc(t && t.maps ? t.maps : '')}" placeholder="เช่น P124">
                    </div>
                </div>
                <div class="sip-field">
                    <label class="sip-label">เงื่อนไขที่แนะนำ</label>
                    <textarea class="sip-textarea" id="bCond" rows="3">${esc(t ? t.desc : '')}</textarea>
                </div>
                <div class="sip-banner sip-banner-warning">
                    <i data-lucide="alert-triangle" class="icon-sm"></i>
                    <span>ร่างกฎจะยังไม่มีผลกับเคสใด ๆ จนกว่าจะผ่านการทดสอบย้อนหลังและได้รับอนุมัติจาก
                    ผู้ที่ไม่ใช่ผู้เขียน (BR-05)</span>
                </div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                         <button class="btn btn-save" onclick="Rules.saveDraft()">บันทึกเป็นร่าง</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    saveDraft() {
        const name = document.getElementById('bName').value.trim();
        if (!name) { showToast('กรุณากรอกชื่อกฎ', 'warning'); return; }
        const d = document.getElementById('bFrom').value;
        const from = d ? `${(+d.slice(0, 4)) + 543}${d.slice(4)}` : '2569-09-01';
        const action = document.getElementById('bAction').value;

        const rule = {
            id: MockRules.nextDraftId('RUL-NEW'), name,
            category: document.getElementById('bCat').value,
            status: 'DRAFT', version: 1,
            author: MockSession.userId(), approver: null,
            funds: ['UC'], services: ['OPD'],
            effective_from: from, effective_to: null,
            severity: action === 'WARN' ? 'WARNING' : 'ERROR',
            action, maps_to_nhso: document.getElementById('bMaps').value.trim() || null,
            doc_id: 'DOC-NHSO-2569-012', doc_ref: 'รอระบุ',
            desc: document.getElementById('bCond').value.trim(),
            conditions: [{ join: '', field: 'รอกำหนดเงื่อนไข', op: '—', value: '—' }],
            kpi: { hit: 0, true_issue: 0, override: 0, false_positive: 0, prevented: 0 },
        };
        MockDB.insert('rules', rule);
        Drawer.close();
        showToast(`สร้างร่างกฎ ${rule.id} แล้ว — ต้องทดสอบและอนุมัติก่อนเปิดใช้`);
        this.state.filter = 'DRAFT';
        this.renderPills();
        this.renderList();
        this.select(rule.id);
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.Rules = Rules;
document.addEventListener('DOMContentLoaded', () => Rules.init());
