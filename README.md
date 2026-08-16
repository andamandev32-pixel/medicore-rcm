# MediClear — ระบบบริหารวงจรรายได้โรงพยาบาล (RCM)

โครงโปรเจค **Express + MySQL + Design System** สำหรับสร้างโมดูลใหม่ให้หน้าตาและสถาปัตยกรรมเหมือน
ระบบเดิม (`medicore_ipd`) โดยไม่ต้องลากโค้ดคลินิก IPD มาด้วย

สิ่งที่ให้มา: ระบบล็อกอิน/สิทธิ์ที่ใช้งานได้จริง + ชุดหน้าตามาตรฐาน + **โมดูลตัวอย่างที่รันได้ครบวงจร**
(CRUD → สิทธิ์ตามบทบาท → audit log → soft delete → optimistic lock) ให้คัดลอกไปเป็นโมดูลจริง

---

## เริ่มใช้งาน

```bash
cp .env.example .env      # แก้ DB_PASSWORD, DB_NAME, JWT_SECRET
npm install
npm run migrate           # สร้าง database + 7 ตาราง (สร้าง DB ให้เองถ้ายังไม่มี)
npm run seed              # roles + users + หน่วยงาน + ข้อมูลสาธิต 12 รายการ
npm run dev               # http://localhost:3000
```

**บัญชีสาธิต**

| username | password | บทบาท | ใช้ทดสอบอะไร |
|---|---|---|---|
| `admin` | `10210` | ADMIN | เห็นเมนูตั้งค่า จัดการผู้ใช้/หน่วยงาน |
| `doctor01` | `doctor1234` | DOCTOR | กด "ยืนยัน" รายการได้ |
| `nurse01` | `nurse1234` | NURSE | เพิ่ม/แก้/ลบได้ แต่ยืนยันไม่ได้ (403) |
| `pharmacist01` | `pharma1234` | PHARMACIST | เหมือนพยาบาล |
| `superuser` | `super1234` | 4 บทบาท | ทดสอบ `/auth/switch-role` ว่าสลับแล้ว **ลดสิทธิ์จริง** |

---

## ต้นแบบ Claim Intelligence + สไลด์นำเสนอ (ใหม่)

ชุดหน้าจอสำหรับนำเสนอผู้บริหาร — **ข้อมูลจำลองล้วน ไม่เรียก `/api` และไม่ต้องล็อกอิน**
เปิดได้ทันทีหลัง `npm run dev` โดยไม่ต้อง migrate/seed

| ไฟล์ | เนื้อหา | ที่มา |
|---|---|---|
| `public/present-hub.html` | **ศูนย์รวมสไลด์** — เลือกชุดที่จะนำเสนอ · การ์ดทุกใบ generate จาก `DS_DECKS` | — |
| `public/present-modules.html` | **สไลด์สรุปงานรายส่วน** — 5 ส่วนงาน ส่วนละ 3 หน้า (ฟีเจอร์+เมนู · ผังขั้นตอน · สิ่งที่ได้+pain point ที่ปิด) + ผังแผนที่ระบบ + ตารางสรุป pain point ทั้งหมด | ต้นแบบทั้ง 21 หน้าจอ |
| `public/present.html` | **สไลด์นำเสนอฉบับเต็ม** — ปัญหา · บริบท สปสช. · สถาปัตยกรรม · **ควบคุมการส่งต่อ** · **ติดตามผู้ป่วยใน** · แผน 4 ระยะ · ตัวชี้วัด | SRS + NHSO V4 + NHSO Overview |
| `public/present-exec.html` | **สไลด์นำเสนอฉบับย่อ** — แกน "ของเดิม/ของใหม่/ที่ปรับปรุงขึ้น" · ผังเป็นอินโฟกราฟิก SVG · แผนพัฒนา 6 เดือน | ย่อจากฉบับเต็ม |
| `public/present-report-1.html` | **รายงานวิเคราะห์ เล่ม 1** (ยกมาทั้งเล่ม ไม่สรุป) — กฎกรองเคลม 6 ชั้น · เทียบมาตรฐานสากล · ฐานข้อมูลอ้างอิงและสถานะจริง · คู่แข่ง 4 ราย · SWOT | รายงาน 11 ส.ค. 2569 (ฉบับออนไลน์) |
| `public/present-report-2.html` | **รายงานวิเคราะห์ เล่ม 2** — แผนที่ตลาด 5 กลุ่ม · โปรไฟล์ Sati + แยกคำโฆษณาจากข้อเท็จจริง · ความเสี่ยงเรียกเงินคืน · battle card · 8 สิ่งที่ควรทำต่อ | `doc/market-nonhis-claim-audit.html` |
| `public/present-report-3.html` | **รายงานวิเคราะห์ เล่ม 3** — เดินเคส AN 691209 เข้า rule engine จริงสองรอบ + บันไดชั้นงาน 7 ชั้น | `doc/case-walkthrough-vs-sati.html` |

