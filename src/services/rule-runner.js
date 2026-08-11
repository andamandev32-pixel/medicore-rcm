/**
 * rule-runner.js — ตัวรันกฎจากคลังกฎ (ตาราง rule_definitions/rule_versions)
 *
 * ═══ ทำไมต้องมีไฟล์นี้ทั้งที่มี claim-validator.js อยู่แล้ว ═══
 *   claim-validator = "ตรวจตามชั้นข้อมูล" (แฟ้ม/ผู้ป่วย/วินิจฉัย/ยา/ค่าใช้จ่าย/DRG)
 *                     ผลออกมาเป็นรหัสติด C — เป็นมาตรฐานกลางที่ทุก รพ. เหมือนกัน
 *   rule-runner     = "ตรวจตามกฎที่โรงพยาบาลประกาศใช้" — เลือกกฎตามวันที่/สิทธิ/
 *                     ประเภทบริการ (BR-01) แล้วรายงานผลเป็นรายกฎ พร้อมเวอร์ชัน
 *                     และเอกสารอ้างอิง (BR-03)
 *
 *   runner ไม่คำนวณซ้ำ — checker ส่วนใหญ่ "อ่านผล" จาก validation.issues ที่
 *   validator ตรวจไปแล้ว แล้วแปลงเป็นภาษาของกฎ จึงไม่มีตรรกะสองชุดให้เพี้ยนกัน
 *
 * ═══ สัญญาของ checker ═══
 *   CHECKERS[key](ctx) => { outcome, severity?, message?, detail?, evidence? }
 *   outcome: 'PASS' | 'HIT' | 'SKIPPED'
 *     PASS    ตรวจแล้วไม่พบปัญหา
 *     HIT     เข้าเงื่อนไขของกฎ (มีประเด็นต้องแก้)
 *     SKIPPED ตรวจไม่ได้เพราะ "ไม่มีข้อมูลที่ต้องใช้" — ต้องบอกเหตุผลเสมอ
 *
 *   ⭐ ห้าม checker คืน PASS เมื่อข้อมูลขาด — ให้คืน SKIPPED พร้อมเหตุผล
 *      PASS ที่ไม่ได้ตรวจจริงคือคำโกหกที่แพงที่สุดในระบบนี้
 *
 * ═══ ผลลัพธ์ระดับกฎ (เติมโดย runner ไม่ใช่ checker) ═══
 *   NOT_IMPLEMENTED  กฎมีในคลังแต่ยังไม่ผูก check_key
 *   BLOCKED_BY_DOC   กฎอ้างเอกสารที่ยังไม่มี (ref_doc_sources.status != PRESENT)
 *   ERROR            ผูก check_key ไว้แต่ไม่มีใน CHECKERS (registry เพี้ยน)
 */
const { validateClaim } = require('./claim-validator');
const { suggestForClaim } = require('./claim-suggester');

/* ── ตัวช่วยอ่านผลจาก validator ── */
const issuesWhere = (validation, fn) =>
    ((validation && validation.issues) || []).filter(fn);
const hasIssue = (validation, fn) => issuesWhere(validation, fn).length > 0;
const firstIssue = (validation, fn) => issuesWhere(validation, fn)[0] || null;

const hit  = (message, detail, evidence) => ({ outcome: 'HIT', message, detail, evidence });
const pass = () => ({ outcome: 'PASS' });
const skip = detail => ({ outcome: 'SKIPPED', detail });

/** อ่านเงื่อนไขเชิงตัวเลขของสิทธิ (เพดานค่าห้อง/กรอบวันส่งเบิก/UCEP) ณ วันที่หนึ่ง */
async function payerRule(pool, payerKey, ruleKey, asOf) {
    if (!payerKey) return null;
    const [[r]] = await pool.query(
        `SELECT num_value, label_th, verified FROM ref_payer_rules
         WHERE payer_key = ? AND rule_key = ? AND is_active = 1
           AND (effective_from IS NULL OR effective_from <= ?)
           AND (effective_to   IS NULL OR effective_to   >= ?)
         ORDER BY effective_from DESC LIMIT 1`,
        [payerKey, ruleKey, asOf, asOf]
    );
    return r || null;
}

