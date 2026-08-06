# คู่มือเพิ่มหน้าใหม่ (Page Development Guide)

หน้ามาตรฐานของระบบคือ **`public/registry.html`** (หน้าเลื่อน + ตาราง + drawer) และ
**`public/registry-workspace.html`** (แอป 3 คอลัมน์) — ทุกหน้าใหม่ให้ยึด 2 หน้านี้เป็นแม่แบบ
เพื่อให้ลุคและพฤติกรรมเหมือนกันทั้งระบบ

> เริ่มเร็วที่สุด: คัดลอก `public/_template.html` + `public/js/registry.js` แล้วแก้
> หน้าเสิร์ฟอัตโนมัติด้วย `express.static` (ดู `src/server.js`) — วางไฟล์ใน `public/` ได้เลย **ไม่ต้อง register หน้า**

---

## 1. โครงสร้างไฟล์ 1 หน้า

**เลือกแม่แบบตามชนิดของหน้า**

| ต้องการ | ลอกจาก | โครง |
|---|---|---|
| หน้ารายการ/CRUD | `public/registry.html` | page-header + KPI + ตาราง + drawer |
| หน้าทำงาน 3 คอลัมน์ | `public/registry-workspace.html` | `.ds-shell.cols-3` (รายการ / เนื้อหา / แผงบันทึก) |
| หน้าทำงาน 2 คอลัมน์ + หลายมุมมอง | `public/registry-nursing.html` | `.ds-shell.cols-2` + แท็บ + ออกเอกสาร |
| หน้า home ของบทบาท | `public/portal.html` | `.dp-*` — hero + KPI + การ์ดงาน + ปฏิทิน (โหลด `ds-portal.css` เพิ่ม) |
| หน้าเปล่าเริ่มใหม่ | `public/_template.html` | มี TODO กำกับ |

| ส่วน | ไฟล์ | หมายเหตุ |
|---|---|---|
| HTML | `public/<ชื่อ>.html` | CSS มาตรฐาน + `<nav id="appNavbar">` + shared scripts + js ของหน้า |
| Logic | `public/js/<ชื่อ>.js` | global object เช่น `Registry` + helper `esc()` |
| API | `src/routes/<ชื่อ>.js` | export express Router |
| DB | `src/database/schema.sql` | เพิ่ม `CREATE TABLE IF NOT EXISTS` ต่อท้าย |
| สิทธิ์ | `src/middleware/policy.js` + `scripts/check-policy.js` | **ลืมไม่ได้ — ไม่งั้นได้ 403 NO_POLICY** |
| เมนู | `public/js/ds/ds-navbar.js` → `DS_MENU` | ที่เดียวจบ |

---

## 2. หัวไฟล์ HTML (ลอกตามนี้เป๊ะ)

```html
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MediCore — ชื่อหน้า</title>
    <link rel="icon" href="favicon.svg" type="image/svg+xml">

    <!-- ลำดับ CSS มาตรฐาน (อย่าสลับ — ds-tokens ต้องมาก่อนเสมอ) -->
    <link rel="stylesheet" href="css/ds-tokens.css">
    <link rel="stylesheet" href="css/ds-base.css">
    <link rel="stylesheet" href="css/ds-navbar.css">
    <link rel="stylesheet" href="css/ds-layout.css">
    <link rel="stylesheet" href="css/ds-components.css">
    <link rel="stylesheet" href="css/ds-overlays.css">
    <link rel="stylesheet" href="css/ds-print.css">

    <!-- ds-auth ต้องเป็น script แรก — มันห่อ window.fetch -->
    <script src="js/ds/ds-auth.js"></script>
    <script>Auth.requireLogin();</script>      <!-- หรือ Auth.requireRole('ADMIN') -->
</head>
<body data-page="<ชื่อไฟล์ไม่มี .html>">        <!-- ใช้ไฮไลต์เมนูใน navbar -->
    <nav id="appNavbar"></nav>
    ...
    <div id="toastContainer" class="toast-container"></div>

    <script src="js/ds/ds-icons.js"></script>
    <script src="js/ds/ds-navbar.js"></script>
    <script src="js/ds/ds-drawer.js"></script>
    <script src="js/ds/ds-toast.js"></script>
    <script src="js/<ชื่อ>.js"></script>
</body>
</html>
```

