import { NextResponse } from "next/server";
import { verifyAdminApi } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** GET /api/admin/quizzes - List all quizzes for admin */
export async function GET() {
  const auth = await verifyAdminApi();
  if (!auth.authorized) return auth.response;

  const db = createAdminClient();
  const { data: quizzes, error } = await db
    .from("quizzes")
    .select("id, title, description, question_count, is_published, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "โหลดรายการข้อสอบไม่สำเร็จ" },
      { status: 500 }
    );
  }

  return NextResponse.json({ quizzes: quizzes ?? [] });
}

/** PATCH /api/admin/quizzes - Toggle publish status */
export async function PATCH(request: Request) {
  const auth = await verifyAdminApi();
  if (!auth.authorized) return auth.response;

  let body: { quizId?: string; isPublished?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  if (!body.quizId || typeof body.isPublished !== "boolean") {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await db
    .from("quizzes")
    .update({ is_published: body.isPublished })
    .eq("id", body.quizId);

  if (error) {
    return NextResponse.json(
      { error: "อัปเดตสถานะไม่สำเร็จ" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
