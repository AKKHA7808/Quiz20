import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuizHub — ระบบทำข้อสอบออนไลน์ พร้อมตรวจและส่งผล Google Sheets",
  description: "เว็บแอปพลิเคชันทำข้อสอบออนไลน์ นำเข้าจาก CSV ตรวจคะแนนอัตโนมัติ และบันทึกผลไปยัง Google Sheets แบบเรียลไทม์",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>
        <nav>
          <Link href="/dashboard" className="brand">
            📝 QuizHub
          </Link>
          <Link href="/dashboard">หน้าหลัก</Link>
          <Link href="/admin">แผงผู้ดูแล (Admin)</Link>
          <Link href="/admin/import">นำเข้า CSV</Link>
          <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
            <Link href="/login" className="btn btn-secondary btn-sm">
              เข้าสู่ระบบ
            </Link>
            <Link href="/register" className="btn btn-primary btn-sm">
              ลงทะเบียนนักศึกษา
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
