/**
 * MediCore RCM — MOCK HIS EXTRACT (ดึงเวชระเบียนจากระบบ HIS เข้าฟอร์ม)
 * ------------------------------------------------------------
 * เดิมเจ้าหน้าที่ต้องเปิด HIS อีกจอแล้วพิมพ์ซ้ำเข้าฟอร์มส่งต่อ ซึ่งช้าและพิมพ์ตกหล่น
 * โมดูลนี้จำลอง "การดึงข้อมูลรายหมวด" — ผู้ใช้เลือกเฉพาะหมวดที่ต้องการ
 * แล้วระบบเติมลงหัวข้อของสรุปทางคลินิกให้ตามที่ HIS_SECTIONS[].target กำหนด
 *
 * ⭐ ข้อมูลที่คืนออกไป "ฉายจากของที่ระบบรู้อยู่แล้ว" เป็นหลัก — dx / หัตถการ /
 *    เอกสาร / ค่าใช้จ่าย ดึงจาก MockRefer + MockClaims ของ HN นั้นตรง ๆ
 *    จึงไม่มีทางขัดกับข้อมูลบนหน้าจออื่น ส่วนที่ระบบไม่มีจริง (ผล Lab เชิงตัวเลข
 *    สัญญาณชีพ ชื่อยา) เติมจากเทมเพลตตามกลุ่มโรค แบบ deterministic ด้วย HN
 *    เปิดหน้าเดิมกี่ครั้งก็ได้ค่าเดิม ไม่แกว่งกลางการนำเสนอ
 *
 * ⚠️ ความถูกต้องของข้อมูล — ค่าตัวเลขทางคลินิกในไฟล์นี้เป็นค่าจำลองเพื่อสาธิต
 *    ไม่ได้ต่อกับ HIS จริงและไม่ได้ถอดจากเวชระเบียนของผู้ป่วยจริง
 *    ทุกจอที่แสดงต้องขึ้นป้าย HIS_SIMULATED_NOTE — แนวเดียวกับที่ mock-ipd.js
 *    ทำกับค่า Thai DRG และ mock-nhso.js ทำกับรหัสสถานะ สปสช.
 *    เมื่อต่อ HIS จริง ให้แทน MockHIS.extract() ด้วย fetch('/api/his/extract?hn=')
 *    โดยคงรูปคืนค่าเดิม ({ found, patient, sections[] }) หน้าจอจะไม่ต้องแก้เลย
 *
 * ต้องโหลดหลัง mock-claims.js และ mock-referrals.js
 *
 * วันอ้างอิง: 6 ส.ค. 2569 (MockDB.TODAY) · วันที่ทั้งไฟล์เป็น พ.ศ.
 */

const HIS_SIMULATED_NOTE =
    'ค่าจำลองเพื่อสาธิต — ยังไม่ได้ต่อกับ HIS จริง ต้องตรวจกับเวชระเบียนก่อนใช้จริง';

/**
 * หมวดข้อมูลที่ดึงได้ — เรียงตามลำดับที่ควรอ่านในเวชระเบียน
 *   target = หัวข้อปลายทางใน clinical_review (คีย์ของ REFER_REVIEW_PARTS)
 *   ผู้ใช้เปลี่ยนปลายทางรายหมวดได้ตอนดึง ค่านี้เป็นแค่ค่าตั้งต้นที่ถูกบ่อยที่สุด
 */
