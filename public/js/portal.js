/* ────────────────────────────────────────────────────────
   Portal — หน้า home ของบทบาท

   pattern ที่ยกมาใช้ซ้ำได้:
     • KPI คลิกแล้ว scrollTo(section) — ทำให้ตัวเลขบนสุดพาไปที่รายละเอียดได้ทันที
     • การ์ด section โครงเดียวกันทุกใบ (header + count + body ที่เลื่อนในตัวเอง)
   ──────────────────────────────────────────────────────── */

const Portal = {
    state: { items: [], depts: [], weekOffset: 0 },

    /* ป้าย KPI — เพิ่ม/ลดได้ที่นี่ที่เดียว · target = id ของ section ที่จะเลื่อนไป */
    KPIS: [
        { key: 'total',   label: 'ทั้งหมด',      icon: 'inbox',           target: 'sec-draft' },
        { key: 'draft',   label: 'ร่าง',          icon: 'pencil-line',     target: 'sec-draft' },
        { key: 'urgent',  label: 'ด่วน',          icon: 'alert-triangle',  target: 'sec-urgent', critical: true },
        { key: 'done',    label: 'ยืนยันแล้ว',    icon: 'check-circle-2',  target: 'sec-done' },
        { key: 'dept',    label: 'หน่วยงาน',      icon: 'building-2',      target: 'sec-dept' },
    ],

    async init() {
        const u = Auth.getUser();
        if (u) document.getElementById('dpGreet').textContent =
            `งานของ ${u.full_name} · ${u.role_label || u.active_role}`;

        this.startClock();
        this.renderCalendar();
        await this.load();
    },

    startClock() {
        const tick = () => {
            const now = new Date();
            document.getElementById('dpClock').textContent =
                now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
            document.getElementById('dpDateLine').textContent =
                now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        };
        tick();
        setInterval(tick, 1000);
    },

    async load() {
        try {
            const [items, depts] = await Promise.all([
                fetch('/api/registry?limit=500').then(r => r.json()),
                fetch('/api/settings/departments').then(r => r.json()),
            ]);
            if (!Array.isArray(items)) throw new Error(items.error || 'โหลดข้อมูลไม่สำเร็จ');
            this.state.items = items;
            this.state.depts = Array.isArray(depts) ? depts : [];
            this.render();
        } catch (err) {
            console.error('[Portal] load', err);
            showToast(err.message, 'error');
        }
    },

    render() {
        const all    = this.state.items;
        const draft  = all.filter(r => r.status === 'DRAFT');
        const done   = all.filter(r => r.status === 'CONFIRMED');
        const urgent = draft.filter(r => r.priority === 'URGENT');

        const counts = { total: all.length, draft: draft.length, urgent: urgent.length,
                         done: done.length, dept: this.state.depts.length };

        document.getElementById('dpKpiGrid').innerHTML = this.KPIS.map(k => `
      <div class="sip-kpi ${k.critical ? 'critical' : ''}" onclick="Portal.scrollTo('${k.target}')">
        <i data-lucide="${k.icon}" class="sip-kpi-icon icon-lg"></i>
        <div class="sip-kpi-value">${counts[k.key] ?? 0}</div>
        <div class="sip-kpi-label">${esc(k.label)}</div>
      </div>`).join('');

        this.fill('listDraft',  'cntDraft',  draft.slice(0, 20));
        this.fill('listUrgent', 'cntUrgent', urgent, 'urgent');
        this.fill('listDone',   'cntDone',   done.slice(0, 20), 'done');

        // สรุปตามหน่วยงาน
        const byDept = new Map();
        all.forEach(r => {
            const k = r.department_name || 'ไม่ระบุหน่วยงาน';
            byDept.set(k, (byDept.get(k) || 0) + 1);
        });
        document.getElementById('cntDept').textContent = byDept.size;
        document.getElementById('listDept').innerHTML = byDept.size
            ? [...byDept.entries()].map(([name, n]) => `
        <div class="dp-list-item" onclick="location.href='registry.html'">
          <div class="dp-li-icon"><i data-lucide="building-2" class="icon-sm"></i></div>
          <div class="dp-li-body">
            <div class="dp-li-title">${esc(name)}</div>
            <div class="dp-li-meta">${n} รายการ</div>
          </div>
        </div>`).join('')
            : '<div class="dp-empty">ยังไม่มีข้อมูล</div>';

        refreshIcons();
    },

    fill(listId, countId, rows, tone) {
        document.getElementById(countId).textContent = rows.length;
        document.getElementById(listId).innerHTML = rows.length
            ? rows.map(r => `
        <div class="dp-list-item ${tone || ''}" onclick="location.href='registry.html'">
          <div class="dp-li-icon"><i data-lucide="file-text" class="icon-sm"></i></div>
          <div class="dp-li-body">
            <div class="dp-li-title">${esc(r.item_name)}</div>
            <div class="dp-li-meta">
              ${esc(r.item_code)} · ${esc(r.department_name || 'ไม่ระบุหน่วยงาน')}
              ${r.priority === 'URGENT' ? ' · <b style="color:var(--status-danger)">ด่วน</b>' : ''}
            </div>
          </div>
        </div>`).join('')
            : '<div class="dp-empty">ไม่มีรายการ</div>';
    },

    scrollTo(id) {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    /* ── ปฏิทินรายสัปดาห์ (โครงว่างพร้อมต่อ API) ── */
    shiftWeek(d) {
        this.state.weekOffset = d === 0 ? 0 : this.state.weekOffset + d;
        this.renderCalendar();
    },

    renderCalendar() {
        const DAYS  = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
        const HOURS = [8, 10, 12, 14, 16];

        const base = new Date();
        base.setDate(base.getDate() + this.state.weekOffset * 7);
        // จันทร์ของสัปดาห์นั้น (getDay(): 0=อา จึงต้องหมุน)
        const monday = new Date(base);
        monday.setDate(base.getDate() - ((base.getDay() + 6) % 7));

        const fmt = (d) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        const last = new Date(monday); last.setDate(monday.getDate() + 6);
        document.getElementById('dpCalWeekLabel').textContent = `${fmt(monday)} – ${fmt(last)}`;

        const todayKey = new Date().toDateString();
        let html = '<div class="dp-cal-time-label"></div>';
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday); d.setDate(monday.getDate() + i);
            const isToday = d.toDateString() === todayKey;
            html += `<div class="dp-cal-day-header ${isToday ? 'today' : ''}">${DAYS[i]} ${d.getDate()}</div>`;
        }
        HOURS.forEach(h => {
            html += `<div class="dp-cal-time-label">${String(h).padStart(2, '0')}:00</div>`;
            for (let i = 0; i < 7; i++) html += '<div class="dp-cal-cell"></div>';
        });
        document.getElementById('dpCalGrid').innerHTML = html;

        document.getElementById('dpCalFilters').innerHTML = [
            ['evt-type-1', 'งานประจำ'], ['evt-type-4', 'นัดหมาย'], ['evt-type-6', 'เร่งด่วน'],
        ].map(([cls, label]) => `
      <span class="dp-cal-filter active">
        <span class="dp-cal-dot ${cls}" style="background:currentColor"></span> ${label}
      </span>`).join('');
    },

    openSettings() {
        Drawer.open({
            title: 'ตั้งค่าของฉัน',
            contentHtml: `
        <div class="dps-group">
          <div class="dps-group-title">การแสดงผล</div>
          <div class="dps-field">
            <label class="dps-label">หน่วยงานเริ่มต้น</label>
            <select class="sip-select" id="setDept">
              <option value="">ทุกหน่วยงาน</option>
              ${this.state.depts.map(d => `<option value="${d.department_id}">${esc(d.department_name)}</option>`).join('')}
            </select>
            <div class="dps-hint">ใช้เป็นตัวกรองเริ่มต้นเมื่อเปิดหน้ารายการ</div>
          </div>
          <div class="dps-row2">
            <div class="dps-field">
              <label class="dps-label">จำนวนรายการต่อการ์ด</label>
              <input class="sip-input" type="number" value="20" min="5" max="100">
            </div>
            <div class="dps-field">
              <label class="dps-label">เริ่มต้นที่แท็บ</label>
              <select class="sip-select"><option>ร่างที่รอยืนยัน</option><option>เรื่องด่วน</option></select>
            </div>
          </div>
        </div>
        <div class="dps-group">
          <div class="dps-group-title">การแจ้งเตือน</div>
          <label class="dps-check"><input type="checkbox" class="sip-checkbox" checked> แจ้งเมื่อมีเรื่องด่วนเข้าใหม่</label>
          <label class="dps-check"><input type="checkbox" class="sip-checkbox"> สรุปงานค้างตอนสิ้นวัน</label>
        </div>
        <div class="ds-note"><i data-lucide="info" class="icon-sm"></i>
          หน้านี้เป็นโครงตัวอย่าง — ต่อ API บันทึกค่าเมื่อมีตารางตั้งค่าผู้ใช้</div>`,
            footerHtml: `
        <button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>
        <button class="btn btn-save" onclick="showToast('ยังไม่ได้ต่อ API บันทึกค่า','info')">บันทึก</button>`,
            onOpen: () => refreshIcons(),
        });
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.Portal = Portal;
document.addEventListener('DOMContentLoaded', () => Portal.init());
