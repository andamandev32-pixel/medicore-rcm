/**
 * MediClear — MOCK FINDATA (สะพานลูกหนี้จริง → ชั้น mock)
 * ------------------------------------------------------------
 * ตัวสลับแหล่งข้อมูลของหน้า fin-ar / fin-receipt
 *   มีเซิร์ฟเวอร์ + ล็อกอินแล้ว → /api/finance (ตาราง ar_* ใน MySQL)
 *   ไม่มี / ไม่ได้ล็อกอิน       → MockAR (โหมดต้นแบบ)
 *
 * ต้องโหลดหลัง mock-ar.js
 *
 * กติกาเดียวกับ mock-refdata.js / mock-ruledata.js:
 *  1. โหลดหลังไฟล์ mock ทุกไฟล์ของหน้านั้น
 *  2. ล้มเงียบ: ไม่มีเซิร์ฟเวอร์ = ใช้ mock ต่อ (fetch แนบ dsOptional)
 *  3. วันที่จาก API เป็น ค.ศ. ต้องแปลงเป็น พ.ศ. (+543) ก่อนส่งให้หน้าจอ
 *
 * ต่างจากสะพานตัวอื่นตรงที่ "ไม่ splice ทับอาร์เรย์ mock" เพราะสองหน้านี้เป็นของใหม่
 * เขียนให้เรียก FinData ตรง ๆ ตั้งแต่แรก — ชั้น mock จึงเป็นแหล่งข้อมูลสำรอง
 * ไม่ใช่แหล่งหลักที่ต้องถูกเขียนทับ
 *
 * ⚠️ MySQL คืน DECIMAL เป็น "string" — ทุกช่องเงินต้องผ่าน _num() ไม่งั้น
 *    การบวกบนหน้าจอจะกลายเป็นการต่อสตริง ("100"+"200" = "100200")
 */
