/* ────────────────────────────────────────────────────────
   ทะเบียนผู้ป่วยใน (IPD Worklist)

   แพทเทิร์นเดียวกับ claim-worklist.js: global object ไม่ใช่ IIFE
   ทุกตัวเลขบนหน้ามาจาก MockIpd — ห้ามคำนวณเองในไฟล์นี้
   ไม่งั้น KPI หน้านี้กับตัวนับใน pill ของ ipd-admit / ipd-audit จะขัดกัน
   ──────────────────────────────────────────────────────── */

const IpdWorklist = {

    /* ช่วงของเส้นงาน — ใช้ทั้งใน segbar และเป็นตัวกรองหลัก */
    STAGES: [
        { key: 'all',      label: 'ทั้งหมด',    fn: s => true },
        { key: 'admitted', label: 'กำลังนอน',   fn: s => MockIpd.statusOf(s.status).open },
        { key: 'audit',    label: 'รอตรวจแฟ้ม', fn: s => s.audit_status === 'PENDING' || s.audit_status === 'IN_REVIEW' },
        { key: 'returned', label: 'ตีกลับให้แก้', fn: s => s.audit_status === 'RETURNED' },
        { key: 'cleared',  label: 'ผ่านแล้ว',   fn: s => s.audit_status === 'CLEARED' },
    ],

    state: { stage: 'all' },

    init() {
        MockSession.mountBanner('demoBanner');

        const p = new URLSearchParams(location.search);
        if (p.get('stage')) this.state.stage = p.get('stage');
        if (p.get('fund'))  this._pendingFund = p.get('fund');
        if (p.get('files') === 'incomplete') this._pendingFiles = 'incomplete';

        /* ?kpi= มาจากการ์ด KPI บน Dashboard — กรองด้วยชุด id ชุดเดียวกับที่ drawer แสดง
           จำนวนแถวที่นี่จึงเท่ากับตัวเลขบนการ์ดเสมอ (คืน null ถ้าไม่มี ?kpi= หรือ key ไม่รู้จัก) */
        this._kpi = MockKpi.fromUrl();

        this.fillFilters();
        this.renderSeg();
        this.render();
    },

    reload() { this.render(); showToast('รีเฟรชข้อมูลแล้ว'); },

    gotoAudit() { location.href = 'ipd-audit.html'; },

    /* ── ตัวกรอง ── */

    fillFilters() {
        const used = MockIpd.all();

        const fundSel = document.getElementById('fFund');
        fundSel.insertAdjacentHTML('beforeend', IPD_FUNDS
            .filter(f => used.some(s => s.fund === f.key))
            .map(f => `<option value="${esc(f.key)}">${esc(f.label)}</option>`).join(''));
        if (this._pendingFund) fundSel.value = this._pendingFund;

        document.getElementById('fWard').insertAdjacentHTML('beforeend', IPD_WARDS
            .filter(w => used.some(s => s.ward === w.key))
            .map(w => `<option value="${esc(w.key)}">${esc(w.label)}</option>`).join(''));

        document.getElementById('fStatus').insertAdjacentHTML('beforeend', IPD_STAY_STATUS
            .filter(v => used.some(s => s.status === v.key))
            .map(v => `<option value="${esc(v.key)}">${esc(v.label)}</option>`).join(''));

        document.getElementById('fAudit').insertAdjacentHTML('beforeend', IPD_AUDIT_STATUS
            .filter(v => used.some(s => s.audit_status === v.key))
            .map(v => `<option value="${esc(v.key)}">${esc(v.label)}</option>`).join(''));

        const fileSel = document.getElementById('fFiles');
        if (this._pendingFiles) fileSel.value = this._pendingFiles;
    },

    renderSeg() {
        const all = MockIpd.all().filter(s => MockKpi.keep(s));
        document.getElementById('segStage').innerHTML = this.STAGES.map(st => `
            <button class="ds-seg ${st.key === this.state.stage ? 'active' : ''}"
                    onclick="IpdWorklist.setStage('${st.key}')">${esc(st.label)} (${all.filter(st.fn).length})</button>`).join('');
    },

    setStage(key) {
        this.state.stage = key;
        this.renderSeg();
        this.render();
    },

    visible() {
        const kw     = document.getElementById('searchBox').value.trim().toLowerCase();
        const fund   = document.getElementById('fFund').value;
        const ward   = document.getElementById('fWard').value;
        const status = document.getElementById('fStatus').value;
        const audit  = document.getElementById('fAudit').value;
        const los    = document.getElementById('fLos').value;
        const files  = document.getElementById('fFiles').value;

        const stage = this.STAGES.find(s => s.key === this.state.stage) || this.STAGES[0];

        return MockIpd.all().filter(s => {
            if (!MockKpi.keep(s)) return false;
            if (!stage.fn(s)) return false;
            if (fund   !== 'all' && s.fund !== fund) return false;
            if (ward   !== 'all' && s.ward !== ward) return false;
            if (status !== 'all' && s.status !== status) return false;
            if (audit  !== 'all' && s.audit_status !== audit) return false;
            if (los    !== 'all' && MockIpd.losBand(s) !== los) return false;
            if (files !== 'all') {
                const fc = MockIpd.fileCheck(s);
                const ok = !fc.nhso || fc.ok;
                if (files === 'incomplete' && ok)  return false;
                if (files === 'complete'   && !ok) return false;
            }
            if (kw && !(`${s.an} ${s.hn} ${s.patient} ${s.id}`).toLowerCase().includes(kw)) return false;
            return true;
        });
    },

    /* ── แสดงผล ── */

    render() {
        MockKpi.mountBanner('kpiFilterBar');
        const rows  = this.visible();
        const tbody = document.getElementById('rows');

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="15" class="ds-empty">ไม่พบรายการตามเงื่อนไขที่เลือก</td></tr>';
        } else {
            tbody.innerHTML = rows.map(s => {
                const st    = MockIpd.statusOf(s.status);
                const drg   = MockIpd.drgOf(s);
                const band  = MockIpd.losBand(s);
                const arw   = MockIpd.adjRw(s);
                const est   = MockIpd.estimate(s);
                const varc  = MockIpd.variance(s);
                const fc    = MockIpd.fileCheck(s);
                const asses = MockIpd.assess(s);

                const losCell = `<span style="${band === 'high' ? 'color:var(--status-danger);font-weight:700'
                                  : band === 'low' ? 'color:var(--status-warning);font-weight:700' : ''}"
                                       title="${esc(drg ? `จุดตัด ${drg.trimLow}–${drg.trimHigh} วัน` : 'ยังจัดกลุ่ม DRG ไม่ได้')}"
                                 >${MockIpd.los(s)} วัน</span>`
                    + (s.leave_days ? `<div class="td-sub">ลากลับบ้าน ${esc(s.leave_days)} วัน</div>` : '');

                const drgCell = drg
                    ? `<div style="white-space:nowrap">${esc(drg.drg)}<sup title="${esc(IPD_UNVERIFIED_NOTE)}">*</sup></div>
                       <div class="td-sub">AdjRW ${esc(arw.toFixed(4))}</div>`
                    : '<span class="sip-chip sip-chip-danger">จัดกลุ่มไม่ได้</span>';

                const fileCell = !fc.nhso
                    ? `<span class="sip-chip sip-chip-muted" title="กองทุนนี้ไม่ส่งผ่านชุดข้อมูลมาตรฐาน สปสช.">ไม่ผ่าน NHSO</span>`
                    : fc.ok
                        ? `<span class="sip-chip sip-chip-success">${fc.sent.length}/${fc.required.length}</span>`
                        : `<span class="sip-chip sip-chip-danger"
                                 title="ขาด ${esc(MockNhso.fileNames(fc.missing))}">ขาด ${fc.missing.length} แฟ้ม</span>`;

                const money = v => v == null
                    ? '<span class="td-sub">—</span>'
                    : esc(MockFmt.baht(v));
                const varCell = varc == null
                    ? '<span class="td-sub" title="กองทุนนี้ไม่จ่ายตาม DRG">—</span>'
                    : `<span style="color:${varc > 0 ? 'var(--status-danger)' : 'var(--status-success)'}">${
                        varc > 0 ? '+' : ''}${esc(MockFmt.baht(varc))}</span>`;

                return `
                <tr style="cursor:pointer" onclick="IpdWorklist.open('${esc(s.id)}')">
                    <td class="td-sub" style="white-space:nowrap">${esc(s.an)}</td>
                    <td class="td-sub">${esc(s.hn)}</td>
                    <td class="td-name">${esc(s.patient)}
                        <div class="td-sub">${esc(s.age)} ปี · ${s.gender === 'F' ? 'หญิง' : 'ชาย'}${
                            s.pdx ? ' · ' + esc(s.pdx) : ''}</div></td>
                    <td><span class="sip-chip sip-chip-muted"
                              title="${esc((MockIpd.fund(s.fund) || {}).label || '')}">${esc(s.fund)}</span></td>
                    <td class="td-sub" style="white-space:nowrap">${esc(s.ward)} · ${esc(s.bed)}</td>
                    <td class="td-sub" style="white-space:nowrap">${esc(MockFmt.dateTH(s.admit_at))}</td>
                    <td style="white-space:nowrap">${losCell}</td>
                    <td>${drgCell}</td>
                    <td style="text-align:right;white-space:nowrap">${esc(MockFmt.baht(MockIpd.cost(s)))}</td>
                    <td style="text-align:right;white-space:nowrap">${money(est)}</td>
                    <td style="text-align:right;white-space:nowrap">${varCell}</td>
                    <td style="white-space:nowrap">${fileCell}</td>
                    <td><span class="status-badge ${esc(st.badge)}">${esc(st.label)}</span>
                        <div class="td-sub">${esc(MockIpd.auditOf(s.audit_status).label)}</div></td>
                    <td>${MockTone.resultBadgeHtml(asses.result)}</td>
                    <td style="white-space:nowrap" onclick="event.stopPropagation()">
                        <button class="ds-icon-btn" title="เปิดรายละเอียด" onclick="IpdWorklist.open('${esc(s.id)}')">
                            <i data-lucide="eye" class="icon-sm"></i></button>
                        <button class="ds-icon-btn neutral" title="ดูสรุปการประเมิน"
                                onclick="IpdWorklist.openSummary('${esc(s.id)}')">
                            <i data-lucide="shield-check" class="icon-sm"></i></button>
                    </td>
                </tr>`;
            }).join('');
        }

        /* KPI คำนวณจากชุดที่กรองอยู่ — สิ่งที่เห็นคือสิ่งที่นับ */
        const k = MockIpd.stats(rows);
        document.getElementById('rowCount').textContent    = rows.length + ' รายการ';
        document.getElementById('kpiAdmitted').textContent = MockFmt.int(k.admitted);
        document.getElementById('kpiLosOver').textContent  = MockFmt.int(k.losOver);
        document.getElementById('kpiFiles').textContent    = MockFmt.int(k.filesShort);
        document.getElementById('kpiPending').textContent  = MockFmt.int(k.pending + k.inReview);
        document.getElementById('kpiCost').textContent     = MockFmt.baht(k.cost, { short: true });
        document.getElementById('kpiVariance').textContent = (k.variance > 0 ? '+' : '')
            + MockFmt.baht(k.variance, { short: true });

        refreshIcons();   // ⚠️ ต้องเรียกทุกครั้งหลัง innerHTML
    },

    /* ── การกระทำ ── */

    /** ยังนอนอยู่ → หน้าติดตาม · จำหน่ายแล้ว → หน้าตรวจแฟ้ม */
    open(id) {
        const s = MockIpd.byId(id); if (!s) return;
        const page = MockIpd.statusOf(s.status).open ? 'ipd-admit.html' : 'ipd-audit.html';
        location.href = page + '?an=' + encodeURIComponent(s.an);
    },

    openSummary(id) {
        const s = MockIpd.byId(id); if (!s) return;
        const a = MockIpd.assess(s);

        const body = a.reasons.length
            ? `<ul style="margin:0;padding-left:18px;line-height:1.9">${a.reasons.map(r =>
                  `<li style="color:${r.tone === 'danger' ? 'var(--status-danger)' : 'var(--status-warning)'}">${esc(r.text)}</li>`).join('')}</ul>`
            : '<div class="sip-banner sip-banner-success"><i data-lucide="check-circle-2" class="icon-sm"></i> ไม่พบประเด็นค้าง พร้อมส่งเบิก</div>';

        Drawer.open({
            title: `สรุปการประเมิน — AN ${s.an}`,
            contentHtml: `
                <div class="ds-note" style="margin-bottom:12px">
                    <i data-lucide="user" class="icon-sm"></i> ${esc(s.patient)} · HN ${esc(s.hn)} ·
                    กองทุน ${esc((MockIpd.fund(s.fund) || {}).label || s.fund)} ·
                    วันนอน ${esc(MockIpd.los(s))} วัน
                </div>
                <div class="cards-row" style="margin-bottom:14px">
                    <div class="card"><div class="card-title">คะแนนรวม</div>
                        <div style="font-size:26px;font-weight:800">${esc(a.score)}<span style="font-size:14px">/100</span></div></div>
                    <div class="card"><div class="card-title">ผลที่ระบบเสนอ</div>
                        <div style="margin-top:6px">${MockTone.resultBadgeHtml(a.result)}</div></div>
                    <div class="card"><div class="card-title">เวชระเบียน</div>
                        <div style="font-size:26px;font-weight:800">${esc(a.chart.pct)}%</div></div>
                </div>
                ${body}`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>
                         <button class="btn btn-save" onclick="IpdWorklist.open('${esc(s.id)}')">เปิดรายละเอียด</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    /* ── ใบพิมพ์ ── */

    buildReport() {
        const C = DocParts.CELL;
        const warnings = [];
        const rows = this.visible();

        const th = (t, w) => `<th style="${C}font-size:11px;font-weight:700;text-align:center;`
                           + `${w ? 'width:' + w + ';' : ''}">${DocParts.esc(t)}</th>`;

        const body = rows.map((s, i) => {
            const est = MockIpd.estimate(s);
            return `<tr>
            <td style="${C}text-align:center;">${i + 1}</td>
            <td style="${C}">${DocParts.esc(s.an)}</td>
            <td style="${C}">${DocParts.esc(s.hn)}</td>
            <td style="${C}">${DocParts.esc(s.patient)}</td>
            <td style="${C}text-align:center;">${DocParts.esc(s.fund)}</td>
            <td style="${C}text-align:center;">${DocParts.esc(s.ward)}</td>
            <td style="${C}text-align:center;">${DocParts.esc(MockFmt.dateTH(s.admit_at))}</td>
            <td style="${C}text-align:center;">${DocParts.esc(MockIpd.los(s))}</td>
            <td style="${C}text-align:center;" class="${DocPrint.miss(s.pdx, 'การวินิจฉัยหลักของ AN ' + s.an, warnings)}">
                ${DocParts.esc(s.pdx || '')}</td>
            <td style="${C}text-align:center;" class="${DocPrint.miss(s.drg, 'กลุ่ม DRG ของ AN ' + s.an, warnings)}">
                ${DocParts.esc(s.drg || '')}</td>
            <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(MockIpd.cost(s)))}</td>
            <td style="${C}text-align:right;">${DocParts.esc(est == null ? '—' : MockFmt.baht(est))}</td>
            <td style="${C}text-align:center;">${DocParts.esc(MockIpd.auditOf(s.audit_status).label)}</td>
        </tr>`; }).join('');

        const fields = [
            ['ช่วงงาน', (this.STAGES.find(s => s.key === this.state.stage) || {}).label || 'ทั้งหมด'],
            ['จำนวน', rows.length + ' รายการ'],
            ['ค่าใช้จ่ายรวม', MockFmt.baht(rows.reduce((a, s) => a + MockIpd.cost(s), 0)) + ' บาท'],
            ['ผู้พิมพ์', MockSession.user().full_name],
        ];

        const html = `<div style="color:#000;font-size:12px;">
            ${DocParts.docHead({ title: 'ทะเบียนผู้ป่วยใน', formCode: 'IPD/2569', fields })}
            <div style="font-size:10px;margin:0 0 6px">
                หมายเหตุ: กลุ่ม DRG และประมาณการรับเป็นค่าจำลอง ยังไม่ได้อ้างอิงคู่มือ Thai DRG ฉบับจริง
            </div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>
                    ${th('ลำดับ', '32px')}${th('AN', '58px')}${th('HN', '58px')}${th('ชื่อ-สกุล')}
                    ${th('กองทุน', '46px')}${th('หอผู้ป่วย', '54px')}${th('วันรับไว้', '66px')}${th('วันนอน', '40px')}
                    ${th('PDx', '52px')}${th('DRG', '48px')}${th('ค่าใช้จ่าย', '66px')}${th('ประมาณการรับ', '66px')}
                    ${th('สถานะตรวจแฟ้ม', '76px')}
                </tr></thead>
                <tbody>${DocParts.fillRows(body, 18, 13)}</tbody>
            </table>
            ${DocParts.signatureBlock(['ลงชื่อ ผู้จัดทำ', 'ลงชื่อ หัวหน้างานเวชระเบียน'])}
            ${DocParts.footer(fields)}
        </div>`;

        return { html: DocParts.toPrintBorders(html), warnings };
    },

    openPrint() {
        if (!this.visible().length) { showToast('ยังไม่มีรายการให้พิมพ์', 'warning'); return; }
        const { html, warnings } = this.buildReport();
        DocPrint.preview({ title: 'ตัวอย่างก่อนพิมพ์ — ทะเบียนผู้ป่วยใน', html, warnings });
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.IpdWorklist = IpdWorklist;
document.addEventListener('DOMContentLoaded', () => IpdWorklist.init());
