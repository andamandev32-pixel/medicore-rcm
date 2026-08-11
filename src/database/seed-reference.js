/**
 * seed-reference.js — โหลดข้อมูลอ้างอิงมาตรฐานจาก data/reference/*.csv
 * รัน: npm run seed:reference   (ต้อง npm run migrate ก่อน — ตารางอยู่ใน reference.sql)
 *
 * ต่างจาก seed-demo: ใช้ upsert (ON DUPLICATE KEY UPDATE) ไม่ล้างตาราง
 * เพราะข้อมูลอ้างอิงเป็นเป้าหมาย FK ของข้อมูลจริงในอนาคต — id ต้องนิ่ง
 * รันซ้ำได้เสมอ: ไฟล์เดิม = แถวเท่าเดิม · ไฟล์ใหม่ = เพิ่ม/แก้เฉพาะที่เปลี่ยน
 *
 * ทุกชุดที่โหลดสำเร็จเขียน audit_log (entity='reference', action='LOAD')
 * ไว้เป็นหลักฐานที่มา — หน้า meta ของ API อ่านไปแสดง
 */
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');
const { parseCsvObjects, toCEDate } = require('./csv');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'reference');

/* แปลงค่าที่พบบ่อยใน CSV */
const S    = v => { const s = String(v == null ? '' : v).trim(); return s === '' ? null : s; };
const N    = v => { const s = S(v); if (s == null) return null; const n = Number(s); return isFinite(n) ? n : null; };
const BOOL = v => (String(v).trim() === '1' ? 1 : 0);

/* provenance 4 คอลัมน์ท้ายที่ทุกไฟล์มีเหมือนกัน */
const prov = r => [S(r.source_doc), S(r.source_ref), toCEDate(r.source_date), BOOL(r.verified)];

/* คีย์เทียบรหัส ICD: ตัวใหญ่ ไร้จุด ('J18.9' → 'J189') — ไฟล์ทางการ/แฟ้มส่งออกมักไร้จุด */
const codeKey = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * นิยามชุดข้อมูล — ลำดับสำคัญ (FK: matrix ต้องมาหลัง funds+files · drg หลัง versions+mdc)
 * แต่ละชุด: ไฟล์ · SQL upsert · ฟังก์ชันแปลงแถว CSV → params (คืน null = ข้ามแถวพร้อมเหตุผล)
 */
