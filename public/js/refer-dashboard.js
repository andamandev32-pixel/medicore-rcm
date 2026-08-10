/* ────────────────────────────────────────────────────────
   ภาพรวมการส่งต่อผู้ป่วย (Referral Dashboard)

   ทุก KPI มี drawer ที่โชว์ "รายการจริงที่ประกอบเป็นตัวเลข" แล้วตามด้วยที่มาของตัวเลข
   — นี่คืออาวุธกันคำถาม "ตัวเลขจริงไหม" กลางห้องประชุม ห้ามตัดทิ้ง
   นิยามอยู่ที่ MockKpi.DEFS · เรนเดอร์โดย DSKpi — ทั้งสอง dashboard ใช้ชุดเดียวกัน

   เลือกชนิดกราฟตามที่ ds-chart.js รองรับจริงเท่านั้น (line/bars/donut/funnel/spark/hbar)
     • ส่งไปที่ไหน → funnel เพราะเป็นตัวเดียวที่มี label ข้อความด้านซ้าย
       ชื่อโรงพยาบาลไทยยาว ๆ ชนกันแน่บนแกน X ของ bars() · และ funnel ไม่ปล่อย legend
       จึงต้องใช้สีเดียว แล้วสื่อความหมายผ่านตารางคู่แทน (กติกาข้อ 2 ของ ds-chart)
     • รายการโรค → ตาราง + hbar ไม่ใช่ donut เพราะ 10 ชิ้นอ่านไม่ออกบนโปรเจกเตอร์
   ──────────────────────────────────────────────────────── */

