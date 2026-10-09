import { NextRequest, NextResponse } from "next/server";
import {
  getProperties, createProperty, deleteProperty, findUserById
} from "@/lib/db";
import {
  requireAuth, requireRole, validateApiRequest, withRateLimit,
  sanitizeResponse, withSecurityHeaders, withCorsHeaders,
  sanitizeObject, getClientIp
} from "@/lib/api-security";
import { logAudit } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const properties = await Promise.race([
      getProperties(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Property lookup timed out")), 1500);
      }),
    ]);
    console.log("Properties GET count:", properties.length);
    return NextResponse.json({ success: true, properties: properties.map(p => sanitizeResponse(p)) });
  } catch (error) {
    console.warn("Properties unavailable:", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: true, properties: [], degraded: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await withRateLimit(request, `create_property:${getClientIp(request)}`);
    if (rateLimit) return rateLimit;

    const auth = await requireRole(request, ["admin", "owner", "agent"]);
    if (auth instanceof NextResponse) return auth;

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const body = await request.json();
    const sanitized = sanitizeObject(body, [
      { key: "name", type: "string", maxLength: 200 },
      { key: "location", type: "string", maxLength: 500 },
      { key: "type", type: "string", maxLength: 20 },
      { key: "units", type: "number" },
      { key: "latitude", type: "number" },
      { key: "longitude", type: "number" },
      { key: "monthlyRevenue", type: "number" },
      { key: "status", type: "string", maxLength: 20 },
      { key: "imageUrl", type: "string", maxLength: 5000000 },
      { key: "agentId", type: "string", maxLength: 200 },
      { key: "condition", type: "string", maxLength: 100 },
      { key: "availabilityStatus", type: "string", maxLength: 40 },
    ]);
    if (Array.isArray(body.imageUrls)) {
      sanitized.imageUrls = Array.from(new Set(body.imageUrls.filter((url: unknown): url is string => typeof url === "string"))).slice(0, 20);
      sanitized.imageUrl = sanitized.imageUrls[0] || sanitized.imageUrl;
    }
    if (Array.isArray(body.features)) {
      sanitized.features = body.features.filter((feature: unknown): feature is string => typeof feature === "string").slice(0, 30);
    }

    if (!sanitized.name || !sanitized.location) {
      return NextResponse.json({ success: false, error: "Name and location are required" }, { status: 400 });
    }
    if ((sanitized.latitude === undefined) !== (sanitized.longitude === undefined)
      || (sanitized.latitude !== undefined && (sanitized.latitude < -90 || sanitized.latitude > 90))
      || (sanitized.longitude !== undefined && (sanitized.longitude < -180 || sanitized.longitude > 180))) {
      return NextResponse.json({ success: false, error: "Provide valid latitude and longitude together" }, { status: 400 });
    }

    const property = await createProperty(sanitized, auth.userId);
    console.log("Created property:", property);
    await logAudit(auth.userId, "property_created", { propertyId: property.id, name: property.name }, auth.ip, auth.userAgent);
    return NextResponse.json({ success: true, property: sanitizeResponse(property) });
  } catch (error) {
    console.error("Create property error:", error);
    const message = (error as any)?.message || (error instanceof Error ? error.message : "Failed to create property");
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "owner"]);
    if (auth instanceof NextResponse) return auth;

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: "Property ID is required" }, { status: 400 });
    }

    await deleteProperty(id);
    await logAudit(auth.userId, "property_deleted", { propertyId: id }, auth.ip, auth.userAgent);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete property error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete property" }, { status: 500 });
  }
}
