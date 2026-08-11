/**
 * nhso-16files.js — ตัวอ่านแฟ้มมาตรฐาน 16 แฟ้ม (e-Claim) ส่วนผู้ป่วยใน
 *
 * รับเนื้อไฟล์เป็นข้อความ (จาก UI อ่านด้วย FileReader แล้ว POST มา — โปรเจค
 * freeze dependencies จึงไม่ใช้ multipart) แล้วประกอบเป็นเคสพร้อมเขียนลง
 * ipd_admissions + ตารางลูก
 *
 * แฟ้มที่รองรับ (IPD ก่อน — OPD รอเฟสถัดไป):
 *   IPD  บังคับ — 1 แถว = 1 admission (AN เป็นคีย์)
 *   PAT  ข้อมูลผู้ป่วย (จับคู่ด้วย HN)          — optional
 *   INS  สิทธิการรักษา (จับคู่ AN แล้วค่อย HN)   — optional
 *   IDX  การวินิจฉัย (DXTYPE 1=หลัก, อื่น=รอง)   — optional
 *   IOP  หัตถการ ICD-9-CM                       — optional
 *   CHA  ค่าใช้จ่ายรายหมวด CHRGITEM             — optional
 *
 * ความทนทานที่ตั้งใจ: คั่นด้วย | หรือ , หรือ tab ก็ได้ (ดูจากแถวหัว) ·
 * วันที่รับทั้ง YYYYMMDD และ YYYY-MM-DD ทั้ง พ.ศ./ค.ศ. (DB เก็บ ค.ศ. เสมอ) ·
 * ชื่อคอลัมน์ไม่สนตัวพิมพ์เล็ก-ใหญ่ · แถวที่ขาดคีย์ถูกข้ามพร้อมเหตุผล
 */

/* หมวดค่าใช้จ่าย CHRGITEM ตามโครงแฟ้ม CHA (16 แฟ้ม) */
const CHRGITEM_LABELS = {
    '01': 'ค่าห้อง/ค่าอาหาร',
    '02': 'อวัยวะเทียม/อุปกรณ์ในการบำบัดรักษา',
    '03': 'ยาและสารอาหารทางเส้นเลือดที่ใช้ในโรงพยาบาล',
    '04': 'ยาที่นำไปใช้ต่อที่บ้าน',
    '05': 'เวชภัณฑ์ที่ไม่ใช่ยา',
    '06': 'บริการโลหิตและส่วนประกอบของโลหิต',
    '07': 'ตรวจวินิจฉัยทางเทคนิคการแพทย์และพยาธิวิทยา',
    '08': 'ตรวจวินิจฉัยและรักษาทางรังสีวิทยา',
    '09': 'ตรวจวินิจฉัยโดยวิธีพิเศษอื่น ๆ',
    '10': 'อุปกรณ์และเครื่องมือทางการแพทย์',
    '11': 'ทำหัตถการและวิสัญญี',
    '12': 'ค่าบริการทางการพยาบาล',
    '13': 'บริการทางทันตกรรม',
    '14': 'กายภาพบำบัดและเวชกรรมฟื้นฟู',
    '15': 'บริการฝังเข็มและแพทย์แผนไทย',
    '16': 'ค่าห้องผ่าตัดและห้องคลอด',
    '17': 'ค่าธรรมเนียมบุคลากรทางการแพทย์',
    '18': 'บริการอื่น ๆ ที่เกี่ยวกับการรักษาพยาบาล',
    '19': 'บริการอื่น ๆ ที่ไม่เกี่ยวกับการรักษาพยาบาล',
};

/* สิทธิใน INS.INSCL → รหัสสิทธิที่หน้าจอใช้ */
const INSCL_TO_PAYER = { UCS: 'UC', WEL: 'UC', OFC: 'OFC', SSS: 'SSS', LGO: 'LGO', SSI: 'SSS' };

const S = v => { const s = String(v == null ? '' : v).trim(); return s === '' ? null : s; };
const N = v => { const s = S(v); if (s == null) return null; const n = Number(s); return isFinite(n) ? n : null; };

