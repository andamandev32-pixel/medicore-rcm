/* ────────────────────────────────────────────────────────
   ผังขั้นตอนของ "แต่ละส่วนงาน" — deck สรุปงานรายโมดูล
   (present-modules.html · present-modules-slides.js)

   ต่างจาก present-flows.js ตรงที่ไฟล์นั้นวาด "กระบวนการธุรกิจ"
   (as-is / to-be / เส้นทาง สปสช.) ส่วนไฟล์นี้วาด "เมนูในระบบ"
   — แต่ละกล่องคือหน้าจอจริงหนึ่งหน้า และลูกศรคือการส่งงานต่อระหว่างหน้า
   ผู้ฟังจึงเทียบผังกับเมนูบน navbar ได้ตรงตัว

   ⚠️ ไฟล์นี้ "ใช้" PRF / prfBox / prfArrow / prfMarkers / prfText / prfSvg
      จาก present-flows.js — ห้ามประกาศซ้ำ (const ชนกันแล้วหน้าขาวทั้งหน้า)
      present-flows.js จึงต้องโหลดก่อนไฟล์นี้เสมอ

   ⚠️ id ของ <marker> อยู่ใน document เดียวกันทั้ง deck — prefix ด้วย pm* ทุกตัว
      และต้องไม่ชนกับ prefix ของ present-flows.js (jr/st/ch/tl/ar/as/tb/rf)

   ⚠️ ภาษาไทยไม่มีช่องว่างระหว่างคำ SVG จึงตัดบรรทัดเองไม่ได้
      ทุก label ส่งเป็นอาร์เรย์ของบรรทัด · เกณฑ์: กว้างกล่อง ÷ (0.55 × font-size)

   ⚠️ ทุกผังในไฟล์นี้เป็นผัง "เต็มสไลด์" จึงเรียก prfSvg() โดย "ไม่ส่ง" อาร์กิวเมนต์ auto
      → ได้คลาส .pr-svg ที่ CSS วางแบบ position:absolute; inset:0 แล้วย่อพอดีกรอบด้วย
        preserveAspectRatio="xMidYMid meet" · ถ้าส่ง true จะได้ .pr-svg-auto (height:auto)
        ซึ่งสูงเกินกรอบ .pr-body (overflow:hidden) แล้วโดนตัดท้ายผังทิ้ง
      ผังแบบแถบเตี้ย ๆ ที่วางคู่กับเนื้อหาอื่นเท่านั้นที่ควรส่ง true

   ⚠️ ไม่วาดหัวเรื่องซ้ำใน SVG — สไลด์มี <h2> ของตัวเองอยู่แล้ว
      (ถ้าวาดจะได้หัวเรื่องซ้อนสองชั้นและกินพื้นที่ผังไปเปล่า ๆ)
   ──────────────────────────────────────────────────────── */


/* ══════════════════════════════════════════════════════════
   ตัวช่วยเฉพาะไฟล์นี้
   ══════════════════════════════════════════════════════════ */

/** แถบคำอธิบายเต็มความกว้าง — ใช้เป็นหัวเรื่องย่อยหรือสรุปท้ายผัง */
function pmBand(o) {
    let g = `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="${o.rx == null ? 12 : o.rx}"` +
        ` fill="${o.fill}" stroke="${o.stroke}" stroke-width="${o.sw || 2.2}"` +
        `${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`;
    if (o.t) g += prfText(o.x + o.w / 2, o.y + (o.s ? o.h * 0.32 : o.h / 2), o.t,
        { fs: o.fs || 21, fill: o.tc, w: 800 });
    if (o.s) g += prfText(o.x + o.w / 2, o.y + o.h * 0.72, o.s,
        { fs: o.sfs || 17, fill: o.sc || o.tc, w: 500, op: .92 });
    return g;
}

/** ป้ายชื่อไฟล์หน้าจอ — วางใต้กล่องเพื่อให้เทียบกับเมนูจริงได้ */
function pmFile(cx, y, name) {
    return prfText(cx, y, [name], { fs: 13, fill: PRF.slate, w: 600, op: .8 });
}

/** ป้ายกำกับบนเส้น (เช่น "ไม่เกินเกณฑ์") พร้อมพื้นหลังบังเส้นไม่ให้ทับตัวอักษร */
function pmEdgeLabel(x, y, text, color, w) {
    const width = w || text.length * 8.6 + 16;
    return `<rect x="${x - width / 2}" y="${y - 13}" width="${width}" height="26" rx="7"` +
        ` fill="${PRF.white}" stroke="${color}" stroke-width="1.6"/>` +
        prfText(x, y, [text], { fs: 14, fill: color, w: 700 });
}


/* ══════════════════════════════════════════════════════════
   1. แผนที่ระบบรวม — 3 เส้นงานที่ไปจบที่คิวส่งเบิกเดียวกัน
   ----------------------------------------------------------
   สาระ: เส้นทึบ = งานไหลไปข้างหน้า · เส้นประ = ตัวเลขถูกอ่านขึ้นไป
   แสดงบนภาพรวมผู้บริหาร ผู้บริหารจึงไม่ต้องเปิดหน้าปฏิบัติงานเอง
   ══════════════════════════════════════════════════════════ */
