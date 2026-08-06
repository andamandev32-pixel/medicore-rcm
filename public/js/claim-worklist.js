/* ────────────────────────────────────────────────────────
   รายการเคลม (Claim Worklist) — SRS §10

   แพทเทิร์นเดียวกับ registry.js: global object ไม่ใช่ IIFE
   ต่างกันที่แหล่งข้อมูลเป็น MockDB แทน fetch('/api/...')
   ──────────────────────────────────────────────────────── */

const Worklist = {

    state: { result: 'all', selected: new Set() },

    init() {
        MockSession.mountBanner('demoBanner');

        const p = new URLSearchParams(location.search);
        if (p.get('result')) this.state.result = p.get('result');
        if (p.get('stage'))  this._pendingStage = p.get('stage');

        this.fillFilters();
        this.renderSeg();
        this.render();
    },

    reload() { this.state.selected.clear(); this.render(); showToast('รีเฟรชข้อมูลแล้ว'); },

    /* ── ตัวกรอง ── */

    fillFilters() {
        const claims = MockClaims.all();

        const funds = [...new Set(claims.map(c => c.fund))].sort();
        document.getElementById('fFund').insertAdjacentHTML('beforeend',
            funds.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join(''));

        const provs = [...new Set(claims.map(c => c.provider))].sort();
        document.getElementById('fProvider').insertAdjacentHTML('beforeend',
            provs.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join(''));

        const stageSel = document.getElementById('fStage');
        stageSel.insertAdjacentHTML('beforeend', NHSO_STATUS_PIPELINE.map(s =>
            `<option value="${esc(s.key)}">${esc(s.label)}</option>`).join(''));
        if (this._pendingStage) stageSel.value = this._pendingStage;
    },

    renderSeg() {
        const counts = MockClaims.countByResult();
        const total  = MockClaims.all().length;
        const segs = [{ key: 'all', label: 'ทั้งหมด', n: total }]
            .concat(MockTone.RESULTS.map(r => ({ key: r, label: MockTone.resultLabel[r], n: counts[r] || 0 })));

        document.getElementById('segResult').innerHTML = segs.map(s => `
            <button class="ds-seg ${s.key === this.state.result ? 'active' : ''}"
                    onclick="Worklist.setResult('${s.key}')">${esc(s.label)} (${s.n})</button>`).join('');
    },

    setResult(key) {
        this.state.result = key;
        this.renderSeg();
        this.render();
    },

    visible() {
        const kw    = document.getElementById('searchBox').value.trim().toLowerCase();
        const fund  = document.getElementById('fFund').value;
        const svc   = document.getElementById('fService').value;
        const prov  = document.getElementById('fProvider').value;
        const risk  = document.getElementById('fRisk').value;
        const stage = document.getElementById('fStage').value;

        return MockClaims.all().filter(c => {
            if (this.state.result !== 'all' && c.result !== this.state.result) return false;
            if (fund  !== 'all' && c.fund !== fund) return false;
            if (svc   !== 'all' && c.service_type !== svc) return false;
            if (prov  !== 'all' && c.provider !== prov) return false;
            if (stage !== 'all' && (!c.nhso || c.nhso.stage !== stage)) return false;
            if (risk === 'high' && c.risk_score < 70) return false;
            if (risk === 'mid'  && (c.risk_score < 40 || c.risk_score > 69)) return false;
            if (risk === 'low'  && c.risk_score > 39) return false;
            if (kw && !(`${c.id} ${c.hn} ${c.patient} ${c.an || ''}`).toLowerCase().includes(kw)) return false;
            return true;
        });
    },

    /* ── แสดงผล ── */

    render() {
        const rows  = this.visible();
        const tbody = document.getElementById('rows');

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="14" class="ds-empty">ไม่พบเคสตามเงื่อนไขที่เลือก</td></tr>';
        } else {
            tbody.innerHTML = rows.map(c => {
                const codes = MockClaims.predictedCodes(c);
                const nhsoCell = codes.length
                    ? codes.map(k => `<span class="sip-chip sip-chip-danger" title="${esc(NHSO_ERR_TEXT[k] || '')}">${esc(k)}</span>`).join(' ')
                    : '<span class="sip-chip sip-chip-success">พร้อมส่ง</span>';

                return `
                <tr style="cursor:pointer" onclick="Worklist.open('${esc(c.id)}')">
                    <td onclick="event.stopPropagation()">
                        <input type="checkbox" ${this.state.selected.has(c.id) ? 'checked' : ''}
                               onclick="Worklist.toggle('${esc(c.id)}', this)">
                    </td>
                    <td class="td-sub" style="white-space:nowrap">${esc(c.id)}</td>
                    <td class="td-sub">${esc(c.hn)}</td>
                    <td class="td-name">${esc(c.patient)}
                        <div class="td-sub">${esc(c.age)} ปี · ${c.gender === 'F' ? 'หญิง' : 'ชาย'}${
                            c.an ? ' · AN ' + esc(c.an) : ''}</div></td>
                    <td class="td-sub" style="white-space:nowrap">${esc(MockFmt.dateTH(c.service_date))}</td>
                    <td><span class="sip-chip sip-chip-muted">${esc(c.fund)}</span></td>
                    <td class="td-sub">${esc(c.service_type)}</td>
                    <td style="text-align:right;white-space:nowrap">${esc(MockFmt.baht(c.amount_claimed))}</td>
                    <td>${DSChart.riskbar(c.risk_score)}</td>
                    <td>${MockTone.resultBadgeHtml(c.result)}</td>
                    <td style="white-space:nowrap">${nhsoCell}</td>
                    <td class="td-sub">${esc(MockAdmin.userName(c.owner))}</td>
                    <td>${c.result === 'PASS' ? '<span class="td-sub">—</span>' : MockTone.slaHtml(c.due_at)}</td>
                    <td style="white-space:nowrap" onclick="event.stopPropagation()">
                        <button class="ds-icon-btn" title="เปิดรายละเอียดเคส" onclick="Worklist.open('${esc(c.id)}')">
                            <i data-lucide="eye" class="icon-sm"></i></button>
                        <button class="ds-icon-btn edit" title="มอบหมายงาน" onclick="Worklist.openAssign('${esc(c.id)}')">
                            <i data-lucide="user-plus" class="icon-sm"></i></button>
                        <button class="ds-icon-btn neutral" title="ดูผลตรวจกฎ" onclick="Worklist.openRules('${esc(c.id)}')">
                            <i data-lucide="shield-check" class="icon-sm"></i></button>
                    </td>
                </tr>`;
            }).join('');
        }

        /* KPI คำนวณจากชุดที่กรองอยู่ — สิ่งที่เห็นคือสิ่งที่นับ */
        document.getElementById('rowCount').textContent   = rows.length + ' รายการ';
        document.getElementById('kpiTotal').textContent   = MockFmt.int(rows.length);
        document.getElementById('kpiFix').textContent     = MockFmt.int(rows.filter(c => c.result === 'FIX' || c.result === 'BLOCK').length);
        document.getElementById('kpiApprove').textContent = MockFmt.int(rows.filter(c => c.result === 'APPROVE').length);
        document.getElementById('kpiRisk').textContent    = MockFmt.baht(rows.reduce((a, c) => a + (c.amount_at_risk || 0), 0));
        document.getElementById('kpiSla').textContent     = MockFmt.int(
            rows.filter(c => c.result !== 'PASS' && MockTone.sla(c.due_at) === 'over').length);

        refreshIcons();   // ⚠️ ต้องเรียกทุกครั้งหลัง innerHTML
    },

    /* ── เลือกหลายรายการ ── */

    toggle(id, el) {
        if (el.checked) this.state.selected.add(id); else this.state.selected.delete(id);
    },

    toggleAll(el) {
        const rows = this.visible();
        if (el.checked) rows.forEach(c => this.state.selected.add(c.id));
        else rows.forEach(c => this.state.selected.delete(c.id));
        this.render();
    },

    /* ── การกระทำ ── */

    open(id) { location.href = 'claim-case.html?id=' + encodeURIComponent(id); },

    openRules(id) {
        const c = MockClaims.byId(id); if (!c) return;
        const body = (c.rule_results || []).length
            ? `<table class="data-table compact"><thead><tr>
                  <th>รหัสกฎ</th><th>Ver</th><th>ผล</th><th>ข้อความ</th><th>จะได้รหัส</th><th>อ้างอิง</th>
               </tr></thead><tbody>${c.rule_results.map(r => `
                  <tr>
                    <td class="td-sub">${esc(r.rule_id)}</td>
                    <td class="td-sub">v${esc(r.version)}</td>
                    <td>${MockTone.resultBadgeHtml(r.result)}</td>
                    <td>${esc(r.message)}</td>
                    <td>${r.maps_to_nhso
                        ? `<span class="sip-chip sip-chip-danger">${esc(r.maps_to_nhso)}</span>` : '<span class="td-sub">—</span>'}</td>
                    <td class="td-sub">${r.doc_id
                        ? `<a href="claim-knowledge.html?doc=${encodeURIComponent(r.doc_id)}">${esc(r.doc_ref || r.doc_id)}</a>`
                        : '—'}</td>
                  </tr>`).join('')}</tbody></table>`
            : '<div class="sip-banner sip-banner-success"><i data-lucide="check-circle-2" class="icon-sm"></i> ผ่านกฎทั้งหมด ไม่พบประเด็นที่ต้องแก้ไข</div>';

        Drawer.open({
            title: `ผลตรวจกฎ — ${c.id}`,
            contentHtml: `<div class="ds-note" style="margin-bottom:12px">
                    <i data-lucide="user" class="icon-sm"></i> ${esc(c.patient)} · HN ${esc(c.hn)} ·
                    ${esc(MockFmt.dateTH(c.service_date))} · กองทุน ${esc(c.fund)}
                </div>${body}`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>
                         <button class="btn btn-save" onclick="Worklist.open('${esc(c.id)}')">เปิดรายละเอียดเคส</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    openAssign(id) {
        const c = MockClaims.byId(id); if (!c) return;
        const users = MockAdmin.users().filter(u => u.active).map(u =>
            `<option value="${esc(u.id)}" ${u.id === c.owner ? 'selected' : ''}>${esc(u.name)} — ${esc(u.dept)}</option>`).join('');
        const kinds = TASK_KINDS.map(k => `<option value="${esc(k.key)}">${esc(k.label)}</option>`).join('');
        const first = (c.rule_results || [])[0];

        Drawer.open({
            title: 'มอบหมายงาน — ' + c.id,
            contentHtml: `
                <div class="ds-note" style="margin-bottom:14px">
                    <i data-lucide="user" class="icon-sm"></i> ${esc(c.patient)} · HN ${esc(c.hn)} ·
                    มูลค่าเสี่ยง ${esc(MockFmt.baht(c.amount_at_risk))} บาท
                </div>
                <div class="sip-field">
                    <label class="sip-label">เรื่อง *</label>
                    <input class="sip-input" id="aTitle" value="${esc(first ? first.message : 'ตรวจสอบและแก้ไขข้อมูลก่อนส่งเบิก')}">
                </div>
                <div class="sip-field-row">
                    <div class="sip-field">
                        <label class="sip-label">ประเภทงาน</label>
                        <select class="sip-select" id="aKind">${kinds}</select>
                    </div>
                    <div class="sip-field">
                        <label class="sip-label">ความสำคัญ</label>
                        <select class="sip-select" id="aPrio">
                            <option value="HIGH">สูง</option>
                            <option value="NORMAL" selected>ปกติ</option>
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
                        <input class="sip-input" id="aDue" type="date" value="2026-08-10">
                    </div>
                </div>
                <div class="sip-field">
                    <label class="sip-label">รายละเอียด / สิ่งที่ต้องทำ</label>
                    <textarea class="sip-textarea" id="aDetail" rows="4">${esc(first
                        ? `${first.rule_id} v${first.version} — ${first.message}` +
                          (first.maps_to_nhso ? `\nถ้าส่งทั้งอย่างนี้จะได้รหัส ${first.maps_to_nhso} กลับมาจาก สปสช.` : '')
                        : '')}</textarea>
                </div>
                <div class="sip-banner sip-banner-info">
                    <i data-lucide="info" class="icon-sm"></i>
                    งานที่มอบหมายจะไปโผล่ในหน้า "งานและการอนุมัติ" พร้อมนับ SLA ทันที
                </div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                         <button class="btn btn-save" onclick="Worklist.saveAssign('${esc(c.id)}')">มอบหมายงาน</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    saveAssign(id) {
        const title = document.getElementById('aTitle').value.trim();
        if (!title) { showToast('กรุณากรอกเรื่อง', 'warning'); return; }

        /* input[type=date] ทำงานเป็น ค.ศ. — แปลงกลับเป็น พ.ศ. ให้ตรงกับข้อมูลจำลอง */
        const d = document.getElementById('aDue').value;
        const due = d ? `${(+d.slice(0, 4)) + 543}${d.slice(4)}T16:00` : '2569-08-10T16:00';

        const t = MockTasks.create({
            claim_id: id,
            rule_id: (MockClaims.byId(id).rule_results[0] || {}).rule_id || null,
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

    async submitSelected() {
        const ids = [...this.state.selected];
        if (!ids.length) { showToast('ยังไม่ได้เลือกเคส', 'warning'); return; }

        const rows    = ids.map(i => MockClaims.byId(i)).filter(Boolean);
        const blocked = rows.filter(c => ['FIX', 'BLOCK', 'APPROVE'].includes(c.result));

        if (blocked.length) {
            Drawer.open({
                title: 'ยังส่งเบิกไม่ได้',
                contentHtml: `
                    <div class="sip-banner sip-banner-danger">
                        <i data-lucide="x-circle" class="icon-sm"></i>
                        มี ${blocked.length} เคสที่ยังมีประเด็นค้าง — ถ้าส่งไปตอนนี้จะถูกตีกลับ
                    </div>
                    <table class="data-table compact"><thead><tr>
                        <th>รหัสเคส</th><th>ผู้ป่วย</th><th>ผลตรวจ</th><th>จะได้รหัส</th><th>ผู้รับผิดชอบ</th>
                    </tr></thead><tbody>${blocked.map(c => `<tr>
                        <td class="td-sub">${esc(c.id)}</td>
                        <td>${esc(c.patient)}</td>
                        <td>${MockTone.resultBadgeHtml(c.result)}</td>
                        <td>${MockClaims.predictedCodes(c).map(k =>
                            `<span class="sip-chip sip-chip-danger">${esc(k)}</span>`).join(' ') || '—'}</td>
                        <td class="td-sub">${esc(MockAdmin.userName(c.owner))}</td>
                    </tr>`).join('')}</tbody></table>
                    <div class="ds-note"><i data-lucide="shield-check" class="icon-sm"></i>
                        นี่คือด่านที่ระบบทำแทนการส่งไปให้ สปสช. ตีกลับ — แก้ให้จบก่อนแล้วค่อยส่งรอบเดียว</div>`,
                footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>`,
                onOpen: () => refreshIcons(),
            });
            return;
        }

        const ok = await Drawer.confirm({
            title: `ส่งเบิก ${rows.length} เคสไปยัง NHSO?`,
            message: 'ระบบจะสร้างไฟล์ตาม Standard Dataset แล้วส่งผ่าน API',
            lines: rows.slice(0, 6).map(c => `${c.id} · ${c.patient} · ${MockFmt.baht(c.amount_claimed)} บาท`),
            confirmText: 'ส่งเบิก',
            danger: false,
        });
        if (!ok) return;

        rows.forEach(c => MockDB.patch('claims', c.id, {
            nhso: { ...c.nhso, stage: 'AWAIT_PROCESS', status_code: null, sub_status: 'รอประมวลผล',
                    upload_id: 'A6908' + String(600000 + Math.abs(hashCode(c.id)) % 399999) },
            timeline: [...(c.timeline || []), { at: '2569-08-06T09:00', tone: 'info',
                title: 'ส่งเบิกไปยัง NHSO', by: MockAdmin.userName(MockSession.userId()), note: 'ส่งจากหน้า Worklist (โหมดสาธิต)' }],
        }));

        this.state.selected.clear();
        showToast(`ส่งเบิก ${rows.length} เคสแล้ว — ติดตามได้ที่หน้าส่งเบิก NHSO`);
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
            <td style="${C}">${DocParts.esc(r.hn)}</td>
            <td style="${C}">${DocParts.esc(r.patient)}</td>
            <td style="${C}text-align:center;">${DocParts.esc(MockFmt.dateTH(r.service_date))}</td>
            <td style="${C}text-align:center;">${DocParts.esc(r.fund)}</td>
            <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(r.amount_claimed))}</td>
            <td style="${C}text-align:center;">${DocParts.esc(r.risk_score)}</td>
            <td style="${C}text-align:center;">${DocParts.esc(MockTone.resultLabel[r.result])}</td>
            <td style="${C}text-align:center;">${DocParts.esc(MockClaims.predictedCodes(r).join(', ') || '—')}</td>
            <td style="${C}" class="${DocPrint.miss(MockAdmin.userName(r.owner), 'ผู้รับผิดชอบของ ' + r.id, warnings)}">
                ${DocParts.esc(MockAdmin.userName(r.owner))}</td>
        </tr>`).join('');

        const fields = [
            ['ตัวกรอง', this.state.result === 'all' ? 'ทุกผลตรวจ' : MockTone.resultLabel[this.state.result]],
            ['จำนวน', rows.length + ' รายการ'],
            ['มูลค่ารวม', MockFmt.baht(rows.reduce((a, c) => a + c.amount_claimed, 0)) + ' บาท'],
            ['ผู้พิมพ์', MockSession.user().full_name],
        ];

        const html = `<div style="color:#000;font-size:12px;">
            ${DocParts.docHead({ title: 'รายการเคลมรอตรวจก่อนส่งเบิก', formCode: 'CLM/2569', fields })}
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>
                    ${th('ลำดับ', '34px')}${th('รหัสเคส', '82px')}${th('HN', '62px')}${th('ชื่อ-สกุล')}
                    ${th('วันรับบริการ', '74px')}${th('กองทุน', '48px')}${th('มูลค่า', '66px')}
                    ${th('เสี่ยง', '40px')}${th('ผลตรวจ', '62px')}${th('รหัส NHSO', '62px')}${th('ผู้รับผิดชอบ', '15%')}
                </tr></thead>
                <tbody>${DocParts.fillRows(body, 18, 11)}</tbody>
            </table>
            ${DocParts.signatureBlock(['ลงชื่อ ผู้จัดทำ', 'ลงชื่อ ผู้ตรวจสอบ'])}
            ${DocParts.footer(fields)}
        </div>`;

        return { html: DocParts.toPrintBorders(html), warnings };
    },

    openPrint() {
        if (!this.visible().length) { showToast('ยังไม่มีรายการให้พิมพ์', 'warning'); return; }
        const { html, warnings } = this.buildReport();
        DocPrint.preview({ title: 'ตัวอย่างก่อนพิมพ์ — รายการเคลม', html, warnings });
    },
};

/* ใช้สร้าง UploadID จำลองแบบคงที่ต่อเคส */
function hashCode(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return h;
}

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.Worklist = Worklist;
document.addEventListener('DOMContentLoaded', () => Worklist.init());
