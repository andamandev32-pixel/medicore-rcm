-- ============================================================
-- MediClear — Reference Data (ข้อมูลอ้างอิงมาตรฐานการเบิกจ่าย)
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

-- ============================================================
-- 7. เอกสารอ้างอิง / แหล่งที่มา
--    ยก IPD_SOURCES (D2–D8) + MOCK_DOCS จากชั้น mock ขึ้นมาเป็นตารางจริง
--
-- ⭐ status คือหัวใจ: กฎที่อ้างเอกสารซึ่งยัง MISSING ต้องถูกกันไม่ให้ "ผ่าน"
--    rule-runner จะคืนผล BLOCKED_BY_DOC แทน PASS (ดู rules.sql)
--    เอกสารมาเมื่อไหร่ค่อยปลดล็อก — ไม่ใช่เดาค่าแล้วตรวจไปก่อน
-- ============================================================

CREATE TABLE IF NOT EXISTS ref_doc_sources (
    doc_id      VARCHAR(32) PRIMARY KEY,           -- 'D4' หรือ 'DOC-NHSO-2569-012'
    kind        ENUM('ANNOUNCE','MANUAL','AUDIT','INTERNAL','DATASET') NOT NULL DEFAULT 'ANNOUNCE',
    status      ENUM('PRESENT','PARTIAL','MISSING') NOT NULL DEFAULT 'MISSING',
    title       VARCHAR(512) NOT NULL,
    issuer      VARCHAR(128) DEFAULT NULL,         -- สปสช. / สกส. / กรมบัญชีกลาง / สปส. / สพฉ.
    doc_no      VARCHAR(64)  DEFAULT NULL,
    published      DATE DEFAULT NULL,
    effective_from DATE DEFAULT NULL,
    effective_to   DATE DEFAULT NULL,
    version     INT DEFAULT 0,                     -- 0 = ยังไม่มีตัวเอกสาร
    certified_by VARCHAR(16) DEFAULT NULL,         -- ผู้รับรองภายใน (รหัสผู้ใช้ในชั้น mock)
    file_path   VARCHAR(255) DEFAULT NULL,         -- ที่เก็บไฟล์ในโปรเจค (ถ้ามี)
    page_unit   VARCHAR(8) DEFAULT NULL,           -- 'น.' หรือ 'สไลด์'
    -- สิ่งที่เอกสารนี้ให้ได้ คั่นด้วย , เช่น 'drgTable,trimPoint,adjRwFormula'
    -- ใช้ตอบว่า "ค่าที่ระบบใช้อยู่มาจากเอกสารฉบับไหน"
    provides    VARCHAR(255) DEFAULT NULL,
    note        VARCHAR(512) DEFAULT NULL,

    source_doc  VARCHAR(255) DEFAULT NULL,
    source_ref  VARCHAR(64)  DEFAULT NULL,
    source_date DATE         DEFAULT NULL,
    verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_doc_status (status, kind)
) ENGINE=InnoDB;

-- ============================================================
-- 8. สิทธิผู้ป่วย (payer) และเงื่อนไขรายสิทธิ
--
-- payer ไม่ใช่ fund_key — คนละแกนกัน อย่าผูกสลับ
--    payer    = สิทธิของผู้ป่วย: UC/OFC/SSS/LGO/EMS/PVT (ตาราง ref_payers นี้)
--    fund_key = กองทุนค่าใช้จ่ายของ สปสช.: OP/PP/IP/... (ตาราง ref_funds)
--    เคสผู้ป่วยในใช้ fund_key='IP' เสมอ แต่ payer ต่างกันได้ทุกเคส
--    กฎในคลังกฎกำหนดขอบเขตด้วย payer (ฟิลด์ funds[] ของชั้น mock คือ payer)
-- ============================================================