> **หน้าแรกของสามชุดแรกเป็นอินโฟกราฟิกตัวเดียวกัน** — `prfCoverage()` ใน `present-flows.js`
> บอกขอบเขตทั้งระบบในภาพเดียว (4 เส้นงาน · เส้นที่มี ★ คือส่วนที่เพิ่มใหม่)
> แก้ที่ฟังก์ชันเดียวแล้วเปลี่ยนครบทั้งสามชุด
> · ชุด `present-report-1/2/3.html` **ไม่ร่วมด้วยโดยตั้งใจ** — เป็นการยกรายงานมาทั้งเล่ม
> ไม่ใช่การนำเสนอข้อเสนอ จึงไม่โหลด `present-flows*.js` เลย
>
> ⚠️ **จำนวนหน้าของแต่ละชุดอยู่ที่ `DS_DECKS` ที่เดียว** — ไม่เขียนซ้ำใน README, `<title>`,
> หัวไฟล์ หรือปุ่มใน deck อื่น เพราะเคยเพี้ยนมาแล้วทุกที่ที่เขียนซ้ำ
| `public/refer-worklist.html` | ทะเบียนการส่งต่อผู้ป่วย — สองทิศทาง · เลขอนุมัติ · วันหมดอายุ · ธงความเสี่ยง | SRS §7 (Referral/Pre-auth) |
| `public/refer-case.html` | รายละเอียดการส่งต่อ 6 แท็บ + ออกเอกสาร 3 ใบ (ใบส่งตัว · ใบแจ้งหนี้ · ใบตอบกลับ) | SRS §7 · BR-03/04 |
| `public/refer-billing.html` | ตามจ่าย / เรียกเก็บ (AP–AR) · ตรวจใบเรียกเก็บรายบรรทัด · อายุหนี้ 4 ช่วง | ระเบียบส่งต่อ–ตามจ่าย |
| `public/refer-dashboard.html` | ภาพรวมการส่งต่อ — ส่งไปที่ไหน · จำนวนเงิน · รายการโรค | SRS §10 |
| `public/ipd-worklist.html` | ทะเบียนผู้ป่วยใน — ทุก AN · วันนอนเทียบจุดตัด DRG · ค่าใช้จ่ายจริง vs ประมาณการรับ · ความครบของแฟ้ม | 6 กองทุน · Thai DRG (ค่าจำลอง) |
| `public/ipd-admit.html` | ติดตามระหว่างนอน — ไทม์ไลน์รายวัน · เอกสารที่ยังขาด · คะแนนความพร้อม /100 · จำหน่าย | — |
| `public/ipd-audit.html` | ตรวจแฟ้มผู้ป่วยใน — 6 ด้านในหน้าเดียว · ตีกลับให้แก้ (สร้าง Task) · ผ่าน → เข้าคิวส่งเบิก | — |
| `public/claim-dashboard.html` | ภาพรวมผู้บริหาร — **KPI 10 ตัว** (กดดูสูตรได้) + กราฟ + จัดเป็น **4 โซนตามเส้นงาน**: เคลม OPD → **ผู้ป่วยใน** → ส่งต่อ → สถานะฝั่ง สปสช. | SRS §10 |
| `public/claim-worklist.html` | คิวเคลมก่อนส่งเบิก + คอลัมน์ "จะติดที่ NHSO" | SRS §10 |
| `public/claim-case.html` | รายละเอียดเคส 6 แท็บ — ผลกฎ · หลักฐาน · Override | SRS §10 · BR-03/04 |
| `public/claim-rules.html` | คลังกฎ / สร้างกฎ · Version · ทดสอบย้อนหลัง · Maker–Checker | SRS §10 · FR-03/04 |
| `public/claim-knowledge.html` | คลังความรู้ RAG — คำตอบพร้อม Citation และการปฏิเสธเมื่อหลักฐานไม่พอ | SRS §10 · FR-05 |
| `public/claim-tasks.html` | งานและการอนุมัติ · SLA · Escalation · Override | SRS §10 · FR-07 |
| `public/claim-reject.html` | วิเคราะห์การตีกลับ · Pareto · สร้างร่างกฎจากสาเหตุ | SRS §10 · FR-08 |
| `public/claim-admin.html` | ผู้ใช้ · เมทริกซ์สิทธิ์ · Mapping · Integration · ค่าระบบ · Audit Trail | SRS §10 · FR-10 |
| `public/nhso-submit.html` | ส่งเบิก NHSO — 2 ถัง (หน่วยบริการ/สปสช.) · ยอดเรียกเก็บคู่ยอดชดเชย · ตัวกรอง+ปุ่มกลุ่มตามหน้าจอจริง · เส้นทาง 7 ขั้น | NHSO V4 + Overview น.7, 22–25 |
| `public/nhso-case.html` | รายละเอียดรายการ 7 แท็บ + UID/Invoice/รายการก่อนหน้า · สถานะปิด Visit · แถบแฟ้มที่ต้องส่งตามกองทุน | NHSO V4 + Overview น.7, 14–16, 25 |
| `public/nhso-import.html` | นำเข้า API/Upload · **15 แฟ้ม 160 Data Points (72/16/72)** · **เมทริกซ์ 12 กองทุน × แฟ้ม** · งานก่อน UAT · แผน 4 ปี | NHSO V4 + Overview น.12–20 |
| `public/nhso-reports.html` | Transaction / Statement / OFC / **OP Refer** / พึงรับ-พึงจ่าย · คอลัมน์จ่ายเพิ่ม-เรียกคืน · ตัดบัญชีลูกหนี้รายบุคคล | NHSO V4 + Overview น.26–28 |

