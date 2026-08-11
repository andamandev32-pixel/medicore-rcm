# progress.md — บันทึกความคืบหน้า MediClearing

> อัปเดตล่าสุด: **11 ส.ค. 2569** · ไฟล์นี้สรุปว่า "ทำอะไรไปแล้ว · กฎอยู่ตรงไหน · ต่อยังไง"
> อัปเดตไฟล์นี้ทุกครั้งที่จบงานก้อนใหญ่ (พร้อม commit hash)

---

## 1. กฎในระบบมีอะไรบ้าง และดูตรงไหน

ระบบมี "กฎ" 4 กลุ่ม — คนละชั้น คนละที่:

| กลุ่มกฎ | จำนวน | เก็บที่ | ดู/ทดลองได้ที่ | สถานะ |
|---|---|---|---|---|
| **แคตตาล็อกรหัสติด C สปสช.** (เกณฑ์ deny มาตรฐานที่ทุก รพ. เจอ) | 446 รหัส (ทวนแล้ว 440) + **fix_guidance_th 22 รหัส** (ระบบเขียนเอง) | ตาราง MySQL `ref_error_codes` · ไฟล์ต้นทาง `data/reference/error-codes.csv` | `GET /api/reference/error-codes?q=ยา` (ค้นได้) · สถานะรวม `GET /api/reference/meta` | ✅ ข้อมูลจริง ครบ 100% ของแหล่ง |
| **แคตตาล็อก ICD-10 / ICD-9-CM** (ชุดคัดย่อเดโม) | 83 + 28 รหัส | `ref_icd10` / `ref_icd9` · `data/reference/icd10-sample.csv`, `icd9-sample.csv` · ไฟล์เต็มโหลดด้วย `src/database/load-icd.js` | `GET /api/reference/icd10?q=pneumonia` (ค้น/autocomplete ได้ รับทั้งรูปมีจุด-ไร้จุด) | ⚠️ ชุดคัดย่อ verified=0 — ครอบคลุมรหัสในเคสเดโมทั้งหมด |
| **กฎที่ execute ได้จริง (rule engine)** — ตรวจเคลมก่อนส่ง **8 ชั้น + ชั้นเสนอแนะ** | ~30 เช็ค + 6 suggestion | `src/services/claim-validator.js` · `src/services/claim-suggester.js` | `POST /api/reference/validate` (stateless) · `POST /api/ipd/admissions/:id/validate` (จากข้อมูลจริง) · หน้าเว็บ **nhso-import.html → กล่อง Pre-validate** และ **ipd-audit.html → ปุ่ม "ตรวจกับ rule engine จริง"** | ✅ ใช้งานได้ ข้อความ error + แนวทางแก้ดึงจากแคตตาล็อกจริง |
| **ข้อมูลผู้ป่วยในจริง** (admission + การลงรหัส) | 7 เคสเดโม | ตาราง `ipd_admissions` + `ipd_diagnoses`/`ipd_procedures`/`ipd_charges` (`src/database/ipd.sql`) · seed `npm run seed:ipd` | `GET/POST/PUT /api/ipd/admissions` (ต้องล็อกอิน) · หน้า **ipd-admit.html** ลงรหัสผ่านฟอร์มได้จริง (autocomplete จากแคตตาล็อก) | ✅ CRUD + replace-set + audit log + optimistic lock |
| **คลังกฎเชิงนโยบาย 31 ข้อ** (RUL-DRG-007, RUL-ELG-004, RUL-FIL-001 ฯลฯ พร้อม lifecycle DRAFT→ACTIVE, ขอบเขตตามสิทธิ/บริการ, KPI) | 31 กฎ · 36 ฉบับ · 59 เงื่อนไข | ตาราง `rule_definitions`/`rule_versions`(+`check_key`,`params_json`)/`rule_conditions`/`rule_templates`/`rule_kpi_snapshots` · CSV ต้นทาง `data/reference/rules*.csv` · seed `npm run seed:rules` | `GET /api/rules`, `/coverage`, `POST /api/rules/run` · หน้า **claim-rules.html** (แถบ coverage + ป้ายรายกฎ) | ✅ ข้อมูลจริง · **execute ได้ 10/21 กฎ ACTIVE (48%)** ที่เหลือขึ้นป้าย "ตรวจด้วยคน" ไม่ใช่ผ่านเงียบ ๆ |
| **เกณฑ์ตรวจเวชระเบียน MRA 2563** (สปสช.) | 12 องค์ประกอบ (7 บังคับ + 5 เงื่อนไข) · เกณฑ์ย่อย 9 ข้อ | `ref_mra_versions`/`components`/`criteria` · ผลรายเคส `ipd_audits`/`ipd_chart_audit_items`/`ipd_fund_checks` | `GET /api/reference/mra` · `GET/PUT /api/ipd/admissions/:id/audit` · แผงในหน้า **ipd-audit.html** | ✅ โครงเกณฑ์จริง (verified=1) · เกณฑ์ย่อยครบเฉพาะ MR1 — ที่เหลือรอถอดจาก PDF ทางการ |
| **กฎ IPD pre-audit เดิม** (24 หัวข้อที่ต้นแบบคิดเอง + DRG/trim/อัตราจ่าย) | 24 | `public/js/mock/mock-ipd.js` (`_ruleHit`, `IPD_CHART_SECTIONS`) | หน้า **ipd-audit.html** (แสดงคู่กับแผง MRA), **ipd-reference.html** | ⚠️ ยังเป็น mock — จะเลิกใช้เมื่อย้ายผลตรวจ 7 เคสเดโมไปเกณฑ์ MRA ครบ |

