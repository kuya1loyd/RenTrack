import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/security";
import { getCurrentUser } from "@/lib/security";
import { logAudit, updateUserPresence } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (user) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      request.headers.get("cf-connecting-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";
    await updateUserPresence(user.id, { markLogin: false });
    await logAudit(user.id, "logout", { email: user.email, name: user.name }, ip, userAgent);
  }
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response, user?.role);
  return response;
}
