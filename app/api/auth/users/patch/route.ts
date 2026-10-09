import { NextRequest, NextResponse } from "next/server";
import { ensureUserCommissionRateSchema, getAdminSupabase, initDatabase, snakeToCamel } from "@/lib/db";
import { requireRole, sanitizeResponse, validateApiRequest, withRateLimit, getClientIp } from "@/lib/api-security";
import { logAudit } from "@/lib/db";

const ALLOWED_FIELDS = ["name", "email", "phone", "address", "idVerificationStatus", "commissionRate"];

function camelToSnake(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const snake = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    out[snake] = val;
  }
  return out;
}

export async function PATCH(request: NextRequest) {
  try {
    const rateLimit = await withRateLimit(request, `update_user:${getClientIp(request)}`);
    if (rateLimit) return rateLimit;

    const auth = await requireRole(request, ["admin", "owner"]);
    if (auth instanceof NextResponse) return auth;

    await initDatabase();
    await ensureUserCommissionRateSchema();
    const validation = validateApiRequest(request);
    if (validation) return validation;

    const { userId, data } = await request.json();
    if (!userId || !data || typeof data !== "object") {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    if (Object.prototype.hasOwnProperty.call(data, "commissionRate")) {
      if (auth.user?.role !== "owner") {
        return NextResponse.json({ success: false, error: "Only the owning property owner can set an agent commission" }, { status: 403 });
      }
      if (typeof data.commissionRate !== "number" || !Number.isFinite(data.commissionRate) || data.commissionRate < 0 || data.commissionRate > 100) {
        return NextResponse.json({ success: false, error: "Commission rate must be between 0 and 100" }, { status: 400 });
      }
      const { data: targetUser, error: targetError } = await getAdminSupabase()
        .schema("public")
        .from("users")
        .select("id, role, created_by")
        .eq("id", userId)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!targetUser) return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
      if (targetUser.role !== "agent" || targetUser.created_by !== auth.userId) {
        return NextResponse.json({ success: false, error: "You can only set commission for your own agents" }, { status: 403 });
      }
    }

    const updates: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (val === undefined || val === null) continue;
      if (!ALLOWED_FIELDS.includes(key)) continue;
      updates[key] = val;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
    }

    const snakeUpdates = camelToSnake(updates);
    const { data: updatedUser, error } = await getAdminSupabase().schema("public").from("users").update(snakeUpdates).eq("id", userId).select().single();
    if (error) throw error;

    await logAudit(auth.userId, "user_updated", { targetUserId: userId, fields: Object.keys(updates) }, auth.ip, auth.userAgent);

    return NextResponse.json({ success: true, user: snakeToCamel(sanitizeResponse(updatedUser)) });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ success: false, error: "Failed to update user" }, { status: 500 });
  }
}
