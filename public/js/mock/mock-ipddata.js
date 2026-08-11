/**
 * MediCore RCM — MOCK IPDDATA (สะพาน admission จริง → ชั้น mock ผู้ป่วยใน)
 * ------------------------------------------------------------
 * แพทเทิร์นเดียวกับ mock-refdata.js: ดึงข้อมูลจริงจาก /api/ipd แล้ว "merge"
 * เข้า MockDB('ipd_stays') ในที่ — หน้าจอเดิม (ipd-admit / ipd-audit) อ่านแบบเดิม
 *
 * กติกา:
 *  1. โหลดหลังไฟล์ mock ทุกไฟล์ (MockDB ต้องมี ipd_stays อยู่ก่อน)
 *  2. จับคู่ด้วย AN: เคสใน DB ทับเฉพาะฟิลด์การลงรหัส/ค่าใช้จ่าย/วันเวลา
 *     ฟิลด์เดโมที่ DB ยังไม่มี (daily, chart_audit, timeline) คงของ mock ไว้
 *  3. เคสที่ merge แล้วติด `_db = { admission_id, rev }` — ตัวบอกว่าเขียนกลับ DB ได้
 *  4. ล้มเงียบ: ไม่มีเซิร์ฟเวอร์/ยังไม่ล็อกอิน (401) = ใช้ mock ต่อ ไม่มี error
 *  5. วันที่ DB เป็น ค.ศ. ↔ mock เป็น พ.ศ. — แปลงที่สะพานนี้ทั้งสองทิศ
 *  6. merge สำเร็จยิง 'refdata:updated' (detail.ipdStays = จำนวน) ให้หน้า re-render
 */
