/* ────────────────────────────────────────────────────────
   ภาพรวมผู้บริหาร (Executive Dashboard) — SRS §10

   หลักที่ห้ามละเมิด: ตัวเลขทุกตัวบนหน้านี้คำนวณจาก MockDB
   ไม่มีตัวเลขไหน hardcode — ถ้าผู้บริหารกดเข้าไปดูคิวเคส ตัวเลขต้องตรงกัน
   ทุก KPI จึงมีปุ่ม "ตัวเลขนี้มาจากไหน" ที่แสดงสูตรและฟิลด์ที่ใช้รวม
   ──────────────────────────────────────────────────────── */

const Dash = {

    init() {
        MockSession.mountBanner('demoBanner');
        document.getElementById('asOf').textContent =
            'ข้อมูล ณ ' + MockFmt.dateTH('2569-08-06') + ' เวลา 09:00 น. · ข้อมูลจำลองเพื่อการนำเสนอ';
        this.fillFunds();
        this.render();
    },

    fillFunds() {
        const funds = [...new Set(MockClaims.all().map(c => c.fund))].sort();
        document.getElementById('fFund').insertAdjacentHTML('beforeend',
            funds.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join(''));
    },

    scope() {
        const fund = document.getElementById('fFund').value;
        return MockClaims.all().filter(c => fund === 'all' || c.fund === fund);
    },

    render() {
        this.renderKpi();
        this.renderTrend();
        this.renderPrevented();
        this.renderResult();
        this.renderNhso();
        this.renderRules();
        this.renderRefer();
        this.renderRisk();
        this.renderPhases();
        refreshIcons();
    },

    /* ══════════ ภาระผูกพันจากการส่งต่อ ══════════ */

    renderRefer() {
        const np = MockRefer.netPosition();
        const mini = [
            { icon: 'log-out',             value: MockFmt.int(MockRefer.out().length),     label: 'ส่งต่อออก (รายการ)',   href: 'refer-worklist.html?dir=OUT' },
            { icon: 'log-in',              value: MockFmt.int(MockRefer.inbound().length), label: 'รับส่งต่อเข้า (รายการ)', href: 'refer-worklist.html?dir=IN' },
            { icon: 'arrow-up-from-line',  value: MockFmt.baht(np.ap), label: 'ยอดตามจ่ายค้าง (บาท)',  href: 'refer-billing.html?dir=OUT', critical: true },
            { icon: 'arrow-down-to-line',  value: MockFmt.baht(np.ar), label: 'ยอดเรียกเก็บค้าง (บาท)', href: 'refer-billing.html?dir=IN' },
        ];
        document.getElementById('referMini').innerHTML = mini.map(m => `
            <div class="sip-kpi ${m.critical ? 'critical' : ''}" style="cursor:pointer"
                 onclick="location.href='${esc(m.href)}'">
                <i data-lucide="${esc(m.icon)}" class="sip-kpi-icon icon-lg"></i>
                <div class="sip-kpi-value">${esc(m.value)}</div>
                <div class="sip-kpi-label">${esc(m.label)}</div>
            </div>`).join('');

        /* สีเดียว — funnel ไม่ปล่อย legend จึงห้ามสื่อความหมายด้วยสี (กติกา ds-chart ข้อ 2) */
        DSChart.funnel('chartDashRefer', {
            title: 'ปลายทางที่ส่งผู้ป่วยไปมากที่สุด 5 อันดับ',
            steps: MockRefer.byPartner('OUT').slice(0, 5).map(x => ({
                label: x.name, value: x.count, color: 'var(--primary)',
                display: `${MockFmt.int(x.count)} ราย · ${MockFmt.baht(x.amount, { short: true })} บาท`,
            })),
        });
    },

    /* ══════════ KPI ══════════ */

    KPI: [
        { key: 'queue',  icon: 'inbox',          label: 'เคสรอส่งเบิก',
          calc: r => MockFmt.int(r.filter(c => c.nhso && c.nhso.stage === 'AWAIT_SUBMIT').length),
          how: 'นับเคสที่สถานะฝั่ง สปสช. = "รอส่งเบิก"',
          fields: ['claims[].nhso.stage === "AWAIT_SUBMIT"'] },
        { key: 'risk',   icon: 'alert-triangle', label: 'เคสความเสี่ยงสูง (70+)', critical: true,
          calc: r => MockFmt.int(r.filter(c => c.risk_score >= 70 && c.result !== 'PASS').length),
          how: 'นับเคสที่คะแนนความเสี่ยง ≥ 70 และผลตรวจไม่ใช่ "ผ่าน"',
          fields: ['claims[].risk_score >= 70', 'claims[].result !== "PASS"'] },
        { key: 'money',  icon: 'wallet',         label: 'มูลค่าเสี่ยงที่ตรวจพบ (บาท)',
          calc: r => MockFmt.baht(r.reduce((a, c) => a + (c.amount_at_risk || 0), 0)),
          how: 'ผลรวมของมูลค่าที่เสี่ยงถูกตัดจากทุกเคสที่ยังไม่ปิดประเด็น',
          fields: ['Σ claims[].amount_at_risk'] },
        { key: 'first',  icon: 'shield-check',   label: 'First-pass Acceptance',
          calc: () => MockFmt.pct(MockClaims.firstPassRate(), 1),
          how: 'เคสที่ส่งแล้วไม่เคยเข้าสถานะ "รอแก้ไข" ÷ เคสที่ส่งทั้งหมด × 100',
          fields: ['claims[].nhso.stage !== "AWAIT_SUBMIT" (ตัวหาร)',
                   'claims[].nhso.stage !== "AWAIT_FIX" (ตัวตั้ง)'] },
        { key: 'sla',    icon: 'clock',          label: 'งานเกิน SLA',
          calc: () => MockFmt.int(MockTasks.overSla().length),
          how: 'นับ Task ที่ยังไม่ปิดและเลยกำหนดเสร็จแล้ว',
          fields: ['tasks[].status !== "DONE"', 'tasks[].due_at < วันนี้'] },
        { key: 'reject', icon: 'undo-2',         label: 'มูลค่าถูกตัดจ่าย (บาท)',
          calc: r => MockFmt.baht(r.reduce((a, c) => a + (c.amount_rejected || 0), 0)),
          how: 'ผลรวมของยอดที่ สปสช. ตัดจ่ายจริงหลังการ Audit',
          fields: ['Σ claims[].amount_rejected'] },

        /* ── ฝั่งส่งต่อผู้ป่วย — ภาระผูกพันที่เดิมไม่เคยปรากฏบน dashboard ใด ──
           ตัวเลขสองตัวนี้ต้องตรงกับ refer-dashboard และ refer-billing เป๊ะ */
        { key: 'referAp', icon: 'ambulance', label: 'ยอดตามจ่ายส่งต่อค้าง (บาท)', critical: true,
          calc: () => MockFmt.baht(MockRefer.netPosition().ap),
          how: 'ผลรวมยอดคงค้างของใบเรียกเก็บที่ปลายทางส่งมาให้เราตามจ่าย (ยอดใบ − จ่ายแล้ว − โต้แย้ง)',
          fields: ['Σ refer_bills[direction="OUT"].items[].amount',
                   '− Σ refer_bills[].paid_amount', '− Σ refer_bills[].disputed_amount'],
          scopeNote: () => MockRefer.out().length + ' รายการส่งต่อออก (ไม่ตามตัวกรองกองทุน)',
          drill: 'refer-billing.html?dir=OUT' },
        { key: 'referDoc', icon: 'file-warning', label: 'ใบส่งตัวที่มีปัญหา',
          calc: () => MockFmt.int(MockRefer.openRisks().length),
          how: 'นับรายการส่งต่อที่ยังมีธงระดับ ERROR ค้าง (หมดอายุ · เกินขอบเขต · ไม่มีเลขอนุมัติ · เกินวงเงิน · ซ้ำซ้อน)',
          fields: ['referrals[].risk_flags[].level === "ERROR"'],
          scopeNote: () => MockRefer.all().length + ' รายการส่งต่อ (ไม่ตามตัวกรองกองทุน)',
          drill: 'refer-worklist.html?risk=ERROR' },
    ],

    renderKpi() {
        const rows = this.scope();
        document.getElementById('kpiGrid').innerHTML = this.KPI.map(k => `
            <div class="sip-kpi ${k.critical ? 'critical' : ''}" style="cursor:pointer"
                 onclick="Dash.explain('${k.key}')" title="กดเพื่อดูที่มาของตัวเลข">
                <i data-lucide="${k.icon}" class="sip-kpi-icon icon-lg"></i>
                <div class="sip-kpi-value">${esc(k.calc(rows))}</div>
                <div class="sip-kpi-label">${esc(k.label)}</div>
            </div>`).join('');
    },

    /** ตอบคำถาม "ตัวเลขนี้จริงไหม" ก่อนที่จะถูกถามในห้องประชุม */
    explain(key) {
        const k = this.KPI.find(x => x.key === key); if (!k) return;
        const rows = this.scope();
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
                        <tr><td class="l">ขอบเขตที่กรองอยู่</td><td class="l">กองทุน: ${
                            esc(document.getElementById('fFund').value === 'all' ? 'ทุกกองทุน'
                                : document.getElementById('fFund').value)} · ${
                            esc(k.scopeNote ? k.scopeNote() : rows.length + ' เคส')}</td></tr>
                        <tr><td class="l">แหล่งข้อมูล</td><td class="l">ชุดข้อมูลจำลองในต้นแบบ —
                            เมื่อผูกระบบจริงจะมาจาก HIS และผลตอบกลับของ สปสช.</td></tr>
                    </tbody>
                </table>
                <div class="ds-note"><i data-lucide="shield" class="icon-sm"></i>
                    ทุกตัวเลขบน Dashboard เจาะลงไปถึงรายเคส กฎ ผู้แก้ไข และเวลาได้ (BR-03)</div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>
                         <button class="btn btn-save"
                             onclick="Drawer.close();location.href='${esc(k.drill || 'claim-worklist.html')}'">
                             ดูรายเคส</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    /* ══════════ กราฟ ══════════ */

    renderTrend() {
        const t = MOCK_TREND;
        document.getElementById('trendCaption').textContent =
            `เริ่มใช้ระบบเดือน ${t.started_at} — สังเกตจุดที่เส้นสองเส้นแยกออกจากกัน`;
        DSChart.line('chartTrend', {
            title: 'Reject Rate เทียบ First-pass Acceptance',
            labels: t.labels,
            yMax: 100, yFmt: v => v + '%',
            series: [
                { name: 'First-pass Acceptance (%)', points: t.first_pass,  color: 'var(--status-success)' },
                { name: 'Reject Rate (%)',           points: t.reject_rate, color: 'var(--status-danger)' },
            ],
        });
    },

    renderPrevented() {
        DSChart.bars('chartPrevented', {
            title: 'มูลค่าที่ดักได้ก่อนส่ง',
            labels: MOCK_WEEKLY_PREVENTED.labels,
            yFmt: v => MockFmt.baht(v, { short: true }),
            series: [{ name: 'มูลค่าที่ป้องกันได้ (บาท)', values: MOCK_WEEKLY_PREVENTED.values,
                       color: 'var(--primary)' }],
        });
    },

    renderResult() {
        const rows = this.scope();
        const counts = {};
        MockTone.RESULTS.forEach(r => counts[r] = rows.filter(c => c.result === r).length);
        const total = rows.length || 1;

        DSChart.donut('chartResult', {
            title: 'สัดส่วนผลการตรวจด้วยกฎ',
            centerValue: rows.length, centerLabel: 'เคสทั้งหมด',
            slices: MockTone.RESULTS.map(r => ({
                label: MockTone.resultLabel[r], value: counts[r], color: MockTone.resultColor[r] })),
        });

        document.getElementById('resultTable').innerHTML = `
            <thead><tr><th>ผลตรวจ</th><th style="width:1%;text-align:right">จำนวน</th>
                <th style="width:1%;text-align:right">สัดส่วน</th>
                <th style="width:1%;text-align:right">มูลค่าที่เกี่ยวข้อง</th></tr></thead>
            <tbody>${MockTone.RESULTS.map(r => {
                const n = counts[r];
                const amt = rows.filter(c => c.result === r).reduce((a, c) => a + c.amount_claimed, 0);
                return `<tr style="cursor:pointer" onclick="location.href='claim-worklist.html?result=${r}'">
                    <td>${MockTone.resultBadgeHtml(r)}</td>
                    <td style="text-align:right">${MockFmt.int(n)}</td>
                    <td style="text-align:right">${MockFmt.pct((n / total) * 100, 0)}</td>
                    <td style="text-align:right">${esc(MockFmt.baht(amt))}</td>
                </tr>`;
            }).join('')}</tbody>`;
    },

    renderNhso() {
        const stats = MockNhso.stageStats();
        document.getElementById('nhsoStepper').innerHTML = stats.map(s => `
            <span class="ds-step ${s.key === 'AWAIT_FIX' && s.count ? 'active' : s.count ? 'completed' : ''}"
                  style="cursor:pointer" onclick="location.href='nhso-submit.html?stage=${esc(s.key)}'">
                ${esc(s.label)} <strong>(${s.count})</strong></span>`).join('');

        DSChart.funnel('chartFunnel', {
            title: 'ปริมาณเคสตามขั้นตอนของ สปสช.',
            steps: stats.map(s => ({
                label: s.label, value: s.count,
                display: `${s.count} เคส · ${MockFmt.baht(s.amount, { short: true })} บาท`,
                color: s.key === 'AWAIT_FIX' ? 'var(--status-danger)'
                     : s.key === 'PAID' ? 'var(--status-success)' : 'var(--primary)',
            })),
        });
    },

    renderRules() {
        const rules = MockRules.active().slice().sort((a, b) => b.kpi.hit - a.kpi.hit);
        document.getElementById('ruleRows').innerHTML = rules.map(r => `
            <tr style="cursor:pointer" onclick="location.href='claim-rules.html?rule=${encodeURIComponent(r.id)}'">
                <td class="td-sub" style="white-space:nowrap">${esc(r.id)}</td>
                <td class="td-name">${esc(r.name)}
                    <div class="td-sub">${esc(r.category)} · มีผลตั้งแต่ ${esc(MockFmt.dateTH(r.effective_from))}</div></td>
                <td class="td-sub">v${esc(r.version)}</td>
                <td>${r.maps_to_nhso
                    ? `<span class="sip-chip sip-chip-danger">${esc(r.maps_to_nhso)}</span>`
                    : '<span class="td-sub">—</span>'}</td>
                <td style="text-align:right">${MockFmt.int(r.kpi.hit)}</td>
                <td>${DSChart.hbar(r.kpi.true_issue, r.kpi.true_issue + '%',
                        r.kpi.true_issue >= 80 ? 'success' : r.kpi.true_issue >= 60 ? 'warning' : 'danger')}</td>
                <td>${DSChart.hbar(r.kpi.false_positive, r.kpi.false_positive + '%',
                        r.kpi.false_positive <= 15 ? 'success' : r.kpi.false_positive <= 30 ? 'warning' : 'danger')}</td>
                <td style="text-align:right">${MockFmt.pct(r.kpi.override, 0)}</td>
                <td style="text-align:right;white-space:nowrap"><strong>${esc(MockFmt.baht(r.kpi.prevented))}</strong></td>
            </tr>`).join('')
            + `<tr style="background:var(--brand-bg-strong)">
                <td colspan="8" style="text-align:right;font-weight:700">รวมมูลค่าที่กฎป้องกันไว้ได้</td>
                <td style="text-align:right;font-weight:800;white-space:nowrap">
                    ${esc(MockFmt.baht(MockRules.totalPrevented()))}</td></tr>`;
    },

    renderRisk() {
        const rows = this.scope()
            .filter(c => c.result !== 'PASS')
            .sort((a, b) => (b.risk_score - a.risk_score) || (b.amount_at_risk - a.amount_at_risk))
            .slice(0, 10);

        document.getElementById('riskRows').innerHTML = rows.length ? rows.map(c => `
            <tr style="cursor:pointer" onclick="location.href='claim-case.html?id=${encodeURIComponent(c.id)}'">
                <td class="td-sub" style="white-space:nowrap">${esc(c.id)}</td>
                <td class="td-name">${esc(c.patient)}
                    <div class="td-sub">HN ${esc(c.hn)} · ${esc(MockFmt.dateTH(c.service_date))} · ${esc(c.provider)}</div></td>
                <td><span class="sip-chip sip-chip-muted">${esc(c.fund)}</span></td>
                <td style="text-align:right;white-space:nowrap">${esc(MockFmt.baht(c.amount_at_risk))}</td>
                <td>${DSChart.riskbar(c.risk_score)}</td>
                <td>${MockTone.resultBadgeHtml(c.result)}</td>
                <td style="white-space:nowrap">${MockClaims.predictedCodes(c).map(k =>
                    `<span class="sip-chip sip-chip-danger">${esc(k)}</span>`).join(' ') || '<span class="td-sub">—</span>'}</td>
                <td class="td-sub">${esc(MockAdmin.userName(c.owner))}</td>
            </tr>`).join('')
            : '<tr><td colspan="8" class="ds-empty">ไม่มีเคสค้างในขอบเขตที่เลือก</td></tr>';
    },

    renderPhases() {
        const g = NHSO_GOLIVE;
        document.getElementById('phaseBody').innerHTML = `
            <div class="sip-banner sip-banner-warning" style="margin-bottom:14px">
                <i data-lucide="flag" class="icon-sm"></i>
                <span><strong>หมุดเวลาที่ตรึงแผนทั้งหมด:</strong> NHSO Phase 3 (MVP2 Drop 2)
                ${esc(g.label)} <strong>${esc(g.date)}</strong> —
                เพิ่มผู้ป่วยใน (IPD) และสิทธิประกันสังคม/ครูเอกชน/การแพทย์ฉุกเฉิน</span>
            </div>
            <div class="table-responsive">
            <table class="data-table compact">
                <thead><tr><th style="width:1%">ระยะ</th><th>ขอบเขตหลัก</th>
                    <th>ผลส่งมอบ</th><th style="width:1%">ระยะเวลา</th><th style="width:1%">สถานะ</th></tr></thead>
                <tbody>${MOCK_PHASES.map(p => {
                    const t = PHASE_TONE[p.status];
                    return `<tr>
                        <td style="white-space:nowrap"><strong>ระยะ ${esc(p.no)}</strong>
                            <div class="td-sub">${esc(p.name)}</div></td>
                        <td>${esc(p.scope)}</td>
                        <td class="td-sub">${esc(p.deliver)}</td>
                        <td class="td-sub" style="white-space:nowrap">${esc(p.weeks)}</td>
                        <td><span class="status-badge ${esc(t.badge)}">${esc(t.label)}</span></td>
                    </tr>`;
                }).join('')}</tbody>
            </table></div>
            <div class="ds-note"><i data-lucide="info" class="icon-sm"></i>
                ระยะเวลาจริงกำหนดหลังทราบจำนวน Interface ปริมาณข้อมูล กองทุนนำร่อง คุณภาพเอกสาร
                และทรัพยากรของโรงพยาบาล — เสนอใช้ Agile Iteration 2–3 สัปดาห์ พร้อมสาธิตและรับรองผลเป็นช่วง</div>`;
    },

    /* ══════════ ใบพิมพ์ ══════════ */

    buildDoc() {
        const C = DocParts.CELL;
        const warnings = [];
        const rows = this.scope();

        const kpiRows = this.KPI.map((k, i) => `<tr>
            <td style="${C}text-align:center;">${i + 1}</td>
            <td style="${C}">${DocParts.esc(k.label)}</td>
            <td style="${C}text-align:right;font-weight:700;">${DocParts.esc(k.calc(rows))}</td>
            <td style="${C}">${DocParts.esc(k.how)}</td>
        </tr>`).join('');

        const ruleRows = MockRules.active().map((r, i) => `<tr>
            <td style="${C}text-align:center;">${i + 1}</td>
            <td style="${C}">${DocParts.esc(r.id)} v${DocParts.esc(r.version)}</td>
            <td style="${C}">${DocParts.esc(r.name)}</td>
            <td style="${C}text-align:center;">${DocParts.esc(r.maps_to_nhso || '')}</td>
            <td style="${C}text-align:right;">${DocParts.esc(r.kpi.hit)}</td>
            <td style="${C}text-align:right;">${DocParts.esc(r.kpi.true_issue)}%</td>
            <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(r.kpi.prevented))}</td>
        </tr>`).join('');

        /* ใช้ตัวช่วยชุดเดียวกับหน้าจอ — ตัวเลขบนกระดาษจึงตรงกับที่เห็น (PAGE-GUIDE §5B) */
        const np = MockRefer.netPosition();
        const referRows = MockRefer.byPartner('OUT').slice(0, 8).map((x, i) => `<tr>
            <td style="${C}text-align:center;">${i + 1}</td>
            <td style="${C}">${DocParts.esc(x.name)}</td>
            <td style="${C}text-align:center;">${DocParts.esc(x.level || '')}</td>
            <td style="${C}text-align:right;">${DocParts.esc(MockFmt.int(x.count))}</td>
            <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(x.amount))}</td>
            <td style="${C}text-align:center;">${x.mou == null ? '—' : (x.mou ? 'มี' : 'ไม่มี')}</td>
        </tr>`).join('');

        const th = (t, w) => `<th style="${C}font-size:11px;font-weight:700;text-align:center;`
                           + `${w ? 'width:' + w + ';' : ''}">${DocParts.esc(t)}</th>`;

        const fields = [
            ['ขอบเขต', document.getElementById('fFund').value === 'all' ? 'ทุกกองทุน' : document.getElementById('fFund').value],
            ['จำนวนเคส', rows.length + ' เคส'],
            ['รายการส่งต่อ', MockRefer.all().length + ' รายการ'],
            ['ผู้พิมพ์', MockSession.user().full_name],
        ];

        /* ⚠️ ใบพิมพ์หลุดมือไปได้ไกลกว่าหน้าจอ — แถบนี้ต้องติดไปกับกระดาษเสมอ */
        const mockBand = `<div style="background:#fee2e2;border:2px solid #dc2626;border-left-width:7px;
            color:#991b1b;font-size:12px;font-weight:700;line-height:1.5;padding:8px 12px;margin-bottom:10px;
            -webkit-print-color-adjust:exact;print-color-adjust:exact;">
            ข้อมูล MOCKUP — ตัวเลขทุกตัวในเอกสารฉบับนี้เป็นข้อมูลสมมติเพื่อสาธิตรูปแบบรายงาน
            ไม่ใช่ข้อมูลจริงของโรงพยาบาล และห้ามนำไปใช้อ้างอิงหรือตัดสินใจ
        </div>`;

        const html = `<div style="color:#000;font-size:12px;">
            ${DocParts.docHead({ title: 'สรุปภาพรวมผู้บริหาร — Claim Control Tower', formCode: 'EXEC/2569', fields })}
            ${mockBand}
            <div style="font-weight:700;margin:10px 0 4px">1. ตัวชี้วัดหลัก</div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>${th('ที่', '30px')}${th('ตัวชี้วัด', '26%')}${th('ค่า', '18%')}${th('วิธีคำนวณ')}</tr></thead>
                <tbody>${DocParts.fillRows(kpiRows, 6, 4)}</tbody>
            </table>
            <div style="font-weight:700;margin:12px 0 4px">2. ผลของกฎที่เปิดใช้อยู่</div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>${th('ที่', '30px')}${th('รหัสกฎ', '96px')}${th('ชื่อกฎ')}
                    ${th('รหัส NHSO', '62px')}${th('Hit', '44px')}${th('True Issue', '58px')}${th('มูลค่าที่ป้องกันได้', '88px')}</tr></thead>
                <tbody>${DocParts.fillRows(ruleRows, 8, 7)}</tbody>
            </table>
            <div style="margin-top:10px;font-size:12px">
                รวมมูลค่าที่กฎป้องกันไว้ได้ <strong>${DocParts.esc(MockFmt.baht(MockRules.totalPrevented()))}</strong> บาท
            </div>

            <div style="font-weight:700;margin:12px 0 4px">3. ภาระผูกพันจากการส่งต่อผู้ป่วย</div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>${th('ที่', '30px')}${th('ปลายทางที่ส่งไป')}${th('ระดับ', '16%')}
                    ${th('จำนวน', '58px')}${th('มูลค่า (บาท)', '90px')}${th('MOU', '46px')}</tr></thead>
                <tbody>${DocParts.fillRows(referRows, 6, 6)}</tbody>
            </table>
            <div style="margin-top:8px;font-size:12px">
                ยอดตามจ่ายค้าง <strong>${DocParts.esc(MockFmt.baht(np.ap))}</strong> บาท ·
                ยอดเรียกเก็บค้าง <strong>${DocParts.esc(MockFmt.baht(np.ar))}</strong> บาท ·
                สถานะสุทธิ <strong>${DocParts.esc(MockFmt.baht(np.net))}</strong> บาท ·
                ใบส่งตัวที่มีปัญหา <strong>${DocParts.esc(MockRefer.openRisks().length)}</strong> รายการ
            </div>

            ${DocParts.signatureBlock(['ลงชื่อ ผู้จัดทำ', 'ลงชื่อ ผู้บริหารรับทราบ'])}
            ${DocParts.footer(fields)}
        </div>`;

        return { html: DocParts.toPrintBorders(html), warnings };
    },

    openPrint() {
        const { html, warnings } = this.buildDoc();
        DocPrint.preview({ title: 'ตัวอย่างก่อนพิมพ์ — สรุปภาพรวมผู้บริหาร', html, warnings });
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.Dash = Dash;
document.addEventListener('DOMContentLoaded', () => Dash.init());
