import { NextRequest, NextResponse } from "next/server";
import {
  requireRole, validateApiRequest, withRateLimit,
  sanitizeResponse, withSecurityHeaders, withCorsHeaders,
  sanitizeObject, getClientIp
} from "@/lib/api-security";
import { logAudit, getAdminSupabase } from "@/lib/db";

const ALLOWED_PROPERTY_FIELDS = [
  "name", "location", "type", "units", "occupiedUnits",
  "monthlyRevenue", "status", "latitude", "longitude", "imageUrl", "imageUrls", "features", "condition", "availabilityStatus", "agentId", "agent_id"
];

export async function PATCH(request: NextRequest) {
  try {
    const rateLimit = await withRateLimit(request, `update_property:${getClientIp(request)}`);
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
      if (val === undefined) continue;
      const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      if (!ALLOWED_PROPERTY_FIELDS.map(f => f.replace(/([A-Z])/g, "_$1").toLowerCase()).includes(dbKey)) {
        await logAudit(auth.userId, "suspicious_update_attempt", { field: dbKey, propertyId: id }, auth.ip, auth.userAgent);
        continue;
      }
      if (dbKey === "agent_id") {
        updates[dbKey] = val && typeof val === "string" && val.trim() ? val.trim() : null;
      } else if (val === null) {
        continue;
      } else if (dbKey === "features") {
        if (!Array.isArray(val) || val.some((feature) => typeof feature !== "string")) continue;
        updates[dbKey] = val.slice(0, 30);
      } else if (dbKey === "latitude" || dbKey === "longitude") {
        const coordinate = Number(val);
        const min = dbKey === "latitude" ? -90 : -180;
        const max = dbKey === "latitude" ? 90 : 180;
        if (!Number.isFinite(coordinate) || coordinate < min || coordinate > max) continue;
        updates[dbKey] = coordinate;
      } else if (dbKey === "image_urls") {
        if (!Array.isArray(val) || val.some((url) => typeof url !== "string")) continue;
        updates[dbKey] = Array.from(new Set(val)).slice(0, 20);
        updates.image_url = updates.image_url || updates[dbKey][0] || null;
      } else {
        updates[dbKey] = val;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
    }

    const { error } = await getAdminSupabase().from("properties").update(updates).eq("id", id);
    if (error) throw error;

    await logAudit(auth.userId, "property_updated", { propertyId: id, fields: Object.keys(updates).length }, auth.ip, auth.userAgent);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update property error:", error);
    return NextResponse.json({ success: false, error: "Failed to update property" }, { status: 500 });
  }
}
