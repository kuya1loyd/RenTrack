import { NextRequest, NextResponse } from "next/server";
import { verifyLoginOtp, initDatabase, findUserById, logAudit } from "@/lib/db";
import { regenerateSession } from "@/lib/security";
import { withSecurityHeaders, withCorsHeaders, getClientIp } from "@/lib/security-headers";

export async function POST(request: NextRequest) {
  try {
    await initDatabase();

    const { userId, otp } = await request.json();
    if (!userId || !otp) {
      return NextResponse.json({ success: false, error: "User ID and verification code are required" }, { status: 400 });
    }

    const result = await verifyLoginOtp(userId, otp);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    const user = await findUserById(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const response = NextResponse.json({
      success: true,
      message: "Login verified successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        createdAt: user.createdAt,
      },
    });
    regenerateSession(response, user.id, user.role);

    try {
      await logAudit(user.id, "login_success", { email: user.email, role: user.role }, getClientIp(request), request.headers.get("user-agent") || "unknown");
    } catch {}

    return withSecurityHeaders(withCorsHeaders(request, response));
  } catch (error) {
    console.error("Verify login OTP error:", error);
    return NextResponse.json({ success: false, error: "Verification failed" }, { status: 500 });
  }
}
