/* ────────────────────────────────────────────────────────
   ผังการไหลของข้อมูลในการตรวจสอบเวชระเบียน
   (present-modules.html · present-modules-slides.js)

   ต่างจากอีกสองไฟล์ผังตรงที่
     · present-flows.js         วาด "กระบวนการธุรกิจ" (as-is / to-be / เส้นทาง สปสช.)
     · present-flows-modules.js วาด "เมนูในระบบ" — กล่องหนึ่ง = หน้าจอจริงหนึ่งหน้า
     · ไฟล์นี้                  วาด "ข้อมูล" — กล่องหนึ่ง = ชั้นการตรวจหรือตารางอ้างอิง
       ลูกศรคือทางที่ข้อมูลไหล ไม่ใช่การส่งงานต่อระหว่างหน้าจอ
       จึงแยกไฟล์ ไม่เอาไปต่อท้าย present-flows-modules.js ที่ประกาศสัญญาไว้คนละแบบ

   ⭐ สาระที่ทั้งสามผังต้องสื่อให้ตรงกัน — สองคีย์คนละแกน (reference.sql:336-341)
        fund_key  (กองทุน สปสช. 12 ค่า) → กำหนดว่า "ต้องส่งแฟ้มไหนบ้าง"  → ชั้น FILES
        payer_key (สิทธิผู้ป่วย 6 ค่า)  → กำหนดว่า "กฎข้อไหนทำงาน · เอกสารอะไรบังคับ ·
                                          เรตจ่ายต่อ RW เท่าไร"        → คลังกฎ
      เคสผู้ป่วยในใช้ fund_key = 'IP' เสมอ แต่ payer ต่างกันได้ทุกเคส
      และในคลังกฎ "ไม่มีคอลัมน์ fund_key เลย" — scope ด้วย payer × service_type เท่านั้น
      ถ้าวาดรวมกันเมื่อไร ผู้ฟังจะเข้าใจว่ากองทุนคุมทุกอย่าง ซึ่งไม่จริง

   ⚠️ ไฟล์นี้ "ใช้" PRF / prfBox / prfArrow / prfMarkers / prfText / prfBadge / prfSvg
      จาก present-flows.js และ pmBand / pmEdgeLabel จาก present-flows-modules.js
      — ห้ามประกาศซ้ำ (const ชนกันแล้วหน้าขาวทั้งหน้า)
      ลำดับโหลดจึงต้องเป็น present-flows.js → present-flows-modules.js → ไฟล์นี้

   ⚠️ id ของ <marker> อยู่ใน document เดียวกันทั้ง deck — prefix ด้วย pa* ทุกตัว
      ต้องไม่ชนกับ prefix ของอีกสองไฟล์ (jr/st/ch/tl/ar/as/tb/rf/vc และ pm)

   ⚠️ ภาษาไทยไม่มีช่องว่างระหว่างคำ SVG จึงตัดบรรทัดเองไม่ได้
      ทุก label ส่งเป็นอาร์เรย์ของบรรทัด · เกณฑ์: กว้างกล่อง ÷ (0.55 × font-size)

   ⚠️ ทุกผังในไฟล์นี้เป็นผัง "เต็มสไลด์" จึงเรียก prfSvg() โดย "ไม่ส่ง" อาร์กิวเมนต์ auto
      (ส่ง true แล้วได้ .pr-svg-auto ซึ่งสูงเกิน .pr-body แล้วโดนตัดท้ายผังทิ้ง)

   ⚠️ ไม่วาดหัวเรื่องซ้ำใน SVG — สไลด์มี <h2> ของตัวเองแล้ว · legend ไปอยู่ที่ foot ของสไลด์
   ──────────────────────────────────────────────────────── */


