import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, logAudit, updateUserPresence, initDatabase, ensureBuiltInAccount, createLoginOtp } from "@/lib/db";
import { regenerateSession } from "@/lib/security";
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from "@/lib/auth-security";
import { validateApiRequest, withRateLimit } from "@/lib/api-security";
import bcrypt from "bcryptjs";
import { withSecurityHeaders, withCorsHeaders, getClientIp, sanitizeString } from "@/lib/security-headers";
import { createVerificationOtpEmailHtml, getSiteUrl, sendEmail } from "@/lib/mail";

export async function POST(request: NextRequest) {
  try {
    await initDatabase();

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const rateLimit = await withRateLimit(request, `login:${getClientIp(request)}`);
    if (rateLimit) return rateLimit;

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      const response = NextResponse.json({ success: false, error: "Missing email or password" }, { status: 400 });
      return withSecurityHeaders(withCorsHeaders(request, response));
    }

    const sanitizedEmail = sanitizeString(String(email), 200).toLowerCase().trim();
    if (!sanitizedEmail.includes("@") || sanitizedEmail.length > 200) {
      const response = NextResponse.json({ success: false, error: "Invalid email format" }, { status: 400 });
      return withSecurityHeaders(withCorsHeaders(request, response));
    }

    const rateLimitKey = `${getClientIp(request)}:${sanitizedEmail}`;
    const rateLimitStatus = checkRateLimit(rateLimitKey);

    if (!rateLimitStatus.allowed) {
      const waitMinutes = rateLimitStatus.lockedUntil ? Math.ceil((rateLimitStatus.lockedUntil - Date.now()) / 60000) : 15;
      const response = NextResponse.json({
        success: false,
        error: `Too many failed attempts. Please try again in ${waitMinutes} minutes.`,
        locked: true,
        retryAfter: rateLimitStatus.lockedUntil,
      }, { status: 429 });
      return withSecurityHeaders(withCorsHeaders(request, response));
    }

    await ensureBuiltInAccount(sanitizedEmail);

    const user = await Promise.race([
      findUserByEmail(sanitizedEmail),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Database lookup timed out")), 5000);
      }),
    ]);
    if (process.env.NODE_ENV !== "production") {
      console.log("[login] user found:", !!user, user?.email, user?.role, "emailVerified:", user?.emailVerified, "hasPassword:", !!user?.password);
    }
    if (!user) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[login] user not found for email:", sanitizedEmail);
      }
      recordFailedAttempt(rateLimitKey);
      const response = NextResponse.json({ success: false, error: "Invalid email or password" }, { status: 401 });
      return withSecurityHeaders(withCorsHeaders(request, response));
    }

    const pwOk = await bcrypt.compare(String(password), user.password);
    if (process.env.NODE_ENV !== "production") {
      console.log("[login] password compare result:", pwOk, "for email:", sanitizedEmail);
    }
    if (!pwOk) {
      recordFailedAttempt(rateLimitKey);
      await logAudit(user.id, "login_failed", { email: user.email, reason: "invalid_password" }, getClientIp(request), request.headers.get("user-agent") || "unknown").catch(() => {});
      const response = NextResponse.json({ success: false, error: "Invalid email or password" }, { status: 401 });
      return withSecurityHeaders(withCorsHeaders(request, response));
    }

    if (!user.emailVerified) {
      let devOtp: string | undefined;
      const devShowOtp = process.env.DEV_SHOW_OTP === "true";
      try {
        const otp = await createLoginOtp(user.id, 15);
        if (devShowOtp) devOtp = otp;
        const origin = getSiteUrl(request.nextUrl.origin);
        const verifyUrl = `${origin}/verify-otp?email=${encodeURIComponent(user.email)}`;
        await sendEmail({
          to: user.email,
          subject: "Your RentTrack Verification Code",
          text: `Hello ${user.name},\n\nA sign-in attempt requires account verification.\n\nYour 6-Digit Verification Code: ${otp}\n\nPlease verify your account here:\n${verifyUrl}\n\nThis code will expire in 15 minutes.`,
          html: createVerificationOtpEmailHtml({
            title: "Verify Your Account",
            name: user.name,
            code: otp,
            verifyUrl,
            isReminder: true,
          }),
        });
      } catch (otpErr) {
        console.error("Failed to generate or send login OTP:", otpErr);
      }

      const response = NextResponse.json({
        success: false,
        error: "Please verify your account before logging in. A verification code has been sent to your email.",
        needsVerification: true,
        email: user.email,
        userId: user.id,
        ...(devOtp ? { devOtp } : {}),
      }, { status: 403 });
      return withSecurityHeaders(withCorsHeaders(request, response));
    }

    clearRateLimit(rateLimitKey);

    void Promise.allSettled([
      updateUserPresence(user.id, { markLogin: true }),
      logAudit(user.id, "login_success", { email: user.email, role: user.role }, getClientIp(request), request.headers.get("user-agent") || "unknown"),
    ]);

    const safeUser = { ...user };
    delete safeUser.password;
    const response = NextResponse.json({ success: true, user: safeUser });
    regenerateSession(response, user.id);
    return withSecurityHeaders(withCorsHeaders(request, response));
  } catch (error: any) {
    console.error("Login error:", error instanceof Error ? error.message : error);
    const rawMessage = typeof error === "object" && error && "message" in error ? String((error as any).message) : "Login failed";
    const lowerMessage = rawMessage.toLowerCase();
    const isSchemaCacheUnavailable = lowerMessage.includes("schema cache") || (typeof error === "object" && error && (error as any).code === "PGRST205");
    const isDatabaseUnavailable = lowerMessage.includes("fetch failed")
      || lowerMessage.includes("enotfound")
      || lowerMessage.includes("econnrefused")
      || lowerMessage.includes("database lookup timed out")
      || lowerMessage.includes("exceed_egress_quota")
      || lowerMessage.includes("service for this project is restricted")
      || isSchemaCacheUnavailable;
    const friendlyMessage =
      lowerMessage.includes("exceed_egress_quota") || lowerMessage.includes("service for this project is restricted")
        ? "Supabase has restricted this project because it exceeded its egress quota. Remove the spend cap or upgrade the Supabase plan, then try again."
        : isSchemaCacheUnavailable
        ? "Login service cannot access the users table. Refresh the Supabase API schema cache and confirm this deployment uses the correct Supabase project."
        : isDatabaseUnavailable
        ? "Login service is temporarily unavailable. Please check the Supabase URL/network connection and try again."
        : (lowerMessage.includes("relation") && lowerMessage.includes("does not exist")) ||
          (lowerMessage.includes("table") && lowerMessage.includes("does not exist")) ||
          (typeof error === "object" && error && (error.code === "42P01" || (error as any).status === "42P01"))
        ? "Database not initialized yet. Run scripts/supabase-schema.sql in Supabase SQL Editor first."
        : lowerMessage.includes("missing")
        ? `${rawMessage} — set this in Vercel: Project Settings → Environment Variables → NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY`
        : lowerMessage.includes("invalid") || lowerMessage.includes("not found")
        ? "Invalid email or password"
        : rawMessage || "Login failed";
    const response = NextResponse.json({ success: false, error: friendlyMessage }, { status: isDatabaseUnavailable ? 503 : 500 });
    return withSecurityHeaders(withCorsHeaders(request, response));
  }
}