const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/* ══════════════════════════════════════════════════════════
   CHECKERS — ทะเบียนตัวตรวจ
   ชื่อคีย์ต้องตรงกับ rule_versions.check_key (scripts/check-rules.js เฝ้าให้)
   ══════════════════════════════════════════════════════════ */
const CHECKERS = {

    /** แฟ้มครบตามกองทุน — อ่านผลชั้น FILES ของ validator */
    async files_required(ctx) {
        if (!Array.isArray(ctx.claim.files_present)) return skip('ไม่ได้ส่งรายการแฟ้มที่จะส่ง (files_present)');
        const miss = issuesWhere(ctx.validation, i => i.layer === 'FILES' && i.severity === 'ERROR');
        if (!miss.length) return pass();
        return hit('ส่งแฟ้มไม่ครบตามกองทุนที่เบิก',
                   miss.map(m => m.detail).join(' · '), { missing: miss.length });
    },

    /** ราคายาต้องตรง Drug Catalogue — ชั้น DRUG (C195 / P124) */
    async drug_price_catalogue(ctx) {
        if (!Array.isArray(ctx.claim.drugs) || !ctx.claim.drugs.length) return skip('ไม่มีรายการยาในเคสนี้');
        const bad = issuesWhere(ctx.validation, i => i.code === 'C195');
        if (!bad.length) return pass();
        return hit('ราคายาที่เบิกไม่ตรงกับราคาอ้างอิงใน Drug Catalogue',
                   bad.map(b => b.detail).join(' · '), { items: bad.length });
    },

    /** เอกสารที่สิทธินั้นบังคับ (Approve Code / บัตรผู้ประกันตน / เอกสารประกันเอกชน) */
    async payer_doc_present(ctx) {
        const want = (ctx.params && ctx.params.docs) || [];
        if (!want.length) return skip('กฎไม่ได้ระบุว่าต้องมีเอกสารอะไร (params.docs ว่าง)');
        if (!ctx.fundChecks) return skip('ยังไม่มีผลตรวจเอกสารตามสิทธิของเคสนี้ (ipd_fund_checks)');

        const state = new Map(ctx.fundChecks.map(f => [f.check_key, f.state]));
        const missing = want.filter(k => (state.get(k) || 'MISSING') === 'MISSING');
        if (!missing.length) return pass();

        const labels = ctx.payerDocLabels || {};
        return hit('ยังไม่มีเอกสารที่สิทธินี้บังคับก่อนส่งเบิก',
                   missing.map(k => labels[k] || k).join(' · '), { missing });
    },

    /** ลากลับบ้านแล้วต้องส่งแฟ้ม 15 */
    async leave_day_file15(ctx) {
        const days = Number((ctx.claim.admission && ctx.claim.admission.leave_days) || 0);
        if (!days) return pass();
        const files = ctx.claim.files_present;
        if (!Array.isArray(files)) return skip('ไม่ได้ส่งรายการแฟ้มที่จะส่ง (files_present)');
        if (files.map(Number).includes(15)) return pass();
        return hit('มีวันลากลับบ้านแต่ไม่ได้ส่งแฟ้ม 15 (Leave day)',
                   `ลากลับบ้าน ${days} วัน`, { leave_days: days });
    },

    /** ต้องมีทั้งการวินิจฉัยหลักและกลุ่ม DRG */
    async dx_drg_present(ctx) {
        const pdx = ctx.claim.diagnosis && ctx.claim.diagnosis.pdx;
        const drg = ctx.claim.drg && ctx.claim.drg.code;
        const miss = [];
        if (!pdx || (Array.isArray(pdx) && !pdx.length)) miss.push('ไม่มีการวินิจฉัยหลัก (Pdx)');
        if (!drg) miss.push('ยังไม่ได้จัดกลุ่ม DRG');
        if (!miss.length) return pass();
        return hit('ข้อมูลที่จำเป็นต่อการเบิกผู้ป่วยในยังไม่ครบ', miss.join(' · '), { missing: miss });
    },

    /** วันนอนหลุดจุดตัด — params.band: 'high' | 'any' */
    async los_outlier(ctx) {
        const band = (ctx.params && ctx.params.band) || 'any';
        const trims = issuesWhere(ctx.validation, i => i.rule === 'ENG-DRG-TRIM');
        if (!ctx.claim.drg || !ctx.claim.drg.code) return skip('ยังไม่ได้จัดกลุ่ม DRG จึงเทียบจุดตัดวันนอนไม่ได้');
        if (!trims.length) return pass();
        const high = trims.filter(t => /เกินจุดตัดบน/.test(t.detail || ''));
        const use = band === 'high' ? high : trims;
        if (!use.length) return pass();
        return hit('วันนอนอยู่นอกช่วงจุดตัดของกลุ่ม DRG — ต้องคิด AdjRW แบบ outlier',
                   use.map(u => u.detail).join(' · '), { band });
    },

    /** องค์ประกอบเวชระเบียนตามเกณฑ์ MRA ต้องมีครบ — params.components[] */
    async mra_component_present(ctx) {
        const want = (ctx.params && ctx.params.components) || [];
        if (!want.length) return skip('กฎไม่ได้ระบุองค์ประกอบที่ต้องมี (params.components ว่าง)');
        if (!ctx.mraItems) return skip('ยังไม่มีผลตรวจเวชระเบียน (MRA) ของเคสนี้');

        const bad = [];
        for (const key of want) {
            const rows = ctx.mraItems.filter(i => i.component_key === key);
            if (!rows.length) { bad.push(`${key} (ยังไม่ได้ตรวจ)`); continue; }
            if (rows.some(r => r.state === 'MISSING')) bad.push(key);
        }
        if (!bad.length) return pass();
        return hit('เวชระเบียนยังขาดองค์ประกอบที่เกณฑ์ MRA กำหนด', bad.join(' · '), { components: bad });
    },

    /** กลุ่มที่จัดได้จาก Pdx ไม่ตรงกับ DRG ที่บันทึก — อ่านจากชั้นเสนอแนะ */
    async drg_regroup_mismatch(ctx) {
        const s = (ctx.suggestions || []).find(x => x.id === 'SUG-DRG-001');
        if (!ctx.claim.drg || !ctx.claim.drg.code) return skip('ยังไม่ได้จัดกลุ่ม DRG');
        if (!s) return pass();
        return hit(s.message, s.detail, s.evidence);
    },

    /** รหัสที่ลงรองรับกลุ่มที่ RW สูงกว่า (เตือน downcoding) */
    async drg_downcoding(ctx) {
        const s = (ctx.suggestions || []).find(x => x.id === 'SUG-DRG-002');
        if (!ctx.claim.drg || !ctx.claim.drg.code) return skip('ยังไม่ได้จัดกลุ่ม DRG');
        if (!s) return pass();
        return hit(s.message, s.detail, s.evidence);
    },

    /** ค่าห้อง/ค่าอาหารต่อวันเกินเพดานของสิทธิ */
    async room_charge_cap(ctx) {
        const items = (ctx.claim.charges && ctx.claim.charges.items) || [];
        if (!items.length) return skip('ไม่มีค่าใช้จ่ายราย item จึงตรวจค่าห้องไม่ได้');
        const cap = await payerRule(ctx.pool, ctx.payer_key, 'room_cap', ctx.as_of);
        if (!cap || cap.num_value == null) return skip(`ยังไม่มีเพดานค่าห้องของสิทธิ ${ctx.payer_key || '-'}`);

        const los = Number(ctx.claim.admission && ctx.claim.admission.los) || 0;
        const room = items.filter(i => String(i.billgrcs || '') === '02');
        if (!room.length || los <= 0) return pass();
        const total = room.reduce((s, i) => s + Number(i.amount || 0), 0);
        const perDay = total / los;
        if (perDay <= Number(cap.num_value)) return pass();
        return hit('ค่าห้อง/ค่าอาหารต่อวันเกินเพดานของสิทธิ',
                   `เฉลี่ย ${perDay.toFixed(2)} บาท/วัน · เพดาน ${Number(cap.num_value).toFixed(2)} บาท/วัน` +
                   (cap.verified ? '' : ' (เพดานยังเป็นค่าจำลอง รอประกาศจริง)'),
                   { per_day: Math.round(perDay * 100) / 100, cap: Number(cap.num_value) });
    },

    /** เลยกรอบวันส่งเบิกนับจากวันจำหน่าย */
    async submit_deadline(ctx) {
        const disch = ctx.claim.admission && ctx.claim.admission.discharge_date;
        if (!disch) return skip('เคสยังไม่จำหน่าย จึงยังไม่เริ่มนับกรอบวันส่งเบิก');
        const r = await payerRule(ctx.pool, ctx.payer_key, 'submit_days', ctx.as_of);
        if (!r || r.num_value == null) return skip(`ยังไม่มีกรอบวันส่งเบิกของสิทธิ ${ctx.payer_key || '-'}`);

        const today = ctx.today || new Date().toISOString().slice(0, 10);
        const used = dayDiff(String(disch).slice(0, 10), today);
        const limit = Number(r.num_value);
        if (!isFinite(used) || used <= limit) return pass();
        return hit('เลยกรอบเวลาส่งเบิกนับจากวันจำหน่าย',
                   `ผ่านมาแล้ว ${used} วัน · กรอบ ${limit} วัน` +
                   (r.verified ? '' : ' (กรอบยังเป็นค่าจำลอง รอประกาศจริง)'),
                   { days_used: used, limit });
    },

    /** สิทธิ UCEP ใช้ได้ในช่วง 72 ชม.แรก */
    async ucep_72h(ctx) {
        if (ctx.payer_key !== 'EMS') return skip('ไม่ใช่เคสสิทธิฉุกเฉินวิกฤต (UCEP)');
        const adm = ctx.claim.admission || {};
        if (!adm.admit_date) return skip('ไม่มีวันรับผู้ป่วยไว้');
        const r = await payerRule(ctx.pool, 'EMS', 'ucep_hours', ctx.as_of);
        const limitH = r && r.num_value != null ? Number(r.num_value) : 72;

        const end = adm.discharge_date || ctx.today || new Date().toISOString().slice(0, 10);
        const hours = dayDiff(String(adm.admit_date).slice(0, 10), String(end).slice(0, 10)) * 24;
        if (!isFinite(hours) || hours <= limitH) return pass();
        return hit(`อยู่เกินช่วง ${limitH} ชั่วโมงของสิทธิ UCEP — ส่วนที่เกินต้องเบิกตามสิทธิหลัก`,
                   `นับได้ประมาณ ${hours} ชั่วโมง`, { hours, limit: limitH });
    },
};

