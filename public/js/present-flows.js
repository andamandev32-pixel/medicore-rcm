/* ────────────────────────────────────────────────────────
   ผังการทำงานของ deck — วาดด้วย SVG ล้วน

   ทำไมต้องเป็น SVG ไม่ใช่ chip + ลูกศรตัวอักษรแบบเดิม
     · ตัวอักษรใน SVG โตตาม viewBox → เต็มพื้นที่สไลด์เสมอ ไม่ต้องพึ่ง clamp()
       ผังที่เดิมอ่านได้ ~11px บนโปรเจกเตอร์ ตอนนี้ได้ 20–28px
     · ลูกศร "วนกลับ" วาดเป็นเส้นจริงได้ ซึ่งคือสาระของ deck ทั้งชุด
       (chip + → เรียงกันบอกไม่ได้ว่าอะไรย้อนกลับไปที่ไหน)
     · พิมพ์เป็น PDF แล้วคมทุกขนาด

   ⚠️ ภาษาไทยไม่มีช่องว่างระหว่างคำ SVG จึงตัดบรรทัดให้เองไม่ได้
      ทุก label จึงส่งเป็น "อาร์เรย์ของบรรทัด" ที่กำหนดจุดตัดเอง
      ถ้าแก้ข้อความแล้วยาวขึ้น ต้องตัดบรรทัดเพิ่มเอง ไม่งั้นล้นกล่อง
      เกณฑ์คร่าว ๆ: กว้างกล่อง ÷ (0.55 × font-size) = จำนวนอักษรไทยที่ใส่ได้

   ⚠️ id ของ <marker> อยู่ใน document เดียวกันทั้ง 20 สไลด์ — ต้องไม่ซ้ำกัน
      จึง prefix ด้วยชื่อผังทุกตัว
   ──────────────────────────────────────────────────────── */

/* สีของผัง — อ้าง token ชุดเดียวกับ CSS ไม่ hardcode ค่า hex */
const PRF = {
    ink:      'var(--brand-navy)',
    line:     'var(--brand-border-strong)',
    faint:    'var(--brand-bg)',
    white:    '#ffffff',
    blue:     'var(--primary)',
    blueBg:   'var(--primary-bg)',
    blueInk:  'var(--primary-dark)',
    red:      'var(--status-danger)',
    redBg:    'var(--status-danger-soft)',
    redInk:   'var(--status-danger-strong)',
    green:    'var(--status-success)',
    greenBg:  'var(--status-success-soft)',
    greenInk: 'var(--status-success-strong)',
    amber:    'var(--brand-amber-600)',
    amberBg:  'var(--brand-amber-50)',
    navy:     'var(--brand-navy)',
    onDark:   '#ffffff',
    slate:    'var(--brand-navy-500)',
};


/* ══════════════════════════════════════════════════════════
   1. ตัวช่วยระดับล่าง
   ══════════════════════════════════════════════════════════ */

/**
 * ข้อความหลายบรรทัด โดย y คือ "กึ่งกลางแนวตั้งของทั้งบล็อก"
 * ไม่ใช้ dominant-baseline เพราะ engine เก่าบางตัวไม่รองรับตอนพิมพ์
 * จึงชดเชยเส้นฐานเองด้วย +0.34em
 */
function prfText(x, y, lines, o) {
    const fs = o.fs;
    const lh = fs * (o.lh || 1.22);
    const top = y - ((lines.length - 1) * lh) / 2 + fs * 0.34;
    return lines.map((t, i) =>
        `<text x="${x}" y="${(top + i * lh).toFixed(1)}" text-anchor="${o.anchor || 'middle'}"` +
        ` style="font-size:${fs}px;font-weight:${o.w || 800};fill:${o.fill || PRF.ink}` +
        `${o.op ? ';opacity:' + o.op : ''}">${t}</text>`
    ).join('');
}

/** กล่องหนึ่งใบ: t = บรรทัดหลัก, s = บรรทัดรอง */
function prfBox(o) {
    const fs = o.fs || 20, sfs = o.sfs || 15;
    const main = o.t || [], sub = o.s || [];
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const lh = fs * 1.2, slh = sfs * 1.24;
    const hMain = main.length * lh;
    const hSub = sub.length ? sub.length * slh + fs * 0.3 : 0;
    const top = cy - (hMain + hSub) / 2;

    let out = `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="${o.rx == null ? 12 : o.rx}"` +
        ` fill="${o.fill || PRF.white}" stroke="${o.stroke || PRF.line}" stroke-width="${o.sw || 2.2}"/>`;
    if (main.length) {
        out += prfText(cx, top + hMain / 2, main, { fs: fs, fill: o.tc || PRF.ink, w: 800, lh: 1.2 });
    }
    if (sub.length) {
        out += prfText(cx, top + hMain + hSub / 2, sub,
            { fs: sfs, fill: o.sc || o.tc || PRF.ink, w: 500, lh: 1.24, op: o.sop || .78 });
    }
    return out;
}

/** หัวลูกศร — id ต้องไม่ซ้ำทั้ง document */
function prfMarkers(list) {
    return '<defs>' + list.map(m =>
        `<marker id="${m.id}" viewBox="0 0 10 10" refX="8.2" refY="5"` +
        ` markerWidth="${m.w || 4.6}" markerHeight="${m.w || 4.6}" orient="auto-start-reverse">` +
        `<path d="M0,0.6 L10,5 L0,9.4 Z" fill="${m.c}"/></marker>`).join('') + '</defs>';
}

function prfArrow(d, color, markerId, o) {
    o = o || {};
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${o.sw || 2.8}"` +
        ` stroke-linecap="round" stroke-linejoin="round"` +
        `${o.dash ? ` stroke-dasharray="${o.dash}"` : ''} marker-end="url(#${markerId})"/>`;
}

