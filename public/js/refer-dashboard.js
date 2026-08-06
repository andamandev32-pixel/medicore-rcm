/* ────────────────────────────────────────────────────────
   ภาพรวมการส่งต่อผู้ป่วย (Referral Dashboard)

   ทุก KPI มี drawer "ตัวเลขนี้มาจากไหน" แบบเดียวกับ claim-dashboard.js
   — นี่คืออาวุธกันคำถาม "ตัวเลขจริงไหม" กลางห้องประชุม ห้ามตัดทิ้ง

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

    KPI: [
        { key: 'total', icon: 'inbox', label: 'รายการส่งต่อในงวด',
          calc: r => MockFmt.int(r.length),
          how: 'นับรายการส่งต่อทั้งหมดในขอบเขตที่กรองอยู่',
          fields: ['referrals[] ตามทิศทางและกองทุนที่เลือก'],
          drill: () => 'refer-worklist.html' },

        { key: 'out', icon: 'log-out', label: 'ส่งต่อออก (เราตามจ่าย)',
          calc: r => MockFmt.int(r.filter(x => x.direction === 'OUT').length),
          how: 'นับรายการที่เราเป็นต้นสังกัดและส่งผู้ป่วยออกไปรักษาที่อื่น',
          fields: ['referrals[].direction === "OUT"'],
          drill: () => 'refer-worklist.html?dir=OUT' },

        { key: 'in', icon: 'log-in', label: 'รับส่งต่อเข้า (เราเรียกเก็บ)',
          calc: r => MockFmt.int(r.filter(x => x.direction === 'IN').length),
          how: 'นับรายการที่หน่วยบริการอื่นส่งผู้ป่วยมารักษาที่เรา',
          fields: ['referrals[].direction === "IN"'],
          drill: () => 'refer-worklist.html?dir=IN' },

        { key: 'ap', icon: 'arrow-up-from-line', label: 'ยอดตามจ่ายค้าง (บาท)', critical: true,
          calc: () => MockFmt.baht(MockRefer.netPosition().ap),
          how: 'ผลรวมยอดคงค้างของใบเรียกเก็บที่ปลายทางส่งมา (ยอดใบ − จ่ายแล้ว − โต้แย้ง)',
          fields: ['Σ refer_bills[direction="OUT"].items[].amount',
                   '− Σ refer_bills[].paid_amount', '− Σ refer_bills[].disputed_amount'],
          scopeNote: () => MockRefer.billsByDir('OUT').length + ' ใบเรียกเก็บ (ทั้งระบบ ไม่ตามตัวกรอง)',
          drill: () => 'refer-billing.html?dir=OUT' },

        { key: 'ar', icon: 'arrow-down-to-line', label: 'ยอดเรียกเก็บค้าง (บาท)',
          calc: () => MockFmt.baht(MockRefer.netPosition().ar),
          how: 'ผลรวมยอดคงค้างของใบที่เราออกไปเรียกเก็บต้นทาง/สปสช.',
          fields: ['Σ refer_bills[direction="IN"].items[].amount', '− paid − disputed'],
          scopeNote: () => MockRefer.billsByDir('IN').length + ' ใบเรียกเก็บ (ทั้งระบบ ไม่ตามตัวกรอง)',
          drill: () => 'refer-billing.html?dir=IN' },

        { key: 'net', icon: 'scale', label: 'สถานะสุทธิ AR − AP (บาท)',
          calc: () => MockFmt.baht(MockRefer.netPosition().net),
          how: 'ยอดที่เราพึงรับ ลบ ยอดที่เราพึงจ่าย — ติดลบแปลว่าเราเป็นลูกหนี้สุทธิ',
          fields: ['netPosition().ar − netPosition().ap'],
          scopeNote: () => 'ทั้งระบบ ไม่ตามตัวกรอง',
          drill: () => 'refer-billing.html' },

        { key: 'flag', icon: 'file-warning', label: 'ใบส่งตัวที่มีปัญหา', critical: true,
          calc: () => MockFmt.int(MockRefer.openRisks().length),
          how: 'นับรายการที่ยังมีธงระดับ ERROR ค้าง (หมดอายุ · เกินขอบเขต · ไม่มีเลขอนุมัติ · เกินวงเงิน · ซ้ำซ้อน)',
          fields: ['referrals[].risk_flags[].level === "ERROR"'],
          scopeNote: () => 'ทั้งระบบ ไม่ตามตัวกรอง',
          drill: () => 'refer-worklist.html?risk=ERROR' },

        { key: 'rate', icon: 'shield-check', label: 'อัตราใบส่งตัวสมบูรณ์',
          calc: () => MockFmt.pct(MockRefer.docCompletionRate(), 1),
          how: '(รายการทั้งหมด − รายการที่มีธง ERROR) ÷ รายการทั้งหมด × 100',
          fields: ['referrals[].length (ตัวหาร)', 'openRisks().length (ตัวลบ)'],
          scopeNote: () => 'ทั้งระบบ ไม่ตามตัวกรอง',
          drill: () => 'refer-worklist.html?risk=CLEAN' },
    ],

    renderKpi() {
        const rows = this.scope();
        document.getElementById('kpiGrid').innerHTML = this.KPI.map(k => `
            <div class="sip-kpi ${k.critical ? 'critical' : ''}" style="cursor:pointer"
                 onclick="ReferDash.explain('${k.key}')" title="กดเพื่อดูที่มาของตัวเลข">
                <i data-lucide="${k.icon}" class="sip-kpi-icon icon-lg"></i>
                <div class="sip-kpi-value">${esc(k.calc(rows))}</div>
                <div class="sip-kpi-label">${esc(k.label)}</div>
            </div>`).join('');
    },

    explain(key) {
        const k = this.KPI.find(x => x.key === key); if (!k) return;
        const rows = this.scope();
        const dirLabel = this.dir() ? MockRefer.dirMeta(this.dir()).label : 'ทั้งสองทิศทาง';

        Drawer.open({
            title: 'ตัวเลขนี้มาจากไหน — ' + k.label,
            contentHtml: `
                <div style="font-size:34px;font-weight:800;color:var(--brand-navy);margin-bottom:4px">
                    ${esc(k.calc(rows))}</div>
                <div class="td-sub" style="margin-bottom:14px">${esc(k.label)}</div>
                <table class="ds-table-grid">
                    <tbody>
                        <tr><td class="l" style="width:26%">วิธีคำนวณ</td><td class="l">${esc(k.how)}</td></tr>
                        <tr><td class="l">ฟิลด์ที่ใช้</td><td class="l">${k.fields.map(f =>
                            `<div style="font-family:var(--font-mono);font-size:11px">${esc(f)}</div>`).join('')}</td></tr>
                        <tr><td class="l">ขอบเขตที่กรองอยู่</td><td class="l">${esc(dirLabel)} ·
                            กองทุน ${esc(this.fund() === 'all' ? 'ทุกกองทุน' : this.fund())} ·
                            ${esc(k.scopeNote ? k.scopeNote() : rows.length + ' รายการ')}</td></tr>
                        <tr><td class="l">แหล่งข้อมูล</td><td class="l">ชุดข้อมูลจำลองในต้นแบบ —
                            เมื่อผูกระบบจริงจะมาจาก HIS ใบส่งตัว และใบเรียกเก็บของคู่สัญญา</td></tr>
                    </tbody>
                </table>
                <div class="ds-note"><i data-lucide="shield" class="icon-sm"></i>
                    ทุกตัวเลขเจาะลงไปถึงรายการส่งต่อ ใบเรียกเก็บ ผู้อนุมัติ และเวลาได้ (BR-03)</div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>
                         <button class="btn btn-save"
                             onclick="Drawer.close();location.href='${esc(k.drill ? k.drill() : 'refer-worklist.html')}'">
                             ดูรายการ</button>`,
            onOpen: () => refreshIcons(),
        });
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
