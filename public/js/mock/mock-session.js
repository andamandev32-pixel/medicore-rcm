/**
 * MediCore RCM — MOCK SESSION (persona สาธิต)
 * ------------------------------------------------------------
 * ⚠️ หน้าต้นแบบไม่เรียก Auth.requireLogin() เพราะไม่ยิง /api เลย
 *    และ DB จริงอยู่เครื่องระยะไกล — ถ้า gate ด้วย requireLogin
 *    การนำเสนอจะพังทันทีที่เน็ต/DB ไม่พร้อม
 *
 *    ถ้ามีคนล็อกอินจริงอยู่ → ใช้ชื่อและบทบาทจริง
 *    ถ้าไม่ → ใช้ persona ตาม 9 บทบาทใน SRS §2
 *
 * ตัวสลับบทบาทไม่ใช่ทางเลี่ยง แต่เป็นฟีเจอร์ที่ใช้สาธิต Maker–Checker (BR-05):
 * สลับเป็น persona ที่เป็นผู้เขียนกฎ → ปุ่ม "เปิดใช้" ในหน้าคลังกฎจะถูกปิด
 *
 * ต้องโหลด "หลัง" ds-navbar.js และ "ก่อน" JS ของหน้า
 */

const MockSession = {

    _KEY: 'mc_persona_v1',

    /** 9 บทบาทตาม SRS §2 */
    PERSONAS: {
        EXEC:     { name: 'นพ.ธนวัฒน์ ศรีสุวรรณ',  role: 'ผู้บริหาร/เจ้าของกระบวนการ', dept: 'ฝ่ายบริหาร' },
        OFFICER:  { name: 'คุณพิมพ์ชนก วงศ์อนันต์', role: 'Claim Officer',           dept: 'ศูนย์จัดเก็บรายได้' },
        EDITOR:   { name: 'คุณกิตติพงษ์ แสนดี',    role: 'Rule Editor',             dept: 'ศูนย์จัดเก็บรายได้' },
        MED:      { name: 'พญ.ชลธิชา ภักดีวงศ์',   role: 'Medical Reviewer',        dept: 'องค์กรแพทย์' },
        FIN:      { name: 'คุณอรทัย เจริญพร',      role: 'Financial Reviewer',      dept: 'ฝ่ายการเงิน' },
        APPROVER: { name: 'คุณสุรชัย มั่นคงดี',     role: 'Rule Approver',           dept: 'ศูนย์จัดเก็บรายได้' },
        SOURCE:   { name: 'คุณนภาพร ใจงาม',        role: 'หน่วยบริการต้นทาง',        dept: 'เวชระเบียน' },
        ADMIN:    { name: 'คุณวีระ ทองอินทร์',      role: 'System Admin',            dept: 'ศูนย์คอมพิวเตอร์' },
        AUDITOR:  { name: 'คุณเบญจมาศ สุขใจ',      role: 'Auditor',                 dept: 'ตรวจสอบภายใน' },
    },

    /** รหัสผู้ใช้ในชุดข้อมูลจำลองที่ผูกกับแต่ละ persona (ใช้เช็ค "งานของฉัน") */
    USER_ID: {
        EXEC: 'U-001', OFFICER: 'U-004', EDITOR: 'U-005', MED: 'U-006', FIN: 'U-007',
        APPROVER: 'U-008', SOURCE: 'U-009', ADMIN: 'U-002', AUDITOR: 'U-010',
    },

    _real: null,          // ผู้ใช้จริงจากระบบล็อกอิน (ถ้ามี)

    current() {
        try { return sessionStorage.getItem(this._KEY) || 'OFFICER'; }
        catch (e) { return 'OFFICER'; }
    },

    /** ผู้ใช้ที่ navbar จะแสดง */
    user() {
        if (this._real) return this._real;
        const k = this.current(), p = this.PERSONAS[k] || this.PERSONAS.OFFICER;
        return { full_name: p.name, active_role: k, role_label: p.role, department_name: p.dept };
    },

    /** รหัสผู้ใช้ในชุดข้อมูลจำลอง — ใช้กรอง "งานของฉัน" / เช็คผู้เขียนกฎ */
    userId() { return this.USER_ID[this.current()] || 'U-004'; },

    roleLabel() {
        const p = this.PERSONAS[this.current()];
        return p ? p.role : '—';
    },

    isReal() { return !!this._real; },

    setRole(key) {
        if (!this.PERSONAS[key]) return;
        try { sessionStorage.setItem(this._KEY, key); } catch (e) { /* ignore */ }
        location.reload();
    },

    /** Drawer สลับบทบาท — ผูกกับเมนู "สลับบทบาท (สาธิต)" */
    openRolePicker() {
        const cur = this.current();
        const rows = Object.entries(this.PERSONAS).map(([k, p]) => `
            <button class="ds-seg ${k === cur ? 'active' : ''}" style="width:100%;justify-content:flex-start;
                    text-align:left;margin-bottom:6px;padding:10px 12px;height:auto"
                    onclick="MockSession.setRole('${k}')">
                <span style="display:block;font-weight:700">${MockEsc(p.role)}</span>
                <span style="display:block;font-size:11px;opacity:.75">${MockEsc(p.name)} · ${MockEsc(p.dept)}</span>
            </button>`).join('');

        Drawer.open({
            title: 'สลับบทบาท (โหมดสาธิต)',
            contentHtml: `
                <div class="sip-banner sip-banner-info" style="margin-bottom:14px">
                    <i data-lucide="info" class="icon-sm"></i>
                    สลับเพื่อดูว่าหน้าจอเปลี่ยนไปอย่างไรตามสิทธิ์ — เช่น ผู้เขียนกฎจะกด "เปิดใช้กฎ" ของตัวเองไม่ได้
                </div>
                <div class="ds-segbar" style="flex-direction:column;align-items:stretch;background:transparent;padding:0">
                    ${rows}
                </div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    /**
     * แบนเนอร์ "ข้อมูลจำลอง" ที่ทุกหน้าใช้ร่วมกัน
     * ⚠️ ห้ามลดความเด่นหรือย้ายลงล่าง — หน้าต้นแบบถูกเปิดโชว์ผู้บริหารระหว่างนำเสนอ
     *    ตัวเลข กราฟ และรายชื่อทุกจุดเป็นข้อมูลสมมติ ไม่ใช่ข้อมูลจริงของโรงพยาบาล
     */
    bannerHtml() {
        return `<div class="sip-banner sip-banner-mock" style="margin-bottom:16px">
            <span class="sip-mock-tag">ข้อมูล MOCKUP</span>
            <span><strong>ตัวเลขและกราฟทุกจุดในหน้านี้เป็นข้อมูลสมมติเพื่อสาธิตหน้าจอ — ไม่ใช่ข้อมูลจริงของโรงพยาบาล</strong><br>
            ยังไม่เชื่อมต่อ HIS หรือฐานข้อมูลจริง · สิ่งที่ดูได้จากหน้านี้คือ <em>รูปแบบการทำงานและวิธีวัด</em> ไม่ใช่ผลลัพธ์
            · บทบาทที่ใช้ดูอยู่: <strong>${MockEsc(this.roleLabel())}</strong></span>
            <button class="btn btn-ghost btn-sm" style="margin-left:auto;align-self:flex-start"
                    onclick="MockSession.openRolePicker()">สลับบทบาท</button>
        </div>`;
    },

    /** วางแบนเนอร์ต้นแบบไว้บนสุดของ container ที่กำหนด */
    mountBanner(containerId) {
        const el = document.getElementById(containerId);
        if (el) el.innerHTML = this.bannerHtml();
    },
};

/* ── ผูกกับ navbar ทันที (top level — ก่อน DOMContentLoaded เหมือน showcase.html) ── */
if (window.Auth && typeof Auth.isLoggedIn === 'function' && Auth.isLoggedIn()) {
    MockSession._real = Auth.getUser();
}

if (window.DSNavbar) {
    DSNavbar.configure({
        brandSub: 'RCM',
        getUser: () => MockSession.user(),
        // ⚠️ คืน '' เสมอ เพื่อไม่ให้ role gate ของ navbar ซ่อนเมนูตอนยังไม่ล็อกอิน
        //    persona ในต้นแบบเป็นบทบาทตาม SRS ไม่ใช่ role ในฐานข้อมูล จึงยังไม่ผูกกัน
        getRole: () => '',
        onLogout: () => {
            if (MockSession._real && window.Auth) { Auth.logout(); return; }
            showToast('โหมดต้นแบบ — ยังไม่ผูกระบบล็อกอิน', 'info');
        },
    });
}

window.MockSession = MockSession;
