/* ────────────────────────────────────────────────────────
   ส่งเบิก NHSO — นำเข้าข้อมูล / 15 แฟ้ม / งานก่อน UAT

   แท็บ "โครงสร้าง 15 แฟ้ม" กับ "งานก่อน UAT" เป็นเนื้อหาที่ใช้ซ้ำในสไลด์นำเสนอ
   ตัวเลขความครบของ Mapping ผูกกับงานก่อน UAT ข้อ 5 โดยตรง
   ──────────────────────────────────────────────────────── */

const NhsoImport = {

    state: { tab: 'api' },

    TABS: [
        { key: 'api',      label: 'นำเข้าด้วย API' },
        { key: 'upload',   label: 'Upload ไฟล์' },
        { key: 'history',  label: 'ประวัติการนำเข้า' },
        { key: 'dataset',  label: 'โครงสร้าง 15 แฟ้ม' },
        { key: 'fundfile', label: 'แฟ้มที่ต้องส่งตามกองทุน' },
        { key: 'pretask',  label: 'งานก่อน UAT' },
    ],

    /** ตัวกรองของแท็บเมทริกซ์กองทุน — '' = ทุกกองทุน */
    fundFilter: '',

    init() {
        MockSession.mountBanner('demoBanner');
        const p = new URLSearchParams(location.search);
        if (p.get('tab')) this.state.tab = p.get('tab');
        this.renderSeg();
        this.render();

        /* mock-refdata.js hydrate โครงสร้างแฟ้ม/เมทริกซ์กองทุนจริงเสร็จ → วาดใหม่ */
        document.addEventListener('refdata:updated', () => this.render());
    },

    renderSeg() {
        document.getElementById('segTab').innerHTML = this.TABS.map(t => `
            <button class="ds-seg ${t.key === this.state.tab ? 'active' : ''}"
                onclick="NhsoImport.setTab('${t.key}')">${esc(t.label)}</button>`).join('');
    },

    setTab(k) {
        this.state.tab = k;
        history.replaceState(null, '', 'nhso-import.html?tab=' + k);
        this.renderSeg();
        this.render();
    },

    render() {
        const fn = {
            api: () => this.tabApi(), upload: () => this.tabUpload(), history: () => this.tabHistory(),
            dataset: () => this.tabDataset(), fundfile: () => this.tabFundFile(),
            pretask: () => this.tabPretask(),
        }[this.state.tab];
        document.getElementById('tabContent').innerHTML = fn ? fn() : '';
        if (this.state.tab === 'dataset') this.renderMappingChart();
        if (this.state.tab === 'upload') this.preFillSample();
        refreshIcons();
    },

    /* ══════════ API ══════════ */

    tabApi() {
        const a = MOCK_NHSO_API;
        return `
        <div class="cards-row">
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="plug" class="mi"></i> การเชื่อมต่อ API</div>
                    <div class="section-actions">
                        <span class="status-badge ${a.environment === 'TEST' ? 'waiting' : 'active'}">
                            ${esc(a.environment === 'TEST' ? 'Test Environment' : 'Production')}</span>
                    </div>
                </div>
                <table class="ds-table-grid">
                    <tbody>
                        <tr><td class="l" style="width:32%">Software Vendor</td><td class="l">${esc(a.vendor)}</td></tr>
                        <tr><td class="l">Source ID</td><td class="l"><code>${esc(a.source_id)}</code></td></tr>
                        <tr><td class="l">Client ID</td><td class="l"><code>${esc(a.client_id)}</code></td></tr>
                        <tr><td class="l">Token</td><td class="l"><code>${esc(a.token)}</code></td></tr>
                        <tr><td class="l">Endpoint</td><td class="l"><code>${esc(a.endpoint)}</code></td></tr>
                        <tr><td class="l">เชื่อมต่อล่าสุด</td><td class="l">${esc(MockFmt.dateTimeTH(a.last_sync))}</td></tr>
                    </tbody>
                </table>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="btn btn-outline" onclick="NhsoImport.testConnection()">
                        <i data-lucide="activity" class="icon-sm"></i> ทดสอบการเชื่อมต่อ</button>
                    <button class="btn btn-navy" onclick="NhsoImport.pullNow()">
                        <i data-lucide="download" class="icon-sm"></i> ดึงข้อมูลจาก HIS แล้วส่งเข้า NHSO</button>
                </div>
                <div id="apiResult" style="margin-top:12px"></div>
            </div>

            <div class="section-card">
                <div class="section-title" style="margin-bottom:10px">
                    <i data-lucide="repeat" class="mi"></i> รอบการส่งอัตโนมัติ</div>
                <table class="ds-table-grid">
                    <tbody>
                        <tr><td class="l" style="width:40%">รอบดึงข้อมูลจาก HIS</td><td class="l">ทุกวัน เวลา 21:00 น.</td></tr>
                        <tr><td class="l">ตรวจก่อนส่งด้วยกฎ</td><td class="l">อัตโนมัติทันทีหลังดึงข้อมูล</td></tr>
                        <tr><td class="l">ส่งเบิกอัตโนมัติ</td><td class="l">เฉพาะเคสที่ผ่านกฎทั้งหมด</td></tr>
                        <tr><td class="l">เคสที่ยังมีประเด็น</td><td class="l">ค้างที่คิวและสร้าง Task ให้เจ้าของงาน</td></tr>
                        <tr><td class="l">ดึงผลตอบกลับ</td><td class="l">ทุกวัน เวลา 06:00 น.</td></tr>
                    </tbody>
                </table>
                <div class="ds-note"><i data-lucide="shield-check" class="icon-sm"></i>
                    <strong>จุดต่างที่สำคัญ:</strong> ระบบจะไม่ส่งเคสที่กฎตรวจพบประเด็นออกไปโดยอัตโนมัติ
                    — เคสเหล่านั้นจะถูกกันไว้พร้อมเจ้าของงานและ SLA แทนที่จะปล่อยไปให้ สปสช. ตีกลับ</div>
            </div>
        </div>`;
    },

    testConnection() {
        const el = document.getElementById('apiResult');
        el.innerHTML = '<div class="ds-spinner"></div> <span class="td-sub">กำลังทดสอบการเชื่อมต่อ...</span>';
        setTimeout(() => {
            el.innerHTML = `<div class="sip-banner sip-banner-success">
                <i data-lucide="check-circle-2" class="icon-sm"></i>
                เชื่อมต่อสำเร็จ · ตอบกลับใน 218 ms · Test Environment</div>`;
            refreshIcons();
            showToast('ทดสอบการเชื่อมต่อสำเร็จ');
        }, 700);
    },

    pullNow() {
        const el = document.getElementById('apiResult');
        const steps = [
            { code: 'HIS',  label: 'ดึงข้อมูลจาก HIS (แฟ้ม 1–8)' },
            { code: 'RULE', label: 'ตรวจก่อนส่งด้วยกฎที่มีผล ณ วันที่รับบริการ' },
            { code: 'F000', label: 'กำลังนำเข้าไฟล์' },
            { code: 'F001', label: 'กำลังตรวจสอบเบื้องต้น' },
            { code: 'F002', label: 'ตรวจสอบเบื้องต้นเสร็จสิ้น' },
        ];
        let i = 0;
        const tick = () => {
            el.innerHTML = `<div class="ds-stepper">${steps.map((s, n) => `
                <span class="ds-step ${n < i ? 'completed' : n === i ? 'active' : ''}">
                    ${n < i ? '<i data-lucide="check" class="icon-sm"></i> ' : ''}${esc(s.code)} · ${esc(s.label)}</span>`).join('')}</div>`;
            refreshIcons();
            if (++i <= steps.length) setTimeout(tick, 550);
            else {
                const ready = MockNhso.byStage('AWAIT_SUBMIT').filter(c => !MockClaims.predictedCodes(c).length).length;
                const held  = MockNhso.byStage('AWAIT_SUBMIT').filter(c => MockClaims.predictedCodes(c).length).length;
                el.innerHTML += `
                <div class="sip-banner sip-banner-success" style="margin-top:12px">
                    <i data-lucide="check-circle-2" class="icon-sm"></i>
                    ส่งเบิกอัตโนมัติ <strong>${ready}</strong> เคสที่ผ่านกฎทั้งหมด</div>
                <div class="sip-banner sip-banner-warning">
                    <i data-lucide="shield-alert" class="icon-sm"></i>
                    กันไว้ <strong>${held}</strong> เคสที่กฎตรวจพบประเด็น — สร้าง Task ให้เจ้าของงานแล้ว
                    <a href="claim-worklist.html?result=FIX" style="margin-left:6px">ดูคิวแก้ไข</a></div>`;
                refreshIcons();
                showToast('ประมวลผลรอบนำเข้าเสร็จแล้ว');
            }
        };
        tick();
    },

    /* ══════════ Upload ══════════ */

    tabUpload() {
        return `
        <div class="cards-row">
            <div class="section-card">
                <div class="section-title" style="margin-bottom:10px">
                    <i data-lucide="file-up" class="mi"></i> อัปโหลดไฟล์ข้อมูล</div>
                <div class="ds-empty-state" style="border:2px dashed var(--brand-border-strong);
                     border-radius:12px;padding:32px 20px;cursor:pointer"
                     onclick="showToast('โหมดต้นแบบ — ยังไม่ผูกที่เก็บไฟล์จริง','info')">
                    <div class="ds-empty-state-icon"><i data-lucide="upload-cloud"></i></div>
                    <div class="ds-empty-state-title">ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</div>
                    <div class="ds-empty-state-desc">รองรับ .json ตาม Standard Dataset · ขนาดไม่เกิน 50 MB</div>
                </div>
                <div class="sip-field-row" style="margin-top:14px">
                    <div class="sip-field">
                        <label class="sip-label">งวดข้อมูล</label>
                        <select class="sip-select"><option>ส.ค. 2569</option><option>ก.ค. 2569</option></select>
                    </div>
                    <div class="sip-field">
                        <label class="sip-label">ประเภทผู้ป่วย</label>
                        <select class="sip-select"><option>ผู้ป่วยนอก (OP)</option>
                            <option>ส่งเสริมสุขภาพ (PP)</option><option>ผู้ป่วยใน (IP)</option></select>
                    </div>
                </div>
                <label class="sip-checkbox" style="margin-bottom:12px">
                    <input type="checkbox" checked> ตรวจด้วยกฎก่อนส่ง (แนะนำ)
                </label>
                <button class="btn btn-primary btn-block" onclick="NhsoImport.pullNow()">
                    <i data-lucide="send" class="icon-sm"></i> นำเข้าและประมวลผล</button>
                <div id="apiResult" style="margin-top:12px"></div>
            </div>

            <div class="section-card">
                <div class="section-title" style="margin-bottom:10px">
                    <i data-lucide="info" class="mi"></i> ข้อควรรู้ก่อนนำเข้า</div>
                <ul style="font-size:13px;line-height:1.9;color:var(--text-secondary);padding-left:18px">
                    <li>ไฟล์ต้องมีครบตาม <strong>Standard Dataset ฉบับล่าสุด</strong>
                        — ตรวจได้ที่แท็บ "โครงสร้าง 15 แฟ้ม"</li>
                    <li>ระบบตรวจ schema, mandatory field, duplicate และ checksum
                        ก่อนบันทึก Import Log ทุกครั้ง</li>
                    <li>การนำเข้าซ้ำด้วยไฟล์เดิมปลอดภัย — ระบบจับคู่ด้วย SEQ และไม่สร้างเคสซ้ำ</li>
                    <li><strong>ข้อมูลใน HIS ไม่ถูกแก้โดยระบบ</strong> (BR-08)
                        การนำเข้าเป็นการอ่านอย่างเดียว</li>
                </ul>
                <div class="ds-warn"><i data-lucide="alert-triangle" class="icon-sm"></i>
                    ถ้าปิดตัวเลือก "ตรวจด้วยกฎก่อนส่ง" ระบบจะส่งไฟล์ตรงไปยัง สปสช.
                    เหมือนวิธีเดิม — และประเด็นจะกลับมาเป็น Error ให้แก้ทีหลัง</div>
            </div>
        </div>

        <div class="section-card" style="margin-top:16px">
            <div class="section-header">
                <div class="section-title"><i data-lucide="shield-check" class="mi"></i>
                    ทดลองตรวจด้วยกฎมาตรฐานจริง (Pre-validate Engine)</div>
                <div class="section-actions">
                    <span class="status-badge active">เชื่อมแคตตาล็อกรหัสติด C จริง</span>
                </div>
            </div>
            <p style="font-size:13px;color:var(--text-secondary);margin:0 0 10px">
                วางข้อมูลเคลม (JSON) แล้วกดตรวจ — ระบบเทียบกับตารางอ้างอิงมาตรฐานใน MySQL
                (เมทริกซ์กองทุน×แฟ้ม · เลขบัตร ปชช. · การวินิจฉัย · ราคายาเทียบ Drug Catalogue ·
                DRG trim point) แล้วบอกว่า "ถ้าส่งตอนนี้จะติดรหัสอะไร"</p>
            <textarea id="preClaim" class="sip-input" spellcheck="false"
                style="width:100%;min-height:190px;font-family:ui-monospace,Consolas,monospace;font-size:12.5px;line-height:1.6"></textarea>
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
                <button class="btn btn-primary" onclick="NhsoImport.preValidate()">
                    <i data-lucide="shield-check" class="icon-sm"></i> ตรวจกับกฎมาตรฐาน</button>
                <button class="btn btn-outline" onclick="NhsoImport.preFillSample()">
                    <i data-lucide="rotate-ccw" class="icon-sm"></i> ตัวอย่างเคสมีปัญหา</button>
            </div>
            <div id="preResult" style="margin-top:12px"></div>
        </div>

        <div class="section-card" style="margin-top:16px">
            <div class="section-header">
                <div class="section-title"><i data-lucide="database" class="mi"></i>
                    นำเข้า 16 แฟ้มจริง — ผู้ป่วยใน (FR-01)</div>
                <div class="section-actions">
                    <span class="status-badge active">เขียนลงฐานข้อมูลจริง</span>
                </div>
            </div>
            <p style="font-size:13px;color:var(--text-secondary);margin:0 0 10px">
                เลือกแฟ้ม <strong>IPD (บังคับ)</strong> + PAT / INS / IDX / IOP / CHA (มีเท่าไหนใส่เท่านั้น)
                — คั่นด้วย | หรือ , หรือ tab ก็ได้ · วันที่รับทั้ง พ.ศ./ค.ศ. · จับคู่เคสด้วย AN
                (นำเข้าซ้ำ = อัปเดตเคสเดิม ไม่สร้างซ้ำ) · ทุกเคสถูกส่งเข้า rule engine ตรวจทันที
                · ต้องล็อกอินก่อนนำเข้าจริง</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
                ${['IPD', 'PAT', 'INS', 'IDX', 'IOP', 'CHA'].map(k => `
                <div class="sip-field" style="margin:0">
                    <label class="sip-label">${k}${k === 'IPD' ? ' *' : ''}
                        <span id="f16chip-${k}"></span></label>
                    <input class="sip-input" type="file" accept=".txt,.csv,.dat"
                           onchange="NhsoImport.pick16('${k}', this)">
                </div>`).join('')}
            </div>
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
                <button class="btn btn-outline" onclick="NhsoImport.import16(true)">
                    <i data-lucide="scan-search" class="icon-sm"></i> ตรวจอย่างเดียว (dry run)</button>
                <button class="btn btn-primary" onclick="NhsoImport.import16(false)">
                    <i data-lucide="database" class="icon-sm"></i> นำเข้าจริง + ตรวจ</button>
                <button class="btn btn-outline" onclick="NhsoImport.sample16()">
                    <i data-lucide="file-text" class="icon-sm"></i> โหลดไฟล์ตัวอย่าง 2 เคส</button>
            </div>
            <div id="importResult" style="margin-top:12px"></div>
        </div>`;
    },

    /* ══════════ นำเข้า 16 แฟ้มจริง (FR-01) ══════════ */

    _files16: {},

    /* ไฟล์ตัวอย่าง 2 เคส: 691208 เคสปกติ · 691209 เคสมีปัญหา
       (Pdx ไม่เหมาะ IPD? — ไม่ใช่: K35.8 แต่ DRG ไม่ตรง + Sdx มั่ว + ค่าห้องเกินวันนอน + ยอดติดลบ) */
    SAMPLE_16: {
        PAT: `HCODE|HN|TITLE|FNAME|LNAME|DOB|SEX|PERSON_ID
10999|00160101|นาง|วิไล|แสงทอง|25030214|2|3101500445561
10999|00160102|นาย|พงษ์ศักดิ์|ใจดี|25100610|1|3101500446126`,
        INS: `HCODE|HN|INSCL|SUBTYPE|CID|AN
10999|00160101|UCS||3101500445561|691208
10999|00160102|OFC||3101500446126|691209`,
        IPD: `HCODE|HN|AN|DATEADM|TIMEADM|DATEDSC|TIMEDSC|DISCHS|DISCHT|WARDDSC|DRG|RW|ADJRW|ACTLOS
10999|00160101|691208|25690801|0930|25690806|1100|1|1|MED-2|04530|1.4820|1.4820|6
10999|00160102|691209|25690802|1415|25690806|0900|1|1|SUR-4|04510|1.0230|1.0230|5`,
        IDX: `HCODE|AN|DIAG|DXTYPE|DRDX
10999|691208|J18.9|1|ว12345
10999|691208|E11.9|2|ว12345
10999|691209|K35.8|1|ว23456
10999|691209|X999|2|ว23456`,
        IOP: `HCODE|AN|OPER|OPTYPE|DROPER|DATEIN
10999|691209|47.09|1|ว23456|25690803`,
        CHA: `HCODE|AN|CHRGITEM|AMOUNT|QTY
10999|691208|01|7200|6
10999|691208|03|5200|
10999|691208|07|3100|
10999|691209|01|9600|9
10999|691209|03|-500|
10999|691209|11|18400|`,
    },

    pick16(key, input) {
        const f = input.files && input.files[0];
        const chip = document.getElementById('f16chip-' + key);
        if (!f) { delete this._files16[key]; if (chip) chip.innerHTML = ''; return; }
        const reader = new FileReader();
        reader.onload = () => {
            this._files16[key] = String(reader.result);
            const lines = this._files16[key].split(/\r?\n/).filter(l => l.trim()).length - 1;
            if (chip) chip.innerHTML = ` <span class="sip-chip sip-chip-active" style="font-size:10px">${lines} แถว</span>`;
        };
        reader.readAsText(f);
    },

    sample16() {
        this._files16 = { ...this.SAMPLE_16 };
        for (const k of Object.keys(this.SAMPLE_16)) {
            const chip = document.getElementById('f16chip-' + k);
            const lines = this.SAMPLE_16[k].split('\n').length - 1;
            if (chip) chip.innerHTML = ` <span class="sip-chip sip-chip-amber" style="font-size:10px">ตัวอย่าง ${lines} แถว</span>`;
        }
        showToast('โหลดไฟล์ตัวอย่างแล้ว — กด dry run เพื่อดูผลก่อนนำเข้าจริง');
    },

    async import16(dryRun) {
        const out = document.getElementById('importResult');
        if (!this._files16.IPD) {
            out.innerHTML = `<div class="ds-warn"><i data-lucide="alert-triangle" class="icon-sm"></i>
                ต้องมีแฟ้ม IPD ก่อน — เลือกไฟล์หรือกด "โหลดไฟล์ตัวอย่าง"</div>`;
            refreshIcons();
            return;
        }
        out.innerHTML = '<span style="font-size:13px;color:var(--text-secondary)">กำลังประมวลผล…</span>';
        try {
            const res = await fetch('/api/ipd/import', {
                method: 'POST', dsOptional: true,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: this._files16, dry_run: dryRun }),
            });
            const r = await res.json();
            if (!res.ok) throw new Error(r.error || ('HTTP ' + res.status));
            out.innerHTML = this.import16ResultHtml(r);
        } catch (e) {
            const authHint = /401|เข้าสู่ระบบ/.test(e.message)
                ? ' — การนำเข้าต้องล็อกอินด้วยบทบาทเจ้าหน้าที่ก่อน (<a href="index.html">ไปหน้าล็อกอิน</a>)' : '';
            out.innerHTML = `<div class="ds-warn"><i data-lucide="wifi-off" class="icon-sm"></i>
                นำเข้าไม่สำเร็จ (${esc(e.message)})${authHint}</div>`;
        }
        refreshIcons();
    },

    import16ResultHtml(r) {
        const tone = { ERROR: 'rejected', WARNING: 'waiting', INFO: 'active' };
        const caseBlocks = r.cases.map(c => {
            const s = c.summary || {};
            const pass = s.result === 'PASS';
            const issueRows = (c.issues || []).map(i => `
                <tr>
                    <td><span class="status-badge ${tone[i.severity] || 'active'}">${esc(i.severity)}</span></td>
                    <td>${i.code ? `<code>${esc(i.code)}</code>` : `<span class="td-sub">${esc(i.rule || '—')}</span>`}</td>
                    <td class="l">${esc(i.message)}${i.detail && i.detail !== i.message
                        ? `<div class="td-sub">${esc(i.detail)}</div>` : ''}
                        ${i.guidance ? `<div style="font-size:12px;color:var(--status-success)">→ ${esc(i.guidance)}</div>` : ''}</td>
                </tr>`).join('');
            const sugRows = (c.suggestions || []).map(g => `
                <div style="font-size:12.5px;padding:4px 0;border-top:1px dashed var(--border-color)">
                    <code style="font-size:11px">${esc(g.id)}</code>
                    ${g.simulated ? '<span class="sip-chip sip-chip-amber" style="font-size:10px">ค่าจำลอง</span>' : ''}
                    ${esc(g.message)}</div>`).join('');
            return `
            <div class="section-card" style="margin-top:10px">
                <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                    <strong>AN ${esc(c.an)}</strong> <span>${esc(c.patient_name)}</span>
                    <span class="sip-chip ${c.action === 'CREATED' ? 'sip-chip-active' : 'sip-chip-muted'}">${
                        c.action === 'CREATED' ? 'สร้างใหม่' : c.action === 'UPDATED' ? 'อัปเดตเคสเดิม' : 'dry run'}</span>
                    <span class="status-badge ${pass ? 'active' : 'rejected'}">${esc(s.result || '—')}</span>
                    <span class="td-sub">Error ${s.errors ?? 0} · Warning ${s.warnings ?? 0} · ข้อเสนอแนะ ${s.suggestions ?? 0}</span>
                    ${c.admission_id ? `<a href="ipd-audit.html?an=${esc(c.an)}" style="margin-left:auto;font-size:12.5px">
                        เปิดในจอตรวจแฟ้ม →</a>` : ''}
                </div>
                ${issueRows ? `<div class="table-responsive" style="margin-top:8px"><table class="data-table compact">
                    <thead><tr><th>ระดับ</th><th>รหัส</th><th class="l">รายละเอียด</th></tr></thead>
                    <tbody>${issueRows}</tbody></table></div>` : ''}
                ${sugRows ? `<div style="margin-top:6px">${sugRows}</div>` : ''}
            </div>`;
        }).join('');

        return `
        <div class="${r.dry_run ? 'ds-note' : 'sip-banner sip-banner-success'}" style="margin-bottom:4px">
            <i data-lucide="${r.dry_run ? 'scan-search' : 'check-circle-2'}" class="icon-sm"></i>
            ${r.dry_run
                ? `<strong>Dry run</strong> — แปลงและตรวจ ${r.cases.length} เคส ยังไม่เขียนฐานข้อมูล`
                : `นำเข้าแล้ว — สร้างใหม่ ${r.imported} · อัปเดต ${r.updated} เคส`}
            ${r.skipped.length ? ` · ข้าม ${r.skipped.length} แถว (${esc(r.skipped.slice(0, 2).join(' / '))}${r.skipped.length > 2 ? ' …' : ''})` : ''}
        </div>
        ${caseBlocks}`;
    },

    /* ══════════ Pre-validate — เรียก rule engine จริงที่ /api/reference/validate ══════════ */

    PRE_SAMPLE: {
        fund_key: 'IP',
        flags: { leaveDay: true },
        files_present: [1, 2, 3, 4, 5, 7, 8],
        patient: { name: 'ทดสอบ ระบบ', birth_date: '2500-05-10', sex: 'M', cid: '1101700230705', hn: 'HN00123' },
        admission: { admit_date: '2569-07-20', discharge_date: '2569-08-02', los: 20 },
        diagnosis: { pdx: 'Z13.1', sdx: ['E11.9', 'XX0.0'] },
        procedures: [{ code: '38.93', date: '2569-07-21' }],
        drugs: [{ tmt_id: '100001', price: 5.0, qty: 10 }],
        charges: { total: 15800, items: [
            { billgrcs: '02', name: 'ค่าห้อง/ค่าอาหาร', amount: 16800, qty: 14 },
            { billgrcs: '03', name: 'ยาในบัญชี', amount: -1000 },
        ] },
        drg: { code: '04530' },
    },

    preFillSample() {
        const el = document.getElementById('preClaim');
        if (el) el.value = JSON.stringify(this.PRE_SAMPLE, null, 2);
    },

    async preValidate() {
        const out = document.getElementById('preResult');
        let body;
        try {
            body = JSON.parse(document.getElementById('preClaim').value);
        } catch (e) {
            out.innerHTML = `<div class="ds-warn"><i data-lucide="alert-triangle" class="icon-sm"></i>
                JSON ไม่ถูกต้อง — ${esc(e.message)}</div>`;
            refreshIcons();
            return;
        }
        out.innerHTML = '<span style="font-size:13px;color:var(--text-secondary)">กำลังตรวจ…</span>';
        try {
            /* dsOptional: ถ้าไม่มีเซิร์ฟเวอร์ให้แจ้งในกล่องนี้เอง ไม่ต้องขึ้นป้าย static ทั้งหน้า */
            const res = await fetch('/api/reference/validate', {
                method: 'POST', dsOptional: true,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const r = await res.json();
            if (!res.ok) throw new Error(r.error || ('HTTP ' + res.status));
            out.innerHTML = this.preResultHtml(r);
        } catch (e) {
            out.innerHTML = `<div class="ds-warn"><i data-lucide="wifi-off" class="icon-sm"></i>
                เรียก rule engine ไม่ได้ (${esc(e.message)}) —
                หน้านี้ต้องรันกับเซิร์ฟเวอร์ (<code>npm run dev</code>) จึงจะตรวจกับฐานข้อมูลจริงได้</div>`;
        }
        refreshIcons();
    },

    preResultHtml(r) {
        const s = r.summary;
        const tone = { ERROR: 'rejected', WARNING: 'waiting', INFO: 'active' };
        const pass = s.result === 'PASS';
        const rows = r.issues.map(i => `
            <tr>
                <td><span class="status-badge ${tone[i.severity] || 'active'}">${esc(i.severity)}</span></td>
                <td>${i.code ? `<code>${esc(i.code)}</code>` : `<span style="color:var(--text-secondary)">${esc(i.rule || '—')}</span>`}
                    ${i.verified === true ? '' : i.code ? ' <span class="sip-chip sip-chip-amber" style="font-size:10px">รอยืนยัน</span>' : ''}</td>
                <td class="l">${esc(i.message)}${i.detail && i.detail !== i.message
                    ? `<div style="font-size:12px;color:var(--text-secondary)">${esc(i.detail)}</div>` : ''}
                    ${i.guidance ? `<div style="font-size:12px;color:var(--success,#0a7f4f);margin-top:2px">
                        <i data-lucide="wrench" class="icon-sm" style="width:12px;height:12px"></i> ${esc(i.guidance)}</div>` : ''}</td>
                <td class="l" style="font-size:12px;color:var(--text-secondary)">${esc(i.layer)}</td>
            </tr>`).join('');

        const sugs = (r.suggestions || []).map(g => `
            <div style="display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-top:1px solid var(--border-color)">
                <i data-lucide="${g.kind === 'DRG_REVIEW' ? 'trending-up' : 'list-checks'}" class="icon-sm" style="margin-top:2px;flex:none"></i>
                <div style="font-size:13px">
                    <code style="font-size:11px">${esc(g.id)}</code>
                    ${g.simulated ? '<span class="sip-chip sip-chip-amber" style="font-size:10px">ค่าจำลอง</span>' : ''}
                    ${esc(g.message)}
                    ${g.detail ? `<div style="font-size:12px;color:var(--text-secondary)">${esc(g.detail)}</div>` : ''}
                    ${g.evidence && g.evidence.rw_delta != null
                        ? `<div style="font-size:12px;color:var(--text-secondary)">RW ${Number(g.evidence.current_rw).toFixed(4)}
                           → ${Number(g.evidence.best_rw).toFixed(4)} (+${Number(g.evidence.rw_delta).toFixed(4)})</div>` : ''}
                </div>
            </div>`).join('');

        return `
        <div class="${pass ? 'ds-note' : 'ds-warn'}" style="margin-bottom:10px">
            <i data-lucide="${pass ? 'check-circle-2' : 'alert-octagon'}" class="icon-sm"></i>
            <strong>${pass ? 'ผ่านทุกกฎที่ตรวจ' : 'พบประเด็นก่อนส่ง'}</strong>
            — กองทุน ${esc(r.fund.fund_key)} · Error ${s.errors} · Warning ${s.warnings} · Info ${s.info}
            ${s.suggestions ? ` · ข้อเสนอแนะ ${s.suggestions}` : ''}
            · ชั้นที่ตรวจ: ${s.layers_checked.map(esc).join(', ')}
        </div>
        ${r.issues.length ? `
        <div class="table-responsive"><table class="data-table compact">
            <thead><tr><th>ระดับ</th><th>รหัส</th><th class="l">รายละเอียด (ข้อความจากแคตตาล็อกจริง)</th><th class="l">ชั้น</th></tr></thead>
            <tbody>${rows}</tbody>
        </table></div>` : ''}
        ${sugs ? `
        <div class="section-card" style="margin-top:10px;border-left:3px solid var(--warning,#b7791f)">
            <div style="padding:8px 10px;font-size:13px;font-weight:600">
                <i data-lucide="lightbulb" class="icon-sm"></i> ข้อเสนอแนะให้ลงรหัสสมบูรณ์
                <span style="font-weight:400;color:var(--text-secondary)">
                    — ชวนทบทวนเท่านั้น ไม่มีผลต่อ PASS/FAIL · ข้อเสนอที่เพิ่ม RW ต้องมีเอกสารรองรับก่อนปรับ</span>
            </div>
            ${sugs}
        </div>` : ''}`;
    },

    /* ══════════ ประวัติการนำเข้า ══════════ */

    tabHistory() {
        const rows = MOCK_NHSO_IMPORTS;
        return `
        <div class="section-card">
            <div class="section-header">
                <div class="section-title"><i data-lucide="history" class="mi"></i>
                    ประวัติการนำเข้าแฟ้มข้อมูล
                    <span class="ds-pane-count">${rows.length} ครั้ง</span></div>
                <div class="section-actions">
                    <input class="sip-input" type="date" style="width:140px" value="2026-08-01">
                    <input class="sip-input" type="date" style="width:140px" value="2026-08-06">
                    <button class="btn btn-outline" onclick="showToast('ค้นหาแล้ว (โหมดสาธิต)','info')">
                        <i data-lucide="search" class="icon-sm"></i> ค้นหา</button>
                </div>
            </div>
            <div class="table-responsive">
            <table class="data-table compact">
                <thead><tr>
                    <th style="width:1%">UploadID</th><th style="width:1%">วันที่นำเข้า</th>
                    <th>ชื่อไฟล์</th><th style="width:1%">ช่องทาง</th>
                    <th style="width:1%;text-align:right">จำนวนรายการ</th>
                    <th style="width:1%;text-align:right">ผ่าน</th>
                    <th style="width:1%;text-align:right">ไม่ผ่าน</th>
                    <th style="width:1%">สถานะ</th><th style="width:1%"></th>
                </tr></thead>
                <tbody>${rows.map(r => `<tr>
                    <td class="td-sub" style="white-space:nowrap">${esc(r.upload_id)}</td>
                    <td class="td-sub" style="white-space:nowrap">${esc(MockFmt.dateTimeTH(r.at))}</td>
                    <td class="td-name">${esc(r.file)}</td>
                    <td><span class="sip-chip sip-chip-muted">${esc(r.channel)}</span></td>
                    <td style="text-align:right">${MockFmt.int(r.rows)}</td>
                    <td style="text-align:right;color:var(--status-success-strong)">${MockFmt.int(r.ok)}</td>
                    <td style="text-align:right">${r.err
                        ? `<strong style="color:var(--status-danger)">${MockFmt.int(r.err)}</strong>` : '0'}</td>
                    <td><span class="sip-chip ${r.code === 'F002' ? 'sip-chip-success' : 'sip-chip-amber'}">
                        <strong>${esc(r.code)}</strong> ${esc(r.status)}</span></td>
                    <td><button class="ds-icon-btn" title="ดูผลการนำเข้า"
                        onclick="NhsoImport.openBatch('${esc(r.upload_id)}')">
                        <i data-lucide="eye" class="icon-sm"></i></button></td>
                </tr>`).join('')}</tbody>
            </table></div>
        </div>

        <div class="section-card">
            <div class="section-title" style="margin-bottom:10px">
                <i data-lucide="list-ordered" class="mi"></i> รหัสกิจกรรมในประวัติรายการ</div>
            <table class="ds-table-grid">
                <thead><tr><th style="width:12%">รหัส</th><th style="width:24%">สถานะ</th><th>คำอธิบาย</th></tr></thead>
                <tbody>${NHSO_ACTIVITY_CODES.map(a => `<tr>
                    <td class="c"><strong>${esc(a.code)}</strong></td>
                    <td class="l">${esc(a.label)}</td>
                    <td class="l">${esc(a.desc)}</td>
                </tr>`).join('')}</tbody>
            </table>
        </div>`;
    },

    openBatch(uploadId) {
        const b = MOCK_NHSO_IMPORTS.find(x => x.upload_id === uploadId); if (!b) return;
        const cases = MockNhso.cases().filter(c => c.nhso.upload_id === uploadId).slice(0, 10);
        Drawer.open({
            title: 'ผลการนำเข้า — ' + uploadId,
            contentHtml: `
                <table class="ds-table-grid">
                    <tbody>
                        <tr><td class="l" style="width:32%">ชื่อไฟล์</td><td class="l">${esc(b.file)}</td></tr>
                        <tr><td class="l">ช่องทาง</td><td class="l">${esc(b.channel)}</td></tr>
                        <tr><td class="l">วันที่นำเข้า</td><td class="l">${esc(MockFmt.dateTimeTH(b.at))}</td></tr>
                        <tr><td class="l">จำนวนรายการ</td><td class="l">${MockFmt.int(b.rows)} รายการ</td></tr>
                        <tr><td class="l">ผ่านการตรวจสอบเบื้องต้น</td><td class="l">${MockFmt.int(b.ok)} รายการ</td></tr>
                        <tr><td class="l">ไม่ผ่าน</td><td class="l">${b.err
                            ? `<strong style="color:var(--status-danger)">${MockFmt.int(b.err)}</strong> รายการ` : '0'}</td></tr>
                        <tr><td class="l">สถานะล่าสุด</td><td class="l"><strong>${esc(b.code)}</strong> — ${esc(b.status)}</td></tr>
                    </tbody>
                </table>
                ${cases.length ? `
                <div class="ds-section-label">ตัวอย่างรายการในไฟล์นี้</div>
                <table class="data-table compact"><thead><tr>
                    <th>SEQ</th><th>ผู้ป่วย</th><th>สถานะ</th></tr></thead>
                    <tbody>${cases.map(c => `<tr>
                        <td class="td-sub"><a href="nhso-case.html?seq=${encodeURIComponent(c.nhso.seq)}">${esc(c.nhso.seq)}</a></td>
                        <td>${esc(c.patient)}</td>
                        <td class="td-sub">${esc(c.nhso.sub_status)}</td>
                    </tr>`).join('')}</tbody></table>` : ''}`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    /* ══════════ โครงสร้าง 15 แฟ้ม ══════════ */

    tabDataset() {
        const pct = MockNhso.mappingPct();
        const t = MockNhso.fieldTotals();
        return `
        <div class="sip-banner sip-banner-info" style="margin-bottom:14px">
            <i data-lucide="scale" class="icon-sm"></i>
            <span><strong>ที่มา:</strong> ${esc(NHSO_DATASET_ANNOUNCE.short)} —
            อาศัยอำนาจตาม${esc(NHSO_DATASET_ANNOUNCE.legal)} ·
            ดาวน์โหลดได้ที่ ${esc(NHSO_DATASET_ANNOUNCE.source)}</span>
        </div>

        <div class="cards-row" style="grid-template-columns:2fr 1fr">
            <div class="section-card">
                <div class="section-title" style="margin-bottom:6px">
                    <i data-lucide="database" class="mi"></i>
                    แฟ้มข้อมูลมาตรฐานสำหรับการเบิกจ่ายชดเชย (Standard Dataset)</div>
                <div class="td-sub" style="margin-bottom:10px">
                    โครงสร้างข้อมูลที่หน่วยบริการต้องจัดส่งตามประกาศ สปสช. — 15 แฟ้ม ใน 5 กลุ่มข้อมูลหลัก
                    รวม <strong>${t.total} Data Points</strong>
                    (บังคับ ${t.req} · มีเงื่อนไข ${t.cond} · อื่น ๆ ${t.opt})
                </div>
                <div id="chartMapping"></div>
            </div>
            <div class="section-card">
                <div class="section-title" style="margin-bottom:10px">
                    <i data-lucide="gauge" class="mi"></i> ความพร้อมของ Mapping</div>
                <div style="text-align:center;padding:10px 0">
                    <div style="font-size:46px;font-weight:800;color:${
                        pct >= 80 ? 'var(--status-success-strong)' : 'var(--status-warning-strong)'}">${pct}%</div>
                    <div class="td-sub">ความครบของการผูกแฟ้มกับข้อมูลใน HIS</div>
                </div>
                <div class="ds-note">
                    <i data-lucide="link" class="icon-sm"></i>
                    ตัวเลขนี้ผูกกับ <strong>งานก่อน UAT ข้อ 4 และ 5</strong> โดยตรง —
                    ต้องถึง 100% ก่อน Go-Live 16 ก.ย. 2569
                </div>
                <button class="btn btn-outline btn-block" style="margin-top:10px"
                        onclick="NhsoImport.setTab('pretask')">
                    <i data-lucide="list-checks" class="icon-sm"></i> ดูงานก่อน UAT</button>
            </div>
        </div>

        ${NHSO_FILE_GROUPS.map(g => {
            const files = MockNhso.filesByGroup(g.key);
            const sub = files.reduce((a, f) => ({
                req: a.req + f.req, cond: a.cond + f.cond, opt: a.opt + f.opt, total: a.total + f.fields,
            }), { req: 0, cond: 0, opt: 0, total: 0 });
            return `<div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="${g.icon}" class="mi"></i>
                        ${esc(g.label)}
                        <span class="sip-chip sip-chip-muted">${esc(g.hint)}</span></div>
                    <div class="section-actions">
                        <span class="ds-pane-count">${files.length} แฟ้ม · ${sub.total} ฟิลด์</span></div>
                </div>
                <div class="table-responsive">
                <table class="data-table compact">
                    <thead><tr>
                        <th style="width:1%">ลำดับ</th><th style="width:24%">ชื่อแฟ้ม (ไทย)</th>
                        <th style="width:1%">ชื่อแฟ้ม (English)</th><th>คำอธิบาย</th>
                        <th style="width:1%">ที่มาโครงสร้าง</th>
                        <th style="width:1%;text-align:right">บังคับ</th>
                        <th style="width:1%;text-align:right">มีก็ได้</th>
                        <th style="width:1%;text-align:right">อื่น ๆ</th>
                        <th style="width:1%;text-align:right">รวม</th>
                        <th style="width:1%">สถานะ Mapping</th><th style="width:1%"></th>
                    </tr></thead>
                    <tbody>${files.map(f => {
                        const t = NHSO_MAPPING_TONE[f.mapping];
                        const cond = MockNhso.fileCondition(f.no);
                        return `<tr>
                            <td class="td-sub" style="text-align:center"><strong>${esc(f.no)}</strong></td>
                            <td class="td-name">${esc(f.th)}${cond
                                ? `<div class="td-sub">ส่งเมื่อ ${esc(cond.label)}</div>` : ''}</td>
                            <td class="td-sub" style="white-space:nowrap"><code>${esc(f.en)}</code></td>
                            <td class="td-sub">${esc(f.desc)}</td>
                            <td class="td-sub" style="white-space:nowrap">${esc(f.origin)}</td>
                            <td style="text-align:right"><strong>${esc(f.req)}</strong></td>
                            <td style="text-align:right" class="td-sub">${esc(f.cond || '–')}</td>
                            <td style="text-align:right" class="td-sub">${esc(f.opt || '–')}</td>
                            <td style="text-align:right">${esc(f.fields)}</td>
                            <td><span class="sip-chip ${esc(t.chip)}">${esc(t.label)}</span></td>
                            <td><button class="ds-icon-btn" title="ดูรายการฟิลด์"
                                onclick="NhsoImport.openFile(${esc(f.no)})">
                                <i data-lucide="eye" class="icon-sm"></i></button></td>
                        </tr>`;
                    }).join('')}
                    <tr class="ds-row-total">
                        <td colspan="5" style="text-align:right"><strong>รวมกลุ่มนี้</strong></td>
                        <td style="text-align:right"><strong>${sub.req}</strong></td>
                        <td style="text-align:right"><strong>${sub.cond}</strong></td>
                        <td style="text-align:right"><strong>${sub.opt}</strong></td>
                        <td style="text-align:right"><strong>${sub.total}</strong></td>
                        <td colspan="2"></td>
                    </tr></tbody>
                </table></div>
            </div>`;
        }).join('')}

        <div class="section-card">
            <div class="table-responsive">
            <table class="data-table compact">
                <tbody><tr class="ds-row-total">
                    <td><strong>รวมทั้งชุดข้อมูลมาตรฐาน — ${NHSO_FILES.length} แฟ้ม</strong></td>
                    <td style="width:1%;text-align:right;white-space:nowrap">
                        บังคับ <strong>${t.req}</strong></td>
                    <td style="width:1%;text-align:right;white-space:nowrap">
                        มีก็ได้ <strong>${t.cond}</strong></td>
                    <td style="width:1%;text-align:right;white-space:nowrap">
                        อื่น ๆ <strong>${t.opt}</strong></td>
                    <td style="width:1%;text-align:right;white-space:nowrap">
                        รวม <strong>${t.total} Data Points</strong></td>
                </tr></tbody>
            </table></div>
            <div class="ds-note" style="margin-top:10px">
                <i data-lucide="git-branch" class="icon-sm"></i>
                <strong>ของเดิมไปไหน</strong> —
                ${NHSO_FILE_ORIGINS.map(o =>
                    `แฟ้ม ${esc(o.files)} ${esc(o.desc)}`).join(' · ')}
            </div>
        </div>`;
    },

    renderMappingChart() {
        const el = document.getElementById('chartMapping'); if (!el) return;
        const counts = { DONE: 0, PARTIAL: 0, TODO: 0 };
        NHSO_FILES.forEach(f => counts[f.mapping]++);
        DSChart.donut('chartMapping', {
            title: 'สถานะ Mapping ของ 15 แฟ้ม',
            centerValue: NHSO_FILES.length, centerLabel: 'แฟ้มทั้งหมด',
            slices: [
                { label: 'Mapping ครบแล้ว', value: counts.DONE,    color: 'var(--status-success)' },
                { label: 'ยังไม่ครบ',        value: counts.PARTIAL, color: 'var(--status-warning)' },
                { label: 'ยังไม่เริ่ม',      value: counts.TODO,    color: 'var(--status-danger)' },
            ],
        });
    },

    openFile(no) {
        const f = NHSO_FILES.find(x => x.no === no); if (!f) return;
        const g = NHSO_FILE_GROUPS.find(x => x.key === f.group) || {};
        const t = NHSO_MAPPING_TONE[f.mapping];

        /* ตัวอย่างฟิลด์สำคัญของแฟ้มที่ใช้บ่อยในการเดโม */
        const SAMPLE = {
            7:  [['SEQ', 'เลขที่รายการ (Visit)'], ['BILLGRCS', 'หมวดค่าใช้จ่าย'],
                 ['STDCODE', 'รหัสมาตรฐานของรายการ'], ['CODESYS', 'ระบบรหัสที่ใช้'],
                 ['QTY', 'จำนวน'], ['UNITPRICE', 'ราคาต่อหน่วยที่ส่งเบิก'], ['AMOUNT', 'มูลค่ารวม']],
            1:  [['HN', 'เลขประจำตัวผู้ป่วย'], ['CID', 'เลขบัตรประชาชน'], ['DOB', 'วันเกิด'],
                 ['SEX', 'เพศ'], ['INSCL', 'ประเภทสิทธิ'], ['SUBTYPE', 'สิทธิย่อย']],
            14: [['AN', 'เลขที่รับไว้เป็นผู้ป่วยใน'], ['DATEADM', 'วันที่รับไว้'],
                 ['DATEDSC', 'วันที่จำหน่าย'], ['LOS', 'จำนวนวันนอน'], ['DISCHT', 'สถานะจำหน่าย']],
            15: [['AN', 'เลขที่รับไว้เป็นผู้ป่วยใน'], ['LVDATE', 'วันที่เริ่มลากลับบ้าน'],
                 ['LVDAY', 'จำนวนวันลากลับบ้าน']],
            9:  [['AERTYPE', 'ประเภทอุบัติเหตุ/ฉุกเฉิน'], ['ALERTTIME', 'เวลารับแจ้ง'],
                 ['LAT/LONG', 'พิกัดจุดเกิดเหตุ'], ['REFER', 'การนำส่ง/ส่งต่อ']],
        };
        const fields = SAMPLE[no];

        Drawer.open({
            title: `แฟ้มที่ ${no} — ${f.th}`,
            contentHtml: `
                <table class="ds-table-grid">
                    <tbody>
                        <tr><td class="l" style="width:32%">ชื่อแฟ้ม (English)</td><td class="l"><code>${esc(f.en)}</code></td></tr>
                        <tr><td class="l">กลุ่มข้อมูล</td><td class="l">${esc(g.label)} — ${esc(g.hint)}</td></tr>
                        <tr><td class="l">คำอธิบาย</td><td class="l">${esc(f.desc)}</td></tr>
                        <tr><td class="l">ที่มาโครงสร้าง</td><td class="l">${esc(f.origin)}</td></tr>
                        <tr><td class="l">จำนวนฟิลด์</td><td class="l">
                            รวม <strong>${esc(f.fields)}</strong> ฟิลด์ —
                            บังคับ ${esc(f.req)} · มีเงื่อนไข ${esc(f.cond)} · อื่น ๆ ${esc(f.opt)}</td></tr>
                        <tr><td class="l">เงื่อนไขการส่ง</td><td class="l">${
                            MockNhso.fileCondition(f.no)
                                ? 'ส่งเมื่อ ' + esc(MockNhso.fileCondition(f.no).label)
                                : 'บังคับทุกครั้งที่กองทุนครอบคลุมแฟ้มนี้'}</td></tr>
                        <tr><td class="l">กองทุนที่ใช้แฟ้มนี้</td><td class="l">${
                            NHSO_FUND_FILES.filter(x => x.files.includes(f.no)).length} / ${NHSO_FUND_FILES.length} กองทุน</td></tr>
                        <tr><td class="l">สถานะ Mapping</td><td class="l">
                            <span class="sip-chip ${esc(t.chip)}">${esc(t.label)}</span></td></tr>
                    </tbody>
                </table>
                ${fields ? `
                <div class="ds-section-label">ฟิลด์สำคัญ (ตัวอย่าง)</div>
                <table class="ds-table-grid">
                    <thead><tr><th style="width:32%">ฟิลด์</th><th>ความหมาย</th></tr></thead>
                    <tbody>${fields.map(([k, v]) =>
                        `<tr><td class="l"><code>${esc(k)}</code></td><td class="l">${esc(v)}</td></tr>`).join('')}</tbody>
                </table>` : `<div class="ds-empty-sm">รายการฟิลด์เต็มอยู่ในเอกสาร Standard Dataset ฉบับล่าสุด</div>`}
                ${no === 7 ? `<div class="ds-warn"><i data-lucide="alert-triangle" class="icon-sm"></i>
                    แฟ้มนี้เป็นต้นเหตุของรหัส <strong>P124</strong> — ราคา UNITPRICE ต้องไม่เกินราคาใน
                    Drug Catalogue ที่ผูกกับ STDCODE เดียวกัน</div>` : ''}
                ${no === 15 ? `<div class="ds-note"><i data-lucide="calendar-clock" class="icon-sm"></i>
                    แฟ้ม 14 และ 15 เริ่มบังคับใช้พร้อมการเปิด IPD ในระยะ MVP2 Drop 2
                    (Go-Live เป้าหมาย 16 ก.ย. 2569)</div>` : ''}`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    /* ══════════ แฟ้มที่ต้องส่งตามกองทุน ══════════ */

    setFundFilter(k) { this.fundFilter = k; this.render(); },

    tabFundFile() {
        const funds = this.fundFilter
            ? NHSO_FUND_FILES.filter(f => f.key === this.fundFilter)
            : NHSO_FUND_FILES;
        const bad = MockClaims.filesIncomplete();
        const pending = MockNhso.pendingServiceSet();

        return `
        <div class="sip-banner sip-banner-info" style="margin-bottom:14px">
            <i data-lucide="table-2" class="icon-sm"></i>
            <span><strong>กองทุนค่าใช้จ่ายตามโครงสร้างชุดข้อมูลมาตรฐานการเบิกจ่ายชดเชย</strong> —
            ประกาศ สปสช. กำหนดว่าแต่ละกองทุนต้องส่งแฟ้มใดบ้าง
            (${NHSO_FUND_FILES.length} กองทุน × ${NHSO_FILES.length} แฟ้ม)
            ตารางนี้คือที่มาของกฎ <a href="claim-rules.html?rule=RUL-FIL-001">RUL-FIL-001</a></span>
        </div>

        <div class="ds-kpi-grid">
            <div class="sip-kpi"><i data-lucide="layers" class="sip-kpi-icon icon-lg"></i>
                <div class="sip-kpi-value">${NHSO_FUND_FILES.length}</div>
                <div class="sip-kpi-label">กองทุนย่อยในตาราง</div></div>
            <div class="sip-kpi ${bad.length ? 'critical' : ''}">
                <i data-lucide="file-x" class="sip-kpi-icon icon-lg"></i>
                <div class="sip-kpi-value">${bad.length}</div>
                <div class="sip-kpi-label">เคสที่ส่งแฟ้มไม่ครบตามกองทุน</div></div>
            <div class="sip-kpi"><i data-lucide="database" class="sip-kpi-icon icon-lg"></i>
                <div class="sip-kpi-value">${MockNhso.mappingPct()}%</div>
                <div class="sip-kpi-label">ความครบของ Mapping</div></div>
        </div>

        <div class="section-card">
            <div class="section-header">
                <div class="section-title"><i data-lucide="filter" class="mi"></i> เลือกกองทุน</div>
                <div class="section-actions">
                    <span class="ds-pane-count">${funds.length} กองทุน</span></div>
            </div>
            <div class="ds-pilltabs">
                <button class="ds-pilltab ${this.fundFilter ? '' : 'active'}"
                        onclick="NhsoImport.setFundFilter('')">ทุกกองทุน
                    <span class="tab-count">${NHSO_FUND_FILES.length}</span></button>
                ${NHSO_FUND_FILES.map(f => `
                    <button class="ds-pilltab ${this.fundFilter === f.key ? 'active' : ''}"
                            onclick="NhsoImport.setFundFilter('${esc(f.key)}')">${esc(f.key)}
                        <span class="tab-count">${f.files.length}</span></button>`).join('')}
            </div>

            <div class="table-responsive" style="margin-top:12px">
            <table class="data-table compact">
                <thead><tr>
                    <th style="width:26%">กองทุน</th>
                    ${NHSO_FILES.map(f => `<th style="width:1%;text-align:center" title="${esc(f.th)}">
                        ${esc(f.no)}</th>`).join('')}
                    <th style="width:1%;text-align:right">รวม</th>
                </tr></thead>
                <tbody>${funds.map(fund => `<tr>
                    <td class="td-name">${esc(fund.label)}
                        <div class="td-sub"><code>${esc(fund.key)}</code></div></td>
                    ${NHSO_FILES.map(f => {
                        const need = fund.files.includes(f.no);
                        const cond = MockNhso.fileCondition(f.no);
                        if (!need) return '<td class="td-sub" style="text-align:center">—</td>';
                        return `<td style="text-align:center" title="${esc(f.en)}${
                            cond ? ' — ส่งเมื่อ ' + esc(cond.label) : ' — บังคับ'}">
                            <i data-lucide="${cond ? 'circle-dot' : 'check'}" class="icon-sm"
                               style="color:var(--status-${cond ? 'warning' : 'success'}-strong)"></i></td>`;
                    }).join('')}
                    <td style="text-align:right"><strong>${fund.files.length}</strong></td>
                </tr>`).join('')}</tbody>
            </table></div>

            <div class="ds-note" style="margin-top:10px">
                <i data-lucide="info" class="icon-sm"></i>
                <i data-lucide="check" class="icon-sm" style="color:var(--status-success-strong)"></i>
                บังคับเสมอเมื่อกองทุนครอบคลุม ·
                <i data-lucide="circle-dot" class="icon-sm" style="color:var(--status-warning-strong)"></i>
                แฟ้มกลุ่มเฉพาะ ส่งเมื่อเคสเข้าเงื่อนไข (${
                    Object.values(NHSO_FILE_CONDITION).map(c => esc(c.label)).join(' · ')})
            </div>
        </div>

        ${pending ? `
        <div class="section-card">
            <div class="section-title" style="margin-bottom:8px">
                <i data-lucide="alert-triangle" class="mi"></i> ${esc(pending.title)}</div>
            <div class="ds-warn">
                <i data-lucide="alert-triangle" class="icon-sm"></i>
                <span><strong>${esc(pending.warn)}</strong><br>
                ${pending.items.map(i => esc(i)).join(' · ')}</span>
            </div>
        </div>` : ''}

        ${bad.length ? `
        <div class="section-card">
            <div class="section-header">
                <div class="section-title"><i data-lucide="file-x" class="mi"></i>
                    เคสที่ยังส่งแฟ้มไม่ครบ</div>
                <div class="section-actions">
                    <a class="btn btn-outline btn-sm" href="claim-worklist.html?filter=files">
                        ดูในคิวเคลม</a></div>
            </div>
            <div class="table-responsive">
            <table class="data-table compact">
                <thead><tr>
                    <th style="width:1%">รหัสเคส</th><th>ผู้ป่วย</th>
                    <th style="width:1%">บริการ</th><th style="width:22%">กองทุน</th>
                    <th>แฟ้มที่ยังขาด</th>
                </tr></thead>
                <tbody>${bad.slice(0, 12).map(c => {
                    const r = MockClaims.fileCheck(c);
                    return `<tr>
                        <td class="td-sub"><a href="nhso-case.html?seq=${encodeURIComponent(c.nhso.seq)}">${esc(c.id)}</a></td>
                        <td>${esc(c.patient)}</td>
                        <td class="td-sub">${esc(c.service_type)}</td>
                        <td class="td-sub">${esc(r.fundLabel)}</td>
                        <td><span class="sip-chip sip-chip-danger">${esc(MockNhso.fileNames(r.missing))}</span></td>
                    </tr>`;
                }).join('')}</tbody>
            </table></div>
            ${bad.length > 12
                ? `<div class="td-sub" style="margin-top:8px">แสดง 12 จาก ${bad.length} รายการ</div>` : ''}
        </div>` : ''}`;
    },

    /* ══════════ งานก่อน UAT ══════════ */

    tabPretask() {
        const done = NHSO_PRETASKS.filter(t => t.status === 'DONE').length;
        return `
        <div class="sip-banner sip-banner-warning" style="margin-bottom:14px">
            <i data-lucide="flag" class="icon-sm"></i>
            <span><strong>🎯 Go-Live เป้าหมาย ${esc(NHSO_GOLIVE.date)}</strong> สำหรับโรงพยาบาลที่พร้อม —
            ทั้ง 5 งานนี้เป็นข้อกำหนดของ สปสช. สำหรับโรงพยาบาลและ Software Vendor ในช่วง Hand Shake ก่อน UAT</span>
        </div>

        <div class="ds-kpi-grid">
            <div class="sip-kpi"><i data-lucide="list-checks" class="sip-kpi-icon icon-lg"></i>
                <div class="sip-kpi-value">${done}/${NHSO_PRETASKS.length}</div>
                <div class="sip-kpi-label">งานที่เสร็จแล้ว</div></div>
            <div class="sip-kpi"><i data-lucide="database" class="sip-kpi-icon icon-lg"></i>
                <div class="sip-kpi-value">${MockNhso.mappingPct()}%</div>
                <div class="sip-kpi-label">ความครบของ Mapping</div></div>
            <div class="sip-kpi critical"><i data-lucide="calendar-clock" class="sip-kpi-icon icon-lg"></i>
                <div class="sip-kpi-value" style="font-size:20px">${esc(NHSO_GOLIVE.date)}</div>
                <div class="sip-kpi-label">Go-Live เป้าหมาย</div></div>
        </div>

        <div class="section-card">
            <div class="section-title" style="margin-bottom:12px">
                <i data-lucide="handshake" class="mi"></i>
                สิ่งที่โรงพยาบาล / Software Vendor ต้องเตรียมก่อน UAT</div>
            <div class="table-responsive">
            <table class="data-table compact">
                <thead><tr>
                    <th style="width:1%">#</th><th style="width:22%">งาน</th><th>รายละเอียด</th>
                    <th style="width:1%">ผู้รับผิดชอบ</th><th style="width:1%">กำหนดเสร็จ</th>
                    <th style="width:1%">สถานะ</th>
                </tr></thead>
                <tbody>${NHSO_PRETASKS.map(t => {
                    const tone = NHSO_PRETASK_TONE[t.status];
                    return `<tr ${t.no === 5 ? 'style="background:var(--status-danger-soft)"' : ''}>
                        <td style="text-align:center"><strong>${esc(t.no)}</strong></td>
                        <td class="td-name">${esc(t.title)}</td>
                        <td class="td-sub">${esc(t.desc)}
                            ${t.note ? `<div class="ds-hint">${esc(t.note)}</div>` : ''}</td>
                        <td class="td-sub">${esc(t.owner)}</td>
                        <td class="td-sub" style="white-space:nowrap">${esc(MockFmt.dateTH(t.due))}</td>
                        <td><span class="status-badge ${esc(tone.badge)}">${esc(tone.label)}</span></td>
                    </tr>`;
                }).join('')}</tbody>
            </table></div>
            <div class="ds-warn" style="margin-top:12px">
                <i data-lucide="alert-triangle" class="icon-sm"></i>
                <strong>ข้อ 5 คือข้อที่ทำให้เกิด P124</strong> — ถ้า Mapping ราคายา/บริการไม่ตรงกับ
                Drug &amp; Service Catalogue ที่ให้ข้อมูลไว้กับ สปสช. ทุกเคสที่มีรายการนั้นจะถูกตีกลับทั้งชุด
                <a href="claim-admin.html?tab=mapping" style="margin-left:6px">ไปที่หน้าจัดการ Mapping</a>
            </div>
        </div>

        <div class="section-card">
            <div class="section-title" style="margin-bottom:12px">
                <i data-lucide="milestone" class="mi"></i> แผนการขึ้นระบบของ สปสช. (NHSO Roadmap)</div>
            <div class="cards-row">
                ${NHSO_ROADMAP.map(p => `
                    <div class="clinical-card" style="${p.status === 'NEXT'
                        ? 'border-color:var(--status-danger);background:var(--status-danger-soft)' : ''}">
                        <div class="card-title">${esc(p.phase)}</div>
                        <div class="td-sub" style="margin-bottom:8px">${esc(p.when)}</div>
                        <div style="font-size:20px;font-weight:800;color:var(--brand-navy);margin-bottom:6px">
                            ${esc(p.units)}</div>
                        <ul style="font-size:11.5px;line-height:1.6;color:var(--text-muted);padding-left:16px;margin-bottom:8px">
                            ${p.detail.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
                        <div class="ds-section-label">ประเภทผู้ป่วย</div>
                        <div style="margin-bottom:6px">${p.patients.map(x =>
                            `<span class="sip-chip sip-chip-muted">${esc(x)}</span>`).join(' ')}</div>
                        <div class="ds-section-label">สิทธิที่รองรับ</div>
                        <div>${p.rights.map(x =>
                            `<span class="sip-chip sip-chip-muted">${esc(x)}</span>`).join(' ')}</div>
                    </div>`).join('')}
            </div>
            <div class="ds-note" style="margin-top:12px">
                <i data-lucide="info" class="icon-sm"></i> ${esc(NHSO_GOLIVE.note)}
            </div>
        </div>

        <div class="section-card">
            <div class="section-title" style="margin-bottom:4px">
                <i data-lucide="route" class="mi"></i> ${esc(NHSO_MASTERPLAN.title)}</div>
            <div class="td-sub" style="margin-bottom:12px">${esc(NHSO_MASTERPLAN.subtitle)}
                <br><span class="ds-hint">ที่มา: ${esc(NHSO_MASTERPLAN.source)}</span></div>
            <div class="cards-row">
                ${NHSO_MASTERPLAN.phases.map(p => `
                    <div class="clinical-card">
                        <div class="card-title">${esc(p.phase)} — ${esc(p.title)}</div>
                        <div class="td-sub" style="margin-bottom:8px">${esc(p.when)}</div>
                        <ul style="font-size:11.5px;line-height:1.7;color:var(--text-muted);padding-left:16px">
                            ${p.milestones.map(m => `<li>${esc(m)}</li>`).join('')}</ul>
                    </div>`).join('')}
            </div>
            <div class="ds-note" style="margin-top:12px">
                <i data-lucide="users" class="icon-sm"></i>
                <span><strong>เมื่อบูรณาการเต็มรูปแบบ จะครอบคลุมทุกสิทธิ</strong> —
                ${NHSO_ALL_PAYERS.map(p => esc(p)).join(' · ')}</span>
            </div>
        </div>`;
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.NhsoImport = NhsoImport;
document.addEventListener('DOMContentLoaded', () => NhsoImport.init());