/** ตราวงกลม ✓ / ✕ วางคร่อมเส้น */
function prfBadge(x, y, mark, color, r, fs) {
    r = r || 15; fs = fs || 18;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="${PRF.white}" stroke-width="2.5"/>` +
        prfText(x, y, [mark], { fs: fs, fill: PRF.white, w: 900 });
}

/** ลูกศรเชฟรอน (ใช้กับ pipeline สถานะ) */
function prfChevron(o) {
    const n = o.notch == null ? 22 : o.notch;
    const x = o.x, y = o.y, w = o.w, h = o.h;
    const d = o.first
        ? `M${x},${y} H${x + w - n} L${x + w},${y + h / 2} L${x + w - n},${y + h} H${x} Z`
        : `M${x},${y} H${x + w - n} L${x + w},${y + h / 2} L${x + w - n},${y + h} H${x} L${x + n},${y + h / 2} Z`;
    return `<path d="${d}" fill="${o.fill}" stroke="${o.stroke}" stroke-width="${o.sw || 2.2}"` +
        ` stroke-linejoin="round"/>` +
        prfText(x + w / 2 + (o.first ? -n / 3 : 0), y + h / 2, o.t,
            { fs: o.fs || 21, fill: o.tc || PRF.ink, w: 800, lh: 1.18 });
}

function prfSvg(w, h, inner, title, auto) {
    return `<svg class="${auto ? 'pr-svg-auto' : 'pr-svg'}" viewBox="0 0 ${w} ${h}"` +
        ` preserveAspectRatio="xMidYMid meet" role="img" aria-label="${title}">` +
        `<title>${title}</title>${inner}</svg>`;
}


/* ══════════════════════════════════════════════════════════
   2. สไลด์ 4 — Business Journey
   ----------------------------------------------------------
   สาระของสไลด์นี้คือ "มีวงจรย้อนกลับสองจุด" ซึ่งเวอร์ชัน chip เดิม
   แสดงไม่ได้เลย — ที่นี่จึงวาดเส้นย้อนกลับจริง ทั้งสองเส้นชี้กลับไปที่
   กล่องเดียวกัน (ส่งเบิกผ่าน HIS) ให้เห็นว่ารอบส่งเบิกถูกใช้ซ้ำกี่ครั้ง
   เส้นวงในกับวงนอกจงใจไม่ตัดกัน: วงนอกยกกลับที่ x น้อยกว่าจุดเริ่มวงใน
   ══════════════════════════════════════════════════════════ */
function prfJourney() {
    const W = 1300, H = 420, PAD = 12, GAP = 24, N = 6;
    const BW = (W - PAD * 2 - GAP * (N - 1)) / N;   /* ≈ 192.7 */
    const BY = 70, BH = 126, MID = BY + BH / 2, BOT = BY + BH;
    const xs = i => PAD + i * (BW + GAP);
    const cx = i => xs(i) + BW / 2;

    const groups = [
        { a: 0, b: 1, t: 'ผู้ป่วย – หน่วยบริการ',              c: PRF.navy,  bg: PRF.faint },
        { a: 2, b: 3, t: 'NHSO — รับข้อมูลและตรวจสอบขั้นต้น',   c: PRF.blue,  bg: PRF.blueBg },
        { a: 4, b: 4, t: 'ตรวจสอบก่อนจ่าย',                    c: PRF.green, bg: PRF.greenBg },
        { a: 5, b: 5, t: 'Statement · จ่ายเงิน',                c: PRF.amber, bg: PRF.amberBg },
    ];

    const steps = [
        { t: ['ผู้ป่วยรับบริการ'],   s: ['ตรวจสิทธิ์ · ให้บริการ', 'ปิดสิทธิ์ · เป๋าตัง'], fill: PRF.white,   stroke: PRF.navy },
        { t: ['ส่งเบิกผ่าน HIS'],    s: ['HIS / HIS-FDH'],                              fill: PRF.white,   stroke: PRF.navy, sw: 3.6 },
        { t: ['Pre-Validate'],       s: ['ตรวจสอบขั้นต้น'],                             fill: PRF.blueBg,  stroke: PRF.blue },
        { t: ['ประมวลผล', 'ตามประกาศ'], s: ['เงื่อนไขรายกองทุน'],                        fill: PRF.blueBg,  stroke: PRF.blue },
        { t: ['ตรวจสอบก่อนจ่าย'],    s: ['Audit · Rules 3D'],                           fill: PRF.greenBg, stroke: PRF.green },
        { t: ['โอนเงินเข้าบัญชี'],   s: ['Statement → จ่ายเงิน'],                        fill: PRF.amberBg, stroke: PRF.amber },
    ];

    let g = prfMarkers([
        { id: 'jrFwd', c: PRF.navy },
        { id: 'jrErr', c: PRF.red },
    ]);

    /* แถบหัวกลุ่ม */
    groups.forEach(gr => {
        const x = xs(gr.a), w = xs(gr.b) + BW - x;
        g += `<rect x="${x}" y="6" width="${w}" height="38" rx="9" fill="${gr.bg}" stroke="${gr.c}" stroke-width="1.6"/>`;
        g += prfText(x + w / 2, 25, [gr.t], { fs: 17, fill: gr.c, w: 800 });
    });

    /* เส้นทางหลัก */
    steps.forEach((s, i) => {
        g += prfBox({ x: xs(i), y: BY, w: BW, h: BH, t: s.t, s: s.s, fs: 22, sfs: 16, fill: s.fill, stroke: s.stroke, sw: s.sw });
        if (i < N - 1) g += prfArrow(`M${xs(i) + BW},${MID} L${xs(i + 1) - 3},${MID}`, PRF.navy, 'jrFwd');
    });
    /* ✓ ผ่าน — คร่อมลูกศรที่ออกจากจุดตรวจสองจุด */
    g += prfBadge(xs(2) + BW + GAP / 2, MID, '✓', PRF.green, 13, 15);
    g += prfBadge(xs(4) + BW + GAP / 2, MID, '✓', PRF.green, 13, 15);

    /* วงจรย้อนกลับ — กล่อง "รอแก้ไข" อยู่ใต้จุดที่ตรวจพบ */
    const RY = 252, RH = 78, RW = BW + 20;
    const rework = (i, t, s) => {
        const x = xs(i) - 10;
        return prfBox({ x: x, y: RY, w: RW, h: RH, t: t, s: s, fs: 18, sfs: 14, rx: 11,
                        fill: PRF.redBg, stroke: PRF.red, tc: PRF.redInk, sop: .85 });
    };

    /* ① ไม่ผ่านตรวจสอบขั้นต้น → กลับไปส่งใหม่ (วงใน) */
    g += prfArrow(`M${cx(2)},${BOT + 15} L${cx(2)},${RY - 3}`, PRF.red, 'jrErr', { dash: '7 5' });
    g += rework(2, ['รอแก้ไข'], ['ไม่ผ่านการตรวจสอบขั้นต้น', 'แก้ที่ HIS → ส่งใหม่']);
    g += prfArrow(`M${xs(2) - 10},${RY + RH / 2} L${cx(1)},${RY + RH / 2} L${cx(1)},${BOT + 4}`,
        PRF.red, 'jrErr', { dash: '7 5' });
    g += prfBadge(cx(2), BOT, '✕', PRF.red, 15, 17);

    /* ② ไม่ผ่านตรวจสอบก่อนจ่าย → กลับไปส่งใหม่ (วงนอก ยกกลับที่ x น้อยกว่าวงใน จึงไม่ตัดกัน) */
    const OUT_X = cx(1) - 52, OUT_Y = 398;
    g += prfArrow(`M${cx(4)},${BOT + 15} L${cx(4)},${RY - 3}`, PRF.red, 'jrErr', { dash: '7 5' });
    g += rework(4, ['รอแก้ไข'], ['ขอเอกสารเพิ่มเติม', 'แก้ไข → ส่งใหม่']);
    g += prfArrow(`M${cx(4)},${RY + RH} L${cx(4)},${OUT_Y} L${OUT_X},${OUT_Y} L${OUT_X},${BOT + 4}`,
        PRF.red, 'jrErr', { dash: '7 5' });
    g += prfBadge(cx(4), BOT, '✕', PRF.red, 15, 17);

    return prfSvg(W, H, g, 'เส้นทางของหนึ่งเคสบน NHSO Digital Platform และวงจรย้อนกลับสองจุด');
}


/* ══════════════════════════════════════════════════════════
   3. สไลด์ 5 — สถานะรายการ (pipeline)
   ══════════════════════════════════════════════════════════ */
function prfStatusFlow() {
    const W = 1300, H = 178, PAD = 8, N = 6;
    const STEP = (W - PAD * 2) / N, CW = STEP - 5, CY = 6, CH = 96;

    const st = [
        { t: ['รอส่งเบิก'],                 fill: PRF.navy,    stroke: PRF.navy,  tc: PRF.onDark },
        { t: ['รอประมวลผล'],                fill: PRF.faint,   stroke: PRF.line },
        { t: ['อยู่กระบวนการ', 'Audit'],    fill: PRF.faint,   stroke: PRF.line },
        { t: ['รอแก้ไข'],                   fill: PRF.redBg,   stroke: PRF.red,   tc: PRF.redInk },
        { t: ['รอจ่ายเงิน'],                fill: PRF.faint,   stroke: PRF.line },
        { t: ['ออกรายงาน', 'การจ่ายเงิน'],  fill: PRF.greenBg, stroke: PRF.green, tc: PRF.greenInk },
    ];

    let g = prfMarkers([{ id: 'stErr', c: PRF.red }]);
    st.forEach((s, i) => {
        g += prfChevron({ x: PAD + i * STEP, y: CY, w: CW, h: CH, first: i === 0,
                          fill: s.fill, stroke: s.stroke, tc: s.tc, t: s.t, fs: 21 });
    });

    /* ย้อนกลับ: รอแก้ไข → รอส่งเบิก */
    const from = PAD + 3 * STEP + CW / 2, to = PAD + CW / 2, LY = 150;
    g += prfArrow(`M${from},${CY + CH} L${from},${LY} L${to},${LY} L${to},${CY + CH + 4}`,
        PRF.red, 'stErr', { dash: '7 5' });
    const mid = (from + to) / 2;
    g += `<rect x="${mid - 222}" y="${LY - 19}" width="444" height="38" rx="9" fill="${PRF.redBg}" stroke="${PRF.red}" stroke-width="1.6"/>`;
    g += prfText(mid, LY, ['ไม่ผ่าน → หน่วยบริการแก้ที่ HIS → ส่งเข้ามาใหม่'], { fs: 17, fill: PRF.redInk, w: 800 });

    return prfSvg(W, H, g, 'สถานะรายการ 6 ขั้นบน NHSO Digital Platform และเส้นทางย้อนกลับเมื่อไม่ผ่าน', true);
}


/* ══════════════════════════════════════════════════════════
   4. สไลด์ 7 — โซ่ข้อมูลที่ทำให้เกิด P124
   ══════════════════════════════════════════════════════════ */
function prfChain() {
    const W = 1300, H = 74, PAD = 8, GAP = 30, N = 5;
    const BW = (W - PAD * 2 - GAP * (N - 1)) / N, BY = 8, BH = 58;
    const items = [
        { t: ['แฟ้ม 7'] }, { t: ['Seq'] }, { t: ['BILLGRCS'] }, { t: ['STDCODE'] },
        { t: ['ราคาใน Drug Catalogue'], hi: true },
    ];

    let g = prfMarkers([{ id: 'chFwd', c: PRF.navy }]);
    items.forEach((it, i) => {
        const x = PAD + i * (BW + GAP);
        g += prfBox({ x: x, y: BY, w: BW, h: BH, t: it.t, fs: 19, rx: 10,
                      fill: it.hi ? PRF.redBg : PRF.faint,
                      stroke: it.hi ? PRF.red : PRF.line,
                      tc: it.hi ? PRF.redInk : PRF.ink });
        if (i < N - 1) g += prfArrow(`M${x + BW},${BY + BH / 2} L${x + BW + GAP - 3},${BY + BH / 2}`, PRF.navy, 'chFwd', { sw: 2.4 });
    });

    return prfSvg(W, H, g, 'โซ่ข้อมูลที่ต้องไล่ให้ถูกทุกครั้งก่อนส่งเบิก', true);
}


/* ══════════════════════════════════════════════════════════
   5. สไลด์ 8 — สองวงจร (หัวใจของ deck)
   ----------------------------------------------------------
   เดิมเป็น SVG สองชิ้นในการ์ดคนละใบ → คนละ scale และตัวอักษรเหลือ ~14px
   ตอนนี้รวมเป็น SVG ชิ้นเดียวเต็มความกว้าง: scale เดียวกันทั้งสองฝั่ง
   เทียบจำนวนขั้นได้ตรง ๆ และตัวอักษรโตขึ้นเท่าตัว
   ══════════════════════════════════════════════════════════ */
function prfTwoLoops() {
    const W = 1300, H = 516, PW = 636, RX = 664;
    const SX = 92, SW = 524, SY = 72, BH = 52, SG = 14;
    const yAt = i => SY + i * (BH + SG);

    const oldSteps = [
        { t: ['ส่งเบิกจาก HIS'],          s: ['ยังไม่รู้ว่ามีปัญหา'] },
        { t: ['สปสช. ตรวจสอบขั้นต้น'],    s: ['F001 → F002'] },
        { t: ['ตีกลับ P124 / C305'],      s: ['ไม่ผ่านการตรวจสอบขั้นต้น'], hi: true },
        { t: ['หาว่าใครต้องแก้'],         s: ['ไล่ถามข้ามหน่วยงาน'] },
        { t: ['แก้ไขที่ HIS'],            s: ['แก้ราคา · เลขปิดสิทธิ'] },
        { t: ['ส่งใหม่ — รออีกรอบ'],      s: ['เงินเลื่อนออกไปอีกงวด'], hi: true },
    ];
    const newSteps = [
        { t: ['รับข้อมูลจาก HIS'],        s: ['ไม่แก้ข้อมูลต้นทาง (BR-08)'] },
        { t: ['รันกฎชุดเดียวกันก่อนส่ง'], s: ['พบ P124 ตั้งแต่ยังไม่ส่ง'], hi: true },
        { t: ['ติดป้ายให้ครบ 3 อย่าง'],   s: ['ประกาศอ้างอิง · เจ้าของงาน · SLA'] },
        { t: ['แก้ให้จบก่อนกดส่ง'],       s: ['มีหลักฐานทุกขั้น'] },
        { t: ['ส่งครั้งเดียวผ่าน'],       s: ['First-pass Acceptance สูงขึ้น'], hi: true },
    ];

    let g = prfMarkers([
        { id: 'tlOld', c: PRF.red },
        { id: 'tlNew', c: PRF.green },
    ]);

    const column = (ox, steps, o) => {
        let s = `<rect x="${ox}" y="0" width="${PW}" height="${H}" rx="16" fill="${o.bg}" stroke="${o.c}" stroke-width="2.6"/>`;
        s += prfText(ox + PW / 2, 36, [o.title], { fs: 25, fill: o.ink, w: 800 });
        steps.forEach((st, i) => {
            const y = yAt(i);
            s += prfBox({ x: ox + SX, y: y, w: SW, h: BH, t: st.t, s: st.s, fs: 19, sfs: 14, rx: 10,
                          fill: st.hi ? o.c : PRF.white,
                          stroke: st.hi ? o.c : PRF.line,
                          tc: st.hi ? PRF.onDark : PRF.ink,
                          sop: st.hi ? .92 : .78 });
            if (i < steps.length - 1) {
                s += prfArrow(`M${ox + SX + SW / 2},${y + BH} L${ox + SX + SW / 2},${y + BH + SG - 1}`,
                    o.c, o.marker, { sw: 2.6 });
            }
        });
        s += prfText(ox + PW / 2, 480, [o.total], { fs: 25, fill: o.ink, w: 800 });
        return s;
    };

    g += column(0, oldSteps, {
        bg: PRF.redBg, c: PRF.red, ink: PRF.redInk, marker: 'tlOld',
        title: 'วันนี้ — ตรวจ “หลัง” ส่ง', total: 'รวม ~14 วัน · ส่ง 2 รอบ',
    });
    g += column(RX, newSteps, {
        bg: PRF.greenBg, c: PRF.green, ink: PRF.greenInk, marker: 'tlNew',
        title: 'ข้อเสนอ — ตรวจ “ก่อน” ส่ง', total: 'รวม ~4 ชั่วโมง · ส่งรอบเดียว',
    });

    /* ลูกศรวนกลับ มีเฉพาะวงจรเดิม — จากขั้นสุดท้ายกลับไปขั้นที่ 2 */
    const yFrom = yAt(5) + BH / 2, yTo = yAt(1) + BH / 2, LX = 42;
    g += prfArrow(`M${SX},${yFrom} L${LX},${yFrom} L${LX},${yTo} L${SX - 4},${yTo}`,
        PRF.red, 'tlOld', { dash: '7 5', sw: 3 });
    g += `<text x="26" y="${(yFrom + yTo) / 2}" text-anchor="middle" transform="rotate(-90 26 ${(yFrom + yTo) / 2})"` +
        ` style="font-size:18px;font-weight:800;fill:${PRF.redInk}">วนอีกรอบ</text>`;

    return prfSvg(W, H, g, 'เปรียบเทียบวงจรตรวจหลังส่งกับวงจรตรวจก่อนส่ง');
}


/* ══════════════════════════════════════════════════════════
   6. สไลด์ 10 — สถาปัตยกรรมเชิงหน้าที่
   ══════════════════════════════════════════════════════════ */
function prfArchitecture() {
    /* MID = แกนกลางแนวนอนของทั้งผัง — คอลัมน์และหอควบคุมต่างสูงกัน จึงยึดแกนนี้ร่วมกัน
       ให้ลูกศรเส้นทางหลักเป็นเส้นตรงเส้นเดียวตลอด */
    const W = 1300, H = 500, MID = 185;
    const CY = 52, CH = 266;
    const TX = 508, TW = 520, TY = 20, TH = 330;

    const col = (x, w, title, lines, c, bg) => {
        let s = `<rect x="${x}" y="${CY}" width="${w}" height="${CH}" rx="13" fill="${bg}" stroke="${c}" stroke-width="2.4"/>`;
        s += prfText(x + w / 2, CY + 40, [title], { fs: 22, fill: c, w: 800 });
        s += prfText(x + w / 2, CY + CH / 2 + 30, lines, { fs: 17, fill: PRF.ink, w: 500, lh: 1.7, op: .82 });
        return s;
    };

    const tile = (x, y, w, h, title, sub) =>
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.36)" stroke-width="1.8"/>` +
        prfText(x + w / 2, y + 34, [title], { fs: 19, fill: PRF.onDark, w: 800 }) +
        prfText(x + w / 2, y + h - 34, sub, { fs: 15, fill: '#cbd5e1', w: 500, lh: 1.34 });

    let g = prfMarkers([
        { id: 'arFwd', c: PRF.navy },
        { id: 'arBack', c: PRF.red },
    ]);

    g += col(14, 200, 'ระบบต้นทาง',
        ['HIS', 'ไฟล์ Claim', 'เอกสารประกอบ', 'ผลตอบกลับ สปสช.'], PRF.navy, PRF.faint);
    g += col(254, 214, 'รับและรวมข้อมูล',
        ['API · Database View', 'ไฟล์มาตรฐาน / CSV', 'Mapping + Import Log'], PRF.blue, PRF.blueBg);
    g += col(1068, 218, 'ส่งเบิก NHSO',
        ['NHSO Digital Platform', 'Standard Dataset 15 แฟ้ม', 'Statement และการจ่าย'], PRF.amber, PRF.amberBg);

    /* หอควบคุม */
    g += `<rect x="${TX}" y="${TY}" width="${TW}" height="${TH}" rx="15" fill="${PRF.navy}" stroke="${PRF.navy}" stroke-width="2.4"/>`;
    g += prfText(TX + TW / 2, TY + 38, ['Claim Control Tower'], { fs: 26, fill: PRF.onDark, w: 800 });
    const tw = 232, th = 118, t0 = TX + 16, t1 = TX + 16 + tw + 24;
    g += tile(t0, TY + 70, tw, th, 'Rule Engine', ['ตรวจเงื่อนไขที่แน่นอน', 'ตามกองทุนและวันมีผล']);
    g += tile(t1, TY + 70, tw, th, 'RAG Knowledge', ['ค้นหลักเกณฑ์', 'พร้อมแหล่งอ้างอิง']);
    g += tile(t0, TY + 208, tw, th, 'Workflow / Task', ['Owner · SLA', 'Approval · Override']);
    g += tile(t1, TY + 208, tw, th, 'Audit &amp; Dashboard', ['Version · หลักฐาน', 'ตัวชี้วัด']);

    /* เส้นทางหลัก */
    g += prfArrow(`M214,${MID} L251,${MID}`, PRF.navy, 'arFwd');
    g += prfArrow(`M468,${MID} L${TX - 3},${MID}`, PRF.navy, 'arFwd');
    g += prfArrow(`M${TX + TW},${MID} L1065,${MID}`, PRF.navy, 'arFwd');

    /* วงจรย้อนกลับ — ผลจ่าย/Reject กลับเข้าหอควบคุมเป็นร่างกฎใหม่
       ⚠️ กล่องจบที่ x=1130 ส่วนเส้นลงมาที่ x=1177 จึงไม่ทับกัน */
    const FB_Y = 445, FBX = 700, FBW = 430, FBH = 78;
    g += prfArrow(`M1177,${CY + CH} L1177,${FB_Y} L${FBX + FBW + 4},${FB_Y}`, PRF.red, 'arBack', { dash: '7 5' });
    g += prfBox({ x: FBX, y: FB_Y - FBH / 2, w: FBW, h: FBH, rx: 11, fs: 19, sfs: 16,
                  t: ['ผลจ่าย · Reject · อุทธรณ์'], s: ['จัดหมวดสาเหตุ → เสนอร่างกฎใหม่'],
                  fill: PRF.redBg, stroke: PRF.red, tc: PRF.redInk, sop: .88 });
    g += prfArrow(`M${FBX},${FB_Y} L640,${FB_Y} L640,${TY + TH + 4}`, PRF.red, 'arBack', { dash: '7 5' });

    return prfSvg(W, H, g, 'สถาปัตยกรรมเชิงหน้าที่ และวงจรนำผลตีกลับมาเป็นกฎใหม่');
}


