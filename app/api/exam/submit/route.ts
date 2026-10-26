import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SubmitExamSchema } from "@/lib/validations";
import { sendToGoogleSheets, updateSheetStatus } from "@/lib/google-sheets";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

// Limit request body to prevent abuse
const MAX_BODY_SIZE = 100_000; // 100KB

export async function POST(request: Request) {
  // Check content length
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return NextResponse.json(
      { error: "ขนาดข้อมูลเกินกำหนด" },
      { status: 413 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "รูปแบบข้อมูลไม่ถูกต้อง" },
      { status: 400 }
    );
  }

  // Validate with Zod
  const parsed = SubmitExamSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { quizId, firstName, lastName, studentId, answers, idempotencyKey } =
    parsed.data;

  // Generate idempotency key if not provided
  const effectiveIdempotencyKey = idempotencyKey ?? uuidv4();

  const db = createAdminClient();

  // Verify quiz exists and is published
  const { data: quiz } = await db
    .from("quizzes")
    .select("id,title,is_published")
    .eq("id", quizId)
    .eq("is_published", true)
    .single();

  if (!quiz) {
    return NextResponse.json(
      { error: "ไม่พบชุดข้อสอบหรือยังไม่ได้เผยแพร่" },
      { status: 404 }
    );
  }

  // Get all questions for this quiz
  const { data: questions, error: qError } = await db
    .from("questions")
    .select("id")
    .eq("quiz_id", quiz.id)
    .order("position", { ascending: true });

  if (qError || !questions?.length) {
    return NextResponse.json(
      { error: "โหลดข้อสอบไม่สำเร็จ" },
      { status: 500 }
    );
  }

  // Validate all question IDs match
  const validIds = new Set(questions.map((q) => q.id));
  const submittedIds = Object.keys(answers);

  if (submittedIds.length !== questions.length) {
    return NextResponse.json(
      { error: "กรุณาตอบคำถามให้ครบทุกข้อ" },
      { status: 400 }
    );
  }

  const invalidIds = submittedIds.filter((id) => !validIds.has(id));
  if (invalidIds.length > 0) {
    return NextResponse.json(
      { error: "พบรหัสคำถามที่ไม่ตรงกับชุดข้อสอบ" },
      { status: 400 }
    );
  }

  // Get answer keys (server-side only, never exposed to client)
  const { data: keys, error: keyError } = await db
    .from("answer_keys")
    .select("question_id,correct_answer")
    .in(
      "question_id",
      questions.map((q) => q.id)
    );

  if (keyError || !keys || keys.length !== questions.length) {
    return NextResponse.json(
      { error: "ไม่สามารถตรวจเฉลยได้ กรุณาติดต่อผู้ดูแล" },
      { status: 500 }
    );
  }

  // Calculate score on server
  const keyMap = new Map(keys.map((k) => [k.question_id, k.correct_answer]));
  let score = 0;
  for (const q of questions) {
    if (answers[q.id] === keyMap.get(q.id)) {
      score++;
    }
  }

  const totalQuestions = questions.length;
  const correctCount = score;
  const wrongCount = totalQuestions - correctCount;
  const percentage =
    Math.round((score / totalQuestions) * 10000) / 100;
  const submittedAt = new Date().toISOString();

  // Check idempotency - prevent duplicate submissions
  const { data: existingAttempt } = await db
    .from("attempts")
    .select("id,score,total_questions,correct_count,percentage,submitted_at,google_sheets_status")
    .eq("idempotency_key", effectiveIdempotencyKey)
    .maybeSingle();

  if (existingAttempt) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      attemptId: existingAttempt.id,
      score: existingAttempt.score,
      total: existingAttempt.total_questions,
      correctCount: existingAttempt.correct_count,
      wrongCount: existingAttempt.total_questions - existingAttempt.correct_count,
      percentage: existingAttempt.percentage,
      submittedAt: existingAttempt.submitted_at,
      sheetStatus: existingAttempt.google_sheets_status,
    });
  }

  // Save attempt
  const { data: attempt, error: saveError } = await db
    .from("attempts")
    .insert({
      user_id: null,
      quiz_id: quiz.id,
      student_first_name: firstName,
      student_last_name: lastName,
      student_id: studentId,
      score,
      total_questions: totalQuestions,
      correct_count: correctCount,
      percentage,
      submitted_at: submittedAt,
      google_sheets_status: "pending",
      idempotency_key: effectiveIdempotencyKey,
    })
    .select("id")
    .single();

  if (saveError || !attempt) {
    return NextResponse.json(
      { error: "บันทึกผลสอบไม่สำเร็จ กรุณาลองใหม่" },
      { status: 500 }
    );
  }

  // Save individual answers
  const answerRows = questions.map((q) => ({
    attempt_id: attempt.id,
    question_id: q.id,
    selected_answer: answers[q.id],
    is_correct: answers[q.id] === keyMap.get(q.id),
  }));

  const { error: detailError } = await db
    .from("attempt_answers")
    .insert(answerRows);

  if (detailError) {
    return NextResponse.json(
      {
        error:
          "บันทึกผลคะแนนแล้ว แต่บันทึกรายละเอียดคำตอบไม่ครบ กรุณาติดต่อผู้ดูแล",
      },
      { status: 500 }
    );
  }

  // Send to Google Sheets (non-blocking for the response)
  let sheetStatus: "pending" | "success" | "failed" = "pending";
  let sheetError: string | undefined;

  const sheetResult = await sendToGoogleSheets({
    attemptId: attempt.id,
    quizTitle: quiz.title,
    firstName,
    lastName,
    studentId,
    score,
    totalQuestions,
    correctCount,
    wrongCount,
    percentage,
    submittedAt,
  });

  if (sheetResult.ok) {
    sheetStatus = "success";
  } else {
    sheetStatus = "failed";
    sheetError = sheetResult.error;
  }

  // Update sheet status in database
  await updateSheetStatus(db, attempt.id, sheetStatus, sheetError);

  return NextResponse.json({
    ok: true,
    attemptId: attempt.id,
    score,
    total: totalQuestions,
    correctCount,
    wrongCount,
    percentage,
    submittedAt,
    sheetStatus,
  });
}
