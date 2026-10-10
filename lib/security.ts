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

export function createSessionToken(userId: string) {
  const payload = {
    userId,
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token?: string | null): string | null {
  if (!token) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as { userId?: string; exp?: number };
    if (!payload.userId || !payload.exp || Date.now() > payload.exp) return null;

    return payload.userId;
  } catch {
    return null;
  }
}

export function getSessionUserId(request: NextRequest): string | null {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
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

export function setSessionCookie(response: NextResponse, userId: string) {
  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(userId), getSessionCookieOptions());
}

export function regenerateSession(response: NextResponse, userId: string) {
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...getSessionCookieOptions(0), maxAge: 0 });
  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(userId), getSessionCookieOptions());
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...getSessionCookieOptions(0), maxAge: 0 });
}
