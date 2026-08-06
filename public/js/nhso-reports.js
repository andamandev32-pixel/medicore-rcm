/* ────────────────────────────────────────────────────────
   ส่งเบิก NHSO — รายงาน / Statement

   สี่ประเภทรายงานตรงตามหน้าจอจริงของ NHSO Digital Platform
   กติการหัสผ่านไฟล์ยกมาตามเอกสารทุกตัวอักษร — เจ้าหน้าที่ถามเรื่องนี้บ่อยที่สุด
   ──────────────────────────────────────────────────────── */

const Reports = {

    state: { type: 'TRANSACTION' },

    init() {
        MockSession.mountBanner('demoBanner');
        document.getElementById('pwdRule').innerHTML =
            `<strong>รหัสผ่านเปิดไฟล์ที่ดาวน์โหลด:</strong> ${esc(NHSO_REPORT_PASSWORD_RULE)}`;
        this.fillFilters();
        this.renderSeg();
        this.render();
    },

    fillFilters() {
        const periods = [...new Set(MOCK_NHSO_REPORTS.map(r => r.period))];
        document.getElementById('fPeriod').insertAdjacentHTML('beforeend',
            periods.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join(''));
        const funds = [...new Set(MOCK_NHSO_REPORTS.map(r => r.fund))];
        document.getElementById('fFund').insertAdjacentHTML('beforeend',
            funds.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join(''));
    },

    renderSeg() {
        document.getElementById('segType').innerHTML = NHSO_REPORT_TYPES.map(t => {
            const n = MOCK_NHSO_REPORTS.filter(r => r.type === t.key).length;
            return `<button class="ds-seg ${t.key === this.state.type ? 'active' : ''}"
                onclick="Reports.setType('${esc(t.key)}')" title="${esc(t.desc)}">
                ${esc(t.label)} (${n})</button>`;
        }).join('');
    },

    setType(k) { this.state.type = k; this.renderSeg(); this.render(); },

    visible() {
        const period = document.getElementById('fPeriod').value;
        const fund   = document.getElementById('fFund').value;
        return MOCK_NHSO_REPORTS.filter(r => {
            if (r.type !== this.state.type) return false;
            if (period !== 'all' && r.period !== period) return false;
            if (fund !== 'all' && r.fund !== fund) return false;
            return true;
        });
    },

    render() {
        const t = NHSO_REPORT_TYPES.find(x => x.key === this.state.type) || {};
        document.getElementById('typeTitle').textContent = t.label || 'รายงาน';

        const rows = this.visible();
        document.getElementById('rowCount').textContent = rows.length + ' รายการ';
        document.getElementById('rows').innerHTML = rows.length ? rows.map(r => {
            const st = NHSO_REPORT_STATUS[r.status] || { badge: 'pending', label: r.status };
            return `<tr>
                <td class="td-sub" style="white-space:nowrap">${esc(r.id)}</td>
                <td class="td-name">${esc(r.name)}
                    <div class="td-sub">${esc(t.desc || '')}</div></td>
                <td class="td-sub" style="white-space:nowrap">${esc(r.period)}</td>
                <td><span class="sip-chip sip-chip-muted">${esc(r.fund)}</span></td>
                <td class="td-sub" style="white-space:nowrap">${esc(MockFmt.dateTH(r.created))}</td>
                <td style="text-align:right">${MockFmt.int(r.rows)}</td>
                <td style="text-align:right;white-space:nowrap"><strong>${esc(MockFmt.baht(r.amount))}</strong></td>
                <td><span class="status-badge ${esc(st.badge)}">${esc(st.label)}</span></td>
                <td style="white-space:nowrap">
                    <button class="ds-icon-btn edit" title="ดาวน์โหลด Excel"
                        onclick="Reports.download('${esc(r.id)}')">
                        <i data-lucide="download" class="icon-sm"></i></button>
                </td>
            </tr>`;
        }).join('') : '<tr><td colspan="9" class="ds-empty">ไม่พบรายงานตามเงื่อนไข</td></tr>';

        this.renderRecon();
        refreshIcons();
    },

    renderRecon() {
        DSChart.bars('chartRecon', {
            title: 'ยอดพึงรับเทียบยอดที่จ่ายจริง',
            labels: MOCK_NHSO_RECON.map(r => r.period),
            yFmt: v => MockFmt.baht(v, { short: true }),
            series: [
                { name: 'ยอดพึงรับ',      values: MOCK_NHSO_RECON.map(r => r.expect), color: 'var(--primary)' },
                { name: 'ยอดที่จ่ายจริง', values: MOCK_NHSO_RECON.map(r => r.paid),   color: 'var(--status-success)' },
            ],
        });

        document.getElementById('reconRows').innerHTML = MOCK_NHSO_RECON.map(r => {
            const diff = r.expect - r.paid;
            const pct  = (r.paid / r.expect) * 100;
            return `<tr>
                <td>${esc(r.period)}</td>
                <td style="text-align:right">${esc(MockFmt.baht(r.expect))}</td>
                <td style="text-align:right">${esc(MockFmt.baht(r.paid))}</td>
                <td style="text-align:right;color:var(--status-danger)"><strong>${esc(MockFmt.baht(diff))}</strong></td>
                <td style="text-align:right">${MockFmt.pct(pct, 1)}</td>
            </tr>`;
        }).join('')
        + (() => {
            const e = MOCK_NHSO_RECON.reduce((a, r) => a + r.expect, 0);
            const p = MOCK_NHSO_RECON.reduce((a, r) => a + r.paid, 0);
            return `<tr style="background:var(--brand-bg-strong);font-weight:700">
                <td>รวม</td>
                <td style="text-align:right">${esc(MockFmt.baht(e))}</td>
                <td style="text-align:right">${esc(MockFmt.baht(p))}</td>
                <td style="text-align:right;color:var(--status-danger)">${esc(MockFmt.baht(e - p))}</td>
                <td style="text-align:right">${MockFmt.pct((p / e) * 100, 1)}</td>
            </tr>`;
        })();
    },

    /** สาธิตกติการหัสผ่านไฟล์ให้เห็นกับผู้ใช้จริง แทนที่จะให้ไปอ่านคู่มือ */
    download(id) {
        const r = MOCK_NHSO_REPORTS.find(x => x.id === id); if (!r) return;
        const u = MockSession.user();
        const uname = (MockAdmin.users().find(x => x.name === u.full_name) || {}).username || 'claim01';
        const pwd = uname.toLowerCase() + '12345';

        Drawer.open({
            title: 'ดาวน์โหลดรายงาน — ' + r.name,
            contentHtml: `
                <table class="ds-table-grid">
                    <tbody>
                        <tr><td class="l" style="width:32%">รหัสรายงาน</td><td class="l">${esc(r.id)}</td></tr>
                        <tr><td class="l">งวด</td><td class="l">${esc(r.period)}</td></tr>
                        <tr><td class="l">กองทุน</td><td class="l">${esc(r.fund)}</td></tr>
                        <tr><td class="l">จำนวนรายการ</td><td class="l">${MockFmt.int(r.rows)} รายการ</td></tr>
                        <tr><td class="l">ยอดรวม</td><td class="l"><strong>${esc(MockFmt.baht(r.amount))}</strong> บาท</td></tr>
                        <tr><td class="l">รูปแบบไฟล์</td><td class="l">Excel (.xlsx) บีบอัดและตั้งรหัสผ่าน</td></tr>
                    </tbody>
                </table>

                <div class="sip-banner sip-banner-warning" style="margin-bottom:12px">
                    <i data-lucide="key-round" class="icon-sm"></i>
                    <span>${esc(NHSO_REPORT_PASSWORD_RULE)}</span>
                </div>

                <div class="ds-section-label">รหัสผ่านสำหรับผู้ใช้ที่ล็อกอินอยู่</div>
                <div class="ds-block" style="font-family:var(--font-mono);font-size:14px;letter-spacing:.05em">
                    <i data-lucide="lock" class="icon-sm"></i>
                    <strong>${esc(pwd)}</strong>
                    <span class="td-sub" style="margin-left:8px">
                        = ${esc(uname.toLowerCase())} + เลขบัตรประชาชน 5 หลักท้าย</span>
                </div>

                <div class="ds-note"><i data-lucide="info" class="icon-sm"></i>
                    ระบบแสดงรหัสผ่านตามสูตรให้ทันทีที่กดดาวน์โหลด เพื่อลดการโทรถามศูนย์คอมพิวเตอร์
                    — เป็นตัวอย่างของการเอาความรู้ที่อยู่ในคู่มือมาไว้ตรงจุดที่ผู้ใช้ต้องใช้จริง</div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ปิด</button>
                         <button class="btn btn-primary"
                            onclick="Drawer.close();showToast('ตัวอย่างเท่านั้น — ยังไม่ผูกไฟล์จริง','info')">
                            ดาวน์โหลด Excel</button>`,
            onOpen: () => refreshIcons(),
        });
    },

    generate() {
        const t = NHSO_REPORT_TYPES.find(x => x.key === this.state.type) || {};
        Drawer.open({
            title: 'สร้างรายงานใหม่ — ' + t.label,
            contentHtml: `
                <div class="sip-field-row">
                    <div class="sip-field">
                        <label class="sip-label">ประเภทรายงาน</label>
                        <select class="sip-select">${NHSO_REPORT_TYPES.map(x =>
                            `<option ${x.key === this.state.type ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
                    </div>
                    <div class="sip-field">
                        <label class="sip-label">งวด</label>
                        <select class="sip-select"><option>ส.ค. 2569</option><option>ก.ค. 2569</option>
                            <option>มิ.ย. 2569</option></select>
                    </div>
                </div>
                <div class="sip-field-row">
                    <div class="sip-field">
                        <label class="sip-label">กองทุน</label>
                        <select class="sip-select"><option>ทุกกองทุน</option><option>UC</option>
                            <option>OFC</option><option>SSS</option><option>LGO</option><option>EMS</option></select>
                    </div>
                    <div class="sip-field">
                        <label class="sip-label">หน่วยบริการ</label>
                        <select class="sip-select"><option>ทุกหน่วยบริการ</option>
                            ${NHSO_PROVIDERS.map(p => `<option>${esc(p.name)}</option>`).join('')}</select>
                    </div>
                </div>
                <div class="ds-note"><i data-lucide="clock" class="icon-sm"></i>
                    รายงานงวดใหญ่ใช้เวลาประมวลผลสักครู่ ระบบจะแจ้งเตือนเมื่อพร้อมดาวน์โหลด</div>`,
            footerHtml: `<button class="btn btn-outline" onclick="Drawer.close()">ยกเลิก</button>
                         <button class="btn btn-primary"
                            onclick="Drawer.close();showToast('ส่งคำขอสร้างรายงานแล้ว (โหมดสาธิต)')">
                            สร้างรายงาน</button>`,
            onOpen: () => refreshIcons(),
        });
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.Reports = Reports;
document.addEventListener('DOMContentLoaded', () => Reports.init());
