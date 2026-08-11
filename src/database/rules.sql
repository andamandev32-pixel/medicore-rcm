-- ============================================================
-- MediClearing — คลังกฎ (Rule Repository) + บันทึกการประมวลผลกฎ
--
-- ยกกฎเชิงนโยบายจาก public/js/mock/mock-rules.js ขึ้นมาเป็นข้อมูลจริง
-- และทำให้ "รันได้" ผ่าน src/services/rule-runner.js
--
-- ⭐ หลักคิดสำคัญ — ทำไมไม่เก็บเงื่อนไขเป็น AST แล้วตีความ:
--    conditions[] ในต้นแบบเป็น "ข้อความไทยสำหรับให้คนอ่าน" (field/op เป็น
--    display string เช่น 'แฟ้ม 7 · ราคาที่เบิกต่อหน่วย' / 'มากกว่า')
--    ถ้าฝืนแปลงเป็นนิพจน์จะได้ engine ที่เปราะและ "ดูเหมือนตรวจ" แต่ไม่จริง
--
--    จึงแยกสองบทบาทชัด ๆ:
--      rule_conditions          = เอกสารกำกับกฎ ให้คนอ่านและตรวจทาน
--      rule_versions.check_key  = ตัวที่ execute จริง ชี้ไปที่ฟังก์ชันใน
--                                 rule-runner.js (CHECKERS registry) + params_json
--
--    กฎที่ยังไม่มี check_key = ยังตรวจไม่ได้ → runner ต้องคืน NOT_IMPLEMENTED
--    ห้ามนับเป็น "ผ่าน" เด็ดขาด (ไม่งั้นระบบจะโกหกว่าเคสสะอาด)
--
-- BR-01 เลือกกฎตามวันที่ให้บริการ + สิทธิ + ประเภทบริการ (ไม่ใช่เวอร์ชันล่าสุดเสมอ)
-- BR-02 ห้ามแก้ทับกฎที่เคย ACTIVE — ออกเวอร์ชันใหม่เป็นแถวใหม่
-- BR-03 ผลตรวจทุกครั้งต้องย้อนได้ถึง rule code + version + เอกสารอ้างอิง
--
-- วันที่เก็บเป็น ค.ศ. ตามธรรมเนียมโปรเจค — ชั้น mock/หน้าเว็บแปลงเป็น พ.ศ. เอง
-- ทุกคำสั่งต้อง idempotent (IF NOT EXISTS) เพราะ migrate.js รันซ้ำได้เสมอ
-- ============================================================

-- ตัวกฎ (ตัวตนถาวร) — ชื่อ/หมวดเปลี่ยนได้ แต่รหัสกฎไม่เปลี่ยน
CREATE TABLE IF NOT EXISTS rule_definitions (
    rule_code   VARCHAR(32) PRIMARY KEY,           -- 'RUL-DRG-007'
    name        VARCHAR(255) NOT NULL,
    category    VARCHAR(64) DEFAULT NULL,          -- 'ราคาและค่าใช้จ่าย', 'สิทธิและการปิดสิทธิ', ...
    description_th TEXT DEFAULT NULL,
    is_active   TINYINT(1) NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_rule_cat (category, is_active)
) ENGINE=InnoDB;