const FinData = {

    /** true = ข้อมูลจริงจากฐานข้อมูล · false = โหมดต้นแบบ (MockAR) */
    live: false,
    /** ตรวจครั้งเดียวต่อการโหลดหน้า แล้วจำผลไว้ */
    _probed: null,

    /* ── ตัวช่วยแปลงรูป ─────────────────────────────── */

    /** ค.ศ. → พ.ศ. ('2026-07-20' → '2569-07-20') */
    _be(d) {
        if (!d || !/^\d{4}-/.test(String(d))) return d || null;
        return (parseInt(String(d).slice(0, 4), 10) + 543) + String(d).slice(4);
    },

    _num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; },

    /** ช่องที่เป็นวันที่ทั้งหมดที่ API คืนมา (ทุกระดับ) */
    _DATE_FIELDS: ['service_date', 'sent_date', 'received_date', 'adjust_date', 'confirmed_at',
                   'first_sent'],
    /** ช่องที่เป็นเงิน/ตัวเลข — MySQL คืนเป็นสตริง ต้องแปลงก่อนใช้ */
    _NUM_FIELDS: ['billed_amt', 'paid_amt', 'clawback_amt', 'increase_amt', 'reduce_amt',
                  'writeoff_amt', 'billed_adj', 'net_received', 'outstanding', 'age_days',
                  'gross_amt', 'fee_amt', 'net_amt', 'allocated_amt', 'alloc_count',
                  'billed_total', 'item_count', 'amount', 'cases', 'billed', 'paid',
                  'clawback', 'writeoff', 'open_cases'],

    /** แปลงแถวจาก API ให้เป็นรูปที่หน้าจอใช้: วันที่ พ.ศ. + เงินเป็นตัวเลข */
    _row(o) {
        if (Array.isArray(o)) return o.map(x => this._row(x));
        if (!o || typeof o !== 'object') return o;

        const out = {};
        for (const [k, v] of Object.entries(o)) {
            if (v && typeof v === 'object') { out[k] = this._row(v); continue; }
            if (this._DATE_FIELDS.includes(k)) { out[k] = this._be(v); continue; }
            if (this._NUM_FIELDS.includes(k))  { out[k] = this._num(v); continue; }
            out[k] = v;
        }
        return out;
    },

    /* ── การเรียก API ───────────────────────────────── */

    _qs(q) {
        const p = new URLSearchParams();
        Object.entries(q || {}).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '' && v !== 'all') p.set(k, v);
        });
        const s = p.toString();
        return s ? '?' + s : '';
    },

    async _get(path, q) {
        const res = await fetch('/api/finance' + path + this._qs(q), { dsOptional: true });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return this._row(await res.json());
    },

    async _send(method, path, body) {
        const res = await fetch('/api/finance' + path, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const e = new Error(data.error || ('HTTP ' + res.status));
            e.code = data.code; e.data = data;
            throw e;
        }
        return data;
    },

    /**
     * ตรวจว่าต่อฐานข้อมูลจริงได้ไหม — เรียกครั้งเดียวตอนหน้าเริ่มทำงาน
     * ใช้ /periods เป็นตัวทดสอบเพราะเบาที่สุดและต้องผ่านทั้ง auth และ policy
     */
    async probe() {
        if (this._probed !== null) return this._probed;
        try {
            await this._get('/periods');
            this.live = true;
        } catch {
            this.live = false;      // ไม่มีเซิร์ฟเวอร์ / ยังไม่ล็อกอิน → โหมดต้นแบบ
        }
        this._probed = this.live;
        console.info(this.live
            ? '[FinData] ใช้ทะเบียนลูกหนี้จากฐานข้อมูลจริง (/api/finance)'
            : '[FinData] โหมดต้นแบบ — ใช้ข้อมูลจำลองจาก MockAR');
        return this.live;
    },

    /* ── อ่านข้อมูล (ใช้ได้ทั้งสองโหมด) ──────────────── */

    async list(q) {
        if (!this.live) return MockAR.list(q);
        try { return await this._get('/ar', q); }
        catch { return MockAR.list(q); }
    },

    async one(id) {
        if (!this.live) return MockAR.one(id);
        try { return await this._get('/ar/' + encodeURIComponent(id)); }
        catch { return MockAR.one(id); }
    },

    async summary(q) {
        if (!this.live) return MockAR.summary(q);
        try { return await this._get('/summary', q); }
        catch { return MockAR.summary(q); }
    },

    async receipts(q) {
        if (!this.live) return MockAR.receipts(q);
        try { return await this._get('/receipts', q); }
        catch { return MockAR.receipts(q); }
    },

    async receipt(id) {
        if (!this.live) return MockAR.receipt(id);
        try { return await this._get('/receipts/' + encodeURIComponent(id)); }
        catch { return MockAR.receipt(id); }
    },

    async batches(q) {
        if (!this.live) return [];        // โหมดต้นแบบไม่มีชุดส่งให้แก้ (สร้างจริงไม่ได้อยู่แล้ว)
        try { return await this._get('/batches', q); } catch { return []; }
    },

    async batch(id) {
        if (!this.live) return null;
        try { return await this._get('/batches/' + encodeURIComponent(id)); } catch { return null; }
    },

    async candidates(q) {
        if (!this.live) return MockAR.candidates(q);
        try { return await this._get('/candidates', q); }
        catch { return MockAR.candidates(q); }
    },

    /* ── เขียนข้อมูล (ทำได้เฉพาะโหมดต่อฐานข้อมูลจริง) ──
       โหมดต้นแบบต้องปฏิเสธตรง ๆ ไม่ใช่แกล้งสำเร็จ — ผู้ใช้ต้องรู้ว่าไม่ได้บันทึกจริง */

    _requireLive() {
        if (this.live) return;
        const e = new Error('โหมดต้นแบบบันทึกข้อมูลจริงไม่ได้ — ต้องเข้าสู่ระบบและมีเซิร์ฟเวอร์ก่อน');
        e.code = 'PROTOTYPE_MODE';
        throw e;
    },

    async createBatch(body)            { this._requireLive(); return this._send('POST', '/batches', body); },
    async setBatchItems(id, rev, items){ this._requireLive(); return this._send('PUT', `/batches/${id}/items`, { rev, items }); },
    async confirmBatch(id, opts)       { this._requireLive(); return this._send('PUT', `/batches/${id}/confirm`, opts || {}); },
    async deleteBatch(id, reason)      { this._requireLive(); return this._send('DELETE', `/batches/${id}`, { reason }); },
    async createReceipt(body)          { this._requireLive(); return this._send('POST', '/receipts', body); },
    async updateReceipt(id, body)      { this._requireLive(); return this._send('PUT', `/receipts/${id}`, body); },
    async allocate(id, rev, lines)     { this._requireLive(); return this._send('PUT', `/receipts/${id}/allocations`, { rev, allocations: lines }); },
    async confirmReceipt(id, opts)     { this._requireLive(); return this._send('PUT', `/receipts/${id}/confirm`, opts || {}); },
    async deleteReceipt(id, reason)    { this._requireLive(); return this._send('DELETE', `/receipts/${id}`, { reason }); },
    async adjust(body)                 { this._requireLive(); return this._send('POST', '/adjustments', body); },
    async unadjust(id, reason)         { this._requireLive(); return this._send('DELETE', `/adjustments/${id}`, { reason }); },
};

window.FinData = FinData;
