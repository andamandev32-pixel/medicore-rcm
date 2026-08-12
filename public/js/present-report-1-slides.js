/* ────────────────────────────────────────────────────────
   สไลด์รายงานวิเคราะห์ เล่ม 1 — เนื้อหาเต็ม ไม่ย่อ

   ต้นฉบับ: "กฎมาตรฐานการกรองเคลม ฐานข้อมูลอ้างอิง และภูมิทัศน์คู่แข่ง"
            จัดทำ 11 สิงหาคม 2569
            ฉบับออนไลน์ https://claude.ai/code/artifact/cb207927-6e5b-4e95-98fc-d216263f4bd7
            ⚠️ เล่มนี้ไม่มีสำเนาใน repo (เล่ม 2–3 มีที่ doc/) — ต้นฉบับอยู่ที่ลิงก์ข้างบนเท่านั้น

   หลักในการแปลงเป็นสไลด์: ย้ายทั้งเล่ม ไม่สรุป ไม่ตัดข้อความที่เป็นข้อจำกัดหรือจุดอ่อน
   ลำดับหัวข้อตรงกับต้นฉบับทุกหน้า เพื่อให้เปิดคู่กันแล้วตามกันทัน

   ⚠️ deck ชุดรายงานไม่มีส่วนเกริ่น "ที่มาของโครงการ" ที่อีก 3 deck ใช้ร่วมกัน
      (PAGE-GUIDE §7B-1 ระบุข้อยกเว้นนี้ไว้แล้ว) จึงไม่ต้องโหลด present-flows*.js

   ⚠️ ค่า k ของทุกหน้าวัดจากการเรนเดอร์จริง ไม่ได้กะเอา — .pr-body เป็น overflow:hidden
      เนื้อหาที่ล้นจะหายเงียบ ๆ โดยไม่มี error · แก้ข้อความเมื่อไรต้องวัดใหม่
   ──────────────────────────────────────────────────────── */

const REPORT_1_URL = 'https://claude.ai/code/artifact/cb207927-6e5b-4e95-98fc-d216263f4bd7';

/** แถบท้ายหน้า — เหมือนกันทุกหน้าในเล่ม */
const R1_FOOT = 'รายงานวิเคราะห์ เล่ม 1 · 11 ส.ค. 2569 · ข้อมูลจากแหล่งทางการ สปสช. / กสธ. / สมสท. / สกส.';

/** กล่องชั้นการตรวจสอบ — ใช้ซ้ำในหน้า 2–3 (โครงเดียวกับ .layer ในรายงานต้นฉบับ) */
function r1Layer(n, title, body, src) {
    return `
    <div class="pr-card" style="display:grid;grid-template-columns:calc(2.6*var(--u)) 1fr;
         gap:calc(.8*var(--u));border-left:calc(.28*var(--u)) solid var(--primary)">
        <div style="font-size:calc(2.1*var(--u));font-weight:800;color:var(--primary);
             font-variant-numeric:tabular-nums;line-height:1.1">${n}</div>
        <div>
            <strong style="font-size:calc(1.34*var(--u));color:var(--brand-navy)">${title}</strong>
            <div class="pr-kv" style="margin-top:calc(.15*var(--u))">${body}</div>
            <div class="pr-cap" style="margin-top:calc(.2*var(--u))">${src}</div>
        </div>
    </div>`;
}

/** การ์ดคู่แข่ง — หัวเรื่อง + ตำแหน่งในตลาด + จุดแข็ง/จุดอ่อนคนละคอลัมน์ */
function r1Vendor(name, pos, lead, plusLabel, plus, minusLabel, minus) {
    return `
    <div class="pr-card" style="display:flex;flex-direction:column;gap:calc(.35*var(--u))">
        <div>
            <strong style="font-size:calc(1.42*var(--u));color:var(--brand-navy)">${name}</strong>
            <div class="pr-cap">${pos}</div>
        </div>
        ${lead ? `<div class="pr-kv">${lead}</div>` : ''}
        <div class="pr-grid pr-g2">
            <div>
                <div style="font-size:calc(1.06*var(--u));font-weight:800;
                     color:var(--status-success-strong)">${plusLabel}</div>
                <ul class="pr-ul">${plus.map(x => `<li>${x}</li>`).join('')}</ul>
            </div>
            <div>
                <div style="font-size:calc(1.06*var(--u));font-weight:800;
                     color:var(--status-danger-strong)">${minusLabel}</div>
                <ul class="pr-ul">${minus.map(x => `<li>${x}</li>`).join('')}</ul>
            </div>
        </div>
    </div>`;
}


