import { requireAdmin } from "@/lib/auth";
import AdminDashboard from "./admin-dashboard";

export const metadata = {
  title: "ผู้ดูแลระบบ — QuizHub",
  description: "จัดการชุดข้อสอบ ดูผลสอบทั้งหมด และส่งผลคะแนนซ้ำไปยัง Google Sheets",
};

export default async function AdminPage() {
  await requireAdmin();

  return (
    <main className="wide">
      <AdminDashboard />
    </main>
  );
}