/* ══════════════════════════════════════════════════════════
   7. สไลด์ 16 — วงจรชีวิตของกฎ
   ══════════════════════════════════════════════════════════ */
function prfLifecycle() {
    const W = 780, H = 72, PAD = 6, N = 5;
    const STEP = (W - PAD * 2) / N, CW = STEP - 4, CY = 6, CH = 58;
    const st = [
        { t: ['ร่าง'] }, { t: ['รอทบทวน'] }, { t: ['อนุมัติแล้ว'] },
        { t: ['เปิดใช้'], on: true }, { t: ['ยกเลิกใช้'] },
    ];

    let g = '';
    st.forEach((s, i) => {
        g += prfChevron({ x: PAD + i * STEP, y: CY, w: CW, h: CH, first: i === 0, notch: 17, fs: 17,
                          fill: s.on ? PRF.green : PRF.faint,
                          stroke: s.on ? PRF.green : PRF.line,
                          tc: s.on ? PRF.onDark : PRF.ink, t: s.t });
    });
    return prfSvg(W, H, g, 'วงจรชีวิตของกฎ ตั้งแต่ร่างจนยกเลิกใช้', true);
}


/* ══════════════════════════════════════════════════════════
   7. ผังสำหรับ deck ผู้บริหาร 10 หน้า (present-exec.html)
      ⚠️ present.html เดิม 20 สไลด์ไม่ได้เรียกฟังก์ชันชุดนี้ — เพิ่มเข้ามาเฉย ๆ
   ══════════════════════════════════════════════════════════ */

