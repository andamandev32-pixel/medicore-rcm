// ============================================================
// ID Generator — สร้าง business number แบบ prefix + running number
//
// ใช้เมื่อคอลัมน์ไม่ใช่ AUTO_INCREMENT แต่เป็นเลขที่เอกสารที่คนต้องอ่าน
// (เช่น item_code 'RG001', เลขที่ใบงาน 'JOB2026001')
//
// ⚠️ ไม่ atomic — ถ้ามี insert พร้อมกันหนักให้เรียกภายใน transaction
//    ที่ล็อกแถวไว้ หรือใช้ UNIQUE KEY เป็นด่านสุดท้าย (schema.sql ทำแล้ว)
// ============================================================

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * หาเลขลำดับถัดไปของ column ที่ขึ้นต้นด้วย prefix แล้วต่อด้วยตัวเลขล้วน
 * เช่น prefix 'RG' จะ match 'RG001' แต่ไม่ match 'RGX001' (anchored regex)
 * @returns {Promise<string>} เช่น 'RG011'
 */
async function nextId(conn, { table, column, prefix, pad = 3 }) {
    const [rows] = await conn.query(
        `SELECT ${column} AS id FROM ${table} WHERE ${column} LIKE ?`,
        [prefix + '%']
    );
    const re = new RegExp('^' + escapeRe(prefix) + '(\\d+)$');
    let max = 0;
    for (const r of rows) {
        const m = re.exec(r.id);
        if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
    }
    return prefix + String(max + 1).padStart(pad, '0');
}

module.exports = { nextId };
