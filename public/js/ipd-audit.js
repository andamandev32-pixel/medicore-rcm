/* ────────────────────────────────────────────────────────
   ตรวจแฟ้มผู้ป่วยใน / ประเมินก่อนส่งตรวจ (IPD Chart Audit)

   นี่คือด่านที่ตอบโจทย์ "ประเมินก่อนส่งตรวจ ตรวจแฟ้มผู้ป่วยใน ตามเงื่อนไขของแต่ละกองทุน"
   ผู้ตรวจเห็น 5 ด้านในหน้าจอเดียว แล้วจึงตัดสิน
     1. เงื่อนไขของกองทุนที่ผู้ป่วยใช้สิทธิ (ต่างกันทุกกองทุน)
     2. ความครบของแฟ้มตามชุดข้อมูลมาตรฐาน สปสช. (กองทุนเอกชนข้ามข้อนี้)
     3. ความครบของเวชระเบียน
     4. กลุ่ม DRG กับผลทางการเงิน
     5. ผลกฎที่ scope IPD

   แพทเทิร์นเดียวกับ claim-case.js · ทุกตัวเลข derive จาก MockIpd ห้าม hardcode
   ──────────────────────────────────────────────────────── */

const IpdAudit = {

    TABS: ['fund', 'files', 'chart', 'drg', 'rules', 'summary'],

    FILTERS: [
        { key: 'PENDING',   label: 'รอตรวจ' },
        { key: 'IN_REVIEW', label: 'กำลังตรวจ' },
        { key: 'RETURNED',  label: 'ตีกลับ' },
        { key: 'CLEARED',   label: 'ผ่านแล้ว' },
        { key: 'all',       label: 'ทั้งหมด' },
    ],

    state: { id: null, filter: 'PENDING', tab: 'fund' },

    init() {
        const p = new URLSearchParams(location.search);
        if (p.get('filter')) this.state.filter = p.get('filter');

        this.fillFilters();

        /* ถ้ากล่องเริ่มต้นว่างสำหรับสถานการณ์ปัจจุบัน ให้เด้งไปกล่องแรกที่มีของ
           ไม่งั้นเปิดหน้ามาแล้วดูเหมือนระบบพัง */
        if (!this.pool().filter(s => this.matchFilter(s, this.state.filter)).length) {
            const alt = this.FILTERS.find(f => this.pool().some(s => this.matchFilter(s, f.key)));
            if (alt) this.state.filter = alt.key;
        }

        this.renderPills();
        this.renderList();

        const an  = p.get('an');
        const hit = an ? MockIpd.byAn(an) : null;
        if (hit && !this.matchFilter(hit, this.state.filter)) {
            this.state.filter = 'all';
            this.renderPills();
            this.renderList();
        }
        const first = this.visible()[0];
        this.select(hit ? hit.id : (first ? first.id : null));

        /* ข้อมูล admission จริง merge เสร็จ (mock-ipddata.js) → วาดใหม่ด้วยข้อมูล DB */
        document.addEventListener('refdata:updated', e => {
            if (!e.detail || !e.detail.ipdStays) return;
            this.renderPills();
            this.renderList();
            this.select(this.state.id);
        });
    },

    current() { return this.state.id ? MockIpd.byId(this.state.id) : null; },

    /** เฉพาะเคสที่จำหน่ายแล้วและเข้าคิวตรวจ */
    pool() { return MockIpd.toAudit(); },

    matchFilter(s, key) { return key === 'all' ? true : s.audit_status === key; },

    /* ══════════ คอลัมน์ซ้าย ══════════ */

    fillFilters() {
        const rows = this.pool();
        document.getElementById('fFund').insertAdjacentHTML('beforeend', IPD_FUNDS
            .filter(f => rows.some(s => s.fund === f.key))
            .map(f => `<option value="${esc(f.key)}">${esc(f.short)}</option>`).join(''));
        document.getElementById('fWard').insertAdjacentHTML('beforeend', IPD_WARDS
            .filter(w => rows.some(s => s.ward === w.key))
            .map(w => `<option value="${esc(w.key)}">${esc(w.label)}</option>`).join(''));
    },

    renderPills() {
        const rows = this.pool();
        document.getElementById('pillTabs').innerHTML = this.FILTERS.map(f => `
            <button class="ds-pilltab ${f.key === this.state.filter ? 'active' : ''}"
                    onclick="IpdAudit.setFilter('${f.key}')">
                ${esc(f.label)} <span class="tab-count">${rows.filter(s => this.matchFilter(s, f.key)).length}</span></button>`).join('');
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
        const ward = document.getElementById('fWard').value;

        return this.pool().filter(s => {
            if (!this.matchFilter(s, this.state.filter)) return false;
            if (fund !== 'all' && s.fund !== fund) return false;
            if (ward !== 'all' && s.ward !== ward) return false;
            if (kw && !(`${s.an} ${s.hn} ${s.patient}`).toLowerCase().includes(kw)) return false;
            return true;
        });
    },

    renderList() {
        const rows = this.visible();
        document.getElementById('listCount').textContent = rows.length + ' รายการ';
        document.getElementById('listContainer').innerHTML = rows.length
            ? rows.map(s => {
                const a  = MockIpd.assess(s);
                const dl = MockIpd.submitDeadline(s);
                return `
                <div class="ds-list-card ${s.id === this.state.id ? 'active' : ''}"
                     onclick="IpdAudit.select('${esc(s.id)}')">
                    <div class="ds-list-card-top">
                        <span class="td-sub">AN ${esc(s.an)}</span>
                        ${MockTone.resultChipHtml(a.result)}
                    </div>
                    <div class="ds-list-card-name">${esc(s.patient)}</div>
                    <div class="ds-list-card-detail">
                        ${esc((MockIpd.fund(s.fund) || {}).short || s.fund)} ·
                        จำหน่าย ${esc(MockFmt.dateTH(s.discharge_at))} ·
                        นอน ${esc(MockIpd.los(s))} วัน · คะแนน ${esc(a.score)}
                    </div>
                    ${dl && s.audit_status !== 'CLEARED'
                        ? `<div style="margin-top:4px">${MockTone.slaHtml(dl)}</div>` : ''}
                </div>`; }).join('')
            : '<div class="ds-empty">ไม่พบแฟ้มตามเงื่อนไข</div>';
        refreshIcons();
    },

    toggleLeft() { document.getElementById('shell').classList.toggle('left-collapsed'); },

    /* ══════════ เลือกแฟ้ม ══════════ */

    select(id) {
        this.state.id = id;
        const s = this.current();

        document.getElementById('emptyState').style.display = s ? 'none' : '';
        document.getElementById('detailWrap').style.display = s ? '' : 'none';
        if (!s) { this.renderList(); return; }

        history.replaceState(null, '', 'ipd-audit.html?an=' + encodeURIComponent(s.an));

        MockSession.mountBanner('demoBanner');
        this.renderContext(s);
        this.renderFund(s);
        this.renderFiles(s);
        this.renderChart(s);
        this.renderDrg(s);
        this.renderRules(s);
        this.renderSummary(s);
        this.renderActions(s);
        this.renderList();
        refreshIcons();
    },

    renderContext(s) {
        const a  = MockIpd.assess(s);
        const dl = MockIpd.submitDeadline(s);

        document.getElementById('ctxAvatar').textContent =
            s.patient.replace(/^(นาย|นาง|นางสาว|ด\.ช\.|ด\.ญ\.)/, '').trim().charAt(0);
        document.getElementById('ctxName').textContent = s.patient;
        document.getElementById('ctxChip').innerHTML   = MockTone.resultChipHtml(a.result);
        document.getElementById('ctxMeta').innerHTML = `
            <span>AN ${esc(s.an)} · HN ${esc(s.hn)}</span>
            <span>กองทุน: ${esc((MockIpd.fund(s.fund) || {}).label || s.fund)}</span>
            <span>รับไว้–จำหน่าย: ${esc(MockFmt.dateTH(s.admit_at))} – ${esc(MockFmt.dateTH(s.discharge_at))}</span>
            <span>วันนอนที่เบิกได้: ${esc(MockIpd.los(s))} วัน</span>
            <span>สถานะตรวจ: ${esc(MockIpd.auditOf(s.audit_status).label)}</span>
            ${dl ? `<span>ยื่นภายใน: ${esc(MockFmt.dateTH(dl))}</span>` : ''}`;

        const alert = document.getElementById('ctxAlert');
        const worst = a.reasons.find(r => r.tone === 'danger') || a.reasons[0];
        if (worst) {
            alert.style.display = '';
            document.getElementById('ctxAlertLabel').textContent =
                a.result === 'BLOCK' ? 'ระงับส่ง' : 'ต้องแก้ไขก่อนส่ง';
            document.getElementById('ctxAlertText').textContent = a.reasons.length > 1
                ? `${worst.text} (และอีก ${a.reasons.length - 1} รายการ)` : worst.text;
        } else {
            alert.style.display = 'none';
        }
    },

    showAlert() { this.switchTab('summary'); },

    switchTab(key, btn) {
        this.state.tab = key;
        document.querySelectorAll('.ds-tab').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        else document.querySelectorAll('.ds-tab')[this.TABS.indexOf(key)].classList.add('active');

        document.querySelectorAll('.ds-tab-content').forEach(el => el.classList.remove('active'));
        const map = { fund: 'tabFund', files: 'tabFiles', chart: 'tabChart',
                      drg: 'tabDrg', rules: 'tabRules', summary: 'tabSummary' };
        document.getElementById(map[key]).classList.add('active');
        refreshIcons();
    },

    /* ══════════ แท็บ 1 — เงื่อนไขกองทุน ══════════ */

    renderFund(s) {
        const fund = MockIpd.fund(s.fund) || {};
        const rule = MockIpd.fundRule(s.fund);
        const rows = MockIpd.fundCheckItems(s);
        const bad  = rows.filter(r => r.state === 'MISSING').length;
        const dl   = MockIpd.submitDeadline(s);

        setBadge('fundBadge', bad);

        document.getElementById('tabFund').innerHTML = `
            <div class="cards-row">
                <div class="card"><div class="card-title">กองทุนที่ใช้สิทธิ</div>
                    <div style="font-size:17px;font-weight:800;line-height:1.4">${esc(fund.label || s.fund)}</div>
                    <div class="td-sub">ผู้รับผิดชอบจ่าย: ${esc(fund.payer || '—')}</div></div>
                <div class="card"><div class="card-title">ช่องทางยื่น</div>
                    <div style="font-size:12px;line-height:1.6">${esc(rule.channel)}</div></div>
                <div class="card"><div class="card-title">กำหนดยื่น</div>
                    <div style="font-size:17px;font-weight:800">${dl ? esc(MockFmt.dateTH(dl)) : '—'}</div>
                    <div class="td-sub">${dl ? MockFmt.countdown(dl) : esc(rule.submitDue.note)}</div></div>
                <div class="card"><div class="card-title">วิธีจ่าย</div>
                    <div style="font-size:12px;line-height:1.6">${esc(rule.payment.note)}</div></div>
            </div>

            ${bad ? `<div class="sip-banner sip-banner-danger">
                <i data-lucide="x-circle" class="icon-sm"></i>
                ยังไม่ผ่านเงื่อนไขของกองทุน ${esc(fund.short || s.fund)} จำนวน ${bad} ข้อ
              </div>` : `<div class="sip-banner sip-banner-success">
                <i data-lucide="check-circle-2" class="icon-sm"></i>
                ผ่านเงื่อนไขของกองทุน ${esc(fund.short || s.fund)} ครบทุกข้อ</div>`}

            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="list-checks" class="mi"></i>
                        รายการตรวจตามเงื่อนไขกองทุน
                        <span class="ds-pane-count">${rows.filter(r => r.state === 'OK').length}/${rows.length} ผ่าน</span></div>
                </div>
                <div class="table-responsive">
                    <table class="data-table compact">
                        <thead><tr>
                            <th>รายการที่กองทุนกำหนด</th><th>รายละเอียด</th>
                            <th style="width:1%">สถานะ</th><th style="width:1%">ตรวจแล้ว</th>
                        </tr></thead>
                        <tbody>${rows.map(r => `<tr>
                            <td>${esc(r.label)}${r.required ? '' : ' <span class="td-sub">(ไม่บังคับ)</span>'}</td>
                            <td class="td-sub">${esc(r.detail || '')}</td>
                            <td>${stateChip(r.state)}</td>
                            <td style="white-space:nowrap">${stateButtons('fund', r.key, r.state)}</td>
                        </tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>

            ${rule.limits && rule.limits.length ? `
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="alert-circle" class="mi"></i> ข้อจำกัด / เพดานของกองทุนนี้</div>
                </div>
                <ul style="margin:6px 0 2px;padding-left:20px;font-size:12px;line-height:1.9">
                    ${rule.limits.map(l => `<li>${esc(l)}</li>`).join('')}
                </ul>
            </div>` : ''}

            ${unverifiedNote('เงื่อนไขกองทุนชุดนี้เรียบเรียงจากความเข้าใจทั่วไป ยังไม่ได้เทียบกับประกาศฉบับจริง '
                           + 'ต้องให้เจ้าหน้าที่ที่รับผิดชอบกองทุนตรวจก่อนใช้อ้างอิง')}`;
    },

    /* ══════════ แท็บ 2 — แฟ้ม 1–15 ══════════ */

    renderFiles(s) {
        const fc   = MockIpd.fileCheck(s);
        const rule = MockIpd.fundRule(s.fund);
        setBadge('fileBadge', fc.nhso ? fc.missing.length : 0);

        /* กองทุนที่ไม่ผ่าน สปสช. ไม่มีชุดข้อมูล 15 แฟ้ม — แสดงชุดเอกสารของบริษัทประกันแทน */
        if (!fc.nhso) {
            const saved = {};
            (s.fund_check || []).forEach(c => { saved[c.key] = c; });
            document.getElementById('tabFiles').innerHTML = `
                <div class="sip-banner sip-banner-info">
                    <i data-lucide="info" class="icon-sm"></i>
                    <strong>${esc(fc.fundLabel)} ไม่ส่งผ่านชุดข้อมูลมาตรฐาน 15 แฟ้มของ สปสช.</strong>
                    — ยื่นตรงต่อบริษัทประกันด้วยชุดเอกสารตามกรมธรรม์
                </div>
                <div class="section-card">
                    <div class="section-header">
                        <div class="section-title"><i data-lucide="paperclip" class="mi"></i>
                            ชุดเอกสารที่ต้องยื่นต่อบริษัทประกัน</div>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table compact">
                            <thead><tr><th>เอกสาร</th><th style="width:1%">สถานะ</th>
                                <th style="width:1%">ตรวจแล้ว</th></tr></thead>
                            <tbody>${rule.docs.map(d => {
                                const st = saved[d.key] ? saved[d.key].state : 'MISSING';
                                return `<tr>
                                    <td>${esc(d.label)}</td>
                                    <td>${stateChip(st)}</td>
                                    <td style="white-space:nowrap">${stateButtons('fund', d.key, st)}</td>
                                </tr>`; }).join('')}</tbody>
                        </table>
                    </div>
                </div>`;
            return;
        }

        const row = no => {
            const f    = MockNhso.file(no);
            const cond = MockNhso.fileCondition(no);
            const sent = fc.sent.includes(no);
            const need = fc.required.includes(no);
            const stat = !need ? 'NA' : (sent ? 'OK' : 'MISSING');
            return `<tr>
                <td class="td-sub">${esc(no)}</td>
                <td>${esc(f ? f.th : '—')}
                    <div class="td-sub">${esc(f ? f.en : '')}${
                        cond ? ' · เงื่อนไข: ' + esc(cond.label) : ' · บังคับ'}</div></td>
                <td class="td-sub" style="text-align:center">${esc(f ? f.fields : '—')}</td>
                <td>${f ? `<span class="sip-chip ${esc((NHSO_MAPPING_TONE[f.mapping] || {}).chip || 'sip-chip-muted')}">${
                    esc((NHSO_MAPPING_TONE[f.mapping] || {}).label || f.mapping)}</span>` : '—'}</td>
                <td>${stateChip(stat)}</td>
            </tr>`;
        };

        const inScope = fc.inScope.slice().sort((a, b) => a - b);
        const extra   = fc.extra.slice().sort((a, b) => a - b);

        document.getElementById('tabFiles').innerHTML = `
            ${fc.missing.length ? `<div class="sip-banner sip-banner-danger">
                <i data-lucide="x-circle" class="icon-sm"></i>
                <strong>ขาดแฟ้ม ${esc(MockNhso.fileNames(fc.missing))}</strong>
                ที่กองทุน${esc(fc.fundLabel)}บังคับ — ส่งทั้งอย่างนี้จะไม่ผ่านการตรวจสอบเบื้องต้น (RUL-FIL-001)
              </div>` : `<div class="sip-banner sip-banner-success">
                <i data-lucide="check-circle-2" class="icon-sm"></i>
                ส่งแฟ้มครบตามที่กองทุน${esc(fc.fundLabel)}กำหนด (${fc.sent.length}/${fc.required.length})</div>`}

            <div class="cards-row">
                <div class="card"><div class="card-title">แฟ้มในขอบเขตกองทุน</div>
                    <div style="font-size:26px;font-weight:800">${fc.inScope.length}</div></div>
                <div class="card"><div class="card-title">ต้องส่งจริงสำหรับเคสนี้</div>
                    <div style="font-size:26px;font-weight:800">${fc.required.length}</div>
                    <div class="td-sub">หักแฟ้มมีเงื่อนไขที่เคสไม่เข้าข่าย</div></div>
                <div class="card"><div class="card-title">ส่งแล้ว</div>
                    <div style="font-size:26px;font-weight:800">${fc.sent.length}</div></div>
                <div class="card"><div class="card-title">ยังขาด</div>
                    <div style="font-size:26px;font-weight:800;color:${
                        fc.missing.length ? 'var(--status-danger)' : 'var(--status-success)'}">${fc.missing.length}</div></div>
            </div>

            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="folder" class="mi"></i>
                        แฟ้มตามกองทุน ${esc(fc.fundLabel)}</div>
                    <div class="section-actions">
                        <span class="sip-chip sip-chip-muted">${esc(NHSO_DATASET_ANNOUNCE.short)}</span>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="data-table compact">
                        <thead><tr>
                            <th style="width:1%">แฟ้ม</th><th>ชื่อแฟ้ม</th>
                            <th style="width:1%">ฟิลด์</th><th style="width:1%">Mapping</th>
                            <th style="width:1%">สถานะ</th>
                        </tr></thead>
                        <tbody>${inScope.map(row).join('')}</tbody>
                    </table>
                </div>
                ${extra.length ? `<div class="ds-note" style="margin-top:10px">
                    <i data-lucide="info" class="icon-sm"></i>
                    ส่งแฟ้มนอกขอบเขตกองทุนมาด้วย: ${esc(MockNhso.fileNames(extra))}
                    — ไม่ผิด แต่ควรตรวจว่าตั้งค่ากองทุนถูกต้อง</div>` : ''}
            </div>

            ${(s.leave_days > 0) ? `<div class="ds-warn">
                <i data-lucide="alert-triangle" class="icon-sm"></i>
                เคสนี้มีการลากลับบ้าน ${esc(s.leave_days)} วัน — แฟ้ม 15 (NHSO LVD) จึงเป็นแฟ้มบังคับ
                และจำนวนวันนอนในแฟ้ม 14 ต้องหักวันลาออกแล้ว (วันนอนที่เบิกได้ = ${esc(MockIpd.los(s))} วัน)
              </div>` : ''}`;
    },

    /* ══════════ แท็บ 3 — เวชระเบียน ══════════ */

    renderChart(s) {
        const groups = MockIpd.chartByGroup(s);
        const score  = MockIpd.chartScore(s);
        setBadge('chartBadge', score.missing.length);

        document.getElementById('tabChart').innerHTML = `
            <div class="cards-row">
                <div class="card"><div class="card-title">คะแนนเวชระเบียน</div>
                    <div style="font-size:28px;font-weight:800">${score.pct}<span style="font-size:14px">%</span></div>
                    <div class="td-sub">${score.got}/${score.max} คะแนนถ่วงน้ำหนัก</div></div>
                ${groups.map(g => `
                <div class="card"><div class="card-title">${esc(g.label)}</div>
                    <div style="font-size:28px;font-weight:800;color:${
                        g.ok === g.total ? 'var(--status-success)' : 'var(--status-danger)'}">${g.ok}/${g.total}</div></div>`).join('')}
            </div>

            ${groups.map(g => `
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="${esc(g.icon)}" class="mi"></i> ${esc(g.label)}
                        <span class="ds-pane-count">${g.ok}/${g.total} ครบ</span></div>
                </div>
                <div class="table-responsive">
                    <table class="data-table compact">
                        <thead><tr>
                            <th>รายการตรวจ</th><th style="width:1%">น้ำหนัก</th>
                            <th style="width:1%">สถานะ</th><th style="width:1%">บันทึกผล</th>
                            <th style="width:1%">ผู้ตรวจ</th>
                        </tr></thead>
                        <tbody>${g.items.map(it => `<tr style="${
                            it.state === 'MISSING' ? 'background:var(--status-danger-soft)' : ''}">
                            <td>${esc(it.label)}${!it.applicable
                                ? ' <span class="td-sub">(เคสนี้ไม่เข้าเงื่อนไข)</span>' : ''}</td>
                            <td class="td-sub" style="text-align:center">${esc(it.weight)}</td>
                            <td>${stateChip(it.state)}</td>
                            <td style="white-space:nowrap">${it.applicable
                                ? stateButtons('chart', it.key, it.state) : '<span class="td-sub">—</span>'}</td>
                            <td class="td-sub">${esc(it.by || '—')}</td>
                        </tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>`).join('')}`;
    },

    /* ══════════ แท็บ 4 — DRG และการเงิน ══════════ */

    renderDrg(s) {
        const drg  = MockIpd.drgOf(s);
        const arw  = MockIpd.adjRw(s);
        const rate = MockIpd.rate(s.fund, MockIpd.asOf(s));
        const est  = MockIpd.estimate(s);
        const cost = MockIpd.cost(s);
        const varc = MockIpd.variance(s);
        const band = MockIpd.losBand(s);
        const fund = MockIpd.fund(s.fund) || {};

        document.getElementById('tabDrg').innerHTML = `
            ${!drg ? `<div class="sip-banner sip-banner-danger">
                <i data-lucide="alert-circle" class="icon-sm"></i>
                <strong>จัดกลุ่ม DRG ไม่ได้</strong> — ต้องระบุการวินิจฉัยหลักที่จัดกลุ่มได้ก่อนส่งเบิก (RUL-IPD-017)
              </div>` : ''}

            <div class="cards-row">
                <div class="clinical-card">
                    <div class="card-title"><i data-lucide="clipboard-list" class="mi"></i> รหัสที่ใช้จัดกลุ่ม</div>
                    <div class="ds-section-label">การวินิจฉัยหลัก (PDx)</div>
                    ${s.pdx ? `<div style="font-size:12px;padding:2px 0">
                        <span class="sip-chip sip-chip-active">${esc(s.pdx)}</span> ${esc(s.pdx_name || '')}</div>`
                      : '<div class="ds-empty-sm">ยังไม่ระบุ</div>'}
                    <div class="ds-section-label" style="margin-top:8px">การวินิจฉัยร่วม (SDx)</div>
                    ${(s.sdx || []).map(d => `<div style="font-size:12px;padding:2px 0">
                        <span class="sip-chip sip-chip-muted">${esc(d.code)}</span> ${esc(d.name)}</div>`).join('')
                      || '<div class="ds-empty-sm">ไม่มี</div>'}
                    <div class="ds-section-label" style="margin-top:8px">หัตถการ (ICD-9-CM)</div>
                    ${(s.proc || []).map(p => `<div style="font-size:12px;padding:2px 0">
                        <span class="sip-chip sip-chip-muted">${esc(p.code)}</span> ${esc(p.name)}</div>`).join('')
                      || '<div class="ds-empty-sm">ไม่มี</div>'}
                </div>
                <div class="clinical-card">
                    <div class="card-title"><i data-lucide="layers" class="mi"></i> ผลการจัดกลุ่ม</div>
                    ${drg ? kvRows({
                        'เวอร์ชัน Grouper': MockIpd.drgVersion(MockIpd.asOf(s)).label,
                        'ที่มาของค่า RW / จุดตัด': srcLabel(drg),
                        'กลุ่ม DRG': `${drg.drg} — ${drg.label}`,
                        'MDC': `${drg.mdc} · ${(MockIpd.mdc(drg.mdc) || {}).label || ''}`,
                        'RW ตั้งต้น': drg.rw.toFixed(4),
                        'วันนอนเฉลี่ยของกลุ่ม': drg.alos + ' วัน',
                        'จุดตัดล่าง – บน': `${drg.trimLow} – ${drg.trimHigh} วัน`,
                        'วันนอนที่เบิกได้': MockIpd.los(s) + ' วัน'
                            + (s.leave_days ? ` (หักวันลา ${s.leave_days} วันแล้ว)` : ''),
                        'AdjRW': arw.toFixed(4),
                    }) : '<div class="ds-empty">—</div>'}
                    ${drg ? losBar(MockIpd.los(s), drg) : ''}
                </div>
            </div>

            ${band === 'high' ? `<div class="ds-warn">
                <i data-lucide="alert-triangle" class="icon-sm"></i>
                วันนอนเกินจุดตัดบน (high outlier) — ได้ค่าชดเชยเพิ่ม แต่ต้องมีบันทึกเหตุผลทางการแพทย์ประกอบ
                มิฉะนั้นเสี่ยงถูกเรียกคืนตอน Audit (RUL-IPD-018)
              </div>` : band === 'low' ? `<div class="ds-note">
                <i data-lucide="info" class="icon-sm"></i>
                วันนอนต่ำกว่าจุดตัดล่าง (low outlier) — AdjRW ถูกปรับลดตามสัดส่วนวันนอน
              </div>` : ''}

            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="wallet" class="mi"></i> ผลทางการเงิน</div>
                </div>
                <div class="cards-row" style="margin-top:4px">
                    <div class="card"><div class="card-title">ค่าใช้จ่ายจริง</div>
                        <div style="font-size:24px;font-weight:800">${esc(MockFmt.baht(cost))}</div>
                        <div class="td-sub">บาท</div></div>
                    <div class="card"><div class="card-title">อัตราจ่ายต่อ 1 RW</div>
                        <div style="font-size:24px;font-weight:800">${rate == null ? '—' : esc(MockFmt.baht(rate))}</div>
                        <div class="td-sub">${rate == null ? esc(fund.label || '') + ' ไม่จ่ายตาม DRG' : 'บาท/RW'}</div></div>
                    <div class="card"><div class="card-title">ประมาณการรับ</div>
                        <div style="font-size:24px;font-weight:800">${est == null ? '—' : esc(MockFmt.baht(est))}</div>
                        <div class="td-sub">${est == null ? 'จ่ายตามกรมธรรม์' : 'AdjRW × อัตราต่อ RW'}</div></div>
                    <div class="card"><div class="card-title">ส่วนต่าง</div>
                        <div style="font-size:24px;font-weight:800;color:${
                            varc == null ? 'var(--text-muted)' : varc > 0 ? 'var(--status-danger)' : 'var(--status-success)'}">
                            ${varc == null ? '—' : (varc > 0 ? '+' : '') + esc(MockFmt.baht(varc))}</div>
                        <div class="td-sub">${varc == null ? '—'
                            : varc > 0 ? 'โรงพยาบาลรับภาระ' : 'อยู่ในกรอบ'}</div></div>
                </div>
                <div class="table-responsive" style="margin-top:10px">
                    <table class="data-table compact">
                        <thead><tr><th style="width:1%">หมวด</th><th>รายการ</th>
                            <th style="width:1%;text-align:right">จำนวนเงิน</th></tr></thead>
                        <tbody>${(s.charges || []).map(c => `<tr>
                            <td class="td-sub">${esc(c.billgrcs)}</td><td>${esc(c.name)}</td>
                            <td style="text-align:right;white-space:nowrap">${esc(MockFmt.baht(c.amount))}</td>
                        </tr>`).join('') || '<tr><td colspan="3" class="ds-empty">ไม่มีรายการ</td></tr>'}</tbody>
                    </table>
                </div>
            </div>

            ${unverifiedNote()}`;
    },

    /* ══════════ แท็บ 5 — ผลกฎ ══════════ */

    renderRules(s) {
        const rules = MockIpd.rulesFor(s);
        const hits  = rules.filter(r => r.hit);
        setBadge('ruleBadge', hits.length);

        document.getElementById('tabRules').innerHTML = `
            ${hits.length ? `<div class="sip-banner sip-banner-danger">
                <i data-lucide="x-circle" class="icon-sm"></i>
                ติด ${hits.length} กฎจากทั้งหมด ${rules.length} กฎที่ใช้กับกองทุน
                ${esc((MockIpd.fund(s.fund) || {}).short || s.fund)} และบริการผู้ป่วยใน
              </div>` : `<div class="sip-banner sip-banner-success">
                <i data-lucide="check-circle-2" class="icon-sm"></i>
                ผ่านกฎทั้งหมด ${rules.length} ข้อที่ใช้กับเคสนี้</div>`}

            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="git-branch" class="mi"></i>
                        ผลการตรวจด้วยกฎ <span class="ds-pane-count">${rules.length} ข้อ</span></div>
                </div>
                <div class="table-responsive">
                    <table class="data-table compact">
                        <thead><tr>
                            <th style="width:1%">รหัสกฎ</th><th style="width:1%">Ver</th>
                            <th>ชื่อกฎ</th><th style="width:1%">ระดับ</th><th style="width:1%">ผล</th>
                            <th style="width:1%">จะได้รหัสอะไรที่ NHSO</th>
                            <th style="width:1%">เอกสารอ้างอิง</th>
                        </tr></thead>
                        <tbody>${rules.map(r => `
                        <tr style="${r.hit ? 'background:var(--status-danger-soft)' : ''}">
                            <td class="td-sub" style="white-space:nowrap">${esc(r.id)}</td>
                            <td class="td-sub">v${esc(r.version)}</td>
                            <td>${esc(r.name)}
                                ${r.hit && r.evidence ? `<div style="margin-top:5px">${
                                    Object.entries(r.evidence).map(([k, v]) =>
                                        `<span class="sip-chip sip-chip-muted" style="margin-right:4px">${
                                            esc(k)}: ${esc(v)}</span>`).join('')}</div>` : ''}
                                <div class="td-sub" style="margin-top:3px">${esc(r.desc)}</div></td>
                            <td><span class="sip-chip ${esc(MockTone.severityChip[r.severity] || 'sip-chip-muted')}">${
                                esc(MockTone.severityLabel[r.severity] || r.severity)}</span></td>
                            <td>${r.hit ? MockTone.resultBadgeHtml(r.action)
                                : '<span class="status-badge completed">ผ่าน</span>'}</td>
                            <td style="white-space:nowrap">${r.maps_to_nhso
                                ? `<span class="sip-chip sip-chip-danger" title="${esc(NHSO_ERR_TEXT[r.maps_to_nhso] || '')}">${
                                    esc(r.maps_to_nhso)}<sup title="${esc(NHSO_UNVERIFIED_NOTE)}">*</sup></span>`
                                : '<span class="td-sub">—</span>'}</td>
                            <td class="td-sub" style="white-space:nowrap">${r.doc_id
                                ? `<a href="claim-knowledge.html?doc=${encodeURIComponent(r.doc_id)}">${
                                    esc(r.doc_ref || r.doc_id)}</a>` : '—'}</td>
                        </tr>`).join('') || '<tr><td colspan="7" class="ds-empty">ไม่มีกฎที่ใช้กับเคสนี้</td></tr>'}</tbody>
                    </table>
                </div>
                <div class="ds-note" style="margin-top:10px">
                    <i data-lucide="lightbulb" class="icon-sm"></i>
                    กฎที่แสดงคือกฎสถานะ "เปิดใช้" ที่ครอบคลุมกองทุนนี้ ประเภทบริการผู้ป่วยใน
                    และมีผลบังคับ ณ วันจำหน่าย (BR-01)
                </div>
            </div>`;
    },

    /* ══════════ แท็บ 6 — สรุป / Timeline ══════════ */

    renderSummary(s) {
        const a = MockIpd.assess(s);

        document.getElementById('tabSummary').innerHTML = `
            <div class="cards-row">
                <div class="card"><div class="card-title">คะแนนรวม</div>
                    <div style="font-size:30px;font-weight:800">${esc(a.score)}<span style="font-size:14px">/100</span></div></div>
                <div class="card"><div class="card-title">เวชระเบียน (60%)</div>
                    <div style="font-size:30px;font-weight:800">${esc(a.chart.pct)}%</div></div>
                <div class="card"><div class="card-title">ความครบของแฟ้ม (20%)</div>
                    <div style="font-size:30px;font-weight:800">${esc(a.filePct)}%</div></div>
                <div class="card"><div class="card-title">เงื่อนไขกองทุน (20%)</div>
                    <div style="font-size:30px;font-weight:800">${esc(a.fundPct)}%</div></div>
                <div class="card"><div class="card-title">ผลที่ระบบเสนอ</div>
                    <div style="margin-top:8px">${MockTone.resultBadgeHtml(a.result)}</div></div>
            </div>

            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="list" class="mi"></i>
                        ประเด็นที่พบ <span class="ds-pane-count">${a.reasons.length} รายการ</span></div>
                </div>
                ${a.reasons.length
                    ? `<ul style="margin:6px 0 2px;padding-left:20px;font-size:12px;line-height:2">
                        ${a.reasons.map(r => `<li style="color:${
                            r.tone === 'danger' ? 'var(--status-danger)' : 'var(--status-warning)'}">${esc(r.text)}</li>`).join('')}
                       </ul>`
                    : '<div class="sip-banner sip-banner-success"><i data-lucide="check-circle-2" class="icon-sm"></i> ไม่พบประเด็นค้าง</div>'}
            </div>

            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="history" class="mi"></i> ประวัติของ AN นี้</div>
                </div>
                <div style="padding:6px 2px">
                    ${(s.timeline || []).map(t => `
                        <div class="ds-timeline-item ${esc(t.tone || 'info')}">
                            <strong>${esc(t.title)}</strong>
                            <div class="td-sub">${esc(MockFmt.dateTimeTH(t.at))} · ${esc(t.by)}${
                                t.note ? ' · ' + esc(t.note) : ''}</div>
                        </div>`).join('') || '<div class="ds-empty">ยังไม่มีเหตุการณ์</div>'}
                </div>
            </div>

            ${s.claim_id ? `<div class="ds-note">
                <i data-lucide="link" class="icon-sm"></i>
                แฟ้มนี้ผ่านการตรวจแล้วและผูกกับเคลม
                <a href="claim-case.html?id=${encodeURIComponent(s.claim_id)}">${esc(s.claim_id)}</a>
              </div>` : ''}`;
    },

    /* ══════════ แผงขวา — ผลการประเมิน ══════════ */

    renderActions(s) {
        const a  = MockIpd.assess(s);
        const st = MockIpd.auditOf(s.audit_status);

        document.getElementById('actionPane').innerHTML = `
            <div class="ds-section-label">สถานะปัจจุบัน</div>
            <div class="card" style="margin-bottom:12px">
                <span class="status-badge ${esc(st.badge)}">${esc(st.label)}</span>
                <div class="card-footer">${s.auditor
                    ? 'ผู้ตรวจ: ' + esc(MockAdmin.userName(s.auditor)) : 'ยังไม่มีผู้รับตรวจ'}</div>
            </div>

            <div class="ds-section-label">คะแนนที่ระบบคำนวณ</div>
            <div class="card" style="margin-bottom:12px">
                <div style="display:flex;align-items:baseline;gap:8px">
                    <span style="font-size:30px;font-weight:800">${esc(a.score)}</span>
                    <span class="td-sub">/100</span>
                    <span style="margin-left:auto">${MockTone.resultBadgeHtml(a.result)}</span>
                </div>
                <div class="card-footer">เวชระเบียน ${esc(a.chart.pct)}% ·
                    แฟ้ม ${esc(a.filePct)}% · เงื่อนไขกองทุน ${esc(a.fundPct)}%</div>
            </div>

            <div class="sip-field">
                <label class="sip-label">ผลที่ผู้ตรวจยืนยัน</label>
                <select class="sip-select" id="aResult">
                    ${MockTone.RESULTS.map(r => `<option value="${esc(r)}" ${
                        (s.audit_result || a.result) === r ? 'selected' : ''}>${
                        esc(MockTone.resultLabel[r])}</option>`).join('')}
                </select>
            </div>
            <div class="sip-field">
                <label class="sip-label">ความเห็นผู้ตรวจ</label>
                <textarea class="sip-textarea" id="aNote" rows="4"
                          placeholder="ระบุสิ่งที่ต้องแก้ หรือเหตุผลที่ให้ผ่าน">${esc(s.audit_note || '')}</textarea>
            </div>

            ${a.reasons.length ? `
            <div class="ds-section-label">ประเด็นที่ยังค้าง (${a.reasons.length})</div>
            <ul style="margin:0 0 12px;padding-left:18px;font-size:12px;line-height:1.85">
                ${a.reasons.slice(0, 8).map(r => `<li style="color:${
                    r.tone === 'danger' ? 'var(--status-danger)' : 'var(--status-warning)'}">${esc(r.text)}</li>`).join('')}
                ${a.reasons.length > 8 ? `<li class="td-sub">และอีก ${a.reasons.length - 8} รายการ</li>` : ''}
            </ul>` : ''}

            <button class="btn btn-primary btn-block" style="margin-bottom:8px"
                    onclick="IpdAudit.engineCheck()" ${s.fund === 'PVT' ? 'disabled title="เคสประกันเอกชนไม่ผ่านชุดกฎ NHSO"' : ''}>
                <i data-lucide="shield-check" class="icon-sm"></i> ตรวจกับ rule engine จริง
            </button>
            ${s.fund === 'PVT' ? '<div class="td-sub" style="margin-bottom:8px">เคส PVT ไม่ส่ง NHSO — ชุดกฎแฟ้ม/กองทุนใช้กับเคสนี้ไม่ได้</div>' : ''}

            <button class="btn btn-outline btn-block" onclick="IpdAudit.openPrint()">
                <i data-lucide="printer" class="icon-sm"></i> พิมพ์ใบตรวจสอบแฟ้มผู้ป่วยใน
            </button>`;
        refreshIcons();
    },

    /* ── ตรวจเคสนี้กับ rule engine จริง (claim-validator + claim-suggester ฝั่งเซิร์ฟเวอร์) ──
       เคสที่อยู่ใน DB และล็อกอิน: เซิร์ฟเวอร์ประกอบ payload จากข้อมูลจริง
       เคส mock: สะพาน mock-ipddata.js ประกอบ payload แล้วยิง endpoint สาธารณะ */

    async engineCheck() {
        const s = this.current(); if (!s) { showToast('ยังไม่ได้เลือกเคส', 'warning'); return; }
        if (!window.MockIpdData) { showToast('ไม่พบสะพานข้อมูล (mock-ipddata.js)', 'danger'); return; }

        showToast('กำลังตรวจกับ rule engine…', 'info');
        let r;
        try {
            r = await MockIpdData.validate(s);
        } catch (err) {
            showToast('เรียก rule engine ไม่ได้ — ต้องรันกับเซิร์ฟเวอร์ (npm run dev)', 'danger');
            return;
        }

        const tone = { ERROR: 'rejected', WARNING: 'waiting', INFO: 'active' };
        const pass = r.summary.result === 'PASS';
        const issueRows = r.issues.map(i => `
            <tr>
                <td><span class="status-badge ${tone[i.severity] || 'active'}">${esc(i.severity)}</span></td>
                <td>${i.code ? `<code>${esc(i.code)}</code>` : `<span class="td-sub">${esc(i.rule || '—')}</span>`}</td>
                <td class="l">${esc(i.message)}${i.detail && i.detail !== i.message
                    ? `<div class="td-sub">${esc(i.detail)}</div>` : ''}
                    ${i.guidance ? `<div style="font-size:12px;color:var(--status-success);margin-top:2px">→ ${esc(i.guidance)}</div>` : ''}</td>
                <td class="l td-sub">${esc(i.layer)}</td>
            </tr>`).join('');

        const sugs = (r.suggestions || []).map(g => `
            <div style="display:flex;gap:8px;align-items:flex-start;padding:8px 2px;border-top:1px solid var(--border-color)">
                <i data-lucide="${g.kind === 'DRG_REVIEW' ? 'trending-up' : 'list-checks'}" class="icon-sm" style="margin-top:2px;flex:none"></i>
                <div style="font-size:13px">
                    <code style="font-size:11px">${esc(g.id)}</code>
                    ${g.simulated ? '<span class="sip-chip sip-chip-amber" style="font-size:10px">ค่าจำลอง</span>' : ''}
                    ${esc(g.message)}
                    ${g.evidence && g.evidence.rw_delta != null
                        ? `<div class="td-sub">RW ${Number(g.evidence.current_rw).toFixed(4)}
                           → ${Number(g.evidence.best_rw).toFixed(4)} (+${Number(g.evidence.rw_delta).toFixed(4)})</div>` : ''}
                </div>
            </div>`).join('');

        Drawer.open({
            title: `ผลตรวจ rule engine — AN ${s.an}`,
            width: '640px',
            contentHtml: `
                <div class="${pass ? 'ds-note' : 'ds-warn'}" style="margin-bottom:12px">
                    <i data-lucide="${pass ? 'check-circle-2' : 'alert-octagon'}" class="icon-sm"></i>
                    <strong>${pass ? 'ผ่านทุกกฎที่ตรวจ' : 'พบประเด็นก่อนส่ง'}</strong>
                    — Error ${r.summary.errors} · Warning ${r.summary.warnings} · Info ${r.summary.info}
                    ${r.summary.suggestions ? ` · ข้อเสนอแนะ ${r.summary.suggestions}` : ''}<br>
                    <span class="td-sub">ชั้นที่ตรวจ: ${r.summary.layers_checked.map(esc).join(', ')}
                    · ข้อความ error จากแคตตาล็อกรหัสติด C จริง</span>
                </div>
                ${r.issues.length ? `
                <div class="table-responsive"><table class="data-table compact">
                    <thead><tr><th>ระดับ</th><th>รหัส</th><th class="l">รายละเอียด</th><th class="l">ชั้น</th></tr></thead>
                    <tbody>${issueRows}</tbody>
                </table></div>` : ''}
                ${sugs ? `
                <div style="margin-top:14px;border-left:3px solid var(--status-warning);padding-left:10px">
                    <div style="font-size:13px;font-weight:700;margin-bottom:2px">
                        <i data-lucide="lightbulb" class="icon-sm"></i> ข้อเสนอแนะให้ลงรหัสสมบูรณ์</div>
                    <div class="td-sub" style="margin-bottom:4px">ชวนทบทวนเท่านั้น ไม่มีผลต่อ PASS/FAIL
                        — ข้อเสนอที่เพิ่ม RW ต้องมีเอกสารรองรับในเวชระเบียนก่อนปรับรหัส</div>
                    ${sugs}
                </div>` : ''}`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>`,
        });
        refreshIcons();
    },

    /* ── บันทึกผลรายข้อ (เรียกจากปุ่มในตาราง) ── */

    setState(scope, key, state) {
        const s = this.current(); if (!s) return;
        const who = MockAdmin.userName(MockSession.userId());

        if (scope === 'chart') {
            const list = (s.chart_audit || []).map(c => c.key === key
                ? { ...c, state, by: state === 'OK' ? who : null, at: '2569-08-06T09:00' } : c);
            if (!list.some(c => c.key === key)) list.push({ key, state, by: who, at: '2569-08-06T09:00', note: '' });
            MockDB.patch('ipd_stays', s.id, { chart_audit: list });
        } else {
            const list = (s.fund_check || []).map(c => c.key === key ? { ...c, state } : c);
            if (!list.some(c => c.key === key)) list.push({ key, state, note: '' });
            MockDB.patch('ipd_stays', s.id, { fund_check: list });
        }

        /* ผู้ตรวจแตะแฟ้มแล้ว = เข้าสถานะกำลังตรวจ */
        if (s.audit_status === 'PENDING') {
            MockDB.patch('ipd_stays', s.id, { audit_status: 'IN_REVIEW', auditor: MockSession.userId() });
            this.renderPills();
        }
        this.select(s.id);
    },

    /* ── การตัดสิน ── */

    saveDraft() {
        const s = this.current(); if (!s) { showToast('ยังไม่ได้เลือกแฟ้ม', 'warning'); return; }
        MockDB.patch('ipd_stays', s.id, {
            audit_status: s.audit_status === 'CLEARED' ? 'CLEARED' : 'IN_REVIEW',
            auditor: MockSession.userId(),
            audit_result: document.getElementById('aResult').value,
            audit_note: document.getElementById('aNote').value.trim(),
        });
        showToast('บันทึกร่างผลการตรวจแล้ว');
        this.renderPills();
        this.select(s.id);
    },

    async returnCase() {
        const s = this.current(); if (!s) { showToast('ยังไม่ได้เลือกแฟ้ม', 'warning'); return; }
        const a    = MockIpd.assess(s);
        const note = document.getElementById('aNote').value.trim();
        if (!note) { showToast('กรุณาระบุความเห็นผู้ตรวจก่อนตีกลับ', 'warning'); return; }

        const ok = await Drawer.confirm({
            title: `ตีกลับแฟ้ม AN ${s.an} ให้แก้ไข?`,
            message: 'ระบบจะสร้างงานให้หน่วยที่รับผิดชอบ และแฟ้มจะออกจากคิวรอตรวจ',
            lines: a.reasons.slice(0, 6).map(r => r.text),
            confirmText: 'ตีกลับให้แก้',
            danger: true,
        });
        if (!ok) return;

        const t = MockTasks.create({
            kind: 'FIX_CASE',
            title: `แก้ไขแฟ้มผู้ป่วยใน AN ${s.an} — ${s.patient}`,
            owner: MockSession.userId(),
            due_at: '2569-08-13T16:00',
            priority: a.result === 'BLOCK' ? 'HIGH' : 'NORMAL',
            detail: note,
            checklist: a.reasons.map(r => ({ text: r.text, done: false })),
        });

        MockDB.patch('ipd_stays', s.id, {
            audit_status: 'RETURNED',
            audit_result: document.getElementById('aResult').value,
            audit_score: a.score,
            auditor: MockSession.userId(),
            audit_note: note,
            timeline: [...(s.timeline || []), {
                at: '2569-08-06T09:00', tone: 'danger', title: 'ตีกลับให้แก้ไข',
                by: MockAdmin.userName(MockSession.userId()),
                note: `${t.id} · ${a.reasons.length} ประเด็น`,
            }],
        });

        showToast(`ตีกลับแล้ว — สร้างงาน ${t.id} ติดตามการแก้ไข`);
        this.renderPills();
        this.select(s.id);
    },

    async clearCase() {
        const s = this.current(); if (!s) { showToast('ยังไม่ได้เลือกแฟ้ม', 'warning'); return; }
        const a = MockIpd.assess(s);

        if (a.result === 'BLOCK') {
            Drawer.open({
                title: 'ยังส่งเข้าคิวส่งเบิกไม่ได้',
                contentHtml: `
                    <div class="sip-banner sip-banner-danger">
                        <i data-lucide="x-circle" class="icon-sm"></i>
                        แฟ้มนี้ติดเงื่อนไขระดับ "ระงับส่ง" — ถ้าส่งไปตอนนี้จะถูกตีกลับแน่นอน
                    </div>
                    <ul style="margin:12px 0 0;padding-left:20px;font-size:12px;line-height:2">
                        ${a.reasons.filter(r => r.tone === 'danger').map(r => `<li>${esc(r.text)}</li>`).join('')}
                    </ul>
                    <div class="ds-note" style="margin-top:12px">
                        <i data-lucide="shield-check" class="icon-sm"></i>
                        นี่คือด่านที่ระบบทำแทนการปล่อยให้ สปสช. หรือบริษัทประกันตีกลับ
                        — แก้ให้จบก่อนแล้วค่อยส่งรอบเดียว
                    </div>`,
                footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>
                             <button class="btn btn-danger" onclick="Drawer.close(); IpdAudit.returnCase()">ตีกลับให้แก้</button>`,
                onOpen: () => refreshIcons(),
            });
            return;
        }

        const ok = await Drawer.confirm({
            title: `ให้แฟ้ม AN ${s.an} ผ่านและส่งเข้าคิวส่งเบิก?`,
            message: 'แฟ้มจะย้ายไปกล่อง "ผ่านแล้ว" และพร้อมสร้างรายการส่งเบิก',
            lines: [
                `${s.patient} · HN ${s.hn}`,
                `กองทุน ${(MockIpd.fund(s.fund) || {}).label || s.fund}`,
                `คะแนน ${a.score}/100 · ผล ${MockTone.resultLabel[a.result]}`,
                `ค่าใช้จ่าย ${MockFmt.baht(MockIpd.cost(s))} บาท`,
            ],
            confirmText: 'ผ่าน — ส่งเข้าคิวส่งเบิก',
            danger: false,
        });
        if (!ok) return;

        MockDB.patch('ipd_stays', s.id, {
            audit_status: 'CLEARED',
            audit_result: document.getElementById('aResult').value,
            audit_score: a.score,
            auditor: MockSession.userId(),
            audit_note: document.getElementById('aNote').value.trim(),
            timeline: [...(s.timeline || []), {
                at: '2569-08-06T09:00', tone: 'success', title: 'ตรวจแฟ้มผ่าน — ส่งเข้าคิวส่งเบิก',
                by: MockAdmin.userName(MockSession.userId()),
                note: `คะแนน ${a.score}/100`,
            }],
        });

        showToast(`AN ${s.an} ผ่านการตรวจแฟ้มแล้ว — ส่งเข้าคิวส่งเบิก`);
        this.renderPills();
        this.select(s.id);
    },

    /* ══════════ ใบพิมพ์ — ใบตรวจสอบแฟ้มผู้ป่วยใน ══════════ */

    buildDoc() {
        const s = this.current();
        const C = DocParts.CELL;
        const warnings = [];

        const a    = MockIpd.assess(s);
        const fund = MockIpd.fund(s.fund) || {};
        const drg  = MockIpd.drgOf(s);
        const fc   = MockIpd.fileCheck(s);

        const th = (t, w) => `<th style="${C}font-size:11px;font-weight:700;text-align:center;`
                           + `${w ? 'width:' + w + ';' : ''}">${DocParts.esc(t)}</th>`;

        const mark = st => st === 'OK' ? '✓ ครบ' : st === 'NA' ? 'ไม่เกี่ยวข้อง' : '';

        /* เงื่อนไขกองทุน */
        const fundRows = MockIpd.fundCheckItems(s).map((r, i) => `<tr>
            <td style="${C}text-align:center;">${i + 1}</td>
            <td style="${C}">${DocParts.esc(r.label)}</td>
            <td style="${C}text-align:center;" class="${
                DocPrint.miss(r.state === 'MISSING' ? '' : mark(r.state), 'เงื่อนไขกองทุน: ' + r.label, warnings)}">
                ${DocParts.esc(mark(r.state))}</td>
        </tr>`).join('');

        /* เวชระเบียน */
        const chartRows = MockIpd.chartSections(s).map((r, i) => `<tr>
            <td style="${C}text-align:center;">${i + 1}</td>
            <td style="${C}">${DocParts.esc(r.label)}</td>
            <td style="${C}text-align:center;">${DocParts.esc(r.weight)}</td>
            <td style="${C}text-align:center;" class="${
                DocPrint.miss(r.state === 'MISSING' ? '' : mark(r.state), 'เวชระเบียน: ' + r.label, warnings)}">
                ${DocParts.esc(mark(r.state))}</td>
        </tr>`).join('');

        const fields = [
            ['AN', s.an],
            ['HN / ชื่อ-สกุล', `${s.hn} · ${s.patient}`],
            ['กองทุน', fund.label || s.fund],
            ['รับไว้ – จำหน่าย', `${MockFmt.dateTH(s.admit_at)} – ${MockFmt.dateTH(s.discharge_at)}`],
            ['วันนอนที่เบิกได้', `${MockIpd.los(s)} วัน` + (s.leave_days ? ` (ลากลับบ้าน ${s.leave_days} วัน)` : '')],
            ['กลุ่ม DRG / AdjRW', drg ? `${drg.drg} · ${MockIpd.adjRw(s).toFixed(4)}` : 'จัดกลุ่มไม่ได้'],
            ['ผู้ตรวจ', MockAdmin.userName(MockSession.userId())],
        ];

        const html = `<div style="color:#000;font-size:12px;">
            ${DocParts.docHead({ title: 'ใบตรวจสอบแฟ้มผู้ป่วยใน', formCode: 'IPD-AUD/2569', fields })}

            <div style="font-size:11px;margin:0 0 8px">
                <strong>ผลการประเมิน:</strong> ${DocParts.esc(MockTone.resultLabel[a.result])} ·
                คะแนนรวม ${a.score}/100 (เวชระเบียน ${a.chart.pct}% · แฟ้ม ${a.filePct}% · เงื่อนไขกองทุน ${a.fundPct}%)
                ${fc.nhso ? ` · แฟ้มที่ส่ง ${fc.sent.length}/${fc.required.length}` : ' · ไม่ผ่านชุดข้อมูล สปสช.'}
            </div>

            <div style="font-size:11px;font-weight:700;margin:8px 0 4px">
                ส่วนที่ 1 — เงื่อนไขของกองทุน ${DocParts.esc(fund.label || s.fund)}
            </div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>${th('ข้อ', '34px')}${th('รายการที่กองทุนกำหนด')}${th('ผลการตรวจ', '96px')}</tr></thead>
                <tbody>${DocParts.fillRows(fundRows, 8, 3)}</tbody>
            </table>

            <div style="font-size:11px;font-weight:700;margin:12px 0 4px">
                ส่วนที่ 2 — ความครบถ้วนของเวชระเบียน
            </div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>${th('ข้อ', '34px')}${th('รายการตรวจ')}${th('น้ำหนัก', '52px')}${th('ผลการตรวจ', '96px')}</tr></thead>
                <tbody>${DocParts.fillRows(chartRows, 10, 4)}</tbody>
            </table>

            ${a.reasons.length ? `
            <div style="font-size:11px;font-weight:700;margin:12px 0 4px">ส่วนที่ 3 — ประเด็นที่พบ</div>
            <ol style="font-size:11px;margin:0 0 8px;padding-left:20px;line-height:1.7">
                ${a.reasons.map(r => `<li>${DocParts.esc(r.text)}</li>`).join('')}
            </ol>` : ''}

            <div style="font-size:11px;margin:10px 0 4px">
                <strong>ความเห็นผู้ตรวจ:</strong>
            </div>
            <div style="${C}min-height:46px;font-size:11px">${DocParts.esc(s.audit_note || '')}</div>

            <div style="font-size:10px;margin:10px 0 0">
                หมายเหตุ: กลุ่ม DRG, AdjRW และเงื่อนไขกองทุนในใบนี้อ้างอิงข้อมูลจำลอง
                ยังไม่ได้ตรวจสอบกับคู่มือ Thai DRG และประกาศของกองทุนฉบับจริง
            </div>

            ${DocParts.signatureBlock(['ลงชื่อ ผู้ตรวจสอบแฟ้ม', 'ลงชื่อ หัวหน้างานเวชระเบียน'])}
            ${DocParts.footer(fields)}
        </div>`;

        return { html: DocParts.toPrintBorders(html), warnings };
    },

    openPrint() {
        if (!this.current()) { showToast('ยังไม่ได้เลือกแฟ้ม', 'warning'); return; }
        const { html, warnings } = this.buildDoc();
        DocPrint.preview({ title: 'ตัวอย่างก่อนพิมพ์ — ใบตรวจสอบแฟ้มผู้ป่วยใน', html, warnings });
    },
};