/* ── 7.1 ของเดิม: 2 วงจรย้อนกลับ + จุดบอดการส่งต่อที่ไม่มีใครเห็น ── */
function prfAsIs() {
    const W = 1300, H = 470, PAD = 14, GAP = 26, N = 5;
    const BW = (W - PAD * 2 - GAP * (N - 1)) / N;
    const BY = 76, BH = 112, MID = BY + BH / 2, BOT = BY + BH;
    const xs = i => PAD + i * (BW + GAP);
    const cx = i => xs(i) + BW / 2;

    const steps = [
        { t: ['ผู้ป่วยรับบริการ'],  s: ['ตรวจสิทธิ์ · ให้บริการ'] },
        { t: ['คีย์ข้อมูลใน HIS'],  s: ['ไม่มีใครตรวจก่อน'] },
        { t: ['ส่งเบิก สปสช.'],     s: ['ส่งไปแล้วค่อยรู้ผล'], sw: 3.6 },
        { t: ['สปสช. ตรวจ'],        s: ['P124 · L205 · C305'] },
        { t: ['ได้เงิน (บางส่วน)'], s: ['ถูกตัดจ่าย · วนแก้'] },
    ];

    let g = prfMarkers([{ id: 'asFwd', c: PRF.navy }, { id: 'asErr', c: PRF.red }]);

    g += prfText(W / 2, 26, ['ของเดิม — รู้ว่าผิดก็ต่อเมื่อถูกตีกลับมาแล้ว'],
        { fs: 24, fill: PRF.redInk, w: 800 });

    steps.forEach((s, i) => {
        g += prfBox({ x: xs(i), y: BY, w: BW, h: BH, t: s.t, s: s.s, fs: 21, sfs: 15,
                      fill: PRF.white, stroke: i >= 3 ? PRF.red : PRF.navy, sw: s.sw });
        if (i < N - 1) g += prfArrow(`M${xs(i) + BW},${MID} L${xs(i + 1) - 3},${MID}`, PRF.navy, 'asFwd');
    });
    g += prfBadge(cx(3), BOT, '✕', PRF.red, 15, 17);

    /* วงจรย้อนกลับ — แก้ที่ HIS แล้วส่งใหม่ วนได้หลายรอบ */
    const RY = 236, RH = 74;
    g += prfArrow(`M${cx(3)},${BOT + 16} L${cx(3)},${RY - 3}`, PRF.red, 'asErr', { dash: '7 5' });
    g += prfBox({ x: xs(3) - 10, y: RY, w: BW + 20, h: RH, rx: 11,
                  t: ['แก้ที่ HIS แล้วส่งใหม่'], s: ['เฉลี่ย 14 วันต่อรอบ'],
                  fs: 19, sfs: 14, fill: PRF.redBg, stroke: PRF.red, tc: PRF.redInk });
    g += prfArrow(`M${xs(3) - 10},${RY + RH / 2} L${cx(2)},${RY + RH / 2} L${cx(2)},${BOT + 4}`,
        PRF.red, 'asErr', { dash: '7 5' });

    /* ⭐ จุดบอด — การส่งต่อไม่มีอยู่ในสายงานนี้เลย */
    const GY = 350, GH = 96;
    g += `<rect x="${PAD}" y="${GY}" width="${W - PAD * 2}" height="${GH}" rx="12"
            fill="${PRF.redBg}" stroke="${PRF.red}" stroke-width="2.6" stroke-dasharray="10 6"/>`;
    g += prfText(W / 2, GY + 30, ['จุดบอดที่ไม่ปรากฏบนหน้าจอไหนเลย — การส่งผู้ป่วยไปรักษาข้างนอก'],
        { fs: 22, fill: PRF.redInk, w: 800 });
    g += prfText(W / 2, GY + 66,
        ['ใบส่งตัวอยู่ในแฟ้มกระดาษ · ไม่มีที่บันทึกการขออนุมัติ · ไม่รู้ยอดที่ต้องตามจ่ายจนใบเรียกเก็บมาถึง'],
        { fs: 18, fill: PRF.redInk, w: 500, op: .9 });

    return prfSvg(W, H, g, 'กระบวนการเดิม มีวงจรย้อนกลับและมีจุดบอดเรื่องการส่งต่อผู้ป่วย', true);
}

