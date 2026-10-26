import { NextResponse } from "next/server";
import { verifyAdminApi } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendToGoogleSheets, updateSheetStatus } from "@/lib/google-sheets";

export const runtime = "nodejs";

/** POST /api/admin/retry-sheet - Retry sending a specific attempt to Google Sheets */
export async function POST(request: Request) {
  const auth = await verifyAdminApi();
  if (!auth.authorized) return auth.response;

  let body: { attemptId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  if (!body.attemptId) {
    return NextResponse.json(
      { error: "กรุณาระบุ attemptId" },
      { status: 400 }
    );
  }

  const db = createAdminClient();

  // Get the attempt with quiz info
  const { data: attempt, error: fetchError } = await db
    .from("attempts")
    .select(
      "id, quiz_id, student_id, student_first_name, student_last_name, score, total_questions, correct_count, percentage, submitted_at, google_sheets_status, quizzes(title)"
    )
    .eq("id", body.attemptId)
    .single();

  if (fetchError || !attempt) {
    return NextResponse.json(
      { error: "ไม่พบผลสอบ" },
      { status: 404 }
    );
  }

  // Update status to pending
  await updateSheetStatus(db, attempt.id, "pending");

  const quizTitle =
    (attempt.quizzes as { title?: string } | null)?.title ?? "ไม่ทราบชื่อชุดข้อสอบ";

  const result = await sendToGoogleSheets({
    attemptId: attempt.id,
    quizTitle,
    firstName: attempt.student_first_name ?? "",
    lastName: attempt.student_last_name ?? "",
    studentId: attempt.student_id ?? "",
    score: attempt.score,
    totalQuestions: attempt.total_questions,
    correctCount: attempt.correct_count ?? attempt.score,
    wrongCount: attempt.total_questions - (attempt.correct_count ?? attempt.score),
    percentage: attempt.percentage ?? 0,
    submittedAt: attempt.submitted_at,
  });

  if (result.ok) {
    await updateSheetStatus(db, attempt.id, "success");
    return NextResponse.json({
      ok: true,
      message: "ส่งผลสอบไป Google Sheets สำเร็จ",
      duplicate: result.duplicate,
    });
  } else {
    await updateSheetStatus(db, attempt.id, "failed", result.error);
    return NextResponse.json(
      {
        ok: false,
        error: `ส่งไม่สำเร็จ: ${result.error}`,
      },
      { status: 502 }
    );
  }
}