/* ── helper ระดับหน้า ─────────────────────────────────── */

function setBadge(id, n) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = n ? '' : 'none';
    el.textContent = n;
}

/** ป้ายสถานะรายข้อ — อ่านจาก IPD_CHECK_STATE ที่เดียว ห้าม inline คลาสเอง */
function stateChip(state) {
    const c = IPD_CHECK_STATE[state] || IPD_CHECK_STATE.MISSING;
    return `<span class="sip-chip ${esc(c.chip)}">${esc(c.label)}</span>`;
}

/** ปุ่ม 3 สถานะสำหรับผู้ตรวจกดบันทึกผลรายข้อ */
function stateButtons(scope, key, state) {
    return Object.keys(IPD_CHECK_STATE).map(k => `
        <button class="ds-icon-btn ${k === state ? 'edit' : 'neutral'}"
                title="${esc(IPD_CHECK_STATE[k].label)}"
                onclick="IpdAudit.setState('${esc(scope)}', '${esc(key)}', '${esc(k)}')">
            <i data-lucide="${esc(IPD_CHECK_STATE[k].icon)}" class="icon-sm"></i></button>`).join('');
}

/** แถวคู่ key–value แบบเดียวกับ claim-case.js */
function kvRows(o) {
    return Object.entries(o).map(([k, v]) =>
        `<div style="display:flex;justify-content:space-between;gap:12px;padding:4px 0;
             border-bottom:1px dashed var(--brand-border);font-size:12px">
            <span style="color:var(--text-muted)">${esc(k)}</span>
            <strong style="text-align:right">${esc(v)}</strong></div>`).join('');
}

