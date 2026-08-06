/* ────────────────────────────────────────────────────────
   พื้นที่ทำงาน 3 คอลัมน์ — เลือกรายการซ้าย ทำงานที่แผงขวา

   แพทเทิร์นเดียวกับ registry.js: global object + esc() + refreshIcons()
   ──────────────────────────────────────────────────────── */

const Workspace = {
    state: { items: [], selected: null, current: null, filter: 'all', keyword: '' },

    async init() {
        await this.loadDepartments();
        await this.load();
    },

    async loadDepartments() {
        try {
            const rows = await fetch('/api/settings/departments?active=1').then(r => r.json());
            if (!Array.isArray(rows)) return;
            const sel = document.getElementById('deptSelect');
            sel.insertAdjacentHTML('beforeend', rows.map(d =>
                `<option value="${d.department_id}">${esc(d.department_name)}</option>`).join(''));
        } catch (err) {
            console.error('[Workspace] loadDepartments', err);
        }
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
            // ถ้ารายการที่เลือกอยู่ยังอยู่ในผลลัพธ์ ให้โหลดรายละเอียดใหม่ ไม่งั้นเคลียร์
            if (this.state.selected && rows.some(r => r.registry_item_id === this.state.selected)) {
                this.select(this.state.selected);
            } else {
                this.clearDetail();
            }
        } catch (err) {
            console.error('[Workspace] load', err);
            showToast(err.message, 'error');
        }
    },

    reload() { this.load(); },

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
                     onclick="Workspace.select(${it.registry_item_id})">
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

    clearDetail() {
        this.state.selected = null;
        this.state.current  = null;
        document.getElementById('emptyState').style.display = '';
        document.getElementById('detailWrap').style.display = 'none';
        document.getElementById('noteInput').value = '';
    },

    async select(id) {
        this.state.selected = id;
        try {
            const it = await fetch('/api/registry/' + id).then(r => r.json());
            if (it.error) throw new Error(it.error);
            this.state.current = it;

            document.getElementById('emptyState').style.display = 'none';
            document.getElementById('detailWrap').style.display = '';

            const done = it.status === 'CONFIRMED';
            document.getElementById('ctxAvatar').textContent = it.item_name.charAt(0);
            document.getElementById('ctxName').textContent   = it.item_name;
            document.getElementById('ctxId').textContent     = 'รหัส: ' + it.item_code;
            document.getElementById('ctxDept').textContent   = 'หน่วยงาน: ' + (it.department_name || '—');
            document.getElementById('ctxDate').textContent   = 'อัปเดต: ' + fmtDate(it.updated_at);

            const chip = document.getElementById('ctxChip');
            chip.textContent = done ? 'ยืนยันแล้ว' : 'ร่าง';
            chip.className   = 'sip-chip ' + (done ? 'sip-chip-success' : 'sip-chip-active');

            document.getElementById('ctxAlert').style.display = it.priority === 'URGENT' ? '' : 'none';

            document.getElementById('ovDetail').textContent = it.detail || '— ยังไม่มีรายละเอียด —';
            document.getElementById('ovMeta').innerHTML = `
                <div class="td-sub">ผู้บันทึก: ${esc(it.created_by_name || '—')}</div>
                <div class="td-sub">สร้างเมื่อ: ${esc(fmtDate(it.created_at))}</div>
                <div class="td-sub">ผู้ยืนยัน: ${esc(it.confirmed_by_name || '—')}</div>
                <div class="td-sub">ยืนยันเมื่อ: ${esc(fmtDate(it.confirmed_at))}</div>`;

            // แผงขวา: ยืนยันแล้ว = อ่านอย่างเดียว (server ก็ปฏิเสธเช่นกัน — นี่คือชั้น UX)
            const canWrite   = Auth.hasRole('DOCTOR', 'NURSE', 'PHARMACIST', 'ADMIN') && !done;
            const canConfirm = Auth.hasRole('DOCTOR', 'ADMIN') && !done;
            const note = document.getElementById('noteInput');
            note.value    = it.detail || '';
            note.disabled = !canWrite;
            document.getElementById('btnSave').disabled    = !canWrite;
            document.getElementById('btnConfirm').disabled = !canConfirm;
            document.getElementById('lockedBanner').style.display = done ? '' : 'none';

            this.loadHistory(id);
            this.renderList();
            refreshIcons();
        } catch (err) {
            showToast(err.message, 'error');
        }
    },

    async loadHistory(id) {
        try {
            const rows = await fetch(`/api/registry/${id}/history`).then(r => r.json());
            if (!Array.isArray(rows)) return;

            document.getElementById('historyList').innerHTML = rows.length
                ? rows.map(a => `
                    <div class="ds-timeline-item ${ACTION_TONE[a.action] || ''}">
                        <strong>${esc(ACTION_LABEL[a.action] || a.action)}</strong>
                        โดย ${esc(a.actor_name || '—')}${a.actor_role ? ` (${esc(a.actor_role)})` : ''}
                        <span class="ds-timeline-time">${esc(fmtDate(a.created_at))}</span>
                    </div>`).join('')
                : '<div class="ds-empty">ยังไม่มีประวัติ</div>';

            const badge = document.getElementById('histBadge');
            badge.textContent = rows.length;
            badge.style.display = rows.length ? '' : 'none';
        } catch (err) {
            console.error('[Workspace] loadHistory', err);
        }
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

    switchTab(name, btn) {
        document.querySelectorAll('.ds-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.ds-tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById({ overview: 'tabOverview', history: 'tabHistory' }[name]).classList.add('active');
        refreshIcons();
    },

    toggleLeft() { document.getElementById('shell').classList.toggle('left-collapsed'); },

    showAlert() {
        Drawer.open({
            title: 'ความเร่งด่วน',
            contentHtml: `<div class="sip-banner sip-banner-danger">
                รายการนี้ถูกตั้งความเร่งด่วนเป็น "ด่วน" — ควรจัดการก่อนรายการปกติ</div>`,
            onOpen: () => refreshIcons(),
        });
    },

    /** ส่ง rev ที่อ่านมาตอน select() — server ปฏิเสธ 409 ถ้ามีคนแก้ไปก่อน */
    async saveDetail() {
        const it = this.state.current;
        if (!it) { showToast('กรุณาเลือกรายการก่อน', 'warning'); return; }

        try {
            const res = await fetch('/api/registry/' + it.registry_item_id, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    rev:    it.rev,
                    detail: document.getElementById('noteInput').value.trim(),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
            showToast('บันทึกแล้ว');
            await this.load();
            return true;
        } catch (err) {
            showToast(err.message, 'error');
            return false;
        }
    },

    async confirm() {
        const it = this.state.current;
        if (!it) { showToast('กรุณาเลือกรายการก่อน', 'warning'); return; }

        const ok = await Drawer.confirm({
            title: 'บันทึกและยืนยันรายการนี้?',
            message: 'เมื่อยืนยันแล้วจะแก้ไขเนื้อหาไม่ได้อีก',
            lines: [`${it.item_code} · ${it.item_name}`],
            confirmText: 'ยืนยันรายการ',
        });
        if (!ok) return;

        // บันทึกเนื้อหาก่อน แล้วค่อยยืนยัน — ถ้าบันทึกไม่ผ่านต้องไม่ยืนยันตาม
        if (!await this.saveDetail()) return;

        try {
            const res  = await fetch(`/api/registry/${it.registry_item_id}/confirm`, { method: 'PUT' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'ยืนยันไม่สำเร็จ');
            showToast('ยืนยันแล้ว');
            this.load();
        } catch (err) {
            showToast(err.message, 'error');
        }
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

window.Workspace = Workspace;
document.addEventListener('DOMContentLoaded', () => Workspace.init());