/* ══════════════════════════════════════════════════════════
   เลือกกฎตาม BR-01 แล้วรันทีละข้อ
   ══════════════════════════════════════════════════════════ */

async function selectRules(pool, { as_of, payer_key, service_type }) {
    const cond = [`rv.status = 'ACTIVE'`, 'rv.is_active = 1', 'rd.is_active = 1'];
    const params = [];
    if (as_of) {
        cond.push('(rv.effective_from IS NULL OR rv.effective_from <= ?)');
        cond.push('(rv.effective_to   IS NULL OR rv.effective_to   >= ?)');
        params.push(as_of, as_of);
    }
    if (payer_key) {
        cond.push(`EXISTS (SELECT 1 FROM rule_version_payers p
                           WHERE p.rule_version_id = rv.rule_version_id AND p.payer_key = ?)`);
        params.push(payer_key);
    }
    if (service_type) {
        cond.push(`EXISTS (SELECT 1 FROM rule_version_services s
                           WHERE s.rule_version_id = rv.rule_version_id AND s.service_type = ?)`);
        params.push(service_type);
    }

    const [rows] = await pool.query(
        `SELECT rv.rule_version_id, rv.rule_code, rv.version, rv.severity, rv.action,
                rv.maps_to_nhso, rv.check_key, rv.params_json, rv.blocked_by, rv.doc_id, rv.doc_ref,
                rd.name, rd.category, ds.status AS blocker_status, ds.title AS blocker_title
         FROM rule_versions rv
         JOIN rule_definitions rd ON rd.rule_code = rv.rule_code
         LEFT JOIN ref_doc_sources ds ON ds.doc_id = rv.blocked_by
         WHERE ${cond.join(' AND ')}
         ORDER BY rv.rule_code`,
        params
    );
    return rows;
}

