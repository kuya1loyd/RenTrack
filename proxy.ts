import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withSecurityHeaders } from "@/lib/security-headers";

function getSessionRole(request: NextRequest): string | null {
  // 1. Direct role cookie
  const roleCookie = request.cookies.get("renttrack_role")?.value;
  if (roleCookie) return roleCookie;

  // 2. Decode session token payload without Node.js crypto
  const token = request.cookies.get("renttrack_session")?.value;
  if (!token) return null;

  try {
    const [encoded] = token.split(".");
    if (!encoded) return null;
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const decoded = typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("utf-8");
    const payload = JSON.parse(decoded);
    if (payload?.exp && Date.now() > payload.exp) return null;
    return payload?.role || null;
  } catch {
    return null;
  }
}

let cachedMaintenance: { value: boolean; expires: number } | null = null;

async function checkMaintenanceMode(): Promise<boolean> {
  const now = Date.now();
  if (cachedMaintenance && cachedMaintenance.expires > now) {
    return cachedMaintenance.value;
  }
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return false;

    const res = await fetch(`${supabaseUrl}/rest/v1/system_config?key=eq.maintenance_mode&select=value`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = await res.json();
    const isMaint = Array.isArray(data) && data.length > 0 && data[0].value === "true";
    cachedMaintenance = { value: isMaint, expires: now + 5000 };
    return isMaint;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/dashboard/tret") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/tenant";
    const response = NextResponse.redirect(url, 302);
    return withSecurityHeaders(response);
  }

  // Determine user role from session token or role cookie
  const role = getSessionRole(request);
  const isAdmin = role === "admin";
  const isAdminPath = pathname.startsWith("/dashboard/admin");

  const isMaintenance = await checkMaintenanceMode();

  // If maintenance mode is active
  if (isMaintenance) {
    // 1. Administrators are NEVER locked out of any dashboard or page
    if (isAdmin || isAdminPath) {
      const response = NextResponse.next();
      // Clear legacy lockout cookie if present
      if (request.cookies.has("maintenance_mode")) {
        response.cookies.set("maintenance_mode", "", { path: "/", maxAge: 0 });
      }
      return withSecurityHeaders(response);
    }

    // 2. Allow auth routes so administrators can log in
    const isAuthRoute =
      pathname === "/login" ||
      pathname.startsWith("/verify-otp") ||
      pathname.startsWith("/forgot-password") ||
      pathname.startsWith("/reset-password");

    if (isAuthRoute) {
      const response = NextResponse.next();
      return withSecurityHeaders(response);
    }

    // 3. Maintenance page itself
    if (pathname === "/maintenance") {
      const response = NextResponse.next();
      return withSecurityHeaders(response);
    }

    // 4. Redirect all non-admin users and public visitors to /maintenance
    const url = request.nextUrl.clone();
    url.pathname = "/maintenance";
    const response = NextResponse.redirect(url, 302);
    return withSecurityHeaders(response);
  }

  // If maintenance mode is NOT active, redirect users away from /maintenance to home
  if (!isMaintenance && pathname === "/maintenance") {
    const url = request.nextUrl.clone();
    url.pathname = isAdmin ? "/dashboard/admin" : "/";
    const response = NextResponse.redirect(url, 302);
    return withSecurityHeaders(response);
  }

  const response = NextResponse.next();
  // Clean up legacy cookie if it was set
  if (request.cookies.has("maintenance_mode")) {
    response.cookies.set("maintenance_mode", "", { path: "/", maxAge: 0 });
  }
  return withSecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|public/|api/).*)",
  ],
};
