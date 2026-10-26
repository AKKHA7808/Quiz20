"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuthState = {
  error?: string;
  success?: string;
};

/** Helper to generate internal student credentials */
function getStudentCredentials(studentId: string) {
  const cleanId = studentId.trim().toLowerCase();
  return {
    email: `${cleanId}@student.quizhub`,
    password: `std_${cleanId}_quizhub`,
  };
}

/** Action for Student Registration (Name + Student ID only) */
export async function registerStudentAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const studentId = String(formData.get("studentId") ?? "").trim();

  if (!fullName) {
    return { error: "กรุณากรอกชื่อ-นามสกุล" };
  }

  if (!studentId) {
    return { error: "กรุณากรอกรหัสนักศึกษา" };
  }

  // Parse first and last name
  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || firstName;

  const { email, password } = getStudentCredentials(studentId);
  const adminClient = createAdminClient();

  // Try to create the user in Supabase Auth via Admin Client
  const { data: newUser, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        student_id: studentId,
        full_name: fullName,
      },
    });

  if (createError) {
    // If user already exists, update their metadata
    if (
      createError.message.includes("already registered") ||
      createError.message.includes("exists")
    ) {
      // Find existing user and update metadata
      const { data: existingUsers } =
        await adminClient.auth.admin.listUsers();
      const existing = existingUsers?.users?.find(
        (u) => u.email === email
      );
      if (existing) {
        await adminClient.auth.admin.updateUserById(existing.id, {
          password,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
            student_id: studentId,
            full_name: fullName,
          },
        });
      }
    } else {
      return { error: `ลงทะเบียนไม่สำเร็จ: ${createError.message}` };
    }
  }

  // Auto sign in the student
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return {
      error:
        "ลงทะเบียนสำเร็จแล้ว แต่เข้าสู่ระบบอัตโนมัติไม่สำเร็จ กรุณาไปที่หน้าเข้าสู่ระบบและใส่รหัสนักศึกษา",
    };
  }

  redirect("/dashboard");
}

/** Action for Student Login (Student ID only) */
export async function loginStudentAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const studentId = String(formData.get("studentId") ?? "").trim();

  if (!studentId) {
    return { error: "กรุณากรอกรหัสนักศึกษา" };
  }

  const { email, password } = getStudentCredentials(studentId);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error:
        "ไม่พบรหัสนักศึกษานี้ในระบบ กรุณาตรวจสอบรหัส หรือไปที่หน้า 'ลงทะเบียนนักศึกษาใหม่'",
    };
  }

  redirect("/dashboard");
}

/** Action for Admin Login (Email + Password) */
export async function loginAdminAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "กรุณากรอกอีเมลและรหัสผ่านสำหรับผู้ดูแล" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "อีเมลหรือรหัสผ่านผู้ดูแลระบบไม่ถูกต้อง" };
  }

  redirect("/admin");
}

/** Action for Logout */
export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
