/**
 * seed-demo.js — ข้อมูลสาธิตของโมดูลตัวอย่าง (departments + registry_items)
 * รัน: npm run seed:demo   (ต้องรัน seed-users ก่อน เพราะอ้าง user_id)
 *
 * รันซ้ำได้ — ล้าง registry_items ทิ้งแล้วใส่ใหม่ (ข้อมูลสาธิตล้วน ไม่ใช่ของจริง)
 */
const mysql = require('mysql2/promise');
const path  = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const DEPARTMENTS = ['งานผู้ป่วยนอก', 'งานเภสัชกรรม', 'งานเวชระเบียน'];

// flag ที่ใช้จริงคือ priority + status — ตั้งให้คละเพื่อให้ตัวกรองในหน้าเว็บมีอะไรกรอง
const ITEMS = [
    { name: 'ทบทวนแนวทางคัดกรองผู้ป่วยนอก',   dept: 0, priority: 'ROUTINE', status: 'CONFIRMED', detail: 'ปรับแบบคัดกรองให้สอดคล้องกับแนวทางใหม่' },
    { name: 'ตรวจสอบยาคงคลังใกล้หมดอายุ',      dept: 1, priority: 'URGENT',  status: 'DRAFT',     detail: 'พบ 12 รายการหมดอายุภายใน 60 วัน' },
    { name: 'จัดทำทะเบียนครุภัณฑ์ประจำปี',      dept: 2, priority: 'ROUTINE', status: 'DRAFT',     detail: '' },
    { name: 'อบรมการใช้งานระบบสำหรับเจ้าหน้าที่ใหม่', dept: 0, priority: 'ROUTINE', status: 'CONFIRMED', detail: 'รอบละ 15 คน เดือนละ 1 ครั้ง' },
    { name: 'แก้ไขข้อมูลเวชระเบียนซ้ำซ้อน',      dept: 2, priority: 'URGENT',  status: 'DRAFT',     detail: 'พบเลขที่ซ้ำ 8 ราย' },
    { name: 'ทบทวนบัญชียาโรงพยาบาล',           dept: 1, priority: 'ROUTINE', status: 'CONFIRMED', detail: '' },
    { name: 'ปรับปรุงผังการไหลของผู้รับบริการ',   dept: 0, priority: 'ROUTINE', status: 'DRAFT',     detail: 'ลดเวลารอคอยช่วงเช้า' },
    { name: 'สำรวจความพึงพอใจผู้รับบริการ',      dept: 0, priority: 'ROUTINE', status: 'DRAFT',     detail: '' },
    { name: 'ตรวจสอบการเบิกจ่ายเวชภัณฑ์',        dept: 1, priority: 'URGENT',  status: 'DRAFT',     detail: 'ยอดเบิกเดือนนี้สูงผิดปกติ' },
    { name: 'จัดเก็บเอกสารเข้าคลังประจำไตรมาส',   dept: 2, priority: 'ROUTINE', status: 'CONFIRMED', detail: '' },
    { name: 'ทบทวนสิทธิ์การเข้าถึงข้อมูลผู้ใช้',    dept: 2, priority: 'URGENT',  status: 'DRAFT',     detail: 'มีบัญชีที่ไม่ได้ใช้งานเกิน 90 วัน' },
    { name: 'วางแผนอัตรากำลังไตรมาสหน้า',        dept: 0, priority: 'ROUTINE', status: 'DRAFT',     detail: '' },
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
        console.log('Seeding departments...');
        for (const name of DEPARTMENTS) {
            await conn.query(
                `INSERT INTO departments (department_name, is_active)
                 SELECT ?, 1 FROM DUAL
                 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE department_name = ?)`,
                [name, name]
            );
        }
        const [depts] = await conn.query(
            'SELECT department_id, department_name FROM departments ORDER BY department_id'
        );
        console.log(`  ${depts.length} departments`);

        const [[doctor]] = await conn.query(`SELECT user_id FROM users WHERE username = 'doctor01'`);
        const [[nurse]]  = await conn.query(`SELECT user_id FROM users WHERE username = 'nurse01'`);
        if (!doctor || !nurse) {
            console.error('❌ ไม่พบ user demo — รัน npm run seed:users ก่อน');
            process.exit(1);
        }

        console.log('Seeding registry_items...');
        // ล้างก่อน (ไม่ใช่ soft delete — นี่คือการ reset ข้อมูลสาธิต ไม่ใช่การลบเชิงธุรกิจ)
        await conn.query('DELETE FROM audit_log WHERE entity = ?', ['registry_item']);
        await conn.query('DELETE FROM registry_items');
        await conn.query('ALTER TABLE registry_items AUTO_INCREMENT = 1');

        let n = 0;
        for (const it of ITEMS) {
            n += 1;
            const code = 'RG' + String(n).padStart(3, '0');
            const deptId = depts[it.dept] ? depts[it.dept].department_id : null;
            const confirmed = it.status === 'CONFIRMED';

            const [res] = await conn.query(
                `INSERT INTO registry_items
                     (item_code, item_name, department_id, priority, detail,
                      status, confirmed_by, confirmed_at, created_by, updated_by, rev)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
                [
                    code, it.name, deptId, it.priority, it.detail || null,
                    it.status,
                    confirmed ? doctor.user_id : null,
                    confirmed ? new Date() : null,
                    nurse.user_id, nurse.user_id,
                ]
            );

            // เขียน audit ให้ตรงกับที่ route จะเขียนจริง — หน้า "ดูประวัติ" จะได้ไม่ว่างเปล่า
            await conn.query(
                `INSERT INTO audit_log (entity, entity_id, action, actor_id, actor_role, after_json, note)
                 VALUES ('registry_item', ?, 'CREATE', ?, 'NURSE', ?, 'ข้อมูลสาธิต')`,
                [String(res.insertId), nurse.user_id, JSON.stringify({ item_code: code, item_name: it.name })]
            );
            if (confirmed) {
                await conn.query(
                    `INSERT INTO audit_log (entity, entity_id, action, actor_id, actor_role, note)
                     VALUES ('registry_item', ?, 'CONFIRM', ?, 'DOCTOR', 'ข้อมูลสาธิต')`,
                    [String(res.insertId), doctor.user_id]
                );
            }
        }
        console.log(`  ${ITEMS.length} registry_items`);

        console.log('\n✅ seed-demo เสร็จสิ้น');
    } catch (err) {
        console.error('❌ seed-demo ล้มเหลว:', err.message);
        process.exit(1);
    } finally {
        await conn.end();
    }
}

seed();
