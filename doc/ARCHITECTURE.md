# สถาปัตยกรรม — MediCore Starter

> อ่านไฟล์นี้ก่อนแตะโค้ด · คู่มือสร้างหน้า: [PAGE-GUIDE.md](PAGE-GUIDE.md) · ระบบดีไซน์: [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)

Stack: **Node 20 + Express 4 + MySQL2 (raw SQL ไม่มี ORM) + JWT** · frontend เป็น vanilla ไม่มี build step

```
เบราว์เซอร์ ──► express.static(public)          ◄── ไฟล์ .html/.css/.js เสิร์ฟตรง
           └──► /api/* ──► gateway ──► checkRevoked ──► policy ──► routes/*.js ──► pool.query()
```

---

## 1. โครงไฟล์

```
src/
├── server.js              โครง express + mount routes (ไม่มี error middleware โดยตั้งใจ)
├── middleware/
│   ├── auth.js            JWT primitives — requireAuth / requireRole / optionalAuth
│   ├── gateway.js         default-deny — ไม่มี JWT = 401 ยกเว้น PUBLIC allowlist
│   ├── policy.js          ⭐ ตารางสิทธิ์กลาง (role ไหนทำอะไรได้) — แก้ที่นี่ที่เดียว
│   └── revocation.js      ยกเลิก token ก่อนหมดอายุ (token_version + cache 60s)
├── database/
│   ├── connection.js      mysql2 pool
│   ├── migrate.js         รัน SQL_FILES ตามลำดับ (สร้าง database ให้ถ้ายังไม่มี)
│   ├── schema.sql         ⭐ ตารางทั้งหมด + LIFECYCLE MIXIN ที่ copy ได้
│   ├── id-gen.js          nextId() — เลขที่เอกสารแบบ RG001
│   └── seed-*.js          ข้อมูลเริ่มต้น
├── services/
│   └── audit-log.js       ⭐ auditLog / readAuditLog / assertRev / activeOnly
└── routes/
    ├── auth.js            login / logout / me / switch-role
    ├── settings.js        หน่วยงาน + ผู้ใช้
    └── registry.js        ⭐ โมดูลตัวอย่าง — แม่แบบของทุกโมดูล

public/
├── css/ds-*.css           ระบบดีไซน์ (8 ไฟล์) — ห้ามสลับลำดับ <link>
├── js/ds/
│   ├── ds-auth.js         ⭐ Auth + ห่อ window.fetch (ต้องเป็น script แรกของทุกหน้า)
│   ├── ds-navbar.js       ⭐ navbar + DS_MENU (แก้เมนูที่นี่ที่เดียว)
│   ├── ds-drawer.js       Drawer.open / .close / .confirm
│   ├── ds-toast.js        showToast()
│   └── ds-icons.js        refreshIcons()
└── *.html                 หน้าเว็บ — วางไฟล์แล้วใช้ได้เลย ไม่ต้อง register

scripts/check-policy.js    ⭐ ตรวจว่าไม่มี route ไหนหลุดการกำหนดสิทธิ์
```

---

## 2. ชั้นความปลอดภัย — 3 ด่านเรียงกัน

`src/server.js`:
```js
app.use('/api', gateway, checkRevoked, policy);
```

**ต้องอยู่ก่อน mount ทุก router** — router ที่เพิ่มใหม่จึงปลอดภัยโดยอัตโนมัติ

### gateway — "คุณเป็นใคร"
ทุก `/api/*` ต้องมี JWT ยกเว้น `PUBLIC[]` (`POST /auth/login`, `GET /health`) ที่ต้องระบุ **path เต็มตรง ๆ**
ห้าม prefix match เพราะจะเปิดกว้างเกินตั้งใจ

`AUTH_ENFORCE=log` = dry-run (แค่ warn ไม่บล็อก) ใช้ตอน rollout เพื่อดูว่ามี caller ไหนตกหล่น

### checkRevoked — "token ยังใช้ได้อยู่ไหม"
เทียบ `tv` ใน JWT กับ `users.token_version` (cache 60 วิ) — ปิดบัญชี/เปลี่ยนสิทธิ์แล้วเรียก
`bumpTokenVersion(userId)` จะเตะผู้ใช้ออกภายใน ~60 วิ โดยไม่ต้อง query DB ทุก request

ตั้งใจ **fail-open** เมื่อ DB สะดุด — ไม่ล็อกทุกคนออกจากระบบเพราะ DB กระตุกชั่วขณะ

### policy — "คุณทำสิ่งนี้ได้ไหม"
ตาราง `POLICY[]` ตัวเดียวของทั้งระบบ เทียบกับ `req.path` (Express ตัด `/api` ออกแล้ว)