const PRESENT_SLIDES = [

/* 1 ── ปก + TL;DR ────────────────────────────────────── */
{
    accent: true,
    k: .92,
    eyebrow: 'MediClearing · Claim Intelligence · เล่ม 1',
    title: 'กฎมาตรฐานการกรองเคลม ฐานข้อมูลอ้างอิง และภูมิทัศน์คู่แข่ง',
    lead: 'รายงานวิจัยประกอบการพัฒนา Rule Engine · จัดทำ 11 สิงหาคม 2569 — ตอบสามคำถามตั้งต้นก่อนลงมือเขียนตัวตรวจ',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.6*var(--u));height:100%">
        <div class="pr-card info">
            <strong style="font-size:calc(1.36*var(--u))">
                <span style="color:var(--primary)">Q1</span>
                กฎการกรองข้อมูลเคลมมี “มาตรฐานกลาง” ไหม</strong>
            <div class="pr-kv"><b>มี และมีมากกว่าหนึ่งชั้น</b> — แกนหลักคือแคตตาล็อก
                <b>รหัสติด C ของระบบ e-Claim สปสช. (C101–C652 ราว 652 รหัส)</b>
                ซึ่งคือกฎ deny/ตรวจสอบมาตรฐานตัวจริงที่ทุกโรงพยาบาลเจอเหมือนกัน
                บวกชั้นมาตรฐานโครงสร้างข้อมูล (16/43 แฟ้ม) · รหัสยา TMT/Drug Catalogue ·
                Thai DRG · และการตรวจสิทธิ</div>
        </div>

        <div class="pr-card info">
            <strong style="font-size:calc(1.36*var(--u))">
                <span style="color:var(--primary)">Q2</span>
                หาฐานข้อมูลกฎได้ไหม</strong>
            <div class="pr-kv"><b>ได้ และโหลดเข้าระบบเราแล้ว</b> — MySQL ของ MediClearing มีตาราง
                <code>ref_*</code> 10 ตาราง บรรจุรหัสติด C จริง
                <b>446 รหัส ครอบคลุมแคตตาล็อกทั้งหมดของแหล่ง (ทวนซ้ำ ≥2 รอบ 440 รหัส)</b> ·
                โครงสร้าง 15 แฟ้ม · เมทริกซ์ 12 กองทุน×แฟ้ม พร้อม API ·
                หน้าจอเดิมดึงไปแสดงแทน mock อัตโนมัติ · และมี
                <b>rule engine ตรวจเคลมก่อนส่งที่ execute กฎได้จริงแล้ว</b>
                (<code>POST /api/reference/validate</code>)</div>
        </div>

        <div class="pr-card info">
            <strong style="font-size:calc(1.36*var(--u))">
                <span style="color:var(--primary)">Q3</span>
                ตลาดมี product แบบเราไหม</strong>
            <div class="pr-kv"><b>มีคู่แข่งที่ทำ “ฟีเจอร์เคลม” แต่ยังไม่มีใครยืนตำแหน่งเดียวกับเรา</b> —
                ทุกเจ้าหลัก (BMS i-Claim, HA.OS, MEDcury) เป็น <b>HIS vendor</b>
                ที่ผูกฟีเจอร์เคลมกับ HIS ของตัวเอง ช่องว่างของตลาดคือ
                <b>ชั้นควบคุมเคลมที่ไม่ผูกกับ HIS (HIS-agnostic) + ระบบกำกับกฎแบบมี governance</b>
                ซึ่งคือตำแหน่งของเราพอดี — แต่จุดอ่อนเราคือยังเป็นต้นแบบและไม่มีข้อมูลที่ต้นทาง</div>
        </div>

        <div class="pr-note strong" style="flex:none">
            <strong>ข้อสรุป Q3 ถูกแก้ในเล่ม 2 (12 ส.ค. 2569)</strong> — เล่มนี้เทียบเฉพาะกับ HIS vendor
            จึงทำให้ตลาดดูว่างกว่าความจริง · เล่ม 2 พบผู้เล่นอีก 4 กลุ่มที่ไม่ได้นับ และพบว่า Sati
            ยืนตำแหน่ง HIS-agnostic นั้นอยู่ก่อนเราแล้ว
        </div>
    </div>`,
    foot: R1_FOOT,
},

/* 2 ── 6 ชั้นกฎ (1–3) ─────────────────────────────────── */
{
    k: .84,
    eyebrow: 'หัวข้อ 1 · กฎมาตรฐานการกรองเคลมของไทย',
    title: 'มองเป็น 6 ชั้น — ชั้นที่ 1 ถึง 3',
    lead: 'ข้อมูลเคลมหนึ่งเคสจะ “ผ่าน” ได้ต้องรอดทั้ง 6 ชั้นนี้ แต่ละชั้นมีมาตรฐาน + ฐานข้อมูลของตัวเอง '
        + 'และแต่ละชั้นแมปเข้ากับกฎในระบบเราได้โดยตรง',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.5*var(--u));height:100%">
        ${r1Layer(1, 'สิทธิการรักษา (Eligibility)',
            'ตรวจสิทธิ ณ วันรับบริการ · Approve Code / เลขปิดสิทธิ · หน่วยบริการตรงสิทธิ — ' +
            'รหัสติด C ตระกูล C1xx สิทธิ (C131–C154) และ C305–C308 (Approve Code)',
            'ฐานข้อมูล: ระบบตรวจสอบสิทธิ สปสช. (NHSO eServices / SRM) · ในระบบเรา: กฎ RUL-ELG-004/008')}

        ${r1Layer(2, 'โครงสร้างไฟล์และฟิลด์บังคับ (Format)',
            'ชุดข้อมูลมาตรฐาน 15 แฟ้ม (160 data points: บังคับ 72 / เงื่อนไข 16 / เลือก 72) + ' +
            'เมทริกซ์กองทุน×แฟ้ม — <b>ส่งแฟ้มไม่ครบ = ตกตั้งแต่รับไฟล์</b>',
            'ฐานข้อมูล: NHSO DP Overview น.9–16 · โครงสร้าง 43 แฟ้ม Plus (hdata.moph.go.th) · ' +
            'ในระบบเรา: RUL-FIL-001/002 + ตาราง <code>ref_claim_files</code>, <code>ref_fund_file_matrix</code>')}

        ${r1Layer(3, 'ความถูกต้องของรหัสมาตรฐาน (Coding)',
            'ICD-10 / ICD-9-CM ใช้ได้จริง · สอดคล้องเพศ–อายุ · Dx–Procedure จับคู่กัน — ' +
            'แคตตาล็อกช่วง C201–C217: C201 ไม่มี Pdx · C204/C205 Pdx ไม่สอดคล้องเพศ/อายุ · ' +
            'C206 Pdx ไม่เหมาะกับผู้ป่วยใน และ P061 บน platform ใหม่',
            'ฐานข้อมูล: ICD-10-TM (สนย.) · ในระบบเรา: RUL-CDX-009 + engine ตรวจ C201/C202/C206 แล้ว')}
    </div>`,
    foot: R1_FOOT,
},

