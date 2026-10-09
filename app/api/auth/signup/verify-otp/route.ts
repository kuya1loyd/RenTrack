import { NextRequest, NextResponse } from "next/server";
import { verifyLoginOtp, initDatabase, findUserByEmail, findUserById, logAudit, updateUser, getAllUsers, createNotification } from "@/lib/db";
import { withSecurityHeaders, withCorsHeaders, validateApiRequest, getClientIp } from "@/lib/api-security";
import { checkVerifyRateLimit, clearVerifyRateLimit, VERIFY_LOCKOUT_DURATION_MS } from "@/lib/auth-security";

export async function POST(request: NextRequest) {
  try {
    await initDatabase();

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const { email, userId, otp } = await request.json();
    if ((!email && !userId) || !otp) {
      return NextResponse.json({ success: false, error: "Email/User ID and verification code are required" }, { status: 400 });
    }

    const ip = getClientIp(request);

    let resolvedUserId = userId;
    if (!resolvedUserId && email) {
      const userByEmail = await findUserByEmail(String(email).toLowerCase().trim());
      if (!userByEmail) {
        return NextResponse.json({ success: false, error: "No account found with this email" }, { status: 404 });
      }
      resolvedUserId = userByEmail.id;
    }

    if (!resolvedUserId) {
      return NextResponse.json({ success: false, error: "User ID or email is required" }, { status: 400 });
    }

    const rateLimitKey = `signup_verify:${ip}:${resolvedUserId}`;
    const rateLimit = checkVerifyRateLimit(rateLimitKey);

    if (!rateLimit.allowed) {
      const waitMinutes = Math.max(1, Math.ceil((rateLimit.lockedUntil || Date.now() + VERIFY_LOCKOUT_DURATION_MS) - Date.now()) / 60000);
      return NextResponse.json({
        success: false,
        error: `Too many verification attempts. Please try again in ${waitMinutes} minute${waitMinutes > 1 ? "s" : ""}.`,
        locked: true,
        retryAfter: rateLimit.lockedUntil,
      }, { status: 429 });
    }

    const result = await verifyLoginOtp(resolvedUserId, otp);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    const user = await findUserById(resolvedUserId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    await updateUser(resolvedUserId, { emailVerified: true, verificationToken: null, verificationExpiresAt: null });

    const updatedUser = await findUserById(resolvedUserId);
    if (!updatedUser || !updatedUser.emailVerified) {
      return NextResponse.json({ success: false, error: "Failed to verify email. Please try again." }, { status: 500 });
    }

    clearVerifyRateLimit(rateLimitKey);

    try {
      await logAudit(resolvedUserId, "email_verified", { email: user.email, role: user.role }, ip, request.headers.get("user-agent") || "unknown");
    } catch {}

    if (user.role === "agent") {
      try {
        const recipients = (await getAllUsers()).filter((candidate: any) => ["owner", "admin"].includes(candidate.role));
        await Promise.allSettled(recipients.map((recipient: any) => createNotification({
          userId: recipient.id,
          title: "Agent email verified",
          message: `Agent ${user.name} has verified their email and can now log in.`,
          type: "system",
          read: false,
        })));
      } catch (notificationError) {
        console.error("Verified agent notification failed:", notificationError);
      }
    } else if (user.role === "tenant") {
      try {
        const recipients = (await getAllUsers()).filter((candidate: any) => ["owner", "admin"].includes(candidate.role));
        await Promise.allSettled(recipients.map((recipient: any) => createNotification({
          userId: recipient.id,
          title: "Tenant account verified",
          message: `Tenant ${user.name} has verified their account and can now log in.`,
          type: "system",
          read: false,
        })));
      } catch (notificationError) {
        console.error("Verified tenant notification failed:", notificationError);
      }
    }

    const safeUser = { ...updatedUser };
    delete safeUser.password;
    const response = NextResponse.json({
      success: true,
      verified: true,
      user: safeUser,
      message: "Account verified successfully! You can now log in.",
    });
    return withSecurityHeaders(withCorsHeaders(request, response));
  } catch (error) {
    console.error("Verify signup OTP error:", error);
    return NextResponse.json({ success: false, error: "Verification failed" }, { status: 500 });
  }
}