```js
{ m: 'PUT', p: /^\/registry\/[^/]+\/confirm$/, roles: [DOCTOR, ADMIN] },  // กฎแคบ
{ m: 'GET', p: /^\/registry(\/|$)/,            roles: ANY },
{ m: '*',   p: /^\/registry(\/|$)/,            roles: STAFF },            // กฎกว้าง
{ m: '*',   p: /.*/, roles: [], fallthrough: true },                      // ปิดท้าย = ปฏิเสธ
```

**กฎ 3 ข้อ**
1. **match แรกชนะ** → กฎเฉพาะต้องมาก่อนกฎกว้างเสมอ
2. **บรรทัดสุดท้าย fallthrough** = อะไรที่ไม่เข้ากฎไหนเลย → 403 `NO_POLICY` (ไม่ใช่ปล่อยผ่าน)
3. **ทุกครั้งที่เพิ่ม route ต้องเพิ่มกฎ** แล้วรัน `npm run check:policy`

> ตารางรวมศูนย์นี้จะมีค่าก็ต่อเมื่อ `check-policy.js` ยังรันอยู่ — สคริปต์นั้นเดินทุก route ที่ mount จริง
> แล้ว exit 1 ถ้ามีตัวไหนตกไปที่ fallthrough ถ้าเลิกรันสคริปต์ การกระจาย `requireRole` ตาม router
> จะดีกว่าเพราะ grep ง่ายกว่า

### requireRole ในแต่ละ router = ชั้นที่สอง
เป็นเอกสารในตัวไฟล์ (อ่านแล้วรู้ทันทีว่าใครเรียกได้) และต้อง **แคบกว่าหรือเท่ากับ** กฎในตาราง

**`requireRole` ดูแค่ `req.user.active_role` ตัวเดียว ไม่ดู `roles[]`** — เพื่อให้การสลับบทบาท
ลดสิทธิ์ได้จริง และเพื่อให้ audit log ที่บันทึก role เดียวใช้เป็นหลักฐานได้

---

## 3. รูปแบบ route (ต้องเหมือนกันทุกไฟล์)

```js
const express  = require('express');
const router   = express.Router();
const { pool } = require('../database/connection');
```

**Response — raw ไม่มี envelope**

| กรณี | ตอบ |
|---|---|
| GET list | `res.json(rows)` — array ดิบ |
| GET one | `res.json(rows[0])` หรือ `404 { error }` |
| POST | `201 { <id> }` |
| PUT / DELETE | `{ success: true }` |
| ผิดพลาด | `500 { error: err.message }` + `console.error('[Module] METHOD path', err)` |
| สิทธิ์ | `{ error, code }` — `FORBIDDEN` / `NO_POLICY` / `TOKEN_EXPIRED` / `TOKEN_REVOKED` / `STALE_REV` / `ALREADY_CONFIRMED` |

**dynamic WHERE builder** — ใช้ทุกที่ที่มีตัวกรอง
```js
const conditions = [activeOnly('r')];      // ห้ามลืม — ไม่งั้นแถวที่ลบแล้วโผล่กลับมา
const params = [];
if (status) { conditions.push('r.status = ?'); params.push(status); }
... `WHERE ${conditions.join(' AND ')}`
```

**transaction** — ใช้เมื่อเขียนหลายตาราง (รวมถึงเขียน audit)
```js
const conn = await pool.getConnection();
try {
    await conn.beginTransaction();
    ...
    await auditLog(conn, {...});     // ⚠️ ต้องส่ง conn ตัวเดียวกัน ไม่ใช่ pool
    await conn.commit();
} catch (err) {
    await conn.rollback();
    ...
} finally {
    conn.release();
}
```

---

## 4. Audit log

ตาราง `audit_log` **ตัวเดียว** ของทั้งระบบ (ระบบเดิมมี `*_log` แยก 12 ตารางแล้วเขียน INSERT สด
กระจายทั่ว route — พอต้องเพิ่มฟิลด์ต้องไล่แก้ 12 ที่)

```js
await auditLog(conn, {
    entity: 'registry_item', entity_id: id, action: 'UPDATE',
    actor: req.user,              // ดึง user_id + active_role เอง
    before: {...}, after: {...},  // object ธรรมดา — stringify ให้เอง
    note: 'เหตุผล',
});

const rows = await readAuditLog(pool, 'registry_item', id);   // JOIN users ให้ชื่อผู้กระทำมาด้วย
```

`action` ที่ใช้อยู่: `CREATE` / `UPDATE` / `CONFIRM` / `DELETE` / `ACTIVATE` / `DEACTIVATE`

---

## 5. Lifecycle mixin

ตารางประเภท "เอกสาร" ใช้ชุดคอลัมน์เดียวกันทั้งหมด — คัดลอกบล็อก `LIFECYCLE MIXIN` จาก
`schema.sql` ลงตารางใหม่

