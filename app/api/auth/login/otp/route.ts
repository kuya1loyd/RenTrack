import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, initDatabase, getSystemConfig } from "@/lib/db";
import { regenerateSession } from "@/lib/security";
import { withSecurityHeaders, withCorsHeaders, getClientIp } from "@/lib/security-headers";
import { logAudit } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    await initDatabase();

    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Email and password are required" }, { status: 400 });
    }

    const user = await findUserByEmail(email.toLowerCase().trim());
    if (!user) {
      return NextResponse.json({ success: false, error: "Invalid email or password" }, { status: 401 });
    }

    const pwOk = await bcrypt.compare(password, user.password);
    if (!pwOk) {
      return NextResponse.json({ success: false, error: "Invalid email or password" }, { status: 401 });
    }

    // Check maintenance mode: block all non-administrators
    const config = await getSystemConfig();
    const isMaintenance = config.maintenance_mode === "true";
    if (isMaintenance && user.role !== "admin") {
      const reason = config.maintenance_reason || "Scheduled property and unit repair maintenance";
      const rawDate = config.maintenance_started_at || config.updated_at || new Date().toISOString();
      const dateObj = new Date(rawDate);
      const formattedDate = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const formattedTime = dateObj.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const downtimeStr = config.maintenance_estimated_downtime ? ` Expected duration: ${config.maintenance_estimated_downtime}.` : "";

      const maintenanceError = `The system is currently under scheduled maintenance. Only administrators can sign in at this time. Reason: ${reason}. Maintenance began: ${formattedDate} at ${formattedTime}.${downtimeStr}`;

      return NextResponse.json({
        success: false,
        error: maintenanceError,
        maintenance: true,
        reason,
        startedAt: rawDate,
        date: formattedDate,
        time: formattedTime,
        estimatedDowntime: config.maintenance_estimated_downtime,
      }, { status: 503 });
    }

    if (!user.emailVerified) {
      return NextResponse.json({ success: false, error: "Please verify your email address before logging in.", needsVerification: true }, { status: 403 });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      address: user.address,
      createdAt: user.createdAt,
    };

    const response = NextResponse.json({ success: true, skipOtp: true, userId: user.id, user: safeUser });
    regenerateSession(response, user.id, user.role);

    try {
      await logAudit(user.id, "login_success", { email: user.email, role: user.role }, getClientIp(request), request.headers.get("user-agent") || "unknown");
    } catch {}

    return withSecurityHeaders(withCorsHeaders(request, response));
  } catch (error) {
    console.error("Send login OTP error:", error);
    return NextResponse.json({ success: false, error: "Failed to send verification code" }, { status: 500 });
  }
}
