import { NextRequest, NextResponse } from "next/server";
import {
  requireRole, validateApiRequest, withRateLimit,
  sanitizeResponse, withSecurityHeaders, withCorsHeaders,
  sanitizeObject, getClientIp
} from "@/lib/api-security";
import { logAudit, getAdminSupabase } from "@/lib/db";

const ALLOWED_UNIT_FIELDS = [
  "propertyId", "unitNumber", "floor", "status", "rentAmount",
  "tenantName", "tenantId", "imageUrl", "imageUrls", "address", "type", "condition"
];

export async function PATCH(request: NextRequest) {
  try {
    const rateLimit = await withRateLimit(request, `update_unit:${getClientIp(request)}`);
    if (rateLimit) return rateLimit;

    const auth = await requireRole(request, ["admin", "owner", "agent"]);
    if (auth instanceof NextResponse) return auth;

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const { id, data } = await request.json();
    if (!id || !data || typeof data !== "object") {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (val === undefined || val === null) continue;
      const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      if (!ALLOWED_UNIT_FIELDS.map(f => f.replace(/([A-Z])/g, "_$1").toLowerCase()).includes(dbKey)) {
        await logAudit(auth.userId, "suspicious_update_attempt", { field: dbKey, unitId: id }, auth.ip, auth.userAgent);
        continue;
      }
      if (dbKey === "image_urls") {
        if (!Array.isArray(val) || val.some((url) => typeof url !== "string")) continue;
        updates[dbKey] = Array.from(new Set(val)).slice(0, 20);
        updates.image_url = updates[dbKey][0] || null;
      } else {
        updates[dbKey] = val;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
    }

    const { error } = await getAdminSupabase().from("units").update(updates).eq("id", id);
    if (error) throw error;

    await logAudit(auth.userId, "unit_updated", { unitId: id, fields: Object.keys(updates).length }, auth.ip, auth.userAgent);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update unit error:", error);
    return NextResponse.json({ success: false, error: "Failed to update unit" }, { status: 500 });
  }
}