function pmSystemMap() {
    const W = 1300, H = 556, PAD = 16, GAP = 28, N = 3;
    const BW = (W - PAD * 2 - GAP * (N - 1)) / N;          /* ≈ 404 */
    const MY = 164, MH = 156, MBOT = MY + MH;              /* แถวโมดูล */
    const xs = i => PAD + i * (BW + GAP);
    const cx = i => xs(i) + BW / 2;

    const DASH_X = 166, DASH_W = W - PAD * 2 - 300, DASH_Y = 16, DASH_H = 78;
    const CONV = 348;                                      /* เส้นรวมก่อนลงคิวส่งเบิก */
    const NH_W = 560, NH_X = (W - NH_W) / 2, NH_Y = 370, NH_H = 84;
    const RS_W = 460, RS_X = (W - RS_W) / 2, RS_Y = 480, RS_H = 64;

    const mods = [
        { t: ['Claim Intelligence'], c: PRF.blue, bg: PRF.blueBg, ic: PRF.blueInk,
          s: ['เคลมผู้ป่วยนอก · 8 หน้าจอ',
              'รายการเคลม · รายละเอียดเคส · งานและการอนุมัติ',
              'คลังกฎ · คลังความรู้ · วิเคราะห์การตีกลับ'] },
        { t: ['ผู้ป่วยใน (IPD)'], c: PRF.amber, bg: PRF.amberBg, ic: PRF.amber, star: true,
          s: ['3 หน้าจอ · เพิ่มใหม่รอบนี้',
              'ทะเบียนผู้ป่วยใน · ติดตามระหว่างนอน',
              'ตรวจแฟ้มตามเงื่อนไขของแต่ละกองทุน'] },
        { t: ['ส่งต่อผู้ป่วย'], c: PRF.amber, bg: PRF.amberBg, ic: PRF.amber, star: true,
          s: ['6 หน้าจอ · เพิ่มใหม่รอบนี้',
              'สร้างคำขอ · ทะเบียนการส่งต่อ · รายละเอียด',
              'อนุมัติผู้บริหาร · ตามจ่าย · ภาพรวม'] },
    ];

    let g = prfMarkers([
        { id: 'pmSysFwd', c: PRF.navy },
        { id: 'pmSysRead', c: PRF.slate },
        { id: 'pmSysOk', c: PRF.green },
    ]);

    /* ── ภาพรวมผู้บริหาร (บนสุด — อ่านทุกเส้นงาน) ── */
    g += pmBand({ x: DASH_X, y: DASH_Y, w: DASH_W, h: DASH_H, rx: 13,
        fill: PRF.navy, stroke: PRF.navy, sw: 2.4,
        t: ['ภาพรวมผู้บริหาร — อ่านทุกเส้นงานในหน้าเดียว'],
        s: ['KPI ทุกตัวกดดูสูตรได้ และเจาะลงถึงรายเคส · รวมผลตอบกลับของ สปสช.'],
        fs: 23, sfs: 16, tc: PRF.onDark, sc: PRF.onDark });

    /* ── 3 โมดูล ── */
    mods.forEach((m, i) => {
        g += prfBox({ x: xs(i), y: MY, w: BW, h: MH, rx: 13,
            t: (m.star ? ['★ ' + m.t[0]] : m.t), s: m.s,
            fs: 23, sfs: 15, fill: m.bg, stroke: m.c, sw: m.star ? 3.2 : 2.4, tc: m.ic, sc: m.ic });

        /* เส้นประขึ้นไปหาภาพรวมผู้บริหาร */
        g += prfArrow(`M${cx(i)},${MY - 2} L${cx(i)},${DASH_Y + DASH_H + 3}`,
            PRF.slate, 'pmSysRead', { dash: '7 5', sw: 2.2 });

        /* ข้อศอกลงมารวมกัน — ไม่ใส่หัวลูกศร ไม่งั้นได้ 3 หัวซ้อนจุดเดียว */
        g += `<path d="M${cx(i)},${MBOT} L${cx(i)},${CONV} L${W / 2},${CONV}"
                fill="none" stroke="${PRF.navy}" stroke-width="2.8"
                stroke-linecap="round" stroke-linejoin="round"/>`;
    });

    /* ── คิวส่งเบิก ── */
    g += prfArrow(`M${W / 2},${CONV} L${W / 2},${NH_Y - 3}`, PRF.navy, 'pmSysFwd');
    g += prfBox({ x: NH_X, y: NH_Y, w: NH_W, h: NH_H, rx: 13,
        t: ['ส่งเบิก NHSO'],
        s: ['นำเข้า 15 แฟ้ม · รายการส่งเบิก · รายละเอียดรายการ · รายงาน/Statement'],
        fs: 23, sfs: 15, fill: PRF.white, stroke: PRF.navy, sw: 2.8 });

    g += prfArrow(`M${W / 2},${NH_Y + NH_H} L${W / 2},${RS_Y - 3}`, PRF.green, 'pmSysOk');
    g += prfBox({ x: RS_X, y: RS_Y, w: RS_W, h: RS_H, rx: 12,
        t: ['ได้รับเงินครบ — ผ่านตั้งแต่รอบแรก'],
        fs: 21, fill: PRF.greenBg, stroke: PRF.green, sw: 2.6, tc: PRF.greenInk });

    /* คำอธิบายเส้นอยู่ที่ foot ของสไลด์แล้ว — ไม่วาดซ้ำในผัง */
    return prfSvg(W, H, g, 'แผนที่ระบบ สามเส้นงานที่มาจบที่คิวส่งเบิกเดียวกัน');
}


