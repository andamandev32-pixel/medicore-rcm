/* ────────────────────────────────────────────────────────
   บันทึกงาน — workspace 2 คอลัมน์ + แท็บหลายมุมมอง + ออกเอกสาร

   pattern แท็บที่ยกมาใช้ซ้ำได้ (แม่แบบของทุกหน้าที่มีหลายมุมมองต่อเรื่องเดียว):
     TABS[]  → นิยามแท็บ (key/label/icon)
     render  → ชื่อเมท็อดใน Work ที่จะถูกเรียกเมื่อเปิดแท็บนั้น
     • ไม่มีเมท็อด = ขึ้น "กำลังพัฒนา…" ไม่พังทั้งหน้า
     • จำแท็บล่าสุดใน localStorage + รับ ?tab=xxx จาก URL (ส่งลิงก์ตรงเข้าแท็บได้)
   ──────────────────────────────────────────────────────── */

const TAB_STORE = 'work_active_tab';

const Work = {
    state: { items: [], selected: null, current: null, history: [], filter: 'all', keyword: '', tab: null },

    TABS: [
        { key: 'overview', label: 'ภาพรวม',   icon: 'layout-grid', render: 'renderOverview' },
        { key: 'note',     label: 'บันทึก',    icon: 'pen-line',    render: 'renderNote' },
        { key: 'history',  label: 'ประวัติ',   icon: 'history',     render: 'renderHistory' },
        { key: 'docs',     label: 'เอกสาร',    icon: 'printer',     render: 'renderDocs' },
    ],

    async init() {
        const p = new URLSearchParams(location.search);
        this.state.tab = p.get('tab') || localStorage.getItem(TAB_STORE) || 'overview';

        const now = new Date();
        document.getElementById('shiftLabel').textContent =
            now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' });

        await this.loadDepartments();
        await this.load();
    },

    async loadDepartments() {
        try {
            const rows = await fetch('/api/settings/departments?active=1').then(r => r.json());
            if (!Array.isArray(rows)) return;
            document.getElementById('deptSelect').insertAdjacentHTML('beforeend',
                rows.map(d => `<option value="${d.department_id}">${esc(d.department_name)}</option>`).join(''));
        } catch (err) { console.error('[Work] loadDepartments', err); }
    },

    async load() {
        const dept = document.getElementById('deptSelect').value;
        const qs = new URLSearchParams({ limit: 300 });
        if (dept) qs.set('department_id', dept);
        try {
            const rows = await fetch('/api/registry?' + qs).then(r => r.json());
            if (!Array.isArray(rows)) throw new Error(rows.error || 'โหลดข้อมูลไม่สำเร็จ');
            this.state.items = rows;
            this.renderList();
            if (this.state.selected && rows.some(r => r.registry_item_id === this.state.selected)) {
                this.select(this.state.selected);
            } else {
                this.clearDetail();
            }
        } catch (err) {
            console.error('[Work] load', err);
            showToast(err.message, 'error');
        }
    },

    /* ── คอลัมน์ซ้าย ── */
    visible() {
        const kw = this.state.keyword.toLowerCase();
        return this.state.items.filter(it => {
            if (this.state.filter === 'draft'  && it.status !== 'DRAFT') return false;
            if (this.state.filter === 'urgent' && it.priority !== 'URGENT') return false;
            if (kw && !(it.item_name + ' ' + it.item_code).toLowerCase().includes(kw)) return false;
            return true;
        });
    },

    renderList() {
        const rows = this.visible();
        document.getElementById('listContainer').innerHTML = rows.length
            ? rows.map(it => `
        <div class="ds-list-card ${this.state.selected === it.registry_item_id ? 'active' : ''}"
             onclick="Work.select(${it.registry_item_id})">
          <div class="ds-list-card-top">
            <span class="ds-list-card-name">${esc(it.item_name)}</span>
            ${it.priority === 'URGENT' ? '<span class="kbadge kbadge-alert">ด่วน</span>' : ''}
            ${it.status === 'CONFIRMED' ? '<span class="kbadge kbadge-done">ยืนยัน</span>' : ''}
          </div>
          <div class="ds-list-card-detail">${esc(it.item_code)} · ${esc(it.department_name || 'ไม่ระบุหน่วยงาน')}</div>
        </div>`).join('')
            : '<div class="ds-empty">ไม่พบรายการ</div>';

        const all = this.state.items;
        document.getElementById('listCount').textContent = rows.length + ' รายการ';
        document.getElementById('cntAll').textContent    = all.length;
        document.getElementById('cntDraft').textContent  = all.filter(i => i.status === 'DRAFT').length;
        document.getElementById('cntUrgent').textContent = all.filter(i => i.priority === 'URGENT').length;
        refreshIcons();
    },

    setFilter(f, btn) {
        this.state.filter = f;
        document.querySelectorAll('.ds-pilltab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderList();
    },

    onSearch() {
        this.state.keyword = document.getElementById('listSearch').value.trim();
        this.renderList();
    },

    toggleLeft() { document.getElementById('shell').classList.toggle('left-collapsed'); },

    clearDetail() {
        this.state.selected = null; this.state.current = null;
        document.getElementById('emptyState').style.display = '';
        document.getElementById('detailWrap').style.display = 'none';
    },

    /* ── เลือกเรื่อง ── */
    async select(id) {
        this.state.selected = id;
        try {
            const [it, hist] = await Promise.all([
                fetch('/api/registry/' + id).then(r => r.json()),
                fetch(`/api/registry/${id}/history`).then(r => r.json()),
            ]);
            if (it.error) throw new Error(it.error);
            this.state.current = it;
            this.state.history = Array.isArray(hist) ? hist : [];

            document.getElementById('emptyState').style.display = 'none';
            document.getElementById('detailWrap').style.display = '';

            const done = it.status === 'CONFIRMED';
            document.getElementById('ctxAvatar').textContent = it.item_name.charAt(0);
            document.getElementById('ctxName').textContent   = it.item_name;
            document.getElementById('ctxCode').textContent   = 'รหัส: ' + it.item_code;
            document.getElementById('ctxDept').textContent   = 'หน่วยงาน: ' + (it.department_name || '—');
            document.getElementById('ctxBy').textContent     = 'ผู้บันทึก: ' + (it.created_by_name || '—');
            document.getElementById('ctxDate').textContent   = 'อัปเดต: ' + fmtDate(it.updated_at);

            const chip = document.getElementById('ctxChip');
            chip.textContent = done ? 'ยืนยันแล้ว' : 'ร่าง';
            chip.className   = 'sip-chip ' + (done ? 'sip-chip-success' : 'sip-chip-active');
            document.getElementById('ctxAlert').style.display = it.priority === 'URGENT' ? '' : 'none';

            this.renderTabs();
            this.renderList();
        } catch (err) {
            showToast(err.message, 'error');
        }
    },

    /* ── แท็บ ── */
    renderTabs() {
        document.getElementById('tabBar').innerHTML = this.TABS.map(t => `
      <button class="ds-tab ${this.state.tab === t.key ? 'active' : ''}" onclick="Work.switchTab('${t.key}')">
        <i data-lucide="${t.icon}" class="mi"></i> ${esc(t.label)}
        ${t.key === 'history' && this.state.history.length
            ? `<span class="tab-notif">${this.state.history.length}</span>` : ''}
      </button>`).join('');
        this.renderTabBody();
    },

    switchTab(key) {
        this.state.tab = key;
        localStorage.setItem(TAB_STORE, key);
        this.renderTabs();
    },

    renderTabBody() {
        const tab = this.TABS.find(t => t.key === this.state.tab) || this.TABS[0];
        const mount = document.getElementById('tabContent');
        const fn = this[tab.render];
        mount.innerHTML = typeof fn === 'function'
            ? fn.call(this, this.state.current)
            : `<div class="ds-empty-state">
                 <div class="ds-empty-state-title">กำลังพัฒนา…</div>
                 <div class="ds-empty-state-desc">ยังไม่มี Work.${esc(tab.render)}()</div>
               </div>`;
        refreshIcons();
    },

    renderOverview(it) {
        return `<div class="cards-row">
      <div class="clinical-card">
        <div class="card-title">รายละเอียด</div>
        <div>${esc(it.detail || '— ยังไม่มีรายละเอียด —')}</div>
      </div>
      <div class="clinical-card">
        <div class="card-title">ข้อมูลการบันทึก</div>
        <div class="td-sub">สร้างเมื่อ: ${esc(fmtDate(it.created_at))}</div>
        <div class="td-sub">ผู้ยืนยัน: ${esc(it.confirmed_by_name || '—')}</div>
        <div class="td-sub">ยืนยันเมื่อ: ${esc(fmtDate(it.confirmed_at))}</div>
        <div class="td-sub">รุ่นข้อมูล (rev): ${it.rev}</div>
      </div>
    </div>`;
    },

    renderNote(it) {
        const done = it.status === 'CONFIRMED';
        const canWrite = Auth.hasRole('DOCTOR', 'NURSE', 'PHARMACIST', 'ADMIN') && !done;
        return `
      ${done ? `<div class="sip-banner sip-banner-warning">
        <i data-lucide="lock" class="icon-sm"></i> รายการนี้ยืนยันแล้ว — แก้ไขไม่ได้</div>` : ''}
      <div class="section-card" style="margin-top:12px">
        <div class="sip-field">
          <label class="sip-label">รายละเอียดการปฏิบัติงาน</label>
          <textarea class="sip-textarea" id="noteInput" rows="8"
                    ${canWrite ? '' : 'disabled'}>${esc(it.detail || '')}</textarea>
        </div>
        <div class="section-actions" style="justify-content:flex-end">
          <button class="btn btn-outline" onclick="Work.select(${it.registry_item_id})">ยกเลิก</button>
          <button class="btn btn-save" ${canWrite ? '' : 'disabled'} onclick="Work.saveNote()">บันทึก</button>
        </div>
      </div>`;
    },

    renderHistory() {
        const rows = this.state.history;
        if (!rows.length) return '<div class="ds-empty">ยังไม่มีประวัติ</div>';
        return `<div class="ds-timeline">${rows.map(a => `
      <div class="ds-timeline-item ${ACTION_TONE[a.action] || ''}">
        <strong>${esc(ACTION_LABEL[a.action] || a.action)}</strong>
        โดย ${esc(a.actor_name || '—')}${a.actor_role ? ` (${esc(a.actor_role)})` : ''}
        <span class="ds-timeline-time">${esc(fmtDate(a.created_at))}</span>
      </div>`).join('')}</div>`;
    },

    renderDocs() {
        return `<div class="section-card">
      <div class="section-header">
        <div class="section-title"><i data-lucide="file-text" class="mi"></i> เอกสารที่ออกได้</div>
      </div>
      <div class="ds-note"><i data-lucide="info" class="icon-sm"></i>
        กดพิมพ์แล้วจะเปิดตัวอย่างกระดาษ A4 ให้ตรวจก่อน — ซูม/ลากดูได้ แล้วค่อยสั่งพิมพ์จริง</div>
      <div class="ds-actions" style="border:0;background:none;padding:12px 0 0">
        <button class="btn btn-outline" onclick="Work.printRecord()">
          <i data-lucide="printer" class="icon-sm"></i> ใบบันทึกการปฏิบัติงาน
        </button>
        <button class="btn btn-outline" onclick="Work.printHistory()">
          <i data-lucide="history" class="icon-sm"></i> ใบประวัติการแก้ไข
        </button>
      </div>
    </div>`;
    },

    async saveNote() {
        const it = this.state.current;
        try {
            const res = await fetch('/api/registry/' + it.registry_item_id, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rev: it.rev, detail: document.getElementById('noteInput').value.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
            showToast('บันทึกแล้ว');
            this.load();
        } catch (err) { showToast(err.message, 'error'); }
    },

    showAlert() {
        Drawer.open({
            title: 'ความเร่งด่วน',
            contentHtml: `<div class="sip-banner sip-banner-danger">
        รายการนี้ถูกตั้งความเร่งด่วนเป็น "ด่วน" — ควรจัดการก่อนรายการปกติ</div>`,
            onOpen: () => refreshIcons(),
        });
    },

    /* ── เอกสาร ── */
    _fields(it) {
        return [
            ['เลขที่', it.item_code],
            ['เรื่อง', it.item_name],
            ['หน่วยงาน', it.department_name || ''],
        ];
    },

    printRecord() {
        const it = this.state.current;
        const warnings = [];
        const C = DocParts.CELL;
        const row = (label, value, required) => `<tr>
      <td style="${C}width:26%;font-weight:700;">${DocParts.esc(label)}</td>
      <td style="${C}" class="${required ? DocPrint.miss(value, label, warnings) : ''}">
        ${DocParts.esc(value || '')}</td>
    </tr>`;

        const html = `<div style="color:#000;font-size:12px;">
      ${DocParts.docHead({ title: 'ใบบันทึกการปฏิบัติงาน', formCode: 'WK/2569', fields: this._fields(it) })}
      <table style="width:100%;border-collapse:collapse;">
        ${row('เลขที่รายการ', it.item_code, true)}
        ${row('ชื่อรายการ', it.item_name, true)}
        ${row('หน่วยงาน', it.department_name, true)}
        ${row('ความเร่งด่วน', it.priority === 'URGENT' ? 'ด่วน' : 'ปกติ')}
        ${row('สถานะ', it.status === 'CONFIRMED' ? 'ยืนยันแล้ว' : 'ร่าง')}
        ${row('ผู้บันทึก', it.created_by_name, true)}
        ${row('ผู้ยืนยัน', it.confirmed_by_name)}
        <tr>
          <td style="${C}font-weight:700;">รายละเอียดการปฏิบัติงาน</td>
          <td style="${C}height:150px;vertical-align:top;"
              class="${DocPrint.miss(it.detail, 'รายละเอียดการปฏิบัติงาน', warnings)}">
            ${DocParts.esc(it.detail || '')}</td>
        </tr>
      </table>
      ${DocParts.signatureBlock(['ลงชื่อ ผู้บันทึก', 'ลงชื่อ ผู้ตรวจสอบ'])}
      ${DocParts.footer(this._fields(it))}
    </div>`;

        DocPrint.preview({
            title: 'ตัวอย่างก่อนพิมพ์ — ใบบันทึกการปฏิบัติงาน',
            html: DocParts.toPrintBorders(html),
            warnings,
        });
    },

    printHistory() {
        const it = this.state.current;
        const C = DocParts.CELL;
        const th = (t, w) => `<th style="${C}font-size:11px;font-weight:700;text-align:center;`
                           + `${w ? 'width:' + w + ';' : ''}">${t}</th>`;
        const body = this.state.history.map((a, i) => `<tr>
      <td style="${C}text-align:center;">${i + 1}</td>
      <td style="${C}">${DocParts.esc(fmtDate(a.created_at))}</td>
      <td style="${C}">${DocParts.esc(ACTION_LABEL[a.action] || a.action)}</td>
      <td style="${C}">${DocParts.esc(a.actor_name || '')}</td>
      <td style="${C}">${DocParts.esc(a.actor_role || '')}</td>
      <td style="${C}">${DocParts.esc(a.note || '')}</td>
    </tr>`).join('');

        const html = `<div style="color:#000;font-size:12px;">
      ${DocParts.docHead({ title: 'ใบประวัติการแก้ไข', formCode: 'WK-LOG/2569', fields: this._fields(it) })}
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          ${th('ลำดับ', '40px')}${th('วันเวลา', '110px')}${th('การกระทำ', '90px')}
          ${th('ผู้กระทำ', '20%')}${th('บทบาท', '80px')}${th('หมายเหตุ')}
        </tr></thead>
        <tbody>${DocParts.fillRows(body, 14, 6)}</tbody>
      </table>
      ${DocParts.signatureBlock(['ลงชื่อ ผู้รับรองสำเนา'])}
      ${DocParts.footer(this._fields(it))}
    </div>`;

        DocPrint.preview({
            title: 'ตัวอย่างก่อนพิมพ์ — ใบประวัติการแก้ไข',
            html: DocParts.toPrintBorders(html),
        });
    },
};

const ACTION_LABEL = { CREATE: 'สร้างรายการ', UPDATE: 'แก้ไข', CONFIRM: 'ยืนยัน', DELETE: 'ลบ' };
const ACTION_TONE  = { CREATE: 'info', UPDATE: '', CONFIRM: 'success', DELETE: 'danger' };

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDate(v) {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d)) return String(v);
    return d.toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

window.Work = Work;
document.addEventListener('DOMContentLoaded', () => Work.init());
