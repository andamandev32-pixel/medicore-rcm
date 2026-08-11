const express  = require('express');
const router   = express.Router();
const { pool } = require('../database/connection');
const { requireRole } = require('../middleware/auth');
const { nextId } = require('../database/id-gen');
const { auditLog, readAuditLog, assertRev, activeOnly } = require('../services/audit-log');

// ============================================================
// /api/finance — บันทึกส่ง → บันทึกรับ → ตัดยอดลูกหนี้รายบุคคล
//
// โครงตาราง + นิยามยอดคงค้างอยู่ใน src/database/finance.sql (อ่านก่อนแก้ไฟล์นี้)
//
// ยอดคงเหลือ "ไม่เก็บเป็นคอลัมน์" — ทุก endpoint ที่คืนยอดต้องคิดจาก AR_FROM
// ชุดเดียวกันนี้เท่านั้น ไม่งั้นหน้าทะเบียนกับหน้าสรุปจะให้ตัวเลขคนละตัว
//
// รูปแบบ response ตามมาตรฐานโปรเจค (doc/ARCHITECTURE.md §3):
//   GET list → array ดิบ · GET one → object หรือ 404 · POST → 201 { id }
//   PUT/DELETE → { success: true } · error → 500 { error }
// ============================================================

const D = col => `DATE_FORMAT(${col}, '%Y-%m-%d') AS ${col.replace(/^.*\./, '')}`;

const SERVICE_TYPES = ['OPD', 'IPD', 'PP', 'REFER', 'OTHER'];
const ADJUST_KINDS  = ['WRITE_OFF', 'REDUCE', 'INCREASE'];
const AGING_BUCKETS = ['0-30', '31-60', '61-90', '90+'];

const num = v => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

// ── ก้อน SQL กลางของ "ลูกหนี้รายบุคคล" ────────────────────
//
// นับเฉพาะชุดส่งที่ CONFIRMED แล้ว — ชุดที่ยังร่างอยู่ยังไม่ถือเป็นหนี้
// และนับเฉพาะใบรับที่ CONFIRMED แล้ว — ใบร่างยังไม่ตัดยอด

const AR_FROM = `
    FROM ar_items i
    JOIN ar_batches b ON i.batch_id = b.batch_id
    LEFT JOIN (
        SELECT a.ar_item_id,
               SUM(a.paid_amt)     AS paid,
               SUM(a.clawback_amt) AS clawback
        FROM ar_allocations a
        JOIN ar_receipts r ON a.receipt_id = r.receipt_id
        WHERE r.is_deleted = 0 AND r.status = 'CONFIRMED'
        GROUP BY a.ar_item_id
    ) al ON al.ar_item_id = i.ar_item_id
    LEFT JOIN (
        SELECT ar_item_id,
               SUM(CASE WHEN kind = 'INCREASE'  THEN amount ELSE 0 END) AS inc,
               SUM(CASE WHEN kind = 'REDUCE'    THEN amount ELSE 0 END) AS red,
               SUM(CASE WHEN kind = 'WRITE_OFF' THEN amount ELSE 0 END) AS woff
        FROM ar_adjustments WHERE is_deleted = 0
        GROUP BY ar_item_id
    ) aj ON aj.ar_item_id = i.ar_item_id`;

/** ยอดพึงรับหลังปรับปรุง */
const BILLED_ADJ = `(i.billed_amt + COALESCE(aj.inc, 0) - COALESCE(aj.red, 0))`;
/** เงินที่รับจริงสุทธิ (หักเรียกคืนแล้ว) */
const NET_RECV   = `(COALESCE(al.paid, 0) - COALESCE(al.clawback, 0))`;
/** คงค้าง — นิยามเดียวของทั้งระบบ */
const OUTSTAND   = `(${BILLED_ADJ} - ${NET_RECV} - COALESCE(aj.woff, 0))`;

const AR_STATUS = `
    CASE
        WHEN COALESCE(aj.woff, 0) > 0 AND ${OUTSTAND} <= 0 THEN 'WRITTEN_OFF'
        WHEN ${OUTSTAND} <= 0                              THEN 'CLEARED'
        WHEN COALESCE(al.paid, 0) > 0                      THEN 'PARTIAL'
        ELSE 'OPEN'
    END`;

// อายุหนี้นับจากวันที่ส่งเบิก — เคสที่ปิดยอดแล้วไม่มีอายุ (ไม่ต้องตามแล้ว)
const AR_AGING = `
    CASE WHEN ${OUTSTAND} <= 0 THEN NULL
         WHEN DATEDIFF(CURDATE(), b.sent_date) <= 30 THEN '0-30'
         WHEN DATEDIFF(CURDATE(), b.sent_date) <= 60 THEN '31-60'
         WHEN DATEDIFF(CURDATE(), b.sent_date) <= 90 THEN '61-90'
         ELSE '90+'
    END`;

const AR_SELECT = `
    i.ar_item_id, i.batch_id, i.seq, i.case_ref, i.hn, i.an, i.patient_name,
    ${D('i.service_date')}, i.service_type, i.billed_amt, i.admission_id, i.note,
    b.batch_no, b.period_key, b.payer, b.fund_key, b.sent_ref, ${D('b.sent_date')},
    COALESCE(al.paid, 0)     AS paid_amt,
    COALESCE(al.clawback, 0) AS clawback_amt,
    COALESCE(aj.inc, 0)      AS increase_amt,
    COALESCE(aj.red, 0)      AS reduce_amt,
    COALESCE(aj.woff, 0)     AS writeoff_amt,
    ${BILLED_ADJ}            AS billed_adj,
    ${NET_RECV}              AS net_received,
    ${OUTSTAND}              AS outstanding,
    DATEDIFF(CURDATE(), b.sent_date) AS age_days,
    ${AR_STATUS}             AS ar_status,
    ${AR_AGING}              AS aging`;

/** เงื่อนไขพื้นฐาน — ทุก query ของทะเบียนลูกหนี้ต้องมี ห้ามข้าม */
function arBaseConditions() {
    return [activeOnly('b'), `b.status = 'CONFIRMED'`];
}