**เช็คลิสต์ 8 ชั้นที่ engine ตรวจแล้ววันนี้** (`claim-validator.js`):

1. **FILES** — แฟ้มครบตามกองทุน (เมทริกซ์ 12 กองทุน×แฟ้ม จากเอกสาร NHSO DP) → `RUL-FIL-001`
2. **PATIENT** — ชื่อ C101 · วันเกิด C102 · เพศ C103 · เลขบัตร ปชช. + checksum C104/C116 · HN C105 · AN (กรณี IP) C106
3. **ADMISSION** — รูปแบบวันที่ C107/C120/C121 · วันนอนไม่ตรงสูตร (จำหน่าย−รับ+1−ลากลับบ้าน) `ENG-ADM-LOS` (= C112 บน NHSO DP)
4. **DX** — ไม่มี Pdx C201 · Pdx เกิน 1 รหัส C202 · Pdx/Sdx ไม่พบในแคตตาล็อก ICD-10 **C203** · Pdx ไม่เหมาะกับผู้ป่วยใน C206 · รหัสซ้ำ `ENG-DX-DUP`
5. **PROC** — หัตถการไม่พบในแคตตาล็อก ICD-9-CM `ENG-PROC-001` · มีหัตถการแต่ไม่ส่งแฟ้ม 6 `ENG-PROC-FILE`
6. **DRUG** — ยาไม่พบใน Drug Catalogue C562 · ราคาไม่ตรงราคาอ้างอิง C195 (= P124 บน platform ใหม่) · ไม่ระบุจำนวน C303
7. **CHARGE** — ยอด/รายการเป็นศูนย์-ลบ C301 · ค่าห้อง (BILLGRCS 02) เกินวันนอน **C312** · ยอดรวม≠ผลรวมรายการ `ENG-CHG-SUM` · ไม่ระบุหมวด `ENG-CHG-CAT`
8. **DRG** — จัดกลุ่มไม่ได้ C210 · วันนอนหลุด trim point (คำเตือน AdjRW) · **เลือกเวอร์ชันตามวันจำหน่ายแล้ว (BR-02)**

รหัสที่ engine ปล่อยได้ทุกตัวมี `fix_guidance_th` (to-do หน้างาน) ติดกลับใน `issues[].guidance`
เช็คที่พึ่งแคตตาล็อก (C203, ENG-PROC-001) ลดตัวเป็น INFO อัตโนมัติถ้าตาราง ICD ยังว่าง

