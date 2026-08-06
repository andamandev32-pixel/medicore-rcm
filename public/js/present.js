/* ────────────────────────────────────────────────────────
   สไลด์นำเสนอ — กลไกการเลื่อนหน้า

   ยืมกลไกจาก doc/Executive_Summary_Claim_Intelligence_4_Pages.html
   ที่พิสูจน์แล้วว่าใช้งานได้จริงบนโปรเจกเตอร์:
     · PageDown/PageUp สำคัญกว่าลูกศร — presenter clicker ส่งปุ่มพวกนี้
     · #page-N ใน URL ทำให้ deep link ได้ และกด F5 กลางการนำเสนอไม่หลุด
     · @media print ใน ds-present.css ทำให้ Ctrl+P ได้ PDF ทันที ไม่ต้องมีปุ่ม export
   ──────────────────────────────────────────────────────── */

const Deck = {

    current: 0,
    slides: [],
    dots: [],

    init() {
        this.render();
        this.slides = Array.prototype.slice.call(document.querySelectorAll('.pr-slide'));

        const box = document.getElementById('dots');
        box.innerHTML = this.slides.map((s, i) =>
            `<button class="pr-dot" type="button" aria-label="สไลด์ ${i + 1}" onclick="Deck.show(${i})"></button>`).join('');
        this.dots = Array.prototype.slice.call(box.children);

        document.getElementById('prev').onclick = () => this.show(this.current - 1);
        document.getElementById('next').onclick = () => this.show(this.current + 1);

        document.addEventListener('keydown', (e) => {
            if (['ArrowRight', 'PageDown', ' '].indexOf(e.key) > -1) { e.preventDefault(); this.show(this.current + 1); }
            if (['ArrowLeft', 'PageUp'].indexOf(e.key) > -1)         { e.preventDefault(); this.show(this.current - 1); }
            if (e.key === 'Home') this.show(0);
            if (e.key === 'End')  this.show(this.slides.length - 1);
        });

        const hash = location.hash.match(/page-(\d+)/);
        this.show(hash ? Number(hash[1]) - 1 : 0);
    },

    /**
     * s.k = ตัวคูณขนาดตัวอักษรของสไลด์นั้น (ดู --u ใน ds-present.css)
     * หน้าที่มีตารางยาวหรือการ์ดหลายชั้นใช้ค่าน้อยกว่า 1 เพื่อไม่ให้ล้นกรอบ 16:9
     */
    render() {
        document.getElementById('deck').innerHTML = PRESENT_SLIDES.map((s, i) => `
            <section class="pr-slide ${s.accent ? 'accent' : ''}"${s.k ? ` style="--k:${s.k}"` : ''}>
                <div class="pr-inner">
                    ${s.eyebrow ? `<div class="pr-eyebrow">${s.eyebrow}</div>` : ''}
                    ${s.title   ? `<h2>${s.title}</h2>` : ''}
                    ${s.lead    ? `<p class="pr-lead">${s.lead}</p>` : ''}
                    <div class="pr-body">${s.body || ''}</div>
                    <div class="pr-foot">
                        <span>${s.foot || 'เอกสารเพื่อการพิจารณาร่วมกับโรงพยาบาล'}</span>
                        <span>${i + 1} / ${PRESENT_SLIDES.length}</span>
                    </div>
                </div>
            </section>`).join('');
    },

    show(i) {
        this.current = Math.max(0, Math.min(this.slides.length - 1, i));
        this.slides.forEach((s, n) => s.classList.toggle('active', n === this.current));
        this.dots.forEach((d, n) => d.classList.toggle('active', n === this.current));
        document.getElementById('counter').textContent = (this.current + 1) + ' / ' + this.slides.length;
        document.getElementById('prev').disabled = this.current === 0;
        document.getElementById('next').disabled = this.current === this.slides.length - 1;
        history.replaceState(null, '', '#page-' + (this.current + 1));
    },

    toggleFullscreen() {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    },
};

window.Deck = Deck;
document.addEventListener('DOMContentLoaded', () => Deck.init());
