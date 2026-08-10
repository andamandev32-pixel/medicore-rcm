/* ────────────────────────────────────────────────────────
   ติดตามการรักษาระหว่าง admit (IPD Concurrent Tracking)

   หน้านี้ทำงานกับ "เวลาที่โรงพยาบาลยังคุมได้เอง" — ระหว่างที่ผู้ป่วยยังนอนอยู่
   ทุกอย่างที่ขาดตอนนี้ยังตามเก็บได้ พอจำหน่ายแล้วต้นทุนการตามเก็บสูงขึ้นทันที

   แพทเทิร์นเดียวกับ claim-case.js: global object · 3 คอลัมน์ · แท็บ
   ทุกตัวเลข derive จาก MockIpd ห้าม hardcode
   ──────────────────────────────────────────────────────── */

const IpdAdmit = {

    TABS: ['overview', 'daily', 'coding', 'cost', 'gaps'],

    /* ตัวกรองคิวซ้าย — fn รับ stay คืน true/false */
    FILTERS: [
        { key: 'all',   label: 'ทั้งหมด',      fn: s => true },
        { key: 'los',   label: 'เกินวันนอน',    fn: s => MockIpd.losBand(s) === 'high' },
        { key: 'docs',  label: 'เอกสารขาด',     fn: s => MockIpd.chartScore(s).missing.length > 0 },
        { key: 'files', label: 'แฟ้มไม่ครบ',    fn: s => { const f = MockIpd.fileCheck(s); return f.nhso && !f.ok; } },
        { key: 'over',  label: 'เกินประมาณการ', fn: s => { const v = MockIpd.variance(s); return v != null && v > 0; } },
    ],

    state: { id: null, filter: 'all', tab: 'overview' },

    init() {
        const p = new URLSearchParams(location.search);
        if (p.get('filter')) this.state.filter = p.get('filter');

        this.fillFilters();
        this.renderPills();
        this.renderList();

        const an  = p.get('an');
        const hit = an ? MockIpd.byAn(an) : null;
        const first = this.visible()[0];
        this.select(hit ? hit.id : (first ? first.id : null));
    },

    reload() { this.select(this.state.id); showToast('ยกเลิกการแก้ไขแล้ว', 'info'); },

    current() { return this.state.id ? MockIpd.byId(this.state.id) : null; },

    /** เฉพาะผู้ป่วยที่ยังนอนอยู่ — หน้านี้ไม่แสดงเคสที่จำหน่ายแล้ว */
    pool() { return MockIpd.admitted(); },

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
                    onclick="IpdAdmit.setFilter('${f.key}')">
                ${esc(f.label)} <span class="tab-count">${rows.filter(f.fn).length}</span></button>`).join('');
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
        const f    = this.FILTERS.find(x => x.key === this.state.filter) || this.FILTERS[0];

        return this.pool().filter(s => {
            if (!f.fn(s)) return false;
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
                const band = MockIpd.losBand(s);
                return `
                <div class="ds-list-card ${s.id === this.state.id ? 'active' : ''}"
                     onclick="IpdAdmit.select('${esc(s.id)}')">
                    <div class="ds-list-card-top">
                        <span class="td-sub">AN ${esc(s.an)}</span>
                        <span class="status-badge ${esc(MockIpd.statusOf(s.status).badge)}">${
                            esc(MockIpd.statusOf(s.status).label)}</span>
                    </div>
                    <div class="ds-list-card-name">${esc(s.patient)}</div>
                    <div class="ds-list-card-detail">
                        HN ${esc(s.hn)} · ${esc(s.ward)}/${esc(s.bed)} · ${esc(s.fund)} ·
                        <span style="${band === 'high' ? 'color:var(--status-danger);font-weight:700' : ''}"
                        >นอน ${esc(MockIpd.los(s))} วัน</span>
                    </div>
                </div>`; }).join('')
            : '<div class="ds-empty">ไม่พบผู้ป่วยตามเงื่อนไข</div>';
        refreshIcons();
    },

    toggleLeft() { document.getElementById('shell').classList.toggle('left-collapsed'); },

    /* ══════════ เลือกเคส ══════════ */

    select(id) {
        this.state.id = id;
        const s = this.current();

        document.getElementById('emptyState').style.display = s ? 'none' : '';
        document.getElementById('detailWrap').style.display = s ? '' : 'none';
        if (!s) { this.renderList(); return; }

        history.replaceState(null, '', 'ipd-admit.html?an=' + encodeURIComponent(s.an));

        MockSession.mountBanner('demoBanner');
        this.renderContext(s);
        this.renderOverview(s);
        this.renderDaily(s);
        this.renderCoding(s);
        this.renderCost(s);
        this.renderGaps(s);
        this.renderActions(s);
        this.renderList();
        refreshIcons();
    },

    renderContext(s) {
        const a = MockIpd.assess(s);
        document.getElementById('ctxAvatar').textContent =
            s.patient.replace(/^(นาย|นาง|นางสาว|ด\.ช\.|ด\.ญ\.)/, '').trim().charAt(0);
        document.getElementById('ctxName').textContent = s.patient;
        document.getElementById('ctxChip').innerHTML   = MockTone.resultChipHtml(a.result);
        document.getElementById('ctxMeta').innerHTML = `
            <span>AN ${esc(s.an)} · HN ${esc(s.hn)}</span>
            <span>${esc(s.age)} ปี · ${s.gender === 'F' ? 'หญิง' : 'ชาย'}</span>
            <span>${esc((MockIpd.ward(s.ward) || {}).label || s.ward)} เตียง ${esc(s.bed)}</span>
            <span>กองทุน: ${esc((MockIpd.fund(s.fund) || {}).label || s.fund)}</span>
            <span>รับไว้: ${esc(MockFmt.dateTimeTH(s.admit_at))}</span>
            <span>วันนอนถึงวันนี้: ${esc(MockIpd.los(s))} วัน</span>`;

        const alert = document.getElementById('ctxAlert');
        const worst = a.reasons.find(r => r.tone === 'danger') || a.reasons[0];
        if (worst) {
            alert.style.display = '';
            document.getElementById('ctxAlertLabel').textContent =
                a.reasons.filter(r => r.tone === 'danger').length ? 'ต้องแก้ก่อนจำหน่าย' : 'ควรตรวจสอบ';
            document.getElementById('ctxAlertText').textContent = a.reasons.length > 1
                ? `${worst.text} (และอีก ${a.reasons.length - 1} รายการ)` : worst.text;
        } else {
            alert.style.display = 'none';
        }
    },

    showAlert() { this.switchTab('gaps'); },

    switchTab(key, btn) {
        this.state.tab = key;
        document.querySelectorAll('.ds-tab').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        else document.querySelectorAll('.ds-tab')[this.TABS.indexOf(key)].classList.add('active');

        document.querySelectorAll('.ds-tab-content').forEach(el => el.classList.remove('active'));
        const map = { overview: 'tabOverview', daily: 'tabDaily', coding: 'tabCoding',
                      cost: 'tabCost', gaps: 'tabGaps' };
        document.getElementById(map[key]).classList.add('active');

        /* กราฟต้องวาดตอนกล่องมองเห็นแล้ว ไม่งั้น SVG กว้าง 0 */
        if (key === 'cost') this.drawCostChart(this.current());
        refreshIcons();
    },

    /* ══════════ แท็บ 1 — ภาพรวมการนอน ══════════ */

    renderOverview(s) {
        const drg  = MockIpd.drgOf(s);
        const rule = MockIpd.fundRule(s.fund);
        const band = MockIpd.losBand(s);

        let hitActive = false;
        const stepper = MockIpd.steps(s).map(st => {
            if (st.ok) return `<span class="ds-step completed"><i data-lucide="check" class="icon-sm"></i> ${esc(st.label)}</span>`;
            if (!hitActive) { hitActive = true; return `<span class="ds-step active">${esc(st.label)}</span>`; }
            return `<span class="ds-step">${esc(st.label)}</span>`;
        }).join('');

        const leaveRows = (s.leave_periods || []).map(p => `
            <div style="font-size:12px;padding:3px 0">
                <span class="sip-chip sip-chip-amber">${esc(MockFmt.dateTH(p.from))} – ${esc(MockFmt.dateTH(p.to))}</span>
                ${esc(p.reason)}</div>`).join('');

        document.getElementById('tabOverview').innerHTML = `
            <div class="cards-row">
                <div class="clinical-card">
                    <div class="card-title"><i data-lucide="user" class="mi"></i> ผู้ป่วยและสิทธิ</div>
                    ${kvRows({ 'ชื่อ-สกุล': s.patient, 'HN': s.hn, 'AN': s.an,
                               'อายุ / เพศ': `${s.age} ปี · ${s.gender === 'F' ? 'หญิง' : 'ชาย'}`,
                               'กองทุน': (MockIpd.fund(s.fund) || {}).label || s.fund,
                               'ผู้รับผิดชอบจ่าย': (MockIpd.fund(s.fund) || {}).payer || '—' })}
                </div>
                <div class="clinical-card">
                    <div class="card-title"><i data-lucide="bed" class="mi"></i> ข้อมูลการรับไว้</div>
                    ${kvRows({ 'หอผู้ป่วย / เตียง': `${(MockIpd.ward(s.ward) || {}).label || s.ward} · ${s.bed}`,
                               'วันเวลารับไว้': MockFmt.dateTimeTH(s.admit_at),
                               'สถานะ': MockIpd.statusOf(s.status).label,
                               'วันนอนถึงวันนี้': MockIpd.los(s) + ' วัน',
                               'วันลากลับบ้าน': (s.leave_days || 0) + ' วัน' })}
                    ${leaveRows ? `<div style="margin-top:8px">
                        <div class="ds-section-label">ช่วงที่ลากลับบ้าน</div>${leaveRows}
                        <div class="card-footer">มีวันลา = ต้องส่งแฟ้ม 15 (NHSO LVD) ด้วย</div></div>` : ''}
                </div>
            </div>

            <div class="cards-row">
                <div class="clinical-card">
                    <div class="card-title"><i data-lucide="gauge" class="mi"></i> ความพร้อมส่งเบิก</div>
                    <div class="ds-stepper" style="margin:8px 0 12px">${stepper}</div>
                    <div class="card-footer">ขั้นที่ยังไม่ผ่านคือสิ่งที่ต้องปิดก่อนจำหน่าย</div>
                </div>
                <div class="clinical-card">
                    <div class="card-title"><i data-lucide="activity" class="mi"></i> วันนอนเทียบจุดตัด DRG</div>
                    ${drg ? `
                        ${losBar(MockIpd.los(s), drg)}
                        ${kvRows({ 'กลุ่ม DRG': `${drg.drg} — ${drg.label}`,
                                   'วันนอนเฉลี่ยของกลุ่ม': drg.alos + ' วัน',
                                   'จุดตัดล่าง / บน': `${drg.trimLow} – ${drg.trimHigh} วัน`,
                                   'สถานะ': band === 'high' ? 'เกินจุดตัดบน (high outlier)'
                                          : band === 'low' ? 'ต่ำกว่าจุดตัดล่าง (low outlier)' : 'อยู่ในช่วงปกติ' })}
                        ${unverifiedNote()}`
                      : `<div class="sip-banner sip-banner-danger">
                            <i data-lucide="alert-circle" class="icon-sm"></i>
                            ยังจัดกลุ่ม DRG ไม่ได้ — ต้องระบุการวินิจฉัยหลักก่อน</div>`}
                </div>
            </div>

            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="shield-check" class="mi"></i>
                        เงื่อนไขกองทุน ${esc((MockIpd.fund(s.fund) || {}).short || s.fund)} ที่เกี่ยวกับช่วงระหว่างนอน</div>
                </div>
                <div style="padding:4px 2px">
                    <div class="ds-note" style="margin-bottom:8px">
                        <i data-lucide="info" class="icon-sm"></i>
                        <strong>${esc(rule.preAuth.label)}:</strong> ${esc(rule.preAuth.note)}
                    </div>
                    <div class="ds-note">
                        <i data-lucide="send" class="icon-sm"></i>
                        <strong>ช่องทางยื่น:</strong> ${esc(rule.channel)} ·
                        <strong>กำหนดยื่น:</strong> ${esc(rule.submitDue.note)}
                    </div>
                    ${unverifiedNote('เงื่อนไขกองทุนชุดนี้ยังไม่ได้เทียบกับประกาศฉบับจริง')}
                </div>
            </div>`;
    },

    /* ══════════ แท็บ 2 — ไทม์ไลน์รายวัน ══════════ */

    renderDaily(s) {
        const daily = s.daily || [];
        const gaps  = daily.filter(d => !d.progress_note || !d.doctor_order).length;

        const badge = document.getElementById('dailyBadge');
        badge.style.display = gaps ? '' : 'none';
        badge.textContent = gaps;

        let acc = 0;
        const rows = daily.map(d => {
            acc += d.charge_day;
            const bad = !d.progress_note || !d.doctor_order;
            return `<tr style="${bad ? 'background:var(--status-danger-soft, #fee2e2)' : ''}">
                <td class="td-sub">${esc(d.day)}</td>
                <td class="td-sub" style="white-space:nowrap">${esc(MockFmt.dateTH(d.date))}</td>
                <td>${tick(d.progress_note)}</td>
                <td>${tick(d.doctor_order)}</td>
                <td>${tick(d.nurse_note)}</td>
                <td>${(d.events || []).map(e =>
                    `<span class="sip-chip sip-chip-active">${esc(e)}</span>`).join(' ') || '<span class="td-sub">—</span>'}</td>
                <td style="text-align:right;white-space:nowrap">${esc(MockFmt.baht(d.charge_day))}</td>
                <td style="text-align:right;white-space:nowrap">${esc(MockFmt.baht(acc))}</td>
                <td class="td-sub">${esc(d.note)}</td>
            </tr>`;
        }).join('');

        document.getElementById('tabDaily').innerHTML = `
            ${gaps ? `<div class="sip-banner sip-banner-danger">
                <i data-lucide="alert-triangle" class="icon-sm"></i>
                พบ ${gaps} วันที่บันทึกไม่ครบ — แก้ตอนนี้ยังทัน ถ้าปล่อยถึงวันจำหน่ายจะกลายเป็นข้อทักท้วงตอนตรวจแฟ้ม
              </div>` : `<div class="sip-banner sip-banner-success">
                <i data-lucide="check-circle-2" class="icon-sm"></i> บันทึกประจำวันครบทุกวัน</div>`}

            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="calendar-days" class="mi"></i>
                        บันทึกรายวัน <span class="ds-pane-count">${daily.length} วัน</span></div>
                </div>
                <div class="table-responsive">
                    <table class="data-table compact">
                        <thead><tr>
                            <th style="width:1%">วันที่</th><th style="width:1%">วันที่ (พ.ศ.)</th>
                            <th style="width:1%">Progress note</th><th style="width:1%">คำสั่งแพทย์</th>
                            <th style="width:1%">บันทึกพยาบาล</th><th>เหตุการณ์</th>
                            <th style="width:1%;text-align:right">ค่าใช้จ่ายวันนี้</th>
                            <th style="width:1%;text-align:right">สะสม</th>
                            <th style="width:1%">หมายเหตุ</th>
                        </tr></thead>
                        <tbody>${rows || '<tr><td colspan="9" class="ds-empty">ยังไม่มีบันทึกรายวัน</td></tr>'}</tbody>
                    </table>
                </div>
            </div>

            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="history" class="mi"></i> เหตุการณ์สำคัญ</div>
                </div>
                <div style="padding:6px 2px">
                    ${(s.timeline || []).map(t => `
                        <div class="ds-timeline-item ${esc(t.tone || 'info')}">
                            <strong>${esc(t.title)}</strong>
                            <div class="td-sub">${esc(MockFmt.dateTimeTH(t.at))} · ${esc(t.by)}${
                                t.note ? ' · ' + esc(t.note) : ''}</div>
                        </div>`).join('') || '<div class="ds-empty">ยังไม่มีเหตุการณ์</div>'}
                </div>
            </div>`;
    },

    /* ══════════ แท็บ 3 — วินิจฉัย / หัตถการ ══════════ */

    renderCoding(s) {
        const drg = MockIpd.drgOf(s);
        const arw = MockIpd.adjRw(s);

        document.getElementById('tabCoding').innerHTML = `
            ${!s.pdx ? `<div class="sip-banner sip-banner-danger">
                <i data-lucide="alert-circle" class="icon-sm"></i>
                <strong>ยังไม่ได้ระบุการวินิจฉัยหลัก (PDx)</strong> — ผู้ป่วยในจ่ายตามกลุ่มวินิจฉัยโรคร่วม
                ถ้าไม่มี PDx จะคำนวณค่าชดเชยไม่ได้และส่งเบิกไม่ได้ (RUL-IPD-017)
              </div>` : ''}

            <div class="cards-row">
                <div class="clinical-card">
                    <div class="card-title"><i data-lucide="clipboard-list" class="mi"></i> การวินิจฉัย (ICD-10)</div>
                    <div class="ds-section-label">การวินิจฉัยหลัก (PDx)</div>
                    ${s.pdx ? `<div style="font-size:12px;padding:2px 0">
                        <span class="sip-chip sip-chip-active">${esc(s.pdx)}</span> ${esc(s.pdx_name || '')}</div>`
                      : '<div class="ds-empty-sm">ยังไม่ระบุ</div>'}
                    <div class="ds-section-label" style="margin-top:10px">การวินิจฉัยร่วม / โรคแทรก (SDx)</div>
                    ${(s.sdx || []).map(d => `<div style="font-size:12px;padding:2px 0">
                        <span class="sip-chip sip-chip-muted">${esc(d.code)}</span> ${esc(d.name)}</div>`).join('')
                      || '<div class="ds-empty-sm">ไม่มีข้อมูล</div>'}
                </div>
                <div class="clinical-card">
                    <div class="card-title"><i data-lucide="syringe" class="mi"></i> หัตถการ (ICD-9-CM)</div>
                    ${(s.proc || []).map(p => `<div style="font-size:12px;padding:3px 0">
                        <span class="sip-chip sip-chip-muted">${esc(p.code)}</span> ${esc(p.name)}
                        <span class="td-sub"> · ${esc(MockFmt.dateTH(p.date))}</span></div>`).join('')
                      || '<div class="ds-empty-sm">ไม่มีหัตถการ</div>'}
                    <div class="card-footer">
                        มีหัตถการ = ต้องมีรายงานการผ่าตัดในแฟ้ม และต้องส่งแฟ้ม 6 (NHSO Procedure)
                    </div>
                </div>
            </div>

            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="layers" class="mi"></i>
                        กลุ่มวินิจฉัยโรคร่วม (DRG) ที่จัดได้ตอนนี้</div>
                    <div class="section-actions">
                        <span class="sip-chip sip-chip-muted">${esc(MockIpd.drgVersion(MockIpd.asOf(s)).label)}</span>
                    </div>
                </div>
                <div style="padding:4px 2px">
                    ${drg ? `
                        <div class="cards-row">
                            <div class="card"><div class="card-title">กลุ่ม DRG</div>
                                <div style="font-size:22px;font-weight:800">${esc(drg.drg)}</div>
                                <div class="td-sub">${esc(drg.label)}</div></div>
                            <div class="card"><div class="card-title">MDC</div>
                                <div style="font-size:22px;font-weight:800">${esc(drg.mdc)}</div>
                                <div class="td-sub">${esc((MockIpd.mdc(drg.mdc) || {}).label || '')}</div></div>
                            <div class="card"><div class="card-title">RW</div>
                                <div style="font-size:22px;font-weight:800">${esc(drg.rw.toFixed(4))}</div>
                                <div class="td-sub">น้ำหนักสัมพัทธ์ตั้งต้น</div></div>
                            <div class="card"><div class="card-title">AdjRW ปัจจุบัน</div>
                                <div style="font-size:22px;font-weight:800">${esc(arw.toFixed(4))}</div>
                                <div class="td-sub">ปรับตามวันนอน ${esc(MockIpd.los(s))} วัน</div></div>
                        </div>
                        ${losBar(MockIpd.los(s), drg)}
                        ${unverifiedNote()}`
                      : `<div class="ds-empty">ยังจัดกลุ่มไม่ได้ — ต้องมีการวินิจฉัยหลักก่อน</div>`}
                </div>
            </div>`;
    },

    /* ══════════ แท็บ 4 — ค่าใช้จ่าย vs ประมาณการ ══════════ */

    renderCost(s) {
        const est   = MockIpd.estimate(s);
        const cost  = MockIpd.cost(s);
        const varc  = MockIpd.variance(s);
        const fund  = MockIpd.fund(s.fund) || {};
        const rate  = MockIpd.rate(s.fund, MockIpd.asOf(s));

        const byGroup = (s.charges || []).map(c => `
            <tr><td class="td-sub">${esc(c.billgrcs)}</td><td>${esc(c.name)}</td>
                <td style="text-align:right;white-space:nowrap">${esc(MockFmt.baht(c.amount))}</td>
                <td style="text-align:right" class="td-sub">${esc(MockFmt.pct(cost ? c.amount / cost * 100 : 0))}</td></tr>`).join('');

        document.getElementById('tabCost').innerHTML = `
            <div class="cards-row">
                <div class="card"><div class="card-title">ค่าใช้จ่ายจริงสะสม</div>
                    <div style="font-size:26px;font-weight:800">${esc(MockFmt.baht(cost))}</div>
                    <div class="td-sub">บาท · ${esc(MockIpd.los(s))} วันนอน</div></div>
                <div class="card"><div class="card-title">ประมาณการรับตาม DRG</div>
                    <div style="font-size:26px;font-weight:800">${est == null ? '—' : esc(MockFmt.baht(est))}</div>
                    <div class="td-sub">${est == null ? esc(fund.label || '') + ' ไม่จ่ายตาม DRG'
                        : 'AdjRW × ' + esc(MockFmt.baht(rate)) + ' บาท/RW'}</div></div>
                <div class="card"><div class="card-title">ส่วนต่าง</div>
                    <div style="font-size:26px;font-weight:800;color:${
                        varc == null ? 'var(--text-muted)' : varc > 0 ? 'var(--status-danger)' : 'var(--status-success)'}">
                        ${varc == null ? '—' : (varc > 0 ? '+' : '') + esc(MockFmt.baht(varc))}</div>
                    <div class="td-sub">${varc == null ? 'คำนวณไม่ได้'
                        : varc > 0 ? 'โรงพยาบาลรับภาระส่วนเกิน' : 'อยู่ในกรอบประมาณการ'}</div></div>
            </div>

            ${est == null ? `<div class="sip-banner sip-banner-info">
                <i data-lucide="info" class="icon-sm"></i>
                ${esc(fund.label || s.fund)} จ่ายตามค่าใช้จ่ายจริงภายใต้เพดานกรมธรรม์ ไม่ใช่ระบบ DRG
                — ให้ดูวงเงินที่ได้รับอนุมัติล่วงหน้าแทนประมาณการ DRG
              </div>` : unverifiedNote('ประมาณการรับคำนวณจากอัตราต่อ RW ที่เป็นค่าจำลอง')}

            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="trending-up" class="mi"></i>
                        ค่าใช้จ่ายสะสมรายวันเทียบประมาณการรับ</div>
                </div>
                <div id="costChart" style="padding:6px 2px"></div>
            </div>

            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="wallet" class="mi"></i> ค่าใช้จ่ายแยกหมวด (BILLGRCS)</div>
                </div>
                <div class="table-responsive">
                    <table class="data-table compact">
                        <thead><tr><th style="width:1%">หมวด</th><th>รายการ</th>
                            <th style="width:1%;text-align:right">จำนวนเงิน</th>
                            <th style="width:1%;text-align:right">สัดส่วน</th></tr></thead>
                        <tbody>${byGroup || '<tr><td colspan="4" class="ds-empty">ยังไม่มีรายการ</td></tr>'}</tbody>
                    </table>
                </div>
            </div>`;

        this.drawCostChart(s);
    },

    drawCostChart(s) {
        if (!s) return;
        const el = document.getElementById('costChart');
        if (!el || !el.offsetWidth) return;      /* แท็บยังซ่อนอยู่ — วาดตอนสลับมา */

        const series = MockIpd.costSeries(s);
        const est    = MockIpd.estimate(s);
        const opts = {
            labels: (s.daily || []).map(d => 'วันที่ ' + d.day),
            series: [{ name: 'ค่าใช้จ่ายจริงสะสม', points: series }],
            height: 240,
            yFmt: v => MockFmt.baht(v, { short: true }),
        };
        if (est != null) {
            opts.series.push({ name: 'ประมาณการรับตาม DRG', points: series.map(() => est) });
        }
        DSChart.line('costChart', opts);
    },

    /* ══════════ แท็บ 5 — เอกสาร / แฟ้มที่ขาด ══════════ */

    renderGaps(s) {
        const fc    = MockIpd.fileCheck(s);
        const chart = MockIpd.chartScore(s);
        const fundRows = MockIpd.fundCheckItems(s).filter(r => r.state !== 'OK');
        const total = (fc.nhso ? fc.missing.length : 0) + chart.missing.length + fundRows.length;

        const badge = document.getElementById('gapBadge');
        badge.style.display = total ? '' : 'none';
        badge.textContent = total;

        const fileBlock = !fc.nhso
            ? `<div class="ds-note"><i data-lucide="info" class="icon-sm"></i>
                 ${esc(fc.fundLabel)} ไม่ส่งผ่านชุดข้อมูลมาตรฐาน 15 แฟ้มของ สปสช.
                 — ใช้ชุดเอกสารของบริษัทประกันแทน (ดูรายการด้านล่าง)</div>`
            : fc.missing.length
                ? `<div class="sip-banner sip-banner-danger">
                     <i data-lucide="x-circle" class="icon-sm"></i>
                     ยังขาดแฟ้ม ${esc(MockNhso.fileNames(fc.missing))} ที่กองทุน${esc(fc.fundLabel)}บังคับ
                   </div>`
                : `<div class="sip-banner sip-banner-success">
                     <i data-lucide="check-circle-2" class="icon-sm"></i>
                     ส่งแฟ้มครบตามที่กองทุน${esc(fc.fundLabel)}กำหนดแล้ว (${fc.sent.length}/${fc.required.length})</div>`;

        document.getElementById('tabGaps').innerHTML = `
            ${total ? `<div class="ds-warn">
                <i data-lucide="alert-triangle" class="icon-sm"></i>
                มี ${total} รายการที่ยังขาด — ทั้งหมดยังตามเก็บได้ระหว่างผู้ป่วยยังนอนอยู่
              </div>` : `<div class="sip-banner sip-banner-success">
                <i data-lucide="check-circle-2" class="icon-sm"></i> ไม่มีรายการค้าง</div>`}

            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="folder" class="mi"></i>
                        แฟ้มตามกองทุน</div>
                </div>
                <div style="padding:4px 2px">${fileBlock}</div>
            </div>

            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="file-text" class="mi"></i>
                        เวชระเบียนที่ยังขาด
                        <span class="ds-pane-count">${chart.got}/${chart.max} คะแนน · ${chart.pct}%</span></div>
                </div>
                <div class="table-responsive">
                    <table class="data-table compact">
                        <thead><tr><th style="width:1%">หมวด</th><th>รายการ</th>
                            <th style="width:1%">น้ำหนัก</th></tr></thead>
                        <tbody>${chart.missing.map(m => `<tr>
                            <td class="td-sub">${esc((IPD_CHART_GROUPS.find(g => g.key === m.group) || {}).label || m.group)}</td>
                            <td>${esc(m.label)}</td>
                            <td class="td-sub">${esc(m.weight)}</td>
                        </tr>`).join('') || '<tr><td colspan="3" class="ds-empty">ครบทุกรายการ</td></tr>'}</tbody>
                    </table>
                </div>
            </div>

            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="shield-check" class="mi"></i>
                        เงื่อนไข/เอกสารของกองทุน ${esc((MockIpd.fund(s.fund) || {}).short || s.fund)} ที่ยังไม่ครบ</div>
                </div>
                <div class="table-responsive">
                    <table class="data-table compact">
                        <thead><tr><th>รายการ</th><th>รายละเอียด</th></tr></thead>
                        <tbody>${fundRows.map(r => `<tr>
                            <td>${esc(r.label)}</td>
                            <td class="td-sub">${esc(r.detail || '')}</td>
                        </tr>`).join('') || '<tr><td colspan="2" class="ds-empty">ครบทุกรายการ</td></tr>'}</tbody>
                    </table>
                </div>
                ${unverifiedNote('เงื่อนไขกองทุนชุดนี้ยังไม่ได้เทียบกับประกาศฉบับจริง')}
            </div>`;
    },

    /* ══════════ แผงขวา ══════════ */

    renderActions(s) {
        const a = MockIpd.assess(s);
        const last = (s.daily || [])[(s.daily || []).length - 1] || {};

        document.getElementById('actionPane').innerHTML = `
            <div class="ds-section-label">สรุปความพร้อม</div>
            <div class="card" style="margin-bottom:12px">
                <div style="display:flex;align-items:baseline;gap:8px">
                    <span style="font-size:30px;font-weight:800">${esc(a.score)}</span>
                    <span class="td-sub">/100</span>
                    <span style="margin-left:auto">${MockTone.resultBadgeHtml(a.result)}</span>
                </div>
                <div class="card-footer">เวชระเบียน ${esc(a.chart.pct)}% ·
                    เอกสารกองทุน ${esc(a.fundPct)}% · แฟ้ม ${esc(a.filePct)}%</div>
            </div>

            ${a.reasons.length ? `
            <div class="ds-section-label">สิ่งที่ยังขาด (${a.reasons.length})</div>
            <ul style="margin:0 0 14px;padding-left:18px;font-size:12px;line-height:1.85">
                ${a.reasons.slice(0, 8).map(r =>
                    `<li style="color:${r.tone === 'danger' ? 'var(--status-danger)' : 'var(--status-warning)'}">${esc(r.text)}</li>`).join('')}
                ${a.reasons.length > 8 ? `<li class="td-sub">และอีก ${a.reasons.length - 8} รายการ</li>` : ''}
            </ul>` : ''}

            <div class="ds-section-label">บันทึกกิจกรรมประจำวัน</div>
            <div class="sip-field">
                <label class="sip-label">วันที่</label>
                <input class="sip-input" id="nDate" type="date" value="${esc(toGregorian(last.date))}">
            </div>
            <div class="sip-field">
                <label class="sip-label">เหตุการณ์</label>
                <input class="sip-input" id="nEvent" placeholder="เช่น ย้ายเข้าไอซียู / ปรับแผนการรักษา">
            </div>
            <div class="sip-field">
                <label class="sip-label">หมายเหตุ</label>
                <textarea class="sip-textarea" id="nNote" rows="3"
                          placeholder="สิ่งที่ต้องส่งต่อให้เวรถัดไปหรืองานเวชระเบียน"></textarea>
            </div>
            <div class="sip-field">
                <label class="sip-checkbox" style="display:flex;gap:8px;align-items:center">
                    <input type="checkbox" id="nProgress" checked>
                    <span>บันทึกความก้าวหน้า (Progress note) ของวันนี้ครบแล้ว</span>
                </label>
            </div>
            <div class="ds-note">
                <i data-lucide="info" class="icon-sm"></i>
                บันทึกที่นี่จะไปโผล่ในแท็บ "ไทม์ไลน์รายวัน" และนับรวมในคะแนนเวชระเบียนทันที
            </div>`;
        refreshIcons();
    },

    saveNote() {
        const s = this.current(); if (!s) { showToast('ยังไม่ได้เลือกผู้ป่วย', 'warning'); return; }

        const ev   = document.getElementById('nEvent').value.trim();
        const note = document.getElementById('nNote').value.trim();
        const done = document.getElementById('nProgress').checked;
        if (!ev && !note && !done) { showToast('ยังไม่มีอะไรให้บันทึก', 'warning'); return; }

        /* input[type=date] ทำงานเป็น ค.ศ. — แปลงกลับเป็น พ.ศ. ให้ตรงกับข้อมูลจำลอง */
        const raw = document.getElementById('nDate').value;
        const day = raw ? `${(+raw.slice(0, 4)) + 543}${raw.slice(4)}` : null;

        const daily = (s.daily || []).map(d => (day && d.date === day)
            ? { ...d, progress_note: done || d.progress_note, doctor_order: done || d.doctor_order,
                events: ev ? [...(d.events || []), ev] : d.events,
                note: done ? '' : (note || d.note) }
            : d);

        MockDB.patch('ipd_stays', s.id, {
            daily,
            timeline: [...(s.timeline || []), {
                at: '2569-08-06T09:00', tone: 'info',
                title: ev || 'บันทึกกิจกรรมประจำวัน',
                by: MockAdmin.userName(MockSession.userId()),
                note: note || (done ? 'ยืนยันบันทึกความก้าวหน้าครบ' : ''),
            }],
        });

        showToast('บันทึกแล้ว');
        this.select(s.id);
    },

    /* ── จำหน่ายและส่งเข้าคิวตรวจแฟ้ม ── */

    openDischarge() {
        const s = this.current(); if (!s) { showToast('ยังไม่ได้เลือกผู้ป่วย', 'warning'); return; }
        const a = MockIpd.assess(s);

        Drawer.open({
            title: `จำหน่ายผู้ป่วย — AN ${s.an}`,
            contentHtml: `
                <div class="ds-note" style="margin-bottom:14px">
                    <i data-lucide="user" class="icon-sm"></i> ${esc(s.patient)} · HN ${esc(s.hn)} ·
                    รับไว้ ${esc(MockFmt.dateTH(s.admit_at))} · นอนแล้ว ${esc(MockIpd.los(s))} วัน
                </div>
                <div class="sip-field-row">
                    <div class="sip-field">
                        <label class="sip-label">วันที่จำหน่าย *</label>
                        <input class="sip-input" id="dDate" type="date" value="2026-08-06">
                    </div>
                    <div class="sip-field">
                        <label class="sip-label">เวลา</label>
                        <input class="sip-input" id="dTime" type="time" value="11:00">
                    </div>
                </div>
                <div class="sip-field-row">
                    <div class="sip-field">
                        <label class="sip-label">ประเภทการจำหน่าย (DISCHT)</label>
                        <select class="sip-select" id="dType">${IPD_DISCHARGE_TYPE.map(t =>
                            `<option value="${esc(t.code)}">${esc(t.code)} — ${esc(t.label)}</option>`).join('')}</select>
                    </div>
                    <div class="sip-field">
                        <label class="sip-label">สถานะเมื่อจำหน่าย (DISCHS)</label>
                        <select class="sip-select" id="dStatus">${IPD_DISCHARGE_STATUS.map(t =>
                            `<option value="${esc(t.code)}">${esc(t.code)} — ${esc(t.label)}</option>`).join('')}</select>
                    </div>
                </div>
                <div class="sip-field">
                    <label class="sip-label">หมายเหตุการจำหน่าย</label>
                    <textarea class="sip-textarea" id="dNote" rows="2"></textarea>
                </div>
                ${a.reasons.length ? `
                <div class="sip-banner sip-banner-warning">
                    <i data-lucide="alert-triangle" class="icon-sm"></i>
                    ยังมี ${a.reasons.length} รายการค้าง — จำหน่ายได้ แต่จะไปโผล่เป็นข้อทักท้วงในคิวตรวจแฟ้ม
                </div>
                <ul style="margin:8px 0 0;padding-left:18px;font-size:12px;line-height:1.8">
                    ${a.reasons.slice(0, 5).map(r => `<li>${esc(r.text)}</li>`).join('')}
                </ul>` : `
                <div class="sip-banner sip-banner-success">
                    <i data-lucide="check-circle-2" class="icon-sm"></i>
                    ไม่มีรายการค้าง — ตรวจแฟ้มน่าจะผ่านรอบเดียว
                </div>`}`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                         <button class="btn btn-save-send" onclick="IpdAdmit.doDischarge()">จำหน่ายและส่งตรวจแฟ้ม</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    doDischarge() {
        const s = this.current(); if (!s) return;

        const raw  = document.getElementById('dDate').value;
        const time = document.getElementById('dTime').value || '11:00';
        if (!raw) { showToast('กรุณาระบุวันที่จำหน่าย', 'warning'); return; }

        /* input[type=date] ทำงานเป็น ค.ศ. — แปลงกลับเป็น พ.ศ. */
        const disch = `${(+raw.slice(0, 4)) + 543}${raw.slice(4)}T${time}`;
        const type  = document.getElementById('dType').value;
        const stat  = document.getElementById('dStatus').value;
        const note  = document.getElementById('dNote').value.trim();

        MockDB.patch('ipd_stays', s.id, {
            status: stat === '3' ? 'DEAD' : (type === '2' ? 'REFERRED_OUT' : 'DISCHARGED'),
            discharge_at: disch,
            discharge_type: type,
            discharge_status: stat,
            audit_status: 'PENDING',
            timeline: [...(s.timeline || []), {
                at: disch, tone: 'info',
                title: 'จำหน่ายผู้ป่วย — ' + ((MockIpd.dischargeType(type) || {}).label || ''),
                by: MockAdmin.userName(MockSession.userId()),
                note: note || 'ส่งเข้าคิวตรวจแฟ้มผู้ป่วยใน',
            }],
        });

        Drawer.close();
        showToast(`จำหน่าย AN ${s.an} แล้ว — ส่งเข้าคิวตรวจแฟ้ม`);
        setTimeout(() => { location.href = 'ipd-audit.html?an=' + encodeURIComponent(s.an); }, 700);
    },
};


/* ── helper ระดับหน้า ─────────────────────────────────── */

/** แถวคู่ key–value แบบเดียวกับ claim-case.js */
function kvRows(o) {
    return Object.entries(o).map(([k, v]) =>
        `<div style="display:flex;justify-content:space-between;gap:12px;padding:4px 0;
             border-bottom:1px dashed var(--brand-border);font-size:12px">
            <span style="color:var(--text-muted)">${esc(k)}</span>
            <strong style="text-align:right">${esc(v)}</strong></div>`).join('');
}

/** เครื่องหมายถูก/ผิดในตารางรายวัน */
function tick(ok) {
    return ok
        ? '<i data-lucide="check" class="icon-sm" style="color:var(--status-success)"></i>'
        : '<i data-lucide="x" class="icon-sm" style="color:var(--status-danger)"></i>';
}

/** แถบแสดงวันนอนเทียบจุดตัดล่าง–บนของกลุ่ม DRG */
function losBar(los, drg) {
    const span = Math.max(drg.trimHigh * 1.3, los * 1.1);
    const pct  = v => Math.min(100, (v / span) * 100);
    const band = los < drg.trimLow ? 'warning' : los > drg.trimHigh ? 'danger' : 'success';
    return `
        <div style="margin:10px 0 14px">
            <div style="position:relative;height:10px;border-radius:5px;background:var(--surface-1)">
                <div style="position:absolute;left:${pct(drg.trimLow)}%;width:${pct(drg.trimHigh) - pct(drg.trimLow)}%;
                            top:0;bottom:0;background:var(--status-success-soft);border-radius:5px"></div>
                <div style="position:absolute;left:${pct(los)}%;top:-4px;width:3px;height:18px;
                            background:var(--status-${band});border-radius:2px"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:5px">
                <span>0</span>
                <span>จุดตัดล่าง ${esc(drg.trimLow)} · จุดตัดบน ${esc(drg.trimHigh)} วัน</span>
                <span>นอนจริง ${esc(los)} วัน</span>
            </div>
        </div>`;
}

/** ป้าย "รอยืนยัน" — ต้องขึ้นทุกจุดที่แสดงค่า DRG/เงื่อนไขกองทุนที่ยังไม่ได้ยืนยัน */
function unverifiedNote(extra) {
    return `<div class="ds-warn" style="margin-top:10px">
        <i data-lucide="alert-triangle" class="icon-sm"></i>
        <strong>รอยืนยัน</strong> — ${esc(extra || IPD_UNVERIFIED_NOTE)}
        · <a href="ipd-reference.html">ดูทะเบียนเอกสารอ้างอิงและนำเข้าค่าจริง</a>
    </div>`;
}

/** วันที่ พ.ศ. → ค.ศ. สำหรับใส่ใน input[type=date] */
function toGregorian(th) {
    if (!th) return '2026-08-06';
    const m = String(th).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${(+m[1]) - 543}-${m[2]}-${m[3]}` : '2026-08-06';
}

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.IpdAdmit = IpdAdmit;
document.addEventListener('DOMContentLoaded', () => IpdAdmit.init());
