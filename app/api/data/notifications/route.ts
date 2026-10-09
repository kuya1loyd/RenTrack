import { NextRequest, NextResponse } from "next/server";
import {
  getNotifications, createNotification, markNotificationRead,
  markAllNotificationsRead, getUnreadCount
} from "@/lib/db";
import {
  requireAuth, validateApiRequest, withSecurityHeaders, withCorsHeaders,
  sanitizeObject, sanitizeResponse, getClientIp
} from "@/lib/api-security";
import { logAudit } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const countOnly = searchParams.get("count") === "true";

    const isOwner = auth.user?.role === "owner";
    const filterForRole = (list: any[]) => {
      if (!isOwner) return list;
      return list.filter((n: any) => {
        const text = `${n.title || ""} ${n.message || ""}`.toLowerCase();
        return !text.includes("support request") && !text.includes("to support") && !text.includes("new support");
      });
    };

    if (countOnly && userId) {
      if (isOwner) {
        const all = await getNotifications(userId);
        const filtered = filterForRole(all);
        const count = filtered.filter((n: any) => !n.read).length;
        return NextResponse.json({ success: true, count });
      }
      const count = await getUnreadCount(userId);
      return NextResponse.json({ success: true, count });
    }

    const notifications = userId
      ? await getNotifications(userId)
      : await getNotifications(auth.userId);

    const filtered = filterForRole(notifications);
    return NextResponse.json({ success: true, notifications: filtered.map((n: any) => sanitizeResponse(n)) });
  } catch (error) {
    console.error("Get notifications error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const data = await request.json();
    const sanitized = sanitizeObject(data, [
      { key: "userId", type: "string", maxLength: 100 },
      { key: "title", type: "string", maxLength: 200 },
      { key: "message", type: "string", maxLength: 1000 },
      { key: "type", type: "string", maxLength: 50 },
      { key: "read", type: "boolean" },
    ]);

    if (!sanitized.userId || !sanitized.title) {
      return NextResponse.json({ success: false, error: "User ID and title are required" }, { status: 400 });
    }

    const notification = await createNotification(sanitized);
    return NextResponse.json({ success: true, notification: sanitizeResponse(notification) });
  } catch (error) {
    console.error("Create notification error:", error);
    return NextResponse.json({ success: false, error: "Failed to create notification" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id, userId, action } = await request.json();

    if (action === "markAllRead" && userId) {
      await markAllNotificationsRead(userId);
    } else if (id) {
      await markNotificationRead(id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update notification error:", error);
    return NextResponse.json({ success: false, error: "Failed to update notification" }, { status: 500 });
  }
}
