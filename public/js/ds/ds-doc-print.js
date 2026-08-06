/**
 * MediCore Design System — DOC PRINT
 * ------------------------------------------------------------
 * ขั้นตอนพิมพ์เอกสารมาตรฐานของทั้งระบบ:
 *
 *     กดปุ่มพิมพ์ → drawer พรีวิวกระดาษ A4 (ซูม/ลากได้) → กด "พิมพ์" → ออกเครื่องพิมพ์
 *
 * ทุกเอกสารในโปรเจคต้องใช้เส้นทางนี้ ห้ามเรียก window.print() ตรง —
 * ไม่งั้นผู้ใช้จะเสียกระดาษกับเอกสารที่กรอกไม่ครบหรือจัดหน้าเพี้ยน
 *
 * วิธีใช้:
 *   DocPrint.preview({
 *     title: 'ตัวอย่างก่อนพิมพ์ — ทะเบียนรายการ',
 *     html:  buildReportHtml(rows),      // string หรือ () => string
 *     warnings: ['ยังไม่ได้ระบุผู้รับผิดชอบ 2 รายการ'],   // optional
 *   });
 *
 * ต้องโหลดคู่กับ: ds-drawer.js · ds-doc-parts.js · ds-print.css
 */
(function () {

    const VP_ID    = 'dsPaperVp';
    const PAPER_ID = 'dsPaperSheet';
    const STAGE_ID = 'dsPrintStage';

    const ZOOM_MIN = 0.4, ZOOM_MAX = 2.0, ZOOM_STEP = 0.1;

    let _html = '';
    let _zoom = 0.9;

    /* เคลียร์ stage หลังพิมพ์เสมอ — ไม่งั้น DOM บวมขึ้นทุกครั้งที่กดพิมพ์
       ผูกตั้งแต่โหลดไฟล์ ไม่ผูกตอน print() ครั้งแรก เพราะถ้ามีใครใส่เนื้อหาลง
       #dsPrintStage เองโดยไม่ผ่าน print() จะไม่มีใครเก็บกวาดให้
       (afterprint ยิงทั้งตอนพิมพ์จริงและตอนผู้ใช้กดยกเลิกในกล่องพิมพ์) */
    window.addEventListener('afterprint', () => {
        document.body.classList.remove('ds-printing');
        const s = document.getElementById(STAGE_ID);
        if (s) s.innerHTML = '';
    });

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const resolve = (h) => (typeof h === 'function' ? h() : (h || ''));

    /* ── ซูม ── */
    function applyZoom() {
        const sheet = document.getElementById(PAPER_ID);
        if (sheet) sheet.style.transform = `scale(${_zoom})`;
        const lbl = document.getElementById('dsZoomLabel');
        if (lbl) lbl.textContent = Math.round(_zoom * 100) + '%';
    }

    function setZoom(delta) {
        _zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, _zoom + delta));
        applyZoom();
    }

    /* ── ลากเลื่อนกระดาษ + Ctrl+scroll ซูม ── */
    function bindPan(vp) {
        let down = false, sx = 0, sy = 0, sl = 0, st = 0;

        vp.addEventListener('mousedown', (e) => {
            if (e.target.closest('button, a, input, select, textarea')) return;
            down = true;
            sx = e.pageX; sy = e.pageY; sl = vp.scrollLeft; st = vp.scrollTop;
            vp.classList.add('is-panning');
            e.preventDefault();     // กันการลากเลือกข้อความระหว่าง pan
        });
        // ผูกที่ window ไม่ใช่ vp — ปล่อยเมาส์นอกกรอบแล้วต้องหยุดลากด้วย
        window.addEventListener('mouseup', () => { down = false; vp.classList.remove('is-panning'); });
        vp.addEventListener('mousemove', (e) => {
            if (!down) return;
            vp.scrollLeft = sl - (e.pageX - sx);
            vp.scrollTop  = st - (e.pageY - sy);
        });
        vp.addEventListener('wheel', (e) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            setZoom(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
        }, { passive: false });
    }

    /* ── กล่องสรุปความครบถ้วน ── */
    function warningBox(warnings) {
        if (!warnings || !warnings.length) {
            return `<div class="sip-banner sip-banner-success" style="margin-bottom:8px;">
        <i data-lucide="check-circle-2" class="icon-sm"></i> ข้อมูลครบถ้วน</div>`;
        }
        return `<div class="sip-banner sip-banner-danger" style="margin-bottom:8px;display:block;">
      <div style="font-weight:700;margin-bottom:4px;">
        <i data-lucide="alert-triangle" class="icon-sm"></i>
        พบ ${warnings.length} จุดที่ยังไม่ได้กรอก
      </div>
      <ul style="margin:0 0 0 18px;padding:0;font-size:12px;">
        ${warnings.map(w => `<li>${esc(w)}</li>`).join('')}
      </ul>
    </div>`;
    }

    const DocPrint = {

        /** เปิด drawer พรีวิว */
        preview(opts) {
            opts = opts || {};
            if (!window.Drawer) { console.error('[DocPrint] ต้องโหลด ds-drawer.js ก่อน'); return; }

            _html = resolve(opts.html);
            _zoom = opts.zoom || 0.9;
            const hasWarn = !!(opts.warnings && opts.warnings.length);

            window.Drawer.open({
                title: opts.title || 'ตัวอย่างก่อนพิมพ์',
                width: opts.width || 'min(940px, 94vw)',
                contentHtml: `
          ${warningBox(opts.warnings)}
          ${opts.toolbarHtml || ''}
          <div style="display:flex;gap:8px;align-items:center;padding:6px 2px 8px;
                      border-bottom:1px solid var(--brand-border);margin-bottom:8px;">
            <button class="btn-row" onclick="DocPrint.zoomOut()" title="ย่อ">
              <i data-lucide="zoom-out" class="icon-sm"></i></button>
            <span id="dsZoomLabel" style="min-width:46px;text-align:center;font-weight:700;font-size:12.5px;">90%</span>
            <button class="btn-row" onclick="DocPrint.zoomIn()" title="ขยาย">
              <i data-lucide="zoom-in" class="icon-sm"></i></button>
            <button class="btn-row" onclick="DocPrint.zoomReset()">
              <i data-lucide="maximize" class="icon-sm"></i> พอดี</button>
            <span style="font-size:11px;color:var(--text-muted);margin-left:auto;">
              ลากเพื่อเลื่อน · Ctrl+scroll ซูม</span>
          </div>
          <div class="ds-paper-viewport" id="${VP_ID}">
            <div class="ds-paper" id="${PAPER_ID}">${_html}</div>
          </div>`,
                footerHtml: `
          <button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>
          <button class="btn ${hasWarn ? 'btn-danger' : 'btn-primary'}" onclick="DocPrint.print()">
            <i data-lucide="printer" class="icon-sm"></i> พิมพ์
          </button>`,
                onOpen: () => {
                    if (window.refreshIcons) refreshIcons();
                    applyZoom();
                    const vp = document.getElementById(VP_ID);
                    if (vp) bindPan(vp);
                },
            });
        },

        /** เปลี่ยนเนื้อเอกสารในที่เดิม — ใช้ตอนสลับตัวเลือก (เรียงใหม่/กรองใหม่) โดยไม่ปิด drawer */
        rerender(html) {
            _html = resolve(html);
            const sheet = document.getElementById(PAPER_ID);
            if (sheet) sheet.innerHTML = _html;
            if (window.refreshIcons) refreshIcons();
            applyZoom();
        },

        zoomIn()    { setZoom(ZOOM_STEP); },
        zoomOut()   { setZoom(-ZOOM_STEP); },
        zoomReset() { _zoom = 0.9; applyZoom(); },

        /**
         * สั่งพิมพ์จริง — ยัดเอกสารลง #dsPrintStage แล้วสลับ body.ds-printing
         * (สูตร @media print อยู่ใน ds-print.css แล้ว ไม่ต้องฉีด <style> ตอนรันไทม์)
         */
        print(html) {
            const content = html ? resolve(html) : _html;
            if (!content) { console.warn('[DocPrint] ไม่มีเนื้อหาให้พิมพ์'); return; }

            let stage = document.getElementById(STAGE_ID);
            if (!stage) {
                stage = document.createElement('div');
                stage.id = STAGE_ID;
                document.body.appendChild(stage);
            }
            stage.innerHTML = content;
            document.body.classList.add('ds-printing');
            window.print();     // เก็บกวาดที่ listener afterprint ด้านบน
        },

        /**
         * helper สำหรับ build เอกสาร — คืนค่าที่จะแสดง และเก็บ label ไว้ใน warnings ถ้าว่าง
         * ใช้:  `<td class="${DocPrint.miss(v, 'ผู้รับผิดชอบ', warns)}">${v || ''}</td>`
         */
        miss(value, label, warnings) {
            const empty = value == null || String(value).trim() === '';
            if (empty && warnings) warnings.push(label);
            return empty ? 'ds-miss' : '';
        },
    };

    window.DocPrint = DocPrint;
})();
