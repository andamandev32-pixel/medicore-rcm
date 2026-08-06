/* ────────────────────────────────────────────────────────
   วิเคราะห์การตีกลับ (Reject Analysis) — SRS §10 · FR-08

   นี่คือเสา "Reject Feedback Loop" ที่กดใช้งานได้จริง:
     ผลตีกลับ → จัดหมวดสาเหตุ → ดูว่ามีกฎครอบคลุมหรือยัง
     → สร้างร่างกฎจากสาเหตุนั้น → ไปโผล่ในคลังกฎเป็น "ร่าง"
   ──────────────────────────────────────────────────────── */

const Reject = {

    state: { group: 'all' },

    init() {
        MockSession.mountBanner('demoBanner');
        this.fillBatches();
        this.renderSeg();
        this.render();
    },

    fillBatches() {
        document.getElementById('fBatch').insertAdjacentHTML('beforeend',
            MOCK_REJECT_BATCHES.map(b =>
                `<option value="${esc(b.id)}">${esc(b.period)} (${esc(b.id)})</option>`).join(''));
    },

    renderSeg() {
        const all = MockRejects.causes().length;
        document.getElementById('segGroup').innerHTML =
            `<button class="ds-seg ${this.state.group === 'all' ? 'active' : ''}"
                onclick="Reject.setGroup('all')">ทั้งหมด (${all})</button>` +
            REJECT_GROUPS.map(g => {
                const n = MockRejects.causes().filter(c => c.group === g.key).length;
                return `<button class="ds-seg ${this.state.group === g.key ? 'active' : ''}"
                    onclick="Reject.setGroup('${esc(g.key)}')">${esc(g.label)} (${n})</button>`;
            }).join('');
    },

    setGroup(k) { this.state.group = k; this.renderSeg(); this.render(); },

    visible() {
        return MockRejects.causes().filter(c =>
            this.state.group === 'all' || c.group === this.state.group);
    },

    render() {
        this.renderKpi();
        this.renderPareto();
        this.renderTrend();
        this.renderTable();
        this.renderBatches();
        refreshIcons();
    },

    renderKpi() {
        const top = MockRejects.pareto()[0] || {};
        const covered = MockRejects.coveredAmount();
        const total = MockRejects.totalAmount() || 1;
        document.getElementById('kpiCount').textContent     = MockFmt.int(MockRejects.totalCount());
        document.getElementById('kpiAmount').textContent    = MockFmt.baht(total);
        document.getElementById('kpiTop').textContent       = top.code ? `${top.code} — ${top.cause}` : '—';
        document.getElementById('kpiCovered').textContent   = MockFmt.pct((covered / total) * 100, 0);
        document.getElementById('kpiUncovered').textContent = MockFmt.int(MockRejects.uncovered().length);
    },

    renderPareto() {
        const rows = MockRejects.pareto();
        const max = rows[0] ? rows[0].amount : 1;
        document.getElementById('paretoBody').innerHTML = rows.map(r => `
            <div class="ds-pareto-row" style="cursor:pointer" onclick="Reject.openCause('${esc(r.code)}')">
                <div class="ds-pareto-label">
                    <span class="sip-chip ${r.rule ? 'sip-chip-success' : 'sip-chip-danger'}">${esc(r.code)}</span>
                    ${esc(r.cause)}
                    <small>${esc(r.dept)}</small>
                </div>
                ${DSChart.hbar((r.amount / max) * 100, MockFmt.baht(r.amount) + ' บ.',
                    r.rule ? '' : 'danger')}
                <div class="ds-pareto-cum">สะสม ${MockFmt.pct(r.cum, 0)}</div>
            </div>`).join('');
    },

    renderTrend() {
        DSChart.line('chartTrend', {
            title: 'จำนวนรายการที่ถูกตีกลับรายเดือน',
            labels: MockRejects.trend.labels,
            yFmt: v => MockFmt.int(v),
            series: [{ name: 'จำนวนรายการที่ถูกตีกลับ', points: MockRejects.trend.count,
                       color: 'var(--status-danger)', }],
            area: true,
        });
    },

    renderTable() {
        const rows = this.visible().slice().sort((a, b) => b.amount - a.amount);
        document.getElementById('rowCount').textContent = rows.length + ' สาเหตุ';
        document.getElementById('rows').innerHTML = rows.length ? rows.map(c => {
            const g = REJECT_GROUPS.find(x => x.key === c.group) || {};
            const rule = c.rule ? MockRules.byId(c.rule) : null;
            return `<tr>
                <td><span class="sip-chip ${c.rule ? 'sip-chip-muted' : 'sip-chip-danger'}">${esc(c.code)}</span></td>
                <td class="td-name">${esc(c.cause)}
                    <div class="td-sub">${esc(NHSO_ERR_TEXT[c.code] ? NHSO_ERR_TEXT[c.code].slice(0, 90) + '…' : '')}</div></td>
                <td class="td-sub">${esc(g.label || '—')}</td>
                <td class="td-sub">${esc(c.dept)}</td>
                <td style="text-align:right">${MockFmt.int(c.count)}</td>
                <td style="text-align:right;white-space:nowrap"><strong>${esc(MockFmt.baht(c.amount))}</strong></td>
                <td style="white-space:nowrap">${rule
                    ? `<a href="claim-rules.html?rule=${encodeURIComponent(rule.id)}"
                         class="sip-chip sip-chip-success">${esc(rule.id)} ${esc(MockTone.lifecycleLabel[rule.status])}</a>`
                    : '<span class="sip-chip sip-chip-danger">ยังไม่มีกฎ</span>'}</td>
                <td style="white-space:nowrap">
                    <button class="ds-icon-btn" title="ดูรายละเอียดสาเหตุ" onclick="Reject.openCause('${esc(c.code)}')">
                        <i data-lucide="eye" class="icon-sm"></i></button>
                    ${!rule ? `<button class="ds-icon-btn edit" title="สร้างร่างกฎจากสาเหตุนี้"
                        onclick="Reject.openDraft('${esc(c.code)}')">
                        <i data-lucide="git-branch-plus" class="icon-sm"></i></button>` : ''}
                </td>
            </tr>`;
        }).join('') : '<tr><td colspan="8" class="ds-empty">ไม่พบสาเหตุในหมวดนี้</td></tr>';
    },

    renderBatches() {
        document.getElementById('batchRows').innerHTML = MOCK_REJECT_BATCHES.map(b => `
            <tr>
                <td class="td-sub">${esc(b.id)}</td>
                <td>${esc(b.period)}</td>
                <td class="td-sub">${esc(MockFmt.dateTimeTH(b.imported))}</td>
                <td style="text-align:right">${MockFmt.int(b.rows)}</td>
                <td style="text-align:right">${esc(MockFmt.baht(b.amount))}</td>
                <td class="td-sub">${esc(MockAdmin.userName(b.by))}</td>
            </tr>`).join('');
    },

    /* ══════════ Drawer ══════════ */

    openCause(code) {
        const c = MockRejects.causeOf(code); if (!c) return;
        const rows = MockRejects.all().filter(r => r.code === code).slice(0, 12);
        const rule = c.rule ? MockRules.byId(c.rule) : null;

        Drawer.open({
            title: `สาเหตุ ${code} — ${c.cause}`,
            contentHtml: `
                ${NHSO_ERR_TEXT[code] ? `
                <div class="ds-block" style="margin-bottom:12px;font-family:var(--font-mono);font-size:11px;line-height:1.7">
                    ${esc(NHSO_ERR_TEXT[code])}</div>` : ''}
                <table class="ds-table-grid">
                    <tbody>
                        <tr><td class="l" style="width:32%">ขั้นที่พบ</td><td class="l">${
                            esc((REJECT_GROUPS.find(g => g.key === c.group) || {}).label || '—')}</td></tr>
                        <tr><td class="l">หน่วยงานที่เกี่ยวข้อง</td><td class="l">${esc(c.dept)}</td></tr>
                        <tr><td class="l">จำนวนครั้ง</td><td class="l">${MockFmt.int(c.count)} ครั้ง</td></tr>
                        <tr><td class="l">มูลค่าที่เสียไป</td><td class="l"><strong>${esc(MockFmt.baht(c.amount))}</strong> บาท</td></tr>
                        <tr><td class="l">กฎที่ครอบคลุม</td><td class="l">${rule
                            ? `<a href="claim-rules.html?rule=${encodeURIComponent(rule.id)}">${esc(rule.id)} v${esc(rule.version)}</a>
                               — ${esc(rule.name)} ${MockTone.lifecycleHtml(rule.status)}`
                            : '<span class="sip-chip sip-chip-danger">ยังไม่มีกฎครอบคลุม</span>'}</td></tr>
                    </tbody>
                </table>

                <div class="ds-section-label">เคสตัวอย่างที่ถูกตีกลับด้วยสาเหตุนี้</div>
                <div class="table-responsive"><table class="data-table compact">
                    <thead><tr><th>รหัสตีกลับ</th><th>เคส</th><th style="width:1%;text-align:right">มูลค่า</th>
                        <th style="width:1%">อุทธรณ์</th><th style="width:1%">สถานะ</th></tr></thead>
                    <tbody>${rows.map(r => `<tr>
                        <td class="td-sub">${esc(r.id)}</td>
                        <td><a href="claim-case.html?id=${encodeURIComponent(r.claim_id)}">${esc(r.claim_id)}</a></td>
                        <td style="text-align:right">${esc(MockFmt.baht(r.amount))}</td>
                        <td>${r.appealed ? '<span class="sip-chip sip-chip-ack">ยื่นแล้ว</span>' : '<span class="td-sub">—</span>'}</td>
                        <td>${r.resolved ? '<span class="sip-chip sip-chip-success">ปิดแล้ว</span>'
                                         : '<span class="sip-chip sip-chip-amber">ค้าง</span>'}</td>
                    </tr>`).join('')}</tbody>
                </table></div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>
                ${!rule ? `<button class="btn btn-primary" onclick="Reject.openDraft('${esc(code)}')">
                    สร้างร่างกฎจากสาเหตุนี้</button>` : ''}`,
            onOpen: () => refreshIcons(),
        });
    },

    openDraftFromTop() {
        const un = MockRejects.uncovered();
        if (!un.length) { showToast('ทุกสาเหตุมีกฎครอบคลุมแล้ว', 'info'); return; }
        const top = un.slice().sort((a, b) => b.amount - a.amount)[0];
        this.openDraft(top.code);
    },

    /** ⭐ หัวใจของ Reject Feedback Loop */
    openDraft(code) {
        const c = MockRejects.causeOf(code); if (!c) return;

        const SUGGEST = {
            A210: { field: 'แฟ้ม 7 · ค่าห้องผู้ป่วยใน (BILLGRCS 02)', op: 'มากกว่า',
                    value: 'เกณฑ์ค่าห้องของกองทุนนั้น', action: 'APPROVE', doc: 'DOC-NHSO-2569-012' },
            P208: { field: 'วันที่รับบริการ', op: 'อยู่นอกช่วง',
                    value: 'ช่วงสิทธิที่ตรวจสอบได้', action: 'FIX', doc: 'DOC-NHSO-2569-015' },
            A144: { field: 'รายการที่เบิก', op: 'ไม่มีข้อบ่งชี้รองรับใน', value: 'แฟ้ม 5 (Diagnosis)',
                    action: 'APPROVE', doc: 'DOC-INT-2569-002' },
            C420: { field: 'รหัสหน่วยบริการต้นสังกัด (CUP)', op: 'ไม่ตรงกับ',
                    value: 'สิทธิที่ตรวจสอบได้ของผู้รับบริการ', action: 'FIX', doc: 'DOC-NHSO-2569-008' },
        };
        const s = SUGGEST[code] || { field: 'ฟิลด์ที่เกี่ยวข้อง', op: 'ไม่ผ่านเงื่อนไข',
                                      value: 'ตามประกาศที่เกี่ยวข้อง', action: 'FIX', doc: 'DOC-NHSO-2569-012' };

        Drawer.open({
            title: 'สร้างร่างกฎจากผลตีกลับ — ' + code,
            contentHtml: `
                <div class="sip-banner sip-banner-info" style="margin-bottom:14px">
                    <i data-lucide="repeat" class="icon-sm"></i>
                    <span>สาเหตุนี้ทำให้เสียมูลค่า <strong>${esc(MockFmt.baht(c.amount))} บาท</strong>
                    จาก ${esc(c.count)} ครั้ง — ถ้ามีกฎดักไว้ก่อนส่ง จะไม่เกิดซ้ำในงวดหน้า</span>
                </div>
                <div class="sip-field">
                    <label class="sip-label">ชื่อกฎ *</label>
                    <input class="sip-input" id="dName" value="${esc('ป้องกัน ' + code + ' — ' + c.cause)}">
                </div>
                <div class="sip-field-row">
                    <div class="sip-field">
                        <label class="sip-label">หมวด</label>
                        <select class="sip-select" id="dCat">
                            <option>ราคาและค่าใช้จ่าย</option><option>สิทธิและการปิดสิทธิ</option>
                            <option>Coding</option><option>ความครบของข้อมูล</option>
                            <option>เอกสาร</option><option>Clinical</option>
                        </select>
                    </div>
                    <div class="sip-field">
                        <label class="sip-label">ระดับผล</label>
                        <select class="sip-select" id="dAction">
                            <option value="WARN" ${s.action === 'WARN' ? 'selected' : ''}>แจ้งเตือน</option>
                            <option value="FIX" ${s.action === 'FIX' ? 'selected' : ''}>ต้องแก้ไข</option>
                            <option value="APPROVE" ${s.action === 'APPROVE' ? 'selected' : ''}>ต้องอนุมัติ</option>
                            <option value="BLOCK">ระงับส่ง</option>
                        </select>
                    </div>
                </div>

                <div class="ds-section-label">เงื่อนไขที่ระบบแนะนำจากสาเหตุนี้</div>
                <div class="ds-block" style="margin-bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    <span class="sip-chip sip-chip-muted">ถ้า</span>
                    <strong style="color:var(--brand-navy)">${esc(s.field)}</strong>
                    <span class="sip-chip sip-chip-amber">${esc(s.op)}</span>
                    <span>${esc(s.value)}</span>
                </div>

                <div class="sip-field">
                    <label class="sip-label">เอกสารอ้างอิง</label>
                    <select class="sip-select" id="dDoc">
                        ${MockKnowledgeDocsOptions(s.doc)}
                    </select>
                </div>
                <div class="sip-field">
                    <label class="sip-label">ผู้เขียนกฎ</label>
                    <input class="sip-input" value="${esc(MockSession.user().full_name)} (${esc(MockSession.roleLabel())})" disabled>
                </div>

                <div class="sip-banner sip-banner-warning">
                    <i data-lucide="alert-triangle" class="icon-sm"></i>
                    <span>ร่างนี้ยังไม่มีผลกับเคสใด ๆ — ต้องทดสอบย้อนหลังและได้รับอนุมัติจากผู้ที่ไม่ใช่ผู้เขียน
                    ก่อนจึงจะเปิดใช้ได้ (BR-05)</span>
                </div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                         <button class="btn btn-save" onclick="Reject.saveDraft('${esc(code)}')">
                             บันทึกเป็นร่างกฎ</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    saveDraft(code) {
        const c = MockRejects.causeOf(code);
        const name = document.getElementById('dName').value.trim();
        if (!name) { showToast('กรุณากรอกชื่อกฎ', 'warning'); return; }
        const action = document.getElementById('dAction').value;
        const docId  = document.getElementById('dDoc').value;

        const rule = {
            id: MockRules.nextDraftId('RUL-RJ'), name,
            category: document.getElementById('dCat').value,
            status: 'DRAFT', version: 1,
            author: MockSession.userId(), approver: null,
            funds: ['UC', 'OFC'], services: ['OPD', 'IPD'],
            effective_from: '2569-09-01', effective_to: null,
            severity: action === 'WARN' ? 'WARNING' : 'ERROR',
            action, maps_to_nhso: code,
            doc_id: docId, doc_ref: 'สร้างจากผลตีกลับ',
            desc: `สร้างจากการวิเคราะห์ผลตีกลับ — สาเหตุ ${code}: ${c.cause} `
                + `(${c.count} ครั้ง · ${MockFmt.baht(c.amount)} บาท)`,
            conditions: [{ join: '', field: 'เงื่อนไขที่แนะนำจากสาเหตุ ' + code, op: 'ตรวจสอบ', value: c.cause }],
            kpi: { hit: 0, true_issue: 0, override: 0, false_positive: 0, prevented: 0 },
        };
        MockDB.insert('rules', rule);

        Drawer.close();
        showToast(`สร้างร่างกฎ ${rule.id} แล้ว — ไปทดสอบและขออนุมัติที่คลังกฎ`);

        /* ให้ผู้ใช้เห็นผลลัพธ์ทันที ไม่ต้องเดาว่าไปโผล่ที่ไหน */
        setTimeout(() => {
            Drawer.open({
                title: 'สร้างร่างกฎสำเร็จ',
                contentHtml: `<div class="sip-banner sip-banner-success">
                        <i data-lucide="check-circle-2" class="icon-sm"></i>
                        <span>ร่างกฎ <strong>${esc(rule.id)}</strong> ถูกบันทึกในคลังกฎแล้ว
                        สถานะ "ร่าง"</span></div>
                    <div class="ds-note"><i data-lucide="arrow-right" class="icon-sm"></i>
                        ขั้นถัดไป: รันทดสอบย้อนหลัง → ส่งขออนุมัติ → ผู้อนุมัติ (ที่ไม่ใช่คุณ) กดเปิดใช้</div>`,
                footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>
                    <button class="btn btn-primary"
                        onclick="location.href='claim-rules.html?rule=${encodeURIComponent(rule.id)}'">
                        ไปที่คลังกฎ</button>`,
                onOpen: () => refreshIcons(),
            });
        }, 200);
    },

    openImport() {
        Drawer.open({
            title: 'นำเข้าไฟล์ผลตีกลับจาก สปสช.',
            contentHtml: `
                <div class="sip-field-row">
                    <div class="sip-field">
                        <label class="sip-label">งวด</label>
                        <select class="sip-select" id="iPeriod">
                            <option>ส.ค. 2569</option><option>ก.ค. 2569</option><option>มิ.ย. 2569</option>
                        </select>
                    </div>
                    <div class="sip-field">
                        <label class="sip-label">ประเภทไฟล์</label>
                        <select class="sip-select" id="iType">
                            <option>Transaction Report (Excel)</option>
                            <option>Statement Report (Excel)</option>
                            <option>ไฟล์ผลตอบกลับ (JSON)</option>
                        </select>
                    </div>
                </div>
                <div class="ds-block" style="margin-bottom:12px">
                    <i data-lucide="file-spreadsheet" class="icon-sm"></i>
                    เลือกไฟล์ — <span class="td-sub">โหมดต้นแบบ ยังไม่ผูกที่เก็บไฟล์จริง</span>
                </div>
                <div class="ds-section-label">ตัวอย่างการ Mapping คอลัมน์</div>
                <table class="ds-table-grid">
                    <thead><tr><th>คอลัมน์ในไฟล์</th><th>ฟิลด์ในระบบ</th></tr></thead>
                    <tbody>
                        <tr><td class="l">SEQ</td><td class="l">nhso.seq → เชื่อมกับเคส</td></tr>
                        <tr><td class="l">ERROR_CODE</td><td class="l">รหัสสาเหตุ (P124 / C305 / …)</td></tr>
                        <tr><td class="l">AMOUNT_CLAIM</td><td class="l">ยอดขอเบิก</td></tr>
                        <tr><td class="l">AMOUNT_PAID</td><td class="l">ยอดที่จ่ายจริง</td></tr>
                        <tr><td class="l">AMOUNT_DEDUCT</td><td class="l">ยอดที่ถูกตัด</td></tr>
                        <tr><td class="l">APPEAL_STATUS</td><td class="l">สถานะการอุทธรณ์</td></tr>
                    </tbody>
                </table>
                <div class="ds-note"><i data-lucide="info" class="icon-sm"></i>
                    ระบบจะจับคู่ทุกรายการกลับเข้าเคสเดิมด้วย SEQ แล้วเชื่อมกับกฎที่เคยตรวจ/ไม่ได้ตรวจในเคสนั้น</div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                         <button class="btn btn-primary" onclick="Drawer.close();showToast('นำเข้าไฟล์ผลตีกลับแล้ว (โหมดสาธิต)')">
                             นำเข้า</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    /* ══════════ ใบพิมพ์ ══════════ */

    buildReport() {
        const C = DocParts.CELL;
        const warnings = [];
        const rows = MockRejects.pareto();

        const th = (t, w) => `<th style="${C}font-size:11px;font-weight:700;text-align:center;`
                           + `${w ? 'width:' + w + ';' : ''}">${DocParts.esc(t)}</th>`;

        const body = rows.map((r, i) => `<tr>
            <td style="${C}text-align:center;">${i + 1}</td>
            <td style="${C}text-align:center;">${DocParts.esc(r.code)}</td>
            <td style="${C}">${DocParts.esc(r.cause)}</td>
            <td style="${C}">${DocParts.esc(r.dept)}</td>
            <td style="${C}text-align:right;">${DocParts.esc(r.count)}</td>
            <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(r.amount))}</td>
            <td style="${C}text-align:right;">${DocParts.esc(MockFmt.pct(r.cum, 0))}</td>
            <td style="${C}" class="${DocPrint.miss(r.rule, 'กฎที่ครอบคลุมสาเหตุ ' + r.code, warnings)}">
                ${DocParts.esc(r.rule || '')}</td>
        </tr>`).join('');

        const fields = [
            ['ขอบเขต', this.state.group === 'all' ? 'ทุกขั้นตอน'
                : (REJECT_GROUPS.find(g => g.key === this.state.group) || {}).label],
            ['จำนวนสาเหตุ', rows.length + ' สาเหตุ'],
            ['มูลค่ารวม', MockFmt.baht(MockRejects.totalAmount()) + ' บาท'],
            ['ผู้พิมพ์', MockSession.user().full_name],
        ];

        const html = `<div style="color:#000;font-size:12px;">
            ${DocParts.docHead({ title: 'รายงานวิเคราะห์สาเหตุการตีกลับ (Pareto)', formCode: 'RJ/2569', fields })}
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>${th('ที่', '30px')}${th('รหัส', '52px')}${th('สาเหตุ')}${th('หน่วยงาน', '20%')}
                    ${th('จำนวน', '48px')}${th('มูลค่า', '72px')}${th('% สะสม', '52px')}${th('กฎที่ครอบคลุม', '86px')}</tr></thead>
                <tbody>${DocParts.fillRows(body, 14, 8)}</tbody>
            </table>
            <div style="margin-top:10px;font-size:12px">
                สาเหตุที่ยังไม่มีกฎครอบคลุม <strong>${DocParts.esc(MockRejects.uncovered().length)}</strong> รายการ
                — เป็นรายการงานสำหรับผู้ดูแลกฎในรอบถัดไป
            </div>
            ${DocParts.signatureBlock(['ลงชื่อ ผู้วิเคราะห์', 'ลงชื่อ ผู้รับรอง'])}
            ${DocParts.footer(fields)}
        </div>`;

        return { html: DocParts.toPrintBorders(html), warnings };
    },

    openPrint() {
        const { html, warnings } = this.buildReport();
        DocPrint.preview({ title: 'ตัวอย่างก่อนพิมพ์ — รายงานวิเคราะห์การตีกลับ', html, warnings });
    },
};

/** ตัวเลือกเอกสารอ้างอิง — ใช้จาก drawer สร้างร่างกฎ */
function MockKnowledgeDocsOptions(selected) {
    /* หน้านี้ไม่ได้โหลด mock-knowledge.js จึงใช้รายการย่อที่พอสำหรับร่าง */
    const DOCS = [
        ['DOC-NHSO-2569-012', 'สปสช. 04/2569 — หลักเกณฑ์การเบิกค่ายา'],
        ['DOC-NHSO-2569-008', 'สปสช. 02/2569 — การตรวจสอบสิทธิและการปิดสิทธิ'],
        ['DOC-NHSO-2569-015', 'สปสช. 06/2569 — อุบัติเหตุและเจ็บป่วยฉุกเฉิน'],
        ['DOC-NHSO-2569-019', 'คู่มือ Coding 2569'],
        ['DOC-NHSO-2569-024', 'Standard Dataset v2569.2'],
        ['DOC-INT-2569-002',  'ระเบียบ รพ. 03/2569 — ยากลุ่มพิเศษ'],
    ];
    return DOCS.map(([id, label]) =>
        `<option value="${id}" ${id === selected ? 'selected' : ''}>${label}</option>`).join('');
}

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.Reject = Reject;
document.addEventListener('DOMContentLoaded', () => Reject.init());
