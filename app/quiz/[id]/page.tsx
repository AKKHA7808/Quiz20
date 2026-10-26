import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import QuizForm from "./quiz-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("title")
    .eq("id", id)
    .single();

  return {
    title: quiz ? `${quiz.title} — ทำข้อสอบ (สมาชิก)` : "ทำข้อสอบ",
  };
}

export default async function QuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, title, description, is_published")
    .eq("id", id)
    .eq("is_published", true)
    .single();

  if (!quiz) notFound();

  const { data: questions, error } = await supabase
    .from("questions")
    .select("id, question_text, choice_a, choice_b, choice_c, choice_d")
    .eq("quiz_id", id)
    .order("position", { ascending: true });

  if (error || !questions?.length) notFound();

  return (
    <main>
      <h1>{quiz.title}</h1>
      {quiz.description && <p className="muted">{quiz.description}</p>}
      <QuizForm quizId={quiz.id} questions={questions} />
    </main>
  );
}
