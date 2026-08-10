/* ────────────────────────────────────────────────────────
   สร้างคำขอส่งต่อผู้ป่วย (New Referral Request)

   แพทเทิร์นเดียวกับ claim-rules.js → openBuilder()/saveDraft():
   ประกอบ record ให้ครบทุกฟิลด์แล้ว MockDB.insert() ทีเดียว
   ต่างกันตรงที่หน้านี้เป็นฟอร์มเต็มหน้า ไม่ใช่ drawer เพราะช่องเยอะ
   และต้องเห็น "ความพร้อมส่งขออนุมัติ" คู่กันไปตลอดขณะกรอก

   ⚠️ ฟิลด์ letter_no / auth_no / auth_type / auth_source / issued_at /
      expires_at / approver / approved_at เป็นของที่ "ออกตอนอนุมัติ"
      (MockRefer.applyTaskDecision) — ห้ามเซ็ตที่นี่เด็ดขาด ไม่งั้นรายการ
      จะติดด่าน "มีเลขอนุมัติแล้ว" ของ ReferList.submitSelected() ทันที

   ⭐ สามคนในคำขอเดียว — แยกกันคนละฟิลด์เพราะผู้อนุมัติต้องตามกลับได้ว่าใครทำอะไร
        attending_doctor  แพทย์เจ้าของไข้ — คนที่รับผิดชอบทางคลินิก
        doctor            แพทย์ผู้เขียนใบส่งต่อ — อาจเป็นแพทย์เวร/ที่ปรึกษา คนละคนกับเจ้าของไข้
        reviewed_by       เจ้าหน้าที่ผู้ตรวจทานก่อนส่งขออนุมัติ = maker ของ BR-05
      เนื้อหาที่ใช้ตัดสินอยู่ใน clinical_review ตามหัวข้อของ REFER_REVIEW_PARTS
      ทั้งหมดนี้ไปโผล่ที่หน้าอนุมัติ claim-tasks.html แท็บ "การอนุมัติ"
   ──────────────────────────────────────────────────────── */

