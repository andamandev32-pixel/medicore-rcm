/**
 * seed-rules.js — โหลดคลังกฎจาก data/reference/rules*.csv
 * รัน: npm run seed:rules   (ต้อง npm run seed:reference ก่อน — กฎมี FK ไปเอกสาร/สิทธิ)
 *
 * แยกจาก seed-reference.js เพราะกฎมีตารางลูก 3 ตาราง (payers/services/conditions)
 * ที่ต้องรู้ rule_version_id ของแม่ก่อน — รูปแบบ DATASETS แบบแถวเดียวจบทำไม่ได้
 *
 * ตารางลูกใช้วิธี replace-set: ลบของเดิมของเวอร์ชันนั้นแล้วใส่ใหม่ทั้งชุด
 * (เหมือน PUT /coding ของ ipd) — รันซ้ำได้ ผลเท่าเดิมเสมอ
 */
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');
const { parseCsvObjects, toCEDate } = require('./csv');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'reference');

const S = v => { const s = String(v == null ? '' : v).trim(); return s === '' ? null : s; };
const N = v => { const s = S(v); if (s == null) return null; const n = Number(s); return isFinite(n) ? n : null; };
const BOOL = v => (String(v).trim() === '1' ? 1 : 0);
const LIST = v => String(v || '').split('|').map(x => x.trim()).filter(Boolean);

function read(file) {
    const p = path.join(DATA_DIR, file);
    if (!fs.existsSync(p)) return null;
    return parseCsvObjects(fs.readFileSync(p, 'utf8')).records;
}

