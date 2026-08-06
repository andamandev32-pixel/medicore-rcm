/**
 * MediCore Design System — CHART (inline SVG, ไม่มี dependency)
 * ------------------------------------------------------------
 * ทำไมไม่ใช้ไลบรารี:
 *   - โปรเจคไม่มี build step และเดโมต้องเปิดได้ตอนเน็ตล่ม
 *   - Canvas พิมพ์ไม่ออกและ screen reader มองไม่เห็น
 *
 * หลักการที่ห้ามละเมิด:
 *   1. สีเขียนเป็น var(--token) เสมอ — inline SVG อยู่ใน cascade เดียวกับหน้า
 *      จึง resolve custom property ได้ กราฟจึงไม่มีทางเพี้ยนจาก ds-tokens.css
 *   2. ทุกกราฟต้องมี <title> + legend ข้อความ — ห้ามสื่อความหมายด้วยสีอย่างเดียว
 *      (โปรเจกเตอร์กินสี · อาจถูกพิมพ์ขาวดำ)
 *   3. ไม่มี tooltip (บนโปรเจกเตอร์ไม่มี hover) · ไม่มี animation (ชนกับ slide transition)
 *   4. viewBox + preserveAspectRatio → responsive โดยไม่ต้องมี resize listener
 *
 * ใช้:
 *   DSChart.line(el,  { labels, series:[{name,points,color}], yFmt, area })
 *   DSChart.bars(el,  { labels, series:[{name,values,color}], stacked, yFmt })
 *   DSChart.donut(el, { slices:[{label,value,color}], centerLabel, centerValue })
 *   DSChart.funnel(el,{ steps:[{label,value}] })
 *   DSChart.spark(el, { points, color })
 *   el = HTMLElement หรือ id (string)
 */