/** แถบแสดงวันนอนเทียบจุดตัดล่าง–บนของกลุ่ม DRG */
function losBar(los, drg) {
    const span = Math.max(drg.trimHigh * 1.3, los * 1.1);
    const pct  = v => Math.min(100, (v / span) * 100);
    const band = los < drg.trimLow ? 'warning' : los > drg.trimHigh ? 'danger' : 'success';
    return `
        <div style="margin:10px 0 4px">
            <div style="position:relative;height:10px;border-radius:5px;background:var(--surface-1)">
                <div style="position:absolute;left:${pct(drg.trimLow)}%;width:${pct(drg.trimHigh) - pct(drg.trimLow)}%;
                            top:0;bottom:0;background:var(--status-success-soft);border-radius:5px"></div>
                <div style="position:absolute;left:${pct(los)}%;top:-4px;width:3px;height:18px;
                            background:var(--status-${band});border-radius:2px"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:5px">
                <span>0</span>
                <span>จุดตัด ${esc(drg.trimLow)} – ${esc(drg.trimHigh)} วัน</span>
                <span>นอนจริง ${esc(los)} วัน</span>
            </div>
        </div>`;
}

/** ที่มาของค่าอ้างอิงหนึ่งแถว — บอกตรง ๆ ว่าอ้างเอกสารฉบับไหน และมีเอกสารแล้วหรือยัง */
function srcLabel(row) {
    const s = MockIpd.sourceOf(row);
    if (!s) return 'ยังไม่ระบุที่มา';
    return (s.id ? `[${s.id}] ` : '') + s.title + (s.ok ? '' : ' — ยังไม่มีเอกสารในระบบ');
}

/** ป้าย "รอยืนยัน" — ต้องขึ้นทุกจุดที่แสดงค่าที่ยังไม่ได้ยืนยันกับเอกสารจริง */
function unverifiedNote(extra) {
    return `<div class="ds-warn" style="margin-top:10px">
        <i data-lucide="alert-triangle" class="icon-sm"></i>
        <strong>รอยืนยัน</strong> — ${esc(extra || IPD_UNVERIFIED_NOTE)}
        · <a href="ipd-reference.html">ดูทะเบียนเอกสารอ้างอิงและนำเข้าค่าจริง</a>
    </div>`;
}

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.IpdAudit = IpdAudit;
document.addEventListener('DOMContentLoaded', () => IpdAudit.init());
