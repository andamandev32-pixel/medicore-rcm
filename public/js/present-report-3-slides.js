/* ────────────────────────────────────────────────────────
   สไลด์รายงานวิเคราะห์ เล่ม 3 — เนื้อหาเต็ม ไม่ย่อ

   ต้นฉบับ: "เดินเคสจริงหนึ่งเคส — ชั้นไหนเราทำได้ ชั้นไหน Sati ทำได้ และชั้นไหนไม่มีใครทำ"
            จัดทำ 12 สิงหาคม 2569 · ภาคผนวกของรายงานวิเคราะห์ตลาด (เล่ม 2)
   สำเนาในเครื่อง: doc/case-walkthrough-vs-sati.html
   ไฟล์เคสที่รันจริง: doc/examples/case-an691209-as-submitted.json / -fixed.json
   ฉบับออนไลน์:    https://claude.ai/code/artifact/5b9a12c4-894f-4b57-9b25-6697efc7ab87

   ⚠️ ผลรันในหน้า 2 และ 4 คัดลอกจาก output จริงของ POST /api/reference/validate
      เมื่อ 12 ส.ค. 2569 (จัดรูปแบบให้อ่านง่ายขึ้น เนื้อความไม่แก้)
      ห้ามแก้ตัวเลขในบล็อกเหล่านี้ด้วยมือ — ถ้าผลเปลี่ยนต้องรันใหม่แล้ววางทับ
      คำสั่งรันซ้ำ: curl -X POST localhost:3200/api/reference/validate --data-binary @<ไฟล์เคส>

   ⚠️ กติกาของเล่มนี้: คอลัมน์ฝั่ง Sati เขียนจากสิ่งที่ผู้ขายเผยแพร่ต่อสาธารณะเท่านั้น
      ที่ไหนไม่มีข้อมูลต้องเขียนว่า "ไม่ระบุต่อสาธารณะ" — ห้ามเดาแทนเขา
      คอลัมน์ฝั่งเราเขียนจากโค้ดและผลรันจริง ที่ไหนยังทำไม่ได้ต้องเขียนว่าทำไม่ได้
   ──────────────────────────────────────────────────────── */

const REPORT_3_URL = 'https://claude.ai/code/artifact/5b9a12c4-894f-4b57-9b25-6697efc7ab87';
const R3_FOOT = 'รายงานวิเคราะห์ เล่ม 3 · 12 ส.ค. 2569 · ผลฝั่ง MediClearing ทุกบรรทัดมาจากการยิง API จริง';

/**
 * บันไดชั้นงานหนึ่งขั้น — Sati ซ้าย / เรา ขวา
 * ⚠️ ฝั่งซ้ายเป็นคำกล่าวอ้างสาธารณะของผู้ขาย ไม่ใช่สิ่งที่เราตรวจสอบเอง
 *    จึงใช้สีน้ำเงิน (--primary) ไม่ใช่สีเขียวของ "ยืนยันแล้ว"
 */
function r3Rung(n, title, tag, tagType, them, us) {
    return `
    <div class="pr-card" style="padding:0;overflow:hidden">
        <div style="display:flex;align-items:baseline;gap:calc(.6*var(--u));flex-wrap:wrap;
             padding:calc(.4*var(--u)) calc(.7*var(--u));background:var(--brand-bg-strong);
             border-bottom:1px solid var(--brand-border)">
            <span style="font-variant-numeric:tabular-nums;font-weight:800;color:var(--primary);
                  font-size:calc(1.3*var(--u))">${n}</span>
            <b style="font-size:calc(1.34*var(--u));color:var(--brand-navy)">${title}</b>
            <span style="margin-left:auto"><span class="pr-chip ${tagType}">${tag}</span></span>
        </div>
        <div class="pr-grid pr-g2" style="gap:0">
            <div style="padding:calc(.5*var(--u)) calc(.7*var(--u));border-right:1px solid var(--brand-border)">
                <div style="font-size:calc(1.02*var(--u));letter-spacing:.07em;text-transform:uppercase;
                     font-weight:800;color:var(--primary-dark);margin-bottom:calc(.15*var(--u))">Sati</div>
                <div class="pr-kv">${them}</div>
            </div>
            <div style="padding:calc(.5*var(--u)) calc(.7*var(--u))">
                <div style="font-size:calc(1.02*var(--u));letter-spacing:.07em;text-transform:uppercase;
                     font-weight:800;color:var(--status-success-strong);margin-bottom:calc(.15*var(--u))">MediClearing</div>
                <div class="pr-kv">${us}</div>
            </div>
        </div>
    </div>`;
}