/* 3 ── 6 ชั้นกฎ (4–6) ─────────────────────────────────── */
{
    k: .84,
    eyebrow: 'หัวข้อ 1 · กฎมาตรฐานการกรองเคลมของไทย',
    title: '6 ชั้น — ชั้นที่ 4 ถึง 6 (ชั้นล่างสุดคือชั้นที่ใหญ่ที่สุด)',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.5*var(--u));height:100%">
        ${r1Layer(4, 'ราคาและรายการยา (Pricing / Catalogue)',
            'รหัสยาต้องอยู่ใน Drug Catalogue ของหน่วยบริการ ราคาที่เบิกต้องเท่าราคาที่ขึ้นทะเบียน — ' +
            'C195/C295 “ราคายาไม่เท่า Drug catalog” · C562 “ยาไม่พบใน Drug Catalog” · P124 บน platform ใหม่',
            'ฐานข้อมูล: TMT (สมสท.) + Drug Catalogue สปสช. · ในระบบเรา: RUL-DRG-007 + ตาราง <code>ref_tmt_drugs</code>')}

        ${r1Layer(5, 'กลุ่มวินิจฉัยโรคร่วม (DRG) — เฉพาะผู้ป่วยใน',
            'จัดกลุ่ม DRG ได้ (ไม่ตก error group) · RW/AdjRW ตามเวอร์ชัน Grouper · วันนอนใน trim point — ' +
            '<b>C210 “จัดกลุ่ม DRG ไม่ได้ (กลุ่ม 26509)”</b> · C211/C212 (กลุ่ม 26519/26529) · ' +
            'C334 “ไม่ใช่ DRG ในกลุ่ม Cataract ที่กำหนด”',
            'ฐานข้อมูล: คู่มือ Thai DRG + ตาราง RW จาก สกส. (chi.or.th) · ในระบบเรา: โมดูล IPD pre-audit + <code>ref_drg</code>')}

        ${r1Layer(6, 'เงื่อนไขสิทธิประโยชน์รายบริการ (Benefit rules)',
            '<b>ชั้นที่ใหญ่ที่สุดของแคตตาล็อก C</b> — เงื่อนไขเฉพาะโรค/บริการ: มะเร็งตามโปรโตคอล · ' +
            'ฟอกไต · ODS · ฝากครรภ์ · ทันตกรรม · วางแผนครอบครัว ฯลฯ (C421–C652)',
            'ฐานข้อมูล: ประกาศ/คู่มือแนวทางขอรับค่าใช้จ่ายรายปีของ สปสช. · ในระบบเรา: คลังกฎ + คลังความรู้ (RAG)')}
    </div>`,
    foot: R1_FOOT,
},

/* 4 ── เทียบมาตรฐานสากล ───────────────────────────────── */
{
    k: 1,
    eyebrow: 'หัวข้อ 1 (ต่อ) · เทียบมาตรฐานสากล',
    title: 'สหรัฐฯ มีโครงสร้างเหมือนกันทุกชั้น — แบบแผนเดียวกัน',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.7*var(--u));height:100%">
        <div class="pr-grid pr-g3">
            <div class="pr-card">
                <h3>WEDI SNIP levels 1–7</h3>
                <div class="pr-kv">ไล่จาก syntax ของไฟล์ EDI 837 → business rules → payer-specific
                    — โครงเดียวกับที่เราไล่จาก “แฟ้มครบ” ไป “เงื่อนไขสิทธิประโยชน์”</div>
            </div>
            <div class="pr-card">
                <h3>NCCI edits + MUE ของ CMS</h3>
                <div class="pr-kv">แคตตาล็อกกฎจับคู่รหัส / เพดานจำนวน — <b>แบบเดียวกับรหัสติด C</b>
                    คือเป็นเอกสารสาธารณะที่ผู้จ่ายประกาศเองว่าจะปฏิเสธด้วยเกณฑ์อะไร</div>
            </div>
            <div class="pr-card">
                <h3>ตลาด claim scrubber</h3>
                <div class="pr-kv">ทั้งอุตสาหกรรมสร้างบนแคตตาล็อกกฎสาธารณะเหล่านี้ + กฎเฉพาะ payer
                    — ไม่มีใครคิดกฎขึ้นเอง</div>
            </div>
        </div>

        <div class="pr-note" style="flex:none">
            <strong>สิ่งที่ยืนยันได้จากการเทียบนี้</strong> — แนวทางของเรา
            (<b>ยึดแคตตาล็อกทางการเป็นแกน แล้วให้โรงพยาบาลเพิ่มกฎของตัวเอง</b>)
            ตรงกับแบบแผนที่พิสูจน์แล้วในตลาดที่โตเต็มที่ ไม่ใช่การออกแบบใหม่ที่ยังไม่มีใครลอง ·
            ข้อต่างเดียวคือ localization — 16/15 แฟ้ม, รหัสติด C, Thai DRG, FDH ไม่มีในสินค้าต่างประเทศ
        </div>

        <div class="pr-card amber" style="flex:none">
            <div class="pr-kv"><b>ผลต่อการออกแบบระบบ:</b> เพราะกฎเป็น “ข้อมูล” ไม่ใช่ “โปรแกรม”
            ระบบจึงเก็บรหัสและข้อความ error ไว้ในตาราง <code>ref_error_codes</code>
            แทนที่จะ hardcode ไว้ในโค้ด — เมื่อ สปสช. ออกแคตตาล็อกใหม่ ระบบเปลี่ยนตามได้ทันทีโดยไม่ต้อง deploy</div>
        </div>
    </div>`,
    foot: R1_FOOT,
},

