# data/reference — ข้อมูลอ้างอิงมาตรฐานการเบิกจ่าย

ไฟล์ CSV ในโฟลเดอร์นี้คือ "ข้อมูลตั้งต้น" ของตาราง `ref_*` (ดู `src/database/reference.sql`)
โหลดด้วย `npm run seed:reference` (ทุกไฟล์ยกเว้น TMT) และ `npm run seed:tmt` (TMT)

ทุกแถวมีคอลัมน์ `verified`:
- `1` = ทวนกับแหล่งทางการแล้ว (แหล่ง + ตำแหน่งอยู่ใน `source_doc`/`source_ref`)
- `0` = ค่าจำลอง/รอทวน — UI จะขึ้นป้าย "รอยืนยัน"

## ที่มาของแต่ละไฟล์

| ไฟล์ | เนื้อหา | ที่มา | สถานะ |
|---|---|---|---|
| `error-codes.csv` | รหัสติด C ระบบ e-Claim 440 รหัส + รหัสตอบกลับ NHSO DP 6 รหัส (P124, L205, C305, P061, P208, C112) | รวบรวมจาก [รายละเอียดการผิดพลาดของข้อมูล (รหัสติด C) — UC@KKPHO](https://www.uckkpho.com/uc/1313/) ต้นทางคือระบบ e-Claim สปสช. (eclaim.nhso.go.th) · เก็บข้อมูล 11 ส.ค. 2569 ทวนซ้ำทุกช่วง ≥2 รอบ | ครอบคลุมแคตตาล็อกทั้งหมด: C101–C217, C300–C393, C421–C652 (verified=1) — **ช่วง C218–C299, C394–C420 ไม่มีอยู่จริง เลขแคตตาล็อกข้ามเอง** · แถว NHSO_DP มาจาก OCR ภาพสไลด์ (verified=0) รอ สปสช. เผยแพร่แคตตาล็อกทางการ |
| `claim-files.csv` | โครงสร้าง 15 แฟ้ม NHSO Digital Platform (จำนวนฟิลด์ req/cond/opt รวม 160 data points, แฟ้มเงื่อนไข) | doc/2. NHSO.Digital.Platform.Overview.23.06.2569.pdf น.9–13 | ทวนแล้ว (verified=1) · คอลัมน์ `mapping_status` เป็นสถานะฝั่ง รพ. ไม่ใช่ข้อมูลทางการ |
| `funds.csv` + `fund-file-matrix.csv` | 12 กองทุน × แฟ้มที่ต้องส่ง (กฎ RUL-FIL-001) | เอกสารเดียวกัน น.14–16 | ทวนแล้ว (verified=1) |
| `drg-versions.csv` `mdc.csv` `drg.csv` | Thai DRG: RW / ALOS / trim points | **ค่าจำลองจากต้นแบบ** — ของจริงต้องใช้คู่มือ Thai DRG + ตารางอัตราจาก สกส. ([chi.or.th](https://www.chi.or.th)) | verified=0 ทั้งหมด — ห้ามใช้คิดเงินจริง |
| `tmt-sample.csv` | ตัวอย่างโครงไฟล์รหัสยา TMT 5 แถว | **ไม่ใช่รหัส TMT จริง** — ใช้ทดสอบ pipeline เท่านั้น | ของจริงดาวน์โหลด Master TMT จาก สมสท. ([this.or.th](https://this.or.th/)) ดูขั้นตอนด้านล่าง |
| `icd10-sample.csv` | รหัสวินิจฉัย ICD-10 ชุดคัดย่อ ~85 รหัส (ครอบคลุมรหัสที่ใช้ในเคสเดโม + `drg.csv`) | โครงตาม ICD-10-TM (สนย. สธ.) — **ชุดคัดย่อเพื่อเดโม ไม่ใช่แคตตาล็อกเต็ม** | verified=0 · แคตตาล็อกเต็มโหลดด้วย `load-icd.js` ดูขั้นตอนด้านล่าง |
| `icd9-sample.csv` | รหัสหัตถการ ICD-9-CM ชุดคัดย่อ ~28 รหัส + ธง `operative` (หัตถการห้องผ่าตัด) | โครงตาม ICD-9-CM ฉบับที่ใช้จัดกลุ่ม Thai DRG — **ชุดคัดย่อเพื่อเดโม** | verified=0 · แคตตาล็อกเต็มโหลดด้วย `load-icd.js` |

## วิธีโหลด Master TMT ฉบับจริง

1. ดาวน์โหลด `MasterTTMT_YYYYMMDD.zip` จาก this.or.th (หน้า "TTMT สำหรับ Drug Catalogue สปสช.")
   หรือชุดเผยแพร่บน [data.go.th](https://data.go.th/dataset/thai-medicines-terminology-tmt)
2. แตก zip แล้วเปิดไฟล์ concept (มักเป็น .xls) → Save As CSV (UTF-8)
   ให้หัวคอลัมน์ตรงกับ `tmt-sample.csv`: `tmt_id,level,fsn,manufacturer,strength,dosage_form,unit_of_use,ref_price,price_source,change_flag`
   (คอลัมน์ราคาเว้นว่างได้ — ราคากลางเป็นคนละไฟล์)
3. วางไว้ที่ `data/reference/tmt/` (โฟลเดอร์นี้อยู่ใน .gitignore — ไฟล์ release เต็มไม่ commit ลง repo สาธารณะ)
4. รัน:
   ```
   node src/database/load-tmt.js --file data/reference/tmt/TMTRF20250701.csv --release TMTRF20250701 --date 2025-07-01
   ```

## วิธีโหลดแคตตาล็อก ICD-10-TM / ICD-9-CM ฉบับเต็ม

1. แหล่งทางการ: ICD-10-TM จากกองยุทธศาสตร์และแผนงาน (สนย.) สธ. — หนังสือ/ไฟล์เผยแพร่ที่
   [สำนักนโยบายและยุทธศาสตร์](https://spd.moph.go.th/) หรือชุดข้อมูลบน [data.go.th](https://data.go.th/)
   · ICD-9-CM ใช้ฉบับเดียวกับที่คู่มือ Thai DRG (สกส.) อ้างอิง
2. แปลงเป็น CSV (UTF-8) ให้มีหัวคอลัมน์อย่างน้อย `code,term_en` (คอลัมน์เต็มดู `icd10-sample.csv` / `icd9-sample.csv`
   — `term_th`, `sex_limit`, `operative` เว้นว่างได้)
3. วางไว้ที่ `data/reference/icd/` (อยู่ใน .gitignore — ไฟล์เต็มไม่ commit ลง repo สาธารณะ)
4. รันจากเครื่อง dev (DB อยู่ remote — loader batch 500 แถว/คำสั่ง):
   ```
   node src/database/load-icd.js --system icd10 --file data/reference/icd/icd10tm-2024.csv --source "ICD-10-TM 2024 (สนย. สธ.)" --date 2024-01-01
   node src/database/load-icd.js --system icd9  --file data/reference/icd/icd9cm.csv --source "ICD-9-CM (คู่มือ Thai DRG)" --date 2024-01-01
   ```
   แถวที่โหลดจากไฟล์จริงจะติด `verified=1` ทับแถวตัวอย่างที่รหัสซ้ำกันโดยอัตโนมัติ

หมายเหตุ: คอลัมน์ `fix_guidance_th` ใน `error-codes.csv` เป็นข้อความแนวทางแก้ไขที่ระบบเขียนเอง
(ไม่ใช่ข้อความจากเอกสารทางการ) — ธง `verified` ของแถวหมายถึง `description_th` เท่านั้น

## แหล่งมาตรฐานอื่นที่เกี่ยวข้อง (ยังไม่ได้โหลดเข้าระบบ)

- โครงสร้าง 43 แฟ้ม Plus (กสธ.): https://hdata.moph.go.th/site/
- FHIR CodeSystem 43 แฟ้ม (SIL-TH): https://terms.sil-th.org/core/CodeSystem-cs-th-file-list.html
- Drug Catalogue สปสช.: https://drug.nhso.go.th/drugcatalogue/
- SSOP สกส. (ประกันสังคม/กรมบัญชีกลาง): https://cs10.chi.or.th/ssopupload
- FDH กระทรวงสาธารณสุข: https://dhes.moph.go.th/?cat=58
