import { NextRequest, NextResponse } from "next/server";
import { getUnits, createUnit, deleteUnit } from "@/lib/db";
import {
  requireAuth, requireRole, validateApiRequest, withRateLimit,
  sanitizeResponse, withSecurityHeaders, withCorsHeaders,
  sanitizeObject, getClientIp
} from "@/lib/api-security";
import { logAudit } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const units = await getUnits();
    return NextResponse.json({ success: true, units: units.map(u => sanitizeResponse(u)) });
  } catch (error) {
    console.warn("Units unavailable:", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: true, units: [], degraded: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await withRateLimit(request, `create_unit:${getClientIp(request)}`);
    if (rateLimit) return rateLimit;

    const auth = await requireRole(request, ["admin", "owner", "agent"]);
    if (auth instanceof NextResponse) return auth;

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const body = await request.json();
    const sanitized = sanitizeObject(body, [
      { key: "propertyId", type: "string", maxLength: 100 },
      { key: "unitNumber", type: "string", maxLength: 50 },
      { key: "floor", type: "number" },
      { key: "status", type: "string", maxLength: 20 },
      { key: "rentAmount", type: "number" },
      { key: "tenantName", type: "string", maxLength: 200 },
      { key: "tenantId", type: "string", maxLength: 100 },
      { key: "imageUrl", type: "string", maxLength: 5000000 },
    ]);
    if (Array.isArray(body.imageUrls)) {
      sanitized.imageUrls = Array.from(new Set(body.imageUrls.filter((url: unknown): url is string => typeof url === "string")).values()).slice(0, 20);
      sanitized.imageUrl = sanitized.imageUrls[0] || sanitized.imageUrl;
    }

    if (!sanitized.propertyId || !sanitized.unitNumber) {
      return NextResponse.json({ success: false, error: "Property ID and unit number are required" }, { status: 400 });
    }

    const unit = await createUnit(sanitized);
    console.log("Created unit:", unit);
    await logAudit(auth.userId, "unit_created", { unitId: unit.id, unitNumber: unit.unit_number }, auth.ip, auth.userAgent);
    return NextResponse.json({ success: true, unit: sanitizeResponse(unit) });
  } catch (error) {
    console.error("Create unit error:", error);
    return NextResponse.json({ success: false, error: "Failed to create unit" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "owner"]);
    if (auth instanceof NextResponse) return auth;

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: "Unit ID is required" }, { status: 400 });
    }

    await deleteUnit(id);
    await logAudit(auth.userId, "unit_deleted", { unitId: id }, auth.ip, auth.userAgent);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete unit error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete unit" }, { status: 500 });
  }
}
