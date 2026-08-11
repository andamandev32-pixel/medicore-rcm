-- ============================================================
-- MediClearing — งานการเงิน: บันทึกส่ง → บันทึกรับ → ตัดยอดลูกหนี้รายบุคคล
--
-- เติมชั้นที่ระบบยังขาด: exec-finance.html สรุปยอดได้ระดับ "งวด × กองทุน"
-- แต่ตอบไม่ได้ว่า *เคสไหนของใคร* ยังไม่ได้เงิน — ซึ่งเป็นสิ่งที่ NHSO_CLEAR_AR
-- (public/js/mock/mock-nhso.js) ระบุเป็นเป้าหมายไว้ตั้งแต่ต้น:
--   "Clear บัญชีลูกหนี้ — เคลียร์ได้เป็นรายบุคคล
--    1 เคส ต้องรองรับการรับชำระหลายงวด หลายกองทุน และยอดเรียกคืน"
--
-- โครงเป็นบัญชีแยกประเภทย่อย (AR sub-ledger) 2 ฝั่ง:
--   ฝั่งตั้งหนี้  ar_batches → ar_items        "บันทึกส่ง" 1 ครั้ง ตั้งยอดพึงรับรายเคส
--   ฝั่งตัดหนี้  ar_receipts → ar_allocations  "บันทึกรับ" 1 ครั้ง ตัดยอดลงรายเคส
--   ปรับปรุง     ar_adjustments                ตัดจำหน่าย/ปรับเพิ่ม-ลด ที่ไม่มีเงินเข้า
--
-- ⚠️ ห้ามเก็บยอดคงค้าง/ยอดรับสะสมเป็นคอลัมน์ — คำนวณจากผลบวกเสมอ
--    (เหตุผลเดียวกับ mock-referrals.js:15 — ยอดที่เก็บซ้ำจะเพี้ยนจากยอดจริงวันหนึ่ง)
--    นิยามกลางที่ทั้ง API และหน้าจอต้องใช้ตรงกัน:
--      billed_adj   = billed_amt + Σ INCREASE − Σ REDUCE
--      net_received = Σ paid_amt − Σ clawback_amt   (เฉพาะใบรับที่ CONFIRMED)
--      outstanding  = billed_adj − net_received − Σ WRITE_OFF
--
-- ตารางแม่ (batches/receipts) ใช้ LIFECYCLE MIXIN — เป็น "เอกสาร"
-- ตารางลูก (items/allocations) เป็น replace-set ใต้ธุรกรรมและ rev ของแม่
-- แก้ได้เฉพาะตอนแม่ยัง DRAFT · ยืนยันแล้วล็อก เพราะยอดถูกอ้างไปคิดคงค้างแล้ว
--
-- วันที่เก็บเป็น ค.ศ. ตามธรรมเนียมโปรเจค — ชั้น mock/หน้าเว็บแปลงเป็น พ.ศ. เอง
-- ยกเว้น period_key: เป็น "ชื่องวด" ที่ สปสช. ออกให้ (YYMM พ.ศ. เช่น 6907)
-- ไม่ใช่วันที่ จึงเก็บตามรูปที่ราชการใช้ ตรงกับ NHSO_REPORT_NAMING
--
-- ทุกคำสั่งต้อง idempotent (IF NOT EXISTS) เพราะ migrate.js รันซ้ำได้เสมอ
-- ============================================================

-- ============================================================
-- 1. บันทึกส่ง — ตั้งยอดพึงรับ
-- ============================================================

CREATE TABLE IF NOT EXISTS ar_batches (
    batch_id    INT AUTO_INCREMENT PRIMARY KEY,
    batch_no    VARCHAR(32) NOT NULL,             -- เลขที่ชุดส่ง gen ด้วย id-gen.js (SB0001)
    period_key  VARCHAR(4)  NOT NULL,             -- งวด สปสช. YYMM พ.ศ. ('6907')
    payer       VARCHAR(8)  NOT NULL,             -- สิทธิผู้ป่วย UC/SSS/OFC/LGO/EMS/PVT (ref_payers)
    -- คีย์แถวกองทุนบนแบบฟอร์มสรุปยอดเงินโอน (FIN_SSO_ROWS/FIN_UC_ROWS)
    -- เช่น 'uc_ipd', 'sso_adjrw_main' — ใช้ผูกยอดรายเคสกลับไปหาแถวในหน้า exec-finance
    fund_key    VARCHAR(24) NOT NULL,
    sent_date   DATE NOT NULL,                    -- วันที่ส่งเบิก = วันตั้งหนี้ (ฐานนับอายุหนี้)
    sent_ref    VARCHAR(64) DEFAULT NULL,         -- เลขอ้างอิงที่ได้ตอนส่ง (REP/เลขรับของ สปสช.)
    channel     VARCHAR(32) DEFAULT NULL,         -- e-Claim / Statement / นำส่งเอกสาร
    note        VARCHAR(512) DEFAULT NULL,

    -- ═══ LIFECYCLE MIXIN (ดูคำอธิบายใน schema.sql) ═══
    status       ENUM('DRAFT','CONFIRMED') NOT NULL DEFAULT 'DRAFT',
    confirmed_by INT DEFAULT NULL,
    confirmed_at DATETIME DEFAULT NULL,
    is_deleted   TINYINT(1) NOT NULL DEFAULT 0,
    deleted_by   INT DEFAULT NULL,
    deleted_at   DATETIME DEFAULT NULL,
    created_by   INT DEFAULT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by   INT DEFAULT NULL,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    rev          INT NOT NULL DEFAULT 0,
    -- ═══════════════════════════════════════════════

    UNIQUE KEY uk_batch_no (batch_no),
    INDEX idx_period (period_key, payer),
    INDEX idx_active (is_deleted, status, sent_date)
) ENGINE=InnoDB;

