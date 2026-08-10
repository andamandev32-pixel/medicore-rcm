/* ────────────────────────────────────────────────────────
   งานและการอนุมัติ (Task & Approval) — SRS §10 · FR-07

   BR-04: Override ต้องมีผู้ทำ เวลา เหตุผล และหลักฐานทุกครั้ง
   BR-05: ผู้เสนอกับผู้อนุมัติต้องเป็นคนละคน
   ──────────────────────────────────────────────────────── */

const Tasks = {

    state: { id: null, filter: 'mine', tab: 'detail' },

    FILTERS: [
        { key: 'mine',     label: 'งานของฉัน',      fn: () => MockTasks.mine() },
        { key: 'approve',  label: 'รอฉันอนุมัติ',    fn: () => MockTasks.toApprove() },
        { key: 'assigned', label: 'มอบหมายโดยฉัน',   fn: () => MockTasks.assignedByMe() },
        { key: 'sla',      label: 'เกิน SLA',        fn: () => MockTasks.overSla() },
        { key: 'all',      label: 'ทั้งหมด',         fn: () => MockTasks.all() },
    ],

    TABS: [
        { key: 'detail',   label: 'รายละเอียดงาน',   icon: 'file-text' },
        { key: 'check',    label: 'การตรวจสอบ',      icon: 'list-checks' },
        { key: 'approval', label: 'อนุมัติ / Override', icon: 'shield-alert' },
    ],

    init() {
        const p = new URLSearchParams(location.search);
        this.state.id = p.get('id');
        if (p.get('filter')) this.state.filter = p.get('filter');

        /* ?kpi=sla มาจากการ์ด "งานเกิน SLA" บน claim-dashboard
           กล่อง 'sla' ของหน้านี้เรียก MockTasks.overSla() ตัวเดียวกับที่การ์ดนับ
           จึงเลือกกล่องนั้นแทนการกรองซ้อน — ตัวนับบน pill คือหลักฐานว่ายอดตรงกัน */
        const kpi = MockKpi.fromUrl();
        if (kpi && this.FILTERS.some(f => f.key === kpi.def.taskBox)) this.state.filter = kpi.def.taskBox;

        if (this.state.id) this.state.filter = 'all';

        /* บาง persona ไม่มีงานในกล่องเริ่มต้น — เลื่อนไปกล่องแรกที่มีงาน
           ไม่งั้นหน้าจะขึ้นมาว่างเปล่าและดูเหมือนระบบพัง */
        if (!p.get('filter') && !p.get('kpi') && !this.state.id) {
            const f = this.FILTERS.find(x => x.fn().length);
            if (f) this.state.filter = f.key;
        }

        this.fillKinds();
        this.renderPills();
        this.renderList();
        const first = this.visible()[0];
        this.select(this.state.id || (first ? first.id : null));
    },

    current() { return this.state.id ? MockTasks.byId(this.state.id) : null; },

    fillKinds() {
        document.getElementById('fKind').insertAdjacentHTML('beforeend',
            TASK_KINDS.map(k => `<option value="${esc(k.key)}">${esc(k.label)}</option>`).join(''));
    },

    renderPills() {
        document.getElementById('pillTabs').innerHTML = this.FILTERS.map(f => `
            <button class="ds-pilltab ${f.key === this.state.filter ? 'active' : ''}"
                onclick="Tasks.setFilter('${f.key}')">
                ${esc(f.label)} <span class="tab-count">${f.fn().length}</span></button>`).join('');
    },

    setFilter(k) { this.state.filter = k; this.renderPills(); this.renderList(); refreshIcons(); },

    visible() {
        const f  = this.FILTERS.find(x => x.key === this.state.filter) || this.FILTERS[0];
        const kw = (document.getElementById('listSearch').value || '').trim().toLowerCase();
        const kind = document.getElementById('fKind').value;
        return f.fn().filter(t => {
            if (kind !== 'all' && t.kind !== kind) return false;
            if (kw && !(`${t.id} ${t.title} ${t.claim_id || ''} ${t.rule_id || ''}`).toLowerCase().includes(kw)) return false;
            return true;
        });
    },

    renderList() {
        const rows = this.visible();
        document.getElementById('listCount').textContent = rows.length + ' งาน';
        document.getElementById('listContainer').innerHTML = rows.length
            ? rows.map(t => `
                <div class="ds-list-card ${t.id === this.state.id ? 'active' : ''}"
                     onclick="Tasks.select('${esc(t.id)}')">
                    <div class="ds-list-card-top">
                        <span class="td-sub">${esc(t.id)}</span>
                        <span class="kbadge ${esc(MockTasks.statusBadge(t.status))}">${esc(MockTasks.statusLabel(t.status))}</span>
                    </div>
                    <div class="ds-list-card-name" style="font-size:12px">${esc(t.title)}</div>
                    <div class="ds-list-card-detail" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                        <span>${esc(MockTasks.kindLabel(t.kind))}</span>
                        <span>·</span>
                        <span>${esc(MockAdmin.userName(t.owner))}</span>
                        ${t.status === 'DONE' ? '' : MockTone.slaHtml(t.due_at)}
                    </div>
                </div>`).join('')
            : '<div class="ds-empty">ไม่มีงานในกล่องนี้</div>';
        refreshIcons();
    },

    toggleLeft() { document.getElementById('shell').classList.toggle('left-collapsed'); },

    select(id) {
        this.state.id = id;
        const t = this.current();
        document.getElementById('emptyState').style.display = t ? 'none' : '';
        document.getElementById('detailWrap').style.display = t ? '' : 'none';
        if (!t) { this.renderList(); return; }

        history.replaceState(null, '', 'claim-tasks.html?id=' + encodeURIComponent(id));
        MockSession.mountBanner('demoBanner');

        this.renderContext(t);
        this.renderTabBar();
        this.renderTab(t);
        this.renderList();
        refreshIcons();
    },

    renderContext(t) {
        document.getElementById('ctxAvatar').textContent = String(t.id).slice(-2);
        document.getElementById('ctxName').textContent   = t.title;
        document.getElementById('ctxChip').innerHTML =
            `<span class="kbadge ${esc(MockTasks.statusBadge(t.status))}">${esc(MockTasks.statusLabel(t.status))}</span>
             <span class="sip-chip ${esc((TASK_PRIORITY[t.priority] || {}).chip || 'sip-chip-muted')}">
                ความสำคัญ${esc((TASK_PRIORITY[t.priority] || {}).label || '')}</span>`;
        document.getElementById('ctxMeta').innerHTML = `
            <span>รหัสงาน: ${esc(t.id)}</span>
            <span>ประเภท: ${esc(MockTasks.kindLabel(t.kind))}</span>
            ${t.claim_id ? `<span>เคส: <a href="claim-case.html?id=${encodeURIComponent(t.claim_id)}">${esc(t.claim_id)}</a></span>` : ''}
            ${t.rule_id  ? `<span>กฎ: <a href="claim-rules.html?rule=${encodeURIComponent(t.rule_id)}">${esc(t.rule_id)}</a></span>` : ''}
            ${t.refer_id ? `<span>ส่งต่อ: <a href="refer-case.html?id=${encodeURIComponent(t.refer_id)}">${esc(t.refer_id)}</a></span>` : ''}
            <span>ผู้มอบหมาย: ${esc(MockAdmin.userName(t.assigner))}</span>
            <span>ผู้รับผิดชอบ: ${esc(MockAdmin.userName(t.owner))} (${esc(t.dept)})</span>
            <span>กำหนดเสร็จ: ${esc(MockFmt.dateTimeTH(t.due_at))}</span>`;

        const alert = document.getElementById('ctxAlert');
        const sla = MockTone.sla(t.due_at);
        if (t.status !== 'DONE' && sla !== 'ok') {
            alert.style.display = '';
            document.getElementById('ctxAlertText').textContent =
                sla === 'over'
                    ? `${MockFmt.countdown(t.due_at)}${t.escalated ? ' — ยกระดับอัตโนมัติแล้ว' : ''}`
                    : `ใกล้ครบกำหนด — ${MockFmt.countdown(t.due_at)}`;
        } else { alert.style.display = 'none'; }
    },

    renderTabBar() {
        document.getElementById('tabBar').innerHTML = this.TABS.map(t => `
            <button class="ds-tab ${t.key === this.state.tab ? 'active' : ''}"
                onclick="Tasks.switchTab('${t.key}')">
                <i data-lucide="${t.icon}" class="mi"></i> ${esc(t.label)}</button>`).join('');
    },

    switchTab(k) { this.state.tab = k; this.renderTabBar(); this.renderTab(this.current()); refreshIcons(); },

    renderTab(t) {
        const fn = { detail: () => this.tabDetail(t), check: () => this.tabCheck(t), approval: () => this.tabApproval(t) }[this.state.tab];
        document.getElementById('tabContent').innerHTML = fn ? fn() : '';
    },

    tabDetail(t) {
        const claim = t.claim_id ? MockClaims.byId(t.claim_id) : null;
        /* window.MockRefer อาจไม่มี ถ้าหน้าไหนไม่ได้โหลด mock-referrals.js */
        const refer = (t.refer_id && window.MockRefer) ? MockRefer.byId(t.refer_id) : null;
        return `
        <div class="cards-row">
            <div class="clinical-card">
                <div class="card-title"><i data-lucide="file-text" class="mi"></i> สิ่งที่ต้องทำ</div>
                <div style="font-size:13px;line-height:1.8;color:var(--text-secondary);white-space:pre-line">${esc(t.detail)}</div>
                ${claim ? `
                <div style="margin-top:12px">
                    <div class="ds-section-label">เคสที่เกี่ยวข้อง</div>
                    <div class="ds-block" style="cursor:pointer"
                         onclick="location.href='claim-case.html?id=${encodeURIComponent(claim.id)}'">
                        <strong>${esc(claim.id)}</strong> · ${esc(claim.patient)} · HN ${esc(claim.hn)}
                        · มูลค่าเสี่ยง ${esc(MockFmt.baht(claim.amount_at_risk))} บาท
                        ${MockClaims.predictedCodes(claim).map(k =>
                            `<span class="sip-chip sip-chip-danger">${esc(k)}</span>`).join(' ')}
                    </div>
                </div>` : ''}
                ${refer ? `
                <div style="margin-top:12px">
                    <div class="ds-section-label">รายการส่งต่อที่เกี่ยวข้อง</div>
                    <div class="ds-block" style="cursor:pointer"
                         onclick="location.href='refer-case.html?id=${encodeURIComponent(refer.id)}'">
                        <strong>${esc(refer.id)}</strong> · ${esc(refer.patient)} ·
                        ${esc(MockRefer.partnerLabel(refer))} ${esc(refer.partner_name)}
                        <div class="td-sub">วงเงิน ${esc(MockFmt.baht(refer.cap_amount))} บาท ·
                            ขอบเขต ${esc(MockRefer.scopeLabel(refer))} ·
                            หมดอายุ ${esc(MockFmt.dateTH(refer.expires_at))}</div>
                        ${MockRefer.flags(refer).map(f => `<span class="sip-chip ${
                            f.level === 'ERROR' ? 'sip-chip-danger' : f.level === 'WARNING' ? 'sip-chip-amber' : 'sip-chip-muted'
                        }" title="${esc(f.detail)}">${esc(f.code)}</span>`).join(' ')}
                    </div>
                </div>` : ''}
            </div>
            <div class="clinical-card">
                <div class="card-title"><i data-lucide="history" class="mi"></i> ไทม์ไลน์ของงาน</div>
                <div class="ds-timeline">${(t.timeline || []).map(e => `
                    <div class="ds-timeline-item ${esc(e.tone || '')}">
                        <strong>${esc(e.title)}</strong> โดย ${esc(MockAdmin.userName(e.by))}
                        ${e.note ? `<div class="td-sub">${esc(e.note)}</div>` : ''}
                        <span class="ds-timeline-time">${esc(MockFmt.dateTimeTH(e.at))}</span>
                    </div>`).join('')}</div>
                <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
                    <button class="btn btn-outline btn-sm" onclick="Tasks.openReassign()">
                        <i data-lucide="user-plus" class="icon-sm"></i> มอบหมายต่อ</button>
                    <button class="btn btn-outline btn-sm" onclick="Tasks.openEscalate()">
                        <i data-lucide="trending-up" class="icon-sm"></i> ยกระดับ</button>
                </div>
            </div>
        </div>`;
    },

    tabCheck(t) {
        const rule = t.rule_id ? MockRules.byId(t.rule_id) : null;
        return `
        <div class="section-card">
            <div class="section-header">
                <div class="section-title"><i data-lucide="list-checks" class="mi"></i> รายการที่ต้องตรวจ</div>
                <div class="section-actions">
                    <span class="ds-pane-count">${(t.checklist || []).filter(c => c.done).length}/${(t.checklist || []).length} เสร็จ</span>
                </div>
            </div>
            ${(t.checklist || []).length ? (t.checklist || []).map((c, i) => `
                <label class="sip-checkbox" style="display:flex;gap:8px;padding:7px 0;border-bottom:1px dashed var(--brand-border)">
                    <input type="checkbox" ${c.done ? 'checked' : ''} onchange="Tasks.toggleCheck(${i}, this)">
                    <span style="${c.done ? 'text-decoration:line-through;color:var(--text-muted)' : ''}">${esc(c.text)}</span>
                </label>`).join('')
              : '<div class="ds-empty-sm">งานนี้ยังไม่มี checklist</div>'}
            ${rule ? `
            <div class="ds-note" style="margin-top:12px">
                <i data-lucide="shield-check" class="icon-sm"></i>
                checklist ชุดนี้มาจากกฎ <a href="claim-rules.html?rule=${encodeURIComponent(rule.id)}">${esc(rule.id)} v${esc(rule.version)}</a>
                — ${esc(rule.name)}${rule.maps_to_nhso ? ` · ถ้าไม่ปิดจะได้รหัส ${esc(rule.maps_to_nhso)} จาก สปสช.` : ''}
            </div>` : ''}
        </div>

        <div class="section-card">
            <div class="section-title" style="margin-bottom:10px"><i data-lucide="message-square" class="mi"></i> ความเห็นและการดำเนินการ</div>
            <div class="sip-field">
                <label class="sip-label">ความเห็น / สิ่งที่แก้ไข</label>
                <textarea class="sip-textarea" id="tComment" rows="4"
                    placeholder="บันทึกสิ่งที่ตรวจสอบ แก้ไข หรือเหตุผลที่ตีกลับ..."></textarea>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-danger" onclick="Tasks.act('RETURNED')">
                    <i data-lucide="corner-up-left" class="icon-sm"></i> ตีกลับ</button>
                <button class="btn btn-save" onclick="Tasks.act('PROGRESS')">
                    <i data-lucide="save" class="icon-sm"></i> บันทึกความคืบหน้า</button>
                <button class="btn btn-save-send" onclick="Tasks.act('DONE')">
                    <i data-lucide="check-circle-2" class="icon-sm"></i> ปิดงาน / ส่งต่อผู้อนุมัติ</button>
            </div>
        </div>`;
    },

    /* ══════════ ของที่ผู้อนุมัติต้องอ่านก่อนกดอนุมัติ (คำขอส่งต่อ) ══════════ */

    /** เจ้าของไข้ / ผู้เขียนใบส่งต่อ — ติดป้ายเมื่อเป็นคนละคน จะได้ไม่อ่านข้าม */
    _doctors(r) {
        const d = MockRefer.doctorMeta(r);
        if (!d.attending && !d.writer) return '<span class="td-sub">ยังไม่ระบุแพทย์</span>';
        return `เจ้าของไข้ <strong>${esc(d.attending || '—')}</strong>
            ${d.sameCoin
                ? '<span class="td-sub">· เขียนใบส่งต่อเอง</span>'
                : `<span class="td-sub">· เขียนใบส่งต่อโดย</span> <strong>${esc(d.writer || '—')}</strong>
                   <span class="sip-chip sip-chip-amber" title="ผู้เขียนไม่ใช่เจ้าของไข้ — ตรวจว่าได้ปรึกษาเจ้าของไข้แล้ว">คนละคน</span>`}
            ${d.dept ? `<div class="td-sub">${esc(d.dept)}</div>` : ''}`;
    },

    /** สรุปทางคลินิกเต็ม ๆ — หัวข้อที่ยังไม่เขียนก็แสดง เพื่อให้ตีกลับได้ตรงจุด */
    _clinicalReview(r) {
        const parts   = MockRefer.reviewParts(r);
        const missing = MockRefer.reviewMissing(r);
        if (!parts.some(p => p.text) && !missing.length) return '';

        return `
        <div class="section-card">
            <div class="section-header">
                <div class="section-title"><i data-lucide="notebook-pen" class="mi"></i>
                    สรุปทางคลินิกจากแพทย์</div>
                <div class="section-actions">
                    <span class="ds-pane-count" style="color:${missing.length
                        ? 'var(--status-danger)' : 'var(--status-success)'}">
                        ${parts.filter(p => p.text).length}/${parts.length} หัวข้อ</span>
                </div>
            </div>
            ${missing.length ? `
            <div class="sip-banner sip-banner-warning" style="margin-bottom:12px">
                <i data-lucide="alert-triangle" class="icon-sm"></i>
                <span>ยังขาด ${missing.length} หัวข้อที่จำเป็น — <strong>${esc(
                    missing.map(m => m.label).join(' · '))}</strong><br>
                <span class="td-sub">ถ้าข้อมูลไม่พอตัดสิน ให้ตีกลับพร้อมระบุว่าขาดอะไร
                แทนการอนุมัติไปก่อน</span></span>
            </div>` : ''}
            ${parts.map(p => `
                <div style="padding:8px 0;border-bottom:1px dashed var(--brand-border)">
                    <div class="ds-section-label" style="margin:0 0 4px">
                        ${esc(p.label)}
                        ${p.text ? '' : p.required
                            ? '<span class="sip-chip sip-chip-danger">ยังไม่เขียน</span>'
                            : '<span class="sip-chip sip-chip-muted">ไม่บังคับ</span>'}
                    </div>
                    <div style="font-size:12.5px;line-height:1.75;${p.text ? '' : 'color:var(--text-muted)'}">
                        ${p.text ? esc(p.text) : '—'}</div>
                </div>`).join('')}
            ${this._hisNote(r)}
            ${r.refer_note ? `
            <div class="ds-note" style="margin-top:10px">
                <i data-lucide="message-square" class="icon-sm"></i>
                บันทึกเพิ่มเติมถึงผู้อนุมัติ: ${esc(r.refer_note)}
            </div>` : ''}
        </div>`;
    },

    /** ที่มาของข้อความ — ข้อความที่ดึงจาก HIS ยังไม่ผ่านการเรียบเรียงโดยแพทย์เสมอไป */
    _hisNote(r) {
        const src = MockRefer.reviewSources(r);
        if (!src.length) return '';
        return `
            <div class="ds-note" style="margin-top:10px">
                <i data-lucide="database" class="icon-sm"></i>
                <span>${src.length} หมวดในสรุปนี้ดึงจากระบบ HIS —
                <strong>${esc(src.map(s => s.label).join(' · '))}</strong><br>
                <span class="td-sub">${esc((window.MockHIS && MockHIS.SIMULATED_NOTE) || '')}</span></span>
            </div>`;
    },

    /** เจ้าหน้าที่ผู้ตรวจทาน = maker — ไม่มีลายเซ็นนี้ คำขอยังไม่ควรมาถึงโต๊ะอนุมัติ */
    _reviewerBlock(r) {
        const rv = MockRefer.reviewer(r);
        return `
        <div class="section-card">
            <div class="section-title" style="margin-bottom:10px">
                <i data-lucide="user-check" class="mi"></i> การตรวจทานโดยเจ้าหน้าที่</div>
            ${rv ? `
            <table class="ds-table-grid"><tbody>
                <tr><td class="l" style="width:26%">ผู้ตรวจทาน</td>
                    <td class="l"><strong>${esc(rv.name)}</strong>
                        <span class="td-sub">· ${esc((MockAdmin.user(rv.id) || {}).dept || '')}</span></td></tr>
                <tr><td class="l">เวลาที่ตรวจทาน</td>
                    <td class="l">${esc(MockFmt.dateTimeTH(rv.at))}</td></tr>
                <tr><td class="l">ความเห็น</td>
                    <td class="l">${rv.note ? esc(rv.note)
                        : '<span class="td-sub">ไม่ได้บันทึกความเห็นไว้</span>'}</td></tr>
            </tbody></table>
            <div class="ds-note" style="margin-top:10px">
                <i data-lucide="shield-check" class="icon-sm"></i>
                ผู้ตรวจทานคือผู้เสนอ (maker) — คุณในฐานะผู้อนุมัติ (checker) ต้องเป็นคนละคนเสมอ (BR-05)
            </div>`
            : `<div class="sip-banner sip-banner-danger">
                <i data-lucide="user-x" class="icon-sm"></i>
                <span><strong>ยังไม่มีเจ้าหน้าที่ตรวจทานคำขอนี้</strong> —
                คำขอมาถึงโต๊ะอนุมัติโดยข้ามขั้นตรวจทาน<br>
                <span class="td-sub">ควรตีกลับให้ตรวจทานก่อน หรืออนุมัติพร้อมระบุเหตุผล
                ที่ยอมข้าม ซึ่งจะถูกบันทึกลง Audit Trail</span></span>
            </div>`}
        </div>`;
    },

    tabApproval(t) {
        const isAuthor  = t.assigner === MockSession.userId();
        const isOwner   = t.owner === MockSession.userId();
        const canApprove = isOwner && !isAuthor;   /* ประตูนี้ไม่ผูกกับ kind จึงรองรับชนิดใหม่ได้เอง */
        const refer = (t.refer_id && window.MockRefer) ? MockRefer.byId(t.refer_id) : null;
        const isExec = t.kind === 'APPROVE_REFER_EXEC';

        return `
        ${refer && (t.kind === 'APPROVE_REFER' || isExec) ? `
        ${isExec ? `
        <div class="sip-banner sip-banner-warning" style="margin-bottom:12px">
            <i data-lucide="shield-check" class="icon-sm"></i>
            <span><strong>เรื่องนี้มาถึงโต๊ะผู้บริหารเพราะวงเงินเกินเกณฑ์</strong> —
            ขอ ${esc(MockFmt.baht(refer.cap_amount))} บาท เกินเกณฑ์
            ${esc(MockFmt.baht(REFER_APPROVAL.EXEC_THRESHOLD))} บาท อยู่
            <strong>${esc(MockFmt.baht(MockRefer.execExcess(refer)))} บาท</strong><br>
            <span class="td-sub">ผ่านการอนุมัติชั้นเจ้าหน้าที่แล้วโดย
            ${esc(refer.ops_approver ? MockAdmin.userName(refer.ops_approver) : '—')}
            ${refer.ops_approve_note ? '· ' + esc(refer.ops_approve_note) : ''}</span></span>
        </div>` : ''}
        <div class="section-card">
            <div class="section-title" style="margin-bottom:10px">
                <i data-lucide="ambulance" class="mi"></i> สรุปคำขอส่งต่อที่ต้องตัดสิน</div>
            <table class="ds-table-grid"><tbody>
                <tr><td class="l" style="width:26%">ผู้ป่วย</td><td class="l">${esc(refer.patient)} ·
                    HN ${esc(refer.hn)} · ${esc(refer.age)} ปี · สิทธิ ${esc(refer.fund)}</td></tr>
                <tr><td class="l">การวินิจฉัย</td><td class="l">${(refer.dx || []).map(d =>
                    `${esc(d.code)} ${esc(d.name)}`).join(' · ') || '—'}</td></tr>
                <tr><td class="l">${esc(MockRefer.partnerLabel(refer))}</td><td class="l">${esc(refer.partner_name)}
                    <span class="td-sub">· ${esc(refer.partner_level)} · ${esc(refer.partner_province)}</span></td></tr>
                <tr><td class="l">แพทย์ผู้รับผิดชอบ</td><td class="l">${this._doctors(refer)}</td></tr>
                <tr><td class="l">เหตุผลการส่งต่อ</td><td class="l">${esc(MockRefer.reasonMeta(refer).label)}</td></tr>
                <tr><td class="l">ขอบเขตที่ขอ</td><td class="l">${esc(MockRefer.scopeLabel(refer))}
                    <span class="td-sub">— ${esc(refer.scope_note || '')}</span></td></tr>
                <tr><td class="l">วงเงินที่ขอ</td><td class="l"><strong>${esc(MockFmt.baht(refer.cap_amount))} บาท</strong>
                    <span class="td-sub">· มูลค่าประเมิน ${esc(MockFmt.baht(refer.est_amount))} บาท ·
                    ไม่เกิน ${esc(refer.visit_limit)} ครั้ง</span></td></tr>
                <tr><td class="l">ธงที่ตรวจพบ</td><td class="l">${MockRefer.flags(refer).length
                    ? MockRefer.flags(refer).map(f => `<span class="sip-chip ${
                        f.level === 'ERROR' ? 'sip-chip-danger' : f.level === 'WARNING' ? 'sip-chip-amber' : 'sip-chip-muted'
                      }" title="${esc(f.detail)}">${esc(f.label)}</span>`).join(' ')
                    : '<span class="sip-chip sip-chip-success">ไม่พบประเด็น</span>'}</td></tr>
            </tbody></table>
            <div class="ds-note" style="margin-top:10px">
                <i data-lucide="info" class="icon-sm"></i>
                เมื่ออนุมัติ ระบบจะออกเลขที่ใบส่งตัวและเลขอนุมัติให้อัตโนมัติ พร้อมกำหนดวันหมดอายุ
                — พิมพ์ใบส่งตัวได้ทันทีจากหน้ารายละเอียดการส่งต่อ
            </div>
        </div>

        ${this._clinicalReview(refer)}
        ${this._reviewerBlock(refer)}` : ''}
        ${isAuthor && isOwner ? `
        <div class="sip-banner sip-banner-danger" style="margin-bottom:12px">
            <i data-lucide="user-x" class="icon-sm"></i>
            <span><strong>คุณเป็นทั้งผู้เสนอและผู้รับงานนี้</strong> — ตามหลัก Maker–Checker (BR-05)
            ต้องมอบหมายให้ผู้อื่นเป็นผู้อนุมัติก่อน</span>
        </div>` : canApprove ? `
        <div class="sip-banner sip-banner-info" style="margin-bottom:12px">
            <i data-lucide="user-check" class="icon-sm"></i>
            <span>คุณอยู่ในบทบาท <strong>${esc(MockSession.roleLabel())}</strong>
            และไม่ใช่ผู้เสนอ — จึงอนุมัติงานนี้ได้</span>
        </div>` : ''}

        <div class="section-card">
            <div class="section-title" style="margin-bottom:10px">
                <i data-lucide="shield-alert" class="mi"></i> ประวัติการ Override (BR-04)</div>
            ${(t.overrides || []).length ? `
            <div class="table-responsive"><table class="data-table compact">
                <thead><tr><th style="width:1%">เวลา</th><th style="width:1%">ผู้กระทำ</th>
                    <th style="width:1%">บทบาท</th><th>เหตุผล</th>
                    <th style="width:1%">หลักฐาน</th><th style="width:1%">ผู้อนุมัติ</th></tr></thead>
                <tbody>${t.overrides.map(o => `<tr>
                    <td class="td-sub" style="white-space:nowrap">${esc(MockFmt.dateTimeTH(o.at))}</td>
                    <td class="td-sub">${esc(MockAdmin.userName(o.by))}</td>
                    <td class="td-sub">${esc(o.role)}</td>
                    <td>${esc(o.reason)}</td>
                    <td class="td-sub">${esc(o.evidence)}</td>
                    <td class="td-sub">${esc(MockAdmin.userName(o.approver))}</td>
                </tr>`).join('')}</tbody>
            </table></div>`
            : '<div class="ds-empty-sm">ยังไม่มีการ Override สำหรับงานนี้</div>'}
            <div class="ds-note" style="margin-top:10px">
                <i data-lucide="lock" class="icon-sm"></i>
                รายการ Override แก้ไขหรือลบจากหน้าจอปกติไม่ได้ — เก็บอยู่ใน Audit Trail
                พร้อม Actor · Time · Action · Before/After
            </div>
        </div>

        <div class="section-card">
            <div class="section-title" style="margin-bottom:10px"><i data-lucide="gavel" class="mi"></i> การตัดสิน</div>
            <div class="sip-field">
                <label class="sip-label">เหตุผลประกอบการอนุมัติ / ปฏิเสธ *</label>
                <textarea class="sip-textarea" id="aReason" rows="3"
                    placeholder="ระบุเหตุผลที่ผู้ตรวจสอบย้อนหลังจะเข้าใจได้..."></textarea>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-danger" ${canApprove ? '' : 'disabled'} onclick="Tasks.decide(false)">
                    <i data-lucide="x-circle" class="icon-sm"></i> ปฏิเสธ</button>
                <button class="btn btn-save-send" ${canApprove ? '' : 'disabled'} onclick="Tasks.decide(true)">
                    <i data-lucide="check-circle-2" class="icon-sm"></i> อนุมัติ</button>
            </div>
            ${!canApprove ? `<div class="td-sub" style="margin-top:8px">
                ปุ่มถูกปิดเพราะงานนี้ไม่ได้มอบหมายให้คุณอนุมัติ หรือคุณเป็นผู้เสนอเอง
                — สลับบทบาทจากเมนูตั้งค่าเพื่อดูมุมของผู้อนุมัติ</div>` : ''}
        </div>`;
    },

    /* ══════════ การกระทำ ══════════ */

    toggleCheck(i, el) {
        const t = this.current();
        const list = (t.checklist || []).map((c, n) => n === i ? { ...c, done: el.checked } : c);
        MockDB.patch('tasks', t.id, { checklist: list });
        this.select(t.id);
    },

    act(status) {
        const t = this.current();
        const note = document.getElementById('tComment').value.trim();
        if (!note) { showToast('กรุณาบันทึกความเห็นก่อน', 'warning'); return; }

        const tone = status === 'DONE' ? 'success' : status === 'RETURNED' ? 'danger' : '';
        const title = status === 'DONE' ? 'ปิดงาน' : status === 'RETURNED' ? 'ตีกลับ' : 'บันทึกความคืบหน้า';

        MockDB.patch('tasks', t.id, {
            status,
            timeline: [...(t.timeline || []), {
                at: '2569-08-06T09:00', tone, title, by: MockSession.userId(), note }],
        });
        showToast(title + 'แล้ว');
        this.renderPills();
        this.select(t.id);
    },

    async decide(approve) {
        const t = this.current();
        const reason = document.getElementById('aReason').value.trim();
        if (!reason) { showToast('ต้องระบุเหตุผลประกอบการตัดสิน (BR-04)', 'warning'); return; }

        const ok = await Drawer.confirm({
            title: approve ? 'อนุมัติงานนี้?' : 'ปฏิเสธงานนี้?',
            message: 'ระบบจะบันทึกผู้ตัดสิน เวลา และเหตุผลลง Audit Trail ซึ่งลบไม่ได้',
            lines: [`${t.id} — ${t.title}`, `ผู้ตัดสิน: ${MockSession.user().full_name} (${MockSession.roleLabel()})`],
            confirmText: approve ? 'อนุมัติ' : 'ปฏิเสธ', danger: !approve,
        });
        if (!ok) return;

        MockDB.patch('tasks', t.id, {
            status: approve ? 'DONE' : 'RETURNED',
            overrides: [...(t.overrides || []), {
                at: '2569-08-06T09:00', by: MockSession.userId(), role: MockSession.roleLabel(),
                reason, evidence: 'บันทึกจากหน้าอนุมัติ', approver: MockSession.userId() }],
            timeline: [...(t.timeline || []), {
                at: '2569-08-06T09:00', tone: approve ? 'success' : 'danger',
                title: approve ? 'อนุมัติ' : 'ปฏิเสธ', by: MockSession.userId(), note: reason }],
        });

        /* ถ้าเป็นการอนุมัติกฎ ให้กฎเปลี่ยนสถานะตามไปด้วย */
        if (approve && t.kind === 'APPROVE_RULE' && t.rule_id) {
            MockDB.patch('rules', t.rule_id, { status: 'ACTIVE', approver: MockSession.userId() });
        }

        /* งานฝั่งส่งต่อ — logic การออกเลขอนุมัติ/ใบส่งตัวอยู่ใน MockRefer ทั้งหมด */
        if (t.refer_id && window.MockRefer) MockRefer.applyTaskDecision(t, approve, reason);

        showToast(approve ? 'อนุมัติแล้ว — บันทึกลง Audit Trail' : 'ปฏิเสธและตีกลับแล้ว');
        this.renderPills();
        this.select(t.id);
    },

    openReassign() {
        const t = this.current();
        const users = MockAdmin.users().filter(u => u.active).map(u =>
            `<option value="${esc(u.id)}" ${u.id === t.owner ? 'selected' : ''}>${esc(u.name)} — ${esc(u.dept)}</option>`).join('');
        Drawer.open({
            title: 'มอบหมายต่อ — ' + t.id,
            contentHtml: `
                <div class="sip-field">
                    <label class="sip-label">ผู้รับผิดชอบใหม่ *</label>
                    <select class="sip-select" id="rOwner">${users}</select>
                </div>
                <div class="sip-field">
                    <label class="sip-label">เหตุผลที่มอบหมายต่อ *</label>
                    <textarea class="sip-textarea" id="rReason" rows="3"></textarea>
                </div>
                <div class="ds-note"><i data-lucide="info" class="icon-sm"></i>
                    การมอบหมายต่อไม่รีเซ็ต SLA — นาฬิกาเดินต่อจากเดิม</div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                         <button class="btn btn-save" onclick="Tasks.saveReassign()">มอบหมายต่อ</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    saveReassign() {
        const t = this.current();
        const who = document.getElementById('rOwner').value;
        const reason = document.getElementById('rReason').value.trim();
        if (!reason) { showToast('กรุณาระบุเหตุผล', 'warning'); return; }
        MockDB.patch('tasks', t.id, {
            owner: who, dept: (MockAdmin.user(who) || {}).dept || t.dept,
            timeline: [...(t.timeline || []), { at: '2569-08-06T09:00', tone: 'info',
                title: 'มอบหมายต่อ', by: MockSession.userId(),
                note: `ให้ ${MockAdmin.userName(who)} · ${reason}` }],
        });
        Drawer.close();
        showToast('มอบหมายต่อให้ ' + MockAdmin.userName(who) + ' แล้ว');
        this.renderPills();
        this.select(t.id);
    },

    openEscalate() {
        const t = this.current();
        Drawer.open({
            title: 'ยกระดับงาน — ' + t.id,
            contentHtml: `
                <div class="sip-banner sip-banner-warning" style="margin-bottom:14px">
                    <i data-lucide="trending-up" class="icon-sm"></i>
                    <span>ใช้เมื่องานติดขัดเกินระดับที่ผู้รับผิดชอบแก้ได้เอง
                    — ระบบจะแจ้งผู้บังคับบัญชาตามสายงานที่ตั้งไว้</span>
                </div>
                <div class="sip-field">
                    <label class="sip-label">ระดับที่ยกไป</label>
                    <select class="sip-select" id="eLevel">
                        <option>หัวหน้าหน่วยงานที่รับผิดชอบ</option>
                        <option>หัวหน้าศูนย์จัดเก็บรายได้</option>
                        <option>ผู้อำนวยการ / ผู้บริหารที่กำกับ</option>
                    </select>
                </div>
                <div class="sip-field">
                    <label class="sip-label">เหตุผล *</label>
                    <textarea class="sip-textarea" id="eReason" rows="3"
                        placeholder="ติดขัดเรื่องอะไร ต้องการการตัดสินใจอะไร..."></textarea>
                </div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                         <button class="btn btn-navy" onclick="Tasks.saveEscalate()">ยกระดับ</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    saveEscalate() {
        const t = this.current();
        const level = document.getElementById('eLevel').value;
        const reason = document.getElementById('eReason').value.trim();
        if (!reason) { showToast('กรุณาระบุเหตุผล', 'warning'); return; }
        MockDB.patch('tasks', t.id, {
            escalated: true,
            timeline: [...(t.timeline || []), { at: '2569-08-06T09:00', tone: 'warning',
                title: 'ยกระดับงาน', by: MockSession.userId(), note: `${level} · ${reason}` }],
        });
        Drawer.close();
        showToast('ยกระดับไปยัง ' + level + ' แล้ว');
        this.select(t.id);
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.Tasks = Tasks;
document.addEventListener('DOMContentLoaded', () => Tasks.init());
