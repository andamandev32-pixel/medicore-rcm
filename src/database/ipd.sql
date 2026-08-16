-- ============================================================
-- MediClear — ผู้ป่วยใน (IPD Admission จริง)
--
-- แทนที่ MockDB('ipd_stays') ฝั่ง browser — เก็บ admission + การลงรหัส
-- (Pdx/Sdx ICD-10 · หัตถการ ICD-9-CM · ค่าใช้จ่ายราย item BILLGRCS)
-- เพื่อส่งเข้า rule engine (claim-validator/claim-suggester) ก่อนส่งเบิก
--
-- ตารางแม่ ipd_admissions ใช้ LIFECYCLE MIXIN (ดู schema.sql) — เป็น "เอกสาร"
-- ตารางลูก (dx/proc/charges) เป็น replace-set ใต้ธุรกรรมของแม่: แก้ทั้งชุด
-- ผ่าน rev ของแม่ + audit_log ที่แม่ จึงไม่ต้องมี mixin ซ้ำ
--
-- วันที่เก็บเป็น ค.ศ. ตามธรรมเนียมโปรเจค — ชั้น mock/หน้าเว็บแปลงเป็น พ.ศ. เอง
-- ทุกคำสั่งต้อง idempotent (IF NOT EXISTS) เพราะ migrate.js รันซ้ำได้เสมอ
-- ============================================================