-- ลูกหนี้รายบุคคล — 1 แถว = 1 เคสที่ส่งเบิกไป = 1 บรรทัดลูกหนี้
--
-- admission_id ผูกกลับไป ipd_admissions ได้ถ้าเคสนั้นอยู่ในระบบ (nullable
-- เพราะเคส OPD/PP ยังไม่มีตารางของตัวเองในฐานข้อมูล — เก็บ case_ref เป็นตัวอ้างแทน)
-- ไม่ทำ FK ไป ref_payers เพราะสิทธิ ณ วันรับบริการต้องคงอยู่แม้แคตตาล็อกเปลี่ยน
CREATE TABLE IF NOT EXISTS ar_items (
    ar_item_id   INT AUTO_INCREMENT PRIMARY KEY,
    batch_id     INT NOT NULL,
    seq          SMALLINT NOT NULL DEFAULT 0,
    case_ref     VARCHAR(32) NOT NULL,            -- เลขอ้างเคส (CLM-2569-0031 / AN)
    hn           VARCHAR(16) DEFAULT NULL,
    an           VARCHAR(16) DEFAULT NULL,
    patient_name VARCHAR(255) DEFAULT NULL,
    cid          VARCHAR(13) DEFAULT NULL,
    service_date DATE DEFAULT NULL,               -- วันรับบริการ (คนละตัวกับวันส่งเบิก)
    service_type ENUM('OPD','IPD','PP','REFER','OTHER') NOT NULL DEFAULT 'OTHER',
    billed_amt   DECIMAL(14,2) NOT NULL,          -- ยอดพึงรับตั้งต้นของเคสนี้
    admission_id INT DEFAULT NULL,
    note         VARCHAR(512) DEFAULT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_batch (batch_id, seq),
    INDEX idx_case (case_ref),
    INDEX idx_hn (hn),
    FOREIGN KEY (batch_id)     REFERENCES ar_batches(batch_id),
    FOREIGN KEY (admission_id) REFERENCES ipd_admissions(admission_id)
) ENGINE=InnoDB;

-- ============================================================
-- 2. บันทึกรับ — เงินเข้าบัญชี แล้วตัดยอดลงรายเคส
-- ============================================================

-- gross_amt = ยอดตามหนังสือแจ้งโอน · net_amt = ยอดที่เข้าบัญชีจริง
-- แยกกันเพราะมีค่าธรรมเนียม/ภาษีหัก ณ ที่จ่ายคั่นอยู่ (NHSO_STATEMENT_TAX_NOTE)
-- ยอดที่เอาไปตัดลูกหนี้คือยอดตาม Statement (gross) ไม่ใช่เงินสุทธิที่เข้าบัญชี
CREATE TABLE IF NOT EXISTS ar_receipts (
    receipt_id    INT AUTO_INCREMENT PRIMARY KEY,
    receipt_no    VARCHAR(32) NOT NULL,           -- เลขที่ใบบันทึกรับ gen ด้วย id-gen.js (RC0001)
    received_date DATE NOT NULL,                  -- วันที่เงินเข้าบัญชี
    period_key    VARCHAR(4) NOT NULL,            -- งวดของ Statement ที่จ่ายรอบนี้
    payer         VARCHAR(8) NOT NULL,
    statement_no  VARCHAR(64) DEFAULT NULL,       -- เลขที่ Statement/REP ที่อ้างถึง
    channel       VARCHAR(32) DEFAULT NULL,       -- โอนเข้าบัญชี / เช็ค / หักกลบ
    bank_ref      VARCHAR(64) DEFAULT NULL,       -- เลขอ้างอิงรายการเดินบัญชี
    gross_amt     DECIMAL(14,2) NOT NULL DEFAULT 0,
    fee_amt       DECIMAL(14,2) NOT NULL DEFAULT 0,
    net_amt       DECIMAL(14,2) NOT NULL DEFAULT 0,
    note          VARCHAR(512) DEFAULT NULL,

    -- ═══ LIFECYCLE MIXIN (ดูคำอธิบายใน schema.sql) ═══
    status       ENUM('DRAFT','CONFIRMED') NOT NULL DEFAULT 'DRAFT',
    confirmed_by INT DEFAULT NULL,
    confirmed_at DATETIME DEFAULT NULL,
    is_deleted   TINYINT(1) NOT NULL DEFAULT 0,
    deleted_by   INT DEFAULT NULL,
    deleted_at   DATETIME DEFAULT NULL,
    created_by   INT DEFAULT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by   INT DEFAULT NULL,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    rev          INT NOT NULL DEFAULT 0,
    -- ═══════════════════════════════════════════════

    UNIQUE KEY uk_receipt_no (receipt_no),
    INDEX idx_period (period_key, payer),
    INDEX idx_active (is_deleted, status, received_date)
) ENGINE=InnoDB;

