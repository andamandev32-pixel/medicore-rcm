/* ────────────────────────────────────────────────────────
   คลังความรู้ (Knowledge Center / RAG) — SRS §10 · FR-05

   BR-06: ทุกคำตอบต้องแสดงแหล่งอ้างอิง และต้องแจ้งเมื่อหลักฐานไม่เพียงพอ
   BR-07: AI เสนอแนะได้ แต่ไม่เปิดใช้กฎหรืออนุมัติเคสเอง

   จุดสาธิต: ลองถามคำถามที่ไม่มีในเอกสาร — ระบบต้อง "ปฏิเสธเป็น"
   ──────────────────────────────────────────────────────── */

const Knowledge = {

    state: { doc: null, filter: 'all', tab: 'ask', answer: null },

    TABS: [
        { key: 'ask',     label: 'ค้นถาม',              icon: 'search' },
        { key: 'content', label: 'เนื้อหาเอกสาร',        icon: 'file-text' },
        { key: 'rules',   label: 'กฎที่อ้างอิงเอกสารนี้', icon: 'git-branch' },
    ],

    SUGGESTED: [
        'เบิกยาหมวด BILLGRCS 03 ต้องดูราคาจากที่ไหน และถ้าเกินจะเป็นอย่างไร',
        'เลขปิดสิทธิ UCS ไม่ตรงกับฐานข้อมูล หน่วยบริการต้องทำอย่างไร',
        'รหัสหัตถการไม่สอดคล้องกับการวินิจฉัย จะได้รหัสอะไรกลับมา',
        'แฟ้ม 15 (LVD) กรณีลากลับบ้าน เริ่มบังคับใช้เมื่อไหร่',
        'เบิกค่าบริการทันตกรรมจัดฟันในสิทธิบัตรทองได้หรือไม่',
    ],

    init() {
        MockSession.mountBanner('demoBanner');
        const p = new URLSearchParams(location.search);
        this.state.doc = p.get('doc');
        if (this.state.doc) this.state.tab = 'content';

        this.fillTypes();
        this.renderPills();
        this.renderList();
        this.renderContext();
        this.renderTabBar();
        this.renderTab();
        refreshIcons();
    },

    current() { return this.state.doc ? MockKnowledge.byId(this.state.doc) : null; },

    /* ══════════ ซ้าย ══════════ */

    fillTypes() {
        document.getElementById('fType').insertAdjacentHTML('beforeend',
            DOC_TYPES.map(t => `<option value="${esc(t.key)}">${esc(t.label)}</option>`).join(''));
    },

    renderPills() {
        const all = MockKnowledge.docs().length;
        const st = ['ACTIVE', 'FUTURE', 'EXPIRED'];
        document.getElementById('pillTabs').innerHTML =
            `<button class="ds-pilltab ${this.state.filter === 'all' ? 'active' : ''}"
                onclick="Knowledge.setFilter('all')">ทั้งหมด <span class="tab-count">${all}</span></button>` +
            st.map(s => `<button class="ds-pilltab ${this.state.filter === s ? 'active' : ''}"
                onclick="Knowledge.setFilter('${s}')">
                ${esc(DOC_STATUS[s].label)} <span class="tab-count">${MockKnowledge.byStatus(s).length}</span></button>`).join('');
    },

    setFilter(k) { this.state.filter = k; this.renderPills(); this.renderList(); refreshIcons(); },

    visible() {
        const kw = (document.getElementById('listSearch').value || '').trim().toLowerCase();
        const ty = document.getElementById('fType').value;
        return MockKnowledge.docs().filter(d => {
            if (this.state.filter !== 'all' && d.status !== this.state.filter) return false;
            if (ty !== 'all' && d.type !== ty) return false;
            if (kw && !(`${d.title} ${d.no} ${d.id}`).toLowerCase().includes(kw)) return false;
            return true;
        });
    },

    renderList() {
        const rows = this.visible();
        document.getElementById('listCount').textContent = rows.length + ' ฉบับ';
        document.getElementById('listContainer').innerHTML = rows.length
            ? rows.map(d => `
                <div class="ds-list-card ${d.id === this.state.doc ? 'active' : ''}"
                     onclick="Knowledge.selectDoc('${esc(d.id)}')">
                    <div class="ds-list-card-top">
                        <span class="td-sub">${esc(d.no)}</span>
                        <span class="sip-chip ${esc(DOC_STATUS[d.status].chip)}">${esc(DOC_STATUS[d.status].label)}</span>
                    </div>
                    <div class="ds-list-card-name" style="font-size:12px">${esc(d.title)}</div>
                    <div class="ds-list-card-detail">
                        มีผล ${esc(MockFmt.dateTH(d.effective_from))}${
                            d.effective_to ? ' – ' + esc(MockFmt.dateTH(d.effective_to)) : ''}
                    </div>
                </div>`).join('')
            : '<div class="ds-empty">ไม่พบเอกสาร</div>';
        refreshIcons();
    },

    toggleLeft() { document.getElementById('shell').classList.toggle('left-collapsed'); },

    selectDoc(id) {
        this.state.doc = id;
        this.state.tab = 'content';
        history.replaceState(null, '', 'claim-knowledge.html?doc=' + encodeURIComponent(id));
        this.renderContext();
        this.renderTabBar();
        this.renderTab();
        this.renderList();
        refreshIcons();
    },

    renderContext() {
        const d = this.current();
        document.getElementById('ctxName').textContent = d ? d.title : 'คลังความรู้และหลักเกณฑ์';
        document.getElementById('ctxChip').innerHTML = d
            ? `<span class="sip-chip ${esc(DOC_STATUS[d.status].chip)}">${esc(DOC_STATUS[d.status].label)}</span>` : '';
        document.getElementById('ctxMeta').innerHTML = d ? `
            <span>${esc(d.no)}</span>
            <span>ผู้ออก: ${esc(d.issuer)}</span>
            <span>มีผล: ${esc(MockFmt.dateTH(d.effective_from))}${
                d.effective_to ? ' – ' + esc(MockFmt.dateTH(d.effective_to)) : ' เป็นต้นไป'}</span>
            <span>Version ${esc(d.version)}</span>`
            : `<span>${MockKnowledge.docs().length} ฉบับ</span>
               <span>ตอบเฉพาะจากเอกสารที่มีสิทธิ์และมีผลกับบริบท</span>`;
    },

    renderTabBar() {
        document.getElementById('tabBar').innerHTML = this.TABS.map(t => `
            <button class="ds-tab ${t.key === this.state.tab ? 'active' : ''}"
                onclick="Knowledge.switchTab('${t.key}')">
                <i data-lucide="${t.icon}" class="mi"></i> ${esc(t.label)}</button>`).join('');
    },

    switchTab(k) { this.state.tab = k; this.renderTabBar(); this.renderTab(); refreshIcons(); },

    renderTab() {
        const fn = { ask: () => this.tabAsk(), content: () => this.tabContent(), rules: () => this.tabRules() }[this.state.tab];
        document.getElementById('tabContent').innerHTML = fn ? fn() : '';
        refreshIcons();
    },

    /* ══════════ แท็บค้นถาม ══════════ */

    tabAsk() {
        const a = this.state.answer;
        return `
        <div class="section-card">
            <div class="section-title" style="margin-bottom:10px">
                <i data-lucide="message-circle-question" class="mi"></i> ถามหลักเกณฑ์เป็นภาษาไทย</div>
            <div class="sip-field">
                <textarea class="sip-textarea" id="qBox" rows="3"
                    placeholder="เช่น เบิกยาหมวด BILLGRCS 03 ต้องดูราคาจากที่ไหน...">${esc(a ? a.q : '')}</textarea>
            </div>
            <div class="ds-chips" style="margin-bottom:10px">
                ${this.SUGGESTED.map(q => `<span class="ds-chip-suggest"
                    onclick="Knowledge.ask(${JSON.stringify(q).replace(/"/g, '&quot;')})">${esc(q)}</span>`).join('')}
            </div>
            <button class="btn btn-primary" onclick="Knowledge.ask()">
                <i data-lucide="search" class="icon-sm"></i> ค้นคำตอบ</button>
            <span class="td-sub" style="margin-left:10px">
                ระบบตอบจากเอกสารที่รับรองแล้วเท่านั้น และแสดงแหล่งอ้างอิงทุกครั้ง</span>
        </div>

        ${a ? this.answerHtml(a) : `
        <div class="ds-note">
            <i data-lucide="shield-check" class="icon-sm"></i>
            <strong>หลักการของคลังความรู้นี้:</strong> ตอบเฉพาะจากเอกสารที่มีสิทธิ์เข้าถึงและมีผลกับบริบทนั้น ·
            แสดงชื่อเอกสาร หน้า/หัวข้อ และวันที่มีผลทุกคำตอบ ·
            <strong>แจ้งเมื่อหลักฐานไม่เพียงพอแทนการเดา</strong> (BR-06) ·
            AI เสนอแนะได้ แต่ไม่เปิดใช้กฎหรืออนุมัติเคสเอง (BR-07)
        </div>`}`;
    },

    answerHtml(a) {
        if (a.insufficient) {
            return `
            <div class="sip-banner sip-banner-warning" style="margin-bottom:12px">
                <i data-lucide="help-circle" class="icon-sm"></i>
                <span><strong>หลักฐานไม่เพียงพอ</strong> — ไม่พบเอกสารที่ครอบคลุมคำถามนี้ในช่วงเวลาที่สอบถาม</span>
            </div>
            <div class="section-card">
                <div class="section-title" style="margin-bottom:8px">
                    <i data-lucide="message-square" class="mi"></i> คำตอบ</div>
                <div style="font-size:13px;line-height:1.85;color:var(--text-secondary)">${esc(a.answer)}</div>
                <div class="ds-note" style="margin-top:12px">
                    <i data-lucide="lightbulb" class="icon-sm"></i>
                    การปฏิเสธเป็นคือสิ่งที่ทำให้คำตอบอื่นเชื่อถือได้ — ถ้าระบบตอบทุกคำถามได้เสมอ
                    ผู้ใช้จะไม่มีทางรู้ว่าคำตอบไหนมีหลักฐานจริง
                    <br>แนะนำ: เพิ่มเอกสารที่เกี่ยวข้องเข้าคลังความรู้ แล้วให้ผู้รับรองยืนยันก่อนใช้อ้างอิง
                </div>
            </div>`;
        }

        return `
        <div class="section-card">
            <div class="section-header">
                <div class="section-title"><i data-lucide="message-square" class="mi"></i> คำตอบ</div>
                <div class="section-actions">
                    <span class="sip-chip ${a.confidence === 'สูง' ? 'sip-chip-success' : 'sip-chip-amber'}">
                        ความมั่นใจ${esc(a.confidence)}</span>
                    <span class="sip-chip sip-chip-muted">อ้างอิง ${a.citations.length} แหล่ง</span>
                </div>
            </div>
            <div style="font-size:13px;line-height:1.9;color:var(--text-secondary)">
                ${a.answer.replace(/\[(\d)\]/g, (m, n) =>
                    `<a href="javascript:void(0)" onclick="Knowledge.focusCite(${n - 1})"
                        style="display:inline-block;min-width:18px;text-align:center;background:var(--primary-bg);
                        color:var(--primary-dark);border-radius:4px;font-size:11px;font-weight:700;
                        text-decoration:none;padding:0 4px">${n}</a>`)}
            </div>
        </div>
        ${a.rules && a.rules.length ? `
        <div class="section-card">
            <div class="section-title" style="margin-bottom:8px">
                <i data-lucide="git-branch" class="mi"></i> กฎในระบบที่บังคับใช้หลักเกณฑ์นี้แล้ว</div>
            ${a.rules.map(id => {
                const r = MockRules.byId(id);
                return r ? `<div class="ds-block" style="cursor:pointer;margin-bottom:6px"
                    onclick="location.href='claim-rules.html?rule=${encodeURIComponent(r.id)}'">
                    <strong>${esc(r.id)} v${esc(r.version)}</strong> — ${esc(r.name)}
                    ${MockTone.lifecycleHtml(r.status)}
                    ${r.maps_to_nhso ? `<span class="sip-chip sip-chip-danger">ดัก ${esc(r.maps_to_nhso)}</span>` : ''}
                </div>` : '';
            }).join('')}
        </div>` : ''}`;
    },

    ask(preset) {
        const box = document.getElementById('qBox');
        const q = (preset != null ? preset : (box ? box.value : '')).trim();
        if (!q) { showToast('กรุณาพิมพ์คำถาม', 'warning'); return; }

        const found = MockKnowledge.search(q);
        this.state.answer = { ...found, q };
        this.state.tab = 'ask';
        this.renderTabBar();
        this.renderTab();
        this.renderCitations();
        refreshIcons();
    },

    renderCitations() {
        const a = this.state.answer;
        const pane = document.getElementById('citePane');
        const cites = (a && a.citations) || [];
        document.getElementById('citeCount').textContent = cites.length + ' แหล่ง';

        if (!cites.length) {
            pane.innerHTML = a
                ? `<div class="sip-banner sip-banner-warning">
                       <i data-lucide="alert-triangle" class="icon-sm"></i>
                       ไม่มีแหล่งอ้างอิง — ระบบไม่ยืนยันคำตอบนี้</div>`
                : '<div class="ds-empty">ถามคำถามเพื่อดูแหล่งอ้างอิง</div>';
            refreshIcons();
            return;
        }

        pane.innerHTML = cites.map((c, i) => {
            const d = MockKnowledge.byId(c.doc_id) || {};
            return `<div class="clinical-card" id="cite-${i}" style="margin-bottom:10px">
                <div class="card-title" style="display:flex;align-items:center;gap:6px">
                    <span style="background:var(--primary);color:#fff;border-radius:4px;
                        min-width:18px;text-align:center;font-size:11px">${i + 1}</span>
                    ${esc(d.no || c.doc_id)}
                </div>
                <div style="font-size:12px;font-weight:700;color:var(--brand-navy);margin-bottom:4px">
                    ${esc(d.title || '')}</div>
                <div class="td-sub" style="margin-bottom:6px">
                    ${esc(c.ref)} · มีผล ${esc(MockFmt.dateTH(d.effective_from))}
                    ${d.status && d.status !== 'ACTIVE'
                        ? `<span class="sip-chip ${esc(DOC_STATUS[d.status].chip)}">${esc(DOC_STATUS[d.status].label)}</span>` : ''}
                </div>
                <div style="font-size:11.5px;line-height:1.7;color:var(--text-secondary);
                     border-left:3px solid var(--primary);padding-left:9px">
                    “${esc(c.quote)}”</div>
                <button class="btn btn-ghost btn-sm" style="margin-top:8px"
                        onclick="Knowledge.selectDoc('${esc(c.doc_id)}')">
                    <i data-lucide="external-link" class="icon-sm"></i> เปิดเอกสาร</button>
            </div>`;
        }).join('');
        refreshIcons();
    },

    focusCite(i) {
        const el = document.getElementById('cite-' + i);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'box-shadow .2s';
        el.style.boxShadow = 'var(--sip-shadow-glow-amber)';
        setTimeout(() => { el.style.boxShadow = ''; }, 1400);
    },

    /* ══════════ แท็บเนื้อหาเอกสาร ══════════ */

    tabContent() {
        const d = this.current();
        if (!d) return '<div class="ds-empty">เลือกเอกสารจากด้านซ้ายเพื่อดูเนื้อหาและ metadata</div>';
        return `
        ${d.status === 'EXPIRED' ? `
        <div class="sip-banner sip-banner-danger" style="margin-bottom:12px">
            <i data-lucide="alert-octagon" class="icon-sm"></i>
            <span><strong>เอกสารนี้หมดอายุแล้ว</strong> (สิ้นสุด ${esc(MockFmt.dateTH(d.effective_to))})
            — ห้ามใช้อ้างอิงกับเคสที่รับบริการหลังวันดังกล่าว</span>
        </div>` : d.status === 'FUTURE' ? `
        <div class="sip-banner sip-banner-warning" style="margin-bottom:12px">
            <i data-lucide="clock" class="icon-sm"></i>
            <span><strong>เอกสารนี้ยังไม่มีผล</strong> — จะเริ่มมีผล ${esc(MockFmt.dateTH(d.effective_from))}
            รายละเอียดอาจเปลี่ยนก่อนวันบังคับใช้จริง</span>
        </div>` : ''}

        <div class="section-card">
            <div class="section-title" style="margin-bottom:10px">
                <i data-lucide="tags" class="mi"></i> ข้อมูลเอกสาร (Metadata)</div>
            <table class="ds-table-grid">
                <tbody>
                    <tr><td class="l" style="width:28%">ชื่อเอกสาร</td><td class="l">${esc(d.title)}</td></tr>
                    <tr><td class="l">เลขที่</td><td class="l">${esc(d.no)}</td></tr>
                    <tr><td class="l">ประเภท</td><td class="l">${esc(MockKnowledge.typeLabel(d.type))}</td></tr>
                    <tr><td class="l">ผู้ออกเอกสาร</td><td class="l">${esc(d.issuer)}</td></tr>
                    <tr><td class="l">วันที่ประกาศ</td><td class="l">${esc(MockFmt.dateTH(d.published))}</td></tr>
                    <tr><td class="l"><strong>วันที่มีผล</strong></td><td class="l">
                        <strong>${esc(MockFmt.dateTH(d.effective_from))}</strong></td></tr>
                    <tr><td class="l">วันที่สิ้นสุด</td><td class="l">${
                        d.effective_to ? esc(MockFmt.dateTH(d.effective_to)) : '— (ยังมีผลอยู่)'}</td></tr>
                    <tr><td class="l">กองทุนที่เกี่ยวข้อง</td><td class="l">${d.funds.map(f =>
                        `<span class="sip-chip sip-chip-muted">${esc(f)}</span>`).join(' ')}</td></tr>
                    <tr><td class="l">Version</td><td class="l">${esc(d.version)}</td></tr>
                    <tr><td class="l">ผู้รับรอง</td><td class="l">${esc(MockAdmin.userName(d.certified_by))}</td></tr>
                    <tr><td class="l">สถานะ</td><td class="l">
                        <span class="sip-chip ${esc(DOC_STATUS[d.status].chip)}">${esc(DOC_STATUS[d.status].label)}</span></td></tr>
                </tbody>
            </table>
        </div>

        <div class="section-card">
            <div class="section-title" style="margin-bottom:10px">
                <i data-lucide="file-text" class="mi"></i> ข้อความที่ใช้อ้างอิง — ${esc(d.pages)}</div>
            <div style="font-size:13px;line-height:1.95;color:var(--text-primary);
                 background:var(--brand-amber-50);border-left:4px solid var(--brand-amber);
                 padding:12px 16px;border-radius:0 8px 8px 0">
                ${esc(d.excerpt)}
            </div>
            <div class="ds-note" style="margin-top:12px">
                <i data-lucide="info" class="icon-sm"></i>
                ในระบบจริง ปุ่มนี้จะเปิดไฟล์ต้นฉบับที่หน้าและย่อหน้าที่อ้างถึงโดยตรง
            </div>
        </div>`;
    },

    tabRules() {
        const d = this.current();
        if (!d) return '<div class="ds-empty">เลือกเอกสารจากด้านซ้ายก่อน</div>';
        const rules = MockKnowledge.rulesFor(d.id);
        return rules.length ? `
        <div class="ds-note" style="margin-bottom:12px">
            <i data-lucide="link" class="icon-sm"></i>
            กฎเหล่านี้อ้างอิงเอกสารฉบับนี้ — ถ้าเอกสารถูกยกเลิกหรือมีฉบับใหม่
            ระบบจะแจ้งให้ทบทวนกฎที่ผูกอยู่ทั้งหมด
        </div>
        <div class="table-responsive">
        <table class="data-table compact">
            <thead><tr><th style="width:1%">รหัสกฎ</th><th>ชื่อกฎ</th>
                <th style="width:1%">Ver</th><th style="width:1%">สถานะ</th>
                <th style="width:1%">รหัส NHSO</th><th style="width:1%">ข้ออ้างอิง</th></tr></thead>
            <tbody>${rules.map(r => `<tr style="cursor:pointer"
                onclick="location.href='claim-rules.html?rule=${encodeURIComponent(r.id)}'">
                <td class="td-sub">${esc(r.id)}</td>
                <td class="td-name">${esc(r.name)}</td>
                <td class="td-sub">v${esc(r.version)}</td>
                <td>${MockTone.lifecycleHtml(r.status)}</td>
                <td>${r.maps_to_nhso ? `<span class="sip-chip sip-chip-danger">${esc(r.maps_to_nhso)}</span>` : '—'}</td>
                <td class="td-sub">${esc(r.doc_ref)}</td>
            </tr>`).join('')}</tbody>
        </table></div>`
        : '<div class="ds-empty">ยังไม่มีกฎที่อ้างอิงเอกสารฉบับนี้<div class="td-sub" style="margin-top:6px">ถ้าเอกสารมีเกณฑ์ที่ตรวจอัตโนมัติได้ ควรสร้างกฎเพื่อดักตั้งแต่ก่อนส่ง</div></div>';
    },

    /* ══════════ แผงขวา ══════════ */

    copyAnswer() {
        const a = this.state.answer;
        if (!a) { showToast('ยังไม่มีคำตอบให้คัดลอก', 'warning'); return; }
        const plain = a.answer.replace(/<[^>]+>/g, '');
        const cites = (a.citations || []).map((c, i) =>
            `[${i + 1}] ${(MockKnowledge.byId(c.doc_id) || {}).no || c.doc_id} · ${c.ref}`).join('\n');
        if (navigator.clipboard) navigator.clipboard.writeText(`${a.q}\n\n${plain}\n\nแหล่งอ้างอิง:\n${cites}`).catch(() => {});
        showToast('คัดลอกคำตอบพร้อมแหล่งอ้างอิงแล้ว');
    },

    createRule() {
        const a = this.state.answer;
        if (!a) { showToast('ถามคำถามก่อน แล้วจึงสร้างกฎจากคำตอบ', 'warning'); return; }
        if (a.insufficient) { showToast('คำตอบนี้ไม่มีหลักฐานรองรับ — สร้างกฎจากคำตอบนี้ไม่ได้ (BR-06)', 'error'); return; }
        const doc = (a.citations[0] || {}).doc_id || '';
        location.href = `claim-rules.html?from=qa&doc=${encodeURIComponent(doc)}&q=${encodeURIComponent(a.q)}`;
    },
};

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.Knowledge = Knowledge;
document.addEventListener('DOMContentLoaded', () => Knowledge.init());
