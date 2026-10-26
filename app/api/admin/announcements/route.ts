import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-security";
import { getAllUsers, createNotification } from "@/lib/db";
import { broadcastAnnouncementEmailToAllUsers } from "@/lib/mail";
import { withSecurityHeaders, withCorsHeaders } from "@/lib/security-headers";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin"]);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const title = String(body.title || "").trim();
    const message = String(body.message || "").trim();
    const reason = body.reason ? String(body.reason).trim() : undefined;
    const duration = body.duration ? String(body.duration).trim() : undefined;

    if (!title || !message) {
      return NextResponse.json({ success: false, error: "Title and message are required" }, { status: 400 });
    }

    const users = await getAllUsers();
    const targetUsers = (users || []).filter((u: any) => u.role !== "admin");

    // Create in-app notifications in parallel for instant execution
    await Promise.allSettled(
      targetUsers.map((user: any) =>
        createNotification({
          userId: user.id,
          title,
          message,
          type: "system",
          read: false,
        })
      )
    );

    // Broadcast emails in the background so the admin UI responds instantly without hanging
    void broadcastAnnouncementEmailToAllUsers({
      title,
      message,
      maintenanceReason: reason,
      estimatedDowntime: duration,
    }).catch((err) => {
      console.error("[Announcement Broadcast] Background delivery error:", err);
    });

    const response = NextResponse.json({
      success: true,
      count: targetUsers.length,
      message: `Announcement broadcast dispatched to ${targetUsers.length} user(s).`,
    });
    return withSecurityHeaders(withCorsHeaders(request, response));
  } catch (error) {
    console.error("Broadcast announcement error:", error);
    const response = NextResponse.json({ success: false, error: "Failed to send announcement" }, { status: 500 });
    return withSecurityHeaders(withCorsHeaders(request, response));
  }
}
