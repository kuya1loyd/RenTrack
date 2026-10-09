import { NextRequest, NextResponse } from "next/server";
import { createUser, findUserByEmail, initDatabase, findOrCreateAdmin, createLoginOtp, logAudit } from "@/lib/db";
import { sendEmail, getSiteUrl, createVerificationOtpEmailHtml } from "@/lib/mail";
import { validatePasswordStrength } from "@/lib/auth-security";
import {
  validateApiRequest, withRateLimit, withSecurityHeaders, withCorsHeaders,
  sanitizeObject, getClientIp
} from "@/lib/api-security";

export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    await findOrCreateAdmin();

    const rateLimit = await withRateLimit(request, `signup:${getClientIp(request)}`);
    if (rateLimit) return rateLimit;

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const { name, email, password, role, phone, address } = await request.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const allowedRoles = ["tenant", "agent", "owner"];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ success: false, error: "Invalid role" }, { status: 403 });
    }

    const sanitizedEmail = String(email).toLowerCase().trim().replace(/[^a-zA-Z0-9@._+-]/g, "");
    if (!sanitizedEmail.includes("@") || sanitizedEmail.length > 200) {
      return NextResponse.json({ success: false, error: "Invalid email format" }, { status: 400 });
    }

    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      return NextResponse.json({ success: false, error: `Password too weak: ${strength.errors.join(", ")}` }, { status: 400 });
    }

    const existing = await findUserByEmail(sanitizedEmail);
    if (existing) {
      return NextResponse.json({ success: false, error: "An account with this email already exists" }, { status: 409 });
    }

    const sanitizedData = sanitizeObject(
      { name, email: sanitizedEmail, password, role, phone, address },
      [
        { key: "name", type: "string", maxLength: 200 },
        { key: "email", type: "string", maxLength: 200 },
        { key: "role", type: "string", maxLength: 20 },
        { key: "phone", type: "string", maxLength: 50 },
        { key: "address", type: "string", maxLength: 500 },
      ]
    );

    const user = await createUser(sanitizedData.name, sanitizedData.email, password, sanitizedData.role, sanitizedData.phone, undefined, sanitizedData.address);
    const otp = await createLoginOtp(user.id, 15);

    const origin = getSiteUrl(request.nextUrl.origin);
    const devShowOtp = process.env.DEV_SHOW_OTP === "true";
    let emailError: string | null = null;

    try {
      await sendEmail({
        to: user.email,
        subject: "Verify your RentTrack account",
        text: `Hello ${sanitizedData.name},\n\nThank you for creating an account on RentTrack.\n\nYour 6-Digit Verification Code: ${otp}\n\nPlease verify your account here:\n${origin}/verify-otp?email=${encodeURIComponent(user.email)}\n\nThis code will expire in 15 minutes.`,
        html: createVerificationOtpEmailHtml({
          title: "Welcome to RentTrack",
          name: sanitizedData.name,
          code: otp,
          verifyUrl: `${origin}/verify-otp?email=${encodeURIComponent(user.email)}`,
          credentials: {
            email: user.email,
            role: sanitizedData.role,
          },
        }),
      });
    } catch (err) {
      console.error("Failed to send verification email:", err);
      emailError = err instanceof Error ? err.message : "Failed to send verification email";
    }

    const responseBody: any = { success: true, needsOtp: true, email: user.email, userId: user.id };
    if (emailError) {
      responseBody.emailError = emailError;
      responseBody.message = devShowOtp
        ? `Dev mode: verification code is ${otp}`
        : "Account created, but we could not send the verification email. Please contact support or try again later.";
    } else {
      responseBody.message = "Account created! Please check your email for the verification code.";
    }
    if (devShowOtp && !emailError) {
      responseBody.devOtp = otp;
    }
    const response = NextResponse.json(responseBody);
    return withSecurityHeaders(withCorsHeaders(request, response));
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ success: false, error: "Signup failed" }, { status: 500 });
  }
}
