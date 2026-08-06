/* ────────────────────────────────────────────────────────
   รายละเอียดการส่งต่อผู้ป่วย (Referral Case Detail)

   สิ่งที่หน้านี้ต้องพิสูจน์
     • ใบส่งตัว เลขอนุมัติ ขอบเขต และวงเงิน ถูกตรวจ "ก่อน" เกิดภาระผูกพัน
     • ทุกธงย้อนกลับได้ถึงกฎ + ข้อมูลที่ใช้ตัดสิน (BR-03)
     • ใบเรียกเก็บที่เกินขอบเขตถูกแยกออกได้รายบรรทัด ไม่ใช่จ่ายทั้งใบ
   ──────────────────────────────────────────────────────── */

const ReferCase = {

    state: { id: null, filter: 'all', tab: 'overview' },

    TAB_KEYS: ['overview', 'check', 'evidence', 'docs', 'money', 'timeline'],
    TAB_MAP: { overview: 'tabOverview', check: 'tabCheck', evidence: 'tabEvidence',
               docs: 'tabDocs', money: 'tabMoney', timeline: 'tabTimeline' },

    init() {
        const p = new URLSearchParams(location.search);
        this.state.id = p.get('id');
        if (p.get('filter')) this.state.filter = p.get('filter');
        if (p.get('dir'))    document.getElementById('fDir').value = p.get('dir');

        /* เข้ามาจาก claim-case.html?claim=CLM-xxxx — หารายการส่งต่อที่ผูกกับเคสนั้น */
        if (!this.state.id && p.get('claim')) {
            const hit = MockRefer.all().find(r => r.claim_id === p.get('claim'));
            if (hit) this.state.id = hit.id;
        }

        this.renderPills();
        this.renderList();

        const first = this.visible()[0];
        this.select(this.state.id || (first ? first.id : null));
    },

    reload() { this.select(this.state.id); showToast('ยกเลิกการแก้ไขแล้ว', 'info'); },

    current() { return this.state.id ? MockRefer.byId(this.state.id) : null; },

    /* ══════════ คอลัมน์ซ้าย ══════════ */

    FILTERS: [
        { key: 'all',    label: 'ทั้งหมด' },
        { key: 'action', label: 'ต้องดำเนินการ' },
        { key: 'appr',   label: 'รออนุมัติ' },
        { key: 'over',   label: 'เกินกำหนด' },
        { key: 'mine',   label: 'ของฉัน' },
    ],

    matchFilter(r, key) {
        if (key === 'all')    return true;
        if (key === 'mine')   return r.owner === MockSession.userId();
        if (key === 'action') return MockRefer.hasError(r);
        if (key === 'appr')   return r.status === 'WAIT_APPR' || r.status === 'DOC_CHECK';
        if (key === 'over')   return !!r.due_at && MockTone.sla(r.due_at) === 'over';
        return true;
    },

    renderPills() {
        document.getElementById('pillTabs').innerHTML = this.FILTERS.map(f => {
            const n = MockRefer.all().filter(r => this.matchFilter(r, f.key)).length;
            return `<button class="ds-pilltab ${f.key === this.state.filter ? 'active' : ''}"
                        onclick="ReferCase.setFilter('${f.key}')">
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
        const kw  = (document.getElementById('listSearch').value || '').trim().toLowerCase();
        const dir = document.getElementById('fDir').value;
        return MockRefer.all().filter(r => {
            if (!this.matchFilter(r, this.state.filter)) return false;
            if (dir !== 'all' && r.direction !== dir) return false;
            if (kw && !(`${r.id} ${r.hn} ${r.patient} ${r.letter_no || ''} ${r.partner_name}`)
                        .toLowerCase().includes(kw)) return false;
            return true;
        });
    },

    renderList() {
        const rows = this.visible();
        document.getElementById('listCount').textContent = rows.length + ' รายการ';
        document.getElementById('listContainer').innerHTML = rows.length
            ? rows.map(r => {
                const err = MockRefer.errorFlags(r).length;
                return `
                <div class="ds-list-card ${r.id === this.state.id ? 'active' : ''}"
                     onclick="ReferCase.select('${esc(r.id)}')">
                    <div class="ds-list-card-top">
                        <span class="td-sub">${esc(r.id)}</span>
                        <span class="sip-chip ${r.direction === 'OUT' ? 'sip-chip-amber' : 'sip-chip-active'}">${
                            esc(MockRefer.dirLabel(r))}</span>
                    </div>
                    <div class="ds-list-card-name">${esc(r.patient)}</div>
                    <div class="ds-list-card-detail">
                        ${esc(r.partner_name)} · ${esc(MockFmt.dateTH(r.refer_date))} ·
                        ${esc(MockFmt.baht(r.cap_amount))} บาท
                        ${err ? `<span class="sip-chip sip-chip-danger">${err} ปัญหา</span>` : ''}
                    </div>
                </div>`;
            }).join('')
            : '<div class="ds-empty">ไม่พบรายการตามเงื่อนไข</div>';
        refreshIcons();
    },

    toggleLeft() { document.getElementById('shell').classList.toggle('left-collapsed'); },

    /* ══════════ เลือกรายการ ══════════ */

    select(id) {
        this.state.id = id;
        const r = this.current();

        document.getElementById('emptyState').style.display = r ? 'none' : '';
        document.getElementById('detailWrap').style.display = r ? '' : 'none';
        if (!r) { this.renderList(); return; }

        history.replaceState(null, '', 'refer-case.html?id=' + encodeURIComponent(id));

        MockSession.mountBanner('demoBanner');
        this.renderContext(r);
        this.renderOverview(r);
        this.renderCheck(r);
        this.renderEvidence(r);
        this.renderDocs(r);
        this.renderMoney(r);
        this.renderTimeline(r);
        this.renderActions(r);
        this.renderList();
        refreshIcons();
    },

    renderContext(r) {
        document.getElementById('ctxAvatar').textContent =
            r.patient.replace(/^(นาย|นาง|นางสาว|ด\.ช\.|ด\.ญ\.)/, '').trim().charAt(0);
        document.getElementById('ctxName').textContent = r.patient;
        document.getElementById('ctxChip').innerHTML =
            `${MockRefer.statusHtml(r)}
             <span class="sip-chip ${r.direction === 'OUT' ? 'sip-chip-amber' : 'sip-chip-active'}"
                   title="${esc(MockRefer.dirMeta(r.direction).sub)}">${esc(MockRefer.dirLabel(r))}</span>`;
        document.getElementById('ctxMeta').innerHTML = `
            <span>รหัส: ${esc(r.id)}</span>
            <span>HN ${esc(r.hn)}${r.an ? ' · AN ' + esc(r.an) : ''}</span>
            <span>${esc(MockRefer.partnerLabel(r))}: ${esc(r.partner_name)}</span>
            <span>วันที่ส่งต่อ: ${esc(MockFmt.dateTH(r.refer_date))}</span>
            <span>วงเงิน: ${esc(MockFmt.baht(r.cap_amount))} บาท</span>
            ${r.claim_id ? `<span>เคลม: <a href="claim-case.html?id=${encodeURIComponent(r.claim_id)}">${esc(r.claim_id)}</a></span>` : ''}`;

        const errs  = MockRefer.errorFlags(r);
        const alert = document.getElementById('ctxAlert');
        if (errs.length) {
            alert.style.display = '';
            document.getElementById('ctxAlertLabel').textContent = 'ใบส่งตัวมีปัญหา';
            document.getElementById('ctxAlertText').textContent = errs.map(f => f.label).join(' · ');
        } else {
            alert.style.display = 'none';
        }

        const badge = document.getElementById('flagBadge');
        badge.style.display = errs.length ? '' : 'none';
        badge.textContent   = errs.length;
    },

    showAlert() { this.switchTab('check'); },

    switchTab(key, btn) {
        this.state.tab = key;
        document.querySelectorAll('.ds-tab').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        else document.querySelectorAll('.ds-tab')[this.TAB_KEYS.indexOf(key)].classList.add('active');

        document.querySelectorAll('.ds-tab-content').forEach(el => el.classList.remove('active'));
        document.getElementById(this.TAB_MAP[key]).classList.add('active');
        refreshIcons();
    },

    _kv(o) {
        return Object.entries(o).map(([k, v]) =>
            `<div style="display:flex;justify-content:space-between;gap:12px;padding:4px 0;
                 border-bottom:1px dashed var(--brand-border);font-size:12px">
                <span style="color:var(--text-muted)">${esc(k)}</span>
                <strong style="text-align:right">${v}</strong></div>`).join('');
    },

    /* ══════════ แท็บ 1 — ภาพรวม ══════════ */

    renderOverview(r) {
        /* ความพร้อมตามจ่าย 5 ขั้น — derive จาก MockRefer.readiness() ไม่ hardcode */
        let hitActive = false;
        const stepper = MockRefer.readiness(r).map(s => {
            if (s.ok) return `<span class="ds-step completed"><i data-lucide="check" class="icon-sm"></i> ${esc(s.label)}</span>`;
            if (!hitActive) { hitActive = true; return `<span class="ds-step active">${esc(s.label)}</span>`; }
            return `<span class="ds-step">${esc(s.label)}</span>`;
        }).join('');

        const dxHtml = (r.dx || []).map(d =>
            `<span class="sip-chip sip-chip-muted" title="${esc(d.name)}">${esc(d.code)} ${esc(d.type)}</span>`).join(' ') || '—';

        /* หัตถการที่ขอ vs ที่ทำจริง — ส่วนต่างคือที่มาของธง REF-SCOPE */
        const planned = new Set((r.proc_planned || []).map(p => p.code));
        const procHtml = (r.proc_actual || []).length
            ? (r.proc_actual || []).map(p => `<div style="font-size:12px;padding:2px 0${
                planned.has(p.code) ? '' : ';color:var(--status-danger);font-weight:600'}">
                ${esc(p.code)} ${esc(p.name)}
                ${planned.has(p.code) ? '' : ' — นอกขอบเขตที่อนุมัติ'}</div>`).join('')
            : '<span class="td-sub">ยังไม่มีการให้บริการ</span>';

        const billed = MockRefer.sumBilled(r);
        const over   = r.cap_amount && billed > r.cap_amount;

        document.getElementById('tabOverview').innerHTML = `
            <div class="cards-row">
                <div class="clinical-card">
                    <div class="card-title"><i data-lucide="user" class="mi"></i> ผู้ป่วยและสิทธิ</div>
                    ${this._kv({
                        'ชื่อ-สกุล': esc(r.patient), 'HN': esc(r.hn), 'AN': esc(r.an || '—'),
                        'อายุ / เพศ': `${esc(r.age)} ปี · ${r.gender === 'F' ? 'หญิง' : 'ชาย'}`,
                        'เลขบัตรประชาชน': esc(r.nid_masked || '—'),
                        'กองทุน / เลขที่สิทธิ': `${esc(r.fund)} · ${esc(r.right_no || '—')}`,
                    })}
                </div>

                <div class="clinical-card">
                    <div class="card-title"><i data-lucide="ambulance" class="mi"></i> การส่งต่อ</div>
                    ${this._kv({
                        [MockRefer.partnerLabel(r)]: esc(r.partner_name),
                        'ระดับ / จังหวัด': `${esc(r.partner_level)} · ${esc(r.partner_province)}`,
                        'เหตุผล': `<span class="sip-chip ${esc(MockRefer.reasonMeta(r).chip)}">${esc(MockRefer.reasonMeta(r).label)}</span>`,
                        'ความเร่งด่วน': esc((REFER_URGENCY[r.urgency] || {}).label || r.urgency),
                        'แพทย์ผู้ส่งต่อ': esc(r.doctor),
                        'การวินิจฉัย': dxHtml,
                    })}
                    <div class="ds-section-label" style="margin-top:10px">หัตถการที่ทำจริง</div>
                    ${procHtml}
                </div>
            </div>

            <div class="cards-row" style="margin-top:14px">
                <div class="clinical-card">
                    <div class="card-title"><i data-lucide="file-check" class="mi"></i> ใบส่งตัวและการอนุมัติ</div>
                    ${this._kv({
                        'เลขที่ใบส่งตัว': r.letter_no ? esc(r.letter_no)
                            : '<span class="sip-chip sip-chip-danger">ยังไม่ออกใบส่งตัว</span>',
                        'เลขอนุมัติ': r.auth_no ? esc(r.auth_no)
                            : '<span class="sip-chip sip-chip-danger">ไม่มีเลขอนุมัติ</span>',
                        'ประเภทเลข': esc(r.auth_type === 'APPROVE_CODE' ? 'Approve Code (OFC)'
                            : r.auth_type === 'CLOSE_RIGHT' ? 'เลขปิดสิทธิ (UCS)'
                            : r.auth_type === 'PREAUTH' ? 'Pre-authorization' : '—'),
                        'ผู้ออกเลข': esc(r.auth_source || '—'),
                        'วันที่ออก': esc(MockFmt.dateTH(r.issued_at)),
                        'วันหมดอายุ': r.expires_at
                            ? `${esc(MockFmt.dateTH(r.expires_at))} ${MockTone.slaHtml(r.expires_at)}` : '—',
                        'ขอบเขตที่อนุมัติ': esc(MockRefer.scopeLabel(r)),
                        'รายละเอียดขอบเขต': esc(r.scope_note || '—'),
                        'จำนวนครั้ง': `${esc(r.visit_used)} / ${esc(r.visit_limit)} ครั้ง` +
                            (r.visit_used > r.visit_limit ? ' <span class="sip-chip sip-chip-danger">เกินโควตา</span>' : ''),
                        'ผู้อนุมัติ': esc(r.approver || '—'),
                    })}
                </div>

                <div class="clinical-card">
                    <div class="card-title"><i data-lucide="wallet" class="mi"></i> สถานะการเงิน</div>
                    ${this._kv({
                        'วงเงินที่อนุมัติ': esc(MockFmt.baht(r.cap_amount)) + ' บาท',
                        'มูลค่าที่ประเมินไว้': esc(MockFmt.baht(r.est_amount)) + ' บาท',
                        'ยอดที่ถูกเรียกเก็บ': billed
                            ? `<span style="${over ? 'color:var(--status-danger)' : ''}">${esc(MockFmt.baht(billed))} บาท</span>`
                            : '<span class="td-sub">ยังไม่มีใบเรียกเก็บ</span>',
                        'จ่าย / รับชำระแล้ว': esc(MockFmt.baht(MockRefer.sumPaid(r))) + ' บาท',
                        'โต้แย้ง': esc(MockFmt.baht(MockRefer.sumDisputed(r))) + ' บาท',
                        'คงค้าง': `<strong>${esc(MockFmt.baht(MockRefer.outstanding(r)))} บาท</strong>`,
                        'ช่องทาง': esc(REFER_CHANNEL[r.reimburse_channel] || '—'),
                        'ใบตอบกลับ': r.direction === 'OUT'
                            ? (r.counter_received ? '<span class="sip-chip sip-chip-success">ได้รับแล้ว</span>'
                                                  : '<span class="sip-chip sip-chip-amber">ยังไม่ได้รับ</span>')
                            : (r.counter_sent ? '<span class="sip-chip sip-chip-success">ส่งแล้ว</span>'
                                              : '<span class="sip-chip sip-chip-amber">ยังไม่ได้ส่ง</span>'),
                    })}
                    <div class="ds-section-label" style="margin-top:12px">ความพร้อมตามจ่าย</div>
                    <div class="ds-stepper">${stepper}</div>
                </div>
            </div>`;
    },

    /* ══════════ แท็บ 2 — ตรวจสอบ ══════════ */

    renderCheck(r) {
        const flags = MockRefer.flags(r);
        document.getElementById('tabCheck').innerHTML = flags.length ? `
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="shield-check" class="mi"></i>
                        ผลการตรวจใบส่งตัวและการเรียกเก็บ
                        <span class="ds-pane-count">${flags.filter(f => f.level === 'ERROR').length} ต้องแก้</span></div>
                    <div class="section-actions">
                        <span class="td-sub">มูลค่าที่เสี่ยงรวม ${esc(MockFmt.baht(MockRefer.amountAtRisk(r)))} บาท</span>
                    </div>
                </div>
                <div class="table-responsive">
                <table class="data-table compact">
                    <thead><tr>
                        <th style="width:1%">รหัสธง</th><th style="width:1%">ระดับ</th><th>ประเด็น</th>
                        <th style="width:1%;text-align:right">เสี่ยง (บาท)</th>
                        <th style="width:1%">จะติดที่ NHSO</th><th style="width:1%">กฎอ้างอิง</th><th style="width:1%"></th>
                    </tr></thead>
                    <tbody>${flags.map((f, i) => `<tr>
                        <td><span class="sip-chip ${f.level === 'ERROR' ? 'sip-chip-danger'
                            : f.level === 'WARNING' ? 'sip-chip-amber' : 'sip-chip-muted'}">${esc(f.code)}</span></td>
                        <td class="td-sub">${esc(MockTone.severityLabel[f.level] || f.level)}</td>
                        <td class="td-name">${esc(f.label)}
                            <div class="td-sub">${esc(f.detail)}</div></td>
                        <td style="text-align:right;white-space:nowrap">${esc(MockFmt.baht(f.amount_at_risk))}</td>
                        <td>${f.maps_to_nhso
                            ? `<a href="nhso-case.html?seq=${encodeURIComponent(this._nhsoSeq(r))}"
                                  class="sip-chip sip-chip-danger"
                                  title="เปิดดูข้อความจริงที่ สปสช. ตอบกลับ">${esc(f.maps_to_nhso)}</a>`
                            : '<span class="td-sub">—</span>'}</td>
                        <td class="td-sub"><a href="claim-rules.html?rule=${encodeURIComponent(f.rule_id)}">${esc(f.rule_id)}</a></td>
                        <td>${f.level === 'ERROR' ? `<button class="btn btn-outline btn-sm"
                            onclick="ReferCase.openOverride(${i})">ขอ Override</button>` : ''}</td>
                    </tr>`).join('')}</tbody>
                </table>
                </div>
                <div class="ds-note" style="margin-top:10px">
                    <i data-lucide="lightbulb" class="icon-sm"></i>
                    ทุกธงยิงจากกฎที่มีเลขเวอร์ชันและเอกสารอ้างอิง — ย้อนกลับได้ว่าตัดสินด้วยข้อมูลอะไร (BR-03)
                </div>
            </div>`
            : `<div class="sip-banner sip-banner-success">
                   <i data-lucide="check-circle-2" class="icon-sm"></i>
                   ใบส่งตัวและการเรียกเก็บผ่านการตรวจทั้งหมด ไม่พบประเด็นที่ต้องแก้ไข</div>`;
    },

    /** seq ของเคลมที่ผูกอยู่ — ใช้ลิงก์ข้ามไปดูข้อความจริงฝั่ง สปสช. */
    _nhsoSeq(r) {
        const c = r.claim_id ? MockClaims.byId(r.claim_id) : null;
        return (c && c.nhso) ? c.nhso.seq : '';
    },

    /* ══════════ แท็บ 3 — หลักฐาน ══════════ */

    renderEvidence(r) {
        const flags = MockRefer.flags(r);
        const bills = MockRefer.bills(r.id);

        const evidenceCards = flags.length ? flags.map(f => `
            <div class="section-card" style="margin-bottom:12px">
                <div class="section-header">
                    <div class="section-title">
                        <span class="sip-chip ${f.level === 'ERROR' ? 'sip-chip-danger'
                            : f.level === 'WARNING' ? 'sip-chip-amber' : 'sip-chip-muted'}">${esc(f.code)}</span>
                        ${esc(f.label)}</div>
                    <div class="section-actions">
                        <button class="btn btn-outline btn-sm" onclick="ReferCase.copyEvidence('${esc(f.code)}')">
                            <i data-lucide="copy" class="icon-sm"></i> คัดลอก snapshot</button>
                    </div>
                </div>
                <table class="ds-table-grid"><tbody>${
                    Object.entries(f.evidence || {}).map(([k, v]) =>
                        `<tr><td class="l" style="width:32%">${esc(k)}</td><td class="l">${esc(v)}</td></tr>`).join('')
                }</tbody></table>
            </div>`).join('')
            : '<div class="ds-empty">ไม่มีธงที่ต้องแสดงหลักฐาน</div>';

        /* รายการในใบเรียกเก็บ — บรรทัดนอกขอบเขตทำพื้นแดงให้เห็นทันที */
        const billTables = bills.map(b => `
            <div class="section-card" style="margin-bottom:12px">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="receipt" class="mi"></i>
                        รายการในใบเรียกเก็บ ${esc(b.id)}
                        <span class="td-sub">· ${esc(b.bill_no)} · ${esc(MockFmt.dateTH(b.bill_date))}</span></div>
                    <div class="section-actions">${MockRefer.billStatusHtml(b)}</div>
                </div>
                <div class="table-responsive">
                <table class="data-table compact">
                    <thead><tr><th style="width:1%">รหัส</th><th>รายการ</th>
                        <th style="width:1%;text-align:right">จำนวน</th>
                        <th style="width:1%;text-align:right">ราคา/หน่วย</th>
                        <th style="width:1%;text-align:right">รวม</th>
                        <th style="width:1%">ในขอบเขต</th></tr></thead>
                    <tbody>${(b.items || []).map(it => `
                        <tr${it.in_scope === false ? ' style="background:var(--status-danger-soft)"' : ''}>
                            <td class="td-sub">${esc(it.code)}</td>
                            <td>${esc(it.name)}${it.note ? `<div class="td-sub">${esc(it.note)}</div>` : ''}</td>
                            <td style="text-align:right">${esc(it.qty)}</td>
                            <td style="text-align:right">${esc(MockFmt.baht(it.unit_price))}</td>
                            <td style="text-align:right">${esc(MockFmt.baht(it.amount))}</td>
                            <td>${it.in_scope === false
                                ? '<span class="sip-chip sip-chip-danger">นอกขอบเขต</span>'
                                : '<span class="sip-chip sip-chip-success">อยู่ในขอบเขต</span>'}</td>
                        </tr>`).join('')}</tbody>
                </table>
                </div>
                <div class="ds-note" style="margin-top:8px">
                    <i data-lucide="calculator" class="icon-sm"></i>
                    รวมทั้งใบ ${esc(MockFmt.baht(MockRefer.billTotal(b)))} บาท ·
                    นอกขอบเขต <strong>${esc(MockFmt.baht(MockRefer.billOutOfScope(b)))}</strong> บาท ·
                    วงเงินที่อนุมัติ ${esc(MockFmt.baht(r.cap_amount))} บาท
                </div>
            </div>`).join('');

        document.getElementById('tabEvidence').innerHTML = evidenceCards + billTables;
    },

    copyEvidence(code) {
        const r = this.current();
        const f = MockRefer.flags(r).find(x => x.code === code);
        if (!f) return;
        const json = JSON.stringify({ refer_id: r.id, flag: f.code, level: f.level,
                                      rule_id: f.rule_id, maps_to_nhso: f.maps_to_nhso,
                                      amount_at_risk: f.amount_at_risk, evidence: f.evidence }, null, 2);
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

    renderDocs(r) {
        const docs = r.documents || [];
        document.getElementById('tabDocs').innerHTML = docs.length ? `
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="paperclip" class="mi"></i>
                        เอกสารประกอบการส่งต่อ
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
                <div class="ds-note" style="margin-top:10px">
                    <i data-lucide="info" class="icon-sm"></i>
                    ใบตอบกลับ (counter-referral) เป็นเอกสารที่ขาดบ่อยที่สุด —
                    ถ้าไม่มี เวชระเบียนไม่ครบ และจะส่งเบิกไม่ผ่าน
                </div>
            </div>`
            : '<div class="ds-empty">ยังไม่มีเอกสารประกอบ</div>';
    },

    /* ══════════ แท็บ 5 — การเงิน ══════════ */

    renderMoney(r) {
        const bills = MockRefer.bills(r.id);
        const isOut = r.direction === 'OUT';

        document.getElementById('tabMoney').innerHTML = `
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="wallet" class="mi"></i>
                        ${isOut ? 'ใบเรียกเก็บจากปลายทาง (เราตามจ่าย)' : 'ใบเรียกเก็บที่เราออก (เรารับชำระ)'}
                        <span class="ds-pane-count">${bills.length} ใบ</span></div>
                    <div class="section-actions">
                        <button class="btn btn-outline btn-sm" onclick="location.href='refer-billing.html?refer=${encodeURIComponent(r.id)}'">
                            <i data-lucide="external-link" class="icon-sm"></i> เปิดหน้าตามจ่าย/เรียกเก็บ</button>
                    </div>
                </div>
                ${bills.length ? `
                <div class="table-responsive">
                <table class="data-table compact">
                    <thead><tr>
                        <th style="width:1%">เลขที่ใบ</th><th style="width:1%">เลขที่คู่สัญญา</th>
                        <th style="width:1%">วันที่</th><th style="width:1%">ช่องทาง</th>
                        <th style="width:1%;text-align:right">ยอด</th>
                        <th style="width:1%;text-align:right">อนุมัติจ่าย</th>
                        <th style="width:1%;text-align:right">โต้แย้ง</th>
                        <th style="width:1%;text-align:right">ชำระแล้ว</th>
                        <th style="width:1%">อายุหนี้</th><th style="width:1%">สถานะ</th><th style="width:1%"></th>
                    </tr></thead>
                    <tbody>${bills.map(b => `<tr>
                        <td class="td-sub">${esc(b.id)}</td>
                        <td class="td-sub">${esc(b.bill_no)}</td>
                        <td class="td-sub" style="white-space:nowrap">${esc(MockFmt.dateTH(b.bill_date))}</td>
                        <td class="td-sub">${esc(REFER_CHANNEL[b.channel] || b.channel)}
                            ${b.nhso_claim_id ? `<div class="sip-chip sip-chip-danger"
                                title="มีทั้งใบเรียกเก็บและเคสส่งเบิก สปสช. — เข้าข่ายเรียกเก็บซ้ำซ้อน">+ ส่งเบิก ${esc(b.nhso_claim_id)}</div>` : ''}</td>
                        <td style="text-align:right;white-space:nowrap">${esc(MockFmt.baht(MockRefer.billTotal(b)))}</td>
                        <td style="text-align:right">${esc(MockFmt.baht(b.approved_amount))}</td>
                        <td style="text-align:right;${b.disputed_amount ? 'color:var(--status-danger);font-weight:700' : ''}">${
                            esc(MockFmt.baht(b.disputed_amount))}</td>
                        <td style="text-align:right">${esc(MockFmt.baht(b.paid_amount))}</td>
                        <td class="td-sub">${esc(MockRefer.billAge(b))} วัน</td>
                        <td>${MockRefer.billStatusHtml(b)}</td>
                        <td><button class="btn btn-outline btn-sm" onclick="ReferCase.openVerify('${esc(b.id)}')">
                            ตรวจใบเรียกเก็บ</button></td>
                    </tr>`).join('')}</tbody>
                </table>
                </div>
                <div class="ds-note" style="margin-top:10px">
                    <i data-lucide="calculator" class="icon-sm"></i>
                    เรียกเก็บรวม <strong>${esc(MockFmt.baht(MockRefer.sumBilled(r)))}</strong> บาท ·
                    ${isOut ? 'จ่ายแล้ว' : 'รับชำระแล้ว'} ${esc(MockFmt.baht(MockRefer.sumPaid(r)))} บาท ·
                    โต้แย้ง ${esc(MockFmt.baht(MockRefer.sumDisputed(r)))} บาท ·
                    คงค้าง <strong>${esc(MockFmt.baht(MockRefer.outstanding(r)))}</strong> บาท
                </div>`
                : `<div class="ds-empty">ยังไม่มีใบเรียกเก็บสำหรับรายการนี้
                        <div class="td-sub" style="margin-top:6px">
                            ${isOut ? 'ภาระผูกพันที่ประเมินไว้ ' + esc(MockFmt.baht(r.est_amount)) +
                                      ' บาท — ยังไม่ปรากฏในบัญชีจนกว่าใบเรียกเก็บจะมาถึง'
                                    : 'ยังไม่ได้ออกใบเรียกเก็บ — ตรวจกำหนดยื่นตามระเบียบด้วย'}
                        </div></div>`}
            </div>`;
    },

    /** ตรวจใบเรียกเก็บรายบรรทัด — หัวใจของการโต้แย้งเฉพาะส่วนที่เกินขอบเขต */
    openVerify(billId) {
        const b = MockRefer.billById(billId); if (!b) return;
        const r = this.current();

        Drawer.open({
            title: `ตรวจใบเรียกเก็บ — ${b.id}`,
            contentHtml: `
                <div class="ds-note" style="margin-bottom:12px">
                    <i data-lucide="file-text" class="icon-sm"></i>
                    ${esc(b.bill_no)} · ${esc(MockFmt.dateTH(b.bill_date))} ·
                    ${esc(r.partner_name)} · วงเงินที่อนุมัติ ${esc(MockFmt.baht(r.cap_amount))} บาท
                </div>
                <div class="ds-section-label">เลือกรายการที่อนุมัติจ่าย — ที่ไม่ติ๊กจะถูกบันทึกเป็นการโต้แย้ง</div>
                <div class="table-responsive">
                <table class="data-table compact">
                    <thead><tr><th style="width:1%">จ่าย</th><th>รายการ</th>
                        <th style="width:1%;text-align:right">จำนวนเงิน</th><th style="width:1%">ขอบเขต</th></tr></thead>
                    <tbody>${(b.items || []).map((it, i) => `<tr>
                        <td><input type="checkbox" class="vItem" data-i="${i}" data-amt="${it.amount}"
                                   ${it.in_scope === false ? '' : 'checked'} onchange="ReferCase.recalcVerify()"></td>
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
                    <textarea class="sip-textarea" id="vReason" rows="3"
                        placeholder="เช่น หัตถการนอกขอบเขตใบส่งตัว / เกินจำนวนครั้งที่อนุมัติ...">${
                        esc(MockRefer.billOutOfScope(b) ? 'รายการนอกขอบเขตใบส่งตัวและเกินจำนวนครั้งที่อนุมัติ' : '')}</textarea>
                </div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                         <button class="btn btn-save" onclick="ReferCase.saveVerify('${esc(b.id)}')">บันทึกผลตรวจ</button>`,
            onOpen: () => { refreshIcons(); ReferCase.recalcVerify(); },
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
        this.select(this.state.id);
    },

    /* ══════════ แท็บ 6 — Timeline ══════════ */

    renderTimeline(r) {
        const tl = r.timeline || [];
        document.getElementById('tabTimeline').innerHTML = tl.length ? `
            <div class="section-card">
                <div class="section-header"><div class="section-title">
                    <i data-lucide="history" class="mi"></i> ลำดับเหตุการณ์ของการส่งต่อ</div></div>
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

    /* ══════════ แผงขวา ══════════ */

    renderActions(r) {
        const users = MockAdmin.users().filter(u => u.active).map(u =>
            `<option value="${esc(u.id)}" ${u.id === r.owner ? 'selected' : ''}>${esc(u.name)}</option>`).join('');
        const tasks = MockTasks.forRefer(r.id);
        const canRequest = r.direction === 'OUT' && !r.auth_no && r.status !== 'WAIT_APPR';

        document.getElementById('actionPane').innerHTML = `
            <div class="sip-field">
                <label class="sip-label">ผู้รับผิดชอบ</label>
                <select class="sip-select" id="wOwner">${users}</select>
            </div>
            <div class="sip-field">
                <label class="sip-label">กำหนดถัดไป</label>
                <input class="sip-input" id="wDue" type="date" value="2026-08-12">
            </div>
            <div class="sip-field">
                <label class="sip-label">บันทึกการดำเนินการ</label>
                <textarea class="sip-textarea" id="wNote" rows="5"
                    placeholder="สิ่งที่ดำเนินการ / เหตุผล / เอกสารที่แนบเพิ่ม..."></textarea>
            </div>
            <label class="sip-checkbox" style="margin-bottom:12px">
                <input type="checkbox" id="wEvidence"> แนบหลักฐานแล้ว
            </label>

            ${MockRefer.hasError(r) ? `
            <div class="sip-banner sip-banner-danger" style="margin-bottom:12px">
                <i data-lucide="alert-triangle" class="icon-sm"></i>
                <span>มีธงระดับ <strong>ERROR</strong> ค้างอยู่ ${MockRefer.errorFlags(r).length} รายการ —
                เสี่ยง ${esc(MockFmt.baht(MockRefer.amountAtRisk(r)))} บาท</span>
            </div>` : ''}

            <div class="ds-section-label">งานที่ผูกกับรายการนี้</div>
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

            <div class="ds-section-label" style="margin-top:14px">ออกเอกสาร</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-outline btn-sm" onclick="ReferCase.printReferralForm()">
                    <i data-lucide="printer" class="icon-sm"></i> ใบส่งตัว</button>
                <button class="btn btn-outline btn-sm" onclick="ReferCase.printInvoice()">
                    <i data-lucide="receipt" class="icon-sm"></i> ใบแจ้งหนี้</button>
                <button class="btn btn-outline btn-sm" onclick="ReferCase.printCounter()">
                    <i data-lucide="reply" class="icon-sm"></i> ใบตอบกลับ</button>
            </div>

            <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
                ${canRequest ? `<button class="btn btn-primary btn-sm" onclick="ReferCase.requestApproval()">
                    <i data-lucide="send" class="icon-sm"></i> ส่งขออนุมัติ</button>` : ''}
                ${MockRefer.hasError(r) ? `<button class="btn btn-danger btn-sm" onclick="ReferCase.openOverride(0)">
                    <i data-lucide="shield-alert" class="icon-sm"></i> ขอ Override</button>` : ''}
            </div>`;
        refreshIcons();
    },

    saveWork() {
        const r = this.current(); if (!r) return;
        const note = document.getElementById('wNote').value.trim();
        if (!note) { showToast('กรุณาบันทึกสิ่งที่ดำเนินการ', 'warning'); return; }

        MockDB.patch('referrals', r.id, {
            owner: document.getElementById('wOwner').value,
            timeline: [...(r.timeline || []), {
                at: '2569-08-06T09:00', tone: 'info', title: 'บันทึกการดำเนินการ',
                by: MockSession.user().full_name,
                note: note + (document.getElementById('wEvidence').checked ? ' · แนบหลักฐานแล้ว' : ''),
            }],
        });
        showToast('บันทึกแล้ว');
        this.select(r.id);
    },

    /** ตรวจซ้ำ — ปิดเฉพาะธงที่แก้ได้ด้วยเอกสาร/ข้อมูล ไม่ล้างทุกอย่างทิ้ง */
    async saveAndRecheck() {
        const r = this.current(); if (!r) return;
        const note = document.getElementById('wNote').value.trim();
        if (!note) { showToast('กรุณาบันทึกสิ่งที่ดำเนินการก่อนตรวจซ้ำ', 'warning'); return; }

        const FIXABLE = ['REF-NOAUTH', 'REF-NOCOUNTER', 'REF-UNBILLED', 'REF-LATE'];
        const before  = MockRefer.flags(r);
        const after   = before.filter(f => !FIXABLE.includes(f.code));
        const closed  = before.length - after.length;

        const ok = await Drawer.confirm({
            title: 'ตรวจซ้ำด้วยกฎชุดปัจจุบัน?',
            message: 'ระบบจะรันกฎการส่งต่ออีกครั้งกับข้อมูลที่แก้แล้ว',
            lines: [`${r.id} · ${r.patient}`,
                    closed ? `คาดว่าจะปิดได้ ${closed} ธง` : 'ธงที่เหลือเป็นเรื่องที่แก้ย้อนหลังไม่ได้'],
            confirmText: 'ตรวจซ้ำ', danger: false,
        });
        if (!ok) return;

        MockDB.patch('referrals', r.id, {
            risk_flags: after,
            risk_score: Math.max(5, r.risk_score - closed * 18),
            owner: document.getElementById('wOwner').value,
            timeline: [...(r.timeline || []),
                { at: '2569-08-06T09:00', tone: 'info', title: 'บันทึกการดำเนินการ',
                  by: MockSession.user().full_name, note },
                { at: '2569-08-06T09:01', tone: closed ? 'success' : 'warning',
                  title: `ตรวจซ้ำ — ปิดได้ ${closed} ธง เหลือ ${after.length} ธง`,
                  by: 'Rule Engine',
                  note: after.length ? 'ธงที่เหลือต้องแก้ที่ต้นทาง เช่น ใบส่งตัวหมดอายุหรือทำเกินขอบเขตไปแล้ว'
                                     : 'ปิดประเด็นครบทุกข้อ' }],
        });
        showToast(closed ? `ตรวจซ้ำแล้ว — ปิดได้ ${closed} ธง` : 'ตรวจซ้ำแล้ว — ไม่มีธงที่ปิดได้จากขั้นตอนนี้');
        this.select(r.id);
    },

    requestApproval() {
        const r = this.current(); if (!r) return;
        const me = MockSession.userId();
        const approver = (MockAdmin.users().find(u => u.active && u.id !== me &&
                            (u.roles || []).some(x => /APPROVER/i.test(x))) ||
                          MockAdmin.users().find(u => u.active && u.id !== me) || {}).id;

        const t = MockRefer.requestApproval(r.id, { owner: approver });
        if (!t) { showToast('ส่งขออนุมัติไม่สำเร็จ', 'error'); return; }
        showToast(`ส่งขออนุมัติแล้ว — ${t.id} ถึง ${MockAdmin.userName(approver)}`);
        this.select(r.id);
    },

    /* ══════════ Override (BR-04) ══════════ */

    openOverride(idx) {
        const r = this.current(); if (!r) return;
        const f = MockRefer.errorFlags(r)[idx] || MockRefer.errorFlags(r)[0];
        if (!f) { showToast('รายการนี้ไม่มีธงที่ต้อง Override', 'info'); return; }

        const me = MockSession.userId();
        const approvers = MockAdmin.users().filter(u => u.active && u.id !== me).map(u =>
            `<option value="${esc(u.id)}">${esc(u.name)} — ${esc(u.dept)}</option>`).join('');

        Drawer.open({
            title: 'ขอ Override — ' + f.code,
            contentHtml: `
                <div class="sip-banner sip-banner-warning" style="margin-bottom:12px">
                    <i data-lucide="shield-alert" class="icon-sm"></i>
                    <span>${esc(f.label)} — เสี่ยง ${esc(MockFmt.baht(f.amount_at_risk))} บาท<br>
                    <span class="td-sub">${esc(f.detail)}</span></span>
                </div>
                <div class="sip-field">
                    <label class="sip-label">เหตุผล *</label>
                    <textarea class="sip-textarea" id="oReason" rows="3"
                        placeholder="เหตุผลที่ผู้ตรวจสอบย้อนหลังจะเข้าใจได้..."></textarea>
                </div>
                <div class="sip-field">
                    <label class="sip-label">หลักฐานประกอบ *</label>
                    <input class="sip-input" id="oEvidence" placeholder="เช่น บันทึกอนุมัติเลขที่ ... / หนังสือจากปลายทาง">
                </div>
                <div class="sip-field">
                    <label class="sip-label">ผู้อนุมัติ * <span class="td-sub">(ตัวเองไม่ได้ — BR-05)</span></label>
                    <select class="sip-select" id="oApprover">${approvers}</select>
                </div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                         <button class="btn btn-save" onclick="ReferCase.saveOverride('${esc(f.code)}')">ยื่นขอ Override</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    saveOverride(code) {
        const r = this.current();
        const reason   = document.getElementById('oReason').value.trim();
        const evidence = document.getElementById('oEvidence').value.trim();
        const approver = document.getElementById('oApprover').value;
        if (!reason || !evidence) { showToast('ต้องระบุเหตุผลและหลักฐาน (BR-04)', 'warning'); return; }

        const t = MockTasks.create({
            refer_id: r.id, kind: 'OVERRIDE',
            title: `ขอ Override ${code} — ${r.patient}`,
            owner: approver, due_at: '2569-08-12T16:00', priority: 'HIGH',
            detail: `${code} · ${reason}\nหลักฐาน: ${evidence}`,
        });
        Drawer.close();
        showToast(`ยื่นขอ Override แล้ว — ${t.id} ถึง ${MockAdmin.userName(approver)}`);
        this.select(r.id);
    },

    /* ══════════ ใบพิมพ์ 3 ใบ (PAGE-GUIDE §5B) ══════════ */

    _fields(r, extra) {
        return [
            ['เลขที่ใบส่งตัว', r.letter_no || ''],
            ['ผู้ป่วย', `${r.patient} · HN ${r.hn}`],
            ['สิทธิ', `${r.fund} · ${r.right_no || '—'}`],
            [MockRefer.partnerLabel(r), r.partner_name],
            ...(extra || []),
            ['ผู้จัดทำ', MockSession.user().full_name],
        ];
    },

    /** ใบส่งตัวผู้ป่วย — ใบที่ผู้ป่วยถือไปปลายทาง */
    buildReferralForm() {
        const r = this.current();
        const C = DocParts.CELL;
        const warnings = [];
        const th = (t, w) => `<th style="${C}font-size:11px;font-weight:700;text-align:center;`
                           + `${w ? 'width:' + w + ';' : ''}">${DocParts.esc(t)}</th>`;

        const dxRows = (r.dx || []).map((d, i) => `<tr>
            <td style="${C}text-align:center;">${i + 1}</td>
            <td style="${C}text-align:center;">${DocParts.esc(d.code)}</td>
            <td style="${C}">${DocParts.esc(d.name)}</td>
            <td style="${C}text-align:center;">${DocParts.esc(d.type)}</td>
        </tr>`).join('');

        const procRows = (r.proc_planned || []).map((p, i) => `<tr>
            <td style="${C}text-align:center;">${i + 1}</td>
            <td style="${C}text-align:center;">${DocParts.esc(p.code)}</td>
            <td style="${C}">${DocParts.esc(p.name)}</td>
        </tr>`).join('');

        const fields = this._fields(r, [['วันที่ส่งต่อ', MockFmt.dateTH(r.refer_date)]]);

        const html = `<div style="color:#000;font-size:12px;">
            ${DocParts.docHead({ title: 'ใบส่งตัวผู้ป่วยไปรับการรักษาต่อ', formCode: 'REF-01/2569', fields })}

            <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
                <tbody>
                    <tr><td style="${C}width:22%;">ชื่อ-สกุลผู้ป่วย</td>
                        <td style="${C}" class="${DocPrint.miss(r.patient, 'ชื่อผู้ป่วย', warnings)}">${DocParts.esc(r.patient)}</td>
                        <td style="${C}width:14%;">อายุ / เพศ</td>
                        <td style="${C}width:18%;">${DocParts.esc(r.age)} ปี · ${r.gender === 'F' ? 'หญิง' : 'ชาย'}</td></tr>
                    <tr><td style="${C}">HN / AN</td><td style="${C}">${DocParts.esc(r.hn)} ${r.an ? '/ ' + DocParts.esc(r.an) : ''}</td>
                        <td style="${C}">เลขบัตรประชาชน</td><td style="${C}">${DocParts.esc(r.nid_masked || '')}</td></tr>
                    <tr><td style="${C}">สิทธิการรักษา</td><td style="${C}">${DocParts.esc(r.fund)} — ${DocParts.esc(r.right_no || '')}</td>
                        <td style="${C}">เลขอนุมัติ</td>
                        <td style="${C}" class="${DocPrint.miss(r.auth_no, 'เลขอนุมัติ (Referral/Pre-auth)', warnings)}">
                            ${DocParts.esc(r.auth_no || '')}</td></tr>
                    <tr><td style="${C}">${DocParts.esc(MockRefer.partnerLabel(r))}</td>
                        <td style="${C}" colspan="3">${DocParts.esc(r.partner_name)}
                            — ${DocParts.esc(r.partner_level)} · ${DocParts.esc(r.partner_province)}</td></tr>
                    <tr><td style="${C}">เหตุผลการส่งต่อ</td>
                        <td style="${C}" colspan="3">${DocParts.esc(MockRefer.reasonMeta(r).label)}
                            ${r.refer_note ? ' — ' + DocParts.esc(r.refer_note) : ''}</td></tr>
                </tbody>
            </table>

            <div style="font-weight:700;margin:10px 0 4px">1. การวินิจฉัยโรค</div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>${th('ที่', '30px')}${th('รหัส ICD-10', '90px')}${th('คำวินิจฉัย')}${th('ประเภท', '60px')}</tr></thead>
                <tbody>${DocParts.fillRows(dxRows, 4, 4)}</tbody>
            </table>

            <div style="font-weight:700;margin:12px 0 4px">2. หัตถการ/การรักษาที่ขออนุมัติ</div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>${th('ที่', '30px')}${th('รหัส', '90px')}${th('รายการ')}</tr></thead>
                <tbody>${DocParts.fillRows(procRows, 4, 3)}</tbody>
            </table>

            <div style="font-weight:700;margin:12px 0 4px">3. ขอบเขตและวงเงินที่อนุมัติ</div>
            <table style="width:100%;border-collapse:collapse;">
                <tbody>
                    <tr><td style="${C}width:22%;">ขอบเขตที่อนุมัติ</td>
                        <td style="${C}" class="${DocPrint.miss(r.scope_note, 'รายละเอียดขอบเขตที่อนุมัติ', warnings)}">
                            ${DocParts.esc(MockRefer.scopeLabel(r))} — ${DocParts.esc(r.scope_note || '')}</td></tr>
                    <tr><td style="${C}">จำนวนครั้งที่อนุมัติ</td><td style="${C}">${DocParts.esc(r.visit_limit)} ครั้ง</td></tr>
                    <tr><td style="${C}">วงเงินที่อนุมัติ</td><td style="${C}"><strong>${DocParts.esc(MockFmt.baht(r.cap_amount))}</strong> บาท</td></tr>
                    <tr><td style="${C}">ใบส่งตัวมีผลถึง</td>
                        <td style="${C}" class="${DocPrint.miss(r.expires_at, 'วันหมดอายุใบส่งตัว', warnings)}">
                            ${DocParts.esc(MockFmt.dateTH(r.expires_at))}</td></tr>
                </tbody>
            </table>

            <div style="margin-top:8px;font-size:11px">
                หมายเหตุ: การให้บริการนอกขอบเขตหรือหลังวันหมดอายุที่ระบุไว้ หน่วยบริการต้นสังกัดสงวนสิทธิ์ไม่ตามจ่าย
            </div>

            ${DocParts.signatureBlock(['ลงชื่อ แพทย์ผู้ส่งต่อ', 'ลงชื่อ ผู้อนุมัติวงเงิน', 'ลงชื่อ ผู้รับผู้ป่วย'])}
            ${DocParts.footer(fields)}
        </div>`;

        /* แพทย์ผู้ส่งต่อยังต้องเตือนแยก เพราะไม่ได้อยู่ในตารางด้านบน */
        DocPrint.miss(r.doctor, 'แพทย์ผู้ส่งต่อ', warnings);

        return { html: DocParts.toPrintBorders(html), warnings };
    },

    printReferralForm() {
        if (!this.current()) { showToast('เลือกรายการก่อน', 'warning'); return; }
        const { html, warnings } = this.buildReferralForm();
        DocPrint.preview({ title: 'ตัวอย่างก่อนพิมพ์ — ใบส่งตัวผู้ป่วย', html, warnings });
    },

    /** ใบแจ้งหนี้ / ใบเรียกเก็บค่ารักษาพยาบาลกรณีส่งต่อ */
    buildInvoice() {
        const r = this.current();
        const C = DocParts.CELL;
        const warnings = [];
        const bills = MockRefer.bills(r.id);
        const th = (t, w) => `<th style="${C}font-size:11px;font-weight:700;text-align:center;`
                           + `${w ? 'width:' + w + ';' : ''}">${DocParts.esc(t)}</th>`;

        let n = 0;
        const rows = bills.flatMap(b => (b.items || []).map(it => {
            n++;
            return `<tr>
                <td style="${C}text-align:center;">${n}</td>
                <td style="${C}text-align:center;">${DocParts.esc(b.bill_no)}</td>
                <td style="${C}text-align:center;">${DocParts.esc(it.code)}</td>
                <td style="${C}">${DocParts.esc(it.name)}</td>
                <td style="${C}text-align:right;">${DocParts.esc(it.qty)}</td>
                <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(it.unit_price))}</td>
                <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(it.amount))}</td>
                <td style="${C}text-align:center;">${it.in_scope === false ? 'นอกขอบเขต' : 'ในขอบเขต'}</td>
            </tr>`;
        })).join('');

        const total = MockRefer.sumBilled(r);
        const fields = this._fields(r, [
            ['ประเภทเอกสาร', r.direction === 'OUT' ? 'ใบเรียกเก็บที่ได้รับจากปลายทาง' : 'ใบเรียกเก็บที่ออกไปยังต้นทาง'],
            ['จำนวนใบ', bills.length + ' ใบ'],
        ]);

        const html = `<div style="color:#000;font-size:12px;">
            ${DocParts.docHead({ title: 'ใบแจ้งหนี้ค่ารักษาพยาบาลกรณีส่งต่อ', formCode: 'REF-02/2569', fields })}
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>${th('ที่', '30px')}${th('เลขที่ใบ', '96px')}${th('รหัส', '58px')}${th('รายการ')}
                    ${th('จำนวน', '48px')}${th('ราคา/หน่วย', '72px')}${th('รวม', '76px')}${th('ขอบเขต', '66px')}</tr></thead>
                <tbody>${DocParts.fillRows(rows, 12, 8)}</tbody>
            </table>

            <table style="width:100%;border-collapse:collapse;margin-top:10px;">
                <tbody>
                    <tr><td style="${C}width:60%;">วงเงินที่อนุมัติตามใบส่งตัว</td>
                        <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(r.cap_amount))} บาท</td></tr>
                    <tr><td style="${C}">ยอดเรียกเก็บรวม</td>
                        <td style="${C}text-align:right;"><strong>${DocParts.esc(MockFmt.baht(total))}</strong> บาท</td></tr>
                    <tr><td style="${C}">อนุมัติจ่าย</td>
                        <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(
                            bills.reduce((a, b) => a + (b.approved_amount || 0), 0)))} บาท</td></tr>
                    <tr><td style="${C}">โต้แย้ง / ไม่รับผิดชอบ</td>
                        <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(MockRefer.sumDisputed(r)))} บาท</td></tr>
                    <tr><td style="${C}">คงค้าง</td>
                        <td style="${C}text-align:right;"><strong>${DocParts.esc(MockFmt.baht(MockRefer.outstanding(r)))}</strong> บาท</td></tr>
                </tbody>
            </table>

            ${DocParts.signatureBlock(['ลงชื่อ ผู้จัดทำ', 'ลงชื่อ ผู้ตรวจสอบ', 'ลงชื่อ ผู้มีอำนาจอนุมัติ'])}
            ${DocParts.footer(fields)}
        </div>`;

        return { html: DocParts.toPrintBorders(html), warnings };
    },

    printInvoice() {
        const r = this.current();
        if (!r) { showToast('เลือกรายการก่อน', 'warning'); return; }
        if (!MockRefer.bills(r.id).length) { showToast('รายการนี้ยังไม่มีใบเรียกเก็บ', 'warning'); return; }
        const { html, warnings } = this.buildInvoice();
        DocPrint.preview({ title: 'ตัวอย่างก่อนพิมพ์ — ใบแจ้งหนี้กรณีส่งต่อ', html, warnings });
    },

    /** ใบตอบกลับการส่งต่อ (counter-referral) */
    buildCounter() {
        const r = this.current();
        const C = DocParts.CELL;
        const warnings = [];

        const procTxt = (r.proc_actual || []).map(p =>
            `${p.code} ${p.name} (${MockFmt.dateTH(p.date)})`).join(' · ');

        const fields = this._fields(r, [
            ['ช่วงที่ให้บริการ', `${MockFmt.dateTH(r.service_date_from)} – ${MockFmt.dateTH(r.service_date_to)}`],
        ]);

        const html = `<div style="color:#000;font-size:12px;">
            ${DocParts.docHead({ title: 'ใบตอบกลับการส่งต่อผู้ป่วย (Counter-referral)', formCode: 'REF-03/2569', fields })}

            <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
                <tbody>
                    <tr><td style="${C}width:24%;">การวินิจฉัยเมื่อจำหน่าย</td>
                        <td style="${C}">${DocParts.esc((r.dx || []).map(d => `${d.code} ${d.name}`).join(' · ') || '')}</td></tr>
                    <tr><td style="${C}">หัตถการ/การรักษาที่ให้</td>
                        <td style="${C}" class="${DocPrint.miss(procTxt, 'หัตถการที่ทำจริง', warnings)}">${DocParts.esc(procTxt)}</td></tr>
                    <tr><td style="${C}">ช่วงเวลาที่รักษา</td>
                        <td style="${C}" class="${DocPrint.miss(r.service_date_to, 'วันที่สิ้นสุดการรักษา', warnings)}">
                            ${DocParts.esc(MockFmt.dateTH(r.service_date_from))} – ${DocParts.esc(MockFmt.dateTH(r.service_date_to))}</td></tr>
                    <tr><td style="${C}">ค่าใช้จ่ายที่เกิดขึ้น</td>
                        <td style="${C}">${DocParts.esc(MockFmt.baht(MockRefer.sumBilled(r) || r.est_amount))} บาท</td></tr>
                </tbody>
            </table>

            <div style="font-weight:700;margin:10px 0 4px">สรุปผลการรักษาและคำแนะนำสำหรับหน่วยบริการต้นทาง</div>
            <div style="border:1px solid #000;min-height:120px;padding:8px;font-size:12px;">
                ${DocParts.esc(r.refer_note || '')}
            </div>

            <div style="font-weight:700;margin:12px 0 4px">แผนการดูแลต่อเนื่อง / นัดครั้งถัดไป</div>
            <div style="border:1px solid #000;min-height:70px;padding:8px;"></div>

            ${DocParts.signatureBlock(['ลงชื่อ แพทย์ผู้รักษา', 'ลงชื่อ ผู้ส่งเอกสาร'])}
            ${DocParts.footer(fields)}
        </div>`;

        return { html: DocParts.toPrintBorders(html), warnings };
    },

    printCounter() {
        if (!this.current()) { showToast('เลือกรายการก่อน', 'warning'); return; }
        const { html, warnings } = this.buildCounter();
        DocPrint.preview({ title: 'ตัวอย่างก่อนพิมพ์ — ใบตอบกลับการส่งต่อ', html, warnings });
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.ReferCase = ReferCase;
document.addEventListener('DOMContentLoaded', () => ReferCase.init());
