-- ============================================================
-- MediCore Starter — Schema
--
-- ไม่มี CREATE DATABASE / USE ในไฟล์นี้ — migrate.js สร้างและเลือก database
-- จาก env DB_NAME ให้เอง (ทำให้ไฟล์นี้ย้ายไป database ไหนก็ได้)
--
-- ทุกคำสั่งต้อง idempotent (IF NOT EXISTS) เพราะ migrate.js รันซ้ำได้เสมอ
-- ============================================================

-- ============================================================
-- 1. ผู้ใช้และสิทธิ์
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    -- เลขใบประกอบวิชาชีพ — ใช้กำกับการกระทำที่ต้องมีผู้รับผิดชอบตามกฎหมาย
    -- ถ้าโดเมนใหม่ไม่ใช่งานวิชาชีพ ลบคอลัมน์นี้ได้ (ต้องแก้ routes/auth.js ด้วย)
    license_no    VARCHAR(50) DEFAULT NULL,
    is_active     BOOLEAN DEFAULT TRUE,
    -- token_version: ยกเลิก JWT ที่ออกไปแล้วภายใน ~60 วิ (src/middleware/revocation.js)
    -- ต้องมีตั้งแต่ต้น — ทั้ง revocation.js และ routes/auth.js พึ่งคอลัมน์นี้
    token_version INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS roles (
    role_id     INT AUTO_INCREMENT PRIMARY KEY,
    role_name   VARCHAR(50) NOT NULL UNIQUE,   -- ADMIN, DOCTOR, NURSE, PHARMACIST, NURSE_AIDE
    description VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB;

-- ผู้ใช้ 1 คนถือได้หลาย role แต่ "ใช้" ได้ทีละ role (active_role ใน JWT)
-- การสลับ role จึงลดสิทธิ์ได้จริง ดู src/middleware/auth.js:42-52
CREATE TABLE IF NOT EXISTS user_roles (
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
    session_id     VARCHAR(128) PRIMARY KEY,
    user_id        INT NOT NULL,
    active_role_id INT NOT NULL,
    ip_address     VARCHAR(45) DEFAULT NULL,
    expires_at     TIMESTAMP NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)        REFERENCES users(user_id),
    FOREIGN KEY (active_role_id) REFERENCES roles(role_id)
) ENGINE=InnoDB;

-- ============================================================
-- 2. Master data
-- ============================================================

CREATE TABLE IF NOT EXISTS departments (
    department_id   INT AUTO_INCREMENT PRIMARY KEY,
    department_name VARCHAR(255) NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- 3. Audit log — ตารางกลางตารางเดียวของทั้งระบบ
--
-- โปรเจคก่อนหน้ามีตาราง *_log แยกต่อ entity 12 ตัว schema เกือบเหมือนกันหมด
-- แล้วเขียน INSERT สดกระจายทั่ว route — ที่นี่รวมเป็นตารางเดียว + helper
-- src/services/audit-log.js
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
    log_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    entity      VARCHAR(64) NOT NULL,          -- ชื่อตาราง/ก้อนข้อมูล เช่น 'registry_item'
    entity_id   VARCHAR(64) NOT NULL,          -- varchar เพื่อรองรับ PK ทั้ง int และ string
    action      VARCHAR(32) NOT NULL,          -- CREATE / UPDATE / CONFIRM / DELETE / ...
    actor_id    INT DEFAULT NULL,
    -- role เดียวที่ใช้ ณ เวลานั้น (active_role) ไม่ใช่ roles[] ทั้งหมด
    -- ไม่งั้น log ใช้เป็นหลักฐานไม่ได้ว่าทำในฐานะอะไร
    actor_role  VARCHAR(32) DEFAULT NULL,
    before_json JSON DEFAULT NULL,
    after_json  JSON DEFAULT NULL,
    note        VARCHAR(255) DEFAULT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_entity (entity, entity_id, created_at),
    INDEX idx_actor  (actor_id, created_at)
) ENGINE=InnoDB;

-- ============================================================
-- 4. โมดูลตัวอย่าง — registry_items
--
-- ทะเบียนรายการ generic ที่สาธิตครบวงจร: CRUD + สิทธิ์ตาม role +
-- audit log + lifecycle mixin + optimistic lock
-- คัดลอกตารางนี้ (พร้อม routes/registry.js + public/registry.html)
-- ไปเป็นโมดูลจริงของโปรเจคใหม่ได้เลย
-- ============================================================

CREATE TABLE IF NOT EXISTS registry_items (
    registry_item_id INT AUTO_INCREMENT PRIMARY KEY,
    item_code        VARCHAR(32)  NOT NULL,
    item_name        VARCHAR(255) NOT NULL,
    department_id    INT DEFAULT NULL,
    priority         ENUM('ROUTINE','URGENT') NOT NULL DEFAULT 'ROUTINE',
    detail           TEXT DEFAULT NULL,

    -- ═══════════════════════════════════════════════════════════════════
    -- LIFECYCLE MIXIN — copy บล็อกนี้ลงทุกตารางที่เป็น "เอกสาร"
    --
    -- status       ร่าง → ยืนยัน (ยืนยันแล้วห้ามแก้เนื้อหา ให้สร้างฉบับแก้แทน)
    -- is_deleted   ลบนุ่ม — ทุก query ต้องมี is_deleted = 0 (ใช้ activeOnly() ช่วย)
    -- rev          optimistic lock — client ส่ง rev ที่อ่านมา ถ้าไม่ตรง = มีคนแก้ไปก่อน
    --              ป้องกัน 2 คนเปิดหน้าเดียวกันแล้วเขียนทับกันเงียบ ๆ
    -- ═══════════════════════════════════════════════════════════════════
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
    -- ═══════════════════════════════════════════════════════════════════

    UNIQUE KEY uk_item_code (item_code),
    INDEX idx_active (is_deleted, status, created_at),
    FOREIGN KEY (department_id) REFERENCES departments(department_id)
) ENGINE=InnoDB;
