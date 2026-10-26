import LoginForm from "./login-form";

export const metadata = {
  title: "เข้าสู่ระบบ / สมัครสมาชิก — QuizHub",
  description: "เข้าสู่ระบบเพื่อจัดการข้อสอบและดูประวัติผลการสอบ",
};

export default function LoginPage() {
  return (
    <main>
      <div className="text-center" style={{ marginTop: "16px" }}>
        <h1>ยินดีต้อนรับสู่ QuizHub</h1>
        <p className="muted">ระบบทำข้อสอบออนไลน์และจัดการผลสอบ</p>
      </div>

      <LoginForm />
    </main>
  );
}