/** ตัวกรองที่หน้าทะเบียนกับหน้าสรุปใช้ร่วมกัน — คิดที่เดียวจึงกรองเหมือนกันเสมอ */
function arFilters(q) {
    const cond = arBaseConditions();
    const params = [];

    if (q.period && q.period !== 'all') { cond.push('b.period_key = ?'); params.push(String(q.period)); }
    if (q.payer  && q.payer  !== 'all') { cond.push('b.payer = ?');      params.push(String(q.payer)); }
    if (q.fund   && q.fund   !== 'all') { cond.push('b.fund_key = ?');   params.push(String(q.fund)); }
    if (q.service_type && q.service_type !== 'all') {
        cond.push('i.service_type = ?'); params.push(String(q.service_type));
    }
    if (q.hn) { cond.push('i.hn = ?'); params.push(String(q.hn)); }
    if (q.search) {
        cond.push('(i.case_ref LIKE ? OR i.patient_name LIKE ? OR i.hn LIKE ? OR i.an LIKE ?)');
        const like = `%${q.search}%`;
        params.push(like, like, like, like);
    }
    return { cond, params };
}

/** สถานะ/อายุหนี้เป็นค่าที่คำนวณ จึงกรองใน HAVING ไม่ใช่ WHERE */
function arHaving(q) {
    const having = [];
    const params = [];
    if (q.status && q.status !== 'all') { having.push('ar_status = ?'); params.push(String(q.status)); }
    if (q.aging  && q.aging  !== 'all') { having.push('aging = ?');     params.push(String(q.aging)); }
    if (q.only_open === '1' || q.only_open === 'true') having.push('outstanding > 0');
    return { having, params };
}

