import { NextResponse } from "next/server";
import { verifyAdminApi } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** GET /api/admin/export - Export attempts as CSV */
export async function GET(request: Request) {
  const auth = await verifyAdminApi();
  if (!auth.authorized) return auth.response;

  const url = new URL(request.url);
  const quizId = url.searchParams.get("quizId")?.trim() ?? "";

  const db = createAdminClient();

  let query = db
    .from("attempts")
    .select(
      "id, student_id, student_first_name, student_last_name, score, total_questions, correct_count, percentage, submitted_at, google_sheets_status, quizzes(title)"
    )
    .order("submitted_at", { ascending: false })
    .limit(10000);

  if (quizId) {
    query = query.eq("quiz_id", quizId);
  }

  const { data: attempts, error } = await query;

  if (error || !attempts) {
    return NextResponse.json(
      { error: "ดึงข้อมูลไม่สำเร็จ" },
      { status: 500 }
    );
  }

  // Build CSV
  const BOM = "\uFEFF";
  const headers = [
    "วันที่และเวลา",
    "รหัสนักศึกษา",
    "ชื่อ",
    "นามสกุล",
    "ชุดข้อสอบ",
    "คะแนนที่ได้",
    "คะแนนเต็ม",
    "จำนวนข้อที่ถูก",
    "จำนวนข้อที่ผิด",
    "เปอร์เซ็นต์",
    "สถานะ Google Sheets",
    "Attempt ID",
  ];

  function escapeCSV(val: string): string {
    // Prevent formula injection
    let safe = val;
    if (/^[=+\-@\t\r]/.test(safe)) safe = "'" + safe;
    if (safe.includes('"') || safe.includes(",") || safe.includes("\n")) {
      return '"' + safe.replace(/"/g, '""') + '"';
    }
    return safe;
  }

  const rows = attempts.map((a) => {
    const quizTitle =
      (a.quizzes as { title?: string } | null)?.title ?? "";
    const wrongCount = a.total_questions - (a.correct_count ?? a.score);
    return [
      a.submitted_at ? new Date(a.submitted_at).toLocaleString("th-TH") : "",
      a.student_id ?? "",
      a.student_first_name ?? "",
      a.student_last_name ?? "",
      quizTitle,
      String(a.score),
      String(a.total_questions),
      String(a.correct_count ?? a.score),
      String(wrongCount),
      String(a.percentage ?? 0),
      a.google_sheets_status ?? "",
      a.id,
    ]
      .map(escapeCSV)
      .join(",");
  });

  const csv = BOM + headers.map(escapeCSV).join(",") + "\n" + rows.join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="results-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