const DSChart = {

    /* ลำดับสีหมวดหมู่ — ใช้ตามลำดับนี้เสมอเมื่อ series ไม่ระบุสีเอง */
    PALETTE: ['var(--primary)', 'var(--teal)', 'var(--brand-amber-500)',
              'var(--purple)', 'var(--green)', 'var(--slate)'],

    /* สี 5 ระดับผลตรวจตาม SRS §4 — ห้ามเปลี่ยน ต้องตรงกับ .status-badge บนหน้าเดียวกัน */
    RESULT_COLOR: {
        PASS:    'var(--status-success)',
        WARN:    'var(--status-warning)',
        FIX:     'var(--status-danger)',
        APPROVE: 'var(--status-acknowledged)',
        BLOCK:   'var(--status-danger-strong)',
    },

    /* ── helper ────────────────────────────────────────── */

    _el(t) { return typeof t === 'string' ? document.getElementById(t) : t; },

    _esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    _num(n) { return Math.round(n * 100) / 100; },

    /** เลือกขั้นแกน Y ที่อ่านง่าย (1/2/5 × 10^n) */
    _niceStep(max, want) {
        const raw = max / (want || 4);
        const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
        const n   = raw / mag;
        const mul = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
        return mul * mag;
    },

    /** legend มาตรฐาน — ทุกกราฟต้องเรียกผ่านตัวนี้ */
    _legend(items) {
        return `<ul class="ds-chart-legend">${items.map(i => `
            <li><span class="sw" style="background:${i.color}"></span>
                ${this._esc(i.label)}${i.value != null ? ` <b>${this._esc(i.value)}</b>` : ''}</li>`
        ).join('')}</ul>`;
    },

    _wrap(title, svg, legendHtml) {
        return `<div class="ds-chart" role="img" aria-label="${this._esc(title)}">${svg}</div>${legendHtml || ''}`;
    },

    /* ── กราฟเส้น ──────────────────────────────────────── */
    /**
     * opts: { labels:[], series:[{name, points:[], color?}], height?, area?, yFmt?, yMax? }
     */
    line(target, opts) {
        const el = this._el(target); if (!el) return;
        const W = 720, H = opts.height || 240;
        const P = { t: 16, r: 16, b: 28, l: 46 };
        const iw = W - P.l - P.r, ih = H - P.t - P.b;
        const labels = opts.labels || [];
        const series = (opts.series || []).map((s, i) => ({
            ...s, color: s.color || this.PALETTE[i % this.PALETTE.length],
        }));

        const allV = series.flatMap(s => s.points).filter(v => typeof v === 'number');
        const rawMax = opts.yMax != null ? opts.yMax : Math.max(1, ...allV);
        const step   = this._niceStep(rawMax, 4);
        const yMax   = Math.ceil(rawMax / step) * step;
        const fmt    = opts.yFmt || (v => String(v));

        const x = i => P.l + (labels.length <= 1 ? iw / 2 : (i * iw) / (labels.length - 1));
        const y = v => P.t + ih - (v / yMax) * ih;

        let g = '';
        for (let v = 0; v <= yMax + 1e-9; v += step) {
            g += `<line class="ds-chart-grid" x1="${P.l}" y1="${this._num(y(v))}" x2="${W - P.r}" y2="${this._num(y(v))}"/>`
               + `<text class="ds-chart-axis" x="${P.l - 6}" y="${this._num(y(v)) + 3}" text-anchor="end">${this._esc(fmt(v))}</text>`;
        }

        // ป้ายแกน X — ถ้าจุดเยอะ เว้นระยะให้ไม่ทับกัน
        const skip = Math.ceil(labels.length / 12);
        g += labels.map((L, i) => (i % skip === 0 || i === labels.length - 1)
            ? `<text class="ds-chart-axis" x="${this._num(x(i))}" y="${H - 8}" text-anchor="middle">${this._esc(L)}</text>` : ''
        ).join('');

        const paths = series.map(s => {
            const pts = s.points.map((v, i) => `${this._num(x(i))},${this._num(y(v))}`);
            const d   = 'M' + pts.join(' L');
            const areaD = opts.area
                ? `<path d="${d} L${this._num(x(s.points.length - 1))},${this._num(y(0))} L${this._num(x(0))},${this._num(y(0))} Z"
                         fill="${s.color}" opacity=".10"/>` : '';
            const dots = s.points.map((v, i) =>
                `<circle cx="${this._num(x(i))}" cy="${this._num(y(v))}" r="3" fill="${s.color}"/>`).join('');
            return `${areaD}<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5"
                     stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
        }).join('');

        const title = opts.title || series.map(s => s.name).join(' / ');
        const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
            <title>${this._esc(title)}</title>${g}${paths}</svg>`;

        el.innerHTML = this._wrap(title, svg, this._legend(series.map(s => ({
            label: s.name, color: s.color,
            value: s.points.length ? fmt(s.points[s.points.length - 1]) : null,
        }))));
    },

    /* ── กราฟแท่ง ──────────────────────────────────────── */
    /**
     * opts: { labels:[], series:[{name, values:[], color?}], height?, stacked?, yFmt? }
     */
    bars(target, opts) {
        const el = this._el(target); if (!el) return;
        const W = 720, H = opts.height || 240;
        const P = { t: 16, r: 16, b: 28, l: 52 };
        const iw = W - P.l - P.r, ih = H - P.t - P.b;
        const labels = opts.labels || [];
        const series = (opts.series || []).map((s, i) => ({
            ...s, color: s.color || this.PALETTE[i % this.PALETTE.length],
        }));

        const colTotals = labels.map((_, i) => opts.stacked
            ? series.reduce((a, s) => a + (s.values[i] || 0), 0)
            : Math.max(0, ...series.map(s => s.values[i] || 0)));
        const rawMax = Math.max(1, ...colTotals);
        const step   = this._niceStep(rawMax, 4);
        const yMax   = Math.ceil(rawMax / step) * step;
        const fmt    = opts.yFmt || (v => String(v));

        const y  = v => P.t + ih - (v / yMax) * ih;
        const gw = iw / Math.max(1, labels.length);
        const bw = opts.stacked ? gw * 0.52 : (gw * 0.72) / Math.max(1, series.length);

        let g = '';
        for (let v = 0; v <= yMax + 1e-9; v += step) {
            g += `<line class="ds-chart-grid" x1="${P.l}" y1="${this._num(y(v))}" x2="${W - P.r}" y2="${this._num(y(v))}"/>`
               + `<text class="ds-chart-axis" x="${P.l - 6}" y="${this._num(y(v)) + 3}" text-anchor="end">${this._esc(fmt(v))}</text>`;
        }

        let rects = '';
        labels.forEach((L, i) => {
            const gx = P.l + i * gw;
            if (opts.stacked) {
                let acc = 0;
                series.forEach(s => {
                    const v = s.values[i] || 0;
                    const h = (v / yMax) * ih;
                    rects += `<rect x="${this._num(gx + (gw - bw) / 2)}" y="${this._num(y(acc + v))}"
                                width="${this._num(bw)}" height="${this._num(h)}" fill="${s.color}" rx="2"/>`;
                    acc += v;
                });
            } else {
                const start = gx + (gw - bw * series.length) / 2;
                series.forEach((s, k) => {
                    const v = s.values[i] || 0;
                    const h = (v / yMax) * ih;
                    rects += `<rect x="${this._num(start + k * bw)}" y="${this._num(y(v))}"
                                width="${this._num(bw * 0.88)}" height="${this._num(h)}" fill="${s.color}" rx="2"/>`;
                });
            }
            const skip = Math.ceil(labels.length / 14);
            if (i % skip === 0 || i === labels.length - 1) {
                g += `<text class="ds-chart-axis" x="${this._num(gx + gw / 2)}" y="${H - 8}" text-anchor="middle">${this._esc(L)}</text>`;
            }
        });

        const title = opts.title || series.map(s => s.name).join(' / ');
        const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
            <title>${this._esc(title)}</title>${g}${rects}</svg>`;

        el.innerHTML = this._wrap(title, svg, this._legend(series.map(s => ({
            label: s.name, color: s.color,
            value: fmt(s.values.reduce((a, b) => a + (b || 0), 0)),
        }))));
    },

    /* ── โดนัท ─────────────────────────────────────────── */
    /**
     * opts: { slices:[{label,value,color?}], centerLabel?, centerValue?, height? }
     */
    donut(target, opts) {
        const el = this._el(target); if (!el) return;
        const S = 240, R = 96, r = 62, C = S / 2;
        const slices = (opts.slices || []).map((s, i) => ({
            ...s, color: s.color || this.PALETTE[i % this.PALETTE.length],
        }));
        const total = slices.reduce((a, s) => a + (s.value || 0), 0) || 1;

        let a0 = -Math.PI / 2;
        const arcs = slices.map(s => {
            const frac = (s.value || 0) / total;
            const a1   = a0 + frac * Math.PI * 2;
            // วงกลมเต็มวาดด้วย path เดียวไม่ได้ — ตัดเป็น 2 ครึ่งเมื่อ frac ≈ 1
            const big  = frac > 0.5 ? 1 : 0;
            const p = (ang, rad) => `${this._num(C + rad * Math.cos(ang))},${this._num(C + rad * Math.sin(ang))}`;
            const d = frac >= 0.999
                ? `M${C - R},${C} A${R},${R} 0 1 1 ${C + R},${C} A${R},${R} 0 1 1 ${C - R},${C}
                   M${C - r},${C} A${r},${r} 0 1 0 ${C + r},${C} A${r},${r} 0 1 0 ${C - r},${C}`
                : `M${p(a0, R)} A${R},${R} 0 ${big} 1 ${p(a1, R)} L${p(a1, r)} A${r},${r} 0 ${big} 0 ${p(a0, r)} Z`;
            a0 = a1;
            return `<path d="${d}" fill="${s.color}" fill-rule="evenodd"/>`;
        }).join('');

        const center = (opts.centerValue != null || opts.centerLabel)
            ? `<text x="${C}" y="${C - 2}" text-anchor="middle"
                  style="font-size:26px;font-weight:800;fill:var(--brand-navy)">${this._esc(opts.centerValue || '')}</text>
               <text x="${C}" y="${C + 18}" text-anchor="middle" class="ds-chart-axis">${this._esc(opts.centerLabel || '')}</text>` : '';

        const title = opts.title || 'สัดส่วน';
        const svg = `<svg viewBox="0 0 ${S} ${S}" preserveAspectRatio="xMidYMid meet" style="max-width:240px;margin:0 auto">
            <title>${this._esc(title)}</title>${arcs}${center}</svg>`;

        el.innerHTML = this._wrap(title, svg, this._legend(slices.map(s => ({
            label: s.label, color: s.color,
            value: `${s.value} (${Math.round((s.value / total) * 100)}%)`,
        }))));
    },

    /* ── กรวย (ปริมาณตามขั้นของ pipeline) ─────────────── */
    funnel(target, opts) {
        const el = this._el(target); if (!el) return;
        const steps = opts.steps || [];
        const W = 720, rowH = 34, H = steps.length * rowH + 12;
        const max = Math.max(1, ...steps.map(s => s.value || 0));
        const labelW = 190, barW = W - labelW - 90;

        const rows = steps.map((s, i) => {
            const w = ((s.value || 0) / max) * barW;
            const color = s.color || this.PALETTE[i % this.PALETTE.length];
            const y = i * rowH + 8;
            return `<text class="ds-chart-axis" x="${labelW - 10}" y="${y + 15}" text-anchor="end"
                       style="font-size:11px;fill:var(--text-primary)">${this._esc(s.label)}</text>
                    <rect x="${labelW}" y="${y + 3}" width="${this._num(Math.max(w, 2))}" height="16" rx="3" fill="${color}"/>
                    <text class="ds-chart-value" x="${this._num(labelW + Math.max(w, 2) + 8)}" y="${y + 15}">${this._esc(s.display != null ? s.display : s.value)}</text>`;
        }).join('');

        const title = opts.title || 'ปริมาณตามขั้นตอน';
        const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
            <title>${this._esc(title)}</title>${rows}</svg>`;
        el.innerHTML = this._wrap(title, svg, '');
    },

    /* ── เส้นจิ๋วใน KPI ────────────────────────────────── */
    spark(target, opts) {
        const el = this._el(target); if (!el) return;
        const pts = opts.points || [];
        if (pts.length < 2) { el.innerHTML = ''; return; }
        const W = 100, H = 28;
        const mn = Math.min(...pts), mx = Math.max(...pts), rng = (mx - mn) || 1;
        const d = pts.map((v, i) =>
            `${this._num((i / (pts.length - 1)) * W)},${this._num(H - ((v - mn) / rng) * (H - 4) - 2)}`).join(' L');
        el.innerHTML = `<div class="ds-chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:28px">
            <title>${this._esc(opts.title || 'แนวโน้ม')}</title>
            <path d="M${d}" fill="none" stroke="${opts.color || 'var(--primary)'}" stroke-width="2"
                  stroke-linejoin="round" stroke-linecap="round"/></svg></div>`;
    },

    /* ── แถบวัดแบบ CSS (คืน HTML string ให้เอาไปวางในเซลล์ตาราง) ── */

    /** คะแนนความเสี่ยง 0–100 */
    riskbar(score) {
        const s = Math.max(0, Math.min(100, Number(score) || 0));
        const tone = s >= 70 ? 'high' : s >= 40 ? 'mid' : '';
        return `<span class="ds-riskbar ${tone}">
            <span class="ds-riskbar-track"><span class="ds-riskbar-fill" style="width:${s}%"></span></span>
            <span class="ds-riskbar-num">${s}</span></span>`;
    },

    /** แถบแนวนอนทั่วไป · tone: '' | success | warning | danger | accent */
    hbar(pct, display, tone) {
        const p = Math.max(0, Math.min(100, Number(pct) || 0));
        return `<span class="ds-hbar ${tone || ''}">
            <span class="ds-hbar-track"><span class="ds-hbar-fill" style="width:${p}%"></span></span>
            <span class="ds-hbar-num">${this._esc(display != null ? display : p + '%')}</span></span>`;
    },
};

window.DSChart = DSChart;
