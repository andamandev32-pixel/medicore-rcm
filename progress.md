# progress.md — บันทึกความคืบหน้า MediClearing

> อัปเดตล่าสุด: **11 ส.ค. 2569** · ไฟล์นี้สรุปว่า "ทำอะไรไปแล้ว · กฎอยู่ตรงไหน · ต่อยังไง"
> อัปเดตไฟล์นี้ทุกครั้งที่จบงานก้อนใหญ่ (พร้อม commit hash)

---

## 1. กฎในระบบมีอะไรบ้าง และดูตรงไหน

ระบบมี "กฎ" 4 กลุ่ม — คนละชั้น คนละที่:

| กลุ่มกฎ | จำนวน | เก็บที่ | ดู/ทดลองได้ที่ | สถานะ |
|---|---|---|---|---|
| **แคตตาล็อกรหัสติด C สปสช.** (เกณฑ์ deny มาตรฐานที่ทุก รพ. เจอ) | 446 รหัส (ทวนแล้ว 440) | ตาราง MySQL `ref_error_codes` · ไฟล์ต้นทาง `data/reference/error-codes.csv` | `GET /api/reference/error-codes?q=ยา` (ค้นได้) · สถานะรวม `GET /api/reference/meta` | ✅ ข้อมูลจริง ครบ 100% ของแหล่ง |
| **กฎที่ execute ได้จริง (rule engine)** — ตรวจเคลมก่อนส่ง 6 ชั้น | ~20 เช็ค | `src/services/claim-validator.js` | `POST /api/reference/validate` · หน้าเว็บ **nhso-import.html → แท็บอัปโหลด → กล่อง "ทดลองตรวจด้วยกฎมาตรฐานจริง"** | ✅ ใช้งานได้ ข้อความ error ดึงจากแคตตาล็อกจริง |
| **กฎเชิงนโยบาย 27 ข้อ** (RUL-DRG-007, RUL-ELG-004, RUL-FIL-001 ฯลฯ พร้อม lifecycle DRAFT→ACTIVE, maker-checker, KPI) | 27 ข้อ | `public/js/mock/mock-rules.js` (ยังเป็น mock ฝั่ง browser) | หน้า **claim-rules.html** (คลังกฎ + no-code builder + backtest) | ⚠️ โครงจอครบ แต่เงื่อนไขยังเป็นข้อความ ไม่ execute |
| **กฎ IPD pre-audit** (25 หัวข้อตรวจเวชระเบียน + DRG/trim/อัตราจ่าย) | 25+ | `public/js/mock/mock-ipd.js` (`_ruleHit`, `IPD_CHART_SECTIONS`) | หน้า **ipd-audit.html**, **ipd-reference.html** | ⚠️ execute ใน browser กับข้อมูล mock |

**เช็คลิสต์ 6 ชั้นที่ engine ตรวจแล้ววันนี้** (`claim-validator.js`):

1. **FILES** — แฟ้มครบตามกองทุน (เมทริกซ์ 12 กองทุน×แฟ้ม จากเอกสาร NHSO DP) → `RUL-FIL-001`
2. **PATIENT** — ชื่อ C101 · วันเกิด C102 · เพศ C103 · เลขบัตร ปชช. + checksum C104/C116 · HN C105 · AN (กรณี IP) C106 · วันรับ/จำหน่าย C107/C120/C121
3. **DX** — ไม่มี Pdx C201 · Pdx เกิน 1 รหัส C202 · Pdx ไม่เหมาะกับผู้ป่วยใน C206
4. **DRUG** — ยาไม่พบใน Drug Catalogue C562 · ราคาไม่ตรงราคาอ้างอิง C195 (= P124 บน platform ใหม่) · ไม่ระบุจำนวน C303
5. **CHARGE** — ค่าใช้จ่ายเป็นศูนย์/ลบ C301
6. **DRG** — จัดกลุ่มไม่ได้ C210 · วันนอนหลุด trim point (คำเตือน AdjRW)

ตัวอย่างเรียกตรง ๆ:

