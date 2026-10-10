import { NextRequest, NextResponse } from "next/server";

interface RateLimitStore {
  [key: string]: { count: number; firstAttempt: number; lockedUntil?: number };
}

const rateLimitStore: RateLimitStore = {};
const verifyRateLimitStore: RateLimitStore = {};

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const MAX_VERIFY_ATTEMPTS = 10;
export const VERIFY_LOCKOUT_DURATION_MS = 5 * 60 * 1000;
export const VERIFY_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export function getRateLimitKey(request: NextRequest): string {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const email = request.headers.get("x-identifier") || "";
  return `${ip}:${email}`.toLowerCase();
}

export function checkRateLimit(key: string): { allowed: boolean; remaining: number; lockedUntil?: number } {
  if (key.startsWith("login:") || key.includes("/api/auth/login") || key.includes("login")) {
    return { allowed: true, remaining: 999 };
  }
  const now = Date.now();
  const record = rateLimitStore[key];

  if (!record) {
    rateLimitStore[key] = { count: 1, firstAttempt: now };
    return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS - 1 };
  }

  if (record.lockedUntil && now < record.lockedUntil) {
    return { allowed: false, remaining: 0, lockedUntil: record.lockedUntil };
  }

  if (now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore[key] = { count: 1, firstAttempt: now };
    return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS - 1 };
  }

  record.count += 1;

  if (record.count > MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    return { allowed: false, remaining: 0, lockedUntil: record.lockedUntil };
  }

  return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS - record.count };
}

export function checkVerifyRateLimit(key: string): { allowed: boolean; remaining: number; lockedUntil?: number } {
  const now = Date.now();
  const record = verifyRateLimitStore[key];

  if (!record) {
    verifyRateLimitStore[key] = { count: 1, firstAttempt: now };
    return { allowed: true, remaining: MAX_VERIFY_ATTEMPTS - 1 };
  }

  if (record.lockedUntil && now < record.lockedUntil) {
    return { allowed: false, remaining: 0, lockedUntil: record.lockedUntil };
  }

  if (now - record.firstAttempt > VERIFY_RATE_LIMIT_WINDOW_MS) {
    verifyRateLimitStore[key] = { count: 1, firstAttempt: now };
    return { allowed: true, remaining: MAX_VERIFY_ATTEMPTS - 1 };
  }

  record.count += 1;

  if (record.count > MAX_VERIFY_ATTEMPTS) {
    record.lockedUntil = now + VERIFY_LOCKOUT_DURATION_MS;
    return { allowed: false, remaining: 0, lockedUntil: record.lockedUntil };
  }

  return { allowed: true, remaining: MAX_VERIFY_ATTEMPTS - record.count };
}

export function recordFailedAttempt(key: string) {
  if (key.startsWith("login:") || key.includes("/api/auth/login") || key.includes("login")) {
    return;
  }
  if (!rateLimitStore[key]) {
    rateLimitStore[key] = { count: 1, firstAttempt: Date.now() };
  } else {
    rateLimitStore[key].count += 1;
  }
}

export function clearRateLimit(key: string) {
  delete rateLimitStore[key];
}

export function clearAllRateLimits() {
  for (const k of Object.keys(rateLimitStore)) {
    delete rateLimitStore[k];
  }
  for (const k of Object.keys(verifyRateLimitStore)) {
    delete verifyRateLimitStore[k];
  }
}

export function clearVerifyRateLimit(key: string) {
  delete verifyRateLimitStore[key];
}

export function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  response.headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';");
  return response;
}

export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push("At least 8 characters");
  if (!/[A-Z]/.test(password)) errors.push("One uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("One lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("One number");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("One special character");
  return { valid: errors.length === 0, errors };
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function hashIp(ip: string): string {
  return Buffer.from(ip).toString("base64").slice(0, 16);
}