const DATASETS = [
    {
        name: 'funds', file: 'funds.csv',
        sql: `INSERT INTO ref_funds (fund_key, label_th, sort_order, source_doc, source_ref, source_date, verified)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE label_th=VALUES(label_th), sort_order=VALUES(sort_order),
                  source_doc=VALUES(source_doc), source_ref=VALUES(source_ref),
                  source_date=VALUES(source_date), verified=VALUES(verified)`,
        map(r, errs) {
            if (!S(r.fund_key) || !S(r.label_th)) { errs.push('fund_key/label_th ว่าง'); return null; }
            return [S(r.fund_key), S(r.label_th), N(r.sort_order) || 0, ...prov(r)];
        },
    },
    {
        name: 'claim_files', file: 'claim-files.csv',
        sql: `INSERT INTO ref_claim_files (file_no, group_key, name_th, name_en, description_th, origin,
                  req_count, cond_count, opt_count, field_count, condition_key, condition_label,
                  mapping_status, source_doc, source_ref, source_date, verified)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE group_key=VALUES(group_key), name_th=VALUES(name_th),
                  name_en=VALUES(name_en), description_th=VALUES(description_th), origin=VALUES(origin),
                  req_count=VALUES(req_count), cond_count=VALUES(cond_count), opt_count=VALUES(opt_count),
                  field_count=VALUES(field_count), condition_key=VALUES(condition_key),
                  condition_label=VALUES(condition_label), mapping_status=VALUES(mapping_status),
                  source_doc=VALUES(source_doc), source_ref=VALUES(source_ref),
                  source_date=VALUES(source_date), verified=VALUES(verified)`,
        map(r, errs) {
            const no = N(r.file_no);
            if (!no || !S(r.name_th)) { errs.push('file_no/name_th ว่าง'); return null; }
            return [no, S(r.group_key), S(r.name_th), S(r.name_en), S(r.description_th), S(r.origin),
                    N(r.req_count) || 0, N(r.cond_count) || 0, N(r.opt_count) || 0, N(r.field_count) || 0,
                    S(r.condition_key), S(r.condition_label), S(r.mapping_status) || 'TODO', ...prov(r)];
        },
    },
    {
        name: 'fund_file_matrix', file: 'fund-file-matrix.csv',
        sql: `INSERT INTO ref_fund_file_matrix (fund_key, file_no, requirement, source_doc, source_ref, source_date, verified)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE requirement=VALUES(requirement), source_doc=VALUES(source_doc),
                  source_ref=VALUES(source_ref), source_date=VALUES(source_date), verified=VALUES(verified)`,
        map(r, errs) {
            const no = N(r.file_no);
            if (!S(r.fund_key) || !no) { errs.push('fund_key/file_no ว่าง'); return null; }
            return [S(r.fund_key), no, S(r.requirement) || 'REQUIRED', ...prov(r)];
        },
    },
    {
        name: 'error_codes', file: 'error-codes.csv',
        sql: `INSERT INTO ref_error_codes (system, code, category, level, file_no, description_th,
                  fix_guidance_th, effective_from, effective_to, source_doc, source_ref, source_date, verified)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE category=VALUES(category), level=VALUES(level), file_no=VALUES(file_no),
                  description_th=VALUES(description_th), fix_guidance_th=VALUES(fix_guidance_th),
                  effective_from=VALUES(effective_from), effective_to=VALUES(effective_to),
                  source_doc=VALUES(source_doc), source_ref=VALUES(source_ref),
                  source_date=VALUES(source_date), verified=VALUES(verified)`,
        map(r, errs) {
            if (!S(r.code) || !S(r.description_th)) { errs.push('code/description_th ว่าง'); return null; }
            return [S(r.system) || 'ECLAIM', S(r.code), S(r.category), S(r.level) || 'ERROR', N(r.file_no),
                    S(r.description_th), S(r.fix_guidance_th),
                    toCEDate(r.effective_from), toCEDate(r.effective_to), ...prov(r)];
        },
    },
    {
        name: 'drg_versions', file: 'drg-versions.csv',
        sql: `INSERT INTO ref_drg_versions (version_code, label, effective_from, effective_to,
                  source_doc, source_ref, source_date, verified)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE label=VALUES(label), effective_from=VALUES(effective_from),
                  effective_to=VALUES(effective_to), source_doc=VALUES(source_doc),
                  source_ref=VALUES(source_ref), source_date=VALUES(source_date), verified=VALUES(verified)`,
        map(r, errs) {
            if (!S(r.version_code) || !S(r.label)) { errs.push('version_code/label ว่าง'); return null; }
            return [S(r.version_code), S(r.label), toCEDate(r.effective_from), toCEDate(r.effective_to), ...prov(r)];
        },
    },
    {
        name: 'mdc', file: 'mdc.csv',
        sql: `INSERT INTO ref_mdc (mdc, label_th) VALUES (?, ?)
              ON DUPLICATE KEY UPDATE label_th=VALUES(label_th)`,
        map(r, errs) {
            if (!S(r.mdc) || !S(r.label_th)) { errs.push('mdc/label_th ว่าง'); return null; }
            return [S(r.mdc), S(r.label_th)];
        },
    },
    {
        name: 'drg', file: 'drg.csv',
        sql: `INSERT INTO ref_drg (version_code, drg_code, mdc, description_th, rw, alos,
                  trim_low, trim_high, pdx_codes, source_doc, source_ref, source_date, verified)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE mdc=VALUES(mdc), description_th=VALUES(description_th),
                  rw=VALUES(rw), alos=VALUES(alos), trim_low=VALUES(trim_low), trim_high=VALUES(trim_high),
                  pdx_codes=VALUES(pdx_codes), source_doc=VALUES(source_doc), source_ref=VALUES(source_ref),
                  source_date=VALUES(source_date), verified=VALUES(verified)`,
        map(r, errs) {
            const rw = N(r.rw);
            if (!S(r.version_code) || !S(r.drg_code)) { errs.push('version_code/drg_code ว่าง'); return null; }
            if (rw == null || rw <= 0) { errs.push(`RW ไม่ใช่ตัวเลขบวก ("${r.rw}")`); return null; }
            return [S(r.version_code), S(r.drg_code), S(r.mdc), S(r.description_th), rw, N(r.alos),
                    N(r.trim_low), N(r.trim_high), S(r.pdx_codes), ...prov(r)];
        },
    },
    {
        name: 'icd10', file: 'icd10-sample.csv',
        sql: `INSERT INTO ref_icd10 (code, code_key, term_en, term_th, sex_limit,
                  source_doc, source_ref, source_date, verified)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE code=VALUES(code), term_en=VALUES(term_en),
                  term_th=VALUES(term_th), sex_limit=VALUES(sex_limit),
                  source_doc=VALUES(source_doc), source_ref=VALUES(source_ref),
                  source_date=VALUES(source_date), verified=VALUES(verified)`,
        map(r, errs) {
            const key = codeKey(r.code);
            if (!key || !S(r.term_en)) { errs.push('code/term_en ว่าง'); return null; }
            const sex = String(r.sex_limit || '').toUpperCase();
            return [S(r.code), key, S(r.term_en), S(r.term_th),
                    (sex === 'M' || sex === 'F') ? sex : null, ...prov(r)];
        },
    },
    {
        name: 'icd9', file: 'icd9-sample.csv',
        sql: `INSERT INTO ref_icd9 (code, code_key, term_en, term_th, operative,
                  source_doc, source_ref, source_date, verified)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE code=VALUES(code), term_en=VALUES(term_en),
                  term_th=VALUES(term_th), operative=VALUES(operative),
                  source_doc=VALUES(source_doc), source_ref=VALUES(source_ref),
                  source_date=VALUES(source_date), verified=VALUES(verified)`,
        map(r, errs) {
            const key = codeKey(r.code);
            if (!key || !S(r.term_en)) { errs.push('code/term_en ว่าง'); return null; }
            return [S(r.code), key, S(r.term_en), S(r.term_th),
                    S(r.operative) == null ? null : BOOL(r.operative), ...prov(r)];
        },
    },
];