/* 5 ── ฐานข้อมูลกฎ + สถานะในระบบ ─────────────────────── */
{
    k: .84,
    eyebrow: 'หัวข้อ 2 · ฐานข้อมูลกฎ',
    title: 'แหล่งดาวน์โหลด และสถานะจริงในระบบเรา',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.5*var(--u));height:100%">
        <table class="pr-table">
            <tr><th style="width:20%">ชุดข้อมูล</th><th style="width:32%">แหล่งทางการ</th>
                <th style="width:22%">ในระบบเรา</th><th style="width:26%">สถานะ</th></tr>
            <tr>
                <td><b>รหัสติด C</b> (C101–C652)<br>
                    <span style="color:var(--text-muted)">แคตตาล็อกกฎ deny ของ e-Claim</span></td>
                <td>eclaim.nhso.go.th · ฉบับรวบรวม UC@KKPHO · PDF สสจ.ขอนแก่น (ม.ค. 2565)</td>
                <td><code>ref_error_codes</code><br>446 รหัส</td>
                <td><span class="pr-chip green">ครบ 100% ของแหล่ง · ทวนแล้ว 440</span><br>
                    <span style="color:var(--text-muted)">ช่วง C218–C299 และ C394–C420 ไม่มีจริง —
                    เลขแคตตาล็อกข้ามเอง (ทวนยืนยันแล้ว)</span></td>
            </tr>
            <tr>
                <td><b>โครงสร้าง 15 แฟ้ม<br>+ เมทริกซ์กองทุน</b></td>
                <td>NHSO DP Overview 23.06.2569 (อยู่ใน repo) · 43 แฟ้ม Plus — hdata.moph.go.th ·
                    FHIR CodeSystem (SIL-TH)</td>
                <td><code>ref_claim_files</code> 15 แฟ้ม<br>
                    <code>ref_fund_file_matrix</code><br>12 กองทุน / 99 แถว</td>
                <td><span class="pr-chip green">ทวนแล้ว 100%</span></td>
            </tr>
            <tr>
                <td><b>รหัสยา TMT /<br>Drug Catalogue</b></td>
                <td>Master TMT — สมสท. (ออกทุก 2 สัปดาห์) · data.go.th · Drug Catalogue สปสช.</td>
                <td><code>ref_tmt_drugs</code><br>โครงพร้อม + loader batch</td>
                <td><span class="pr-chip amber">รอโหลดไฟล์จริง</span><br>
                    <span style="color:var(--text-muted)">ขั้นตอนอยู่ใน data/reference/README.md</span></td>
            </tr>
            <tr class="bad">
                <td><b>Thai DRG</b><br>(RW / ALOS / trim)</td>
                <td>สกส. chi.or.th (คู่มือ Thai DRG + ตารางอัตรา) · SSOP สำหรับ ปกส./กรมบัญชีกลาง</td>
                <td><code>ref_drg</code><br>14 กลุ่ม (จำลอง)</td>
                <td><span class="pr-chip red">ค่าจำลอง — ห้ามใช้คิดเงิน</span><br>
                    <span style="color:var(--text-muted)">รอตารางจริงจาก สกส.</span></td>
            </tr>
            <tr>
                <td><b>รหัสตอบกลับ<br>NHSO DP ใหม่</b><br>(P124, L205, C305 ฯลฯ)</td>
                <td>สไลด์โครงการ NHSO DP (OCR) — สปสช. จะเผยแพร่แคตตาล็อก “Error ที่พบบ่อย”
                    ตามแผน Go-Live 16 ก.ย. 2569</td>
                <td>แยกไว้ที่<br><code>system = NHSO_DP</code><br>6 รหัส</td>
                <td><span class="pr-chip amber">รอแคตตาล็อกทางการ</span></td>
            </tr>
        </table>

        <div class="pr-card good" style="flex:none">
            <div class="pr-kv"><b>ทำแล้ว (11 ส.ค. 2569):</b> สร้างตาราง <code>ref_*</code> 10 ตารางใน MySQL +
            seed ข้อมูลจริง + API <code>/api/reference</code> 9 เส้น + หน้าจอเดิม
            (claim-rules / claim-case / claim-reject / nhso-import / ipd-reference) ดึงข้อมูลจริงแทน mock อัตโนมัติ
            โดย mock ยังเป็น fallback เมื่อไม่มีเซิร์ฟเวอร์ · <b>rule engine ตัวแรกใช้งานได้แล้ว</b>
            <code>POST /api/reference/validate</code> ตรวจ 6 ชั้น — ทดลองได้ที่หน้า “นำเข้าข้อมูล → อัปโหลด” กล่อง Pre-validate</div>
        </div>
    </div>`,
    foot: R1_FOOT,
},

/* 6 ── ข้อค้นพบระหว่างทวนข้อมูล ───────────────────────── */
{
    k: .96,
    eyebrow: 'หัวข้อ 2 (ต่อ) · ข้อค้นพบระหว่างทวนข้อมูล',
    title: 'สามเรื่องที่เจอตอนทวนแคตตาล็อก และเปลี่ยนวิธีออกแบบตาราง',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.6*var(--u));height:100%">
        <div class="pr-card good">
            <h3>1 · C305 — ยืนยันตรงกัน 2 แหล่ง</h3>
            <div class="pr-kv">“Approve Code ที่บันทึกเบิกไม่ตรงกับฐานข้อมูลของหน่วยบริการ”
                ตรงกับที่ mock ในระบบใช้อยู่แล้ว — ใช้ต่อได้โดยไม่ต้องแก้</div>
        </div>

        <div class="pr-card danger">
            <h3>2 · C112 — ความหมายชนกันระหว่างสองระบบ</h3>
            <div class="pr-kv">
                e-Claim เดิม: <b>“สถานภาพเมื่อจำหน่ายใช้ไม่ได้”</b><br>
                OCR จากสไลด์ platform ใหม่: <b>“วันนอนไม่สอดคล้องแฟ้ม 14”</b><br>
                <b>ผลต่อการออกแบบ:</b> ตาราง <code>ref_error_codes</code> จึงมีคอลัมน์ <code>system</code>
                แยกสองระบบออกจากกัน — ถ้าเก็บรวมกันจะตอบผิดตั้งแต่ช่วงเปลี่ยนผ่าน</div>
        </div>

        <div class="pr-card amber">
            <h3>3 · ชุดข้อมูลรอบแรกติดเลขผิดทั้งบล็อก (ช่วง C2xx)</h3>
            <div class="pr-kv">การทวนซ้ำหลายรอบจับได้ว่ารอบแรกเลื่อนเลขทั้งบล็อก —
                <b>แคตตาล็อกที่ commit แล้วคือฉบับที่สองแหล่งอิสระให้ผลตรงกันเท่านั้น</b>
                ส่วนที่ยืนยันได้แหล่งเดียวถูกกันออกไปก่อน</div>
        </div>

        <div class="pr-note" style="flex:none">
            <strong>เหตุผลที่ต้องเล่าเรื่องนี้ตอนนำเสนอ</strong> — ตัวเลข “446 รหัส ครบ 100%”
            จะมีน้ำหนักก็ต่อเมื่อบอกได้ว่าทวนอย่างไรและตัดอะไรออก ·
            ตรวจสถานะข้อมูลได้เสมอที่ <code>GET /api/reference/meta</code> —
            จำนวนแถว · % ที่ทวนแล้ว · ประวัติการโหลดล่าสุด
        </div>
    </div>`,
    foot: R1_FOOT,
},