const HIS_SECTIONS = [
    { key: 'hpi',        target: 'history',   icon: 'clipboard-list', source: 'OPD / IPD Note',
      label: 'อาการสำคัญและประวัติปัจจุบัน' },
    { key: 'diagnosis',  target: 'history',   icon: 'file-text',      source: 'เวชระเบียน',
      label: 'การวินิจฉัย (ICD-10)' },
    { key: 'comorbid',   target: 'history',   icon: 'heart-pulse',    source: 'เวชระเบียน',
      label: 'โรคร่วมและประวัติแพ้ยา' },
    { key: 'vitals',     target: 'findings',  icon: 'activity',       source: 'ห้องตรวจ',
      label: 'สัญญาณชีพครั้งล่าสุด' },
    { key: 'lab',        target: 'findings',  icon: 'flask-conical',  source: 'ระบบห้องปฏิบัติการ (LIS)',
      label: 'ผลตรวจทางห้องปฏิบัติการ' },
    { key: 'imaging',    target: 'findings',  icon: 'scan-line',      source: 'ระบบรังสีวิทยา (RIS/PACS)',
      label: 'ผลตรวจทางรังสีและภาพวินิจฉัย' },
    { key: 'medication', target: 'treatment', icon: 'pill',           source: 'ห้องยา',
      label: 'ยาที่ได้รับปัจจุบัน' },
    { key: 'procedure',  target: 'treatment', icon: 'stethoscope',    source: 'ห้องผ่าตัด / หัตถการ',
      label: 'หัตถการและการรักษาที่ทำแล้ว' },
    { key: 'visit',      target: 'treatment', icon: 'history',        source: 'เวชระเบียน',
      label: 'ประวัติการมารับบริการย้อนหลัง' },
];

/**
 * เทมเพลตทางคลินิกตามกลุ่มโรค — คีย์คือ prefix ของรหัส ICD-10
 * ค้นแบบยาวสุดก่อน (N18 ชนะ N1) เพื่อให้เจาะจงกว่าชนะเสมอ
 */
