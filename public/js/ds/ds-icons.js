/* ============================================================
   MediCore Design System — ICONS
   ------------------------------------------------------------
   ระบบไอคอน = Lucide เท่านั้น  ·  ห้ามใช้ emoji ใน UI
   (ยกเว้นเนื้อหาที่ผู้ใช้พิมพ์เอง เช่น ช่องข้อความ)

   วิธีใช้ใน HTML:
     <i data-lucide="pill" class="mi"></i>        ← ขนาดตามฟอนต์รอบข้าง
     <i data-lucide="pill" class="icon-md"></i>   ← ขนาดคงที่ 16px

   ⚠️ หลัง render เนื้อหาใหม่ด้วย innerHTML ต้องเรียก refreshIcons() เสมอ
      ไม่งั้นไอคอนที่เพิ่งใส่จะไม่ถูกแปลงเป็น SVG

   วิธีใช้ใน JS:
     el.innerHTML = DSIcons.html('pill', { cls: 'icon-lg icon-amber' });
     refreshIcons();
   ============================================================ */

(function () {
    /* ลำดับการโหลด: ไฟล์ในเครื่องก่อน → CDN เป็นตัวสำรอง
       ⚠️ ห้ามสลับลำดับ — การนำเสนอบน wifi สถานที่จัดงานต้องไม่พึ่งอินเทอร์เน็ต
          ถ้าโหลดจาก CDN อย่างเดียว เน็ตล่มเมื่อไหร่ไอคอนหายทั้งระบบ
          (navbar รอดเพราะใช้ inline DS_ICONS แต่เนื้อหาในหน้าจะเป็นช่องว่างหมด)
       อัปเดตไฟล์ในเครื่อง: curl -sSL https://unpkg.com/lucide@latest/dist/umd/lucide.min.js -o public/js/vendor/lucide.min.js */
    const LOCAL = 'js/vendor/lucide.min.js';
    const CDN   = 'https://unpkg.com/lucide@latest';
    let loading = null;

    function inject(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                if (window.lucide) { resolve(window.lucide); return; }
                existing.addEventListener('load',  () => resolve(window.lucide));
                existing.addEventListener('error', reject);
                return;
            }
            const s = document.createElement('script');
            s.src = src;
            s.onload  = () => (window.lucide ? resolve(window.lucide) : reject(new Error('no lucide')));
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    /** โหลด Lucide — ในเครื่องก่อน แล้วค่อย CDN (คืน Promise) */
    function load() {
        if (window.lucide) return Promise.resolve(window.lucide);
        if (loading) return loading;
        loading = inject(LOCAL)
            .catch(() => inject(CDN))
            .catch(() => {
                console.warn('[DSIcons] โหลด Lucide ไม่สำเร็จทั้งในเครื่องและ CDN — ไอคอนจะไม่แสดง '
                           + '(navbar ยังใช้ inline SVG จึงยังปกติ)');
                return null;
            });
        return loading;
    }

    /** แปลง <i data-lucide> ทั้งหมดในหน้าให้เป็น SVG */
    function render() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
            return true;
        }
        return false;
    }

    /** โหลด (ถ้าจำเป็น) แล้ว render */
    function refresh() {
        if (render()) return Promise.resolve(true);
        return load().then(() => render());
    }

    /** สร้าง markup ไอคอนสำหรับต่อสตริง HTML */
    function html(name, opts = {}) {
        const cls = opts.cls || opts.class || 'mi';
        const size = opts.size ? ` style="width:${opts.size}px;height:${opts.size}px"` : '';
        const title = opts.title ? ` title="${String(opts.title).replace(/"/g, '&quot;')}"` : '';
        return `<i data-lucide="${name}" class="${cls}"${size}${title}></i>`;
    }

    window.DSIcons = { load, render, refresh, html };
    window.refreshIcons = refresh;

    document.addEventListener('DOMContentLoaded', () => refresh());
})();
