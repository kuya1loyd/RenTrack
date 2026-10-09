import { NextRequest, NextResponse } from "next/server";
import { createRating, getRatings, getAverageRating, getRatingsByUser } from "@/lib/db";
import { requireAuth, validateApiRequest, withSecurityHeaders, withCorsHeaders, sanitizeObject, getClientIp } from "@/lib/api-security";
import { logAudit } from "@/lib/db";
import { sendSystemEmail, isSmtpConfigured, createRentTrackEmailTemplate, escapeHtml } from "@/lib/mail";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const body = await request.json();
    const sanitized = sanitizeObject(body, [
      { key: "targetType", type: "string", maxLength: 20 },
      { key: "targetId", type: "string", maxLength: 100 },
      { key: "rating", type: "number" },
      { key: "comment", type: "string", maxLength: 1000 },
    ]);

    if (!sanitized.targetType || !sanitized.targetId || !sanitized.rating) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    if (sanitized.rating < 1 || sanitized.rating > 5) {
      return NextResponse.json({ success: false, error: "Rating must be between 1 and 5" }, { status: 400 });
    }

    const rating = await createRating({
      userId: auth.userId,
      targetType: sanitized.targetType as "property" | "unit",
      targetId: sanitized.targetId,
      rating: sanitized.rating,
      comment: sanitized.comment,
    });

    await logAudit(auth.userId, "rating_created", { targetType: sanitized.targetType, targetId: sanitized.targetId, rating: sanitized.rating }, auth.ip, auth.userAgent);

    try {
      const users = await (await import("@/lib/db")).getAllUsers();
      const adminRecipients = users.filter((u: any) => ["admin", "owner"].includes(u.role));
      const { createNotification } = await import("@/lib/db");
      const senderName = auth.user?.name || "A tenant";
      for (const admin of adminRecipients) {
        await createNotification({
          userId: admin.id,
          title: `New ${sanitized.rating}★ Rating`,
          message: `${senderName} submitted a ${sanitized.rating}-star rating for ${sanitized.targetType}.`,
          type: "system",
        });
      }
    } catch (notifErr) {
      console.error("Failed to notify admins of rating:", notifErr);
    }

    try {
      if (isSmtpConfigured()) {
        const users = await (await import("@/lib/db")).getAllUsers();
        const recipients = users.filter((u: any) => (u.role === "owner" || u.role === "admin" || u.role === "agent") && u.email);
        for (const recipient of recipients) {
          const html = createRentTrackEmailTemplate({
            title: "New Rating Received",
            body: `A new <strong>${escapeHtml(String(sanitized.rating))}/5</strong> rating was submitted for <strong>${escapeHtml(sanitized.targetType)}</strong> ID: ${escapeHtml(String(sanitized.targetId))}.`,
            footerNote: "Log in to the dashboard to view the full rating and comment.",
          });
          await sendSystemEmail({
            to: recipient.email,
            subject: `New ${sanitized.targetType} rating received`,
            html,
          });
        }
      }
    } catch (err) {
      console.error("Failed to send rating notification email:", err);
    }

    return NextResponse.json({ success: true, rating });
  } catch (error) {
    console.error("Create rating error:", error);
    return NextResponse.json({ success: false, error: "Failed to submit rating" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get("targetType");
    const targetId = searchParams.get("targetId");
    const userId = searchParams.get("userId");

    if (userId) {
      const ratings = await getRatingsByUser(userId);
      return NextResponse.json({ success: true, ratings });
    }

    if (!targetType || !targetId) {
      return NextResponse.json({ success: false, error: "Missing targetType or targetId" }, { status: 400 });
    }

    const [ratings, average] = await Promise.all([
      getRatings(targetType, targetId),
      getAverageRating(targetType, targetId),
    ]);

    return NextResponse.json({ success: true, ratings, average });
  } catch (error) {
    console.error("Get ratings error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch ratings" }, { status: 500 });
  }
}
