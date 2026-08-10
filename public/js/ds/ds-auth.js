/* =====================================================
   MediCore Starter — Auth Client (ใช้ร่วมทุกหน้า)

   ⚠️ ต้องเป็น <script> ตัวแรกของหน้า ก่อน script ที่ยิง fetch
      เพราะไฟล์นี้ห่อ window.fetch เพื่อแนบ JWT ให้อัตโนมัติ

     <script src="js/ds/ds-auth.js"></script>   ← ตัวแรกเสมอ
     <script src="js/ds/ds-icons.js"></script>
     ...

   DSNavbar อ่าน window.Auth เองอัตโนมัติ — ไม่ต้อง configure เพิ่ม
   ===================================================== */

const Auth = (() => {
    // เปลี่ยน 2 ค่านี้ถ้ารันหลายโปรเจคบน origin เดียวกัน (กัน token ปนกัน)
    const TOKEN_KEY = 'app_token';
    const USER_KEY  = 'app_user';

    // ── เก็บ / อ่าน Token ──
    function getToken()  { return localStorage.getItem(TOKEN_KEY); }
    function getUser()   {
        try { return JSON.parse(localStorage.getItem(USER_KEY)); }
        catch { return null; }
    }
    function setSession(token, user) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    function clearSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }

    // ── ถอด payload ของ JWT ──
    //
    // JWT ใช้ base64url (— และ _) แต่ atob() รับแค่ base64 มาตรฐาน (+ และ /)
    // ถ้าไม่แปลงก่อน atob จะ throw แล้ว isLoggedIn() คืน false ทั้งที่ token ยังดี
    // → requireLogin() เคลียร์ session แล้วเด้งผู้ใช้ออกทันทีที่เปิดหน้า
    //
    // ที่ผ่านมาไม่เจอเพราะขึ้นกับว่าชื่อผู้ใช้เข้ารหัสแล้วได้อักขระ -/_ หรือไม่
    // (ชื่อพยาบาลไม่ได้ ชื่อแพทย์ "นพ.ธนวัฒน์" ได้ → แพทย์ล็อกอินไม่ติดคนเดียว)
    function decodePayload(token) {
        const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        const json = decodeURIComponent(
            atob(pad).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
        );
        return JSON.parse(json);
    }

    // ── ตรวจสอบว่า Login อยู่ไหม ──
    // demo_token_* ไม่รับแล้ว — server ตรวจ JWT จริงทุก endpoint การรับ token ปลอม
    // ตรงนี้ได้ผลแค่ทำให้ UI คิดว่าล็อกอินอยู่แล้วไปเจอ 401 รัว ๆ
    function isLoggedIn() {
        const token = getToken();
        if (!token) return false;
        try {
            return decodePayload(token).exp * 1000 > Date.now();
        } catch { return false; }
    }

    // ── id ผู้ใช้ปัจจุบัน — ใช้เป็นผู้บันทึก/ผู้ปฏิบัติในทุกหน้า ──
    //
    // คืน null เมื่อไม่ทราบ ห้าม fallback เป็น 1 เด็ดขาด (เดิมหลายไฟล์เขียน
    // `catch { return 1 }` ซึ่งแปลว่าเวลาถอด token ไม่ได้ การกระทำของแพทย์
    // จะถูกบันทึกว่าเป็น user #1 = admin เงียบ ๆ เวชระเบียนชี้ผิดคน)
    function getUserId() {
        const u = getUser();
        if (u && u.user_id != null) return u.user_id;
        const t = getToken();
        if (!t) return null;
        try { return decodePayload(t).user_id ?? null; } catch { return null; }
    }

    // ── สิทธิ์ (role) ──
    //
    // ยึด active_role ตัวเดียวให้ตรงกับที่ server บังคับ — ไม่มี role = ไม่มีสิทธิ์
    // ห้าม default เป็น 'NURSE' หรือ true เด็ดขาด (ของเดิมทำแบบนั้นหลายที่
    // ผู้ใช้ที่โหลด role ไม่สำเร็จเลยได้สิทธิ์พยาบาลเต็มไปโดยปริยาย)
    function getRole()  { return getUser()?.active_role || null; }
    function hasRole(...roles) {
        const r = getRole();
        return r != null && roles.includes(r);
    }

    // ใช้แสดงตัวเลือก "สลับบทบาท" เท่านั้น — ห้ามเอาไปตัดสินสิทธิ์
    // (ถือหลาย role ไม่ได้แปลว่าใช้สิทธิ์ทุกอันพร้อมกัน ต้องสลับก่อน)
    function getRoles() { return getUser()?.roles || []; }

    // gate ระดับหน้า — เป็น UX ไม่ใช่ security (ไฟล์ static ใครก็โหลดได้)
    // ด่านจริงอยู่ที่ server เสมอ
    function requireRole(...roles) {
        if (!requireLogin()) return false;
        if (!hasRole(...roles)) {
            window.location.href = '/index.html?denied=1';
            return false;
        }
        return true;
    }

    // ── หน้าปัจจุบันตรงกับหน้าปลายทางหรือไม่ (กัน redirect วนซ้ำ) ──
    function isSamePage(target) {
        const cur  = window.location.pathname.split('/').pop() || 'index.html';
        const dest = target.split('/').pop() || 'index.html';
        return cur === dest;
    }

    // ── Redirect ถ้ายังไม่ Login ──
    function requireLogin(redirectTo = '/index.html') {
        if (!isLoggedIn()) {
            clearSession();
            // ถ้าอยู่หน้า login (ปลายทาง) อยู่แล้ว ไม่ต้อง redirect — กัน reload วนไม่สิ้นสุด
            if (isSamePage(redirectTo)) return false;
            window.location.href = redirectTo;
            return false;
        }
        return true;
    }

    // ── Redirect ถ้า Login แล้ว (ป้องกันกลับไปหน้า login) ──
    function redirectIfLoggedIn(redirectTo = '/index.html') {
        if (isLoggedIn() && !isSamePage(redirectTo)) {
            window.location.href = redirectTo;
        }
    }

    // ── fetch wrapper ที่แนบ JWT ทุก request ──
    async function apiFetch(url, options = {}) {
        const token = getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // ผ่าน window.fetch ที่ถูกห่อไว้ด้านล่าง — จัดการ 401 ที่เดียว
        return fetch(url, { ...options, headers });
    }

    // ── Login API call ──
    async function login(username, password, role) {
        const res = await fetch('/api/auth/login', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ username, password, role }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
        setSession(data.token, data.user);
        return data.user;
    }

    // ── Logout ──
    async function logout() {
        try {
            await apiFetch('/api/auth/logout', { method: 'POST' });
        } catch {}
        clearSession();
        window.location.href = '/index.html';
    }

    // ── Switch Role ──
    async function switchRole(newRole) {
        const res = await apiFetch('/api/auth/switch-role', {
            method: 'POST',
            body:   JSON.stringify({ role: newRole }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const user = { ...getUser(), active_role: newRole, role_label: data.role_label };
        setSession(data.token, user);
        return user;
    }

    // ── ซ่อน element ที่ role ปัจจุบันไม่มีสิทธิ์เห็น ──
    //
    // ใช้: <a href="settings.html" data-role-gate="ADMIN">  แล้วเรียก Auth.applyRoleGate()
    // หลัง render (DSNavbar ทำให้เฉพาะภายใน navbar เท่านั้น อันนี้ครอบทั้งหน้า)
    //
    // ⚠️ เป็นแค่ UX — ไฟล์ static ใครก็โหลดได้ ด่านจริงอยู่ที่ server เสมอ
    function applyRoleGate(root = document) {
        const role = (getRole() || '').toUpperCase();
        root.querySelectorAll('[data-role-gate]').forEach(el => {
            if (el.closest('.mc-navbar')) return;   // navbar จัดการเองใน DSNavbar
            const allowed = (el.getAttribute('data-role-gate') || '')
                .split(/[\s,|]+/).filter(Boolean).map(s => s.toUpperCase());
            if (!allowed.length) return;
            el.style.display = (role && allowed.includes(role)) ? '' : 'none';
        });
    }

    // ── แสดง user info ใน navbar (เรียกหลัง DOMContentLoaded) ──
    function renderNavUser(nameElId = 'user-info', avatarElId = null) {
        const user = getUser();
        if (!user) return;
        const nameEl = document.getElementById(nameElId);
        if (nameEl) nameEl.textContent = `${user.full_name} (${user.role_label || user.active_role})`;
        if (avatarElId) {
            const el = document.getElementById(avatarElId);
            if (el) el.textContent = user.full_name?.charAt(0) || 'U';
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ห่อ window.fetch — แนบ JWT ให้ทุก request ที่ยิงไป /api
    //
    // ห่อที่เดียวแทนการเรียก Auth.apiFetch ทีละจุด เพราะพอโปรเจคโตขึ้น
    // จะมี fetch ตรงหลายร้อยจุด การไล่แก้ทีละ call site ตกหล่นแล้วหน้านั้น
    // พัง 401 ทั้งหน้า — ห่อที่เดียวครอบคลุมกว่าและย้อนกลับง่ายกว่า
    //
    // ต้องโหลดไฟล์นี้เป็น script แรกของหน้า ก่อน script ที่ยิง fetch
    // ─────────────────────────────────────────────────────────────
    const _origFetch = window.fetch.bind(window);

    // ─────────────────────────────────────────────────────────────
    // โหมด static (เช่น deploy ขึ้น Vercel เฉพาะโฟลเดอร์ public/)
    //
    // หน้าต้นแบบ claim-*/nhso-*/refer-*/present* ไม่ยิง /api อยู่แล้วจึงไม่กระทบ
    // แต่หน้าที่ผูก backend จริง (index/registry/portal/settings) จะยิงแล้วไม่มีใครรับ
    // ถ้าไม่บอกอะไรเลย ผู้ใช้จะเจอหน้าค้างหรือหน้าขาวโดยไม่รู้สาเหตุ
    //
    // ตรวจจากอาการที่แยกจากเซิร์ฟเวอร์จริงได้ชัด: ต่อไม่ติด หรือ 404 ที่ตอบเป็น HTML
    // (เซิร์ฟเวอร์จริงตอบ JSON เสมอ 404 จาก route ที่มีอยู่จึงไม่เข้าเงื่อนไขนี้)
    // ─────────────────────────────────────────────────────────────
    let _noticedStatic = false;
    function _noticeStaticMode() {
        if (_noticedStatic) return;
        _noticedStatic = true;
        const show = () => {
            if (document.getElementById('dsStaticNotice')) return;
            const el = document.createElement('div');
            el.id = 'dsStaticNotice';
            el.setAttribute('role', 'status');
            el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:9999;'
                + 'max-width:min(680px,92vw);background:#fef3c7;border:2px solid #d97706;border-radius:10px;'
                + 'color:#7c2d12;padding:12px 44px 12px 16px;font-size:13px;line-height:1.6;'
                + 'box-shadow:0 10px 30px rgba(0,0,0,.18)';
            el.innerHTML =
                '<strong>โหมดนำเสนอ (static)</strong> — หน้านี้ต้องใช้เซิร์ฟเวอร์และฐานข้อมูล '
              + 'จึงใช้งานไม่ได้บนที่อยู่นี้<br>'
              + 'หน้าต้นแบบทั้งหมดใช้ได้ตามปกติ: '
              + '<a href="claim-dashboard.html" style="color:#7c2d12;font-weight:700">ภาพรวมผู้บริหาร</a> · '
              + '<a href="refer-worklist.html" style="color:#7c2d12;font-weight:700">ทะเบียนการส่งต่อ</a> · '
              + '<a href="present-exec.html" style="color:#7c2d12;font-weight:700">สไลด์นำเสนอ</a>'
              + '<button type="button" aria-label="ปิด" '
              + 'style="position:absolute;top:6px;right:10px;border:0;background:transparent;'
              + 'font-size:20px;line-height:1;cursor:pointer;color:#7c2d12">&times;</button>';
            el.querySelector('button').onclick = () => el.remove();
            document.body.appendChild(el);
        };
        if (document.body) show();
        else document.addEventListener('DOMContentLoaded', show);
    }

    window.fetch = async (input, init = {}) => {
        const url = typeof input === 'string' ? input
                  : (input && input.url) || '';
        const isApi = url.startsWith('/api')
                   || url.startsWith(window.location.origin + '/api');
        if (!isApi) return _origFetch(input, init);

        const headers = new Headers(
            init.headers || (input instanceof Request ? input.headers : undefined)
        );
        const token = getToken();
        // ห้ามทับของเดิม — device ingest และ wrapper บางไฟล์ตั้ง Authorization มาเองแล้ว
        if (token && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
        }

        let res;
        try {
            res = await _origFetch(input, { ...init, headers });
        } catch (err) {
            // dsOptional: คำขอ "มีก็ดี ไม่มีก็ได้" (เช่น mock-refdata.js hydrate)
            // ล้มบน static deploy เป็นเรื่องปกติ — ไม่ต้องขึ้นป้ายโหมดนำเสนอ
            if (!init.dsOptional) _noticeStaticMode();      // ต่อ /api ไม่ติดเลย
            throw err;
        }

        if (res.status === 404 && !(res.headers.get('content-type') || '').includes('json')) {
            if (!init.dsOptional) _noticeStaticMode();      // มีคนตอบ แต่ไม่ใช่ API — เสิร์ฟไฟล์ static อยู่
        }

        if (res.status === 401) {
            // ต้อง clone ก่อนอ่าน ไม่งั้น caller จะเจอ "body already consumed"
            const body = await res.clone().json().catch(() => ({}));
            if (['TOKEN_EXPIRED', 'INVALID_TOKEN', 'TOKEN_REVOKED'].includes(body.code)) {
                clearSession();
                if (!isSamePage('/index.html')) {
                    window.location.href = '/index.html?expired=1';
                }
            }
        }
        return res;
    };

    return { getToken, getUser, getUserId, decodePayload, isLoggedIn,
             requireLogin, redirectIfLoggedIn,
             getRole, getRoles, hasRole, requireRole, applyRoleGate,
             apiFetch, login, logout, switchRole, renderNavUser, clearSession };
})();

// `const Auth` ระดับ script ใช้เป็นตัวแปร global ได้ แต่ **ไม่ผูกเป็น property ของ window**
// โค้ดหลายที่เช็ค `window.Auth && Auth.getUser` จึงได้ false เสมอ → ตรรกะสิทธิ์ฝั่ง client ตายทั้งหมด
// ผูกให้ชัดเจนตรงนี้เพื่อให้ทั้งสองรูปแบบใช้ได้
if (typeof window !== 'undefined') window.Auth = Auth;

// ── ป้องกันทุกหน้า (ยกเว้น index.html) ──
// ถ้าต้องการ protect หน้าไหน ใส่ไว้ที่หัวไฟล์:
//   Auth.requireLogin();