/* ══════════════════════════════════════════════════════════
   1. ภาพรวม — ข้อมูลชุดเดียว แต่ถูกกำหนดชะตาด้วยสองคีย์
   ----------------------------------------------------------
   จุดที่ตั้งใจให้เห็นด้วยตา: เส้นประของ "กองทุน" ลงไปที่ชั้นแรกชั้นเดียว
   ส่วนเส้นประของ "สิทธิ" วิ่งผ่านช่องว่างระหว่างคอลัมน์ลงไปที่คลังกฎ
   โดยไม่แตะ 8 ชั้นเลย — นั่นคือความจริงของโครงสร้างข้อมูล ไม่ใช่การจัดวางให้สวย

   8 ชั้นเรียงแบบงูเลื้อย (แถวล่างวิ่งขวา→ซ้าย) เพื่อไม่ให้เส้นวนกลับ
   ตัดกับเส้นประของสิทธิ · มีตราเลข 1–8 กำกับทุกกล่องกันอ่านลำดับผิด
   ══════════════════════════════════════════════════════════ */
function paAuditFlow() {
    const W = 1300, H = 580;
    const MX = 250, MW = 1034;                       /* คอลัมน์หลัก 250..1284 */
    const GAP = 14, N = 4, BW = (MW - GAP * (N - 1)) / N;   /* = 248 */
    const xs = i => MX + i * (BW + GAP);
    const cx = i => xs(i) + BW / 2;                  /* 374 · 636 · 898 · 1160 */

    const SRC_Y = 14, SRC_H = 48, SRC_BOT = SRC_Y + SRC_H;
    const KEY_Y = 82, KEY_H = 84, KEY_BOT = KEY_Y + KEY_H;
    const R1_Y = 190, R2_Y = 296, LH = 84;
    const R1_BOT = R1_Y + LH, R2_BOT = R2_Y + LH;
    const MID_Y = 408, MID_H = 76, MID_BOT = MID_Y + MID_H;
    const OUT_Y = 512, OUT_H = 56;

    const HW = 508;                                  /* กล่องครึ่งคอลัมน์ */
    const HL = MX, HR = MX + MW - HW;                /* 250 · 776 */
    const hlc = HL + HW / 2, hrc = HR + HW / 2;      /* 504 · 1030 */

    /* ช่องว่างระหว่างคอลัมน์ 3 กับ 4 — ทางลงของเส้น "สิทธิ" */
    const PAYER_X = (xs(2) + BW + xs(3)) / 2;        /* = 1029 */

    /* ── 8 ชั้น เรียงตามลำดับที่ engine execute จริง ──
       col แถวบน 0→3 · แถวล่าง 3→0 (งูเลื้อย) · ipd = ชั้นที่ทำงานเฉพาะผู้ป่วยใน */
    const layers = [
        { r: 0, c: 0, n: '1', t: ['แฟ้มครบตามกองทุน'], s: ['FILES', 'ตามเมทริกซ์กองทุน × แฟ้ม'] },
        { r: 0, c: 1, n: '2', t: ['ข้อมูลผู้ป่วย'], s: ['PATIENT', 'C101–C106 · C116'] },
        { r: 0, c: 2, n: '3', t: ['วันรับ – วันจำหน่าย'], s: ['ADMISSION · C107 · C121', '★ เฉพาะผู้ป่วยใน'], ipd: true },
        { r: 0, c: 3, n: '4', t: ['การวินิจฉัย'], s: ['DX', 'C201 · C202 · C203 · C206'] },
        { r: 1, c: 3, n: '5', t: ['หัตถการ'], s: ['PROC · เทียบ ICD-9-CM', 'ต้องมีแฟ้ม 6 มาด้วย'] },
        { r: 1, c: 2, n: '6', t: ['ยาและราคา'], s: ['DRUG · C195 · C562', 'เทียบราคาคลังยาของหน่วยบริการ'] },
        { r: 1, c: 1, n: '7', t: ['ค่าใช้จ่าย'], s: ['CHARGE · C301 · C312', 'ยอดรวมต้องเท่ารายการย่อย'] },
        { r: 1, c: 0, n: '8', t: ['กลุ่มวินิจฉัยโรคร่วม'], s: ['DRG · C210 · วันนอนเทียบจุดตัด', '★ เฉพาะผู้ป่วยใน'], ipd: true },
    ];

    let g = prfMarkers([
        { id: 'paFwd', c: PRF.navy },
        { id: 'paFund', c: PRF.blue },
        { id: 'paPayer', c: PRF.amber },
        { id: 'paRef', c: PRF.slate },
        { id: 'paOk', c: PRF.green },
        { id: 'paWarn', c: PRF.amber },
        { id: 'paStop', c: PRF.red },
    ]);

    /* ── ต้นทาง ── */
    g += pmBand({
        x: MX, y: SRC_Y, w: MW, h: SRC_H, rx: 12,
        fill: PRF.navy, stroke: PRF.navy, sw: 2.4,
        t: ['ข้อมูลเคสหนึ่งชุด — จาก 16 แฟ้มของ HIS หรือคีย์ในหน้าจอผู้ป่วยใน'],
        s: ['ไม่ว่ามาทางไหน ทุกเคสถูกตรวจด้วยโครงเดียวกัน — ต่างกันที่ “สองคีย์” ในแถวถัดไป'],
        fs: 21, sfs: 15, tc: PRF.onDark, sc: PRF.onDark,
    });

    /* ── สองคีย์ที่กำหนดว่าเคสนี้ต้องตรวจอะไร ── */
    g += prfBox({
        x: HL, y: KEY_Y, w: HW, h: KEY_H, rx: 12,
        t: ['กองทุน   fund_key — 12 ค่า'],
        s: ['กำหนดว่า “เคสนี้ต้องส่งแฟ้มไหนบ้าง”',
            'OP PP QOF LTC CMHS DMHT TTM REHAB CANCER TELEMED AE IP'],
        fs: 19, sfs: 13, fill: PRF.blueBg, stroke: PRF.blue, sw: 3, tc: PRF.blueInk,
    });
    g += prfBox({
        x: HR, y: KEY_Y, w: HW, h: KEY_H, rx: 12,
        t: ['สิทธิ   payer_key — 6 ค่า'],
        s: ['กำหนดว่า “กฎข้อไหนทำงาน · เอกสารอะไรบังคับ · เรตจ่ายเท่าไร”',
            'UC · OFC · SSS · LGO · EMS (UCEP) · PVT (ประกันเอกชน)'],
        fs: 19, sfs: 13, fill: PRF.amberBg, stroke: PRF.amber, sw: 3, tc: PRF.amber,
    });
    g += prfArrow(`M${hlc},${SRC_BOT} L${hlc},${KEY_Y - 3}`, PRF.navy, 'paFwd');
    g += prfArrow(`M${hrc},${SRC_BOT} L${hrc},${KEY_Y - 3}`, PRF.navy, 'paFwd');

    /* กองทุน → ชั้นแรกชั้นเดียว */
    g += prfArrow(`M${hlc},${KEY_BOT} L${hlc},${KEY_BOT + 12} L${cx(0)},${KEY_BOT + 12} L${cx(0)},${R1_Y - 3}`,
        PRF.blue, 'paFund', { dash: '7 5', sw: 2.4 });

    /* สิทธิ → ข้ามทั้ง 8 ชั้น ลงตรงไปที่คลังกฎ ผ่านช่องว่างระหว่างคอลัมน์ */
    g += prfArrow(`M${PAYER_X},${KEY_BOT} L${PAYER_X},${MID_Y - 3}`,
        PRF.amber, 'paPayer', { dash: '9 6', sw: 2.4 });
    /* ป้ายวางในช่องว่างระหว่างแถวล่างกับแถว MID (380..408) — สูงพอให้ป้าย 26px ไม่ทับกล่อง */
    g += pmEdgeLabel(PAYER_X, (R2_BOT + MID_Y) / 2, 'สิทธิไม่ผ่าน 8 ชั้น', PRF.amber);

    /* ── ตารางอ้างอิงในฐานข้อมูล (แผงตั้งด้านซ้าย) ── */
    const REF_X = 16, REF_Y = R1_Y, REF_W = 214, REF_H = MID_BOT - R1_Y;
    g += prfBox({
        x: REF_X, y: REF_Y, w: REF_W, h: REF_H, rx: 12,
        t: ['ตารางอ้างอิง', 'ในฐานข้อมูล'],
        s: ['ref_funds',
            'ref_fund_file_matrix  99 แถว',
            '',
            'ref_icd10 · ref_icd9',
            'ref_tmt_drugs',
            'ref_drg',
            '',
            'ref_error_codes',
            '446 รหัสติด C',
            '',
            'ข้อความ error ไม่ฝังในโค้ด',
            'ดึงจากตารางตอนท้ายเสมอ'],
        fs: 17, sfs: 12.5, fill: PRF.faint, stroke: PRF.line, sw: 2.2, sc: PRF.slate, sop: .92,
    });
    g += prfArrow(`M${REF_X + REF_W},${R1_Y + LH / 2} L${xs(0) - 3},${R1_Y + LH / 2}`,
        PRF.slate, 'paRef', { dash: '7 5', sw: 2 });
    g += prfArrow(`M${REF_X + REF_W},${R2_Y + LH / 2} L${xs(0) - 3},${R2_Y + LH / 2}`,
        PRF.slate, 'paRef', { dash: '7 5', sw: 2 });

    /* ── 8 ชั้น ── */
    layers.forEach(L => {
        const x = xs(L.c), y = L.r ? R2_Y : R1_Y;
        g += prfBox({
            x: x, y: y, w: BW, h: LH, rx: 12, t: L.t, s: L.s, fs: 18, sfs: 12.5,
            fill: L.ipd ? PRF.amberBg : PRF.white,
            stroke: L.ipd ? PRF.amber : PRF.navy,
            sw: L.ipd ? 3 : 2.2,
            tc: L.ipd ? PRF.amber : PRF.ink,
        });
        g += prfBadge(x + 20, y, L.n, L.ipd ? PRF.amber : PRF.navy, 13, 15);
    });

    /* ลูกศรแถวบน ซ้าย→ขวา */
    for (let i = 0; i < 3; i++) {
        g += prfArrow(`M${xs(i) + BW},${R1_Y + LH / 2} L${xs(i + 1) - 3},${R1_Y + LH / 2}`, PRF.navy, 'paFwd');
    }
    /* ตกลงแถวล่างที่คอลัมน์ขวาสุด */
    g += prfArrow(`M${cx(3)},${R1_BOT} L${cx(3)},${R2_Y - 3}`, PRF.navy, 'paFwd');
    /* ลูกศรแถวล่าง ขวา→ซ้าย */
    for (let i = 3; i > 0; i--) {
        g += prfArrow(`M${xs(i)},${R2_Y + LH / 2} L${xs(i - 1) + BW + 3},${R2_Y + LH / 2}`, PRF.navy, 'paFwd');
    }

    /* ── MRA + คลังกฎ ── */
    g += prfBox({
        x: HL, y: MID_Y, w: HW, h: MID_H, rx: 12,
        t: ['เกณฑ์เวชระเบียน MRA 2563'],
        s: ['12 องค์ประกอบ — บังคับเสมอ 7 + ตามลักษณะเคส 5',
            '★ เฉพาะผู้ป่วยใน · ข้อที่ไม่เกี่ยวกับเคสตัดออกจากตัวหาร'],
        fs: 19, sfs: 13, fill: PRF.amberBg, stroke: PRF.amber, sw: 3, tc: PRF.amber,
    });
    g += prfBox({
        x: HR, y: MID_Y, w: HW, h: MID_H, rx: 12,
        t: ['คลังกฎของโรงพยาบาล'],
        s: ['21 กฎที่ใช้งานอยู่ · ตรวจอัตโนมัติได้จริง 10 ข้อ (48%)',
            'scope ด้วย สิทธิ × ประเภทบริการ (OPD / IPD / PP)'],
        fs: 19, sfs: 13, fill: PRF.blueBg, stroke: PRF.blue, sw: 3, tc: PRF.blueInk,
    });
    /* ชั้นที่ 8 → MRA (ยกลงมาต่ำกว่าแถวกล่องก่อนค่อยเลี้ยว) */
    g += prfArrow(`M${cx(0)},${R2_BOT} L${cx(0)},${MID_Y - 14} L${hlc},${MID_Y - 14} L${hlc},${MID_Y - 3}`,
        PRF.navy, 'paFwd');
    g += prfArrow(`M${HL + HW},${MID_Y + MID_H / 2} L${HR - 3},${MID_Y + MID_H / 2}`, PRF.navy, 'paFwd');

    /* ── ผลลัพธ์ 3 ทาง ── */
    const OW = (MW - GAP * 2) / 3;                    /* ≈ 335.3 */
    const outs = [
        { t: ['ผ่าน — เข้าคิวส่งเบิก'], s: ['ไม่เหลือ error'], c: PRF.green, bg: PRF.greenBg, ic: PRF.greenInk, m: 'paOk' },
        { t: ['ตีกลับให้แก้'], s: ['สร้างงานพร้อม checklist ให้หน่วยที่ต้องแก้'], c: PRF.amber, bg: PRF.amberBg, ic: PRF.amber, m: 'paWarn' },
        { t: ['ระงับส่ง'], s: ['กฎระดับ BLOCK — กดผ่านไม่ได้'], c: PRF.red, bg: PRF.redBg, ic: PRF.redInk, m: 'paStop' },
    ];
    const ox = i => MX + i * (OW + GAP);
    const ocx = i => ox(i) + OW / 2;
    const BUS = OUT_Y - 14;

    g += `<path d="M${hrc},${MID_BOT} L${hrc},${BUS}" fill="none" stroke="${PRF.navy}"
            stroke-width="2.8" stroke-linecap="round"/>`;
    g += `<path d="M${ocx(0)},${BUS} L${ocx(2)},${BUS}" fill="none" stroke="${PRF.navy}"
            stroke-width="2.8" stroke-linecap="round"/>`;
    outs.forEach((o, i) => {
        g += prfArrow(`M${ocx(i)},${BUS} L${ocx(i)},${OUT_Y - 3}`, o.c, o.m);
        g += prfBox({
            x: ox(i), y: OUT_Y, w: OW, h: OUT_H, rx: 12, t: o.t, s: o.s, fs: 18, sfs: 12.5,
            fill: o.bg, stroke: o.c, sw: 2.6, tc: o.ic,
        });
    });

    return prfSvg(W, H, g, 'ผังการไหลของข้อมูลในการตรวจสอบเวชระเบียน — กองทุนกำหนดแฟ้ม สิทธิกำหนดกฎ');
}