/**
 * รันกฎกับเคสหนึ่ง
 *
 * @param {object} pool
 * @param {object} arg
 *   claim        payload แบบเดียวกับ POST /api/reference/validate
 *   validation   ผลจาก validateClaim (ถ้าไม่ส่งมา runner จะเรียกเอง)
 *   suggestions  ผลจาก suggestForClaim (ถ้าไม่ส่งมา runner จะเรียกเอง)
 *   as_of        วันที่ใช้เลือกกฎ (ค.ศ. YYYY-MM-DD) — ปกติคือวันจำหน่าย/วันรับบริการ
 *   payer_key    สิทธิผู้ป่วย · service_type 'IPD'|'OPD'|'PP'
 *   mraItems     ผลตรวจ MRA ของเคส (ถ้ามี) · fundChecks ผลตรวจเอกสารตามสิทธิ
 *   subject      {type, id} สำหรับบันทึกผล · persist=true เพื่อเขียน rule_executions
 */
async function runRules(pool, opts = {}) {
    const {
        claim, as_of = null, payer_key = null, service_type = null,
        mraItems = null, fundChecks = null, subject = null, persist = false, actorId = null,
    } = opts;
    if (!claim) throw new Error('runRules ต้องมี claim');

    const validation  = opts.validation  || await validateClaim(pool, claim);
    const suggestions = opts.suggestions || await suggestForClaim(pool, claim, validation.fund);

    /* ป้ายชื่อเอกสารตามสิทธิ — ใช้ทำข้อความให้อ่านรู้เรื่อง */
    let payerDocLabels = {};
    if (payer_key) {
        const [docs] = await pool.query(
            'SELECT check_key, label_th FROM ref_payer_docs WHERE payer_key = ? AND is_active = 1',
            [payer_key]
        );
        payerDocLabels = Object.fromEntries(docs.map(d => [d.check_key, d.label_th]));
    }

    const rules = await selectRules(pool, { as_of, payer_key, service_type });
    const items = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const r of rules) {
        const base = {
            rule_code: r.rule_code, version: r.version, name: r.name, category: r.category,
            severity: r.severity, action: r.action, maps_to_nhso: r.maps_to_nhso,
            check_key: r.check_key, doc_id: r.doc_id, doc_ref: r.doc_ref,
        };

        /* กฎที่รอเอกสาร — ตรวจไม่ได้และต้องไม่แสดงว่าผ่าน */
        if (r.blocked_by && r.blocker_status !== 'PRESENT') {
            items.push({ ...base, outcome: 'BLOCKED_BY_DOC',
                message: `ยังตรวจกฎนี้ไม่ได้ — รอเอกสาร [${r.blocked_by}] ${r.blocker_title || ''}`.trim(),
                detail: null, evidence: null });
            continue;
        }
        if (!r.check_key) {
            items.push({ ...base, outcome: 'NOT_IMPLEMENTED',
                message: 'กฎนี้อยู่ในคลังแล้วแต่ยังไม่มีตัวตรวจอัตโนมัติ — ต้องตรวจด้วยคน',
                detail: null, evidence: null });
            continue;
        }
        const fn = CHECKERS[r.check_key];
        if (!fn) {
            items.push({ ...base, outcome: 'ERROR',
                message: `ไม่พบตัวตรวจชื่อ "${r.check_key}" ในระบบ (คลังกฎกับโค้ดไม่ตรงกัน)`,
                detail: null, evidence: null });
            continue;
        }

        try {
            const res = await fn({
                pool, claim, validation, suggestions, mraItems, fundChecks,
                params: r.params_json || null, payer_key, as_of, today, payerDocLabels,
            });
            items.push({
                ...base,
                outcome: res.outcome,
                /* SKIPPED บอกเหตุผลไว้ใน detail — ยกขึ้นเป็น message ด้วย
                   ไม่งั้นหน้าจอจะเห็นแถวว่างเปล่าแล้วเข้าใจผิดว่าไม่มีอะไร */
                message: res.message || (res.outcome === 'SKIPPED' && res.detail
                    ? `ตรวจไม่ได้ — ${res.detail}` : null),
                detail: res.detail || null,
                evidence: res.evidence || null,
            });
        } catch (e) {
            items.push({ ...base, outcome: 'ERROR', message: `ตัวตรวจทำงานผิดพลาด: ${e.message}`,
                detail: null, evidence: null });
        }
    }

    const count = o => items.filter(i => i.outcome === o).length;
    const executed = items.filter(i => ['PASS', 'HIT', 'SKIPPED'].includes(i.outcome)).length;
    const summary = {
        rules_total: items.length,
        rules_executed: executed,
        hits: count('HIT'),
        passed: count('PASS'),
        skipped: count('SKIPPED'),
        not_implemented: count('NOT_IMPLEMENTED'),
        blocked: count('BLOCKED_BY_DOC'),
        errors: count('ERROR'),
        /* ⭐ ตัวเลขที่ต้องโชว์แทน "ผ่านกฎทั้งหมด" — บอกตรง ๆ ว่าตรวจจริงกี่ข้อ */
        coverage_pct: items.length ? Math.round((executed / items.length) * 100) : 0,
    };

    let execution_id = null;
    if (persist) {
        const [ins] = await pool.query(
            `INSERT INTO rule_executions (subject_type, subject_id, as_of, payer_key, service_type,
                 rules_total, rules_executed, hits, not_implemented, blocked, input_snapshot, actor_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [(subject && subject.type) || 'ADHOC', (subject && subject.id) || null, as_of,
             payer_key, service_type, summary.rules_total, summary.rules_executed, summary.hits,
             summary.not_implemented, summary.blocked, JSON.stringify(claim), actorId]
        );
        execution_id = ins.insertId;
        for (const it of items) {
            await pool.query(
                `INSERT INTO rule_execution_items (execution_id, rule_code, version, check_key,
                     outcome, severity, action, message, detail, evidence_json, doc_ref)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [execution_id, it.rule_code, it.version, it.check_key, it.outcome,
                 it.severity, it.action, it.message, it.detail,
                 it.evidence ? JSON.stringify(it.evidence) : null, it.doc_ref]
            );
        }
    }

    return { as_of, payer_key, service_type, summary, items, execution_id };
}

/** รายชื่อตัวตรวจที่มีจริงในโค้ด — ใช้โดย /api/rules/coverage และ scripts/check-rules.js */
function checkerKeys() { return Object.keys(CHECKERS).sort(); }

module.exports = { runRules, selectRules, CHECKERS, checkerKeys };
