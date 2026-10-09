import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase, findUserById, initDatabase, logAudit } from "@/lib/db";
import bcrypt from "bcryptjs";
import { requireAuth, validateApiRequest, withSecurityHeaders, withCorsHeaders, getClientIp, getUserAgent } from "@/lib/api-security";

export async function POST(request: NextRequest) {
  try {
    await initDatabase();

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const body = await request.json().catch(() => null);
    if (!body) {
      const res = NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
      return withSecurityHeaders(withCorsHeaders(request, res));
    }

    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      const res = NextResponse.json({ success: false, error: "Current password and new password are required" }, { status: 400 });
      return withSecurityHeaders(withCorsHeaders(request, res));
    }

    if (String(newPassword).length < 6) {
      const res = NextResponse.json({ success: false, error: "New password must be at least 6 characters" }, { status: 400 });
      return withSecurityHeaders(withCorsHeaders(request, res));
    }

    const user = await findUserById(auth.userId);
    if (!user) {
      const res = NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
      return withSecurityHeaders(withCorsHeaders(request, res));
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatches) {
      const res = NextResponse.json({ success: false, error: "Current password is incorrect" }, { status: 401 });
      return withSecurityHeaders(withCorsHeaders(request, res));
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const { error: passwordError } = await getAdminSupabase()
      .schema("public")
      .from("users")
      .update({ password: newHash })
      .eq("id", auth.userId);

    if (passwordError) {
      console.error("Password update error:", passwordError);
      const res = NextResponse.json({ success: false, error: "Failed to update password" }, { status: 500 });
      return withSecurityHeaders(withCorsHeaders(request, res));
    }

    await logAudit(
      auth.userId,
      "change_password",
      { success: true },
      getClientIp(request),
      getUserAgent(request)
    ).catch(() => {});

    const res = NextResponse.json({ success: true, message: "Password updated successfully" });
    return withSecurityHeaders(withCorsHeaders(request, res));
  } catch (error) {
    console.error("Change password error:", error);
    const res = NextResponse.json({ success: false, error: "Failed to update password" }, { status: 500 });
    return withSecurityHeaders(withCorsHeaders(request, res));
  }
}
