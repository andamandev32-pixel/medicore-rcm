# Design System — MediCore Starter

> **Single-source-of-truth** สำหรับสี typography ไอคอน และ component pattern ของทุกหน้าในโปรเจค
> ห้ามแตกต่างกันระหว่างหน้า
>
> **ค่าจริงทั้งหมดอยู่ที่ `public/css/ds-tokens.css`** — เอกสารนี้อธิบายว่าแต่ละโทเคนมีไว้ทำอะไร
> และควรเลือกใช้ตัวไหนเมื่อไหร่ ถ้าค่าไม่ตรงกัน **ให้ยึดไฟล์ CSS**
>
> วิธีสร้างหน้าใหม่: [PAGE-GUIDE.md](PAGE-GUIDE.md) · สถาปัตยกรรม: [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 1. Brand Palette

### 1.1 Primary — Navy Blue

```css
--brand-navy:           #0f172a;   /* Slate-900 — navbar, hero, sidebar, พื้นเข้ม */
--brand-navy-700:       #1e293b;   /* Slate-800 — hover/secondary surface */
--brand-navy-600:       #334155;   /* Slate-700 — border/divider on navy */
--brand-navy-500:       #475569;   /* Slate-600 — text on light surface (muted) */
--brand-navy-on:        #ffffff;   /* text on navy bg */

--navy:                 #003366;   /* น้ำเงินเข้ม — คนละตัวกับ --brand-navy */
--navy-dark:            #00264D;
--navy-light:           #004080;
```

> ⚠️ **`--navy` กับ `--brand-navy` เป็นคนละสีและใช้คนละที่ อย่ารวมกัน**
>
> | ใช้ที่ | โทเคน |
> |---|---|
> | พื้นเข้ม — navbar, hero gradient, `.dp-hero` | `--brand-navy` (slate `#0f172a`) |
> | ตัวอักษร/พื้นเน้น — `.card-title`, `.toast`, `h3` หัวแผง | `--navy` (`#003366`) |

### 1.2 Accent — Amber/Yellow

```css
--brand-amber:          #fbbf24;   /* Amber-400 — primary accent: CTA, highlight, brand mark */
--brand-amber-500:      #f59e0b;   /* Amber-500 — hover state */
--brand-amber-100:      #fef3c7;   /* Amber-100 — soft bg for chips/banners */
--brand-amber-on:       #1e293b;   /* text on amber bg (must be dark) */
```

### 1.3 Surface — White

```css
--brand-white:          #ffffff;   /* card/data surface — always white */
--brand-bg:             #f8fafc;   /* page bg — Slate-50 */
--brand-border:         #e2e8f0;   /* Slate-200 — light divider */
--brand-border-strong:  #cbd5e1;   /* Slate-300 — emphasized border */
```

### 1.4 Status (orthogonal to brand — ไม่เกี่ยวกับ palette หลัก)

```css
--status-success:       #10b981;   /* Emerald-500 — completed, given, ok */
--status-success-soft:  #d1fae5;   /* Emerald-100 — bg */
--status-warning:       #f59e0b;   /* Amber-500 — active, pending (เหมือนกับ amber-500) */
--status-warning-soft:  #fef3c7;
--status-danger:        #ef4444;   /* Red-500 — critical, abnormal, alert */
--status-danger-soft:   #fee2e2;
--status-info:          #3b82f6;   /* Blue-500 — informational, in-progress */
--status-info-soft:     #dbeafe;
--status-muted:         #94a3b8;   /* Slate-400 — off, cancelled, disabled */
--status-muted-soft:    #f1f5f9;
--status-acknowledged:  #6366f1;   /* Indigo-500 — doctor ack */
--status-ack-soft:      #e0e7ff;
```

### 1.5 ตัวอย่างการใช้

| ที่ | สี |
|---|---|
| Page bg | `--brand-bg` (#f8fafc) |
| Card/panel/table bg | `--brand-white` |
| Primary CTA bg | `--brand-amber` text `--brand-amber-on` |
| Primary header/nav | `--brand-navy` text `--brand-navy-on` |
| Hero gradient | `linear-gradient(160deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)` พร้อม amber radial accent |
| Hover link | `--brand-amber` (จาก navy → highlight ด้วย amber) |
| Active sidebar item | bg `--brand-amber` text `--brand-navy` |
| Status badges | ใช้ status tokens (ไม่ใช่ brand) |

---

## 2. Typography

- **`--font-main`** — `'Inter', 'Noto Sans Thai', system-ui, sans-serif`
  (Inter = ละติน/ตัวเลข · Noto Sans Thai = ไทย) โหลดผ่าน `@import` บรรทัดแรกของ `ds-tokens.css`
- **`--font-mono`** — `ui-monospace, 'Cascadia Code', 'Consolas', monospace`
  **ไม่โหลด webfont** ใช้ของระบบ (สำหรับรหัส เลขที่เอกสาร ช่วงเวลา)
- **`--font-print`** — `'Sarabun', 'TH Sarabun PSK', 'Noto Sans Thai', serif`
  **ใช้เฉพาะใบพิมพ์เอกสารราชการ/A4 ไม่ใช่ฟอนต์ของ UI**
- ขนาด: `--font-size-xs` (10) → `-sm` (11) → `-base` (13) → `-md` (14, base ของ body)
  → `-lg` (16) → `-xl` (18) → `-2xl` (22) → `-3xl` (28)
  **ห้ามใช้ต่ำกว่า 12px กับเนื้อหาที่ต้องอ่าน** (11 = chip/badge, 10 = เท่าที่จำเป็นจริง ๆ)
- `html` = 14px · `body` line-height 1.55 · Heading 700 · Body 400 · Strong 600

---

## 3. Icon System — Lucide เท่านั้น

**ห้ามใช้ emoji ใน UI ทั้งระบบ** (ยกเว้น content ที่ user พิมพ์เอง เช่น message field)

### 3.1 วิธีใช้

โหลด `ds-icons.js` (โหลด Lucide จาก CDN แบบ lazy ให้เอง — ไม่ต้องใส่ `<script>` ของ Lucide เอง):
```html
<script src="js/ds/ds-icons.js"></script>
```

แทรก icon:
```html
<i data-lucide="clipboard-list" class="mi"></i>       <!-- .mi = ขนาดตามฟอนต์รอบข้าง (1.05em) -->
<i data-lucide="plus" class="icon-sm"></i>            <!-- หรือระบุขนาดคงที่ -->
```

**หลัง render ด้วย `innerHTML` ต้องเรียกทุกครั้ง** ไม่งั้นไอคอนใหม่จะเป็นช่องว่าง:
```js
refreshIcons();
```

> navbar ใช้ **inline SVG ของตัวเอง** (`DS_ICONS` ใน `ds-navbar.js`) ไม่พึ่ง CDN
> — เมนูจึงไม่พังถ้า CDN ล่ม เพิ่มไอคอนใหม่ของ navbar ที่ object นั้น

### 3.2 ขนาด — CSS classes

```css
.icon-xs   { width: 12px; height: 12px; stroke-width: 2; }
.icon-sm   { width: 14px; height: 14px; stroke-width: 2; }
.icon-md   { width: 16px; height: 16px; stroke-width: 2; }  /* default */
.icon-lg   { width: 20px; height: 20px; stroke-width: 2; }
.icon-xl   { width: 28px; height: 28px; stroke-width: 1.5; }
.icon-2xl  { width: 48px; height: 48px; stroke-width: 1.5; }
```

### 3.3 Emoji → Lucide mapping (ห้ามใช้ emoji ใน UI — แปลงเป็น Lucide เสมอ)

| Plan emoji | Lucide name | ความหมาย |
|---|---|---|
| 📊 | `bar-chart-3` | ผล lab/chart |
| 📋 | `clipboard-list` | รายการ/checklist |
| 📋 (drafts) | `file-edit` | ร่างคำสั่ง |
| 📄 | `file-text` | เอกสาร |
| 📆 | `calendar` | ปฏิทิน |
| 📅 | `calendar-days` | นัด |
| 🔔 | `bell` | notification |
| 💬 | `message-square` | consult/comment |
| ⚠ | `alert-triangle` | warning |
| 🔴 | `alert-circle` | critical/error |
| 🟡 | `alert-octagon` | medium severity |
| 🟢 | `check-circle-2` | ok/normal |
| ✓ | `check` | confirmed |
| ✕ | `x` | cancelled |
| 👁 | `eye` | acknowledged/รับทราบ |
| 🚫 | `ban` | off/discontinue |
| ⏳ | `clock` | in-progress |
| 🕐 | `clock-3` | scheduled |
| 🔄 | `refresh-cw` | recurring/reset |
| 📌 | `pin` | pinned |
| ⭐ | `star` | favorite |
| 🏷 | `tag` | chronic/label |
| ➕ | `plus` | add |
| ➖ | `minus` | remove |
| 🔍 | `search` | search |
| 🖨 | `printer` | print |
| 📤 | `upload` | export/share |
| 💾 | `save` | save |
| 🗑 | `trash-2` | delete |
| ✍ | `pen-line` | sign |
| ⚙ | `settings` | settings |
| 🏠 | `home` | home/portal |

---

## 4. Component Patterns

### 4.1 Button

```css
/* Primary CTA */
.btn-primary {
  background: var(--brand-amber);
  color: var(--brand-amber-on);
  border: 1px solid var(--brand-amber-500);
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-primary:hover { background: var(--brand-amber-500); }

/* Navy (secondary, structural) */
.btn-navy {
  background: var(--brand-navy);
  color: var(--brand-navy-on);
}
.btn-navy:hover { background: var(--brand-navy-700); }

/* Outline */
.btn-outline {
  background: var(--brand-white);
  color: var(--brand-navy);
  border: 1px solid var(--brand-border-strong);
}
.btn-outline:hover { border-color: var(--brand-navy); }

/* Ghost (icon-only) */
.btn-ghost {
  background: transparent;
  color: var(--brand-navy-500);
}
.btn-ghost:hover { background: var(--status-muted-soft); }
```

### 4.2 Card

```css
.card {
  background: var(--brand-white);
  border: 1px solid var(--brand-border);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(15,23,42,0.04);
}
.card-hover:hover {
  border-color: var(--brand-amber);
  box-shadow: 0 4px 12px rgba(15,23,42,0.08);
}
```

### 4.3 Header / Top bar

```css
.app-header {
  background: var(--brand-navy);
  color: var(--brand-navy-on);
  height: 56px;
  padding: 0 24px;
  display: flex; align-items: center; justify-content: space-between;
}
.app-header .brand-mark {
  /* logo with amber accent dot */
}
```

### 4.4 Sidebar / Nav

```css
.sidebar {
  background: var(--brand-navy);
  color: var(--brand-navy-on);
  width: 240px;
}
.sidebar-item.active {
  background: var(--brand-amber);
  color: var(--brand-amber-on);
  border-left: 3px solid var(--brand-amber-500);
}
.sidebar-item:not(.active):hover {
  background: var(--brand-navy-700);
}
```

### 4.5 Status Chip

```css
.chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px; font-weight: 600;
  border: 1px solid currentColor;
  background: var(--bg);
}
.chip-active   { color: var(--status-warning); background: var(--status-warning-soft); }
.chip-progress { color: var(--status-info);    background: var(--status-info-soft); }
.chip-success  { color: var(--status-success); background: var(--status-success-soft); }
.chip-danger   { color: var(--status-danger);  background: var(--status-danger-soft); }
.chip-muted    { color: var(--status-muted);   background: var(--status-muted-soft); }
.chip-ack      { color: var(--status-acknowledged); background: var(--status-ack-soft); }
```

### 4.6 KPI Tile

```css
.kpi-tile {
  background: var(--brand-white);
  border: 1px solid var(--brand-border);
  border-radius: 12px;
  padding: 16px;
  display: flex; flex-direction: column; gap: 6px;
  cursor: pointer; transition: var(--transition-fast);
}
.kpi-tile:hover {
  border-color: var(--brand-amber);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(15,23,42,0.08);
}
.kpi-tile .icon { color: var(--brand-amber); }
.kpi-tile .value {
  font-size: 28px; font-weight: 800; color: var(--brand-navy);
  font-variant-numeric: tabular-nums;
}
.kpi-tile .label { font-size: 12px; color: var(--brand-navy-500); }
.kpi-tile.critical { border-color: var(--status-danger); }
.kpi-tile.critical .value { color: var(--status-danger); }
```

### 4.7 Banner / Alert bar

```css
.banner {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px; font-weight: 500;
}
.banner-info     { background: var(--status-info-soft);    color: #1e40af; }
.banner-warning  { background: var(--status-warning-soft); color: #92400e; }
.banner-danger   { background: var(--status-danger-soft);  color: #991b1b; }
.banner-draft    { background: var(--brand-amber-100);     color: var(--brand-amber-on); }
```

---

## 5. Layout Tokens

```css
--header-h: 56px;
--sidebar-w: 240px;
--sidebar-w-collapsed: 72px;
--content-max: 1280px;
--gutter: 24px;
```

---

## 6. Print

```css
@page { size: A4 portrait; margin: 2cm 2cm 2.5cm 3cm; }
@media print {
  body { background: white; color: black; }
  .no-print { display: none !important; }
  .print-only { display: block !important; }
}
```

Print typography: `'TH Sarabun PSK', 'Sarabun', 'Noto Sans Thai', serif` 16pt body / 18pt heading

---

## 7. Implementation Checklist

ก่อนถือว่าหน้าเสร็จ:

- [ ] ไม่มี emoji ใน HTML markup (ยกเว้น textarea/input content ที่ user พิมพ์)
- [ ] ทุก icon เป็น Lucide (`<i data-lucide="...">`)
- [ ] เรียก `refreshIcons()` หลัง render dynamic content
- [ ] CTA primary ใช้ `--brand-amber` background, navy text
- [ ] Header/sidebar bg = `--brand-navy` (white text)
- [ ] Content/card surface = `--brand-white`
- [ ] Page bg = `--brand-bg` (#f8fafc)
- [ ] ไม่มี hardcoded color hex ใน inline style → ใช้ CSS variables
- [ ] Hover state primary CTA = `--brand-amber-500`
- [ ] Status badges ใช้ status tokens (ไม่ใช่ brand)

---

## 8. Files

**ลำดับ `<link>` ห้ามสลับ** — `ds-tokens` ต้องมาก่อนเสมอ

| ไฟล์ | เนื้อหา |
|---|---|
| `public/css/ds-tokens.css` | ⭐ `:root` เดียวจบ — สี typography spacing radius shadow layout z-index (**แก้สีแบรนด์ที่นี่ที่เดียว**) |
| `public/css/ds-base.css` | reset · body · scrollbar · keyframes · utility ไอคอน (`.mi` `.icon-*`) |
| `public/css/ds-navbar.css` | `.mc-navbar` + dropdown + user chip |
| `public/css/ds-layout.css` | `.page-container` · `.ds-shell` (2/3 คอลัมน์) · `.ds-context-bar` · `.ds-list-card` |
| `public/css/ds-components.css` | ปุ่ม การ์ด KPI ตาราง 3 แบบ ฟอร์ม banner chip badge tab stepper timeline empty spinner |
| `public/css/ds-overlays.css` | drawer · modal · confirm · toast · page overlay |
| `public/css/ds-print.css` | A4 print + `.ds-paper` |
| `public/css/ds-landing.css` | hero · stat bar · module card · flow track · login (**เฉพาะหน้าแรก**) |
| `public/css/ds-portal.css` | hero · KPI grid · การ์ดงาน · ปฏิทินรายสัปดาห์ (**เฉพาะหน้า portal** — ธีมย่อยสี `--primary` แทน amber) |

| ไฟล์ JS | หน้าที่ |
|---|---|
| `public/js/ds/ds-auth.js` | Auth + ห่อ `window.fetch` — **ต้องเป็น script แรกของทุกหน้า** |
| `public/js/ds/ds-navbar.js` | navbar + `DS_MENU` (แก้เมนูที่นี่ที่เดียว) + inline SVG ไม่พึ่ง CDN |
| `public/js/ds/ds-drawer.js` | `Drawer.open/close/confirm` |
| `public/js/ds/ds-toast.js` | `showToast()` |
| `public/js/ds/ds-icons.js` | `refreshIcons()` — โหลด Lucide แบบ lazy |
| `public/js/ds/ds-doc-print.js` | พรีวิวใบพิมพ์ A4 ใน drawer (ซูม/ลาก) + สั่งพิมพ์ + เตือนช่องว่าง |
| `public/js/ds/ds-doc-parts.js` | ชิ้นส่วนใบพิมพ์ — หัวกระดาษ / footer ทุกหน้า / ช่องลงชื่อ / เติมแถวว่าง |

> ที่มา: สกัดจาก `medicore_ipd/design-system/` ซึ่งรวมโทเคนที่เดิมกระจายอยู่ 6 ไฟล์
> (`design-tokens` / `theme-bridge` / `smart-ipd-tokens` / `doctor` / `hub` / `main`)
> และทับกันเองจนค่าที่ได้จริงขึ้นกับลำดับ `<link>` ของแต่ละหน้า