/* 7 ── คู่แข่ง: BMS + HA.OS ───────────────────────────── */
{
    k: .82,
    eyebrow: 'หัวข้อ 3 · คู่แข่งในตลาด',
    title: 'BMS i-Claim / HOSxP และ HA.OS — สองเจ้าที่ชนเราตรงที่สุด',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.5*var(--u));height:100%">
        ${r1Vendor(
            'BMS i-Claim / HOSxP — Bangkok Medical Software',
            'เจ้าตลาด HIS โรงพยาบาลรัฐ (HOSxP ใช้ในโรงพยาบาลหลายร้อยแห่ง) · i-Claim คือโมดูลส่งเบิกในระบบนิเวศเดียวกัน',
            'ครบวงจรฝั่งส่งออก: export 16 แฟ้ม · ตรวจแก้ติด C · ตรวจสิทธิผ่าน SRM · ส่งเข้า FDH — คือ <b>“มาตรฐานโดยพฤตินัย”</b> ของ รพ.รัฐ',
            'จุดแข็ง',
            ['ข้อมูลอยู่ที่ต้นทาง (เป็น HIS เอง) ไม่ต้อง integrate',
             'ฐานลูกค้าและชุมชนผู้ใช้ใหญ่ที่สุดในประเทศ',
             'ตามประกาศ สปสช. เร็ว เพราะทุก รพ. ลูกค้ากดดันพร้อมกัน'],
            'จุดอ่อน / ช่องว่าง',
            ['ผูกกับ HOSxP — รพ.ที่ใช้ HIS อื่นใช้ไม่ได้',
             'เป็นเครื่องมือ “ส่งออกแล้ววนแก้” ไม่ใช่ control tower — ไม่มี rule governance, backtest, RAG, SLA workflow',
             'มุมมองผู้บริหาร/analytics จำกัด'])}

        ${r1Vendor(
            'HA.OS — Claims Management module',
            'HIS ยุคใหม่ (cloud) เจาะตลาดเดียวกัน · โมดูลเคลมฝังในระบบ',
            'แนวคิดใกล้เราที่สุดเชิงฟีเจอร์: Data Validation ตั้งแต่จุดสั่งยา (กันติด C ที่ point of care) · Correction Guidance · auto-booking FDH · import REP/Statement ปิดลูกหนี้อัตโนมัติ · dashboard การเงินหลายกองทุน',
            'จุดแข็ง',
            ['กันเคลมเสียตั้งแต่ตอนบันทึก ไม่ใช่ก่อนส่ง — จุดที่ถูกที่สุดในการแก้',
             'ปิดวงจรถึงการเงิน (REP → ลูกหนี้)',
             'ทำ content marketing เรื่องติด C / 43 แฟ้ม แข็งแรง (ยึดหน้าค้นหา)'],
            'จุดอ่อน / ช่องว่าง',
            ['ต้องเปลี่ยน HIS ทั้งโรงพยาบาล — ต้นทุนเปลี่ยนสูงมาก ตลาดจริงคือ รพ.ที่กำลังจะเปลี่ยน HIS เท่านั้น',
             'กฎเป็นของ vendor — รพ. เขียน/ทดสอบ/อนุมัติกฎเองแบบ maker-checker ไม่ได้'])}
    </div>`,
    foot: R1_FOOT,
},

/* 8 ── คู่แข่ง: MEDcury + ต่างประเทศ ──────────────────── */
{
    k: .9,
    eyebrow: 'หัวข้อ 3 (ต่อ) · คู่แข่งในตลาด',
    title: 'MEDcury / MEDHIS และผู้เล่นต่างประเทศ',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.55*var(--u));height:100%">
        ${r1Vendor(
            'MEDcury / MEDHIS (Centrix)',
            'HIS โรงพยาบาลเอกชน (อ้างอิงเครือ Prince ฯลฯ) · ระบบเบิกจ่าย–ตรวจสิทธิ + ต่อ SAP/ERP',
            '',
            'จุดแข็ง',
            ['เข้าใจ workflow รพ.เอกชน + ประกันเอกชน',
             'เชื่อม ERP/การเงินองค์กรได้'],
            'จุดอ่อน / ช่องว่าง',
            ['โฟกัสที่ HIS ไม่ใช่ claim intelligence — ไม่มี rule engine ที่ รพ. กำกับเอง',
             'ตลาด รพ.รัฐ/กองทุนรัฐไม่ใช่จุดแข็ง'])}

        ${r1Vendor(
            'ผู้เล่นต่างประเทศ — Waystar · Optum · Experian Health · RapidClaims',
            'ตลาด RCM สหรัฐฯ — ไม่ชนเราตรง ๆ แต่เป็นแบบแผนฟีเจอร์ที่ควรเรียน',
            '',
            'สิ่งที่ควรยืมมา',
            ['Denial prediction ด้วย ML (ทำนายโอกาสติด C ก่อนส่ง)',
             'Claim scrubber เป็น layer แยกจาก HIS ขายได้เดี่ยว ๆ — พิสูจน์แล้วว่า business model นี้ยืนได้',
             'วัดผลเป็น first-pass rate / denial rate — KPI เดียวกับ dashboard เรา'],
            'ทำไมไม่ชนเรา',
            ['ไม่มี localization ไทย (16 แฟ้ม, รหัสติด C, DRG ไทย, FDH)',
             'ราคาระดับ enterprise สหรัฐฯ'])}

        <div class="pr-note strong" style="flex:none">
            <strong>อ่านหน้านี้คู่กับเล่ม 2</strong> — MEDcury จับมือ Sati ตั้งแต่ 13 ก.พ. 2568
            ฝัง ChartSum เข้า MEDHIS ซึ่งเล่มนี้ยังไม่รู้ · สมมติฐาน “HIS vendor ตามไม่ทัน” จึงใช้ไม่ได้อีก
        </div>
    </div>`,
    foot: R1_FOOT,
},

