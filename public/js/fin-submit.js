/* ────────────────────────────────────────────────────────
   บันทึกส่ง — ตั้งยอดพึงรับรายเคส

   ลำดับงานที่หน้านี้บังคับ (ตรงกับ src/routes/finance.js):
     1. ตั้งหัวชุด    งวด × สิทธิ × กองทุน + วันที่ส่งเบิก (= วันเริ่มนับอายุหนี้)
     2. เลือกเคส      จากเคสที่ "ยังไม่เคยถูกตั้งหนี้" เท่านั้น (API กรองมาให้แล้ว)
     3. ยืนยัน        ชุดกลายเป็นยอดพึงรับ เข้าทะเบียนลูกหนี้ และเริ่มนับอายุหนี้

   ⚠️ ยอดพึงรับต่อเคสมาจากผลรวมค่ารักษาที่บันทึกไว้ (ipd_charges) ไม่ให้พิมพ์ทับ
      ถ้าต้องแก้ ให้ใช้ "ปรับปรุงยอด" ที่หน้าทะเบียนลูกหนี้ซึ่งบังคับใส่เหตุผท
      และลง audit_log — การแก้ยอดตั้งหนี้เงียบ ๆ ทำให้กระทบยอดกับ HIS ไม่ได้

   ⚠️ วันที่ส่งเบิกคือฐานนับอายุหนี้ ไม่ใช่วันที่กดบันทึก — ถ้าส่งไปเมื่อวาน
      ต้องใส่วันเมื่อวาน ไม่งั้นอายุหนี้จะน้อยกว่าจริงและงานติดตามจะสายไปเรื่อย ๆ
   ──────────────────────────────────────────────────────── */

