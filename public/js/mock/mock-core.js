/**
 * MediCore RCM — MOCK CORE
 * ------------------------------------------------------------
 * ⚠️ ชั้นข้อมูลจำลองสำหรับ "ต้นแบบเพื่อการนำเสนอ" เท่านั้น
 *    ไม่มีการเรียก /api ใด ๆ · เมื่อผูก backend จริงให้แทน MockDB.* ด้วย fetch()
 *    ตาม doc/PAGE-GUIDE.md §4 แล้วลบโฟลเดอร์ js/mock/ ทิ้ง
 *
 * ต้องโหลด "เป็นไฟล์แรก" ในกลุ่ม mock — ไฟล์โดเมนอื่นเรียก MockDB.register()
 *
 * กฎเหล็ก
 *   1. ทุก global ในโฟลเดอร์นี้เป็น SCREAMING_SNAKE (MOCK_CLAIMS) หรือ namespace (MockDB)
 *      — const ชนกับตัวแปรของหน้าเมื่อไหร่ JS จะ throw แล้วหน้าขาวทั้งหน้า
 *   2. ห้าม hardcode ตัวเลขที่คำนวณได้ — KPI/ตัวนับ/ชุดกราฟ ต้อง derive จาก MockDB
 *      ไม่งั้นตัวเลขบนหน้าต่าง ๆ จะขัดกันเองตอนสาธิต
 */

/* ══════════════════════════════════════════════════════════
   1. MockDB — ทะเบียนชุดข้อมูล + ชั้นเขียนทับสำหรับสาธิต
   ══════════════════════════════════════════════════════════ */
const MockDB = {

    /** วันอ้างอิงของข้อมูลจำลองทั้งชุด — 6 ส.ค. 2569 */
    TODAY: new Date('2026-08-06T09:00:00'),

    _base:    {},                 // ข้อมูลตั้งต้น (อ่านอย่างเดียว)
    _KEY:     'mc_demo_v1',
    _overlay: null,               // { table: { id: {patch} }, _new: { table: [row] } }

    _load() {
        if (this._overlay) return this._overlay;
        try {
            this._overlay = JSON.parse(sessionStorage.getItem(this._KEY) || '{}');
        } catch (e) {
            this._overlay = {};
        }
        return this._overlay;
    },

    _save() {
        try { sessionStorage.setItem(this._KEY, JSON.stringify(this._load())); }
        catch (e) { /* โหมดส่วนตัวของเบราว์เซอร์ — ยอมให้ข้อมูลอยู่แค่ในหน่วยความจำ */ }
    },

    /** ไฟล์ mock แต่ละโดเมนเรียกตัวนี้ตอนท้ายไฟล์ */
    register(name, rows) { this._base[name] = rows || []; return this; },

    /** คีย์หลักของแต่ละตาราง */
    _idKey(name) {
        return ({ claims: 'id', rules: 'id', docs: 'id', tasks: 'id',
                  rejects: 'id', users: 'id', audit: 'id' })[name] || 'id';
    },

    /** ทุกแถวของตาราง (base + แถวที่เพิ่มตอนสาธิต + patch ที่ merge แล้ว) */
    all(name) {
        const ov  = this._load();
        const key = this._idKey(name);
        const patches = (ov[name] || {});
        const added   = ((ov._new || {})[name] || []);
        return [...(this._base[name] || []), ...added]
            .map(r => patches[r[key]] ? { ...r, ...patches[r[key]] } : r);
    },

    byId(name, id)   { const k = this._idKey(name); return this.all(name).find(r => String(r[k]) === String(id)) || null; },
    where(name, fn)  { return this.all(name).filter(fn); },
    count(name, fn)  { return fn ? this.where(name, fn).length : this.all(name).length; },
    sum(name, fn, pick) { return this.where(name, fn).reduce((a, r) => a + (Number(pick(r)) || 0), 0); },

    /** แก้ค่าของแถว — เก็บลง sessionStorage ให้หน้าอื่นเห็นตามในเซสชันเดียวกัน */
    patch(name, id, changes) {
        const ov = this._load();
        ov[name] = ov[name] || {};
        ov[name][id] = { ...(ov[name][id] || {}), ...changes };
        this._save();
        return this.byId(name, id);
    },

    /** เพิ่มแถวใหม่ตอนสาธิต (เช่น สร้าง Task, สร้างร่างกฎจาก Reject) */
    insert(name, row) {
        const ov = this._load();
        ov._new = ov._new || {};
        ov._new[name] = ov._new[name] || [];
        ov._new[name].push(row);
        this._save();
        return row;
    },

    /** มีการแก้ข้อมูลสาธิตค้างอยู่หรือไม่ (ใช้โชว์ป้ายเตือนบน navbar ได้) */
    isDirty() {
        const ov = this._load();
        return Object.keys(ov).some(k => k === '_new'
            ? Object.values(ov._new).some(a => a.length)
            : Object.keys(ov[k] || {}).length);
    },

    /** คืนค่าตั้งต้นทั้งหมด — ผูกกับเมนู "รีเซ็ตข้อมูลสาธิต" */
    reset() {
        try { sessionStorage.removeItem(this._KEY); } catch (e) { /* ignore */ }
        this._overlay = null;
        location.reload();
    },
};


