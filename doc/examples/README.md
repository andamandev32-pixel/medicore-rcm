# เคสตัวอย่างสำหรับเดินระบบ (AN 691209)

เคสผู้ป่วยในที่ใช้ในรายงานเล่ม 3 (`doc/case-walkthrough-vs-sati.html`) —
ชายไทย 72 ปี ปอดอักเสบ + เบาหวาน + ไตเรื้อรัง ฟอกเลือด 3 ครั้ง กองทุน IP

| ไฟล์ | ผลที่ควรได้ |
|---|---|
| `case-an691209-as-submitted.json` | `FAIL` — errors 4 · warnings 3 · info 1 · suggestions 2 |
| `case-an691209-fixed.json` | `PASS` — errors 0 · warnings 0 · info 1 · suggestions 1 |

```bash
curl -s -X POST http://localhost:3200/api/reference/validate \
  -H "Content-Type: application/json" \
  --data-binary @doc/examples/case-an691209-as-submitted.json
```

จุดผิด 6 จุดที่ฝังไว้ในไฟล์ as-submitted (เป็นความผิดพลาดที่เจอจริงหน้างานทั้งหมด):

1. ไม่ส่งแฟ้ม 6 ทั้งที่มีหัตถการ → `RUL-FIL-001` + `ENG-PROC-FILE`
2. เลขบัตร ปชช. ผิด checksum → `C104`
3. วันนอน 10 ไม่หักวันลากลับบ้าน 1 วัน → `ENG-ADM-LOS` (= `C112` บน NHSO DP)
4. ราคายา 3.50 ≠ ราคาอ้างอิง 2.00 → `C195` (= `P124` บน NHSO DP)
5. เบิกค่าห้อง 12 วัน > วันนอน 10 วัน → `C312`
6. รายการค่าแล็บไม่ระบุหมวด BILLGRCS → `ENG-CHG-CAT`

และจัดกลุ่ม DRG เป็น 04510 ทั้งที่ Pdx เข้ากลุ่ม 04530 → ชั้นเสนอแนะคืน `SUG-DRG-001`

⚠️ ตาราง DRG/RW ในระบบยัง `verified=0` (ค่าจำลอง) — ผล trim และส่วนต่าง RW
เป็นการประมาณ ห้ามนำไปคิดเงินจริง จนกว่าจะโหลดตารางจริงจาก สกส.
