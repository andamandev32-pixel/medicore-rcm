/* ────────────────────────────────────────────────────────
   ศูนย์รวมสไลด์นำเสนอ — present-hub.html

   การ์ดมาจากสองทะเบียน คนละที่ คนละอายุ:
     1. DS_DECKS      (ds-navbar.js)  — ชุดถาวรที่อยู่ใน repo · เมนู "นำเสนอ" อ่านที่เดียวกัน
     2. dsUserDecks() (localStorage)  — ชุดที่ผู้ใช้เพิ่มเองจากปุ่มในหน้านี้

   ⚠️ ห้าม hardcode จำนวนชุดหรือจำนวนหน้า — derive จากทะเบียนทั้งสอง
      (PAGE-GUIDE §7B: ตัวเลขที่คำนวณได้ห้ามพิมพ์ค้างไว้)

   ⚠️ ชุดที่เพิ่มเองอยู่แค่ในเบราว์เซอร์เครื่องนี้ — หน้าเว็บเขียนคำเตือนไว้แล้ว
      อย่าเอาออก เพราะถ้าไปนำเสนอด้วยเครื่องอื่นแล้วชุดหาย จะหาสาเหตุไม่เจอ
   ──────────────────────────────────────────────────────── */

const PresentHub = {

    init() {
        if (window.MockSession && typeof MockSession.mountBanner === 'function') {
            MockSession.mountBanner('demoBanner');
        }
        this.render();

        // Esc ปิด modal — แพทเทิร์นเดียวกับ overlay อื่นในระบบ
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAdd();
        });
    },

    /** ชุดถาวร — ถ้า ds-navbar.js ยังไม่โหลดให้คืนอาร์เรย์ว่างแทนที่จะ throw */
    decks() { return Array.isArray(window.DS_DECKS) ? DS_DECKS : []; },

    /** ชุดที่เพิ่มเอง — อ่านผ่าน helper ของ ds-navbar เท่านั้น ห้ามแตะ localStorage ตรง ๆ */
    userDecks() { return typeof window.dsUserDecks === 'function' ? dsUserDecks() : []; },

    /** รายงานฉบับเต็ม — เอกสารบนเว็บ ไม่ใช่สไลด์ จึงไม่นับรวมจำนวนหน้า */
    reports() { return Array.isArray(window.DS_REPORTS) ? DS_REPORTS : []; },

    render() {
        const decks = this.decks();
        const mine  = this.userDecks();
        const pages = [...decks, ...mine].reduce((a, d) => a + (Number(d.count) || 0), 0);
        const total = decks.length + mine.length;

        document.getElementById('hubSubtitle').textContent =
            `${total} ชุด · รวม ${pages} หน้า — เลือกชุดที่ตรงกับผู้ฟังและเวลาที่มี`;

        document.getElementById('hubCount').innerHTML =
            `<span class="sip-chip sip-chip-muted">${esc(decks.length)} ชุด</span>
             <span class="sip-chip sip-chip-muted">${esc(decks.reduce((a, d) => a + (Number(d.count) || 0), 0))} หน้า</span>`;

        const box = document.getElementById('deckCards');
        box.innerHTML = decks.length
            ? this.gridHtml(decks.map(d => this.cardHtml(d)))
            : '<div class="ds-empty">ยังไม่มีชุดสไลด์ที่ลงทะเบียนไว้</div>';

        this.renderReports();
        this.renderUserDecks(mine);
        refreshIcons();
    },

    renderReports() {
        const rs = this.reports();
        document.getElementById('reportCount').innerHTML =
            `<span class="sip-chip sip-chip-muted">${esc(rs.length)} เล่ม</span>`;
        document.getElementById('reportCards').innerHTML = this.gridHtml(rs.map(r => `
            <div class="card" style="display:flex;flex-direction:column;gap:10px">
                <div style="display:flex;align-items:flex-start;gap:10px">
                    <span class="ds-dot ds-dot-green" style="margin-top:7px"></span>
                    <div style="flex:1;min-width:0">
                        <div class="card-title" style="margin:0">${esc(r.label)}</div>
                        <div class="td-sub">${esc(r.date)} · เอกสารฉบับเต็ม ↗</div>
                    </div>
                </div>
                <div class="td-sub" style="line-height:1.6">
                    <b>${esc(r.title)}</b><br>${esc(r.desc)}
                </div>
                <div class="btn-row" style="margin-top:auto">
                    <button class="btn btn-save btn-block"
                            onclick="window.open('${esc(r.href)}','_blank','noopener')">
                        <i data-lucide="book-open" class="icon-sm"></i> อ่านรายงาน
                    </button>
                    <button class="btn btn-outline" onclick="location.href='${esc(r.deck)}'"
                            title="เปิดเป็นสไลด์สำหรับฉายบนจอ">
                        <i data-lucide="presentation" class="icon-sm"></i>
                    </button>
                </div>
            </div>`));
    },

    renderUserDecks(mine) {
        const sec = document.getElementById('userDeckSection');
        sec.style.display = mine.length ? '' : 'none';
        if (!mine.length) return;

        /* เตือนเมื่อลิงก์ซ้ำกับการ์ดถาวร — เกิดตอนผู้ใช้เพิ่มเองไว้ก่อน แล้วต่อมาลิงก์นั้น
           ถูกลงทะเบียนถาวร · เทียบโดยตัด query string ทิ้ง (?via=auto_preview ฯลฯ) */
        const bare = (h) => String(h || '').split(/[?#]/)[0];
        const perm = new Set([...this.decks(), ...this.reports()].map(d => bare(d.href)));
        const dupe = mine.filter(d => perm.has(bare(d.href)));

        document.getElementById('userDeckDupeNote').innerHTML = dupe.length ? `
            <div class="ds-warn" style="margin-bottom:12px">
                <i data-lucide="alert-triangle" class="icon-sm"></i>
                <span><b>${esc(dupe.length)} รายการซ้ำกับการ์ดถาวรด้านบนแล้ว</b> —
                รายการเหล่านี้ขึ้นทะเบียนในระบบเรียบร้อย ทุกคนที่เปิดเว็บเห็นเหมือนกัน
                จึงไม่ต้องเก็บไว้ในเบราว์เซอร์อีก · กด <b>ล้างทั้งหมด</b> ได้เลย</span>
            </div>` : '';

        document.getElementById('userDeckCount').innerHTML =
            `<span class="sip-chip sip-chip-muted">${esc(mine.length)} ชุด</span>
             <span class="sip-chip sip-chip-muted">เก็บในเบราว์เซอร์นี้</span>`;

        document.getElementById('userDeckCards').innerHTML =
            this.gridHtml(mine.map(d => this.cardHtml(d, true)));
    },

    clearUserDecks() {
        const n = this.userDecks().length;
        if (!n) return;
        if (!confirm(`ล้างชุดที่เพิ่มเองทั้ง ${n} รายการ?\n\nลบเฉพาะรายการในเบราว์เซอร์นี้ ไม่ได้ลบไฟล์หรือลิงก์ปลายทาง`)) return;
        if (!dsSaveUserDecks([])) { DSToast.error('ล้างไม่สำเร็จ — เบราว์เซอร์ปิด localStorage'); return; }
        this.render();
        DSToast.success('ล้างแล้ว');
    },

    gridHtml(cards) {
        return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px">
                    ${cards.join('')}
                </div>`;
    },

    /** @param {boolean} mine — การ์ดของชุดที่เพิ่มเอง จะมีปุ่มแก้ไข/ลบ และป้ายกำกับต่างสี */
    cardHtml(d, mine) {
        const tags = (d.tags || []).map(t =>
            `<span class="sip-chip sip-chip-muted">${esc(t)}</span>`).join('');
        const ext  = typeof window.dsIsExternal === 'function' ? dsIsExternal(d.href) : false;
        const open = ext ? `window.open('${esc(d.href)}','_blank','noopener')`
                         : `location.href='${esc(d.href)}'`;

        return `
        <div class="card" style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:flex-start;gap:10px">
                <span class="ds-dot ${mine ? 'ds-dot-amber' : 'ds-dot-blue'}" style="margin-top:7px"></span>
                <div style="flex:1;min-width:0">
                    <div class="card-title" style="margin:0">
                        ${esc(d.label)}
                        ${d.badge ? `<span class="mc-di-badge ${esc(d.badge.type || 'new')}"
                                       style="margin-left:6px">${esc(d.badge.text)}</span>` : ''}
                        ${mine ? '<span class="mc-di-badge new" style="margin-left:6px">เพิ่มเอง</span>' : ''}
                    </div>
                    <div class="td-sub">
                        ${d.count ? esc(d.count) + ' หน้า · ' : ''}${esc(d.href)}
                        ${ext ? ' <span title="เปิดแท็บใหม่">↗</span>' : ''}
                    </div>
                </div>
            </div>

            ${d.desc ? `<div class="td-sub" style="line-height:1.6">${esc(d.desc)}</div>` : ''}
            ${tags ? `<div class="ds-chips">${tags}</div>` : ''}

            <div class="btn-row" style="margin-top:auto">
                <button class="btn btn-save btn-block" onclick="${open}">
                    <i data-lucide="play" class="icon-sm"></i> เปิดสไลด์
                </button>
                ${mine ? `
                <button class="btn btn-outline" onclick="PresentHub.openAdd('${esc(d.id)}')" title="แก้ไข">
                    <i data-lucide="pencil" class="icon-sm"></i>
                </button>
                <button class="btn btn-outline" onclick="PresentHub.removeDeck('${esc(d.id)}')"
                        title="ลบชุดนี้ออกจากเบราว์เซอร์นี้">
                    <i data-lucide="trash-2" class="icon-sm"></i>
                </button>` : `
                <button class="btn btn-outline"
                        onclick="window.open('${esc(d.href)}','_blank','noopener')"
                        title="เปิดในแท็บใหม่ — ใช้ตอนต้องสลับกลับมาที่ระบบต้นแบบระหว่างนำเสนอ">
                    <i data-lucide="external-link" class="icon-sm"></i>
                </button>`}
            </div>
        </div>`;
    },

    /* ── เพิ่ม / แก้ไข ────────────────────────────────────────── */

    /** @param {string} [id] — ส่ง id = โหมดแก้ไข · ไม่ส่ง = เพิ่มใหม่ */
    openAdd(id) {
        const d = id ? this.userDecks().find(x => x.id === id) : null;

        document.getElementById('deckModalTitle').textContent = d ? 'แก้ไขชุดสไลด์' : 'เพิ่มชุดสไลด์';
        document.getElementById('deckEditId').value = d ? d.id : '';
        document.getElementById('deckLabel').value  = d ? d.label : '';
        document.getElementById('deckHref').value   = d ? d.href : '';
        document.getElementById('deckDesc').value   = d ? (d.desc || '') : '';
        document.getElementById('deckCount').value  = d && d.count ? d.count : '';
        document.getElementById('deckTags').value   = d && d.tags ? d.tags.join(', ') : '';

        document.getElementById('deckModal').classList.add('active');
        document.getElementById('deckLabel').focus();
        refreshIcons();
    },

    closeAdd() { document.getElementById('deckModal').classList.remove('active'); },

    saveAdd() {
        const val = (id) => document.getElementById(id).value.trim();
        const label = val('deckLabel');
        let   href  = val('deckHref');

        if (!label) { DSToast.error('ต้องระบุชื่อชุด'); return; }
        if (!href)  { DSToast.error('ต้องระบุลิงก์'); return; }

        /* กัน javascript: / data: ที่รันโค้ดได้เมื่อกดเปิด — อนุญาตเฉพาะ http(s) กับพาธในระบบ
           (หน้านี้ไม่มี auth แต่ผู้ใช้อาจวางลิงก์ที่ก๊อปมาจากที่อื่นโดยไม่ดู) */
        if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^https?:/i.test(href)) {
            DSToast.error('ลิงก์ต้องเป็น https:// หรือชื่อไฟล์ในระบบ เช่น present-report-1.html');
            return;
        }
        if (!/^https?:/i.test(href) && !/\.html?($|[?#])/i.test(href)) href += '.html';

        const list = this.userDecks();
        const id   = document.getElementById('deckEditId').value
                  || 'ud' + Date.now().toString(36);

        const entry = {
            id, label, href,
            desc:  val('deckDesc'),
            count: Number(val('deckCount')) || 0,
            tags:  val('deckTags').split(',').map(s => s.trim()).filter(Boolean).slice(0, 8),
        };

        const at = list.findIndex(x => x.id === id);
        if (at >= 0) list[at] = entry; else list.push(entry);

        if (!dsSaveUserDecks(list)) {
            DSToast.error('บันทึกไม่สำเร็จ — เบราว์เซอร์ปิด localStorage หรือพื้นที่เต็ม');
            return;
        }

        this.closeAdd();
        this.render();
        DSToast.success(at >= 0 ? 'แก้ไขชุดสไลด์แล้ว' : 'เพิ่มชุดสไลด์แล้ว — รีเฟรชหน้าเพื่อให้ขึ้นในเมนูนำเสนอ');
    },

    removeDeck(id) {
        const d = this.userDecks().find(x => x.id === id);
        if (!d) return;
        if (!confirm(`ลบ “${d.label}” ออกจากรายการ?\n\nลบเฉพาะรายการในหน้านี้ ไม่ได้ลบตัวไฟล์สไลด์`)) return;

        if (!dsSaveUserDecks(this.userDecks().filter(x => x.id !== id))) {
            DSToast.error('ลบไม่สำเร็จ — เบราว์เซอร์ปิด localStorage');
            return;
        }
        this.render();
        DSToast.success('ลบแล้ว');
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.PresentHub = PresentHub;
document.addEventListener('DOMContentLoaded', () => PresentHub.init());