/* ══════════════════════════════════════════════════════════
   2. ภาพรวมผู้บริหาร — 4 เส้นงานเข้า แล้วเจาะลงได้ถึงรายเคส
   ══════════════════════════════════════════════════════════ */
function pmExecFlow() {
    const W = 1300, H = 505, PAD = 16, GAP = 24, N = 4;
    const BW = (W - PAD * 2 - GAP * (N - 1)) / N;          /* = 299 */
    const SY = 22, SH = 92, SBOT = SY + SH;
    const xs = i => PAD + i * (BW + GAP);
    const cx = i => xs(i) + BW / 2;

    const BAND_Y = 156, BAND_H = 128;
    const TILE_W = 290, TILE_GAP = 22, TILE_H = 68;
    const TILE_X0 = PAD + ((W - PAD * 2) - (TILE_W * 4 + TILE_GAP * 3)) / 2;
    const DY = 340, DH = 96;

    const sources = [
        { t: ['เคลมผู้ป่วยนอก'], s: ['คิวเคลม · ผลกฎ · SLA'], c: PRF.blue, bg: PRF.blueBg, ic: PRF.blueInk },
        { t: ['ผู้ป่วยใน (IPD)'], s: ['วันนอน · แฟ้ม · DRG'], c: PRF.amber, bg: PRF.amberBg, ic: PRF.amber, star: true },
        { t: ['ส่งต่อผู้ป่วย'], s: ['ตามจ่าย · เรียกเก็บ'], c: PRF.amber, bg: PRF.amberBg, ic: PRF.amber, star: true },
        { t: ['สปสช. ตอบกลับ'], s: ['สถานะ · รหัสข้อผิดพลาด'], c: PRF.navy, bg: PRF.faint, ic: PRF.ink },
    ];

    const tiles = [
        { t: ['เคสรอส่งเบิก'], c: PRF.blue },
        { t: ['★ แฟ้ม IPD ไม่ครบ'], c: PRF.amber, star: true },
        { t: ['★ ยอดตามจ่ายค้าง'], c: PRF.amber, star: true },
        { t: ['First-pass Acceptance'], c: PRF.green },
    ];

    const drill = [
        { t: ['กดที่ KPI'], s: ['ทุกตัวกดได้'] },
        { t: ['เห็นสูตรและฟิลด์'], s: ['ที่ใช้คำนวณจริง'] },
        { t: ['เปิดดูรายเคส'], s: ['ตัวเลขตรงกับหน้าปฏิบัติงาน'] },
        { t: ['มอบหมายให้แก้'], s: ['พร้อมผู้รับผิดชอบและ SLA'], hi: true },
    ];

    let g = prfMarkers([{ id: 'pmExeIn', c: PRF.slate }, { id: 'pmExeGo', c: PRF.navy }]);

    sources.forEach((s, i) => {
        g += prfBox({ x: xs(i), y: SY, w: BW, h: SH, rx: 12,
            t: (s.star ? ['★ ' + s.t[0]] : s.t), s: s.s, fs: 21, sfs: 15,
            fill: s.bg, stroke: s.c, sw: s.star ? 3 : 2.2, tc: s.ic, sc: s.ic });
        g += prfArrow(`M${cx(i)},${SBOT} L${cx(i)},${BAND_Y - 3}`, PRF.slate, 'pmExeIn', { dash: '7 5', sw: 2.2 });
    });

    /* ── แถบ dashboard ── */
    g += `<rect x="${PAD}" y="${BAND_Y}" width="${W - PAD * 2}" height="${BAND_H}" rx="13"
            fill="${PRF.navy}" stroke="${PRF.navy}" stroke-width="2.4"/>`;
    g += prfText(W / 2, BAND_Y + 26, ['ภาพรวมผู้บริหาร (claim-dashboard) — KPI 10 ช่อง กดดูที่มาของตัวเลขได้ทุกช่อง'],
        { fs: 20, fill: PRF.onDark, w: 800 });
    tiles.forEach((t, i) => {
        const x = TILE_X0 + i * (TILE_W + TILE_GAP);
        g += prfBox({ x: x, y: BAND_Y + 44, w: TILE_W, h: TILE_H, rx: 10,
            t: t.t, fs: 18, fill: PRF.white, stroke: t.c, sw: t.star ? 3 : 2, tc: t.c });
    });

    /* ── ลูกโซ่การเจาะข้อมูล ── */
    g += prfArrow(`M${W / 2},${BAND_Y + BAND_H} L${W / 2},${DY - 34}`, PRF.navy, 'pmExeGo');
    g += prfText(W / 2, DY - 18, ['กดที่ตัวเลขแล้วเดินต่อได้ทันที'], { fs: 16, fill: PRF.slate, w: 600, op: .9 });

    drill.forEach((d, i) => {
        g += prfBox({ x: xs(i), y: DY, w: BW, h: DH, rx: 12, t: d.t, s: d.s, fs: 20, sfs: 14,
            fill: d.hi ? PRF.greenBg : PRF.white, stroke: d.hi ? PRF.green : PRF.navy,
            sw: d.hi ? 3 : 2.2, tc: d.hi ? PRF.greenInk : PRF.ink });
        if (i < N - 1) g += prfArrow(`M${xs(i) + BW},${DY + DH / 2} L${xs(i + 1) - 3},${DY + DH / 2}`,
            PRF.navy, 'pmExeGo');
    });

    g += prfText(W / 2, H - 12,
        ['ไม่มีตัวเลขไหนบนหน้านี้ที่พิมพ์ค้างไว้ — ทุกช่องคำนวณจากข้อมูลชุดเดียวกับหน้าปฏิบัติงาน กดเข้าไปดูแล้วต้องตรงกันเสมอ'],
        { fs: 16, fill: PRF.slate, w: 500, op: .9 });

    return prfSvg(W, H, g, 'ภาพรวมผู้บริหาร รับสี่เส้นงานแล้วเจาะลงถึงรายเคส');
}