**ห้ามลืม:** `data-page` ต้องตรงกับชื่อไฟล์ ไม่งั้นเมนูไม่ไฮไลต์

---

## 3. เลือกโครงเลย์เอาต์

### (ก) หน้าเลื่อนธรรมดา — `registry.html`
```html
<div class="page-container">
    <div class="page-header">
        <div>
            <div class="page-title"><i data-lucide="list" class="mi"></i> <span>หัวข้อ</span></div>
            <div class="page-subtitle">คำอธิบายสั้น ๆ</div>
        </div>
        <div class="section-actions">
            <button class="btn btn-outline">…</button>
            <button class="btn btn-primary">…</button>
        </div>
    </div>

    <div class="ds-kpi-grid">
        <div class="sip-kpi"><i data-lucide="inbox" class="sip-kpi-icon icon-lg"></i>
            <div class="sip-kpi-value">0</div><div class="sip-kpi-label">ทั้งหมด</div></div>
        <div class="sip-kpi critical">…</div>   <!-- .critical = กรอบแดง -->
    </div>

    <div class="section-card">
        <div class="section-header">
            <div class="section-title">…</div>
            <div class="section-actions">
                <select class="sip-select" style="width:140px">…</select>
                <input class="sip-input" style="width:240px">
            </div>
        </div>
        <div class="table-responsive">
            <table class="data-table"><thead>…</thead><tbody id="rows"></tbody></table>
        </div>
    </div>
</div>
```
> `.sip-select` / `.sip-input` ยืดเต็มพื้นที่โดยปริยาย — ใส่ `style="width:…"` ใน `.section-actions`
> ไม่งั้นตัวกรองจะตกบรรทัด

### (ข) แอป 3 คอลัมน์ — `registry-workspace.html`
```html
<body class="ds-shell-page">           <!-- fallback ล็อกการเลื่อนสำหรับเบราว์เซอร์ที่ไม่รองรับ :has() -->
<div class="ds-shell cols-3" id="shell">     <!-- ใช้ .cols-2 ถ้าไม่ต้องการแผงขวา -->
    <aside class="ds-pane-left">
        <div class="ds-pane-header"><h3>…</h3><span class="ds-pane-count">0 รายการ</span></div>
        <div class="ds-pane-tools"><select class="sip-select">…</select></div>
        <div class="ds-pilltabs"><button class="ds-pilltab active">… <span class="tab-count">0</span></button></div>
        <input class="ds-pane-search">
        <div class="ds-pane-scroll" id="listContainer"></div>   <!-- .ds-list-card ต่อรายการ -->
    </aside>

    <main class="ds-pane-main">
        <div class="ds-empty-state">…</div>          <!-- ตอนยังไม่เลือก -->
        <div class="ds-context-bar">…</div>          <!-- แถบข้อมูลรายการที่เลือก (sticky) -->
        <div class="ds-tabs"><button class="ds-tab active">…</button></div>
        <div class="ds-tab-content active" id="tabX">…</div>
    </main>

    <aside class="ds-pane-right">
        <div class="ds-pane-header">…</div>
        <div class="ds-pane-scroll" style="padding:0 16px 90px">…</div>
        <div class="ds-actions">                     <!-- แถบปุ่มติดขอบล่าง -->
            <button class="btn btn-outline">ยกเลิก</button>
            <button class="btn btn-save">บันทึก</button>
            <button class="btn btn-save-send">บันทึกและส่ง</button>
        </div>
    </aside>
</div>
```
`.ds-shell` ล็อกการเลื่อนของทั้งหน้า — แต่ละคอลัมน์เลื่อนเองผ่าน `.ds-pane-scroll`
หน้าเลื่อนปกติ **ไม่ต้อง** hack `overflow` อะไรทั้งสิ้น

---

## 4. แพทเทิร์น JS ของหน้า

