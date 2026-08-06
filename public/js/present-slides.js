/* ────────────────────────────────────────────────────────
   เนื้อหาสไลด์นำเสนอผู้บริหาร — 20 หน้า

   ที่มาของเนื้อหา
     · SRS_Claim_Intelligence_Readiness_Platform_v1.0 (3 ส.ค. 2569)
     · โครงการ NHSO Digital Platform_Commu_03082026_V4.pdf (3 ส.ค. 2569) — เอกสารส่งเคลมรุ่นล่าสุด
     · Executive_Summary_Claim_Intelligence_4_Pages

   ⚠️ ไฟล์นี้ไม่พึ่ง mock-*.js เลย (deck ต้องเปิดได้แม้ไม่มีอะไรอื่น)
      ตัวเลขที่ปรากฏจึงเขียนตรง ๆ และมีคำกำกับว่าเป็นตัวอย่างทุกจุดที่จำเป็น
   ──────────────────────────────────────────────────────── */

/* ══════════════════════════════════════════════════════════
   ตัวช่วยวาดภาพ

   ⚠️ ผังการทำงานทั้งหมด (สไลด์ 4 · 5 · 7 · 8 · 10 · 16) ย้ายไป
      js/present-flows.js แล้ว — วาดด้วย SVG เพื่อให้ตัวอักษรโตตามสไลด์
      ไฟล์นี้เหลือเฉพาะ Gantt และการ์ดเดินหน้าจอที่เป็น HTML ล้วน
   ══════════════════════════════════════════════════════════ */

/** Gantt แผนส่งมอบเทียบไทม์ไลน์ NHSO */
function prGantt() {
    /* แกนเวลา ส.ค. 2569 – ก.ค. 2570 = 12 ช่อง */
    const MONTHS = ['ส.ค.69', 'ก.ย.69', 'ต.ค.69', 'พ.ย.69', 'ธ.ค.69', 'ม.ค.70',
                    'ก.พ.70', 'มี.ค.70', 'เม.ย.70', 'พ.ค.70', 'มิ.ย.70', 'ก.ค.70'];
    /* --lbl = ความกว้างคอลัมน์ชื่องาน · ใช้ซ้ำทั้งหัวตาราง แถบ และเลเยอร์หมุดเวลา
       ⚠️ คำอธิบายอยู่ในคอลัมน์ซ้ายที่เดียว ส่วนในแท่งใส่ได้แค่ป้ายสั้น (tag)
          เพราะแท่งสั้น ๆ อย่างระยะ 0 กว้างไม่พอ ข้อความยาวจะถูกตัดกลางคำ */
    const ROW = 'display:grid;grid-template-columns:var(--lbl) 1fr;gap:calc(.5*var(--u))';

    const bar = (label, sub, tag, from, to, color, textColor) => {
        const left = (from / 12) * 100, width = ((to - from) / 12) * 100;
        return `<div style="${ROW};align-items:center;margin-bottom:calc(.4*var(--u))">
            <div style="font-size:calc(1*var(--u));line-height:1.25">
                <strong style="color:var(--brand-navy)">${label}</strong>
                <div style="color:var(--text-muted);font-size:calc(.88*var(--u))">${sub}</div></div>
            <div style="position:relative;height:calc(1.6*var(--u));background:var(--brand-bg-strong);border-radius:5px">
                <div style="position:absolute;left:${left}%;width:${width}%;top:0;bottom:0;
                     background:${color};border-radius:5px;display:grid;place-items:center;
                     font-size:calc(.9*var(--u));font-weight:700;color:${textColor || '#fff'};overflow:hidden;
                     white-space:nowrap">${tag}</div>
            </div></div>`;
    };

    /* หมุดวันที่ 16 ก.ย. 2569 = กลางช่องที่ 1 (index 1)
       ⚠️ เส้นหมุดวางเป็น "เลเยอร์ทับ" ที่ใช้ grid ชุดเดียวกับแถบ
          ไม่ใช่ absolute + calc ผสมหน่วย % กับ px ซึ่ง CSS คำนวณไม่ได้ */
    const markerLeft = ((1 + 0.5) / 12) * 100;

    return `
    <div style="position:relative;--lbl:calc(15*var(--u))">
        <div style="${ROW};margin-bottom:calc(.4*var(--u))">
            <div></div>
            <div style="display:grid;grid-template-columns:repeat(12,1fr);font-size:calc(.88*var(--u));
                 color:var(--text-muted);text-align:center">
                ${MONTHS.map(m => `<span>${m}</span>`).join('')}
            </div>
        </div>

        <div style="font-size:calc(1.1*var(--u));font-weight:800;color:var(--status-danger);margin:2px 0 5px">
            ไทม์ไลน์ของ สปสช.
        </div>
        ${bar('Phase 2 · MVP2 Drop 1', '~9,000 หน่วย · รพ.สต. ทั่วประเทศ', 'ดำเนินการอยู่', 0, 1.5, 'var(--brand-navy-500)')}
        ${bar('Phase 3 · MVP2 Drop 2', '308 หน่วย · รพ.นำร่อง 7 แห่ง · +IPD · +ประกันสังคม', 'Go-Live 16 ก.ย. 69', 1.5, 5, 'var(--status-danger)')}

        <div style="font-size:calc(1.1*var(--u));font-weight:800;color:var(--primary);margin:calc(.6*var(--u)) 0 5px">
            แผนส่งมอบของเรา (SRS §13) — Agile Iteration 2–3 สัปดาห์
        </div>
        ${bar('ระยะ 0 · Discovery &amp; Baseline', 'ยืนยัน Workflow ข้อมูล Reject KPI Interface', '4–6 สัปดาห์', 0, 1.4, 'var(--brand-amber-500)', 'var(--brand-navy)')}
        ${bar('ระยะ 1 · Foundation &amp; Rule Template', 'Claim Case · Worklist · Dashboard · กฎสำเร็จรูป · RAG ชุดแรก', '10–14 สัปดาห์', 1.4, 4.5, 'var(--primary)')}
        ${bar('ระยะ 2 · Hospital Self-management', 'No-code Rule Builder · Back-test · Version/Approval · SLA', '10–12 สัปดาห์', 5, 8, 'var(--teal)')}
        ${bar('ระยะ 3 · AI-assisted Improvement', 'อ่าน Clinical text · Coding assist · Draft Rule suggestion', '12–16 สัปดาห์', 8, 12, 'var(--purple)')}

        <div style="${ROW};position:absolute;inset:calc(1.6*var(--u)) 0 0;pointer-events:none">
            <div></div>
            <div style="position:relative">
                <div style="position:absolute;left:${markerLeft}%;top:0;bottom:0;
                     border-left:2px dashed var(--status-danger)"></div>
                <div style="position:absolute;left:${markerLeft}%;top:0;transform:translate(5px,-3px);
                     font-size:calc(.9*var(--u));font-weight:800;color:var(--status-danger);white-space:nowrap;
                     background:var(--status-danger-soft);border-radius:4px;padding:1px 6px">
                    16 ก.ย. 2569
                </div>
            </div>
        </div>
    </div>
    <div class="pr-note strong" style="margin-top:10px">
        <strong>หมุดเวลาที่ตรึงแผนทั้งหมด: 16 กันยายน 2569</strong> — NHSO Go-Live เป้าหมายสำหรับโรงพยาบาลที่พร้อม
        (เพิ่มผู้ป่วยใน IPD และสิทธิประกันสังคม / ครูเอกชน / การแพทย์ฉุกเฉิน)
        · ระยะ 0 และต้นระยะ 1 จึงต้องเสร็จก่อนหมุดนี้ เพื่อให้ตรวจก่อนส่งได้ตั้งแต่วันแรกที่ขึ้นระบบ
    </div>`;
}

