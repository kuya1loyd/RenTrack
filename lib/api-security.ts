import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/security";
import { findUserById, logAudit } from "@/lib/db";
import {
  withSecurityHeaders,
  withCorsHeaders,
  validateContentType,
  checkRequestSize,
  getClientIp,
  getUserAgent,
} from "@/lib/security-headers";
export { getClientIp, getUserAgent } from "@/lib/security-headers";
export { checkRateLimit, recordFailedAttempt } from "@/lib/auth-security";
export { withSecurityHeaders, withCorsHeaders, sanitizeObject, validateContentType, checkRequestSize } from "@/lib/security-headers";

export interface SecureContext {
  userId: string;
  user: Awaited<ReturnType<typeof findUserById>>;
  ip: string;
  userAgent: string;
}

export async function requireAuth(request: NextRequest): Promise<SecureContext | NextResponse> {
  const userId = getSessionUserId(request);
  if (!userId) {
    const response = NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    return withSecurityHeaders(withCorsHeaders(request, response));
  }

  const user = await findUserById(userId);
  if (!user) {
    const response = NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    return withSecurityHeaders(withCorsHeaders(request, response));
  }

  return {
    userId,
    user,
    ip: getClientIp(request),
    userAgent: getUserAgent(request),
  };
}

export async function requireRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<SecureContext | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!allowedRoles.includes(auth.user.role)) {
    await logAudit(auth.userId, "access_denied", { route: request.nextUrl.pathname, allowedRoles, actualRole: auth.user.role }, auth.ip, auth.userAgent);
    const response = NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 });
    return withSecurityHeaders(withCorsHeaders(request, response));
  }

  return auth;
}

export function validateApiRequest(request: NextRequest): NextResponse | null {
  if (!validateContentType(request)) {
    const response = NextResponse.json({ success: false, error: "Invalid content type" }, { status: 415 });
    return withSecurityHeaders(withCorsHeaders(request, response));
  }

  if (!checkRequestSize(request)) {
    const response = NextResponse.json({ success: false, error: "Request too large" }, { status: 413 });
    return withSecurityHeaders(withCorsHeaders(request, response));
  }

  return null;
}

export async function withRateLimit(request: NextRequest, identifier?: string): Promise<NextResponse | null> {
  if (identifier?.startsWith("login:") || request.nextUrl.pathname.includes("/auth/login") || request.nextUrl.pathname.endsWith("/login")) {
    return null;
  }
  const key = identifier || `${getClientIp(request)}:${request.nextUrl.pathname}`;
  const { checkRateLimit } = await import("@/lib/auth-security");
  const limit = checkRateLimit(key);

  if (!limit.allowed) {
    const waitMinutes = limit.lockedUntil ? Math.ceil((limit.lockedUntil - Date.now()) / 60000) : 15;
    const response = NextResponse.json(
      { success: false, error: `Too many requests. Please try again in ${waitMinutes} minutes.` },
      { status: 429 }
    );
    response.headers.set("Retry-After", String(Math.ceil((limit.lockedUntil || Date.now() + 15 * 60 * 1000) - Date.now()) / 1000));
    return withSecurityHeaders(withCorsHeaders(request, response));
  }

  return null;
}

export function sanitizeResponse<T extends Record<string, any>>(data: T, sensitiveFields = ["password", "payment_pin_hash", "verification_token", "login_otp", "code_hash"]): T {
  const sanitized = { ...data };
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      delete sanitized[field];
    }
  }
  return sanitized;
}
