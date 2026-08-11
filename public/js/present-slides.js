/* ────────────────────────────────────────────────────────
   เนื้อหาสไลด์นำเสนอผู้บริหาร — ฉบับเต็ม

   ที่มาของเนื้อหา
     · เสียงจากหน้างาน — pain point ที่ผู้บริหารโรงพยาบาลให้กลับมาหลังนำเสนอรอบแรก (หน้า 1B–1D)
     · SRS_Claim_Intelligence_Readiness_Platform_v1.0 (3 ส.ค. 2569)
     · โครงการ NHSO Digital Platform_Commu_03082026_V4.pdf (3 ส.ค. 2569) — เอกสารส่งเคลมรุ่นล่าสุด
     · Executive_Summary_Claim_Intelligence_4_Pages

   หน้า 1B–1D คือส่วนเกริ่น "ที่มาของโครงการ" ที่ deck ทั้ง 3 ชุดใช้ร่วมกัน
   (prfPainMap / prfPainScope ใน present-flows.js §8) — แก้ถ้อยคำที่นั่นที่เดียว

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
    eyebrow: 'ข้อเสนอเชิงระบบ',
    title: 'MediClearing — ระบบครอบคลุมงานอะไรบ้าง',
    /* lead ต้องยาวไม่เกิน 1 บรรทัด — prfCoverage คำนวณสัดส่วนจากพื้นที่ .pr-body
       ที่เหลือหลัง lead 1 บรรทัด ถ้าตกไปบรรทัดที่สองผังจะย่อลงทั้งใบทันที
       (จึงตัด "ทำงานเสริมกับ HIS เดิม" ออก — ประเด็นนี้มีสไลด์ของตัวเองอยู่แล้ว) */
    lead: 'ระบบบริหารวงจรรายได้โรงพยาบาล (RCM) — 4 เส้นงานที่มาจบที่คิวส่งเบิกเดียวกัน ' +
          'แล้วต่อด้วยงานการเงินจนเงินเข้าบัญชี',
    body: `<div class="pr-flow">${prfCoverage()}</div>`,
    foot: 'อ้างอิง: SRS v1.0 (3 ส.ค. 2569) · NHSO Digital Platform Communication V4 (3 ส.ค. 2569)',
},

/* 1B ── ที่มาของโครงการ: เสียงจากหน้างาน ─────────────── */
{
    eyebrow: 'ที่มาของโครงการ',
    title: 'สิ่งที่โรงพยาบาลบอกมา — 6 เรื่องบนเส้นทางเดียวกัน',
    lead: 'ไม่ใช่ 6 ปัญหาแยกกัน แต่เป็นจุดสะดุด 6 จุดบนเส้นทางเดียวของรายได้ ' +
          'ตั้งแต่ให้บริการผู้ป่วยจนถึงปิดลูกหนี้รายตัว',
    body: `<div class="pr-flow">${prfPainMap()}</div>`,
    foot: 'สรุปจากการนำเสนอและข้อคิดเห็นของผู้บริหารโรงพยาบาล — ยังไม่มีตัวเลข Baseline จากข้อมูลจริง',
},

/* 1C ── 6 หัวข้องานที่เป็นความต้องการ ───────────────────
   6 การ์ดใน 2 แถวบนสไลด์เดียว = การ์ดละ ~19u เท่านั้น และ .pr-body
   เป็น overflow:hidden (ล้นแล้วโดนตัดเงียบ ๆ ไม่มีสัญญาณเตือน)
   จึงคุมความยาวไว้ที่ หัวข้อ 1 บรรทัด · คำพูด 2 บรรทัด · bullet บรรทัดละข้อ
   ถ้าจะเติมข้อความ ให้ลด k ลงด้วย ไม่งั้นบรรทัดท้ายของแถวล่างจะหายไป */
{
    k: .90,
    eyebrow: 'ความต้องการ',
    title: '6 หัวข้องานที่ถอดออกมาจากสิ่งที่บอกมา',
    lead: 'ข้อความในเครื่องหมายคำพูดคือสิ่งที่ได้ยินจากหน้างาน บรรทัดล่างคืองานที่ต้องทำเพื่อปิดเรื่องนั้น',
    body: `
    <div class="pr-grid pr-g3" style="height:100%;grid-template-rows:1fr 1fr">
        <div class="pr-card danger">
            <h3>1 · คิวงานค้าง + นาฬิกากำหนดส่ง</h3>
            <div class="pr-kv">“ไม่รู้ว่าติดอยู่กี่เคส ติดเรื่องไหน นานหรือยัง
                จนบางทีเลยกำหนดส่ง ทำให้เบิกไม่ได้”</div>
            <ul class="pr-ul">
                <li>เห็นเคส สาเหตุ อายุงาน เจ้าของงาน ครบหน้าเดียว</li>
                <li>วัดด้วย <b>เคสที่หลุดกำหนดส่ง</b> ต่องวด</li>
            </ul>
        </div>
        <div class="pr-card danger">
            <h3>2 · สถิติสาเหตุที่ติด และผลหลังแก้</h3>
            <div class="pr-kv">“ไม่มีสถิติว่าติดเรื่องไหน ตีกลับเป็นอย่างไร
                แก้ส่งไปแล้วเป็นไงบ้าง ทำข้อมูลก็นาน ไม่แน่ใจว่าถูก”</div>
            <ul class="pr-ul">
                <li>จัดอันดับสาเหตุ และอัตราผ่านหลังแก้</li>
                <li>วัดด้วย <b>อัตราผ่านของประเด็นเดิม</b></li>
            </ul>
        </div>
        <div class="pr-card danger">
            <h3>3 · ติดตามจนปิดลูกหนี้รายตัว</h3>
            <div class="pr-kv">“ปิดลูกหนี้รายตัวครบไหม ขาดช่วงของการติดตาม
                และตกหล่น พอรู้อีกทีก็หายแล้ว”</div>
            <ul class="pr-ul">
                <li>เส้นเดียว ส่ง → ผลตรวจ → รับเงิน → ปิด</li>
                <li>วัดด้วย <b>เคสที่ไม่มีใครถือเกิน SLA</b></li>
            </ul>
        </div>
        <div class="pr-card danger">
            <h3>4 · กระทบยอดเงินโอนกับยอดส่งเบิก</h3>
            <div class="pr-kv">“เงินเข้ามาชนยอดส่งเบิกไม่ได้ คนละหน่วยงาน
                บางเคสส่งหลายกองทุน โอนมาก่อนแต่ไม่รู้ว่าของยอดไหน”</div>
            <ul class="pr-ul">
                <li>แตกยอดโอนกลับไปหางวด กองทุน และเคส</li>
                <li>วัดด้วย <b>ยอดที่กระทบไม่ลงตัว</b> ที่ค้างอยู่</li>
            </ul>
        </div>
        <div class="pr-card amber">
            <h3>★ 5 · ค่าส่งต่อ = ต้นทุนรายผู้ป่วย</h3>
            <div class="pr-kv">“การส่งไปรักษาต่อภายนอก ไม่ได้เป็นส่วนเดียวกับ
                การสรุปรายจ่ายรายบุคคล จึงไม่รู้ต้นทุนจริง”</div>
            <ul class="pr-ul">
                <li>ใบส่งตัว เลขอนุมัติ วงเงิน ผูกกับเคสที่ใช้เบิก</li>
                <li>วัดด้วย <b>ต้นทุน–รายรับรายคน</b> ก่อนตัดสินใจส่ง</li>
            </ul>
        </div>
        <div class="pr-card info">
            <h3>6 · ย้ายความรู้จากคนมาไว้ในระบบ</h3>
            <div class="pr-kv">“อยากให้การทำงานสั้นลง ระบบช่วยงาน routine
                ไม่ต้องพึ่งความชำนาญส่วนตัว ลดเวลาและแรงงาน”</div>
            <ul class="pr-ul">
                <li>กฎ + คลังความรู้พร้อมประกาศอ้างอิง</li>
                <li>วัดด้วย <b>เวลาต่อเคส</b> และ <b>คนใหม่ทำงานได้ในกี่วัน</b></li>
            </ul>
        </div>
    </div>`,
    foot: 'ข้อ 5 มีดาวเพราะเป็นเส้นงานที่เดิมไม่มีระบบรองรับเลย',
},