-- ฉบับของกฎ — ทุกการเปลี่ยนแปลงคือแถวใหม่ (BR-02)
CREATE TABLE IF NOT EXISTS rule_versions (
    rule_version_id INT AUTO_INCREMENT PRIMARY KEY,
    rule_code   VARCHAR(32) NOT NULL,
    version     INT NOT NULL,
    status      ENUM('DRAFT','REVIEW','APPROVED','ACTIVE','RETIRED') NOT NULL DEFAULT 'DRAFT',
    severity    ENUM('ERROR','WARNING','INFO') NOT NULL DEFAULT 'ERROR',
    action      ENUM('BLOCK','FIX','WARN','APPROVE') NOT NULL DEFAULT 'WARN',

    -- รหัสที่คาดว่าจะได้กลับมาถ้าไม่แก้ (ผูกกับ ref_error_codes)
    maps_to_nhso VARCHAR(8) DEFAULT NULL,
    nhso_system  VARCHAR(16) NOT NULL DEFAULT 'ECLAIM',

    -- ⭐ สองคอลัมน์นี้คือสิ่งที่ทำให้กฎ "รันได้จริง"
    --    check_key   = ชื่อ checker ใน CHECKERS ของ rule-runner.js
    --                  NULL = ยังไม่มีตัวตรวจ → ผลลัพธ์ NOT_IMPLEMENTED
    --    params_json = ค่าคงที่ของกฎข้อนั้น เช่น {"days":30} — เปลี่ยนได้โดยไม่แก้โค้ด
    check_key   VARCHAR(64) DEFAULT NULL,
    params_json JSON DEFAULT NULL,

    -- กฎที่รอเอกสารทางการ (ref_doc_sources.status = MISSING) → BLOCKED_BY_DOC
    blocked_by  VARCHAR(32) DEFAULT NULL,
    doc_id      VARCHAR(32) DEFAULT NULL,          -- เอกสารอ้างอิงของกฎ (BR-03)
    doc_ref     VARCHAR(128) DEFAULT NULL,         -- 'ข้อ 4.2 หน้า 18'
    origin_doc  VARCHAR(512) DEFAULT NULL,         -- ที่มาแบบข้อความ (กรณีไม่มี doc_id)

    author_ref   VARCHAR(16) DEFAULT NULL,         -- ผู้ร่าง
    approver_ref VARCHAR(16) DEFAULT NULL,         -- ผู้อนุมัติ (ต้องคนละคนกับผู้ร่าง — BR-05)
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

    UNIQUE KEY uk_rule_version (rule_code, version),
    INDEX idx_rv_status (status, effective_from),
    INDEX idx_rv_check (check_key),
    FOREIGN KEY (rule_code)  REFERENCES rule_definitions(rule_code),
    FOREIGN KEY (blocked_by) REFERENCES ref_doc_sources(doc_id),
    FOREIGN KEY (doc_id)     REFERENCES ref_doc_sources(doc_id)
) ENGINE=InnoDB;

-- ขอบเขตกฎ: สิทธิผู้ป่วยที่กฎนี้ใช้ (BR-01)
CREATE TABLE IF NOT EXISTS rule_version_payers (
    rule_version_id INT NOT NULL,
    payer_key   VARCHAR(8) NOT NULL,
    PRIMARY KEY (rule_version_id, payer_key),
    FOREIGN KEY (rule_version_id) REFERENCES rule_versions(rule_version_id),
    FOREIGN KEY (payer_key) REFERENCES ref_payers(payer_key)
) ENGINE=InnoDB;

-- ขอบเขตกฎ: ประเภทบริการที่กฎนี้ใช้ (BR-01)
CREATE TABLE IF NOT EXISTS rule_version_services (
    rule_version_id INT NOT NULL,
    service_type ENUM('OPD','IPD','PP') NOT NULL,
    PRIMARY KEY (rule_version_id, service_type),
    FOREIGN KEY (rule_version_id) REFERENCES rule_versions(rule_version_id)
) ENGINE=InnoDB;

-- เงื่อนไขเชิงเอกสาร — ให้คนอ่านและตรวจทาน ไม่ใช่ตัวที่ execute
-- (ตัวที่ execute คือ rule_versions.check_key — ดูหัวไฟล์)
CREATE TABLE IF NOT EXISTS rule_conditions (
    condition_id INT AUTO_INCREMENT PRIMARY KEY,
    rule_version_id INT NOT NULL,
    seq       SMALLINT NOT NULL DEFAULT 0,
    join_op   VARCHAR(4) DEFAULT NULL,             -- '' | 'AND' | 'OR' (แถวแรกว่างเสมอ)
    field     VARCHAR(255) NOT NULL,
    op        VARCHAR(64)  NOT NULL,
    value     VARCHAR(512) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_rule_cond (rule_version_id, seq),
    FOREIGN KEY (rule_version_id) REFERENCES rule_versions(rule_version_id)
) ENGINE=InnoDB;

