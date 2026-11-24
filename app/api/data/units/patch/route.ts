import { NextRequest, NextResponse } from "next/server";
import {
  requireRole, validateApiRequest, withRateLimit,
  sanitizeResponse, withSecurityHeaders, withCorsHeaders,
  sanitizeObject, getClientIp
} from "@/lib/api-security";
import { logAudit, getAdminSupabase, initDatabase } from "@/lib/db";

const ALLOWED_UNIT_FIELDS = [
  "propertyId", "unitNumber", "floor", "status", "rentAmount",
  "tenantName", "tenantId", "imageUrl", "imageUrls", "address", "type", "condition",
  "name", "city", "province", "createdBy", "agentId", "amenities", "features"
];

export async function PATCH(request: NextRequest) {
  try {
    await initDatabase();
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
      } else if (dbKey === "amenities" || dbKey === "features") {
        if (!Array.isArray(val) || val.some((item) => typeof item !== "string")) continue;
        const cleaned = Array.from(new Set(val.map((s) => s.trim()).filter(Boolean))).slice(0, 50);
        updates.amenities = cleaned;
        updates.features = cleaned;
      } else {
        updates[dbKey] = val;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
    }

    let { error } = await getAdminSupabase().from("units").update(updates).eq("id", id);
    if (error && ((error as any).code === "PGRST204" || error.message?.includes("amenities") || error.message?.includes("features") || error.message?.includes("name") || error.message?.includes("city") || error.message?.includes("province") || error.message?.includes("type") || error.message?.includes("condition"))) {
      try {
        const fixSql = `
          ALTER TABLE units ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'condo';
          ALTER TABLE units ADD COLUMN IF NOT EXISTS condition TEXT;
          ALTER TABLE units ADD COLUMN IF NOT EXISTS name TEXT;
          ALTER TABLE units ADD COLUMN IF NOT EXISTS city TEXT;
          ALTER TABLE units ADD COLUMN IF NOT EXISTS province TEXT;
          ALTER TABLE units ADD COLUMN IF NOT EXISTS created_by TEXT;
          ALTER TABLE units ADD COLUMN IF NOT EXISTS agent_id TEXT;
          ALTER TABLE units ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]'::jsonb;
          ALTER TABLE units ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;
          ALTER TABLE units ALTER COLUMN property_id DROP NOT NULL;
          NOTIFY pgrst, 'reload schema';
        `;
        await getAdminSupabase().rpc("exec_sql", { sql: fixSql });
        const retry = await getAdminSupabase().from("units").update(updates).eq("id", id);
        if (retry.error && ((retry.error as any).code === "PGRST204" || retry.error.message?.includes("amenities") || retry.error.message?.includes("features"))) {
          const fallbackUpdates = { ...updates };
          const savedAmenities = fallbackUpdates.amenities;
          delete fallbackUpdates.amenities;
          delete fallbackUpdates.features;
          if (Object.keys(fallbackUpdates).length > 0) {
            const retryBase = await getAdminSupabase().from("units").update(fallbackUpdates).eq("id", id);
            error = retryBase.error;
          } else {
            error = null;
          }
          if (!error && Array.isArray(savedAmenities)) {
            const jsonLiteral = JSON.stringify(savedAmenities).replace(/'/g, "''");
            const safeId = String(id).replace(/'/g, "''");
            await getAdminSupabase().rpc("exec_sql", {
              sql: `UPDATE units SET amenities = '${jsonLiteral}'::jsonb, features = '${jsonLiteral}'::jsonb WHERE id = '${safeId}'`,
            });
          }
        } else {
          error = retry.error;
        }
      } catch (e) {
        console.warn("Could not auto-repair units table on PATCH:", e);
      }
    }
    if (error) throw error;

    await logAudit(auth.userId, "unit_updated", { unitId: id, fields: Object.keys(updates).length }, auth.ip, auth.userAgent);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update unit error:", error);
    return NextResponse.json({ success: false, error: "Failed to update unit" }, { status: 500 });
  }
}