/* ══════════════════════════════════════════════════════════
   3. Claim Intelligence — ลูกโซ่หลัก + วงจรปรับปรุงกฎ
   ----------------------------------------------------------
   สาระ: วงจรล่าง (ตีกลับ → สร้างร่างกฎ → คลังกฎ) คือสิ่งที่ทำให้
   ระบบ "ฉลาดขึ้นเอง" ทุกครั้งที่ถูกตัดจ่าย ไม่ใช่แค่รายงานสถิติ
   ══════════════════════════════════════════════════════════ */
function pmClaimFlow() {
    const W = 1300, H = 512, PAD = 16, GAP = 24, N = 5;
    const BW = (W - PAD * 2 - GAP * (N - 1)) / N;          /* ≈ 234.4 */
    const BY = 96, BH = 110, MID = BY + BH / 2, BOT = BY + BH;
    const xs = i => PAD + i * (BW + GAP);
    const cx = i => xs(i) + BW / 2;

    const KY = 268, KH = 88, KW = 360;
    const RY = 400, RH = 82;

    const steps = [
        { t: ['รายการเคลม'], s: ['คิวก่อนส่ง', 'คอลัมน์ “จะติดที่ NHSO”'], f: 'claim-worklist' },
        { t: ['รายละเอียดเคส'], s: ['ผลกฎ · หลักฐาน · Override'], f: 'claim-case' },
        { t: ['ตรวจด้วยกฎ'], s: ['ชุดเดียวกับที่ สปสช. ใช้'], f: 'ก่อนกดส่ง', hi: true },
        { t: ['งานและการอนุมัติ'], s: ['SLA · Escalation'], f: 'claim-tasks' },
        { t: ['เข้าคิวส่งเบิก'], s: ['ส่งเมื่อพร้อมจริง'], f: 'nhso-submit', ok: true },
    ];

    let g = prfMarkers([
        { id: 'pmClmFwd', c: PRF.navy },
        { id: 'pmClmFeed', c: PRF.blue },
        { id: 'pmClmLoop', c: PRF.amber },
    ]);

    g += prfText(W / 2, 22, ['แต่ละกล่องคือหนึ่งเมนูบน navbar'], { fs: 16, fill: PRF.slate, w: 500, op: .85 });

    steps.forEach((s, i) => {
        const fill = s.hi ? PRF.greenBg : s.ok ? PRF.greenBg : PRF.white;
        const stroke = s.hi || s.ok ? PRF.green : PRF.navy;
        g += prfBox({ x: xs(i), y: BY, w: BW, h: BH, rx: 12, t: s.t, s: s.s, fs: 19, sfs: 13.5,
            fill: fill, stroke: stroke, sw: s.hi ? 3.6 : 2.2,
            tc: s.hi || s.ok ? PRF.greenInk : PRF.ink });
        g += pmFile(cx(i), BOT + 18, s.f);
        if (i < N - 1) g += prfArrow(`M${xs(i) + BW},${MID} L${xs(i + 1) - 3},${MID}`, PRF.navy, 'pmClmFwd');
    });

    /* ── แหล่งความรู้ที่ป้อนขั้น "ตรวจด้วยกฎ" ── */
    const kx1 = xs(1), kx2 = xs(1) + KW + 32;
    const sources = [
        { x: kx1, t: ['คลังกฎ / สร้างกฎ'], s: ['เวอร์ชัน · ทดสอบย้อนหลัง', 'Maker–Checker (BR-05)'], f: 'claim-rules' },
        { x: kx2, t: ['คลังความรู้ (RAG)'], s: ['ตอบพร้อมอ้างอิงประกาศ', 'หลักฐานไม่พอ = ปฏิเสธที่จะเดา'], f: 'claim-knowledge' },
    ];
    sources.forEach(s => {
        g += prfBox({ x: s.x, y: KY, w: KW, h: KH, rx: 12, t: s.t, s: s.s, fs: 19, sfs: 13.5,
            fill: PRF.blueBg, stroke: PRF.blue, sw: 2.4, tc: PRF.blueInk });
        g += pmFile(s.x + KW / 2, KY + KH + 17, s.f);
        g += prfArrow(`M${s.x + KW / 2},${KY - 3} L${s.x + KW / 2},${BOT + 34}`,
            PRF.blue, 'pmClmFeed', { dash: '7 5', sw: 2.4 });
    });

    /* ── วงจรปรับปรุงกฎ: ถูกตัดจ่าย → หาสาเหตุ → ร่างกฎใหม่ → กลับเข้าคลังกฎ ── */
    g += prfBox({ x: kx1, y: RY, w: KW, h: RH, rx: 12,
        t: ['วิเคราะห์การตีกลับ'], s: ['Pareto หาสาเหตุที่ทำเงินหายมากที่สุด', 'แล้วสร้าง “ร่างกฎ” จากสาเหตุนั้น'],
        fs: 19, sfs: 13.5, fill: PRF.amberBg, stroke: PRF.amber, sw: 2.6, tc: PRF.amber });
    g += pmFile(kx1 + KW / 2, RY + RH + 17, 'claim-reject');

    /* ผลตอบกลับจาก สปสช. ไหลลงมาที่การวิเคราะห์ */
    g += prfArrow(`M${cx(4)},${BOT + 30} L${cx(4)},${RY + RH / 2} L${kx1 + KW + 3},${RY + RH / 2}`,
        PRF.amber, 'pmClmLoop', { dash: '7 5' });
    g += pmEdgeLabel(cx(4) - 150, RY + RH / 2, 'รหัสที่ถูกตัดจ่ายกลับมา', PRF.amber);

    /* ร่างกฎกลับขึ้นคลังกฎ */
    g += prfArrow(`M${kx1 + KW / 2},${RY - 3} L${kx1 + KW / 2},${KY + KH + 26}`,
        PRF.amber, 'pmClmLoop', { sw: 3 });

    /* คำอธิบายวงจรสีเหลืองอยู่ที่ foot ของสไลด์แล้ว — ไม่วาดซ้ำในผัง */
    return prfSvg(W, H, g, 'ผังโมดูล Claim Intelligence พร้อมวงจรปรับปรุงกฎ');
}


