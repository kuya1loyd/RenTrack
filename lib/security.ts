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

const ROLE_SESSION_COOKIES: Record<string, string> = {
  admin: "renttrack_session_admin",
  owner: "renttrack_session_owner",
  agent: "renttrack_session_agent",
  tenant: "renttrack_session_tenant",
};

function inferPortalRoleFromReferer(request: NextRequest): string | null {
  const referer = request.headers.get("referer") || "";
  if (referer.includes("/dashboard/owner")) return "owner";
  if (referer.includes("/dashboard/agent")) return "agent";
  if (referer.includes("/dashboard/tenant")) return "tenant";
  if (referer.includes("/dashboard/admin")) return "admin";
  return null;
}

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim() || null;
  }
  return null;
}

export function getSessionUserIdCandidates(request: NextRequest, preferredRoles?: string[]): string[] {
  const ids: string[] = [];
  const pushUnique = (id: string | null) => {
    if (id && !ids.includes(id)) ids.push(id);
  };

  const bearer = extractBearerToken(request);
  if (bearer) {
    pushUnique(verifySessionToken(bearer));
  }

  const refererRole = inferPortalRoleFromReferer(request);
  if (refererRole && ROLE_SESSION_COOKIES[refererRole]) {
    pushUnique(verifySessionToken(request.cookies.get(ROLE_SESSION_COOKIES[refererRole])?.value));
  }

  if (preferredRoles && preferredRoles.length > 0) {
    for (const role of preferredRoles.map((r) => r.toLowerCase())) {
      const cookieName = ROLE_SESSION_COOKIES[role];
      if (cookieName) {
        pushUnique(verifySessionToken(request.cookies.get(cookieName)?.value));
      }
    }
  }

  pushUnique(verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value));

  for (const cookieName of Object.values(ROLE_SESSION_COOKIES)) {
    pushUnique(verifySessionToken(request.cookies.get(cookieName)?.value));
  }

  return ids;
}

export function getSessionUserId(request: NextRequest, preferredRoles?: string[]): string | null {
  const candidates = getSessionUserIdCandidates(request, preferredRoles);
  return candidates[0] || null;
}

export function getSessionRole(request: NextRequest): string | null {
  const refererRole = inferPortalRoleFromReferer(request);
  if (refererRole) {
    const roleCookieName = ROLE_SESSION_COOKIES[refererRole];
    const rolePayload = roleCookieName ? getSessionPayload(request.cookies.get(roleCookieName)?.value) : null;
    if (rolePayload?.role) return rolePayload.role;
  }
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

export function setSessionCookie(response: NextResponse, userId: string, role?: string): string {
  const token = createSessionToken(userId, role);
  const options = getSessionCookieOptions();
  response.cookies.set(SESSION_COOKIE_NAME, token, options);
  if (role) {
    const normalizedRole = role.toLowerCase();
    const roleCookieName = ROLE_SESSION_COOKIES[normalizedRole];
    if (roleCookieName) {
      response.cookies.set(roleCookieName, token, options);
    }
    response.cookies.set("renttrack_role", normalizedRole, { path: "/", httpOnly: false, sameSite: "lax", maxAge: SESSION_TTL_SECONDS });
  }
  return token;
}

export function regenerateSession(response: NextResponse, userId: string, role?: string): string {
  const token = createSessionToken(userId, role);
  const options = getSessionCookieOptions();
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...getSessionCookieOptions(0), maxAge: 0 });
  response.cookies.set(SESSION_COOKIE_NAME, token, options);
  if (role) {
    const normalizedRole = role.toLowerCase();
    const roleCookieName = ROLE_SESSION_COOKIES[normalizedRole];
    if (roleCookieName) {
      response.cookies.set(roleCookieName, token, options);
    }
    response.cookies.set("renttrack_role", normalizedRole, { path: "/", httpOnly: false, sameSite: "lax", maxAge: SESSION_TTL_SECONDS });
  }
  return token;
}

export function clearSessionCookie(response: NextResponse, role?: string) {
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...getSessionCookieOptions(0), maxAge: 0 });
  response.cookies.set("renttrack_role", "", { path: "/", maxAge: 0 });
  if (role) {
    const roleCookieName = ROLE_SESSION_COOKIES[role.toLowerCase()];
    if (roleCookieName) {
      response.cookies.set(roleCookieName, "", { ...getSessionCookieOptions(0), maxAge: 0 });
    }
  } else {
    for (const cookieName of Object.values(ROLE_SESSION_COOKIES)) {
      response.cookies.set(cookieName, "", { ...getSessionCookieOptions(0), maxAge: 0 });
    }
  }
}
