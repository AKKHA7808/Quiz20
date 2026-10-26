"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  question_count: number;
  is_published: boolean;
  created_at: string;
}

interface Attempt {
  id: string;
  quiz_id: string;
  student_id: string;
  student_first_name: string;
  student_last_name: string;
  score: number;
  total_questions: number;
  correct_count: number;
  percentage: number;
  submitted_at: string;
  google_sheets_status: "pending" | "success" | "failed";
  google_sheets_error: string | null;
  quizzes?: { title?: string } | null;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"results" | "quizzes" | "guide">("results");

  // Quizzes state
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [togglingQuizId, setTogglingQuizId] = useState<string | null>(null);

  // Results state
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [loadingResults, setLoadingResults] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Retry state
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load quizzes
  const loadQuizzes = useCallback(async () => {
    setLoadingQuizzes(true);
    try {
      const res = await fetch("/api/admin/quizzes");
      const data = await res.json();
      if (res.ok) {
        setQuizzes(data.quizzes || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingQuizzes(false);
    }
  }, []);

  // Load results
  const loadResults = useCallback(async () => {
    setLoadingResults(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search.trim()) params.set("search", search.trim());
      if (selectedQuizId) params.set("quizId", selectedQuizId);

      const res = await fetch(`/api/admin/results?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setAttempts(data.attempts || []);
        setTotalAttempts(data.total || 0);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingResults(false);
    }
  }, [page, search, selectedQuizId]);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  // Toggle publish
  async function togglePublish(quiz: Quiz) {
    setTogglingQuizId(quiz.id);
    setActionMessage(null);
    try {
      const res = await fetch("/api/admin/quizzes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: quiz.id, isPublished: !quiz.is_published }),
      });
      if (res.ok) {
        setQuizzes((prev) =>
          prev.map((q) => (q.id === quiz.id ? { ...q, is_published: !q.is_published } : q))
        );
        setActionMessage({
          type: "success",
          text: `เปลี่ยนสถานะ "${quiz.title}" เป็น ${!quiz.is_published ? "เผยแพร่แล้ว" : "ยกเลิกเผยแพร่แล้ว"} สำเร็จ`,
        });
      } else {
        const data = await res.json();
        setActionMessage({ type: "error", text: data.error || "เปลี่ยนสถานะไม่สำเร็จ" });
      }
    } catch {
      setActionMessage({ type: "error", text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" });
    } finally {
      setTogglingQuizId(null);
    }
  }

  // Retry sending to Google Sheets
  async function retrySheet(attemptId: string) {
    setRetryingId(attemptId);
    setActionMessage(null);
    try {
      const res = await fetch("/api/admin/retry-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: "success", text: "ส่งผลสอบไปยัง Google Sheets สำเร็จเรียบร้อยแล้ว!" });
        // Update local status
        setAttempts((prev) =>
          prev.map((a) => (a.id === attemptId ? { ...a, google_sheets_status: "success", google_sheets_error: null } : a))
        );
      } else {
        setActionMessage({ type: "error", text: `ส่งไม่สำเร็จ: ${data.error || "ข้อผิดพลาดที่ไม่ทราบสาเหตุ"}` });
        setAttempts((prev) =>
          prev.map((a) => (a.id === attemptId ? { ...a, google_sheets_status: "failed", google_sheets_error: data.error } : a))
        );
      }
    } catch {
      setActionMessage({ type: "error", text: "ไม่สามารถเชื่อมต่อเพื่อส่งผลสอบได้" });
    } finally {
      setRetryingId(null);
    }
  }

  // Copy exam link
  function copyLink(quizId: string) {
    const url = `${window.location.origin}/exam/${quizId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(quizId);
    setTimeout(() => setCopiedId(null), 2500);
  }

  // Export CSV
  function handleExport() {
    const params = new URLSearchParams();
    if (selectedQuizId) params.set("quizId", selectedQuizId);
    window.open(`/api/admin/export?${params.toString()}`, "_blank");
  }

  // Stats
  const totalQuizzes = quizzes.length;
  const publishedQuizzes = quizzes.filter((q) => q.is_published).length;
  const sheetSuccessCount = attempts.filter((a) => a.google_sheets_status === "success").length;
  const sheetFailedCount = attempts.filter((a) => a.google_sheets_status === "failed").length;

  return (
    <div className="admin-dashboard">
      <div className="flex justify-between items-center flex-wrap gap-3 mb-4">
        <div>
          <h1>แผงควบคุมผู้ดูแลระบบ (Admin Dashboard)</h1>
          <p className="muted">จัดการชุดข้อสอบ ดูประวัติผลการสอบ และติดตามการซิงค์ Google Sheets</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/import" className="btn btn-primary">
            + นำเข้าข้อสอบ CSV
          </Link>
          <button onClick={handleExport} className="btn btn-secondary">
            📥 ส่งออกผลสอบ (CSV)
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className={`alert alert-${actionMessage.type} mb-4`}>
          {actionMessage.text}
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="result-grid">
        <div className="result-item">
          <div className="label">ชุดข้อสอบทั้งหมด</div>
          <div className="value">{totalQuizzes} ชุด ({publishedQuizzes} เผยแพร่)</div>
        </div>
        <div className="result-item">
          <div className="label">จำนวนครั้งที่เข้าสอบ</div>
          <div className="value">{totalAttempts} ครั้ง</div>
        </div>
        <div className="result-item">
          <div className="label">ซิงค์ Sheets สำเร็จ (ในหน้านี้)</div>
          <div className="value" style={{ color: "var(--success)" }}>{sheetSuccessCount} ครั้ง</div>
        </div>
        <div className="result-item">
          <div className="label">ซิงค์ Sheets ล้มเหลว (ในหน้านี้)</div>
          <div className="value" style={{ color: sheetFailedCount > 0 ? "var(--error)" : "inherit" }}>
            {sheetFailedCount} ครั้ง
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mt-4" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
        <button
          className={`btn ${activeTab === "results" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("results")}
        >
          📋 ผลการสอบ ({totalAttempts})
        </button>
        <button
          className={`btn ${activeTab === "quizzes" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("quizzes")}
        >
          📚 จัดการชุดข้อสอบ ({totalQuizzes})
        </button>
        <button
          className={`btn ${activeTab === "guide" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("guide")}
        >
          ⚙️ คู่มือติดตั้ง Google Sheets & Webhook
        </button>
      </div>

      {/* TAB 1: RESULTS */}
      {activeTab === "results" && (
        <div className="card mt-4">
          <div className="search-bar">
            <input
              type="text"
              placeholder="🔍 ค้นหารหัสนักศึกษา หรือชื่อ-นามสกุล..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <select
              value={selectedQuizId}
              onChange={(e) => {
                setSelectedQuizId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">-- ชุดข้อสอบทั้งหมด --</option>
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>
            <button onClick={loadResults} className="btn btn-secondary">
              รีเฟรช
            </button>
          </div>

          {loadingResults ? (
            <p className="text-center muted" style={{ padding: "40px" }}>
              <span className="spinner spinner-dark mr-2" /> กำลังโหลดผลการสอบ...
            </p>
          ) : attempts.length === 0 ? (
            <div className="text-center muted" style={{ padding: "40px" }}>
              ยังไม่พบผลการสอบตามเงื่อนไขที่ค้นหา
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>เวลาส่งข้อสอบ</th>
                    <th>รหัสนักศึกษา</th>
                    <th>ชื่อ - นามสกุล</th>
                    <th>ชุดข้อสอบ</th>
                    <th>คะแนนที่ได้</th>
                    <th>เปอร์เซ็นต์</th>
                    <th>สถานะ Google Sheets</th>
                    <th>การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((att) => {
                    const pass = att.percentage >= 50;
                    return (
                      <tr key={att.id}>
                        <td>
                          {att.submitted_at
                            ? new Date(att.submitted_at).toLocaleString("th-TH", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "-"}
                        </td>
                        <td>
                          <strong>{att.student_id}</strong>
                        </td>
                        <td>
                          {att.student_first_name} {att.student_last_name}
                        </td>
                        <td>{att.quizzes?.title || "ไม่ทราบชุดข้อสอบ"}</td>
                        <td>
                          <strong>{att.score}</strong> / {att.total_questions}
                        </td>
                        <td>
                          <span className={`badge ${pass ? "badge-success" : "badge-error"}`}>
                            {att.percentage}%
                          </span>
                        </td>
                        <td>
                          {att.google_sheets_status === "success" && (
                            <span className="badge badge-success">✓ ส่งแล้ว</span>
                          )}
                          {att.google_sheets_status === "failed" && (
                            <span
                              className="badge badge-error"
                              title={att.google_sheets_error || "เกิดข้อผิดพลาดในการส่ง"}
                            >
                              ✕ ล้มเหลว
                            </span>
                          )}
                          {att.google_sheets_status === "pending" && (
                            <span className="badge badge-warning">⏳ รอดำเนินการ</span>
                          )}
                        </td>
                        <td>
                          {att.google_sheets_status !== "success" ? (
                            <button
                              className="btn btn-outline btn-sm"
                              disabled={retryingId === att.id}
                              onClick={() => retrySheet(att.id)}
                            >
                              {retryingId === att.id ? (
                                <>
                                  <span className="spinner spinner-dark mr-2" /> กำลังส่ง...
                                </>
                              ) : (
                                "🔄 ส่งซ้ำ (Retry)"
                              )}
                            </button>
                          ) : (
                            <span className="muted" style={{ fontSize: "0.8rem" }}>สมบูรณ์</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalAttempts > limit && (
            <div className="pagination">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn btn-secondary btn-sm"
              >
                ◀ ก่อนหน้า
              </button>
              <span className="muted" style={{ margin: "0 12px" }}>
                หน้า {page} จาก {Math.ceil(totalAttempts / limit)} ({totalAttempts} รายการ)
              </span>
              <button
                disabled={page >= Math.ceil(totalAttempts / limit)}
                onClick={() => setPage((p) => p + 1)}
                className="btn btn-secondary btn-sm"
              >
                ถัดไป ▶
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: QUIZZES MANAGEMENT */}
      {activeTab === "quizzes" && (
        <div className="card mt-4">
          <div className="flex justify-between items-center mb-4">
            <h2>รายการชุดข้อสอบทั้งหมด</h2>
            <Link href="/admin/import" className="btn btn-primary btn-sm">
              + นำเข้าข้อสอบใหม่จาก CSV
            </Link>
          </div>

          {loadingQuizzes ? (
            <p className="text-center muted" style={{ padding: "40px" }}>
              <span className="spinner spinner-dark mr-2" /> กำลังโหลดชุดข้อสอบ...
            </p>
          ) : quizzes.length === 0 ? (
            <div className="text-center muted" style={{ padding: "40px" }}>
              ยังไม่มีชุดข้อสอบในระบบ กรุณานำเข้าจาก CSV
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ชื่อชุดข้อสอบ</th>
                    <th>คำอธิบาย</th>
                    <th>จำนวนข้อ</th>
                    <th>สถานะ</th>
                    <th>วันที่สร้าง</th>
                    <th>การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {quizzes.map((quiz) => (
                    <tr key={quiz.id}>
                      <td>
                        <strong>{quiz.title}</strong>
                      </td>
                      <td style={{ maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {quiz.description || "-"}
                      </td>
                      <td>{quiz.question_count} ข้อ</td>
                      <td>
                        {quiz.is_published ? (
                          <span className="badge badge-success">เผยแพร่อยู่</span>
                        ) : (
                          <span className="badge badge-warning">แบบร่าง (ยังไม่เผยแพร่)</span>
                        )}
                      </td>
                      <td>
                        {quiz.created_at
                          ? new Date(quiz.created_at).toLocaleDateString("th-TH")
                          : "-"}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className={`btn btn-sm ${quiz.is_published ? "btn-secondary" : "btn-success"}`}
                            disabled={togglingQuizId === quiz.id}
                            onClick={() => togglePublish(quiz)}
                          >
                            {quiz.is_published ? "ปิดการสอบ" : "เปิดให้ทำข้อสอบ"}
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => copyLink(quiz.id)}
                          >
                            {copiedId === quiz.id ? "✓ คัดลอกแล้ว" : "🔗 ลิงก์สอบ"}
                          </button>
                          <Link
                            href={`/exam/${quiz.id}`}
                            target="_blank"
                            className="btn btn-secondary btn-sm"
                          >
                            ดูหน้าสอบ ↗
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GUIDE */}
      {activeTab === "guide" && (
        <div className="card mt-4">
          <h2>ขั้นตอนการติดตั้ง Google Sheets & Apps Script Webhook</h2>
          <ol style={{ paddingLeft: "24px", lineHeight: "1.8", margin: "16px 0" }}>
            <li>
              สร้าง <strong>Google Spreadsheet</strong> ใหม่ แล้วคัดลอก Spreadsheet ID จาก URL บนแถบเบราว์เซอร์
              (เช่น <code>https://docs.google.com/spreadsheets/d/<strong>YOUR_SPREADSHEET_ID</strong>/edit</code>)
            </li>
            <li>
              ไปที่เมนู <strong>Extensions &gt; Apps Script</strong>
            </li>
            <li>
              ลบโค้ดเดิมทั้งหมด แล้ววางโค้ดจากไฟล์ <code>google-apps-script/Code.gs</code> ในโปรเจกต์นี้
            </li>
            <li>
              ไปที่ <strong>Project Settings (ไอคอนฟันเฟือง) &gt; Script Properties</strong> แล้วกด <strong>Add script property</strong> 2 รายการ:
              <ul style={{ margin: "8px 0 8px 20px" }}>
                <li><code>SPREADSHEET_ID</code> = ค่า Spreadsheet ID ที่คัดลอกมา</li>
                <li><code>WEBHOOK_SECRET</code> = รหัสลับ เช่น <code>my-super-secret-key-12345</code></li>
              </ul>
            </li>
            <li>
              กดปุ่ม <strong>Deploy &gt; New deployment</strong>:
              <ul style={{ margin: "8px 0 8px 20px" }}>
                <li>เลือก Type: <strong>Web app</strong></li>
                <li>Execute as: <strong>Me</strong></li>
                <li>Who has access: <strong>Anyone</strong> (ทุกคน เพื่อให้ Next.js เซิร์ฟเวอร์เรียก Webhook เข้ามาได้)</li>
              </ul>
            </li>
            <li>
              กด Deploy แล้วคัดลอก <strong>Web app URL</strong> (ลงท้ายด้วย <code>/exec</code>)
            </li>
            <li>
              นำมาตั้งค่าในไฟล์ <code>.env.local</code> ของโปรเจกต์ Next.js:
              <pre style={{ background: "var(--bg)", padding: "12px", borderRadius: "8px", marginTop: "8px" }}>
{`GOOGLE_SHEETS_WEBHOOK_URL="https://script.google.com/macros/s/AKfycb.../exec"
GOOGLE_SHEETS_WEBHOOK_SECRET="my-super-secret-key-12345"`}
              </pre>
            </li>
          </ol>
          <div className="alert alert-info">
            💡 เมื่อนักศึกษาทำข้อสอบเสร็จ ระบบจะส่งผลสอบไปยัง Google Apps Script อัตโนมัติ หากเน็ตหลุดหรือปลายทางล้มเหลว สามารถกดปุ่ม <strong>"ส่งซ้ำ (Retry)"</strong> ในตารางผลสอบเพื่อส่งใหม่ได้ทันที
          </div>
        </div>
      )}
    </div>
  );
}
