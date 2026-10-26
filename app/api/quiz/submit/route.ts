import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  let body: { quizId?: unknown; answers?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  if (typeof body.quizId !== "string" || !body.answers || typeof body.answers !== "object" || Array.isArray(body.answers))
    return NextResponse.json({ error: "ข้อมูลคำตอบไม่ถูกต้อง" }, { status: 400 });

  const db = createAdminClient();
  const { data: quiz } = await db.from("quizzes").select("id,is_published")
    .eq("id", body.quizId).eq("is_published", true).single();
  if (!quiz) return NextResponse.json({ error: "ไม่พบชุดข้อสอบ" }, { status: 404 });

  const { data: questions, error } = await db.from("questions").select("id").eq("quiz_id", quiz.id);
  if (error || !questions?.length) return NextResponse.json({ error: "โหลดข้อสอบไม่สำเร็จ" }, { status: 400 });
  const { data: keys, error: keyError } = await db.from("answer_keys").select("question_id,correct_answer")
    .in("question_id", questions.map(q => q.id));
  if (keyError || !keys || keys.length !== questions.length)
    return NextResponse.json({ error: "โหลดเฉลยไม่สำเร็จ" }, { status: 500 });

  const answers = body.answers as Record<string, unknown>;
  const allowedIds = new Set(questions.map(q => q.id));
  if (Object.keys(answers).some(id => !allowedIds.has(id)) ||
      Object.values(answers).some(a => !["A", "B", "C", "D"].includes(String(a))))
    return NextResponse.json({ error: "พบคำตอบที่ไม่ตรงกับชุดข้อสอบ" }, { status: 400 });

  const keyMap = new Map(keys.map(k => [k.question_id, k.correct_answer]));
  const score = questions.reduce((sum,q) => sum + (answers[q.id] === keyMap.get(q.id) ? 1 : 0), 0);
  const { data: attempt, error: attemptError } = await db.from("attempts").insert({
    user_id:user.id, quiz_id:quiz.id, score, total_questions:questions.length,
    submitted_at:new Date().toISOString()
  }).select("id").single();
  if (attemptError || !attempt) return NextResponse.json({ error: "บันทึกผลสอบไม่สำเร็จ" }, { status: 400 });

  const answerRows = questions.map(q => ({
    attempt_id:attempt.id, question_id:q.id,
    selected_answer: typeof answers[q.id] === "string" ? answers[q.id] : null,
    is_correct: answers[q.id] === keyMap.get(q.id)
  }));
  const { error: answersError } = await db.from("attempt_answers").insert(answerRows);
  if (answersError) return NextResponse.json({ error: "บันทึกคำตอบไม่ครบ โปรดติดต่อผู้ดูแล" }, { status: 500 });

  return NextResponse.json({ ok:true, score, total:questions.length });
}
