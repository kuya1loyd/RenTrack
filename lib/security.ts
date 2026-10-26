import { createHash, createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "renttrack_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function isSecureCookieEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

function getSessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecureCookieEnvironment(),
    path: "/",
    maxAge,
  };
}

function requireSessionSecret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("SESSION_SECRET environment variable is required");
  }
  return value;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  const secret = requireSessionSecret();
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function hashSecret(value: string) {
  return createHash("sha256").update(value.trim()).digest("hex");
}

export function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export interface SessionPayload {
  userId: string;
  role?: string;
  exp: number;
}

export function createSessionToken(userId: string, role?: string) {
  const payload: SessionPayload = {
    userId,
    role,
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function getSessionPayload(token?: string | null): SessionPayload | null {
  if (!token) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  try {
    const expected = sign(encoded);
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(signature);
    if (expectedBuffer.length !== actualBuffer.length) return null;
    if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

    const payload = JSON.parse(base64UrlDecode(encoded)) as SessionPayload;
    if (!payload.userId || !payload.exp || Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

export function verifySessionToken(token?: string | null): string | null {
  const payload = getSessionPayload(token);
  return payload ? payload.userId : null;
}

export function getSessionUserId(request: NextRequest): string | null {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export function getSessionRole(request: NextRequest): string | null {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = getSessionPayload(token);
  if (payload?.role) return payload.role;
  return request.cookies.get("renttrack_role")?.value || null;
}

export async function getCurrentUser(request: NextRequest) {
  const userId = getSessionUserId(request);
  if (!userId) return null;
  const { findUserById } = await import("@/lib/db");
  const user = await findUserById(userId);
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

export function setSessionCookie(response: NextResponse, userId: string, role?: string) {
  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(userId, role), getSessionCookieOptions());
  if (role) {
    response.cookies.set("renttrack_role", role, { path: "/", httpOnly: false, sameSite: "lax", maxAge: SESSION_TTL_SECONDS });
  }
}

export function regenerateSession(response: NextResponse, userId: string, role?: string) {
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...getSessionCookieOptions(0), maxAge: 0 });
  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(userId, role), getSessionCookieOptions());
  if (role) {
    response.cookies.set("renttrack_role", role, { path: "/", httpOnly: false, sameSite: "lax", maxAge: SESSION_TTL_SECONDS });
  }
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...getSessionCookieOptions(0), maxAge: 0 });
  response.cookies.set("renttrack_role", "", { path: "/", maxAge: 0 });
}
