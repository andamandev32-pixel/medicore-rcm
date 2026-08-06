/* ────────────────────────────────────────────────────────
   ทะเบียนรายการ — CRUD + สิทธิ์ + audit

   แพทเทิร์น JS ของระบบ: global object ไม่ใช่ IIFE
   เพราะ markup เรียก handler ตรง — onclick="Registry.edit(1)"

   ทุก fetch('/api/...') ได้ Authorization header อัตโนมัติจาก ds-auth.js
   ──────────────────────────────────────────────────────── */

const Registry = {
    state: { rows: [], depts: [], keyword: '' },

    async init() {
        // อ่านตัวกรองจาก query string (ลิงก์จากหน้าแรกส่งมา เช่น ?priority=URGENT)
        const p = new URLSearchParams(location.search);
        if (p.get('status'))   document.getElementById('fStatus').value   = p.get('status');
        if (p.get('priority')) document.getElementById('fPriority').value = p.get('priority');

        await this.loadDepartments();
        await this.load();
    },

    async loadDepartments() {
        try {
            const rows = await fetch('/api/settings/departments?active=1').then(r => r.json());
            this.state.depts = Array.isArray(rows) ? rows : [];
        } catch (err) {
            console.error('[Registry] loadDepartments', err);
        }
    },

    async load() {
        const qs = new URLSearchParams({
            status:   document.getElementById('fStatus').value,
            priority: document.getElementById('fPriority').value,
        });
        try {
            const rows = await fetch('/api/registry?' + qs).then(r => r.json());
            if (!Array.isArray(rows)) throw new Error(rows.error || 'โหลดข้อมูลไม่สำเร็จ');
            this.state.rows = rows;
            this.render();
        } catch (err) {
            console.error('[Registry] load', err);
            showToast(err.message, 'error');
            document.getElementById('rows').innerHTML =
                '<tr><td colspan="7" class="ds-empty">โหลดข้อมูลไม่สำเร็จ</td></tr>';
        }
    },

    visible() {
        const kw = this.state.keyword.toLowerCase();
        if (!kw) return this.state.rows;
        return this.state.rows.filter(r =>
            (r.item_name + ' ' + r.item_code).toLowerCase().includes(kw));
    },

    render() {
        const rows  = this.visible();
        const tbody = document.getElementById('rows');
        const canWrite   = Auth.hasRole('DOCTOR', 'NURSE', 'PHARMACIST', 'ADMIN');
        const canConfirm = Auth.hasRole('DOCTOR', 'ADMIN');

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="ds-empty">ไม่พบรายการ</td></tr>';
        } else {
            tbody.innerHTML = rows.map(r => {
                const done = r.status === 'CONFIRMED';
                return `
                <tr>
                    <td class="td-sub">${esc(r.item_code)}</td>
                    <td class="td-name">${esc(r.item_name)}</td>
                    <td class="td-sub">${esc(r.department_name || '—')}</td>
                    <td>${r.priority === 'URGENT'
                            ? '<span class="sip-chip sip-chip-danger">ด่วน</span>'
                            : '<span class="sip-chip sip-chip-muted">ปกติ</span>'}</td>
                    <td><span class="status-badge ${done ? 'completed' : 'pending'}">${done ? 'ยืนยันแล้ว' : 'ร่าง'}</span></td>
                    <td class="td-sub">${esc(fmtDate(r.updated_at))}</td>
                    <td style="white-space:nowrap">
                        <button class="ds-icon-btn" title="ดูประวัติ" onclick="Registry.history(${r.registry_item_id})">
                            <i data-lucide="history" class="icon-sm"></i>
                        </button>
                        ${!done && canConfirm ? `
                        <button class="ds-icon-btn" title="ยืนยัน" onclick="Registry.confirm(${r.registry_item_id})">
                            <i data-lucide="check-circle-2" class="icon-sm"></i>
                        </button>` : ''}
                        ${!done && canWrite ? `
                        <button class="ds-icon-btn edit" title="แก้ไข" onclick="Registry.edit(${r.registry_item_id})">
                            <i data-lucide="pencil" class="icon-sm"></i>
                        </button>` : ''}
                        ${canWrite ? `
                        <button class="ds-icon-btn" title="ลบ" onclick="Registry.remove(${r.registry_item_id})">
                            <i data-lucide="trash-2" class="icon-sm"></i>
                        </button>` : ''}
                    </td>
                </tr>`;
            }).join('');
        }

        const all = this.state.rows;
        document.getElementById('rowCount').textContent  = rows.length + ' รายการ';
        document.getElementById('kpiTotal').textContent     = all.length;
        document.getElementById('kpiDraft').textContent     = all.filter(r => r.status === 'DRAFT').length;
        document.getElementById('kpiUrgent').textContent    = all.filter(r => r.priority === 'URGENT' && r.status === 'DRAFT').length;
        document.getElementById('kpiConfirmed').textContent = all.filter(r => r.status === 'CONFIRMED').length;

        refreshIcons();   // ⚠️ ต้องเรียกทุกครั้งหลัง render ไอคอนใหม่
    },

    onSearch() {
        this.state.keyword = document.getElementById('searchBox').value.trim();
        this.render();
    },

    /* ── ฟอร์มเพิ่ม/แก้ไข ใช้ markup เดียวกัน ── */
    _formHtml(r) {
        const opts = this.state.depts.map(d =>
            `<option value="${d.department_id}" ${r && r.department_id === d.department_id ? 'selected' : ''}>
                ${esc(d.department_name)}</option>`).join('');
        return `
            <div class="sip-field">
                <label class="sip-label">ชื่อรายการ *</label>
                <input class="sip-input" id="fName" value="${esc(r ? r.item_name : '')}" placeholder="พิมพ์ชื่อรายการ...">
            </div>
            <div class="sip-field-row">
                <div class="sip-field">
                    <label class="sip-label">หน่วยงาน</label>
                    <select class="sip-select" id="fDept"><option value="">— ไม่ระบุ —</option>${opts}</select>
                </div>
                <div class="sip-field">
                    <label class="sip-label">ความเร่งด่วน</label>
                    <select class="sip-select" id="fPrio">
                        <option value="ROUTINE" ${r && r.priority === 'ROUTINE' ? 'selected' : ''}>ปกติ</option>
                        <option value="URGENT"  ${r && r.priority === 'URGENT'  ? 'selected' : ''}>ด่วน</option>
                    </select>
                </div>
            </div>
            <div class="sip-field">
                <label class="sip-label">รายละเอียด</label>
                <textarea class="sip-textarea" id="fDetail" rows="4">${esc(r ? (r.detail || '') : '')}</textarea>
            </div>
            <div class="ds-note"><i data-lucide="info" class="icon-sm"></i>
                บันทึกเป็น "ร่าง" — ต้องให้ผู้มีสิทธิ์กดยืนยันจึงจะปิดรายการ</div>`;
    },

    openCreate() {
        Drawer.open({
            title: 'เพิ่มรายการใหม่',
            contentHtml: this._formHtml(null),
            footerHtml: `
                <button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                <button class="btn btn-save" onclick="Registry.save()">บันทึก</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    async edit(id) {
        try {
            const r = await fetch('/api/registry/' + id).then(x => x.json());
            if (r.error) throw new Error(r.error);
            Drawer.open({
                title: 'แก้ไข ' + r.item_code,
                contentHtml: this._formHtml(r),
                footerHtml: `
                    <button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                    <button class="btn btn-save" onclick="Registry.save(${id}, ${r.rev})">บันทึก</button>`,
                onOpen: () => refreshIcons(),
            });
        } catch (err) {
            showToast(err.message, 'error');
        }
    },

    /**
     * id = null → สร้างใหม่ · id + rev → แก้ไข
     * rev คือรุ่นของข้อมูลที่ผู้ใช้เห็นตอนเปิดฟอร์ม — server จะปฏิเสธ (409)
     * ถ้ามีคนอื่นแก้ไปก่อน กันการเขียนทับกันเงียบ ๆ
     */
    async save(id = null, rev = null) {
        const body = {
            item_name:     document.getElementById('fName').value.trim(),
            department_id: document.getElementById('fDept').value || null,
            priority:      document.getElementById('fPrio').value,
            detail:        document.getElementById('fDetail').value.trim(),
        };
        if (!body.item_name) { showToast('กรุณากรอกชื่อรายการ', 'warning'); return; }
        if (id !== null) body.rev = rev;

        try {
            const res = await fetch(id ? '/api/registry/' + id : '/api/registry', {
                method:  id ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');

            Drawer.close();
            showToast(id ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มรายการแล้ว');
            this.load();
        } catch (err) {
            showToast(err.message, 'error');
        }
    },

    async confirm(id) {
        const ok = await Drawer.confirm({
            title: 'ยืนยันรายการนี้?',
            message: 'เมื่อยืนยันแล้วจะแก้ไขเนื้อหาไม่ได้อีก',
            confirmText: 'ยืนยันรายการ',
        });
        if (!ok) return;

        try {
            const res  = await fetch(`/api/registry/${id}/confirm`, { method: 'PUT' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'ยืนยันไม่สำเร็จ');
            showToast('ยืนยันแล้ว');
            this.load();
        } catch (err) {
            showToast(err.message, 'error');
        }
    },

    async remove(id) {
        const row = this.state.rows.find(r => r.registry_item_id === id);
        const ok = await Drawer.confirm({
            title: 'ลบรายการนี้?',
            message: 'รายการจะถูกซ่อนจากทุกหน้า แต่ประวัติยังเก็บไว้ใน audit log',
            lines: row ? [`${row.item_code} · ${row.item_name}`] : [],
            confirmText: 'ลบรายการ',
            danger: true,
        });
        if (!ok) return;

        try {
            const res  = await fetch('/api/registry/' + id, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'ลบไม่สำเร็จ');
            showToast('ลบแล้ว');
            this.load();
        } catch (err) {
            showToast(err.message, 'error');
        }
    },

    /* ────────────────────────────────────────────────────────
       พิมพ์รายงาน — สร้าง HTML → DocPrint.preview() → ผู้ใช้กดพิมพ์เอง
       คัดลอกฟังก์ชันคู่นี้ไปทำเอกสารอื่นได้เลย
       ──────────────────────────────────────────────────────── */

    /** สร้าง HTML ใบพิมพ์ · คืน { html, warnings } */
    buildReport() {
        const C = DocParts.CELL;
        const warnings = [];

        // ⚠️ ใบพิมพ์ใช้ "รายการที่กรองอยู่บนจอ" — สิ่งที่เห็นคือสิ่งที่ได้
        const rows = this.visible();

        const th = (t, w) => `<th style="${C}font-size:11px;font-weight:700;text-align:center;`
                           + `${w ? 'width:' + w + ';' : ''}">${DocParts.esc(t)}</th>`;

        const body = rows.map((r, i) => `<tr>
        <td style="${C}text-align:center;">${i + 1}</td>
        <td style="${C}">${DocParts.esc(r.item_code)}</td>
        <td style="${C}">${DocParts.esc(r.item_name)}</td>
        <td style="${C}" class="${DocPrint.miss(r.department_name, `หน่วยงานของ ${r.item_code}`, warnings)}">
          ${DocParts.esc(r.department_name || '')}</td>
        <td style="${C}text-align:center;">${r.priority === 'URGENT' ? 'ด่วน' : 'ปกติ'}</td>
        <td style="${C}text-align:center;">${r.status === 'CONFIRMED' ? 'ยืนยันแล้ว' : 'ร่าง'}</td>
        <td style="${C}">${DocParts.esc(r.confirmed_by_name || '')}</td>
      </tr>`).join('');

        const u = Auth.getUser() || {};
        const fields = [
            ['หน่วยงาน', document.getElementById('fStatus').value === 'all' ? 'ทุกสถานะ' : 'เฉพาะที่กรอง'],
            ['จำนวน', rows.length + ' รายการ'],
            ['ผู้พิมพ์', u.full_name || '—'],
        ];

        const html = `<div style="color:#000;font-size:12px;">
      ${DocParts.docHead({ title: 'ทะเบียนรายการ', formCode: 'RG/2569', fields })}
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          ${th('ลำดับ', '40px')}${th('รหัส', '70px')}${th('ชื่อรายการ')}
          ${th('หน่วยงาน', '18%')}${th('เร่งด่วน', '60px')}${th('สถานะ', '70px')}${th('ผู้ยืนยัน', '16%')}
        </tr></thead>
        <tbody>${DocParts.fillRows(body, 16, 7)}</tbody>
      </table>
      ${DocParts.signatureBlock(['ลงชื่อ ผู้จัดทำ', 'ลงชื่อ ผู้ตรวจสอบ'])}
      ${DocParts.footer(fields)}
    </div>`;

        return { html: DocParts.toPrintBorders(html), warnings };
    },

    openPrint() {
        if (!this.state.rows.length) { showToast('ยังไม่มีรายการให้พิมพ์', 'warning'); return; }
        const { html, warnings } = this.buildReport();
        DocPrint.preview({
            title: 'ตัวอย่างก่อนพิมพ์ — ทะเบียนรายการ',
            html,
            warnings,
        });
    },

    async history(id) {
        try {
            const rows = await fetch(`/api/registry/${id}/history`).then(r => r.json());
            if (!Array.isArray(rows)) throw new Error(rows.error || 'โหลดประวัติไม่สำเร็จ');

            const html = rows.length
                ? `<div class="ds-timeline">${rows.map(a => `
                    <div class="ds-timeline-item ${ACTION_TONE[a.action] || ''}">
                        <strong>${esc(ACTION_LABEL[a.action] || a.action)}</strong>
                        โดย ${esc(a.actor_name || '—')}${a.actor_role ? ` (${esc(a.actor_role)})` : ''}
                        ${a.note ? `<div class="td-sub">${esc(a.note)}</div>` : ''}
                        <span class="ds-timeline-time">${esc(fmtDate(a.created_at))}</span>
                    </div>`).join('')}</div>`
                : '<div class="ds-empty">ยังไม่มีประวัติ</div>';

            Drawer.open({ title: 'ประวัติการแก้ไข', contentHtml: html, onOpen: () => refreshIcons() });
        } catch (err) {
            showToast(err.message, 'error');
        }
    },
};

const ACTION_LABEL = { CREATE: 'สร้างรายการ', UPDATE: 'แก้ไข', CONFIRM: 'ยืนยัน', DELETE: 'ลบ' };
const ACTION_TONE  = { CREATE: 'info', UPDATE: '', CONFIRM: 'success', DELETE: 'danger' };

/* helper มาตรฐานของทุกหน้า — กัน XSS ตอน render ค่าลง innerHTML */
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

window.Registry = Registry;
document.addEventListener('DOMContentLoaded', () => Registry.init());
