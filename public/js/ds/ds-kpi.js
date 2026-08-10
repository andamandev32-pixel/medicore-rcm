/* ============================================================
   MediCore Design System — KPI GRID + DRILL-DOWN DRAWER
   ------------------------------------------------------------
   การ์ด KPI + drawer ที่ตอบ 2 คำถามเรียงกันตามลำดับที่คนถามจริง
     1. "ตัวเลขนี้มาจากเคสไหนบ้าง"  → ตารางรายการจริง (อยู่บนสุด)
     2. "คำนวณยังไง เชื่อได้ไหม"     → หมายเหตุใต้ตาราง
   ของเดิมมีแต่ข้อ 2 ผู้บริหารจึงต้องเดาต่อเองว่าเลข 13 คือเคสไหน

   ไฟล์นี้เป็น "ตัวเรนเดอร์ล้วน ๆ" ไม่รู้จัก MockKpi — หน้าเป็นคนส่ง defs
   และ resolve() เข้ามา เมื่อผูก backend จริงแล้วลบ js/mock/ ทิ้ง ไฟล์นี้ยังอยู่

   ต้องโหลดหลัง ds-drawer.js (ใช้ Drawer.open) และ ds-icons.js (ใช้ refreshIcons)

   วิธีใช้:
     DSKpi.configure({
       defs:      MockKpi.forPage('claim-dashboard'),
       ctx:       () => ({ rows: Dash.scope(), fund: … }),   // เรียกใหม่ทุกครั้งที่เปิด
       resolve:   (def, ctx) => MockKpi.rows(def, ctx),
       scopeLine: (def, ctx) => 'กองทุน: ทุกกองทุน · 47 เคส',
       sourceNote:'ชุดข้อมูลจำลองในต้นแบบ — …',
       note:      'ทุกตัวเลขบน Dashboard เจาะลงไปถึง… (BR-03)',
       drillText: 'ดูรายเคสทั้งหมด',
       cap:       20,
     });
     el.innerHTML = DSKpi.cards();      // การ์ดทั้งแถบ (ใส่ใน .ds-kpi-grid)
     el.innerHTML = DSKpi.footnote();   // หมายเหตุใต้แถบ (เฉพาะ KPI ที่ติด *)
     DSKpi.open('risk');                // เปิด drawer (markup เรียกเอง)
   ============================================================ */

