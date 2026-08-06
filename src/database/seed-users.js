/**
 * seed-users.js — สร้าง roles และ users เริ่มต้น
 * รัน: npm run seed:users
 *
 * รันซ้ำได้ (ON DUPLICATE KEY UPDATE) — รหัสผ่านจะถูก reset กลับเป็นค่าเริ่มต้น
 */
const bcrypt = require('bcryptjs');
const mysql  = require('mysql2/promise');
const path   = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const SALT_ROUNDS = 10;

// role_id คงที่ — seed อื่นและ policy.js อ้างชื่อ role ไม่ใช่ id แต่ตรึงไว้ให้ predictable
const DEFAULT_ROLES = [
    { role_id: 1, role_name: 'ADMIN',      description: 'ผู้ดูแลระบบ' },
    { role_id: 2, role_name: 'DOCTOR',     description: 'แพทย์' },
    { role_id: 3, role_name: 'NURSE',      description: 'พยาบาล' },
    { role_id: 4, role_name: 'PHARMACIST', description: 'เภสัชกร' },
    { role_id: 5, role_name: 'NURSE_AIDE', description: 'ผู้ช่วยพยาบาล' },
];

const DEFAULT_USERS = [
    { username: 'admin',        password: '10210',       full_name: 'ศิริพร ดูแลระบบ',      license_no: null,      roles: ['ADMIN'] },
    { username: 'doctor01',     password: 'doctor1234',  full_name: 'นพ.ธนวัฒน์ พงษ์ไพร',  license_no: 'ว.12345', roles: ['DOCTOR'] },
    { username: 'nurse01',      password: 'nurse1234',   full_name: 'นางสาววิไล ขยันดี',    license_no: 'พ.12345', roles: ['NURSE'] },
    { username: 'pharmacist01', password: 'pharma1234',  full_name: 'ภก.มานะ เชี่ยวชาญ',   license_no: 'ภ.12345', roles: ['PHARMACIST'] },
    // ถือหลาย role — ใช้ทดสอบ /auth/switch-role และพิสูจน์ว่าสลับแล้ว "ลดสิทธิ์" ได้จริง
    { username: 'superuser',    password: 'super1234',   full_name: 'ผู้ใช้ทดสอบหลายบทบาท', license_no: null,     roles: ['ADMIN', 'DOCTOR', 'NURSE', 'PHARMACIST'] },
];

async function seed() {
    const conn = await mysql.createConnection({
        host:     process.env.DB_HOST || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 3306,
        user:     process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'medicore_rcm',
    });

    try {
        console.log('Seeding roles...');
        for (const r of DEFAULT_ROLES) {
            await conn.query(
                `INSERT INTO roles (role_id, role_name, description) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE description = VALUES(description)`,
                [r.role_id, r.role_name, r.description]
            );
        }
        console.log(`  ${DEFAULT_ROLES.length} roles`);

        console.log('Seeding users...');
        for (const u of DEFAULT_USERS) {
            const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
            await conn.query(
                `INSERT INTO users (username, password_hash, full_name, license_no, is_active)
                 VALUES (?, ?, ?, ?, 1)
                 ON DUPLICATE KEY UPDATE
                     password_hash = VALUES(password_hash),
                     full_name     = VALUES(full_name),
                     license_no    = VALUES(license_no),
                     is_active     = 1`,
                [u.username, hash, u.full_name, u.license_no]
            );

            const [[row]] = await conn.query('SELECT user_id FROM users WHERE username = ?', [u.username]);
            // ล้าง role เดิมก่อน เพื่อให้การถอด role ออกจาก DEFAULT_USERS มีผลจริงตอน re-seed
            await conn.query('DELETE FROM user_roles WHERE user_id = ?', [row.user_id]);
            for (const roleName of u.roles) {
                await conn.query(
                    `INSERT IGNORE INTO user_roles (user_id, role_id)
                     SELECT ?, role_id FROM roles WHERE role_name = ?`,
                    [row.user_id, roleName]
                );
            }
            console.log(`  ${u.username.padEnd(14)} ${u.password.padEnd(12)} [${u.roles.join(', ')}]`);
        }

        console.log('\n✅ seed-users เสร็จสิ้น');
    } catch (err) {
        console.error('❌ seed-users ล้มเหลว:', err.message);
        process.exit(1);
    } finally {
        await conn.end();
    }
}

seed();
