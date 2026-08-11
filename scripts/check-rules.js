#!/usr/bin/env node
// ============================================================
// ตรวจว่าคลังกฎในฐานข้อมูลกับตัวตรวจในโค้ดยังตรงกัน
//
// คู่กับ check-policy.js — อันนั้นกันสิทธิ์หลุด อันนี้กัน "กฎโกหก":
//   1. check_key ในฐานข้อมูลที่ไม่มีใน CHECKERS  → กฎจะพังตอนรันจริง
//   2. กฎ ACTIVE ที่ blocked_by ชี้เอกสารซึ่งมาแล้ว (PRESENT) แต่ยังไม่มี check_key
//      → เอกสารมาแล้วแต่ไม่มีใครกลับมาต่อตัวตรวจ ช่องโหว่นี้เงียบมาก
//
//   npm run check:rules
//   npm run check:rules -- --all   พิมพ์ตารางกฎทั้งหมด
// ============================================================
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const { checkerKeys } = require('../src/services/rule-runner');

const showAll = process.argv.includes('--all');

(async () => {
    const conn = await mysql.createConnection({
        host:     process.env.DB_HOST || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 3306,
        user:     process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'medicore_rcm',
    });

    try {
        const [rows] = await conn.query(
            `SELECT rv.rule_code, rv.version, rv.status, rv.check_key, rv.blocked_by,
                    rd.name, ds.status AS blocker_status
             FROM rule_versions rv
             JOIN rule_definitions rd ON rd.rule_code = rv.rule_code
             LEFT JOIN ref_doc_sources ds ON ds.doc_id = rv.blocked_by
             WHERE rv.is_active = 1 AND rd.is_active = 1
               AND rv.version = (SELECT MAX(v2.version) FROM rule_versions v2
                                 WHERE v2.rule_code = rv.rule_code AND v2.is_active = 1)
             ORDER BY rv.rule_code`
        );
        if (!rows.length) {
            console.error('❌ ไม่พบกฎในฐานข้อมูล — รัน npm run seed:rules ก่อน');
            process.exit(1);
        }

        const known = new Set(checkerKeys());
        const missingChecker = [];   // ปัญหาที่ 1
        const staleBlocked   = [];   // ปัญหาที่ 2
        const table = [];

        for (const r of rows) {
            let state;
            if (r.blocked_by && r.blocker_status !== 'PRESENT') state = 'รอเอกสาร';
            else if (!r.check_key)                              state = 'ยังไม่มีตัวตรวจ';
            else if (!known.has(r.check_key))                   state = 'ตัวตรวจหาย';
            else                                                state = 'ตรวจจริง';

            if (state === 'ตัวตรวจหาย') missingChecker.push(r);
            if (r.status === 'ACTIVE' && r.blocked_by && r.blocker_status === 'PRESENT' && !r.check_key) {
                staleBlocked.push(r);
            }
            table.push({ ...r, state });
        }

        if (showAll) {
            for (const t of table) {
                console.log(`  ${t.rule_code.padEnd(14)} v${String(t.version).padEnd(2)} ` +
                            `${t.status.padEnd(8)} ${t.state.padEnd(16)} ${t.check_key || '-'}`);
            }
            console.log();
        }

        const active = table.filter(t => t.status === 'ACTIVE');
        const exec   = active.filter(t => t.state === 'ตรวจจริง').length;
        const pct    = active.length ? Math.round((exec / active.length) * 100) : 0;

        console.log(`กฎทั้งหมด        : ${table.length} ข้อ (ACTIVE ${active.length})`);
        console.log(`ตัวตรวจในโค้ด    : ${known.size} ตัว`);
        console.log(`ตรวจจริง         : ${exec} / ${active.length} กฎ ACTIVE (${pct}%)`);
        console.log(`ยังไม่มีตัวตรวจ   : ${active.filter(t => t.state === 'ยังไม่มีตัวตรวจ').length}`);
        console.log(`รอเอกสารอ้างอิง  : ${active.filter(t => t.state === 'รอเอกสาร').length}`);

        let bad = false;
        if (missingChecker.length) {
            bad = true;
            console.error(`\n❌ กฎที่อ้างตัวตรวจซึ่งไม่มีในโค้ด ${missingChecker.length} ข้อ:`);
            missingChecker.forEach(r => console.error(`   ${r.rule_code} → check_key "${r.check_key}"`));
            console.error('\n→ เพิ่มตัวตรวจใน CHECKERS ของ src/services/rule-runner.js หรือแก้ค่าใน data/reference/rule-versions.csv');
        }
        if (staleBlocked.length) {
            bad = true;
            console.error(`\n❌ กฎที่เอกสารอ้างอิงมาแล้วแต่ยังไม่ได้ต่อตัวตรวจ ${staleBlocked.length} ข้อ:`);
            staleBlocked.forEach(r => console.error(`   ${r.rule_code} (เอกสาร ${r.blocked_by} พร้อมแล้ว)`));
            console.error('\n→ ผูก check_key ให้กฎเหล่านี้ หรือเปลี่ยนสถานะเอกสารให้ตรงความจริง');
        }
        if (bad) process.exit(1);

        console.log('\n✅ คลังกฎกับตัวตรวจในโค้ดตรงกัน');
    } catch (err) {
        console.error('❌ check-rules ล้มเหลว:', err.message);
        process.exit(1);
    } finally {
        await conn.end();
    }
})();