/**
 * ช่องตัวเลขที่ยังไม่มีค่า — สไลด์ 19 ตั้งใจไม่ใส่ตัวเลขใด ๆ
 * ห้ามแทนที่ด้วยตัวเลขสมมติ ค่าที่เติมได้มีทางเดียวคือ Baseline จริงของโรงพยาบาล (ระยะ 0)
 */
function prTBD(unit) {
    return `<b style="color:var(--text-muted);letter-spacing:.06em">XX</b>` +
        (unit ? `<br><span style="color:var(--text-muted);font-size:.86em">${unit}</span>` : '');
}

/** การ์ดเดินหน้าจอ */
function prScreen(name, href, points) {
    return `<div class="pr-shot">
        <div class="pr-shot-bar">${name}</div>
        <div class="pr-shot-body">
            <ul class="pr-ul" style="padding-left:1em">${points.map(p => `<li>${p}</li>`).join('')}</ul>
        </div>
        <div style="padding:0 calc(.6*var(--u)) calc(.55*var(--u))"><a class="pr-open" href="${href}" target="_blank" rel="noopener">
            เปิดหน้าจริง →</a></div>
    </div>`;
}


/* ══════════════════════════════════════════════════════════
   เนื้อหาสไลด์
   ══════════════════════════════════════════════════════════ */