/* 9 ── ตารางเทียบความสามารถ ───────────────────────────── */
{
    k: 1,
    eyebrow: 'หัวข้อ 3 (ต่อ) · ตารางเทียบความสามารถ',
    title: 'เทียบ 6 ความสามารถ กับ HIS vendor ทั้งสามเจ้า',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.6*var(--u));height:100%">
        <table class="pr-table">
            <tr>
                <th style="width:32%">ความสามารถ</th>
                <th class="c">BMS i-Claim</th><th class="c">HA.OS</th><th class="c">MEDcury</th>
                <th class="c" style="background:var(--brand-navy);color:#fff">MediClearing (เรา)</th>
            </tr>
            <tr><td>ใช้ได้โดยไม่เปลี่ยน HIS</td>
                <td class="c"><span class="pr-chip red">ผูก HOSxP</span></td>
                <td class="c"><span class="pr-chip red">ผูก HA.OS</span></td>
                <td class="c"><span class="pr-chip red">ผูก MEDHIS</span></td>
                <td class="c"><span class="pr-chip green">HIS-agnostic</span></td></tr>
            <tr><td>ตรวจก่อนส่ง (pre-validate ติด C)</td>
                <td class="c"><span class="pr-chip green">มี</span></td>
                <td class="c"><span class="pr-chip green">มี (ที่จุดสั่ง)</span></td>
                <td class="c"><span class="pr-chip amber">บางส่วน</span></td>
                <td class="c"><span class="pr-chip green">แกนของระบบ</span></td></tr>
            <tr><td>Rule governance (maker-checker · version · backtest)</td>
                <td class="c"><span class="pr-chip red">ไม่มี</span></td>
                <td class="c"><span class="pr-chip red">ไม่มี</span></td>
                <td class="c"><span class="pr-chip red">ไม่มี</span></td>
                <td class="c"><span class="pr-chip green">ออกแบบไว้แล้ว (BR-01..08)</span></td></tr>
            <tr><td>คลังความรู้อ้างอิงเอกสาร (RAG + citation)</td>
                <td class="c"><span class="pr-chip red">ไม่มี</span></td>
                <td class="c"><span class="pr-chip red">ไม่มี</span></td>
                <td class="c"><span class="pr-chip red">ไม่มี</span></td>
                <td class="c"><span class="pr-chip green">ออกแบบไว้แล้ว</span></td></tr>
            <tr><td>Reject → กฎใหม่ (feedback loop)</td>
                <td class="c"><span class="pr-chip amber">มือ</span></td>
                <td class="c"><span class="pr-chip amber">guidance</span></td>
                <td class="c"><span class="pr-chip red">ไม่มี</span></td>
                <td class="c"><span class="pr-chip green">Pareto → draft rule</span></td></tr>
            <tr class="bad"><td><b>ใช้งานจริงในโรงพยาบาลวันนี้</b></td>
                <td class="c">หลายร้อยแห่ง</td>
                <td class="c">มีลูกค้าจริง</td>
                <td class="c">เครือ รพ.เอกชน</td>
                <td class="c"><b>ต้นแบบ + ฐานข้อมูลอ้างอิงจริง</b></td></tr>
        </table>

        <div class="pr-note strong" style="flex:none">
            <strong>แถวล่างสุดคือแถวที่ต้องพูดเองก่อนถูกถาม</strong> — เรามีเครื่องหมายเขียวมากที่สุด
            ในห้าแถวบน แต่ทุกเจ้ามีโรงพยาบาลใช้จริงแล้ว ส่วนเรายังไม่มี
            · ความได้เปรียบเชิงฟีเจอร์ไม่ชนะความได้เปรียบเชิงหลักฐาน
        </div>
    </div>`,
    foot: R1_FOOT,
},

/* 10 ── SWOT ──────────────────────────────────────────── */
{
    k: .96,
    eyebrow: 'หัวข้อ 4 · ตำแหน่งของเรา',
    title: 'SWOT ณ 11 ส.ค. 2569',
    body: `
    <div class="pr-grid pr-g2" style="height:100%;align-content:start">
        <div class="pr-card good">
            <h3 style="color:var(--status-success-strong)">Strengths</h3>
            <ul class="pr-ul">
                <li>ตำแหน่ง HIS-agnostic “ชั้นข้าง HIS” — ไม่บังคับ รพ. เปลี่ยนระบบ</li>
                <li>Rule governance ครบ (maker-checker · versioning · backtest) — ไม่มีคู่แข่งไทยรายใดมี</li>
                <li>วางสถาปัตยกรรม provenance/verified ตั้งแต่ต้น — ทุกตัวเลขบอกที่มาได้</li>
            </ul>
        </div>
        <div class="pr-card danger">
            <h3 style="color:var(--status-danger-strong)">Weaknesses</h3>
            <ul class="pr-ul">
                <li>ยังเป็นต้นแบบ — rule engine จริงยังไม่ได้ execute กฎ (เงื่อนไขยังเป็นข้อความ)</li>
                <li>ไม่มีข้อมูลที่ต้นทาง — ต้องพึ่ง integration (API/ไฟล์/DB view) กับ HIS ทุกเจ้า</li>
                <li>ทีมเล็กเทียบ vendor ที่มี support ทั่วประเทศ</li>
            </ul>
        </div>
        <div class="pr-card good">
            <h3 style="color:var(--status-success-strong)">Opportunities</h3>
            <ul class="pr-ul">
                <li>NHSO Digital Platform Go-Live 16 ก.ย. 2569 — ทุก รพ. ต้องปรับตัวพร้อมกัน คือหน้าต่างการขายที่ดีที่สุด</li>
                <li>รพ. ใช้ HIS หลากหลาย (HOSxP, SSB, iMed, เขียนเอง) — ไม่มีใครให้เครื่องมือเคลมกลางกับกลุ่มนี้</li>
                <li>แคตตาล็อกรหัส C เป็นข้อมูลสาธารณะ — สร้าง moat ที่ “ความสด + ความครบ + กฎที่ execute ได้” ไม่ใช่ตัวข้อมูล</li>
            </ul>
        </div>
        <div class="pr-card amber">
            <h3 style="color:var(--brand-amber-600)">Threats</h3>
            <ul class="pr-ul">
                <li>BMS เพิ่ม analytics/governance ให้ i-Claim — กินตลาด HOSxP ทั้งก้อนทันที</li>
                <li>สปสช. ทำ pre-validation ให้ฟรีบน platform ใหม่ — ลดคุณค่าชั้นตรวจ format พื้นฐาน
                    (เราต้องยืนที่ชั้น 5–6 + workflow)</li>
                <li>FDH บังคับเส้นทางส่งข้อมูล — ต้องตาม spec ราชการให้ทันตลอด</li>
            </ul>
        </div>
    </div>`,
    foot: R1_FOOT,
},

/* 11 ── ข้อเสนอถัดไป ──────────────────────────────────── */
{
    k: .98,
    eyebrow: 'หัวข้อ 4 (ต่อ) · ข้อเสนอถัดไป',
    title: 'เรียงตามผลตอบแทน — สองข้อแรกปิดแล้วในวันเดียวกับที่เขียนรายงาน',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.6*var(--u));height:100%">
        <table class="pr-table">
            <tr><th class="c" style="width:6%">#</th><th style="width:52%">งาน</th><th>เหตุผล</th></tr>
            <tr class="good">
                <td class="c"><b>✓</b></td>
                <td><s>ทำ rule engine ที่ execute เงื่อนไขได้จริง (ชั้น deterministic)</s> — <b>เสร็จแล้ว</b>:
                    <code>POST /api/reference/validate</code> ตรวจแฟ้ม / ผู้ป่วย / วินิจฉัย / ยา / ค่าใช้จ่าย / DRG
                    พร้อมกล่องทดลองในหน้า nhso-import</td>
                <td>เปลี่ยน “แคตตาล็อกกฎ” เป็น “ตัวกันเงินหลุด” — คุณค่าที่ขายได้จริง</td>
            </tr>
            <tr class="good">
                <td class="c"><b>✓</b></td>
                <td><s>ปิดแคตตาล็อกรหัส C ให้ครบ</s> — <b>เสร็จแล้ว</b>: ครบ 100% ของแหล่ง (446 รหัส)
                    ช่วงที่ “หาย” พิสูจน์แล้วว่าเลขข้ามเอง</td>
                <td>ตัวเลข “ครบ 100%” คือ marketing ในตัว</td>
            </tr>
            <tr>
                <td class="c"><b>1</b></td>
                <td>โหลด Master TMT ฉบับจริง + ตาราง Thai DRG จาก สกส.
                    (pipeline พร้อมแล้ว — ขั้นตอนใน <code>data/reference/README.md</code>)</td>
                <td>ปลดป้าย “ค่าจำลอง” — ความน่าเชื่อถือของ demo ต่อ รพ. จริง
                    และทำให้กฎราคายา/DRG trim คมจริง</td>
            </tr>
            <tr>
                <td class="c"><b>2</b></td>
                <td>สร้างตัว import 16 แฟ้ม/CSV จริง (FR-01) แล้วต่อท่อเข้า validate engine
                    เพื่อ demo end-to-end กับข้อมูล รพ. นำร่อง</td>
                <td>จุดอ่อนใหญ่สุดคือ “ไม่มีข้อมูลต้นทาง” — importer คือประตูเข้า</td>
            </tr>
            <tr>
                <td class="c"><b>3</b></td>
                <td>เพิ่ม fix guidance รายรหัส (คอลัมน์รองรับแล้ว) จาก PDF แนวทางแก้ไขของ สสจ./สปสช.</td>
                <td>เปลี่ยน error เป็น to-do ที่หน้างานทำตามได้ทันที — จุดขายเหนือ REP เปล่า ๆ</td>
            </tr>
        </table>

        <div class="pr-note" style="flex:none">
            <strong>สถานะ ณ วันนำเสนอ (12 ส.ค. 2569)</strong> — ข้อ 2 ทำแล้วเฉพาะฝั่งผู้ป่วยใน
            (IPD/PAT/INS/IDX/IOP/CHA) ฝั่ง OPD และ AER/ADP ยังไม่ได้ทำ · ข้อ 1 และ 3 ยังค้างทั้งคู่
        </div>
    </div>`,
    foot: R1_FOOT,
},