/* ══════════════════════════════════════════════════════════
   2. MockFmt — จัดรูปแบบตัวเลข/วันที่ (พ.ศ. ทั้งระบบ)
   ══════════════════════════════════════════════════════════ */
const MockFmt = {

    int(n)   { return (Number(n) || 0).toLocaleString('th-TH'); },

    baht(n, opts) {
        const v = Number(n) || 0;
        if (opts && opts.short) {
            if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2).replace(/\.00$/, '') + ' ล้าน';
            if (Math.abs(v) >= 1e3) return Math.round(v / 1e3) + 'K';
        }
        return v.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    },

    pct(n, digits) { return (Number(n) || 0).toFixed(digits == null ? 1 : digits) + '%'; },

    /** '2569-07-28' หรือ ISO → '28 ก.ค. 2569' */
    dateTH(v) {
        if (!v) return '—';
        const p = this._parse(v);
        if (!p) return String(v);
        return `${p.d} ${this.MONTHS[p.m]} ${p.y}`;
    },

    dateTimeTH(v) {
        if (!v) return '—';
        const p = this._parse(v);
        if (!p) return String(v);
        const hh = String(p.hh).padStart(2, '0'), mm = String(p.mi).padStart(2, '0');
        return `${p.d} ${this.MONTHS[p.m]} ${p.y} ${hh}:${mm}`;
    },

    MONTHS: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
             'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],

    /**
     * ข้อมูลจำลองเก็บปีเป็น พ.ศ. อยู่แล้ว ('2569-07-28T16:00')
     * แปลงเป็น ค.ศ. ก่อนสร้าง Date แล้วคืนชิ้นส่วนที่เป็น พ.ศ.
     */
    _parse(v) {
        const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
        if (!m) { const d = new Date(v); return isNaN(d) ? null
            : { y: d.getFullYear() + 543, m: d.getMonth(), d: d.getDate(), hh: d.getHours(), mi: d.getMinutes() }; }
        return { y: +m[1], m: +m[2] - 1, d: +m[3], hh: +(m[4] || 0), mi: +(m[5] || 0) };
    },

    /** วันที่ พ.ศ. → Date object (ค.ศ.) สำหรับคำนวณส่วนต่างเวลา */
    toDate(v) {
        const p = this._parse(v);
        return p ? new Date(p.y - 543, p.m, p.d, p.hh, p.mi) : null;
    },

    /** เหลืออีกเท่าไรถึงกำหนด — 'อีก 6 ชม.' / 'เกิน 2 วัน' */
    countdown(due) {
        const d = this.toDate(due); if (!d) return '—';
        const diff = d - MockDB.TODAY;
        const over = diff < 0;
        const h = Math.abs(diff) / 36e5;
        const txt = h < 24 ? `${Math.round(h)} ชม.` : `${Math.round(h / 24)} วัน`;
        return over ? `เกิน ${txt}` : `อีก ${txt}`;
    },
};


