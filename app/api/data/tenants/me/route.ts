import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase, getUnits, getProperties } from "@/lib/db";
import { requireRole, sanitizeResponse } from "@/lib/api-security";

export const dynamic = "force-dynamic";

/**
 * Returns the logged-in tenant's own rental assignment (condo unit or house property),
 * read directly from Supabase. Never fails just because move-out data is missing.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["tenant"]);
    if (auth instanceof NextResponse) return auth;

    const client = getAdminSupabase();
    const userId = auth.userId;
    const email = String((auth.user as any)?.email || "").trim().toLowerCase();

    // Collect every tenant row linked to this account (by id or email)
    const rows: any[] = [];
    const { data: byId } = await client.from("tenants").select("*").eq("id", userId);
    if (byId) rows.push(...byId);
    if (email) {
      const { data: byEmail } = await client.from("tenants").select("*").ilike("email", email);
      for (const r of byEmail || []) {
        if (!rows.some((x) => x.id === r.id)) rows.push(r);
      }
    }

    const hasTarget = (t: any) => Boolean(t?.unit_id || t?.property_name || t?.unit_number);
    const active = rows.filter((t) => t.status !== "archived" && t.status !== "inactive");
    const tenantRow =
      active.find((t) => t.assignment_status === "confirmed" && hasTarget(t)) ||
      active.find((t) => t.assignment_status === "pending" && hasTarget(t)) ||
      active.find((t) => hasTarget(t)) ||
      active[0] ||
      rows[0] ||
      null;

    const identityIds = Array.from(new Set([userId, ...rows.map((r) => r.id)]));

    // Load units & properties with the shared mappers (camelCase, amenities, images)
    const [allUnits, allProperties] = await Promise.all([
      getUnits().catch(() => [] as any[]),
      getProperties().catch(() => [] as any[]),
    ]);

    let unit: any =
      (tenantRow?.unit_id && allUnits.find((u: any) => u.id === tenantRow.unit_id)) ||
      allUnits.find((u: any) => u.tenantId && identityIds.includes(u.tenantId)) ||
      null;

    let property: any = null;
    if (unit?.propertyId) {
      property = allProperties.find((p: any) => p.id === unit.propertyId) || null;
    }
    if (!property && !unit && tenantRow?.property_name) {
      const name = String(tenantRow.property_name).trim().toLowerCase();
      property = allProperties.find((p: any) => String(p.name || "").trim().toLowerCase() === name) || null;
      if (!property) {
        // Independent condo unit assigned by name
        unit =
          allUnits.find(
            (u: any) =>
              String(u.name || "").trim().toLowerCase() === name &&
              (!tenantRow.unit_number || String(u.unitNumber || "").toLowerCase() === String(tenantRow.unit_number).toLowerCase())
          ) || null;
      }
    }

    const assignmentStatus: string =
      tenantRow?.assignment_status ||
      (unit && unit.status === "occupied" && unit.tenantId && identityIds.includes(unit.tenantId) ? "confirmed" : hasTarget(tenantRow) ? "pending" : "");

    const rentAmount = Number(tenantRow?.rent_amount || unit?.rentAmount || property?.monthlyRevenue || 0);

    return NextResponse.json(
      sanitizeResponse({
        success: true,
        assignment: tenantRow
          ? {
              tenantId: tenantRow.id,
              name: tenantRow.name || (auth.user as any)?.name || "",
              assignmentStatus,
              status: tenantRow.status || "active",
              kind: unit ? "unit" : property ? "property" : hasTarget(tenantRow) ? "property" : null,
              propertyName: tenantRow.property_name || unit?.name || property?.name || null,
              unitNumber: tenantRow.unit_number || unit?.unitNumber || null,
              unitId: unit?.id || tenantRow.unit_id || null,
              rentAmount,
              contractStart: tenantRow.contract_start || null,
              contractEnd: tenantRow.contract_end || null,
            }
          : null,
        unit,
        property,
      })
    );
  } catch (error) {
    console.error("Get my rental error:", error);
    return NextResponse.json({ success: false, error: "Could not load your rental" }, { status: 500 });
  }
}
