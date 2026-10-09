import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, findUserById, createLoginOtp, initDatabase } from "@/lib/db";
import { sendEmail, getSiteUrl, createVerificationOtpEmailHtml } from "@/lib/mail";
import { withSecurityHeaders, withCorsHeaders, validateApiRequest, getClientIp } from "@/lib/api-security";
import { checkVerifyRateLimit, MAX_VERIFY_ATTEMPTS } from "@/lib/auth-security";

export async function POST(request: NextRequest) {
  try {
    await initDatabase();

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const { email, userId } = await request.json();
    if (!email && !userId) {
      return NextResponse.json({ success: false, error: "Email or User ID is required" }, { status: 400 });
    }

    const ip = getClientIp(request);

    let user;
    if (userId) {
      user = await findUserById(userId);
    } else if (email) {
      user = await findUserByEmail(String(email).toLowerCase().trim());
    }

    if (!user) {
      return NextResponse.json({ success: false, error: "No account found" }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ success: false, error: "Email is already verified" }, { status: 400 });
    }

    const rateLimitKey = `resend_verify:${ip}:${user.email.toLowerCase()}`;
    const rateLimit = checkVerifyRateLimit(rateLimitKey);

    if (!rateLimit.allowed) {
      const waitMinutes = Math.max(1, Math.ceil((rateLimit.lockedUntil || Date.now() + 5 * 60 * 1000) - Date.now()) / 60000);
      return NextResponse.json({
        success: false,
        error: `Too many resend requests. Please try again in ${waitMinutes} minute${waitMinutes > 1 ? "s" : ""}.`,
        locked: true,
        retryAfter: rateLimit.lockedUntil,
      }, { status: 429 });
    }

    const otp = await createLoginOtp(user.id, 15);
    const origin = getSiteUrl(request.nextUrl.origin);

    let emailError: string | null = null;
    const devShowOtp = process.env.DEV_SHOW_OTP === "true";

    try {
      const verifyUrl = `${origin}/verify-otp?email=${encodeURIComponent(user.email)}`;
      await sendEmail({
        to: user.email,
        subject: "Your RentTrack Verification Code",
        text: `Hello ${user.name},\n\nHere is your requested verification code: ${otp}\n\nPlease verify your account here:\n${verifyUrl}\n\nThis code will expire in 15 minutes.`,
        html: createVerificationOtpEmailHtml({
          title: "Verify Your Email",
          name: user.name,
          code: otp,
          verifyUrl,
          isReminder: true,
        }),
      });
    } catch (err) {
      console.error("Failed to send verification email:", err);
      emailError = err instanceof Error ? err.message : "Failed to send verification email";
    }

    const responseBody: any = { success: true };
    if (emailError) {
      responseBody.emailError = emailError;
      responseBody.message = devShowOtp
        ? `Dev mode: verification code is ${otp}`
        : "Verification code generated, but email delivery failed. Please contact support or try again later.";
    } else {
      responseBody.message = "Verification code sent";
    }
    if (devShowOtp && !emailError) {
      responseBody.devOtp = otp;
    }
    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json({ success: false, error: "Failed to send verification code" }, { status: 500 });
  }
}