**ข้อมูลจำลองอยู่ที่ `public/js/mock/`** — `mock-core.js` ต้องโหลดก่อนเสมอ
แกนข้อมูลคือ `mock-claims.js` และ `mock-referrals.js` (ทุกหน้าฉายจากอาร์เรย์เดียวกัน ตัวเลขจึงกระทบยอดกันได้)
`mock-nhso.js` ต้องโหลด**ก่อน** `mock-claims.js` เพราะตัวสร้างเคสเรียก `MockNhso.checkFiles()`
`mock-ipd.js` ต้องโหลด**หลัง** `mock-claims.js` เพราะฉายเคส IPD ที่ส่งเบิกแล้วต่อจาก `claims`

### เพิ่มชุดสไลด์ใหม่ (3 ขั้น)

ทะเบียนชุดสไลด์อยู่ที่ **`DS_DECKS` ใน `public/js/ds/ds-navbar.js` ที่เดียว** —
ทั้งเมนู "นำเสนอ" บน navbar และการ์ดบน `present-hub.html` อ่านจากอาร์เรย์เดียวกัน

1. คัดลอก `public/present-modules.html` เป็น shell ใหม่ แล้วสลับชื่อไฟล์สไลด์ที่แท็ก `<script>`
2. เขียนไฟล์สไลด์ — ประกาศ `const PRESENT_SLIDES = [...]` แล้วปิดท้ายด้วย `window.PRESENT_SLIDES = PRESENT_SLIDES`
3. เพิ่ม 1 รายการใน `DS_DECKS` (`href` · `label` · `icon` · `count` · `desc` · `tags`)

