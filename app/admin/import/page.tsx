import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import ImportForm from "./form";

export const metadata = {
  title: "นำเข้าข้อสอบจาก CSV — QuizHub",
  description: "อัปโหลดไฟล์ CSV เพื่อสร้างชุดข้อสอบและบันทึกคำถามลงฐานข้อมูลอัตโนมัติ",
};

export default async function ImportPage() {
  await requireAdmin();

  return (
    <main>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1>นำเข้าข้อสอบจากไฟล์ CSV</h1>
          <p className="muted">สร้างชุดข้อสอบและบันทึกคำถามเข้าสู่ระบบอัตโนมัติ</p>
        </div>
        <Link href="/admin" className="btn btn-secondary btn-sm">
          ← กลับไปยังแผงผู้ดูแล
        </Link>
      </div>

      <div className="card">
        <ImportForm />
      </div>

      <div className="card">
        <h2>ข้อกำหนดและโครงสร้างไฟล์ CSV</h2>
        <p className="muted">
          ไฟล์ CSV ต้องใช้การเข้ารหัสแบบ <strong>UTF-8</strong> หรือ <strong>UTF-8 with BOM</strong> โดยบรรทัดแรกสุดต้องเป็นหัวคอลัมน์ภาษาอังกฤษ:
        </p>
        <pre style={{ background: "var(--bg)", padding: "12px", borderRadius: "8px", margin: "12px 0", overflowX: "auto" }}>
          <code>question,choice_a,choice_b,choice_c,choice_d,answer</code>
        </pre>
        <ul style={{ paddingLeft: "24px", lineHeight: "1.8", color: "var(--text)" }}>
          <li>
            <strong>question</strong>: ข้อความคำถาม (ความยาว 3 - 1,000 ตัวอักษร)
          </li>
          <li>
            <strong>choice_a, choice_b, choice_c, choice_d</strong>: ตัวเลือกคำตอบ A, B, C, D (ความยาว 1 - 500 ตัวอักษร)
          </li>
          <li>
            <strong>answer</strong>: ตัวอักษรคำตอบที่ถูกต้อง ต้องเป็น <strong>A</strong>, <strong>B</strong>, <strong>C</strong>, หรือ <strong>D</strong> เท่านั้น (ตัวพิมพ์ใหญ่หรือพิมพ์เล็กก็ได้)
          </li>
          <li>
            <strong>ขนาดไฟล์</strong>: ไม่เกิน 2 MB และไม่เกิน 500 คำถามต่อไฟล์
          </li>
        </ul>
      </div>
    </main>
  );
}
