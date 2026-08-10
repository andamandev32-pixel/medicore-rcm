/**
 * MediCore RCM — MOCK REFDATA (สะพานข้อมูลจริง → ชั้น mock)
 * ------------------------------------------------------------
 * ดึงข้อมูลอ้างอิงมาตรฐานจาก /api/reference (ตาราง ref_* ใน MySQL)
 * แล้ว "เขียนทับ" ค่าคงที่ฝั่ง mock ในที่ — หน้าจอเดิมไม่ต้องแก้วิธีอ่าน
 *
 * กติกาสำคัญ:
 *  1. ต้องโหลด "หลังไฟล์ mock ทุกไฟล์" ของหน้านั้น (ค่าคงที่ต้องมีอยู่ก่อน)
 *  2. ห้าม reassign — ไฟล์อื่นอ้าง const binding เดิมอยู่ การตั้ง window.X ใหม่
 *     ไม่มีผล ต้อง mutate ในที่เท่านั้น (splice อาร์เรย์ / แก้ property ของ object)
 *  3. ล้มเงียบ: ไม่มีเซิร์ฟเวอร์ (static deploy) = ใช้ mock ต่อ ไม่มี error โผล่
 *     (fetch แนบ dsOptional เพื่อไม่ให้ ds-auth ขึ้นป้าย "โหมดนำเสนอ")
 *  4. วันที่จาก API เป็น ค.ศ. — ชั้น mock ใช้ พ.ศ. ต้องแปลง +543 ก่อนเขียนทับ
 *  5. ชุดไหนโหลดสำเร็จยิง event 'refdata:updated' — หน้าที่สนใจ re-render เอง
 */
