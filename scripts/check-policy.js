#!/usr/bin/env node
// ============================================================
// ตรวจว่าทุก route ที่ mount จริงมีกฎสิทธิ์ครอบคลุม
//
// นี่คือเหตุผลที่ policy รวมไว้ในตารางเดียว — เขียนเทสต์แบบนี้กับ requireRole
// ที่กระจายตาม router ไม่ได้ เพิ่ม endpoint ใหม่โดยไม่กำหนดสิทธิ์ = สคริปต์นี้แดง
//
//   npm run check:policy          — สรุปอย่างเดียว
//   npm run check:policy -- --all — พิมพ์ตาราง route → role ทั้งหมด
// ============================================================
const path = require('path');
// ต้องโหลด .env ก่อน require router — router ดึง database/connection.js ซึ่งบังคับให้มี DB_NAME
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { match } = require('../src/middleware/policy');

// ต้องตรงกับลำดับ mount ใน server.js — เพิ่ม router ใหม่ต้องเพิ่มที่นี่ด้วย
const MOUNTS = [
    ['/api/auth',      'auth'],
    ['/api/settings',  'settings'],
    ['/api/registry',  'registry'],
    ['/api/reference', 'reference'],
];

const showAll = process.argv.includes('--all');
const routes = [];
const loadErrors = [];

for (const [prefix, file] of MOUNTS) {
    let r;
    try { r = require(path.join(__dirname, '..', 'src', 'routes', file)); }
    catch (e) { loadErrors.push(`${file}: ${e.message}`); continue; }

    const stack = (r && r.stack) || (r && r.router && r.router.stack) || [];
    for (const layer of stack) {
        if (!layer.route) continue;
        for (const m of Object.keys(layer.route.methods)) {
            if (m === '_all') continue;
            const sub = layer.route.path === '/' ? '' : layer.route.path;
            routes.push({
                method: m.toUpperCase(),
                // path ที่ policy จะเห็น = ตัด '/api' ออก
                policyPath: prefix.replace(/^\/api/, '') + sub,
                full: prefix + sub,
                file,
            });
        }
    }
}

const uncovered = [];
const table = [];
for (const r of routes) {
    const rule = match(r.method, r.policyPath);
    if (rule.fallthrough) uncovered.push(r);
    else table.push({ ...r, roles: rule.public ? 'PUBLIC' : rule.roles.join(',') });
}

if (showAll) {
    table.sort((a, b) => a.full.localeCompare(b.full) || a.method.localeCompare(b.method));
    for (const t of table) {
        console.log(`  ${t.method.padEnd(7)} ${t.full.padEnd(58)} ${t.roles}`);
    }
    console.log();
}

console.log(`routes ทั้งหมด : ${routes.length} จาก ${MOUNTS.length} mount`);
console.log(`มีกฎครอบคลุม  : ${table.length}`);
console.log(`ไม่มีกฎ        : ${uncovered.length}`);

if (loadErrors.length) {
    console.log(`\n⚠ โหลด router ไม่ได้ ${loadErrors.length} ไฟล์:`);
    loadErrors.forEach(e => console.log(`   ${e}`));
}

if (uncovered.length) {
    console.error('\n❌ route ที่ยังไม่ได้กำหนดสิทธิ์ (จะถูกปฏิเสธด้วย NO_POLICY):');
    uncovered.forEach(r => console.error(`   ${r.method.padEnd(7)} ${r.full}   [${r.file}]`));
    console.error('\n→ เพิ่มกฎใน src/middleware/policy.js ก่อน merge');
    process.exit(1);
}

if (loadErrors.length) process.exit(1);
console.log('\n✅ ทุก route มีกฎสิทธิ์ครอบคลุม');
