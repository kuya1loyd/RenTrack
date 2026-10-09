import { NextRequest, NextResponse } from "next/server";
import { getComplaintById, updateComplaintTenantReply, createNotification, getAdminSupabase } from "@/lib/db";
import { requireAuth, validateApiRequest, withSecurityHeaders, withCorsHeaders, sanitizeObject } from "@/lib/api-security";
import { logAudit } from "@/lib/db";

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const { id, replyText } = await request.json();
    if (!id || !replyText?.trim()) {
      return NextResponse.json({ success: false, error: "Complaint ID and reply are required" }, { status: 400 });
    }

    const complaint = await getComplaintById(id);
    if (!complaint) {
      return NextResponse.json({ success: false, error: "Complaint not found" }, { status: 404 });
    }

    if (complaint.tenantId !== auth.userId) {
      return NextResponse.json({ success: false, error: "Not allowed to reply to this complaint" }, { status: 403 });
    }

    const updated = await updateComplaintTenantReply(id, replyText, auth.user.name);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Failed to save reply" }, { status: 500 });
    }

    const isSupport = complaint.target_type === "support" || complaint.targetType === "support";
    const titleText = isSupport ? "Tenant replied to support request" : "Tenant replied to complaint";

    if (complaint.assigned_to) {
      await createNotification({
        userId: complaint.assigned_to,
        title: titleText,
        message: `${auth.user.name} replied to: ${complaint.subject}`,
        type: "system",
      });
    } else {
      // Support replies strictly go to admin only (never owner)
      const rolesToNotify = isSupport ? ["admin"] : ["admin", "agent"];
      const { data: staff } = await getAdminSupabase().schema("public").from("users").select("id").in("role", rolesToNotify);
      for (const member of staff || []) {
        await createNotification({
          userId: member.id,
          title: titleText,
          message: `${auth.user.name} replied to: ${complaint.subject}`,
          type: "system",
        });
      }
    }

    await logAudit(auth.userId, "complaint_tenant_reply", { complaintId: id }, (request as any).ip, (request as any).headers.get("user-agent"));
    return NextResponse.json({ success: true, complaint: updated });
  } catch (error) {
    console.error("Tenant reply error:", error);
    return NextResponse.json({ success: false, error: "Failed to save reply" }, { status: 500 });
  }
}
