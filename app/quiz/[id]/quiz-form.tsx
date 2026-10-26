"use client";
import { useState } from "react";

type Question = { id:string; question_text:string; choice_a:string; choice_b:string; choice_c:string; choice_d:string };
export default function QuizForm({ quizId, questions }: { quizId:string; questions:Question[] }) {
  const [answers, setAnswers] = useState<Record<string,string>>({});
  const [result, setResult] = useState<{score:number;total:number}|null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm("ยืนยันส่งคำตอบหรือไม่?")) return;
    setBusy(true); setError("");
    const res = await fetch("/api/quiz/submit", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({quizId, answers})
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "ส่งคำตอบไม่สำเร็จ"); return; }
    setResult({score:data.score,total:data.total});
  }

  if (result) return <div className="card"><h2>ส่งข้อสอบเรียบร้อย</h2><p>คะแนนของคุณ</p><h1>{result.score} / {result.total}</h1><p><a href="/dashboard">กลับหน้าหลัก</a></p></div>;
  return <form className="card" onSubmit={submit}>
    {questions.map((q,i)=><section className="question" key={q.id}>
      <h3>{i+1}. {q.question_text}</h3>
      {(["A","B","C","D"] as const).map((letter)=>{
        const thaiLabels: Record<string, string> = { A: "ก", B: "ข", C: "ค", D: "ง" };
        return (
          <label className="choice" key={letter}>
            <input type="radio" name={q.id} value={letter} required
              checked={answers[q.id]===letter} onChange={()=>setAnswers(prev=>({...prev,[q.id]:letter}))}/>
            {thaiLabels[letter]}. {q[(`choice_${letter.toLowerCase()}`) as keyof Question]}
          </label>
        );
      })}
    </section>)}
    {error && <p className="error">{error}</p>}
    <p><button type="submit" disabled={busy}>{busy ? "กำลังส่ง..." : "ส่งคำตอบ"}</button></p>
  </form>;
}