| คอลัมน์ | ความหมาย |
|---|---|
| `status` | `DRAFT` → `CONFIRMED` · ยืนยันแล้วห้ามแก้เนื้อหา (สร้างฉบับใหม่แทน) |
| `confirmed_by` / `_at` | ใครยืนยัน เมื่อไหร่ |
| `is_deleted` / `deleted_by` / `_at` | **soft delete** — ทุก query ต้องมี `activeOnly()` |
| `created_by` / `updated_by` / `_at` | ผู้บันทึก |
| `rev` | **optimistic lock** |

### optimistic lock ใช้ยังไง
1. หน้าเว็บอ่านข้อมูล ได้ `rev` มาด้วย
2. ตอนบันทึกส่ง `rev` นั้นกลับมา
3. Route ทำ `SELECT ... FOR UPDATE` (**ต้องมี** ไม่งั้นสองคนอ่าน rev เดียวกันพร้อมกันแล้วผ่านทั้งคู่)
4. `assertRev(row, req.body.rev)` → ถ้าไม่ตรง throw → ตอบ `409 { code:'STALE_REV' }`
5. `UPDATE ... SET rev = rev + 1`

ที่ต้องมี: สองคนเปิดหน้าเดียวกัน คนแรกบันทึก คนที่สองบันทึกทับ — ไม่มีใครรู้ว่าเพิ่งลบงานคนแรกไป

---

## 6. Frontend

**ไม่มี bundler** — `<script src>` ธรรมดา ลำดับ script คือ dependency order

**ลำดับ CSS (ห้ามสลับ)**
```
ds-tokens → ds-base → ds-navbar → ds-layout → ds-components → ds-overlays → ds-print
```
`ds-landing.css` เพิ่มเฉพาะหน้าแรก

**ลำดับ script**
```
ds-auth.js  ◄── ต้องมาก่อนทุกตัว (ห่อ window.fetch)
ds-icons.js → ds-navbar.js → ds-drawer.js → ds-toast.js → js ของหน้า
```

### ds-auth.js
- เก็บ JWT ที่ `localStorage['app_token']` + user ที่ `app_user`
- **ห่อ `window.fetch`** — ทุก request ที่ยิง `/api` ได้ `Authorization: Bearer` อัตโนมัติ
  จึงเขียน `fetch('/api/x')` ตรง ๆ ได้ ไม่ต้องแนบ header เอง
- ดัก 401 code `TOKEN_EXPIRED` / `INVALID_TOKEN` / `TOKEN_REVOKED` → เคลียร์ session
  → เด้ง `/index.html?expired=1`
- `Auth.requireLogin()` / `Auth.requireRole('ADMIN')` วางไว้ใน `<head>` เพื่อ gate ทั้งหน้า
- `Auth.applyRoleGate()` ซ่อน element ที่มี `data-role-gate="ADMIN"`

> role gate ฝั่ง client เป็น **UX เท่านั้น** — ไฟล์ static ใครก็โหลดได้ ด่านจริงอยู่ที่ `policy.js` เสมอ

### แพทเทิร์น JS ของหน้า
**global object ไม่ใช่ IIFE** เพราะ markup เรียก handler ตรง (`onclick="Registry.edit(1)"`)

```js
const Registry = {
    state: { rows: [] },
    async load() { ... this.render(); },
    render() { ... refreshIcons(); },     // ⚠️ ต้องเรียกทุกครั้งหลัง innerHTML
};
function esc(s) { ... }                   // กัน XSS — ทุกค่าที่ลง innerHTML ต้องผ่าน
window.Registry = Registry;
document.addEventListener('DOMContentLoaded', () => Registry.init());
```

### เมนู
แก้ที่ `DS_MENU` ใน `public/js/ds/ds-navbar.js` **ที่เดียว** — การไฮไลต์เมนูที่กำลังเปิดอยู่
derive จาก `DS_MENU` + `<body data-page="ชื่อไฟล์">` เอง ไม่มีตาราง map แยกให้ลืมอัปเดต

---

## 7. Environment

| ตัวแปร | ค่าเริ่มต้น | หมายเหตุ |
|---|---|---|
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | localhost:3306 | `migrate` สร้าง database ให้ถ้ายังไม่มี |
| `PORT` | 3000 | Render จ่ายให้เอง |
| `NODE_ENV` | development | `production` + ไม่ตั้ง `JWT_SECRET` → **ปฏิเสธการ start** |
| `JWT_SECRET` | dev secret | ตั้งเสมอบน production |
| `JWT_EXPIRES` | 8h | = 1 เวร |
| `AUTH_ENFORCE` | deny | `log` = dry-run |
