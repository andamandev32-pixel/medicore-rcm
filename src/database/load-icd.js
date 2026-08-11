/**
 * load-icd.js — โหลดแคตตาล็อกรหัส ICD-10 / ICD-9-CM ฉบับเต็มเข้า ref_icd10 / ref_icd9
 *
 * รัน (ไฟล์จริงวางใน data/reference/icd/ — โฟลเดอร์นี้ .gitignore):
 *   node src/database/load-icd.js --system icd10 --file data/reference/icd/icd10tm-2024.csv \
 *        --source "ICD-10-TM 2024 (สนย. สธ.)" --date 2024-01-01
 *   node src/database/load-icd.js --system icd9  --file data/reference/icd/icd9cm.csv \
 *        --source "ICD-9-CM สำหรับจัดกลุ่ม DRG" --date 2024-01-01
 *
 * หัวคอลัมน์ที่ต้องมี: code, term_en (คอลัมน์อื่นดู icd10-sample.csv / icd9-sample.csv)
 * ไฟล์ตัวอย่างในโฟลเดอร์ data/reference โหลดผ่าน npm run seed:reference อยู่แล้ว
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

/* ── อ่าน CLI args แบบ --key value ── */
function parseArgs() {
    const a = {};
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1];
    }
    return a;
}

const S = v => { const s = String(v == null ? '' : v).trim(); return s === '' ? null : s; };
const codeKey = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const SYSTEMS = {
    icd10: {
        table: 'ref_icd10',
        sql: `INSERT INTO ref_icd10 (code, code_key, term_en, term_th, sex_limit,
                  source_doc, source_date, verified)
              VALUES ?
              ON DUPLICATE KEY UPDATE code=VALUES(code), term_en=VALUES(term_en),
                  term_th=VALUES(term_th), sex_limit=VALUES(sex_limit),
                  source_doc=VALUES(source_doc), source_date=VALUES(source_date),
                  verified=VALUES(verified), is_active=1`,
        map(r, sourceDoc, srcDate) {
            const key = codeKey(r.code), term = S(r.term_en);
            if (!key || !term) return null;
            const sex = String(r.sex_limit || '').toUpperCase();
            return [S(r.code), key, term.slice(0, 255), S(r.term_th),
                    (sex === 'M' || sex === 'F') ? sex : null, sourceDoc, srcDate, 1];
        },
    },
    icd9: {
        table: 'ref_icd9',
        sql: `INSERT INTO ref_icd9 (code, code_key, term_en, term_th, operative,
                  source_doc, source_date, verified)
              VALUES ?
              ON DUPLICATE KEY UPDATE code=VALUES(code), term_en=VALUES(term_en),
                  term_th=VALUES(term_th), operative=VALUES(operative),
                  source_doc=VALUES(source_doc), source_date=VALUES(source_date),
                  verified=VALUES(verified), is_active=1`,
        map(r, sourceDoc, srcDate) {
            const key = codeKey(r.code), term = S(r.term_en);
            if (!key || !term) return null;
            const op = S(r.operative);
            return [S(r.code), key, term.slice(0, 255), S(r.term_th),
                    op == null ? null : (op === '1' ? 1 : 0), sourceDoc, srcDate, 1];
        },
    },
};

async function load() {
    const args = parseArgs();
    const sys = SYSTEMS[String(args.system || '').toLowerCase()];
    if (!sys || !args.file) {
        console.error('❌ ต้องระบุ --system icd10|icd9 และ --file <path.csv> (ดูตัวอย่างในคอมเมนต์หัวไฟล์)');
        process.exit(1);
    }
    const filePath = path.isAbsolute(args.file) ? args.file : path.join(__dirname, '..', '..', args.file);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ ไม่พบไฟล์: ${filePath}`);
        process.exit(1);
    }

    const { header, records } = parseCsvObjects(fs.readFileSync(filePath, 'utf8'));
    const missing = ['code', 'term_en'].filter(c => !header.includes(c));
    if (missing.length) {
        console.error(`❌ ไฟล์ขาดคอลัมน์ที่ต้องมี: ${missing.join(', ')} · พบ: ${header.join(', ')}`);
        process.exit(1);
    }

    const sourceDoc = S(args.source) || `แคตตาล็อก ${args.system} — ${path.basename(filePath)}`;
    const srcDate   = toCEDate(args.date);

    const conn = await mysql.createConnection({
        host:     process.env.DB_HOST || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 3306,
        user:     process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'medicore_rcm',
    });

    try {
        console.log(`Loading ${args.system}: ${path.basename(filePath)} (${records.length} แถว)`);
        const rows = [];
        let skipped = 0;
        for (const r of records) {
            const row = sys.map(r, sourceDoc, srcDate);
            if (!row) { skipped++; continue; }
            rows.push(row);
        }

        for (let i = 0; i < rows.length; i += BATCH) {
            await conn.query(sys.sql, [rows.slice(i, i + BATCH)]);
            if (rows.length > BATCH) {
                process.stdout.write(`\r  ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
            }
        }
        if (rows.length > BATCH) process.stdout.write('\n');

        await conn.query(
            `INSERT INTO audit_log (entity, entity_id, action, actor_id, actor_role, note)
             VALUES ('reference', ?, 'LOAD', NULL, NULL, ?)`,
            [args.system, `${path.basename(filePath)} · ${rows.length} แถว · ข้าม ${skipped}`]
        );

        console.log(`✅ ${sys.table}: ${rows.length} แถว` + (skipped ? ` · ข้าม ${skipped}` : ''));
    } catch (err) {
        console.error('❌ load-icd ล้มเหลว:', err.message);
        process.exit(1);
    } finally {
        await conn.end();
    }
}

load();
