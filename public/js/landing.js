/* ────────────────────────────────────────────────────────
   หน้าแรก — login + สรุปตัวเลข + รายการล่าสุด

   แพทเทิร์น JS ของระบบ: global object ไม่ใช่ IIFE
   เพราะ markup เรียก handler ตรง — onsubmit="Landing.login(event)"
   ──────────────────────────────────────────────────────── */

const Landing = {

    async init() {
        this.showLoginMessage();

        if (Auth.isLoggedIn()) {
            this.showApp();
        } else {
            document.getElementById('loginOverlay').style.display = '';
            document.getElementById('loginUser').focus();
        }
    },

    /* ?expired=1 / ?denied=1 มาจาก ds-auth.js และ Auth.requireRole() */
    showLoginMessage() {
        const p = new URLSearchParams(location.search);
        if (p.get('expired')) this.error('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
        if (p.get('denied'))  this.error('บัญชีนี้ไม่มีสิทธิ์เข้าถึงหน้าที่เรียก');
    },

    error(msg) {
        const el = document.getElementById('loginError');
        el.textContent = msg;
        el.style.display = msg ? '' : 'none';
    },

    async login(ev) {
        ev.preventDefault();
        const btn  = document.getElementById('loginBtn');
        const user = document.getElementById('loginUser').value.trim();
        const pass = document.getElementById('loginPass').value;

        if (!user || !pass) { this.error('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'); return; }

        this.error('');
        btn.disabled = true;
        btn.textContent = 'กำลังเข้าสู่ระบบ...';
        try {
            await Auth.login(user, pass);
            // reload แทนการซ่อน overlay เฉย ๆ — navbar/role gate ถูก render ไปแล้ว
            // ตอนยังไม่ล็อกอิน การโหลดใหม่ทำให้ทุกอย่างตรงกับ role จริงโดยไม่ต้องไล่ refresh ทีละส่วน
            location.replace('index.html');
        } catch (err) {
            this.error(err.message || 'เข้าสู่ระบบไม่สำเร็จ');
            btn.disabled = false;
            btn.textContent = 'เข้าสู่ระบบ';
        }
    },

    showApp() {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = '';

        DSNavbar.init();          // navbar อยู่ใน #mainApp จึง init หลังเปิดหน้า
        Auth.applyRoleGate();     // ซ่อนการ์ด/ทางลัดที่ role นี้ไม่มีสิทธิ์

        const u = Auth.getUser();
        if (u) {
            document.getElementById('heroGreeting').textContent =
                `สวัสดี ${u.full_name} — ${u.role_label || u.active_role}`;
        }

        this.startClock();
        this.loadStats();
        refreshIcons();
    },

    startClock() {
        const tick = () => {
            const now = new Date();
            document.getElementById('heroClock').textContent =
                now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
            document.getElementById('heroDate').textContent =
                now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        };
        tick();
        setInterval(tick, 1000);
    },

    async loadStats() {
        try {
            const [items, depts] = await Promise.all([
                fetch('/api/registry?limit=500').then(r => r.json()),
                fetch('/api/settings/departments').then(r => r.json()),
            ]);
            if (!Array.isArray(items)) throw new Error(items.error || 'โหลดข้อมูลไม่สำเร็จ');

            const draft     = items.filter(i => i.status === 'DRAFT').length;
            const confirmed = items.filter(i => i.status === 'CONFIRMED').length;
            const urgent    = items.filter(i => i.priority === 'URGENT' && i.status === 'DRAFT').length;

            const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
            set('stTotal', items.length);      set('modTotal', items.length);
            set('stDraft', draft);             set('modDraft', draft);
            set('stUrgent', urgent);           set('modUrgent', urgent);
            set('stConfirmed', confirmed);     set('modDone', confirmed);
            set('stDept', Array.isArray(depts) ? depts.length : '–');

            this.renderRecent(items.slice(0, 5));
        } catch (err) {
            console.error('[Landing] loadStats', err);
            document.getElementById('recentList').innerHTML =
                '<div class="ds-empty-sm">โหลดข้อมูลไม่สำเร็จ</div>';
        }

        // ผู้ใช้: เห็นเฉพาะ ADMIN (endpoint เปิดให้ทุกคนอ่าน แต่การ์ดถูก role gate ซ่อนไว้)
        if (Auth.hasRole('ADMIN')) {
            try {
                const users = await fetch('/api/settings/users').then(r => r.json());
                if (Array.isArray(users)) document.getElementById('modUsers').textContent = users.length;
            } catch { /* ไม่ critical */ }
        }
    },

    renderRecent(rows) {
        const box = document.getElementById('recentList');
        if (!rows.length) { box.innerHTML = '<div class="ds-empty-sm">ยังไม่มีรายการ</div>'; return; }

        const color = r => r.priority === 'URGENT' ? 'var(--red)'
                         : r.status === 'CONFIRMED' ? 'var(--green)' : 'var(--blue)';
        box.innerHTML = rows.map(r => `
            <div class="act-item">
                <div class="act-dot" style="background:${color(r)}"></div>
                <div class="act-text">${esc(r.item_code)} · ${esc(r.item_name)}</div>
                <div class="act-time">${esc(r.status === 'CONFIRMED' ? 'ยืนยันแล้ว' : 'ร่าง')}</div>
            </div>`).join('');
    },
};

/* helper มาตรฐานของทุกหน้า — กัน XSS ตอน render ค่าลง innerHTML */
function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.Landing = Landing;
document.addEventListener('DOMContentLoaded', () => Landing.init());
