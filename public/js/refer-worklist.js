/* ────────────────────────────────────────────────────────
   ทะเบียนการส่งต่อผู้ป่วย (Referral Worklist)

   แพทเทิร์นเดียวกับ claim-worklist.js: global object ไม่ใช่ IIFE
   ตัวเลข KPI ทุกตัว derive จาก MockRefer — ห้าม hardcode (PAGE-GUIDE §7B)
   ──────────────────────────────────────────────────────── */

const ReferList = {

    state: { dir: 'all', selected: new Set() },

    init() {
        MockSession.mountBanner('demoBanner');

        const p = new URLSearchParams(location.search);
        if (p.get('dir'))     this.state.dir  = p.get('dir');
        if (p.get('risk'))    this._pendingRisk = p.get('risk');
        if (p.get('partner')) this._pendingPartner = p.get('partner');

        /* ?kpi= มาจากการ์ด KPI บน Dashboard — กรองด้วยชุด id ชุดเดียวกับที่ drawer แสดง
           จำนวนแถวที่นี่จึงเท่ากับตัวเลขบนการ์ดเสมอ (คืน null ถ้าไม่มี ?kpi= หรือ key ไม่รู้จัก) */
        this._kpi = MockKpi.fromUrl();

        this.fillFilters();
        this.renderSeg();
        this.render();
    },

    reload() { this.state.selected.clear(); this.render(); showToast('รีเฟรชข้อมูลแล้ว'); },

    /* ── ตัวกรอง ── */

    fillFilters() {
        const rows = MockRefer.all();

        const partners = [...new Set(rows.map(r => r.partner_name))].sort();
        document.getElementById('fPartner').insertAdjacentHTML('beforeend',
            partners.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join(''));

        /* สถานะมี 2 ชุดตามทิศทาง — รวมเป็นรายการเดียวโดยติดป้ายทิศทางกำกับ */
        const statuses = [];
        REFER_DIRECTION.forEach(d => Object.entries(REFER_STATUS[d.key]).forEach(([k, v]) => {
            statuses.push({ value: d.key + ':' + k, label: `${v.label} (${d.label})` });
        }));
        document.getElementById('fStatus').insertAdjacentHTML('beforeend',
            statuses.map(s => `<option value="${esc(s.value)}">${esc(s.label)}</option>`).join(''));

        document.getElementById('fReason').insertAdjacentHTML('beforeend',
            Object.entries(REFER_REASON).map(([k, v]) =>
                `<option value="${esc(k)}">${esc(v.label)}</option>`).join(''));

        const funds = [...new Set(rows.map(r => r.fund))].sort();
        document.getElementById('fFund').insertAdjacentHTML('beforeend',
            funds.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join(''));

        if (this._pendingRisk)    document.getElementById('fRisk').value    = this._pendingRisk;
        if (this._pendingPartner) document.getElementById('fPartner').value = this._pendingPartner;
    },

    renderSeg() {
        const scope = MockRefer.all().filter(r => MockKpi.keep(r));
        const segs = [{ key: 'all', label: 'ทั้งหมด', n: scope.length }]
            .concat(REFER_DIRECTION.map(d => ({ key: d.key, label: d.label,
                n: scope.filter(r => r.direction === d.key).length })));

        document.getElementById('segDir').innerHTML = segs.map(s => `
            <button class="ds-seg ${s.key === this.state.dir ? 'active' : ''}"
                    onclick="ReferList.setDir('${esc(s.key)}')">${esc(s.label)} (${s.n})</button>`).join('');
    },

    setDir(key)  { this.state.dir = key; this.renderSeg(); this.render(); },
    setRisk(key) { document.getElementById('fRisk').value = key; this.render(); },

    visible() {
        const kw      = document.getElementById('searchBox').value.trim().toLowerCase();
        const partner = document.getElementById('fPartner').value;
        const status  = document.getElementById('fStatus').value;
        const reason  = document.getElementById('fReason').value;
        const fund    = document.getElementById('fFund').value;
        const risk    = document.getElementById('fRisk').value;

        const expiring = new Set(MockRefer.expiringSoon(7).map(r => r.id));

        return MockRefer.byDir(this.state.dir === 'all' ? null : this.state.dir).filter(r => {
            if (!MockKpi.keep(r)) return false;
            if (partner !== 'all' && r.partner_name !== partner) return false;
            if (reason  !== 'all' && r.reason !== reason) return false;
            if (fund    !== 'all' && r.fund !== fund) return false;
            if (status  !== 'all' && status !== r.direction + ':' + r.status) return false;

            const flags = MockRefer.flags(r);
            if (risk === 'ERROR'  && !flags.some(f => f.level === 'ERROR')) return false;
            if (risk === 'WARN'   && !flags.some(f => f.level === 'WARNING')) return false;
            if (risk === 'EXPIRE' && !expiring.has(r.id)) return false;
            if (risk === 'CLEAN'  && flags.some(f => f.level !== 'INFO')) return false;

            if (kw && !(`${r.id} ${r.hn} ${r.patient} ${r.letter_no || ''} ${r.auth_no || ''} ${r.partner_name}`)
                        .toLowerCase().includes(kw)) return false;
            return true;
        });
    },

    /* ── แสดงผล ── */

    render() {
        MockKpi.mountBanner('kpiFilterBar');
        const rows  = this.visible();
        const tbody = document.getElementById('rows');

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="15" class="ds-empty">ไม่พบรายการตามเงื่อนไขที่เลือก</td></tr>';
        } else {
            tbody.innerHTML = rows.map(r => {
                const dm     = MockRefer.dirMeta(r.direction);
                const rm     = MockRefer.reasonMeta(r);
                const billed = MockRefer.sumBilled(r);
                const over   = r.cap_amount && billed > r.cap_amount;

                const flags = MockRefer.flags(r);
                const flagCell = flags.length
                    ? flags.map(f => `<span class="sip-chip ${
                        f.level === 'ERROR' ? 'sip-chip-danger' : f.level === 'WARNING' ? 'sip-chip-amber' : 'sip-chip-muted'
                      }" title="${esc(f.detail)}">${esc(f.code.replace('REF-', ''))}</span>`).join(' ')
                    : '<span class="sip-chip sip-chip-success">ไม่มีธง</span>';

                const authCell = r.auth_no
                    ? `<span class="td-sub">${esc(r.auth_no)}</span>`
                    : '<span class="sip-chip sip-chip-danger">ไม่มีเลขอนุมัติ</span>';

                return `
                <tr style="cursor:pointer" onclick="ReferList.open('${esc(r.id)}')">
                    <td onclick="event.stopPropagation()">
                        <input type="checkbox" ${this.state.selected.has(r.id) ? 'checked' : ''}
                               onclick="ReferList.toggle('${esc(r.id)}', this)">
                    </td>
                    <td class="td-sub" style="white-space:nowrap">${esc(r.id)}</td>
                    <td><span class="sip-chip ${r.direction === 'OUT' ? 'sip-chip-amber' : 'sip-chip-active'}"
                              title="${esc(dm.sub)}">${esc(dm.label)}</span></td>
                    <td class="td-name">${esc(r.patient)}
                        <div class="td-sub">HN ${esc(r.hn)} · ${esc(r.age)} ปี ·
                            ${(r.dx || [])[0] ? esc(r.dx[0].code) : '—'}</div></td>
                    <td class="td-sub">${esc(r.partner_name)}
                        <div class="td-sub">${esc(r.partner_level || '')}</div></td>
                    <td><span class="sip-chip ${esc(rm.chip)}">${esc(rm.label)}</span></td>
                    <td class="td-sub" style="white-space:nowrap">${esc(r.letter_no || '—')}</td>
                    <td style="white-space:nowrap">${authCell}</td>
                    <td style="white-space:nowrap">${r.expires_at
                        ? MockTone.slaHtml(r.expires_at) : '<span class="td-sub">—</span>'}</td>
                    <td class="td-sub" style="white-space:nowrap">${esc(MockRefer.scopeLabel(r))}
                        <div class="td-sub">${esc(MockFmt.baht(r.cap_amount))} บาท</div></td>
                    <td style="text-align:right;white-space:nowrap">
                        ${billed ? `<span style="${over ? 'color:var(--status-danger);font-weight:700' : ''}"
                            title="${over ? 'เกินวงเงินที่อนุมัติ ' + esc(MockFmt.baht(r.cap_amount)) + ' บาท' : ''}">${
                            esc(MockFmt.baht(billed))}</span>` : '<span class="td-sub">—</span>'}</td>
                    <td style="white-space:nowrap">${flagCell}</td>
                    <td>${MockRefer.statusHtml(r)}</td>
                    <td class="td-sub">${esc(MockAdmin.userName(r.owner))}</td>
                    <td style="white-space:nowrap" onclick="event.stopPropagation()">
                        <button class="ds-icon-btn" title="เปิดรายละเอียด" onclick="ReferList.open('${esc(r.id)}')">
                            <i data-lucide="eye" class="icon-sm"></i></button>
                        <button class="ds-icon-btn edit" title="มอบหมายงาน" onclick="ReferList.openAssign('${esc(r.id)}')">
                            <i data-lucide="user-plus" class="icon-sm"></i></button>
                        <button class="ds-icon-btn neutral" title="ดูธงความเสี่ยง" onclick="ReferList.openRisk('${esc(r.id)}')">
                            <i data-lucide="shield-check" class="icon-sm"></i></button>
                    </td>
                </tr>`;
            }).join('');
        }

        /* KPI นับจากชุดที่กรองอยู่ — สิ่งที่เห็นคือสิ่งที่นับ
           ยกเว้น AP/AR ที่เป็นสถานะการเงินรวมทั้งระบบ จึงอ่านจาก netPosition() ตรง ๆ
           (ตัวเลขนี้ต้องตรงกับ refer-billing และ claim-dashboard) */
        const np       = MockRefer.netPosition();
        const expiring = new Set(MockRefer.expiringSoon(7).map(r => r.id));

        document.getElementById('rowCount').textContent = rows.length + ' รายการ';
        document.getElementById('kpiTotal').textContent  = MockFmt.int(rows.length);
        document.getElementById('kpiError').textContent  = MockFmt.int(rows.filter(r => MockRefer.hasError(r)).length);
        document.getElementById('kpiExpire').textContent = MockFmt.int(rows.filter(r => expiring.has(r.id)).length);
        document.getElementById('kpiAp').textContent     = MockFmt.baht(np.ap);
        document.getElementById('kpiAr').textContent     = MockFmt.baht(np.ar);
        document.getElementById('kpiRisk').textContent   = MockFmt.baht(
            rows.reduce((a, r) => a + MockRefer.amountAtRisk(r), 0));

        refreshIcons();   // ⚠️ ต้องเรียกทุกครั้งหลัง innerHTML
    },

    /* ── เลือกหลายรายการ ── */

    toggle(id, el) {
        if (el.checked) this.state.selected.add(id); else this.state.selected.delete(id);
    },

    toggleAll(el) {
        const rows = this.visible();
        if (el.checked) rows.forEach(r => this.state.selected.add(r.id));
        else rows.forEach(r => this.state.selected.delete(r.id));
        this.render();
    },

    /* ── การกระทำ ── */

    open(id) { location.href = 'refer-case.html?id=' + encodeURIComponent(id); },

    openRisk(id) {
        const r = MockRefer.byId(id); if (!r) return;
        const flags = MockRefer.flags(r);

        const body = flags.length
            ? flags.map(f => `
                <div class="section-card" style="margin-bottom:12px">
                    <div class="section-header">
                        <div class="section-title">
                            <span class="sip-chip ${f.level === 'ERROR' ? 'sip-chip-danger'
                                : f.level === 'WARNING' ? 'sip-chip-amber' : 'sip-chip-muted'}">${esc(f.code)}</span>
                            ${esc(f.label)}
                        </div>
                        <div class="section-actions">
                            ${f.maps_to_nhso ? `<span class="sip-chip sip-chip-danger"
                                title="รหัสที่ สปสช. จะตอบกลับถ้าไม่แก้">จะติด ${esc(f.maps_to_nhso)}</span>` : ''}
                            <span class="td-sub">เสี่ยง ${esc(MockFmt.baht(f.amount_at_risk))} บาท</span>
                        </div>
                    </div>
                    <div style="padding:0 4px 8px">${esc(f.detail)}</div>
                    <table class="ds-table-grid"><tbody>${
                        Object.entries(f.evidence || {}).map(([k, v]) =>
                            `<tr><td class="l" style="width:34%">${esc(k)}</td><td class="l">${esc(v)}</td></tr>`).join('')
                    }</tbody></table>
                    <div class="td-sub" style="padding:8px 4px 0">
                        กฎอ้างอิง: <a href="claim-rules.html?rule=${encodeURIComponent(f.rule_id)}">${esc(f.rule_id)}</a>
                    </div>
                </div>`).join('')
            : '<div class="sip-banner sip-banner-success"><i data-lucide="check-circle-2" class="icon-sm"></i> ไม่พบประเด็นที่ต้องแก้ไข</div>';

        Drawer.open({
            title: `ธงความเสี่ยง — ${r.id}`,
            contentHtml: `<div class="ds-note" style="margin-bottom:12px">
                    <i data-lucide="user" class="icon-sm"></i> ${esc(r.patient)} · HN ${esc(r.hn)} ·
                    ${esc(MockRefer.dirLabel(r))} ${esc(r.partner_name)} · กองทุน ${esc(r.fund)}
                </div>${body}`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>
                         <button class="btn btn-save" onclick="ReferList.open('${esc(r.id)}')">เปิดรายละเอียด</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    openAssign(id) {
        const r = MockRefer.byId(id); if (!r) return;
        const users = MockAdmin.users().filter(u => u.active).map(u =>
            `<option value="${esc(u.id)}" ${u.id === r.owner ? 'selected' : ''}>${esc(u.name)} — ${esc(u.dept)}</option>`).join('');
        const kinds = TASK_KINDS.map(k =>
            `<option value="${esc(k.key)}" ${k.key === 'APPROVE_REFER' ? 'selected' : ''}>${esc(k.label)}</option>`).join('');
        const first = MockRefer.flags(r)[0];

        Drawer.open({
            title: 'มอบหมายงาน — ' + r.id,
            contentHtml: `
                <div class="ds-note" style="margin-bottom:14px">
                    <i data-lucide="user" class="icon-sm"></i> ${esc(r.patient)} · HN ${esc(r.hn)} ·
                    ${esc(MockRefer.partnerLabel(r))} ${esc(r.partner_name)} ·
                    มูลค่าเสี่ยง ${esc(MockFmt.baht(MockRefer.amountAtRisk(r)))} บาท
                </div>
                <div class="sip-field">
                    <label class="sip-label">เรื่อง *</label>
                    <input class="sip-input" id="aTitle" value="${esc(first ? first.label
                        : `อนุมัติการส่งต่อ ${r.patient} → ${r.partner_name}`)}">
                </div>
                <div class="sip-field-row">
                    <div class="sip-field">
                        <label class="sip-label">ประเภทงาน</label>
                        <select class="sip-select" id="aKind">${kinds}</select>
                    </div>
                    <div class="sip-field">
                        <label class="sip-label">ความสำคัญ</label>
                        <select class="sip-select" id="aPrio">
                            <option value="HIGH" ${first ? 'selected' : ''}>สูง</option>
                            <option value="NORMAL" ${first ? '' : 'selected'}>ปกติ</option>
                            <option value="LOW">ต่ำ</option>
                        </select>
                    </div>
                </div>
                <div class="sip-field-row">
                    <div class="sip-field">
                        <label class="sip-label">ผู้รับผิดชอบ *</label>
                        <select class="sip-select" id="aOwner">${users}</select>
                    </div>
                    <div class="sip-field">
                        <label class="sip-label">กำหนดเสร็จ</label>
                        <input class="sip-input" id="aDue" type="date" value="2026-08-12">
                    </div>
                </div>
                <div class="sip-field">
                    <label class="sip-label">รายละเอียด / สิ่งที่ต้องทำ</label>
                    <textarea class="sip-textarea" id="aDetail" rows="4">${esc(first
                        ? `${first.code} — ${first.detail}` +
                          (first.maps_to_nhso ? `\nถ้าไม่แก้จะได้รหัส ${first.maps_to_nhso} กลับมาจาก สปสช.` : '')
                        : `วงเงินที่ขอ ${MockFmt.baht(r.cap_amount)} บาท · ขอบเขต: ${MockRefer.scopeLabel(r)}`)}</textarea>
                </div>
                <div class="sip-banner sip-banner-info">
                    <i data-lucide="info" class="icon-sm"></i>
                    งานที่มอบหมายจะไปโผล่ในหน้า "งานและการอนุมัติ" พร้อมนับ SLA ทันที
                    — ผู้ขอไม่สามารถอนุมัติเองได้ (BR-05)
                </div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                         <button class="btn btn-save" onclick="ReferList.saveAssign('${esc(r.id)}')">มอบหมายงาน</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    saveAssign(id) {
        const title = document.getElementById('aTitle').value.trim();
        if (!title) { showToast('กรุณากรอกเรื่อง', 'warning'); return; }

        /* input[type=date] ทำงานเป็น ค.ศ. — แปลงกลับเป็น พ.ศ. ให้ตรงกับข้อมูลจำลอง */
        const d   = document.getElementById('aDue').value;
        const due = d ? `${(+d.slice(0, 4)) + 543}${d.slice(4)}T16:00` : '2569-08-12T16:00';

        const t = MockTasks.create({
            refer_id: id,
            kind:     document.getElementById('aKind').value,
            title,
            owner:    document.getElementById('aOwner').value,
            due_at:   due,
            priority: document.getElementById('aPrio').value,
            detail:   document.getElementById('aDetail').value.trim(),
        });

        Drawer.close();
        showToast(`มอบหมายงาน ${t.id} ให้ ${MockAdmin.userName(t.owner)} แล้ว`);
        this.render();
    },

    /** ส่งขออนุมัติหลายรายการ — ด่านเดียวกับที่ claim-worklist ใช้กันการส่งเบิกทั้งที่ยังมีปัญหา */
    async submitSelected() {
        const ids = [...this.state.selected];
        if (!ids.length) { showToast('ยังไม่ได้เลือกรายการ', 'warning'); return; }

        const rows = ids.map(i => MockRefer.byId(i)).filter(Boolean);

        /* ⚠️ ต้องตรงกับ ReferNew.validate(f, true) และ ReferCase.requestApproval()
              ไม่งั้นผู้ใช้จะส่งได้จากหน้าหนึ่งแต่ส่งไม่ได้จากอีกหน้า ทั้งที่เป็นรายการเดียวกัน
              ไม่เช็ค reviewer ตรงนี้ เพราะการกดส่งจากหน้านี้คือการตรวจทานเอง —
              doSubmit() จะลงชื่อผู้ตรวจทานให้ทุกรายการที่ส่ง */
        const reasonOf = r =>
              r.direction !== 'OUT'      ? 'เป็นรายการรับส่งต่อเข้า — ไม่ต้องขออนุมัติวงเงิน'
            : MockRefer.hasError(r)      ? 'มีธงความเสี่ยงระดับ ERROR ค้างอยู่'
            : r.auth_no                  ? 'มีเลขอนุมัติแล้ว'
            : r.status === 'WAIT_APPR'   ? 'อยู่ระหว่างรออนุมัติอยู่แล้ว'
            : !MockRefer.reviewComplete(r)
                ? `สรุปทางคลินิกยังไม่ครบ — ขาด ${MockRefer.reviewMissing(r).map(m => m.label).join(' · ')}`
            : null;

        const blocked = rows.filter(r => reasonOf(r));
        const ready   = rows.filter(r => !reasonOf(r));

        if (blocked.length) {
            Drawer.open({
                title: 'ส่งขออนุมัติไม่ได้บางรายการ',
                contentHtml: `
                    <div class="sip-banner sip-banner-danger">
                        <i data-lucide="x-circle" class="icon-sm"></i>
                        มี ${blocked.length} รายการที่ยังส่งขออนุมัติไม่ได้
                        ${ready.length ? `· อีก ${ready.length} รายการพร้อมส่ง` : ''}
                    </div>
                    <table class="data-table compact"><thead><tr>
                        <th>รหัส</th><th>ผู้ป่วย</th><th>คู่สัญญา</th><th>เหตุผลที่ยังส่งไม่ได้</th>
                    </tr></thead><tbody>${blocked.map(r => `<tr>
                        <td class="td-sub">${esc(r.id)}</td>
                        <td>${esc(r.patient)}</td>
                        <td class="td-sub">${esc(r.partner_name)}</td>
                        <td>${esc(reasonOf(r))}</td>
                    </tr>`).join('')}</tbody></table>
                    <div class="ds-note"><i data-lucide="shield-check" class="icon-sm"></i>
                        นี่คือด่านที่ทำให้ไม่มีใบส่งตัวออกไปทั้งที่ยังมีปัญหาค้าง —
                        ถ้าปล่อยผ่าน จะไปรู้ตอนปลายทางเรียกเก็บมาแล้ว ซึ่งแก้ไม่ได้แล้ว</div>`,
                footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>
                    ${ready.length ? `<button class="btn btn-save"
                        onclick="Drawer.close(); ReferList.doSubmit(${JSON.stringify(ready.map(r => r.id)).replace(/"/g, '&quot;')})">
                        ส่งขออนุมัติ ${ready.length} รายการที่พร้อม</button>` : ''}`,
                onOpen: () => refreshIcons(),
            });
            return;
        }

        this.doSubmit(ready.map(r => r.id));
    },

    async doSubmit(ids) {
        const rows = ids.map(i => MockRefer.byId(i)).filter(Boolean);
        if (!rows.length) return;

        const me = MockSession.userId();

        const ok = await Drawer.confirm({
            title: `ตรวจทานและส่งขออนุมัติ ${rows.length} รายการ?`,
            message: `คุณจะถูกบันทึกเป็นเจ้าหน้าที่ผู้ตรวจทานทุกรายการที่ส่ง `
                   + `แล้วระบบจะสร้างงานให้ผู้มีอำนาจอนุมัติคนอื่น — ผู้ตรวจทานอนุมัติเองไม่ได้ (BR-05)`,
            lines: rows.slice(0, 6).map(r =>
                `${r.id} · ${r.patient} → ${r.partner_name} · ${MockFmt.baht(r.cap_amount)} บาท`),
            confirmText: 'ตรวจทานแล้ว ส่งขออนุมัติ',
            danger: false,
        });
        if (!ok) return;

        /* ผู้อนุมัติต้องไม่ใช่ผู้ขอ — เลือกคนแรกที่มีสิทธิ์ APPROVE_RULE และไม่ใช่ผู้ใช้ปัจจุบัน */
        const approver = (MockAdmin.users().find(u => u.active && u.id !== me &&
                            (u.roles || []).some(x => /APPROVER/i.test(x))) ||
                          MockAdmin.users().find(u => u.active && u.id !== me) || {}).id;

        const now  = '2569-08-06T09:00';
        const note = 'ตรวจทานคำขอเป็นชุดจากหน้าทะเบียน — สรุปทางคลินิกครบและไม่มีธง ERROR ค้าง';

        rows.forEach(r => {
            /* ลงชื่อผู้ตรวจทานก่อนเสมอ ไม่งั้นงานจะไปถึงโต๊ะอนุมัติแบบไม่มี maker */
            MockDB.patch('referrals', r.id, {
                reviewed_by: me, reviewer_name: MockAdmin.userName(me),
                reviewed_at: now, review_note: r.review_note || note,
                timeline: [...(r.timeline || []), {
                    at: now, tone: 'success', title: 'เจ้าหน้าที่ตรวจทานคำขอ',
                    by: MockAdmin.userName(me), note,
                }],
            });
            MockRefer.requestApproval(r.id, {
                owner: approver,
                detail: `วงเงินที่ขอ ${MockFmt.baht(r.cap_amount)} บาท · ขอบเขต: ${MockRefer.scopeLabel(r)}\n`
                      + `เจ้าของไข้: ${MockRefer.doctorMeta(r).attending || '—'} · `
                      + `ผู้เขียนใบส่งต่อ: ${r.doctor || '—'}\n`
                      + `ตรวจทานโดย: ${MockAdmin.userName(me)}`,
            });
        });

        this.state.selected.clear();
        showToast(`ตรวจทานและส่งขออนุมัติ ${rows.length} รายการแล้ว — ติดตามได้ที่หน้างานและการอนุมัติ`);
        this.render();
    },

    /* ── ใบพิมพ์ ── */

    buildReport() {
        const C = DocParts.CELL;
        const warnings = [];
        const rows = this.visible();

        const th = (t, w) => `<th style="${C}font-size:11px;font-weight:700;text-align:center;`
                           + `${w ? 'width:' + w + ';' : ''}">${DocParts.esc(t)}</th>`;

        const body = rows.map((r, i) => `<tr>
            <td style="${C}text-align:center;">${i + 1}</td>
            <td style="${C}">${DocParts.esc(r.id)}</td>
            <td style="${C}text-align:center;">${DocParts.esc(MockRefer.dirLabel(r))}</td>
            <td style="${C}">${DocParts.esc(r.patient)}</td>
            <td style="${C}">${DocParts.esc(r.partner_name)}</td>
            <td style="${C}" class="${DocPrint.miss(r.letter_no, 'เลขที่ใบส่งตัวของ ' + r.id, warnings)}">
                ${DocParts.esc(r.letter_no || '')}</td>
            <td style="${C}" class="${DocPrint.miss(r.auth_no, 'เลขอนุมัติของ ' + r.id, warnings)}">
                ${DocParts.esc(r.auth_no || '')}</td>
            <td style="${C}text-align:center;">${DocParts.esc(MockFmt.dateTH(r.expires_at))}</td>
            <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(r.cap_amount))}</td>
            <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(MockRefer.sumBilled(r)))}</td>
            <td style="${C}text-align:center;">${DocParts.esc(
                MockRefer.flags(r).map(f => f.code.replace('REF-', '')).join(', ') || '—')}</td>
            <td style="${C}text-align:center;">${DocParts.esc(MockRefer.statusMeta(r).label)}</td>
        </tr>`).join('');

        const fields = [
            ['ทิศทาง', this.state.dir === 'all' ? 'ทั้งหมด' : MockRefer.dirMeta(this.state.dir).label],
            ['จำนวน', rows.length + ' รายการ'],
            ['วงเงินรวม', MockFmt.baht(rows.reduce((a, r) => a + (r.cap_amount || 0), 0)) + ' บาท'],
            ['ยอดเรียกเก็บรวม', MockFmt.baht(rows.reduce((a, r) => a + MockRefer.sumBilled(r), 0)) + ' บาท'],
            ['ผู้พิมพ์', MockSession.user().full_name],
        ];

        const html = `<div style="color:#000;font-size:12px;">
            ${DocParts.docHead({ title: 'ทะเบียนการส่งต่อผู้ป่วย', formCode: 'REF/2569', fields })}
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>
                    ${th('ลำดับ', '30px')}${th('รหัส', '96px')}${th('ทิศทาง', '52px')}${th('ผู้ป่วย')}
                    ${th('คู่สัญญา', '17%')}${th('เลขที่ใบส่งตัว', '92px')}${th('เลขอนุมัติ', '80px')}
                    ${th('หมดอายุ', '66px')}${th('วงเงิน', '62px')}${th('เรียกเก็บ', '62px')}
                    ${th('ธง', '58px')}${th('สถานะ', '76px')}
                </tr></thead>
                <tbody>${DocParts.fillRows(body, 18, 12)}</tbody>
            </table>
            ${DocParts.signatureBlock(['ลงชื่อ ผู้จัดทำ', 'ลงชื่อ ผู้ตรวจสอบ'])}
            ${DocParts.footer(fields)}
        </div>`;

        return { html: DocParts.toPrintBorders(html), warnings };
    },

    openPrint() {
        if (!this.visible().length) { showToast('ยังไม่มีรายการให้พิมพ์', 'warning'); return; }
        const { html, warnings } = this.buildReport();
        DocPrint.preview({ title: 'ตัวอย่างก่อนพิมพ์ — ทะเบียนการส่งต่อ', html, warnings });
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.ReferList = ReferList;
document.addEventListener('DOMContentLoaded', () => ReferList.init());
