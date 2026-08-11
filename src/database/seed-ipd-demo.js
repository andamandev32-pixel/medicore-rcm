/**
 * seed-ipd-demo.js — เติมเคสผู้ป่วยในตัวอย่างลง ipd_admissions + ตารางลูก
 * รัน: npm run seed:ipd   (ต้อง npm run migrate ก่อน)
 *
 * เคสชุดเดียวกับ mock ฝั่ง browser (mock-ipd.js) เพื่อให้หน้าจอมีข้อมูลเดโม
 * ตอนต่อกับ backend จริง — วันที่แปลงจาก พ.ศ. เป็น ค.ศ. ตามธรรมเนียม DB
 *
 * Idempotent แบบ "insert เฉพาะที่ยังไม่มี": ถ้า AN มีอยู่แล้ว ข้ามทั้งเคส
 * (ไม่ทับข้อมูลที่ผู้ใช้แก้ผ่านหน้าจอ — ล้างเองด้วยการลบแถวใน DB ถ้าต้องรีเซ็ต)
 */
const mysql = require('mysql2/promise');
const path  = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const norm = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/* เลขบัตร ปชช. สำหรับเดโม: เติมหลักตรวจสอบ (mod 11) ให้ 12 หลักแรกที่กำหนด */
function demoCid(base12) {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(base12[i]) * (13 - i);
    return base12 + String((11 - (sum % 11)) % 10);
}

