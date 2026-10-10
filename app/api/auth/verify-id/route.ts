import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId, getCurrentUser } from "@/lib/security";
import { findUserById, updateUserIdVerification, initDatabase } from "@/lib/db";
import { logAudit } from "@/lib/db";
import { withSecurityHeaders, withCorsHeaders, getClientIp } from "@/lib/security-headers";

export async function PATCH(request: NextRequest) {
  try {
    await initDatabase();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    if (!["admin", "owner", "agent"].includes(currentUser.role)) {
      return NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 });
    }

    const { userId, status, reason } = await request.json();
    if (!userId || !["approved", "rejected"].includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
    }

    const targetUser = await findUserById(userId);
    if (!targetUser || !["tenant", "agent"].includes(targetUser.role)) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Property owners and administrators can verify and accept agent identification documents
    if (targetUser.role === "agent" && !["owner", "admin"].includes(currentUser.role)) {
      return NextResponse.json(
        { success: false, error: "Only property owners and administrators can verify and accept agent ID applications." },
        { status: 403 }
      );
    }

    await updateUserIdVerification(userId, targetUser.idVerificationUrl || "", status);

    try {
      const { createNotification } = await import("@/lib/db");
      const rejectionNote = reason?.trim() ? ` Reason: ${reason.trim()}` : "";
      await createNotification({
        userId,
        title: status === "approved" ? "ID Verification Approved" : "ID Verification Rejected",
        message: status === "approved"
          ? "Your government ID has been reviewed and approved."
          : `Your government ID was rejected.${rejectionNote} Please upload a clear valid government ID.`,
        type: "id_verification",
      });
    } catch (notifErr) {
      console.warn("Could not dispatch ID verification notification:", notifErr);
    }

    const actorId = getSessionUserId(request);
    if (actorId) {
      await logAudit(actorId, "id_verification_updated", { targetUserId: userId, status, reason: reason?.trim() || undefined }, getClientIp(request), request.headers.get("user-agent") || "unknown");
    }

    return NextResponse.json({ success: true, message: `ID verification ${status}` });
  } catch (error) {
    console.error("ID verification update error:", error);
    return NextResponse.json({ success: false, error: "Failed to update verification" }, { status: 500 });
  }
}