const ReferDash = {

    init() {
        MockSession.mountBanner('demoBanner');

        const p = new URLSearchParams(location.search);
        if (p.get('dir')) document.getElementById('fDir').value = p.get('dir');

        this.fillFunds();
        this.render();
    },

    fillFunds() {
        const funds = [...new Set(MockRefer.all().map(r => r.fund))].sort();
        document.getElementById('fFund').insertAdjacentHTML('beforeend',
            funds.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join(''));
    },

    dir()  { const v = document.getElementById('fDir').value; return v === 'all' ? null : v; },
    fund() { return document.getElementById('fFund').value; },

    /** ชุดข้อมูลที่อยู่ในขอบเขตตัวกรองปัจจุบัน */
    scope() {
        const f = this.fund();
        return MockRefer.byDir(this.dir()).filter(r => f === 'all' || r.fund === f);
    },

    render() {
        this.renderKpi();
        this.renderDest();
        this.renderMoney();
        this.renderAging();
        this.renderDx();
        this.renderRisk();
        refreshIcons();
    },

    /* ══════════ KPI ══════════ */

    /* นิยาม KPI ทั้ง 8 ตัวย้ายไปอยู่ที่ MockKpi.DEFS (js/mock/mock-kpi.js) ร่วมกับของ
       claim-dashboard — เดิมสองหน้าลอกโค้ดกันทั้งดุ้น พอแก้ที่เดียวอีกหน้าไม่ตาม
       ยอด AP/AR/ใบส่งตัวที่มีปัญหา จึงกระทบยอดกับ claim-dashboard ได้โดยอัตโนมัติ */

    kpiDefs() { return MockKpi.forPage('refer-dashboard'); },

    kpiCtx() { return { rows: this.scope(), fund: this.fund(), dir: this.dir() || 'all' }; },

    renderKpi() {
        DSKpi.configure({
            defs:    this.kpiDefs(),
            ctx:     () => this.kpiCtx(),
            resolve: (def, ctx) => MockKpi.rows(def, ctx),
            value:   (def, ctx) => MockKpi.value(def, ctx),
            cap:     MockKpi.CAP,
            fmt:     v => MockFmt.baht(v),
            scopeLine: (k, ctx) => {
                const dirLabel = this.dir() ? MockRefer.dirMeta(this.dir()).label : 'ทั้งสองทิศทาง';
                return `${dirLabel} · กองทุน ${ctx.fund === 'all' ? 'ทุกกองทุน' : ctx.fund} · `
                     + (k.scopeNote ? k.scopeNote() : ctx.rows.length + ' รายการ');
            },
            sourceNote: 'ชุดข้อมูลจำลองในต้นแบบ — เมื่อผูกระบบจริงจะมาจาก HIS ใบส่งตัว '
                      + 'และใบเรียกเก็บของคู่สัญญา',
            note: 'ทุกตัวเลขเจาะลงไปถึงรายการส่งต่อ ใบเรียกเก็บ ผู้อนุมัติ และเวลาได้ (BR-03)',
            drillText: 'ดูรายการทั้งหมด',
        });
        document.getElementById('kpiGrid').innerHTML = DSKpi.cards();
        const foot = document.getElementById('kpiFootnote');
        if (foot) foot.innerHTML = DSKpi.footnote();
    },

    /* ══════════ ส่งไปที่ไหน ══════════ */

    renderDest() {
        /* คำถาม "ส่งไปที่ไหน" หมายถึงปลายทางของ refer-out เป็นหลัก
           ถ้าผู้ใช้เลือก IN ก็แสดงต้นทางที่ส่งเข้ามาแทน */
        const dir  = this.dir() || 'OUT';
        const rows = MockRefer.byPartner(dir);
        const tot  = rows.reduce((a, x) => a + x.count, 0) || 1;

        document.getElementById('destScope').textContent =
            dir === 'OUT' ? `ปลายทางที่เราส่งผู้ป่วยไป · รวม ${MockFmt.int(tot)} ราย`
                          : `ต้นทางที่ส่งผู้ป่วยมา · รวม ${MockFmt.int(tot)} ราย`;

        /* สีเดียวทั้งกรวย — funnel ไม่ปล่อย legend จึงห้ามสื่อความหมายด้วยสี */
        DSChart.funnel('chartDest', {
            title: dir === 'OUT' ? 'ปลายทางที่ส่งผู้ป่วยไป (เรียงตามจำนวนราย)'
                                 : 'ต้นทางที่ส่งผู้ป่วยมา (เรียงตามจำนวนราย)',
            steps: rows.slice(0, 8).map(x => ({
                label: x.name, value: x.count,
                display: `${MockFmt.int(x.count)} ราย · ${MockFmt.baht(x.amount, { short: true })} บาท`,
                color: 'var(--primary)',
            })),
        });

        document.getElementById('destRows').innerHTML = rows.length ? rows.map(x => `
            <tr style="cursor:pointer"
                onclick="location.href='refer-worklist.html?partner=${encodeURIComponent(x.name)}'">
                <td class="td-name">${esc(x.name)}</td>
                <td class="td-sub">${esc(x.level || '—')}</td>
                <td style="text-align:right">${esc(MockFmt.int(x.count))}</td>
                <td style="text-align:right">${esc(MockFmt.baht(x.amount))}</td>
                <td style="text-align:right">${esc(MockFmt.baht(x.paid))}</td>
                <td>${DSChart.hbar((x.count / tot) * 100, MockFmt.pct((x.count / tot) * 100, 0))}</td>
                <td>${x.mou == null ? '<span class="td-sub">—</span>'
                    : x.mou ? '<span class="sip-chip sip-chip-success">มี MOU</span>'
                            : '<span class="sip-chip sip-chip-amber">ไม่มี MOU</span>'}</td>
                <td class="td-sub">${x.avg_settle_days == null ? '—' : esc(x.avg_settle_days) + ' วัน'}</td>
            </tr>`).join('')
            : '<tr><td colspan="8" class="ds-empty">ไม่มีข้อมูล</td></tr>';
    },

    /* ══════════ จำนวนเงิน ══════════ */

    renderMoney() {
        const m = MockRefer.monthlyMoney();
        DSChart.bars('chartMoney', {
            title: 'ยอดตามจ่าย (AP) เทียบยอดเรียกเก็บ (AR) รายงวด',
            labels: m.map(x => x.label),
            yFmt: v => MockFmt.baht(v, { short: true }),
            series: [
                { name: 'ตามจ่าย (AP)',  values: m.map(x => x.ap), color: 'var(--status-danger)' },
                { name: 'เรียกเก็บ (AR)', values: m.map(x => x.ar), color: 'var(--status-success)' },
            ],
        });
    },

    renderAging() {
        const out = MockRefer.agingBuckets('OUT');
        const inb = MockRefer.agingBuckets('IN');
        DSChart.bars('chartAging', {
            title: 'อายุหนี้คงค้าง แยกตามทิศทาง',
            labels: out.map(x => x.label),
            yFmt: v => MockFmt.baht(v, { short: true }),
            series: [
                { name: 'ตามจ่าย (AP)',  values: out.map(x => x.amount), color: 'var(--status-danger)' },
                { name: 'เรียกเก็บ (AR)', values: inb.map(x => x.amount), color: 'var(--status-success)' },
            ],
        });
    },

    /* ══════════ รายการโรค ══════════ */

    renderDx() {
        const dir  = this.dir() || 'OUT';
        const rows = MockRefer.byDx(dir);
        const max  = Math.max(1, ...rows.map(x => x.count));

        document.getElementById('dxRows').innerHTML = rows.length ? rows.slice(0, 10).map(x => `
            <tr>
                <td class="td-sub">${esc(x.code)}</td>
                <td class="td-name">${esc(x.name)}</td>
                <td>${DSChart.hbar((x.count / max) * 100, MockFmt.int(x.count) + ' ราย')}</td>
                <td style="text-align:right">${esc(MockFmt.baht(x.amount))}</td>
                <td class="td-sub">${esc(x.top_partner)}</td>
            </tr>`).join('')
            : '<tr><td colspan="5" class="ds-empty">ไม่มีข้อมูล</td></tr>';

        const grp = MockRefer.byDxGroup(dir);
        DSChart.donut('chartDxGroup', {
            title: 'สัดส่วนตามกลุ่มโรค',
            centerValue: MockFmt.int(grp.reduce((a, g) => a + g.value, 0)),
            centerLabel: 'รายการส่งต่อ',
            slices: grp.map(g => ({ label: g.label, value: g.value })),
        });

        const reason = MockRefer.byReason(dir);
        DSChart.donut('chartReason', {
            title: 'สัดส่วนตามเหตุผลการส่งต่อ',
            slices: reason.map(x => ({ label: x.label, value: x.value })),
        });
    },

    /* ══════════ ความเสี่ยง ══════════ */

    renderRisk() {
        const pareto = MockRefer.riskPareto();
        DSChart.bars('chartRisk', {
            title: 'จำนวนรายการที่ติดธงแต่ละประเภท',
            labels: pareto.map(x => x.code.replace('REF-', '')),
            yFmt: v => MockFmt.int(v),
            series: [{ name: 'จำนวนรายการ', values: pareto.map(x => x.count), color: 'var(--primary)' }],
        });

        const maxAmt = Math.max(1, ...pareto.map(x => x.amount));
        document.getElementById('riskRows').innerHTML = pareto.length ? pareto.map(x => `
            <tr style="cursor:pointer" onclick="location.href='refer-worklist.html?risk=${
                x.level === 'ERROR' ? 'ERROR' : x.level === 'WARNING' ? 'WARN' : 'all'}'">
                <td><span class="sip-chip ${x.level === 'ERROR' ? 'sip-chip-danger'
                    : x.level === 'WARNING' ? 'sip-chip-amber' : 'sip-chip-muted'}">${esc(x.code)}</span></td>
                <td>${esc(x.label)}</td>
                <td>${DSChart.hbar((x.amount / maxAmt) * 100, MockFmt.int(x.count) + ' รายการ',
                        x.level === 'ERROR' ? 'danger' : x.level === 'WARNING' ? 'warning' : '')}</td>
                <td style="text-align:right">${esc(MockFmt.baht(x.amount))}</td>
            </tr>`).join('')
            : '<tr><td colspan="4" class="ds-empty">ไม่พบธงความเสี่ยง</td></tr>';

        const top = MockRefer.all()
            .map(r => ({ r, amt: MockRefer.amountAtRisk(r) }))
            .filter(x => x.amt > 0 || MockRefer.hasError(x.r))
            .sort((a, b) => b.amt - a.amt).slice(0, 10);

        document.getElementById('topRiskRows').innerHTML = top.length ? top.map(({ r, amt }) => `
            <tr style="cursor:pointer" onclick="location.href='refer-case.html?id=${encodeURIComponent(r.id)}'">
                <td class="td-sub" style="white-space:nowrap">${esc(r.id)}</td>
                <td class="td-name">${esc(r.patient)}
                    <div class="td-sub">${esc(r.partner_name)}</div></td>
                <td style="white-space:nowrap">${MockRefer.flags(r).map(f =>
                    `<span class="sip-chip ${f.level === 'ERROR' ? 'sip-chip-danger'
                        : f.level === 'WARNING' ? 'sip-chip-amber' : 'sip-chip-muted'}"
                       title="${esc(f.detail)}">${esc(f.code.replace('REF-', ''))}</span>`).join(' ')}</td>
                <td style="text-align:right;white-space:nowrap">${esc(MockFmt.baht(amt))}</td>
            </tr>`).join('')
            : '<tr><td colspan="4" class="ds-empty">ไม่มีรายการเสี่ยง</td></tr>';
    },

    /* ══════════ ใบพิมพ์ ══════════ */

    buildDoc() {
        const C = DocParts.CELL;
        const warnings = [];
        const dir  = this.dir() || 'OUT';
        const rows = this.scope();
        const np   = MockRefer.netPosition();

        const th = (t, w) => `<th style="${C}font-size:11px;font-weight:700;text-align:center;`
                           + `${w ? 'width:' + w + ';' : ''}">${DocParts.esc(t)}</th>`;

        const destRows = MockRefer.byPartner(dir).map((x, i) => `<tr>
            <td style="${C}text-align:center;">${i + 1}</td>
            <td style="${C}">${DocParts.esc(x.name)}</td>
            <td style="${C}text-align:center;">${DocParts.esc(x.level || '')}</td>
            <td style="${C}text-align:right;">${DocParts.esc(MockFmt.int(x.count))}</td>
            <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(x.amount))}</td>
            <td style="${C}text-align:center;">${x.mou == null ? '—' : (x.mou ? 'มี' : 'ไม่มี')}</td>
        </tr>`).join('');

        const dxRows = MockRefer.byDx(dir).slice(0, 10).map((x, i) => `<tr>
            <td style="${C}text-align:center;">${i + 1}</td>
            <td style="${C}text-align:center;">${DocParts.esc(x.code)}</td>
            <td style="${C}">${DocParts.esc(x.name)}</td>
            <td style="${C}text-align:right;">${DocParts.esc(MockFmt.int(x.count))}</td>
            <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(x.amount))}</td>
        </tr>`).join('');

        const riskRows = MockRefer.riskPareto().map((x, i) => `<tr>
            <td style="${C}text-align:center;">${i + 1}</td>
            <td style="${C}text-align:center;">${DocParts.esc(x.code)}</td>
            <td style="${C}">${DocParts.esc(x.label)}</td>
            <td style="${C}text-align:right;">${DocParts.esc(MockFmt.int(x.count))}</td>
            <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(x.amount))}</td>
        </tr>`).join('');

        const fields = [
            ['ทิศทาง', this.dir() ? MockRefer.dirMeta(this.dir()).label : 'ทั้งสองทิศทาง'],
            ['กองทุน', this.fund() === 'all' ? 'ทุกกองทุน' : this.fund()],
            ['รายการส่งต่อ', rows.length + ' รายการ'],
            ['ยอดตามจ่ายค้าง', MockFmt.baht(np.ap) + ' บาท'],
            ['ยอดเรียกเก็บค้าง', MockFmt.baht(np.ar) + ' บาท'],
            ['ผู้พิมพ์', MockSession.user().full_name],
        ];

        const html = `<div style="color:#000;font-size:12px;">
            ${DocParts.docHead({ title: 'สรุปภาพรวมการส่งต่อผู้ป่วย', formCode: 'REF-DASH/2569', fields })}

            <div style="border:2px solid #b91c1c;color:#b91c1c;font-weight:700;
                        padding:6px 10px;margin:8px 0 12px;text-align:center;">
                ข้อมูล MOCKUP เพื่อการนำเสนอ — ไม่ใช่ตัวเลขจริงของหน่วยบริการ
            </div>

            <div style="font-weight:700;margin:10px 0 4px">1. ส่งไปที่ไหน</div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>${th('ที่', '28px')}${th('คู่สัญญา')}${th('ระดับ', '17%')}
                    ${th('จำนวน', '58px')}${th('มูลค่า (บาท)', '90px')}${th('MOU', '46px')}</tr></thead>
                <tbody>${DocParts.fillRows(destRows, 8, 6)}</tbody>
            </table>

            <div style="font-weight:700;margin:12px 0 4px">2. รายการโรคที่ส่งต่อ (10 อันดับ)</div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>${th('ที่', '28px')}${th('ICD-10', '68px')}${th('ชื่อโรค')}
                    ${th('จำนวน', '58px')}${th('มูลค่า (บาท)', '90px')}</tr></thead>
                <tbody>${DocParts.fillRows(dxRows, 10, 5)}</tbody>
            </table>

            <div style="font-weight:700;margin:12px 0 4px">3. ธงความเสี่ยงที่ตรวจพบ</div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>${th('ที่', '28px')}${th('รหัสธง', '110px')}${th('ประเด็น')}
                    ${th('จำนวน', '58px')}${th('มูลค่าเสี่ยง', '90px')}</tr></thead>
                <tbody>${DocParts.fillRows(riskRows, 6, 5)}</tbody>
            </table>

            ${DocParts.signatureBlock(['ลงชื่อ ผู้จัดทำ', 'ลงชื่อ ผู้บริหารที่รับทราบ'])}
            ${DocParts.footer(fields)}
        </div>`;

        return { html: DocParts.toPrintBorders(html), warnings };
    },

    openPrint() {
        const { html, warnings } = this.buildDoc();
        DocPrint.preview({ title: 'ตัวอย่างก่อนพิมพ์ — สรุปภาพรวมการส่งต่อ', html, warnings });
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.ReferDash = ReferDash;
document.addEventListener('DOMContentLoaded', () => ReferDash.init());