async function seed() {
    const conn = await mysql.createConnection({
        host:     process.env.DB_HOST || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 3306,
        user:     process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'medicore_rcm',
    });

    let failed = 0;
    try {
        for (const ds of DATASETS) {
            const filePath = path.join(DATA_DIR, ds.file);
            if (!fs.existsSync(filePath)) {
                console.warn(`  SKIP: ${ds.file} (ไม่พบไฟล์)`);
                continue;
            }
            const { records } = parseCsvObjects(fs.readFileSync(filePath, 'utf8'));
            let ok = 0;
            const skipped = [];

            await conn.beginTransaction();
            try {
                for (let i = 0; i < records.length; i++) {
                    const errs = [];
                    const params = ds.map(records[i], errs);
                    if (!params) { skipped.push(`บรรทัด ${i + 2}: ${errs.join(', ')}`); continue; }
                    await conn.query(ds.sql, params);
                    ok++;
                }
                await conn.query(
                    `INSERT INTO audit_log (entity, entity_id, action, actor_id, actor_role, note)
                     VALUES ('reference', ?, 'LOAD', NULL, NULL, ?)`,
                    [ds.name, `${ds.file} · ${ok} แถว · ข้าม ${skipped.length}`]
                );
                await conn.commit();
            } catch (e) {
                await conn.rollback();
                failed++;
                console.error(`  ❌ ${ds.name}: ${e.message}`);
                continue;
            }

            console.log(`  ${ds.name.padEnd(18)} ${String(ok).padStart(5)} แถว` +
                        (skipped.length ? ` · ข้าม ${skipped.length}` : ''));
            skipped.slice(0, 5).forEach(s => console.warn(`      ⚠ ${s}`));
            if (skipped.length > 5) console.warn(`      ⚠ ...และอีก ${skipped.length - 5} แถว`);
        }

        if (failed) {
            console.error(`\n❌ seed-reference มีชุดที่ล้มเหลว ${failed} ชุด`);
            process.exitCode = 1;
        } else {
            console.log('\n✅ seed-reference เสร็จสิ้น');
        }
    } catch (err) {
        console.error('❌ seed-reference ล้มเหลว:', err.message);
        process.exit(1);
    } finally {
        await conn.end();
    }
}

seed();