**global object ไม่ใช่ IIFE** — เพราะ markup เรียก handler ตรง (`onclick="X.foo()"`)

```js
const MyPage = {
    state: { rows: [], keyword: '' },

    async init() { await this.load(); },

    async load() {
        try {
            // ไม่ต้องแนบ Authorization — ds-auth.js ห่อ fetch ให้แล้ว
            const rows = await fetch('/api/<โมดูล>').then(r => r.json());
            if (!Array.isArray(rows)) throw new Error(rows.error || 'โหลดข้อมูลไม่สำเร็จ');
            this.state.rows = rows;
            this.render();
        } catch (err) {
            console.error('[MyPage] load', err);
            showToast(err.message, 'error');
        }
    },

    render() {
        document.getElementById('rows').innerHTML = this.state.rows.length
            ? this.state.rows.map(r => `<tr><td>${esc(r.name)}</td></tr>`).join('')
            : '<tr><td colspan="3" class="ds-empty">ไม่พบรายการ</td></tr>';
        refreshIcons();      // ⚠️ ต้องเรียกทุกครั้งหลัง innerHTML ไม่งั้นไอคอนไม่ขึ้น
    },
};

function esc(s) {            // ⚠️ ทุกค่าที่ลง innerHTML ต้องผ่านตัวนี้
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.MyPage = MyPage;
document.addEventListener('DOMContentLoaded', () => MyPage.init());
```

**สามข้อที่พลาดบ่อยที่สุด**
1. ลืม `refreshIcons()` หลัง render → ไอคอนเป็นช่องว่าง
2. ลืม `esc()` → XSS + หน้าพังเมื่อข้อมูลมี `<`
3. ลืมเช็ค `Array.isArray()` → error object ถูกเอาไป `.map()` แล้วหน้าขาว

---

## 5. Drawer / Modal / Confirm / Toast

**Drawer = ตัวหลัก** สำหรับงานที่มีฟอร์ม (modal ใช้เฉพาะข้อความสั้น)

```js
Drawer.open({
    title: 'เพิ่มรายการ',
    contentHtml: `<div class="sip-field">
                      <label class="sip-label">ชื่อ *</label>
                      <input class="sip-input" id="fName">
                  </div>`,
    footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                 <button class="btn btn-save" onclick="MyPage.save()">บันทึก</button>`,
    onOpen: () => refreshIcons(),
});

const ok = await Drawer.confirm({          // แทน window.confirm — คืน Promise<boolean>
    title: 'ลบรายการนี้?', message: 'กู้คืนไม่ได้',
    lines: ['RG001 · ชื่อรายการ'], confirmText: 'ลบรายการ', danger: true,
});

showToast('บันทึกแล้ว');                    // success (ค่าเริ่มต้น)
showToast('ผิดพลาด', 'error');              // error | warning | info
```

---

## 5B. ใบพิมพ์เอกสาร — `DocPrint` + `DocParts`

**ขั้นตอนเดียวของทั้งระบบ:** กดปุ่มพิมพ์ → drawer พรีวิว A4 (ซูม/ลากได้) → กด "พิมพ์"

> **ห้ามเรียก `window.print()` ตรง ๆ** — ผู้ใช้จะเสียกระดาษกับเอกสารที่กรอกไม่ครบหรือจัดหน้าเพี้ยน
> พรีวิวคือด่านสุดท้ายก่อนของออกเครื่องพิมพ์

โหลดเพิ่ม 2 ไฟล์ (ต่อจาก `ds-drawer.js`):
```html
<script src="js/ds/ds-doc-parts.js"></script>
<script src="js/ds/ds-doc-print.js"></script>
```

### สร้างเอกสาร
```js
buildDoc() {
    const C = DocParts.CELL;          // สไตล์ช่องตารางมาตรฐาน (เส้นดำ 1px)
    const warnings = [];              // เก็บ label ของช่องที่ยังว่าง
    const fields = [['เลขที่', it.code], ['เรื่อง', it.name]];

    const html = `<div style="color:#000;font-size:12px;">
      ${DocParts.docHead({ title: 'ชื่อเอกสาร', formCode: 'XX/2569', fields })}
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr><th style="${C}">คอลัมน์</th></tr></thead>
        <tbody>${DocParts.fillRows(rowsHtml, 16, 1)}</tbody>
      </table>
      ${DocParts.signatureBlock(['ลงชื่อ ผู้บันทึก', 'ลงชื่อ ผู้ตรวจสอบ'])}
      ${DocParts.footer(fields)}
    </div>`;

    return { html: DocParts.toPrintBorders(html), warnings };
},

