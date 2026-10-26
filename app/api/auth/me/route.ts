import { NextRequest, NextResponse } from "next/server";
import { findUserById, updateUserPresence, initDatabase } from "@/lib/db";
import { getSessionUserId } from "@/lib/security";

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
    const response = NextResponse.json({ success: true, user: safeUser });
    if (user.role) {
      response.cookies.set("renttrack_role", user.role, { path: "/", httpOnly: false, sameSite: "lax", maxAge: 60 * 60 * 8 });
    }
    return response;
  } catch (error) {
    console.error("Session lookup error:", error);
    return NextResponse.json({ success: false, error: "Failed to load session" }, { status: 500 });
  }
}