**ชั้นเสนอแนะ (`claim-suggester.js`)** — แยก `suggestions[]` ไม่กระทบ PASS/FAIL · แสดง RW delta อย่างเดียว (ไม่แสดงบาท ตราบที่ DRG ยัง verified=0) · ข้อเสนอเพิ่ม RW กำกับ "ต้องมีเอกสารรองรับ" เสมอ:

- `SUG-DRG-001` กลุ่มที่จัดได้จาก Pdx ≠ DRG ที่บันทึก (port RUL-IPD-023)
- `SUG-DRG-002` Pdx+Sdx เข้ากลุ่ม RW สูงกว่าได้ + rw_delta (port RUL-IPD-025 — เตือน downcoding)
- `SUG-CMP-001` นอน ≥3 วันแต่ไม่มี Sdx เลย → ชวนทบทวนโรคร่วมที่แพทย์บันทึกแต่ยังไม่ลงรหัส
- `SUG-CMP-002` กองทุน IP มีแต่ยอดสรุป ไม่มีราย item (แฟ้ม 7 CHAD → C304)
- `SUG-CMP-003` มีวินิจฉัยแต่ยังไม่จัดกลุ่ม DRG
- `SUG-CMP-004` กลุ่มหัตถการแต่ไม่มีรหัส ICD-9-CM

ตัวอย่างเรียกตรง ๆ:

```bash
curl -X POST http://localhost:3200/api/reference/validate \
  -H "Content-Type: application/json" \
  -d '{"fund_key":"IP","admission":{"admit_date":"2569-08-01","discharge_date":"2569-08-05","los":5},
       "diagnosis":{"pdx":"I50.0","sdx":["I21.9"]},"drg":{"code":"05450"}}'
# → issues [] + suggestions [SUG-DRG-002 rw_delta +1.6668 "ตรวจสอบว่ามีเอกสารรองรับ..."]
```

---

## 2. ทำเสร็จแล้ว (ตาม commit)

### เฟสก่อนหน้า
- `b6b65c2` โครงโปรเจกต์: Express + MySQL starter (auth/roles/audit/registry) + หน้าต้นแบบ 21+ จอ (mock)
- `c3df42d` แบรนด์ MediClearing + โมดูลผู้ป่วยใน/ผู้บริหาร/ศูนย์รวมสไลด์
- `45d9485` deploy ขึ้น Render + ต่อ Render MCP

### 11 ส.ค. 2569 — ฐานข้อมูลอ้างอิงจริง + rule engine
- `25b99eb` **ฐานข้อมูลอ้างอิงมาตรฐาน** — ตาราง `ref_*` 10 ตาราง (`src/database/reference.sql`) ทุกตารางมี provenance (`source_doc/source_ref/source_date/verified`) · CSV + loader (`seed-reference.js` upsert idempotent, `load-tmt.js` batch) · API สาธารณะ `/api/reference/*` + กฎ gateway/policy/check-policy ครบ
- `6d5cb04` **ต่อหน้าจอเข้าข้อมูลจริง** — `public/js/mock/mock-refdata.js` ดึงจาก API แล้ว mutate ค่าคงที่ mock ในที่ + event `refdata:updated` ให้ 5 หน้า re-render (claim-rules / claim-case / claim-reject / nhso-import / ipd-reference) · ไม่มี backend = ใช้ mock เดิมเงียบ ๆ
- `b465f68` **แคตตาล็อกรหัส C ครบ 100%** — 446 รหัส ทวนซ้ำ ≥2 รอบ 440 รหัส · พิสูจน์ว่าช่วง C218–C299, C394–C420 ไม่มีจริง (เลขข้ามเอง) · แก้บล็อก C201–C217 ที่รอบแรกติดเลขผิด (ตัวจริงคือกลุ่มรหัสวินิจฉัย/DRG grouping)
- `de8df80` **rule engine ตัวแรก** — `POST /api/reference/validate` ตรวจ 6 ชั้น + กล่อง Pre-validate ในหน้า nhso-import

