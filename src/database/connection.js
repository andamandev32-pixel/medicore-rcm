const mysql = require('mysql2/promise');

// ห้ามใส่ค่า default ของ DB_NAME เป็นชื่อ database ของโปรเจคอื่น —
// server ตัวนี้มักใช้ MySQL host เดียวกับระบบอื่น ถ้าลืมตั้ง env แล้วมี fallback
// แอปจะไปเขียนทับฐานข้อมูลของระบบที่กำลังใช้งานจริงโดยเงียบ ๆ
const DB_NAME = process.env.DB_NAME;
if (!DB_NAME) {
    console.error('[db] ปฏิเสธการเริ่มระบบ: ไม่ได้ตั้ง DB_NAME (คัดลอก .env.example เป็น .env ก่อน)');
    process.exit(1);
}

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
        return true;
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        return false;
    }
}

module.exports = { pool, testConnection };