/* 12 ── แหล่งอ้างอิง ──────────────────────────────────── */
{
    k: .94,
    eyebrow: 'ท้ายเล่ม 1',
    title: 'แหล่งอ้างอิงทั้งหมดของรายงานฉบับนี้',
    lead: 'ทุกข้อในเล่มนี้สาวกลับได้ถึงเอกสารสาธารณะหรือเอกสารทางการที่ระบุไว้ด้านล่าง — ไม่มีข้อไหนมาจากการประมาณเอง',
    body: `
    <div style="display:flex;flex-direction:column;gap:calc(.55*var(--u));height:100%">
        <div class="pr-grid pr-g2">
            <div class="pr-card">
                <h3>รหัสติด C</h3>
                <ul class="pr-ul">
                    <li>UC@KKPHO — <code>uckkpho.com/uc/1313</code></li>
                    <li>C-Error E-Claim NHSO (06-01-2565) — PDF</li>
                    <li>C Validate 20230915 (รพ.สมุทรสาคร) — PDF</li>
                </ul>
            </div>
            <div class="pr-card">
                <h3>โครงสร้างข้อมูล</h3>
                <ul class="pr-ul">
                    <li>43 แฟ้ม (กสธ.) — <code>hdata.moph.go.th</code></li>
                    <li>FHIR CodeSystem — <code>terms.sil-th.org</code></li>
                    <li>NHSO DP Overview 23.06.2569 (ในโฟลเดอร์ <code>doc/</code>)</li>
                </ul>
            </div>
            <div class="pr-card">
                <h3>ยาและอัตราจ่าย</h3>
                <ul class="pr-ul">
                    <li>Master TMT — สมสท. <code>this.or.th</code> · <code>data.go.th</code></li>
                    <li>Drug Catalogue สปสช. — <code>drug.nhso.go.th</code></li>
                    <li>สกส. (Thai DRG / SSOP) — <code>chi.or.th</code></li>
                    <li>FDH กสธ. — <code>dhes.moph.go.th</code> · Hfocus ถามตอบ FDH</li>
                </ul>
            </div>
            <div class="pr-card">
                <h3>ผู้ขายและตลาด</h3>
                <ul class="pr-ul">
                    <li>BMS-HOSxP — <code>hosxp.net</code> · เอกสารอบรม i-Claim V4 (PDF)</li>
                    <li>HA.OS — <code>haos-his.com/reimbursement</code> · บทความติด C</li>
                    <li>MEDcury / MEDHIS — <code>medcury.health</code></li>
                    <li>RCM สากล — Wikipedia · RapidClaims · Becker’s 385 RCM companies 2026</li>
                </ul>
            </div>
        </div>

        <div class="pr-note" style="flex:none;display:flex;align-items:center;gap:calc(.8*var(--u))">
            <span style="flex:1"><strong>สถานะข้อมูลในระบบตรวจได้เสมอที่</strong>
            <code>GET /api/reference/meta</code> — จำนวนแถว · % ที่ทวนแล้ว · ประวัติการโหลดล่าสุด</span>
            <a class="pr-open" href="${REPORT_1_URL}" target="_blank" rel="noopener">เปิดรายงานฉบับเต็ม →</a>
        </div>
    </div>`,
    foot: R1_FOOT,
},

];

window.PRESENT_SLIDES = PRESENT_SLIDES;
