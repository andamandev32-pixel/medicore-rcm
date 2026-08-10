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
        this.renderIpd();
        this.renderRefer();
        this.renderRisk();
        this.renderPhases();
        refreshIcons();
    },

    /* ══════════ งานผู้ป่วยใน (IPD) ══════════
       ทุกตัวเลขมาจาก MockIpd — ห้ามคำนวณเองในไฟล์นี้
       ไม่งั้น KPI หน้านี้กับตัวนับใน pill ของ ipd-worklist / ipd-audit จะขัดกัน
       ⚠️ ส่วนต่างจากประมาณการ DRG เป็น "ข้อมูลประกอบ" เท่านั้น
          อัตราจ่ายต่อ RW ยังเป็นค่าจำลอง ห้ามนำไปตัดสินอะไรจนกว่าจะใส่อัตราจริง */

    renderIpd() {
        const st = MockIpd.stats();

        const mini = [
            { icon: 'bed',           value: MockFmt.int(st.admitted),
              label: 'กำลังนอน (ราย)',            href: 'ipd-worklist.html?stage=admitted' },
            { icon: 'calendar-clock', value: MockFmt.int(st.losOver),
              label: 'วันนอนเกินจุดตัด DRG',      href: 'ipd-worklist.html', critical: true },
            { icon: 'folder-x',      value: MockFmt.int(st.filesShort),
              label: 'แฟ้มไม่ครบตามกองทุน',       href: 'ipd-worklist.html?files=incomplete', critical: true },
            { icon: 'clipboard-check', value: MockFmt.int(st.pending + st.inReview),
              label: 'รอตรวจแฟ้ม (ราย)',          href: 'ipd-audit.html' },
            { icon: 'undo-2',        value: MockFmt.int(st.returned),
              label: 'ตีกลับให้แก้ (ราย)',        href: 'ipd-audit.html', critical: st.returned > 0 },
        ];

        document.getElementById('ipdMini').innerHTML = mini.map(m => `
            <div class="sip-kpi ${m.critical ? 'critical' : ''}" style="cursor:pointer"
                 onclick="location.href='${esc(m.href)}'">
                <i data-lucide="${esc(m.icon)}" class="sip-kpi-icon icon-lg"></i>
                <div class="sip-kpi-value">${esc(m.value)}</div>
                <div class="sip-kpi-label">${esc(m.label)}</div>
            </div>`).join('');

        /* คิวตรวจแฟ้มเรียงตามลำดับที่งานเดินจริง — สีสื่อความหมายเหมือน funnel ของ สปสช. */
        const queue = [
            { key: 'PENDING',   color: 'var(--primary)' },
            { key: 'IN_REVIEW', color: 'var(--primary)' },
            { key: 'RETURNED',  color: 'var(--status-danger)' },
            { key: 'CLEARED',   color: 'var(--status-success)' },
        ];
        DSChart.funnel('chartDashIpd', {
            title: 'คิวตรวจแฟ้มผู้ป่วยใน — ตามลำดับที่งานเดิน',
            steps: queue.map(q => {
                const rows = MockIpd.all().filter(s => s.audit_status === q.key);
                const cost = rows.reduce((a, s) => a + MockIpd.cost(s), 0);
                return {
                    label: MockIpd.auditOf(q.key).label,
                    value: rows.length,
                    display: `${MockFmt.int(rows.length)} ราย · ${MockFmt.baht(cost, { short: true })} บาท`,
                    color: q.color,
                };
            }),
        });

        /* เคสที่ผลประเมินยังไม่ผ่าน — เรียงตามลำดับความรุนแรงก่อน แล้วค่อยคะแนนต่ำสุด
           ลำดับความรุนแรงใช้ชุดเดียวกับ MockIpd.assess(): ระงับส่ง → ต้องแก้ไข → ต้องอนุมัติ → แจ้งเตือน
           (เรียงด้วยคะแนนอย่างเดียวไม่ได้ — เคส "ระงับส่ง" ที่คะแนนสูงจะตกไปท้ายตาราง
            ทั้งที่เป็นเคสเดียวที่ส่งเบิกไม่ได้เลย) */
        const SEVERITY = { BLOCK: 0, FIX: 1, APPROVE: 2, WARN: 3, PASS: 4 };
        const bad = MockIpd.toAudit()
            .map(s => ({ stay: s, a: MockIpd.assess(s) }))
            .filter(x => x.a.result !== 'PASS')
            .sort((a, b) => (SEVERITY[a.a.result] - SEVERITY[b.a.result]) || (a.a.score - b.a.score))
            .slice(0, 6);

        document.getElementById('ipdRows').innerHTML = bad.length
            ? bad.map(x => {
                const f = MockIpd.fund(x.stay.fund);
                const band = MockIpd.losBand(x.stay);
                return `
                <tr style="cursor:pointer" onclick="location.href='ipd-audit.html?an=${encodeURIComponent(x.stay.an)}'">
                    <td class="td-sub" style="white-space:nowrap">${esc(x.stay.an)}</td>
                    <td class="td-name">${esc(x.stay.patient)}
                        <div class="td-sub">${esc(x.a.reasons.length)} ประเด็นที่ยังค้าง</div></td>
                    <td class="td-sub">${esc(f ? f.short : x.stay.fund)}</td>
                    <td style="text-align:right;white-space:nowrap${band === 'high'
                        ? ';color:var(--status-danger);font-weight:800' : ''}">
                        ${MockFmt.int(MockIpd.los(x.stay))}</td>
                    <td style="text-align:right;font-weight:700">${esc(x.a.score)}</td>
                    <td>${MockTone.resultBadgeHtml(x.a.result)}</td>
                </tr>`;
            }).join('')
            : '<tr><td colspan="6" class="ds-empty">ไม่มีเคสที่ต้องแก้ — แฟ้มพร้อมส่งเบิกทั้งหมด</td></tr>';
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

    /* นิยาม KPI ทั้ง 10 ตัวอยู่ที่ MockKpi.DEFS (js/mock/mock-kpi.js)
       และการ์ด/drawer เรนเดอร์โดย DSKpi (js/ds/ds-kpi.js) — ที่นี่เหลือแค่ผูก 2 อย่างเข้าด้วยกัน
       เหตุผลที่ย้ายออก: refer-dashboard.js เคยลอกโค้ดชุดนี้ไปทั้งดุ้น พอแก้ที่เดียวอีกหน้าไม่ตาม
       และตัวเลขบนการ์ดกับจำนวนแถวในหน้าปลายทางต้องมาจากฟังก์ชันเดียวกันเสมอ (PAGE-GUIDE §7B) */

    kpiDefs() { return MockKpi.forPage('claim-dashboard'); },

    kpiCtx() {
        return { rows: this.scope(), fund: document.getElementById('fFund').value };
    },

    renderKpi() {
        DSKpi.configure({
            defs:    this.kpiDefs(),
            ctx:     () => this.kpiCtx(),
            resolve: (def, ctx) => MockKpi.rows(def, ctx),
            value:   (def, ctx) => MockKpi.value(def, ctx),
            cap:     MockKpi.CAP,
            fmt:     v => MockFmt.baht(v),
            scopeLine: (k, ctx) => `กองทุน: ${ctx.fund === 'all' ? 'ทุกกองทุน' : ctx.fund} · `
                + (k.scopeNote ? k.scopeNote() : ctx.rows.length + ' เคส'),
            sourceNote: 'ชุดข้อมูลจำลองในต้นแบบ — เมื่อผูกระบบจริงจะมาจาก HIS และผลตอบกลับของ สปสช.',
            note: 'ทุกตัวเลขบน Dashboard เจาะลงไปถึงรายเคส กฎ ผู้แก้ไข และเวลาได้ (BR-03)',
            drillText: 'ดูรายการทั้งหมด',
        });
        document.getElementById('kpiGrid').innerHTML = DSKpi.cards();
        document.getElementById('kpiFootnote').innerHTML = DSKpi.footnote();
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

        /* หน้าแรกของ สปสช. แบ่งด้วยคำถามเดียว: ตอนนี้งานอยู่ที่ใคร
           ถังของหน่วยบริการคือเวลาที่โรงพยาบาลคุมได้เอง — ที่ที่ระบบเราสร้างมูลค่า */
        const buckets = MockNhso.bucketStats();
        const total   = buckets.reduce((a, b) => a + b.count, 0) || 1;

        document.getElementById('nhsoStepper').innerHTML =
            buckets.map(b => `
                <div style="flex:1 1 240px;min-width:220px;padding:10px 12px;border-radius:10px;
                     border:1px solid ${b.key === 'PROVIDER' ? 'var(--primary)' : 'var(--brand-border)'};
                     background:${b.key === 'PROVIDER' ? 'var(--primary-bg)' : 'var(--surface)'}">
                    <div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700">
                        <i data-lucide="${b.icon}" class="icon-sm"></i> ${esc(b.short)}
                        <span class="sip-chip sip-chip-muted" style="margin-left:auto">
                            ${Math.round(b.count / total * 100)}%</span>
                    </div>
                    <div style="font-size:22px;font-weight:800;color:var(--brand-navy);margin:2px 0">
                        ${MockFmt.int(b.count)} <span style="font-size:12px;font-weight:600">รายการ</span></div>
                    <div style="font-size:11.5px;margin-bottom:6px">
                        <span class="ds-amt ds-amt-billed">${esc(MockFmt.baht(b.billed))}</span> /
                        <span class="ds-amt ds-amt-comp">${esc(MockFmt.baht(b.compensated))}</span> บาท</div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px">
                        ${b.stages.map(s => `<span class="sip-chip sip-chip-muted" style="cursor:pointer"
                            onclick="location.href='nhso-submit.html?stage=${esc(s.key)}'">
                            ${esc(s.label)} <strong>${s.count}</strong></span>`).join('')}
                    </div>
                </div>`).join('');

        DSChart.funnel('chartFunnel', {
            title: 'ปริมาณเคสตามขั้นตอนของ สปสช.',
            steps: stats.map(s => ({
                label: s.label, value: s.count,
                display: `${s.count} เคส · ${MockFmt.baht(s.billed, { short: true })} / `
                       + `${MockFmt.baht(s.compensated, { short: true })} บาท`,
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
                และทรัพยากรของโรงพยาบาล — เสนอใช้ Agile Iteration 2–3 สัปดาห์ พร้อมสาธิตและรับรองผลเป็นช่วง</div>

            <div class="ds-section-label" style="margin-top:16px">
                ${esc(NHSO_MASTERPLAN.title)}</div>
            <div class="td-sub" style="margin-bottom:10px">
                16 ก.ย. 2569 ไม่ใช่ปลายทาง — แผนของ สปสช. เดินต่อถึงบูรณาการเต็มรูปแบบ
                ที่มา: ${esc(NHSO_MASTERPLAN.source)}
            </div>
            <div class="table-responsive">
            <table class="data-table compact">
                <thead><tr><th style="width:1%">ระยะ</th><th style="width:22%">ช่วงเวลา</th>
                    <th>หมุดสำคัญ</th></tr></thead>
                <tbody>${NHSO_MASTERPLAN.phases.map(p => `<tr>
                    <td style="white-space:nowrap"><strong>${esc(p.phase)}</strong>
                        <div class="td-sub">${esc(p.title)}</div></td>
                    <td class="td-sub">${esc(p.when)}</td>
                    <td class="td-sub">${p.milestones.map(m => `<div>· ${esc(m)}</div>`).join('')}</td>
                </tr>`).join('')}</tbody>
            </table></div>
            <div class="ds-warn" style="margin-top:10px">
                <i data-lucide="alert-triangle" class="icon-sm"></i>
                <span><strong>เอกสาร 2 ฉบับให้วันไม่ตรงกัน</strong> —
                Overview (23 มิ.ย. 2569) ระบุนำร่องโรงพยาบาล 1 ก.ค. 2569 (1,700 แห่ง)
                ส่วน Communication V4 (3 ส.ค. 2569 · ใหม่กว่า) ระบุ Go-Live 16 ก.ย. 2569 (308 หน่วย)
                — แผนนี้ยึดฉบับใหม่กว่าเป็นหมุดหลัก และเก็บแผน 4 ปีไว้เป็นบริบทระยะยาว
                ต้องยืนยันกับ สปสช. ก่อนตรึงแผนโครงการจริง</span>
            </div>`;
    },

    /* ══════════ ใบพิมพ์ ══════════ */

    buildDoc() {
        const C = DocParts.CELL;
        const warnings = [];
        const rows = this.scope();

        /* ค่าบนกระดาษต้องมาจาก MockKpi ตัวเดียวกับที่การ์ดบนจอใช้ (PAGE-GUIDE §5B) */
        const kpiCtx = this.kpiCtx();
        const kpiRows = this.kpiDefs().map((k, i) => `<tr>
            <td style="${C}text-align:center;">${i + 1}</td>
            <td style="${C}">${DocParts.esc(k.label)}</td>
            <td style="${C}text-align:right;font-weight:700;">${DocParts.esc(MockKpi.value(k, kpiCtx))}</td>
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