(function () {

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /** ค่าของช่องหนึ่ง — col.html คืน HTML ดิบ (ผู้เขียน col เป็นคน esc เอง) ส่วน col.get ถูก esc ให้ */
    function cell(col, row) {
        if (col.html) return col.html(row) || '';
        const main = esc(col.get ? col.get(row) : '');
        const sub  = col.sub ? esc(col.sub(row)) : '';
        return sub ? `${main}<div class="td-sub">${sub}</div>` : main;
    }

    function align(col) { return col.align === 'r' ? 'text-align:right;' : col.align === 'c' ? 'text-align:center;' : ''; }

    /* ตัวจัดรูปแบบตัวเลขของไฟล์นี้เอง — ไม่พึ่ง MockFmt เพื่อให้ ds/ ไม่ผูกกับ mock/
       หน้าที่ต้องการรูปแบบอื่นส่ง cfg.fmt เข้ามาแทนได้ */
    function num(v) { return (Number(v) || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 }); }

    window.DSKpi = {

        _cfg: { defs: [], cap: 20 },

        configure(cfg) {
            this._cfg = Object.assign({ defs: [], cap: 20 }, cfg || {});
            return this;
        },

        defs() { return this._cfg.defs || []; },
        def(key) { return this.defs().find(d => d.key === key) || null; },

        _ctx()  { const f = this._cfg.ctx; return (typeof f === 'function' ? f() : f) || {}; },
        _rows(d, ctx) {
            const f = this._cfg.resolve;
            return (typeof f === 'function' ? f(d, ctx) : []) || [];
        },
        _num(v) { return (this._cfg.fmt || num)(v); },
        /* ตัวเลขบนการ์ด — ให้ฝั่งที่นิยาม KPI เป็นคนตัดสินว่า ctx ไหนใช้ได้
           (KPI บางตัวไม่สนตัวกรองของหน้า ถ้าปล่อยให้เรียก d.value(rows, ctx) ตรง ๆ
            วันหนึ่งจะมีคนเขียน value ที่อ่าน ctx.fund แล้วขัดกับ rows ที่ไม่ได้กรอง) */
        _value(d, rows, ctx) {
            const f = this._cfg.value;
            return typeof f === 'function' ? f(d, ctx) : d.value(rows, ctx);
        },

        /* ══════════ การ์ด ══════════ */

        /** markup เดิมทุกคลาส — ไม่มี CSS ใหม่ */
        cards() {
            const ctx = this._ctx();
            return this.defs().map(d => `
                <div class="sip-kpi ${d.critical ? 'critical' : ''}" style="cursor:pointer"
                     onclick="DSKpi.open('${esc(d.key)}')"
                     title="กดเพื่อดูรายการที่ประกอบเป็นตัวเลขนี้">
                    <i data-lucide="${esc(d.icon)}" class="sip-kpi-icon icon-lg"></i>
                    <div class="sip-kpi-value">${esc(this._value(d, this._rows(d, ctx), ctx))}</div>
                    <div class="sip-kpi-label">${esc(d.label)}${d.unverified
                        ? `<sup title="${esc(d.unverified)}">*</sup>` : ''}</div>
                </div>`).join('');
        },

        /**
         * หมายเหตุใต้แถบการ์ด — ของเดิม `*` มีแต่ tooltip ซึ่งบนโปรเจกเตอร์
         * ไม่มีใครเอาเมาส์ไปชี้ ข้อความเตือนจึงไม่เคยถูกอ่านจริง
         */
        footnote() {
            const marked = this.defs().filter(d => d.unverified);
            if (!marked.length) return '';       /* ไม่มีค่าที่ติด * → ไม่ต้องมีกล่องว่าง ๆ */
            return `<div class="ds-note" style="margin:-6px 0 16px">
                <i data-lucide="info" class="icon-sm"></i>
                <span>${marked.map(d =>
                    `<sup>*</sup> <strong>${esc(d.label)}</strong> — ${esc(d.unverified)}`).join('<br>')}</span>
            </div>`;
        },

        /* ══════════ drawer ══════════ */

        open(key) {
            const d = this.def(key); if (!d) return;
            const ctx  = this._ctx();
            const rows = this._rows(d, ctx);
            const cap  = this._cfg.cap || 20;
            const shown = rows.slice(0, cap);

            const head = d.cols.map(c =>
                `<th style="${align(c)}${c.nowrap ? 'white-space:nowrap;' : ''}">${esc(c.h)}</th>`).join('');

            const body = shown.map(r => `
                <tr style="cursor:pointer" title="เปิดรายละเอียด"
                    onclick="location.href='${esc(d.rowHref(r))}'">
                    ${d.cols.map(c => `<td style="${align(c)}${c.nowrap ? 'white-space:nowrap;' : ''}">`
                        + `${cell(c, r)}</td>`).join('')}
                </tr>`).join('');

            /* แถวรวม — KPI ที่เป็นจำนวนเงินต้องพิสูจน์ตัวเองได้ว่าบวกแล้วได้เลขบนการ์ดจริง */
            const total = d.totalOf ? `
                <tr style="background:var(--brand-bg-strong);font-weight:800">
                    <td colspan="${d.cols.length - 1}" style="text-align:right">
                        ${esc(d.totalLabel || 'รวม')}</td>
                    <td style="text-align:right;white-space:nowrap">
                        ${esc(this._num(rows.reduce((a, r) => a + (Number(d.totalOf(r)) || 0), 0)))}</td>
                </tr>` : '';

            const listHtml = rows.length ? `
                <div class="table-responsive">
                    <table class="data-table compact">
                        <thead><tr>${head}</tr></thead>
                        <tbody>${body}${total}</tbody>
                    </table>
                </div>
                ${rows.length > cap ? `<div class="td-sub" style="margin-top:6px">
                    แสดง ${cap} รายการแรกจาก ${rows.length} รายการ —
                    กด "${esc(this._cfg.drillText || 'ดูรายละเอียดต่อ')}" เพื่อดูครบทุกรายการ</div>` : ''}`
                : `<div class="sip-banner sip-banner-success">
                       <i data-lucide="check-circle-2" class="icon-sm"></i>
                       ไม่มีรายการค้างในขอบเขตที่เลือก</div>`;

            const scope = typeof this._cfg.scopeLine === 'function'
                ? this._cfg.scopeLine(d, ctx)
                : (d.scopeNote ? d.scopeNote() : rows.length + ' รายการ');

            Drawer.open({
                /* กว้างกว่าค่าเริ่มต้น 480px เพราะมีตาราง — ใช้พารามิเตอร์ที่ Drawer รองรับอยู่แล้ว
                   แบบเดียวกับ DocPrint.preview() จึงไม่ต้องเพิ่ม CSS */
                width: 'min(820px, 96vw)',
                title: 'ตัวเลขนี้มาจากไหน — ' + esc(d.label),
                contentHtml: `
                    <div style="font-size:34px;font-weight:800;color:var(--brand-navy);margin-bottom:4px">
                        ${esc(this._value(d, rows, ctx))}</div>
                    <div class="td-sub">${esc(d.label)}</div>
                    ${d.subline ? `<div class="td-sub" style="margin-top:2px">${esc(d.subline(rows, ctx))}</div>` : ''}

                    <div class="ds-section-label" style="margin:16px 0 8px">
                        รายการที่ประกอบเป็นตัวเลขนี้ · ${esc(this._num(rows.length))} รายการ</div>
                    ${listHtml}

                    <div class="ds-section-label" style="margin:18px 0 8px">หมายเหตุ — ที่มาของตัวเลข</div>
                    <table class="ds-table-grid">
                        <tbody>
                            <tr><td class="l" style="width:26%">วิธีคำนวณ</td><td class="l">${esc(d.how)}</td></tr>
                            <tr><td class="l">ฟิลด์ที่ใช้</td><td class="l">${(d.fields || []).map(f =>
                                `<div style="font-family:var(--font-mono);font-size:11px">${esc(f)}</div>`).join('')}</td></tr>
                            <tr><td class="l">ขอบเขตที่กรองอยู่</td><td class="l">${esc(scope)}</td></tr>
                            <tr><td class="l">แหล่งข้อมูล</td><td class="l">${esc(this._cfg.sourceNote || '')}</td></tr>
                            ${d.unverified ? `<tr><td class="l">สถานะของค่า</td>
                                <td class="l" style="color:var(--status-danger-strong);font-weight:700">
                                    ${esc(d.unverified)}</td></tr>` : ''}
                        </tbody>
                    </table>
                    <div class="ds-note"><i data-lucide="shield" class="icon-sm"></i>
                        ${esc(this._cfg.note || '')}</div>`,
                footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>
                             <button class="btn btn-save"
                                 onclick="Drawer.close();location.href='${esc(d.drill(ctx))}'">
                                 ${esc(this._cfg.drillText || 'ดูรายละเอียดต่อ')}</button>`,
                onOpen: () => refreshIcons(),
            });
        },
    };
})();
