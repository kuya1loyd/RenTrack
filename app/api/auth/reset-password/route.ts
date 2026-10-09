import { NextRequest, NextResponse } from "next/server";
import { findUserById, resetUserPassword, initDatabase } from "@/lib/db";
import { sendEmail } from "@/lib/mail";
import {
  requireAuth, validateApiRequest, withRateLimit,
  getClientIp
} from "@/lib/api-security";
import { logAudit } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    await initDatabase();

    const rateLimit = await withRateLimit(request, `reset_password:${getClientIp(request)}`);
    if (rateLimit) return rateLimit;

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const currentUser = auth.user;
    if (currentUser.role !== "admin" && currentUser.role !== "owner") {
      return NextResponse.json({ success: false, error: "Only admin or owner can reset passwords" }, { status: 403 });
    }

    const { userId, newPassword, currentPassword } = await request.json();
    if (!userId || !newPassword) {
      return NextResponse.json({ success: false, error: "User ID and new password are required" }, { status: 400 });
    }

    const bcrypt = (await import("bcryptjs")).default;
    let passwordMatches = true;
    if (currentPassword) {
      passwordMatches = await bcrypt.compare(currentPassword, currentUser.password);
    }
    if (!passwordMatches) {
      await logAudit(auth.userId, "password_reset_failed", { reason: "invalid_admin_password", targetUserId: userId }, auth.ip, auth.userAgent);
      return NextResponse.json({ success: false, error: "Your current password is incorrect" }, { status: 401 });
    }

    if (String(newPassword).length < 8) {
      return NextResponse.json({ success: false, error: "New password must be at least 8 characters" }, { status: 400 });
    }

    const targetUser = await findUserById(userId);
    if (!targetUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    await resetUserPassword(userId, newPassword);

    await sendEmail({
      to: targetUser.email,
      subject: "Your RentTrack password has been reset",
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; padding: 0; background: #f3f4f6; color: #1f2937;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f3f4f6; padding: 40px 0;">
            <tr><td align="center"><table width="100%" style="max-width: 560px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
              <tr><td style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 40px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">RentTrack</h1>
              </td></tr>
              <tr><td style="padding: 40px 40px 30px;">
                <h2 style="color: #111827; margin: 0 0 16px; font-size: 22px; font-weight: 700;">Password Reset Successful</h2>
                <p style="color: #4b5563; line-height: 1.7; margin: 0 0 8px; font-size: 15px;">Hello <strong>${targetUser.name}</strong>,</p>
                <p style="color: #4b5563; line-height: 1.7; margin: 0 0 8px; font-size: 15px;">Your password has been reset by <strong>${currentUser.name}</strong> (${currentUser.role}).</p>
                <p style="color: #4b5563; line-height: 1.7; margin: 0 0 8px; font-size: 15px;">You can now log in with your new password.</p>
                <p style="color: #dc2626; line-height: 1.7; margin: 16px 0 0; font-size: 14px; font-weight: 600;">If you did not expect this change, please contact support immediately at admin@renttrack.com.</p>
              </td></tr>
            </table></td></tr>
          </table>
        </div>
      `,
    }).catch((err) => {
      console.error("Failed to send password reset email:", err);
    });

    await logAudit(auth.userId, "password_reset", { targetUserId: userId, targetUserName: targetUser.name }, auth.ip, auth.userAgent);
    return NextResponse.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ success: false, error: "Failed to reset password" }, { status: 500 });
  }
}