/* ── 7.2 ของใหม่: ด่านตรวจก่อนส่ง + โมดูลส่งต่อที่เพิ่มเข้ามา ── */
function prfToBe() {
    const W = 1300, H = 470, PAD = 14, GAP = 26, N = 5;
    const BW = (W - PAD * 2 - GAP * (N - 1)) / N;
    const BY = 76, BH = 112, MID = BY + BH / 2, BOT = BY + BH;
    const xs = i => PAD + i * (BW + GAP);
    const cx = i => xs(i) + BW / 2;

    const steps = [
        { t: ['ผู้ป่วยรับบริการ'],   s: ['ตรวจสิทธิ์ · ให้บริการ'] },
        { t: ['คีย์ข้อมูลใน HIS'],   s: ['ระบบอ่านข้างเคียง'] },
        { t: ['ตรวจก่อนส่ง'],        s: ['กฎชุดเดียวกับ สปสช.'], sw: 3.6, hi: true },
        { t: ['ส่งเบิก สปสช.'],      s: ['ส่งเมื่อพร้อมจริง'] },
        { t: ['ได้เงินเต็ม'],        s: ['ผ่านรอบเดียว'] },
    ];

    let g = prfMarkers([{ id: 'tbFwd', c: PRF.navy }, { id: 'tbFix', c: PRF.amber }]);

    g += prfText(W / 2, 26, ['ของใหม่ — ดักไว้ก่อนส่ง และเห็นภาระผูกพันตั้งแต่ยังไม่เกิดหนี้'],
        { fs: 24, fill: PRF.greenInk, w: 800 });

    steps.forEach((s, i) => {
        g += prfBox({ x: xs(i), y: BY, w: BW, h: BH, t: s.t, s: s.s, fs: 21, sfs: 15,
                      fill: s.hi ? PRF.greenBg : PRF.white,
                      stroke: s.hi ? PRF.green : PRF.navy, sw: s.sw });
        if (i < N - 1) g += prfArrow(`M${xs(i) + BW},${MID} L${xs(i + 1) - 3},${MID}`, PRF.navy, 'tbFwd');
    });
    g += prfBadge(xs(2) + BW + GAP / 2, MID, '✓', PRF.green, 14, 16);
    g += prfBadge(xs(3) + BW + GAP / 2, MID, '✓', PRF.green, 14, 16);

    /* วงจรแก้ที่สั้นลง — วนอยู่ในโรงพยาบาล ไม่ต้องไปกลับกับ สปสช. */
    const RY = 236, RH = 74;
    g += prfArrow(`M${cx(2)},${BOT + 16} L${cx(2)},${RY - 3}`, PRF.amber, 'tbFix', { dash: '7 5' });
    g += prfBox({ x: xs(2) - 10, y: RY, w: BW + 20, h: RH, rx: 11,
                  t: ['แก้ให้จบในโรงพยาบาล'], s: ['เฉลี่ย 4 ชั่วโมง'],
                  fs: 19, sfs: 14, fill: PRF.amberBg, stroke: PRF.amber });
    g += prfArrow(`M${xs(2) - 10},${RY + RH / 2} L${cx(1)},${RY + RH / 2} L${cx(1)},${BOT + 4}`,
        PRF.amber, 'tbFix', { dash: '7 5' });

    /* ⭐ โมดูลใหม่ */
    const GY = 350, GH = 96;
    g += `<rect x="${PAD}" y="${GY}" width="${W - PAD * 2}" height="${GH}" rx="12"
            fill="${PRF.greenBg}" stroke="${PRF.green}" stroke-width="2.6"/>`;
    g += prfText(W / 2, GY + 30, ['เพิ่มใหม่ — โมดูลส่งต่อผู้ป่วย 4 หน้าจอ'],
        { fs: 22, fill: PRF.greenInk, w: 800 });
    g += prfText(W / 2, GY + 66,
        ['ทะเบียนการส่งต่อ · ขออนุมัติแบบ Maker–Checker · ตามจ่าย/เรียกเก็บรายบรรทัด · ภาพรวมผู้บริหาร'],
        { fs: 18, fill: PRF.greenInk, w: 500, op: .92 });

    return prfSvg(W, H, g, 'กระบวนการใหม่ ตรวจก่อนส่งและมีโมดูลส่งต่อผู้ป่วย', true);
}