const FinSubmit = {

    /** หัวชุดที่กำลังกรอก + เคสที่เลือกไว้ (เก็บใน state ไม่ใช่ DOM เพื่อคิดยอดสดได้) */
    draft: {
        period_key: '', payer: 'UC', fund_key: '', sent_date: '', sent_ref: '', note: '',
        picked: new Set(),
    },
    cands: [], batches: [],

    /* ══════════ วงจรชีวิต ══════════ */

    async init() {
        MockSession.mountBanner('demoBanner');
        await FinData.probe();

        // ค่าเริ่มต้น: งวดล่าสุด + วันนี้
        this.draft.period_key = AR_PERIODS[AR_PERIODS.length - 1].key;
        this.draft.fund_key = AR_FUND_OPTIONS[this.draft.payer][0];
        this.draft.sent_date = new Date().toISOString().slice(0, 10);

        this.renderSource();
        this.renderHead();
        this.renderPickFilters();
        await this.reload();
    },

    renderSource() {
        document.getElementById('sourceNote').innerHTML = FinData.live
            ? `<div class="sip-mock-note" style="border-color:var(--status-success-border);
                    background:var(--status-success-bg)">
                 <span class="sip-mock-tag" style="background:var(--status-success-strong)">ข้อมูลจริง</span>
                 <span>เคสที่แสดงคือผู้ป่วยในจริงในระบบที่ยังไม่เคยถูกตั้งเป็นลูกหนี้ ·
                       ยืนยันชุดแล้วเข้าทะเบียนลูกหนี้ทันที</span>
               </div>`
            : `<div class="sip-mock-note">
                 <span class="sip-mock-tag">MOCKUP</span>
                 <span>โหมดต้นแบบ — ดูขั้นตอนได้ แต่สร้างชุดส่งจริงไม่ได้
                       (ต้องเข้าสู่ระบบด้วยสิทธิ์การเงินและมีเซิร์ฟเวอร์)</span>
               </div>`;
    },

    async reload() {
        const [cands, batches] = await Promise.all([
            FinData.candidates({ payer: this.draft.payer, search: this._search() }),
            FinData.batches({ limit: 100 }),
        ]);
        this.cands = cands;
        this.batches = batches;

        // เคสที่เลือกไว้แต่หลุดจากรายการ (เปลี่ยนสิทธิ/ค้นหา) ต้องเอาออกจากชุด
        // ไม่งั้นจะยืนยันชุดที่มีเคสซึ่งผู้ใช้มองไม่เห็นแล้ว
        const ids = new Set(cands.map(c => c.admission_id));
        [...this.draft.picked].forEach(id => { if (!ids.has(id)) this.draft.picked.delete(id); });

        document.getElementById('asOf').textContent =
            `${AR_PAYER_LABEL[this.draft.payer]} · เคสที่ยังไม่ได้ตั้งหนี้ ${MockFmt.int(cands.length)} ราย`;

        this.renderSteps();
        this.renderCands();
        this.renderConfirm();
        this.renderBatches();
        refreshIcons();
    },

    _search() { return (document.getElementById('cSearch') || {}).value || ''; },

    /* ══════════ แถบลำดับขั้น ══════════ */

    renderSteps() {
        const d = this.draft;
        const done1 = !!(d.period_key && d.payer && d.fund_key && d.sent_date);
        const done2 = d.picked.size > 0;

        const step = (n, label, ok, active) => `
            <div style="flex:1;min-width:180px;padding:10px 12px;border-radius:8px;
                 border:1px solid ${ok ? 'var(--status-success-border)' : 'var(--brand-border)'};
                 background:${ok ? 'var(--status-success-bg)' : (active ? 'var(--brand-amber-50)' : 'var(--surface-1)')}">
                <div style="display:flex;align-items:center;gap:6px;font-weight:700">
                    <i data-lucide="${ok ? 'check-circle' : 'circle'}" class="icon-sm"></i>
                    <span>ขั้น ${n}</span>
                </div>
                <div class="ds-hint" style="margin-top:2px">${esc(label)}</div>
            </div>`;

        document.getElementById('stepBar').innerHTML =
            `<div style="display:flex;gap:10px;flex-wrap:wrap">
                ${step(1, done1 ? 'หัวชุดครบแล้ว' : 'กรอกงวด สิทธิ กองทุน และวันที่ส่ง', done1, !done1)}
                ${step(2, done2 ? `เลือกไว้ ${MockFmt.int(d.picked.size)} เคส` : 'ยังไม่ได้เลือกเคส', done2, done1 && !done2)}
                ${step(3, done1 && done2 ? 'พร้อมยืนยัน' : 'ทำขั้น 1–2 ให้ครบก่อน', false, done1 && done2)}
            </div>`;
    },

    /* ══════════ ขั้น 1 — หัวชุด ══════════ */

    renderHead() {
        const d = this.draft;
        const periods = AR_PERIODS.map(p =>
            `<option value="${esc(p.key)}"${p.key === d.period_key ? ' selected' : ''}>
                งวด ${esc(p.label)} (${esc(p.key)})</option>`).join('');
        const payers = Object.entries(AR_PAYER_LABEL).map(([k, v]) =>
            `<option value="${esc(k)}"${k === d.payer ? ' selected' : ''}>${esc(v)}</option>`).join('');

        document.getElementById('headForm').innerHTML = `
            <div class="sip-field-row">
                <div class="sip-field">
                    <label class="ds-section-label">งวดที่ส่งเบิก</label>
                    <select class="sip-select" id="hPeriod" style="width:100%"
                            onchange="FinSubmit.setHead('period_key', this.value)">${periods}</select>
                </div>
                <div class="sip-field">
                    <label class="ds-section-label">สิทธิผู้ป่วย</label>
                    <select class="sip-select" id="hPayer" style="width:100%"
                            onchange="FinSubmit.setPayer(this.value)">${payers}</select>
                </div>
                <div class="sip-field">
                    <label class="ds-section-label">กองทุนที่ตั้งเบิก</label>
                    <select class="sip-select" id="hFund" style="width:100%"
                            onchange="FinSubmit.setHead('fund_key', this.value)">${this._fundOptions()}</select>
                </div>
            </div>
            <div class="sip-field-row">
                <div class="sip-field">
                    <label class="ds-section-label">วันที่ส่งเบิก (ฐานนับอายุหนี้)</label>
                    <input type="date" class="sip-input" id="hSent" style="width:100%"
                           value="${esc(d.sent_date)}"
                           onchange="FinSubmit.setHead('sent_date', this.value)">
                    <!-- ช่อง <input type=date> แสดงตามภาษาของเบราว์เซอร์ (อาจเป็น MM/DD/YYYY
                         และเป็น ค.ศ. เสมอ) — ทวนเป็น พ.ศ. ให้อ่านชัดว่าเลือกวันไหนจริง -->
                    <div class="ds-hint" id="hSentBE">${esc(this._sentBEText(d.sent_date))}</div>
                </div>
                <div class="sip-field">
                    <label class="ds-section-label">เลขอ้างอิงที่ได้ตอนส่ง (ถ้ามี)</label>
                    <input class="sip-input" id="hRef" style="width:100%" value="${esc(d.sent_ref)}"
                           placeholder="เลขรับของ สปสช. / REP"
                           oninput="FinSubmit.setHead('sent_ref', this.value)">
                </div>
            </div>
            <div class="ds-note" style="display:block">
                วันที่ส่งเบิกคือวันที่ส่งข้อมูลออกไปจริง <b>ไม่ใช่วันที่กดบันทึก</b> —
                อายุหนี้ทั้งหมดนับจากวันนี้ ถ้าใส่ผิด งานติดตามหนี้จะสายไปเรื่อย ๆ
            </div>`;
    },

    _fundOptions() {
        const opts = AR_FUND_OPTIONS[this.draft.payer] || [];
        return opts.map(k =>
            `<option value="${esc(k)}"${k === this.draft.fund_key ? ' selected' : ''}>
                ${esc(AR_FUND_LABEL[k] || k)}</option>`).join('');
    },

    /** ข้อความทวนวันที่ส่งเบิกเป็น พ.ศ. */
    _sentBEText(iso) {
        if (!iso) return 'ยังไม่ได้เลือกวันที่';
        return 'ตรงกับ ' + MockFmt.dateTH(this._be(iso));
    },

    setHead(field, value) {
        this.draft[field] = value;
        if (field === 'sent_date') {
            const el = document.getElementById('hSentBE');
            if (el) el.textContent = this._sentBEText(value);
        }
        this.renderSteps();
        this.renderConfirm();
        refreshIcons();
    },

    /** เปลี่ยนสิทธิ = เปลี่ยนทั้งรายการกองทุนและรายการเคส ต้องล้างที่เลือกไว้ */
    setPayer(payer) {
        this.draft.payer = payer;
        this.draft.fund_key = (AR_FUND_OPTIONS[payer] || [])[0] || '';
        this.draft.picked.clear();
        document.getElementById('hFund').innerHTML = this._fundOptions();
        this.reload();
    },

    /* ══════════ ขั้น 2 — เลือกเคส ══════════ */

    renderPickFilters() {
        document.getElementById('pickFilters').innerHTML = `
            <input class="sip-input" id="cSearch" style="width:280px"
                   placeholder="ค้นหา AN / HN / ชื่อผู้ป่วย" oninput="FinSubmit.searchLater()">
            <button class="btn btn-outline btn-sm" onclick="FinSubmit.pickAll(true)">
                <i data-lucide="check-square" class="icon-sm"></i> เลือกทั้งหมดที่แสดง</button>
            <button class="btn btn-outline btn-sm" onclick="FinSubmit.pickAll(false)">
                <i data-lucide="square" class="icon-sm"></i> ล้างที่เลือก</button>`;
    },

    searchLater() {
        clearTimeout(this._t);
        this._t = setTimeout(() => this.reload(), 300);
    },

    pickAll(on) {
        if (on) this.cands.forEach(c => this.draft.picked.add(c.admission_id));
        else this.draft.picked.clear();
        this.renderSteps(); this.renderCands(); this.renderConfirm(); refreshIcons();
    },

    toggle(id) {
        const s = this.draft.picked;
        if (s.has(id)) s.delete(id); else s.add(id);
        this.renderSteps(); this.renderCands(); this.renderConfirm(); refreshIcons();
    },

    renderCands() {
        const head = `<thead><tr>
            <th style="width:38px"></th>
            <th style="width:90px">AN</th>
            <th style="width:90px">HN</th>
            <th style="min-width:170px">ผู้ป่วย</th>
            <th style="width:100px">วันจำหน่าย</th>
            <th style="width:90px">สิทธิ</th>
            <th style="width:80px">DRG</th>
            <th class="num" style="width:120px">ยอดพึงรับ</th>
            <th style="width:130px">การลงรหัส</th>
        </tr></thead>`;

        if (!this.cands.length) {
            document.getElementById('candTable').innerHTML = head
                + `<tbody><tr><td colspan="9" class="c" style="padding:26px">
                     <span class="td-sub">ไม่มีเคสของสิทธินี้ที่ยังไม่ได้ตั้งหนี้ —
                     ตั้งหนี้ครบแล้ว หรือยังไม่มีการบันทึกค่ารักษา</span></td></tr></tbody>`;
            document.getElementById('pickNote').textContent = 'ไม่พบเคส';
            return;
        }

        const body = this.cands.map(c => {
            const on = this.draft.picked.has(c.admission_id);
            // เคสที่ยังไม่ยืนยันการลงรหัสตั้งหนี้ได้ แต่ต้องเตือน — ยอดอาจเปลี่ยนหลังโค้ดเดอร์แก้
            const draftCoding = c.coding_status !== 'CONFIRMED';
            return `<tr${on ? ' style="background:var(--brand-amber-50)"' : ''}>
                <td class="c"><input type="checkbox" class="sip-checkbox"
                    ${on ? 'checked' : ''} onchange="FinSubmit.toggle(${esc(c.admission_id)})"></td>
                <td class="l"><b>${esc(c.an)}</b></td>
                <td class="l">${esc(c.hn || '—')}</td>
                <td class="l">${esc(c.patient_name || '—')}</td>
                <td class="c">${esc(c.service_date ? MockFmt.dateTH(c.service_date) : '—')}</td>
                <td class="c">${esc(c.payer || '—')}</td>
                <td class="c">${esc(c.drg_code || '—')}</td>
                <td class="num"><span class="ds-amt ds-amt-billed">${esc(MockFmt.baht(c.billed_amt))}</span></td>
                <td class="c">${draftCoding
                    ? '<span class="kbadge kbadge-pending">ยังไม่ยืนยัน</span>'
                    : '<span class="kbadge kbadge-done">ยืนยันแล้ว</span>'}</td>
            </tr>`;
        }).join('');

        document.getElementById('candTable').innerHTML = head + `<tbody>${body}</tbody>`;
        document.getElementById('pickNote').innerHTML =
            `แสดง ${MockFmt.int(this.cands.length)} เคส · เลือกไว้ `
            + `<b>${MockFmt.int(this.draft.picked.size)}</b> เคส`;
    },

    /* ══════════ ขั้น 3 — ยืนยัน ══════════ */

    _pickedRows() { return this.cands.filter(c => this.draft.picked.has(c.admission_id)); }, // eslint-disable-line

    renderConfirm() {
        const d = this.draft;
        const rows = this._pickedRows();
        const total = rows.reduce((a, c) => a + Number(c.billed_amt), 0);
        const draftCoding = rows.filter(c => c.coding_status !== 'CONFIRMED').length;
        const ready = d.period_key && d.payer && d.fund_key && d.sent_date && rows.length > 0;

        const kv = (k, v) => `<div style="display:flex;justify-content:space-between;gap:12px;
            padding:5px 0;border-bottom:1px dashed var(--border-subtle)">
            <span class="ds-hint">${esc(k)}</span><span>${v}</span></div>`;

        document.getElementById('confirmPane').innerHTML = `
            <div style="margin-bottom:12px">
                ${kv('งวด', esc(d.period_key || '—'))}
                ${kv('สิทธิ / กองทุน', esc(AR_PAYER_LABEL[d.payer] || d.payer) + ' · '
                     + esc(AR_FUND_LABEL[d.fund_key] || d.fund_key || '—'))}
                ${kv('วันที่ส่งเบิก', d.sent_date ? esc(MockFmt.dateTH(FinSubmit._be(d.sent_date))) : '—')}
                ${kv('จำนวนเคส', '<b>' + esc(MockFmt.int(rows.length)) + '</b> ราย')}
                ${kv('ยอดพึงรับรวม', '<b>' + esc(MockFmt.baht(total)) + '</b> บาท')}
            </div>

            ${draftCoding ? `<div class="ds-warn" style="display:block">
                มี ${MockFmt.int(draftCoding)} เคสที่ <b>ยังไม่ยืนยันการลงรหัส</b> —
                ตั้งหนี้ได้ แต่ถ้าโค้ดเดอร์แก้ค่ารักษาทีหลัง ยอดพึงรับจะไม่ตรงกับ HIS
                ต้องแก้ผ่าน "ปรับปรุงยอด" ที่หน้าทะเบียนลูกหนี้
            </div>` : ''}

            <div class="ds-note" style="display:block">
                ${rows.length
                    ? `ยืนยันแล้ว: เคสทั้ง <b>${MockFmt.int(rows.length)} ราย</b> เข้าทะเบียนลูกหนี้ทันที ·
                       เริ่มนับอายุหนี้จากวันที่ส่งเบิก · <b>แก้รายการในชุดไม่ได้อีก</b>
                       (ปรับยอดรายเคสได้ผ่านการปรับปรุงยอดซึ่งมีเหตุผลกำกับ)`
                    : 'เลือกเคสในขั้น 2 ก่อน แล้วสรุปยอดที่จะตั้งเป็นลูกหนี้จะขึ้นที่นี่'}
            </div>

            <div class="section-actions" style="margin-top:12px">
                <button class="btn btn-outline btn-sm" onclick="FinSubmit.saveDraft()"
                        ${ready ? '' : 'disabled'}>
                    <i data-lucide="save" class="icon-sm"></i> บันทึกเป็นร่าง (ยังไม่ตั้งหนี้)</button>
                <button class="btn btn-primary btn-sm" onclick="FinSubmit.submitAndConfirm()"
                        ${ready ? '' : 'disabled'}
                        title="${ready ? '' : 'ต้องกรอกหัวชุดให้ครบและเลือกเคสอย่างน้อย 1 ราย'}">
                    <i data-lucide="check" class="icon-sm"></i> สร้างชุดและยืนยันตั้งยอดพึงรับ</button>
            </div>`;
    },

    /** ค.ศ. → พ.ศ. (ช่อง <input type=date> เป็น ค.ศ. เสมอ · MockFmt ต้องการ พ.ศ.) */
    _be(d) {
        if (!d || !/^\d{4}-/.test(d)) return d;
        return (parseInt(d.slice(0, 4), 10) + 543) + d.slice(4);
    },

    /** payload ของชุด — ใช้ทั้งบันทึกร่างและยืนยัน จึงสร้างที่เดียว */
    _payload() {
        const d = this.draft;
        return {
            period_key: d.period_key, payer: d.payer, fund_key: d.fund_key,
            sent_date: d.sent_date, sent_ref: d.sent_ref || null,
            channel: 'e-Claim', note: d.note || null,
            items: this._pickedRows().map(c => ({
                case_ref: 'AN-' + c.an, hn: c.hn, an: c.an,
                patient_name: c.patient_name, service_date: c.service_date,
                service_type: 'IPD', billed_amt: Number(c.billed_amt),
                admission_id: c.admission_id,
                note: 'ยอดพึงรับจากค่ารักษาที่บันทึกไว้ในระบบผู้ป่วยใน',
            })),
        };
    },

    async saveDraft() {
        try {
            const r = await FinData.createBatch(this._payload());
            DSToast.success(`บันทึกร่าง ${r.batch_no} แล้ว — ยังไม่ถือเป็นหนี้จนกดยืนยัน`);
            this.draft.picked.clear();
            await this.reload();
        } catch (e) {
            DSToast.error(e.message);
        }
    },

    async submitAndConfirm() {
        const rows = this._pickedRows();
        const total = rows.reduce((a, c) => a + Number(c.billed_amt), 0);

        const ok = await Drawer.confirm({
            title: 'ยืนยันตั้งยอดพึงรับ?',
            message: 'เคสทั้งชุดจะเข้าทะเบียนลูกหนี้และเริ่มนับอายุหนี้ทันที แก้รายการในชุดไม่ได้อีก',
            lines: [
                `${AR_PAYER_LABEL[this.draft.payer]} · ${AR_FUND_LABEL[this.draft.fund_key] || this.draft.fund_key}`,
                `งวด ${this.draft.period_key} · ส่งเบิก ${MockFmt.dateTH(this._be(this.draft.sent_date))}`,
                `${rows.length} เคส · รวม ${MockFmt.baht(total)} บาท`,
            ],
            confirmText: 'ยืนยันตั้งหนี้',
            danger: false,
        });
        if (!ok) return;

        try {
            // สร้างชุดพร้อมรายการในครั้งเดียว แล้วยืนยันต่อ — ถ้ายืนยันพลาด ชุดยังเป็นร่างอยู่
            // ให้ผู้ใช้กดยืนยันจากตารางด้านล่างได้ ไม่ต้องเลือกเคสใหม่ทั้งชุด
            const r = await FinData.createBatch(this._payload());
            await FinData.confirmBatch(r.batch_id);
            DSToast.success(`ตั้งยอดพึงรับ ${rows.length} เคส (${MockFmt.baht(total)} บาท) เรียบร้อย — `
                          + `ชุด ${r.batch_no}`);
            this.draft.picked.clear();
            await this.reload();
        } catch (e) {
            DSToast.error(e.message);
        }
    },

    /* ══════════ ชุดส่งที่มีอยู่ ══════════ */

    renderBatches() {
        const head = `<thead><tr>
            <th style="width:95px">เลขที่ชุด</th>
            <th style="width:65px">งวด</th>
            <th style="width:120px">สิทธิ</th>
            <th style="min-width:200px">กองทุน</th>
            <th style="width:100px">วันที่ส่ง</th>
            <th class="num" style="width:70px">เคส</th>
            <th class="num" style="width:120px">ยอดพึงรับ</th>
            <th style="width:110px">สถานะ</th>
            <th style="width:110px"></th>
        </tr></thead>`;

        if (!this.batches.length) {
            document.getElementById('batchTable').innerHTML = head
                + `<tbody><tr><td colspan="9" class="c" style="padding:26px">
                     <span class="td-sub">${FinData.live
                        ? 'ยังไม่มีชุดส่งในระบบ'
                        : 'โหมดต้นแบบไม่มีชุดส่งให้แสดง — ดูตัวอย่างยอดที่ตั้งแล้วได้ที่ทะเบียนลูกหนี้'}
                     </span></td></tr></tbody>`;
            return;
        }

        const body = this.batches.map(b => {
            const draft = b.status === 'DRAFT';
            return `<tr>
                <td class="l"><b>${esc(b.batch_no)}</b></td>
                <td class="c">${esc(b.period_key)}</td>
                <td class="l">${esc(AR_PAYER_LABEL[b.payer] || b.payer)}</td>
                <td class="l">${esc(AR_FUND_LABEL[b.fund_key] || b.fund_key)}</td>
                <td class="c">${esc(MockFmt.dateTH(b.sent_date))}</td>
                <td class="num">${esc(MockFmt.int(b.item_count))}</td>
                <td class="num">${esc(MockFmt.baht(b.billed_total))}</td>
                <td class="c"><span class="kbadge ${draft ? 'kbadge-draft' : 'kbadge-done'}">
                    ${draft ? 'ร่าง' : 'ตั้งหนี้แล้ว'}</span></td>
                <td class="c">${draft ? `
                    <button class="btn btn-primary btn-sm"
                        onclick="FinSubmit.confirmExisting(${esc(b.batch_id)}, '${esc(b.batch_no)}')">
                        ยืนยัน</button>
                    <button class="btn btn-outline btn-sm"
                        onclick="FinSubmit.removeBatch(${esc(b.batch_id)}, '${esc(b.batch_no)}')"
                        title="ลบร่าง">&times;</button>` : ''}</td>
            </tr>`;
        }).join('');

        document.getElementById('batchTable').innerHTML = head + `<tbody>${body}</tbody>`;
    },

    async confirmExisting(id, no) {
        const ok = await Drawer.confirm({
            title: `ยืนยันชุด ${no}?`,
            message: 'เคสในชุดจะเข้าทะเบียนลูกหนี้และเริ่มนับอายุหนี้ทันที',
            confirmText: 'ยืนยันตั้งหนี้', danger: false,
        });
        if (!ok) return;
        try {
            const r = await FinData.confirmBatch(id);
            DSToast.success(`ตั้งยอดพึงรับ ${r.items} เคส (${MockFmt.baht(r.billed_total)} บาท) แล้ว`);
            await this.reload();
        } catch (e) { DSToast.error(e.message); }
    },

    async removeBatch(id, no) {
        const ok = await Drawer.confirm({
            title: `ลบชุดร่าง ${no}?`,
            message: 'ชุดที่ยังไม่ยืนยันลบได้ — ประวัติยังอยู่ใน audit log',
            confirmText: 'ลบ', danger: true,
        });
        if (!ok) return;
        try {
            await FinData.deleteBatch(id, 'ลบจากหน้าบันทึกส่ง');
            DSToast.success('ลบชุดร่างแล้ว');
            await this.reload();
        } catch (e) { DSToast.error(e.message); }
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.FinSubmit = FinSubmit;
document.addEventListener('DOMContentLoaded', () => FinSubmit.init());
