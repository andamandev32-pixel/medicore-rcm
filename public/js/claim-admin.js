/* ────────────────────────────────────────────────────────
   ผู้ดูแลระบบ / Audit — SRS §10 · FR-10

   หน้านี้คือที่ที่ผู้บริหารมาดูว่า "ระบบบังคับธรรมาภิบาลตัวเองจริงไหม"
     · เมทริกซ์สิทธิ์ 9 บทบาท × 7 ความสามารถ — Rule Editor ไม่มีสิทธิ์อนุมัติกฎ (BR-05)
     · สวิตช์ธรรมาภิบาล AI ที่ล็อกไว้เปิด/ปิดไม่ได้ (BR-06/BR-07)
     · Audit Trail แสดง Before/After ทุกการเปลี่ยนแปลง
   ──────────────────────────────────────────────────────── */

const Admin = {

    state: { tab: 'users', mapKind: 'DRUG' },

    TABS: [
        { key: 'users',   label: 'ผู้ใช้',        icon: 'users' },
        { key: 'perm',    label: 'สิทธิ์',        icon: 'key-round' },
        { key: 'mapping', label: 'Mapping',      icon: 'link' },
        { key: 'integ',   label: 'Integration',  icon: 'plug' },
        { key: 'config',  label: 'ค่าระบบ',      icon: 'settings' },
        { key: 'audit',   label: 'Audit Trail',  icon: 'scroll-text' },
    ],

    init() {
        MockSession.mountBanner('demoBanner');
        const p = new URLSearchParams(location.search);
        if (p.get('tab')) this.state.tab = p.get('tab');
        this.renderTabBar();
        this.render();
    },

    renderTabBar() {
        document.getElementById('tabBar').innerHTML = this.TABS.map(t => `
            <button class="ds-tab ${t.key === this.state.tab ? 'active' : ''}"
                onclick="Admin.setTab('${t.key}')">
                <i data-lucide="${t.icon}" class="mi"></i> ${esc(t.label)}</button>`).join('');
    },

    setTab(k) {
        this.state.tab = k;
        history.replaceState(null, '', 'claim-admin.html?tab=' + k);
        this.renderTabBar();
        this.render();
    },

    render() {
        const fn = {
            users: () => this.tabUsers(), perm: () => this.tabPerm(), mapping: () => this.tabMapping(),
            integ: () => this.tabInteg(), config: () => this.tabConfig(), audit: () => this.tabAudit(),
        }[this.state.tab];
        document.getElementById('tabContent').innerHTML = fn ? fn() : '';
        refreshIcons();
    },

    /* ══════════ ผู้ใช้ ══════════ */

    tabUsers() {
        const users = MockAdmin.users();
        return `
        <div class="section-header" style="padding:0 0 12px">
            <div class="section-title">ผู้ใช้งานระบบ
                <span class="ds-pane-count">${users.filter(u => u.active).length} คนที่ใช้งานอยู่</span></div>
            <div class="section-actions">
                <button class="btn btn-primary btn-sm" onclick="Admin.openUser()">
                    <i data-lucide="user-plus" class="icon-sm"></i> เพิ่มผู้ใช้</button>
            </div>
        </div>
        <div class="table-responsive">
        <table class="data-table compact">
            <thead><tr><th>ชื่อ-สกุล</th><th style="width:1%">Username</th>
                <th style="width:1%">หน่วยงาน</th><th>บทบาท</th>
                <th style="width:1%">สถานะ</th><th style="width:1%">เข้าใช้ล่าสุด</th><th style="width:1%"></th></tr></thead>
            <tbody>${users.map(u => `<tr>
                <td class="td-name">${esc(u.name)}</td>
                <td class="td-sub"><code>${esc(u.username)}</code></td>
                <td class="td-sub">${esc(u.dept)}</td>
                <td>${u.roles.map(r => `<span class="sip-chip sip-chip-active">${esc(MockAdmin.roleLabel(r))}</span>`).join(' ')}</td>
                <td>${u.active ? '<span class="status-badge active">ใช้งาน</span>'
                               : '<span class="status-badge inactive">ปิดใช้งาน</span>'}</td>
                <td class="td-sub" style="white-space:nowrap">${esc(MockFmt.dateTimeTH(u.last_login))}</td>
                <td><button class="ds-icon-btn edit" title="แก้ไข" onclick="Admin.openUser('${esc(u.id)}')">
                    <i data-lucide="pencil" class="icon-sm"></i></button></td>
            </tr>`).join('')}</tbody>
        </table></div>
        <div class="ds-note"><i data-lucide="shield" class="icon-sm"></i>
            ระบบใช้หลัก least privilege — ผู้ใช้ได้เฉพาะสิทธิ์ที่จำเป็นต่อหน้าที่
            และการเปลี่ยนสิทธิ์ทุกครั้งถูกบันทึกใน Audit Trail</div>`;
    },

    openUser(id) {
        const u = id ? MockAdmin.user(id) : null;
        Drawer.open({
            title: u ? 'แก้ไขผู้ใช้ — ' + u.name : 'เพิ่มผู้ใช้ใหม่',
            contentHtml: `
                <div class="sip-field">
                    <label class="sip-label">ชื่อ-สกุล *</label>
                    <input class="sip-input" value="${esc(u ? u.name : '')}">
                </div>
                <div class="sip-field-row">
                    <div class="sip-field">
                        <label class="sip-label">Username *</label>
                        <input class="sip-input" value="${esc(u ? u.username : '')}">
                    </div>
                    <div class="sip-field">
                        <label class="sip-label">หน่วยงาน</label>
                        <input class="sip-input" value="${esc(u ? u.dept : '')}">
                    </div>
                </div>
                <div class="sip-field">
                    <label class="sip-label">บทบาท (เลือกได้หลายบทบาท)</label>
                    <div class="ds-chips">${MOCK_ROLES.map(r => `
                        <span class="ds-chip-toggle ${u && u.roles.indexOf(r.key) > -1 ? 'is-on' : ''}"
                            onclick="this.classList.toggle('is-on')">${esc(r.label)}</span>`).join('')}</div>
                </div>
                <div class="sip-banner sip-banner-warning">
                    <i data-lucide="alert-triangle" class="icon-sm"></i>
                    <span>ไม่ควรให้ผู้ใช้คนเดียวมีทั้ง <strong>Rule Editor</strong> และ
                    <strong>Rule Approver</strong> — จะทำให้ Maker–Checker ไม่มีผล (BR-05)</span>
                </div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                         <button class="btn btn-save" onclick="Drawer.close();showToast('บันทึกแล้ว (โหมดสาธิต)')">
                             บันทึก</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    /* ══════════ สิทธิ์ ══════════ */

    tabPerm() {
        return `
        <div class="ds-note" style="margin-bottom:14px">
            <i data-lucide="users" class="icon-sm"></i>
            เมทริกซ์สิทธิ์ ${MOCK_ROLES.length} บทบาท × ${MOCK_CAPS.length} ความสามารถ
            — ตรงกับบทบาทที่ระบุไว้ใน SRS §2
        </div>
        <div class="table-responsive">
        <table class="ds-table-grid">
            <thead><tr>
                <th style="width:22%;text-align:left">บทบาท</th>
                ${MOCK_CAPS.map(c => `<th>${esc(c.label)}</th>`).join('')}
            </tr></thead>
            <tbody>${MOCK_ROLES.map(r => {
                const flag = r.key === 'EDITOR' || r.key === 'APPROVER';
                return `<tr ${flag ? 'style="background:var(--brand-amber-50)"' : ''}>
                    <td class="l"><strong>${esc(r.label)}</strong>
                        <div class="td-sub" style="font-size:11px">${esc(r.duty)}</div></td>
                    ${MOCK_CAPS.map(c => `<td class="c">${MockAdmin.can(r.key, c.key)
                        ? '<i data-lucide="check" class="icon-sm" style="color:var(--status-success)"></i>'
                        : '<i data-lucide="minus" class="icon-sm" style="color:var(--brand-border-strong)"></i>'}</td>`).join('')}
                </tr>`;
            }).join('')}</tbody>
        </table></div>
        <div class="sip-banner sip-banner-danger">
            <i data-lucide="user-x" class="icon-sm"></i>
            <span><strong>สองแถวที่ไฮไลต์คือหัวใจของ BR-05:</strong>
            <strong>Rule Editor</strong> เขียนกฎได้แต่ <u>ไม่มีสิทธิ์อนุมัติกฎ</u> ·
            <strong>Rule Approver</strong> อนุมัติได้แต่ <u>ไม่มีสิทธิ์เขียนกฎ</u>
            — ระบบบังคับให้คนละคนเสมอ ไม่ใช่แค่แนวปฏิบัติบนกระดาษ</span>
        </div>
        <div class="ds-note"><i data-lucide="server" class="icon-sm"></i>
            การซ่อนเมนูตามสิทธิ์เป็นแค่เรื่อง UX — ด่านจริงบังคับที่ฝั่ง server ทุกครั้งที่เรียก API</div>`;
    },

    /* ══════════ Mapping ══════════ */

    tabMapping() {
        const rows = MockAdmin.mappings(this.state.mapKind);
        const pct = MockAdmin.mappingPct();
        const bad = MOCK_MAPPINGS.filter(m => m.status !== 'OK').length;

        return `
        <div class="ds-kpi-grid">
            <div class="sip-kpi"><i data-lucide="link" class="sip-kpi-icon icon-lg"></i>
                <div class="sip-kpi-value">${pct}%</div>
                <div class="sip-kpi-label">ความครบของ Mapping</div></div>
            <div class="sip-kpi critical"><i data-lucide="unlink" class="sip-kpi-icon icon-lg"></i>
                <div class="sip-kpi-value">${bad}</div>
                <div class="sip-kpi-label">รายการที่ยังไม่ตรง / ยังไม่ผูก</div></div>
            <div class="sip-kpi"><i data-lucide="calendar-clock" class="sip-kpi-icon icon-lg"></i>
                <div class="sip-kpi-value" style="font-size:20px">${esc(NHSO_GOLIVE.date)}</div>
                <div class="sip-kpi-label">ต้องครบ 100% ก่อนวันนี้</div></div>
        </div>

        <div class="ds-segbar" style="margin-bottom:12px">
            ${MOCK_MAPPING_KINDS.map(k => `
                <button class="ds-seg ${k.key === this.state.mapKind ? 'active' : ''}"
                    onclick="Admin.setMapKind('${esc(k.key)}')">${esc(k.label)}
                    (${MockAdmin.mappings(k.key).length})</button>`).join('')}
        </div>

        <div class="table-responsive">
        <table class="data-table compact">
            <thead><tr>
                <th style="width:1%">รหัสใน HIS</th><th>ชื่อรายการ</th>
                <th style="width:1%">STDCODE</th><th style="width:1%">BILLGRCS</th>
                <th style="width:1%;text-align:right">ราคาใน HIS</th>
                <th style="width:1%;text-align:right">ราคาใน Catalogue</th>
                <th style="width:1%">สถานะ</th><th style="width:1%">แก้ล่าสุด</th><th style="width:1%"></th>
            </tr></thead>
            <tbody>${rows.map(m => {
                const t = MOCK_MAPPING_TONE[m.status];
                return `<tr ${m.status !== 'OK' ? 'style="background:var(--status-danger-soft)"' : ''}>
                    <td class="td-sub"><code>${esc(m.his_code)}</code></td>
                    <td class="td-name">${esc(m.name)}</td>
                    <td class="td-sub">${esc(m.stdcode)}</td>
                    <td class="td-sub">${esc(m.billgrcs)}</td>
                    <td style="text-align:right">${m.price_his == null ? '—' : esc(MockFmt.baht(m.price_his))}</td>
                    <td style="text-align:right">${m.price_std == null ? '—' : esc(MockFmt.baht(m.price_std))}</td>
                    <td><span class="sip-chip ${esc(t.chip)}">${esc(t.label)}</span></td>
                    <td class="td-sub" style="white-space:nowrap">${esc(m.updated === '—' ? '—' : MockFmt.dateTH(m.updated))}</td>
                    <td>${m.status !== 'OK' ? `<button class="ds-icon-btn edit" title="แก้ Mapping"
                        onclick="Admin.openMapping('${esc(m.his_code)}')">
                        <i data-lucide="wrench" class="icon-sm"></i></button>` : ''}</td>
                </tr>`;
            }).join('')}</tbody>
        </table></div>

        <div class="ds-warn">
            <i data-lucide="alert-triangle" class="icon-sm"></i>
            แถวที่ราคาไม่ตรงคือ<strong>ต้นเหตุโดยตรงของรหัส P124</strong> —
            ทุกเคสที่มีรายการนั้นจะถูกตีกลับทั้งชุด · เป็นงานก่อน UAT ข้อ 5 ของ สปสช.
            <a href="nhso-import.html?tab=pretask" style="margin-left:6px">ดูงานก่อน UAT</a>
        </div>`;
    },

    setMapKind(k) { this.state.mapKind = k; this.render(); },

    openMapping(hisCode) {
        const m = MOCK_MAPPINGS.find(x => x.his_code === hisCode); if (!m) return;
        const affected = MockClaims.all().filter(c =>
            (c.charges || []).some(x => x.stdcode === m.stdcode));
        Drawer.open({
            title: 'แก้ Mapping — ' + m.name,
            contentHtml: `
                <table class="ds-table-grid">
                    <tbody>
                        <tr><td class="l" style="width:34%">รหัสใน HIS</td><td class="l"><code>${esc(m.his_code)}</code></td></tr>
                        <tr><td class="l">STDCODE (สปสช.)</td><td class="l"><code>${esc(m.stdcode)}</code></td></tr>
                        <tr><td class="l">หมวดค่าใช้จ่าย</td><td class="l">BILLGRCS ${esc(m.billgrcs)}</td></tr>
                        <tr><td class="l">ราคาที่ใช้ใน HIS</td><td class="l">
                            <strong style="color:var(--status-danger)">${m.price_his == null ? '—' : esc(MockFmt.baht(m.price_his))}</strong> บาท</td></tr>
                        <tr><td class="l">ราคาใน Catalogue</td><td class="l">
                            <strong>${m.price_std == null ? 'ยังไม่พบรายการ' : esc(MockFmt.baht(m.price_std))}</strong>
                            ${m.price_std == null ? '' : ' บาท'}</td></tr>
                        <tr><td class="l">ส่วนต่าง</td><td class="l">${m.price_std == null ? '—'
                            : `<strong style="color:var(--status-danger)">${esc(MockFmt.baht(m.price_his - m.price_std))}</strong> บาท/หน่วย`}</td></tr>
                    </tbody>
                </table>
                <div class="sip-banner sip-banner-danger" style="margin-bottom:12px">
                    <i data-lucide="alert-octagon" class="icon-sm"></i>
                    <span>มี <strong>${affected.length}</strong> เคสในระบบที่มีรายการนี้อยู่
                    — ทุกเคสจะถูกตีกลับด้วย P124 ถ้าส่งก่อนแก้ Mapping</span>
                </div>
                <div class="sip-field">
                    <label class="sip-label">แก้ไขราคาใน HIS ให้ตรง Catalogue</label>
                    <input class="sip-input" value="${esc(m.price_std == null ? '' : m.price_std)}"
                        placeholder="ราคาต่อหน่วยตาม Drug / Service Catalogue">
                </div>
                <div class="ds-note"><i data-lucide="info" class="icon-sm"></i>
                    ในระบบจริง การแก้ราคาจะทำที่ HIS ต้นทาง (BR-08) — หน้านี้ใช้ระบุว่าต้องแก้อะไรบ้าง
                    และสร้าง Task ให้ผู้รับผิดชอบ</div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>
                         <button class="btn btn-save" onclick="Drawer.close();showToast('สร้างงานแก้ Mapping แล้ว (โหมดสาธิต)')">
                             สร้างงานให้ผู้รับผิดชอบ</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    /* ══════════ Integration ══════════ */

    tabInteg() {
        return `
        <div class="table-responsive">
        <table class="data-table compact">
            <thead><tr><th>ระบบ</th><th style="width:1%">ประเภท</th><th>Endpoint</th>
                <th style="width:1%">สถานะ</th><th style="width:1%">เชื่อมล่าสุด</th></tr></thead>
            <tbody>${MOCK_INTEGRATIONS.map(i => `<tr>
                <td class="td-name">${esc(i.name)}
                    <div class="td-sub">${esc(i.note)}</div></td>
                <td class="td-sub" style="white-space:nowrap">${esc(i.kind)}</td>
                <td class="td-sub"><code>${esc(i.endpoint)}</code></td>
                <td><span class="status-badge ${esc(i.status)}">${
                    esc(i.status === 'active' ? 'เชื่อมต่ออยู่' : 'ปิดใช้งาน')}</span></td>
                <td class="td-sub" style="white-space:nowrap">${esc(MockFmt.dateTimeTH(i.last))}</td>
            </tr>`).join('')}</tbody>
        </table></div>

        <div class="section-header" style="padding:16px 0 10px">
            <div class="section-title"><i data-lucide="activity" class="mi"></i> Integration Log</div>
        </div>
        <div class="ds-timeline">${MOCK_INTEGRATION_LOG.map(l => `
            <div class="ds-timeline-item ${esc(l.tone)}">
                <strong>${esc(l.title)}</strong>
                <div class="td-sub">${esc(l.note)}</div>
                <span class="ds-timeline-time">${esc(MockFmt.dateTimeTH(l.at))}</span>
            </div>`).join('')}</div>

        <div class="ds-note"><i data-lucide="lock" class="icon-sm"></i>
            <strong>BR-08:</strong> การเชื่อมต่อ HIS เป็นแบบอ่านอย่างเดียว (Database View)
            ระบบไม่แก้ข้อมูลต้นทาง เว้นแต่มี Interface และสิทธิ์ที่โรงพยาบาลอนุมัติเป็นลายลักษณ์อักษร</div>`;
    },

    /* ══════════ ค่าระบบ ══════════ */

    tabConfig() {
        const c = MOCK_CONFIG;
        return `
        <div class="cards-row">
            <div class="clinical-card">
                <div class="card-title"><i data-lucide="clock" class="mi"></i> SLA ตามประเภทงาน</div>
                <table class="ds-table-grid">
                    <thead><tr><th style="width:44%">ประเภทงาน</th><th style="width:20%">ภายใน</th><th>ยกระดับไปที่</th></tr></thead>
                    <tbody>${c.sla.map(s => `<tr>
                        <td class="l">${esc(s.kind)}</td>
                        <td class="c"><strong>${esc(s.hours)}</strong> ชม.</td>
                        <td class="l">${esc(s.escalate)}</td>
                    </tr>`).join('')}</tbody>
                </table>
            </div>
            <div class="clinical-card">
                <div class="card-title"><i data-lucide="gauge" class="mi"></i> เกณฑ์คะแนนความเสี่ยง</div>
                <table class="ds-table-grid">
                    <thead><tr><th style="width:20%">ระดับ</th><th style="width:26%">ช่วงคะแนน</th><th>การดำเนินการ</th></tr></thead>
                    <tbody>${c.risk.map(r => `<tr>
                        <td class="c"><strong>${esc(r.level)}</strong></td>
                        <td class="c">${esc(r.range)}</td>
                        <td class="l">${esc(r.action)}</td>
                    </tr>`).join('')}</tbody>
                </table>
            </div>
        </div>

        <div class="cards-row">
            <div class="clinical-card">
                <div class="card-title"><i data-lucide="archive" class="mi"></i> การเก็บรักษาข้อมูล (Retention)</div>
                <table class="ds-table-grid">
                    <thead><tr><th style="width:42%">ประเภทข้อมูล</th><th style="width:18%">เก็บ</th><th>หมายเหตุ</th></tr></thead>
                    <tbody>${c.retention.map(r => `<tr>
                        <td class="l">${esc(r.kind)}</td>
                        <td class="c"><strong>${esc(r.keep)}</strong></td>
                        <td class="l">${esc(r.note)}</td>
                    </tr>`).join('')}</tbody>
                </table>
            </div>
            <div class="clinical-card" style="border-color:var(--status-danger)">
                <div class="card-title"><i data-lucide="bot" class="mi"></i> ธรรมาภิบาล AI (BR-06 / BR-07)</div>
                ${c.ai.map(a => `
                    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;
                         border-bottom:1px dashed var(--brand-border)">
                        <span class="ds-toggle ${a.on ? 'is-on' : ''}"
                              ${a.locked ? 'title="ล็อกไว้ตามกฎทางธุรกิจ — เปลี่ยนไม่ได้"'
                                         : 'onclick="this.classList.toggle(\'is-on\')" style="cursor:pointer"'}>
                            <span class="ds-toggle-track"><span class="ds-toggle-knob"></span></span>
                        </span>
                        <div style="flex:1;font-size:12.5px;line-height:1.5">
                            ${esc(a.label)}
                            ${a.note ? `<div class="td-sub"><i data-lucide="lock" class="icon-xs"></i> ${esc(a.note)}</div>` : ''}
                        </div>
                        ${a.locked ? '<i data-lucide="lock" class="icon-sm" style="color:var(--status-danger)"></i>' : ''}
                    </div>`).join('')}
                <div class="ds-warn" style="margin-top:10px">
                    <i data-lucide="shield-alert" class="icon-sm"></i>
                    สามข้อล่างล็อกไว้ที่ระดับระบบ — ผู้ดูแลระบบก็เปลี่ยนไม่ได้
                    เพราะเป็นข้อจำกัดที่กำหนดไว้ในกฎทางธุรกิจ ไม่ใช่ค่าตั้งค่า
                </div>
            </div>
        </div>

        <div class="section-card" style="margin-top:14px">
            <div class="section-title" style="margin-bottom:10px">
                <i data-lucide="scale" class="mi"></i> กฎทางธุรกิจที่ระบบบังคับ (SRS §6)</div>
            <table class="ds-table-grid">
                <thead><tr><th style="width:10%">รหัส</th><th>ข้อกำหนด</th></tr></thead>
                <tbody>${MOCK_BUSINESS_RULES.map(b => `<tr>
                    <td class="c"><strong>${esc(b.code)}</strong></td>
                    <td class="l">${esc(b.text)}</td>
                </tr>`).join('')}</tbody>
            </table>
        </div>`;
    },

    /* ══════════ Audit Trail ══════════ */

    tabAudit() {
        const rows = MockDB.all('audit');
        return `
        <div class="section-header" style="padding:0 0 12px">
            <div class="section-title">ประวัติการใช้งาน
                <span class="ds-pane-count">${rows.length} รายการล่าสุด</span></div>
            <div class="section-actions">
                <input class="sip-input" type="date" style="width:140px" value="2026-08-01">
                <input class="sip-input" type="date" style="width:140px" value="2026-08-06">
                <select class="sip-select" style="width:160px" id="fAction" onchange="Admin.render()">
                    <option value="all">ทุกการกระทำ</option>
                    ${Object.entries(MOCK_AUDIT_ACTION).map(([k, v]) =>
                        `<option value="${esc(k)}">${esc(v.label)}</option>`).join('')}
                </select>
                <button class="btn btn-outline btn-sm" onclick="showToast('ส่งออก Audit Log แล้ว (โหมดสาธิต)','info')">
                    <i data-lucide="download" class="icon-sm"></i> ส่งออก</button>
            </div>
        </div>
        <div class="table-responsive">
        <table class="data-table compact">
            <thead><tr><th style="width:1%">เวลา</th><th style="width:1%">ผู้กระทำ</th>
                <th style="width:1%">บทบาท</th><th style="width:1%">การกระทำ</th>
                <th>วัตถุ</th><th>ก่อน → หลัง</th>
                <th style="width:1%">IP</th><th style="width:1%"></th></tr></thead>
            <tbody>${rows.map(a => {
                const act = MOCK_AUDIT_ACTION[a.action] || { label: a.action, tone: '' };
                const u = MockAdmin.user(a.actor);
                const diff = Object.keys(a.after || {}).length
                    ? Object.entries(a.after).map(([k, v]) =>
                        `<div style="font-size:11px">${esc(k)}: <span style="color:var(--text-muted)">${
                            esc((a.before || {})[k] != null ? (a.before || {})[k] : '—')}</span>
                         → <strong>${esc(v)}</strong></div>`).join('')
                    : '<span class="td-sub">—</span>';
                return `<tr>
                    <td class="td-sub" style="white-space:nowrap">${esc(MockFmt.dateTimeTH(a.at))}</td>
                    <td class="td-sub">${esc(u ? u.name : a.actor)}</td>
                    <td class="td-sub">${esc(u ? MockAdmin.roleLabel(u.roles[0]) : 'ระบบ')}</td>
                    <td><span class="sip-chip ${act.tone === 'danger' ? 'sip-chip-danger'
                        : act.tone === 'success' ? 'sip-chip-success'
                        : act.tone === 'warning' ? 'sip-chip-amber' : 'sip-chip-muted'}">${esc(act.label)}</span></td>
                    <td class="td-name">${esc(a.entity)}</td>
                    <td>${diff}</td>
                    <td class="td-sub">${esc(a.ip)}</td>
                    <td><button class="ds-icon-btn" title="ดู snapshot" onclick="Admin.openAudit('${esc(a.id)}')">
                        <i data-lucide="file-json" class="icon-sm"></i></button></td>
                </tr>`;
            }).join('')}</tbody>
        </table></div>
        <div class="sip-banner sip-banner-info">
            <i data-lucide="lock" class="icon-sm"></i>
            <span>Audit Log <strong>แก้ไขหรือลบจากหน้าจอปกติไม่ได้</strong> — บันทึก Actor · Role · Action ·
            Entity · Before/After · Timestamp · Source ทุกครั้ง และค้นย้อนหลังได้ตามนโยบาย Retention (7 ปี)</span>
        </div>`;
    },

    openAudit(id) {
        const a = MockDB.byId('audit', id); if (!a) return;
        const u = MockAdmin.user(a.actor);
        Drawer.open({
            title: 'Audit Snapshot — ' + a.id,
            contentHtml: `
                <table class="ds-table-grid">
                    <tbody>
                        <tr><td class="l" style="width:28%">เวลา</td><td class="l">${esc(MockFmt.dateTimeTH(a.at))}</td></tr>
                        <tr><td class="l">ผู้กระทำ</td><td class="l">${esc(u ? u.name : a.actor)}
                            ${u ? ` (${esc(MockAdmin.roleLabel(u.roles[0]))})` : ''}</td></tr>
                        <tr><td class="l">การกระทำ</td><td class="l">${esc((MOCK_AUDIT_ACTION[a.action] || {}).label || a.action)}</td></tr>
                        <tr><td class="l">วัตถุที่ถูกกระทำ</td><td class="l">${esc(a.entity)}</td></tr>
                        <tr><td class="l">แหล่งที่มา (IP)</td><td class="l">${esc(a.ip)}</td></tr>
                    </tbody>
                </table>
                <div class="ds-section-label">ค่าก่อนเปลี่ยน</div>
                <div class="ds-block" style="font-family:var(--font-mono);font-size:11px;white-space:pre-wrap">${
                    esc(JSON.stringify(a.before || {}, null, 2))}</div>
                <div class="ds-section-label">ค่าหลังเปลี่ยน</div>
                <div class="ds-block" style="font-family:var(--font-mono);font-size:11px;white-space:pre-wrap">${
                    esc(JSON.stringify(a.after || {}, null, 2))}</div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>`,
            onOpen: () => refreshIcons(),
        });
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.Admin = Admin;
document.addEventListener('DOMContentLoaded', () => Admin.init());
