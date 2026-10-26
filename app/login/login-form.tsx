"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { loginStudentAction, loginAdminAction, AuthState } from "./actions";

export default function LoginForm() {
  const [isAdminMode, setIsAdminMode] = useState(false);

  const [studentState, studentFormAction, isStudentPending] = useActionState(
    loginStudentAction,
    {} as AuthState
  );

  const [adminState, adminFormAction, isAdminPending] = useActionState(
    loginAdminAction,
    {} as AuthState
  );

  return (
    <div className="card" style={{ maxWidth: "480px", margin: "24px auto" }}>
      {!isAdminMode ? (
        /* STUDENT LOGIN */
        <div>
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <h2>เข้าสู่ระบบนักศึกษา</h2>
            <p className="muted">
              กรอกรหัสนักศึกษาของคุณเพื่อเข้าทำข้อสอบและดูประวัติคะแนน
            </p>
          </div>

          {studentState.error && (
            <div className="alert alert-error mb-4">{studentState.error}</div>
          )}

          <form action={studentFormAction}>
            <div className="field">
              <label>
                รหัสนักศึกษา <span className="error">*</span>
              </label>
              <input
                name="studentId"
                type="text"
                required
                placeholder="ตัวอย่างเช่น 6501234567"
                autoComplete="off"
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", marginTop: "16px", padding: "12px" }}
              disabled={isStudentPending}
            >
              {isStudentPending ? (
                <>
                  <span className="spinner mr-2" /> กำลังเข้าสู่ระบบ...
                </>
              ) : (
                "เข้าสู่ระบบ ➔"
              )}
            </button>
          </form>

          <div
            className="text-center mt-4"
            style={{ paddingTop: "16px", borderTop: "1px solid var(--border)" }}
          >
            <p className="muted" style={{ fontSize: "0.95rem" }}>
              ยังไม่เคยลงทะเบียน?{" "}
              <Link href="/register" style={{ color: "var(--primary)", fontWeight: 700 }}>
                ลงทะเบียนนักศึกษาใหม่ที่นี่ ➔
              </Link>
            </p>
            <p style={{ marginTop: "12px" }}>
              <button
                type="button"
                onClick={() => setIsAdminMode(true)}
                className="btn btn-outline btn-sm"
                style={{ fontSize: "0.82rem" }}
              >
                🔒 เข้าสู่ระบบสำหรับผู้ดูแล (Admin)
              </button>
            </p>
          </div>
        </div>
      ) : (
        /* ADMIN LOGIN */
        <div>
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <h2>เข้าสู่ระบบผู้ดูแลระบบ (Admin)</h2>
            <p className="muted">สำหรับครูผู้สอนหรือผู้ดูแลระบบจัดการข้อสอบ</p>
          </div>

          {adminState.error && (
            <div className="alert alert-error mb-4">{adminState.error}</div>
          )}

          <form action={adminFormAction}>
            <div className="field">
              <label>อีเมลผู้ดูแล (Email)</label>
              <input
                name="email"
                type="email"
                required
                placeholder="admin@example.com"
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="field">
              <label>รหัสผ่าน (Password)</label>
              <input
                name="password"
                type="password"
                required
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", marginTop: "16px", padding: "12px" }}
              disabled={isAdminPending}
            >
              {isAdminPending ? (
                <>
                  <span className="spinner mr-2" /> กำลังตรวจสอบ...
                </>
              ) : (
                "เข้าสู่ระบบผู้ดูแล ➔"
              )}
            </button>
          </form>

          <div
            className="text-center mt-4"
            style={{ paddingTop: "16px", borderTop: "1px solid var(--border)" }}
          >
            <button
              type="button"
              onClick={() => setIsAdminMode(false)}
              className="btn btn-secondary btn-sm"
            >
              ← กลับไปยังหน้าเข้าสู่ระบบนักศึกษา
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