const PRESENT_SLIDES = [

/* 1 ── ปก ─────────────────────────────────────────────── */
{
    accent: true,
    body: `<div style="height:100%;display:flex;flex-direction:column;justify-content:center">
        <div class="pr-eyebrow">ข้อเสนอเชิงระบบ · 6 สิงหาคม 2569</div>
        <h1 style="margin-top:0">Claim Intelligence &amp; Readiness Platform</h1>
        <p class="pr-lead" style="font-size:calc(1.75*var(--u));max-width:76%">
            ระบบตรวจสอบความพร้อมและบริหารองค์ความรู้ <strong>ก่อนส่งเคลม</strong> —
            ทำงานเสริมกับ HIS เดิม เชื่อม “ข้อมูล – กฎ – องค์ความรู้ – ผู้รับผิดชอบ”
            ให้เป็นกระบวนการเดียวที่ตรวจสอบย้อนหลังและพัฒนาต่อได้
        </p>
        <div class="pr-grid pr-g4" style="margin-top:14px">
            <div class="pr-card info"><div class="pr-stat">P124</div>
                <div class="pr-stat-label">รหัสที่ระบบดักได้ก่อนส่ง</div></div>
            <div class="pr-card good"><div class="pr-stat up">ก่อนส่ง</div>
                <div class="pr-stat-label">จุดที่ย้ายการตรวจมาไว้</div></div>
            <div class="pr-card amber"><div class="pr-stat">15 แฟ้ม</div>
                <div class="pr-stat-label">NHSO Standard Dataset</div></div>
            <div class="pr-card danger"><div class="pr-stat bad">16 ก.ย. 2569</div>
                <div class="pr-stat-label">NHSO Go-Live เป้าหมาย</div></div>
        </div>
        <p class="pr-lead" style="margin-top:16px;font-size:calc(1.14*var(--u))">
            อ้างอิง: SRS v1.0 (3 ส.ค. 2569) · โครงการ NHSO Digital Platform Communication V4 (3 ส.ค. 2569)
        </p>
    </div>`,
    foot: 'เอกสารเพื่อการพิจารณาร่วมกับโรงพยาบาล',
},

/* 2 ── สรุปหนึ่งหน้า ─────────────────────────────────── */
{
    k: .96,
    eyebrow: 'Executive Summary',
    title: 'สรุปหนึ่งหน้า',
    lead: 'ถ้ามีเวลา 2 นาที ให้ดูหน้านี้หน้าเดียว',
    body: `
    <div class="pr-grid pr-g2" style="height:100%">
        <div style="display:flex;flex-direction:column;gap:10px">
            <div class="pr-card">
                <h3>ปัญหา</h3>
                <div class="pr-kv">สปสช. ตรวจ <strong>หลัง</strong> เราส่ง — ได้รหัสผิดพลาดกลับมา
                    ต้องหาคนแก้ แก้ที่ HIS แล้วส่งใหม่ เสียไปหนึ่งรอบส่งเบิกเต็ม ๆ</div>
            </div>
            <div class="pr-card good">
                <h3>ข้อเสนอ</h3>
                <div class="pr-kv">รันกฎ <strong>ชุดเดียวกัน</strong> ตั้งแต่ก่อนกดส่ง
                    พร้อมติดประกาศอ้างอิง เจ้าของงาน และ SLA ให้ทุกประเด็น</div>
            </div>
            <div class="pr-card" style="flex:1">
                <h3>4 เสาหลัก</h3>
                <ul class="pr-ul">
                    <li><b>Rule Engine</b> — ตรวจเงื่อนไขที่แน่นอนตามกองทุนและวันที่มีผล</li>
                    <li><b>RAG Knowledge Base</b> — ค้นและอธิบายหลักเกณฑ์พร้อมแหล่งอ้างอิง</li>
                    <li><b>Workflow / Task</b> — Owner · SLA · Approval · Override</li>
                    <li><b>Reject Feedback Loop</b> — เปลี่ยนผลตีกลับเป็นกฎของโรงพยาบาล</li>
                </ul>
            </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
            <div class="pr-card amber">
                <h3>สิ่งที่ขอในรอบนี้</h3>
                <ul class="pr-ul">
                    <li>แต่งตั้งคณะทำงานร่วม (Claim · เวชระเบียน/Coder · การเงิน · แพทย์ · IT)</li>
                    <li>สิทธิ์เข้าถึงข้อมูล HIS และรายการประกาศที่รับรองแล้ว</li>
                    <li>เลือกกองทุนและกรณีนำร่อง พร้อมช่วงเวลา UAT</li>
                </ul>
            </div>
            <div class="pr-card info" style="flex:1">
                <h3>ไทม์ไลน์ย่อ</h3>
                <table class="pr-table">
                    <tr><td><b>ระยะ 0</b> Discovery &amp; Baseline</td><td class="c">4–6 สัปดาห์</td></tr>
                    <tr><td><b>ระยะ 1</b> Foundation &amp; Rule Template</td><td class="c">10–14 สัปดาห์</td></tr>
                    <tr><td><b>ระยะ 2</b> Hospital Self-management</td><td class="c">10–12 สัปดาห์</td></tr>
                    <tr><td><b>ระยะ 3</b> AI-assisted Improvement</td><td class="c">12–16 สัปดาห์</td></tr>
                </table>
                <div class="pr-note" style="margin-top:8px">
                    ต้องพร้อมใช้ก่อน <strong>NHSO Go-Live 16 ก.ย. 2569</strong>
                    ที่เพิ่มผู้ป่วยใน (IPD) และสิทธิประกันสังคม
                </div>
            </div>
        </div>
    </div>`,
},

/* 3 ── ปัญหาวันนี้ ───────────────────────────────────── */
{
    eyebrow: 'สถานการณ์ปัจจุบัน',
    title: 'ปัญหาที่เกิดขึ้นทุกงวดส่งเบิก',
    body: `
    <div class="pr-grid pr-g4" style="margin-bottom:14px">
        <div class="pr-card danger"><div class="pr-stat" style="color:var(--text-muted)">XX%</div>
            <div class="pr-stat-label">อัตราเคลมถูกตีกลับ<br>รอ Baseline จากข้อมูลจริง</div></div>
        <div class="pr-card danger"><div class="pr-stat" style="color:var(--text-muted)">XX นาที</div>
            <div class="pr-stat-label">เวลาตรวจเฉลี่ยต่อเคส<br>รอ Baseline จากข้อมูลจริง</div></div>
        <div class="pr-card danger"><div class="pr-stat" style="color:var(--text-muted)">XX%</div>
            <div class="pr-stat-label">งานที่เกิน SLA<br>รอ Baseline จากข้อมูลจริง</div></div>
        <div class="pr-card danger"><div class="pr-stat bad">ผูกกับคน</div>
            <div class="pr-stat-label">องค์ความรู้อยู่ในตัวบุคคล<br>ยืนยันได้จากหน้างาน</div></div>
    </div>
    <div class="pr-grid pr-g2">
        <div class="pr-card">
            <h3>สาเหตุเชิงกระบวนการ</h3>
            <ul class="pr-ul">
                <li>ข้อมูลที่ใช้เบิกมาจากหลายที่ — สิทธิ เวชระเบียน Coding รายการบริการ ค่าใช้จ่าย เอกสาร</li>
                <li>หลักเกณฑ์เปลี่ยนตามประกาศและมี <b>ช่วงวันที่มีผล</b> ต่างกันในแต่ละกองทุน</li>
                <li>เจ้าหน้าที่รู้ว่าผิดตอนที่ <b>สปสช. ตีกลับมาแล้ว</b> ซึ่งช้าไปหนึ่งรอบเสมอ</li>
                <li>ประเด็นเดิมกลับมาซ้ำ เพราะบทเรียนไม่ได้ถูกแปลงเป็นกฎ</li>
            </ul>
        </div>
        <div class="pr-card">
            <h3>สิ่งที่ สปสช. เองก็ระบุไว้</h3>
            <ul class="pr-ul">
                <li>หน่วยบริการ <b>ไม่มีเครื่องมือตรวจสอบสถานะการเบิกจ่าย</b> ทำให้ส่งเบิกซ้ำซ้อน</li>
                <li>กระบวนการเบิกจ่ายซับซ้อน ต้องบันทึกผ่านหลายโปรแกรม</li>
                <li>กระทบยอดบัญชีลำบาก เพราะมีกองทุนย่อยจำนวนมากและจ่ายไม่พร้อมกัน</li>
                <li>ยังไม่มีระบบ intelligent ช่วยหน่วยบริการ โดยเฉพาะเจ้าหน้าที่ใหม่</li>
            </ul>
            <div class="pr-note" style="margin-top:9px">
                ที่มา: NHSO Digital Platform Communication (3 ส.ค. 2569) — สรุปผล Survey ปัญหาการใช้งานระบบ e-Claim
            </div>
        </div>
    </div>`,
},

/* 4 ── Business Journey ──────────────────────────────── */
{
    eyebrow: 'บริบท NHSO',
    title: 'Business Journey — ระบบ NHSO Digital Platform',
    lead: 'เส้นทางจริงของหนึ่งเคส ตั้งแต่คนไข้เดินเข้ามาจนเงินเข้าบัญชีหน่วยบริการ',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.6*var(--u));height:100%">
        <div class="pr-flow">${prfJourney()}</div>
        <div class="pr-note strong" style="flex:none">
            เส้นประสีแดงสองเส้นคือ <strong>“ไม่ผ่าน → แก้ที่ HIS → ส่งใหม่”</strong>
            ทั้งขั้นตรวจสอบขั้นต้นและขั้นตรวจสอบก่อนจ่าย และทั้งคู่ย้อนกลับไปที่จุดเดียวกัน
            · ทุกครั้งที่เข้าวงจรนี้ คือหนึ่งรอบส่งเบิกที่รายได้ถูกเลื่อนออกไป
        </div>
    </div>`,
},

/* 5 ── Status Pipeline ──────────────────────────────── */
{
    eyebrow: 'บริบท NHSO',
    title: 'สถานะรายการบน NHSO Digital Platform',
    lead: 'ระบบเราต้องพูดภาษาเดียวกับหน้าจอที่เจ้าหน้าที่ใช้อยู่ทุกวัน',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.8*var(--u));height:100%">
    <div style="flex:none">${prfStatusFlow()}</div>
    <div class="pr-grid pr-g3" style="flex:1;min-height:0">
        <div class="pr-card">
            <h3>สถานะย่อยภายใต้ “รอส่งเบิก”</h3>
            <table class="pr-table">
                <tr><td class="c"><b>1000</b></td><td>กำลังตรวจสอบขั้นต้น</td></tr>
                <tr><td class="c"><b>1100</b></td><td>รอส่งเบิก</td></tr>
                <tr><td class="c"><b>4103</b></td><td>ยกเลิกและรอส่งใหม่</td></tr>
                <tr><td class="c"><b>3101</b></td><td>ขอยกเลิกรายการโดยหน่วยบริการ</td></tr>
            </table>
        </div>
        <div class="pr-card danger">
            <h3>“รอแก้ไข” แยกได้ 2 แบบ</h3>
            <ul class="pr-ul">
                <li><b>ไม่ผ่านการตรวจสอบขั้นต้น</b> — พบตั้งแต่ Pre-Validate</li>
                <li><b>ไม่ผ่านการประมวลผล</b> — พบหลังผ่านขั้นต้นแล้ว</li>
            </ul>
            <div class="pr-note strong" style="margin-top:8px">
                ทั้งสองแบบจบลงที่เดียวกัน: หน่วยบริการต้องกลับไปแก้ที่ HIS แล้วส่งเข้ามาใหม่
            </div>
        </div>
        <div class="pr-card">
            <h3>รหัสกิจกรรมในประวัติรายการ</h3>
            <table class="pr-table">
                <tr><td class="c"><b>F000</b></td><td>กำลังนำเข้าไฟล์</td></tr>
                <tr><td class="c"><b>F001</b></td><td>กำลังตรวจสอบขั้นต้น</td></tr>
                <tr><td class="c"><b>F002</b></td><td>ตรวจสอบขั้นต้นเสร็จสิ้น</td></tr>
            </table>
            <div class="pr-note" style="margin-top:8px">
                ระบบเราเก็บ F000/F001/F002 ไว้ในไทม์ไลน์ของเคส
                จึงนับ “จำนวนรอบการส่ง” ต่อเคสได้ตรง ๆ
            </div>
        </div>
    </div>
    </div>`,
},