openPrint() {
    const { html, warnings } = this.buildDoc();
    DocPrint.preview({ title: 'ตัวอย่างก่อนพิมพ์ — ชื่อเอกสาร', html, warnings });
},
```

### เตือนช่องที่ยังไม่ได้กรอก
```js
`<td style="${C}" class="${DocPrint.miss(value, 'ชื่อช่อง', warnings)}">${value || ''}</td>`
```
ค่าว่าง → ได้คลาส `.ds-miss` (กรอบแดง + ป้าย "⚠ ยังไม่ได้กรอก" ที่หายไปตอนพิมพ์)
และ label ถูก push เข้า `warnings` → drawer ขึ้นกล่องแดงสรุป + ปุ่มพิมพ์เป็นสีแดง
**ยังกดพิมพ์ได้** — เป็นการเตือน ไม่ใช่บล็อก

### กฎที่ต้องทำตามทุกใบ

| กฎ | เหตุผล |
|---|---|
| **`DocParts.footer()` ทุกใบ** | ทำให้ทุกหน้ามีข้อมูลระบุตัวเรื่อง + เวลาที่พิมพ์ + เลขหน้า — แผ่นที่ 2 ที่หลุดออกมาต้องรู้ว่าเป็นของเรื่องไหน |
| **ใช้ renderer ตัวเดียวกับหน้าจอ** | ข้อความบนกระดาษต้องตรงกับที่เห็นบนจอ · `toPrintBorders()` แปลงแค่สีเส้นเทา→ดำ |
| **ร่าง (DRAFT) ไม่ขึ้นใบพิมพ์** | และต้องมีแบนเนอร์เตือนบนจอว่ามีร่างค้าง ไม่งั้นงานที่ทำจริงหายจากเอกสารเงียบ ๆ |
| **รายการที่ยกเลิก ให้พิมพ์ด้วย (ขีดฆ่า + ผู้ยกเลิก)** | ถ้าตัดออก เลขลำดับของรายการหลังจะเลื่อน ใบที่พิมพ์คนละวันจะอ้างเลขเดียวกันคนละเรื่อง |
| **`fillRows()` เติมแถวว่าง** | ฟอร์มกระดาษต้องมีบรรทัดให้เขียนเพิ่มด้วยมือ |

### ทำไมเลขหน้าถึงทำแบบนี้
Chrome ไม่รองรับ `counter(page)` นอก `@page` margin box → ใช้ footer แบบ `position:fixed`
ที่เบราว์เซอร์วาดซ้ำทุกหน้าแทน (ดู `ds-print.css`) · เลข x/y ทำงานเต็มที่ใน Firefox
ส่วน Chrome ได้ "ระบุตัวเรื่องครบทุกหน้า" ซึ่งเป็นข้อกำหนดที่สำคัญกว่า

ตัวอย่างที่ทำงานจริง: `public/js/registry.js` → `buildReport()` / `openPrint()`
และ `public/js/registry-nursing.js` → `printRecord()` / `printHistory()`

---

## 6. คลาส CSS ที่มีให้ใช้

| กลุ่ม | คลาส |
|---|---|
| ปุ่ม | `.btn` + `.btn-primary`(amber CTA) `.btn-save`(ฟ้า) `.btn-save-send`(ส้ม) `.btn-outline` `.btn-ghost` `.btn-danger` `.btn-navy` · ขนาด `.btn-sm/-lg/-block` · `.ds-icon-btn(.edit/.neutral)` |
| การ์ด | `.section-card` > `.section-header` > `.section-title`/`.section-actions` · `.card` · `.clinical-card` · `.cards-row` · `.ds-list-card(.active)` |
| ตาราง | `.data-table` (+`.td-name`/`.td-sub`/`.compact`) · `.sip-table` · `.ds-table-grid` (เส้นครบ สำหรับพิมพ์) · ครอบด้วย `.table-responsive` |
| ฟอร์ม | `.sip-field` `.sip-field-row` `.sip-label` `.sip-input` `.sip-select` `.sip-textarea` `.sip-checkbox` `.ds-toggle` |
| ป้าย | `.status-badge.{active,pending,completed,confirmed,scheduled,waiting,in-progress,danger,inactive}` · `.kbadge-{pending,acked,progress,active,done,off,draft,alert}` |
| chip | `.sip-chip.{-active,-progress,-success,-danger,-muted,-ack,-amber}` · `.ds-chip-toggle(.is-on)` |
| KPI | `.ds-kpi-grid` > `.sip-kpi(.critical)` > `.sip-kpi-icon/-value/-label` |
| banner | `.sip-banner.{-info,-warning,-danger,-success,-draft}` · `.ds-note` `.ds-warn` |
| แท็บ | `.ds-tabs > .ds-tab(.active)` (ขีดเส้นใต้) · `.ds-segbar > .ds-seg` (pill) · `.ds-pilltabs > .ds-pilltab > .tab-count` |
| อื่น | `.ds-stepper > .ds-step(.completed/.active)` · `.ds-timeline-item(.info/.success/.warning/.danger/.accent)` · `.ds-empty` `.ds-empty-state` `.ds-spinner` |

รายละเอียดสี/ขนาด: [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) · ค่าจริง: `public/css/ds-tokens.css`

**ไอคอน — Lucide เท่านั้น ห้ามใช้ emoji ใน UI**
```html
<i data-lucide="pill" class="mi"></i>        <!-- ขนาดตามฟอนต์รอบข้าง -->
<i data-lucide="plus" class="icon-sm"></i>   <!-- icon-xs/sm/md/lg/xl = 12/14/16/20/28px -->
```
navbar ใช้ inline SVG ของตัวเอง (`DS_ICONS`) จึงไม่พังถ้า CDN ล่ม

---

## 7. ต่อ backend

1. เพิ่มตารางใน `src/database/schema.sql` (idempotent เสมอ) → `npm run migrate`
2. คัดลอก `src/routes/registry.js` → `src/routes/<ชื่อ>.js`
3. `app.use('/api/<ชื่อ>', ...)` ใน `src/server.js`
4. เพิ่มกฎใน `src/middleware/policy.js` — **กฎแคบต้องมาก่อนกฎกว้าง**
5. เพิ่ม `['/api/<ชื่อ>', '<ชื่อ>']` ใน `scripts/check-policy.js` → `npm run check:policy` ต้องเขียว

ดู [ARCHITECTURE.md](ARCHITECTURE.md) §3 สำหรับรูปแบบ response, transaction, audit

---

## 7B. โหมดต้นแบบ (หน้าที่ขึ้นต้นด้วย `claim-` / `nhso-` / `refer-` และ `present*.html`)

หน้าชุดนี้สร้างขึ้นเพื่อ**นำเสนอผู้บริหาร** จึงเบี่ยงจากกติกาปกติ 3 ข้อโดยตั้งใจ
อย่า "แก้ให้ถูก" โดยไม่อ่านเหตุผลก่อน

| เบี่ยงจากอะไร | ทำอย่างไร | ทำไม |
|---|---|---|
| ไม่มี `Auth.requireLogin()` | คง `ds-auth.js` เป็น script แรกไว้ แต่ไม่เรียก `requireLogin()` · `mock-session.js` เรียก `DSNavbar.configure()` แทน (แบบเดียวกับ `showcase.html`) | หน้าเหล่านี้ไม่ยิง `/api` เลย และ DB อยู่เครื่องระยะไกล ถ้า gate ไว้ การนำเสนอจะพังทันทีที่เน็ต/DB ไม่พร้อม |
| ข้อมูลมาจาก `MockDB` ไม่ใช่ `fetch` | `public/js/mock/*.js` — `mock-core.js` โหลดก่อนเสมอ, `mock-session.js` หลัง `ds-navbar.js`, ที่เหลือก่อน JS ของหน้า | ยังไม่มี schema/route จริง · เมื่อผูก backend ให้เปลี่ยน `MockDB.*` เป็น `fetch('/api/...')` ตาม §4 แล้วลบโฟลเดอร์ `js/mock/` |
| กลุ่มเมนู `claim` / `nhso` / `refer` ไม่มี `roles:` | อย่าใส่ `roles:` ใน `DS_MENU` ของสามกลุ่มนี้ | `DSNavbar._role()` คืน `''` ตอนยังไม่ล็อกอิน — ใส่ `roles:` เมื่อไหร่เมนูหายทั้งกลุ่มระหว่างเดโม |

**กฎที่ยังบังคับเหมือนเดิมทุกข้อ:** `esc()` ทุกค่าที่ลง `innerHTML` · `refreshIcons()` หลัง `innerHTML` ทุกครั้ง ·
ตัวกรองใน `.section-actions` ต้องมี `style="width:…"` · พิมพ์ผ่าน `DocPrint.preview()` เท่านั้น

**ห้าม hardcode ตัวเลขที่คำนวณได้** — KPI, ตัวนับใน pill/seg, ชุดข้อมูลกราฟ ต้อง derive จาก `MockDB`
ไม่งั้นตัวเลขบนหน้า Dashboard กับ Worklist จะขัดกันเองกลางการนำเสนอ
(มีสคริปต์ตรวจความสอดคล้องอยู่ในบันทึกการพัฒนา — ตัวเลข 5 จุดต้องกระทบยอดกันได้)

---

## 8. Checklist ก่อนถือว่าเสร็จ

- [ ] `npm run check:policy` เขียว
- [ ] เปิดหน้าโดยไม่ล็อกอิน → ถูกเด้งไป `index.html`
- [ ] ล็อกอินด้วย role ที่ไม่มีสิทธิ์ → ปุ่ม/เมนูหาย **และ** ยิง API ตรงได้ 403
- [ ] ไอคอนขึ้นครบทุกตัว (ไม่มีช่องว่าง) — ทั้งตอนโหลดแรกและหลังกดกรอง
- [ ] ย่อจอ 1024px → ไม่มี scrollbar แนวนอนของทั้งหน้า
- [ ] ข้อมูลที่มี `<` `&` แสดงถูกต้อง (ผ่าน `esc()` แล้ว)
- [ ] เพิ่มเมนูใน `DS_MENU` และ `data-page` ตรงกับชื่อไฟล์

---

## 9. วิธีสั่ง AI ให้ทำหน้าใหม่ (บอก 5 อย่างนี้)

1. **ชื่อหน้า + ชื่อไฟล์** — เช่น "หน้าตารางเวรพยาบาล → `nurse-shift.html`"
2. **โครงไหน** — หน้าเลื่อน (`registry.html`) หรือ 3 คอลัมน์ (`registry-workspace.html`)
3. **ข้อมูล** — ตาราง/ฟิลด์อะไร มาจาก API ไหน (ถ้ายังไม่มีให้บอกว่าต้องสร้าง)
4. **ใครทำอะไรได้** — role ไหนอ่าน role ไหนเขียน role ไหนยืนยัน (ไปเป็นกฎใน `policy.js`)
5. **ต้องมี audit / soft delete / ยืนยันไหม** — ถ้าใช่ ให้ใช้ `LIFECYCLE MIXIN`

ตัวอย่างคำสั่งที่ดี:
> "สร้างหน้า `nurse-shift.html` แบบหน้าเลื่อน แสดงตารางเวรพยาบาล (วันที่/เวร/พยาบาล/หอผู้ป่วย)
> อ่านได้ทุก role, เพิ่ม/แก้ได้เฉพาะ NURSE กับ ADMIN, ต้องมี audit log กับ soft delete
> ยึดแม่แบบจาก `registry.html` และเพิ่มเมนูใต้กลุ่ม 'ทะเบียนรายการ'"
