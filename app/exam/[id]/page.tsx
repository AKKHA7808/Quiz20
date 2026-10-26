import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import PublicExamForm from "./public-exam-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: quiz } = await db
    .from("quizzes")
    .select("title, description")
    .eq("id", id)
    .single();

  return {
    title: quiz ? `${quiz.title} — ทำข้อสอบออนไลน์` : "แบบทดสอบออนไลน์",
    description: quiz?.description ?? "ระบบทำข้อสอบออนไลน์ พร้อมตรวจคะแนนทันที",
  };
}

export default async function PublicExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();

  const { data: quiz } = await db
    .from("quizzes")
    .select("id, title, description, question_count, is_published")
    .eq("id", id)
    .eq("is_published", true)
    .single();

  if (!quiz) notFound();

  // Answer key is never queried or sent to the client
  const { data: questions, error } = await db
    .from("questions")
    .select("id, question_text, choice_a, choice_b, choice_c, choice_d")
    .eq("quiz_id", id)
    .order("position", { ascending: true });

  if (error || !questions?.length) notFound();

  return (
    <main>
      <div style={{ marginBottom: "20px" }}>
        <h1>{quiz.title}</h1>
        {quiz.description && <p className="muted">{quiz.description}</p>}
      </div>

      <PublicExamForm quizId={quiz.id} questions={questions} />
    </main>
  );
}
