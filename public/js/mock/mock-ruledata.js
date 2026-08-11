/**
 * MediCore RCM — MOCK RULEDATA (สะพานคลังกฎจริง → ชั้น mock)
 * ------------------------------------------------------------
 * ดึงกฎจาก /api/rules (ตาราง rule_definitions/rule_versions ใน MySQL)
 * แล้วเขียนทับ MOCK_RULES ในที่ — หน้าคลังกฎเดิมไม่ต้องแก้วิธีอ่านข้อมูล
 *
 * กติกาเดียวกับ mock-refdata.js:
 *  1. โหลดหลังไฟล์ mock ทุกไฟล์ของหน้านั้น
 *  2. ห้าม reassign — ต้อง mutate อาร์เรย์ในที่ (const rebinding ไม่ได้)
 *  3. ล้มเงียบ: ไม่มีเซิร์ฟเวอร์ = ใช้ mock ต่อ (fetch แนบ dsOptional)
 *  4. วันที่จาก API เป็น ค.ศ. ต้องแปลงเป็น พ.ศ. (+543) ก่อนเขียนทับ
 *
 * ⭐ สิ่งที่เพิ่มจากของเดิมและสำคัญที่สุด: ฟิลด์ exec_state
 *    EXECUTABLE      ระบบตรวจกฎข้อนี้อัตโนมัติได้จริง
 *    NOT_IMPLEMENTED อยู่ในคลังแล้วแต่ยังไม่มีตัวตรวจ — ต้องตรวจด้วยคน
 *    BLOCKED_BY_DOC  รอเอกสารอ้างอิงก่อนจึงจะตรวจได้
 *    หน้าจอต้องแสดงสถานะนี้เสมอ ไม่งั้นผู้ใช้จะเข้าใจว่าทุกกฎถูกตรวจแล้ว
 */
const MockRuleData = {

    loaded: {},
    coverage: null,     // ผลจาก /api/rules/coverage — ใช้ขึ้นแถบสรุป

    /** ค.ศ. → พ.ศ. ('2026-07-20' → '2569-07-20') */
    _be(d) {
        if (!d || !/^\d{4}-/.test(d)) return d || null;
        return (parseInt(d.slice(0, 4), 10) + 543) + d.slice(4);
    },

    async _get(path) {
        const res = await fetch('/api/rules' + path, { dsOptional: true });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    },

    /** แปลงแถวจาก API ให้เป็นรูปทรงเดียวกับ MOCK_RULES */
    _toMockShape(r) {
        return {
            id: r.rule_code,
            name: r.name,
            category: r.category || '',
            status: r.status,
            version: r.version,
            author: r.author_ref || null,
            approver: r.approver_ref || null,
            funds: r.payers || [],           // ชั้น mock เรียก payer ว่า funds
            services: r.services || [],
            effective_from: this._be(r.effective_from),
            effective_to: this._be(r.effective_to),
            severity: r.severity,
            action: r.action,
            maps_to_nhso: r.maps_to_nhso || null,
            doc_id: r.doc_id || null,
            doc_ref: r.doc_ref || null,
            origin_doc: r.origin_doc || null,
            blocked_by: r.blocked_by || null,
            desc: r.description_th || '',
            conditions: r.conditions || [],
            kpi: r.kpi || { hit: 0, true_issue: 0, override: 0, false_positive: 0, prevented: 0 },
            /* ── ของใหม่จากฐานข้อมูลจริง ── */
            exec_state: r.exec_state,
            check_key: r.check_key || null,
            doc_title: r.doc_title || null,
            blocker_title: r.blocker_title || null,
        };
    },

    async hydrateRules() {
        if (!window.MOCK_RULES) return;
        const rows = await this._get('?status=all&with_conditions=1&limit=500');
        if (!rows.length) return;

        /* API ส่งทุกฉบับเมื่อ status=all — เก็บเฉพาะฉบับล่าสุดของแต่ละกฎ
           ให้ตรงกับที่ชั้น mock คาดหวัง (1 กฎ = 1 แถว) */
        const latest = new Map();
        for (const r of rows) {
            const cur = latest.get(r.rule_code);
            if (!cur || Number(r.version) > Number(cur.version)) latest.set(r.rule_code, r);
        }
        const mapped = [...latest.values()].map(r => this._toMockShape(r));

        MOCK_RULES.splice(0, MOCK_RULES.length, ...mapped);
        MockDB.register('rules', MOCK_RULES);
        this.loaded.rules = mapped.length;
    },

    async hydrateCoverage() {
        this.coverage = await this._get('/coverage');
        window.RULE_COVERAGE = this.coverage;
        this.loaded.coverage = this.coverage.active ? this.coverage.active.total : 0;
    },

    async hydrateTemplates() {
        if (!window.MOCK_RULE_TEMPLATES) return;
        const rows = await this._get('/templates');
        if (!rows.length) return;
        MOCK_RULE_TEMPLATES.splice(0, MOCK_RULE_TEMPLATES.length, ...rows.map(t => ({
            key: t.template_key, icon: t.icon, name: t.name_th,
            desc: t.description_th, maps: t.maps_to_nhso,
            check_key: t.check_key, implemented: t.implemented,
        })));
        this.loaded.templates = rows.length;
    },

    async hydrate() {
        await Promise.allSettled([
            this.hydrateRules(),
            this.hydrateCoverage(),
            this.hydrateTemplates(),
        ]);
        const keys = Object.keys(this.loaded);
        if (keys.length) {
            console.info('[MockRuleData] ใช้คลังกฎจากฐานข้อมูลจริง:',
                keys.map(k => `${k}=${this.loaded[k]}`).join(' '));
            document.dispatchEvent(new CustomEvent('ruledata:updated', { detail: this.loaded }));
        }
    },
};

window.MockRuleData = MockRuleData;
MockRuleData.hydrate();
