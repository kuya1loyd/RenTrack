import { NextRequest, NextResponse } from "next/server";
import { findUserById, updateUserPresence, initDatabase } from "@/lib/db";
import { createSessionToken, getSessionUserId } from "@/lib/security";

export async function GET(request: NextRequest) {
  try {
    await initDatabase();

    const userId = getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const user = await findUserById(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    await updateUserPresence(userId);

    const safeUser = { ...user };
    delete safeUser.password;
    const sessionToken = createSessionToken(userId, user.role);
    const response = NextResponse.json({ success: true, user: safeUser, sessionToken });
    if (user.role) {
      const normalizedRole = String(user.role).toLowerCase();
      response.cookies.set(`renttrack_session_${normalizedRole}`, sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 8,
      });
    }
    return response;
  } catch (error) {
    console.error("Session lookup error:", error);
    return NextResponse.json({ success: false, error: "Failed to load session" }, { status: 500 });
  }
}