/* 1D ── จากความต้องการสู่ส่วนงานที่รองรับ ────────────── */
{
    eyebrow: 'ขอบเขตงาน',
    title: '6 เรื่องที่บอกมา → 6 หัวข้องาน → ส่วนงานที่รองรับ',
    body: `<div class="pr-flow">${prfPainScope()}</div>`,
    foot: 'ทุกหัวข้อมีหน้าจอต้นแบบเปิดใช้งานได้แล้ววันนี้ — ★ คือเส้นงานที่เพิ่มใหม่ในรอบนี้',
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
                <h3>ปัญหา 3 ข้อ</h3>
                <div class="pr-kv">
                    <b>1.</b> สปสช. ตรวจ <strong>หลัง</strong> เราส่ง — ได้รหัสผิดพลาดกลับมา
                    ต้องหาคนแก้ แก้ที่ HIS แล้วส่งใหม่ เสียไปหนึ่งรอบส่งเบิกเต็ม ๆ<br>
                    <b>2.</b> การส่งผู้ป่วยไปรักษาข้างนอก <strong>ไม่มีที่บันทึกในระบบเลย</strong><br>
                    <b>3.</b> งานผู้ป่วยใน <strong>ไม่มีด่านตรวจแฟ้ม</strong> —
                    รู้ว่าเอกสารไม่ครบตอนจำหน่ายไปแล้ว
                </div>
            </div>
            <div class="pr-card good">
                <h3>ข้อเสนอ</h3>
                <div class="pr-kv">รันกฎ <strong>ชุดเดียวกัน</strong> ตั้งแต่ก่อนกดส่ง
                    พร้อมติดประกาศอ้างอิง เจ้าของงาน และ SLA ให้ทุกประเด็น ·
                    เพิ่ม <strong>โมดูลควบคุมการส่งต่อ</strong> และ
                    <strong>โมดูลติดตามการรักษาผู้ป่วยใน</strong> ที่เดิมไม่มีระบบรองรับ</div>
            </div>
            <div class="pr-card" style="flex:1">
                <h3>4 เสาหลัก + 2 โมดูลใหม่</h3>
                <ul class="pr-ul">
                    <li><b>Rule Engine</b> — ตรวจเงื่อนไขที่แน่นอนตามกองทุนและวันที่มีผล</li>
                    <li><b>RAG Knowledge Base</b> — ค้นและอธิบายหลักเกณฑ์พร้อมแหล่งอ้างอิง</li>
                    <li><b>Workflow / Task</b> — Owner · SLA · Approval · Override</li>
                    <li><b>Reject Feedback Loop</b> — เปลี่ยนผลตีกลับเป็นกฎของโรงพยาบาล</li>
                    <li><b>★ ควบคุมการส่งต่อ</b> — ใบส่งตัว · เลขอนุมัติ · วงเงิน · ตามจ่าย</li>
                    <li><b>★ ติดตามผู้ป่วยใน</b> — เอกสารระหว่างนอน · DRG · ตรวจแฟ้มตามกองทุน</li>
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

/* 3 ── สาเหตุร่วมของปัญหาหน้างาน ──────────────────────
   หน้า 1B–1D เล่าว่า "หน้างานเจออะไร" แล้ว — หน้านี้จึงไม่เล่าปัญหาซ้ำ
   แต่ตอบว่าทำไมถึงเป็นแบบนั้น และ สปสช. เองก็สำรวจเจอเรื่องเดียวกัน */
{
    k: .95,                      /* เพิ่ม lead เข้ามาแล้วเนื้อเดิมเริ่มชนขอบล่าง */
    eyebrow: 'สาเหตุร่วม',
    title: 'ทำไมถึงเป็นแบบนั้น — สาเหตุเชิงกระบวนการ',
    lead: 'ทั้ง 6 เรื่องที่หน้างานเจอ มีต้นเหตุร่วมกันไม่กี่อย่าง และ สปสช. เองก็ระบุไว้ตรงกัน',
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
            ทั้งขั้นตรวจสอบเบื้องต้นและขั้นตรวจสอบก่อนจ่าย และทั้งคู่ย้อนกลับไปที่จุดเดียวกัน
            · ทุกครั้งที่เข้าวงจรนี้ คือหนึ่งรอบส่งเบิกที่รายได้ถูกเลื่อนออกไป
        </div>
    </div>`,
},

/* 5 ── Status Pipeline ──────────────────────────────── */
{
    eyebrow: 'บริบท NHSO',
    title: 'หน้าแรกของ สปสช. ถามคำถามเดียว: ตอนนี้งานอยู่ที่ใคร',
    lead: 'ทุกรายการเป็นลูกของฝั่งใดฝั่งหนึ่งเสมอ — และแสดง 2 ยอดคู่กันทุกวิดเจ็ต '
        + 'ยอดเรียกเก็บ (ฟ้า) / ยอดชดเชย (เขียว)',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.8*var(--u));height:100%">
    <div style="flex:none">${prfStatusFlow()}</div>
    <div class="pr-grid pr-g3" style="flex:1;min-height:0">
        <div class="pr-card danger">
            <h3>รอดำเนินการโดย <b>หน่วยบริการ</b></h3>
            <div class="pr-chip red" style="margin-bottom:6px">เวลาที่โรงพยาบาลคุมได้เอง</div>
            <table class="pr-table">
                <tr><td colspan="2"><b>รอส่งเบิก</b></td></tr>
                <tr><td class="c">·</td><td>กำลังตรวจสอบเบื้องต้น</td></tr>
                <tr><td class="c">·</td><td>รอส่งเบิก</td></tr>
                <tr><td class="c">·</td><td>ยกเลิกและรอส่งใหม่</td></tr>
                <tr><td colspan="2"><b>รอแก้ไข</b></td></tr>
                <tr><td class="c">·</td><td>ไม่ผ่านการตรวจสอบเบื้องต้น</td></tr>
                <tr><td class="c">·</td><td>ส่งเบิกไม่สำเร็จ</td></tr>
                <tr><td class="c">·</td><td>รอยืนยัน Authen</td></tr>
                <tr><td class="c">·</td><td>ไม่ผ่านการประมวลผล</td></tr>
                <tr><td class="c">·</td><td>รอชี้แจงความผิดปกติ</td></tr>
            </table>
        </div>
        <div class="pr-card info">
            <h3>รอดำเนินการโดย <b>สปสช.</b></h3>
            <div class="pr-chip blue" style="margin-bottom:6px">รอฝั่งผู้จ่าย</div>
            <table class="pr-table">
                <tr><td class="c">·</td><td>รอประมวลผล</td></tr>
                <tr><td class="c">·</td><td>อยู่กระบวนการ Audit (Rules 3D)</td></tr>
                <tr><td class="c">·</td><td>รอจ่ายเงิน</td></tr>
                <tr><td class="c">·</td><td>ออกรายงานการจ่ายเงิน</td></tr>
            </table>
            <div class="pr-note strong" style="margin-top:8px">
                ทุกสถานะฝั่ง “รอแก้ไข” จบลงที่เดียวกัน —
                หน่วยบริการต้องกลับไปแก้ที่ <b>HIS</b> แล้วส่งเข้ามาใหม่
                (หน้าจอ สปสช. แก้ข้อมูลไม่ได้)
            </div>
        </div>
        <div class="pr-card">
            <h3>รหัสกิจกรรมในประวัติรายการ</h3>
            <table class="pr-table">
                <tr><td class="c"><b>F000</b></td><td>กำลังนำเข้าไฟล์</td></tr>
                <tr><td class="c"><b>F001</b></td><td>กำลังตรวจสอบเบื้องต้น</td></tr>
                <tr><td class="c"><b>F002</b></td><td>ตรวจสอบเบื้องต้นเสร็จสิ้น</td></tr>
            </table>
            <div class="pr-note" style="margin-top:8px">
                ระบบเราเก็บ F000/F001/F002 ไว้ในไทม์ไลน์ของเคส
                จึงนับ “จำนวนรอบการส่ง” ต่อเคสได้ตรง ๆ
            </div>
            <div class="pr-note strong" style="margin-top:6px">
                <b>จุดที่ระบบเราสร้างมูลค่า</b> คือถังซ้าย —
                ทุกวันที่รายการค้างอยู่ฝั่งหน่วยบริการ คือวันที่เงินยังไม่เข้า
            </div>
        </div>
    </div>
    </div>`,
},

/* 6 ── Standard Dataset ─────────────────────────────── */
{
    k: 1.05,
    eyebrow: 'บริบท NHSO',
    title: 'Standard Dataset — 15 แฟ้ม 5 กลุ่ม รวม 160 Data Points',
    lead: 'ประกาศ สปสช. พ.ศ. 2566 กำหนดไว้ครบ: บังคับ 72 ฟิลด์ · มีเงื่อนไข 16 · อื่น ๆ 72 '
        + '— ตัวเลขนี้คือขอบเขตของสิ่งที่ระบบเราต้องตรวจให้ครบ',
    body: `
    <div class="pr-grid pr-g5">
        <div class="pr-card info">
            <h3>ข้อมูลหลัก <span class="pr-chip blue">33 ฟิลด์</span></h3>
            <div class="pr-chip blue" style="margin-bottom:6px">ใครรักษาใครที่ไหน</div>
            <ul class="pr-ul" style="padding-left:1em">
                <li>1 · NHSO Patient <span style="color:var(--text-muted)">18 (บังคับ 3)</span></li>
                <li>2 · NHSO Provider <span style="color:var(--text-muted)">7 (บังคับ 2)</span></li>
                <li>3 · NHSO Practitioner <span style="color:var(--text-muted)">8 (บังคับ 3)</span></li></ul>
        </div>
        <div class="pr-card">
            <h3>ข้อมูลการรักษา <span class="pr-chip">29 ฟิลด์</span></h3>
            <div class="pr-chip" style="margin-bottom:6px">เป็นอะไรรักษาอย่างไร</div>
            <ul class="pr-ul" style="padding-left:1em">
                <li>4 · NHSO OPD <span style="color:var(--text-muted)">17 (บังคับ 4)</span></li>
                <li>5 · NHSO Diagnosis <span style="color:var(--text-muted)">6 · ICD-10</span></li>
                <li>6 · NHSO Procedure <span style="color:var(--text-muted)">6 · ICD-9-CM</span></li></ul>
        </div>
        <div class="pr-card amber">
            <h3>ข้อมูลการเงิน <span class="pr-chip amber">23 ฟิลด์</span></h3>
            <div class="pr-chip amber" style="margin-bottom:6px">คิดเงินเท่าไหร่</div>
            <ul class="pr-ul" style="padding-left:1em">
                <li>7 · NHSO CHAD <span style="color:var(--text-muted)">15 (บังคับ 8)</span><br>
                    <span style="color:var(--text-muted)">ค่าใช้จ่ายรายรายการ</span></li>
                <li>8 · NHSO CHA <span style="color:var(--text-muted)">8 (บังคับ 7)</span><br>
                    <span style="color:var(--text-muted)">รายละเอียดทางการเงิน</span></li></ul>
        </div>
        <div class="pr-card">
            <h3>กลุ่มเฉพาะ <span class="pr-chip">46 ฟิลด์</span></h3>
            <div class="pr-chip" style="margin-bottom:6px">ส่งเมื่อเข้าเงื่อนไข</div>
            <ul class="pr-ul" style="padding-left:1em">
                <li>9 · NHSO AER <span style="color:var(--text-muted)">15</span></li>
                <li>10 · NHSO Prenatal <span style="color:var(--text-muted)">8</span></li>
                <li>11 · NHSO Newborn <span style="color:var(--text-muted)">8</span></li>
                <li>12 · NHSO CMHS <span style="color:var(--text-muted)">6</span></li>
                <li>13 · NHSO Disability <span style="color:var(--text-muted)">9</span></li></ul>
        </div>
        <div class="pr-card good">
            <h3>ผู้ป่วยใน <span class="pr-chip green">29 ฟิลด์</span></h3>
            <div class="pr-chip green" style="margin-bottom:6px">Admissions</div>
            <ul class="pr-ul" style="padding-left:1em">
                <li>14 · NHSO IPD <span style="color:var(--text-muted)">23 (บังคับ 9)</span></li>
                <li>15 · NHSO LVD <span style="color:var(--text-muted)">6</span><br>
                    <span style="color:var(--text-muted)">กรณีลากลับบ้าน</span></li></ul>
            <div class="pr-note strong" style="margin-top:8px;font-size:calc(.98*var(--u))">
                สองแฟ้มนี้เพิ่มใน Phase 3 · Go-Live 16 ก.ย. 2569
            </div>
        </div>
    </div>
    <div class="pr-note" style="margin-top:9px">
        ที่มาโครงสร้าง — แฟ้ม 1–9 อ้างอิง 16 แฟ้มของ e-Claim เดิม · แฟ้ม 10–13 อ้างอิง DMIS ·
        แฟ้ม 14–15 อ้างอิงโครงสร้างผู้ป่วยใน
        <span style="color:var(--text-muted)">(Overview 23 มิ.ย. 2569 น.12–13)</span>
    </div>`,
},

/* 6B ── กองทุน × แฟ้ม (ใหม่) ─────────────────────────── */
{
    eyebrow: 'สเปกที่แปลงเป็นกฎได้ทันที',
    title: 'แต่ละกองทุนต้องส่งแฟ้มไม่เท่ากัน — 12 กองทุน × 15 แฟ้ม',
    lead: 'ประกาศ สปสช. กำหนดตารางนี้ไว้ชัด · เป็นตารางที่ระบบเราแปลงเป็นกฎ RUL-FIL-001 '
        + 'แล้วตรวจได้ตั้งแต่ก่อนกดส่ง — ไม่ต้องรอ สปสช. ตีกลับมาบอก',
    body: `
    <div style="display:flex;flex-direction:column;gap:9px;height:100%">
        <div class="pr-card info">
            <h3>แฟ้มที่ทุกกองทุนต้องส่งเหมือนกัน</h3>
            <p>1 Patient · 2 Provider · 4 OPD · 7 CHAD · 8 CHA
               <span style="color:var(--text-muted)">— แกนกลางที่ขาดไม่ได้ทุกกองทุน</span></p>
        </div>
        <div class="pr-grid pr-g3" style="flex:1">
            <div class="pr-card">
                <h3>ตัวอย่างที่ต่างกันชัด</h3>
                <ul class="pr-ul" style="padding-left:1em">
                    <li><b>ผู้ป่วยนอกทั่วไป</b> → แฟ้ม 1–11</li>
                    <li><b>QOF</b> → 1,2,4,5,6,7,8 <span style="color:var(--text-muted)">(7 แฟ้ม)</span></li>
                    <li><b>LTC</b> → 1,2,4,7,8 <span style="color:var(--text-muted)">(5 แฟ้ม)</span></li>
                    <li><b>ผู้ป่วยใน (IP)</b> → +14, 15</li>
                    <li><b>อุบัติเหตุ/ฉุกเฉิน</b> → +9 (AER)</li>
                </ul>
            </div>
            <div class="pr-card amber">
                <h3>แฟ้มกลุ่มเฉพาะ ส่งเมื่อเข้าเงื่อนไข</h3>
                <ul class="pr-ul" style="padding-left:1em">
                    <li>9 AER → อุบัติเหตุ ฉุกเฉิน รับส่งต่อ</li>
                    <li>10/11 → ตั้งครรภ์ / คลอดทารก</li>
                    <li>12 CMHS → จิตเวชเรื้อรังในชุมชน</li>
                    <li>13 → ผู้พิการ</li>
                    <li>15 LVD → ผู้ป่วยในลากลับบ้าน</li>
                </ul>
            </div>
            <div class="pr-card danger">
                <h3>ทำไมเรื่องนี้สำคัญ</h3>
                <p>แฟ้มขาดแม้แฟ้มเดียว = <b>ไม่ผ่านการตรวจสอบเบื้องต้น</b>
                   ต้องแก้ที่ HIS แล้วส่งใหม่ทั้งรอบ</p>
                <div class="pr-note strong" style="margin-top:8px">
                    กฎ RUL-FIL-001 ตรวจให้อัตโนมัติทุกเคส ก่อนกดส่ง
                </div>
            </div>
        </div>
        <div class="pr-note">
            ที่มา: Overview 23 มิ.ย. 2569 น.14–16 “กองทุนค่าใช้จ่ายตามโครงสร้างชุดข้อมูลมาตรฐานการเบิกจ่ายชดเชย”
        </div>
    </div>`,
},

/* 6C ── กลุ่มบริการชุดที่ 2 (ใหม่) ───────────────────── */
{
    k: 1.12,
    eyebrow: 'ขอบเขตที่ต้องรู้ก่อนวางแผน',
    title: 'สิ่งที่ยังส่งผ่าน Platform ใหม่ไม่ได้ — CKD · HIV · TB',
    lead: 'ชุดข้อมูลมาตรฐานประกาศเสร็จแล้ว 11 กลุ่มบริการ (ณ 31 มี.ค. 2567) '
        + 'แต่ยังเหลืออีก 3 กลุ่มที่ยังไม่ประกาศ — โรงพยาบาลต้องคงช่องทางเดิมไว้',
    body: `
    <div class="pr-grid pr-g2">
        <div class="pr-card good">
            <h3>ชุดที่ 1 — ประกาศแล้ว <span class="pr-chip green">11 กลุ่ม</span></h3>
            <div class="pr-chip green" style="margin-bottom:6px">ณ 31 มีนาคม 2567</div>
            <ul class="pr-ul" style="padding-left:1em">
                <li>ผู้ป่วยนอกทั่วไป · สร้างเสริมสุขภาพและป้องกันโรค</li>
                <li>บริการปฐมภูมิเพิ่มเติม (QOF)</li>
                <li>จิตเวชเรื้อรังในชุมชน · เบาหวาน/ความดัน</li>
                <li>แพทย์แผนไทยและการแพทย์ทางเลือก</li>
                <li>ฟื้นฟูสมรรถภาพด้านการแพทย์ · ผู้ป่วยระยะสุดท้าย</li>
                <li>กลุ่มโรคมะเร็ง · Tele Med · ผู้ป่วยใน</li>
            </ul>
        </div>
        <div class="pr-card danger">
            <h3>ชุดที่ 2 — ยังดำเนินการอยู่ <span class="pr-chip red">3 กลุ่ม</span></h3>
            <div class="pr-chip red" style="margin-bottom:6px">ยังไม่ประกาศชุดข้อมูลมาตรฐาน</div>
            <ul class="pr-ul" style="padding-left:1em">
                <li><b>การบริการบำบัดทดแทนไต (CKD)</b></li>
                <li><b>ผู้ติดเชื้อ HIV และผู้ป่วยโรคเอดส์</b></li>
                <li><b>ผู้ป่วยวัณโรค (TB)</b></li>
            </ul>
            <div class="pr-note strong" style="margin-top:10px">
                ผลต่อแผนโครงการ: ยังเลิกใช้ช่องทางเดิมไม่ได้ทั้งหมด
                ต้องเดินคู่ขนานสองระบบไปก่อน — และงบส่วนนี้ยังกระทบยอดแยก
            </div>
            <div class="pr-note" style="margin-top:6px">
                กฎ RUL-SET-001 เตือนอัตโนมัติถ้ามีเคสกลุ่มนี้หลุดเข้ามาในคิวส่ง NHSO
            </div>
        </div>
    </div>
    <div class="pr-note" style="margin-top:9px">
        ที่มา: Overview 23 มิ.ย. 2569 น.13
    </div>`,
},

/* 7 ── Error จริง ──────────────────────────────────── */
{
    eyebrow: 'ของจริงจากหน้าจอ สปสช.',
    title: 'รหัสข้อผิดพลาดที่หน่วยบริการเจอจริง',
    lead: 'ทั้งสามรหัสนี้ถอดมาจากหน้าจอ “ผลการตรวจสอบ” ของ NHSO Digital Platform โดยไม่แก้ถ้อยคำ — '
        + 'ตัวรหัสยังรอยืนยันกับ สปสช. เพราะอยู่ในภาพหน้าจอ ไม่ใช่เนื้อความเอกสาร',
    body: `
    <div style="display:flex;flex-direction:column;gap:9px;height:100%">
        <div class="pr-card danger">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
                <span class="pr-chip red">ERROR</span>
                <strong style="font-size:calc(1.4*var(--u));color:var(--brand-navy)">ปัญหาที่พบจากการตรวจสอบเบื้องต้น</strong>
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

        <div class="pr-note" style="flex:none">
            <strong>ข้อควรรู้เรื่องรหัส</strong> — เอกสาร Overview 23 มิ.ย. 2569 น.8 ระบุว่า สปสช.
            จะรวบรวม “Error ที่พบบ่อย” พร้อมแนวทางแก้ไขเผยแพร่ · เมื่อได้แคตตาล็อกฉบับจริง
            ระบบจะแทนที่รหัสทั้งชุดทันที เพราะ Rule Engine ผูกรหัสไว้ที่ข้อมูล ไม่ได้ฝังในโปรแกรม
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
    eyebrow: 'เดินหน้าจอ 1 / 6',
    title: 'ภาพรวมผู้บริหาร และคิวเคลม',
    lead: 'กดปุ่มใต้การ์ดเพื่อเปิดหน้าจริงในต้นแบบ (เปิดแท็บใหม่)',
    body: `<div class="pr-grid pr-g2" style="height:100%">
        ${prScreen('Executive Dashboard — ภาพรวมผู้บริหาร', 'claim-dashboard.html', [
            '<b>KPI 10 ช่อง</b> · จัดหน้าเป็น <b>4 โซนตามเส้นงาน</b>: เคลม OPD → ผู้ป่วยใน → ส่งต่อ → สปสช.',
            '<b>กดที่ KPI ได้ทุกช่อง</b> — ระบบจะบอกสูตรและฟิลด์ที่ใช้คำนวณ ตอบคำถาม “ตัวเลขนี้จริงไหม”',
            '★ โซนผู้ป่วยใน: กำลังนอน · เกินจุดตัด DRG · แฟ้มไม่ครบ · คิวตรวจแฟ้ม · เคสที่ต้องแก้',
            '★ โซนส่งต่อ: ยอดตามจ่ายค้าง · ใบส่งตัวที่มีปัญหา · ปลายทางที่ส่งไปมากที่สุด',
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
    eyebrow: 'เดินหน้าจอ 2 / 6',
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
    eyebrow: 'เดินหน้าจอ 3 / 6',
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
    eyebrow: 'เดินหน้าจอ 4 / 6',
    title: 'วิเคราะห์การตีกลับ และโมดูลส่งเบิก NHSO',
    body: `<div class="pr-grid pr-g2" style="height:100%">
        ${prScreen('Reject Analysis — วิเคราะห์การตีกลับ', 'claim-reject.html', [
            'Pareto สาเหตุ 10 อันดับ พร้อม % สะสม — เห็นทันทีว่าแก้อะไรก่อนคุ้มที่สุด',
            'จัดหมวดตามอนุกรมวิธานของ สปสช.: ไม่ผ่านตรวจสอบเบื้องต้น / ไม่ผ่านประมวลผล / ตัดจ่ายหลัง Audit',
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

/* 15B ── ⭐ ควบคุมการส่งต่อไปรักษาภายนอก — ผังงาน ──────
   เดิม deck ชุดนี้ไม่มีเรื่องส่งต่อเลย ทั้งที่เป็นช่องโหว่ทางการเงินที่ใหญ่ที่สุด
   ใช้ผังเดียวกับ deck ผู้บริหารเพื่อไม่ให้เล่าคนละเรื่องกัน */
{
    eyebrow: '⭐ โมดูลใหม่ 1 / 2',
    title: 'ควบคุมการส่งต่อไปรักษาภายนอก — ขออนุมัติ 2 ชั้นตามวงเงิน',
    lead: 'ส่วนที่เดิมอยู่บนกระดาษทั้งหมด — ใบส่งตัว เลขอนุมัติ ขอบเขต และวงเงิน',
    body: `<div class="pr-flow">${pmReferMenuFlow()}</div>`,
    foot: 'เลขที่ใบส่งตัวและเลขอนุมัติ ระบบออกให้หลังอนุมัติเท่านั้น — กรอกเองไม่ได้ (BR-05)',
},

/* 15C ── ⭐ ควบคุมการส่งต่อ — เดินหน้าจอ ────────────── */
{
    eyebrow: '⭐ เดินหน้าจอ 5 / 6 · โมดูลใหม่',
    title: 'หน้าจอชุดควบคุมการส่งต่อ',
    body: `<div class="pr-grid pr-g2" style="height:100%">
        ${prScreen('ทะเบียนการส่งต่อ + สร้างคำขอ', 'refer-worklist.html', [
            'สองทิศทางในหน้าเดียว — ส่งออก (เราตามจ่าย) และรับเข้า (เราเรียกเก็บ)',
            '<b>คอลัมน์เลขอนุมัติ · วันหมดอายุ · ธงความเสี่ยง 5 แบบ</b> — เห็นใบที่มีปัญหาทันที',
            'สร้างคำขอมี <b>ปุ่มดึงข้อมูลจาก HIS 9 หมวด</b> — ต่อท้ายข้อความเดิม ไม่ทับที่แพทย์เขียน',
            'แผงความพร้อม 8 ข้อ อัปเดตสด — ส่งขออนุมัติไม่ได้ถ้าของที่ผู้อนุมัติต้องใช้ยังไม่ครบ',
            'ผู้เสนอกับผู้อนุมัติต้องคนละคน ระบบปิดปุ่มให้ (BR-05)',
        ])}
        ${prScreen('อนุมัติผู้บริหาร + ตามจ่าย/เรียกเก็บ', 'exec-approve.html', [
            '<b>วงเงินเกิน 250,000 บาท</b> จึงขึ้นถึงโต๊ะผู้บริหาร — ต่ำกว่านั้นจบที่ชั้นเจ้าหน้าที่',
            'เป็น <b>ตารางทั้งคิว</b> ไม่ใช่ทีละใบ เพราะผู้บริหารตัดสินจากการเทียบยอดผูกพันทั้งงวด',
            'อนุมัติ/ตีกลับทีละหลายรายการพร้อมเหตุผลที่ลง Audit Trail (BR-04)',
            'ตามจ่าย: <b>ตรวจใบเรียกเก็บรายบรรทัดเทียบขอบเขตในใบส่งตัว</b> — โต้แย้งเฉพาะส่วนเกิน',
            'อายุหนี้ 4 ช่วง และยอดที่ยังไม่ถึงกำหนดชำระ',
        ])}
    </div>`,
    foot: 'ยอดตามจ่ายค้างขึ้นบนภาพรวมผู้บริหารตั้งแต่ขั้นขออนุมัติ — ก่อนกลายเป็นหนี้จริง',
},

/* 15D ── ⭐ ติดตามการรักษาผู้ป่วยใน — ผังงาน ────────── */
{
    eyebrow: '⭐ โมดูลใหม่ 2 / 2',
    title: 'ติดตามการรักษาผู้ป่วยใน — จับเอกสารที่ขาดตั้งแต่ยังนอนอยู่',
    lead: 'เดิมทั้งระบบเป็น OPD ล้วน — ผู้ป่วยในคือก้อนเงินที่ใหญ่กว่าต่อราย',
    body: `<div class="pr-flow">${pmIpdFlow()}</div>`,
    foot: 'สอดรับกับ NHSO Go-Live 16 ก.ย. 2569 ที่เพิ่มผู้ป่วยใน (IPD) เข้ามาในระบบส่งเบิก',
},

/* 15E ── ⭐ ติดตามผู้ป่วยใน — เดินหน้าจอ ────────────── */
{
    eyebrow: '⭐ เดินหน้าจอ 6 / 6 · โมดูลใหม่',
    title: 'หน้าจอชุดผู้ป่วยใน',
    body: `<div class="pr-grid pr-g2" style="height:100%">
        ${prScreen('ทะเบียนผู้ป่วยใน + ติดตามระหว่างนอน', 'ipd-worklist.html', [
            'ทุก AN ในที่เดียว — กำลังนอน · รอตรวจแฟ้ม · ตีกลับ · ผ่านแล้ว',
            '<b>วันนอนเทียบจุดตัด DRG</b> — เกินจุดตัดบนขึ้นสีแดงตั้งแต่ยังนอนอยู่',
            '<b>ค่าใช้จ่ายจริง เทียบ ประมาณการรับตาม DRG</b> พร้อมคอลัมน์ส่วนต่าง',
            'หน้าติดตาม: ไทม์ไลน์รายวัน วันไหนขาด Progress note หรือคำสั่งแพทย์ขึ้นแดง',
            'คะแนนความพร้อม /100 = เวชระเบียน 60% + แฟ้ม 20% + เงื่อนไขกองทุน 20%',
        ])}
        ${prScreen('ตรวจแฟ้มผู้ป่วยใน — ด่านสุดท้ายก่อนส่งเบิก', 'ipd-audit.html', [
            'ผู้ตรวจเห็น <b>6 ด้านในหน้าจอเดียว</b> — เงื่อนไขกองทุน · แฟ้ม 1–15 · เวชระเบียน · DRG · ผลกฎ · สรุป',
            'ปุ่ม 3 สถานะทุกข้อ: ครบ / ไม่ครบ / ไม่เกี่ยวข้อง',
            '<b>ตีกลับให้แก้</b> → สร้างงานพร้อม checklist ให้หน่วยที่รับผิดชอบ',
            'ถ้าติดระดับ “ระงับส่ง” ระบบ <b>ไม่ยอมให้ผ่านเข้าคิวส่งเบิก</b>',
            'รองรับ 6 กองทุนที่มีเงื่อนไข ชุดเอกสาร และกำหนดยื่นต่างกัน',
        ])}
    </div>`,
    foot: '⚠️ ค่า DRG / อัตราจ่ายต่อ RW ในต้นแบบยังเป็นค่าจำลอง — ติดธง “รอยืนยัน” ไว้ทุกจุดจนกว่าจะได้ประกาศฉบับจริง',
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

/* 17B ── แผน 4 ปีของ สปสช. (ใหม่) ────────────────────── */
{
    k: 1.03,
    eyebrow: 'มองไกลกว่า Go-Live',
    title: '16 ก.ย. 2569 ไม่ใช่ปลายทาง — แผนปฏิบัติการ 4 ปี (2567–2570)',
    lead: 'สปสช. วางแผนถึงการบูรณาการเต็มรูปแบบ 1 ต.ค. 2569 ครบทุกกองทุน ทุกสิทธิ ทั่วประเทศ '
        + 'สิ่งที่เราสร้างวันนี้จึงต้องรองรับหลายผู้จ่าย ไม่ใช่ UC อย่างเดียว',
    body: `
    <div class="pr-grid pr-g3">
        <div class="pr-card good">
            <h3>ระยะที่ 1 <span class="pr-chip green">เสร็จแล้ว</span></h3>
            <div class="pr-chip green" style="margin-bottom:6px">2567 – กลางปี 2568</div>
            <p><b>วางรากฐานและระบบนำร่อง</b></p>
            <ul class="pr-ul" style="padding-left:1em">
                <li>2567 — ประกาศชุดข้อมูลมาตรฐาน (Standard Data Set for Claim)</li>
                <li>1 มิ.ย. 2568 — นำร่องหน่วยบริการปฐมภูมิบางส่วนใน กทม.</li>
            </ul>
        </div>
        <div class="pr-card amber">
            <h3>ระยะที่ 2 <span class="pr-chip amber">กำลังทำ</span></h3>
            <div class="pr-chip amber" style="margin-bottom:6px">ปลายปี 2568 – กลางปี 2569</div>
            <p><b>ขยายผลระดับประเทศ</b></p>
            <ul class="pr-ul" style="padding-left:1em">
                <li>1 ต.ค. 2568 — ครอบคลุม กทม. ทุกกองทุน</li>
                <li>1 เม.ย. 2569 — รพ.สต. และปฐมภูมิ 905 แห่ง</li>
                <li>1 พ.ค. 2569 — รพ.สต. ทั่วประเทศ</li>
                <li>ระดับโรงพยาบาล — <b>Go-Live 16 ก.ย. 2569</b></li>
            </ul>
        </div>
        <div class="pr-card info">
            <h3>ระยะที่ 3 <span class="pr-chip blue">ถัดไป</span></h3>
            <div class="pr-chip blue" style="margin-bottom:6px">อ้างอิง 1 ต.ค. 2569</div>
            <p><b>บูรณาการเต็มรูปแบบ</b></p>
            <ul class="pr-ul" style="padding-left:1em">
                <li>ใช้งานจริงกับหน่วยบริการทั้งประเทศ</li>
                <li>รองรับทุกกองทุนสุขภาพอย่างสมบูรณ์</li>
                <li>บันทึกใน HIS ครั้งเดียว เชื่อมโยงเบิกจ่ายได้ทันที</li>
            </ul>
            <div class="pr-note strong" style="margin-top:8px">
                UC · ประกันสังคม · ข้าราชการ · อปท. · กทม. · ขสมก. · รฟท. · ครูเอกชน · การแพทย์ฉุกเฉิน
            </div>
        </div>
    </div>
    <div class="pr-note" style="margin-top:9px">
        <strong>ข้อควรระวัง</strong> — เอกสารสองฉบับให้วันไม่ตรงกัน:
        Overview (23 มิ.ย. 2569) ระบุนำร่องโรงพยาบาล 1 ก.ค. 2569 จำนวน 1,700 แห่ง ·
        Communication V4 (3 ส.ค. 2569 · ใหม่กว่า) ระบุ Go-Live 16 ก.ย. 2569 จำนวน 308 หน่วย
        <span style="color:var(--text-muted)">— แผนนี้ยึดฉบับใหม่กว่า และขอยืนยันวันกับ สปสช. ก่อนตรึงแผนจริง</span>
    </div>`,
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
                <td>ขอ Client ID / Token สำหรับ Test Environment
                    <span style="color:var(--text-muted)">· Token key เป็นงานฐานขั้นแรกของ
                    เส้นทาง 7 ขั้น · credential ของ Production ต้องขอแยก</span></td>
                <td>ศูนย์คอมพิวเตอร์</td></tr>
            <tr><td class="c"><b>3</b></td><td><b>ตั้งค่า User</b></td>
                <td>ผู้ใช้งาน NHSO Portal ครบทุก Role ที่ต้องการ
                    <span style="color:var(--text-muted)">· เข้าระบบด้วย <b>ThaiD + SMS OTP 6 หลัก</b>
                    ผู้ใช้ทุกคนต้องมี ThaiD และเบอร์ที่ลงทะเบียนไว้ก่อน</span></td>
                <td>ศูนย์จัดเก็บรายได้</td></tr>
            <tr><td class="c"><b>4</b></td><td><b>พัฒนาระบบ</b></td>
                <td>เชื่อมต่อ HIS → NHSO Platform ตาม Standard Dataset <b>ล่าสุด</b>
                    <span style="color:var(--text-muted)">· คำว่า “ล่าสุด” สำคัญ —
                    ชุดข้อมูลเป็นเป้าเคลื่อนที่ ต้องตรวจเวอร์ชันประกาศทุกครั้ง</span></td>
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
    /* ตารางยาว 7 แถว (เพิ่มตัวชี้วัดของโมดูลส่งต่อและผู้ป่วยใน) — k ต่ำกว่าหน้าอื่นโดยตั้งใจ */
    k: .77,
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
            <tr class="good"><td><b>★ ยอดตามจ่ายส่งต่อค้าง</b><br><span style="color:var(--text-muted)">ภาระผูกพัน</span></td>
                <td>ยอดใบเรียกเก็บคงค้าง − จ่ายแล้ว − โต้แย้ง แยกตามอายุหนี้</td>
                <td class="c" style="color:var(--text-muted)">วันนี้<br>ไม่มีที่บันทึก</td><td class="c">${prTBD('บาท')}</td>
                <td>เห็นภาระผูกพันตั้งแต่ขั้นขออนุมัติ ก่อนใบเรียกเก็บจะมาถึง</td></tr>
            <tr class="good"><td><b>★ แฟ้มผู้ป่วยในครบตามกองทุน</b><br><span style="color:var(--text-muted)">ความพร้อมส่งเบิก</span></td>
                <td>AN ที่แฟ้มครบตามที่กองทุนบังคับ ÷ AN ที่จำหน่ายแล้ว × 100</td>
                <td class="c" style="color:var(--text-muted)">วันนี้<br>ไม่มีด่านตรวจ</td><td class="c">${prTBD()}</td>
                <td>คู่กับ “อัตราตรวจแฟ้มผ่านรอบเดียว” — สะท้อนงานตามเก็บเอกสารที่ลดลง</td></tr>
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