-- แม่แบบกฎสำหรับหน้าจอสร้างกฎแบบ no-code
CREATE TABLE IF NOT EXISTS rule_templates (
    template_key VARCHAR(32) PRIMARY KEY,          -- REQUIRED/RANGE/DXPROC/CATALOGUE/APPROVE/DOCS
    icon        VARCHAR(32) DEFAULT NULL,
    name_th     VARCHAR(255) NOT NULL,
    description_th VARCHAR(512) DEFAULT NULL,
    maps_to_nhso VARCHAR(8) DEFAULT NULL,
    check_key   VARCHAR(64) DEFAULT NULL,          -- แม่แบบที่ผูกกับ checker จริงได้
    seq         SMALLINT NOT NULL DEFAULT 0,
    is_active   TINYINT(1) NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- สถิติผลของกฎ ณ ช่วงเวลาหนึ่ง (ของเดิมเป็นตัวเลขนิ่งในต้นแบบ)
CREATE TABLE IF NOT EXISTS rule_kpi_snapshots (
    snapshot_id INT AUTO_INCREMENT PRIMARY KEY,
    rule_code   VARCHAR(32) NOT NULL,
    as_of       DATE NOT NULL,
    hit            INT NOT NULL DEFAULT 0,
    true_issue     INT NOT NULL DEFAULT 0,         -- % ที่เป็นปัญหาจริง
    override_count INT NOT NULL DEFAULT 0,
    false_positive INT NOT NULL DEFAULT 0,
    prevented   DECIMAL(14,2) NOT NULL DEFAULT 0,  -- มูลค่าที่กันไว้ได้ (บาท)
    simulated   TINYINT(1) NOT NULL DEFAULT 1,     -- 1 = ตัวเลขสาธิต ยังไม่ใช่ของจริง
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_kpi (rule_code, as_of),
    FOREIGN KEY (rule_code) REFERENCES rule_definitions(rule_code)
) ENGINE=InnoDB;

-- ============================================================
-- บันทึกการประมวลผลกฎ (BR-03) — ต้องย้อนได้ว่า "ตอนนั้นตัดสินด้วยอะไร"
-- เก็บ input snapshot ไว้ด้วย เพราะข้อมูลเคสแก้ได้ภายหลัง
-- ============================================================

CREATE TABLE IF NOT EXISTS rule_executions (
    execution_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    subject_type VARCHAR(32) NOT NULL,             -- 'IPD_ADMISSION' | 'CLAIM' | 'ADHOC'
    subject_id   VARCHAR(64) DEFAULT NULL,
    as_of        DATE DEFAULT NULL,                -- วันที่ใช้เลือกกฎ (วันจำหน่าย/วันรับบริการ)
    payer_key    VARCHAR(8) DEFAULT NULL,
    service_type VARCHAR(8) DEFAULT NULL,

    rules_total     INT NOT NULL DEFAULT 0,        -- กฎที่เข้าขอบเขต
    rules_executed  INT NOT NULL DEFAULT 0,        -- ที่มี checker และรันจริง
    hits            INT NOT NULL DEFAULT 0,
    not_implemented INT NOT NULL DEFAULT 0,
    blocked         INT NOT NULL DEFAULT 0,
    input_snapshot  JSON DEFAULT NULL,

    actor_id    INT DEFAULT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_exec_subject (subject_type, subject_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rule_execution_items (
    item_id     BIGINT AUTO_INCREMENT PRIMARY KEY,
    execution_id BIGINT NOT NULL,
    rule_code   VARCHAR(32) NOT NULL,
    version     INT DEFAULT NULL,
    check_key   VARCHAR(64) DEFAULT NULL,
    -- PASS            ตรวจแล้วผ่าน
    -- HIT             ตรวจแล้วเข้าเงื่อนไขของกฎ (มีประเด็น)
    -- NOT_IMPLEMENTED กฎมีอยู่แต่ยังไม่มีตัวตรวจ — ห้ามแสดงว่าผ่าน
    -- BLOCKED_BY_DOC  ตรวจไม่ได้เพราะยังไม่มีเอกสารอ้างอิง
    -- SKIPPED         อยู่นอกขอบเขตเคสนี้ · ERROR ตัวตรวจพัง
    outcome     ENUM('PASS','HIT','NOT_IMPLEMENTED','BLOCKED_BY_DOC','SKIPPED','ERROR') NOT NULL,
    severity    VARCHAR(16) DEFAULT NULL,
    action      VARCHAR(16) DEFAULT NULL,
    message     VARCHAR(1024) DEFAULT NULL,
    detail      VARCHAR(1024) DEFAULT NULL,
    evidence_json JSON DEFAULT NULL,
    doc_ref     VARCHAR(128) DEFAULT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_exec_item (execution_id, outcome),
    FOREIGN KEY (execution_id) REFERENCES rule_executions(execution_id)
) ENGINE=InnoDB;