/* 6 ── Standard Dataset ─────────────────────────────── */
{
    eyebrow: 'บริบท NHSO',
    title: 'Standard Dataset — 15 แฟ้ม ใน 5 กลุ่มข้อมูลหลัก',
    lead: 'โครงสร้างข้อมูลที่หน่วยบริการต้องจัดส่งตามประกาศ สปสช. — คือขอบเขตของสิ่งที่ระบบเราต้องตรวจให้ครบ',
    body: `
    <div class="pr-grid pr-g5" style="height:100%">
        <div class="pr-card info">
            <h3>ข้อมูลหลัก</h3>
            <div class="pr-chip blue" style="margin-bottom:6px">ใครรักษาใครที่ไหน</div>
            <ul class="pr-ul" style="padding-left:1em">
                <li>1 · NHSO Patient</li><li>2 · NHSO Provider</li><li>3 · NHSO Practitioner</li></ul>
        </div>
        <div class="pr-card">
            <h3>ข้อมูลการรักษา</h3>
            <div class="pr-chip" style="margin-bottom:6px">เป็นอะไรรักษาอย่างไร</div>
            <ul class="pr-ul" style="padding-left:1em">
                <li>4 · NHSO OPD</li><li>5 · NHSO Diagnosis</li><li>6 · NHSO Procedure</li></ul>
        </div>
        <div class="pr-card amber">
            <h3>ข้อมูลการเงิน</h3>
            <div class="pr-chip amber" style="margin-bottom:6px">คิดเงินเท่าไหร่</div>
            <ul class="pr-ul" style="padding-left:1em">
                <li>7 · NHSO CHAD<br><span style="color:var(--text-muted)">ค่าใช้จ่ายรายรายการ</span></li>
                <li>8 · NHSO CHA<br><span style="color:var(--text-muted)">รายละเอียดทางการเงิน</span></li></ul>
        </div>
        <div class="pr-card">
            <h3>กลุ่มเฉพาะ</h3>
            <div class="pr-chip" style="margin-bottom:6px">กรณีพิเศษ</div>
            <ul class="pr-ul" style="padding-left:1em">
                <li>9 · NHSO AER</li><li>10 · NHSO Prenatal</li><li>11 · NHSO Newborn</li>
                <li>12 · NHSO CMHS</li><li>13 · NHSO Disability</li></ul>
        </div>
        <div class="pr-card good">
            <h3>ผู้ป่วยใน</h3>
            <div class="pr-chip green" style="margin-bottom:6px">Admissions</div>
            <ul class="pr-ul" style="padding-left:1em">
                <li>14 · NHSO IPD</li>
                <li>15 · NHSO LVD<br><span style="color:var(--text-muted)">กรณีลากลับบ้าน</span></li></ul>
            <div class="pr-note strong" style="margin-top:8px;font-size:calc(.98*var(--u))">
                สองแฟ้มนี้เพิ่มใน Phase 3 · Go-Live 16 ก.ย. 2569
            </div>
        </div>
    </div>`,
},

/* 7 ── Error จริง ──────────────────────────────────── */
{
    eyebrow: 'ของจริงจากหน้าจอ สปสช.',
    title: 'รหัสข้อผิดพลาดที่หน่วยบริการเจอจริง',
    lead: 'ทั้งสามรหัสนี้ถอดมาจากหน้าจอ “ผลการตรวจสอบ” ของ NHSO Digital Platform โดยไม่แก้ถ้อยคำ',
    body: `
    <div style="display:flex;flex-direction:column;gap:9px;height:100%">
        <div class="pr-card danger">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
                <span class="pr-chip red">ERROR</span>
                <strong style="font-size:calc(1.4*var(--u));color:var(--brand-navy)">ปัญหาที่พบจากการตรวจสอบขั้นต้น</strong>
            </div>
            <div class="pr-code"><span class="k">P124</span> — พบสาเหตุส่งเบิก ไม่เท่ากับ ราคา <span class="hl">Drug Catalogue</span>
รบกวนตรวจสอบ <span class="hl">แฟ้ม 7</span> Seq.690014144 หมวดค่าใช้จ่าย ยาสารอาหารทางเส้นเลือดที่ใช้ที่ รพ.
(<span class="hl">BILLGRCS = 03</span>) <span class="hl">STDCODE 338139</span> รบกวนตรวจสอบข้อมูลพร้อมแก้ไขข้อมูลแล้วส่งเข้ามาใหม่อีกครั้ง</div>
        </div>

        <div class="pr-card amber">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
                <span class="pr-chip amber">WARNING</span>
                <strong style="font-size:calc(1.4*var(--u));color:var(--brand-navy)">สามารถยืนยันส่งเบิกได้</strong>
            </div>
            <div class="pr-code"><span class="k">L205</span> — แฟ้ม 7 Seq.690014144 หมวดค่าใช้จ่าย ยาสารอาหารทางเส้นเลือดที่ใช้ที่ รพ.
(BILLGRCS = 03) CODESYS 001 ผ่านขั้นตอนการหาข้อมูลยา รพ.</div>
        </div>

        <div class="pr-card danger">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
                <span class="pr-chip red">ERROR</span>
                <strong style="font-size:calc(1.4*var(--u));color:var(--brand-navy)">ปัญหาที่พบจากการประมวลผลไฟล์</strong>
            </div>
            <div class="pr-code"><span class="k">C305</span> — <span class="hl">Approve Code (OFC) / เลขปิดสิทธิ (UCS)</span> ที่บันทึกเบิกในโปรแกรม e-Claim
ไม่ตรงกันฐานข้อมูลของหน่วยบริการ</div>
        </div>

        <div class="pr-note strong" style="flex:none">
            <strong>โซ่ที่ต้องไล่ให้ถูกทุกครั้งก่อนกดส่ง</strong>
            ${prfChain()}
            เป็นการเทียบข้อมูลที่ <strong>เครื่องทำได้แม่นและเร็วกว่าคน</strong> — และทำได้ตั้งแต่ยังไม่ส่ง
        </div>
    </div>`,
},

