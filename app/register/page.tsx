import RegisterForm from "./register-form";

export const metadata = {
  title: "ลงทะเบียนนักศึกษาใหม่ — QuizHub",
  description: "ลงทะเบียนด้วยชื่อ-นามสกุล และรหัสนักศึกษา เพื่อเข้าทำข้อสอบในระบบ",
};

export default function RegisterPage() {
  return (
    <main>
      <div className="text-center" style={{ marginTop: "16px" }}>
        <h1>ลงทะเบียนเข้าสู่ระบบ</h1>
        <p className="muted">QuizHub — แบบทดสอบออนไลน์</p>
      </div>

      <RegisterForm />
    </main>
  );
}