> ⚠️ **ห้ามโหลดไฟล์สไลด์สองไฟล์ในหน้าเดียว** — ทุกไฟล์ประกาศตัวแปรชื่อ `PRESENT_SLIDES` เหมือนกัน
> ⚠️ สไลด์ที่มีผัง SVG ต้องโหลด `present-flows.js` **ก่อน** ไฟล์สไลด์เสมอ
> (และ `present-flows-modules.js` ต่อจากนั้น เพราะใช้ `PRF` / `prfBox` / `prfArrow` ร่วมกัน)
> ⚠️ `count` ต้องตรงกับจำนวนสมาชิกจริงในอาร์เรย์ — เดิมตัวเลขนี้กระจายอยู่หลายที่แล้วเพี้ยน
> (`index.html` เคยเขียน 20 ทั้งที่ `present-slides.js` มี 23 และลิงก์ `#page-8` / `#page-17` ก็ชี้ผิดสไลด์)

### เอกสาร สปสช. ที่หน้า NHSO ทั้งหมดอ้างอิง

| เอกสาร | ใช้ทำอะไร |
|---|---|
| `doc/โครงการ NHSO Digital Platform_Commu_03082026_V4.pdf` (3 ส.ค. 2569) | Roadmap 3 ระยะ · Go-Live 16 ก.ย. 2569 · งานก่อน UAT 5 ข้อ · ThaiD + OTP · รายงาน 4 ประเภท · ชื่อสถานะและรหัสข้อผิดพลาด |
| `doc/2. NHSO.Digital.Platform.Overview.23.06.2569.pdf` (23 มิ.ย. 2569) | ตารางจำนวนฟิลด์ 160 Data Points (น.12) · ที่มาโครงสร้าง 16 แฟ้ม/DMIS (น.13) · **เมทริกซ์กองทุน × แฟ้ม (น.14–16)** · กลุ่มบริการชุดที่ 2 CKD/HIV/TB · แผน 4 ปี (น.17–20) · หน้าจอ 2 ถังและคอลัมน์ Statement (น.23–28) |

> ⚠️ **รหัสที่ยังยืนยันไม่ได้** — สถานะย่อยตัวเลข (1000/1100/4103/3101), รหัสข้อผิดพลาด
> (P124/C305/P061/A210…) และรหัสกิจกรรม (F000–F002) ถอดจากภาพสไลด์ที่ดึงข้อความไม่ได้
> จึงติดธง `verified:false` ไว้และขึ้นดอกจัน “รอยืนยัน” บนหน้าจอทุกจุด
> เอกสาร Overview น.8 ระบุว่า สปสช. จะเผยแพร่แคตตาล็อก “Error ที่พบบ่อย” — เมื่อได้มาให้แทนที่ทั้งชุด
> (แก้ที่ `NHSO_ERR_VERIFIED` ใน `mock-claims.js` และ `verified:` ใน `mock-nhso.js`)

**เดโม 60 วินาที (ฝั่งเคลม):** `claim-worklist.html` → เลือก `CLM-2569-0042` (เห็น "คาดว่าจะติด P124")
→ เปิดเคส ดูแท็บ **หลักฐาน** → ไปที่ `nhso-case.html?seq=6900107` เห็น P124 ตัวเดียวกัน
แบบที่ สปสช. ตอบกลับบนเคสคู่แฝดที่วนแก้อยู่ 14 วัน
· สลับบทบาทจากเมนู ⚙ เป็น **Rule Editor** แล้วเปิด `claim-rules.html` — ปุ่ม "เปิดใช้กฎ" จะถูกปิด (BR-05)

**เดโม 3 นาที (ฝั่งส่งต่อผู้ป่วย):**
`refer-dashboard.html` จำ 3 ตัวเลข → คลิก KPI *ใบส่งตัวที่มีปัญหา* ดูสูตร → ไป `refer-worklist.html?risk=ERROR`
→ เปิด `REF-OUT-2569-0007` (ใบส่งตัวหมดอายุ + ปลายทางทำ CAPD นอกขอบเขต + เรียกเก็บเกินวงเงิน)
→ แท็บ **การเงิน** กด *ตรวจใบเรียกเก็บ* ติ๊กออก 2 บรรทัดนอกขอบเขต แล้วโต้แย้ง
→ เปิด `REF-OUT-2569-0033` (รออนุมัติ) → คลิก `TSK-000151` → เมนู ⚙ สลับบทบาทเป็น **Rule Approver**
→ ปุ่ม "อนุมัติ" เปิดใช้ได้ (BR-05 ผ่านเพราะผู้ขอ ≠ ผู้อนุมัติ) → กดอนุมัติ
→ กลับหน้าการส่งต่อ **เลขอนุมัติและใบส่งตัวถูกออกให้อัตโนมัติ** → กด *พิมพ์ใบส่งตัว*
· จุดเชื่อมกับเดโมเดิม: `REF-IN-2569-0051` ธง REF-NOAUTH บอกว่า "จะติด C305" → คลิกไปเห็นข้อความจริงบน `CLM-2569-0007`