const MockIpdData = {

    loaded: 0,

    /* ── แปลงปี ── */
    _be(v) { return v && /^\d{4}-/.test(v) ? (parseInt(v.slice(0, 4), 10) + 543) + v.slice(4) : (v || null); },
    _ce(v) { return v && /^\d{4}-/.test(v) ? (parseInt(v.slice(0, 4), 10) - 543) + v.slice(4) : (v || null); },

    async _get(path) {
        const res = await fetch('/api/ipd' + path, { dsOptional: true });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    },

    async _send(method, path, body) {
        const res = await fetch('/api/ipd' + path, {
            method, dsOptional: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        return data;
    },

    /* DB row (detail) → ฟิลด์ทับลง mock stay */
    _mergeFields(adm) {
        return {
            hn: adm.hn, patient: adm.patient_name,
            fund: adm.payer || undefined,
            ward: adm.ward || undefined, bed: adm.bed || undefined,
            admit_at: this._be(adm.admit_at),
            discharge_at: adm.discharge_at ? this._be(adm.discharge_at) : null,
            discharge_type: adm.discharge_type, discharge_status: adm.discharge_status,
            leave_days: Number(adm.leave_days) || 0,
            pdx: adm.pdx ? adm.pdx.code : null,
            pdx_name: adm.pdx ? (adm.pdx.name || '') : '',
            sdx: (adm.sdx || []).map(d => ({ code: d.code, name: d.name || '' })),
            proc: (adm.procedures || []).map(p => ({
                code: p.code, name: p.name || '', date: this._be(p.proc_date) })),
            drg: adm.drg_code || null,
            charges: (adm.charges || []).map(c => ({
                billgrcs: c.billgrcs || '', name: c.name || '',
                amount: Number(c.amount) || 0,
                qty: c.qty != null ? Number(c.qty) : undefined })),
            files_sent: adm.files_sent || [],
            file_ctx: adm.file_ctx || {},
            _db: { admission_id: adm.admission_id, rev: adm.rev },
        };
    },

    /* ── โหลด admission จริงทั้งหมดแล้ว merge เข้า mock ── */
    async hydrateStays() {
        if (!window.MockDB) return;
        const list = await this._get('/admissions?limit=100');
        if (!Array.isArray(list) || !list.length) return;

        const details = await Promise.all(
            list.map(r => this._get('/admissions/' + r.admission_id).catch(() => null)));

        let merged = 0;
        for (const adm of details) {
            if (!adm) continue;
            const stay = MockDB.all('ipd_stays').find(s => String(s.an) === String(adm.an));
            if (stay) {
                MockDB.patch('ipd_stays', stay.id, this._mergeFields(adm));
                merged++;
            }
            /* เคสใน DB ที่ mock ไม่รู้จัก: ยังไม่เติมเข้าจอ (daily/chart_audit ไม่มี
               จะทำให้หน้าจอเดโมพัง) — รอ FR-01 import จริงค่อยยกทั้งหน้าออกจาก mock */
        }
        this.loaded = merged;
    },

    /* ── สถานะเขียนกลับ ── */
    canWrite(stay) {
        return !!(stay && stay._db && window.Auth && Auth.isLoggedIn());
    },

    /* ── บันทึกการลงรหัส (Pdx/Sdx/หัตถการ) กลับ DB ── */
    async saveCoding(stay, { pdx, sdx, proc }) {
        const r = await this._send('PUT', `/admissions/${stay._db.admission_id}/coding`, {
            rev: stay._db.rev,
            pdx: pdx ? { code: pdx.code, name: pdx.name || null } : null,
            sdx: (sdx || []).map(d => ({ code: d.code, name: d.name || null })),
            procedures: (proc || []).map(p => ({
                code: p.code, name: p.name || null, date: this._ce(p.date) })),
        });
        stay._db.rev = r.rev;
        return r;
    },

    /* ── บันทึกค่าใช้จ่ายราย item กลับ DB ── */
    async saveCharges(stay, items) {
        const r = await this._send('PUT', `/admissions/${stay._db.admission_id}/charges`, {
            rev: stay._db.rev,
            items: (items || []).map(it => ({
                billgrcs: it.billgrcs || null, name: it.name || null,
                amount: Number(it.amount) || 0,
                qty: it.qty != null && it.qty !== '' ? Number(it.qty) : null })),
        });
        stay._db.rev = r.rev;
        return r;
    },

    /* ── ตรวจกับ rule engine จริง ──
       เคสที่อยู่ใน DB: ให้เซิร์ฟเวอร์ประกอบ payload จากข้อมูลจริง (ต้องล็อกอิน)
       เคส mock ล้วน: ประกอบ payload ฝั่งนี้แล้วยิง endpoint สาธารณะ /reference/validate */
    async validate(stay) {
        if (stay._db && window.Auth && Auth.isLoggedIn()) {
            return this._send('POST', `/admissions/${stay._db.admission_id}/validate`, {});
        }
        const claim = {
            fund_key: 'IP',
            flags: stay.file_ctx || {},
            files_present: stay.files_sent || [],
            /* mock stay ไม่มี cid/วันเกิด — ไม่ส่ง section patient (engine ข้ามชั้นนั้น) */
            admission: {
                admit_date: this._ce((stay.admit_at || '').slice(0, 10)) || undefined,
                discharge_date: stay.discharge_at ? this._ce(stay.discharge_at.slice(0, 10)) : undefined,
                los: window.MockIpd ? MockIpd.los(stay) : undefined,
                leave_days: Number(stay.leave_days) || 0,
            },
            diagnosis: { pdx: stay.pdx || null, sdx: (stay.sdx || []).map(d => d.code) },
            procedures: (stay.proc || []).map(p => ({ code: p.code, date: this._ce(p.date) })),
            charges: (stay.charges || []).length
                ? { total: (stay.charges || []).reduce((t, c) => t + (Number(c.amount) || 0), 0),
                    items: (stay.charges || []).map(c => ({
                        billgrcs: c.billgrcs, name: c.name,
                        amount: Number(c.amount) || 0,
                        qty: c.qty != null ? Number(c.qty) : undefined })) }
                : undefined,
            drg: stay.drg ? { code: stay.drg } : undefined,
        };
        const res = await fetch('/api/reference/validate', {
            method: 'POST', dsOptional: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(claim),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        data.claim = claim;
        return data;
    },

    /* ── ค้นรหัสจากแคตตาล็อก (autocomplete ช่องลงรหัส) ── */
    async searchCodes(system, q) {
        if (!q || q.trim().length < 2) return [];
        try {
            const res = await fetch(`/api/reference/${system}?q=${encodeURIComponent(q.trim())}&limit=12`,
                                    { dsOptional: true });
            if (!res.ok) return [];
            return await res.json();
        } catch { return []; }
    },

    async lookupCode(system, code) {
        try {
            const res = await fetch(`/api/reference/${system}?code=${encodeURIComponent(code)}`,
                                    { dsOptional: true });
            if (!res.ok) return null;
            const rows = await res.json();
            return rows[0] || null;
        } catch { return null; }
    },

    async init() {
        try {
            await this.hydrateStays();
            if (this.loaded) {
                document.dispatchEvent(new CustomEvent('refdata:updated',
                    { detail: { ipdStays: this.loaded } }));
            }
        } catch { /* ไม่มี backend/ยังไม่ล็อกอิน — ใช้ mock ต่อเงียบ ๆ */ }
    },
};

/* mock ไฟล์อื่นโหลด synchronous ก่อนไฟล์นี้ — DOMContentLoaded จึงการันตีว่า
   listener 'refdata:updated' ของหน้าถูกติดตั้งก่อน event ยิง (เหมือน mock-refdata.js) */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MockIpdData.init());
} else {
    MockIpdData.init();
}