/* ══════════════════════════════════════════════════════════
   4. ผู้ป่วยใน (IPD) — จับของที่ขาด "ตั้งแต่ผู้ป่วยยังนอนอยู่"
   ----------------------------------------------------------
   สาระ: แถบเหลืองด้านบนคือช่วงเวลาที่โรงพยาบาลยังคุมได้เอง
   เอกสารที่หายไปตอนจำหน่ายแล้ว ตามเก็บทีหลังยากกว่ามาก
   ══════════════════════════════════════════════════════════ */
function pmIpdFlow() {
    const W = 1300, H = 506, PAD = 16, GAP = 22, N = 5;
    const BW = (W - PAD * 2 - GAP * (N - 1)) / N;          /* ≈ 236.8 */
    const BY = 112, BH = 116, MID = BY + BH / 2, BOT = BY + BH;
    const xs = i => PAD + i * (BW + GAP);
    const cx = i => xs(i) + BW / 2;

    const CTL_Y = 26, CTL_H = 58;
    const FIX_Y = 294, FIX_H = 84;
    const SUM_Y = 412, SUM_H = 84;

    const steps = [
        { t: ['ทะเบียนผู้ป่วยใน'], s: ['ทุก AN · วันนอน · DRG', 'ค่าใช้จ่ายจริง vs ประมาณการรับ'], f: 'ipd-worklist' },
        { t: ['ติดตามระหว่างนอน'], s: ['ไทม์ไลน์รายวัน', 'เอกสารที่ยังขาด'], f: 'ipd-admit', hi: true },
        { t: ['จำหน่าย'], s: ['DISCHT · DISCHS', 'เข้าคิวตรวจแฟ้มอัตโนมัติ'], f: 'ปุ่มในหน้าติดตาม' },
        { t: ['ตรวจแฟ้มผู้ป่วยใน'], s: ['6 ด้านในหน้าเดียว', 'คะแนน /100 ตามเงื่อนไขกองทุน'], f: 'ipd-audit', hi: true },
        { t: ['ผ่าน — เข้าคิวส่งเบิก'], s: ['ต่อคิวเดิมของเคลม', 'และ ส่งเบิก NHSO'], f: 'claim-worklist', ok: true },
    ];

    let g = prfMarkers([
        { id: 'pmIpdFwd', c: PRF.navy },
        { id: 'pmIpdBack', c: PRF.red },
        { id: 'pmIpdOk', c: PRF.green },
    ]);

    /* ── แถบ "เวลาที่ยังคุมได้เอง" คลุมขั้นที่ 1–3 ── */
    const ctlX = xs(0), ctlW = xs(2) + BW - xs(0);
    g += pmBand({ x: ctlX, y: CTL_Y, w: ctlW, h: CTL_H, rx: 11,
        fill: PRF.amberBg, stroke: PRF.amber, sw: 2.4, dash: '8 5',
        t: ['ช่วงที่โรงพยาบาลยังคุมได้เอง — ขาดอะไรตอนนี้ยังตามเก็บทัน'],
        fs: 19, tc: PRF.amber });
    g += pmBand({ x: xs(3), y: CTL_Y, w: xs(4) + BW - xs(3), h: CTL_H, rx: 11,
        fill: PRF.faint, stroke: PRF.line, sw: 2,
        t: ['หลังจำหน่าย — ต้นทุนการตามเก็บสูงขึ้นทันที'],
        fs: 19, tc: PRF.slate });

    steps.forEach((s, i) => {
        const fill = s.hi ? PRF.amberBg : s.ok ? PRF.greenBg : PRF.white;
        const stroke = s.hi ? PRF.amber : s.ok ? PRF.green : PRF.navy;
        g += prfBox({ x: xs(i), y: BY, w: BW, h: BH, rx: 12, t: s.t, s: s.s, fs: 19, sfs: 13.5,
            fill: fill, stroke: stroke, sw: s.hi ? 3.4 : 2.2,
            tc: s.hi ? PRF.amber : s.ok ? PRF.greenInk : PRF.ink });
        g += pmFile(cx(i), BOT + 18, s.f);
        if (i < N - 1) g += prfArrow(`M${xs(i) + BW},${MID} L${xs(i + 1) - 3},${MID}`,
            PRF.navy, i === 3 ? 'pmIpdOk' : 'pmIpdFwd');
    });
    g += prfBadge(xs(3) + BW + GAP / 2, MID, '✓', PRF.green, 13, 15);

    /* ── ตีกลับให้แก้ → กลับไปที่หน้าติดตาม ── */
    const fixX = xs(1), fixW = xs(2) + BW - xs(1);
    g += prfArrow(`M${cx(3)},${BOT + 30} L${cx(3)},${FIX_Y + FIX_H / 2} L${fixX + fixW + 3},${FIX_Y + FIX_H / 2}`,
        PRF.red, 'pmIpdBack', { dash: '7 5' });
    g += pmEdgeLabel(cx(3) - 92, FIX_Y + FIX_H / 2, 'ตีกลับให้แก้', PRF.red);
    g += prfBox({ x: fixX, y: FIX_Y, w: fixW, h: FIX_H, rx: 12,
        t: ['สร้างงานให้หน่วยที่รับผิดชอบ'],
        s: ['พร้อม checklist ว่าขาดอะไรบ้าง · ไปโผล่ที่หน้า “งานและการอนุมัติ”'],
        fs: 19, sfs: 13.5, fill: PRF.redBg, stroke: PRF.red, sw: 2.4, tc: PRF.redInk });
    g += prfArrow(`M${fixX + fixW / 2},${FIX_Y - 3} L${fixX + fixW / 2},${BOT + 34}`,
        PRF.red, 'pmIpdBack', { dash: '7 5' });

    /* ── สรุปจุดบอดที่ปิดได้ ── */
    g += pmBand({ x: PAD, y: SUM_Y, w: W - PAD * 2, h: SUM_H, rx: 12,
        fill: PRF.greenBg, stroke: PRF.green, sw: 2.6,
        t: ['จุดบอดที่ปิดได้ 3 อย่าง'],
        s: ['เดิมรู้ว่าแฟ้มไม่ครบตอนจำหน่ายไปแล้ว   ·   เดิมไม่เห็นวันนอนเกินจุดตัด DRG จนกว่าจะปิดงวด   ·   เดิมไม่มีที่ตรวจตามเงื่อนไขรายกองทุน'],
        fs: 21, sfs: 16, tc: PRF.greenInk });

    return prfSvg(W, H, g, 'ผังโมดูลผู้ป่วยใน จับเอกสารที่ขาดตั้งแต่ผู้ป่วยยังนอนอยู่');
}


