/* ────────────────────────────────────────────────────────
   อนุมัติวงเงินระดับผู้บริหาร (Executive Budget Approval)

   ชั้นที่ 2 ของสายอนุมัติส่งต่อ — SRS §7 · BR-04/BR-05
     ร่าง → ส่งขออนุมัติ → เจ้าหน้าที่อนุมัติ → [เกินเกณฑ์] → ผู้บริหารอนุมัติ → ออกใบส่งตัว

   ทำไมหน้านี้แยกจาก claim-tasks.html ทั้งที่งานอยู่ในกล่องเดียวกัน:
   ผู้บริหารตัดสินจากการเทียบทั้งคิว ("เดือนนี้กำลังจะผูกพันรวมเท่าไร ก้อนไหนควรผ่านก่อน")
   ถ้าเปิดทีละใบจะไม่มีทางเห็นยอดรวม — งานเดียวกันแต่คนละคำถาม จึงคนละหน้าจอ

   ⚠️ logic การตัดสินทั้งหมดอยู่ที่ MockRefer.execDecide() ไม่ได้เขียนซ้ำที่นี่
      หน้านี้ทำแค่เลือกรายการ ถามเหตุผล แล้วเรียกทีละรายการ
   ──────────────────────────────────────────────────────── */

const ExecApprove = {

    state: { selected: new Set() },

    init() {
        MockSession.mountBanner('demoBanner');
        this.fillFilters();
        this.renderGuard();
        this.render();
        document.getElementById('noteThreshold').textContent =
            MockFmt.baht(REFER_APPROVAL.EXEC_THRESHOLD) + ' บาท';
        refreshIcons();
    },

    reload() { this.state.selected.clear(); this.render(); showToast('รีเฟรชข้อมูลแล้ว'); },

    /* ══════════ ด่านบทบาท ══════════
       ไม่ใช่ระบบสิทธิ์จริง — เป็นการสาธิตว่าโต๊ะนี้เป็นของผู้บริหาร
       และเพื่อให้ผู้ชมเห็นว่าต้องสลับบทบาทถึงจะกดได้ (เหมือน BR-05 ในหน้าอื่น) */

    isExec() {
        const me = MockAdmin.user(MockSession.userId());
        return !!me && (me.roles || []).some(x => REFER_APPROVAL.EXEC_ROLE.test(x));
    },

    renderGuard() {
        const el = document.getElementById('roleGuard');
        if (this.isExec()) {
            el.innerHTML = `
                <div class="sip-banner sip-banner-info" style="margin-bottom:16px">
                    <i data-lucide="user-check" class="icon-sm"></i>
                    <span>คุณอยู่ในบทบาท <strong>${esc(MockSession.roleLabel())}</strong>
                    — ตัดสินวาระในหน้านี้ได้</span>
                </div>`;
            return;
        }
        el.innerHTML = `
            <div class="sip-banner sip-banner-warning" style="margin-bottom:16px">
                <i data-lucide="lock" class="icon-sm"></i>
                <span><strong>โต๊ะนี้เป็นของผู้บริหาร</strong> — บทบาทปัจจุบันคือ
                ${esc(MockSession.roleLabel())} จึงดูได้อย่างเดียว<br>
                <span class="td-sub">สลับเป็น "ผู้บริหาร/เจ้าของกระบวนการ" จากแบนเนอร์ด้านบน
                เพื่อทดลองอนุมัติ</span></span>
                <button class="btn btn-ghost btn-sm" style="margin-left:auto;align-self:flex-start"
                        onclick="MockSession.openRolePicker()">สลับบทบาท</button>
            </div>`;
    },

    /* ══════════ ตัวกรอง ══════════ */

    fillFilters() {
        const rows = MockRefer.execQueue();

        const funds = [...new Set(rows.map(r => r.fund))].sort();
        document.getElementById('fFund').insertAdjacentHTML('beforeend',
            funds.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join(''));

        const partners = [...new Set(rows.map(r => r.partner_name))].sort();
        document.getElementById('fPartner').insertAdjacentHTML('beforeend',
            partners.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join(''));
    },

    visible() {
        const kw      = document.getElementById('searchBox').value.trim().toLowerCase();
        const fund    = document.getElementById('fFund').value;
        const partner = document.getElementById('fPartner').value;

        return MockRefer.execQueue().filter(r => {
            if (fund    !== 'all' && r.fund !== fund) return false;
            if (partner !== 'all' && r.partner_name !== partner) return false;
            if (kw && !(`${r.id} ${r.hn} ${r.patient} ${r.partner_name}`).toLowerCase().includes(kw)) return false;
            return true;
        }).sort((a, b) => b.cap_amount - a.cap_amount);   /* ก้อนใหญ่ขึ้นก่อน — ตรงกับลำดับที่ผู้บริหารสนใจ */
    },

    /* ══════════ แสดงผล ══════════ */

    render() {
        const rows  = this.visible();
        const tbody = document.getElementById('rows');

        /* ล้างรายการที่เลือกไว้แต่หลุดจากตัวกรองแล้ว ไม่งั้นจะเผลออนุมัติของที่มองไม่เห็น */
        const shown = new Set(rows.map(r => r.id));
        [...this.state.selected].forEach(id => { if (!shown.has(id)) this.state.selected.delete(id); });

        tbody.innerHTML = rows.length ? rows.map(r => {
            const task  = MockRefer.execTask(r.id);
            const flags = MockRefer.flags(r);
            return `
            <tr>
                <td>
                    <input type="checkbox" ${this.state.selected.has(r.id) ? 'checked' : ''}
                           onclick="ExecApprove.toggle('${esc(r.id)}', this)"></td>
                <td class="td-sub" style="cursor:pointer" onclick="ExecApprove.open('${esc(r.id)}')">${esc(r.id)}</td>
                <td class="td-name" style="cursor:pointer" onclick="ExecApprove.open('${esc(r.id)}')">
                    ${esc(r.patient)}
                    <div class="td-sub">HN ${esc(r.hn)} · ${esc(r.age)} ปี · สิทธิ ${esc(r.fund)}
                        · ${esc((r.dx || [])[0] ? r.dx[0].code : '—')}</div></td>
                <td>${esc(r.partner_name)}
                    <div class="td-sub">${esc(r.partner_level)}</div></td>
                <td>${esc(MockRefer.scopeLabel(r))}</td>
                <td style="text-align:right"><strong>${esc(MockFmt.baht(r.cap_amount))}</strong></td>
                <td style="text-align:right;color:var(--status-danger)">
                    +${esc(MockFmt.baht(MockRefer.execExcess(r)))}</td>
                <td>${esc(r.ops_approver ? MockAdmin.userName(r.ops_approver) : '—')}
                    <div class="td-sub">${esc(MockFmt.dateTimeTH(r.ops_approved_at))}</div></td>
                <td>${flags.length
                    ? flags.map(f => `<span class="sip-chip ${
                        f.level === 'ERROR' ? 'sip-chip-danger'
                        : f.level === 'WARNING' ? 'sip-chip-amber' : 'sip-chip-muted'
                      }" title="${esc(f.detail)}">${esc(f.label)}</span>`).join(' ')
                    : '<span class="sip-chip sip-chip-success">ไม่พบประเด็น</span>'}</td>
                <td>${task ? MockTone.slaHtml(task.due_at) : MockTone.slaHtml(r.due_at)}</td>
                <td><button class="ds-icon-btn" title="ดูรายละเอียด"
                        onclick="ExecApprove.open('${esc(r.id)}')">
                        <i data-lucide="eye" class="icon-sm"></i></button></td>
            </tr>`;
        }).join('')
        : `<tr><td colspan="11" class="ds-empty">
             ไม่มีวาระรอตัดสิน — คำขอที่วงเงินไม่เกิน
             ${esc(MockFmt.baht(REFER_APPROVAL.EXEC_THRESHOLD))} บาท จบที่ชั้นเจ้าหน้าที่</td></tr>`;

        document.getElementById('rowCount').textContent = rows.length + ' รายการ';
        this.renderKpi(rows);
        refreshIcons();
    },

    /** KPI derive จากแถวที่เห็นจริง — ห้าม hardcode (PAGE-GUIDE §7B) */
    renderKpi(rows) {
        const overdue = rows.filter(r => {
            const t = MockRefer.execTask(r.id);
            return MockTone.sla(t ? t.due_at : r.due_at) === 'over';
        }).length;

        document.getElementById('kpiCount').textContent   = rows.length;
        document.getElementById('kpiTotal').textContent   =
            MockFmt.baht(rows.reduce((a, r) => a + (r.cap_amount || 0), 0));
        document.getElementById('kpiExcess').textContent  =
            MockFmt.baht(rows.reduce((a, r) => a + MockRefer.execExcess(r), 0));
        document.getElementById('kpiOverdue').textContent = overdue;
    },

    open(id) { location.href = 'refer-case.html?id=' + encodeURIComponent(id); },

    toggle(id, el) {
        if (el.checked) this.state.selected.add(id); else this.state.selected.delete(id);
        this.render();
    },

    toggleAll(el) {
        this.state.selected.clear();
        if (el.checked) this.visible().forEach(r => this.state.selected.add(r.id));
        this.render();
    },

    /* ══════════ ตัดสิน ══════════ */

    async decideSelected(approve) {
        if (!this.isExec()) {
            showToast('ต้องอยู่ในบทบาทผู้บริหารจึงจะตัดสินวาระนี้ได้', 'warning');
            return;
        }

        const rows = [...this.state.selected].map(id => MockRefer.byId(id)).filter(Boolean);
        if (!rows.length) { showToast('ยังไม่ได้เลือกรายการ', 'warning'); return; }

        /* ผู้บริหารต้องไม่ใช่ผู้อนุมัติชั้นแรก (BR-05) — กันไว้ถึงในเดโมจะไม่เกิด */
        const me      = MockSession.userId();
        const selfOps = rows.filter(r => r.ops_approver === me);
        if (selfOps.length) {
            showToast(`คุณเป็นผู้อนุมัติชั้นแรกของ ${selfOps.length} รายการ — ตัดสินซ้ำเองไม่ได้ (BR-05)`, 'warning');
            return;
        }

        const total = rows.reduce((a, r) => a + (r.cap_amount || 0), 0);

        Drawer.open({
            title: approve ? `อนุมัติวงเงิน ${rows.length} รายการ` : `ตีกลับ ${rows.length} รายการ`,
            contentHtml: `
                <div class="sip-banner ${approve ? 'sip-banner-info' : 'sip-banner-warning'}"
                     style="margin-bottom:14px">
                    <i data-lucide="${approve ? 'check-circle-2' : 'corner-up-left'}" class="icon-sm"></i>
                    <span>${approve
                        ? `จะผูกพันงบตามจ่ายรวม <strong>${esc(MockFmt.baht(total))} บาท</strong>
                           และออกเลขที่ใบส่งตัวกับเลขอนุมัติให้ทันที`
                        : `จะส่งเรื่องกลับให้ทบทวน — สถานะเปลี่ยนเป็น <strong>ไม่อนุมัติ</strong>
                           และยังไม่มีการออกเลขอนุมัติ`}</span>
                </div>

                <table class="data-table compact"><thead><tr>
                    <th>รายการ</th><th style="text-align:right">วงเงิน</th><th style="text-align:right">เกินเกณฑ์</th>
                </tr></thead><tbody>${rows.map(r => `<tr>
                    <td>${esc(r.patient)}<div class="td-sub">${esc(r.id)} → ${esc(r.partner_name)}</div></td>
                    <td style="text-align:right">${esc(MockFmt.baht(r.cap_amount))}</td>
                    <td style="text-align:right;color:var(--status-danger)">
                        +${esc(MockFmt.baht(MockRefer.execExcess(r)))}</td>
                </tr>`).join('')}</tbody></table>

                <div class="sip-field" style="margin-top:14px">
                    <label class="sip-label">เหตุผลประกอบการตัดสิน *</label>
                    <textarea class="sip-textarea" id="xReason" rows="4" placeholder="${esc(approve
                        ? 'เช่น จำเป็นทางคลินิก ไม่มีทางเลือกที่ถูกกว่า และอยู่ในกรอบงบตามจ่ายของงวด'
                        : 'เช่น ขอให้เทียบอัตรากับโรงพยาบาลรัฐก่อน หรือขอเอกสารเพิ่ม')}"></textarea>
                </div>
                <div class="ds-note"><i data-lucide="shield-check" class="icon-sm"></i>
                    ระบบจะบันทึกผู้ตัดสิน เวลา และเหตุผลลง Audit Trail ซึ่งลบไม่ได้ (BR-04)
                    — เหตุผลเดียวกันนี้จะถูกใส่ให้ทุกรายการที่เลือก</div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                <button class="btn ${approve ? 'btn-save' : 'btn-danger'}"
                        onclick="ExecApprove.confirmDecide(${approve})">
                    ${approve ? 'อนุมัติทั้งหมด' : 'ตีกลับทั้งหมด'}</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    confirmDecide(approve) {
        const reason = document.getElementById('xReason').value.trim();
        if (!reason) { showToast('ต้องระบุเหตุผลประกอบการตัดสิน (BR-04)', 'warning'); return; }

        const ids  = [...this.state.selected];
        let done = 0, skipped = 0;
        ids.forEach(id => { MockRefer.execDecide(id, approve, reason) ? done++ : skipped++; });

        Drawer.close();
        this.state.selected.clear();
        document.getElementById('chkAll').checked = false;
        this.render();

        showToast(skipped
            ? `${approve ? 'อนุมัติ' : 'ตีกลับ'} ${done} รายการ — อีก ${skipped} รายการไม่มีงานอนุมัติค้างอยู่`
            : `${approve ? 'อนุมัติ' : 'ตีกลับ'} ${done} รายการแล้ว — บันทึกลง Audit Trail`,
            skipped ? 'warning' : 'success');
    },

    /* ══════════ ใบพิมพ์วาระอนุมัติ ══════════ */

    buildReport() {
        const C = DocParts.CELL;
        const warnings = [];
        const rows = this.visible();

        const th = (t, w) => `<th style="${C}font-size:11px;font-weight:700;text-align:center;`
                           + `${w ? 'width:' + w + ';' : ''}">${DocParts.esc(t)}</th>`;

        const body = rows.map((r, i) => `<tr>
            <td style="${C}text-align:center;">${i + 1}</td>
            <td style="${C}">${DocParts.esc(r.id)}</td>
            <td style="${C}">${DocParts.esc(r.patient)}
                <div style="font-size:10px">HN ${DocParts.esc(r.hn)} · สิทธิ ${DocParts.esc(r.fund)}</div></td>
            <td style="${C}">${DocParts.esc(r.partner_name)}</td>
            <td style="${C}">${DocParts.esc(MockRefer.scopeLabel(r))}</td>
            <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(r.cap_amount))}</td>
            <td style="${C}text-align:right;">${DocParts.esc(MockFmt.baht(MockRefer.execExcess(r)))}</td>
            <td style="${C}" class="${DocPrint.miss(
                r.ops_approver && MockAdmin.userName(r.ops_approver),
                'ผู้อนุมัติชั้นเจ้าหน้าที่ของ ' + r.id, warnings)}">
                ${DocParts.esc(r.ops_approver ? MockAdmin.userName(r.ops_approver) : '')}</td>
            <td style="${C}"></td>
        </tr>`).join('');

        const fields = [
            ['เกณฑ์ยกระดับ', MockFmt.baht(REFER_APPROVAL.EXEC_THRESHOLD) + ' บาท'],
            ['จำนวนวาระ', rows.length + ' รายการ'],
            ['วงเงินรวมที่เสนอ', MockFmt.baht(rows.reduce((a, r) => a + (r.cap_amount || 0), 0)) + ' บาท'],
            ['ส่วนที่เกินเกณฑ์รวม', MockFmt.baht(rows.reduce((a, r) => a + MockRefer.execExcess(r), 0)) + ' บาท'],
            ['ผู้พิมพ์', MockSession.user().full_name],
        ];

        const html = `<div style="color:#000;font-size:12px;">
            ${DocParts.docHead({ title: 'วาระขออนุมัติวงเงินการส่งต่อ (ระดับผู้บริหาร)',
                                 formCode: 'REF-EXEC/2569', fields })}
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>
                    ${th('ลำดับ', '30px')}${th('รหัส', '96px')}${th('ผู้ป่วย', '20%')}${th('ปลายทาง', '18%')}
                    ${th('ขอบเขต')}${th('วงเงินที่ขอ', '74px')}${th('เกินเกณฑ์', '70px')}
                    ${th('อนุมัติชั้นแรก', '92px')}${th('มติ', '64px')}
                </tr></thead>
                <tbody>${DocParts.fillRows(body, 14, 9)}</tbody>
            </table>
            ${DocParts.signatureBlock(['ลงชื่อ ผู้เสนอวาระ', 'ลงชื่อ ผู้บริหารผู้อนุมัติ'])}
            ${DocParts.footer(fields)}
        </div>`;

        return { html: DocParts.toPrintBorders(html), warnings };
    },

    openPrint() {
        if (!this.visible().length) { showToast('ยังไม่มีวาระให้พิมพ์', 'warning'); return; }
        const { html, warnings } = this.buildReport();
        DocPrint.preview({ title: 'ตัวอย่างก่อนพิมพ์ — วาระขออนุมัติวงเงิน', html, warnings });
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.ExecApprove = ExecApprove;
document.addEventListener('DOMContentLoaded', () => ExecApprove.init());