/* ══════════════════════════════════════════════════════════
   โครงร่วมของผัง IPD / OPD
   ----------------------------------------------------------
   สองผังใช้กริดเดียวกันโดยตั้งใจ ผู้ฟังจึงเทียบ "ต่างกันตรงไหน" ได้ทันที
   ไม่ต้องไล่อ่านใหม่ทั้งผัง — ตำแหน่งกล่องที่ i ของทั้งสองผังคือขั้นเดียวกัน
   ══════════════════════════════════════════════════════════ */
const PA_W = 1300, PA_H = 512, PA_PAD = 16;
const PA_FW = PA_W - PA_PAD * 2;                      /* 1268 */
const PA_N = 6, PA_GAP = 16;
const PA_BW = (PA_FW - PA_GAP * (PA_N - 1)) / PA_N;   /* = 198 */
const PA_TOP_Y = 14, PA_TOP_H = 60;
const PA_ROW_Y = 104, PA_ROW_H = 128;
const PA_DET_Y = 278, PA_DET_H = 108, PA_DET_W = 612;
const PA_SUM_Y = 416, PA_SUM_H = 76;
const paX = i => PA_PAD + i * (PA_BW + PA_GAP);
const paCx = i => paX(i) + PA_BW / 2;

/** วาดโครงร่วม แล้วคืนสตริง SVG ที่ประกอบเสร็จแล้ว */
function paTrack(o) {
    let g = prfMarkers([
        { id: o.pfx + 'Fwd', c: PRF.navy },
        { id: o.pfx + 'Det', c: PRF.slate },
    ]);

    /* แถบบน — ประโยคเดียวที่สรุปว่าหมวดนี้ต่างจากอีกหมวดตรงไหน */
    g += pmBand({
        x: PA_PAD, y: PA_TOP_Y, w: PA_FW, h: PA_TOP_H, rx: 12,
        fill: o.topFill, stroke: o.topStroke, sw: 2.4,
        t: o.topT, s: o.topS, fs: 21, sfs: 15, tc: o.topInk, sc: o.topInk,
    });

    /* แถวขั้นตอน 6 กล่อง */
    o.steps.forEach((s, i) => {
        g += prfBox({
            x: paX(i), y: PA_ROW_Y, w: PA_BW, h: PA_ROW_H, rx: 12,
            t: s.t, s: s.s, fs: 17, sfs: 12,
            fill: s.bg || PRF.white, stroke: s.c || PRF.navy, sw: s.hi ? 3.4 : 2.2,
            tc: s.ic || PRF.ink, sc: s.ic || PRF.ink,
        });
        if (i < PA_N - 1) {
            g += prfArrow(`M${paX(i) + PA_BW},${PA_ROW_Y + PA_ROW_H / 2} L${paX(i + 1) - 3},${PA_ROW_Y + PA_ROW_H / 2}`,
                PRF.navy, o.pfx + 'Fwd');
        }
    });

    /* กล่องขยายความสองใบ — ผูกกับกล่องที่ 2 และที่ 4 ด้วยเส้นประสั้น ๆ */
    [o.detL, o.detR].forEach((d, k) => {
        const x = k ? PA_W - PA_PAD - PA_DET_W : PA_PAD;
        g += prfBox({
            x: x, y: PA_DET_Y, w: PA_DET_W, h: PA_DET_H, rx: 12,
            t: d.t, s: d.s, fs: 18, sfs: 14,
            fill: d.bg || PRF.faint, stroke: d.c || PRF.line, sw: 2.2,
            tc: d.ic || PRF.ink, sc: d.ic || PRF.slate, sop: .95,
        });
        const from = paCx(k ? 3 : 1);
        g += prfArrow(`M${from},${PA_ROW_Y + PA_ROW_H} L${from},${PA_DET_Y - 3}`,
            PRF.slate, o.pfx + 'Det', { dash: '7 5', sw: 2 });
    });

    /* แถบสรุปท้ายผัง — ไม่มีลูกศรเข้าโดยตั้งใจ เป็นหมายเหตุ ไม่ใช่ขั้นตอน */
    g += pmBand({
        x: PA_PAD, y: PA_SUM_Y, w: PA_FW, h: PA_SUM_H, rx: 12,
        fill: o.sumFill, stroke: o.sumStroke, sw: 2.6, dash: o.sumDash,
        t: o.sumT, s: o.sumS, fs: 21, sfs: 15, tc: o.sumInk,
    });

    return prfSvg(PA_W, PA_H, g, o.title);
}