const CASES = [
    {
        an: '691201', hn: '00151022', patient_name: 'นางประนอม สุขสวัสดิ์',
        cid: demoCid('310170023070'), birth_date: '1958-03-12', sex: 'F', payer: 'UC',
        ward: 'MED-3', bed: '08', admit_at: '2026-08-01 10:40:00', discharge_at: null,
        leave_days: 0, drg_code: '04530',
        files_sent: [1, 2, 3, 4, 5, 7, 8],
        file_ctx: { emergency: false, prenatal: false, newborn: false, psych: false, disability: false, leaveDay: false },
        pdx: { code: 'J18.9', name: 'Pneumonia, unspecified organism' },
        sdx: [{ code: 'E11.9', name: 'Type 2 diabetes mellitus without complications' }],
        procedures: [],
        charges: [
            { billgrcs: '02', name: 'ค่าห้อง/ค่าอาหาร', amount: 12000, qty: 10 },
            { billgrcs: '03', name: 'ยาและสารอาหารทางเส้นเลือด', amount: 6800 },
            { billgrcs: '06', name: 'ค่าตรวจทางห้องปฏิบัติการ', amount: 4300 },
        ],
    },
    {
        an: '691202', hn: '00148890', patient_name: 'นายเสน่ห์ วงศ์อารีย์',
        cid: demoCid('310170045121'), birth_date: '1947-01-25', sex: 'M', payer: 'OFC',
        ward: 'SUR-4', bed: '15', admit_at: '2026-07-12 07:55:00', discharge_at: null,
        leave_days: 0, drg_code: '08340',
        files_sent: [1, 2, 3, 4, 5, 6, 7, 8],
        file_ctx: { emergency: false, prenatal: false, newborn: false, psych: false, disability: false, leaveDay: false },
        pdx: { code: 'S72.0', name: 'Fracture of neck of femur' },
        sdx: [{ code: 'I10', name: 'Essential (primary) hypertension' },
              { code: 'N18.3', name: 'Chronic kidney disease, stage 3' }],
        procedures: [{ code: '79.35', name: 'Open reduction of fracture with internal fixation, femur', date: '2026-07-13' }],
        charges: [
            { billgrcs: '02', name: 'ค่าห้อง/ค่าอาหาร', amount: 67200, qty: 28 },
            { billgrcs: '03', name: 'ยาและสารอาหารทางเส้นเลือด', amount: 18500 },
            { billgrcs: '09', name: 'ค่าผ่าตัดและหัตถการ', amount: 25600 },
            { billgrcs: '06', name: 'ค่าตรวจทางห้องปฏิบัติการ', amount: 9800 },
        ],
    },
    {
        an: '691203', hn: '00139455', patient_name: 'นายบรรจง เพ็ชรรัตน์',
        cid: demoCid('310170067342'), birth_date: '1965-06-02', sex: 'M', payer: 'SSS',
        ward: 'MED-2', bed: '21', admit_at: '2026-07-26 15:10:00', discharge_at: null,
        leave_days: 2, drg_code: '05450',
        /* จงใจไม่มีแฟ้ม 15 ทั้งที่ leaveDay = true — เคสเดโมกฎแฟ้มเงื่อนไข (RUL-FIL-001) */
        files_sent: [1, 2, 3, 4, 5, 7, 8],
        file_ctx: { emergency: false, prenatal: false, newborn: false, psych: false, disability: false, leaveDay: true },
        pdx: { code: 'I50.0', name: 'Congestive heart failure' },
        sdx: [{ code: 'I10', name: 'Essential (primary) hypertension' }],
        procedures: [],
        charges: [
            { billgrcs: '02', name: 'ค่าห้อง/ค่าอาหาร', amount: 18000, qty: 15 },
            { billgrcs: '03', name: 'ยาและสารอาหารทางเส้นเลือด', amount: 8400 },
            { billgrcs: '06', name: 'ค่าตรวจทางห้องปฏิบัติการ', amount: 5200 },
        ],
    },
    {
        an: '691204', hn: '00152761', patient_name: 'นางสาวกมลชนก อารีรักษ์',
        cid: demoCid('310170089563'), birth_date: '1992-11-19', sex: 'F', payer: 'PVT',
        ward: 'SUR-4', bed: '03', admit_at: '2026-07-29 21:05:00', discharge_at: '2026-08-02 11:00:00',
        discharge_type: '1', discharge_status: '1', leave_days: 0, drg_code: '06450',
        files_sent: [],
        file_ctx: { emergency: false, prenatal: false, newborn: false, psych: false, disability: false, leaveDay: false },
        pdx: { code: 'K35.8', name: 'Acute appendicitis, other and unspecified' },
        sdx: [],
        procedures: [{ code: '47.09', name: 'Other appendectomy', date: '2026-07-30' }],
        charges: [
            { billgrcs: '02', name: 'ค่าห้อง/ค่าอาหาร', amount: 19000, qty: 5 },
            { billgrcs: '03', name: 'ยาและสารอาหารทางเส้นเลือด', amount: 8600 },
            { billgrcs: '09', name: 'ค่าผ่าตัดและหัตถการ', amount: 18400 },
            { billgrcs: '06', name: 'ค่าตรวจทางห้องปฏิบัติการ', amount: 6200 },
        ],
    },
    {
        an: '691205', hn: '00136014', patient_name: 'นายสมพร ทรัพย์เจริญ',
        cid: demoCid('310170101784'), birth_date: '1969-04-15', sex: 'M', payer: 'UC',
        ward: 'MED-2', bed: '11', admit_at: '2026-07-20 08:30:00', discharge_at: '2026-07-27 10:15:00',
        discharge_type: '1', discharge_status: '1', leave_days: 0, drg_code: '06210',
        files_sent: [1, 2, 3, 4, 5, 7, 8, 14],
        file_ctx: { emergency: false, prenatal: false, newborn: false, psych: false, disability: false, leaveDay: false },
        pdx: { code: 'K92.2', name: 'Gastrointestinal haemorrhage, unspecified' },
        sdx: [{ code: 'K29.7', name: 'Gastritis, unspecified' }],
        procedures: [],
        charges: [
            { billgrcs: '02', name: 'ค่าห้อง/ค่าอาหาร', amount: 9600, qty: 8 },
            { billgrcs: '03', name: 'ยาและสารอาหารทางเส้นเลือด', amount: 5400 },
            { billgrcs: '06', name: 'ค่าตรวจทางห้องปฏิบัติการ', amount: 6800 },
        ],
    },
    {
        an: '691206', hn: '00153388', patient_name: 'นายกิตติพงษ์ แซ่ลิ้ม',
        cid: demoCid('310170123905'), birth_date: '1974-09-30', sex: 'M', payer: 'EMS',
        ward: 'ICU-1', bed: '04', admit_at: '2026-08-02 02:15:00', discharge_at: '2026-08-05 16:30:00',
        discharge_type: '1', discharge_status: '1', leave_days: 0, drg_code: '05220',
        files_sent: [1, 2, 3, 4, 5, 6, 7, 8, 14],
        file_ctx: { emergency: true, prenatal: false, newborn: false, psych: false, disability: false, leaveDay: false },
        pdx: { code: 'I21.9', name: 'Acute myocardial infarction, unspecified' },
        sdx: [{ code: 'E11.9', name: 'Type 2 diabetes mellitus without complications' }],
        procedures: [{ code: '00.66', name: 'Percutaneous transluminal coronary angioplasty', date: '2026-08-02' }],
        charges: [
            { billgrcs: '02', name: 'ค่าห้อง ICU/ค่าอาหาร', amount: 26000, qty: 4 },
            { billgrcs: '03', name: 'ยาและสารอาหารทางเส้นเลือด', amount: 21500 },
            { billgrcs: '09', name: 'ค่าหัตถการหัวใจและหลอดเลือด', amount: 62000 },
            { billgrcs: '06', name: 'ค่าตรวจทางห้องปฏิบัติการ', amount: 11800 },
        ],
    },
    {
        an: '691207', hn: '00150907', patient_name: 'นางสาวชนิดา บุญเรือง',
        cid: demoCid('310170146026'), birth_date: '1998-02-14', sex: 'F', payer: 'LGO',
        ward: 'OBG-5', bed: '07', admit_at: '2026-07-30 06:40:00', discharge_at: '2026-08-03 09:20:00',
        discharge_type: '1', discharge_status: '1', leave_days: 0, drg_code: '14012',
        files_sent: [1, 2, 3, 4, 5, 6, 7, 8, 11, 14],
        file_ctx: { emergency: false, prenatal: true, newborn: true, psych: false, disability: false, leaveDay: false },
        pdx: { code: 'O82', name: 'Single delivery by caesarean section' },
        sdx: [],
        procedures: [{ code: '74.1', name: 'Low cervical caesarean section', date: '2026-07-31' }],
        charges: [
            { billgrcs: '02', name: 'ค่าห้อง/ค่าอาหาร', amount: 8000, qty: 5 },
            { billgrcs: '03', name: 'ยาและสารอาหารทางเส้นเลือด', amount: 4200 },
            { billgrcs: '09', name: 'ค่าผ่าตัดคลอด', amount: 14800 },
            { billgrcs: '06', name: 'ค่าตรวจทางห้องปฏิบัติการ', amount: 3600 },
        ],
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

    let inserted = 0, skipped = 0;
    try {
        for (const c of CASES) {
            const [[exists]] = await conn.query(
                `SELECT admission_id FROM ipd_admissions WHERE an = ?`, [c.an]);
            if (exists) { skipped++; continue; }

            await conn.beginTransaction();
            try {
                const [r] = await conn.query(
                    `INSERT INTO ipd_admissions
                         (an, hn, patient_name, cid, birth_date, sex, payer, ward, bed,
                          admit_at, discharge_at, discharge_type, discharge_status, leave_days,
                          drg_code, files_sent, file_ctx, status, rev)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 0)`,
                    [c.an, c.hn, c.patient_name, c.cid, c.birth_date, c.sex, c.payer,
                     c.ward, c.bed, c.admit_at, c.discharge_at || null,
                     c.discharge_type || null, c.discharge_status || null, c.leave_days,
                     c.drg_code, JSON.stringify(c.files_sent), JSON.stringify(c.file_ctx)]);
                const id = r.insertId;

                const dxRows = [[id, 'PDX', 0, c.pdx.code, norm(c.pdx.code), c.pdx.name]];
                c.sdx.forEach((d, i) => dxRows.push([id, 'SDX', i + 1, d.code, norm(d.code), d.name]));
                await conn.query(
                    `INSERT INTO ipd_diagnoses (admission_id, dx_type, seq, code, code_key, name) VALUES ?`,
                    [dxRows]);

                if (c.procedures.length) {
                    await conn.query(
                        `INSERT INTO ipd_procedures (admission_id, seq, code, code_key, name, proc_date) VALUES ?`,
                        [c.procedures.map((p, i) => [id, i, p.code, norm(p.code), p.name, p.date || null])]);
                }
                await conn.query(
                    `INSERT INTO ipd_charges (admission_id, seq, billgrcs, name, amount, qty) VALUES ?`,
                    [c.charges.map((ch, i) => [id, i, ch.billgrcs, ch.name, ch.amount, ch.qty ?? null])]);

                await conn.query(
                    `INSERT INTO audit_log (entity, entity_id, action, actor_id, actor_role, note)
                     VALUES ('ipd_admission', ?, 'CREATE', NULL, NULL, 'seed-ipd-demo')`, [id]);

                await conn.commit();
                inserted++;
            } catch (e) {
                await conn.rollback();
                throw e;
            }
        }
        console.log(`✅ seed-ipd-demo: เพิ่ม ${inserted} เคส · มีอยู่แล้วข้าม ${skipped}`);
    } catch (err) {
        console.error('❌ seed-ipd-demo ล้มเหลว:', err.message);
        process.exit(1);
    } finally {
        await conn.end();
    }
}

seed();