const PRESENT_SLIDES = [

/* 1 ── ปก + เคสที่ใช้เดิน ─────────────────────────────── */
{
    accent: true,
    k: .88,
    eyebrow: 'MediClearing · Claim Intelligence · เล่ม 3',
    title: 'เดินเคสจริงหนึ่งเคส — ชั้นไหนเราทำได้ ชั้นไหน Sati ทำได้ และชั้นไหนไม่มีใครทำ',
    lead: 'ภาคผนวกของรายงานวิเคราะห์ตลาด · จัดทำ 12 สิงหาคม 2569 · '
        + 'ผลฝั่ง MediClearing ทุกบรรทัดมาจากการยิง API จริงบนระบบ ไม่ใช่ภาพจำลอง',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.55*var(--u));height:100%">
        <div class="pr-card good" style="flex:none">
            <div class="pr-kv"><b>วิธีอ่านเอกสารนี้:</b> คอลัมน์ฝั่ง Sati เขียนจาก<b>สิ่งที่ผู้ขายเผยแพร่ต่อสาธารณะเท่านั้น</b>
                — ที่ไหนไม่มีข้อมูลจะเขียนว่า “ไม่ระบุต่อสาธารณะ” ไม่เดาแทนเขา ·
                คอลัมน์ฝั่งเราเขียนจากโค้ดและผลรันจริง ที่ไหนยังทำไม่ได้จะเขียนว่าทำไม่ได้</div>
        </div>

        <div class="pr-card" style="border-color:var(--status-success-strong)">
            <h3>AN 691209 · ผู้ป่วยใน กองทุน IP (บัตรทอง)</h3>
            <div class="pr-grid pr-g2" style="gap:calc(.1*var(--u)) calc(1.4*var(--u))">
                <div class="pr-kv"><span style="color:var(--text-muted)">ผู้ป่วย</span> —
                    ชายไทย 72 ปี · HN 00512347</div>
                <div class="pr-kv"><span style="color:var(--text-muted)">รับไว้ – จำหน่าย</span> —
                    3 – 12 ก.ค. 2569</div>
                <div class="pr-kv"><span style="color:var(--text-muted)">วันนอนที่เวชระเบียนแจ้ง</span> —
                    10 วัน · <b>ลากลับบ้าน 1 วัน</b></div>
                <div class="pr-kv"><span style="color:var(--text-muted)">หัตถการ</span> —
                    39.95 ฟอกเลือดด้วยเครื่องไตเทียม × 3 ครั้ง</div>
                <div class="pr-kv"><span style="color:var(--text-muted)">วินิจฉัยหลัก (Pdx)</span> —
                    J18.9 ปอดอักเสบ ไม่ระบุเชื้อ</div>
                <div class="pr-kv"><span style="color:var(--text-muted)">DRG ที่เจ้าหน้าที่บันทึก</span> —
                    04510 ปอดอุดกั้นเรื้อรัง กำเริบ</div>
                <div class="pr-kv"><span style="color:var(--text-muted)">วินิจฉัยร่วม (Sdx)</span> —
                    E11.6 เบาหวานชนิดที่ 2 มีภาวะแทรกซ้อน · N18.3 ไตเรื้อรังระยะ 3</div>
                <div class="pr-kv"><span style="color:var(--text-muted)">ค่ารักษาที่ตั้งเบิก</span> —
                    48,200 บาท</div>
            </div>
        </div>

        <div class="pr-note" style="flex:none">
            <strong>ทำไมเลือกเคสนี้</strong> — เป็นเคสที่พบบ่อยที่สุดแบบหนึ่งในผู้ป่วยในของ รพ. ทั่วไป
            และเป็นเคสที่ “ถูกทั้งสองทาง” ได้ยาก คือมีทั้ง<b>โอกาสเบิกขาด</b> (โรคร่วมเยอะ)
            และ<b>โอกาสถูกเรียกคืน</b> (ฟอกเลือด · ค่าห้อง · ลากลับบ้าน) ·
            ในชุดข้อมูลที่เจ้าหน้าที่เตรียมส่งมีความผิดพลาดปนอยู่ <b>6 จุด</b> ซึ่งพบจริงในหน้างานทั้งหมด
            ไม่ได้ตั้งขึ้นมาให้จับง่าย: ลืมส่งแฟ้มหัตถการ · เลขบัตรประชาชนคีย์ผิดหนึ่งหลัก ·
            วันนอนไม่ได้หักวันลากลับบ้าน · ราคายาไม่ตรง Drug Catalogue · เบิกค่าห้องเกินวันนอน ·
            และจัดกลุ่ม DRG ผิดกลุ่ม
        </div>
    </div>`,
    foot: R3_FOOT,
},

/* 2 ── ผลรันรอบแรก ────────────────────────────────────── */
{
    k: .82,
    eyebrow: 'หัวข้อ 2 · ผลรันจริง รอบแรก',
    title: 'ตามที่เจ้าหน้าที่เตรียมส่ง — result = FAIL',
    body: `
    <div style="display:flex;flex-direction:column;height:100%">
        <div class="pr-cmd">$ curl -s -X POST http://localhost:3200/api/reference/validate \\
     -H "Content-Type: application/json" --data-binary @case.json</div>
<div class="pr-code"><b>summary</b>  result=<span class="e">FAIL</span>  errors=<span class="e">4</span>  warnings=<span class="w">3</span>  info=<span class="i">1</span>  suggestions=<span class="s">2</span>
<span class="dim">layers_checked = FILES · PATIENT · ADMISSION · DX · PROC · DRUG · CHARGE · DRG</span>

<span class="dim">──────── issues ────────</span>
FILES     <span class="e">ERROR</span>   RUL-FIL-001   ขาดแฟ้ม 6 (แฟ้มข้อมูลการทำหัตถการของผู้เข้ารับบริการ)
PATIENT   <span class="e">ERROR</span>   <b>C104</b>          เลขบัตรประชาชนของผู้ป่วย ใช้ไม่ได้ หรือไม่มี
                              <span class="dim">&lt;&lt; checksum เลขบัตรไม่ผ่าน</span>
ADMISSION <span class="w">WARNING</span> ENG-ADM-LOS   วันนอน 10 ไม่ตรงกับที่คำนวณ 9 วัน (จำหน่าย−รับ+1−ลากลับบ้าน 1)
                              <span class="dim">&lt;&lt; บน NHSO Digital Platform จะติดรหัส C112</span>
PROC      <span class="w">WARNING</span> ENG-PROC-FILE มีรหัสหัตถการแต่ชุดข้อมูลไม่มีแฟ้ม 6 (Procedure ICD-9-CM)
DRUG      <span class="e">ERROR</span>   <b>C195</b>          บันทึกเบิกค่ายาไม่เท่ากับราคาใน Drug catalog
                              <span class="dim">&lt;&lt; รายการยา #1 (TMT 100002) — เบิก 3.50 ≠ ราคาอ้างอิง 2.00 (platform ใหม่ = P124)</span>
CHARGE    <span class="e">ERROR</span>   <b>C312</b>          บันทึกเบิกค่าห้อง มากกว่าจำนวนวันนอน
                              <span class="dim">&lt;&lt; รายการ #1 (ค่าห้องและค่าอาหาร) — เบิกค่าห้อง 12 วัน &gt; วันนอน 10 วัน</span>
CHARGE    <span class="w">WARNING</span> ENG-CHG-CAT   รายการ #4 (ค่าตรวจทางห้องปฏิบัติการ) — ไม่ระบุหมวด BILLGRCS
DRG       <span class="i">INFO</span>    ENG-DRG-SRC   ตาราง DRG ที่ใช้ยังเป็นค่าจำลอง (รอตารางจริงจาก สกส.) — ผล trim เป็นการประมาณ

<span class="dim">──────── suggestions (ไม่ตัดสิน PASS/FAIL) ────────</span>
<span class="s">SUG-DRG-001</span>  กลุ่มที่จัดได้จากรหัสวินิจฉัยคือ 04530 (ปอดอักเสบ มีโรคร่วม/โรคแทรก)
             ไม่ตรงกับ DRG ที่บันทึก 04510 — ตรวจสอบการจัดกลุ่มก่อนส่ง
             <span class="dim">evidence: current_rw 1.023 → best_rw 1.482</span>
<span class="s">SUG-DRG-002</span>  Pdx+Sdx เข้ากลุ่ม 11510 (ไตวายเรื้อรัง ต้องฟอกเลือด) ที่ RW สูงกว่าได้ <b>+0.7110 RW</b>
             <b>ตรวจสอบว่ามีเอกสารรองรับ … ห้ามปรับโดยไม่มีหลักฐานในเวชระเบียน</b>
             <span class="dim">evidence: {current_drg 04510, best_drg 11510, rw_delta 0.711}  simulated=true</span></div>
    </div>`,
    foot: R3_FOOT,
},

/* 3 ── สังเกตสามอย่าง ─────────────────────────────────── */
{
    k: .96,
    eyebrow: 'หัวข้อ 2 (ต่อ)',
    title: 'สามอย่างที่เป็นสาระของทั้งเอกสารนี้',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.6*var(--u));height:100%">
        <table class="pr-table">
            <tr><th style="width:48%">สิ่งที่เกิดขึ้น</th><th>ทำไมถึงสำคัญ</th></tr>
            <tr>
                <td><b>ทุกข้อผูกกับรหัสติด C จริง</b> — C104, C195, C312 คือรหัสที่ สปสช.
                    จะตอบกลับมาถ้าส่งไปแบบนี้ <b>ไม่ใช่ข้อความที่ระบบคิดเอง</b></td>
                <td>เจ้าหน้าที่แก้ได้ทันทีโดยไม่ต้องรอไฟล์ตอบกลับ
                    และเวลาถูกถามว่าทำไมต้องแก้ ตอบได้ว่าอ้างรหัสไหน</td>
            </tr>
            <tr>
                <td><b>C195 บอกด้วยว่าบนแพลตฟอร์มใหม่คือ P124</b> ·
                    ENG-ADM-LOS บอกว่าคือ C112</td>
                <td>ช่วงเปลี่ยนผ่าน e-Claim → NHSO Digital Platform รหัสตอบกลับคนละชุด
                    ระบบจึงแม็ปให้ทั้งสองระบบพร้อมกัน</td>
            </tr>
            <tr>
                <td><b>ข้อเสนอเพิ่ม RW ไม่ถูกนับเป็นผลตรวจ</b> — อยู่คนละก้อนกับ issues
                    และมีธง <code>simulated=true</code></td>
                <td>ตัวเสนอแนะ<b>ไม่มีสิทธิ์ตัดสิน</b>ว่าเคสผ่านหรือไม่ผ่าน และไม่ปรับรหัสให้เอง</td>
            </tr>
        </table>

        <div class="pr-note" style="flex:none">
            <strong>เรื่องจริงระหว่างทำเอกสารนี้</strong> — เลขบัตรประชาชนในเคสตัวอย่าง
            <b>ถูกพิมพ์ผิดหนึ่งหลักโดยไม่ตั้งใจ</b>ตอนเขียนไฟล์ทดสอบ —
            engine จับได้เองด้วย checksum mod 11 แล้วคืน C104 ออกมา
            จึงเก็บไว้ในเคสเลย เพราะเป็นตัวอย่างที่ตรงกับหน้างานที่สุด
        </div>
    </div>`,
    foot: R3_FOOT,
},