/* ══════════════════════════════════════════════════════════
   2. ผู้ป่วยใน — ทำงานครบทุกชั้น และมีเกณฑ์เวชระเบียนของตัวเอง
   ══════════════════════════════════════════════════════════ */
function paAuditIpd() {
    return paTrack({
        pfx: 'paI',
        title: 'ผังการไหลของข้อมูลในการตรวจเวชระเบียนผู้ป่วยใน',

        topFill: PRF.navy, topStroke: PRF.navy, topInk: PRF.onDark,
        topT: ['ผู้ป่วยในทุกเคสใช้กองทุน IP เสมอ — แต่ “สิทธิ” ต่างกันได้ทุกเคส'],
        topS: ['กองทุนคุมว่าต้องส่งแฟ้มไหน · สิทธิคุมว่าต้องมีเอกสารอะไรและใช้กฎข้อไหน — เคสเดียวจึงมีสองเงื่อนไขพร้อมกัน'],

        steps: [
            { t: ['รับข้อมูล'], s: ['16 แฟ้ม: IPD PAT INS', 'IDX IOP CHA', 'หรือคีย์ในหน้าติดตาม'] },
            { t: ['แฟ้มตามกองทุน'], s: ['fund_key = IP เสมอ', 'บังคับ 9 แฟ้ม', '+ แฟ้ม 15 ถ้ามีวันลา'],
              c: PRF.blue, bg: PRF.blueBg, ic: PRF.blueInk },
            { t: ['8 ชั้น deterministic'], s: ['ทำงานครบทุกชั้น', 'รวม ADMISSION และ DRG', 'ที่ผู้ป่วยนอกไม่มี'] },
            { t: ['เกณฑ์เวชระเบียน', 'MRA 2563'], s: ['12 องค์ประกอบ', 'ให้คะแนนตามลักษณะเคส'],
              c: PRF.amber, bg: PRF.amberBg, ic: PRF.amber, hi: true },
            { t: ['คลังกฎ scope IPD'], s: ['กฎที่พึ่งผล MRA', 'ถ้าไม่ส่งผลตรวจเข้าไป', 'คืน SKIPPED ไม่ใช่ PASS'] },
            { t: ['ผลตรวจ'], s: ['ผ่าน → คิวส่งเบิก', 'ตีกลับให้แก้', 'ระงับส่ง (BLOCK)'],
              c: PRF.green, bg: PRF.greenBg, ic: PRF.greenInk },
        ],

        detL: {
            t: ['แฟ้มที่กองทุน IP ต้องการ — ต่างจากทุกกองทุน'],
            s: ['บังคับ 9 แฟ้ม — 1 2 3 4 5 6 7 8 และ 14',
                'IP เป็นกองทุนเดียวที่บังคับแฟ้ม 14 และเดียวที่มีแฟ้ม 15 อยู่ในขอบเขต',
                'แฟ้ม 15 (ลากลับบ้าน) บังคับเฉพาะเคสที่มีวันลา'],
            bg: PRF.blueBg, c: PRF.blue, ic: PRF.blueInk,
        },
        detR: {
            t: ['12 องค์ประกอบของ MRA 2563'],
            s: ['บังคับเสมอ 7 — สรุปจำหน่าย 2 ส่วน · ใบยินยอม · ซักประวัติ · ตรวจร่างกาย',
                'บันทึกความก้าวหน้า · บันทึกทางการพยาบาล',
                'ตามลักษณะเคส 5 — ปรึกษาแผนก · ระงับความรู้สึก · ผ่าตัด · คลอด · ฟื้นฟู',
                'ข้อที่ไม่เกี่ยวกับเคส ตัดออกจากตัวหาร ไม่ใช่ให้ 0 คะแนน'],
            bg: PRF.amberBg, c: PRF.amber, ic: PRF.amber,
        },

        sumFill: PRF.faint, sumStroke: PRF.slate, sumInk: PRF.ink,
        sumT: ['คะแนนความพร้อมส่งเบิก /100  =  เวชระเบียน 60%  +  แฟ้ม 20%  +  เงื่อนไขสิทธิ 20%'],
        sumS: ['ป้ายกำกับที่ต้องอ่านคู่กัน: เกณฑ์ย่อยถอดจากคู่มือแล้วเฉพาะองค์ประกอบที่ 1 (9 เกณฑ์) · ค่า DRG / RW / เรตจ่าย ยังเป็นค่าจำลอง จึงไม่นำส่วนต่างมาตัดสินผล'],
    });
}


