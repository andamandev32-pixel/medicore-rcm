-- ============================================================
-- MediClearing — Reference Data (ข้อมูลอ้างอิงมาตรฐานการเบิกจ่าย)
--
-- ตารางชุดนี้เก็บ "มาตรฐานที่ประกาศจากภายนอก" — รหัสติด C ของ สปสช.,
-- โครงสร้าง 15 แฟ้ม NHSO Digital Platform, รหัสยา TMT, ตาราง Thai DRG
-- โหลดด้วย seed-reference.js / load-tmt.js จาก data/reference/*.csv
--
-- ไม่ใช้ LIFECYCLE MIXIN (schema.sql) — แถวพวกนี้ไม่ใช่ "เอกสาร" ที่ผู้ใช้แก้
-- แต่เป็นข้อมูลที่ loader จัดการ จึงใช้ PROVENANCE MIXIN แทน:
--
-- ═══ PROVENANCE MIXIN — ทุกตารางอ้างอิงภายนอกต้องมี ═══
--   source_doc  ชื่อเอกสาร/ไฟล์ที่มา เช่น 'C-Error E-Claim NHSO 06-01-2565'
--   source_ref  ตำแหน่งในเอกสาร เช่น 'น.14' หรือเลขหน้า/ข้อ
--   source_date วันที่ของเอกสารต้นทาง (ค.ศ.)
--   verified    1 = ทวนกับเอกสารทางการแล้ว — UI ใช้ขึ้นป้าย "ยืนยันแล้ว/รอยืนยัน"
--   is_active   0 = รายการถูกยกเลิก/หายไปจาก release ล่าสุด (ไม่ลบทิ้ง — เคสเก่าอ้างได้)
--
-- วันที่ทุกคอลัมน์เก็บเป็น ค.ศ. — ชั้น mock/หน้าเว็บแปลงเป็น พ.ศ. เอง
-- ทุกคำสั่งต้อง idempotent (IF NOT EXISTS) เพราะ migrate.js รันซ้ำได้เสมอ
-- ============================================================

-- ============================================================
-- 1. รหัสติด C / รหัสตอบกลับ สปสช. (e-Claim + NHSO Digital Platform)
--
-- แคตตาล็อกทางการมี C101–C652 (~652 รหัส) — โหลดทีละส่วนได้
-- แถวที่ยังไม่ทวนกับเอกสารให้ verified = 0 ไว้ก่อน
-- ============================================================

CREATE TABLE IF NOT EXISTS ref_error_codes (
    error_code_id   INT AUTO_INCREMENT PRIMARY KEY,
    -- system: รหัสเดียวกันอาจมีความหมายต่างกันคนละระบบ (เช่น C112/C305)
    --   ECLAIM  = แคตตาล็อกรหัสติด C ของโปรแกรม e-Claim เดิม (C101–C652)
    --   NHSO_DP = รหัสตอบกลับ NHSO Digital Platform ใหม่ (P/L/C จากสไลด์ — รอแคตตาล็อกทางการ)
    system          VARCHAR(16) NOT NULL DEFAULT 'ECLAIM',
    code            VARCHAR(8) NOT NULL,           -- 'C305', 'P124', ...
    category        VARCHAR(64) DEFAULT NULL,      -- หมวดตามเอกสาร เช่น 'ข้อมูลผู้ป่วย', 'สิทธิ/ปิดสิทธิ'
    level           ENUM('ERROR','WARNING','INFO') NOT NULL DEFAULT 'ERROR',
    file_no         TINYINT DEFAULT NULL,          -- แฟ้มที่เกี่ยวข้อง (1–15) ถ้าเอกสารระบุ
    description_th  TEXT NOT NULL,
    fix_guidance_th TEXT DEFAULT NULL,             -- วิธีปฏิบัติ/แนวทางแก้ไขตามเอกสาร
    effective_from  DATE DEFAULT NULL,
    effective_to    DATE DEFAULT NULL,

    source_doc  VARCHAR(255) DEFAULT NULL,
    source_ref  VARCHAR(64)  DEFAULT NULL,
    source_date DATE         DEFAULT NULL,
    verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_sys_code (system, code),
    INDEX idx_cat (category, verified)
) ENGINE=InnoDB;

-- ============================================================
-- 2. โครงสร้างชุดข้อมูลมาตรฐาน 15 แฟ้ม (NHSO Digital Platform)
--    ที่มา: NHSO Digital Platform Overview 23.06.2569 น.9–16
--
-- req/cond/opt_count เก็บตรงตามเอกสาร (รวม 160 data points)
-- ref_claim_file_fields เก็บรายฟิลด์ — เติมทีหลังเมื่อได้ spec รายฟิลด์
-- ============================================================

CREATE TABLE IF NOT EXISTS ref_claim_files (
    file_no         TINYINT PRIMARY KEY,           -- 1..15
    group_key       VARCHAR(16) NOT NULL,          -- MASTER/CLINICAL/FINANCE/SPECIFIC/ADMISSION
    name_th         VARCHAR(255) NOT NULL,
    name_en         VARCHAR(64)  NOT NULL,
    description_th  VARCHAR(255) DEFAULT NULL,
    origin          VARCHAR(32)  DEFAULT NULL,     -- '16 แฟ้ม' / 'DMIS' / 'ผู้ป่วยใน'
    req_count       TINYINT NOT NULL DEFAULT 0,    -- ฟิลด์ต้องระบุ (Y)
    cond_count      TINYINT NOT NULL DEFAULT 0,    -- ฟิลด์มีเงื่อนไข (Y/N)
    opt_count       TINYINT NOT NULL DEFAULT 0,    -- ฟิลด์อื่น ๆ (N)
    field_count     TINYINT NOT NULL DEFAULT 0,
    -- แฟ้มเงื่อนไข: ส่งเฉพาะเมื่อเคสเข้าเงื่อนไข (แฟ้ม 9–13, 15)
    condition_key   VARCHAR(32)  DEFAULT NULL,     -- emergency/prenatal/newborn/psych/disability/leaveDay
    condition_label VARCHAR(255) DEFAULT NULL,
    -- สถานะ mapping ฝั่งโรงพยาบาล (ไม่ใช่ข้อมูลทางการ — หน้างานอัปเดตเอง)
    mapping_status  ENUM('DONE','PARTIAL','TODO') NOT NULL DEFAULT 'TODO',

    source_doc  VARCHAR(255) DEFAULT NULL,
    source_ref  VARCHAR(64)  DEFAULT NULL,
    source_date DATE         DEFAULT NULL,
    verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ref_claim_file_fields (
    field_id    INT AUTO_INCREMENT PRIMARY KEY,
    file_no     TINYINT NOT NULL,
    seq         SMALLINT NOT NULL DEFAULT 0,
    field_code  VARCHAR(64) NOT NULL,              -- 'STDCODE', 'BILLGRCS', ...
    name_th     VARCHAR(255) DEFAULT NULL,
    requirement ENUM('REQ','COND','OPT') NOT NULL,
    data_type   VARCHAR(32) DEFAULT NULL,
    note        VARCHAR(255) DEFAULT NULL,

    source_doc  VARCHAR(255) DEFAULT NULL,
    source_ref  VARCHAR(64)  DEFAULT NULL,
    source_date DATE         DEFAULT NULL,
    verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_file_field (file_no, field_code),
    FOREIGN KEY (file_no) REFERENCES ref_claim_files(file_no)
) ENGINE=InnoDB;

-- ============================================================
-- 3. กองทุนค่าใช้จ่าย × แฟ้มที่ต้องส่ง (เมทริกซ์กฎ RUL-FIL-001)
--    ที่มา: NHSO Digital Platform Overview 23.06.2569 น.14–16
-- ============================================================

CREATE TABLE IF NOT EXISTS ref_funds (
    fund_key   VARCHAR(16) PRIMARY KEY,            -- OP/PP/QOF/LTC/CMHS/DMHT/TTM/REHAB/CANCER/TELEMED/AE/IP
    label_th   VARCHAR(255) NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,

    source_doc  VARCHAR(255) DEFAULT NULL,
    source_ref  VARCHAR(64)  DEFAULT NULL,
    source_date DATE         DEFAULT NULL,
    verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ref_fund_file_matrix (
    fund_key    VARCHAR(16) NOT NULL,
    file_no     TINYINT NOT NULL,
    -- REQUIRED = ส่งเสมอเมื่อเบิกกองทุนนี้ · CONDITIONAL = ส่งเมื่อเข้าเงื่อนไขของแฟ้ม
    requirement ENUM('REQUIRED','CONDITIONAL') NOT NULL DEFAULT 'REQUIRED',

    source_doc  VARCHAR(255) DEFAULT NULL,
    source_ref  VARCHAR(64)  DEFAULT NULL,
    source_date DATE         DEFAULT NULL,
    verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (fund_key, file_no),
    FOREIGN KEY (fund_key) REFERENCES ref_funds(fund_key),
    FOREIGN KEY (file_no)  REFERENCES ref_claim_files(file_no)
) ENGINE=InnoDB;

-- ============================================================
-- 4. รหัสยามาตรฐานไทย TMT (Thai Medicines Terminology)
--    ที่มา: Master TMT release จาก สมสท. (this.or.th) — ออกทุก 2 สัปดาห์
--
-- โหลดด้วย load-tmt.js เท่านั้น (ไฟล์ใหญ่หลักหมื่นแถว ต้อง batch)
-- ============================================================

CREATE TABLE IF NOT EXISTS ref_tmt_releases (
    release_version VARCHAR(24) PRIMARY KEY,       -- 'TMTRF20250701'
    release_date    DATE DEFAULT NULL,
    source_url      VARCHAR(255) DEFAULT NULL,
    row_count       INT DEFAULT NULL,
    loaded_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ref_tmt_drugs (
    tmt_id      VARCHAR(10) PRIMARY KEY,           -- TMT concept id (ตัวเลข — เก็บ string กันเลขนำหน้า 0 หาย)
    level       ENUM('SUBS','VTM','GP','GPU','TP','TPU') NOT NULL DEFAULT 'TPU',
    fsn         VARCHAR(512) NOT NULL,             -- Fully Specified Name
    manufacturer VARCHAR(255) DEFAULT NULL,
    strength    VARCHAR(128) DEFAULT NULL,
    dosage_form VARCHAR(128) DEFAULT NULL,
    unit_of_use VARCHAR(64)  DEFAULT NULL,
    -- ราคาอ้างอิงมาจาก "ไฟล์ราคากลาง" คนละไฟล์กับ TMT — เว้น NULL ได้
    ref_price   DECIMAL(12,2) DEFAULT NULL,
    price_source VARCHAR(128) DEFAULT NULL,
    change_flag VARCHAR(8)   DEFAULT NULL,         -- A(dd)/E(dit)/D(elete) จากไฟล์ delta ของ release
    release_version VARCHAR(24) NOT NULL,          -- release ล่าสุดที่พบรายการนี้

    source_doc  VARCHAR(255) DEFAULT NULL,
    source_ref  VARCHAR(64)  DEFAULT NULL,
    source_date DATE         DEFAULT NULL,
    verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_fsn (fsn(191)),
    FOREIGN KEY (release_version) REFERENCES ref_tmt_releases(release_version)
) ENGINE=InnoDB;

-- ============================================================
-- 5. Thai DRG — น้ำหนักสัมพัทธ์และจุดตัดวันนอน
--    ที่มา: คู่มือ Thai DRG (สกส. chi.or.th) — เวอร์ชันบังคับใช้ตามช่วงเวลา
--
-- เคสที่จำหน่ายปีก่อนต้องคำนวณด้วยค่าของเวอร์ชันที่บังคับใช้ ณ วันจำหน่าย
-- เมื่อมีเวอร์ชันใหม่ให้ "เพิ่มแถว" แล้วปิด effective_to ของเดิม ห้ามแก้ทับ (BR-02)
-- ============================================================

CREATE TABLE IF NOT EXISTS ref_drg_versions (
    version_code   VARCHAR(16) PRIMARY KEY,        -- 'TDRG-6.3'
    label          VARCHAR(128) NOT NULL,
    effective_from DATE DEFAULT NULL,
    effective_to   DATE DEFAULT NULL,

    source_doc  VARCHAR(255) DEFAULT NULL,
    source_ref  VARCHAR(64)  DEFAULT NULL,
    source_date DATE         DEFAULT NULL,
    verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ref_mdc (
    mdc      VARCHAR(4) PRIMARY KEY,               -- '04'
    label_th VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ref_drg (
    drg_id       INT AUTO_INCREMENT PRIMARY KEY,
    version_code VARCHAR(16) NOT NULL,
    drg_code     VARCHAR(8)  NOT NULL,             -- '04530'
    mdc          VARCHAR(4)  DEFAULT NULL,
    description_th VARCHAR(255) DEFAULT NULL,
    rw           DECIMAL(9,4) NOT NULL,            -- น้ำหนักสัมพัทธ์
    alos         DECIMAL(6,2) DEFAULT NULL,        -- วันนอนเฉลี่ย
    trim_low     SMALLINT DEFAULT NULL,            -- จุดตัดวันนอน (ชื่อคอลัมน์ตรงหัว CSV ของหน้า import เดิม)
    trim_high    SMALLINT DEFAULT NULL,
    -- รหัส PDx ตัวแทนที่จัดเข้ากลุ่มนี้ (คั่นด้วย |) — ใช้แทน Grouper จริงในต้นแบบเท่านั้น
    pdx_codes    VARCHAR(255) DEFAULT NULL,

    source_doc  VARCHAR(255) DEFAULT NULL,
    source_ref  VARCHAR(64)  DEFAULT NULL,
    source_date DATE         DEFAULT NULL,
    verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_ver_drg (version_code, drg_code),
    FOREIGN KEY (version_code) REFERENCES ref_drg_versions(version_code)
) ENGINE=InnoDB;

-- ============================================================
-- 6. รหัสวินิจฉัย ICD-10 / รหัสหัตถการ ICD-9-CM
--    ที่มา: ICD-10-TM (สนย. สธ.) · ICD-9-CM ฉบับที่ สปสช. ใช้จัดกลุ่ม DRG
--
-- ตัวอย่างใน repo เป็นชุดคัดย่อ (verified=0) โหลดผ่าน seed-reference
-- แคตตาล็อกเต็มโหลดด้วย load-icd.js (ไฟล์จริงไม่ commit — ดู data/reference/README.md)
--
-- code     เก็บรูปมีจุด ('J18.9') ตามที่หน้างานคุ้นตา
-- code_key เก็บรูปไร้จุดตัวใหญ่ ('J189') เป็นคีย์เทียบ — แฟ้มส่งออก/ไฟล์ทางการมักไร้จุด
-- ============================================================

CREATE TABLE IF NOT EXISTS ref_icd10 (
    icd10_id   INT AUTO_INCREMENT PRIMARY KEY,
    code       VARCHAR(10) NOT NULL,               -- 'J18.9'
    code_key   VARCHAR(8)  NOT NULL,               -- 'J189'
    term_en    VARCHAR(255) NOT NULL,
    term_th    VARCHAR(255) DEFAULT NULL,
    sex_limit  ENUM('M','F') DEFAULT NULL,         -- รหัสจำกัดเพศ (รองรับกฎ C204 ในอนาคต)

    source_doc  VARCHAR(255) DEFAULT NULL,
    source_ref  VARCHAR(64)  DEFAULT NULL,
    source_date DATE         DEFAULT NULL,
    verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_icd10_key (code_key),
    INDEX idx_icd10_code (code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ref_icd9 (
    icd9_id    INT AUTO_INCREMENT PRIMARY KEY,
    code       VARCHAR(8) NOT NULL,                -- '79.35'
    code_key   VARCHAR(6) NOT NULL,                -- '7935'
    term_en    VARCHAR(255) NOT NULL,
    term_th    VARCHAR(255) DEFAULT NULL,
    operative  TINYINT(1) DEFAULT NULL,            -- 1 = หัตถการห้องผ่าตัด (OR) · NULL = ยังไม่ระบุ

    source_doc  VARCHAR(255) DEFAULT NULL,
    source_ref  VARCHAR(64)  DEFAULT NULL,
    source_date DATE         DEFAULT NULL,
    verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_icd9_key (code_key),
    INDEX idx_icd9_code (code)
) ENGINE=InnoDB;