const HIS_DX_TEMPLATES = {
    N18: {
        cc: 'บวมที่ขาทั้งสองข้าง เหนื่อยง่าย ปัสสาวะเป็นฟอง',
        lab: ['Creatinine 3.10 mg/dL (ค่าปกติ 0.7–1.3)', 'eGFR 19 mL/min/1.73m²',
              'BUN 42 mg/dL', 'Potassium 5.4 mEq/L', 'Hemoglobin 9.2 g/dL',
              'Urine protein/creatinine ratio 2.8 g/g'],
        img: ['อัลตราซาวด์ไต: ไตทั้งสองข้างขนาดเล็กลง เนื้อไตบางและ echogenicity เพิ่มขึ้น'],
        med: ['Losartan 100 mg วันละ 1 ครั้ง', 'Furosemide 40 mg วันละ 2 ครั้ง',
              'Sodium bicarbonate 600 mg วันละ 3 ครั้ง', 'Erythropoietin 4,000 U สัปดาห์ละ 2 ครั้ง'],
    },
    I25: {
        cc: 'เจ็บแน่นหน้าอกขณะออกแรง ร้าวไปแขนซ้าย เดินได้ไม่ถึง 100 เมตรต้องหยุดพัก',
        lab: ['Troponin-I 0.04 ng/mL (ไม่สูง)', 'LDL-cholesterol 148 mg/dL',
              'HbA1c 7.8%', 'Creatinine 1.10 mg/dL'],
        img: ['EKG: ST depression ที่ lead V4–V6 ขณะมีอาการ',
              'Echocardiogram: EF 48% · ผนังหัวใจด้านหน้าบีบตัวลดลง',
              'สวนหัวใจ (CAG): LAD ตีบ 90%, LCx 75%, RCA 80% — 3-vessel disease'],
        med: ['Aspirin 81 mg วันละ 1 ครั้ง', 'Clopidogrel 75 mg วันละ 1 ครั้ง',
              'Atorvastatin 40 mg ก่อนนอน', 'Metoprolol 50 mg วันละ 2 ครั้ง',
              'Isosorbide dinitrate 10 mg วันละ 3 ครั้ง'],
    },
    I35: {
        cc: 'เหนื่อยง่ายเวลาออกแรง หน้ามืดคล้ายจะเป็นลม นอนราบไม่ได้ต้องหนุนหมอน 2 ใบ',
        lab: ['NT-proBNP 2,480 pg/mL', 'Creatinine 1.20 mg/dL', 'Hemoglobin 11.8 g/dL'],
        img: ['Echocardiogram: aortic valve area 0.7 cm² · mean gradient 52 mmHg — severe AS · EF 42%',
              'ภาพรังสีทรวงอก: หัวใจโต และมีน้ำท่วมปอดเล็กน้อย'],
        med: ['Furosemide 40 mg วันละ 1 ครั้ง', 'Spironolactone 25 mg วันละ 1 ครั้ง',
              'Enalapril 5 mg วันละ 2 ครั้ง'],
    },
    S06: {
        cc: 'ประสบอุบัติเหตุจราจร ไม่สวมหมวกนิรภัย ซึมลง เรียกไม่ค่อยรู้สึกตัว',
        lab: ['Hematocrit 34%', 'Platelet 210,000 /µL', 'INR 1.1', 'Blood glucose 156 mg/dL'],
        img: ['CT สมองไม่ฉีดสี: acute subdural hematoma ซีกขวา หนา 12 มม. · midline shift 7 มม.',
              'กะโหลกร้าวบริเวณ vault ด้านขวา'],
        med: ['3% NaCl 250 mL หยดทางหลอดเลือดดำ', 'Phenytoin 100 mg ทุก 8 ชั่วโมง',
              'Paracetamol 1 g ทุก 6 ชั่วโมงเมื่อมีไข้'],
    },
    M17: {
        cc: 'ปวดเข่าทั้งสองข้างเวลาเดินและขึ้นบันได เป็นมากขึ้นในช่วง 2 ปี',
        lab: ['ESR 28 mm/hr', 'CRP 6.2 mg/L', 'Creatinine 0.90 mg/dL'],
        img: ['ภาพรังสีเข่าทั้งสองข้าง: ช่องข้อแคบลงมาก มีกระดูกงอกรอบข้อ — Kellgren-Lawrence grade 4'],
        med: ['Naproxen 250 mg วันละ 2 ครั้งหลังอาหาร', 'Paracetamol 500 mg เมื่อปวด',
              'Glucosamine sulfate 1,500 mg วันละ 1 ครั้ง'],
    },
    E11: {
        cc: 'น้ำตาลในเลือดสูงเรื้อรัง ควบคุมด้วยยากินได้ไม่ดี มีอาการชาปลายเท้า',
        lab: ['HbA1c 8.6%', 'Fasting plasma glucose 178 mg/dL',
              'Urine microalbumin 180 mg/g creatinine', 'LDL-cholesterol 132 mg/dL'],
        img: ['ตรวจจอประสาทตา: พบ non-proliferative diabetic retinopathy ระดับปานกลาง'],
        med: ['Metformin 1,000 mg วันละ 2 ครั้ง', 'Glipizide 5 mg ก่อนอาหารเช้า',
              'Insulin glargine 18 ยูนิต ก่อนนอน'],
    },
};

/** ใช้เมื่อไม่มีเทมเพลตตรงกลุ่มโรค — ยังคืนของที่ระบบรู้จริงได้ครบ */
const HIS_FALLBACK = {
    cc:  'มารับบริการตามนัดติดตามอาการ',
    lab: ['CBC: อยู่ในเกณฑ์ปกติ', 'Creatinine 1.00 mg/dL', 'Electrolyte อยู่ในเกณฑ์ปกติ'],
    img: [],
    med: ['ยาเดิมตามแผนการรักษา'],
};


