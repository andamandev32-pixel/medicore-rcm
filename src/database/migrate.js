/**
 * migrate.js — รัน SQL ตามลำดับใน SQL_FILES
 * รัน: npm run migrate
 *
 * ไม่มีตาราง migration / ไม่มี versioning โดยตั้งใจ — ทุกไฟล์ต้องเขียนแบบ
 * idempotent (CREATE TABLE IF NOT EXISTS / ADD COLUMN แล้วกลืน error) แล้วรันซ้ำได้เสมอ
 * แลกความเรียบง่ายกับวินัยในการเขียน SQL
 *
 * ทนต่อ error ต่อไฟล์: ถ้าไฟล์ใด apply ไม่ผ่าน จะบันทึกเป็น warning แล้วไปต่อ
 * เพื่อให้ migration ที่ถูกต้องยัง apply ได้ครบ — สรุปรายการที่ข้ามท้ายสุด
 */
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// เพิ่มไฟล์ใหม่ต่อท้าย ห้ามแทรกกลาง — ลำดับคือสัญญาว่าอะไรมาก่อนอะไร
const SQL_FILES = [
    'schema.sql',
    'reference.sql',    // ข้อมูลอ้างอิงมาตรฐานการเบิกจ่าย (รหัสติด C / 15 แฟ้ม / TMT / DRG / ICD)
    'ipd.sql',          // ผู้ป่วยใน: admission จริง + การลงรหัส (dx/หัตถการ/ค่าใช้จ่าย)
];

const DB_NAME = process.env.DB_NAME || 'medicore_rcm';

async function migrate() {
    // connect โดยไม่ระบุ database ก่อน — ต้องสร้าง database ให้ได้แม้ยังไม่มี
    // (ของเดิมระบุ database ตอน connect เลย ทำให้รันบน DB เปล่าใหม่ไม่ได้)
    const connection = await mysql.createConnection({
        host:     process.env.DB_HOST || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 3306,
        user:     process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
    });

    const skipped = [];
    try {
        console.log(`Running database migration on "${DB_NAME}"...`);

        await connection.query(
            `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
             CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
        await connection.query(`USE \`${DB_NAME}\``);

        for (const file of SQL_FILES) {
            const filePath = path.join(__dirname, file);
            if (!fs.existsSync(filePath)) {
                console.warn(`  SKIP: ${file} (not found)`);
                continue;
            }
            const sql = fs.readFileSync(filePath, 'utf8');
            console.log(`  Applying: ${file}`);
            try {
                await connection.query(sql);
                console.log(`  Done:     ${file}`);
            } catch (e) {
                skipped.push({ file, message: e.message });
                console.warn(`  ⚠ SKIPPED: ${file} — ${e.message}`);
            }
        }

        if (skipped.length) {
            console.log(`\nMigration finished with ${skipped.length} skipped file(s):`);
            skipped.forEach(s => console.log(`  - ${s.file}: ${s.message}`));
            process.exitCode = 1;   // มีไฟล์ตกหล่น = ยังไม่เรียบร้อย
        } else {
            console.log('Migration completed successfully.');
        }
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

migrate();
