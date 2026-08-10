/* ────────────────────────────────────────────────────────
   ตารางอ้างอิงงานผู้ป่วยใน (IPD Reference Data)

   หน้านี้มีหน้าที่เดียว — ทำให้ "ค่าไหนเชื่อได้ ค่าไหนยังเดา" เห็นชัดในที่เดียว
   และเปิดทางให้เอาเอกสารจริงเข้าระบบโดยไม่ต้องแก้โค้ด

   ⭐ ทุกตัวเลข derive จาก MockIpd.sourceStatus() — ห้าม hardcode
   ──────────────────────────────────────────────────────── */

const IpdReference = {

    TABS: ['sources', 'drg', 'rate', 'fund', 'import'],

    state: {
        tab: 'sources',
        mdc: 'all',
        kw: '',
        /* ผลการอ่านไฟล์ล่าสุด — ยังไม่เขียนลง MockDB จนกว่าจะกดยืนยัน */
        pending: null,
    },

    init() {
        MockSession.mountBanner('demoBanner');
        const p = new URLSearchParams(location.search);
        if (this.TABS.includes(p.get('tab'))) this.state.tab = p.get('tab');
        this.render();
        this.switchTab(this.state.tab);
    },

    reload() { this.state.pending = null; this.render(); this.switchTab(this.state.tab); showToast('รีเฟรชแล้ว'); },

    /* ── กฎที่ถูกล็อกเพราะยังไม่มีเอกสาร ── */
    blockedRules() { return MockRules.all().filter(r => r.blocked_by); },
    blockedBy(srcId) { return this.blockedRules().filter(r => r.blocked_by === srcId); },

    render() {
        const st = MockIpd.sourceStatus();
        const locked = this.blockedRules().length;

        document.getElementById('kpiDocs').textContent     = `${st.present}/${st.total}`;
        document.getElementById('kpiMissing').textContent  = MockFmt.int(st.missing);
        document.getElementById('kpiVerified').textContent = st.verifiedPct + '%';
        document.getElementById('kpiLocked').textContent   = MockFmt.int(locked);
        document.getElementById('kpiDrg').textContent      = MockFmt.int(st.drgRows);

        document.getElementById('refBanner').innerHTML = st.missing
            ? `<strong>ยังขาดเอกสารอ้างอิง ${st.missing} ฉบับ</strong> — ค่า DRG และอัตราจ่ายที่แสดงทั้งระบบ
               จึงยังเป็นค่าจำลอง (ยืนยันแล้ว ${st.verifiedPct}%) และมีกฎ ${locked} ข้อที่เขียนไว้แล้วแต่เปิดใช้ไม่ได้
               · ตัวเลข "ประมาณการรับ" และ "ส่วนต่าง" ยังอ่านเป็นข้อค้นพบไม่ได้`
            : `<strong>เอกสารอ้างอิงครบแล้ว</strong> — ตรวจสอบว่าทุกค่าถูกยืนยันและกฎที่รออยู่ถูกเปิดใช้`;

        this.renderSources();
        this.renderDrg();
        this.renderRate();
        this.renderFund();
        this.renderImport();

        const b = document.getElementById('srcBadge');
        b.style.display = st.missing ? '' : 'none';
        b.textContent = st.missing;

        refreshIcons();
    },

    switchTab(key, btn) {
        this.state.tab = key;
        document.querySelectorAll('.ds-tab').forEach(x => x.classList.remove('active'));
        if (btn) btn.classList.add('active');
        else document.querySelectorAll('.ds-tab')[this.TABS.indexOf(key)].classList.add('active');

        document.querySelectorAll('.ds-tab-content').forEach(el => el.classList.remove('active'));
        const map = { sources: 'tabSources', drg: 'tabDrg', rate: 'tabRate',
                      fund: 'tabFund', import: 'tabImport' };
        document.getElementById(map[key]).classList.add('active');
        history.replaceState(null, '', 'ipd-reference.html?tab=' + encodeURIComponent(key));
        refreshIcons();
    },

    /* ══════════ แท็บ 1 — ทะเบียนเอกสาร ══════════ */

    renderSources() {
        const st = MockIpd.sourceStatus();

        const rows = MockIpd.sources().map(s => {
            const tone    = IPD_SOURCE_TONE[s.status] || IPD_SOURCE_TONE.MISSING;
            const blocked = this.blockedBy(s.id);
            const gives   = (s.provides || []).map(k => {
                const p = IPD_PROVIDES.find(x => x.key === k);
                return `<span class="sip-chip sip-chip-muted">${esc(p ? p.label : k)}</span>`;
            }).join(' ');

            return `<tr>
                <td class="td-sub" style="white-space:nowrap">[${esc(s.id)}]</td>
                <td class="td-name">${esc(s.title)}
                    <div class="td-sub">${esc(s.issuer || '—')}${
                        s.funds ? ' · กองทุน ' + esc(s.funds.join(', ')) : ''}</div>
                    ${s.note ? `<div class="td-sub" style="margin-top:3px">${esc(s.note)}</div>` : ''}</td>
                <td><span class="sip-chip ${esc(tone.chip)}">${esc(tone.label)}</span>
                    ${s.file ? `<div class="td-sub" style="margin-top:4px;word-break:break-all">${esc(s.file)}</div>` : ''}</td>
                <td>${gives || '<span class="td-sub">—</span>'}</td>
                <td>${blocked.length
                    ? `<span class="sip-chip sip-chip-danger">${blocked.length} กฎ</span>
                       <div class="td-sub" style="margin-top:4px">${
                           blocked.map(r => esc(r.id)).join('<br>')}</div>`
                    : '<span class="td-sub">—</span>'}</td>
            </tr>`;
        }).join('');

        document.getElementById('tabSources').innerHTML = `
            <div class="ds-note" style="margin-bottom:12px">
                <i data-lucide="info" class="icon-sm"></i>
                คอลัมน์ <strong>"ขาดแล้วตรวจอะไรไม่ได้"</strong> คือกฎที่เขียนตรรกะไว้ครบแล้ว
                แต่ยังเปิดใช้ไม่ได้เพราะไม่มีเกณฑ์จากเอกสาร — ได้เอกสารมาเมื่อไหร่เปิดใช้ได้ทันที
            </div>

            <div class="table-responsive">
                <table class="data-table compact">
                    <thead><tr>
                        <th style="width:1%">รหัส</th><th>เอกสาร</th>
                        <th style="width:1%">สถานะ</th><th style="width:28%">ค้ำค่าอะไรในระบบ</th>
                        <th style="width:1%">ขาดแล้วตรวจอะไรไม่ได้</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>

            <div class="section-header" style="margin-top:18px">
                <div class="section-title"><i data-lucide="list-checks" class="mi"></i>
                    ความพร้อมรายด้าน</div>
            </div>
            <div class="cards-row">
                ${st.byProvides.map(p => `
                <div class="card">
                    <div class="card-title">${esc(p.label)}</div>
                    <div style="margin-top:6px">
                        <span class="sip-chip ${p.ready ? 'sip-chip-success' : 'sip-chip-danger'}">${
                            p.ready ? 'มีเอกสารรองรับ' : 'ยังไม่มีเอกสาร'}</span>
                    </div>
                </div>`).join('')}
            </div>

            <div class="section-header" style="margin-top:18px">
                <div class="section-title"><i data-lucide="lock" class="mi"></i>
                    กฎที่รอเอกสาร <span class="ds-pane-count">${this.blockedRules().length} ข้อ</span></div>
            </div>
            <div class="table-responsive">
                <table class="data-table compact">
                    <thead><tr>
                        <th style="width:1%">รหัสกฎ</th><th>ชื่อกฎ</th>
                        <th style="width:1%">กองทุน</th><th style="width:1%">รอเอกสาร</th>
                        <th style="width:1%">สถานะ</th>
                    </tr></thead>
                    <tbody>${this.blockedRules().map(r => `<tr style="cursor:pointer"
                        onclick="location.href='claim-rules.html?rule=${encodeURIComponent(r.id)}'">
                        <td class="td-sub" style="white-space:nowrap">${esc(r.id)}</td>
                        <td class="td-name">${esc(r.name)}
                            <div class="td-sub">${esc(r.desc)}</div></td>
                        <td class="td-sub" style="white-space:nowrap">${esc(r.funds.join(', '))}</td>
                        <td><span class="sip-chip sip-chip-danger">[${esc(r.blocked_by)}]</span></td>
                        <td>${MockTone.lifecycleHtml(r.status)}</td>
                    </tr>`).join('') || '<tr><td colspan="5" class="ds-empty">ไม่มีกฎที่ถูกล็อก</td></tr>'}</tbody>
                </table>
            </div>`;
    },

    /* ══════════ แท็บ 2 — ตาราง DRG ══════════ */

    renderDrg() {
        const ver  = MockIpd.drgVersion();
        const rows = MockIpd.drgTable().filter(d => {
            if (this.state.mdc !== 'all' && d.mdc !== this.state.mdc) return false;
            const kw = this.state.kw;
            if (kw && !(`${d.drg} ${d.label} ${(d.pdx || []).join(' ')}`).toLowerCase().includes(kw)) return false;
            return true;
        });

        const usedMdc = [...new Set(MockIpd.drgTable().map(d => d.mdc))].sort();

        document.getElementById('tabDrg').innerHTML = `
            <div class="section-header">
                <div class="section-title">
                    <i data-lucide="layers" class="mi"></i>
                    ${esc(ver ? ver.label : '—')}
                    <span class="ds-pane-count">${rows.length} กลุ่ม</span>
                </div>
                <div class="section-actions">
                    <select class="sip-select" style="width:230px" onchange="IpdReference.setMdc(this.value)">
                        <option value="all">ทุกกลุ่มโรคหลัก (MDC)</option>
                        ${usedMdc.map(c => `<option value="${esc(c)}" ${c === this.state.mdc ? 'selected' : ''}>${
                            esc(c)} · ${esc((MockIpd.mdc(c) || {}).label || '')}</option>`).join('')}
                    </select>
                    <input type="text" class="sip-input" style="width:220px" value="${esc(this.state.kw)}"
                           placeholder="ค้นหารหัส DRG / ชื่อกลุ่ม / PDx" oninput="IpdReference.setKw(this.value)">
                </div>
            </div>

            ${ver && !ver.verified ? this.unverifiedRow(ver, 'เวอร์ชัน Grouper') : ''}

            <div class="table-responsive">
                <table class="data-table compact">
                    <thead><tr>
                        <th style="width:1%">DRG</th><th style="width:1%">MDC</th><th>ชื่อกลุ่ม</th>
                        <th style="width:1%;text-align:right">RW</th>
                        <th style="width:1%;text-align:right">ALOS</th>
                        <th style="width:1%">จุดตัด</th>
                        <th style="width:1%">PDx ที่จัดเข้ากลุ่ม</th>
                        <th style="width:1%">ที่มา</th>
                    </tr></thead>
                    <tbody>${rows.map(d => `<tr>
                        <td class="td-sub">${esc(d.drg)}</td>
                        <td class="td-sub">${esc(d.mdc)}</td>
                        <td class="td-name">${esc(d.label)}</td>
                        <td style="text-align:right;white-space:nowrap">${esc(d.rw.toFixed(4))}</td>
                        <td style="text-align:right">${esc(d.alos)}</td>
                        <td class="td-sub" style="white-space:nowrap">${esc(d.trimLow)} – ${esc(d.trimHigh)} วัน</td>
                        <td class="td-sub">${(d.pdx || []).map(c =>
                            `<span class="sip-chip sip-chip-muted">${esc(c)}</span>`).join(' ')}</td>
                        <td style="white-space:nowrap">${this.srcChip(d)}</td>
                    </tr>`).join('') || '<tr><td colspan="8" class="ds-empty">ไม่พบกลุ่มตามเงื่อนไข</td></tr>'}</tbody>
                </table>
            </div>

            <div class="ds-note" style="margin-top:12px">
                <i data-lucide="git-branch" class="icon-sm"></i>
                มีประกาศเวอร์ชันใหม่ให้ <strong>เพิ่มแถวใหม่</strong> แล้วปิด <code>effective_to</code> ของเวอร์ชันเดิม
                ห้ามแก้ทับ — เคสที่จำหน่ายไปแล้วต้องคำนวณย้อนด้วยเวอร์ชันของวันนั้นเสมอ
            </div>`;
    },

    setMdc(v) { this.state.mdc = v; this.renderDrg(); refreshIcons(); },
    setKw(v)  { this.state.kw = (v || '').trim().toLowerCase(); this.renderDrg(); refreshIcons(); },

    /* ══════════ แท็บ 3 — อัตราจ่ายต่อ RW ══════════ */

    renderRate() {
        const rows = MockDB.all('ipd_rate_rows');

        document.getElementById('tabRate').innerHTML = `
            <div class="ds-note" style="margin-bottom:12px">
                <i data-lucide="info" class="icon-sm"></i>
                ประมาณการรับ = <strong>AdjRW × อัตราต่อ 1 RW ของกองทุน ณ วันจำหน่าย</strong>
                — อัตราประกาศใหม่ทุกปีงบประมาณ ระบบจึงเลือกแถวตามช่วงมีผล ไม่ใช่ค่าล่าสุดเสมอ
            </div>

            <div class="table-responsive">
                <table class="data-table compact">
                    <thead><tr>
                        <th style="width:1%">กองทุน</th><th>ชื่อเต็ม</th>
                        <th style="width:1%;text-align:right">บาท / 1 RW</th>
                        <th style="width:1%">มีผลตั้งแต่</th><th style="width:1%">ถึง</th>
                        <th style="width:1%">ที่มา</th>
                    </tr></thead>
                    <tbody>${rows.map(r => {
                        const f = MockIpd.fund(r.fund) || {};
                        return `<tr>
                        <td><span class="sip-chip sip-chip-muted">${esc(r.fund)}</span></td>
                        <td class="td-name">${esc(f.label || r.fund)}
                            ${r.reason ? `<div class="td-sub">${esc(r.reason)}</div>` : ''}</td>
                        <td style="text-align:right;white-space:nowrap">${
                            r.rate == null ? '<span class="td-sub">ไม่จ่ายตาม DRG</span>'
                                           : esc(MockFmt.baht(r.rate))}</td>
                        <td class="td-sub" style="white-space:nowrap">${esc(MockFmt.dateTH(r.effective_from))}</td>
                        <td class="td-sub" style="white-space:nowrap">${
                            r.effective_to ? esc(MockFmt.dateTH(r.effective_to))
                                           : '<span class="sip-chip sip-chip-success">ปัจจุบัน</span>'}</td>
                        <td style="white-space:nowrap">${this.srcChip(r)}</td>
                    </tr>`; }).join('')}</tbody>
                </table>
            </div>

            <div class="section-header" style="margin-top:18px">
                <div class="section-title"><i data-lucide="function-square" class="mi"></i>
                    สูตรปรับ AdjRW กรณีวันนอนหลุดจุดตัด</div>
            </div>
            <div class="table-responsive">
                <table class="data-table compact">
                    <thead><tr><th style="width:1%">เวอร์ชัน</th><th>กรณีนอนสั้นกว่าจุดตัดล่าง</th>
                        <th>กรณีนอนยาวกว่าจุดตัดบน</th><th style="width:1%">มีผลตั้งแต่</th>
                        <th style="width:1%">ที่มา</th></tr></thead>
                    <tbody>${IPD_OUTLIER_RULES.map(o => `<tr>
                        <td class="td-sub">${esc(o.version)}</td>
                        <td>ลดตามสัดส่วนวันนอน ไม่ต่ำกว่า ${esc(MockFmt.pct(o.low.floor * 100, 0))} ของ RW
                            <div class="td-sub">RW × (วันนอน ÷ จุดตัดล่าง)</div></td>
                        <td>บวกส่วนเพิ่มรายวันที่ ${esc(MockFmt.pct(o.high.factor * 100, 0))} ของอัตรารายวัน
                            <div class="td-sub">RW + (RW ÷ ALOS) × (วันนอน − จุดตัดบน) × ${esc(o.high.factor)}</div></td>
                        <td class="td-sub" style="white-space:nowrap">${esc(MockFmt.dateTH(o.effective_from))}</td>
                        <td style="white-space:nowrap">${this.srcChip(o)}</td>
                    </tr>`).join('')}</tbody>
                </table>
            </div>
            <div class="ds-warn" style="margin-top:10px">
                <i data-lucide="alert-triangle" class="icon-sm"></i>
                <strong>สูตรนี้เป็นสูตรจำลอง</strong> — คู่มือ Thai DRG ฉบับจริงกำหนดสูตรและค่าคงที่ไว้ชัดเจน
                ต้องแทนทั้งชุดเมื่อได้เอกสาร [D4]
            </div>`;
    },

    /* ══════════ แท็บ 4 — เงื่อนไขกองทุน ══════════ */

    renderFund() {
        const funds = IPD_FUNDS;

        const row = (label, get) => `<tr>
            <td class="td-name" style="white-space:nowrap">${esc(label)}</td>
            ${funds.map(f => `<td>${get(MockIpd.fundRule(f.key), f)}</td>`).join('')}
        </tr>`;

        document.getElementById('tabFund').innerHTML = `
            <div class="ds-warn" style="margin-bottom:12px">
                <i data-lucide="alert-triangle" class="icon-sm"></i>
                เงื่อนไขทั้งตารางนี้เรียบเรียงจากความเข้าใจทั่วไป <strong>ยังไม่ได้เทียบกับประกาศฉบับจริง</strong>
                ของแต่ละกองทุน — ต้องให้เจ้าหน้าที่ที่รับผิดชอบกองทุนนั้นตรวจก่อนใช้อ้างอิง
            </div>

            <div class="table-responsive">
                <table class="data-table compact">
                    <thead><tr>
                        <th style="width:1%">หัวข้อ</th>
                        ${funds.map(f => `<th>${esc(f.short)}<div class="td-sub">${esc(f.payer)}</div></th>`).join('')}
                    </tr></thead>
                    <tbody>
                        ${row('ผ่าน สปสช.', (r, f) => f.nhso
                            ? '<span class="sip-chip sip-chip-success">ใช่</span>'
                            : '<span class="sip-chip sip-chip-danger">ไม่ผ่าน</span>')}
                        ${row('จ่ายตาม DRG', r => r.payment.drg
                            ? '<span class="sip-chip sip-chip-success">ใช่</span>'
                            : `<span class="sip-chip sip-chip-amber">ไม่ใช่</span>
                               <div class="td-sub">${esc(r.payment.note)}</div>`)}
                        ${row('อนุมัติล่วงหน้า', r => (r.preAuth.required
                            ? '<span class="sip-chip sip-chip-danger">ต้องมี</span>'
                            : '<span class="sip-chip sip-chip-muted">ไม่ต้อง</span>')
                            + `<div class="td-sub">${esc(r.preAuth.note)}</div>`)}
                        ${row('กำหนดยื่น', r => `${esc(r.submitDue.days)} วันนับจาก${esc(r.submitDue.from)}
                            <div class="td-sub">${esc(r.submitDue.note)}</div>`)}
                        ${row('ช่องทางยื่น', r => `<div class="td-sub">${esc(r.channel)}</div>`)}
                        ${row('เอกสารบังคับ', r => `<div class="td-sub">${
                            r.docs.map(d => '· ' + esc(d.label)).join('<br>')}</div>`)}
                        ${row('ข้อจำกัด / เพดาน', r => `<div class="td-sub">${
                            (r.limits || []).map(l => '· ' + esc(l)).join('<br>') || '—'}</div>`)}
                        ${row('ที่มา', (r, f) => {
                            const src = MockIpd.sources().filter(s => (s.funds || []).includes(f.key)
                                && (s.provides || []).includes('fundRule'));
                            return src.length
                                ? src.map(s => `<span class="sip-chip ${
                                    esc((IPD_SOURCE_TONE[s.status] || {}).chip || 'sip-chip-muted')}"
                                    title="${esc(s.title)}">[${esc(s.id)}]</span>`).join(' ')
                                : '<span class="td-sub">—</span>';
                        })}
                    </tbody>
                </table>
            </div>`;
    },

    /* ══════════ แท็บ 5 — นำเข้า ══════════ */

    KINDS: {
        drg: {
            label: 'ตารางกลุ่ม DRG',
            table: 'ipd_drg_rows',
            cols: ['drg', 'mdc', 'label', 'rw', 'alos', 'trim_low', 'trim_high', 'pdx'],
            sample: 'drg,mdc,label,rw,alos,trim_low,trim_high,pdx\n'
                  + '04530,04,ปอดอักเสบ มีโรคร่วม/โรคแทรก,1.4820,5.8,2,14,J18.9|J15.9\n'
                  + '05450,05,หัวใจล้มเหลว ไม่มีโรคแทรก,0.9812,4.2,1,11,I50.0|I50.9',
        },
        rate: {
            label: 'อัตราจ่ายต่อ 1 RW',
            table: 'ipd_rate_rows',
            cols: ['fund', 'rate', 'effective_from'],
            sample: 'fund,rate,effective_from,effective_to\n'
                  + 'UC,8500,2569-10-01,\n'
                  + 'OFC,11800,2569-10-01,',
        },
    },

    renderImport() {
        const p = this.state.pending;

        document.getElementById('tabImport').innerHTML = `
            <div class="ds-note" style="margin-bottom:12px">
                <i data-lucide="shield" class="icon-sm"></i>
                ไฟล์ถูกอ่านในเบราว์เซอร์เท่านั้น <strong>ไม่ถูกส่งไปที่ใด</strong> ·
                ผลที่ยืนยันแล้วเก็บใน sessionStorage ของโหมดสาธิต — กด "รีเซ็ตข้อมูลสาธิต" เพื่อคืนค่าเดิม
            </div>

            <div class="section-header">
                <div class="section-title"><i data-lucide="upload" class="mi"></i> เลือกชนิดข้อมูลแล้ววางไฟล์</div>
                <div class="section-actions">
                    <select class="sip-select" id="impKind" style="width:220px">
                        ${Object.entries(this.KINDS).map(([k, v]) =>
                            `<option value="${esc(k)}">${esc(v.label)}</option>`).join('')}
                    </select>
                    <button class="btn btn-outline" onclick="IpdReference.downloadTemplate()">
                        <i data-lucide="download" class="icon-sm"></i> ดาวน์โหลดแบบฟอร์ม
                    </button>
                </div>
            </div>

            <label for="impFile"
                   style="display:block;border:2px dashed var(--brand-border-strong);border-radius:10px;
                          padding:26px;text-align:center;cursor:pointer;background:var(--surface-1)">
                <i data-lucide="file-spreadsheet" class="icon-xl" style="color:var(--text-muted)"></i>
                <div style="margin-top:8px;font-weight:700">คลิกเพื่อเลือกไฟล์ CSV</div>
                <div class="td-sub" style="margin-top:4px">รองรับ UTF-8 (มี BOM ก็ได้) · คั่นด้วยจุลภาค · หลายค่าในช่องเดียวคั่นด้วย |</div>
            </label>
            <input type="file" id="impFile" accept=".csv,text/csv" style="display:none"
                   onchange="IpdReference.readFile(this)">

            <div class="ds-section-label" style="margin-top:14px">คอลัมน์ที่ต้องมี</div>
            <div style="font-size:12px">
                ${Object.entries(this.KINDS).map(([k, v]) => `
                    <div style="padding:4px 0"><strong>${esc(v.label)}</strong> —
                    ${v.cols.map(c => `<span class="sip-chip sip-chip-muted">${esc(c)}</span>`).join(' ')}
                    <span class="td-sub"> (คอลัมน์อื่นที่เกินมาจะถูกละไว้)</span></div>`).join('')}
            </div>

            <div id="impResult" style="margin-top:16px">${p ? this.previewHtml(p) : ''}</div>`;
    },

    downloadTemplate() {
        const kind = document.getElementById('impKind').value;
        const k = this.KINDS[kind];
        /* BOM นำหน้าเพื่อให้ Excel เปิดภาษาไทยไม่เพี้ยน */
        const blob = new Blob(['﻿' + k.sample], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ipd-${kind}-template.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('ดาวน์โหลดแบบฟอร์มแล้ว');
    },

    readFile(input) {
        const file = input.files && input.files[0];
        if (!file) return;
        const kind = document.getElementById('impKind').value;

        const reader = new FileReader();
        reader.onerror = () => showToast('อ่านไฟล์ไม่สำเร็จ', 'error');
        reader.onload = () => {
            try {
                this.state.pending = this.buildPreview(kind, file.name, String(reader.result || ''));
            } catch (err) {
                console.error('[IpdReference] อ่านไฟล์', err);
                this.state.pending = null;
                document.getElementById('impResult').innerHTML = `
                    <div class="sip-banner sip-banner-danger">
                        <i data-lucide="x-circle" class="icon-sm"></i>
                        <span><strong>อ่านไฟล์ไม่ได้</strong> — ${esc(err.message)}</span>
                    </div>`;
                refreshIcons();
                return;
            }
            document.getElementById('impResult').innerHTML = this.previewHtml(this.state.pending);
            refreshIcons();
        };
        reader.readAsText(file, 'utf-8');
        input.value = '';       /* ให้เลือกไฟล์เดิมซ้ำได้ */
    },

    /* ── ตัวอ่าน CSV: รองรับ BOM · CRLF · ค่าที่ใส่เครื่องหมายคำพูด ── */
    parseCsv(text) {
        const src = String(text).replace(/^﻿/, '');
        const rows = [];
        let row = [], cell = '', quoted = false;

        for (let i = 0; i < src.length; i++) {
            const c = src[i];
            if (quoted) {
                if (c === '"') {
                    if (src[i + 1] === '"') { cell += '"'; i++; }   /* "" = อัญประกาศจริง */
                    else quoted = false;
                } else cell += c;
                continue;
            }
            if (c === '"') { quoted = true; continue; }
            if (c === ',')  { row.push(cell); cell = ''; continue; }
            if (c === '\r') continue;
            if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
            cell += c;
        }
        if (cell !== '' || row.length) { row.push(cell); rows.push(row); }

        return rows.filter(r => r.some(v => String(v).trim() !== ''))
                   .map(r => r.map(v => v.trim()));
    },

    /**
     * แปลง CSV เป็นผลเปรียบเทียบ 4 กลุ่ม — ยังไม่เขียนลง MockDB
     * แถวที่ผิดจะถูกข้ามพร้อมเหตุผล ไม่ทำให้ทั้งไฟล์ล้ม
     */
    buildPreview(kind, fileName, text) {
        const k = this.KINDS[kind];
        const rows = this.parseCsv(text);
        if (rows.length < 2) throw new Error('ไฟล์ว่างหรือมีแต่หัวคอลัมน์');

        const head = rows[0].map(h => h.toLowerCase());
        const missCols = k.cols.filter(c => head.indexOf(c) < 0);
        if (missCols.length) {
            throw new Error('ขาดคอลัมน์ที่ต้องมี: ' + missCols.join(', ')
                + ' · พบในไฟล์: ' + head.join(', '));
        }
        const at = name => { const i = head.indexOf(name); return i < 0 ? null : i; };
        const val = (r, name) => { const i = at(name); return i == null ? '' : (r[i] || '').trim(); };

        const num = (v, label, errs) => {
            if (v === '') { errs.push(`${label} ว่าง`); return null; }
            const n = Number(v);
            if (!isFinite(n)) { errs.push(`${label} ไม่ใช่ตัวเลข ("${v}")`); return null; }
            return n;
        };
        const isThaiDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v);

        const ver     = MockIpd.drgVersion();
        const current = MockDB.all(k.table);
        const out = { kind, fileName, table: k.table,
                      added: [], changed: [], same: [], skipped: [] };

        rows.slice(1).forEach((r, i) => {
            const line = i + 2;                    /* บรรทัดจริงในไฟล์ (นับหัวคอลัมน์) */
            const errs = [];
            let rec = null, id = null, cmp = [];

            if (kind === 'drg') {
                const drg = val(r, 'drg');
                if (!drg) errs.push('รหัส DRG ว่าง');
                const rw   = num(val(r, 'rw'),   'RW',   errs);
                const alos = num(val(r, 'alos'), 'ALOS', errs);
                const tl   = num(val(r, 'trim_low'),  'จุดตัดล่าง', errs);
                const th   = num(val(r, 'trim_high'), 'จุดตัดบน',  errs);
                if (tl != null && th != null && tl > th) errs.push('จุดตัดล่างมากกว่าจุดตัดบน');
                if (!errs.length) {
                    id  = `${ver.code}/${drg}`;
                    rec = { id, drg, mdc: val(r, 'mdc'), label: val(r, 'label'),
                            rw, alos, trimLow: tl, trimHigh: th,
                            pdx: val(r, 'pdx').split('|').map(s => s.trim()).filter(Boolean),
                            version: ver.code, source: val(r, 'source') || 'D4',
                            srcRef: val(r, 'src_ref') || null, verified: true };
                    cmp = ['rw', 'alos', 'trimLow', 'trimHigh', 'label', 'mdc'];
                }
            } else {
                const fund = val(r, 'fund').toUpperCase();
                if (!MockIpd.fund(fund)) errs.push(`ไม่รู้จักกองทุน "${fund}"`);
                const rate = num(val(r, 'rate'), 'อัตราต่อ RW', errs);
                const from = val(r, 'effective_from');
                if (!isThaiDate(from)) errs.push('วันเริ่มมีผลต้องเป็นรูปแบบ พ.ศ. YYYY-MM-DD');
                const to = val(r, 'effective_to');
                if (to && !isThaiDate(to)) errs.push('วันสิ้นสุดรูปแบบไม่ถูกต้อง');
                if (!errs.length) {
                    id  = `${fund}/${from}`;
                    rec = { id, fund, rate, effective_from: from, effective_to: to || null,
                            source: val(r, 'source') || 'D5',
                            srcRef: val(r, 'src_ref') || null, verified: true };
                    cmp = ['rate', 'effective_to'];
                }
            }

            if (errs.length) { out.skipped.push({ line, raw: r.join(','), why: errs.join(' · ') }); return; }

            const old = current.find(x => x.id === id);
            if (!old) { out.added.push({ line, rec }); return; }

            const diffs = cmp.filter(f => String(old[f]) !== String(rec[f]))
                             .map(f => ({ field: f, from: old[f], to: rec[f] }));
            if (diffs.length) out.changed.push({ line, rec, diffs });
            else out.same.push({ line, rec });
        });

        return out;
    },

    previewHtml(p) {
        const k = this.KINDS[p.kind];
        const box = (title, tone, icon, n) => `
            <div class="card"><div class="card-title">
                <i data-lucide="${icon}" class="mi" style="color:var(--status-${tone})"></i> ${esc(title)}</div>
                <div style="font-size:26px;font-weight:800;color:var(--status-${tone})">${n}</div></div>`;

        const usable = p.added.length + p.changed.length;

        return `
            <div class="ds-section-label">ผลอ่านไฟล์ ${esc(p.fileName)} — ${esc(k.label)}</div>
            <div class="cards-row" style="margin-bottom:12px">
                ${box('เพิ่มใหม่',  'success', 'plus-circle',  p.added.length)}
                ${box('ค่าเปลี่ยน', 'warning', 'refresh-cw',   p.changed.length)}
                ${box('เหมือนเดิม', 'muted',   'equal',        p.same.length)}
                ${box('ข้ามแถว',   'danger',  'x-circle',     p.skipped.length)}
            </div>

            ${p.changed.length ? `
            <div class="ds-section-label">ค่าที่จะเปลี่ยน</div>
            <div class="table-responsive" style="margin-bottom:12px">
                <table class="data-table compact">
                    <thead><tr><th style="width:1%">บรรทัด</th><th style="width:1%">รายการ</th>
                        <th>สิ่งที่เปลี่ยน</th></tr></thead>
                    <tbody>${p.changed.map(c => `<tr>
                        <td class="td-sub">${esc(c.line)}</td>
                        <td class="td-sub">${esc(c.rec.id)}</td>
                        <td>${c.diffs.map(d =>
                            `<div style="font-size:12px">${esc(d.field)}:
                             <span style="color:var(--text-muted);text-decoration:line-through">${esc(d.from)}</span>
                             → <strong>${esc(d.to)}</strong></div>`).join('')}</td>
                    </tr>`).join('')}</tbody>
                </table>
            </div>` : ''}

            ${p.added.length ? `
            <div class="ds-section-label">แถวใหม่</div>
            <div class="table-responsive" style="margin-bottom:12px">
                <table class="data-table compact">
                    <thead><tr><th style="width:1%">บรรทัด</th><th style="width:1%">รายการ</th><th>ค่า</th></tr></thead>
                    <tbody>${p.added.map(a => `<tr>
                        <td class="td-sub">${esc(a.line)}</td>
                        <td class="td-sub">${esc(a.rec.id)}</td>
                        <td class="td-sub">${esc(this.recSummary(p.kind, a.rec))}</td>
                    </tr>`).join('')}</tbody>
                </table>
            </div>` : ''}

            ${p.skipped.length ? `
            <div class="sip-banner sip-banner-danger">
                <i data-lucide="alert-triangle" class="icon-sm"></i>
                <span>ข้าม ${p.skipped.length} แถวที่ข้อมูลไม่ถูกต้อง — แถวที่เหลือยังนำเข้าได้ตามปกติ</span>
            </div>
            <div class="table-responsive" style="margin-bottom:12px">
                <table class="data-table compact">
                    <thead><tr><th style="width:1%">บรรทัด</th><th style="width:1%">เหตุผล</th><th>ข้อมูลในไฟล์</th></tr></thead>
                    <tbody>${p.skipped.map(s => `<tr>
                        <td class="td-sub">${esc(s.line)}</td>
                        <td style="color:var(--status-danger)">${esc(s.why)}</td>
                        <td class="td-sub" style="word-break:break-all">${esc(s.raw)}</td>
                    </tr>`).join('')}</tbody>
                </table>
            </div>` : ''}

            <div class="ds-actions" style="position:static;padding:0;border:0;margin-top:12px">
                <button class="btn btn-outline" onclick="IpdReference.cancelImport()">ยกเลิก</button>
                <button class="btn btn-save-send" ${usable ? '' : 'disabled'}
                        onclick="IpdReference.confirmImport()">
                    ยืนยันนำเข้า ${usable} รายการ
                </button>
            </div>
            ${usable ? `<div class="ds-note" style="margin-top:10px">
                <i data-lucide="badge-check" class="icon-sm"></i>
                แถวที่นำเข้าจะถูกตั้งเป็น <strong>ยืนยันกับเอกสารแล้ว</strong> —
                ป้าย "รอยืนยัน" จะหายจากหน้าอื่นเฉพาะค่าที่มาจากไฟล์นี้
            </div>` : ''}`;
    },

    recSummary(kind, r) {
        return kind === 'drg'
            ? `${r.label} · RW ${r.rw} · ALOS ${r.alos} · จุดตัด ${r.trimLow}–${r.trimHigh}`
            : `${MockFmt.baht(r.rate)} บาท/RW · มีผล ${MockFmt.dateTH(r.effective_from)}`;
    },

    cancelImport() {
        this.state.pending = null;
        document.getElementById('impResult').innerHTML = '';
        showToast('ยกเลิกการนำเข้าแล้ว', 'info');
    },

    confirmImport() {
        const p = this.state.pending;
        if (!p) return;

        p.changed.forEach(c => MockDB.patch(p.table, c.rec.id, c.rec));

        /* เพิ่มอัตราจ่ายฉบับใหม่ = ต้องปิดช่วงมีผลของฉบับเดิมให้ด้วย
           ไม่งั้นสองแถวจะมีผลทับกันและคนกรอกมักลืมปิดเอง */
        if (p.kind === 'rate') {
            p.added.forEach(a => {
                const prev = MockDB.all(p.table)
                    .filter(r => r.fund === a.rec.fund && !r.effective_to
                              && r.effective_from < a.rec.effective_from)
                    .sort((x, y) => y.effective_from.localeCompare(x.effective_from))[0];
                if (prev) {
                    const d = MockFmt.toDate(a.rec.effective_from);
                    d.setDate(d.getDate() - 1);
                    MockDB.patch(p.table, prev.id, {
                        effective_to: `${d.getFullYear() + 543}-`
                            + `${String(d.getMonth() + 1).padStart(2, '0')}-`
                            + `${String(d.getDate()).padStart(2, '0')}`,
                    });
                }
            });
        }

        p.added.forEach(a => MockDB.insert(p.table, a.rec));

        MockDB.insert('ipd_ref_imports', {
            id: 'IMP-' + String(MockDB.all('ipd_ref_imports').length + 1).padStart(4, '0'),
            at: '2569-08-06T09:00', by: MockAdmin.userName(MockSession.userId()),
            kind: p.kind, file: p.fileName,
            rows: p.added.length + p.changed.length + p.same.length + p.skipped.length,
            added: p.added.length, changed: p.changed.length, skipped: p.skipped.length,
        });

        this.state.pending = null;
        showToast(`นำเข้าแล้ว — เพิ่ม ${p.added.length} · แก้ ${p.changed.length} รายการ`);
        this.render();
        this.switchTab('drg');
    },

    /* ── ชิปที่มาของค่าหนึ่งแถว ── */
    srcChip(row) {
        const s = MockIpd.sourceOf(row);
        if (!s) return '<span class="td-sub">—</span>';
        return `<span class="sip-chip ${s.ok ? 'sip-chip-success' : 'sip-chip-danger'}"
                      title="${esc(s.title)}">${s.id ? '[' + esc(s.id) + '] ' : ''}${
                      s.ok ? 'ยืนยันแล้ว' : 'รอยืนยัน'}</span>`;
    },

    unverifiedRow(row, what) {
        const s = MockIpd.sourceOf(row);
        return `<div class="ds-warn" style="margin-bottom:10px">
            <i data-lucide="alert-triangle" class="icon-sm"></i>
            <strong>${esc(what)}ยังไม่ได้ยืนยัน</strong> — ที่มาที่ต้องใช้คือ
            ${s && s.id ? `[${esc(s.id)}] ${esc(s.title)}` : 'เอกสารที่ยังไม่ระบุ'} ซึ่งยังไม่มีในระบบ
        </div>`;
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.IpdReference = IpdReference;
document.addEventListener('DOMContentLoaded', () => IpdReference.init());