const MockHIS = {

    SIMULATED_NOTE: HIS_SIMULATED_NOTE,
    sections() { return HIS_SECTIONS; },
    section(key) { return HIS_SECTIONS.find(s => s.key === key) || null; },

    /** เลขเสถียรจาก HN — ใช้แทน random เพื่อให้ค่าสัญญาณชีพไม่แกว่งระหว่างเดโม */
    _seed(hn, salt) {
        const s = String(hn || '') + '|' + salt;
        let h = 0;
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
        return h;
    },

    /** เวชระเบียนของ HN นี้เท่าที่ระบบมี — ใบส่งต่อมาก่อนเพราะใหม่กว่าและมีบริบทครบกว่า */
    _record(hn) {
        if (!hn) return null;
        const refer = (window.MockRefer ? MockRefer.all() : []).filter(r => r.hn === hn);
        const claim = (window.MockClaims ? MockClaims.all() : []).filter(c => c.hn === hn);
        return refer[0] || claim[0] || null;
    },

    _claims(hn) {
        return (window.MockClaims ? MockClaims.all() : []).filter(c => c.hn === hn);
    },

    /** เทมเพลตของกลุ่มโรค — จับคู่ prefix ที่ยาวที่สุดที่ตรง */
    _template(rec) {
        const codes = ((rec && rec.dx) || []).map(d => String(d.code || ''));
        let best = null, bestLen = 0;
        Object.keys(HIS_DX_TEMPLATES).forEach(prefix => {
            if (codes.some(c => c.startsWith(prefix)) && prefix.length > bestLen) {
                best = HIS_DX_TEMPLATES[prefix]; bestLen = prefix.length;
            }
        });
        return best || HIS_FALLBACK;
    },

    /* ══════════ ตัวสร้างเนื้อหารายหมวด ══════════ */

    _lines(key, hn, rec, tpl) {
        const dx     = (rec && rec.dx) || [];
        const claims = this._claims(hn);

        switch (key) {

            case 'hpi': {
                const main = dx.find(d => d.type === 'หลัก') || dx[0];
                const urg  = rec && rec.urgency && window.REFER_URGENCY
                    ? (REFER_URGENCY[rec.urgency] || {}).label : null;
                return [
                    `อาการสำคัญ: ${tpl.cc}`,
                    main ? `ปัญหาหลักที่ติดตาม: ${main.name} (${main.code})` : null,
                    urg ? `ระดับความเร่งด่วนที่บันทึกไว้: ${urg}` : null,
                    rec && rec.age ? `ผู้ป่วย${rec.gender === 'F' ? 'หญิง' : 'ชาย'}ไทย อายุ ${rec.age} ปี` : null,
                ].filter(Boolean);
            }

            case 'diagnosis':
                return dx.map(d => `${d.code} ${d.name} (${d.type})`);

            case 'comorbid': {
                const co = dx.filter(d => d.type !== 'หลัก');
                return [
                    ...co.map(d => `โรคร่วม: ${d.code} ${d.name}`),
                    `ประวัติแพ้ยา: ${this._seed(hn, 'allergy') % 5 === 0
                        ? 'แพ้ Penicillin — ผื่นลมพิษทั้งตัว' : 'ไม่มีประวัติแพ้ยาที่บันทึกไว้'}`,
                ];
            }

            case 'vitals': {
                const s = this._seed(hn, 'vital');
                const sbp = 108 + (s % 45), dbp = 62 + (s % 25);
                return [
                    `ความดันโลหิต ${sbp}/${dbp} mmHg`,
                    `ชีพจร ${64 + (s % 34)} ครั้ง/นาที`,
                    `อัตราหายใจ ${16 + (s % 6)} ครั้ง/นาที`,
                    `อุณหภูมิ ${(36.4 + (s % 12) / 10).toFixed(1)} °C`,
                    `ออกซิเจนปลายนิ้ว ${94 + (s % 5)}%`,
                    `น้ำหนัก ${48 + (s % 32)} กก. · ส่วนสูง ${150 + (s % 25)} ซม.`,
                ];
            }

            case 'lab': {
                /* ค่าเชิงตัวเลขมาจากเทมเพลต ส่วนรายการที่ "สั่งตรวจจริง" ดึงจากค่าใช้จ่ายของเคลม */
                const ordered = claims.flatMap(c => (c.charges || [])
                    .filter(x => x.billgrcs === '06' || /ห้องปฏิบัติการ|ตรวจเลือด/.test(x.name || ''))
                    .map(x => `รายการที่สั่งตรวจ: ${String(x.name).replace(/^ค่า/, '')}`));
                return [...tpl.lab, ...[...new Set(ordered)]];
            }

            case 'imaging': {
                const docs = ((rec && rec.documents) || [])
                    .filter(d => d.type === 'ผลตรวจ')
                    .map(d => `${d.name}${d.date ? ` (${MockFmt.dateTH(d.date)})` : ''}`
                            + `${d.status === 'FOUND' ? '' : ' — ยังไม่พบไฟล์ผลตรวจในระบบ'}`);
                return [...tpl.img, ...docs];
            }

            case 'medication':
                return tpl.med;

            case 'procedure': {
                const done = [
                    ...((rec && rec.proc_actual) || []),
                    ...((rec && rec.proc) || []),
                    ...claims.flatMap(c => c.proc || []),
                ];
                /* หมวดที่ไม่มีข้อมูลคืนอาร์เรย์ว่าง — extract() จะตัดทิ้ง
                   ไม่คืนบรรทัด "ยังไม่มีข้อมูล" เพราะถ้าผู้ใช้เผลอดึงเข้าไป
                   จะกลายเป็นข้อความขยะในเวชระเบียนที่ส่งให้ปลายทางอ่าน */
                const seen = new Set();
                return done.filter(p => p && p.code && !seen.has(p.code) && seen.add(p.code))
                    .map(p => `${p.code} ${p.name}${p.date ? ` — ทำเมื่อ ${MockFmt.dateTH(p.date)}` : ''}`);
            }

            case 'visit':
                return claims.slice(0, 6).map(c =>
                    `${MockFmt.dateTH(c.service_date)} · ${c.service_type === 'IPD' ? 'ผู้ป่วยใน' : 'ผู้ป่วยนอก'}`
                    + ` · ${c.provider}`);

            default: return [];
        }
    },

    /**
     * ดึงเวชระเบียนของ HN — คืนทุกหมวดที่มีเนื้อหา
     * @returns {{found:boolean, hn:string, patient:string, pulled_at:string, sections:Array}}
     */
    extract(hn) {
        const rec = this._record(hn);
        if (!rec) return { found: false, hn, patient: '', pulled_at: null, sections: [] };

        const tpl = this._template(rec);
        const sections = HIS_SECTIONS.map(s => {
            const lines = this._lines(s.key, hn, rec, tpl).filter(Boolean);
            return { ...s, lines, text: lines.join(' · ') };
        }).filter(s => s.lines.length);

        return {
            found: true, hn,
            patient: rec.patient || '',
            pulled_at: '2569-08-06T09:00',
            source_ref: rec.id || '',
            sections,
        };
    },

    /**
     * ประกอบข้อความที่จะเติมเข้าฟอร์ม
     * @param picks [{key, target}] — target ที่ผู้ใช้เลือก (ว่าง = ใช้ค่าตั้งต้นของหมวด)
     * @returns {{ [reviewKey]: string }} ข้อความต่อหัวข้อ รวมหลายหมวดที่ลงหัวข้อเดียวกันแล้ว
     */
    compose(hn, picks) {
        const ex  = this.extract(hn);
        const out = {};
        (picks || []).forEach(p => {
            const s = ex.sections.find(x => x.key === p.key);
            if (!s) return;
            const target = p.target || s.target;
            const block  = `[${s.label}] ${s.lines.join(' · ')}`;
            out[target] = out[target] ? `${out[target]}\n${block}` : block;
        });
        return out;
    },
};

window.HIS_SECTIONS        = HIS_SECTIONS;
window.HIS_SIMULATED_NOTE  = HIS_SIMULATED_NOTE;
window.MockHIS             = MockHIS;
