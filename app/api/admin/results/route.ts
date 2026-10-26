import { NextResponse } from "next/server";
import { verifyAdminApi } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** GET /api/admin/results - Get all attempts with filtering */
export async function GET(request: Request) {
  const auth = await verifyAdminApi();
  if (!auth.authorized) return auth.response;

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const quizId = url.searchParams.get("quizId")?.trim() ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));
  const offset = (page - 1) * limit;

  const db = createAdminClient();

  let query = db
    .from("attempts")
    .select(
      "id, quiz_id, student_id, student_first_name, student_last_name, score, total_questions, correct_count, percentage, submitted_at, google_sheets_status, google_sheets_error, quizzes(title)",
      { count: "exact" }
    )
    .order("submitted_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (quizId) {
    query = query.eq("quiz_id", quizId);
  }

  if (search) {
    // Search by student_id, first_name, or last_name
    query = query.or(
      `student_id.ilike.%${search}%,student_first_name.ilike.%${search}%,student_last_name.ilike.%${search}%`
    );
  }

  const { data: attempts, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { error: "โหลดผลสอบไม่สำเร็จ" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    attempts: attempts ?? [],
    total: count ?? 0,
    page,
    limit,
  });
}
