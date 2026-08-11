/**
 * drg-adjrw.js — คำนวณน้ำหนักสัมพัทธ์ที่ปรับตามวันนอน (AdjRW) ตามคู่มือ Thai DRG
 *
 * สูตรจริงจากคู่มือ (ไม่ใช่สูตรจำลองที่ต้นแบบเคยใช้):
 *   OT = 3 x WtLOS
 *   ปกติ (WtLOS/3 <= LOS <= OT)  : AdjRW = RW
 *   นอนสั้น (LOS < WtLOS/3)       : AdjRW = RW0d + LOS x (RW - RW0d) / CEILING(WtLOS/3)
 *   OT < LOS <= 2xOT             : AdjRW = RW + OF x b12 x (LOS - OT)
 *   2xOT < LOS <= 3xOT           : AdjRW = RW + OF x b12 x OT + OF x b23 x (LOS - 2xOT)
 *   LOS > 3xOT                   : AdjRW = RW + OF x OT x (b12 + b23)
 *
 * ⭐ ถ้าค่าประกอบไม่ครบ (rw0d / of_factor / b12 / b23 ยังไม่มีในตาราง)
 *    ต้องคืน adj_rw = null พร้อม reason — ห้ามเดาค่าแล้วคำนวณต่อ
 *    เพราะตัวเลขนี้เอาไปคูณอัตราจ่ายเป็นเงินได้ การเดาคือการโกหกเรื่องเงิน
 *
 * ⭐ verified = 1 ต่อเมื่อ "ทุกแหล่ง" ที่ใช้คำนวณ verified ครบ
 *    ผู้เรียกต้องไม่แปลง RW เป็นบาทถ้า verified = 0 (ดู README ของ data/reference)
 */

/** ค่าที่ใช้ได้จริง (ไม่ใช่ null/NaN) */
const num = v => (v == null || v === '' || !isFinite(Number(v)) ? null : Number(v));

/**
 * แกนคำนวณล้วน — แยกจาก DB เพื่อทดสอบได้ตรง ๆ
 * @returns {{adj_rw:number|null, band:string, reason:string|null}}
 */
function computeAdjRwFrom({ rw, rw0d, wtlos, ot, of_factor, b12, b23, los }) {
    const RW = num(rw), LOS = num(los), WT = num(wtlos);
    if (RW == null) return { adj_rw: null, band: 'unknown', reason: 'ไม่มีค่า RW ของกลุ่มนี้' };
    if (LOS == null || LOS < 0) return { adj_rw: null, band: 'unknown', reason: 'ไม่มีจำนวนวันนอน' };
    if (WT == null || WT <= 0) return { adj_rw: null, band: 'unknown', reason: 'ไม่มีค่า WtLOS (วันนอนมาตรฐาน) ของกลุ่มนี้' };

    const OT = num(ot) != null ? num(ot) : WT * 3;      // ตามคู่มือ OT = 3 x WtLOS
    const lowCut = Math.ceil(WT / 3);

    if (LOS < WT / 3) {
        const RW0D = num(rw0d);
        if (RW0D == null) {
            return { adj_rw: null, band: 'low', reason: 'นอนสั้นกว่าเกณฑ์ แต่ยังไม่มีค่า RW0d ของกลุ่มนี้' };
        }
        if (lowCut <= 0) return { adj_rw: null, band: 'low', reason: 'ค่า WtLOS ผิดปกติ' };
        return { adj_rw: round4(RW0D + LOS * (RW - RW0D) / lowCut), band: 'low', reason: null };
    }

    if (LOS <= OT) return { adj_rw: round4(RW), band: 'normal', reason: null };

    const OF = num(of_factor), B12 = num(b12), B23 = num(b23);
    if (OF == null || B12 == null || B23 == null) {
        return {
            adj_rw: null, band: 'high',
            reason: 'นอนเกินจุดตัด แต่ยังไม่มีค่า OF/b12/b23 จากคู่มือ Thai DRG',
        };
    }
    if (LOS <= 2 * OT)  return { adj_rw: round4(RW + OF * B12 * (LOS - OT)), band: 'high1', reason: null };
    if (LOS <= 3 * OT)  return { adj_rw: round4(RW + OF * B12 * OT + OF * B23 * (LOS - 2 * OT)), band: 'high2', reason: null };
    return { adj_rw: round4(RW + OF * OT * (B12 + B23)), band: 'high3', reason: null };
}

const round4 = n => Math.round(n * 10000) / 10000;

/**
 * ดึงค่าประกอบจากฐานข้อมูลแล้วคำนวณ
 * @param {object} pool mysql2 pool
 * @param {{versionCode:string, drgCode:string, los:number}} arg
 */
async function computeAdjRw(pool, { versionCode, drgCode, los }) {
    if (!versionCode || !drgCode) {
        return { adj_rw: null, band: 'unknown', reason: 'ไม่ระบุเวอร์ชัน/รหัส DRG', verified: 0 };
    }

    const [[drg]] = await pool.query(
        `SELECT rw, verified FROM ref_drg
         WHERE version_code = ? AND drg_code = ? AND is_active = 1`,
        [versionCode, String(drgCode)]
    );
    if (!drg) {
        return { adj_rw: null, band: 'unknown', reason: `ไม่พบ DRG ${drgCode} ในเวอร์ชัน ${versionCode}`, verified: 0 };
    }

    const [[out]] = await pool.query(
        `SELECT rw0d, wtlos, ot, of_factor, drg_kind, verified FROM ref_drg_outlier
         WHERE version_code = ? AND drg_code = ? AND is_active = 1`,
        [versionCode, String(drgCode)]
    );

    let coeff = null;
    if (out && out.drg_kind) {
        const [[c]] = await pool.query(
            `SELECT b12, b23, verified FROM ref_drg_outlier_coeff
             WHERE version_code = ? AND drg_kind = ? AND is_active = 1
               AND rw_min <= ? AND (rw_max IS NULL OR rw_max >= ?)
             ORDER BY rw_min DESC LIMIT 1`,
            [versionCode, out.drg_kind, drg.rw, drg.rw]
        );
        coeff = c || null;
    }

    const res = computeAdjRwFrom({
        rw: drg.rw,
        rw0d: out ? out.rw0d : null,
        wtlos: out ? out.wtlos : null,
        ot: out ? out.ot : null,
        of_factor: out ? out.of_factor : null,
        b12: coeff ? coeff.b12 : null,
        b23: coeff ? coeff.b23 : null,
        los,
    });

    /* verified ต่อเมื่อทุกแหล่งที่ "ใช้จริง" ยืนยันแล้ว
       (แถบ normal ใช้แค่ ref_drg + wtlos จึงไม่บังคับให้ coeff verified) */
    const needCoeff = res.band && res.band.startsWith('high');
    const verified = drg.verified && out && out.verified && (!needCoeff || (coeff && coeff.verified)) ? 1 : 0;

    return { ...res, rw: Number(drg.rw), verified, version_code: versionCode, drg_code: String(drgCode) };
}

module.exports = { computeAdjRw, computeAdjRwFrom };