/* 4 ── ผลรันรอบสอง ────────────────────────────────────── */
{
    k: .9,
    eyebrow: 'หัวข้อ 3 · ผลรันจริง รอบสอง',
    title: 'หลังแก้ตามที่ระบบบอก — result = PASS',
    lead: 'แก้ตามที่ระบบชี้: เพิ่มแฟ้ม 6 · แก้เลขบัตรให้ถูก · วันนอน 10 → 9 (หักวันลากลับบ้าน) · '
        + 'ราคายา 3.50 → 2.00 ตาม Drug Catalogue · ค่าห้อง 12 → 9 วัน · เติมหมวด BILLGRCS ให้ค่าแล็บ · '
        + 'และปรับกลุ่ม DRG เป็น 04530 ตามที่ทบทวนแล้วว่ามีหลักฐานรองรับ',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.6*var(--u));height:100%">
        <div>
            <div class="pr-cmd">$ curl -s -X POST http://localhost:3200/api/reference/validate \\
     -H "Content-Type: application/json" --data-binary @case-fixed.json</div>
<div class="pr-code"><b>summary</b>  result=<span class="ok">PASS</span>  errors=<span class="ok">0</span>  warnings=<span class="ok">0</span>  info=<span class="i">1</span>  suggestions=<span class="s">1</span>

