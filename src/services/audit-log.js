// ============================================================
// Audit log + lifecycle helpers — ของกลางของทั้งระบบ
//
// ทำไมรวมไว้ที่เดียว:
//   โปรเจคก่อนหน้ามีตาราง *_log แยกต่อ entity 12 ตัว schema เกือบเหมือนกันหมด
//   แล้วเขียน INSERT สดกระจายทั่ว route — พอต้องเพิ่มฟิลด์ (เช่น actor_role)
//   ต้องไล่แก้ 12 ที่ และมีที่ตกหล่นเสมอ ที่นี่จึงเหลือตาราง audit_log ตัวเดียว
//   + helper ตัวเดียว
//
// ใช้คู่กับ LIFECYCLE MIXIN ใน schema.sql (status/is_deleted/rev)
// ============================================================

/**
 * บันทึก audit
 *
 * @param {object} conn  pool หรือ connection — **ถ้าอยู่ใน transaction ต้องส่ง connection
 *                       ตัวเดียวกับที่แก้ข้อมูล** ไม่งั้น log จะ commit แม้ธุรกรรมหลัก rollback
 * @param {object} o
 * @param {string} o.entity     ชื่อก้อนข้อมูล เช่น 'registry_item'
 * @param {string|number} o.entity_id
 * @param {string} o.action     CREATE / UPDATE / CONFIRM / DELETE / ...
 * @param {object} [o.actor]    req.user — ดึง user_id + active_role เอง
 * @param {object} [o.before]   สภาพก่อนแก้ (null ได้)
 * @param {object} [o.after]    สภาพหลังแก้ (null ได้)
 * @param {string} [o.note]
 */
async function auditLog(conn, { entity, entity_id, action, actor, before, after, note }) {
    if (!entity || entity_id == null || !action) {
        throw new Error('auditLog: ต้องระบุ entity, entity_id และ action');
    }
    await conn.query(
        `INSERT INTO audit_log
            (entity, entity_id, action, actor_id, actor_role, before_json, after_json, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            entity,
            String(entity_id),
            action,
            actor?.user_id ?? null,
            // active_role ตัวเดียว ไม่ใช่ roles[] — ให้ตรงกับสิทธิ์ที่ใช้จริงตอนนั้น
            // (เหตุผลเดียวกับ requireRole ใน src/middleware/auth.js)
            actor?.active_role ?? null,
            before ? JSON.stringify(before) : null,
            after  ? JSON.stringify(after)  : null,
            note ?? null,
        ]
    );
}

/**
 * อ่านประวัติของ entity หนึ่ง ๆ (ใหม่ก่อน) — ใช้กับปุ่ม "ดูประวัติ"
 * JOIN users เพื่อให้ได้ชื่อผู้กระทำ ไม่ใช่แค่ id
 */
async function readAuditLog(conn, entity, entity_id, limit = 100) {
    const [rows] = await conn.query(
        `SELECT a.log_id, a.action, a.actor_id, a.actor_role, a.before_json, a.after_json,
                a.note, a.created_at, u.full_name AS actor_name
         FROM audit_log a
         LEFT JOIN users u ON a.actor_id = u.user_id
         WHERE a.entity = ? AND a.entity_id = ?
         ORDER BY a.log_id DESC
         LIMIT ?`,
        [entity, String(entity_id), Number(limit) || 100]
    );
    return rows;
}

/**
 * optimistic lock — ตรวจว่า client ถือข้อมูลรุ่นล่าสุดอยู่จริงก่อนเขียนทับ
 *
 * ที่ต้องมีเพราะ: 2 คนเปิดหน้าเดียวกัน คนแรกบันทึก คนที่สองบันทึกทับ
 * โดยไม่มีใครรู้ว่าเพิ่งลบงานของคนแรกไป — เงียบและตามไม่ได้
 *
 * ใช้: assertRev(row, req.body.rev) แล้วดัก error ใน catch → 409 STALE_REV
 * เมื่อผ่านแล้ว UPDATE ต้องมี `rev = rev + 1` เสมอ
 */
function assertRev(row, clientRev) {
    if (clientRev === undefined || clientRev === null || clientRev === '') {
        const e = new Error('ต้องส่ง rev มาด้วยเพื่อกันการเขียนทับ');
        e.code = 'STALE_REV';
        throw e;
    }
    if (Number(row.rev) !== Number(clientRev)) {
        const e = new Error('ข้อมูลถูกแก้ไขโดยผู้ใช้อื่นแล้ว กรุณาโหลดใหม่ก่อนบันทึก');
        e.code = 'STALE_REV';
        throw e;
    }
}

/**
 * เงื่อนไข "ยังไม่ถูกลบ" สำหรับต่อใน conditions[] ตาม dynamic-WHERE pattern
 * ใช้: const conditions = [activeOnly('r')];
 *
 * ทุก query ที่อ่านตารางซึ่งมี LIFECYCLE MIXIN ต้องมีเงื่อนไขนี้ —
 * ถ้าลืม ข้อมูลที่ผู้ใช้ลบไปแล้วจะโผล่กลับมา
 */
function activeOnly(alias) {
    return alias ? `${alias}.is_deleted = 0` : 'is_deleted = 0';
}

module.exports = { auditLog, readAuditLog, assertRev, activeOnly };