### 11 ส.ค. 2569 (รอบสอง) — IPD coding check & suggest ครบวงจร
- `fb04cde` ก้อนเดียวทั้งฟีเจอร์ — รายละเอียดตามหัวข้อย่อย:
- **แคตตาล็อก ICD** — ตาราง `ref_icd10`/`ref_icd9` + CSV ตัวอย่าง (83+28 รหัส ครอบคลุมเคสเดโมทั้งหมด, verified=0) + `load-icd.js` (batch loader ไฟล์เต็ม, `npm run load:icd`) + API `GET /api/reference/icd10|icd9` (ค้นได้ทั้งรูปมีจุด/ไร้จุดผ่าน `code_key`)
- **validator 6→8 ชั้น** — รับ `sdx[]`, `procedures[]`, `charges.items[]`, `leave_days` (back-compat 100% — payload เดิมได้ผลเดิมเป๊ะ) · เช็คใหม่: C203, C312, ENG-DX-DUP, ENG-PROC-001/FILE, ENG-CHG-SUM/CAT, ENG-ADM-LOS · แก้บั๊ก BR-02 (เวอร์ชัน DRG ตามวันจำหน่าย) · เติม `fix_guidance_th` 22 รหัส → ติดกลับใน `issues[].guidance`
- **ชั้นเสนอแนะ** — `claim-suggester.js` 6 กฎ (regroup mismatch / RW สูงกว่าที่รหัสรองรับ / ความครบถ้วน) — RW delta เท่านั้น ไม่แสดงบาท ไม่ auto-apply มีธง `simulated`
- **ตารางผู้ป่วยในจริง** — `ipd.sql` 4 ตาราง (lifecycle mixin) + `/api/ipd/admissions` CRUD + PUT `/coding` `/charges` (replace-set) + `POST /:id/validate` (เซิร์ฟเวอร์ประกอบ payload จาก DB, fund_key='IP' เสมอ) + `npm run seed:ipd` 7 เคสเดโม · check:policy 36 routes ครบ
- **UI** — สะพาน `mock-ipddata.js` (merge เข้า mock ด้วย AN, เขียนกลับเมื่อล็อกอิน, ล้มเงียบเมื่อ static) · **ipd-admit**: แท็บ coding/cost แก้ไขได้จริง (autocomplete จากแคตตาล็อก, บันทึกลง DB) · **ipd-audit**: ปุ่ม "ตรวจกับ rule engine จริง" + drawer แสดง issues+guidance+suggestions (ปิดสำหรับเคส PVT) · **nhso-import**: แสดง guidance + บล็อกข้อเสนอแนะ, PRE_SAMPLE ใหม่โชว์ 14 ประเด็น 8 ชั้น

### 11 ส.ค. 2569 (รอบสาม) — ตัวนำเข้า 16 แฟ้มจริง (FR-01 ส่วนผู้ป่วยใน)
- `9efb074` ทั้งฟีเจอร์ — รายละเอียด:
- **parser** `src/services/nhso-16files.js` — อ่านแฟ้ม IPD (บังคับ) + PAT/INS/IDX/IOP/CHA · คั่น |/,/tab ก็ได้ · วันที่ พ.ศ./ค.ศ. · DXTYPE 1=Pdx อื่น=Sdx · CHRGITEM 19 หมวดพร้อมชื่อไทย · INSCL→สิทธิ (UCS→UC ฯลฯ)
- **`POST /api/ipd/import`** (STAFF) — upsert ด้วย AN (นำเข้าซ้ำ = อัปเดต ไม่สร้างซ้ำ) + `dry_run` ดูผลก่อนเขียนจริง + **ทุกเคสถูกส่งเข้า validate engine + suggester ทันที** ผลตรวจติดไปเป็นรายเคส · refactor: `buildClaimFromAdmission`/`validateAdmission` ใช้ร่วมกับ route validate เดิม
- **C312 ฉลาดขึ้น** — จับ "ค่าห้อง" จากชื่อรายการด้วย (BILLGRCS ใช้ 02 แต่ CHRGITEM 16 แฟ้มใช้ 01)
- **UI nhso-import → แท็บอัปโหลด** — กล่อง "นำเข้า 16 แฟ้มจริง": เลือกไฟล์ 6 ช่อง (FileReader ไม่ต้องพึ่ง multipart — โปรเจค freeze dependencies) + ปุ่ม dry run/นำเข้าจริง/ไฟล์ตัวอย่าง 2 เคส + ผลรายเคสพร้อมลิงก์เปิดในจอตรวจแฟ้ม
- ทดสอบผ่าน: ไม่ล็อกอิน→401 · dry run ไม่เขียน DB · เคสตัวอย่างจับ C203/C312/C301 + SUG-DRG-001/002 · นำเข้าซ้ำ = updated 2 created 0 · INS map สิทธิถูก (UCS→UC)

