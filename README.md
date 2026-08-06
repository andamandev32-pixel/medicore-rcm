# MediCore Starter

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
| `public/present.html` | **สไลด์นำเสนอ 20 หน้า (ฉบับเต็ม)** — ปุ่มลูกศร/clicker เลื่อน · `Ctrl+P` ได้ PDF A4 แนวนอน | SRS + NHSO V4 |
| `public/present-exec.html` | **สไลด์นำเสนอ 10 หน้า (ฉบับย่อ)** — แกน "ของเดิม/ของใหม่/ที่ปรับปรุงขึ้น" · ผังเป็นอินโฟกราฟิก SVG · แผนพัฒนา 6 เดือน | ย่อจากฉบับเต็ม |
| `public/refer-worklist.html` | ทะเบียนการส่งต่อผู้ป่วย — สองทิศทาง · เลขอนุมัติ · วันหมดอายุ · ธงความเสี่ยง | SRS §7 (Referral/Pre-auth) |
| `public/refer-case.html` | รายละเอียดการส่งต่อ 6 แท็บ + ออกเอกสาร 3 ใบ (ใบส่งตัว · ใบแจ้งหนี้ · ใบตอบกลับ) | SRS §7 · BR-03/04 |
| `public/refer-billing.html` | ตามจ่าย / เรียกเก็บ (AP–AR) · ตรวจใบเรียกเก็บรายบรรทัด · อายุหนี้ 4 ช่วง | ระเบียบส่งต่อ–ตามจ่าย |
| `public/refer-dashboard.html` | ภาพรวมการส่งต่อ — ส่งไปที่ไหน · จำนวนเงิน · รายการโรค | SRS §10 |
| `public/claim-dashboard.html` | ภาพรวมผู้บริหาร — KPI 6 ตัว (กดดูสูตรได้) + กราฟ + สถานะฝั่ง สปสช. | SRS §10 |
| `public/claim-worklist.html` | คิวเคลมก่อนส่งเบิก + คอลัมน์ "จะติดที่ NHSO" | SRS §10 |
| `public/claim-case.html` | รายละเอียดเคส 6 แท็บ — ผลกฎ · หลักฐาน · Override | SRS §10 · BR-03/04 |
| `public/claim-rules.html` | คลังกฎ / สร้างกฎ · Version · ทดสอบย้อนหลัง · Maker–Checker | SRS §10 · FR-03/04 |
| `public/claim-knowledge.html` | คลังความรู้ RAG — คำตอบพร้อม Citation และการปฏิเสธเมื่อหลักฐานไม่พอ | SRS §10 · FR-05 |
| `public/claim-tasks.html` | งานและการอนุมัติ · SLA · Escalation · Override | SRS §10 · FR-07 |
| `public/claim-reject.html` | วิเคราะห์การตีกลับ · Pareto · สร้างร่างกฎจากสาเหตุ | SRS §10 · FR-08 |
| `public/claim-admin.html` | ผู้ใช้ · เมทริกซ์สิทธิ์ · Mapping · Integration · ค่าระบบ · Audit Trail | SRS §10 · FR-10 |
| `public/nhso-submit.html` | ส่งเบิก NHSO — 6 ขั้นตอน + สถานะย่อย 1000/1100/4103/3101 | NHSO V4 |
| `public/nhso-case.html` | รายละเอียดรายการ 7 แท็บตรงตามหน้าจอจริง + P124/L205/C305 | NHSO V4 |
| `public/nhso-import.html` | นำเข้า API/Upload · **โครงสร้าง 15 แฟ้ม** · งานก่อน UAT | NHSO V4 |
| `public/nhso-reports.html` | Transaction / Statement / OFC / พึงรับ-พึงจ่าย + กติการหัสผ่านไฟล์ | NHSO V4 |

**ข้อมูลจำลองอยู่ที่ `public/js/mock/`** — `mock-core.js` ต้องโหลดก่อนเสมอ
แกนข้อมูลคือ `mock-claims.js` และ `mock-referrals.js` (ทุกหน้าฉายจากอาร์เรย์เดียวกัน ตัวเลขจึงกระทบยอดกันได้)

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