/** YYYYMMDD / YYYY-MM-DD · พ.ศ. หรือ ค.ศ. → 'YYYY-MM-DD' (ค.ศ.) หรือ null */
function ceDate(v) {
    const s = String(v || '').trim().replace(/-/g, '');
    if (!/^\d{8}$/.test(s)) return null;
    let y = parseInt(s.slice(0, 4), 10);
    if (y > 2400) y -= 543;
    return `${y}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** HHMM / HH:MM → 'HH:MM' หรือ '00:00' */
function hhmm(v) {
    const s = String(v || '').trim().replace(':', '');
    if (!/^\d{3,4}$/.test(s)) return '00:00';
    const p = s.padStart(4, '0');
    return `${p.slice(0, 2)}:${p.slice(2)}`;
}

/**
 * อ่านข้อความแฟ้มเป็น array ของ object (คีย์จากแถวหัว, UPPERCASE)
 * ตัวคั่นเดาจากแถวหัว: | ก่อน แล้ว tab แล้ว comma
 */
function parseDelimited(text) {
    const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/)
        .filter(l => l.trim() !== '');
    if (lines.length < 2) return { header: [], rows: [] };
    const head = lines[0];
    const delim = head.includes('|') ? '|' : head.includes('\t') ? '\t' : ',';
    const header = head.split(delim).map(h => h.trim().toUpperCase());
    const rows = lines.slice(1).map(line => {
        const cells = line.split(delim);
        const o = {};
        header.forEach((h, i) => { o[h] = cells[i] !== undefined ? cells[i].trim() : ''; });
        return o;
    });
    return { header, rows };
}

/**
 * ประกอบเคสผู้ป่วยในจากแฟ้มที่ส่งมา
 * @param {object} files { IPD, PAT?, INS?, IDX?, IOP?, CHA? } — เนื้อไฟล์เป็น string
 * @returns {{ cases: Array, skipped: Array<string> }}
 */
function buildIpdCases(files) {
    const skipped = [];
    const get = key => parseDelimited(files[key] || '').rows;

    const ipdRows = get('IPD');
    if (!ipdRows.length) {
        const e = new Error('ต้องมีแฟ้ม IPD อย่างน้อย 1 แถว (1 แถว = 1 admission)');
        e.status = 400;
        throw e;
    }

    /* ดัชนีแฟ้มประกอบ */
    const patByHn = new Map();
    for (const r of get('PAT')) { const hn = S(r.HN); if (hn) patByHn.set(hn, r); }

    const insByAn = new Map(), insByHn = new Map();
    for (const r of get('INS')) {
        const an = S(r.AN), hn = S(r.HN);
        if (an && !insByAn.has(an)) insByAn.set(an, r);
        if (hn && !insByHn.has(hn)) insByHn.set(hn, r);
    }

    const group = (rows, keyFn) => {
        const m = new Map();
        rows.forEach(r => {
            const k = keyFn(r);
            if (!k) return;
            if (!m.has(k)) m.set(k, []);
            m.get(k).push(r);
        });
        return m;
    };
    const dxByAn  = group(get('IDX'), r => S(r.AN));
    const opByAn  = group(get('IOP'), r => S(r.AN));
    const chaByAn = group(get('CHA'), r => S(r.AN));

    const cases = [];
    const seen = new Set();
    ipdRows.forEach((r, i) => {
        const an = S(r.AN), hn = S(r.HN);
        const admitDate = ceDate(r.DATEADM);
        if (!an || !hn) { skipped.push(`IPD แถว ${i + 2}: ไม่มี AN/HN`); return; }
        if (seen.has(an)) { skipped.push(`IPD แถว ${i + 2}: AN ${an} ซ้ำในไฟล์`); return; }
        if (!admitDate)   { skipped.push(`IPD แถว ${i + 2}: DATEADM "${r.DATEADM || ''}" อ่านไม่ได้`); return; }
        seen.add(an);

        const pat = patByHn.get(hn) || {};
        const ins = insByAn.get(an) || insByHn.get(hn) || {};
        const dischDate = ceDate(r.DATEDSC);

        /* ชื่อ: PAT รุ่นแยกช่อง (TITLE/FNAME/LNAME) หรือรุ่นรวม (NAMEPAT) */
        const name = [S(pat.TITLE), S(pat.FNAME), S(pat.LNAME)].filter(Boolean).join(' ').replace(' ', '')
            || S(pat.NAMEPAT) || `ไม่ทราบชื่อ (นำเข้า AN ${an})`;
        const sexRaw = String(pat.SEX || '').trim();

        const dxRows = (dxByAn.get(an) || []);
        const pdxRow = dxRows.find(d => String(d.DXTYPE).trim() === '1') || null;
        const sdx = dxRows.filter(d => d !== pdxRow && S(d.DIAG))
                          .map(d => ({ code: S(d.DIAG), name: null }));
        const proc = (opByAn.get(an) || []).filter(d => S(d.OPER))
            .map(p => ({ code: S(p.OPER), name: null, date: ceDate(p.DATEIN) }));
        const charges = (chaByAn.get(an) || [])
            .filter(c => N(c.AMOUNT) != null)
            .map(c => {
                const item = String(c.CHRGITEM || '').trim().padStart(2, '0');
                return { billgrcs: item, name: CHRGITEM_LABELS[item] || `หมวด ${item}`,
                         amount: N(c.AMOUNT), qty: N(c.QTY) };
            });

        const leaveDays = N(r.LEAVEDAY) || 0;
        /* แฟ้ม (ตามโครง 15 แฟ้ม NHSO DP) ที่ "มีข้อมูลจริง" จากรอบนำเข้านี้ */
        const filesSent = [1, 2, 3,
            ...(dxRows.length ? [5] : []), ...(proc.length ? [6] : []),
            ...(charges.length ? [7, 8] : []), 14];

        cases.push({
            an, hn,
            patient_name: name,
            cid: S(pat.PERSON_ID) || S(pat.CID) || S(ins.CID),
            birth_date: ceDate(pat.DOB),
            sex: sexRaw === '1' ? 'M' : sexRaw === '2' ? 'F' : null,
            payer: INSCL_TO_PAYER[String(ins.INSCL || '').trim().toUpperCase()] || null,
            ward: S(r.WARDDSC),
            admit_at: `${admitDate} ${hhmm(r.TIMEADM)}:00`,
            discharge_at: dischDate ? `${dischDate} ${hhmm(r.TIMEDSC)}:00` : null,
            discharge_type: S(r.DISCHT),
            discharge_status: S(r.DISCHS),
            leave_days: leaveDays,
            drg_code: S(r.DRG),
            files_sent: filesSent,
            file_ctx: { emergency: false, prenatal: false, newborn: false,
                        psych: false, disability: false, leaveDay: leaveDays > 0 },
            pdx: pdxRow && S(pdxRow.DIAG) ? { code: S(pdxRow.DIAG), name: null } : null,
            sdx, proc, charges,
        });
    });

    return { cases, skipped };
}

module.exports = { parseDelimited, buildIpdCases, ceDate, CHRGITEM_LABELS };