const ReferNew = {

    state: {
        dir: 'OUT',
        procs: [{ code: '', name: '' }],
    },

    init() {
        MockSession.mountBanner('demoBanner');

        const p = new URLSearchParams(location.search);
        if (p.get('dir') === 'IN') this.state.dir = 'IN';

        this.fillSelects();
        this.fillDatalists();
        this.renderSeg();
        this.renderReviewFields();
        this.renderProcs();
        this.applyDir();

        /* ผูกที่ตัวครอบตัวเดียว — ทุกช่องจึงอัปเดตแผงสรุปได้โดยไม่ต้องใส่ on* รายช่อง
           (on* ที่ยังเหลือในมาร์กอัป มีไว้เพื่อผลข้างเคียงเฉพาะช่อง เช่น เติมค่าให้อัตโนมัติ) */
        const main = document.querySelector('.ds-pane-main');
        main.addEventListener('input',  () => this.sync());
        main.addEventListener('change', () => this.sync());

        this.renderSummary();
        refreshIcons();
    },

    /* ══════════ ตัวเลือกในฟอร์ม — derive จาก mock ทั้งหมด ══════════ */

    /** ปลายทางเปลี่ยนตามทิศทาง: ส่งออก = รพ.ภายนอก · รับเข้า = หน่วยบริการที่ส่งมา */
    partners() {
        if (this.state.dir === 'OUT') return MOCK_REFER_PROVIDERS;
        return (window.NHSO_PROVIDERS || []).map(p => ({
            code: p.code, name: p.name,
            level: 'ปฐมภูมิ', province: 'กรุงเทพมหานคร',
        }));
    },

    partnerById(code) {
        return this.partners().find(p => String(p.code) === String(code)) || null;
    },

    fillSelects() {
        /* enum ของ referral เก็บเป็น {key:{label}} ยกเว้น REFER_CHANNEL ที่เป็น {key:'ข้อความ'} */
        const opts = o => Object.entries(o)
            .map(([k, v]) => `<option value="${esc(k)}">${esc(v.label || v)}</option>`).join('');

        document.getElementById('fReason').innerHTML   = opts(REFER_REASON);
        document.getElementById('fUrgency').innerHTML  = opts(REFER_URGENCY);
        document.getElementById('fScope').innerHTML    = opts(REFER_SCOPE);
        document.getElementById('fChannel').innerHTML  = opts(REFER_CHANNEL);
        document.getElementById('fUrgency').value      = 'ELECTIVE';

        document.getElementById('fFund').innerHTML = (window.CLAIM_FUNDS || ['UC'])
            .map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');

        const staff = MockAdmin.users().filter(u => u.active).map(u =>
            `<option value="${esc(u.id)}" ${u.id === MockSession.userId() ? 'selected' : ''}
             >${esc(u.name)}</option>`).join('');
        document.getElementById('fOwner').innerHTML = staff;

        /* ผู้ตรวจทานเริ่มที่ตัวเอง — คนที่นั่งกรอกฟอร์มคือคนที่ตรวจทานตามปกติ
           และเป็น maker ที่ระบบจะกันไม่ให้อนุมัติเองตอน save() */
        document.getElementById('fReviewer').innerHTML =
            `<option value="">— ยังไม่มีผู้ตรวจทาน —</option>` + staff;
        document.getElementById('fReviewer').value = MockSession.userId();

        this.renderPartners();
    },

    /** ช่องสรุปทางคลินิก — สร้างจาก REFER_REVIEW_PARTS ทั้งชุด id = fClin + Pascal(key) */
    fieldId(key) { return 'fClin' + key.charAt(0).toUpperCase() + key.slice(1); },

    renderReviewFields() {
        document.getElementById('reviewFields').innerHTML = REFER_REVIEW_PARTS.map(p => `
            <div class="sip-field">
                <label class="sip-label">${esc(p.label)}${p.required ? ' *' : ''}</label>
                <textarea class="sip-textarea" id="${esc(this.fieldId(p.key))}" rows="3"
                          placeholder="${esc(p.hint)}"></textarea>
            </div>`).join('');
    },

    renderPartners() {
        const sel  = document.getElementById('fPartner');
        const keep = sel.value;
        sel.innerHTML = '<option value="">— เลือก —</option>' + this.partners().map(p =>
            `<option value="${esc(p.code)}">${esc(p.name)} · ${esc(p.level)}</option>`).join('');
        if (keep && this.partnerById(keep)) sel.value = keep;
    },

    /**
     * ไม่มีตาราง patients ในระบบ — ประกอบดัชนีจากรายการส่งต่อ + เคลม
     * ทำให้คนที่เลือกตอนสร้าง เป็นคนเดียวกับที่เห็นบน worklist หลังบันทึก
     */
    patientIndex() {
        if (this._pIdx) return this._pIdx;
        const idx = {};
        [...MockRefer.all(), ...MockClaims.all()].forEach(r => {
            if (r.hn && !idx[r.hn]) idx[r.hn] = r;
        });
        this._pIdx = idx;
        return idx;
    },

    fillDatalists() {
        const pts = Object.values(this.patientIndex());
        document.getElementById('hnList').innerHTML = pts.map(p =>
            `<option value="${esc(p.hn)}">${esc(p.patient)}</option>`).join('');

        /* รวมทั้งเจ้าของไข้และผู้เขียน — ช่องทั้งสองใช้ datalist ก้อนเดียวกัน */
        const docs = [...new Set(MockRefer.all()
            .flatMap(r => [r.doctor, r.attending_doctor]).filter(Boolean))].sort();
        document.getElementById('docList').innerHTML = docs.map(d =>
            `<option value="${esc(d)}"></option>`).join('');

        const depts = [...new Set(MockRefer.all().map(r => r.clinic_dept).filter(Boolean))].sort();
        document.getElementById('deptList').innerHTML = depts.map(d =>
            `<option value="${esc(d)}"></option>`).join('');
    },

    /* ══════════ ทิศทาง ══════════ */

    renderSeg() {
        document.getElementById('segDir').innerHTML = REFER_DIRECTION.map(d => `
            <button class="ds-seg ${d.key === this.state.dir ? 'active' : ''}"
                    onclick="ReferNew.setDir('${esc(d.key)}')">${esc(d.label)}</button>`).join('');
    },

    setDir(key) {
        if (key === this.state.dir) return;
        this.state.dir = key;
        this.renderSeg();
        this.renderPartners();
        this.applyDir();
        this.sync();
        refreshIcons();
    },

    /** ปรับป้ายและปุ่มให้ตรงทิศทาง — รับส่งต่อเข้าไม่ต้องขออนุมัติวงเงิน */
    applyDir() {
        const meta = MockRefer.dirMeta(this.state.dir);
        const isOut = this.state.dir === 'OUT';

        document.getElementById('partnerLabel').textContent = meta.partnerLabel + ' *';
        document.getElementById('partnerCardTitle').textContent =
            isOut ? 'ปลายทางและเหตุผลที่ส่งต่อ' : 'ต้นทางและเหตุผลที่ส่งมา';

        document.getElementById('dirNote').innerHTML = `
            <i data-lucide="${isOut ? 'log-out' : 'log-in'}" class="icon-sm"></i>
            <span><strong>${esc(meta.label)}</strong> — ${esc(meta.sub)}</span>`;

        document.getElementById('btnSubmit').style.display = isOut ? '' : 'none';
    },

    /* ══════════ หัตถการที่วางแผน ══════════ */

    renderProcs() {
        document.getElementById('procRows').innerHTML = this.state.procs.map((p, i) => `
            <div class="sip-field-row" style="align-items:end">
                <div class="sip-field">
                    <input class="sip-input" placeholder="รหัสหัตถการ เช่น 39.95"
                           value="${esc(p.code)}" oninput="ReferNew.setProc(${i}, 'code', this.value)">
                </div>
                <div class="sip-field" style="grid-column:span 2">
                    <input class="sip-input" placeholder="ชื่อหัตถการ เช่น Hemodialysis"
                           value="${esc(p.name)}" oninput="ReferNew.setProc(${i}, 'name', this.value)">
                </div>
                <div class="sip-field" style="max-width:44px">
                    <button class="ds-icon-btn" title="ลบแถว" onclick="ReferNew.removeProc(${i})">
                        <i data-lucide="trash-2" class="icon-sm"></i>
                    </button>
                </div>
            </div>`).join('');
        refreshIcons();
    },

    setProc(i, key, val) { if (this.state.procs[i]) this.state.procs[i][key] = val; },
    addProc()  { this.state.procs.push({ code: '', name: '' }); this.renderProcs(); },
    removeProc(i) {
        this.state.procs.splice(i, 1);
        if (!this.state.procs.length) this.state.procs.push({ code: '', name: '' });
        this.renderProcs();
    },

    /* ══════════ เติมค่าอัตโนมัติ ══════════ */

    onHn() {
        const hn = document.getElementById('fHn').value.trim();
        const p  = this.patientIndex()[hn];
        if (p) {
            document.getElementById('fPatient').value = p.patient || '';
            if (p.age)    document.getElementById('fAge').value    = p.age;
            if (p.gender) document.getElementById('fGender').value = p.gender;
            if (p.fund)   document.getElementById('fFund').value   = p.fund;
        }
        this.onFund();
    },

    /**
     * เลขที่สิทธิ — กติกาเดียวกับ seed: HN คือ '001' + เลขลำดับ 5 หลัก
     * และ right_no ใช้เลขลำดับนั้นเติมศูนย์ให้ครบ 7 หลัก
     * (ตรวจได้จาก hn '00131204' → 'UC69-0031204' ใน mock-referrals.js)
     */
    onFund() {
        const hn   = document.getElementById('fHn').value.trim();
        const fund = document.getElementById('fFund').value;
        const el   = document.getElementById('fRightNo');
        const p    = this.patientIndex()[hn];

        if (p && p.right_no && p.fund === fund) el.value = p.right_no;
        else if (hn) el.value = `${fund}69-${String(hn).replace(/^001/, '').padStart(7, '0')}`;
        this.sync();
    },

    onScope() {
        const scope = document.getElementById('fScope').value;
        const ipd   = scope === 'IPD_ADMIT';
        document.getElementById('rowAn').style.display = ipd ? '' : 'none';
        document.getElementById('fServiceType').value  = ipd ? 'IPD' : 'OPD';
        this.sync();
    },

    /* ══════════ ดึงเวชระเบียนจาก HIS รายหมวด ══════════ */

    /** หมวดที่ดึงเข้าฟอร์มไปแล้ว — เก็บไว้แสดงที่มาและบันทึกลงรายการเป็นหลักฐาน */
    hisPulled: [],

    openHis() {
        const hn = this.val('fHn');
        if (!hn) { showToast('กรอก HN ก่อน จึงจะดึงเวชระเบียนจาก HIS ได้', 'warning'); return; }

        const ex = MockHIS.extract(hn);
        if (!ex.found) {
            showToast(`ไม่พบเวชระเบียนของ HN ${hn} ในระบบ HIS`, 'warning');
            return;
        }

        /* ตัวเลือกปลายทาง = หัวข้อของสรุปทางคลินิก ผู้ใช้เปลี่ยนรายหมวดได้
           เผื่อกรณีที่หมวดเดียวกันควรไปคนละที่ เช่น ผลตรวจที่ใช้เป็นเหตุผลส่งต่อ */
        const targetOpts = sel => REFER_REVIEW_PARTS.map(p =>
            `<option value="${esc(p.key)}" ${p.key === sel ? 'selected' : ''}>${esc(p.label)}</option>`).join('');

        Drawer.open({
            width: '620px',
            title: `ดึงข้อมูลจาก HIS — HN ${esc(hn)}`,
            contentHtml: `
                <div class="ds-note" style="margin-bottom:12px">
                    <i data-lucide="user" class="icon-sm"></i>
                    ${esc(ex.patient)} · พบ ${ex.sections.length} หมวดที่ดึงได้
                    ${ex.source_ref ? `<span class="td-sub">· อ้างอิง ${esc(ex.source_ref)}</span>` : ''}
                </div>
                <div class="sip-banner sip-banner-warning" style="margin-bottom:12px">
                    <i data-lucide="alert-triangle" class="icon-sm"></i>
                    <span>${esc(MockHIS.SIMULATED_NOTE)}</span>
                </div>

                <div class="ds-section-label" style="display:flex;align-items:center;gap:8px">
                    เลือกหมวดที่ต้องการดึง
                    <button class="btn btn-ghost btn-sm" style="margin-left:auto"
                            onclick="ReferNew.hisToggleAll(true)">เลือกทั้งหมด</button>
                    <button class="btn btn-ghost btn-sm" onclick="ReferNew.hisToggleAll(false)">ล้าง</button>
                </div>

                ${ex.sections.map(s => `
                    <div class="ds-block" style="margin-bottom:8px">
                        <label class="sip-checkbox" style="display:flex;gap:8px;align-items:flex-start">
                            <input type="checkbox" class="hisPick" data-key="${esc(s.key)}"
                                   onchange="ReferNew.hisCount()">
                            <span style="flex:1">
                                <strong style="font-size:12.5px">
                                    <i data-lucide="${esc(s.icon)}" class="icon-sm"></i> ${esc(s.label)}</strong>
                                <span class="sip-chip sip-chip-muted">${esc(s.source)}</span>
                                <span class="td-sub">${s.lines.length} รายการ</span>
                                <div class="td-sub" style="margin-top:4px;line-height:1.6">
                                    ${esc(s.lines.slice(0, 3).join(' · '))}${
                                        s.lines.length > 3 ? ` … และอีก ${s.lines.length - 3} รายการ` : ''}
                                </div>
                            </span>
                        </label>
                        <div class="sip-field" style="margin:8px 0 0 26px">
                            <label class="sip-label" style="font-size:11px">เติมลงหัวข้อ</label>
                            <select class="sip-select hisTarget" data-key="${esc(s.key)}"
                                    style="font-size:12px">${targetOpts(s.target)}</select>
                        </div>
                    </div>`).join('')}

                <div class="ds-note" style="margin-top:10px">
                    <i data-lucide="info" class="icon-sm"></i>
                    ข้อความจะถูก <strong>ต่อท้าย</strong> ของเดิมพร้อมป้ายชื่อหมวดกำกับ
                    ไม่ทับสิ่งที่แพทย์เขียนไว้เอง — เกลาเป็นภาษาคนได้หลังดึง
                </div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                         <button class="btn btn-save" onclick="ReferNew.hisApply()">
                            ดึงเข้าฟอร์ม <span id="hisN">0</span> หมวด</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    hisToggleAll(on) {
        document.querySelectorAll('.hisPick').forEach(el => { el.checked = on; });
        this.hisCount();
    },

    hisCount() {
        const n = document.querySelectorAll('.hisPick:checked').length;
        document.getElementById('hisN').textContent = n;
    },

    hisApply() {
        const picks = [...document.querySelectorAll('.hisPick:checked')].map(el => {
            const key = el.dataset.key;
            const sel = document.querySelector(`.hisTarget[data-key="${key}"]`);
            return { key, target: sel ? sel.value : null };
        });
        if (!picks.length) { showToast('ยังไม่ได้เลือกหมวดที่จะดึง', 'warning'); return; }

        const hn    = this.val('fHn');
        const parts = MockHIS.compose(hn, picks);

        Object.entries(parts).forEach(([target, text]) => {
            const el = document.getElementById(this.fieldId(target));
            if (!el) return;
            el.value = el.value.trim() ? `${el.value.trim()}\n${text}` : text;
        });

        /* บันทึกที่มาไว้ — ผู้อนุมัติและผู้ตรวจสอบย้อนหลังต้องรู้ว่าบรรทัดไหนมาจาก HIS */
        picks.forEach(p => {
            const s = MockHIS.section(p.key);
            if (s && !this.hisPulled.some(x => x.key === p.key)) {
                this.hisPulled.push({ key: p.key, label: s.label, source: s.source,
                                      target: p.target || s.target, at: '2569-08-06T09:00' });
            }
        });

        Drawer.close();
        this.renderHisPulled();
        this.sync();
        showToast(`ดึงจาก HIS แล้ว ${picks.length} หมวด — ตรวจและเกลาข้อความก่อนส่งขออนุมัติ`);
    },

    renderHisPulled() {
        const el = document.getElementById('hisPulled');
        if (!this.hisPulled.length) { el.innerHTML = ''; return; }
        el.innerHTML = `
            <div class="sip-banner sip-banner-info" style="margin-bottom:12px">
                <i data-lucide="database" class="icon-sm"></i>
                <span>ดึงจาก HIS แล้ว ${this.hisPulled.length} หมวด —
                ${esc(this.hisPulled.map(p => p.label).join(' · '))}<br>
                <span class="td-sub">${esc(MockHIS.SIMULATED_NOTE)}</span></span>
            </div>`;
        refreshIcons();
    },

    /* ══════════ อ่านค่าจากฟอร์ม ══════════ */

    val(id)  { const el = document.getElementById(id); return el ? el.value.trim() : ''; },
    num(id)  { return Number(this.val(id)) || 0; },

    /** สรุปทางคลินิก → {history, findings, ...} ตามคีย์ของ REFER_REVIEW_PARTS */
    readReview() {
        const o = {};
        REFER_REVIEW_PARTS.forEach(p => { o[p.key] = this.val(this.fieldId(p.key)); });
        return o;
    },

    read() {
        const partner = this.partnerById(this.val('fPartner'));
        return {
            direction: this.state.dir,
            hn: this.val('fHn'), an: this.val('fAn'),
            patient: this.val('fPatient'),
            age: this.num('fAge'), gender: this.val('fGender'),
            fund: this.val('fFund'), right_no: this.val('fRightNo'),
            partner,
            dx_code: this.val('fDxCode'), dx_name: this.val('fDxName'),
            procs: this.state.procs.filter(p => p.code.trim() || p.name.trim()),
            reason: this.val('fReason'), urgency: this.val('fUrgency'),
            doctor: this.val('fDoctor'), attending: this.val('fAttending'),
            clinic_dept: this.val('fClinicDept'),
            review: this.readReview(),
            reviewer: this.val('fReviewer'),
            review_note: this.val('fReviewNote'),
            reviewed: document.getElementById('fReviewed').checked,
            refer_date: this.val('fReferDate'),
            scope: this.val('fScope'), scope_note: this.val('fScopeNote'),
            visit_limit: this.num('fVisitLimit') || 1,
            cap_amount: this.num('fCap'), est_amount: this.num('fEst'),
            service_type: this.val('fServiceType'),
            reimbursable: document.getElementById('fReimbursable').checked,
            channel: this.val('fChannel'),
            owner: this.val('fOwner'), due: this.val('fDue'),
            note: this.val('fNote'),
        };
    },

    /**
     * ความพร้อมส่งขออนุมัติ — สะท้อนด่าน reasonOf() ของ ReferList.submitSelected()
     * หนึ่งต่อหนึ่ง เพื่อไม่ให้ผู้ใช้ไปเจอ "ส่งขออนุมัติไม่ได้" ทีหลัง
     * ⚠️ อย่าใช้ MockRefer.readiness() — ตัวนั้นเช็ค letter_no/auth_no ซึ่งเป็น
     *    ของที่ยังไม่มีตอนสร้าง จะขึ้นแดงทุกข้อทั้งที่คำขอถูกต้อง
     */
    readiness(f) {
        const missing = this.missingReview(f);
        return [
            { label: 'เป็นรายการส่งต่อออก (ต้องขออนุมัติวงเงิน)', ok: f.direction === 'OUT' },
            { label: 'ระบุผู้ป่วยและ HN ครบ',                    ok: !!(f.hn && f.patient) },
            { label: `เลือก${MockRefer.dirMeta(f.direction).partnerLabel}แล้ว`, ok: !!f.partner },
            { label: 'ระบุการวินิจฉัยหลัก',                      ok: !!(f.dx_code && f.dx_name) },
            { label: 'ระบุแพทย์เจ้าของไข้และผู้เขียนใบส่งต่อ',      ok: !!(f.attending && f.doctor) },
            { label: missing.length
                        ? `เขียนสรุปทางคลินิก — ยังขาด ${missing.length} หัวข้อ`
                        : 'เขียนสรุปทางคลินิกครบทุกหัวข้อ',
              ok: missing.length === 0 },
            { label: 'ระบุขอบเขตและวงเงินที่ขอ',                  ok: !!(f.scope && f.cap_amount > 0) },
            { label: 'เจ้าหน้าที่ตรวจทานและลงชื่อแล้ว',            ok: !!(f.reviewer && f.reviewed) },
        ];
    },

    /** หัวข้อบังคับที่ยังไม่ได้เขียน — ใช้ทั้งบนแผงขวาและตอน validate */
    missingReview(f) {
        return REFER_REVIEW_PARTS.filter(p => p.required && !(f.review[p.key] || '').trim());
    },

    /* ══════════ แผงขวา ══════════ */

    /* หน่วงไว้ก่อน — renderSummary() ปิดท้ายด้วย refreshIcons() ซึ่งสแกนทั้งหน้า
       ถ้าเรียกทุก keystroke การพิมพ์ในช่องบันทึกจะสะดุด */
    _syncTimer: null,
    sync() {
        clearTimeout(this._syncTimer);
        this._syncTimer = setTimeout(() => this.renderSummary(), 120);
    },

    _kv(o) {
        return Object.entries(o).map(([k, v]) =>
            `<div style="display:flex;justify-content:space-between;gap:12px;padding:4px 0;
                 border-bottom:1px dashed var(--brand-border);font-size:12px">
                <span style="color:var(--text-muted)">${esc(k)}</span>
                <strong style="text-align:right">${v}</strong></div>`).join('');
    },

    /** ตัวนับบนหัวการ์ดสรุปทางคลินิก + ป้ายเตือนเมื่อเจ้าของไข้กับผู้เขียนเป็นคนเดียวกัน */
    renderReviewMeter(f) {
        const done = REFER_REVIEW_PARTS.filter(p => (f.review[p.key] || '').trim()).length;
        const el   = document.getElementById('reviewCount');
        el.textContent = `${done}/${REFER_REVIEW_PARTS.length} หัวข้อ`;
        el.style.color = this.missingReview(f).length ? 'var(--status-danger)' : 'var(--status-success)';

        document.getElementById('doctorNote').style.display =
            (f.attending && f.doctor && f.attending === f.doctor) ? '' : 'none';
    },

    renderSummary() {
        const f     = this.read();
        const steps = this.readiness(f);
        const ready = steps.every(s => s.ok);
        const isOut = f.direction === 'OUT';

        this.renderReviewMeter(f);

        const checklist = steps.map(s => `
            <div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;font-size:12px">
                <i data-lucide="${s.ok ? 'check-circle-2' : 'circle'}" class="icon-sm"
                   style="flex-shrink:0;margin-top:1px;color:${s.ok ? '#22c55e' : 'var(--text-muted)'}"></i>
                <span style="color:${s.ok ? 'var(--text)' : 'var(--text-muted)'}">${esc(s.label)}</span>
            </div>`).join('');

        document.getElementById('summaryPane').innerHTML = `
            <div class="ds-section-label">สรุปคำขอ</div>
            ${this._kv({
                'ผู้ป่วย':   esc(f.patient || '—') + (f.hn ? ` <span class="td-sub">(${esc(f.hn)})</span>` : ''),
                [MockRefer.dirMeta(f.direction).partnerLabel]: esc(f.partner ? f.partner.name : '—'),
                'กองทุน':    esc(f.fund) + (f.right_no ? ` <span class="td-sub">${esc(f.right_no)}</span>` : ''),
                'การวินิจฉัย': f.dx_code ? `${esc(f.dx_code)} <span class="td-sub">${esc(f.dx_name)}</span>` : '—',
                'ขอบเขต':    esc((REFER_SCOPE[f.scope] || {}).label || '—'),
                'จำนวนครั้ง': `${f.visit_limit} ครั้ง`,
                'วงเงินที่ขอ': f.cap_amount
                    ? `<span style="color:var(--brand-navy)">${esc(MockFmt.baht(f.cap_amount))} บาท</span>`
                    : '<span style="color:var(--status-danger)">ยังไม่ระบุ</span>',
                'ความเร่งด่วน': `<span class="sip-chip ${esc((REFER_URGENCY[f.urgency] || {}).chip || 'sip-chip-muted')}"
                                >${esc((REFER_URGENCY[f.urgency] || {}).label || '—')}</span>`,
                'แพทย์เจ้าของไข้': esc(f.attending || '—'),
                'ผู้เขียนใบส่งต่อ': esc(f.doctor || '—') +
                    (f.attending && f.doctor && f.attending !== f.doctor
                        ? ' <span class="sip-chip sip-chip-amber">คนละคน</span>' : ''),
                'ผู้ตรวจทาน': f.reviewer
                    ? esc(MockAdmin.userName(f.reviewer)) +
                      (f.reviewed ? ' <span class="sip-chip sip-chip-success">ลงชื่อแล้ว</span>'
                                  : ' <span class="sip-chip sip-chip-amber">ยังไม่ลงชื่อ</span>')
                    : '<span style="color:var(--status-danger)">ยังไม่ระบุ</span>',
            })}

            <div class="ds-section-label" style="margin-top:14px">สรุปทางคลินิกที่เขียนแล้ว</div>
            ${REFER_REVIEW_PARTS.map(p => {
                const txt = (f.review[p.key] || '').trim();
                const tone = txt ? '#22c55e' : (p.required ? 'var(--status-danger)' : 'var(--text-muted)');
                return `<div style="display:flex;align-items:flex-start;gap:8px;padding:4px 0;font-size:12px">
                    <i data-lucide="${txt ? 'check-circle-2' : p.required ? 'alert-circle' : 'circle'}"
                       class="icon-sm" style="flex-shrink:0;margin-top:1px;color:${tone}"></i>
                    <span style="color:${txt ? 'var(--text)' : 'var(--text-muted)'}">${esc(p.label)}
                        <span class="td-sub">${txt ? `${txt.length} ตัวอักษร`
                                                   : p.required ? 'ต้องเขียน' : 'ไม่บังคับ'}</span></span>
                </div>`;
            }).join('')}

            <div class="ds-section-label" style="margin-top:14px">ความพร้อมส่งขออนุมัติ</div>
            ${checklist}

            ${isOut ? (ready ? `
                <div class="sip-banner sip-banner-success" style="margin-top:12px">
                    <i data-lucide="shield-check" class="icon-sm"></i>
                    <span>ครบแล้ว — กด <strong>บันทึกและส่งขออนุมัติ</strong> เพื่อสร้างงานให้ผู้มีอำนาจอนุมัติ
                    พร้อมเริ่มนับ SLA ได้ทันที</span>
                </div>` : `
                <div class="sip-banner sip-banner-warning" style="margin-top:12px">
                    <i data-lucide="alert-triangle" class="icon-sm"></i>
                    <span>ยังกรอกไม่ครบ — บันทึกเป็นร่างไว้ก่อนได้
                    แล้วค่อยส่งขออนุมัติจากหน้าทะเบียนภายหลัง</span>
                </div>`) : `
                <div class="ds-note" style="margin-top:12px">
                    <i data-lucide="info" class="icon-sm"></i>
                    รายการรับส่งต่อเข้าไม่ต้องขออนุมัติวงเงิน — บันทึกแล้วจะอยู่สถานะ
                    <strong>รับผู้ป่วยแล้ว</strong> และไปตั้งเรื่องเรียกเก็บที่หน้าตามจ่าย/เรียกเก็บ
                </div>`}

            <div class="ds-note" style="margin-top:12px">
                <i data-lucide="lightbulb" class="icon-sm"></i>
                <strong>เลขที่ใบส่งตัว</strong> และ <strong>เลขอนุมัติ</strong> ระบบจะออกให้อัตโนมัติ
                เมื่อผู้มีอำนาจกดอนุมัติ — ไม่ต้องกรอกเอง และผู้ขอจะอนุมัติเองไม่ได้ (BR-05)
            </div>`;

        refreshIcons();
    },

    /* ══════════ บันทึก ══════════ */

    /** ค.ศ. จาก <input type="date"> → พ.ศ. แบบเดียวกับ ReferList.saveAssign() */
    _be(d) { return d ? `${(+d.slice(0, 4)) + 543}${d.slice(4)}` : null; },

    /**
     * ด่านตอนบันทึก — แยกเป็นสองชั้น
     *   บันทึกร่าง: เอาแค่ที่ทำให้รายการมีตัวตนบนทะเบียนได้
     *   ส่งขออนุมัติ: ต้องมีของที่ผู้อนุมัติใช้ตัดสินครบ (สรุปคลินิก + ผู้ตรวจทาน)
     * ไม่งั้นงานจะไปโผล่ที่หน้าอนุมัติแบบที่ตัดสินไม่ได้ แล้วถูกตีกลับฟรี ๆ
     */
    validate(f, submitNow) {
        if (!f.hn)         return 'กรุณากรอก HN';
        if (!f.patient)    return 'กรุณากรอกชื่อผู้ป่วย';
        if (!f.partner)    return `กรุณาเลือก${MockRefer.dirMeta(f.direction).partnerLabel}`;
        if (!f.attending)  return 'กรุณาระบุแพทย์เจ้าของไข้';
        if (!f.doctor)     return 'กรุณาระบุแพทย์ผู้เขียนใบส่งต่อ';
        if (!f.refer_date) return 'กรุณาระบุวันที่ขอส่งต่อ';
        if (!f.dx_code || !f.dx_name) return 'กรุณาระบุรหัสและชื่อการวินิจฉัยหลัก';
        if (!f.scope)      return 'กรุณาเลือกขอบเขตที่ขออนุมัติ';
        if (f.cap_amount <= 0) return 'กรุณาระบุวงเงินที่ขออนุมัติ';

        if (submitNow) {
            const miss = this.missingReview(f);
            if (miss.length) return `ยังเขียนสรุปทางคลินิกไม่ครบ — ขาด "${miss[0].label}"`
                                  + (miss.length > 1 ? ` และอีก ${miss.length - 1} หัวข้อ` : '');
            if (!f.reviewer) return 'กรุณาระบุเจ้าหน้าที่ผู้ตรวจทาน';
            if (!f.reviewed) return 'เจ้าหน้าที่ต้องติ๊ก "ตรวจทานแล้ว" ก่อนส่งขออนุมัติ';
        }
        return null;
    },

    async save(submitNow) {
        const f   = this.read();
        const err = this.validate(f, submitNow);
        if (err) { showToast(err, 'warning'); return; }

        const isOut = f.direction === 'OUT';
        if (submitNow && !isOut) { showToast('รายการรับส่งต่อเข้าไม่ต้องขออนุมัติวงเงิน', 'warning'); return; }

        const now      = '2569-08-06T09:00';
        const today    = '2569-08-06';
        const byName   = MockAdmin.userName(MockSession.userId());
        const referBe  = this._be(f.refer_date) || today;

        const r = {
            id: MockRefer.nextId(f.direction), direction: f.direction, claim_id: null,
            hn: f.hn, an: f.scope === 'IPD_ADMIT' ? (f.an || null) : null,
            patient: f.patient, age: f.age || null, gender: f.gender,
            nid_masked: (this.patientIndex()[f.hn] || {}).nid_masked || null,
            fund: f.fund, right_no: f.right_no || null,
            partner_code: f.partner.code, partner_name: f.partner.name,
            partner_level: f.partner.level, partner_province: f.partner.province,
            dx: [{ code: f.dx_code, name: f.dx_name, type: 'หลัก' }],
            proc_planned: f.procs.map(p => ({ code: p.code.trim(), name: p.name.trim() })),
            proc_actual: [],
            reason: f.reason, urgency: f.urgency, doctor: f.doctor, refer_note: f.note,
            attending_doctor: f.attending, clinic_dept: f.clinic_dept || null,
            clinical_review: f.review,
            /* ที่มาของข้อความ — บรรทัดไหนพิมพ์เอง บรรทัดไหนดึงจาก HIS ต้องแยกออกได้ */
            review_sources: this.hisPulled.slice(),

            /* ── ลงชื่อตรวจทานเมื่อเจ้าหน้าที่ติ๊กแล้วเท่านั้น — ปล่อยว่างไว้ถ้ายัง
                 เพื่อให้หน้าอนุมัติแยกออกว่า "ยังไม่มีใครตรวจ" กับ "ตรวจแล้วเสนอมา" ── */
            reviewed_by:   f.reviewed ? f.reviewer : null,
            reviewer_name: f.reviewed ? MockAdmin.userName(f.reviewer) : null,
            reviewed_at:   f.reviewed ? now : null,
            review_note:   f.review_note,

            /* ── ออกให้ตอนอนุมัติเท่านั้น (MockRefer.applyTaskDecision) ── */
            letter_no: null, auth_no: null, auth_type: null, auth_source: null,
            issued_at: null, expires_at: null, approver: null, approved_at: null,

            scope: f.scope, scope_note: f.scope_note,
            visit_limit: f.visit_limit, visit_used: 0,
            cap_amount: f.cap_amount,
            refer_date: referBe, service_date_from: null, service_date_to: null,
            service_type: f.service_type, est_amount: f.est_amount || f.cap_amount,
            reimbursable: f.reimbursable, reimburse_channel: f.channel,
            counter_received: false, counter_sent: false, counter_at: null,
            risk_score: 0, risk_flags: [],
            documents: [
                { name: 'ใบส่งตัวผู้ป่วย',       type: 'ใบส่งตัว',   status: 'PENDING', by: '—',      date: null },
                { name: 'สำเนาบัตรประชาชน/สิทธิ', type: 'สิทธิ',      status: 'FOUND',   by: 'ระบบ HIS', date: today },
                { name: 'ใบรับรองแพทย์',         type: 'เวชระเบียน', status: 'PENDING', by: '—',      date: null },
            ],
            timeline: [
                { at: now, tone: 'info', title: 'บันทึกคำขอส่งต่อ', by: f.doctor || byName,
                  note: `เหตุผล: ${MockRefer.reasonMeta(f).label} · เจ้าของไข้ ${f.attending}`
                      + ` · เขียนสรุปทางคลินิก ${REFER_REVIEW_PARTS.length - this.missingReview(f).length}`
                      + `/${REFER_REVIEW_PARTS.length} หัวข้อ · ประเมิน ${MockFmt.baht(f.cap_amount)} บาท` },
                ...(this.hisPulled.length ? [{
                    at: now, tone: 'info', title: `ดึงเวชระเบียนจาก HIS ${this.hisPulled.length} หมวด`,
                    by: 'ระบบ HIS',
                    note: this.hisPulled.map(p => p.label).join(' · '),
                }] : []),
                ...(f.reviewed ? [{
                    at: now, tone: 'success', title: 'เจ้าหน้าที่ตรวจทานคำขอ',
                    by: MockAdmin.userName(f.reviewer),
                    note: f.review_note || 'ตรวจทานความครบถ้วนของคำขอแล้ว',
                }] : []),
            ],
            task_ids: [], owner: f.owner || MockSession.userId(),
            due_at: this._be(f.due) ? this._be(f.due) + 'T16:00' : null,
            status: isOut ? 'DRAFT' : 'RECEIVED',
        };

        if (submitNow) {
            const ok = await Drawer.confirm({
                title: 'บันทึกและส่งขออนุมัติ?',
                message: 'ระบบจะสร้างงานให้ผู้มีอำนาจอนุมัติ พร้อมนับ SLA — ผู้ขออนุมัติเองไม่ได้ (BR-05)',
                lines: [`${r.patient} → ${r.partner_name} · ${MockFmt.baht(r.cap_amount)} บาท`,
                        `เจ้าของไข้ ${f.attending} · เขียนโดย ${f.doctor}`,
                        `ตรวจทานโดย ${MockAdmin.userName(f.reviewer)}`],
                confirmText: 'บันทึกและส่งขออนุมัติ',
                danger: false,
            });
            if (!ok) return;
        }

        MockDB.insert('referrals', r);

        if (submitNow) {
            /* ผู้อนุมัติต้องไม่ใช่ผู้ขอ — กติกาเดียวกับ ReferList.doSubmit()
               กันทั้งคนที่ล็อกอินอยู่และเจ้าหน้าที่ผู้ตรวจทาน เพราะทั้งคู่คือฝั่ง maker */
            const maker    = new Set([MockSession.userId(), f.reviewer].filter(Boolean));
            const free     = u => u.active && !maker.has(u.id);
            const approver = (MockAdmin.users().find(u => free(u) &&
                                (u.roles || []).some(x => /APPROVER/i.test(x))) ||
                              MockAdmin.users().find(free) || {}).id;

            MockRefer.requestApproval(r.id, {
                owner: approver,
                detail: `วงเงินที่ขอ ${MockFmt.baht(r.cap_amount)} บาท · ขอบเขต: ${MockRefer.scopeLabel(r)}\n`
                      + `เจ้าของไข้: ${f.attending} · ผู้เขียนใบส่งต่อ: ${f.doctor}\n`
                      + `ตรวจทานโดย: ${MockAdmin.userName(f.reviewer)}`,
            });
            showToast(`สร้าง ${r.id} และส่งขออนุมัติถึง ${MockAdmin.userName(approver)} แล้ว`);
        } else {
            showToast(isOut ? `บันทึกร่าง ${r.id} แล้ว — ส่งขออนุมัติได้จากหน้าทะเบียน`
                            : `บันทึก ${r.id} แล้ว`);
        }

        location.href = `refer-case.html?id=${encodeURIComponent(r.id)}`;
    },

    async cancel() {
        const ok = await Drawer.confirm({
            title: 'ทิ้งคำขอนี้?',
            message: 'ข้อมูลที่กรอกไว้จะหายทั้งหมด',
            confirmText: 'ทิ้งและออก', danger: true,
        });
        if (ok) location.href = 'refer-worklist.html';
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.ReferNew = ReferNew;
document.addEventListener('DOMContentLoaded', () => ReferNew.init());