-- การตัดยอด — 1 แถว = เงินก้อนหนึ่งจากกองทุนย่อยหนึ่ง ตัดเข้าลูกหนี้รายหนึ่ง
--
-- ทำไม subfund อยู่ตรงนี้ไม่ใช่ที่ ar_items:
--   กองทุนที่เรา "ตั้งเบิก" กับกองทุนที่ สปสช. "จำแนกจ่ายจริง" เป็นคนละตัว
--   (NHSO_MULTI_FUND ใน mock-nhso.js) — 1 เคสอาจได้เงินจากหลายกองทุนย่อย
--   คนละงวดกัน ตัวจำแนกจึงต้องอยู่ที่ฝั่งรับ ไม่ใช่ฝั่งตั้งหนี้
-- clawback_amt = ยอดเรียกคืนที่หักกลบมาในงวดนี้ (ยอดสุทธิ = paid − clawback)
CREATE TABLE IF NOT EXISTS ar_allocations (
    alloc_id     INT AUTO_INCREMENT PRIMARY KEY,
    receipt_id   INT NOT NULL,
    ar_item_id   INT NOT NULL,
    seq          SMALLINT NOT NULL DEFAULT 0,
    subfund      VARCHAR(64) DEFAULT NULL,        -- กองทุนย่อยที่จ่ายจริงตาม Statement
    paid_amt     DECIMAL(14,2) NOT NULL DEFAULT 0,
    clawback_amt DECIMAL(14,2) NOT NULL DEFAULT 0,
    note         VARCHAR(512) DEFAULT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- 1 เคสรับได้หลายกองทุนย่อยในใบเดียว แต่กองทุนย่อยเดิมซ้ำในใบเดียวไม่ได้
    UNIQUE KEY uk_alloc (receipt_id, ar_item_id, subfund),
    INDEX idx_item (ar_item_id),
    FOREIGN KEY (receipt_id) REFERENCES ar_receipts(receipt_id),
    FOREIGN KEY (ar_item_id) REFERENCES ar_items(ar_item_id)
) ENGINE=InnoDB;

-- ============================================================
-- 3. ปรับปรุงยอด — รายการที่ไม่มีเงินเข้าแต่ยอดลูกหนี้ต้องเปลี่ยน
--
-- ไม่ใช้ LIFECYCLE MIXIN เต็มชุดเพราะนี่เป็น "รายการลงบัญชี" ไม่ใช่เอกสารที่มีร่าง
-- ลงแล้วมีผลทันที แก้ไม่ได้ — ผิดให้กลับรายการด้วยแถวใหม่ (ตรงข้าม kind)
-- มีแค่ soft delete ไว้เผื่อลงผิดใบทั้งใบ ประวัติดูจาก audit_log
-- ============================================================

CREATE TABLE IF NOT EXISTS ar_adjustments (
    adjust_id   INT AUTO_INCREMENT PRIMARY KEY,
    ar_item_id  INT NOT NULL,
    adjust_date DATE NOT NULL,
    -- WRITE_OFF ตัดจำหน่ายหนี้สูญ (เลิกตาม) · REDUCE/INCREASE ปรับยอดพึงรับตั้งต้น
    kind        ENUM('WRITE_OFF','REDUCE','INCREASE') NOT NULL,
    amount      DECIMAL(14,2) NOT NULL,           -- บวกเสมอ — ทิศทางอ่านจาก kind
    reason      VARCHAR(255) NOT NULL,            -- บังคับ: ตัดยอดทิ้งต้องอธิบายได้เสมอ

    is_deleted  TINYINT(1) NOT NULL DEFAULT 0,
    deleted_by  INT DEFAULT NULL,
    deleted_at  DATETIME DEFAULT NULL,
    created_by  INT DEFAULT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_item (ar_item_id, is_deleted),
    FOREIGN KEY (ar_item_id) REFERENCES ar_items(ar_item_id)
) ENGINE=InnoDB;