CREATE TABLE IF NOT EXISTS ipd_admissions (
    admission_id INT AUTO_INCREMENT PRIMARY KEY,
    an           VARCHAR(16) NOT NULL,             -- เลขที่ admission จาก HIS
    hn           VARCHAR(16) NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    cid          VARCHAR(13) DEFAULT NULL,
    birth_date   DATE DEFAULT NULL,
    sex          ENUM('M','F') DEFAULT NULL,
    -- สิทธิผู้ป่วย (UC/OFC/SSS/LGO/EMS/PVT) — ใช้แสดงผล/เลือกเอกสารกองทุน
    -- ⚠️ ไม่ใช่ fund_key ของ NHSO: ตอนตรวจกับ engine เคสผู้ป่วยในใช้ fund_key 'IP' เสมอ
    payer        VARCHAR(8) DEFAULT NULL,
    ward         VARCHAR(64) DEFAULT NULL,
    bed          VARCHAR(16) DEFAULT NULL,

    admit_at     DATETIME NOT NULL,
    discharge_at DATETIME DEFAULT NULL,
    discharge_type   VARCHAR(2) DEFAULT NULL,      -- DISCHT (1=ปกติ, 2=ส่งต่อ, ...)
    discharge_status VARCHAR(2) DEFAULT NULL,      -- DISCHS (1=หาย/ทุเลา, ...)
    leave_days   SMALLINT NOT NULL DEFAULT 0,      -- วันลากลับบ้าน (แฟ้ม 15 LVD)

    drg_code     VARCHAR(8) DEFAULT NULL,          -- DRG ที่ coder บันทึก (engine ใช้ตรวจ/เทียบ)
    files_sent   JSON DEFAULT NULL,                -- เลขแฟ้มที่จะส่ง เช่น [1,2,3,4,5,7,8,14]
    file_ctx     JSON DEFAULT NULL,                -- เงื่อนไขแฟ้ม {emergency, prenatal, newborn, psych, disability, leaveDay}

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

    UNIQUE KEY uk_an (an),
    INDEX idx_hn (hn),
    INDEX idx_active (is_deleted, status, admit_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ipd_diagnoses (
    diagnosis_id INT AUTO_INCREMENT PRIMARY KEY,
    admission_id INT NOT NULL,
    dx_type      ENUM('PDX','SDX') NOT NULL,
    seq          SMALLINT NOT NULL DEFAULT 0,      -- ลำดับของ Sdx (Pdx มีได้แถวเดียว seq=0)
    code         VARCHAR(10) NOT NULL,             -- รูปมีจุด 'J18.9'
    code_key     VARCHAR(8)  NOT NULL,             -- รูปไร้จุด 'J189' — คีย์เทียบกับ ref_icd10
    name         VARCHAR(255) DEFAULT NULL,        -- ชื่อ ณ เวลาบันทึก (คงไว้แม้แคตตาล็อกเปลี่ยน)
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_adm (admission_id, dx_type, seq),
    FOREIGN KEY (admission_id) REFERENCES ipd_admissions(admission_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ipd_procedures (
    procedure_id INT AUTO_INCREMENT PRIMARY KEY,
    admission_id INT NOT NULL,
    seq          SMALLINT NOT NULL DEFAULT 0,
    code         VARCHAR(8) NOT NULL,              -- ICD-9-CM รูปมีจุด '79.35'
    code_key     VARCHAR(6) NOT NULL,              -- 'ไร้จุด' — คีย์เทียบกับ ref_icd9
    name         VARCHAR(255) DEFAULT NULL,
    proc_date    DATE DEFAULT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_adm (admission_id, seq),
    FOREIGN KEY (admission_id) REFERENCES ipd_admissions(admission_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ipd_charges (
    charge_id    INT AUTO_INCREMENT PRIMARY KEY,
    admission_id INT NOT NULL,
    seq          SMALLINT NOT NULL DEFAULT 0,
    billgrcs     VARCHAR(4) DEFAULT NULL,          -- หมวดค่าใช้จ่ายมาตรฐาน ('02' = ค่าห้อง/ค่าอาหาร)
    name         VARCHAR(255) DEFAULT NULL,
    amount       DECIMAL(12,2) NOT NULL,
    qty          DECIMAL(8,2) DEFAULT NULL,        -- จำนวนหน่วย (ค่าห้อง = จำนวนวัน — กฎ C312)
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_adm (admission_id, seq),
    FOREIGN KEY (admission_id) REFERENCES ipd_admissions(admission_id)
) ENGINE=InnoDB;

-- ============================================================
-- 5. ผลตรวจประเมินเวชระเบียนรายเคส (MRA) + ผลตรวจเอกสารตามสิทธิ
--
-- แทน chart_audit / fund_check ที่เดิมฝังอยู่ในเคสตัวอย่างฝั่ง browser
-- ipd_audits เป็น "เอกสาร" (LIFECYCLE MIXIN + rev) · ตารางลูกเป็น replace-set
-- ใต้ธุรกรรมของแม่ เหมือน dx/proc/charges
--
-- 1 admission มีผลตรวจได้ 1 ชุด (แก้ทับได้ ประวัติดูจาก audit_log)
-- mra_version บันทึกไว้ทุกครั้ง เพราะเกณฑ์เปลี่ยนตามปี — เคสเก่าต้องอ่านย้อนได้ว่าใช้เกณฑ์ฉบับไหน
-- ============================================================

CREATE TABLE IF NOT EXISTS ipd_audits (
    audit_id     INT AUTO_INCREMENT PRIMARY KEY,
    admission_id INT NOT NULL,
    mra_version  VARCHAR(16) DEFAULT NULL,         -- ฉบับเกณฑ์ที่ใช้ตรวจครั้งนี้

    -- คะแนนเวชระเบียน: got/max นับเฉพาะเกณฑ์ที่ "เข้าเงื่อนไข" (N/A ตัดออกจากตัวหาร)
    chart_score  DECIMAL(6,2) DEFAULT NULL,
    chart_max    DECIMAL(6,2) DEFAULT NULL,
    chart_pct    DECIMAL(5,2) DEFAULT NULL,
    fund_pct     DECIMAL(5,2) DEFAULT NULL,        -- เอกสารตามสิทธิครบกี่ %
    file_pct     DECIMAL(5,2) DEFAULT NULL,        -- แฟ้มที่ต้องส่งครบกี่ %
    total_score  DECIMAL(5,2) DEFAULT NULL,
    result       ENUM('PASS','WARN','APPROVE','FIX','BLOCK') DEFAULT NULL,
    note         VARCHAR(512) DEFAULT NULL,

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

    UNIQUE KEY uk_audit_adm (admission_id),
    FOREIGN KEY (admission_id) REFERENCES ipd_admissions(admission_id)
) ENGINE=InnoDB;

-- ผลรายเกณฑ์ MRA (component_key + criterion_no ชี้ไปที่ ref_mra_criteria)
-- ไม่ใส่ FK ข้ามไป ref_mra_criteria เพราะเกณฑ์เวอร์ชันเก่าอาจถูกปิด is_active
-- แต่ผลตรวจเก่าต้องคงอยู่อ่านได้เสมอ
CREATE TABLE IF NOT EXISTS ipd_chart_audit_items (
    item_id      INT AUTO_INCREMENT PRIMARY KEY,
    audit_id     INT NOT NULL,
    component_key VARCHAR(48) NOT NULL,
    criterion_no SMALLINT NOT NULL DEFAULT 0,      -- 0 = ประเมินระดับองค์ประกอบ ไม่ลงรายข้อ
    state        ENUM('OK','MISSING','NA') NOT NULL DEFAULT 'NA',
    note         VARCHAR(512) DEFAULT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_audit_item (audit_id, component_key, criterion_no),
    FOREIGN KEY (audit_id) REFERENCES ipd_audits(audit_id)
) ENGINE=InnoDB;

-- ผลตรวจเอกสารที่สิทธินั้นบังคับ (check_key ตรงกับ ref_payer_docs)
CREATE TABLE IF NOT EXISTS ipd_fund_checks (
    fund_check_id INT AUTO_INCREMENT PRIMARY KEY,
    audit_id   INT NOT NULL,
    check_key  VARCHAR(48) NOT NULL,
    state      ENUM('OK','MISSING','NA') NOT NULL DEFAULT 'NA',
    note       VARCHAR(512) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_audit_fund (audit_id, check_key),
    FOREIGN KEY (audit_id) REFERENCES ipd_audits(audit_id)
) ENGINE=InnoDB;