/* ══════════════════════════════════════════════════════════
   5. ส่งต่อผู้ป่วย — เส้นทางอนุมัติ 2 ชั้นตามวงเงิน
   ----------------------------------------------------------
   สาระ: เลขที่ใบส่งตัวและเลขอนุมัติ "ระบบออกให้หลังอนุมัติเท่านั้น"
   กรอกเองไม่ได้ และผู้ขออนุมัติเองไม่ได้ (BR-05)
   ══════════════════════════════════════════════════════════ */
function pmReferMenuFlow() {
    const W = 1300, H = 570, PAD = 16, GAP = 26, N = 4;
    const BW = 280;
    const X0 = PAD + ((W - PAD * 2) - (BW * N + GAP * (N - 1))) / 2;   /* = 51 */
    const xs = i => X0 + i * (BW + GAP);
    const cx = i => xs(i) + BW / 2;

    const AY = 72, AH = 100, AMID = AY + AH / 2, ABOT = AY + AH;
    const EY = 240, EH = 92;
    const CY = 366, CH = 100, CMID = CY + CH / 2;
    const GY = 508, GH = 50;

    const rowA = [
        { t: ['สร้างคำขอส่งต่อ'], s: ['ดึงข้อมูลจาก HIS 9 หมวด'], f: 'refer-new' },
        { t: ['เจ้าหน้าที่ตรวจทาน'], s: ['Maker — ผู้เสนอ'], f: 'ลงชื่อในคำขอ' },
        { t: ['อนุมัติชั้นเจ้าหน้าที่'], s: ['Checker — คนละคนกับผู้เสนอ'], f: 'claim-tasks' },
        /* ไม่ใส่ f: — ใต้กล่องนี้เป็นทางแยกของเส้น ถ้ามีป้ายจะทับกัน */
        { t: ['วงเงินเกิน', '250,000 บาท?'], s: [], dec: true },
    ];

    const rowC = [
        { t: ['ออกใบส่งตัว + เลขอนุมัติ'], s: ['ระบบออกให้เอง กรอกเองไม่ได้'], f: 'อัตโนมัติหลังอนุมัติ', ok: true },
        { t: ['ทะเบียนการส่งต่อ'], s: ['สองทิศทาง · วันหมดอายุ · ธงเสี่ยง'], f: 'refer-worklist' },
        { t: ['ตามจ่าย / เรียกเก็บ'], s: ['ตรวจใบเรียกเก็บรายบรรทัด'], f: 'refer-billing' },
        { t: ['ภาพรวมการส่งต่อ'], s: ['ไปที่ไหน · เท่าไร · โรคอะไร'], f: 'refer-dashboard' },
    ];

    let g = prfMarkers([
        { id: 'pmRefFwd', c: PRF.navy },
        { id: 'pmRefUp', c: PRF.amber },
        { id: 'pmRefOk', c: PRF.green },
    ]);

    g += prfText(W / 2, 22, ['แต่ละกล่องคือหนึ่งเมนูบน navbar'], { fs: 16, fill: PRF.slate, w: 500, op: .85 });

    rowA.forEach((s, i) => {
        g += prfBox({ x: xs(i), y: AY, w: BW, h: AH, rx: s.dec ? 20 : 12, t: s.t, s: s.s, fs: 20, sfs: 14,
            fill: s.dec ? PRF.amberBg : PRF.white, stroke: s.dec ? PRF.amber : PRF.navy,
            sw: s.dec ? 3.2 : 2.2, tc: s.dec ? PRF.amber : PRF.ink });
        if (s.f) g += pmFile(cx(i), ABOT + 18, s.f);
        if (i < N - 1) g += prfArrow(`M${xs(i) + BW},${AMID} L${xs(i + 1) - 3},${AMID}`, PRF.navy, 'pmRefFwd');
    });

    /* ── ทางแยกใต้กล่องตัดสิน ──
       ⚠️ ห้ามลากเส้นสาขากลับไปทางซ้ายที่ระดับ AMID — มันจะพาดกลางกล่องแถว A
          แล้วบังข้อความข้างใน · ต้องอ้อมลงมาใต้ป้ายชื่อไฟล์ก่อนเสมอ */
    const FORK = ABOT + 42;                                /* ใต้ป้ายชื่อไฟล์ของแถว A */
    g += `<path d="M${cx(3)},${ABOT} L${cx(3)},${FORK}" fill="none"
            stroke="${PRF.amber}" stroke-width="2.8" stroke-linecap="round"/>`;

    /* สาขา "เกินเกณฑ์" → โต๊ะผู้บริหาร (ลงตรง) */
    g += prfArrow(`M${cx(3)},${FORK} L${cx(3)},${EY - 3}`, PRF.amber, 'pmRefUp');
    g += pmEdgeLabel(cx(3) + 104, FORK, 'เกินเกณฑ์', PRF.amber);
    g += prfBox({ x: xs(3), y: EY, w: BW, h: EH, rx: 12,
        t: ['อนุมัติระดับผู้บริหาร'], s: ['เทียบกันทั้งคิว', 'เห็นยอดผูกพันรวมของงวด'],
        fs: 20, sfs: 14, fill: PRF.amberBg, stroke: PRF.amber, sw: 3.2, tc: PRF.amber });
    g += pmFile(cx(3), EY + EH + 17, 'exec-approve');

    /* ทั้งสองสาขาไปจบที่ "ออกใบส่งตัว" เหมือนกัน — เดินเส้นแนวตั้งคนละ x กัน 32px
       ไม่งั้นจะทับกันสนิทจนดูเหมือนมีเส้นเดียว · สาขาผู้บริหารออกทางขอบซ้ายของกล่อง
       (ไม่ใช่ใต้กล่อง) เพื่อไม่ให้เส้นพาดป้าย exec-approve */
    const JOIN_OK = cx(0) - 16, JOIN_EXEC = cx(0) + 16;
    g += prfArrow(`M${xs(3) - 3},${EY + EH / 2} L${JOIN_EXEC},${EY + EH / 2} L${JOIN_EXEC},${CY - 3}`,
        PRF.amber, 'pmRefUp');

    /* สาขา "ไม่เกินเกณฑ์" → อ้อมซ้ายใต้แถว A แล้วลงไปออกใบส่งตัว */
    g += prfArrow(`M${cx(3)},${FORK} L${JOIN_OK},${FORK} L${JOIN_OK},${CY - 3}`,
        PRF.green, 'pmRefOk', { dash: '7 5' });
    g += pmEdgeLabel(cx(1) + 30, FORK, 'ไม่เกินเกณฑ์ — จบที่ชั้นเจ้าหน้าที่', PRF.green);

    rowC.forEach((s, i) => {
        g += prfBox({ x: xs(i), y: CY, w: BW, h: CH, rx: 12, t: s.t, s: s.s, fs: 19, sfs: 13.5,
            fill: s.ok ? PRF.greenBg : PRF.white, stroke: s.ok ? PRF.green : PRF.navy,
            sw: s.ok ? 3 : 2.2, tc: s.ok ? PRF.greenInk : PRF.ink });
        g += pmFile(cx(i), CY + CH + 17, s.f);
        if (i < rowC.length - 1) g += prfArrow(`M${xs(i) + BW},${CMID} L${xs(i + 1) - 3},${CMID}`,
            PRF.navy, 'pmRefFwd');
    });

    /* ── จุดที่ระบบดักได้ ── */
    g += pmBand({ x: PAD, y: GY, w: W - PAD * 2, h: GH, rx: 11,
        fill: PRF.redBg, stroke: PRF.red, sw: 2, dash: '8 5',
        t: ['ระบบดักให้:  ไม่มีเลขอนุมัติ  ·  ใบส่งตัวหมดอายุ  ·  ทำเกินขอบเขต  ·  เรียกเก็บซ้ำซ้อน  ·  ผู้ขออนุมัติของตัวเองไม่ได้ (BR-05)'],
        fs: 18, tc: PRF.redInk });

    return prfSvg(W, H, g, 'ผังโมดูลส่งต่อผู้ป่วย เส้นทางอนุมัติสองชั้นตามวงเงิน');
}