CREATE TABLE IF NOT EXISTS ref_payers (
    payer_key  VARCHAR(8) PRIMARY KEY,             -- UC/OFC/SSS/LGO/EMS/PVT
    label_th   VARCHAR(255) NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    -- 0 = ไม่ได้จ่ายตามระบบ DRG (เช่น PVT จ่ายตามจริงใต้เพดานกรมธรรม์)
    drg_based  TINYINT(1) NOT NULL DEFAULT 1,
    note       VARCHAR(512) DEFAULT NULL,

    source_doc  VARCHAR(255) DEFAULT NULL,
    source_ref  VARCHAR(64)  DEFAULT NULL,
    source_date DATE         DEFAULT NULL,
    verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- เงื่อนไขเชิงตัวเลขรายสิทธิ (เพดานค่าห้อง/กรอบวันส่งเบิก/ชั่วโมง UCEP)
-- แยกเป็นแถวแทน hardcode ในโค้ด เพราะประกาศใหม่ทุกปี — เพิ่มแถวแล้วปิด effective_to ของเดิม
CREATE TABLE IF NOT EXISTS ref_payer_rules (
    payer_rule_id INT AUTO_INCREMENT PRIMARY KEY,
    payer_key   VARCHAR(8) NOT NULL,
    rule_key    VARCHAR(32) NOT NULL,              -- 'room_cap' | 'submit_days' | 'ucep_hours'
    num_value   DECIMAL(12,2) DEFAULT NULL,
    text_value  VARCHAR(255) DEFAULT NULL,
    label_th    VARCHAR(255) DEFAULT NULL,
    effective_from DATE DEFAULT NULL,
    effective_to   DATE DEFAULT NULL,

    source_doc  VARCHAR(255) DEFAULT NULL,
    source_ref  VARCHAR(64)  DEFAULT NULL,
    source_date DATE         DEFAULT NULL,
    verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_payer_rule (payer_key, rule_key, effective_from),
    FOREIGN KEY (payer_key) REFERENCES ref_payers(payer_key)
) ENGINE=InnoDB;

-- เอกสารที่แต่ละสิทธิบังคับให้มีก่อนส่งเบิก (แทน fund_check ในชั้น mock)
CREATE TABLE IF NOT EXISTS ref_payer_docs (
    payer_doc_id INT AUTO_INCREMENT PRIMARY KEY,
    payer_key  VARCHAR(8) NOT NULL,
    check_key  VARCHAR(48) NOT NULL,               -- 'approve_code','sss_card','claim_form','policy_doc','consent'
    label_th   VARCHAR(255) NOT NULL,
    required   TINYINT(1) NOT NULL DEFAULT 1,
    seq        SMALLINT NOT NULL DEFAULT 0,

    source_doc  VARCHAR(255) DEFAULT NULL,
    source_ref  VARCHAR(64)  DEFAULT NULL,
    source_date DATE         DEFAULT NULL,
    verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_payer_doc (payer_key, check_key),
    FOREIGN KEY (payer_key) REFERENCES ref_payers(payer_key)
) ENGINE=InnoDB;

-- อัตราจ่ายต่อ 1 RW (บาท) รายสิทธิ — ยกจาก IPD_FUND_RATES
-- rate_per_rw NULL = สิทธิที่ไม่ได้จ่ายตาม DRG (PVT)
CREATE TABLE IF NOT EXISTS ref_fund_rates (
    fund_rate_id INT AUTO_INCREMENT PRIMARY KEY,
    payer_key   VARCHAR(8) NOT NULL,
    rate_per_rw DECIMAL(12,2) DEFAULT NULL,
    effective_from DATE DEFAULT NULL,
    effective_to   DATE DEFAULT NULL,
    note        VARCHAR(512) DEFAULT NULL,

    source_doc  VARCHAR(255) DEFAULT NULL,
    source_ref  VARCHAR(64)  DEFAULT NULL,
    source_date DATE         DEFAULT NULL,
    verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_fund_rate (payer_key, effective_from),
    FOREIGN KEY (payer_key) REFERENCES ref_payers(payer_key)
) ENGINE=InnoDB;

-- ============================================================
-- 9. ค่าประกอบการคำนวณ AdjRW ตามคู่มือ Thai DRG
--
-- เป็น "ตารางพี่น้อง" ของ ref_drg ไม่ใช่การ ALTER ของเดิม
--    เพราะ migrate.js รันไฟล์ SQL ทั้งไฟล์เป็นคำสั่งเดียว — ALTER ที่รันซ้ำไม่ได้
--    จะทำให้ทั้งไฟล์ถูกข้าม ตารางแยกจึงปลอดภัยและ idempotent จริง
--
-- สูตรจริง (src/services/drg-adjrw.js):
--   OT = 3 x WtLOS
--   LOS ปกติ         : AdjRW = RW
--   LOS < WtLOS/3    : AdjRW = RW0d + LOS x (RW - RW0d) / CEILING(WtLOS/3)
--   OT < LOS <= 2OT  : AdjRW = RW + OF x b12 x (LOS - OT)
--   2OT < LOS <= 3OT : AdjRW = RW + OF x b12 x OT + OF x b23 x (LOS - 2OT)
--   LOS > 3OT        : AdjRW = RW + OF x OT x (b12 + b23)
-- ============================================================

CREATE TABLE IF NOT EXISTS ref_drg_outlier (
    drg_outlier_id INT AUTO_INCREMENT PRIMARY KEY,
    version_code VARCHAR(16) NOT NULL,
    drg_code     VARCHAR(8)  NOT NULL,
    rw0d      DECIMAL(9,4) DEFAULT NULL,           -- RW กรณีนอนไม่ถึง 24 ชม.
    wtlos     DECIMAL(6,2) DEFAULT NULL,           -- วันนอนมาตรฐานของกลุ่ม
    ot        DECIMAL(6,2) DEFAULT NULL,           -- จุดตัดวันนอนนานเกินเกณฑ์ (ปกติ = 3 x wtlos)
    of_factor DECIMAL(9,4) DEFAULT NULL,           -- OF - ตัวปรับเฉพาะกลุ่ม
    drg_kind  ENUM('SURGICAL','MEDICAL') DEFAULT NULL,  -- ใช้เลือกชุดสัมประสิทธิ์ b12/b23

    source_doc  VARCHAR(255) DEFAULT NULL,
    source_ref  VARCHAR(64)  DEFAULT NULL,
    source_date DATE         DEFAULT NULL,
    verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_drg_outlier (version_code, drg_code),
    FOREIGN KEY (version_code) REFERENCES ref_drg_versions(version_code)
) ENGINE=InnoDB;

-- สัมประสิทธิ์ b12/b23 แยกตามประเภทกลุ่มและช่วง RW ตามคู่มือ
CREATE TABLE IF NOT EXISTS ref_drg_outlier_coeff (
    coeff_id  INT AUTO_INCREMENT PRIMARY KEY,
    version_code VARCHAR(16) NOT NULL,
    drg_kind  ENUM('SURGICAL','MEDICAL') NOT NULL,
    rw_min    DECIMAL(9,4) NOT NULL DEFAULT 0,
    rw_max    DECIMAL(9,4) DEFAULT NULL,           -- NULL = ไม่จำกัดปลายบน
    b12       DECIMAL(10,6) NOT NULL,
    b23       DECIMAL(10,6) NOT NULL,

    source_doc  VARCHAR(255) DEFAULT NULL,
    source_ref  VARCHAR(64)  DEFAULT NULL,
    source_date DATE         DEFAULT NULL,
    verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_drg_coeff (version_code, drg_kind, rw_min),
    FOREIGN KEY (version_code) REFERENCES ref_drg_versions(version_code)
) ENGINE=InnoDB;

-- ============================================================
-- 10. เกณฑ์ตรวจประเมินคุณภาพการบันทึกเวชระเบียน (MRA - สปสช.)
--     ที่มา: คู่มือการตรวจประเมินคุณภาพการบันทึกเวชระเบียนผู้ป่วยใน ฉบับ 2563
--
-- แทน IPD_CHART_SECTIONS 24 หัวข้อที่ต้นแบบคิดขึ้นเอง - ของจริงคือ
--    12 องค์ประกอบ (7 บังคับทุกเคส + 5 เฉพาะบางเคส) เกณฑ์ย่อยข้อละ 1 คะแนน
--
-- การให้คะแนน: เกณฑ์ข้อละ 1 คะแนน · องค์ประกอบที่เคสไม่เข้าเงื่อนไข = N/A
-- และต้อง "ตัดออกจากตัวหาร" ไม่ใช่ให้ 0 (ดู src/services/mra-audit.js)
-- ============================================================

CREATE TABLE IF NOT EXISTS ref_mra_versions (
    version_code VARCHAR(16) PRIMARY KEY,          -- 'MRA-2563'
    label       VARCHAR(255) NOT NULL,
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

CREATE TABLE IF NOT EXISTS ref_mra_components (
    component_id INT AUTO_INCREMENT PRIMARY KEY,
    version_code  VARCHAR(16) NOT NULL,
    component_key VARCHAR(48) NOT NULL,            -- 'discharge_summary_dxop','history',...
    seq          SMALLINT NOT NULL DEFAULT 0,
    name_th      VARCHAR(255) NOT NULL,
    name_en      VARCHAR(128) DEFAULT NULL,
    -- 1 = ต้องบันทึกทุกเคส (7 องค์ประกอบ) · 0 = เฉพาะเคสที่เข้าเงื่อนไข (5 องค์ประกอบ)
    always_required TINYINT(1) NOT NULL DEFAULT 1,
    -- เงื่อนไขที่ทำให้องค์ประกอบนี้ถูกนำมาคิด: 'proc','consult','anesthesia','labour','rehab'
    needs        VARCHAR(32) DEFAULT NULL,
    max_score    SMALLINT NOT NULL DEFAULT 0,      -- = จำนวนเกณฑ์ย่อย

    source_doc  VARCHAR(255) DEFAULT NULL,
    source_ref  VARCHAR(64)  DEFAULT NULL,
    source_date DATE         DEFAULT NULL,
    verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_mra_component (version_code, component_key),
    FOREIGN KEY (version_code) REFERENCES ref_mra_versions(version_code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ref_mra_criteria (
    criterion_id INT AUTO_INCREMENT PRIMARY KEY,
    version_code  VARCHAR(16) NOT NULL,
    component_key VARCHAR(48) NOT NULL,
    criterion_no  SMALLINT NOT NULL,               -- 'ข้อ 1', 'ข้อ 2', ...
    text_th      VARCHAR(512) NOT NULL,
    score        SMALLINT NOT NULL DEFAULT 1,      -- เกณฑ์ละ 1 คะแนนตามคู่มือ

    source_doc  VARCHAR(255) DEFAULT NULL,
    source_ref  VARCHAR(64)  DEFAULT NULL,
    source_date DATE         DEFAULT NULL,
    verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_mra_criterion (version_code, component_key, criterion_no),
    FOREIGN KEY (version_code, component_key)
        REFERENCES ref_mra_components(version_code, component_key)
) ENGINE=InnoDB;
