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
        { key: 'pretask',  label: 'งานก่อน UAT' },
    ],

    init() {
        MockSession.mountBanner('demoBanner');
        const p = new URLSearchParams(location.search);
        if (p.get('tab')) this.state.tab = p.get('tab');
        this.renderSeg();
        this.render();
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
            dataset: () => this.tabDataset(), pretask: () => this.tabPretask(),
        }[this.state.tab];
        document.getElementById('tabContent').innerHTML = fn ? fn() : '';
        if (this.state.tab === 'dataset') this.renderMappingChart();
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
            { code: 'F001', label: 'กำลังตรวจสอบขั้นต้น' },
            { code: 'F002', label: 'ตรวจสอบขั้นต้นเสร็จสิ้น' },
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
        </div>`;
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
                        <tr><td class="l">ผ่านการตรวจสอบขั้นต้น</td><td class="l">${MockFmt.int(b.ok)} รายการ</td></tr>
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
        return `
        <div class="cards-row" style="grid-template-columns:2fr 1fr">
            <div class="section-card">
                <div class="section-title" style="margin-bottom:6px">
                    <i data-lucide="database" class="mi"></i>
                    แฟ้มข้อมูลมาตรฐานสำหรับการเบิกจ่ายชดเชย (Standard Dataset)</div>
                <div class="td-sub" style="margin-bottom:10px">
                    โครงสร้างข้อมูลที่หน่วยบริการต้องจัดส่งตามประกาศ สปสช. — 15 แฟ้ม ใน 5 กลุ่มข้อมูลหลัก
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
            return `<div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i data-lucide="${g.icon}" class="mi"></i>
                        ${esc(g.label)}
                        <span class="sip-chip sip-chip-muted">${esc(g.hint)}</span></div>
                    <div class="section-actions">
                        <span class="ds-pane-count">${files.length} แฟ้ม</span></div>
                </div>
                <div class="table-responsive">
                <table class="data-table compact">
                    <thead><tr>
                        <th style="width:1%">ลำดับ</th><th style="width:26%">ชื่อแฟ้ม (ไทย)</th>
                        <th style="width:1%">ชื่อแฟ้ม (English)</th><th>คำอธิบาย</th>
                        <th style="width:1%;text-align:right">จำนวนฟิลด์</th>
                        <th style="width:1%">สถานะ Mapping</th><th style="width:1%"></th>
                    </tr></thead>
                    <tbody>${files.map(f => {
                        const t = NHSO_MAPPING_TONE[f.mapping];
                        return `<tr>
                            <td class="td-sub" style="text-align:center"><strong>${esc(f.no)}</strong></td>
                            <td class="td-name">${esc(f.th)}</td>
                            <td class="td-sub" style="white-space:nowrap"><code>${esc(f.en)}</code></td>
                            <td class="td-sub">${esc(f.desc)}</td>
                            <td style="text-align:right">${esc(f.fields)}</td>
                            <td><span class="sip-chip ${esc(t.chip)}">${esc(t.label)}</span></td>
                            <td><button class="ds-icon-btn" title="ดูรายการฟิลด์"
                                onclick="NhsoImport.openFile(${esc(f.no)})">
                                <i data-lucide="eye" class="icon-sm"></i></button></td>
                        </tr>`;
                    }).join('')}</tbody>
                </table></div>
            </div>`;
        }).join('')}`;
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
                        <tr><td class="l">จำนวนฟิลด์</td><td class="l">${esc(f.fields)} ฟิลด์</td></tr>
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
                        <td class="td-sub">${esc(t.desc)}</td>
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