async function seed() {
    const conn = await mysql.createConnection({
        host:     process.env.DB_HOST || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 3306,
        user:     process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'medicore_rcm',
    });

    try {
        const rules      = read('rules.csv');
        const versions   = read('rule-versions.csv');
        const conditions = read('rule-conditions.csv') || [];
        const templates  = read('rule-templates.csv')  || [];
        const kpis       = read('rule-kpi.csv')        || [];
        if (!rules || !versions) {
            console.error('❌ ไม่พบ rules.csv หรือ rule-versions.csv ใน data/reference/');
            process.exit(1);
        }

        /* เอกสาร/สิทธิที่มีจริง — ใช้กันไม่ให้ FK พังเงียบ ๆ */
        const [docRows]   = await conn.query('SELECT doc_id FROM ref_doc_sources');
        const [payerRows] = await conn.query('SELECT payer_key FROM ref_payers');
        const knownDocs   = new Set(docRows.map(r => r.doc_id));
        const knownPayers = new Set(payerRows.map(r => r.payer_key));
        const warn = [];

        await conn.beginTransaction();

        /* ── 1. ตัวกฎ ── */
        for (const r of rules) {
            if (!S(r.rule_code) || !S(r.name)) continue;
            await conn.query(
                `INSERT INTO rule_definitions (rule_code, name, category, description_th)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE name=VALUES(name), category=VALUES(category),
                     description_th=VALUES(description_th)`,
                [S(r.rule_code), S(r.name), S(r.category), S(r.description_th)]
            );
        }

        /* ── 2. ฉบับของกฎ + ขอบเขต (payers/services) ── */
        let verCount = 0, scopeCount = 0;
        for (const v of versions) {
            const code = S(v.rule_code), ver = N(v.version);
            if (!code || ver == null) continue;

            let docId = S(v.doc_id), blockedBy = S(v.blocked_by);
            if (docId && !knownDocs.has(docId)) { warn.push(`${code} v${ver}: ไม่พบเอกสาร ${docId} — เว้นว่างไว้`); docId = null; }
            if (blockedBy && !knownDocs.has(blockedBy)) { warn.push(`${code} v${ver}: ไม่พบเอกสาร ${blockedBy}`); blockedBy = null; }

            await conn.query(
                `INSERT INTO rule_versions (rule_code, version, status, severity, action,
                     maps_to_nhso, nhso_system, check_key, params_json, blocked_by, doc_id, doc_ref,
                     origin_doc, author_ref, approver_ref, effective_from, effective_to, note,
                     source_doc, verified)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE status=VALUES(status), severity=VALUES(severity),
                     action=VALUES(action), maps_to_nhso=VALUES(maps_to_nhso),
                     nhso_system=VALUES(nhso_system), check_key=VALUES(check_key),
                     params_json=VALUES(params_json), blocked_by=VALUES(blocked_by),
                     doc_id=VALUES(doc_id), doc_ref=VALUES(doc_ref), origin_doc=VALUES(origin_doc),
                     author_ref=VALUES(author_ref), approver_ref=VALUES(approver_ref),
                     effective_from=VALUES(effective_from), effective_to=VALUES(effective_to),
                     note=VALUES(note), source_doc=VALUES(source_doc), verified=VALUES(verified)`,
                [code, ver, S(v.status) || 'DRAFT', S(v.severity) || 'ERROR', S(v.action) || 'WARN',
                 S(v.maps_to_nhso), S(v.nhso_system) || 'ECLAIM', S(v.check_key), S(v.params_json),
                 blockedBy, docId, S(v.doc_ref), S(v.origin_doc),
                 S(v.author_ref), S(v.approver_ref),
                 toCEDate(v.effective_from), toCEDate(v.effective_to), S(v.note),
                 S(v.source_doc), BOOL(v.verified)]
            );
            verCount++;

            const [[rv]] = await conn.query(
                'SELECT rule_version_id FROM rule_versions WHERE rule_code = ? AND version = ?',
                [code, ver]
            );
            const rvId = rv.rule_version_id;

            /* replace-set: ขอบเขตของเวอร์ชันนี้ */
            await conn.query('DELETE FROM rule_version_payers   WHERE rule_version_id = ?', [rvId]);
            await conn.query('DELETE FROM rule_version_services WHERE rule_version_id = ?', [rvId]);
            for (const p of LIST(v.payers)) {
                if (!knownPayers.has(p)) { warn.push(`${code} v${ver}: ไม่รู้จักสิทธิ ${p}`); continue; }
                await conn.query(
                    'INSERT IGNORE INTO rule_version_payers (rule_version_id, payer_key) VALUES (?, ?)',
                    [rvId, p]
                );
                scopeCount++;
            }
            for (const s of LIST(v.services)) {
                if (!['OPD', 'IPD', 'PP'].includes(s)) { warn.push(`${code} v${ver}: ไม่รู้จักบริการ ${s}`); continue; }
                await conn.query(
                    'INSERT IGNORE INTO rule_version_services (rule_version_id, service_type) VALUES (?, ?)',
                    [rvId, s]
                );
                scopeCount++;
            }
        }

        /* ── 3. เงื่อนไขเชิงเอกสาร (replace-set ต่อเวอร์ชัน) ── */
        const byVersion = new Map();
        for (const c of conditions) {
            const key = `${S(c.rule_code)}/${N(c.version)}`;
            if (!byVersion.has(key)) byVersion.set(key, []);
            byVersion.get(key).push(c);
        }
        let condCount = 0;
        for (const [key, rows] of byVersion) {
            const [code, ver] = key.split('/');
            const [[rv]] = await conn.query(
                'SELECT rule_version_id FROM rule_versions WHERE rule_code = ? AND version = ?',
                [code, ver]
            );
            if (!rv) continue;
            await conn.query('DELETE FROM rule_conditions WHERE rule_version_id = ?', [rv.rule_version_id]);
            for (const c of rows) {
                await conn.query(
                    `INSERT INTO rule_conditions (rule_version_id, seq, join_op, field, op, value)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [rv.rule_version_id, N(c.seq) || 0, S(c.join_op), S(c.field) || '-', S(c.op) || '-', S(c.value)]
                );
                condCount++;
            }
        }

        /* ── 4. แม่แบบกฎ ── */
        for (const t of templates) {
            if (!S(t.template_key)) continue;
            await conn.query(
                `INSERT INTO rule_templates (template_key, icon, name_th, description_th,
                     maps_to_nhso, check_key, seq)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE icon=VALUES(icon), name_th=VALUES(name_th),
                     description_th=VALUES(description_th), maps_to_nhso=VALUES(maps_to_nhso),
                     check_key=VALUES(check_key), seq=VALUES(seq)`,
                [S(t.template_key), S(t.icon), S(t.name_th) || S(t.template_key), S(t.description_th),
                 S(t.maps_to_nhso), S(t.check_key), N(t.seq) || 0]
            );
        }

        /* ── 5. สถิติผลของกฎ (ตัวเลขสาธิต — simulated = 1) ── */
        let kpiCount = 0;
        for (const k of kpis) {
            const asOf = toCEDate(k.as_of);
            if (!S(k.rule_code) || !asOf) continue;
            await conn.query(
                `INSERT INTO rule_kpi_snapshots (rule_code, as_of, hit, true_issue, override_count,
                     false_positive, prevented, simulated)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE hit=VALUES(hit), true_issue=VALUES(true_issue),
                     override_count=VALUES(override_count), false_positive=VALUES(false_positive),
                     prevented=VALUES(prevented), simulated=VALUES(simulated)`,
                [S(k.rule_code), asOf, N(k.hit) || 0, N(k.true_issue) || 0, N(k.override_count) || 0,
                 N(k.false_positive) || 0, N(k.prevented) || 0, S(k.simulated) == null ? 1 : BOOL(k.simulated)]
            );
            kpiCount++;
        }

        await conn.query(
            `INSERT INTO audit_log (entity, entity_id, action, actor_id, actor_role, note)
             VALUES ('reference', 'rules', 'LOAD', NULL, NULL, ?)`,
            [`rules.csv · ${rules.length} กฎ · ${verCount} ฉบับ · ${condCount} เงื่อนไข`]
        );
        await conn.commit();

        const [[cov]] = await conn.query(
            `SELECT COUNT(*) AS total, SUM(check_key IS NOT NULL) AS implemented
             FROM rule_versions rv
             WHERE rv.status = 'ACTIVE' AND rv.is_active = 1`
        );

        console.log(`  rule_definitions   ${String(rules.length).padStart(5)} กฎ`);
        console.log(`  rule_versions      ${String(verCount).padStart(5)} ฉบับ`);
        console.log(`  rule scope         ${String(scopeCount).padStart(5)} แถว (สิทธิ/บริการ)`);
        console.log(`  rule_conditions    ${String(condCount).padStart(5)} เงื่อนไข`);
        console.log(`  rule_templates     ${String(templates.length).padStart(5)} แม่แบบ`);
        console.log(`  rule_kpi_snapshots ${String(kpiCount).padStart(5)} แถว`);
        console.log(`\n  กฎ ACTIVE ที่มีตัวตรวจจริง: ${cov.implemented || 0}/${cov.total} ข้อ`);
        if (warn.length) {
            console.warn(`\n⚠ ข้อสังเกต ${warn.length} รายการ:`);
            warn.slice(0, 8).forEach(w => console.warn('   ' + w));
            if (warn.length > 8) console.warn(`   ...และอีก ${warn.length - 8} รายการ`);
        }
        console.log('\n✅ seed-rules เสร็จสิ้น');
    } catch (err) {
        await conn.rollback().catch(() => {});
        console.error('❌ seed-rules ล้มเหลว:', err.message);
        process.exit(1);
    } finally {
        await conn.end();
    }
}

seed();