<span class="dim">──────── issues ────────</span>
DRG       <span class="i">INFO</span>    ENG-DRG-SRC   ตาราง DRG ที่ใช้ยังเป็นค่าจำลอง (รอตารางจริงจาก สกส.)

<span class="dim">──────── suggestions ────────</span>
<span class="s">SUG-DRG-002</span>  Pdx+Sdx เข้ากลุ่ม 11510 (ไตวายเรื้อรัง ต้องฟอกเลือด) ที่ RW สูงกว่าได้ <b>+0.2520 RW</b>
             <b>ตรวจสอบว่ามีเอกสารรองรับ … ห้ามปรับโดยไม่มีหลักฐานในเวชระเบียน</b>
             <span class="dim">evidence: {current_drg 04530, current_rw 1.482, best_drg 11510, best_rw 1.734, rw_delta 0.252}</span></div>
        </div>

        <div class="pr-card danger" style="flex:none">
            <h3 style="color:var(--status-danger-strong)">จุดที่ต่างกันชัดที่สุดของทั้งสองระบบอยู่ตรงบรรทัดสุดท้ายนี้</h3>
            <div class="pr-kv">เคสนี้มี N18.3 + ฟอกเลือด 3 ครั้ง จึง “เอื้อม” ไปกลุ่ม 11510
                ที่ RW สูงกว่าอีก <b>+0.2520</b> ได้ — และถ้าไตวายเป็นเหตุผลหลักที่ผู้ป่วยนอนโรงพยาบาลจริง
                การจัดเข้ากลุ่มนั้นก็ถูกต้อง · แต่ถ้าผู้ป่วยมานอนเพราะปอดอักเสบ
                แล้วฟอกเลือดเป็นการรักษาต่อเนื่องตามปกติ การย้ายกลุ่มคือ <b>upcoding</b>
                ที่จะถูกเรียกเงินคืนตอนสุ่มตรวจ<br>
                ระบบเรา<b>ไม่ตัดสินใจแทน</b> — เสนอเป็นส่วนต่าง RW เท่านั้น ไม่แปลงเป็นบาท ไม่ปรับรหัสให้
                และบังคับข้อความ “ห้ามปรับโดยไม่มีหลักฐานในเวชระเบียน” ติดไปทุกครั้ง
                แล้วส่งต่อให้ชั้นตรวจเวชระเบียน (MRA) เป็นคนตอบว่าหลักฐานมีจริงไหม</div>
        </div>
    </div>`,
    foot: R3_FOOT,
},

/* 5 ── บันไดชั้น 1–2 ──────────────────────────────────── */
{
    k: .82,
    eyebrow: 'หัวข้อ 4 · บันไดชั้นงาน',
    title: 'ใครทำอะไรได้ในเคสนี้ — ชั้น 1 และ 2',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.5*var(--u));height:100%">
        ${r3Rung(1, 'แพทย์เขียนเวชระเบียน → ถอดเป็นข้อมูลมีโครงสร้าง', 'Sati ชนะขาด', 'blue',
            'ChartSum อ่าน progress note / discharge summary ที่เป็นข้อความอิสระ (รวมเอกสารสแกน) ' +
            'แล้วถอดเป็นข้อมูลมีโครงสร้าง + เสนอรหัส ICD-10 / ICD-9-CM / SNOMED-CT' +
            '<ul class="pr-ul"><li>เคสนี้: อ่านเจอ “ฟอกเลือด 3 ครั้ง”, “DM with CKD stage 3” ' +
            'จากตัวเนื้อความได้เอง โดยเจ้าหน้าที่ไม่ต้องคีย์</li>' +
            '<li>ผู้ขายอ้างประมวลผลต่ำกว่า 1 วินาที/เคส และลดเวลาทบทวนชาร์ต 40%</li></ul>',
            '<b>ทำไม่ได้ — ไม่มีความสามารถอ่านข้อความอิสระ</b>' +
            '<ul class="pr-ul"><li>รับได้เฉพาะข้อมูลที่มีโครงสร้างแล้ว: ตัวนำเข้า 16 แฟ้ม ' +
            '(IPD/PAT/INS/IDX/IOP/CHA) หรือฟอร์มลงรหัสที่มี autocomplete จากแคตตาล็อก</li>' +
            '<li>แปลว่า<b>ต้องมีคนถอดรหัสมาก่อน</b> ไม่ว่าจะเป็นคนหรือ AI ของเจ้าอื่น</li></ul>')}

        ${r3Rung(2, 'ตรวจคุณภาพการบันทึกเวชระเบียนตามเกณฑ์ MRA', 'เราทำได้ · เขาไม่ระบุ', 'green',
            'AI Pre-Audit ระบุว่าตรวจ “ความครบถ้วนของเวชระเบียน” และ “แนะรหัสพร้อมหลักฐานเชิงคลินิก”' +
            '<ul class="pr-ul"><li><b>ไม่ระบุต่อสาธารณะ</b>ว่ายึดเกณฑ์ MRA ของ สปสช. ฉบับไหน ' +
            'หรือให้คะแนนรายองค์ประกอบอย่างไร</li></ul>',
            'ยึด <b>“เกณฑ์การตรวจประเมินคุณภาพการบันทึกเวชระเบียนผู้ป่วยใน ฉบับ 2563 (สปสช.)”</b> ตรง ๆ — ' +
            '<code>MRA-2563</code> ในตาราง <code>ref_mra_versions</code>' +
            '<ul class="pr-ul"><li>12 องค์ประกอบ: บังคับ 7 (สรุปการจำหน่าย · ใบยินยอม · ซักประวัติ · ' +
            'ตรวจร่างกาย · progress note · บันทึกพยาบาล) + ตามเงื่อนไข 5</li>' +
            '<li>เคสนี้มีหัตถการ → <code>operative_note</code> ถูก<b>เปิดใช้อัตโนมัติ</b> (needs = proc) ' +
            'ส่วนที่ไม่เข้าเงื่อนไข เช่น บันทึกการคลอด จะถูก<b>ตัดออกจากตัวหาร</b> ไม่ใช่หักคะแนน</li>' +
            '<li><b>ยังไม่ครบ:</b> เกณฑ์ย่อยลงรายละเอียดเฉพาะองค์ประกอบแรก 9 ข้อ ' +
            'อีก 11 องค์ประกอบยังรอถอดจาก PDF ทางการ</li></ul>')}
    </div>`,
    foot: R3_FOOT,
},