```bash
curl -X POST http://localhost:3200/api/reference/validate \
  -H "Content-Type: application/json" \
  -d '{"fund_key":"OP","files_present":[1,2,3,4,5,6,7,8]}'
# → {"summary":{"result":"PASS",...}}
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

### ผลการทดสอบที่ผ่านแล้ว
- `npm run migrate` / `npm run seed:reference` รันซ้ำได้ (idempotent) — row counts นิ่ง
- `npm run check:policy` — 25 routes มีกฎครบ, 9 เส้น reference เป็น PUBLIC
- Headless browser (Edge): hydration ทำงานเมื่อมี backend · โหมด static ไม่มีป้าย error · แก้แถวใน DB แล้วหน้าเว็บเปลี่ยนตาม (พิสูจน์อ่าน DB จริง)
- Validate engine: เคสผิด 9 จุดจับครบ · เคสถูกได้ PASS · กองทุนผิดได้ 400

### เอกสาร
- **รายงานวิเคราะห์** (มาตรฐานกฎ 6 ชั้น · แหล่งฐานข้อมูล · คู่แข่ง BMS i-Claim / HA.OS / MEDcury + SWOT): https://claude.ai/code/artifact/cb207927-6e5b-4e95-98fc-d216263f4bd7
- ที่มาข้อมูลอ้างอิงรายไฟล์: `data/reference/README.md`

---

## 3. วิธีรัน / ตรวจสอบ

```bash
npm run migrate          # สร้าง/อัปเดตตาราง (schema.sql + reference.sql)
npm run seed:reference   # โหลดข้อมูลอ้างอิงจาก data/reference/*.csv
npm run seed:tmt         # โหลดตัวอย่าง TMT (ไฟล์จริงดู data/reference/README.md)
npm run dev              # เปิดเซิร์ฟเวอร์ → http://localhost:3200
npm run check:policy     # ตรวจว่าทุก route มีกฎสิทธิ์
```

จุดดูสถานะข้อมูล: `GET /api/reference/meta` — จำนวนแถว · % ที่ทวนแล้ว · ประวัติการโหลด

---

## 4. งานถัดไป (เรียงตามผลตอบแทน)

| # | งาน | หมายเหตุ |
|---|---|---|
| 1 | โหลด **Master TMT ฉบับจริง** (สมสท. this.or.th) + **ตาราง Thai DRG จริง** (สกส. chi.or.th) | pipeline พร้อมแล้ว — ตอนนี้ DRG เป็นค่าจำลอง `verified=0` ห้ามใช้คิดเงิน |
| 2 | **ตัว import 16 แฟ้ม/CSV จริง** (FR-01) แล้วต่อท่อเข้า validate engine | ปิดจุดอ่อน "ไม่มีข้อมูลต้นทาง" — demo end-to-end กับ รพ. นำร่อง |
| 3 | เติม **fix guidance รายรหัส** (คอลัมน์ `fix_guidance_th` รองรับแล้ว ยังว่าง) | เปลี่ยน error เป็น to-do ที่หน้างานทำตามได้ |
| 4 | ยกกฎ 27 ข้อใน `mock-rules.js` ให้เก็บใน DB + เงื่อนไขเป็น AST ที่ engine execute ได้ | ปิดช่องว่าง "คลังกฎสวยแต่ไม่ตัดสิน" |
| 5 | รอแคตตาล็อก error ทางการของ NHSO Digital Platform (Go-Live 16 ก.ย. 2569) แล้วแทนที่ 6 รหัส `system=NHSO_DP` | ตอนนี้ติดธง "รอยืนยัน" ถูกต้องแล้ว |

## 5. ประเด็นค้าง / ความเสี่ยง

- ⚠️ **`.mcp.json` มี Render API key จริงใน working copy** — ไฟล์ถูก track ใน repo สาธารณะ (เวอร์ชันที่ commit แล้วยังสะอาด) **ห้าม commit ไฟล์นี้ทั้งที่มี key** — แนะนำเปลี่ยนเป็น `"${RENDER_API_KEY}"` แล้วตั้ง env variable หรือ rotate key ถ้าสงสัยว่าหลุด
- DB อยู่บน host แชร์ (141.98.17.115) — โหลดข้อมูลก้อนใหญ่ให้รันจากเครื่อง dev เป็น batch เท่านั้น
- seed เป็น upsert ไม่ลบแถวเก่า — ถ้าถอดรหัสออกจาก CSV ต้องลบใน DB เอง (เคย prune C200 ไปหนึ่งครั้ง)
