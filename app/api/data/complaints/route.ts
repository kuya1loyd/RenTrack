import { NextRequest, NextResponse } from "next/server";
import { createComplaint, getComplaints, getComplaintById, updateComplaintStatus, createNotification, getAdminSupabase } from "@/lib/db";
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
      { key: "subject", type: "string", maxLength: 200 },
      { key: "message", type: "string", maxLength: 2000 },
      { key: "priority", type: "string", maxLength: 20 },
    ]);

    if (!sanitized.targetType || !sanitized.targetId || !sanitized.subject || !sanitized.message) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const complaint = await createComplaint({
      tenantId: auth.userId,
      targetType: sanitized.targetType as "property" | "unit" | "support",
      targetId: sanitized.targetId,
      subject: sanitized.subject,
      message: sanitized.message,
      priority: sanitized.priority,
    });

    await logAudit(auth.userId, "complaint_created", { targetType: sanitized.targetType, targetId: sanitized.targetId, subject: sanitized.subject }, auth.ip, auth.userAgent);

    try {
      const users = await (await import("@/lib/db")).getAllUsers();
      // Support requests must only go to admin, NEVER to owners
      const isSupportRequest = sanitized.targetType === "support";
      const adminRecipients = isSupportRequest
        ? users.filter((u: any) => u.role === "admin")
        : users.filter((u: any) => ["admin"].includes(u.role));
      const senderName = auth.user?.name || "A tenant";
      const notifTitle = isSupportRequest ? "New Support Request" : "New Tenant Complaint";
      for (const admin of adminRecipients) {
        await createNotification({
          userId: admin.id,
          title: notifTitle,
          message: `${senderName}: "${sanitized.subject}"`,
          type: "system",
        });
      }
      // Also record confirmation notification for the tenant
      await createNotification({
        userId: auth.userId,
        title: isSupportRequest ? "Support Request Submitted" : "Complaint Submitted",
        message: `Your request "${sanitized.subject}" has been received.`,
        type: "system",
      });
    } catch (notifErr) {
      console.error("Failed to notify admins of complaint:", notifErr);
    }

    try {
      if (isSmtpConfigured()) {
        const users = await (await import("@/lib/db")).getAllUsers();
        const isSupportRequest = sanitized.targetType === "support";
        // Support requests strictly go to admins only (never owners)
        const recipients = isSupportRequest
          ? users.filter((u: any) => u.role === "admin" && u.email)
          : users.filter((u: any) => (u.role === "admin" || u.role === "agent") && u.email);
        for (const recipient of recipients) {
          const html = createRentTrackEmailTemplate({
            title: isSupportRequest ? "New Support Request" : "New Complaint",
            body: `A new ${isSupportRequest ? "support request" : "complaint"} has been submitted.<br /><br /><strong>Subject:</strong> ${escapeHtml(sanitized.subject)}<br /><strong>Priority:</strong> ${escapeHtml(sanitized.priority || "medium")}<br /><br /><strong>Message:</strong><br />${escapeHtml(sanitized.message)}`,
            footerNote: "Please review and take action in the admin dashboard.",
          });
          await sendSystemEmail({
            to: recipient.email,
            subject: `${isSupportRequest ? "New Support Request" : "New Complaint"}: ${sanitized.subject}`,
            html,
          });
        }
      }
    } catch (err) {
      console.error("Failed to send complaint notification email:", err);
    }

    return NextResponse.json({ success: true, complaint });
  } catch (error) {
    console.error("Create complaint error:", error);
    return NextResponse.json({ success: false, error: "Failed to submit complaint" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const complaints = await getComplaints(auth.user.role === "tenant" ? auth.userId : undefined);
    return NextResponse.json({ success: true, complaints });
  } catch (error) {
    console.error("Get complaints error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch complaints" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!["admin", "owner", "agent"].includes(auth.user.role)) {
      return NextResponse.json({ success: false, error: "Not allowed to update complaints" }, { status: 403 });
    }

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const { id, status, assignedTo, responseText, responseBy } = await request.json();
    if (!id || !status) {
      return NextResponse.json({ success: false, error: "Complaint ID and status are required" }, { status: 400 });
    }

    const validStatuses = ["open", "in_progress", "resolved", "closed"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }

    const complaint = await updateComplaintStatus(id, status, assignedTo, responseText, responseBy || auth.user.name);
    if (responseText?.trim()) {
      const { data: request } = await getAdminSupabase().from("complaints").select("tenant_id, subject").eq("id", id).maybeSingle();
      if (request?.tenant_id) await createNotification({ userId: request.tenant_id, title: "Support request updated", message: `${responseBy || auth.user.name} replied to: ${request.subject}`, type: "system" });
    }
    await logAudit(auth.userId, "complaint_updated", { complaintId: id, status }, auth.ip, auth.userAgent);
    return NextResponse.json({ success: true, complaint });
  } catch (error) {
    console.error("Update complaint error:", error);
    return NextResponse.json({ success: false, error: "Failed to update complaint" }, { status: 500 });
  }
}
