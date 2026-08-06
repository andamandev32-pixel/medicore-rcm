/* ────────────────────────────────────────────────────────
   ตั้งค่า — ผู้ใช้และสิทธิ์ + หน่วยงาน (ADMIN)
   ──────────────────────────────────────────────────────── */

const ROLE_LABEL = {
    ADMIN: 'ผู้ดูแลระบบ', DOCTOR: 'แพทย์', NURSE: 'พยาบาล',
    PHARMACIST: 'เภสัชกร', NURSE_AIDE: 'ผู้ช่วยพยาบาล',
};

const Users = {
    state: { users: [], depts: [] },

    async init() {
        await Promise.all([this.load(), this.loadDepts()]);
    },

    async load() {
        try {
            const rows = await fetch('/api/settings/users').then(r => r.json());
            if (!Array.isArray(rows)) throw new Error(rows.error || 'โหลดข้อมูลไม่สำเร็จ');
            this.state.users = rows;
            this.render();
        } catch (err) {
            console.error('[Users] load', err);
            showToast(err.message, 'error');
            document.getElementById('rows').innerHTML =
                '<tr><td colspan="7" class="ds-empty">โหลดข้อมูลไม่สำเร็จ</td></tr>';
        }
    },

    render() {
        const me = Auth.getUserId();
        document.getElementById('userCount').textContent = this.state.users.length + ' คน';
        document.getElementById('rows').innerHTML = this.state.users.map(u => `
            <tr>
                <td class="td-sub">${u.user_id}</td>
                <td class="td-name">${esc(u.username)}${u.user_id === me ? ' <span class="kbadge kbadge-active">คุณ</span>' : ''}</td>
                <td>${esc(u.full_name)}</td>
                <td>${u.roles.map(r => `<span class="sip-chip sip-chip-muted">${esc(ROLE_LABEL[r] || r)}</span>`).join(' ') || '—'}</td>
                <td class="td-sub">${esc(u.license_no || '—')}</td>
                <td><span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'ใช้งาน' : 'ปิดบัญชี'}</span></td>
                <td>
                    ${u.user_id === me ? '' : `
                    <button class="ds-icon-btn ${u.is_active ? '' : 'edit'}"
                            title="${u.is_active ? 'ปิดบัญชี' : 'เปิดบัญชี'}"
                            onclick="Users.toggleActive(${u.user_id}, ${u.is_active ? 0 : 1})">
                        <i data-lucide="${u.is_active ? 'user-x' : 'user-check'}" class="icon-sm"></i>
                    </button>`}
                </td>
            </tr>`).join('');
        refreshIcons();
    },

    async toggleActive(id, next) {
        const u = this.state.users.find(x => x.user_id === id);
        const ok = await Drawer.confirm({
            title: next ? 'เปิดบัญชีนี้?' : 'ปิดบัญชีนี้?',
            message: next
                ? 'ผู้ใช้จะเข้าสู่ระบบได้อีกครั้ง'
                : 'ผู้ใช้จะถูกบังคับออกจากระบบภายใน ~60 วินาที และเข้าใหม่ไม่ได้',
            lines: u ? [`${u.username} · ${u.full_name}`] : [],
            confirmText: next ? 'เปิดบัญชี' : 'ปิดบัญชี',
            danger: !next,
        });
        if (!ok) return;

        try {
            const res = await fetch(`/api/settings/users/${id}/set-active`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ is_active: next }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'ดำเนินการไม่สำเร็จ');
            showToast(next ? 'เปิดบัญชีแล้ว' : 'ปิดบัญชีแล้ว');
            this.load();
        } catch (err) {
            showToast(err.message, 'error');
        }
    },

    /* ── หน่วยงาน ── */
    async loadDepts() {
        try {
            const rows = await fetch('/api/settings/departments').then(r => r.json());
            if (!Array.isArray(rows)) throw new Error(rows.error || 'โหลดข้อมูลไม่สำเร็จ');
            this.state.depts = rows;
            document.getElementById('deptRows').innerHTML = rows.length
                ? rows.map(d => `
                    <tr>
                        <td class="td-sub">${d.department_id}</td>
                        <td class="td-name">${esc(d.department_name)}</td>
                        <td><span class="status-badge ${d.is_active ? 'active' : 'inactive'}">${d.is_active ? 'ใช้งาน' : 'ปิด'}</span></td>
                    </tr>`).join('')
                : '<tr><td colspan="3" class="ds-empty">ยังไม่มีหน่วยงาน</td></tr>';
        } catch (err) {
            console.error('[Users] loadDepts', err);
        }
    },

    openDept() {
        Drawer.open({
            title: 'เพิ่มหน่วยงาน',
            contentHtml: `
                <div class="sip-field">
                    <label class="sip-label">ชื่อหน่วยงาน *</label>
                    <input class="sip-input" id="dName" placeholder="เช่น งานผู้ป่วยนอก">
                </div>`,
            footerHtml: `
                <button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                <button class="btn btn-save" onclick="Users.saveDept()">บันทึก</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    async saveDept() {
        const name = document.getElementById('dName').value.trim();
        if (!name) { showToast('กรุณากรอกชื่อหน่วยงาน', 'warning'); return; }
        try {
            const res = await fetch('/api/settings/departments', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ department_name: name }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
            Drawer.close();
            showToast('เพิ่มหน่วยงานแล้ว');
            this.loadDepts();
        } catch (err) {
            showToast(err.message, 'error');
        }
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.Users = Users;
document.addEventListener('DOMContentLoaded', () => Users.init());