// ─────────────────────────────────────────────
// GET /api/finance/ar — ทะเบียนลูกหนี้รายบุคคล
//   ?period=&payer=&fund=&service_type=&status=&aging=&hn=&search=&only_open=&limit=&offset=
// ─────────────────────────────────────────────
router.get('/ar', async (req, res) => {
    try {
        const { cond, params }  = arFilters(req.query);
        const { having, params: hp } = arHaving(req.query);

        const limit  = Math.min(parseInt(req.query.limit) || 200, 1000);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);

        const [rows] = await pool.query(
            `SELECT ${AR_SELECT} ${AR_FROM}
             WHERE ${cond.join(' AND ')}
             ${having.length ? 'HAVING ' + having.join(' AND ') : ''}
             ORDER BY outstanding DESC, b.sent_date ASC, i.ar_item_id ASC
             LIMIT ? OFFSET ?`,
            [...params, ...hp, limit, offset]
        );
        res.json(rows);
    } catch (err) {
        console.error('[Finance] GET /ar', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/finance/ar/:id — ลูกหนี้ 1 ราย + ประวัติการรับชำระและการปรับปรุง
// ─────────────────────────────────────────────
router.get('/ar/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT ${AR_SELECT} ${AR_FROM}
             WHERE ${arBaseConditions().join(' AND ')} AND i.ar_item_id = ?`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'ไม่พบลูกหนี้รายนี้' });

        const [payments] = await pool.query(
            `SELECT a.alloc_id, a.subfund, a.paid_amt, a.clawback_amt, a.note,
                    r.receipt_id, r.receipt_no, r.period_key, r.statement_no,
                    r.status AS receipt_status, ${D('r.received_date')}
             FROM ar_allocations a
             JOIN ar_receipts r ON a.receipt_id = r.receipt_id
             WHERE a.ar_item_id = ? AND r.is_deleted = 0
             ORDER BY r.received_date ASC, a.alloc_id ASC`,
            [req.params.id]
        );

        const [adjustments] = await pool.query(
            `SELECT adjust_id, kind, amount, reason, ${D('adjust_date')}, created_at
             FROM ar_adjustments
             WHERE ar_item_id = ? AND is_deleted = 0
             ORDER BY adjust_date ASC, adjust_id ASC`,
            [req.params.id]
        );

        res.json({ ...rows[0], payments, adjustments });
    } catch (err) {
        console.error('[Finance] GET /ar/:id', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/finance/summary — KPI + อายุหนี้ + แยกรายกองทุน
//   ใช้ตัวกรองชุดเดียวกับ /ar ตัวเลขบนการ์ดจึงตรงกับตารางที่อยู่ใต้การ์ดเสมอ
// ─────────────────────────────────────────────
router.get('/summary', async (req, res) => {
    try {
        const { cond, params } = arFilters(req.query);
        const where = `WHERE ${cond.join(' AND ')}`;

        const [[total]] = await pool.query(
            `SELECT COUNT(*)                       AS cases,
                    COALESCE(SUM(${BILLED_ADJ}),0) AS billed,
                    COALESCE(SUM(COALESCE(al.paid,0)),0)     AS paid,
                    COALESCE(SUM(COALESCE(al.clawback,0)),0) AS clawback,
                    COALESCE(SUM(COALESCE(aj.woff,0)),0)     AS writeoff,
                    COALESCE(SUM(${NET_RECV}),0)   AS net_received,
                    COALESCE(SUM(${OUTSTAND}),0)   AS outstanding,
                    COALESCE(SUM(CASE WHEN ${OUTSTAND} > 0 THEN 1 ELSE 0 END),0) AS open_cases
             ${AR_FROM} ${where}`,
            params
        );

        const [aging] = await pool.query(
            `SELECT ${AR_AGING} AS bucket, COUNT(*) AS cases, SUM(${OUTSTAND}) AS amount
             ${AR_FROM} ${where}
             GROUP BY bucket HAVING bucket IS NOT NULL`,
            params
        );

        const [byFund] = await pool.query(
            `SELECT b.fund_key, b.payer, COUNT(*) AS cases,
                    SUM(${BILLED_ADJ}) AS billed,
                    SUM(${NET_RECV})   AS net_received,
                    SUM(${OUTSTAND})   AS outstanding
             ${AR_FROM} ${where}
             GROUP BY b.fund_key, b.payer
             ORDER BY outstanding DESC`,
            params
        );

        const [byStatus] = await pool.query(
            `SELECT ${AR_STATUS} AS ar_status, COUNT(*) AS cases, SUM(${OUTSTAND}) AS amount
             ${AR_FROM} ${where} GROUP BY ar_status`,
            params
        );

        // เติมถังอายุหนี้ที่ไม่มีข้อมูลให้ครบ — หน้าจอจะได้ไม่ต้องเดาว่าถังไหนหาย
        const agingMap = Object.fromEntries(aging.map(a => [a.bucket, a]));
        res.json({
            total,
            aging: AGING_BUCKETS.map(k => ({
                bucket: k,
                cases:  Number(agingMap[k]?.cases  || 0),
                amount: Number(agingMap[k]?.amount || 0),
            })),
            by_fund: byFund,
            by_status: byStatus,
        });
    } catch (err) {
        console.error('[Finance] GET /summary', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/finance/periods — งวดที่มีข้อมูลจริง (ให้หน้าจอสร้าง dropdown)
// ─────────────────────────────────────────────
router.get('/periods', async (req, res) => {
    try {
        const [rows] = await pool.query(
            // ⚠️ ห้ามใช้ D() ในนี้ — D() ต่อ "AS <ชื่อ>" มาด้วย ครอบใน MIN() แล้วจะได้
            //    MIN(DATE_FORMAT(...) AS sent_date) ซึ่งเป็น syntax error
            `SELECT period_key, payer, COUNT(*) AS batches,
                    DATE_FORMAT(MIN(sent_date), '%Y-%m-%d') AS first_sent
             FROM ar_batches
             WHERE is_deleted = 0 AND status = 'CONFIRMED'
             GROUP BY period_key, payer
             ORDER BY period_key DESC, payer ASC`
        );
        res.json(rows);
    } catch (err) {
        console.error('[Finance] GET /periods', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/finance/candidates?payer=&search=&limit=
//   เคสที่ "ตั้งเป็นลูกหนี้ได้" — ยังไม่เคยถูกตั้งหนี้ในชุดส่งไหนเลย
//
// แหล่งเดียวที่มีเคสจริงในฐานข้อมูลตอนนี้คือ ipd_admissions (ผู้ป่วยนอกยังไม่มีตาราง)
// จึงตั้งหนี้จากผู้ป่วยในได้ก่อน — ยอดพึงรับ = ผลรวม ipd_charges ของเคสนั้น
// ไม่ใช่ตัวเลขที่คนพิมพ์เอง ยอดตั้งหนี้จึงตรงกับค่ารักษาที่บันทึกไว้เสมอ
//
// NOT EXISTS กันตั้งหนี้ซ้ำ — เคสเดียวถูกตั้งเป็นลูกหนี้สองรอบแปลว่ายอดพึงรับ
// ของโรงพยาบาลบวมเป็นสองเท่าเงียบ ๆ
// ─────────────────────────────────────────────
router.get('/candidates', async (req, res) => {
    try {
        const cond = ['a.is_deleted = 0', 'COALESCE(ch.total, 0) > 0'];
        const params = [];

        if (req.query.payer && req.query.payer !== 'all') {
            cond.push('a.payer = ?'); params.push(String(req.query.payer));
        }
        if (req.query.search) {
            cond.push('(a.an LIKE ? OR a.hn LIKE ? OR a.patient_name LIKE ?)');
            const like = `%${req.query.search}%`;
            params.push(like, like, like);
        }

        const limit = Math.min(parseInt(req.query.limit) || 200, 500);
        const [rows] = await pool.query(
            `SELECT a.admission_id, a.an, a.hn, a.patient_name, a.payer, a.drg_code,
                    a.status AS coding_status,
                    DATE_FORMAT(COALESCE(a.discharge_at, a.admit_at), '%Y-%m-%d') AS service_date,
                    COALESCE(ch.total, 0) AS billed_amt
             FROM ipd_admissions a
             LEFT JOIN (SELECT admission_id, SUM(amount) AS total
                        FROM ipd_charges GROUP BY admission_id) ch
                    ON ch.admission_id = a.admission_id
             WHERE ${cond.join(' AND ')}
               AND NOT EXISTS (
                   SELECT 1 FROM ar_items i
                   JOIN ar_batches b ON i.batch_id = b.batch_id
                   WHERE i.admission_id = a.admission_id AND b.is_deleted = 0)
             ORDER BY service_date ASC, a.admission_id ASC
             LIMIT ?`,
            [...params, limit]
        );
        res.json(rows);
    } catch (err) {
        console.error('[Finance] GET /candidates', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// บันทึกส่ง (ar_batches)
// ============================================================

const BATCH_SELECT = `
    b.batch_id, b.batch_no, b.period_key, b.payer, b.fund_key, ${D('b.sent_date')},
    b.sent_ref, b.channel, b.note, b.status, b.rev,
    b.confirmed_by, b.confirmed_at, b.created_by, b.created_at, b.updated_at,
    uc.full_name AS created_by_name,
    uf.full_name AS confirmed_by_name,
    (SELECT COUNT(*)                FROM ar_items x WHERE x.batch_id = b.batch_id) AS item_count,
    (SELECT COALESCE(SUM(x.billed_amt),0) FROM ar_items x WHERE x.batch_id = b.batch_id) AS billed_total`;

const BATCH_FROM = `
    FROM ar_batches b
    LEFT JOIN users uc ON b.created_by   = uc.user_id
    LEFT JOIN users uf ON b.confirmed_by = uf.user_id`;

// ─────────────────────────────────────────────
// GET /api/finance/batches?period=&payer=&fund=&status=&search=&limit=
// ─────────────────────────────────────────────
router.get('/batches', async (req, res) => {
    try {
        const { period, payer, fund, status, search } = req.query;
        const cond = [activeOnly('b')];
        const params = [];

        if (period && period !== 'all') { cond.push('b.period_key = ?'); params.push(period); }
        if (payer  && payer  !== 'all') { cond.push('b.payer = ?');      params.push(payer); }
        if (fund   && fund   !== 'all') { cond.push('b.fund_key = ?');   params.push(fund); }
        if (status && status !== 'all') { cond.push('b.status = ?');     params.push(status); }
        if (search) {
            cond.push('(b.batch_no LIKE ? OR b.sent_ref LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        const limit = Math.min(parseInt(req.query.limit) || 200, 500);
        const [rows] = await pool.query(
            `SELECT ${BATCH_SELECT} ${BATCH_FROM}
             WHERE ${cond.join(' AND ')}
             ORDER BY b.sent_date DESC, b.batch_id DESC
             LIMIT ?`,
            [...params, limit]
        );
        res.json(rows);
    } catch (err) {
        console.error('[Finance] GET /batches', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/finance/batches/:id — หัวชุด + รายเคสในชุด
// ─────────────────────────────────────────────
router.get('/batches/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT ${BATCH_SELECT} ${BATCH_FROM} WHERE b.batch_id = ? AND ${activeOnly('b')}`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'ไม่พบชุดบันทึกส่งนี้' });

        const [items] = await pool.query(
            `SELECT ar_item_id, seq, case_ref, hn, an, patient_name, cid,
                    ${D('service_date')}, service_type, billed_amt, admission_id, note
             FROM ar_items WHERE batch_id = ? ORDER BY seq ASC, ar_item_id ASC`,
            [req.params.id]
        );
        res.json({ ...rows[0], items });
    } catch (err) {
        console.error('[Finance] GET /batches/:id', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/finance/batches/:id/history
// ─────────────────────────────────────────────
router.get('/batches/:id/history', async (req, res) => {
    try {
        res.json(await readAuditLog(pool, 'ar_batch', req.params.id));
    } catch (err) {
        console.error('[Finance] GET /batches/:id/history', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// POST /api/finance/batches
// body: { period_key, payer, fund_key, sent_date, sent_ref?, channel?, note?, items? }
// ─────────────────────────────────────────────
router.post('/batches', requireRole('FINANCE', 'ADMIN'), async (req, res) => {
    const { period_key, payer, fund_key, sent_date, sent_ref, channel, note, items } = req.body;

    if (!/^\d{4}$/.test(String(period_key || ''))) {
        return res.status(400).json({ error: 'period_key ต้องเป็นงวด 4 หลักแบบ YYMM พ.ศ. เช่น 6907' });
    }
    if (!payer || !fund_key || !sent_date) {
        return res.status(400).json({ error: 'ต้องระบุ payer, fund_key และ sent_date' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const batch_no = await nextId(conn, {
            table: 'ar_batches', column: 'batch_no', prefix: 'SB', pad: 4,
        });

        const [r] = await conn.query(
            `INSERT INTO ar_batches
                 (batch_no, period_key, payer, fund_key, sent_date, sent_ref, channel, note,
                  status, created_by, updated_by, rev)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, 0)`,
            [batch_no, String(period_key), payer, fund_key, sent_date,
             sent_ref || null, channel || null, note || null,
             req.user.user_id, req.user.user_id]
        );

        if (Array.isArray(items) && items.length) {
            await replaceItems(conn, r.insertId, items);
        }

        await auditLog(conn, {
            entity: 'ar_batch', entity_id: r.insertId, action: 'CREATE', actor: req.user,
            after: { batch_no, period_key, payer, fund_key, sent_date, items: items?.length || 0 },
        });

        await conn.commit();
        res.status(201).json({ batch_id: r.insertId, batch_no });
    } catch (err) {
        await conn.rollback();
        console.error('[Finance] POST /batches', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

/**
 * เขียนรายเคสทั้งชุดใหม่ (replace-set) — เรียกได้เฉพาะตอนชุดยัง DRAFT
 * ล้างก่อนแล้วใส่ใหม่ทั้งชุด เพราะการ diff ทีละแถวคือที่มาของแถวกำพร้า
 */
async function replaceItems(conn, batchId, items) {
    await conn.query('DELETE FROM ar_items WHERE batch_id = ?', [batchId]);

    let seq = 0;
    for (const it of items) {
        const case_ref = String(it.case_ref || '').trim();
        if (!case_ref) throw new Error('ทุกบรรทัดต้องมี case_ref');

        const amt = num(it.billed_amt);
        if (amt <= 0) throw new Error(`ยอดพึงรับของ ${case_ref} ต้องมากกว่า 0`);

        const type = SERVICE_TYPES.includes(it.service_type) ? it.service_type : 'OTHER';

        await conn.query(
            `INSERT INTO ar_items
                 (batch_id, seq, case_ref, hn, an, patient_name, cid,
                  service_date, service_type, billed_amt, admission_id, note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [batchId, seq++, case_ref, it.hn || null, it.an || null,
             it.patient_name || null, it.cid || null, it.service_date || null,
             type, amt, it.admission_id || null, it.note || null]
        );
    }
}

/** อ่านหัวเอกสารพร้อมล็อกแถว + ตรวจว่ายังแก้ได้ — ใช้ร่วมกันทั้ง batch และ receipt */
async function lockDraft(conn, table, idCol, id, label) {
    const [[row]] = await conn.query(
        `SELECT * FROM ${table} WHERE ${idCol} = ? AND is_deleted = 0 FOR UPDATE`, [id]
    );
    if (!row) { const e = new Error(`ไม่พบ${label}นี้`); e.http = 404; throw e; }
    if (row.status === 'CONFIRMED') {
        const e = new Error(`${label}ที่ยืนยันแล้วแก้ไขไม่ได้ — ยอดถูกนำไปคิดคงค้างแล้ว`);
        e.http = 409; e.code = 'ALREADY_CONFIRMED'; throw e;
    }
    return row;
}

/** ส่ง error ที่ helper โยนมาให้ตรงรหัส — กันไม่ให้ 404/409 กลายเป็น 500 */
function sendErr(res, err, where) {
    if (err.http) return res.status(err.http).json({ error: err.message, code: err.code });
    if (err.code === 'STALE_REV') return res.status(409).json({ error: err.message, code: 'STALE_REV' });
    console.error(`[Finance] ${where}`, err);
    return res.status(500).json({ error: err.message });
}

// ─────────────────────────────────────────────
// PUT /api/finance/batches/:id   body: { rev, sent_date?, sent_ref?, channel?, note? }
// ─────────────────────────────────────────────
router.put('/batches/:id', requireRole('FINANCE', 'ADMIN'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const before = await lockDraft(conn, 'ar_batches', 'batch_id', req.params.id, 'ชุดบันทึกส่ง');
        assertRev(before, req.body.rev);

        const pick = (k, fallback) => (req.body[k] !== undefined ? (req.body[k] || null) : fallback);
        const sent_date = req.body.sent_date || before.sent_date;
        const sent_ref  = pick('sent_ref', before.sent_ref);
        const channel   = pick('channel',  before.channel);
        const note      = pick('note',     before.note);

        await conn.query(
            `UPDATE ar_batches SET sent_date = ?, sent_ref = ?, channel = ?, note = ?,
                    updated_by = ?, rev = rev + 1
             WHERE batch_id = ?`,
            [sent_date, sent_ref, channel, note, req.user.user_id, req.params.id]
        );
        await auditLog(conn, {
            entity: 'ar_batch', entity_id: req.params.id, action: 'UPDATE', actor: req.user,
            before: { sent_date: before.sent_date, sent_ref: before.sent_ref, note: before.note },
            after:  { sent_date, sent_ref, note },
        });

        await conn.commit();
        res.json({ success: true, rev: Number(before.rev) + 1 });
    } catch (err) {
        await conn.rollback();
        sendErr(res, err, 'PUT /batches/:id');
    } finally {
        conn.release();
    }
});

// ─────────────────────────────────────────────
// PUT /api/finance/batches/:id/items — แทนรายเคสทั้งชุด
// body: { rev, items: [{ case_ref, hn?, an?, patient_name?, service_date?, service_type?, billed_amt }] }
// ─────────────────────────────────────────────
router.put('/batches/:id/items', requireRole('FINANCE', 'ADMIN'), async (req, res) => {
    if (!Array.isArray(req.body.items)) {
        return res.status(400).json({ error: 'ต้องส่ง items เป็น array' });
    }
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const before = await lockDraft(conn, 'ar_batches', 'batch_id', req.params.id, 'ชุดบันทึกส่ง');
        assertRev(before, req.body.rev);

        const [[prev]] = await conn.query(
            'SELECT COUNT(*) AS n, COALESCE(SUM(billed_amt),0) AS amt FROM ar_items WHERE batch_id = ?',
            [req.params.id]
        );

        await replaceItems(conn, req.params.id, req.body.items);
        await conn.query('UPDATE ar_batches SET updated_by = ?, rev = rev + 1 WHERE batch_id = ?',
            [req.user.user_id, req.params.id]);

        const total = req.body.items.reduce((a, x) => a + num(x.billed_amt), 0);
        await auditLog(conn, {
            entity: 'ar_batch', entity_id: req.params.id, action: 'UPDATE_ITEMS', actor: req.user,
            before: { items: Number(prev.n), billed_total: Number(prev.amt) },
            after:  { items: req.body.items.length, billed_total: total },
        });

        await conn.commit();
        res.json({ success: true, rev: Number(before.rev) + 1, items: req.body.items.length, billed_total: total });
    } catch (err) {
        await conn.rollback();
        sendErr(res, err, 'PUT /batches/:id/items');
    } finally {
        conn.release();
    }
});

// ─────────────────────────────────────────────
// PUT /api/finance/batches/:id/confirm — ยืนยัน = ตั้งเป็นยอดพึงรับจริง
//
// ยืนยันแล้วรายเคสจะเข้าทะเบียนลูกหนี้ทันทีและเริ่มนับอายุหนี้
// จึงจำกัดที่ ADMIN เหมือนการยืนยันเอกสารที่มีผลผูกพัน (ดู policy.js)
// ─────────────────────────────────────────────
router.put('/batches/:id/confirm', requireRole('FINANCE', 'ADMIN'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const before = await lockDraft(conn, 'ar_batches', 'batch_id', req.params.id, 'ชุดบันทึกส่ง');

        const [[agg]] = await conn.query(
            'SELECT COUNT(*) AS n, COALESCE(SUM(billed_amt),0) AS amt FROM ar_items WHERE batch_id = ?',
            [req.params.id]
        );
        if (!Number(agg.n)) {
            await conn.rollback();
            return res.status(400).json({ error: 'ชุดที่ไม่มีรายเคสเลย ยืนยันไม่ได้' });
        }

        await conn.query(
            `UPDATE ar_batches SET status = 'CONFIRMED', confirmed_by = ?, confirmed_at = NOW(),
                    updated_by = ?, rev = rev + 1
             WHERE batch_id = ?`,
            [req.user.user_id, req.user.user_id, req.params.id]
        );
        await auditLog(conn, {
            entity: 'ar_batch', entity_id: req.params.id, action: 'CONFIRM', actor: req.user,
            before: { status: before.status },
            after:  { status: 'CONFIRMED', items: Number(agg.n), billed_total: Number(agg.amt) },
            note: req.body?.note || null,
        });

        await conn.commit();
        res.json({ success: true, items: Number(agg.n), billed_total: Number(agg.amt) });
    } catch (err) {
        await conn.rollback();
        sendErr(res, err, 'PUT /batches/:id/confirm');
    } finally {
        conn.release();
    }
});

// ─────────────────────────────────────────────
// DELETE /api/finance/batches/:id — soft delete (ยืนยันแล้วลบไม่ได้)
// ─────────────────────────────────────────────
router.delete('/batches/:id', requireRole('FINANCE', 'ADMIN'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const before = await lockDraft(conn, 'ar_batches', 'batch_id', req.params.id, 'ชุดบันทึกส่ง');

        await conn.query(
            `UPDATE ar_batches SET is_deleted = 1, deleted_by = ?, deleted_at = NOW(), rev = rev + 1
             WHERE batch_id = ?`,
            [req.user.user_id, req.params.id]
        );
        await auditLog(conn, {
            entity: 'ar_batch', entity_id: req.params.id, action: 'DELETE', actor: req.user,
            before: { batch_no: before.batch_no, period_key: before.period_key },
            note: req.body?.reason || null,
        });

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        sendErr(res, err, 'DELETE /batches/:id');
    } finally {
        conn.release();
    }
});

// ============================================================
// บันทึกรับ (ar_receipts) + การตัดยอด (ar_allocations)
// ============================================================

const RECEIPT_SELECT = `
    r.receipt_id, r.receipt_no, ${D('r.received_date')}, r.period_key, r.payer,
    r.statement_no, r.channel, r.bank_ref, r.gross_amt, r.fee_amt, r.net_amt,
    r.note, r.status, r.rev,
    r.confirmed_by, r.confirmed_at, r.created_by, r.created_at, r.updated_at,
    uc.full_name AS created_by_name,
    uf.full_name AS confirmed_by_name,
    (SELECT COUNT(*) FROM ar_allocations x WHERE x.receipt_id = r.receipt_id) AS alloc_count,
    (SELECT COALESCE(SUM(x.paid_amt - x.clawback_amt),0)
       FROM ar_allocations x WHERE x.receipt_id = r.receipt_id) AS allocated_amt`;

const RECEIPT_FROM = `
    FROM ar_receipts r
    LEFT JOIN users uc ON r.created_by   = uc.user_id
    LEFT JOIN users uf ON r.confirmed_by = uf.user_id`;

// ─────────────────────────────────────────────
// GET /api/finance/receipts?period=&payer=&status=&search=&limit=
// ─────────────────────────────────────────────
router.get('/receipts', async (req, res) => {
    try {
        const { period, payer, status, search } = req.query;
        const cond = [activeOnly('r')];
        const params = [];

        if (period && period !== 'all') { cond.push('r.period_key = ?'); params.push(period); }
        if (payer  && payer  !== 'all') { cond.push('r.payer = ?');      params.push(payer); }
        if (status && status !== 'all') { cond.push('r.status = ?');     params.push(status); }
        if (search) {
            cond.push('(r.receipt_no LIKE ? OR r.statement_no LIKE ? OR r.bank_ref LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const limit = Math.min(parseInt(req.query.limit) || 200, 500);
        const [rows] = await pool.query(
            `SELECT ${RECEIPT_SELECT} ${RECEIPT_FROM}
             WHERE ${cond.join(' AND ')}
             ORDER BY r.received_date DESC, r.receipt_id DESC
             LIMIT ?`,
            [...params, limit]
        );
        res.json(rows);
    } catch (err) {
        console.error('[Finance] GET /receipts', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/finance/receipts/:id — หัวใบรับ + บรรทัดที่ตัดยอดไปแล้ว
// ─────────────────────────────────────────────
router.get('/receipts/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT ${RECEIPT_SELECT} ${RECEIPT_FROM} WHERE r.receipt_id = ? AND ${activeOnly('r')}`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'ไม่พบใบบันทึกรับนี้' });

        const [allocations] = await pool.query(
            `SELECT a.alloc_id, a.ar_item_id, a.seq, a.subfund, a.paid_amt, a.clawback_amt, a.note,
                    i.case_ref, i.hn, i.patient_name, i.billed_amt, i.service_type,
                    b.batch_no, b.period_key AS billed_period, b.fund_key
             FROM ar_allocations a
             JOIN ar_items   i ON a.ar_item_id = i.ar_item_id
             JOIN ar_batches b ON i.batch_id   = b.batch_id
             WHERE a.receipt_id = ? ORDER BY a.seq ASC, a.alloc_id ASC`,
            [req.params.id]
        );
        res.json({ ...rows[0], allocations });
    } catch (err) {
        console.error('[Finance] GET /receipts/:id', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/finance/receipts/:id/history
// ─────────────────────────────────────────────
router.get('/receipts/:id/history', async (req, res) => {
    try {
        res.json(await readAuditLog(pool, 'ar_receipt', req.params.id));
    } catch (err) {
        console.error('[Finance] GET /receipts/:id/history', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// POST /api/finance/receipts
// body: { received_date, period_key, payer, statement_no?, channel?, bank_ref?,
//         gross_amt?, fee_amt?, net_amt?, note? }
// ─────────────────────────────────────────────
router.post('/receipts', requireRole('FINANCE', 'ADMIN'), async (req, res) => {
    const { received_date, period_key, payer } = req.body;
    if (!/^\d{4}$/.test(String(period_key || ''))) {
        return res.status(400).json({ error: 'period_key ต้องเป็นงวด 4 หลักแบบ YYMM พ.ศ. เช่น 6907' });
    }
    if (!received_date || !payer) {
        return res.status(400).json({ error: 'ต้องระบุ received_date และ payer' });
    }

    const gross = num(req.body.gross_amt);
    const fee   = num(req.body.fee_amt);
    // ไม่ส่ง net มา = คิดให้จาก gross − fee (ผู้ใช้ส่วนใหญ่กรอกแค่สองช่องแรก)
    const net   = req.body.net_amt !== undefined ? num(req.body.net_amt) : gross - fee;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const receipt_no = await nextId(conn, {
            table: 'ar_receipts', column: 'receipt_no', prefix: 'RC', pad: 4,
        });

        const [r] = await conn.query(
            `INSERT INTO ar_receipts
                 (receipt_no, received_date, period_key, payer, statement_no, channel, bank_ref,
                  gross_amt, fee_amt, net_amt, note, status, created_by, updated_by, rev)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, 0)`,
            [receipt_no, received_date, String(period_key), payer,
             req.body.statement_no || null, req.body.channel || null, req.body.bank_ref || null,
             gross, fee, net, req.body.note || null,
             req.user.user_id, req.user.user_id]
        );

        await auditLog(conn, {
            entity: 'ar_receipt', entity_id: r.insertId, action: 'CREATE', actor: req.user,
            after: { receipt_no, received_date, period_key, payer, gross_amt: gross, net_amt: net },
        });

        await conn.commit();
        res.status(201).json({ receipt_id: r.insertId, receipt_no });
    } catch (err) {
        await conn.rollback();
        console.error('[Finance] POST /receipts', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ─────────────────────────────────────────────
// PUT /api/finance/receipts/:id
// body: { rev, received_date?, statement_no?, channel?, bank_ref?, gross_amt?, fee_amt?, net_amt?, note? }
// ─────────────────────────────────────────────
router.put('/receipts/:id', requireRole('FINANCE', 'ADMIN'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const before = await lockDraft(conn, 'ar_receipts', 'receipt_id', req.params.id, 'ใบบันทึกรับ');
        assertRev(before, req.body.rev);

        const pick = (k, fallback) => (req.body[k] !== undefined ? (req.body[k] || null) : fallback);
        const received_date = req.body.received_date || before.received_date;
        const statement_no  = pick('statement_no', before.statement_no);
        const channel       = pick('channel',      before.channel);
        const bank_ref      = pick('bank_ref',     before.bank_ref);
        const note          = pick('note',         before.note);
        const gross = req.body.gross_amt !== undefined ? num(req.body.gross_amt) : Number(before.gross_amt);
        const fee   = req.body.fee_amt   !== undefined ? num(req.body.fee_amt)   : Number(before.fee_amt);
        const net   = req.body.net_amt   !== undefined ? num(req.body.net_amt)   : gross - fee;

        await conn.query(
            `UPDATE ar_receipts
             SET received_date = ?, statement_no = ?, channel = ?, bank_ref = ?,
                 gross_amt = ?, fee_amt = ?, net_amt = ?, note = ?,
                 updated_by = ?, rev = rev + 1
             WHERE receipt_id = ?`,
            [received_date, statement_no, channel, bank_ref, gross, fee, net, note,
             req.user.user_id, req.params.id]
        );
        await auditLog(conn, {
            entity: 'ar_receipt', entity_id: req.params.id, action: 'UPDATE', actor: req.user,
            before: { gross_amt: Number(before.gross_amt), net_amt: Number(before.net_amt) },
            after:  { gross_amt: gross, net_amt: net },
        });

        await conn.commit();
        res.json({ success: true, rev: Number(before.rev) + 1 });
    } catch (err) {
        await conn.rollback();
        sendErr(res, err, 'PUT /receipts/:id');
    } finally {
        conn.release();
    }
});

// ─────────────────────────────────────────────
// PUT /api/finance/receipts/:id/allocations — ตัดยอดลงรายเคส (แทนทั้งชุด)
// body: { rev, allocations: [{ ar_item_id, subfund?, paid_amt, clawback_amt?, note? }] }
//
// ตั้งใจ "ไม่" ห้ามตัดเกินยอดพึงรับ — ของจริงมีจ่ายเพิ่ม (extra) ตาม
// NHSO_STATEMENT_COLUMNS · ยอดที่เกินจะโผล่เป็นคงค้างติดลบให้เห็นเอง
// สิ่งที่ห้ามคือยอดติดลบและเคสซ้ำกองทุนเดิมในใบเดียว
// ─────────────────────────────────────────────
router.put('/receipts/:id/allocations', requireRole('FINANCE', 'ADMIN'), async (req, res) => {
    const list = req.body.allocations;
    if (!Array.isArray(list)) return res.status(400).json({ error: 'ต้องส่ง allocations เป็น array' });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const before = await lockDraft(conn, 'ar_receipts', 'receipt_id', req.params.id, 'ใบบันทึกรับ');
        assertRev(before, req.body.rev);

        await conn.query('DELETE FROM ar_allocations WHERE receipt_id = ?', [req.params.id]);

        let seq = 0, allocated = 0;
        const seen = new Set();
        for (const a of list) {
            const itemId = parseInt(a.ar_item_id);
            if (!itemId) throw new Error('ทุกบรรทัดต้องระบุ ar_item_id');

            const paid = num(a.paid_amt);
            const claw = num(a.clawback_amt);
            if (paid < 0 || claw < 0) throw new Error('ยอดรับและยอดเรียกคืนต้องไม่ติดลบ');
            if (paid === 0 && claw === 0) continue;   // บรรทัดว่างจากหน้าจอ ข้ามไปเงียบ ๆ

            const subfund = a.subfund ? String(a.subfund).slice(0, 64) : null;
            const key = `${itemId}/${subfund || ''}`;
            if (seen.has(key)) throw new Error(`เคสเดียวกันกองทุนเดิมซ้ำในใบเดียว (${key})`);
            seen.add(key);

            // ต้องเป็นลูกหนี้ที่ตั้งหนี้แล้วจริง ไม่งั้นตัดยอดลอย
            const [[ok]] = await conn.query(
                `SELECT i.ar_item_id FROM ar_items i JOIN ar_batches b ON i.batch_id = b.batch_id
                 WHERE i.ar_item_id = ? AND b.is_deleted = 0 AND b.status = 'CONFIRMED'`,
                [itemId]
            );
            if (!ok) throw new Error(`ลูกหนี้ ar_item_id=${itemId} ไม่มีอยู่ หรือชุดส่งยังไม่ได้ยืนยัน`);

            await conn.query(
                `INSERT INTO ar_allocations (receipt_id, ar_item_id, seq, subfund, paid_amt, clawback_amt, note)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [req.params.id, itemId, seq++, subfund, paid, claw, a.note || null]
            );
            allocated += paid - claw;
        }

        await conn.query('UPDATE ar_receipts SET updated_by = ?, rev = rev + 1 WHERE receipt_id = ?',
            [req.user.user_id, req.params.id]);

        await auditLog(conn, {
            entity: 'ar_receipt', entity_id: req.params.id, action: 'ALLOCATE', actor: req.user,
            after: { lines: seq, allocated_amt: Math.round(allocated * 100) / 100 },
        });

        await conn.commit();
        res.json({
            success: true, rev: Number(before.rev) + 1,
            lines: seq,
            allocated_amt: Math.round(allocated * 100) / 100,
            gross_amt: Number(before.gross_amt),
            // ผลต่างที่ยังตัดไม่ครบ — หน้าจอเอาไปเตือนก่อนกดยืนยัน
            unallocated_amt: Math.round((Number(before.gross_amt) - allocated) * 100) / 100,
        });
    } catch (err) {
        await conn.rollback();
        sendErr(res, err, 'PUT /receipts/:id/allocations');
    } finally {
        conn.release();
    }
});

// ─────────────────────────────────────────────
// PUT /api/finance/receipts/:id/confirm — ยืนยัน = ตัดยอดมีผลจริง
//
// ยอดที่ตัดต้องเท่ากับยอดตาม Statement (gross) — ต่างกันเกิน 1 สตางค์ไม่ให้ผ่าน
// เพราะใบที่ตัดไม่ครบคือที่มาของ "เงินเข้าแล้วแต่ลูกหนี้ยังค้าง" ที่ตามไม่เจอทีหลัง
// ข้ามการตรวจได้ด้วย force:true + reason (บันทึกลง audit_log)
// ─────────────────────────────────────────────
router.put('/receipts/:id/confirm', requireRole('FINANCE', 'ADMIN'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const before = await lockDraft(conn, 'ar_receipts', 'receipt_id', req.params.id, 'ใบบันทึกรับ');

        const [[agg]] = await conn.query(
            `SELECT COUNT(*) AS n, COALESCE(SUM(paid_amt - clawback_amt),0) AS amt
             FROM ar_allocations WHERE receipt_id = ?`,
            [req.params.id]
        );
        if (!Number(agg.n)) {
            await conn.rollback();
            return res.status(400).json({ error: 'ใบที่ยังไม่ได้ตัดยอดลงเคสไหนเลย ยืนยันไม่ได้' });
        }

        const diff  = Math.round((Number(before.gross_amt) - Number(agg.amt)) * 100) / 100;
        const force = req.body?.force === true;
        if (Math.abs(diff) > 0.01 && !force) {
            await conn.rollback();
            return res.status(409).json({
                error: `ยอดที่ตัดลงเคส (${Number(agg.amt).toLocaleString('th-TH')}) ไม่ตรงกับยอดตาม Statement `
                     + `(${Number(before.gross_amt).toLocaleString('th-TH')}) ต่าง ${diff.toLocaleString('th-TH')} บาท`,
                code: 'ALLOCATION_MISMATCH',
                allocated_amt: Number(agg.amt), gross_amt: Number(before.gross_amt), diff,
            });
        }

        await conn.query(
            `UPDATE ar_receipts SET status = 'CONFIRMED', confirmed_by = ?, confirmed_at = NOW(),
                    updated_by = ?, rev = rev + 1
             WHERE receipt_id = ?`,
            [req.user.user_id, req.user.user_id, req.params.id]
        );
        await auditLog(conn, {
            entity: 'ar_receipt', entity_id: req.params.id, action: 'CONFIRM', actor: req.user,
            before: { status: before.status },
            after:  { status: 'CONFIRMED', lines: Number(agg.n), allocated_amt: Number(agg.amt), diff },
            note: force ? `ยืนยันทั้งที่ยอดต่าง ${diff}: ${req.body?.reason || 'ไม่ระบุเหตุผล'}` : (req.body?.note || null),
        });

        await conn.commit();
        res.json({ success: true, lines: Number(agg.n), allocated_amt: Number(agg.amt), diff });
    } catch (err) {
        await conn.rollback();
        sendErr(res, err, 'PUT /receipts/:id/confirm');
    } finally {
        conn.release();
    }
});

// ─────────────────────────────────────────────
// DELETE /api/finance/receipts/:id — soft delete (ยืนยันแล้วลบไม่ได้)
// ─────────────────────────────────────────────
router.delete('/receipts/:id', requireRole('FINANCE', 'ADMIN'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const before = await lockDraft(conn, 'ar_receipts', 'receipt_id', req.params.id, 'ใบบันทึกรับ');

        await conn.query(
            `UPDATE ar_receipts SET is_deleted = 1, deleted_by = ?, deleted_at = NOW(), rev = rev + 1
             WHERE receipt_id = ?`,
            [req.user.user_id, req.params.id]
        );
        await auditLog(conn, {
            entity: 'ar_receipt', entity_id: req.params.id, action: 'DELETE', actor: req.user,
            before: { receipt_no: before.receipt_no, period_key: before.period_key },
            note: req.body?.reason || null,
        });

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        sendErr(res, err, 'DELETE /receipts/:id');
    } finally {
        conn.release();
    }
});

// ============================================================
// ปรับปรุงยอด (ar_adjustments)
// ============================================================

// ─────────────────────────────────────────────
// POST /api/finance/adjustments
// body: { ar_item_id, adjust_date, kind, amount, reason }
//
// ตัดจำหน่ายหนี้สูญเป็นการยอมรับว่าเงินก้อนนี้จะไม่ได้แล้ว จึงจำกัดที่ ADMIN
// ─────────────────────────────────────────────
router.post('/adjustments', requireRole('FINANCE', 'ADMIN'), async (req, res) => {
    const { ar_item_id, adjust_date, kind, reason } = req.body;
    const amount = num(req.body.amount);

    if (!ar_item_id || !adjust_date) return res.status(400).json({ error: 'ต้องระบุ ar_item_id และ adjust_date' });
    if (!ADJUST_KINDS.includes(kind)) return res.status(400).json({ error: `kind ต้องเป็น ${ADJUST_KINDS.join(' / ')}` });
    if (amount <= 0)                  return res.status(400).json({ error: 'จำนวนเงินต้องมากกว่า 0 (ทิศทางอ่านจาก kind)' });
    if (!reason || !String(reason).trim()) return res.status(400).json({ error: 'ต้องระบุเหตุผลของการปรับปรุงยอด' });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[item]] = await conn.query(
            `SELECT i.ar_item_id, i.case_ref FROM ar_items i
             JOIN ar_batches b ON i.batch_id = b.batch_id
             WHERE i.ar_item_id = ? AND b.is_deleted = 0 AND b.status = 'CONFIRMED'`,
            [ar_item_id]
        );
        if (!item) {
            await conn.rollback();
            return res.status(404).json({ error: 'ไม่พบลูกหนี้รายนี้ หรือชุดส่งยังไม่ได้ยืนยัน' });
        }

        const [r] = await conn.query(
            `INSERT INTO ar_adjustments (ar_item_id, adjust_date, kind, amount, reason, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [ar_item_id, adjust_date, kind, amount, String(reason).trim(), req.user.user_id]
        );

        await auditLog(conn, {
            entity: 'ar_item', entity_id: ar_item_id, action: 'ADJUST', actor: req.user,
            after: { adjust_id: r.insertId, kind, amount, case_ref: item.case_ref },
            note: String(reason).trim(),
        });

        await conn.commit();
        res.status(201).json({ adjust_id: r.insertId });
    } catch (err) {
        await conn.rollback();
        console.error('[Finance] POST /adjustments', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ─────────────────────────────────────────────
// DELETE /api/finance/adjustments/:id — กลับรายการที่ลงผิด
// ─────────────────────────────────────────────
router.delete('/adjustments/:id', requireRole('FINANCE', 'ADMIN'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[before]] = await conn.query(
            'SELECT * FROM ar_adjustments WHERE adjust_id = ? AND is_deleted = 0 FOR UPDATE',
            [req.params.id]
        );
        if (!before) {
            await conn.rollback();
            return res.status(404).json({ error: 'ไม่พบรายการปรับปรุงนี้' });
        }

        await conn.query(
            'UPDATE ar_adjustments SET is_deleted = 1, deleted_by = ?, deleted_at = NOW() WHERE adjust_id = ?',
            [req.user.user_id, req.params.id]
        );
        await auditLog(conn, {
            entity: 'ar_item', entity_id: before.ar_item_id, action: 'ADJUST_REVERSE', actor: req.user,
            before: { adjust_id: before.adjust_id, kind: before.kind, amount: Number(before.amount) },
            note: req.body?.reason || null,
        });

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        console.error('[Finance] DELETE /adjustments/:id', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

module.exports = router;
