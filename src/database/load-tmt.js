/**
 * load-tmt.js — โหลดรหัสยามาตรฐาน TMT (Master TMT release) เข้า ref_tmt_drugs
 *
 * รัน:
 *   npm run seed:tmt                                  ← โหลดไฟล์ตัวอย่าง (5 แถว, verified=0)
 *   node src/database/load-tmt.js --file data/reference/tmt/TMTRF20250701.csv \
 *        --release TMTRF20250701 --date 2025-07-01    ← โหลด release จริง (verified=1)
 *
 * ขั้นตอนได้ไฟล์ CSV จาก release ทางการ: ดู data/reference/README.md
 *
 * แยกจาก seed-reference เพราะไฟล์จริงมีหลักหมื่นแถว — ต้อง batch insert
 * (DB อยู่ remote: ทีละแถวใช้เวลาหลายสิบนาที · batch 500 แถว/คำสั่ง เหลือไม่กี่นาที)
 */
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');
const { parseCsvObjects, toCEDate } = require('./csv');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const BATCH = 500;
const LEVELS = new Set(['SUBS', 'VTM', 'GP', 'GPU', 'TP', 'TPU']);

/* ── อ่าน CLI args แบบ --key value ── */
function parseArgs() {
    const a = {};
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1];
    }
    return a;
}

async function load() {
    const args = parseArgs();
    const isSample = !args.file;
    const file    = args.file || path.join('data', 'reference', 'tmt-sample.csv');
    const release = args.release || (isSample ? 'TMT-SAMPLE' : null);
    const relDate = toCEDate(args.date) || null;

    if (!release) {
        console.error('❌ ต้องระบุ --release (เช่น TMTRF20250701) เมื่อโหลดไฟล์จริง');
        process.exit(1);
    }
    const filePath = path.isAbsolute(file) ? file : path.join(__dirname, '..', '..', file);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ ไม่พบไฟล์: ${filePath}`);
        process.exit(1);
    }

    const { header, records } = parseCsvObjects(fs.readFileSync(filePath, 'utf8'));
    const NEED = ['tmt_id', 'fsn'];
    const missing = NEED.filter(c => !header.includes(c));
    if (missing.length) {
        console.error(`❌ ไฟล์ขาดคอลัมน์ที่ต้องมี: ${missing.join(', ')} · พบ: ${header.join(', ')}`);
        console.error('   ดูรูปแบบหัวคอลัมน์ใน data/reference/tmt-sample.csv');
        process.exit(1);
    }

    // release จริง = ข้อมูลจากไฟล์ทางการโดยตรง → verified 1 · ไฟล์ตัวอย่าง → 0
    const verified  = isSample ? 0 : 1;
    const sourceDoc = isSample ? 'ตัวอย่างโครงไฟล์ — ไม่ใช่รหัส TMT จริง'
                               : `Master TMT release ${release} (สมสท. this.or.th)`;

    const conn = await mysql.createConnection({
        host:     process.env.DB_HOST || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 3306,
        user:     process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'medicore_rcm',
    });

    try {
        console.log(`Loading TMT: ${path.basename(filePath)} → release ${release} (${records.length} แถว)`);

        await conn.query(
            `INSERT INTO ref_tmt_releases (release_version, release_date, source_url, row_count)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE release_date=VALUES(release_date), row_count=VALUES(row_count)`,
            [release, relDate, isSample ? null : 'https://this.or.th/', records.length]
        );

        const S = v => { const s = String(v == null ? '' : v).trim(); return s === '' ? null : s; };
        const rows = [];
        let skipped = 0;
        for (const r of records) {
            const id = S(r.tmt_id), fsn = S(r.fsn);
            if (!id || !fsn) { skipped++; continue; }
            const level = LEVELS.has(String(r.level).toUpperCase()) ? String(r.level).toUpperCase() : 'TPU';
            const price = r.ref_price !== '' && isFinite(Number(r.ref_price)) ? Number(r.ref_price) : null;
            rows.push([id, level, fsn.slice(0, 512), S(r.manufacturer), S(r.strength), S(r.dosage_form),
                       S(r.unit_of_use), price, S(r.price_source), S(r.change_flag),
                       release, sourceDoc, relDate, verified]);
        }

        const sql = `INSERT INTO ref_tmt_drugs (tmt_id, level, fsn, manufacturer, strength, dosage_form,
                         unit_of_use, ref_price, price_source, change_flag, release_version,
                         source_doc, source_date, verified)
                     VALUES ?
                     ON DUPLICATE KEY UPDATE level=VALUES(level), fsn=VALUES(fsn),
                         manufacturer=VALUES(manufacturer), strength=VALUES(strength),
                         dosage_form=VALUES(dosage_form), unit_of_use=VALUES(unit_of_use),
                         ref_price=VALUES(ref_price), price_source=VALUES(price_source),
                         change_flag=VALUES(change_flag), release_version=VALUES(release_version),
                         source_doc=VALUES(source_doc), source_date=VALUES(source_date),
                         verified=VALUES(verified), is_active=1`;

        for (let i = 0; i < rows.length; i += BATCH) {
            await conn.query(sql, [rows.slice(i, i + BATCH)]);
            if (rows.length > BATCH) {
                process.stdout.write(`\r  ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
            }
        }
        if (rows.length > BATCH) process.stdout.write('\n');

        // --deactivate-missing: full snapshot เท่านั้น — ปิดรายการที่หายไปจาก release ล่าสุด
        if (args['deactivate-missing'] !== undefined && !isSample) {
            const [r] = await conn.query(
                `UPDATE ref_tmt_drugs SET is_active = 0 WHERE release_version <> ?`, [release]
            );
            console.log(`  ปิดใช้งานรายการที่ไม่อยู่ใน release นี้: ${r.affectedRows} แถว`);
        }

        await conn.query(
            `INSERT INTO audit_log (entity, entity_id, action, actor_id, actor_role, note)
             VALUES ('reference', 'tmt', 'LOAD', NULL, NULL, ?)`,
            [`${path.basename(filePath)} · release ${release} · ${rows.length} แถว · ข้าม ${skipped}`]
        );

        console.log(`✅ TMT ${release}: ${rows.length} แถว` + (skipped ? ` · ข้าม ${skipped}` : ''));
    } catch (err) {
        console.error('❌ load-tmt ล้มเหลว:', err.message);
        process.exit(1);
    } finally {
        await conn.end();
    }
}

load();
