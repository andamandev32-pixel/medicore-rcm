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
        { a: 2, b: 3, t: 'NHSO — รับข้อมูลและตรวจสอบเบื้องต้น',   c: PRF.blue,  bg: PRF.blueBg },
        { a: 4, b: 4, t: 'ตรวจสอบก่อนจ่าย',                    c: PRF.green, bg: PRF.greenBg },
        { a: 5, b: 5, t: 'Statement · จ่ายเงิน',                c: PRF.amber, bg: PRF.amberBg },
    ];

    const steps = [
        { t: ['ผู้ป่วยรับบริการ'],   s: ['ตรวจสิทธิ์ · ให้บริการ', 'ปิดสิทธิ์ · เป๋าตัง'], fill: PRF.white,   stroke: PRF.navy },
        { t: ['ส่งเบิกผ่าน HIS'],    s: ['HIS / HIS-FDH'],                              fill: PRF.white,   stroke: PRF.navy, sw: 3.6 },
        { t: ['Pre-Validate'],       s: ['ตรวจสอบเบื้องต้น'],                             fill: PRF.blueBg,  stroke: PRF.blue },
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

    /* ① ไม่ผ่านตรวจสอบเบื้องต้น → กลับไปส่งใหม่ (วงใน) */
    g += prfArrow(`M${cx(2)},${BOT + 15} L${cx(2)},${RY - 3}`, PRF.red, 'jrErr', { dash: '7 5' });
    g += rework(2, ['รอแก้ไข'], ['ไม่ผ่านการตรวจสอบเบื้องต้น', 'แก้ที่ HIS → ส่งใหม่']);
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
        { t: ['สปสช. ตรวจสอบเบื้องต้น'],    s: ['F001 → F002'] },
        { t: ['ตีกลับ P124 / C305'],      s: ['ไม่ผ่านการตรวจสอบเบื้องต้น'], hi: true },
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
   7B. อินโฟกราฟิก "ระบบครอบคลุมงานอะไรบ้าง" — ใช้บนหน้าแรกของ deck ทุกชุด
   ----------------------------------------------------------
   สาระ: บอกขอบเขตทั้งระบบในภาพเดียว ก่อนจะลงรายละเอียด
     · 4 เส้นงานเรียงตามลำดับที่งานไหลจริง
     · 2 เส้นที่เพิ่มใหม่รอบนี้ (ผู้ป่วยใน · ส่งต่อไปรักษาภายนอก) ติดดาวและใช้สีเหลือง
     · รางบน = ภาพรวมผู้บริหารอ่านทุกเส้น · รางล่าง = ทุกเส้นมาบรรจบที่คิวส่งเบิกเดียวกัน
     · แถวล่างสุด = งานการเงินต่อจากคิวส่งเบิก — บันทึกส่ง (ตั้งเบิกเป็นพึงรับ) ·
       บันทึกรับ (เงินโอนเข้าตัดยอด) · กระทบยอด จนถึงรายงานสรุปยอดเงินโอน–พึงรับ
       (exec-finance) — เดิมขาดชั้นนี้ไป ทำให้ภาพครอบคลุมจบแค่ "ส่งแล้ว" ไม่ถึง "รับแล้ว"

   แต่ละเส้นงานเล่า 3 ชั้นเสมอ — ดูอะไรได้ / ได้ผลอะไร / แก้ปัญหาเดิมข้อไหน
   จงใจไม่บอกจำนวนหน้าจอ เพราะผู้บริหารซื้อผลลัพธ์ ไม่ได้ซื้อจำนวนหน้าจอ
   (และตัวเลขหน้าจอเพี้ยนทุกครั้งที่เพิ่มหน้า — จำนวนหน้าจออยู่ที่ deck รายส่วนที่เดียว)

   ⚠️ สัดส่วน viewBox 1440×580 (≈2.48) จงใจให้เท่ากับพื้นที่ .pr-body ของหน้าปก
      (วัดจริงบน deck กว้าง 1390px ได้ 1284×516 → 2.487 · ทุก deck lead ยาว 1 บรรทัดเท่ากัน)
      svg ย่อแบบ meet — สัดส่วนไม่ตรงเมื่อไร เหลือขอบว่างบน–ล่างทันที
      เดิม 1300×522 — พอเพิ่มแถวงานการเงิน H โตเป็น 580 จึงขยาย W ตามให้สัดส่วนคงเดิม
      ไม่งั้นเหลือขอบว่างซ้าย–ขวา (ทั้งใบย่อลง ~10% — font ในกล่องขยับขึ้นชดเชยแล้ว)

   ใช้ร่วมกันทั้ง present.html / present-exec.html / present-modules.html
   จึงอยู่ในไฟล์นี้ (ไฟล์ฐาน) ไม่ใช่ present-flows-modules.js
   ══════════════════════════════════════════════════════════ */
function prfCoverage() {
    const W = 1440, H = 580, PAD = 14, GAP = 30, N = 4;
    const BW = (W - PAD * 2 - GAP * (N - 1)) / N;          /* ≈ 330.5 */
    const xs = i => PAD + i * (BW + GAP);
    const cx = i => xs(i) + BW / 2;

    /* ระยะแนวตั้ง — ช่องว่างรอบรางจงใจกว้าง 26–38
       เพื่อให้เห็นว่าเส้นออกจากกล่องไหน ไปรวมที่ราง แล้วไปต่อที่แถบไหน
       เดิมกว้าง 34–40 แต่ต้องคายที่ให้แถบงานการเงินแถวล่างสุด */
    const TOP_Y = 2, TOP_H = 54;
    const RAIL_UP = 94;                                    /* ห่างแถบบน 38 · ห่างหัวกล่อง 36 */
    const CY = 130, CH = 246, CBOT = CY + CH;              /* กล่องจบที่ 376 */
    const RAIL_DOWN = 402;                                 /* ห่างท้ายกล่อง 26 */
    const BOT_Y = 420, BOT_H = 46;                         /* คิวส่งเบิกร่วม จบที่ 466 */
    const FIN_Y = 484, FIN_H = 94;                         /* งานการเงิน จบที่ 578 เหลือขอบล่าง 2 */

    /* เนื้อในกล่อง: หัวเรื่อง + 3 ชั้น ชั้นละหัวข้อ 1 บรรทัด เนื้อ 2 บรรทัด
       เกณฑ์ความยาว: (BW − ขอบ 2×15) ÷ (0.55 × 15) ≈ 36 อักษรไทยต่อบรรทัด */
    const HEAD_H = 50, PADX = 15, LBL_H = 16, LINE_H = 17.5, BLK_GAP = 9;

    const cols = [
        { t: 'เคลมผู้ป่วยนอก (OPD)',
          c: PRF.blue, bg: PRF.blueBg, ic: PRF.blueInk,
          b: [['ทุกเคสก่อนกดส่ง — ติดกฎข้อไหน', 'ใครต้องแก้ ต้องแก้ภายในเมื่อไร'],
              ['แก้จบในโรงพยาบาล ส่งรอบเดียวผ่าน', 'ทุกคำตอบอ้างประกาศได้ทันที'],
              ['เดิมรู้ว่าผิดตอน สปสช. ตีกลับ', 'แล้ววนแก้ข้ามรอบส่งเบิก']] },

        { t: '★ ผู้ป่วยใน (IPD)', star: true,
          c: PRF.amber, bg: PRF.amberBg, ic: PRF.amber,
          b: [['แฟ้มที่ยังขาดตั้งแต่ผู้ป่วยยังนอน', 'วันนอนเทียบจุดตัด DRG รายวัน'],
              ['เอกสารครบตั้งแต่ก่อนจำหน่าย', 'เทียบค่าใช้จ่ายจริงกับที่จะได้รับ'],
              ['เดิมไม่มีด่านตรวจแฟ้ม กว่าจะรู้ว่า', 'เอกสารไม่ครบก็จำหน่ายไปแล้ว']] },

        { t: '★ ส่งต่อไปรักษาภายนอก', star: true,
          c: PRF.amber, bg: PRF.amberBg, ic: PRF.amber,
          b: [['ใบส่งตัว เลขอนุมัติ วันหมดอายุ', 'วงเงินคงเหลือ — ครบทุกใบในที่เดียว'],
              ['อนุมัติ 2 ชั้นตามวงเงิน ร่องรอยครบ', 'ตรวจใบเรียกเก็บรายบรรทัดก่อนจ่าย'],
              ['เดิมไม่มีที่บันทึกในระบบเลย รู้ยอด', 'ที่ต้องตามจ่ายตอนใบเรียกเก็บมาถึง']] },

        /* คอลัมน์นี้เล่าเฉพาะ "ส่งออกไปให้ถูก" — เรื่องเงินเข้าและการกระทบยอด
           ย้ายไปอยู่แถบงานการเงินด้านล่างทั้งหมด ไม่งั้นเล่าซ้ำสองที่ */
        { t: 'ส่งเบิก NHSO',
          c: PRF.navy, bg: PRF.faint, ic: PRF.ink,
          b: [['ทุกชุดที่ส่ง 15 แฟ้ม 160 ช่องข้อมูล', 'สถานะรายเคสจนถึงผลตรวจของ สปสช.'],
              ['ส่งครบทุกงวด ไม่มีเคสไร้เจ้าของ', 'ผลตอบกลับเข้าระบบเป็นรายเคสทันที'],
              ['เดิมส่งไปแล้วเงียบ ไม่รู้ว่าเคสไหน', 'ผ่าน ไม่ผ่าน หรือยังค้างอยู่']] },
    ];

    /* แถบงานการเงินแถวล่างสุด — 4 ขั้นนี้ใช้คำเดียวกับการ์ดบนหน้า exec-finance.html
       (ตั้งเบิก · ประมวลผลจ่าย · เงินเข้าบัญชีจริง · คงค้าง) ตั้งใจให้ผู้ฟังจำคำได้
       ตั้งแต่หน้าปก แล้วไปเจอคำเดิมบนหน้าจอจริง — เปลี่ยนคำที่ Fin.KPI เมื่อไรต้องตามแก้ที่นี่ */
    const finSteps = [
        { t: ['บันทึกส่ง — ตั้งเบิก'],      s: ['ปิดงวดแล้วรู้ทันทีว่าส่งกี่ราย กี่บาท'] },
        { t: ['ประมวลผลจ่าย'],             s: ['ผู้จ่ายรับไว้เท่าไร ตัดจ่ายด้วยเหตุใด'] },
        { t: ['บันทึกรับ — เงินเข้าบัญชี'], s: ['ใบโอนและ Statement ตัดยอดรายงวด รายกองทุน'] },
        { t: ['คงค้าง — ยอดที่ยังไม่ได้รับ'], s: ['เหลือเท่าไร ของเคสไหน ตามต่อได้เป็นรายเคส'] },
    ];

    const LBLS = ['ดูอะไรได้', 'ได้ผลอะไร · ข้อดี', 'แก้ปัญหาเดิมข้อไหน'];

    /* หัวลูกศรสองขนาด: ตัวเล็กที่ปลายเส้นแต่ละกล่อง (บอกทิศทางที่วิ่งเข้าราง)
       ตัวใหญ่ที่กลางภาพ (บอกว่ารางไปจบที่แถบไหน) */
    let g = prfMarkers([
        { id: 'cvUp',  c: PRF.slate }, { id: 'cvDn',  c: PRF.navy },
        { id: 'cvUpS', c: PRF.slate, w: 3.4 }, { id: 'cvDnS', c: PRF.navy, w: 3.4 },
        { id: 'cvFin', c: PRF.green, w: 4 },
    ]);

    /* ── รางบน: ภาพรวมผู้บริหารอ่านทุกเส้นงาน ── */
    g += `<rect x="${PAD}" y="${TOP_Y}" width="${W - PAD * 2}" height="${TOP_H}" rx="12"
            fill="${PRF.navy}" stroke="${PRF.navy}" stroke-width="2.2"/>`;
    g += prfText(W / 2, TOP_Y + TOP_H / 2,
        ['ภาพรวมผู้บริหาร — อ่าน 4 เส้นงาน พร้อมยอดพึงรับ–รับจริง–คงค้าง ในหน้าเดียว · ' +
         'KPI ทุกช่องกดดูสูตรและเจาะถึงรายเคสได้'],
        { fs: 21.5, fill: PRF.onDark, w: 800 });

    g += `<path d="M${cx(0)},${RAIL_UP} H${cx(N - 1)}" fill="none"
            stroke="${PRF.slate}" stroke-width="2" stroke-dasharray="7 5" opacity=".8"/>`;
    g += prfArrow(`M${W / 2},${RAIL_UP} L${W / 2},${TOP_Y + TOP_H + 4}`,
        PRF.slate, 'cvUp', { dash: '7 5', sw: 2 });
    g += prfText(W / 2 + 18, (TOP_Y + TOP_H + RAIL_UP) / 2,
        ['ทุกเส้นงานส่งตัวเลขขึ้นหน้าภาพรวมชุดเดียวกัน'],
        { fs: 15, fill: PRF.slate, w: 700, anchor: 'start' });

    /* ── 4 เส้นงาน ── */
    cols.forEach((c, i) => {
        const x = xs(i);
        g += `<rect x="${x}" y="${CY}" width="${BW}" height="${CH}" rx="13"
                fill="${c.bg}" stroke="${c.c}" stroke-width="${c.star ? 3.2 : 2.4}"/>`;
        g += prfText(x + BW / 2, CY + HEAD_H / 2 - 2, [c.t], { fs: 22, fill: c.ic, w: 800 });
        g += `<path d="M${x + 14},${CY + HEAD_H - 2} H${x + BW - 14}" fill="none"
                stroke="${c.c}" stroke-width="1.6" opacity=".45"/>`;

        let y = CY + HEAD_H + 8;
        c.b.forEach((lines, k) => {
            g += `<rect x="${x + PADX}" y="${(y + LBL_H / 2 - 4.5).toFixed(1)}" width="3.2" height="9"
                    rx="1.6" fill="${c.c}"/>`;
            g += prfText(x + PADX + 9, y + LBL_H / 2, [LBLS[k]],
                { fs: 13.5, fill: c.ic, w: 800, anchor: 'start', op: .95 });
            g += prfText(x + PADX, y + LBL_H + lines.length * LINE_H / 2, lines,
                { fs: 15, fill: PRF.ink, w: 500, lh: 1.26, anchor: 'start', op: .86 });
            y += LBL_H + lines.length * LINE_H + BLK_GAP;
        });

        /* ขาขึ้น–ขาลงของกล่องนี้ · เว้นจากขอบกล่อง 3 เพื่อให้เห็นจุดออกชัด */
        g += prfArrow(`M${cx(i)},${CY - 3} L${cx(i)},${RAIL_UP}`,
            PRF.slate, 'cvUpS', { dash: '7 5', sw: 2 });
        g += prfArrow(`M${cx(i)},${CBOT + 3} L${cx(i)},${RAIL_DOWN}`,
            PRF.navy, 'cvDnS', { sw: 2.6 });
    });

    /* ── รางล่าง: มาบรรจบที่คิวส่งเบิกเดียวกัน ── */
    g += `<path d="M${cx(0)},${RAIL_DOWN} H${cx(N - 1)}" fill="none"
            stroke="${PRF.navy}" stroke-width="2.6" stroke-linecap="round"/>`;
    [0, N - 1].forEach(i => {
        g += `<circle cx="${cx(i)}" cy="${RAIL_DOWN}" r="4" fill="${PRF.navy}"/>`;
    });
    g += prfArrow(`M${W / 2},${RAIL_DOWN} L${W / 2},${BOT_Y - 4}`, PRF.navy, 'cvDn');
    g += prfText(W / 2 + 18, (RAIL_DOWN + BOT_Y) / 2,
        ['แล้วลงคิวส่งเบิกเดียวกันทั้งหมด'],
        { fs: 15, fill: PRF.navy, w: 700, anchor: 'start', op: .8 });

    g += `<rect x="${PAD}" y="${BOT_Y}" width="${W - PAD * 2}" height="${BOT_H}" rx="12"
            fill="${PRF.greenBg}" stroke="${PRF.green}" stroke-width="2.6"/>`;
    g += prfText(W / 2, BOT_Y + BOT_H / 2,
        ['ทั้ง 4 เส้นงานมาบรรจบที่คิวส่งเบิกเดียวกัน — ตรวจให้จบในโรงพยาบาล แล้วส่งครั้งเดียวผ่าน'],
        { fs: 22, fill: PRF.greenInk, w: 800 });

    /* ── แถบงานการเงิน: ส่งแล้วยังไม่จบ ต้องตามจนเงินเข้าและกระทบยอดได้ ──
       วางเป็นแผงเดียวเต็มความกว้าง ไม่ใช่คอลัมน์ที่ 5 เพราะงานชั้นนี้เกิด "หลัง"
       ทั้งสี่เส้นงาน ไม่ใช่คู่ขนานกับมัน — ถ้าวางเป็นคอลัมน์จะอ่านผิดว่าเป็นอีกเส้นงานหนึ่ง */
    g += prfArrow(`M${W / 2},${BOT_Y + BOT_H} L${W / 2},${FIN_Y - 3}`, PRF.green, 'cvFin', { sw: 2.8 });
    /* −3 จากกึ่งกลางช่องว่าง: ช่องนี้สูงแค่ 18 ถ้าวางกลางพอดี ตัวอักษรจะไปแตะขอบแผงด้านล่าง */
    g += prfText(W / 2 + 18, (BOT_Y + BOT_H + FIN_Y) / 2 - 3,
        ['ส่งแล้วยังไม่จบ — ต้องตามจนเงินเข้าบัญชี'],
        { fs: 14, fill: PRF.greenInk, w: 700, anchor: 'start', op: .9 });

    g += `<rect x="${PAD}" y="${FIN_Y}" width="${W - PAD * 2}" height="${FIN_H}" rx="12"
            fill="${PRF.white}" stroke="${PRF.green}" stroke-width="2.6"/>`;
    g += prfText(W / 2, FIN_Y + 20,
        ['งานการเงินต่อจากคิวส่งเบิก — บันทึกส่งเป็นยอดพึงรับ แล้วบันทึกรับเมื่อเงินโอนเข้า ' +
         'จนกระทบยอดได้เป็นรายเคส'],
        { fs: 18.5, fill: PRF.greenInk, w: 800 });

    const FX0 = PAD + 14, FGAP = 14;
    const FBW = (W - PAD * 2 - 28 - FGAP * (finSteps.length - 1)) / finSteps.length;
    const FBY = FIN_Y + 33, FBH = 53;
    finSteps.forEach((s, i) => {
        const x = FX0 + i * (FBW + FGAP);
        g += prfBox({ x: x, y: FBY, w: FBW, h: FBH, rx: 10, t: s.t, s: s.s, fs: 16.5, sfs: 13.5,
                      fill: PRF.greenBg, stroke: PRF.green, sw: 2, tc: PRF.greenInk, sop: .9 });
        if (i < finSteps.length - 1) {
            g += prfArrow(`M${x + FBW},${FBY + FBH / 2} L${x + FBW + FGAP - 3},${FBY + FBH / 2}`,
                PRF.green, 'cvFin', { sw: 2.4 });
        }
    });

    /* ไม่ส่ง auto — ให้เป็น .pr-svg ที่ CSS วาง absolute เต็มกรอบแล้วย่อพอดีด้วย
       preserveAspectRatio="xMidYMid meet" · ผังจึงอยู่กึ่งกลางแนวตั้งเสมอ
       ถ้าส่ง true จะได้ height:auto แล้วผังไปเกาะขอบบน เหลือช่องว่างก้อนใหญ่ด้านล่าง
       (หน้าปกของแต่ละ deck มี lead ยาวไม่เท่ากัน พื้นที่ที่เหลือจึงไม่เท่ากันด้วย) */
    return prfSvg(W, H, g,
        'ขอบเขตของระบบ สี่เส้นงานที่มาบรรจบที่คิวส่งเบิกเดียวกัน ' +
        'แล้วต่อด้วยงานการเงิน บันทึกส่ง บันทึกรับ และกระทบยอดจนปิดเคส');
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

/* ── 7.2 ของใหม่: ด่านตรวจก่อนส่ง + โมดูลส่งต่อ + งานการเงินที่ตามต่อจนเงินเข้า ──
   H 470 → 566 ตอนเพิ่มแถบงานการเงิน · ผังนี้ส่ง auto=true (height:auto)
   จึงขยายลงล่างได้โดยไม่บีบส่วนบน แต่ต้องไม่เกินพื้นที่ .pr-body ของสไลด์ */
function prfToBe() {
    const W = 1300, H = 566, PAD = 14, GAP = 26, N = 5;
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
    /* ไม่บอกจำนวนหน้าจอตรงนี้ — เคยเขียน "4 หน้าจอ" ค้างไว้แล้วเพี้ยนตอนโมดูลโตเป็น 6
       จำนวนหน้าจออยู่ที่สไลด์ขอบเขตงานที่เดียว */
    g += prfText(W / 2, GY + 30, ['เพิ่มใหม่ — โมดูลควบคุมการส่งต่อผู้ป่วยครบวงจร'],
        { fs: 22, fill: PRF.greenInk, w: 800 });
    g += prfText(W / 2, GY + 66,
        ['ทะเบียนการส่งต่อ · ขออนุมัติแบบ Maker–Checker · ตามจ่าย/เรียกเก็บรายบรรทัด · ภาพรวมผู้บริหาร'],
        { fs: 18, fill: PRF.greenInk, w: 500, op: .92 });

    /* ⭐ ชั้นที่สอง — "ส่งผ่าน" ยังไม่ใช่ "ได้เงิน" งานการเงินจึงต้องอยู่ในขอบเขตด้วย
       ใช้สีน้ำเงินไม่ใช่เขียว เพื่อให้เห็นว่าเป็นคนละก้อนกับโมดูลส่งต่อด้านบน */
    const FY = 460, FH = 92;
    g += `<rect x="${PAD}" y="${FY}" width="${W - PAD * 2}" height="${FH}" rx="12"
            fill="${PRF.blueBg}" stroke="${PRF.blue}" stroke-width="2.6"/>`;
    g += prfText(W / 2, FY + 29, ['และไม่จบแค่ส่งผ่าน — งานการเงินตามต่อจนเงินเข้าบัญชี'],
        { fs: 22, fill: PRF.blueInk, w: 800 });
    g += prfText(W / 2, FY + 63,
        ['บันทึกส่งเป็นยอดพึงรับ → บันทึกรับเมื่อเงินโอนเข้า → กระทบยอดรายงวด รายกองทุน และรายเคส'],
        { fs: 18, fill: PRF.blueInk, w: 500, op: .92 });

    return prfSvg(W, H, g,
        'กระบวนการใหม่ ตรวจก่อนส่ง มีโมดูลส่งต่อผู้ป่วย และมีงานการเงินที่ตามจนเงินเข้าบัญชี', true);
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
    const W = 1300, H = 530, PAD = 14;
    const LW = 250, TOP = 84, ROW = 50, BARH = 33;
    const track = W - PAD * 2 - LW - 20;
    const colW = track / 6;
    const x0 = PAD + LW + 20;

    const months = ['ก.ย. 69', 'ต.ค. 69', 'พ.ย. 69', 'ธ.ค. 69', 'ม.ค. 70', 'ก.พ. 70'];
    const rows = [
        { t: 'Discovery & Data Mapping',   a: 0, b: 1, c: PRF.slate },
        { t: 'Foundation + Rule Engine',   a: 1, b: 2, c: PRF.blue },
        { t: 'ควบคุมการส่งต่อไปรักษาภายนอก', a: 2, b: 3, c: PRF.amber, star: true },
        { t: 'ติดตามการรักษาผู้ป่วยใน (IPD)', a: 2.5, b: 4, c: PRF.amber, star: true },
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
        /* Math.floor เพราะบางแถวเริ่มกลางเดือน (a = 2.5) — ไม่งั้นได้ป้าย "เดือนที่ 3.5" */
        g += prfText(bx + bw / 2, y + BARH / 2, ['เดือนที่ ' + (Math.floor(r.a) + 1)],
            { fs: 14, fill: PRF.onDark, w: 700 });
    });

    /* หมุดหมายสำคัญ */
    const my = TOP + rows.length * ROW + 26;
    g += `<rect x="${PAD}" y="${my}" width="${W - PAD * 2}" height="62" rx="12"
            fill="${PRF.blueBg}" stroke="${PRF.blue}" stroke-width="2"/>`;
    g += prfText(W / 2, my + 20, ['หมุดหมายส่งมอบ'], { fs: 17, fill: PRF.blueInk, w: 800 });
    g += prfText(W / 2, my + 44,
        ['เดือน 2 ตรวจก่อนส่งได้จริง 1 กองทุน · เดือน 3 ควบคุมการส่งต่อครบวงจร · ' +
         'เดือน 4 ตรวจแฟ้มผู้ป่วยในได้จริง · เดือน 5 ส่งเบิกจริง 1 งวด · เดือน 6 ใช้งานจริง'],
        { fs: 15, fill: PRF.blueInk, w: 500, op: .95 });

    return prfSvg(W, H, g, 'แผนพัฒนา 6 เดือน แสดงเป็นแถบเวลา', true);
}


/* ══════════════════════════════════════════════════════════
   8. ที่มาของโครงการ — เสียงจากหน้างาน (deck ทั้ง 3 ชุดใช้ร่วมกัน)
   ----------------------------------------------------------
   หลังนำเสนอรอบแรก ผู้บริหารโรงพยาบาลให้ pain point กลับมา 6 เรื่อง
   สองผังนี้คือ "แหล่งความจริงเดียว" ของ 6 เรื่องนั้น —
   present.html · present-exec.html · present-modules.html เรียกตัวเดียวกัน
   แก้ถ้อยคำที่นี่ที่เดียวแล้วเปลี่ยนครบทุก deck ไม่ต้องไล่แก้ทีละไฟล์สไลด์

   ⚠️ ห้ามใส่ตัวเลข baseline ที่คิดเอง — ลูกค้ายังไม่ได้ให้ตัวเลขจริง
      ผังชุดนี้จึงเล่าด้วย "สิ่งที่เกิดขึ้น" ไม่ใช่ "กี่เปอร์เซ็นต์"
   ⚠️ ทั้งสองผังกินเต็มสไลด์ จึง "ไม่ส่ง" อาร์กิวเมนต์ auto ให้ prfSvg()
      ต้องได้ .pr-svg ที่ position:absolute inset:0 ไม่งั้นล้น .pr-body ที่ overflow:hidden
   ══════════════════════════════════════════════════════════ */

/* ── 8.1 6 จุดที่งานสะดุด — วางบนเส้นทางเดียวกันเพื่อให้เห็นว่าไม่ใช่ 6 เรื่องแยกกัน ── */
function prfPainMap() {
    /* H บีบจาก 570 → 548 ตั้งใจ: ผังนี้ถูกจำกัดด้วยความสูงของ .pr-body
       (preserveAspectRatio=meet) จึงยังเหลือที่ว่างซ้าย–ขวา — ลด H แล้ว
       svg ทั้งใบขยายขึ้นอีก ~4% ฟรี ๆ ทบกับ font-size ที่เพิ่มในผังนี้ */
    const W = 1300, H = 548, PAD = 14, GAP = 22, N = 5;
    const BW = (W - PAD * 2 - GAP * (N - 1)) / N;
    const SPY = 60, SPH = 104, SPB = SPY + SPH, MID = SPY + SPH / 2;
    const xs = i => PAD + i * (BW + GAP);
    const cx = i => xs(i) + BW / 2;
    /* เส้นแบ่ง "คนละหน่วยงาน" — กล่อง 1–4 เป็นงานหน่วยส่งเบิก กล่อง 5 เป็นงานการเงิน */
    const DIV = xs(4) - GAP / 2;

    const steps = [
        { t: ['ให้บริการผู้ป่วย'],                s: ['OPD และ IPD'] },
        { t: ['รายการที่ต้องแก้', 'ก่อนส่งเบิก'],   s: ['ยังไม่ครบ · รอแก้'],     bad: true },
        { t: ['ส่งเบิก'],                         s: ['หลายกองทุน · หลายงวด'] },
        { t: ['สปสช. ตรวจ', 'และตีกลับ'],         s: ['P124 · C305 · ตัดจ่าย'],  bad: true },
        { t: ['เงินโอนเข้า', 'ปิดลูกหนี้รายตัว'],   s: ['คนละหน่วยงานทำ'],        bad: true },
    ];

    /* ป้ายปัญหาที่ห้อยใต้ขั้นตอน — n คือหมายเลขข้อในสรุปความต้องการ 6 ข้อ */
    const PY = 190, PH = 94;
    const pins = [
        { i: 1, n: '1', t: ['ติดกี่เคส เรื่องไหน', 'นานแค่ไหน — ไม่รู้'],
                        s: ['เลยกำหนดส่ง แล้วเบิกไม่ได้', 'ทั้ง OPD และ IPD'] },
        { i: 3, n: '2', t: ['ไม่มีสถิติว่าติดเรื่องไหน', 'ตีกลับเป็นอย่างไร'],
                        s: ['แก้ส่งไปแล้วดีขึ้นไหม', 'ก็ยังไม่มีข้อมูลตอบ'] },
        { i: 4, n: '4', t: ['เงินเข้ามาชนยอด', 'ส่งเบิกไม่ได้'],
                        s: ['หลายกองทุน โอนมาก่อน', 'แต่ไม่รู้ว่าของยอดไหน'] },
    ];

    let g = prfMarkers([{ id: 'vcFwd', c: PRF.navy }, { id: 'vcErr', c: PRF.red }]);

    /* ── ป้ายเลนบน + เส้นแบ่งหน่วยงาน ── */
    g += prfText((PAD + DIV - 6) / 2, 19, ['หน่วยส่งเบิก · เวชระเบียน · หอผู้ป่วย'],
        { fs: 20, fill: PRF.slate, w: 700 });
    g += prfText((DIV + 6 + W - PAD) / 2, 19, ['การเงิน'], { fs: 20, fill: PRF.slate, w: 700 });
    g += `<line x1="${DIV}" y1="6" x2="${DIV}" y2="288" stroke="${PRF.red}"
            stroke-width="2.4" stroke-dasharray="9 6"/>`;
    g += prfText(DIV, 43, ['คนละหน่วยงาน · ตัวเลขคนละชุด'], { fs: 16, fill: PRF.redInk, w: 700 });

    /* ── สันหลัก 5 ขั้นตอน ── */
    steps.forEach((s, i) => {
        g += prfBox({ x: xs(i), y: SPY, w: BW, h: SPH, t: s.t, s: s.s, fs: 22, sfs: 15.5,
                      fill: s.bad ? PRF.redBg : PRF.white,
                      stroke: s.bad ? PRF.red : PRF.navy,
                      tc: s.bad ? PRF.redInk : PRF.ink });
        if (i < N - 1) {
            /* ลูกศรข้ามเส้นแบ่งหน่วยงาน (3→4) วาดเป็นเส้นประแดง — คือจุดที่ข้อมูลขาดมือ */
            const cut = i === 3;
            g += prfArrow(`M${xs(i) + BW},${MID} L${xs(i + 1) - 3},${MID}`,
                cut ? PRF.red : PRF.navy, cut ? 'vcErr' : 'vcFwd', cut ? { dash: '7 5' } : null);
        }
    });

    /* ── ป้ายปัญหา 1 · 2 · 4 ห้อยใต้ขั้นตอนที่เกี่ยวข้อง ── */
    pins.forEach(p => {
        g += prfArrow(`M${cx(p.i)},${SPB + 4} L${cx(p.i)},${PY - 3}`, PRF.red, 'vcErr', { dash: '6 5', sw: 2.2 });
        g += prfBox({ x: xs(p.i), y: PY, w: BW, h: PH, rx: 11, t: p.t, s: p.s, fs: 17, sfs: 14.5,
                      fill: PRF.white, stroke: PRF.red, sw: 2, tc: PRF.redInk });
        g += prfBadge(xs(p.i) + 22, PY, p.n, PRF.red, 14, 16);
    });

    /* ── 3 · ขาดช่วงการติดตาม พาดตั้งแต่ส่งเบิกจนถึงปิดลูกหนี้ ── */
    const B3X = xs(2), B3W = xs(4) + BW - B3X, B3Y = 296, B3H = 54;
    g += `<rect x="${B3X}" y="${B3Y}" width="${B3W}" height="${B3H}" rx="11"
            fill="${PRF.redBg}" stroke="${PRF.red}" stroke-width="2.2" stroke-dasharray="9 6"/>`;
    g += prfText(B3X + B3W / 2, B3Y + B3H / 2,
        ['ขาดช่วงการติดตาม — ส่งเบิกแล้วเงียบ เคสตกหล่นระหว่างทาง พอรู้อีกทีก็หายแล้ว'],
        /* fs 18 คือเพดานของบรรทัดนี้ — ยาว 75 ตัวอักษรบนกล่องกว้าง 754
           ถ้าดันถึง 19 ข้อความจะเลยเข้าไปทับตราเลข 3 ที่มุมซ้าย */
        { fs: 18, fill: PRF.redInk, w: 800 });
    g += prfBadge(B3X + 24, B3Y + B3H / 2, '3', PRF.red, 14, 16);

    /* ── 5 · จุดบอด: การส่งต่อไปรักษาภายนอกไม่ได้อยู่บนเส้นนี้เลย ── */
    const B5Y = 362, B5H = 84;
    g += `<rect x="${PAD}" y="${B5Y}" width="${W - PAD * 2}" height="${B5H}" rx="12"
            fill="${PRF.redBg}" stroke="${PRF.red}" stroke-width="2.6" stroke-dasharray="10 6"/>`;
    g += prfText(W / 2, B5Y + 31, ['จุดบอด — การส่งผู้ป่วยไปรักษาต่อภายนอก ไม่ได้อยู่บนเส้นนี้เลย'],
        { fs: 22, fill: PRF.redInk, w: 800 });
    g += prfText(W / 2, B5Y + 61,
        ['ค่าที่ต้องตามจ่ายจึงไม่เข้าไปในสรุปรายจ่ายรายบุคคล — ไม่รู้ต้นทุนจริงตอนตัดสินใจส่ง'],
        { fs: 17.5, fill: PRF.redInk, w: 500, op: .92 });
    g += prfBadge(PAD + 28, B5Y, '5', PRF.red, 14, 16);

    /* ── 6 · เรื่องที่คร่อมทุกขั้นตอน: งาน routine ยังพึ่งความชำนาญส่วนบุคคล ── */
    const B6Y = 458, B6H = 78;
    g += `<rect x="${PAD}" y="${B6Y}" width="${W - PAD * 2}" height="${B6H}" rx="12"
            fill="${PRF.amberBg}" stroke="${PRF.amber}" stroke-width="2.4"/>`;
    g += prfText(W / 2, B6Y + 28,
        ['และทั้งเส้นนี้พึ่งความชำนาญส่วนบุคคล — งาน routine ยังต้องใช้คนที่ทำเป็นเท่านั้น'],
        { fs: 21, fill: PRF.amber, w: 800 });
    g += prfText(W / 2, B6Y + 56,
        ['ทำข้อมูลเองครั้งละหลายวัน แล้วยังไม่มั่นใจว่าถูกต้อง · คนย้ายเมื่อไร งานสะดุดทันที'],
        { fs: 17, fill: PRF.amber, w: 500, op: .95 });
    g += prfBadge(PAD + 28, B6Y, '6', PRF.amber, 14, 16);

    return prfSvg(W, H, g,
        'ผังสรุปหกจุดที่งานสะดุด ตั้งแต่ให้บริการผู้ป่วยจนถึงปิดลูกหนี้รายตัว');
}

/* ── 8.2 จากเสียงหน้างาน → หัวข้องาน → ส่วนงานที่รองรับ ── */
function prfPainScope() {
    const W = 1300, H = 600;
    const NX = 30;                                  /* จุดกึ่งกลางตราเลขข้อ */
    const C1 = 48,  W1 = 400;                       /* สิ่งที่หน้างานบอก */
    const C2 = 478, W2 = 430;                       /* หัวข้องาน */
    const C3 = 938, W3 = 348;                       /* ส่วนงานที่รองรับ */
    const TOP = 54, ROWH = 82, STEP = 90;

    /* star = เส้นงานที่เพิ่งเพิ่มใหม่ในรอบนี้ (IPD และการส่งต่อผู้ป่วย) */
    const rows = [
        { a:  ['ไม่รู้ว่าติดอยู่กี่เคส ติดเรื่องไหน นานหรือยัง'],
          as: ['จนบางทีเลยกำหนดส่ง ทำให้เบิกไม่ได้ ทั้ง OPD และ IPD'],
          b:  ['คิวงานค้างก่อนส่งเบิก + นาฬิกากำหนดส่ง'],
          bs: ['เห็นจำนวนเคส สาเหตุที่ติด อายุงาน เจ้าของงาน ครบในหน้าเดียว'],
          c:  ['★ Claim Intelligence · ผู้ป่วยใน (IPD)'],
          cs: ['รายการเคลม · งานและการอนุมัติ', 'ทะเบียนผู้ป่วยใน · ตรวจแฟ้มผู้ป่วยใน'], star: true },

        { a:  ['ไม่มีสถิติว่าติดเรื่องไหน ตีกลับเป็นอย่างไร'],
          as: ['แก้ส่งไปแล้วดีขึ้นไหมก็ไม่รู้', 'ทำข้อมูลเองก็นาน แล้วไม่มั่นใจว่าถูก'],
          b:  ['สถิติสาเหตุที่ติด/ตีกลับ + วัดผลหลังแก้'],
          bs: ['จัดอันดับสาเหตุ · อัตราผ่านหลังแก้', 'ออกรายงานจากข้อมูลชุดเดียวกับหน้าจอ'],
          c:  ['Claim Intelligence · ส่งเบิก NHSO'],
          cs: ['วิเคราะห์การตีกลับ · คลังกฎ', 'รายงาน / Statement'] },

        { a:  ['ส่งเบิกไปแล้วตรงไหม ปิดลูกหนี้รายตัวครบไหม'],
          as: ['ขาดช่วงของการติดตามและตกหล่น', 'พอรู้อีกทีก็หายแล้ว'],
          b:  ['ติดตามรายเคสต่อเนื่องจนปิดลูกหนี้รายตัว'],
          bs: ['สถานะเส้นเดียว ส่ง → ผลตรวจ → รับเงิน → ปิด', 'พร้อมเตือนเคสที่ค้างเกินกำหนด'],
          c:  ['ส่งเบิก NHSO'],
          cs: ['ส่งเบิก · รายละเอียดรายการส่งเบิก', 'รายงาน / Statement'] },

        { a:  ['เงินเข้ามาชนยอดส่งเบิกไม่ได้ คนละหน่วยงาน'],
          as: ['บางเคสส่งหลายกองทุน หน่วยโอนโอนมาก่อน', 'แต่ไม่รู้ว่าโอนมาของยอดไหน'],
          b:  ['กระทบยอดเงินโอนกับยอดส่งเบิก รายกองทุน–รายเคส'],
          bs: ['แตกยอดโอนกลับไปหางวด กองทุน และเคส', 'หน่วยส่งกับการเงินอ่านตัวเลขชุดเดียวกัน'],
          c:  ['ผู้บริหาร · ส่งเบิก NHSO'],
          cs: ['สรุปยอดเงินโอน สปสช./ประกันสังคม', 'นำเข้าข้อมูล (แฟ้มกองทุน)'] },

        { a:  ['การส่งไปรักษาต่อภายนอก ไม่ได้เป็นส่วนเดียวกับ', 'การสรุปรายจ่ายรายบุคคล'],
          as: ['จึงไม่รู้ต้นทุนว่าส่งได้จริงแค่ไหน'],
          b:  ['★ รวมค่าส่งต่อภายนอกเข้าเป็นต้นทุนรายผู้ป่วย'],
          bs: ['ใบส่งตัว เลขอนุมัติ ขอบเขต วงเงิน ผูกกับเคสที่ใช้เบิก',
               'เห็นต้นทุน–รายรับรายคนก่อนตัดสินใจส่ง'],
          c:  ['★ ส่งต่อผู้ป่วย'],
          cs: ['ทะเบียนการส่งต่อ · ตามจ่าย/เรียกเก็บ', 'ภาพรวม · อนุมัติวงเงินผู้บริหาร'], star: true },

        { a:  ['อยากให้การทำงานสั้นลง ไม่ต้องพึ่งความรู้', 'เฉพาะบุคคลหรือความชำนาญส่วนตัว'],
          as: ['ลดเวลาและแรงงานในการทำข้อมูลเหล่านี้'],
          b:  ['ย้ายความรู้จากตัวคนมาไว้ในระบบ'],
          bs: ['กฎและคลังความรู้พร้อมประกาศอ้างอิง', 'งาน routine ให้ระบบตรวจ จัดคิว และออกรายงานเอง'],
          c:  ['Claim Intelligence'],
          cs: ['คลังกฎ · คลังความรู้ (RAG)', 'งานและการอนุมัติ · ผู้ดูแลระบบ'] },
    ];

    let g = prfMarkers([{ id: 'vsA', c: PRF.slate, w: 4 }]);

    g += prfText(C1 + W1 / 2, 26, ['สิ่งที่หน้างานบอกมา'], { fs: 19, fill: PRF.redInk, w: 800 });
    g += prfText(C2 + W2 / 2, 26, ['หัวข้องานที่ต้องทำ'],  { fs: 19, fill: PRF.blueInk, w: 800 });
    g += prfText(C3 + W3 / 2, 26, ['ส่วนงานที่รองรับ'],    { fs: 19, fill: PRF.greenInk, w: 800 });

    rows.forEach((r, i) => {
        const y = TOP + i * STEP, mid = y + ROWH / 2;

        g += prfBox({ x: C1, y: y, w: W1, h: ROWH, rx: 10, t: r.a, s: r.as, fs: 15.5, sfs: 12.6,
                      fill: PRF.redBg, stroke: PRF.red, sw: 1.8, tc: PRF.redInk });
        g += prfBox({ x: C2, y: y, w: W2, h: ROWH, rx: 10, t: r.b, s: r.bs, fs: 16, sfs: 12.8,
                      fill: PRF.blueBg, stroke: PRF.blue, sw: 1.8, tc: PRF.blueInk });
        g += prfBox({ x: C3, y: y, w: W3, h: ROWH, rx: 10, t: r.c, s: r.cs, fs: 14, sfs: 12,
                      fill: r.star ? PRF.amberBg : PRF.greenBg,
                      stroke: r.star ? PRF.amber : PRF.green,
                      sw: r.star ? 2.4 : 1.8,
                      tc: r.star ? PRF.amber : PRF.greenInk });

        g += prfArrow(`M${C1 + W1 + 4},${mid} L${C2 - 4},${mid}`, PRF.slate, 'vsA', { sw: 2.2 });
        g += prfArrow(`M${C2 + W2 + 4},${mid} L${C3 - 4},${mid}`, PRF.slate, 'vsA', { sw: 2.2 });
        g += prfBadge(NX, mid, String(i + 1), PRF.navy, 13, 15);
    });

    return prfSvg(W, H, g,
        'ตารางผังจับคู่ความต้องการของโรงพยาบาลหกข้อ กับหัวข้องานและส่วนงานที่รองรับ');
}

/* ── 8.3 ตารางตัวหนังสือของ 6 เรื่องเดียวกัน (เปิดก่อนผัง) ──────────────
   ผัง 8.1/8.2 อ่านเร็วแต่ตัดถ้อยคำให้สั้นจนเหลือแต่ใจความ
   หน้านี้เก็บ "คำพูดจริง" ไว้เต็มประโยค แล้วจับคู่กับหัวข้องานและชื่อไฟล์หน้าจอ
   จึงเป็นหน้าที่ผู้ฟังชี้ได้ว่าเรื่องของตัวเองอยู่ตรงไหน ก่อนจะไปดูผังภาพ

   ⚠️ ลำดับข้อ 1–6 ต้องตรงกับตราเลขใน prfPainMap() / prfPainScope() เสมอ
      ถ้าจะสลับหรือเพิ่มเรื่อง ต้องแก้ทั้งสามที่พร้อมกัน
   ⚠️ คอลัมน์ขวาเป็นชื่อไฟล์จริงในต้นแบบ ไม่ใช่ชื่อเรียกทางการตลาด —
      เปลี่ยนชื่อไฟล์เมื่อไรต้องตามแก้ที่นี่ (new: true = เส้นงานที่เพิ่มใหม่รอบนี้)
   คืนค่าเป็น HTML ไม่ใช่ SVG ต่างจากฟังก์ชันอื่นในไฟล์นี้ — วางไว้ที่นี่
   เพราะถ้อยคำ 6 เรื่องต้องอยู่ชิดกันทั้งสามรูปแบบ ไม่งั้นแก้ที่เดียวแล้วอีกที่ค้าง

   prfPainTable(from, to) — เลือกช่วงข้อ (นับ 1) เช่น (1,3) และ (4,6)
   เลขข้อในตราคงเดิมเสมอไม่ว่าตัดช่วงไหน เพราะต้องตรงกับผัง 8.1/8.2
   ⚠️ 6 แถวในสไลด์เดียวต้องย่อตัวอักษรจนอ่านยากบนโปรเจกเตอร์ — deck ผู้บริหาร
      จึงตัดเป็น 2 หน้า หน้าละ 3 แถว ถ้าจะรวมกลับเป็นหน้าเดียวต้องลดขนาด
      ตัวอักษรใน .pr-quote / .pr-tbl-t / .pr-tbl-s ที่ ds-present.css ด้วย */
function prfPainTable(from, to) {
    const rows = [
        { q: 'ไม่รู้ว่าตอนนี้ติดอยู่กี่เคส ติดเรื่องไหน นานหรือยัง จนบางทีเลยกำหนดส่ง ' +
             'ทำให้เบิกไม่ได้ ทั้งผู้ป่วยนอกและผู้ป่วยใน',
          t: 'คิวงานค้างก่อนส่งเบิก + นาฬิกากำหนดส่ง',
          s: 'เห็นจำนวนเคส สาเหตุที่ติด อายุงาน เจ้าของงาน และวันครบกำหนด — ครบทั้ง OPD/IPD บนหน้าจอเดียว',
          f: ['claim-worklist.html', 'claim-tasks.html',
              { n: 'ipd-worklist.html', new: true }, { n: 'ipd-audit.html', new: true },
              'claim-dashboard.html'] },

        { q: 'ไม่มีสถิติว่าติดเรื่องไหนบ้าง การตีกลับเป็นอย่างไร แก้ไขส่งไปแล้วเป็นอย่างไรบ้าง ' +
             'ทำข้อมูลเองก็ใช้เวลานาน แล้วไม่แน่ใจว่าถูกต้องไหม',
          t: 'สถิติสาเหตุที่ติด/ตีกลับ และการวัดผลหลังแก้',
          s: 'จัดอันดับสาเหตุ · อัตราผ่านหลังแก้ · ออกรายงานเองจากข้อมูลชุดเดียวกับที่หน้าจอใช้ ไม่ต้องนั่งทำมือ',
          f: ['claim-reject.html', 'claim-rules.html', 'nhso-reports.html'] },

        { q: 'การส่งเบิกเป็นอย่างไร ตรงไหม ปิดลูกหนี้รายตัวครบไหม ' +
             'ขาดช่วงของการติดตามแล้วตกหล่น พอรู้อีกทีก็หายแล้ว',
          t: 'ติดตามรายเคสต่อเนื่องจนปิดลูกหนี้รายตัว',
          s: 'สถานะเส้นเดียวไล่จาก ส่ง → ผลตรวจ → รับเงิน → ปิด พร้อมเตือนเคสที่ค้างเกินกำหนด ไม่มีช่วงที่ไม่มีใครถือ',
          f: ['nhso-submit.html', 'nhso-case.html', 'nhso-reports.html'] },

        { q: 'เงินเข้ามาชนยอดส่งเบิกไม่ได้ คนละหน่วยงานทำงาน หน่วยส่งกับการเงินชนยอดไม่ได้ ' +
             'บางเคสส่งหลายกองทุน หน่วยโอนโอนมาก่อน แต่ไม่รู้ว่าโอนของยอดไหน',
          t: 'กระทบยอดเงินโอนกับยอดส่งเบิก รายกองทุน–รายเคส',
          s: 'แตกยอดโอนกลับไปหางวด/กองทุน/เคส · ส่วนต่างมีเหตุผลกำกับ · หน่วยส่งกับการเงินอ่านตัวเลขชุดเดียวกัน',
          f: ['exec-finance.html', 'nhso-reports.html', 'nhso-import.html (แท็บ fundfile)'] },

        { q: 'การส่งไปรักษาต่อภายนอก ไม่มีข้อมูลเป็นส่วนเดียวกับการสรุปรายจ่ายรายบุคคล ' +
             'จึงรวมตรงนี้ เพื่อให้รู้ต้นทุน สามารถที่ส่งได้จริง',
          t: 'รวมค่าส่งต่อภายนอกเข้าเป็นต้นทุนรายผู้ป่วย',
          s: 'ใบส่งตัว เลขอนุมัติ ขอบเขต วงเงิน ผูกกับเคสเดียวกับที่ใช้เบิก — เห็นต้นทุน–รายรับรายคนก่อนตัดสินใจส่ง',
          f: [{ n: 'refer-worklist.html', new: true }, { n: 'refer-case.html', new: true },
              { n: 'refer-billing.html', new: true }, { n: 'refer-dashboard.html', new: true },
              { n: 'exec-approve.html', new: true }] },

        { q: 'อยากให้การทำงานสั้นลง ระบบเข้ามาช่วยงาน routine ' +
             'ไม่ต้องพึ่งความรู้เฉพาะบุคคลหรือความชำนาญส่วนตัว ลดเวลาและแรงงาน',
          t: 'ย้ายความรู้จากตัวคนมาไว้ในระบบ',
          s: 'กฎและคลังความรู้พร้อมประกาศอ้างอิง · งาน routine ให้ระบบตรวจ จัดคิว และออกรายงานเอง · คนใหม่ทำงานได้ ไม่ต้องรอคนเก่า',
          f: ['claim-rules.html', 'claim-knowledge.html', 'claim-tasks.html', 'claim-admin.html'] },
    ];

    const file = f => {
        const o = typeof f === 'string' ? { n: f } : f;
        return `<span class="pr-file${o.new ? ' new' : ''}">${o.new ? '★ ' : ''}${o.n}</span>`;
    };

    const a = Math.max(1, from || 1);
    const b = Math.min(rows.length, to || rows.length);

    return `
    <div class="pr-tbl-wrap">
        <table class="pr-table clean">
            <colgroup>
                <col style="width:5%"><col style="width:34%"><col style="width:39%"><col style="width:22%">
            </colgroup>
            <thead>
                <tr>
                    <th class="c">#</th>
                    <th class="pain">เสียงจากหน้างาน (คำที่โรงพยาบาลบอกมา)</th>
                    <th class="work">หัวข้องานที่ต้องทำ</th>
                    <th class="scope">หน้าจอต้นแบบที่รองรับ</th>
                </tr>
            </thead>
            <tbody>
                ${rows.slice(a - 1, b).map((r, i) => `
                <tr>
                    <td class="n"><span class="pr-tbl-n">${a + i}</span></td>
                    <td><span class="pr-quote">“${r.q}”</span></td>
                    <td><span class="pr-tbl-t">${r.t}</span><span class="pr-tbl-s">${r.s}</span></td>
                    <td>${r.f.map(file).join('')}</td>
                </tr>`).join('')}
            </tbody>
        </table>
    </div>`;
}


window.prfJourney     = prfJourney;
window.prfStatusFlow  = prfStatusFlow;
window.prfChain       = prfChain;
window.prfTwoLoops    = prfTwoLoops;
window.prfArchitecture = prfArchitecture;
window.prfLifecycle   = prfLifecycle;
window.prfCoverage    = prfCoverage;   /* หน้าแรกของ deck ทุกชุดใช้ตัวนี้ร่วมกัน */

/* — deck ผู้บริหาร 10 หน้า — */
window.prfAsIs        = prfAsIs;
window.prfToBe        = prfToBe;
window.prfReferFlow   = prfReferFlow;
window.prfRoadmap6M   = prfRoadmap6M;

/* — ส่วนเกริ่น "ที่มาของโครงการ" — deck ทั้ง 3 ชุดเรียกชุดนี้ร่วมกัน — */
window.prfPainMap     = prfPainMap;
window.prfPainScope   = prfPainScope;
window.prfPainTable   = prfPainTable;  /* HTML ไม่ใช่ SVG — ดูหมายเหตุที่ §8.3 */