### 11 ส.ค. 2569 (รอบสี่) — ยกคลังกฎ + เกณฑ์ MRA เป็นข้อมูลจริงที่ execute ได้
- `3d6702d` **DDL 22 ตาราง** — reference +10 (`ref_doc_sources` สถานะเอกสาร, `ref_payers`/`payer_rules`/`payer_docs`/`fund_rates`, `ref_drg_outlier`+`coeff`, `ref_mra_*`) · ipd +3 (`ipd_audits`/`chart_audit_items`/`fund_checks`) · `rules.sql` ใหม่ 9 ตาราง
- `1783279` **ข้อมูลจริง** — ดึงกฎ 31 ข้อจาก mock ผ่าน sandbox (36 ฉบับ · 59 เงื่อนไข · 6 แม่แบบ) + เอกสาร 31 ฉบับ + สิทธิ 6 + MRA 12 องค์ประกอบ · `seed-rules.js` (replace-set ตารางลูก)
- `4dfa167` **Service** — `rule-runner.js` (ทะเบียน checker 12 ตัว), `drg-adjrw.js` (สูตรจริง), `mra-audit.js` (N/A ตัดออกจากตัวหาร)
- `69a3399` **API** — `/api/rules` (list/versions/conditions/templates/coverage/run) + `/api/reference/mra|payers|fund-rates` + `scripts/check-rules.js`
- `fbb582b` **หน้าคลังกฎ** — `mock-ruledata.js` + แถบ "ตรวจอัตโนมัติได้จริง 10/21 (48%)" + ป้ายรายกฎ
- `7cb250b` **ผลตรวจ MRA รายเคส** — `GET/PUT /api/ipd/admissions/:id/audit` + ป้อนเข้า rule engine
- แผง MRA ในหน้า ipd-audit ผ่าน `mock-mradata.js` (แสดงคู่กับเช็กลิสต์เดิม ไม่ทำให้จอสาธิตว่าง)

**หลักคิดที่ยึดตลอดรอบนี้ — กฎต้องไม่โกหก:**
- เงื่อนไข 59 ข้อเก็บเป็น "เอกสารให้คนอ่าน" · ตัวที่ execute จริงคือ `check_key` + `params_json` ที่ชี้ฟังก์ชันในโค้ด (ไม่ฝืนแปลงข้อความไทยเป็น AST)
- กฎที่ไม่มีตัวตรวจ → `NOT_IMPLEMENTED` · รอเอกสาร → `BLOCKED_BY_DOC` · ข้อมูลขาด → `SKIPPED` พร้อมเหตุผล — **ไม่มีทางคืน PASS โดยไม่ได้ตรวจ**
- AdjRW คืน `null` + เหตุผล เมื่อขาด RW0d/OF/b12/b23 แทนที่จะเดา (ตัวเลขนี้แปลงเป็นเงินได้)
- `payer` (สิทธิผู้ป่วย) แยกแกนจาก `fund_key` (กองทุน สปสช.) ชัดเจน — `mock-rules.funds[]` คือ payer

**พิสูจน์ว่าใช้ข้อมูลจริง:** บันทึกผลตรวจ MRA + เอกสารสิทธิของ AN 691209 แล้ว `RUL-IPD-019` และ `RUL-IPD-021` เปลี่ยนจาก SKIPPED เป็น HIT (ตรวจจริง 7→8 กฎ)