/* ══════════════════════════════════════════════════════════
   3. ผู้ป่วยนอก — ชุดแฟ้มแปรผันตามกองทุน และยังไม่มีเกณฑ์เวชระเบียน
   ----------------------------------------------------------
   กล่องที่ 1 และ 4 จงใจใช้เส้นประสีเทา = ยังไม่มีของจริง
   แถบล่างเป็นแถบ "ช่องว่าง" ไม่ใช่แถบสรุปความสำเร็จเหมือนผัง IPD
   ══════════════════════════════════════════════════════════ */
function paAuditOpd() {
    return paTrack({
        pfx: 'paO',
        title: 'ผังการไหลของข้อมูลในการตรวจเวชระเบียนผู้ป่วยนอก',

        topFill: PRF.navy, topStroke: PRF.navy, topInk: PRF.onDark,
        topT: ['ผู้ป่วยนอกใช้กองทุนอีก 11 กองทุน — และแต่ละกองทุนบังคับแฟ้มไม่เท่ากัน'],
        topS: ['ชั้นที่ทำงานจึงน้อยกว่าผู้ป่วยใน ไม่ใช่เพราะตรวจหลวมกว่า แต่เพราะข้อมูลที่ต้องตรวจมีคนละชุด'],

        steps: [
            { t: ['รับข้อมูล'], s: ['ยังไม่มีตัวนำเข้า', '16 แฟ้มฝั่ง OPD', 'วันนี้ส่ง JSON เข้า API'],
              c: PRF.line, ic: PRF.slate },
            { t: ['แฟ้มตามกองทุน'], s: ['11 กองทุนที่ไม่ใช่ IP', 'แต่ละกองทุน', 'คนละชุดแฟ้ม'],
              c: PRF.blue, bg: PRF.blueBg, ic: PRF.blueInk, hi: true },
            { t: ['6 ชั้น deterministic'], s: ['ข้าม ADMISSION และ DRG', 'เพราะไม่มีวันรับ–จำหน่าย', 'และไม่เข้ากลุ่ม DRG'] },
            { t: ['ไม่มีเกณฑ์ MRA'], s: ['MRA 2563 เป็นเกณฑ์', 'ของผู้ป่วยในเท่านั้น', 'ฝั่งนี้ยังไม่มีเกณฑ์'],
              c: PRF.line, ic: PRF.slate },
            { t: ['คลังกฎ scope OPD'], s: ['ทำงานบนหน้าจอ', 'รายการเคลม →', 'รายละเอียดเคส'] },
            { t: ['ผลตรวจ'], s: ['ผ่าน → คิวส่งเบิก', 'ตีกลับให้แก้', 'ระงับส่ง (BLOCK)'],
              c: PRF.green, bg: PRF.greenBg, ic: PRF.greenInk },
        ],

        detL: {
            t: ['กองทุนต่างกัน ชุดแฟ้มไม่เท่ากัน'],
            s: ['OP  ผู้ป่วยนอกทั่วไป — บังคับ 1–8 · ตามเงื่อนไข 9 10 11',
                'LTC  ผู้มีภาวะพึ่งพิงในชุมชน — บังคับแค่ 1 2 4 7 8',
                'QOF · REHAB ไม่ใช้แฟ้ม 3   ·   CMHS · TELEMED ไม่ใช้แฟ้ม 6'],
            bg: PRF.blueBg, c: PRF.blue, ic: PRF.blueInk,
        },
        detR: {
            t: ['ฝั่งผู้ป่วยนอกตรวจอะไรแทน MRA'],
            s: ['ความถูกต้องของการวินิจฉัยและหัตถการ — ชั้น DX / PROC',
                'ราคายาเทียบคลังยา และยอดค่าใช้จ่าย — ชั้น DRUG / CHARGE',
                'กฎในคลังกฎที่กำหนดขอบเขตไว้ว่าใช้กับบริการผู้ป่วยนอก',
                'ประเภทบริการมี 3 ค่า: OPD · IPD · PP (สร้างเสริมสุขภาพ)'],
        },

        sumFill: PRF.amberBg, sumStroke: PRF.amber, sumInk: PRF.amber, sumDash: '9 6',
        sumT: ['ช่องว่างที่ยังเหลือฝั่งผู้ป่วยนอก — เขียนไว้ตรงนี้เพื่อไม่ให้เข้าใจว่าทำครบแล้ว'],
        sumS: ['ยังไม่มีตัวนำเข้า 16 แฟ้มฝั่ง OPD (วันนี้รองรับเฉพาะผู้ป่วยใน)   ·   ยังไม่มีหน้าตรวจแฟ้มผู้ป่วยนอกแบบเดียวกับหน้าตรวจแฟ้มผู้ป่วยใน'],
    });
}
