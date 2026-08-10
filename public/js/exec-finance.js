/* ────────────────────────────────────────────────────────
   สรุปยอดเงินโอน สิทธิประกันสังคม และสิทธิหลักประกันสุขภาพแห่งชาติ

   ตารางลอกจากแบบฟอร์มกระดาษของ รพ. — หัว 2 ชั้น กลุ่มคอลัมน์ละ 2 ช่อง (ราย + จำนวนเงิน)
   ตัวเลขทั้งหมดมาจาก MockFinance ตัวเดียว ทั้งหน้าจอ กราฟ และใบพิมพ์จึงกระทบยอดกันได้เสมอ

   ฝั่งประกันสังคมเรียกช่องที่ 3 ว่า "ยอดเงินโอน" · ฝั่งหลักประกันสุขภาพเรียกว่า "รายรับ"
   คำต่างกันบนฟอร์มจริง — ห้ามรวบเป็นคำเดียว (FIN_COL_GROUPS.ucLabel)
   ──────────────────────────────────────────────────────── */

const Fin = {

    state: { scheme: 'all' },

    /**
     * มุมมองสิทธิ — ตัวกรองตัวเดียวที่คุมทั้งหน้า
     *   all   รวมสองสิทธิเป็นยอดเดียว          · ตารางครบทั้งสองบล็อก
     *   split แยกการ์ดตัวเลขคนละชุดต่อสิทธิ     · ตารางครบทั้งสองบล็อก
     *   sso   เฉพาะประกันสังคม                 · เหลือบล็อกเดียว
     *   uc    เฉพาะหลักประกันสุขภาพแห่งชาติ     · เหลือบล็อกเดียว
     * blocks = บล็อกที่ต้องแสดง · chart = scope ที่ส่งให้ MockFinance.series()
     */
    SCHEMES: [
        { key: 'all',   label: 'รวมทุกสิทธิ',              blocks: ['sso', 'uc'], chart: 'all' },
        { key: 'split', label: 'แยกสิทธิ',                 blocks: ['sso', 'uc'], chart: 'all' },
        { key: 'sso',   label: 'ประกันสังคม',              blocks: ['sso'],       chart: 'sso' },
        { key: 'uc',    label: 'หลักประกันสุขภาพแห่งชาติ', blocks: ['uc'],        chart: 'uc' },
    ],

    /** ตัวชี้วัด 4 ตัวของการ์ด — ใช้ชุดเดียวกันทุกมุมมอง เปลี่ยนแค่ว่าเอายอดของใครมาใส่ */
    KPI: [
        { key: 'billed',    icon: 'file-plus',    label: 'ตั้งเบิกทั้งหมด' },
        { key: 'processed', icon: 'cpu',          label: 'ประมวลผลจ่ายแล้ว' },
        { key: 'received',  icon: 'banknote',     label: 'เงินเข้าบัญชีจริง' },
        { key: 'open',      icon: 'alert-circle', label: 'คงค้าง', critical: true },
    ],

    _scheme() { return this.SCHEMES.find(s => s.key === this.state.scheme) || this.SCHEMES[0]; },

    /* ══════════ วงจรชีวิต ══════════ */

    init() {
        MockSession.mountBanner('demoBanner');
        this.fillPeriods();
        this.renderSeg();
        this.render();
    },

    renderSeg() {
        document.getElementById('segScheme').innerHTML = this.SCHEMES.map(s =>
            `<button class="ds-seg${s.key === this.state.scheme ? ' active' : ''}"
                onclick="Fin.setScheme('${esc(s.key)}')">${esc(s.label)}</button>`).join('');
    },

    setScheme(k) { this.state.scheme = k; this.renderSeg(); this.render(); },

    /** ตัวเลือกงวด — 12 เดือนล่าสุด แล้วตามด้วยยอดสะสมรายปีงบประมาณ */
    fillPeriods() {
        const months = MockFinance.periods().map(p =>
            `<option value="${esc(p.key)}">${esc(p.label)}${p.open ? ' (ยังไม่ปิดงวด)' : ''}</option>`).join('');
        const fys = MockFinance.fiscalYears().map(y =>
            `<option value="FY${y}">รวมทั้งปีงบประมาณ ${esc(y)}</option>`).join('');

        document.getElementById('fPeriod').innerHTML =
            `<optgroup label="รายเดือน">${months}</optgroup>`
          + `<optgroup label="สะสมทั้งปีงบประมาณ">${fys}</optgroup>`;
    },

    /** ตารางของงวดที่เลือกอยู่ — เรียกทุกครั้งที่ต้องใช้ ไม่แคช ตัวเลขจึงตรงกับ dropdown เสมอ */
    sheet() {
        const v = document.getElementById('fPeriod').value;
        return String(v).startsWith('FY')
            ? MockFinance.fiscalYear(v.slice(2))
            : MockFinance.sheet(v);
    },

    render() {
        const s = this.sheet();
        const sc = this._scheme();

        document.getElementById('asOf').textContent =
            (s.period.isFY ? 'ยอดสะสม ' : 'ประจำเดือน ') + s.period.label
            + (sc.blocks.length === 1 ? ' · เฉพาะ' + sc.label : '')
            + ' · ข้อมูล ณ ' + MockFmt.dateTH('2569-08-06');

        /* บล็อกที่ไม่ได้เลือกซ่อนทั้งการ์ด — ไม่ใช่แค่ล้างตาราง จะได้ไม่เหลือหัวเรื่องลอย */
        document.getElementById('cardSso').style.display = sc.blocks.includes('sso') ? '' : 'none';
        document.getElementById('cardUc').style.display  = sc.blocks.includes('uc')  ? '' : 'none';

        /* งวดที่ผูกกับหมุด สปสช. ต้องบอกผู้อ่าน ไม่งั้นดูไม่ออกว่าเลขไหนเทียบกับอะไรได้ */
        document.getElementById('ucNote').innerHTML = s.anchored
            ? 'ยอดตั้งเบิก/รายรับรวม ตรงกับรายงานพึงรับ–พึงจ่ายของ สปสช. งวดเดียวกัน'
            : (s.period.isFY ? `รวม ${esc(s.period.months)} งวด` : 'งวดนี้ยังไม่มีรายงานกระทบยอดจาก สปสช.');
        document.getElementById('ssoNote').textContent = s.period.isFY
            ? `รวม ${s.period.months} งวด` : 'ยอดก่อนหักภาษี';

        this.renderKpi(s);
        this.renderTable('ssoTable', s.sso, 'sso');
        this.renderTable('ucTable',  s.uc,  'uc');
        this.renderCharts();
        refreshIcons();
    },

    /* ══════════ KPI ══════════ */

    /**
     * ยอด "รวม" ของมุมมองที่เลือก — all/split ใช้ยอดรวมสองสิทธิ นอกนั้นใช้ของสิทธิเดียว
     * ห้าม hardcode — ทุกค่ามาจากแถวรวมของตารางเดียวกันบนหน้า (PAGE-GUIDE §7B)
     */
    _totalOf(s, which) {
        return which === 'sso' ? s.sso.total : which === 'uc' ? s.uc.total : s.grand;
    },

    /** การ์ด 1 ใบ — ตัวหารของทุก % คือยอดตั้งเบิกของ "ชุดเดียวกัน" ไม่ใช่ยอดรวมทั้งหน้า */
    _kpiTile(m, tot) {
        const pct = v => tot.billed.amt ? MockFmt.pct((v / tot.billed.amt) * 100) : '—';
        const sub = m.key === 'billed' ? MockFmt.int(tot.billed.n) + ' ราย'
                  : m.key === 'open'   ? pct(tot.open.amt) + ' · ' + MockFmt.int(tot.open.n) + ' ราย'
                  : pct(tot[m.key].amt) + ' ของยอดตั้งเบิก';
        const danger = m.critical && tot.open.amt > 0;

        return `<div class="sip-kpi${danger ? ' critical' : ''}" style="cursor:default">
            <i data-lucide="${esc(m.icon)}" class="sip-kpi-icon icon-md"></i>
            <div class="sip-kpi-value">${esc(MockFmt.baht(tot[m.key].amt, { short: true }))}</div>
            <div class="sip-kpi-label">${esc(m.label)}</div>
            <div class="ds-hint" style="margin-top:2px">${esc(sub)}</div>
        </div>`;
    },

    _kpiGrid(tot) {
        return `<div class="ds-kpi-grid">${this.KPI.map(m => this._kpiTile(m, tot)).join('')}</div>`;
    },

    renderKpi(s) {
        const sc = this._scheme();
        let html;

        if (sc.key === 'split') {
            /* แยกเป็นชุดละแถว ไม่ปล่อยให้ 8 ใบไหลรวมบรรทัดเดียว — ไม่งั้นแยกไม่ออกว่าใบไหนของสิทธิใด */
            const head = t => `<div class="ds-zone-sub" style="margin:0 0 6px;font-weight:700;
                color:var(--brand-navy)">${esc(t)}</div>`;
            html = head('สิทธิประกันสังคม') + this._kpiGrid(s.sso.total)
                 + head('สิทธิหลักประกันสุขภาพแห่งชาติ') + this._kpiGrid(s.uc.total);
        } else {
            html = this._kpiGrid(this._totalOf(s, sc.blocks.length === 1 ? sc.blocks[0] : 'all'));
        }

        document.getElementById('kpiWrap').innerHTML = html;
    },

    /* ══════════ ตาราง ══════════ */

    /** หัวตาราง 2 ชั้น — สร้างจาก FIN_COL_GROUPS ไม่พิมพ์ซ้ำใน HTML */
    _thead(side) {
        const grp = FIN_COL_GROUPS.map(g =>
            `<th class="grp" colspan="2">${esc(side === 'uc' && g.ucLabel ? g.ucLabel : g.label)}</th>`).join('');
        const sub = FIN_COL_GROUPS.map(g =>
            `<th class="sub">ราย</th><th class="sub">${esc(g.money)}</th>`).join('');

        return `<thead>
            <tr>
                <th rowspan="2" style="width:46px">ลำดับ</th>
                <th rowspan="2" style="min-width:260px">รายการ</th>
                ${grp}
            </tr>
            <tr>${sub}</tr>
        </thead>`;
    },

    /** 8 ช่องตัวเลขของหนึ่งแถว — คงค้างที่เป็น 0 แสดงเป็นขีด เพื่อให้สายตาจับเฉพาะที่ยังค้างจริง */
    _cells(r) {
        return FIN_COL_GROUPS.map(g => {
            const c = r[g.key];
            const zero = c.amt === 0;
            const tone = g.key === 'billed'   ? 'ds-amt ds-amt-billed'
                       : g.key === 'received' ? 'ds-amt ds-amt-comp'
                       : g.key === 'open'     ? 'ds-amt' : '';
            const style = g.key === 'open' && !zero ? ' style="color:var(--status-warning-strong)"' : '';

            return `<td class="num">${zero ? '<span class="td-sub">—</span>' : esc(MockFmt.int(c.n))}</td>`
                 + `<td class="num">${zero
                        ? '<span class="td-sub">—</span>'
                        : `<span class="${tone}"${style}>${esc(MockFmt.baht(c.amt))}</span>`}</td>`;
        }).join('');
    },

    renderTable(elId, block, side) {
        const body = block.rows.map(r => `
            <tr${r.isGroup ? ' class="is-group"' : ''}>
                <td class="c">${r.level === 0 ? esc(r.no) : ''}</td>
                <td class="l${r.level ? ' sub-item' : ''}">${esc(r.label)}</td>
                ${this._cells(r)}
            </tr>`).join('');

        const total = `
            <tr class="ds-row-total">
                <td colspan="2" class="c">รวม</td>
                ${this._cells(block.total)}
            </tr>`;

        document.getElementById(elId).innerHTML = this._thead(side) + `<tbody>${body}${total}</tbody>`;
    },

    /* ══════════ กราฟ ══════════ */

    /**
     * สองกราฟนี้แสดง 12 งวดเสมอ ไม่ผูกกับ #fPeriod
     * จุดประสงค์คือดูแนวโน้มเรียงเดือน ถ้าตัดเหลืองวดเดียวก็ไม่เหลืออะไรให้เทียบ
     */
    renderCharts() {
        const sc = this._scheme();
        const s = MockFinance.series(sc.chart);
        const money = v => MockFmt.baht(v, { short: true });

        /* เลือกสิทธิเดียว → เหลือเฉพาะกองทุนของสิทธินั้น ไม่งั้นแท่งซ้อนจะรวมเงินของสิทธิที่ไม่ได้ดูอยู่ */
        const funds = FIN_CHART_FUNDS
            .map((f, i) => ({ f, i }))
            .filter(({ f }) => sc.blocks.some(b => f.key.startsWith(b)));

        DSChart.bars('chartFundStack', {
            title: 'สัดส่วนเงินเข้าจำแนกตามกองทุน 12 เดือน',
            stacked: true,
            labels: s.labels,
            yFmt:   money,
            /* คงสีเดิมตามลำดับใน FIN_CHART_FUNDS — กองทุนเดียวกันต้องเป็นสีเดิมทุกมุมมอง */
            series: funds.map(({ f, i }) => ({
                name: f.label, values: s.byFund[i],
                color: DSChart.PALETTE[i % DSChart.PALETTE.length],
            })),
        });

        document.getElementById('chartScopeNote').textContent =
            sc.blocks.length === 1 ? 'เฉพาะ' + sc.label : 'รวมทุกสิทธิ';

        DSChart.bars('chartBilledVsRecv', {
            title: 'ยอดที่ส่งเบิก เทียบยอดที่รับจริงและประมาณการพึงรับ',
            labels: s.labels,
            yFmt:   money,
            series: [
                { name: 'ที่ส่งเบิก',        values: s.billed,   color: 'var(--primary)' },
                { name: 'รับจริง',           values: s.received, color: 'var(--status-success)' },
                { name: 'ประมาณการพึงรับ',   values: s.expected, color: 'var(--brand-amber-500)' },
            ],
        });

        /* อธิบายที่มาของเส้น "ประมาณการพึงรับ" — ตัวเลขคาดการณ์ที่ไม่บอกสูตรคือตัวเลขที่เชื่อไม่ได้ */
        const last = s.labels.length - 1;
        const gap  = s.expected[last] - s.received[last];
        document.getElementById('expectCaption').innerHTML =
            'ประมาณการพึงรับ = ยอดตั้งเบิก × อัตราที่ได้รับจริงเฉลี่ยย้อนหลัง 3 งวด · '
          + `งวดล่าสุด (${esc(s.labels[last])}) ยังต่ำกว่าประมาณการอยู่ `
          + `<strong>${esc(MockFmt.baht(Math.max(0, gap), { short: true }))}</strong> บาท `
          + '<span class="td-sub">— ปกติสำหรับงวดที่ยังไม่ปิด</span>';

        refreshIcons();
    },

    /* ══════════ ใบพิมพ์ ══════════ */

    /** ตารางหนึ่งบล็อกในรูปแบบกระดาษ — ใช้ข้อมูลชุดเดียวกับหน้าจอ (PAGE-GUIDE §5B) */
    _docTable(block, side, minRows) {
        const C = DocParts.CELL;
        const th = (t, extra) => `<th style="${C}font-size:10px;font-weight:700;text-align:center;`
                               + `${extra || ''}">${DocParts.esc(t)}</th>`;

        /* ⚠️ ลำดับ/รายการ ต้อง rowspan=2 — ไม่งั้นหัวแถวที่สองจะเลื่อนไปทับสองคอลัมน์แรก
              และ table-layout:fixed จะเอาความกว้างของช่อง "ราย" ไปให้คอลัมน์ "รายการ" */
        const span2 = (t, extra) => `<th rowspan="2" style="${C}font-size:10px;font-weight:700;`
                                  + `text-align:center;vertical-align:middle;${extra || ''}">${DocParts.esc(t)}</th>`;
        const grp = FIN_COL_GROUPS.map(g =>
            `<th colspan="2" style="${C}font-size:10px;font-weight:700;text-align:center;">`
          + `${DocParts.esc(side === 'uc' && g.ucLabel ? g.ucLabel : g.label)}</th>`).join('');
        const sub = FIN_COL_GROUPS.map(g => th('ราย', 'width:36px;') + th(g.money, 'width:72px;')).join('');

        const num = r => FIN_COL_GROUPS.map(g =>
            `<td style="${C}text-align:right;">${r[g.key].amt === 0 ? '' : DocParts.esc(MockFmt.int(r[g.key].n))}</td>`
          + `<td style="${C}text-align:right;">${r[g.key].amt === 0 ? '' : DocParts.esc(MockFmt.baht(r[g.key].amt))}</td>`
        ).join('');

        const body = block.rows.map(r => `<tr>
            <td style="${C}text-align:center;">${r.level === 0 ? DocParts.esc(r.no) : ''}</td>
            <td style="${C}${r.level ? 'padding-left:18px;' : ''}">${DocParts.esc(r.label)}</td>
            ${num(r)}</tr>`).join('');

        /* เติมบรรทัดว่างให้ครบเหมือนฟอร์มจริง — เจ้าหน้าที่เขียนรายการเพิ่มด้วยมือบนกระดาษ */
        const filled = DocParts.fillRows(body, minRows, 2 + FIN_COL_GROUPS.length * 2);

        const total = `<tr>
            <td colspan="2" style="${C}text-align:center;font-weight:700;">รวม</td>
            ${num(block.total)}</tr>`;

        return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px;">
            <thead>
                <tr>${span2('ลำดับ', 'width:28px;')}${span2('รายการ', 'width:150px;')}${grp}</tr>
                <tr>${sub}</tr>
            </thead>
            <tbody>${filled}${total}</tbody>
        </table>`;
    },

    buildDoc() {
        const s = this.sheet();
        const sc = this._scheme();
        const warnings = [];

        /* ใบพิมพ์ต้องตรงกับสิ่งที่เห็นบนจอ — เลือกสิทธิเดียวก็พิมพ์บล็อกเดียว และยอดรวมท้ายใบก็ต้องเป็นของสิทธินั้น */
        const tot = this._totalOf(s, sc.blocks.length === 1 ? sc.blocks[0] : 'all');

        const fields = [
            ['งวด', s.period.label],
            ['ขอบเขต', sc.blocks.length === 1 ? sc.label : 'รวมทุกสิทธิ'],
            ['ยอดตั้งเบิกรวม', MockFmt.baht(tot.billed.amt) + ' บาท'],
            ['เงินเข้าจริง', MockFmt.baht(tot.received.amt) + ' บาท'],
            ['ผู้พิมพ์', MockSession.user().full_name],
        ];

        if (!s.anchored && !s.period.isFY && sc.blocks.includes('uc')) {
            warnings.push('งวดนี้ยังไม่มีรายงานกระทบยอดจาก สปสช. — ตัวเลขฝั่งหลักประกันสุขภาพเป็นค่าประมาณ');
        }
        if (tot.open.amt > 0) {
            warnings.push('ยังมียอดคงค้าง ' + MockFmt.baht(tot.open.amt) + ' บาท ที่ยังไม่ได้รับโอน');
        }

        const mockBand = `<div style="border:2px solid #dc2626;background:#fee2e2;color:#991b1b;
            font-weight:700;font-size:11px;padding:6px 8px;margin:6px 0 10px;
            -webkit-print-color-adjust:exact;print-color-adjust:exact;">
            ข้อมูล MOCKUP — ตัวเลขทุกตัวในเอกสารฉบับนี้เป็นข้อมูลสมมติเพื่อสาธิตรูปแบบรายงาน
            ไม่ใช่ข้อมูลจริงของโรงพยาบาล และห้ามนำไปใช้อ้างอิงหรือตัดสินใจ
        </div>`;

        /* หัวเรื่องบอกขอบเขตด้วย — ใบที่พิมพ์เฉพาะสิทธิเดียวแล้วหลุดออกจากแฟ้ม ต้องอ่านออกว่าเป็นของสิทธิใด */
        const scopeTitle = sc.blocks.length === 1
            ? 'สรุปรายงานยอดเงินโอน' + sc.label
            : 'สรุปรายงานยอดเงินโอนสิทธิประกันสังคม และสิทธิหลักประกันสุขภาพแห่งชาติ';

        const BLOCK = {
            sso: () => `<div style="font-weight:700;margin:10px 0 4px">%N. สิทธิประกันสังคม</div>`
                     + this._docTable(s.sso, 'sso', s.sso.rows.length),
            uc:  () => `<div style="font-weight:700;margin:14px 0 4px">%N. สิทธิหลักประกันสุขภาพแห่งชาติ</div>`
                     + this._docTable(s.uc, 'uc', s.uc.rows.length + 5),
        };
        const blocks = sc.blocks.map((b, i) => BLOCK[b]().replace('%N.', (i + 1) + '.')).join('');

        const sumLabel = sc.blocks.length === 1 ? 'รวม' + sc.label : 'รวมทั้งสองสิทธิ';

        const html = `<div style="color:#000;font-size:11px;">
            ${/* docHead esc() ชื่อเรื่อง — ห้ามใส่แท็กลงไป ใช้ตัวคั่นข้อความแทน */''}
            ${DocParts.docHead({
                title: scopeTitle + ' '
                     + (s.period.isFY ? 'ยอดสะสม ' : 'ประจำเดือน ') + s.period.label,
                formCode: 'FIN/' + s.period.key, fields,
            })}
            ${mockBand}
            ${blocks}
            <div style="margin-top:10px;font-size:11px">
                ${DocParts.esc(sumLabel)} — ตั้งเบิก <strong>${DocParts.esc(MockFmt.baht(tot.billed.amt))}</strong> บาท ·
                เงินเข้าบัญชีจริง <strong>${DocParts.esc(MockFmt.baht(tot.received.amt))}</strong> บาท ·
                คงค้าง <strong>${DocParts.esc(MockFmt.baht(tot.open.amt))}</strong> บาท
            </div>
            <div style="margin-top:4px;font-size:10px">
                ${DocParts.esc(typeof NHSO_STATEMENT_TAX_NOTE !== 'undefined' ? NHSO_STATEMENT_TAX_NOTE : '')}
                · คงค้าง = ยอดตั้งเบิก − ยอดที่ได้รับโอน
            </div>
            ${DocParts.signatureBlock(['ลงชื่อ ผู้จัดทำ', 'ลงชื่อ หัวหน้างานประกันสุขภาพ', 'ลงชื่อ ผู้บริหารรับทราบ'])}
            ${DocParts.footer(fields)}
        </div>`;

        return { html: DocParts.toPrintBorders(html), warnings };
    },

    openPrint() {
        const { html, warnings } = this.buildDoc();
        DocPrint.preview({ title: 'ตัวอย่างก่อนพิมพ์ — สรุปยอดเงินโอน', html, warnings });
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.Fin = Fin;
document.addEventListener('DOMContentLoaded', () => Fin.init());
