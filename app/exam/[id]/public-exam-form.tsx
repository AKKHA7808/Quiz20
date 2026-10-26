"use client";

import { useState } from "react";
import Link from "next/link";

interface Question {
  id: string;
  question_text: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
}

interface SubmitResult {
  ok: boolean;
  attemptId: string;
  score: number;
  total: number;
  correctCount: number;
  wrongCount: number;
  percentage: number;
  submittedAt: string;
  sheetStatus: "pending" | "success" | "failed";
  duplicate?: boolean;
}

export default function PublicExamForm({
  quizId,
  questions,
}: {
  quizId: string;
  questions: Question[];
}) {
  const [student, setStudent] = useState({
    firstName: "",
    lastName: "",
    studentId: "",
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const progressPercent = Math.round((answeredCount / questions.length) * 100);

  function handlePreSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!student.firstName.trim() || !student.lastName.trim() || !student.studentId.trim()) {
      setError("กรุณากรอกชื่อ นามสกุล และรหัสนักศึกษาให้ครบถ้วน");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (answeredCount < questions.length) {
      setError(`คุณยังตอบข้อสอบไม่ครบ (ตอบแล้ว ${answeredCount}/${questions.length} ข้อ) กรุณาตอบให้ครบทุกข้อ`);
      return;
    }
    setError("");
    setShowConfirm(true);
  }

  async function executeSubmit() {
    setShowConfirm(false);
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/exam/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId,
          firstName: student.firstName.trim(),
          lastName: student.lastName.trim(),
          studentId: student.studentId.trim(),
          answers,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ส่งคำตอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        return;
      }
      setResult(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("ไม่สามารถติดต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  // RESULT VIEW
  if (result) {
    const isPassed = result.percentage >= 50;
    return (
      <div className="card text-center" style={{ maxWidth: "700px", margin: "24px auto" }}>
        <div style={{ fontSize: "3rem", marginBottom: "8px" }}>
          {isPassed ? "🎉" : "📝"}
        </div>
        <h2>ส่งข้อสอบและตรวจคะแนนเรียบร้อยแล้ว</h2>
        <p className="muted">
          ผู้เข้าสอบ: <strong>{student.firstName} {student.lastName}</strong> · รหัสนักศึกษา: <strong>{student.studentId}</strong>
        </p>

        <div className="score-display">
          <div className="score-number">
            {result.score} <span style={{ fontSize: "1.8rem", color: "var(--text-secondary)" }}>/ {result.total}</span>
          </div>
          <div className="score-percent">
            <span className={`badge ${isPassed ? "badge-success" : "badge-error"}`} style={{ fontSize: "1.1rem", padding: "6px 16px" }}>
              {isPassed ? `ผ่านเกณฑ์ (${result.percentage}%)` : `ไม่ผ่านเกณฑ์ (${result.percentage}%)`}
            </span>
          </div>
        </div>

        <div className="result-grid">
          <div className="result-item">
            <div className="label">ตอบถูก</div>
            <div className="value" style={{ color: "var(--success)" }}>{result.correctCount} ข้อ</div>
          </div>
          <div className="result-item">
            <div className="label">ตอบผิด</div>
            <div className="value" style={{ color: "var(--error)" }}>{result.wrongCount} ข้อ</div>
          </div>
          <div className="result-item">
            <div className="label">เวลาที่ส่ง</div>
            <div className="value" style={{ fontSize: "0.95rem" }}>
              {new Date(result.submittedAt).toLocaleTimeString("th-TH")}
            </div>
          </div>
        </div>

        {/* Google Sheets Status */}
        {result.sheetStatus === "success" ? (
          <div className="alert alert-success mt-4">
            ✓ บันทึกผลสอบลงใน <strong>Google Sheets</strong> เรียบร้อยแล้ว
          </div>
        ) : (
          <div className="alert alert-warning mt-4">
            ⚠️ บันทึกผลคะแนนในระบบเรียบร้อย (ระบบจะส่งผลไปยัง Google Sheets ในภายหลัง หรือผู้ดูแลสามารถกดส่งซ้ำได้)
          </div>
        )}

        <div className="mt-4 flex justify-between" style={{ justifyContent: "center", gap: "12px" }}>
          <Link href="/dashboard" className="btn btn-secondary">
            ไปยังหน้าหลัก
          </Link>
          <button
            onClick={() => window.print()}
            className="btn btn-outline"
          >
            🖨️ พิมพ์ / บันทึกผลสอบ
          </button>
        </div>
      </div>
    );
  }

  // EXAM FORM VIEW
  return (
    <>
      {/* Sticky Progress Bar */}
      <div
        style={{
          position: "sticky",
          top: "65px",
          background: "var(--bg-card)",
          zIndex: 90,
          padding: "12px 18px",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow-md)",
          marginBottom: "20px",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex justify-between items-center">
          <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
            ความคืบหน้าการทำข้อสอบ
          </span>
          <span className="muted" style={{ fontWeight: 600 }}>
            {answeredCount} / {questions.length} ข้อ ({progressPercent}%)
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <form onSubmit={handlePreSubmit}>
        {/* Student Information Section */}
        <div className="card">
          <h2>ข้อมูลประจำตัวผู้เข้าสอบ</h2>
          <p className="muted">กรุณากรอกข้อมูลจริงเพื่อใช้ในการบันทึกคะแนนและส่งไปยัง Google Sheets</p>
          <div className="row mt-2">
            <div>
              <label>
                ชื่อ (First Name) <span className="error">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={100}
                placeholder="เช่น สมชาย"
                autoComplete="given-name"
                value={student.firstName}
                onChange={(e) =>
                  setStudent((prev) => ({ ...prev, firstName: e.target.value }))
                }
              />
            </div>
            <div>
              <label>
                นามสกุล (Last Name) <span className="error">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={100}
                placeholder="เช่น ใจดี"
                autoComplete="family-name"
                value={student.lastName}
                onChange={(e) =>
                  setStudent((prev) => ({ ...prev, lastName: e.target.value }))
                }
              />
            </div>
            <div>
              <label>
                รหัสนักศึกษา / เลขประจำตัว <span className="error">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={40}
                placeholder="เช่น 65012345"
                autoComplete="off"
                value={student.studentId}
                onChange={(e) =>
                  setStudent((prev) => ({ ...prev, studentId: e.target.value.trim() }))
                }
              />
            </div>
          </div>
        </div>

        {/* Questions Section */}
        <div className="card">
          <h2>คำถาม ({questions.length} ข้อ)</h2>
          <p className="muted">เลือกคำตอบที่ถูกต้องที่สุดเพียงข้อเดียวในแต่ละข้อ</p>

          {questions.map((q, index) => {
            const isAnswered = Boolean(answers[q.id]);
            return (
              <section className="question" key={q.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`badge ${isAnswered ? "badge-success" : "badge-warning"}`}
                    style={{ fontSize: "0.85rem" }}
                  >
                    ข้อ {index + 1}
                  </span>
                  <h3 style={{ margin: 0 }}>{q.question_text}</h3>
                </div>

                {(["A", "B", "C", "D"] as const).map((letter) => {
                  const thaiLabels: Record<string, string> = {
                    A: "ก",
                    B: "ข",
                    C: "ค",
                    D: "ง",
                  };
                  const choiceText = q[(`choice_${letter.toLowerCase()}`) as keyof Question];
                  const isSelected = answers[q.id] === letter;
                  return (
                    <label
                      key={letter}
                      className="choice"
                      style={{
                        background: isSelected ? "var(--primary-light)" : undefined,
                        borderColor: isSelected ? "var(--primary)" : undefined,
                        fontWeight: isSelected ? 600 : "normal",
                      }}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={letter}
                        checked={isSelected}
                        onChange={() =>
                          setAnswers((prev) => ({ ...prev, [q.id]: letter }))
                        }
                      />
                      <span>
                        <strong>{thaiLabels[letter]}.</strong> {choiceText}
                      </span>
                    </label>
                  );
                })}
              </section>
            );
          })}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="flex justify-between items-center mt-4">
          <span className="muted">
            ทำเสร็จแล้ว {answeredCount} จาก {questions.length} ข้อ
          </span>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: "12px 28px", fontSize: "1rem" }}
            disabled={busy}
          >
            {busy ? (
              <>
                <span className="spinner mr-2" /> กำลังตรวจคะแนนและบันทึกผล...
              </>
            ) : (
              "ตรวจข้อสอบและส่งคำตอบ ➔"
            )}
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="overlay">
          <div className="dialog">
            <h2>ยืนยันการส่งข้อสอบ</h2>
            <p>
              คุณกรอกข้อมูลในนาม:
              <br />
              <strong>{student.firstName} {student.lastName}</strong> (รหัส {student.studentId})
            </p>
            <p className="muted" style={{ margin: "12px 0" }}>
              คุณได้ตอบครบทั้งหมด <strong>{questions.length} ข้อ</strong> เมื่อส่งแล้วระบบจะทำการตรวจคะแนนอัตโนมัติและส่งผลไปยัง Google Sheets ทันที ไม่สามารถแก้ไขได้
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowConfirm(false)}
              >
                กลับไปตรวจคำตอบ
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={executeSubmit}
              >
                ยืนยันส่งข้อสอบ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