/* 6 ── บันไดชั้น 3–4 ──────────────────────────────────── */
{
    k: .82,
    eyebrow: 'หัวข้อ 4 (ต่อ) · บันไดชั้นงาน',
    title: 'ชั้น 3 และ 4 — ชั้น 4 คือชั้นเดียวที่ทับกัน แต่ทับแบบตรงข้าม',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.5*var(--u));height:100%">
        ${r3Rung(3, 'ตรวจข้อมูลเคลมก่อนกดส่ง (8 ชั้น ~30 เช็ค)', 'แกนของระบบเรา', 'green',
            'ระบุว่าตรวจ “claim issues ก่อนส่ง” · cross-check ยากับการวินิจฉัย · ' +
            'ตรวจรายการเรียกเก็บกับกฎคลินิกและ DRG · ตรวจผลแล็บ' +
            '<ul class="pr-ul"><li>ตรวจ<b>ความสมเหตุสมผลทางคลินิก</b> ซึ่งเป็นมุมที่กฎตายตัวทำไม่ได้ — ' +
            'เช่นสั่งยาที่ไม่เข้ากับการวินิจฉัย</li>' +
            '<li><b>ไม่ระบุต่อสาธารณะ</b>ว่าตรวจกับแคตตาล็อกรหัสติด C, เมทริกซ์กองทุน×แฟ้ม, ' +
            '16/15 แฟ้ม หรือ Drug Catalogue สปสช.</li></ul>',
            'ตรวจ 8 ชั้นตามที่เห็นในผลรันข้างบน — FILES · PATIENT · ADMISSION · DX · PROC · DRUG · CHARGE · DRG' +
            '<ul class="pr-ul"><li>ข้อความ error <b>ไม่ hardcode</b> — ดึงจาก <code>ref_error_codes</code> ' +
            '(446 รหัส ทวนแล้ว 440) จึงเปลี่ยนตามแคตตาล็อกทันทีที่อัปเดต</li>' +
            '<li>ทุกข้อคืน <code>guidance</code> เป็นวิธีแก้ภาษาไทยติดกลับมาด้วย</li>' +
            '<li><b>ตรวจไม่ได้จะบอกว่าตรวจไม่ได้</b> — ถ้ายังไม่ได้โหลดแคตตาล็อก ICD ' +
            'ระบบลดเป็น INFO พร้อมเหตุผล ไม่ปล่อยผ่านเป็น PASS เงียบ ๆ</li>' +
            '<li>ตรวจคลินิกไม่ได้: ยาไม่เข้ากับโรค แพทย์สั่งเกินความจำเป็น — ชั้นนี้เป็นของ AI ไม่ใช่ของกฎ</li></ul>')}

        ${r3Rung(4, 'ทบทวนการจัดกลุ่ม DRG / โอกาสเบิกขาด', 'ทำทั้งคู่ แต่คนละท่าที', 'amber',
            'จุดขายหลัก — แก้ Underclaim ที่ผู้ขายระบุว่าเกิดราว 20% ของเคส · คำนวณ DRG &amp; AdjRW ให้ · ' +
            'อ้างว่าเร็วขึ้น 97%' +
            '<ul class="pr-ul"><li>ในเคสนี้จะเห็นสิ่งเดียวกับเรา คือ N18.3 + ฟอกเลือด ' +
            'ทำให้เอื้อมกลุ่ม RW สูงกว่าได้</li>' +
            '<li><b>ไม่ระบุต่อสาธารณะ</b>ว่ามีกลไกห้ามปรับรหัสเมื่อเอกสารไม่รองรับหรือไม่ · ' +
            'และเนื่องจากคิดค่าบริการแบบ<b>แบ่งจากรายได้ที่เพิ่ม</b> แรงจูงใจเชิงโครงสร้างจึงเอียงไปทาง “ปรับขึ้น”</li></ul>',
            'เห็นโอกาสเดียวกัน แต่<b>ล็อกไว้ 4 ชั้น</b>โดยตั้งใจ ' +
            '(เขียนไว้ในหัวไฟล์ <code>claim-suggester.js</code> เป็นหลักจริยธรรมของโมดูล)' +
            '<ul class="pr-ul"><li>อยู่คนละก้อนกับผลตรวจ — <b>ไม่มีสิทธิ์เปลี่ยน PASS/FAIL</b></li>' +
            '<li>คืน <b>ส่วนต่าง RW เท่านั้น ไม่แปลงเป็นบาท</b> ตราบที่ตาราง DRG ยัง <code>verified=0</code></li>' +
            '<li><b>ไม่ auto-apply</b> — ไม่แก้รหัสให้เอง</li>' +
            '<li>บังคับข้อความ “ตรวจสอบว่ามีเอกสารรองรับ … ห้ามปรับโดยไม่มีหลักฐาน” ' +
            'ติดทุกข้อเสนอที่ทำให้ RW สูงขึ้น</li></ul>')}
    </div>`,
    foot: R3_FOOT,
},

/* 7 ── บันไดชั้น 5–6 ──────────────────────────────────── */
{
    k: .84,
    eyebrow: 'หัวข้อ 4 (ต่อ) · บันไดชั้นงาน',
    title: 'ชั้น 5 และ 6 — ชั้น 6 คือชั้นที่เขาไม่มีเลย',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.5*var(--u));height:100%">
        ${r3Rung(5, 'ส่งเบิกและวนแก้เมื่อถูกตีกลับ', 'ของฟรีจากผู้จ่ายก็ทำ', 'amber',
            '<b>ไม่ระบุ</b>ว่าเป็นช่องทางส่งเบิกเอง — วางตัวเป็นชั้นก่อนส่ง แล้วให้ HIS / e-Claim เป็นคนส่ง',
            'มีหน้าคิวส่งเบิก NHSO และหน้ากระทบยอด (Transaction / Statement / OFC / OP Refer) — ' +
            'แต่<b>ตัวช่องทางส่งจริงยังเป็นของ สปสช.</b> (e-Claim / NHSO DP / FDH) เหมือนกันทุกเจ้า' +
            '<ul class="pr-ul"><li>คุณค่าอยู่ที่<b>จำนวนรอบ</b> ไม่ใช่ตัวการส่ง — ' +
            '4 error ในเคสนี้ถ้าไม่ตรวจก่อน จะกลายเป็นการวนแก้อย่างน้อย 1 รอบเต็ม</li>' +
            '<li>ต้องขึ้นทะเบียนเป็น Software Vendor กับ NHSO DP (ขอ Source ID / Client ID) ' +
            'ก่อนจึงจะต่อตรงได้ — <b>ยังไม่ได้ทำ</b></li></ul>')}

        ${r3Rung(6, 'เงินเข้าแล้วหรือยัง — บันทึกรับ ตัดยอด คงค้าง', 'เราทำได้ · เขาไม่มี', 'green',
            '<b>ไม่มี</b> — สินค้าจบที่การเตรียมและตรวจเคลม ไม่มีงานลูกหนี้ค่ารักษาและการกระทบยอด',
            'ปิดวงจรถึงเงินเข้าบัญชี — บันทึกส่ง (ตั้งยอดพึงรับ) → ทะเบียนลูกหนี้รายบุคคล → ' +
            'บันทึกรับ → ตัดยอด → คงค้าง' +
            '<ul class="pr-ul"><li>ยอดคงค้าง<b>คำนวณสดทุกครั้ง ไม่เก็บเป็นคอลัมน์</b>: ' +
            '(ตั้งเบิก + ปรับเพิ่ม − ปรับลด) − (รับ − เรียกคืน) − ตัดจำหน่าย — กันสองความจริงในระบบเดียว</li>' +
            '<li>ยืนยันใบรับที่ตัดยอดไม่ครบจะถูกปฏิเสธด้วย <code>ALLOCATION_MISMATCH</code> ' +
            'พร้อมบอกส่วนต่างเป็นตัวเลข</li>' +
            '<li>เคสที่ตั้งหนี้แล้วหายจากรายการเคสที่ตั้งหนี้ได้ — กันตั้งหนี้ซ้ำที่ทำให้ยอดพึงรับบวมเงียบ ๆ</li></ul>')}
    </div>`,
    foot: R3_FOOT,
},

