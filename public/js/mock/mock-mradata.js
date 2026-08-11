/**
 * MediCore RCM — MOCK MRADATA (สะพานเกณฑ์ตรวจเวชระเบียน MRA จริง)
 * ------------------------------------------------------------
 * ดึงเกณฑ์ MRA (สปสช.) และผลตรวจของ admission จาก /api
 * แล้วให้หน้า ipd-audit วาดแผงเกณฑ์จริงเพิ่มจากรายการตรวจภายในของต้นแบบ
 *
 * ทำไมเป็น "แผงเพิ่ม" ไม่ใช่แทนที่ของเดิมทันที:
 *   รายการตรวจ 24 ข้อในต้นแบบเป็นเช็กลิสต์ที่คิดขึ้นเอง ส่วน MRA คือเกณฑ์ราชการ
 *   เคสสาธิตทั้ง 7 เคสมีผลตรวจผูกกับเช็กลิสต์เดิมอยู่ ถ้าสลับทันทีหน้าจอสาธิตจะว่าง
 *   จึงแสดงคู่กันก่อน: เกณฑ์จริงมาจากฐานข้อมูล · ของเดิมค่อยเลิกใช้เมื่อย้ายผลตรวจครบ
 *
 * ล้มเงียบเหมือนสะพานตัวอื่น — ไม่มี backend หรือไม่ได้ล็อกอิน = ไม่แสดงแผงนี้
 */
const MockMraData = {

    /** ผลจาก GET /api/ipd/admissions/:id/audit เก็บตาม admission_id */
    cache: new Map(),

    async fetchAudit(admissionId) {
        if (!admissionId) return null;
        if (this.cache.has(admissionId)) return this.cache.get(admissionId);
        try {
            const res = await fetch(`/api/ipd/admissions/${admissionId}/audit`, { dsOptional: true });
            if (!res.ok) return null;
            const data = await res.json();
            this.cache.set(admissionId, data);
            return data;
        } catch (e) { return null; }
    },

    /** บันทึกผลตรวจกลับฐานข้อมูล (ต้องล็อกอินและมีสิทธิ์เขียน) */
    async save(admissionId, { chartItems, fundChecks, rev }) {
        const res = await fetch(`/api/ipd/admissions/${admissionId}/audit`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rev, chart_items: chartItems, fund_checks: fundChecks }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || ('HTTP ' + res.status));
        this.cache.delete(admissionId);
        return body;
    },

    /** แผง HTML ของเกณฑ์ MRA — คืน '' เมื่อไม่มีข้อมูล (หน้าเดิมไม่กระทบ) */
    panelHtml(data) {
        if (!data || !data.components || !data.components.length) return '';
        const applicable = data.components.filter(c => c.applicable);
        const pending = data.score ? data.score.pending_components : 0;

        const stateOf = (c, no) => {
            const it = (c.items || []).find(i => Number(i.criterion_no) === Number(no));
            return it ? it.state : 'MISSING';
        };

        return `
        <div class="section-card">
            <div class="section-header">
                <div class="section-title"><i data-lucide="clipboard-check" class="mi"></i>
                    เกณฑ์ตรวจเวชระเบียนตามมาตรฐาน ${esc(data.mra_version || 'MRA')}
                    <span class="ds-pane-count">${applicable.length}/${data.components.length} องค์ประกอบเข้าเงื่อนไข</span></div>
                <div class="section-actions">
                    <span class="status-badge ${data.audit ? 'active' : 'waiting'}">
                        ${data.audit ? 'ตรวจแล้ว ' + (data.score.pct == null ? '-' : data.score.pct) + '%' : 'ยังไม่ได้ตรวจ'}</span>
                </div>
            </div>
            <p style="font-size:12.5px;color:var(--text-secondary);margin:0 0 10px">
                เกณฑ์นี้มาจากฐานข้อมูลจริง (คู่มือ MRA ของ สปสช.) — องค์ประกอบที่เคสไม่เข้าเงื่อนไข
                นับเป็น N/A และ<strong>ตัดออกจากตัวหาร</strong> ไม่ใช่ให้ 0 คะแนน
                ${pending ? `<br><span style="color:var(--status-warning-strong)">
                    ⚠ ยังถอดเกณฑ์ย่อยจากคู่มือไม่ครบ ${pending} องค์ประกอบ — องค์ประกอบเหล่านั้นคิดคะแนนระดับองค์ประกอบไปก่อน</span>` : ''}
            </p>
            <div class="table-responsive">
                <table class="data-table compact">
                    <thead><tr>
                        <th style="width:1%">#</th><th>องค์ประกอบ / เกณฑ์</th>
                        <th style="width:1%">บังคับ</th><th style="width:1%">สถานะ</th>
                    </tr></thead>
                    <tbody>
                        ${data.components.map(c => `
                        <tr style="${c.applicable ? 'font-weight:600' : 'opacity:.55'}">
                            <td class="td-sub">${esc(c.seq)}</td>
                            <td>${esc(c.name_th)}
                                ${c.criteria_pending
                                    ? ' <span class="sip-chip sip-chip-amber" title="ยังไม่ได้ถอดเกณฑ์ย่อยจากคู่มือ">รอเกณฑ์ย่อย</span>'
                                    : ` <span class="td-sub">(${c.criteria.length} เกณฑ์)</span>`}</td>
                            <td class="td-sub" style="text-align:center">${c.always_required ? 'ทุกเคส' : esc(c.needs || '-')}</td>
                            <td>${c.applicable
                                ? stateChip(stateOf(c, 0) === 'OK' || (c.items || []).some(i => i.state === 'OK') ? 'OK' : 'MISSING')
                                : '<span class="td-sub">N/A</span>'}</td>
                        </tr>
                        ${(c.applicable && c.criteria.length ? c.criteria : []).map(cr => `
                        <tr style="opacity:.9">
                            <td></td>
                            <td style="padding-left:22px" class="td-sub">ข้อ ${esc(cr.criterion_no)} · ${esc(cr.text_th)}</td>
                            <td class="td-sub" style="text-align:center">${esc(cr.score)}</td>
                            <td>${stateChip(stateOf(c, cr.criterion_no))}</td>
                        </tr>`).join('')}`).join('')}
                    </tbody>
                </table>
            </div>
            ${data.fund_checks && data.fund_checks.length ? `
            <div style="margin-top:12px">
                <div class="card-title">เอกสารที่สิทธิ ${esc(data.payer || '-')} บังคับก่อนส่งเบิก</div>
                <div class="table-responsive"><table class="data-table compact">
                    <tbody>${data.fund_checks.map(f => `
                        <tr><td>${esc(f.label_th)}</td><td style="width:1%">${stateChip(f.state)}</td></tr>`).join('')}
                    </tbody>
                </table></div>
            </div>` : ''}
        </div>`;
    },
};

window.MockMraData = MockMraData;