/* 8 ── ⭐ สองวงจร ──────────────────────────────────── */
{
    accent: true,
    eyebrow: 'หัวใจของข้อเสนอ',
    title: 'ตรวจหลังส่ง กับ ตรวจก่อนส่ง — ต่างกันที่ “จำนวนรอบ”',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.6*var(--u));height:100%">
        <div class="pr-flow">${prfTwoLoops()}</div>
        <div class="pr-note strong" style="flex:none">
            กฎที่ใช้ตรวจคือ <strong>ชุดเดียวกัน</strong> — เราไม่ได้คิดเกณฑ์ใหม่ แต่ย้ายจุดตรวจมาไว้ก่อนกดส่ง
            แล้วผูกทุกประเด็นเข้ากับประกาศอ้างอิง เจ้าของงาน และ SLA
            · จากตัวอย่างจริงในระบบ: เคส <strong>CLM-2569-0007</strong> (วงจรเดิม) เทียบกับ
            <strong>CLM-2569-0042</strong> (วงจรใหม่) ซึ่งติดเรื่องเดียวกันแต่จบคนละแบบ
        </div>
    </div>`,
},

/* 9 ── ทางแก้ ──────────────────────────────────────── */
{
    eyebrow: 'ข้อเสนอ',
    title: 'Claim Control Tower — ทำงาน “ข้าง” HIS ไม่ใช่แทนที่',
    body: `
    <div class="pr-grid pr-g2" style="margin-bottom:12px">
        <div class="pr-card good">
            <h3>อยู่ในขอบเขต</h3>
            <ul class="pr-ul">
                <li>เชื่อม / นำเข้าข้อมูลจาก HIS และไฟล์ Claim</li>
                <li>ตรวจความพร้อมก่อนส่ง Claim และบริหารข้อผิดพลาด</li>
                <li>Rule Engine · RAG · Workflow · Reject Feedback · Dashboard</li>
                <li>ประวัติกฎ เอกสาร การอนุมัติ Override และ Audit Trail</li>
            </ul>
        </div>
        <div class="pr-card danger">
            <h3>อยู่นอกขอบเขตระยะแรก</h3>
            <ul class="pr-ul">
                <li>ตัดสิน Clinical โดยอัตโนมัติแทนแพทย์</li>
                <li>รับรองว่าทุกเคสจะได้รับชำระ (ขึ้นกับผู้จ่ายและข้อเท็จจริง)</li>
                <li>ให้ AI เปิดใช้กฎที่มีผลทางการเงินโดยไม่มีผู้อนุมัติ</li>
            </ul>
        </div>
    </div>
    <div class="pr-grid pr-g4">
        <div class="pr-card"><h3>ทำงานร่วมกับระบบเดิม</h3>
            <div class="pr-kv">API · Database View · Claim Export · ไฟล์ที่ได้รับอนุมัติ</div></div>
        <div class="pr-card"><h3>ตรวจอย่างมีหลักฐาน</h3>
            <div class="pr-kv">Rule Version · ข้อมูลที่ใช้ตัดสิน · เอกสารอ้างอิง · Audit Trail</div></div>
        <div class="pr-card"><h3>คนเป็นผู้อนุมัติ</h3>
            <div class="pr-kv">AI ช่วยค้นและเสนอแนะ แต่ไม่ตัดสินเรื่องสำคัญแทนบุคลากร</div></div>
        <div class="pr-card"><h3>โรงพยาบาลเป็นเจ้าของความรู้</h3>
            <div class="pr-kv">เพิ่มเอกสาร ปรับกฎ ทดสอบ และอนุมัติได้ตามสิทธิ</div></div>
    </div>
    <div class="pr-note" style="margin-top:11px">
        <strong>BR-08:</strong> ข้อมูลจาก HIS ต้นทางไม่ถูกแก้โดยระบบ
        เว้นแต่มี Interface และสิทธิ์ที่โรงพยาบาลอนุมัติเป็นลายลักษณ์อักษร
    </div>`,
},

/* 10 ── สถาปัตยกรรม ─────────────────────────────────── */
{
    eyebrow: 'ภาพรวมระบบ',
    title: 'สถาปัตยกรรมเชิงหน้าที่',
    lead: 'เส้นประสีแดงคือหัวใจ — บทเรียนจากเคสจริงย้อนกลับเข้ามาเป็นกฎของโรงพยาบาล ไม่ใช่ความจำของบุคคล',
    body: `<div class="pr-flow">${prfArchitecture()}</div>`,
},

/* 11 ── 4 เสาหลัก ──────────────────────────────────── */
{
    eyebrow: 'องค์ประกอบ',
    title: '4 เสาหลัก และหน้าที่ที่แบ่งกันชัดเจน',
    body: `
    <div class="pr-grid pr-g2" style="height:100%">
        <div class="pr-card info">
            <h3>1 · Claim Rule Engine</h3>
            <div class="pr-kv">ตรวจเงื่อนไขที่ <b>แน่นอนและวัดได้</b> — เลือกกฎตามกองทุน ประเภทบริการ
                และ <b>วันที่รับบริการ</b> ไม่ใช่เฉพาะ Version ปัจจุบัน (BR-01)</div>
            <ul class="pr-ul" style="margin-top:6px">
                <li>ผลจำแนก 5 ระดับ: ผ่าน · แจ้งเตือน · ต้องแก้ไข · ต้องอนุมัติ · ระงับส่ง</li>
                <li>บันทึก Rule Code · Version · Input Snapshot · เหตุผล (BR-03)</li>
            </ul>
        </div>
        <div class="pr-card">
            <h3>2 · RAG Knowledge Base</h3>
            <div class="pr-kv">ค้นและอธิบายหลักเกณฑ์ <b>พร้อมแหล่งอ้างอิง</b> —
                ชื่อเอกสาร หน้า/หัวข้อ วันที่มีผล และลิงก์เปิดต้นฉบับ</div>
            <ul class="pr-ul" style="margin-top:6px">
                <li>ตอบเฉพาะจากเอกสารที่มีสิทธิ์และมีผลกับบริบทนั้น</li>
                <li><b>แจ้งเมื่อหลักฐานไม่เพียงพอ</b> แทนการเดา (BR-06)</li>
            </ul>
        </div>
        <div class="pr-card amber">
            <h3>3 · Workflow / Task / SLA</h3>
            <div class="pr-kv">ทุกประเด็นมี <b>Owner · Due Date · SLA · Escalation</b>
                และบันทึกผู้ดำเนินการ เวลา เหตุผล หลักฐานทุกครั้ง</div>
            <ul class="pr-ul" style="margin-top:6px">
                <li>รองรับส่งกลับ แก้ไข ยืนยัน ขอข้อมูลเพิ่ม อนุมัติ และ Override</li>
                <li>กฎระงับส่งต้องผ่าน Maker–Checker (BR-05)</li>
            </ul>
        </div>
        <div class="pr-card good">
            <h3>4 · Reject Feedback Loop</h3>
            <div class="pr-kv">นำผลตอบกลับ รหัส Reject ยอดที่ถูกตัด และผลอุทธรณ์
                กลับมา <b>จัดหมวดสาเหตุ</b> แล้วเสนอเป็นร่างกฎ</div>
            <ul class="pr-ul" style="margin-top:6px">
                <li>เชื่อม Reject กับกฎที่เคยตรวจ / ยังไม่ได้ตรวจในเคสนั้น</li>
                <li>ร่างกฎต้องผ่านการทดสอบย้อนหลังและอนุมัติก่อนเปิดใช้</li>
            </ul>
        </div>
    </div>`,
},

/* 12–15 ── เดินหน้าจอ ──────────────────────────────── */
{
    eyebrow: 'เดินหน้าจอ 1 / 4',
    title: 'ภาพรวมผู้บริหาร และคิวเคลม',
    lead: 'กดปุ่มใต้การ์ดเพื่อเปิดหน้าจริงในต้นแบบ (เปิดแท็บใหม่)',
    body: `<div class="pr-grid pr-g2" style="height:100%">
        ${prScreen('Executive Dashboard — ภาพรวมผู้บริหาร', 'claim-dashboard.html', [
            'KPI 6 ตัว: เคสรอส่งเบิก · เคสเสี่ยงสูง · มูลค่าเสี่ยง · First-pass · งานเกิน SLA · มูลค่าถูกตัด',
            '<b>กดที่ KPI ได้ทุกช่อง</b> — ระบบจะบอกสูตรและฟิลด์ที่ใช้คำนวณ ตอบคำถาม “ตัวเลขนี้จริงไหม”',
            'แนวโน้ม Reject เทียบ First-pass 12 เดือน · มูลค่าที่ดักได้ก่อนส่งรายสัปดาห์',
            'สถานะฝั่ง สปสช. 6 ขั้น พร้อมจำนวนและมูลค่าในแต่ละขั้น',
            'ตารางผลของกฎ: Hit · True Issue · False Positive · Override · มูลค่าที่ป้องกันได้',
        ])}
        ${prScreen('Claim Worklist — คิวเคลมก่อนส่งเบิก', 'claim-worklist.html', [
            'กรองตามผลตรวจ 5 ระดับ · กองทุน · บริการ · หน่วยบริการ · ระดับความเสี่ยง · สถานะ NHSO',
            '<b>คอลัมน์ “จะติดที่ NHSO”</b> — บอกล่วงหน้าว่าเคสนี้จะได้รหัสอะไรกลับมาถ้าส่งทั้งอย่างนี้',
            'คะแนนความเสี่ยง · เจ้าของงาน · ป้าย SLA ในแถวเดียวกัน',
            'มอบหมายงานได้จากตารางตรง ๆ พร้อมนับ SLA ทันที',
            'กด “ส่งเบิกที่เลือก” เมื่อยังมีประเด็นค้าง ระบบจะกันไว้พร้อมบอกเหตุผล',
        ])}
    </div>`,
},
{
    eyebrow: 'เดินหน้าจอ 2 / 4',
    title: 'รายละเอียดเคส และคลังกฎ',
    body: `<div class="pr-grid pr-g2" style="height:100%">
        ${prScreen('Claim Case Detail — รายละเอียดเคส', 'claim-case.html?id=CLM-2569-0042', [
            '6 แท็บ: ภาพรวม · ผลกฎ · หลักฐาน · เอกสาร · Timeline · สถานะ NHSO',
            '<b>แท็บ “หลักฐาน”</b> แสดง snapshot ของข้อมูลที่ใช้ตัดสิน — ราคาที่เบิก 690 เทียบ Catalogue 420',
            'ทุกผลกฎมีเอกสารอ้างอิง (ประกาศ ข้อ หน้า) กดไปอ่านต้นฉบับได้',
            'ขอ Override ได้ แต่ต้องกรอกเหตุผล หลักฐาน และผู้อนุมัติที่ไม่ใช่ตัวเอง (BR-04/BR-05)',
            'พิมพ์ใบสรุปเคสก่อนส่งเบิกผ่านพรีวิว A4',
        ])}
        ${prScreen('Rule Catalog / Builder — คลังกฎ', 'claim-rules.html', [
            'วงจรชีวิตกฎ: ร่าง → รอทบทวน → อนุมัติแล้ว → เปิดใช้ → ยกเลิกใช้',
            '<b>Template สร้างกฎแบบ No-code</b> 6 แบบ รวมถึงตรวจราคาเทียบ Drug Catalogue (→P124)',
            'ทดสอบย้อนหลังกับเคสจริงก่อนขออนุมัติ — ดู Hit / True Issue / False Positive',
            'กฎที่เปิดใช้แล้วแก้ทับไม่ได้ ต้อง Clone เป็น Version ใหม่ (BR-02)',
            '<b>ผู้เขียนกฎกดเปิดใช้กฎของตัวเองไม่ได้</b> — สลับบทบาทในเมนูเพื่อดูสด ๆ',
        ])}
    </div>`,
},
{
    eyebrow: 'เดินหน้าจอ 3 / 4',
    title: 'คลังความรู้ และงาน/การอนุมัติ',
    body: `<div class="pr-grid pr-g2" style="height:100%">
        ${prScreen('Knowledge Center — คลังความรู้ (RAG)', 'claim-knowledge.html', [
            'ถามเป็นภาษาไทย ได้คำตอบพร้อม <b>เลขอ้างอิง [1] [2]</b> ที่ชี้กลับไปยังเอกสารต้นฉบับ',
            'เอกสารมี metadata ครบ: เลขที่ · ผู้ออก · วันประกาศ · <b>วันที่มีผล / สิ้นสุด</b> · สถานะ',
            'มีคำถามตัวอย่างที่ระบบ <b>ตอบว่า “หลักฐานไม่เพียงพอ”</b> แทนการเดา (BR-06)',
            'ดูได้ว่ากฎข้อไหนอ้างอิงเอกสารฉบับนี้',
            'สร้างร่างกฎจากคำตอบได้ทันที — ปิดวงจรความรู้ → กฎ',
        ])}
        ${prScreen('Task & Approval — งานและการอนุมัติ', 'claim-tasks.html', [
            'กล่องงานของฉัน · รอฉันอนุมัติ · มอบหมายโดยฉัน · เกิน SLA',
            'งานที่เกินกำหนดจะถูก <b>ยกระดับอัตโนมัติ</b> พร้อมบันทึกในไทม์ไลน์',
            'Checklist ของงานผูกกับผลกฎที่เป็นต้นเหตุ',
            'ประวัติ Override แสดงผู้กระทำ บทบาท เวลา เหตุผล และหลักฐาน',
            'ตีกลับ / ส่งต่อผู้อนุมัติ / ยกระดับ ได้จากหน้าเดียว',
        ])}
    </div>`,
},
{
    eyebrow: 'เดินหน้าจอ 4 / 4',
    title: 'วิเคราะห์การตีกลับ และโมดูลส่งเบิก NHSO',
    body: `<div class="pr-grid pr-g2" style="height:100%">
        ${prScreen('Reject Analysis — วิเคราะห์การตีกลับ', 'claim-reject.html', [
            'Pareto สาเหตุ 10 อันดับ พร้อม % สะสม — เห็นทันทีว่าแก้อะไรก่อนคุ้มที่สุด',
            'จัดหมวดตามอนุกรมวิธานของ สปสช.: ไม่ผ่านตรวจสอบขั้นต้น / ไม่ผ่านประมวลผล / ตัดจ่ายหลัง Audit',
            'ทุกแถวบอกว่า <b>มีกฎครอบคลุมแล้วหรือยัง</b>',
            '<b>ปุ่ม “สร้างร่างกฎ”</b> เติมเงื่อนไขให้อัตโนมัติจากสาเหตุ แล้วไปโผล่ในคลังกฎเป็นร่าง',
            'นำเข้าไฟล์ผลตีกลับรายงวดได้',
        ])}
        ${prScreen('ส่งเบิก NHSO — โมดูลเต็มรูปแบบ', 'nhso-submit.html', [
            'แถบ 6 ขั้นตอนของ สปสช. กดกรองได้ พร้อมสถานะย่อย 1000 / 1100 / 4103 / 3101',
            'หน้ารายละเอียดมี <b>7 แท็บตรงตามหน้าจอจริง</b> รวมถึง Master Cup และผลการตรวจสอบ',
            'ตารางค่าใช้จ่ายเทียบราคา Drug Catalogue รายบรรทัด — แถวที่เกินย้อมสีทันที',
            'ชี้แจงรายการก่อนส่งเบิก · นำเข้าข้อมูล API/Upload · โครงสร้าง 15 แฟ้ม · งานก่อน UAT',
            'รายงาน Transaction / Statement / OFC / พึงรับ-พึงจ่าย พร้อมกติการหัสผ่านไฟล์',
        ])}
    </div>`,
},

/* 16 ── ธรรมาภิบาล ────────────────────────────────── */
{
    eyebrow: 'การกำกับดูแล',
    k: .92,
    title: 'ธรรมาภิบาล — กฎที่ระบบบังคับตัวเอง',
    body: `
    <div class="pr-grid pr-g2" style="height:100%">
        <div class="pr-card">
            <h3>กฎทางธุรกิจ BR-01 … BR-08</h3>
            <table class="pr-table">
                <tr><td class="c"><b>BR-01</b></td><td>เลือกกฎตามวันที่รับบริการ ช่วงมีผล กองทุน และประเภทบริการ</td></tr>
                <tr><td class="c"><b>BR-02</b></td><td>กฎ Active ที่เคยประมวลผลแล้วห้ามแก้ทับ ต้อง Clone เป็น Version ใหม่</td></tr>
                <tr><td class="c"><b>BR-03</b></td><td>ทุกผลตรวจย้อนกลับได้ถึง Rule Code/Version และข้อมูลที่ใช้ตัดสิน</td></tr>
                <tr><td class="c"><b>BR-04</b></td><td>Override ต้องมีผู้ดำเนินการ เวลา เหตุผล และหลักฐาน</td></tr>
                <tr class="bad"><td class="c"><b>BR-05</b></td><td>กฎระงับส่งหรือมีผลสูงต้องผ่าน Maker–Checker</td></tr>
                <tr><td class="c"><b>BR-06</b></td><td>คำตอบ RAG ต้องแสดงแหล่งอ้างอิง และแจ้งเมื่อหลักฐานไม่พอ</td></tr>
                <tr class="bad"><td class="c"><b>BR-07</b></td><td>AI เสนอแนะได้ แต่ไม่เปิดใช้กฎหรืออนุมัติเคสทางการแพทย์เอง</td></tr>
                <tr><td class="c"><b>BR-08</b></td><td>ข้อมูล HIS ต้นทางไม่ถูกแก้โดยระบบ</td></tr>
            </table>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
            <div class="pr-card info">
                <h3>วงจรชีวิตของกฎ</h3>
                ${prfLifecycle()}
                <div class="pr-kv" style="margin-top:calc(.5*var(--u))">
                    เก็บกฎเดิมไว้ทุก Version เพื่อให้ตรวจย้อนหลังได้ว่าเคสเมื่อ 6 เดือนก่อน
                    ถูกตัดสินด้วยเกณฑ์อะไร
                </div>
            </div>
            <div class="pr-card danger">
                <h3>แยกผู้สร้าง – ผู้ทบทวน – ผู้อนุมัติ</h3>
                <div class="pr-kv">
                    ผู้เขียนกฎ (Rule Editor) <b>ไม่มีสิทธิ์อนุมัติ</b> · ผู้อนุมัติ (Rule Approver) ไม่ใช่คนเขียน
                    · เมทริกซ์สิทธิ์ 9 บทบาท × 7 ความสามารถ ตรวจได้จากหน้าผู้ดูแลระบบ
                </div>
            </div>
            <div class="pr-card amber" style="flex:1">
                <h3>ธรรมาภิบาล AI — สวิตช์ที่ล็อกไว้</h3>
                <ul class="pr-ul">
                    <li>✅ ให้ AI ค้นหลักเกณฑ์และแสดงแหล่งอ้างอิง</li>
                    <li>✅ ให้ AI เสนอร่างกฎจากผลตีกลับ</li>
                    <li>🔒 บังคับแสดง Citation ทุกคำตอบ — <b>ปิดไม่ได้</b></li>
                    <li>🔒 ให้ AI เปิดใช้กฎเอง — <b>เปิดไม่ได้</b></li>
                    <li>🔒 ให้ AI อนุมัติเคสทางการแพทย์ — <b>เปิดไม่ได้</b></li>
                </ul>
            </div>
        </div>
    </div>`,
},

/* 17 ── แผนส่งมอบ ────────────────────────────────── */
{
    accent: true,
    eyebrow: 'แผนการทำงาน',
    k: .94,
    title: 'แผนส่งมอบ 4 ระยะ เทียบไทม์ไลน์ของ สปสช.',
    body: prGantt(),
},

/* 18 ── งานก่อน UAT ──────────────────────────────── */
{
    eyebrow: 'สิ่งที่ต้องเตรียม',
    title: 'งานก่อน UAT — ช่วง Hand Shake กับ สปสช.',
    lead: 'ห้าข้อนี้เป็นข้อกำหนดของ สปสช. เอง สำหรับโรงพยาบาลและ Software Vendor ที่จะขึ้นระบบ',
    body: `
    <table class="pr-table" style="margin-bottom:11px">
        <thead><tr><th style="width:5%">#</th><th style="width:22%">งาน</th><th>รายละเอียด</th>
            <th style="width:22%">ผู้รับผิดชอบที่เสนอ</th></tr></thead>
        <tbody>
            <tr><td class="c"><b>1</b></td><td><b>ขอ Source ID</b></td>
                <td>ขึ้นทะเบียน Software Vendor กับ NHSO Digital Platform</td>
                <td>ศูนย์คอมพิวเตอร์ + ผู้พัฒนา</td></tr>
            <tr><td class="c"><b>2</b></td><td><b>เชื่อมต่อ API</b></td>
                <td>ขอ Client ID / Token สำหรับ Test Environment</td>
                <td>ศูนย์คอมพิวเตอร์</td></tr>
            <tr><td class="c"><b>3</b></td><td><b>ตั้งค่า User</b></td>
                <td>ผู้ใช้งาน NHSO Portal ครบทุก Role ที่ต้องการ</td>
                <td>ศูนย์จัดเก็บรายได้</td></tr>
            <tr><td class="c"><b>4</b></td><td><b>พัฒนาระบบ</b></td>
                <td>เชื่อมต่อ HIS → NHSO Platform ตาม Standard Dataset ล่าสุด</td>
                <td>ผู้พัฒนา + ศูนย์คอมพิวเตอร์</td></tr>
            <tr class="bad"><td class="c"><b>5</b></td><td><b>Mapping Drug &amp; Service Catalogue</b></td>
                <td>ปรับให้หน่วยบริการส่งรายการตาม Drug / Service Catalog ที่ให้ข้อมูลไว้กับ สปสช.</td>
                <td>เภสัชกรรม + ศูนย์จัดเก็บรายได้</td></tr>
        </tbody>
    </table>
    <div class="pr-grid pr-g2">
        <div class="pr-note strong">
            <strong>ข้อ 5 คือข้อที่ทำให้เกิด P124</strong> — ถ้า Mapping ราคาไม่ตรง ทุกเคสที่มีรายการนั้นจะถูกตีกลับหมด
            ระบบเราจึงมีหน้าจัดการ Mapping พร้อมตัวชี้วัดความครบ และเตือนแถวที่ราคาไม่ตรงตั้งแต่ก่อนส่ง
        </div>
        <div class="pr-card info">
            <h3>ประโยชน์ที่ได้ตั้งแต่ช่วงเตรียม</h3>
            <div class="pr-kv">
                งานเตรียม UAT ทั้งห้าข้อนี้ต้องทำอยู่แล้วไม่ว่าจะมีระบบเราหรือไม่
                — ระบบเราทำให้ <b>สถานะของทั้งห้าข้อมองเห็นได้จากหน้าจอเดียว</b>
                พร้อมเจ้าของงานและกำหนดเสร็จ แทนการไล่ถามทางไลน์
            </div>
        </div>
    </div>`,
},

/* 19 ── ตัวชี้วัด ────────────────────────────────── */
{
    eyebrow: 'การวัดผล',
    k: .88,
    title: 'ตัวชี้วัดที่จะใช้ประเมินร่วมกัน',
    body: `
    <table class="pr-table" style="margin-bottom:10px">
        <thead><tr><th style="width:20%">ตัวชี้วัด</th><th style="width:28%">วิธีวัด (นิยามที่ตกลงร่วมกัน)</th>
            <th style="width:10%" class="c">Baseline<br><span style="font-weight:400">ก่อนใช้ระบบ</span></th>
            <th style="width:10%" class="c">วัดจริง<br><span style="font-weight:400">หลังใช้ระบบ</span></th>
            <th>สิ่งที่ผู้บริหารจะเห็นในรายงาน</th></tr></thead>
        <tbody>
            <tr><td><b>Reject Rate</b><br><span style="color:var(--text-muted)">อัตราเคลมถูกตีกลับ</span></td>
                <td>เคส Reject ÷ เคสที่ส่งทั้งหมด × 100</td>
                <td class="c">${prTBD()}</td><td class="c">${prTBD()}</td>
                <td>ทิศทางที่มุ่งหวังคือ <b>ลดลง</b> — เทียบเคสกลุ่มเดียวกัน พร้อมรายการที่ดักได้ก่อนส่ง</td></tr>
            <tr><td><b>First-pass Acceptance</b><br><span style="color:var(--text-muted)">ผ่านตั้งแต่ส่งครั้งแรก</span></td>
                <td>เคสที่ผ่านครั้งแรก ÷ เคสที่ส่งทั้งหมด × 100</td>
                <td class="c">${prTBD()}</td><td class="c">${prTBD()}</td>
                <td>ทิศทางที่มุ่งหวังคือ <b>เพิ่มขึ้น</b> — สะท้อนการส่งซ้ำที่ลดลง วงจรรับชำระสั้นลง</td></tr>
            <tr><td><b>เวลาตรวจต่อเคส</b><br><span style="color:var(--text-muted)">ประสิทธิภาพงาน</span></td>
                <td>เวลาตั้งแต่เปิดตรวจจนยืนยันพร้อมส่ง ÷ จำนวนเคส</td>
                <td class="c">${prTBD('นาที')}</td><td class="c">${prTBD('นาที')}</td>
                <td>ทิศทางที่มุ่งหวังคือ <b>ลดลง</b> — ประเด็น กฎ และเอกสารอ้างอิงอยู่ในจุดเดียว</td></tr>
            <tr><td><b>งานเกิน SLA</b><br><span style="color:var(--text-muted)">การประสานงาน</span></td>
                <td>Task ที่เกินกำหนด ÷ Task ทั้งหมด × 100</td>
                <td class="c">${prTBD()}</td><td class="c">${prTBD()}</td>
                <td>ทิศทางที่มุ่งหวังคือ <b>ลดลง</b> — เห็น Owner และงานค้างชัดเจน เร่งแก้ก่อนรอบส่ง</td></tr>
            <tr class="good"><td><b>มูลค่าที่ป้องกันได้</b><br><span style="color:var(--text-muted)">ผลทางการเงิน</span></td>
                <td>มูลค่ารายการเสี่ยงที่พบและแก้ก่อนส่ง โดยมีหลักฐาน</td>
                <td class="c" style="color:var(--text-muted)">วันนี้<br>วัดไม่ได้</td><td class="c">${prTBD('บาท / ไตรมาส')}</td>
                <td>ตัวเลขที่วันนี้ยังไม่มีใครตอบได้ — ระบบจะแสดงยอดพร้อมรายการอ้างอิงรายเคส</td></tr>
        </tbody>
    </table>
    <div class="pr-note" style="font-size:calc(1.1*var(--u))">
        <strong>สไลด์นี้ตั้งใจไม่ใส่ตัวเลข</strong> — เราไม่ประมาณการผลลัพธ์ล่วงหน้า และไม่นำตัวเลขจากที่อื่นมาอ้างเป็นของโรงพยาบาล
        ช่อง <b>XX</b> จะเติมด้วยข้อมูลจริงของโรงพยาบาลเท่านั้น: <b>เก็บ Baseline ในระยะ 0</b> จากข้อมูลย้อนหลังตามช่วงเวลาที่ตกลงร่วมกัน
        แยกตามกองทุนและประเภทบริการ แล้ว<b>วัดซ้ำด้วยนิยามเดียวกัน</b>หลังระบบทำงานจริง — สิ่งที่ตกลงกันวันนี้คือ “วิธีวัด” ไม่ใช่ “ตัวเลข”
    </div>
    <div class="pr-grid pr-g3" style="margin-top:9px">
        <div class="pr-card"><h3>คุณภาพกฎ</h3>
            <div class="pr-kv">Hit Rate · True Issue Rate · Override Rate · False Positive</div></div>
        <div class="pr-card"><h3>การใช้ความรู้</h3>
            <div class="pr-kv">จำนวนเอกสารที่รับรอง · อัตราคำตอบที่มี Citation · การใช้ Knowledge Center</div></div>
        <div class="pr-card"><h3>ความยั่งยืน</h3>
            <div class="pr-kv">สัดส่วนกฎ/เอกสารที่โรงพยาบาลจัดการเอง · จำนวนผู้ดูแลที่ผ่านการอบรม</div></div>
    </div>`,
},

/* 20 ── สิ่งที่ขอ ────────────────────────────────── */
{
    accent: true,
    eyebrow: 'ขั้นตอนถัดไป',
    title: 'สิ่งที่ขอเพื่อเริ่มดำเนินการ',
    body: `
    <div class="pr-grid pr-g2" style="margin-bottom:12px">
        <div class="pr-card info">
            <h3>1 · แต่งตั้งคณะทำงานร่วม</h3>
            <div class="pr-kv">
                หน่วย Claim · เวชระเบียน/Coder · ฝ่ายการเงิน · ผู้แทนแพทย์ ·
                หน่วยบริการต้นทาง · ศูนย์คอมพิวเตอร์ — เพื่อดำเนินกิจกรรม Discovery &amp; Baseline
            </div>
        </div>
        <div class="pr-card amber">
            <h3>2 · เปิดสิทธิ์เข้าถึงข้อมูล</h3>
            <div class="pr-kv">
                HIS / ฐานข้อมูล / ไฟล์ Claim ที่อนุญาตให้เชื่อม พร้อมระบุ Data Owner ·
                รายชื่อประกาศและคู่มือที่รับรองแล้ว พร้อมวงรอบการทบทวน
            </div>
        </div>
    </div>

    <div class="pr-card" style="margin-bottom:12px">
        <h3>3 · เลือกกรณีนำร่องร่วมกัน</h3>
        <div class="pr-grid pr-g4" style="margin-top:7px">
            <div class="pr-kv">• กองทุนและประเภทเคสที่จะใช้เป็น Pilot<br>&nbsp;&nbsp;พร้อมจำนวนเคสย้อนหลัง</div>
            <div class="pr-kv">• รายการ Reject สำคัญ 10–20 อันดับแรก<br>&nbsp;&nbsp;และมูลค่าผลกระทบ</div>
            <div class="pr-kv">• Role · Approval matrix · SLA<br>&nbsp;&nbsp;และกรณีที่อนุญาตให้ Blocking/Override</div>
            <div class="pr-kv">• KPI Baseline และนิยามสูตร<br>&nbsp;&nbsp;ที่ผู้บริหารจะใช้ประเมินผล</div>
        </div>
    </div>

    <div class="pr-note strong" style="margin-bottom:10px">
        <strong>เงื่อนเวลา:</strong> NHSO Phase 3 Go-Live เป้าหมาย <strong>16 กันยายน 2569</strong>
        — เพื่อให้ตรวจก่อนส่งได้ตั้งแต่วันแรกที่ขึ้นระบบ ระยะ 0 (Discovery &amp; Baseline)
        ควรเริ่มภายในเดือนสิงหาคม 2569
    </div>

    <div class="pr-card navy">
        <div style="font-size:calc(1.5*var(--u));line-height:1.6">
            ผลลัพธ์ที่ต้องการ <strong>ไม่ใช่เพียงเครื่องมือตรวจ Claim</strong>
            แต่เป็นระบบที่เปลี่ยนประสบการณ์จากการทำงานให้เป็น
            <strong>“กฎและองค์ความรู้ของโรงพยาบาล”</strong> ซึ่งตรวจสอบ ปรับปรุง และส่งต่อได้
        </div>
    </div>`,
    foot: 'เริ่มเล็กจากเคสที่เห็นผลได้จริง วัดผลจาก Baseline และขยายระบบตามหลักฐานการใช้งาน',
},

];

window.PRESENT_SLIDES = PRESENT_SLIDES;