/* 8 ── บันไดชั้น 7 ────────────────────────────────────── */
{
    k: .96,
    eyebrow: 'หัวข้อ 4 (ต่อ) · บันไดชั้นงาน',
    title: 'ชั้น 7 — ชั้นที่ตัดสินการแข่งขัน',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.6*var(--u));height:100%">
        ${r3Rung(7, 'ถูกสุ่มตรวจย้อนหลัง — ตอบผู้ตรวจว่าอ้างอะไร', 'ชั้นที่ตัดสินการแข่งขัน', 'green',
            'ผู้ขายระบุว่าช่วย “ลดความเสี่ยงถูกเรียกเงินคืน” ผ่านการทำเวชระเบียนให้ครบถ้วน ' +
            '(audit-proof records)' +
            '<ul class="pr-ul"><li><b>ไม่ระบุต่อสาธารณะ</b>ว่าเก็บบันทึกได้หรือไม่ว่า ณ วันให้บริการนั้น ' +
            'ระบบใช้เกณฑ์ฉบับใดตัดสิน และใครเป็นผู้อนุมัติ</li>' +
            '<li>คำตอบของโมเดลภาษาโดยธรรมชาติคือ<b>เหตุผลเชิงคลินิก</b> ' +
            'ซึ่งไม่ใช่รูปแบบที่ผู้ตรวจขอ</li></ul>',
            'ออกแบบมาเพื่อคำถามนี้โดยเฉพาะ — ผลตรวจทุกข้อสาวกลับได้ถึง ' +
            '<b>รหัสกฎ + เวอร์ชัน + เอกสารต้นทาง</b>' +
            '<ul class="pr-ul"><li><b>BR-01</b> เลือกกฎตาม<b>วันที่รับบริการ</b> + กองทุน + ประเภทบริการ ' +
            'ไม่ใช่ “เอาฉบับล่าสุด” — เคสนี้จำหน่าย 12 ก.ค. 2569 จึงถูกตัดสินด้วยเกณฑ์ที่บังคับใช้ ณ วันนั้น ' +
            'ไม่ใช่เกณฑ์วันที่ถูกตรวจ</li>' +
            '<li><b>BR-02</b> เวอร์ชัน DRG เลือกตามวันจำหน่ายเช่นกัน · <b>BR-03</b> ทุกผลย้อนกลับได้ · ' +
            '<b>BR-04</b> การ override ต้องมีผู้ทำ เวลา เหตุผล หลักฐาน · ' +
            '<b>BR-05</b> กฎที่มีผลทางการเงินต้องผ่าน maker–checker</li>' +
            '<li>ทะเบียนเอกสารอ้างอิงมีสถานะ PRESENT / MISSING — กฎที่เอกสารยังไม่มาจะคืน ' +
            '<code>BLOCKED_BY_DOC</code> <b>ไม่ใช่เดาแล้วตอบ</b></li></ul>')}

        <div class="pr-note strong" style="flex:none">
            <strong>ทำไมชั้นนี้ถึงตัดสิน</strong> — เพราะเป็นชั้นเดียวที่คำตอบต้องอยู่ในรูปแบบที่ผู้ตรวจรับ
            คือ “อ้างประกาศฉบับไหน ข้อไหน ณ วันให้บริการนั้น” ·
            AI ที่ตอบเป็นเหตุผลเชิงคลินิกตอบคำถามนี้ไม่ได้โดยตรง
            และของฟรีจากผู้จ่ายก็จะไม่มีวันสร้างเครื่องมือที่ช่วย รพ. เถียงกับผู้จ่าย
        </div>
    </div>`,
    foot: R3_FOOT,
},

/* 9 ── ตัวเลขที่เปิดเผยเอง ────────────────────────────── */
{
    k: .84,
    eyebrow: 'หัวข้อ 5 · ตัวเลขที่เราเปิดเผยเองในเคสนี้',
    title: 'ตัวชี้วัดที่ระบบบังคับตัวเองให้แสดง แม้จะไม่สวย',
    lead: 'เรียกได้จาก GET /api/rules/coverage ตลอดเวลา — ไม่ใช่ตัวเลขในสไลด์',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.5*var(--u));height:100%">
        <div>
            <div class="pr-cmd">$ curl -s http://localhost:3200/api/rules/coverage</div>
<div class="pr-code"><b>checkers_available</b> (12)  <span class="dim">drg_downcoding · drg_regroup_mismatch · drug_price_catalogue · dx_drg_present ·
                        files_required · leave_day_file15 · los_outlier · mra_component_present ·
                        payer_doc_present · room_charge_cap · submit_deadline · ucep_72h</span>

<b>total</b> 31 กฎในคลัง
<b>active</b>  total=21   <span class="ok">executable=10</span>   <span class="w">not_implemented=11</span>   blocked_by_doc=0   missing_checker=0   <b>pct=48</b></div>
        </div>

        <table class="pr-table">
            <tr><th style="width:22%">ตัวเลข</th><th style="width:16%">ค่า</th>
                <th>ความหมายที่ต้องพูดตรง ๆ กับลูกค้า</th></tr>
            <tr><td>กฎที่ตรวจอัตโนมัติได้จริง</td><td><b>10 / 21 = 48%</b></td>
                <td>อีก 11 ข้อขึ้นป้าย “ตรวจด้วยคน” — <b>ไม่ปล่อยผ่านเป็น PASS เงียบ ๆ</b> ·
                    มีสคริปต์ <code>check:rules</code> ที่ทำให้ build ล้มถ้าคลังกฎกับโค้ดไม่ตรงกัน</td></tr>
            <tr><td>แคตตาล็อกรหัสติด C</td><td>446 รหัส<br>(ทวนแล้ว 440)</td>
                <td>ครบ 100% ของแหล่ง · พิสูจน์แล้วว่าช่วง C218–C299 และ C394–C420 ไม่มีจริง เลขข้ามเอง</td></tr>
            <tr><td>เกณฑ์ MRA</td><td>12 องค์ประกอบ<br>เกณฑ์ย่อย 9 ข้อ</td>
                <td>โครงเกณฑ์ verified=1 แต่<b>เกณฑ์ย่อยครบเฉพาะองค์ประกอบแรก</b> —
                    อีก 11 องค์ประกอบยังรอถอดจากคู่มือทางการ</td></tr>
            <tr class="bad"><td>ตาราง DRG / RW</td><td>14 กลุ่ม<br>verified=0</td>
                <td><b>ค่าจำลอง ห้ามใช้คิดเงิน</b> — จึงเป็นเหตุผลที่ตัวเสนอแนะคืนเป็น RW ไม่ใช่บาท
                    และผลรันติด INFO ทุกครั้ง</td></tr>
            <tr class="bad"><td>ตัวนำเข้า 16 แฟ้ม</td><td>IPD เท่านั้น</td>
                <td>ฝั่ง OPD (OPD/ORF/ODX/OOP/OCH) และ AER/ADP <b>ยังไม่ได้ทำ</b> —
                    เคสตัวอย่างนี้จึงเดินได้เฉพาะผู้ป่วยใน</td></tr>
        </table>
    </div>`,
    foot: R3_FOOT,
},

