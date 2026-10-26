"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerStudentAction, AuthState } from "../login/actions";

export default function RegisterForm() {
  const [state, formAction, isPending] = useActionState(
    registerStudentAction,
    {} as AuthState
  );

  return (
    <div className="card" style={{ maxWidth: "480px", margin: "24px auto" }}>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <h2>ลงทะเบียนนักศึกษาใหม่</h2>
        <p className="muted">
          กรอกชื่อ-นามสกุล และรหัสนักศึกษาเพื่อเข้าใช้งานระบบ ไม่ต้องใช้อีเมลหรือรหัสผ่าน
        </p>
      </div>

      {state.error && (
        <div className="alert alert-error mb-4">{state.error}</div>
      )}

      {state.success && (
        <div className="alert alert-success mb-4">{state.success}</div>
      )}

      <form action={formAction}>
        <div className="field">
          <label>
            ชื่อ - นามสกุล <span className="error">*</span>
          </label>
          <input
            name="fullName"
            type="text"
            required
            maxLength={100}
            placeholder="ตัวอย่างเช่น สมชาย ใจดี"
            autoComplete="name"
          />
        </div>

        <div className="field">
          <label>
            รหัสนักศึกษา <span className="error">*</span>
          </label>
          <input
            name="studentId"
            type="text"
            required
            maxLength={40}
            placeholder="ตัวอย่างเช่น 6501234567"
            autoComplete="off"
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center", marginTop: "16px", padding: "12px" }}
          disabled={isPending}
        >
          {isPending ? (
            <>
              <span className="spinner mr-2" /> กำลังลงทะเบียน...
            </>
          ) : (
            "ลงทะเบียนและเข้าใช้งาน ➔"
          )}
        </button>
      </form>

      <div className="text-center mt-4" style={{ paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          มีรหัสนักศึกษาในระบบแล้ว?{" "}
          <Link href="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
            เข้าสู่ระบบที่นี่
          </Link>
        </p>
      </div>
    </div>
  );
}
