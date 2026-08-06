/* ────────────────────────────────────────────────────────
   ส่งเบิก NHSO — รายการส่งเบิก

   หน้านี้จงใจให้หน้าตาใกล้เคียงหน้าจอจริงของ NHSO Digital Platform
   เพื่อให้เจ้าหน้าที่ที่เคยใช้ระบบ สปสช. จำได้ทันที
   สิ่งที่เพิ่มเข้ามาคือคอลัมน์เดียว: "ตรวจก่อนส่ง (ระบบเรา)"
   ที่บอกล่วงหน้าว่าเคสนี้จะติดรหัสอะไร — คือทั้งหมดของข้อเสนอนี้
   ──────────────────────────────────────────────────────── */

const NhsoSubmit = {

    state: { stage: 'all', sub: 'all', selected: new Set() },

    init() {
        MockSession.mountBanner('demoBanner');

        const p = new URLSearchParams(location.search);
        if (p.get('stage')) this.state.stage = p.get('stage');

        this.fillFilters();
        this.renderStepper();
        this.render();
    },

    fillFilters() {
        const funds = [...new Set(MockNhso.cases().map(c => c.fund))].sort();
        document.getElementById('fFund').insertAdjacentHTML('beforeend',
            funds.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join(''));
    },

    /* ══════════ แถบขั้นตอน ══════════ */

    renderStepper() {
        const stats = MockNhso.stageStats();
        const curIdx = this.state.stage === 'all' ? -1 : MockNhso.stageIndex(this.state.stage);

        const all = `<span class="ds-step ${this.state.stage === 'all' ? 'active' : ''}"
            style="cursor:pointer" onclick="NhsoSubmit.setStage('all')">ทั้งหมด (${MockNhso.cases().length})</span>`;

        document.getElementById('stageStepper').innerHTML = all + stats.map((s, i) => {
            const cls = this.state.stage === s.key ? 'active' : (curIdx > -1 && i < curIdx ? 'completed' : '');
            return `<span class="ds-step ${cls}" style="cursor:pointer" onclick="NhsoSubmit.setStage('${esc(s.key)}')"
                       title="${esc(s.desc)} · ดำเนินการโดย ${esc(s.by)}">
                       ${esc(s.label)} <strong>(${s.count})</strong></span>`;
        }).join('');
        refreshIcons();
    },

    setStage(key) {
        this.state.stage = key;
        this.state.sub   = 'all';
        this.renderStepper();
        this.render();
    },

    setSub(label) { this.state.sub = label; this.render(); },

    renderSubBar() {
        const bar = document.getElementById('subBar');
        const st  = NHSO_STATUS_PIPELINE.find(s => s.key === this.state.stage);
        if (!st || st.sub.length < 2) { bar.innerHTML = ''; return; }

        const rows = MockNhso.byStage(st.key);
        bar.innerHTML = `<div class="ds-segbar">
            <button class="ds-seg ${this.state.sub === 'all' ? 'active' : ''}"
                onclick="NhsoSubmit.setSub('all')">ทั้งหมด (${rows.length})</button>
            ${st.sub.map(s => {
                const n = rows.filter(c => c.nhso.sub_status === s.label).length;
                return `<button class="ds-seg ${this.state.sub === s.label ? 'active' : ''}"
                    onclick="NhsoSubmit.setSub('${esc(s.label)}')">
                    ${s.code ? `<strong>${esc(s.code)}</strong> · ` : ''}${esc(s.label)} (${n})</button>`;
            }).join('')}
        </div>`;
    },

    /* ══════════ ตาราง ══════════ */

    visible() {
        const kw   = document.getElementById('searchBox').value.trim().toLowerCase();
        const fund = document.getElementById('fFund').value;
        const svc  = document.getElementById('fService').value;

        return MockNhso.cases().filter(c => {
            if (this.state.stage !== 'all' && c.nhso.stage !== this.state.stage) return false;
            if (this.state.sub   !== 'all' && c.nhso.sub_status !== this.state.sub) return false;
            if (fund !== 'all' && c.fund !== fund) return false;
            if (svc  !== 'all' && c.service_type !== svc) return false;
            if (kw && !(`${c.nhso.seq} ${c.hn} ${c.an || ''} ${c.patient} ${c.nhso.ref_no || ''}`)
                .toLowerCase().includes(kw)) return false;
            return true;
        });
    },

    render() {
        this.renderSubBar();
        const rows  = this.visible();
        const tbody = document.getElementById('rows');

        document.getElementById('stageTitle').textContent =
            this.state.stage === 'all' ? 'รายการทั้งหมด' : MockNhso.stageLabel(this.state.stage);

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="13" class="ds-empty">ไม่พบรายการในขั้นตอนนี้</td></tr>';
        } else {
            tbody.innerHTML = rows.map(c => {
                const n = c.nhso;
                const codes = MockClaims.predictedCodes(c);
                const errs  = (n.errors || []).map(e => e.code);

                /* คอลัมน์ชี้ขาด: ถ้า NHSO ตอบกลับมาแล้วให้โชว์ของจริง
                   ถ้ายังไม่ส่ง ให้โชว์สิ่งที่กฎเราทำนายไว้ */
                let pre;
                if (errs.length) {
                    pre = errs.map(k => `<span class="sip-chip sip-chip-danger">${esc(k)}</span>`).join(' ')
                        + '<div class="td-sub">สปสช. ตอบกลับแล้ว</div>';
                } else if (codes.length) {
                    pre = codes.map(k => `<span class="sip-chip sip-chip-danger" title="${esc(NHSO_ERR_TEXT[k] || '')}">คาดว่าจะติด ${esc(k)}</span>`).join(' ')
                        + '<div class="td-sub">ตรวจพบก่อนส่ง</div>';
                } else {
                    pre = '<span class="sip-chip sip-chip-success">พร้อมส่ง</span>';
                }

                return `<tr style="cursor:pointer" onclick="NhsoSubmit.open(${esc(n.seq)})">
                    <td onclick="event.stopPropagation()">
                        <input type="checkbox" ${this.state.selected.has(c.id) ? 'checked' : ''}
                               onclick="NhsoSubmit.toggle('${esc(c.id)}', this)"></td>
                    <td class="td-sub" style="white-space:nowrap">${esc(n.seq)}</td>
                    <td class="td-sub">${esc(c.hn)}</td>
                    <td class="td-sub">${esc(c.an || '—')}</td>
                    <td class="td-name">${esc(c.patient)}</td>
                    <td class="td-sub">${esc(c.provider)}</td>
                    <td class="td-sub" style="white-space:nowrap">${esc(MockFmt.dateTH(c.service_date))}</td>
                    <td class="td-sub">${esc(c.service_type === 'IPD' ? 'IP' : c.service_type === 'OPD' ? 'OP' : 'PP')}</td>
                    <td style="text-align:right;white-space:nowrap">${esc(MockFmt.baht(c.amount_claimed))}</td>
                    <td style="white-space:nowrap">
                        <span class="status-badge ${esc(MockNhso.stageBadge(n.stage))}">${
                            n.status_code ? esc(n.status_code) + ' · ' : ''}${esc(n.sub_status)}</span></td>
                    <td style="white-space:nowrap">${pre}</td>
                    <td class="td-sub" style="white-space:nowrap">${esc(n.ref_no || '—')}</td>
                    <td style="white-space:nowrap" onclick="event.stopPropagation()">
                        <button class="ds-icon-btn" title="เรียกดู" onclick="NhsoSubmit.open(${esc(n.seq)})">
                            <i data-lucide="eye" class="icon-sm"></i></button>
                        <button class="ds-icon-btn edit" title="ชี้แจงรายการก่อนส่งเบิก"
                            onclick="NhsoSubmit.openClarify('${esc(c.id)}')">
                            <i data-lucide="file-plus-2" class="icon-sm"></i></button>
                    </td>
                </tr>`;
            }).join('');
        }

        const all   = MockNhso.cases();
        const await_ = MockNhso.byStage('AWAIT_SUBMIT');
        const fix    = MockNhso.byStage('AWAIT_FIX');
        const pay    = MockNhso.byStage('AWAIT_PAY');
        const clean  = all.filter(c => !MockClaims.predictedCodes(c).length).length;

        document.getElementById('rowCount').textContent = rows.length + ' รายการ';
        document.getElementById('kpiAwait').textContent = MockFmt.int(await_.length);
        document.getElementById('kpiFix').textContent   = MockFmt.int(fix.length);
        document.getElementById('kpiPay').textContent   = MockFmt.baht(
            pay.reduce((a, c) => a + c.amount_claimed, 0), { short: true });
        document.getElementById('kpiPre').textContent   = all.length
            ? Math.round((clean / all.length) * 100) + '%' : '0%';

        refreshIcons();
    },

    toggle(id, el) { if (el.checked) this.state.selected.add(id); else this.state.selected.delete(id); },

    toggleAll(el) {
        const rows = this.visible();
        if (el.checked) rows.forEach(c => this.state.selected.add(c.id));
        else rows.forEach(c => this.state.selected.delete(c.id));
        this.render();
    },

    open(seq) { location.href = 'nhso-case.html?seq=' + encodeURIComponent(seq); },

    /* ══════════ Drawer A — ขั้นตอนการทำงาน (จำลอง popup ของ NHSO) ══════════ */

    openSteps() {
        const stats = MockNhso.stageStats();
        Drawer.open({
            title: 'ขั้นตอนการทำงาน',
            contentHtml: `
                <div class="ds-stepper" style="margin-bottom:16px">
                    ${stats.map(s => `<span class="ds-step">${esc(s.label)}</span>`).join('')}
                </div>
                ${stats.map(s => `
                    <div class="section-card" style="margin-bottom:10px">
                        <div class="section-header">
                            <div class="section-title" style="font-size:13px">
                                ${esc(s.label)}
                                <span class="ds-pane-count">${s.count} รายการ</span>
                            </div>
                            <div class="section-actions">
                                <span class="sip-chip ${s.by === 'สปสช.' ? 'sip-chip-ack' : 'sip-chip-active'}">
                                    ดำเนินการโดย ${esc(s.by)}</span>
                            </div>
                        </div>
                        <div class="td-sub" style="margin-bottom:8px">${esc(s.desc)}</div>
                        <div style="display:flex;flex-wrap:wrap;gap:6px">
                            ${s.sub.map(x => `<span class="sip-chip sip-chip-muted">${
                                x.code ? `<strong>${esc(x.code)}</strong> · ` : ''}${esc(x.label)}</span>`).join('')}
                        </div>
                    </div>`).join('')}

                <div class="ds-section-label" style="margin-top:14px">รหัสกิจกรรมในประวัติรายการ</div>
                <table class="ds-table-grid">
                    <thead><tr><th style="width:16%">รหัส</th><th style="width:28%">สถานะ</th><th>คำอธิบาย</th></tr></thead>
                    <tbody>${NHSO_ACTIVITY_CODES.map(a => `<tr>
                        <td class="c"><strong>${esc(a.code)}</strong></td>
                        <td class="l">${esc(a.label)}</td>
                        <td class="l" style="font-size:11px">${esc(a.desc)}</td>
                    </tr>`).join('')}</tbody>
                </table>

                <div class="ds-note">
                    <i data-lucide="info" class="icon-sm"></i>
                    ขั้นตอนและรหัสสถานะทั้งหมดอ้างอิงเอกสาร NHSO Digital Platform Communication (3 ส.ค. 2569)
                </div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    /* ══════════ Drawer B — ชี้แจงรายการก่อนส่งเบิก ══════════ */

    openClarify(id) {
        const c = MockClaims.byId(id); if (!c) return;
        Drawer.open({
            title: 'ชี้แจงรายการก่อนส่งเบิก — SEQ ' + c.nhso.seq,
            contentHtml: `
                <table class="ds-table-grid">
                    <tbody>
                        <tr><td class="l" style="width:32%">ผู้รับบริการ</td><td class="l">${esc(c.patient)} · HN ${esc(c.hn)}</td></tr>
                        <tr><td class="l">วันที่รับบริการ</td><td class="l">${esc(MockFmt.dateTH(c.service_date))}</td></tr>
                        <tr><td class="l">สถานะรายการ</td><td class="l">${
                            c.nhso.status_code ? esc(c.nhso.status_code) + ' — ' : ''}${esc(c.nhso.sub_status)}</td></tr>
                    </tbody>
                </table>

                <label class="sip-checkbox" style="margin:12px 0">
                    <input type="checkbox" id="clChk" onchange="NhsoSubmit.toggleClarify(this)">
                    ต้องการแนบเอกสารชี้แจงรายการก่อนส่งเบิก
                </label>

                <div id="clBody" style="display:none">
                    <div class="sip-field">
                        <label class="sip-label">ประเภทเอกสารชี้แจง</label>
                        <select class="sip-select" id="clType">
                            <option>หนังสือชี้แจงเหตุผลการเบิก</option>
                            <option>ความเห็นแพทย์ผู้รักษา</option>
                            <option>เอกสารรับรองราคา / ใบเสนอราคา</option>
                            <option>เอกสารยืนยันสิทธิ</option>
                        </select>
                    </div>
                    <div class="sip-field">
                        <label class="sip-label">ไฟล์แนบ</label>
                        <div class="ds-block"><i data-lucide="paperclip" class="icon-sm"></i>
                            เลือกไฟล์ (PDF / JPG ไม่เกิน 10 MB) — <span class="td-sub">โหมดต้นแบบ ยังไม่ผูกที่เก็บไฟล์จริง</span></div>
                    </div>
                    <div class="sip-field">
                        <label class="sip-label">คำชี้แจง</label>
                        <textarea class="sip-textarea" id="clNote" rows="4"
                            placeholder="อธิบายเหตุผลประกอบการเบิกให้เจ้าหน้าที่ สปสช. พิจารณา..."></textarea>
                    </div>
                </div>

                <div class="ds-note">
                    <i data-lucide="info" class="icon-sm"></i>
                    การแนบเอกสารชี้แจงตั้งแต่ก่อนส่ง ช่วยลดรอบ "ขอเอกสารเพิ่มเติม" ในขั้นตรวจสอบก่อนจ่าย
                </div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                         <button class="btn btn-save" onclick="NhsoSubmit.saveClarify('${esc(id)}')">บันทึกคำชี้แจง</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    toggleClarify(el) { document.getElementById('clBody').style.display = el.checked ? '' : 'none'; },

    saveClarify(id) {
        const on = document.getElementById('clChk').checked;
        if (!on) { showToast('ยังไม่ได้เลือกแนบเอกสารชี้แจง', 'warning'); return; }
        const type = document.getElementById('clType').value;
        const note = document.getElementById('clNote').value.trim();
        if (!note) { showToast('กรุณากรอกคำชี้แจง', 'warning'); return; }

        const c = MockClaims.byId(id);
        MockDB.patch('claims', id, {
            documents: [...(c.documents || []), {
                name: type, type: 'ชี้แจง', status: 'FOUND',
                by: MockSession.user().full_name, date: '2569-08-06' }],
            timeline: [...(c.timeline || []), {
                at: '2569-08-06T09:00', tone: 'info', title: 'แนบเอกสารชี้แจงรายการก่อนส่งเบิก',
                by: MockSession.user().full_name, note: `${type} · ${note}` }],
        });
        Drawer.close();
        showToast('บันทึกคำชี้แจงแล้ว');
        this.render();
    },

    /* ══════════ ส่งเบิก ══════════ */

    async submitSelected() {
        const ids = [...this.state.selected];
        if (!ids.length) { showToast('ยังไม่ได้เลือกรายการ', 'warning'); return; }

        const rows    = ids.map(i => MockClaims.byId(i)).filter(Boolean);
        const notReady = rows.filter(c => c.nhso.stage !== 'AWAIT_SUBMIT' && c.nhso.stage !== 'AWAIT_FIX');
        if (notReady.length) {
            showToast(`มี ${notReady.length} รายการที่อยู่ระหว่างดำเนินการฝั่ง สปสช. แล้ว`, 'warning');
            return;
        }

        const risky = rows.filter(c => MockClaims.predictedCodes(c).length);
        if (risky.length) {
            Drawer.open({
                title: 'ยังไม่ควรส่ง — ระบบคาดว่าจะถูกตีกลับ',
                contentHtml: `
                    <div class="sip-banner sip-banner-danger">
                        <i data-lucide="x-circle" class="icon-sm"></i>
                        มี ${risky.length} รายการที่กฎตรวจพบประเด็นค้าง ถ้าส่งไปตอนนี้จะได้รหัสข้อผิดพลาดกลับมา
                        และต้องเสียเวลาอีกหนึ่งรอบส่ง
                    </div>
                    <table class="data-table compact"><thead><tr>
                        <th>SEQ</th><th>ผู้ป่วย</th><th>รหัสที่คาดว่าจะติด</th><th>มูลค่าเสี่ยง</th><th>ผู้รับผิดชอบ</th>
                    </tr></thead><tbody>${risky.map(c => `<tr>
                        <td class="td-sub">${esc(c.nhso.seq)}</td>
                        <td>${esc(c.patient)}</td>
                        <td>${MockClaims.predictedCodes(c).map(k =>
                            `<span class="sip-chip sip-chip-danger">${esc(k)}</span>`).join(' ')}</td>
                        <td style="text-align:right">${esc(MockFmt.baht(c.amount_at_risk))}</td>
                        <td class="td-sub">${esc(MockAdmin.userName(c.owner))}</td>
                    </tr>`).join('')}</tbody></table>
                    <div class="ds-note"><i data-lucide="shield-check" class="icon-sm"></i>
                        นี่คือรอบที่ระบบตัดออกไปจากวงจรเดิม — แก้ให้จบก่อน แล้วส่งครั้งเดียวผ่าน</div>`,
                footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>
                             <button class="btn btn-navy" onclick="Drawer.close();location.href='claim-worklist.html?result=FIX'">
                                 ไปที่คิวแก้ไข</button>`,
                onOpen: () => refreshIcons(),
            });
            return;
        }

        const ok = await Drawer.confirm({
            title: `ส่งเบิก ${rows.length} รายการไปยัง สปสช.?`,
            message: 'ระบบจะสร้างไฟล์ตาม Standard Dataset แล้วส่งผ่าน API — สถานะจะเปลี่ยนเป็น "รอประมวลผล"',
            lines: rows.slice(0, 6).map(c => `SEQ ${c.nhso.seq} · ${c.patient} · ${MockFmt.baht(c.amount_claimed)} บาท`),
            confirmText: 'ส่งเบิก', danger: false,
        });
        if (!ok) return;

        const upload = 'A6908' + String(700000 + rows.length * 13);
        rows.forEach(c => MockDB.patch('claims', c.id, {
            nhso: { ...c.nhso, stage: 'AWAIT_PROCESS', status_code: null, sub_status: 'รอประมวลผล',
                    upload_id: upload, ref_no: c.nhso.ref_no || 'E6908' + String(10000000 + c.nhso.seq),
                    errors: [],
                    history: [...(c.nhso.history || []),
                        { at: '2569-08-06T09:00', code: 'F000', status: 'กำลังนำเข้าไฟล์',
                          act: `อัปโหลดไฟล์ ประกอบด้วย ${upload}.json`, by: c.provider },
                        { at: '2569-08-06T09:05', code: 'F001', status: 'กำลังตรวจสอบขั้นต้น',
                          act: 'กำลังนำไฟล์มาตรวจสอบความเชื่อมโยง / ตรวจสอบเงื่อนไขความสมบูรณ์และเงื่อนไขตามประกาศ', by: 'NHSO' }] },
            timeline: [...(c.timeline || []), { at: '2569-08-06T09:00', tone: 'info',
                title: 'ส่งเบิกไปยัง NHSO', by: MockSession.user().full_name, note: 'UploadID ' + upload }],
        }));

        this.state.selected.clear();
        showToast(`ส่งเบิก ${rows.length} รายการแล้ว · UploadID ${upload}`);
        this.renderStepper();
        this.render();
    },

    /* ══════════ Business Journey ══════════ */

    toggleJourney() {
        const body = document.getElementById('journeyBody');
        const btn  = document.getElementById('journeyBtn');
        const show = body.style.display === 'none';
        body.style.display = show ? '' : 'none';
        btn.innerHTML = show
            ? '<i data-lucide="chevron-up" class="icon-sm"></i> ซ่อน'
            : '<i data-lucide="chevron-down" class="icon-sm"></i> แสดง';
        if (show && !body.dataset.done) { body.innerHTML = this.journeyHtml(); body.dataset.done = '1'; }
        refreshIcons();
    },

    TONE: {
        navy:  { bg: 'var(--brand-navy)',       fg: '#fff' },
        blue:  { bg: 'var(--primary-bg)',       fg: 'var(--primary-dark)' },
        green: { bg: 'var(--status-success-soft)', fg: 'var(--status-success-strong)' },
        amber: { bg: 'var(--brand-amber-100)',  fg: 'var(--brand-amber-600)' },
    },

    journeyHtml() {
        return NHSO_JOURNEY.map(lane => {
            const t = this.TONE[lane.tone] || this.TONE.blue;
            const steps = lane.steps.map(s => `
                <div style="flex:0 0 auto;min-width:130px;max-width:190px;padding:10px 12px;border-radius:10px;
                     background:${t.bg};color:${t.fg};border:1px solid var(--brand-border);
                     ${s.strong ? 'box-shadow:var(--sip-shadow-2);font-weight:700;' : ''}">
                    <div style="font-size:12px;font-weight:700">${esc(s.label)}</div>
                    ${s.sub ? `<div style="font-size:10px;opacity:.8;margin-top:2px">${esc(s.sub)}</div>` : ''}
                </div>`).join('<div style="align-self:center;color:var(--brand-border-strong)">→</div>');

            const pass = lane.pass ? `
                <div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px">
                    <span class="sip-chip sip-chip-success">✓ ผ่าน</span>
                    <span>${esc(lane.pass)}</span>
                </div>` : '';
            const fail = lane.fail ? `
                <div style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px;flex-wrap:wrap">
                    <span class="sip-chip sip-chip-danger">✕ ไม่ผ่าน</span>
                    <span class="sip-chip sip-chip-amber">Error</span>
                    ${lane.fail.map(f => `<span>${esc(f)}</span>`).join('<span style="color:var(--brand-border-strong)">→</span>')}
                </div>` : '';

            return `<div style="padding:14px 0;border-bottom:1px solid var(--brand-border)">
                <div class="ds-section-label" style="margin-bottom:8px">${esc(lane.lane)}</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:stretch">${steps}</div>
                ${pass}${fail}
            </div>`;
        }).join('') + `
        <div class="ds-note" style="margin-top:12px">
            <i data-lucide="lightbulb" class="icon-sm"></i>
            สังเกตวงจร "Error → ตรวจสอบหน้าจอ NHSO → หน่วยบริการแก้ไขที่ HIS → ส่งใหม่"
            — <strong>ระบบเราตัดวงจรนี้ทิ้ง</strong> ด้วยการรันกฎชุดเดียวกันตั้งแต่ก่อนกดส่ง
        </div>`;
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.NhsoSubmit = NhsoSubmit;
document.addEventListener('DOMContentLoaded', () => NhsoSubmit.init());