/* 10 ── สรุปเคสนี้ ────────────────────────────────────── */
{
    accent: true,
    k: .96,
    eyebrow: 'หัวข้อ 6 · สรุปเคสนี้เป็นประโยคเดียว',
    title: 'ถ้ามีแต่ Sati vs ถ้ามีแต่ MediClearing',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.6*var(--u));height:100%">
        <div class="pr-grid pr-g2">
            <div class="pr-card">
                <h3 style="color:var(--primary-dark)">ถ้ามีแต่ Sati</h3>
                <div class="pr-kv">เจ้าหน้าที่ไม่ต้องคีย์ ได้รหัสจากชาร์ตอัตโนมัติ
                    และเห็นว่าเคสนี้เบิกขาดอยู่ — แต่<b>ยังส่งไม่ผ่านอยู่ดี</b>
                    เพราะขาดแฟ้ม 6 · เลขบัตรผิด · ราคายาไม่ตรงแคตตาล็อก · และค่าห้องเกินวันนอน
                    ล้วนเป็น<b>ความผิดพลาดเชิงข้อมูล ไม่ใช่เชิงคลินิก</b> ·
                    และเมื่อถูกสุ่มตรวจ ยังต้องหาเอกสารเองว่าตอนนั้นใช้เกณฑ์อะไร</div>
            </div>
            <div class="pr-card good">
                <h3 style="color:var(--status-success-strong)">ถ้ามีแต่ MediClearing</h3>
                <div class="pr-kv">จับ 4 error + 3 คำเตือนก่อนกดส่ง แก้จบในรอบเดียว
                    ตามเงินได้จนเข้าบัญชี และตอบผู้ตรวจได้ว่าอ้างกฎข้อไหนฉบับไหน —
                    แต่<b>ต้องมีคนถอดรหัสจากชาร์ตมาให้ก่อน</b>
                    ซึ่งเป็นงานที่กินเวลามากที่สุดของ coder
                    และเป็นจุดที่ทำให้เกิดการเบิกขาดตั้งแต่ต้นทาง</div>
            </div>
        </div>

        <div class="pr-card good" style="flex:none">
            <div class="pr-kv" style="font-size:calc(1.42*var(--u))"><b>ข้อสรุป:</b>
                ในเคสเดียวกันนี้ ทั้งสองระบบ<b>ไม่ได้แย่งงานกันเลยแม้แต่ชั้นเดียว</b> —
                Sati ทำชั้น 1 ที่เราทำไม่ได้ · เราทำชั้น 3, 6, 7 ที่เขาไม่มี ·
                และชั้น 4 เป็นชั้นเดียวที่ทับกัน แต่ทับแบบตรงข้ามกัน คือ<b>เขาผลักขึ้น เราคุมไว้</b> ·
                ทางที่ให้ผลกับโรงพยาบาลมากที่สุดจึงเป็น
                <b>“AI ถอดรหัส → กฎตรวจ → การเงินตามเก็บ”</b> ต่อกันเป็นสายเดียว
                ไม่ใช่เลือกข้างใดข้างหนึ่ง</div>
        </div>

        <div class="pr-note" style="flex:none;display:flex;align-items:center;gap:calc(.8*var(--u))">
            <span style="flex:1"><strong>ที่มาของตัวเลขในเอกสารนี้</strong> —
            ผลรันฝั่ง MediClearing ทั้งสองรอบมาจากการยิง <code>POST /api/reference/validate</code>
            และ <code>GET /api/rules/coverage</code> บนระบบจริงเมื่อ 12 ส.ค. 2569
            (จัดรูปแบบให้อ่านง่ายขึ้น เนื้อความไม่แก้) · ข้อมูลอ้างอิงบางชุด (DRG/RW, ICD, TMT)
            ยังเป็นชุดคัดย่อหรือค่าจำลองที่ <code>verified=0</code> —
            <b>โครงการตรวจถูกต้อง แต่ตัวเลข RW ยังใช้คิดเงินจริงไม่ได้</b> ·
            ข้อมูลฝั่ง Sati มาจากเว็บไซต์ผู้ขาย ข่าวประชาสัมพันธ์ และบทสัมภาษณ์สาธารณะ
            ไม่มีการตรวจสอบอิสระ และไม่มีการเข้าถึงระบบของเขา</span>
            <a class="pr-open" href="${REPORT_3_URL}" target="_blank" rel="noopener">เปิดรายงานฉบับเต็ม →</a>
        </div>
    </div>`,
    foot: R3_FOOT,
},

];

window.PRESENT_SLIDES = PRESENT_SLIDES;