/* ── 7.3 workflow ส่งต่อผู้ป่วย 2 ทิศทาง + จุดที่ระบบดักได้ ── */
function prfReferFlow() {
    const W = 1300, H = 520, PAD = 14, GAP = 20, N = 5;
    const LW = 176;                                   /* ป้ายชื่อเลนด้านซ้าย */
    const BW = (W - PAD * 2 - LW - GAP * N) / N;
    const H1 = 96, H2 = 300, BH = 108;
    const xs = i => PAD + LW + GAP + i * (BW + GAP);
    const cx = i => xs(i) + BW / 2;

    const lanes = [
        { y: H1, title: ['ส่งต่อออก', 'เราตามจ่าย'], c: PRF.amber, bg: PRF.amberBg,
          steps: [
            { t: ['บันทึกคำขอ', 'ส่งต่อ'],   s: ['เหตุผล · Dx · ปลายทาง'] },
            { t: ['ขออนุมัติ'],              s: ['วงเงิน · Maker–Checker'], hi: true },
            { t: ['ออกใบส่งตัว'],            s: ['เลขอนุมัติ · ขอบเขต · อายุ'], hi: true },
            { t: ['ปลายทาง', 'เรียกเก็บ'],   s: ['ใบแจ้งหนี้เข้ามา'] },
            { t: ['ตรวจแล้วตามจ่าย'],        s: ['โต้แย้งเฉพาะส่วนเกิน'], hi: true },
          ] },
        { y: H2, title: ['รับส่งต่อเข้า', 'เราเรียกเก็บ'], c: PRF.blue, bg: PRF.blueBg,
          steps: [
            { t: ['รับผู้ป่วย'],             s: ['พร้อมใบส่งตัวต้นทาง'] },
            { t: ['ตรวจใบส่งตัว'],           s: ['เลขอนุมัติ · ขอบเขต · อายุ'], hi: true },
            { t: ['ให้บริการ'],              s: ['บันทึกหัตถการจริง'] },
            { t: ['เลือกช่องทาง', 'เรียกเก็บ'], s: ['ต้นทาง หรือ สปสช.'], hi: true },
            { t: ['รับชำระ'],                s: ['ติดตามอายุหนี้'] },
          ] },
    ];

    let g = prfMarkers([{ id: 'rfA', c: PRF.amber }, { id: 'rfB', c: PRF.blue }]);

    lanes.forEach((ln, li) => {
        g += `<rect x="${PAD}" y="${ln.y}" width="${LW}" height="${BH}" rx="12"
                fill="${ln.bg}" stroke="${ln.c}" stroke-width="2.2"/>`;
        g += prfText(PAD + LW / 2, ln.y + BH / 2, ln.title, { fs: 21, fill: ln.c, w: 800, lh: 1.25 });

        ln.steps.forEach((s, i) => {
            g += prfBox({ x: xs(i), y: ln.y, w: BW, h: BH, t: s.t, s: s.s, fs: 18, sfs: 13,
                          fill: s.hi ? ln.bg : PRF.white, stroke: ln.c, sw: s.hi ? 3 : 2.2 });
            if (i < N - 1) g += prfArrow(`M${xs(i) + BW},${ln.y + BH / 2} L${xs(i + 1) - 3},${ln.y + BH / 2}`,
                ln.c, li === 0 ? 'rfA' : 'rfB');
        });
    });

    /* หมุดจุดที่ระบบดักได้ — วางไว้ระหว่างสองเลน */
    const CY = 232;
    const guards = [
        { i: 1, t: 'ไม่มีเลขอนุมัติ' },
        { i: 2, t: 'ใบส่งตัวหมดอายุ' },
        { i: 3, t: 'ทำเกินขอบเขต' },
        { i: 4, t: 'เรียกเก็บซ้ำซ้อน' },
    ];
    g += `<rect x="${PAD}" y="${CY - 24}" width="${W - PAD * 2}" height="48" rx="10"
            fill="${PRF.redBg}" stroke="${PRF.red}" stroke-width="2" stroke-dasharray="8 5"/>`;
    g += prfText(PAD + LW / 2, CY, ['ระบบดักได้ที่นี่'], { fs: 17, fill: PRF.redInk, w: 800 });
    guards.forEach(gd => {
        g += prfText(cx(gd.i), CY, [gd.t], { fs: 16, fill: PRF.redInk, w: 700 });
    });

    g += prfText(W / 2, 34, ['ขั้นตอนการส่งต่อผู้ป่วยไปรักษาภายนอก — 2 ทิศทาง คนละผลทางการเงิน'],
        { fs: 23, fill: PRF.ink, w: 800 });
    g += prfText(W / 2, H - 22,
        ['ทุกจุดที่ไฮไลต์คือขั้นตอนที่เดิมไม่มีระบบรองรับ — ทำบนกระดาษหรือไม่ได้ทำเลย'],
        { fs: 16, fill: PRF.slate, w: 500, op: .9 });

    return prfSvg(W, H, g, 'ผังการส่งต่อผู้ป่วยสองทิศทางพร้อมจุดที่ระบบตรวจจับ', true);
}