/* ══════════════════════════════════════════════════════════
   6. ส่งเบิก NHSO — จุดที่ระบบเราไปแทรกก่อนถึงมือ สปสช.
   ══════════════════════════════════════════════════════════ */
function pmNhsoFlow() {
    const W = 1300, H = 470, PAD = 16, GAP = 24, N = 5;
    const BW = (W - PAD * 2 - GAP * (N - 1)) / N;          /* ≈ 234.4 */
    const BY = 122, BH = 116, MID = BY + BH / 2, BOT = BY + BH;
    const xs = i => PAD + i * (BW + GAP);
    const cx = i => xs(i) + BW / 2;

    const GATE_Y = 24, GATE_H = 62;
    const LOOP_Y = 326;

    const steps = [
        { t: ['นำเข้าข้อมูล'], s: ['15 แฟ้ม · 160 Data Points', '(72 / 16 / 72)'], f: 'nhso-import' },
        { t: ['รายการส่งเบิก'], s: ['2 ถัง: หน่วยบริการ / สปสช.', 'ยอดเรียกเก็บคู่ยอดชดเชย'], f: 'nhso-submit' },
        { t: ['สปสช. ประมวลผล'], s: ['ตรวจเบื้องต้น + Audit', 'ตอบรหัสกลับ เช่น P124 / C305'], f: 'ฝั่ง สปสช.', ext: true },
        { t: ['รายละเอียดรายการ'], s: ['7 แท็บ · UID · Invoice', 'สถานะปิด Visit'], f: 'nhso-case' },
        { t: ['รายงาน / Statement'], s: ['จ่ายเพิ่ม · เรียกคืน', 'พึงรับ–พึงจ่าย'], f: 'nhso-reports', ok: true },
    ];

    let g = prfMarkers([
        { id: 'pmNsoFwd', c: PRF.navy },
        { id: 'pmNsoErr', c: PRF.red },
        { id: 'pmNsoGate', c: PRF.green },
    ]);

    /* ── ด่านตรวจของเรา คร่อมก่อนขั้น "รายการส่งเบิก" ── */
    const gx = xs(0), gw = xs(1) + BW - xs(0);
    g += pmBand({ x: gx, y: GATE_Y, w: gw, h: GATE_H, rx: 11,
        fill: PRF.greenBg, stroke: PRF.green, sw: 3, dash: '8 5',
        t: ['ด่านตรวจของเราอยู่ตรงนี้ — เคลม · IPD · ส่งต่อ ต้องผ่านก่อนถึงจะมาถึงขั้นนี้'],
        fs: 18, tc: PRF.greenInk });
    g += prfArrow(`M${gx + gw / 2},${GATE_Y + GATE_H} L${gx + gw / 2},${BY - 3}`, PRF.green, 'pmNsoGate');

    steps.forEach((s, i) => {
        const fill = s.ext ? PRF.faint : s.ok ? PRF.greenBg : PRF.white;
        const stroke = s.ext ? PRF.slate : s.ok ? PRF.green : PRF.navy;
        g += prfBox({ x: xs(i), y: BY, w: BW, h: BH, rx: 12, t: s.t, s: s.s, fs: 19, sfs: 13.5,
            fill: fill, stroke: stroke, sw: s.ext ? 2.6 : 2.2,
            tc: s.ext ? PRF.slate : s.ok ? PRF.greenInk : PRF.ink });
        g += pmFile(cx(i), BOT + 18, s.f);
        if (i < N - 1) g += prfArrow(`M${xs(i) + BW},${MID} L${xs(i + 1) - 3},${MID}`, PRF.navy, 'pmNsoFwd');
    });

    /* ── วงจร "รอแก้ไข" ที่เราพยายามทำให้ไม่เกิด ── */
    g += prfArrow(`M${cx(2)},${BOT + 30} L${cx(2)},${LOOP_Y} L${cx(1)},${LOOP_Y} L${cx(1)},${BOT + 34}`,
        PRF.red, 'pmNsoErr', { dash: '7 5' });
    g += pmEdgeLabel((cx(1) + cx(2)) / 2, LOOP_Y, 'รอแก้ไข — วนกลับมาส่งใหม่ทั้งรอบ', PRF.red);

    g += pmBand({ x: PAD, y: 378, w: W - PAD * 2, h: 78, rx: 12,
        fill: PRF.blueBg, stroke: PRF.blue, sw: 2.4,
        t: ['เป้าหมายของทั้งระบบคือทำให้เส้นประสีแดงเส้นนี้ไม่เกิด'],
        s: ['ทุกอย่างที่ สปสช. จะตีกลับ เราตรวจให้จบตั้งแต่ยังอยู่ในโรงพยาบาล — ส่งครั้งเดียวแล้วผ่าน'],
        fs: 21, sfs: 16, tc: PRF.blueInk });

    return prfSvg(W, H, g, 'ผังโมดูลส่งเบิก NHSO และจุดที่ระบบเราไปแทรก');
}


window.pmSystemMap     = pmSystemMap;
window.pmExecFlow      = pmExecFlow;
window.pmClaimFlow     = pmClaimFlow;
window.pmIpdFlow       = pmIpdFlow;
window.pmReferMenuFlow = pmReferMenuFlow;
window.pmNhsoFlow      = pmNhsoFlow;
