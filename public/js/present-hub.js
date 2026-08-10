/* ────────────────────────────────────────────────────────
   ศูนย์รวมสไลด์นำเสนอ — present-hub.html

   หน้านี้ไม่มีเนื้อหาของตัวเอง ทุกการ์ด generate จาก DS_DECKS
   ใน ds-navbar.js ซึ่งเป็นทะเบียนเดียวกับที่เมนู "นำเสนอ" อ่าน
   เพิ่มสไลด์ชุดใหม่ที่นั่นที่เดียว แล้วขึ้นทั้งเมนูและหน้านี้พร้อมกัน

   ⚠️ ห้าม hardcode จำนวนชุดหรือจำนวนหน้า — derive จาก DS_DECKS
      (PAGE-GUIDE §7B: ตัวเลขที่คำนวณได้ห้ามพิมพ์ค้างไว้)
   ──────────────────────────────────────────────────────── */

const PresentHub = {

    init() {
        if (window.MockSession && typeof MockSession.mountBanner === 'function') {
            MockSession.mountBanner('demoBanner');
        }
        this.render();
    },

    /** ทะเบียนสไลด์ — ถ้า ds-navbar.js ยังไม่โหลดให้คืนอาร์เรย์ว่างแทนที่จะ throw */
    decks() { return Array.isArray(window.DS_DECKS) ? DS_DECKS : []; },

    render() {
        const decks  = this.decks();
        const pages  = decks.reduce((a, d) => a + (Number(d.count) || 0), 0);

        document.getElementById('hubSubtitle').textContent =
            `${decks.length} ชุด · รวม ${pages} หน้า — เลือกชุดที่ตรงกับผู้ฟังและเวลาที่มี`;

        document.getElementById('hubCount').innerHTML =
            `<span class="sip-chip sip-chip-muted">${esc(decks.length)} ชุด</span>
             <span class="sip-chip sip-chip-muted">${esc(pages)} หน้า</span>`;

        const box = document.getElementById('deckCards');
        if (!decks.length) {
            box.innerHTML = '<div class="ds-empty">ยังไม่มีชุดสไลด์ที่ลงทะเบียนไว้</div>';
            refreshIcons();
            return;
        }

        box.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px">
                ${decks.map(d => this.cardHtml(d)).join('')}
            </div>`;
        refreshIcons();
    },

    cardHtml(d) {
        const tags = (d.tags || []).map(t =>
            `<span class="sip-chip sip-chip-muted">${esc(t)}</span>`).join('');

        return `
        <div class="card" style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:flex-start;gap:10px">
                <span class="ds-dot ds-dot-blue" style="margin-top:7px"></span>
                <div style="flex:1;min-width:0">
                    <div class="card-title" style="margin:0">
                        ${esc(d.label)}
                        ${d.badge ? `<span class="mc-di-badge ${esc(d.badge.type || 'new')}"
                                       style="margin-left:6px">${esc(d.badge.text)}</span>` : ''}
                    </div>
                    <div class="td-sub">${esc(d.count)} หน้า · ${esc(d.href)}</div>
                </div>
            </div>

            <div class="td-sub" style="line-height:1.6">${esc(d.desc || '')}</div>

            ${tags ? `<div class="ds-chips">${tags}</div>` : ''}

            <div class="btn-row" style="margin-top:auto">
                <button class="btn btn-save btn-block"
                        onclick="location.href='${esc(d.href)}'">
                    <i data-lucide="play" class="icon-sm"></i> เปิดสไลด์
                </button>
                <button class="btn btn-outline"
                        onclick="window.open('${esc(d.href)}','_blank','noopener')"
                        title="เปิดในแท็บใหม่ — ใช้ตอนต้องสลับกลับมาที่ระบบต้นแบบระหว่างนำเสนอ">
                    <i data-lucide="external-link" class="icon-sm"></i>
                </button>
            </div>
        </div>`;
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.PresentHub = PresentHub;
document.addEventListener('DOMContentLoaded', () => PresentHub.init());
