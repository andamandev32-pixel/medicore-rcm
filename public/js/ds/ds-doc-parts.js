/**
 * MediCore Design System — DOC PARTS
 * ------------------------------------------------------------
 * ชิ้นส่วนมาตรฐานของ "ใบพิมพ์" — หัวกระดาษ / แถบระบุตัวเรื่อง / footer / ช่องลงชื่อ
 * ใช้คู่กับ ds-doc-print.js (พรีวิว+สั่งพิมพ์) และ ds-print.css (สูตร @media print)
 *
 * ทำไมต้องมีไฟล์นี้ — บทเรียนจากใบพิมพ์รุ่นก่อน:
 *   • เลขหน้า hardcode "หน้า 1" ทุกแผ่น
 *   • แผ่นที่ 2 เป็นต้นไป **ไม่มีข้อมูลระบุตัวเรื่องเลย** → แผ่นที่หลุดออกมาไล่ที่มาไม่ได้
 *   • ไม่มีเวลาที่พิมพ์ → เทียบฉบับพิมพ์ซ้ำไม่ได้ว่าอันไหนใหม่กว่า
 *   • ไม่มีช่องลงชื่อผู้บันทึก/ผู้ตรวจ
 * ทั้ง 4 ข้อแก้ที่ DocParts.footer() + signatureBlock() ที่เดียว
 *
 * ⚠️ เลขหน้า: Chrome ไม่รองรับ counter(page) นอก @page margin box
 *    จึงใช้ footer แบบ position:fixed ที่เบราว์เซอร์วาดซ้ำทุกหน้า (ดู ds-print.css)
 *    เลข x/y ทำงานเต็มที่ใน Firefox — ส่วน Chrome ได้ "ระบุตัวเรื่องครบทุกหน้า"
 *    ซึ่งเป็นข้อกำหนดที่สำคัญกว่า
 */
(function () {

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const p2 = (n) => String(n).padStart(2, '0');

    /** วันเวลาปัจจุบันแบบ พ.ศ. 2 หลัก — DD/MM/YY HH:mm */
    function nowText() {
        const d = new Date();
        return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${(d.getFullYear() + 543) % 100} `
             + `${p2(d.getHours())}:${p2(d.getMinutes())}`;
    }

    /**
     * แถบระบุตัวเรื่องของเอกสาร — ต้องปรากฏ "ทุกหน้า"
     * @param {Array<[string,any]>|Object} fields  [['เลขที่','RG001'],['ผู้รับผิดชอบ','…']] หรือ {เลขที่:'RG001'}
     */
    function subjectBar(fields) {
        const pairs = Array.isArray(fields) ? fields : Object.entries(fields || {});
        return pairs
            .filter(([, v]) => v != null && v !== '')
            .map(([k, v]) => `${esc(k)} ${esc(v)}`)
            .join(' · ');
    }

    /**
     * หัวกระดาษ — ตาราง 3 ช่องมีกรอบดำ (โลโก้ | ชื่อเอกสาร | ข้อมูลระบุตัว + เลขหน้า)
     * @param {object} o
     * @param {string} [o.logoUrl]   ปล่อยว่าง = ไม่แสดงช่องโลโก้
     * @param {string} o.title
     * @param {string} [o.formCode]  รหัสฟอร์มมุมขวาใต้ตาราง
     * @param {Array|Object} [o.fields]
     */
    function docHead(o) {
        o = o || {};
        const logo = o.logoUrl
            ? `<img src="${esc(o.logoUrl)}" style="height:44px;display:block;margin:0 auto;" alt="">`
            : '';
        const pairs = Array.isArray(o.fields) ? o.fields : Object.entries(o.fields || {});
        const info = pairs.map(([k, v]) =>
            `<div>${esc(k)}: ${esc(v == null || v === '' ? '—' : v)}</div>`).join('');

        return `
<table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
  <tr>
    ${logo ? `<td style="${CELL};width:22%;text-align:center;">${logo}</td>` : ''}
    <td style="${CELL};text-align:center;">
      <div style="font-size:15px;font-weight:700;">${esc(o.title || '')}</div>
    </td>
    <td style="${CELL};width:34%;font-size:10.5px;line-height:1.55;">
      ${info}
      <div>หน้า: <span class="ds-page-no"></span></div>
    </td>
  </tr>
</table>
${o.formCode ? `<div style="text-align:right;font-size:11px;margin-bottom:4px;">${esc(o.formCode)}</div>` : ''}`;
    }

    const CELL = 'border:1px solid #000;padding:5px 6px;vertical-align:top;';

    /** footer ประจำหน้า — ระบุตัวเรื่อง + เวลาที่พิมพ์ + เลขหน้า (ds-print.css ตรึงไว้ท้ายทุกหน้า) */
    function footer(fields) {
        return `<div class="ds-print-footer" style="display:flex;justify-content:space-between;
    align-items:flex-end;gap:12px;margin-top:8px;padding-top:4px;
    border-top:1px solid #000;font-size:11px;">
  <div>${subjectBar(fields)}</div>
  <div style="white-space:nowrap;">พิมพ์ ${nowText()} · หน้า <span class="ds-page-no"></span></div>
</div>`;
    }

    /** ช่องลงชื่อ — เอกสารที่ใช้เป็นหลักฐานต้องมีลายมือชื่อกำกับ */
    function signatureBlock(labels) {
        const list = (labels && labels.length) ? labels : ['ลงชื่อ ผู้บันทึก', 'ลงชื่อ ผู้ตรวจสอบ'];
        const cell = (label) => `<div style="flex:1;text-align:center;">
    <div style="border-bottom:1px dotted #000;height:26px;margin:0 8px;"></div>
    <div style="font-size:11px;margin-top:3px;">${esc(label)}</div>
  </div>`;
        return `<div class="ds-print-sign" style="display:flex;gap:10px;margin-top:14px;">
  ${list.map(cell).join('')}
</div>`;
    }

    /**
     * เติมแถวว่างให้ตารางครบขั้นต่ำ — ฟอร์มกระดาษต้องมีบรรทัดให้เขียนเพิ่มด้วยมือ
     * นับ <tr> ที่มีอยู่จริงจาก html แล้วต่อท้ายให้ครบ
     */
    function fillRows(rowsHtml, minRows, colCount) {
        const have = (rowsHtml.match(/<tr[\s>]/g) || []).length;
        if (have >= minRows) return rowsHtml;
        const blank = `<tr>${`<td style="${CELL}height:22px;">&nbsp;</td>`.repeat(colCount)}</tr>`;
        return rowsHtml + blank.repeat(minRows - have);
    }

    /** แปลงสีเส้นเทาของหน้าจอเป็นดำ — ใช้ renderer ตัวเดียวกับหน้าจอแล้วค่อยแปลงตอนพิมพ์ */
    function toPrintBorders(html) {
        return String(html).replace(/#cbd5e1/gi, '#000').replace(/#94a3b8/gi, '#000')
                           .replace(/#e2e8f0/gi, '#000').replace(/#e4e7ec/gi, '#000');
    }

    window.DocParts = { esc, nowText, subjectBar, docHead, footer, signatureBlock, fillRows, toPrintBorders, CELL };
})();