### ผลการทดสอบที่ผ่านแล้ว
- `npm run migrate` / `npm run seed:reference` / `npm run seed:rules` รันซ้ำได้ (idempotent) — row counts นิ่ง
- `npm run check:policy` 48 routes ครบ · `npm run check:rules` คลังกฎกับ registry ตรงกัน (10/21, 48%)
- Headless (Edge) ทั้ง 2 โหมด: มี backend → claim-rules เห็นกฎจาก DB + แถบ coverage · static → mock 31 กฎ แถบซ่อน ไม่มีแบนเนอร์ error · ipd-audit แท็บเดิมไม่พัง
- `npm run check:policy` — 25 routes มีกฎครบ, 9 เส้น reference เป็น PUBLIC
- Headless browser (Edge): hydration ทำงานเมื่อมี backend · โหมด static ไม่มีป้าย error · แก้แถวใน DB แล้วหน้าเว็บเปลี่ยนตาม (พิสูจน์อ่าน DB จริง)
- Validate engine: เคสผิด 9 จุดจับครบ · เคสถูกได้ PASS · กองทุนผิดได้ 400

### เอกสาร
- **รายงานวิเคราะห์** (มาตรฐานกฎ 6 ชั้น · แหล่งฐานข้อมูล · คู่แข่ง BMS i-Claim / HA.OS / MEDcury + SWOT): https://claude.ai/code/artifact/cb207927-6e5b-4e95-98fc-d216263f4bd7
- ที่มาข้อมูลอ้างอิงรายไฟล์: `data/reference/README.md`

---

## 3. วิธีรัน / ตรวจสอบ

```bash
npm run migrate          # สร้าง/อัปเดตตาราง (schema.sql + reference.sql + ipd.sql)
npm run seed:reference   # โหลดข้อมูลอ้างอิงจาก data/reference/*.csv (รวม ICD/MRA/สิทธิ)
npm run seed:rules       # โหลดคลังกฎ 31 ข้อ + เงื่อนไข + แม่แบบ + KPI
npm run seed:tmt         # โหลดตัวอย่าง TMT (ไฟล์จริงดู data/reference/README.md)
npm run seed:ipd         # เติมเคสผู้ป่วยในเดโม 7 เคส (idempotent — มีแล้วข้าม)
npm run load:icd         # โหลดแคตตาล็อก ICD ฉบับเต็ม (--system icd10|icd9 --file ...)
npm run dev              # เปิดเซิร์ฟเวอร์ → http://localhost:3200
npm run check:policy     # ตรวจว่าทุก route มีกฎสิทธิ์ (ปัจจุบัน 48 routes / 6 mounts)
npm run check:rules      # ตรวจว่าคลังกฎกับตัวตรวจในโค้ดตรงกัน + พิมพ์ coverage
```

จุดดูสถานะข้อมูล: `GET /api/reference/meta` — จำนวนแถว · % ที่ทวนแล้ว · ประวัติการโหลด

---

## 4. งานถัดไป (เรียงตามผลตอบแทน)

