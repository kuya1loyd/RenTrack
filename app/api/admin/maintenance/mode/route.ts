import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-security";
import { getMaintenanceMode, setMaintenanceMode, updateSystemConfig, getSystemConfig, logAudit, getAllUsers, createNotification } from "@/lib/db";
import { withSecurityHeaders, withCorsHeaders, getClientIp } from "@/lib/security-headers";
import { broadcastMaintenanceEmailToAllUsers } from "@/lib/mail";

export async function GET(request: NextRequest) {
  try {
    const config = await getSystemConfig();
    const enabled = config.maintenance_mode === "true";
    const reason = config.maintenance_reason || "Property & Units Repair (Scheduled repair & maintenance across properties and units)";
    const startedAt = config.maintenance_started_at || null;
    const estimatedDowntime = config.maintenance_estimated_downtime || "30 to 60 minutes";

    const response = NextResponse.json({
      success: true,
      enabled,
      reason,
      startedAt,
      estimatedDowntime,
    });
    // Remove the legacy local cookie that previously locked out admins
    response.cookies.set("maintenance_mode", "", {
      path: "/",
      maxAge: 0,
    });
    return withSecurityHeaders(withCorsHeaders(request, response));
  } catch (error) {
    console.error("Get maintenance mode error:", error);
    const response = NextResponse.json({ success: false, error: "Failed to fetch maintenance mode" }, { status: 500 });
    return withSecurityHeaders(withCorsHeaders(request, response));
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "owner"]);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const enabled = Boolean(body.enabled);
    const reason = (body.reason || body.maintenanceReason)
      ? String(body.reason || body.maintenanceReason).trim()
      : "Property & Units Repair (Scheduled repair & maintenance across properties and units)";
    const customMessage = body.customMessage
      ? String(body.customMessage).trim()
      : (body.message ? String(body.message).trim() : undefined);
    const estimatedDowntime = body.estimatedDowntime ? String(body.estimatedDowntime).trim() : "30 to 60 minutes";
    const title = body.title ? String(body.title).trim() : undefined;

    await setMaintenanceMode(enabled);
    if (enabled) {
      await updateSystemConfig("maintenance_reason", reason);
      await updateSystemConfig("maintenance_started_at", new Date().toISOString());
      if (estimatedDowntime) {
        await updateSystemConfig("maintenance_estimated_downtime", estimatedDowntime);
      }
    }

    let emailBroadcastResult = { totalAccounts: 0, sentCount: 0, failedCount: 0 };

    if (enabled) {
      try {
        await logAudit(
          auth.userId,
          "maintenance_mode_enabled",
          { reason, customMessage, estimatedDowntime },
          getClientIp(request),
          request.headers.get("user-agent") || "unknown"
        );
      } catch {}

      // Broadcast maintenance email notification to all accounts in the system (in background)
      void broadcastMaintenanceEmailToAllUsers({
        customMessage,
        estimatedDowntime,
        maintenanceReason: reason,
      }).catch((broadcastErr) => {
        console.error("Maintenance broadcast error:", broadcastErr);
      });

      // Also create in-app notifications for non-admin users (admin is managing the system)
      try {
        const users = await getAllUsers();
        await Promise.allSettled(
          (users || [])
            .filter((u: any) => u.role !== "admin")
            .map((u: any) =>
              createNotification({
                userId: u.id,
                title: title || `System Maintenance: ${reason}`,
                message: customMessage || `RentTrack is currently under scheduled maintenance (${estimatedDowntime}). Services will resume shortly.`,
                type: "system",
                read: false,
              })
            )
        );
      } catch (notifErr) {
        console.error("Maintenance in-app notification error:", notifErr);
      }
    } else {
      try {
        await logAudit(
          auth.userId,
          "maintenance_mode_disabled",
          {},
          getClientIp(request),
          request.headers.get("user-agent") || "unknown"
        );
      } catch {}
    }

    const response = NextResponse.json({
      success: true,
      enabled,
      message: enabled
        ? `Maintenance mode enabled. Email notices and notifications dispatched.`
        : "Maintenance mode disabled. System is now operational.",
    });

    // Remove legacy cookie on admin browser so admin is never restricted
    response.cookies.set("maintenance_mode", "", {
      path: "/",
      maxAge: 0,
    });

    return withSecurityHeaders(withCorsHeaders(request, response));
  } catch (error) {
    console.error("Update maintenance mode error:", error);
    const response = NextResponse.json({ success: false, error: "Failed to update maintenance mode" }, { status: 500 });
    return withSecurityHeaders(withCorsHeaders(request, response));
  }
}