> **หน้าเหล่านี้ไม่มี `Auth.requireLogin()` โดยตั้งใจ** (ต่างจากกติกาใน `doc/PAGE-GUIDE.md` §8)
> เพราะไม่ยิง `/api` เลย และ DB อยู่เครื่องระยะไกล — ถ้า gate ไว้ การนำเสนอจะพังทันทีที่เน็ต/DB ไม่พร้อม
> เมื่อผูก backend จริงให้ใส่กลับ แล้วเปลี่ยน `MockDB.*` เป็น `fetch('/api/...')`

---

## หน้าเว็บที่มี

| ไฟล์ | บทบาท | ใช้เป็นแม่แบบของ |
|---|---|---|
| `public/index.html` | หน้าแรก — login + hero + การ์ดโมดูล + ผังลำดับงาน | หน้า landing |
| `public/registry.html` | ทะเบียนรายการ — KPI + ตาราง + drawer CRUD | **หน้า list/CRUD ทุกหน้า** |
| `public/registry-workspace.html` | พื้นที่ทำงาน 3 คอลัมน์ | หน้าทำงานหนัก (รายการ+รายละเอียด+แผงบันทึก) |
| `public/settings-users.html` | ผู้ใช้และสิทธิ์ (ADMIN) | หน้าตั้งค่า |
| `public/registry-nursing.html` | ทำงาน 2 คอลัมน์ + แท็บหลายมุมมอง + **ออกเอกสาร** | หน้าที่ต้องดูเรื่องเดียวหลายมุม |
| `public/portal.html` | home ของบทบาท — hero + KPI + การ์ดงาน + ปฏิทินรายสัปดาห์ | หน้า "งานของฉัน" |
| `public/_template.html` | หน้าเปล่าพร้อม TODO | คัดลอกเริ่มหน้าใหม่ |
| `public/showcase.html` | แกลเลอรีคอมโพเนนต์ทั้งหมดของ design system | เปิดดูว่ามีคลาสอะไรให้ใช้บ้าง |

### พิมพ์เอกสาร

ทุกใบพิมพ์ใช้เส้นทางเดียว: **กดพิมพ์ → drawer พรีวิว A4 (ซูม/ลาก) → กด "พิมพ์"**
ห้ามเรียก `window.print()` ตรง — พรีวิวคือด่านสุดท้ายก่อนของออกเครื่องพิมพ์
คอมโพเนนต์: `public/js/ds/ds-doc-print.js` (พรีวิว+สั่งพิมพ์) + `ds-doc-parts.js` (หัวกระดาษ/footer/ช่องลงชื่อ)
วิธีใช้เต็ม: [doc/PAGE-GUIDE.md §5B](doc/PAGE-GUIDE.md)

### ไอคอนและฟอนต์ตอนออฟไลน์

`ds-icons.js` โหลด Lucide จาก **`public/js/vendor/lucide.min.js` ก่อน** แล้วค่อยตกไปที่ unpkg
— การนำเสนอบน wifi สถานที่จัดงานจึงไม่พึ่งอินเทอร์เน็ต
อัปเดตไฟล์ในเครื่อง: `curl -sSL https://unpkg.com/lucide@latest/dist/umd/lucide.min.js -o public/js/vendor/lucide.min.js`

ฟอนต์ยังมาจาก Google Fonts (`@import` ใน `ds-tokens.css`) แต่ `--font-main` มีฟอนต์ไทยของระบบ
(Leelawadee UI / Thonburi / Tahoma) รองรับไว้แล้ว ถ้าเน็ตล่มตัวอักษรจะเปลี่ยนหน้าตาเล็กน้อยแต่ยังอ่านได้ปกติ

