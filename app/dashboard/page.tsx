import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";

export const metadata = {
  title: "หน้าหลัก — คลังข้อสอบ QuizHub",
  description: "เลือกชุดข้อสอบเพื่อเริ่มทดสอบ และดูประวัติคะแนนสอบ",
};

export default async function Dashboard() {
  const { supabase, user } = await requireUser();

  const [{ data: quizzes }, { data: profile }, { data: attempts }] = await Promise.all([
    supabase
      .from("quizzes")
      .select("id, title, description, question_count, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("attempts")
      .select("id, score, total_questions, correct_count, percentage, submitted_at, quizzes(title)")
      .eq("user_id", user.id)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(10),
  ]);

  const isAdmin = profile?.role === "admin";
  const studentName =
    user.user_metadata?.full_name ||
    (user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
      : user.email);
  const studentId = user.user_metadata?.student_id;

  return (
    <main>
      <div className="flex justify-between items-center flex-wrap gap-2 mb-4">
        <div>
          <h1>คลังข้อสอบออนไลน์</h1>
          <p className="muted">
            ยินดีต้อนรับ: <strong>{studentName}</strong>
            {studentId && <> (รหัสนักศึกษา: <strong>{studentId}</strong>)</>} · บทบาท:{" "}
            <span className={`badge ${isAdmin ? "badge-info" : "badge-secondary"}`}>
              {isAdmin ? "ผู้ดูแลระบบ (Admin)" : "นักศึกษา (Student)"}
            </span>
          </p>
        </div>

        <div className="flex gap-2 items-center">
          {isAdmin && (
            <>
              <Link href="/admin" className="btn btn-primary btn-sm">
                ⚙️ แผงควบคุมผู้ดูแล (Admin)
              </Link>
              <Link href="/admin/import" className="btn btn-secondary btn-sm">
                + นำเข้าข้อสอบ CSV
              </Link>
            </>
          )}
          <form action={logoutAction}>
            <button type="submit" className="btn btn-outline btn-sm">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </div>

      {isAdmin && (
        <div className="alert alert-info mb-4">
          👋 คุณเข้าสู่ระบบด้วยสิทธิ์ผู้ดูแลระบบ คุณสามารถจัดการชุดข้อสอบ ดูผลคะแนนนักศึกษาทุกคน และส่งผลซ้ำไปยัง Google Sheets ได้ที่{" "}
          <Link href="/admin" style={{ fontWeight: 600, textDecoration: "underline" }}>
            แผงผู้ดูแลระบบ
          </Link>
        </div>
      )}

      <h2 className="mt-4">ชุดข้อสอบที่เปิดให้ทำ</h2>

      {!quizzes?.length ? (
        <div className="card text-center muted" style={{ padding: "40px" }}>
          ยังไม่มีชุดข้อสอบที่เปิดให้ทำในขณะนี้
          {isAdmin && (
            <div className="mt-2">
              <Link href="/admin/import" className="btn btn-primary btn-sm">
                นำเข้าชุดข้อสอบแรกจาก CSV
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="row" style={{ margin: "16px 0" }}>
          {quizzes.map((q) => (
            <div className="card" key={q.id} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="badge badge-success">เปิดให้สอบ</span>
                  <span className="muted" style={{ fontSize: "0.85rem" }}>
                    {q.question_count} ข้อ
                  </span>
                </div>
                <h3>{q.title}</h3>
                <p className="muted" style={{ fontSize: "0.9rem", minHeight: "45px" }}>
                  {q.description || "ไม่มีคำอธิบายเพิ่มเติม"}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/exam/${q.id}`} className="btn btn-primary btn-sm" style={{ flex: 1, textAlign: "center" }}>
                  ทำข้อสอบ (ลิงก์ตรง) ➔
                </Link>
                <Link href={`/quiz/${q.id}`} className="btn btn-secondary btn-sm">
                  สอบแบบบันทึกประวัติ
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-4">ประวัติการสอบของคุณ</h2>
      {!attempts?.length ? (
        <div className="card text-center muted" style={{ padding: "30px" }}>
          ยังไม่มีประวัติการทำข้อสอบของคุณในบัญชีนี้
        </div>
      ) : (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>ชุดข้อสอบ</th>
                <th>คะแนนที่ได้</th>
                <th>เปอร์เซ็นต์</th>
                <th>ผลการสอบ</th>
                <th>เวลาที่ส่ง</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a: any) => {
                const percent = a.percentage ?? Math.round((a.score / a.total_questions) * 100);
                const pass = percent >= 50;
                return (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.quizzes?.title ?? "ชุดข้อสอบ"}</strong>
                    </td>
                    <td>
                      {a.score} / {a.total_questions}
                    </td>
                    <td>{percent}%</td>
                    <td>
                      <span className={`badge ${pass ? "badge-success" : "badge-error"}`}>
                        {pass ? "ผ่าน" : "ไม่ผ่าน"}
                      </span>
                    </td>
                    <td className="muted">
                      {a.submitted_at
                        ? new Date(a.submitted_at).toLocaleString("th-TH")
                        : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
