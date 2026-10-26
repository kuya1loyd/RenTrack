import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-security";
import { createNotification, getAdminSupabase, sendMessage } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["agent", "admin", "owner", "tenant"]);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { title, message, type, recipientRole } = body;

    if (!title || !message) {
      return NextResponse.json({ success: false, error: "Title and message are required" }, { status: 400 });
    }

    const recipientIds = new Set<string>();

    if (body.targetUserId) {
      recipientIds.add(body.targetUserId);
    } else {
      const targetRoles =
        recipientRole === "owner"
          ? ["owner"]
          : recipientRole === "both" || type === "payment"
          ? ["owner", "admin"]
          : ["admin"];

      const { data: users } = await getAdminSupabase()
        .schema("public")
        .from("users")
        .select("id")
        .in("role", targetRoles);

      (users || []).forEach((u: any) => recipientIds.add(u.id));
    }

    if (recipientIds.size === 0) {
      return NextResponse.json(
        { success: false, error: `No recipients found to notify` },
        { status: 404 }
      );
    }

    await Promise.all(
      Array.from(recipientIds).flatMap((userId) => [
        createNotification({
          userId,
          title,
          message,
          type: type || "system",
          read: false,
        }),
        sendMessage(auth.userId, userId, title, message),
      ])
    );

    return NextResponse.json({ success: true, notifiedCount: recipientIds.size });
  } catch (error) {
    console.error("Send to admins error:", error);
    return NextResponse.json({ success: false, error: "Failed to send notification" }, { status: 500 });
  }
}