/* ══════════════════════════════════════════════════════════
   3. MockTone — แผนที่ "ความหมาย → คลาส/ป้าย" ที่ทุกหน้าต้องใช้ร่วมกัน

   นี่คือหัวใจ: 12 หน้าติดป้ายเรื่องเดียวกันเหมือนกันเพราะอ่านจาก map เดียว
   ห้ามหน้าไหน inline คลาส .status-badge เอง
   ══════════════════════════════════════════════════════════ */
const MockTone = {

    /* 5 ระดับผลตรวจตาม SRS §4 */
    RESULTS: ['PASS', 'WARN', 'FIX', 'APPROVE', 'BLOCK'],

    resultLabel: {
        PASS: 'ผ่าน', WARN: 'แจ้งเตือน', FIX: 'ต้องแก้ไข',
        APPROVE: 'ต้องอนุมัติ', BLOCK: 'ระงับส่ง',
    },
    resultBadge: {
        PASS: 'completed', WARN: 'waiting', FIX: 'pending',
        APPROVE: 'in-progress', BLOCK: 'danger',
    },
    resultChip: {
        PASS: 'sip-chip-success', WARN: 'sip-chip-amber', FIX: 'sip-chip-danger',
        APPROVE: 'sip-chip-ack', BLOCK: 'sip-chip-danger',
    },
    resultColor: {
        PASS: 'var(--status-success)', WARN: 'var(--status-warning)', FIX: 'var(--status-danger)',
        APPROVE: 'var(--status-acknowledged)', BLOCK: 'var(--status-danger-strong)',
    },

    /* วงจรชีวิตกฎ — SRS FR-04 */
    lifecycleLabel: {
        DRAFT: 'ร่าง', REVIEW: 'รอทบทวน', APPROVED: 'อนุมัติแล้ว',
        ACTIVE: 'เปิดใช้', RETIRED: 'ยกเลิกใช้',
    },
    lifecycleBadge: {
        DRAFT: 'kbadge-draft', REVIEW: 'kbadge-pending', APPROVED: 'kbadge-acked',
        ACTIVE: 'kbadge-active', RETIRED: 'kbadge-off',
    },

    /* ระดับความรุนแรงของกฎ */
    severityChip: { INFO: 'sip-chip-muted', WARNING: 'sip-chip-amber', ERROR: 'sip-chip-danger' },
    severityLabel: { INFO: 'ข้อมูล', WARNING: 'เตือน', ERROR: 'ผิดพลาด' },

    /** สถานะ SLA → คลาส .dp-chip-sla (ต้อง <link> ds-portal.css ด้วย) */
    sla(dueISO) {
        if (!dueISO) return 'ok';
        const d = MockFmt.toDate(dueISO); if (!d) return 'ok';
        const h = (d - MockDB.TODAY) / 36e5;
        return h < 0 ? 'over' : h <= 12 ? 'near' : 'ok';
    },
    slaLabel(dueISO) {
        const s = this.sla(dueISO);
        return s === 'over' ? 'เกิน SLA' : s === 'near' ? 'ใกล้ครบ' : 'ในกำหนด';
    },

    /* ── helper คืน HTML สำเร็จรูป — ใช้ให้ทั่วทุกหน้า ── */

    resultBadgeHtml(result) {
        return `<span class="status-badge ${this.resultBadge[result] || 'pending'}">${
            MockEsc(this.resultLabel[result] || result)}</span>`;
    },
    resultChipHtml(result) {
        return `<span class="sip-chip ${this.resultChip[result] || 'sip-chip-muted'}">${
            MockEsc(this.resultLabel[result] || result)}</span>`;
    },
    lifecycleHtml(status) {
        return `<span class="kbadge ${this.lifecycleBadge[status] || 'kbadge-off'}">${
            MockEsc(this.lifecycleLabel[status] || status)}</span>`;
    },
    slaHtml(dueISO) {
        const s = this.sla(dueISO);
        return `<span class="dp-chip-sla ${s}">${MockEsc(MockFmt.countdown(dueISO))}</span>`;
    },
};

/* esc ของชั้น mock — ตั้งชื่อไม่ให้ชนกับ function esc() ที่ทุกหน้าประกาศเอง */
function MockEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.MockDB   = MockDB;
window.MockFmt  = MockFmt;
window.MockTone = MockTone;
window.MockEsc  = MockEsc;