| # | งาน | หมายเหตุ |
|---|---|---|
| 1 | โหลด **แคตตาล็อกจริงให้ครบ**: ICD-10-TM + ICD-9-CM ฉบับเต็ม (`load:icd` พร้อมแล้ว) · Master TMT (this.or.th) · **ตาราง Thai DRG จริง** (สกส. chi.or.th) | ตอนนี้ ICD เป็นชุดคัดย่อ / DRG เป็นค่าจำลอง `verified=0` ห้ามใช้คิดเงิน — suggestion ติดธง "ค่าจำลอง" อยู่แล้ว |
| 2 | ~~ตัว import 16 แฟ้มจริง (FR-01)~~ ✅ ส่วนผู้ป่วยใน (IPD/PAT/INS/IDX/IOP/CHA) ทำแล้ว — เหลือฝั่ง **OPD** (OPD/ORF/ODX/OOP/OCH) + แฟ้ม AER/ADP | นำเข้า → upsert `ipd_admissions` → validate ทันที · UI ในหน้า nhso-import แท็บอัปโหลด |
| 3 | ~~เติม fix guidance รายรหัส~~ ✅ ทำแล้ว 22 รหัสที่ engine ปล่อยได้ — เหลือเติมทีละหมวดเมื่อ implement กฎเพิ่ม | ข้อความระบบเขียนเอง (ไม่ใช่จากเอกสารทางการ — ดูหมายเหตุใน data/reference/README.md) |
| 4 | ~~ยกกฎ 31 ข้อลง DB + execute ได้~~ ✅ ทำแล้ว (รอบสี่) — เหลือ **เขียน checker เพิ่มให้ 11 กฎที่ยัง NOT_IMPLEMENTED** (RUL-CDX-009 dx↔หัตถการ, RUL-REF-001/002/003 ส่งต่อ, RUL-FIL-002 ฟิลด์บังคับรายแฟ้ม ฯลฯ) | เพิ่มฟังก์ชันใน `CHECKERS` ของ `rule-runner.js` แล้วผูก `check_key` ใน `rule-versions.csv` · `npm run check:rules` จะจับถ้าไม่ตรงกัน |
| 4b | **ถอดเกณฑ์ย่อย MRA จากคู่มือทางการให้ครบ 12 องค์ประกอบ** (ตอนนี้มีครบเฉพาะ MR1 9 ข้อ และเป็นแหล่งทุติยภูมิ verified=0) | ไฟล์ `data/reference/mra-criteria.csv` · แหล่ง: คู่มือ MRA 2563 IPD (รามาฯ/มช./phisweb) — WebFetch อ่าน PDF ไม่ออก ต้องถอดด้วยมือแบบเดียวกับรหัสติด C |
| 4c | ย้ายผลตรวจ 7 เคสเดโมจากเช็กลิสต์เดิม 24 ข้อ ไปเกณฑ์ MRA แล้วเลิกใช้ `IPD_CHART_SECTIONS` | ตอนนี้แสดงคู่กันเพื่อไม่ให้จอสาธิตว่าง — ดู `mock-mradata.js` หัวไฟล์ |
| 4d | เติมค่า **RW0d / OF / b12 / b23** จากคู่มือ Thai DRG แล้ว AdjRW จะคำนวณได้จริง | โครงตาราง+สูตร+loader พร้อมแล้ว (`ref_drg_outlier`, `ref_drg_outlier_coeff`, `drg-adjrw.js`) — ตอนนี้คืน null พร้อมเหตุผลเมื่อค่าไม่ครบ |
| 5 | รอแคตตาล็อก error ทางการของ NHSO Digital Platform (Go-Live 16 ก.ย. 2569) แล้วแทนที่ 6 รหัส `system=NHSO_DP` | ตอนนี้ติดธง "รอยืนยัน" ถูกต้องแล้ว |
| 6 | เช็ค dx เชิงลึกเมื่อได้แคตตาล็อกเต็ม: dx↔เพศ (C204 — คอลัมน์ `sex_limit` รอแล้ว) · dx↔อายุ (C205) · คู่รหัส HTN+CHF/ไตวาย (C215/C216) · dx↔หัตถการ (C212/C214/C217) | โครง input รองรับหมดแล้ว เหลือ logic + ข้อมูล |
| 7 | เก็บ daily note / chart audit / ผลตรวจแฟ้ม ลง DB (ตอนนี้ยังอยู่ใน mock) | จอ ipd-worklist / ipd-admit / ipd-audit merge ข้อมูล admission จริงผ่านสะพาน `mock-ipddata.js` แล้ว |

## 5. ประเด็นค้าง / ความเสี่ยง

- ⚠️ **`.mcp.json` มี Render API key จริงใน working copy** — ไฟล์ถูก track ใน repo สาธารณะ (เวอร์ชันที่ commit แล้วยังสะอาด) **ห้าม commit ไฟล์นี้ทั้งที่มี key** — แนะนำเปลี่ยนเป็น `"${RENDER_API_KEY}"` แล้วตั้ง env variable หรือ rotate key ถ้าสงสัยว่าหลุด
- DB อยู่บน host แชร์ (141.98.17.115) — โหลดข้อมูลก้อนใหญ่ให้รันจากเครื่อง dev เป็น batch เท่านั้น
- seed เป็น upsert ไม่ลบแถวเก่า — ถ้าถอดรหัสออกจาก CSV ต้องลบใน DB เอง (เคย prune C200 ไปหนึ่งครั้ง)