/* ── 7.4 แผนพัฒนา 6 เดือน แบบแถบเวลา ── */
function prfRoadmap6M() {
    const W = 1300, H = 450, PAD = 14;
    const LW = 250, TOP = 84, ROW = 52, BARH = 34;
    const track = W - PAD * 2 - LW - 20;
    const colW = track / 6;
    const x0 = PAD + LW + 20;

    const months = ['ก.ย. 69', 'ต.ค. 69', 'พ.ย. 69', 'ธ.ค. 69', 'ม.ค. 70', 'ก.พ. 70'];
    const rows = [
        { t: 'Discovery & Data Mapping',   a: 0, b: 1, c: PRF.slate },
        { t: 'Foundation + Rule Engine',   a: 1, b: 2, c: PRF.blue },
        { t: 'โมดูลส่งต่อผู้ป่วย',          a: 2, b: 3, c: PRF.amber, star: true },
        { t: 'Workflow · อนุมัติ · RAG',    a: 3, b: 4, c: PRF.blue },
        { t: 'เชื่อม NHSO · Dashboard · UAT 1', a: 4, b: 5, c: PRF.green },
        { t: 'UAT 2 · Go-live · ส่งมอบ',    a: 5, b: 6, c: PRF.green },
    ];

    let g = '';
    g += prfText(W / 2, 30, ['แผนพัฒนา 6 เดือน — อ้างอิงงานพัฒนาของเราเป็นหลัก'],
        { fs: 24, fill: PRF.ink, w: 800 });

    /* หัวคอลัมน์เดือน + เส้นแบ่ง */
    months.forEach((m, i) => {
        g += `<rect x="${x0 + i * colW}" y="${TOP - 34}" width="${colW - 4}" height="26" rx="6"
                fill="${PRF.faint}" stroke="${PRF.line}" stroke-width="1.4"/>`;
        g += prfText(x0 + i * colW + (colW - 4) / 2, TOP - 21, [m], { fs: 15, fill: PRF.ink, w: 700 });
        g += `<line x1="${x0 + i * colW}" y1="${TOP - 2}" x2="${x0 + i * colW}" y2="${TOP + rows.length * ROW}"
                stroke="${PRF.line}" stroke-width="1" stroke-dasharray="3 4" opacity=".55"/>`;
    });

    rows.forEach((r, i) => {
        const y = TOP + i * ROW;
        g += prfText(PAD + 6, y + BARH / 2 + 2, [(r.star ? '★ ' : '') + r.t],
            { fs: 17, fill: r.star ? PRF.amber : PRF.ink, w: r.star ? 800 : 600, anchor: 'start' });
        const bx = x0 + r.a * colW, bw = (r.b - r.a) * colW - 6;
        g += `<rect x="${bx}" y="${y}" width="${bw}" height="${BARH}" rx="8"
                fill="${r.c}" opacity="${r.star ? 1 : .82}"/>`;
        g += prfText(bx + bw / 2, y + BARH / 2, ['เดือนที่ ' + (r.a + 1)],
            { fs: 14, fill: PRF.onDark, w: 700 });
    });

    /* หมุดหมายสำคัญ */
    const my = TOP + rows.length * ROW + 26;
    g += `<rect x="${PAD}" y="${my}" width="${W - PAD * 2}" height="62" rx="12"
            fill="${PRF.blueBg}" stroke="${PRF.blue}" stroke-width="2"/>`;
    g += prfText(W / 2, my + 20, ['หมุดหมายส่งมอบ'], { fs: 17, fill: PRF.blueInk, w: 800 });
    g += prfText(W / 2, my + 44,
        ['เดือน 2 ตรวจก่อนส่งได้จริง 1 กองทุน · เดือน 3 โมดูลส่งต่อครบวงจร · เดือน 5 ส่งเบิกจริง 1 งวด · เดือน 6 ใช้งานจริง'],
        { fs: 16, fill: PRF.blueInk, w: 500, op: .95 });

    return prfSvg(W, H, g, 'แผนพัฒนา 6 เดือน แสดงเป็นแถบเวลา', true);
}


window.prfJourney     = prfJourney;
window.prfStatusFlow  = prfStatusFlow;
window.prfChain       = prfChain;
window.prfTwoLoops    = prfTwoLoops;
window.prfArchitecture = prfArchitecture;
window.prfLifecycle   = prfLifecycle;

/* — deck ผู้บริหาร 10 หน้า — */
window.prfAsIs        = prfAsIs;
window.prfToBe        = prfToBe;
window.prfReferFlow   = prfReferFlow;
window.prfRoadmap6M   = prfRoadmap6M;
