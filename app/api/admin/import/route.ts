import { NextResponse } from "next/server";
import { verifyAdminApi } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCsvContent, MAX_FILE_SIZE } from "@/lib/csv-parser";
import { ImportCsvSchema } from "@/lib/validations";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Verify admin
  const auth = await verifyAdminApi();
  if (!auth.authorized) return auth.response;

  const form = await request.formData();
  const file = form.get("file");
  const rawTitle = String(form.get("title") ?? "").trim();
  const rawDescription = String(form.get("description") ?? "").trim();

  // Validate title/description with Zod
  const metaParsed = ImportCsvSchema.safeParse({
    title: rawTitle,
    description: rawDescription || undefined,
  });
  if (!metaParsed.success) {
    const msg = metaParsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const { title, description } = metaParsed.data;

  // Validate file
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json(
      { error: "กรุณาเลือกไฟล์ .csv" },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `ไฟล์ต้องมีขนาดไม่เกิน ${MAX_FILE_SIZE / (1024 * 1024)} MB` },
      { status: 400 }
    );
  }

  // Parse CSV
  const content = await file.text();
  const { questions, errors } = parseCsvContent(content);

  if (errors.length > 0 && questions.length === 0) {
    return NextResponse.json(
      {
        error: "ไม่สามารถนำเข้าข้อสอบได้",
        details: errors,
      },
      { status: 400 }
    );
  }

  if (questions.length === 0) {
    return NextResponse.json(
      { error: "ไฟล์ไม่มีข้อสอบที่ถูกต้อง" },
      { status: 400 }
    );
  }

  // Use admin client for database operations
  const db = createAdminClient();

  // Create quiz
  const { data: quiz, error: quizError } = await db
    .from("quizzes")
    .insert({
      title,
      description: description || null,
      created_by: auth.userId,
      question_count: questions.length,
      is_published: false,
    })
    .select("id")
    .single();

  if (quizError || !quiz) {
    return NextResponse.json(
      { error: "สร้างชุดข้อสอบไม่สำเร็จ" },
      { status: 400 }
    );
  }

  // Insert questions (without answers)
  const questionRows = questions.map((q) => ({
    quiz_id: quiz.id,
    question_text: q.question_text,
    choice_a: q.choice_a,
    choice_b: q.choice_b,
    choice_c: q.choice_c,
    choice_d: q.choice_d,
    position: q.position,
  }));

  const { data: insertedQuestions, error: questionError } = await db
    .from("questions")
    .insert(questionRows)
    .select("id, position");

  if (
    questionError ||
    !insertedQuestions ||
    insertedQuestions.length !== questions.length
  ) {
    // Rollback: delete quiz
    await db.from("quizzes").delete().eq("id", quiz.id);
    return NextResponse.json(
      { error: `บันทึกคำถามไม่สำเร็จ: ${questionError?.message || "ข้อมูลไม่ครบถ้วน"}` },
      { status: 400 }
    );
  }

  // Ensure exact order by position
  insertedQuestions.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  // Insert answer keys
  const answerKeys = insertedQuestions.map((q, i) => ({
    question_id: q.id,
    correct_answer: questions[i].correct_answer,
  }));

  const { error: keyError } = await db.from("answer_keys").insert(answerKeys);

  if (keyError) {
    // Rollback: delete quiz (cascade will delete questions)
    await db.from("quizzes").delete().eq("id", quiz.id);
    return NextResponse.json(
      { error: "บันทึกเฉลยไม่สำเร็จ" },
      { status: 400 }
    );
  }

  // Auto-publish after successful import
  const { error: publishError } = await db
    .from("quizzes")
    .update({ is_published: true })
    .eq("id", quiz.id);

  if (publishError) {
    return NextResponse.json(
      {
        error:
          "นำเข้าแล้ว แต่เผยแพร่ชุดข้อสอบไม่สำเร็จ กรุณาตรวจสอบในหน้าผู้ดูแล",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    quizId: quiz.id,
    count: questions.length,
    warnings: errors.length > 0 ? errors : undefined,
    preview: questions.slice(0, 3).map((q) => ({
      question: q.question_text.slice(0, 80),
      answer: q.correct_answer,
    })),
  });
}
