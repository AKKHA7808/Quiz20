import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Verify admin credentials for API routes.
 * Returns { user, isAdmin: true } or a NextResponse with 401/403.
 */
export async function verifyAdminApi(): Promise<
  | { authorized: true; userId: string }
  | { authorized: false; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบ" },
        { status: 401 }
      ),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "เฉพาะผู้ดูแลระบบเท่านั้น" },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, userId: user.id };
}