const MockRefData = {

    /** ชุดที่ hydrate สำเร็จ → จำนวนแถว เช่น { errorCodes: 6, files: 15 } */
    loaded: {},

    /** metadata รหัส NHSO DP จากตารางจริง — MockRules.origin() ใช้ขึ้นป้ายที่มา */
    errMeta: {},

    /** ค.ศ. → พ.ศ. ('2026-06-23' → '2569-06-23') */
    _be(d) {
        if (!d || !/^\d{4}-/.test(d)) return d || null;
        return (parseInt(d.slice(0, 4), 10) + 543) + d.slice(4);
    },

    async _get(path) {
        const res = await fetch('/api/reference' + path, { dsOptional: true });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    },

    /* ── 1. รหัสตอบกลับ NHSO DP → NHSO_ERR_TEXT / NHSO_ERR_VERIFIED ── */
    async hydrateErrorCodes() {
        if (!window.NHSO_ERR_TEXT) return;
        const rows = await this._get('/error-codes?system=NHSO_DP&limit=100');
        if (!rows.length) return;

        Object.keys(NHSO_ERR_TEXT).forEach(k => delete NHSO_ERR_TEXT[k]);
        NHSO_ERR_VERIFIED.clear();
        for (const r of rows) {
            NHSO_ERR_TEXT[r.code] = r.description_th;
            if (r.verified) NHSO_ERR_VERIFIED.add(r.code);
            this.errMeta[r.code] = { source_doc: r.source_doc, verified: !!r.verified };
        }
        window.REF_ERR_META = this.errMeta;
        this.loaded.errorCodes = rows.length;
    },

    /* ── 2. โครงสร้าง 15 แฟ้ม → NHSO_FILES + NHSO_FILE_CONDITION ── */
    async hydrateFiles() {
        if (!window.NHSO_FILES) return;
        const rows = await this._get('/files');
        if (!rows.length) return;

        NHSO_FILES.splice(0, NHSO_FILES.length, ...rows.map(r => ({
            no: r.file_no, group: r.group_key, th: r.name_th, en: r.name_en,
            desc: r.description_th, req: r.req_count, cond: r.cond_count,
            opt: r.opt_count, fields: r.field_count, origin: r.origin,
            mapping: r.mapping_status,
        })));

        Object.keys(NHSO_FILE_CONDITION).forEach(k => delete NHSO_FILE_CONDITION[k]);
        for (const r of rows) {
            if (r.condition_key) {
                NHSO_FILE_CONDITION[r.file_no] = { key: r.condition_key, label: r.condition_label };
            }
        }
        this.loaded.files = rows.length;
    },

    /* ── 3. เมทริกซ์กองทุน × แฟ้ม → NHSO_FUND_FILES ── */
    async hydrateFundFiles() {
        if (!window.NHSO_FUND_FILES) return;
        const rows = await this._get('/fund-files');
        if (!rows.length) return;

        NHSO_FUND_FILES.splice(0, NHSO_FUND_FILES.length, ...rows.map(r => ({
            key: r.fund_key, label: r.label_th,
            files: r.files.map(f => f.file_no),
        })));
        this.loaded.fundFiles = rows.length;
    },

    /* ── 4. Thai DRG → IPD_DRG_VERSIONS + IPD_DRG_TABLE + MockDB('ipd_drg_rows') ── */
    async hydrateDrg() {
        if (!window.IPD_DRG_TABLE) return;
        const [versions, rows] = await Promise.all([
            this._get('/drg-versions'),
            this._get('/drg?limit=500'),
        ]);
        if (!rows.length) return;

        if (versions.length) {
            IPD_DRG_VERSIONS.splice(0, IPD_DRG_VERSIONS.length, ...versions.map(v => ({
                code: v.version_code, label: v.label,
                effective_from: this._be(v.effective_from), effective_to: this._be(v.effective_to),
                source: v.source_doc || 'D4', srcRef: v.source_ref, verified: !!v.verified,
            })));
        }

        IPD_DRG_TABLE.splice(0, IPD_DRG_TABLE.length, ...rows.map(r => ({
            drg: r.drg_code, mdc: r.mdc, label: r.description_th,
            rw: Number(r.rw), alos: Number(r.alos),
            trimLow: r.trim_low, trimHigh: r.trim_high,
            pdx: r.pdx_codes ? r.pdx_codes.split('|') : [],
            version: r.version_code, source: r.source_doc || 'D4',
            srcRef: r.source_ref, verified: !!r.verified,
        })));

        /* MockDB เก็บสำเนาไว้ตั้งแต่ mock-ipd.js โหลด — ต้อง register ใหม่
           ทุกอย่างที่อ่านผ่าน MockDB.all('ipd_drg_rows') จะเห็นชุดใหม่ทันที */
        MockDB.register('ipd_drg_rows', IPD_DRG_TABLE.map(d => ({ id: `${d.version}/${d.drg}`, ...d })));
        this.loaded.drg = rows.length;
    },

    /**
     * โหลดทุกชุดพร้อมกัน — แต่ละชุดล้มได้อิสระ (ชุดที่ล้มใช้ mock เดิมต่อ)
     * สำเร็จอย่างน้อย 1 ชุด → ยิง 'refdata:updated' ให้หน้า re-render
     */
    async hydrate() {
        await Promise.allSettled([
            this.hydrateErrorCodes(),
            this.hydrateFiles(),
            this.hydrateFundFiles(),
            this.hydrateDrg(),
        ]);
        const keys = Object.keys(this.loaded);
        if (keys.length) {
            console.info('[MockRefData] ใช้ข้อมูลอ้างอิงจากฐานข้อมูลจริง:',
                keys.map(k => `${k}=${this.loaded[k]}`).join(' '));
            document.dispatchEvent(new CustomEvent('refdata:updated', { detail: this.loaded }));
        }
        /* ไม่มีเซิร์ฟเวอร์ = loaded ว่าง = เงียบ — หน้าใช้ mock ตามเดิม */
    },
};

window.MockRefData = MockRefData;

/* เริ่มดึงทันทีที่ไฟล์โหลด (ก่อน DOMContentLoaded) — network ช้ากว่า init ของหน้าเสมอ
   จึงมั่นใจได้ว่า listener 'refdata:updated' ของหน้าถูกติดตั้งก่อน event ยิง */
MockRefData.hydrate();
