/**
 * csv.js — ตัวอ่าน CSV ฝั่งเซิร์ฟเวอร์
 * port มาจาก public/js/ipd-reference.js parseCsv() (BOM · CRLF · ค่าที่ใส่เครื่องหมายคำพูด)
 * ตั้งใจไม่ใช้ไลบรารีภายนอก — โปรเจคนี้ freeze dependencies
 */

/** แปลงข้อความ CSV เป็น array ของแถว (array ของ string ที่ trim แล้ว) */
function parseCsv(text) {
    const src = String(text).replace(/^﻿/, '');
    const rows = [];
    let row = [], cell = '', quoted = false;

    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (quoted) {
            if (c === '"') {
                if (src[i + 1] === '"') { cell += '"'; i++; }   /* "" = อัญประกาศจริง */
                else quoted = false;
            } else cell += c;
            continue;
        }
        if (c === '"') { quoted = true; continue; }
        if (c === ',')  { row.push(cell); cell = ''; continue; }
        if (c === '\r') continue;
        if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
        cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }

    return rows.filter(r => r.some(v => String(v).trim() !== ''))
               .map(r => r.map(v => v.trim()));
}

/**
 * อ่าน CSV เป็น array ของ object โดยใช้แถวแรกเป็นชื่อคอลัมน์
 * ค่าว่าง ('') คงเป็น '' — ผู้เรียกตัดสินใจเองว่าจะแปลงเป็น NULL
 */
function parseCsvObjects(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) return { header: rows[0] || [], records: [] };
    const header = rows[0].map(h => h.toLowerCase());
    const records = rows.slice(1).map(r => {
        const o = {};
        header.forEach((h, i) => { o[h] = r[i] !== undefined ? r[i] : ''; });
        return o;
    });
    return { header, records };
}

/**
 * แปลงวันที่จาก CSV เป็น ค.ศ. (YYYY-MM-DD) หรือ null
 * รองรับปี พ.ศ. (> 2400) — ลบ 543 ให้อัตโนมัติ
 */
function toCEDate(v) {
    const s = String(v || '').trim();
    if (!s) return null;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    let y = parseInt(m[1], 10);
    if (y > 2400) y -= 543;
    return `${y}-${m[2]}-${m[3]}`;
}

module.exports = { parseCsv, parseCsvObjects, toCEDate };