> ⚠️ **มีไฟล์ design system อยู่ 2 ชุด** — ชุดที่ **ใช้งานจริง** คือ `public/css/ds-*.css` +
> `public/js/ds/*.js` (แอปโหลดจากที่นี่) ส่วนโฟลเดอร์ `design-system/` ที่ root เป็นชุดตั้งต้น
> แบบ standalone ที่มีอยู่ก่อนแล้ว **แก้ที่นั่นจะไม่มีผลกับแอป**
> แนะนำให้ลบ `design-system/` ทิ้งเมื่อยืนยันว่าไม่ต้องใช้แล้ว
> (`design-system/README.md` มีเนื้อหาทับกับ [doc/PAGE-GUIDE.md](doc/PAGE-GUIDE.md) เกือบทั้งหมด)

---

## เพิ่มโมดูลใหม่ (5 ขั้น)

คัดลอกโมดูล `registry` ทั้งชุด แล้วเปลี่ยนชื่อ — ทุกไฟล์ที่ต้องแตะอยู่ในลิสต์นี้

1. **ตาราง** — เพิ่ม `CREATE TABLE` ใน `src/database/schema.sql`
   คัดลอกบล็อก `LIFECYCLE MIXIN` มาด้วยถ้าเป็นข้อมูลประเภท "เอกสาร"
   แล้วรัน `npm run migrate` (idempotent — รันซ้ำได้)
2. **route** — คัดลอก `src/routes/registry.js` เปลี่ยนชื่อตาราง/ฟิลด์
3. **mount** — เพิ่ม `app.use('/api/<ชื่อ>', ...)` ใน `src/server.js`
4. **สิทธิ์** — เพิ่มกฎใน `src/middleware/policy.js` + เพิ่มบรรทัดใน `scripts/check-policy.js` (`MOUNTS`)
   แล้ว `npm run check:policy` ต้องเขียว
5. **หน้าเว็บ** — คัดลอก `public/registry.html` + `public/js/registry.js` แล้วเพิ่มเมนูที่
   `DS_MENU` ใน `public/js/ds/ds-navbar.js` (ที่เดียวจบ)

รายละเอียดเต็ม: [doc/PAGE-GUIDE.md](doc/PAGE-GUIDE.md) · สถาปัตยกรรม: [doc/ARCHITECTURE.md](doc/ARCHITECTURE.md)

---

## คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รันด้วย nodemon |
| `npm start` | รันปกติ |
| `npm run migrate` | สร้าง/อัปเดต schema |
| `npm run seed` | users + ข้อมูลสาธิต |
| `npm run seed:demo` | รีเซ็ตเฉพาะข้อมูลสาธิต |
| `npm run check:policy` | **ตรวจว่าทุก route มีกฎสิทธิ์ครอบคลุม — ต้องเขียวก่อน commit** |
| `npm run check:policy -- --all` | พิมพ์ตาราง route → role ทั้งหมด |

---

## สิ่งที่ยัง**ไม่มี**โดยตั้งใจ

คงรูปแบบเดียวกับ `medicore_ipd` เพื่อให้โค้ดอ่านเหมือนกัน — เพิ่มทีหลังได้ถ้าโปรเจคต้องการ

- ไม่มี central error handler → ทุก route ใช้ `try/catch` + `console.error('[Module] METHOD path', err)`
- ไม่มี validation library → ตรวจ input ด้วย `if (!x) return res.status(400)`
- ไม่มี logger / helmet / rate-limit
- ไม่มี build step / bundler / framework — vanilla ล้วน วางไฟล์ `.html` ใน `public/` แล้วใช้ได้เลย
- ไม่มี test framework — ใช้สคริปต์ assert เองแบบ `scripts/check-policy.js`

---

## Deploy

`render.yaml` เป็น Render Blueprint พร้อมใช้ — secret (`DB_PASSWORD`, `JWT_SECRET`) ตั้ง `sync:false`
ต้องกรอกใน dashboard เอง

> ⚠️ `NODE_ENV=production` แต่ไม่ตั้ง `JWT_SECRET` → server จะปฏิเสธการ start
> (ตั้งใจ — ค่า dev secret อยู่ใน repo ใครเห็นก็ปลอม token ระดับ ADMIN ได้)
