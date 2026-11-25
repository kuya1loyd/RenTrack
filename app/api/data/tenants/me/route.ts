import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase, getUnits, getProperties, findUserById } from "@/lib/db";
import { sanitizeResponse } from "@/lib/api-security";
import { getSessionUserId } from "@/lib/security";

export const dynamic = "force-dynamic";

function normalizeUnitNum(val: unknown): string {
  return String(val || "")
    .replace(/^unit\s*#?\s*/i, "")
    .trim()
    .toLowerCase();
}

/**
 * Returns the logged-in tenant's own rental assignment (condo unit or house property)
 * AND any property/unit inquiries submitted by this tenant, read directly from Supabase.
 */
export async function GET(request: NextRequest) {
  try {
    const client = getAdminSupabase();
    const { searchParams } = new URL(request.url);

    let userId = getSessionUserId(request);
    let userRecord: any = userId ? await findUserById(userId) : null;

    // Safe fallback if browser session cookie was not attached on edge redirect
    if (!userRecord) {
      const paramUserId = (searchParams.get("userId") || "").trim();
      const paramEmail = (searchParams.get("email") || "").trim().toLowerCase();
      if (paramUserId && paramEmail) {
        const candidate = await findUserById(paramUserId);
        if (candidate && String(candidate.email || "").trim().toLowerCase() === paramEmail) {
          userRecord = candidate;
          userId = candidate.id;
        }
      }
    }

    if (!userId || !userRecord) {
      return NextResponse.json({
        success: true,
        assignment: null,
        unit: null,
        property: null,
        inquiries: [],
      });
    }

    const email = String(userRecord.email || "").trim().toLowerCase();
    const userName = String(userRecord.name || "").trim().toLowerCase();

    // 1. Collect every tenant row linked to this account (by id or email)
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

    // 2. Load units & properties with the shared mappers (camelCase, amenities, images)
    const [allUnits, allProperties] = await Promise.all([
      getUnits().catch(() => [] as any[]),
      getProperties().catch(() => [] as any[]),
    ]);

    let unit: any =
      (tenantRow?.unit_id && allUnits.find((u: any) => u.id === tenantRow.unit_id)) ||
      allUnits.find((u: any) => u.tenantId && identityIds.includes(u.tenantId)) ||
      (userName
        ? allUnits.find(
            (u: any) =>
              u.status === "occupied" &&
              u.tenantName &&
              String(u.tenantName).trim().toLowerCase() === userName
          )
        : null) ||
      null;

    let property: any = null;
    if (unit?.propertyId) {
      property = allProperties.find((p: any) => p.id === unit.propertyId) || null;
    }

    if (!property && !unit && (tenantRow?.property_name || tenantRow?.unit_number)) {
      const rawName = String(tenantRow.property_name || "").trim().toLowerCase();
      const targetUnitNum = normalizeUnitNum(tenantRow.unit_number);

      if (rawName) {
        property =
          allProperties.find((p: any) => String(p.name || "").trim().toLowerCase() === rawName) ||
          allProperties.find(
            (p: any) =>
              p.name &&
              (rawName.includes(String(p.name).trim().toLowerCase()) ||
                String(p.name).trim().toLowerCase().includes(rawName))
          ) ||
          null;
      }

      if (!property || targetUnitNum) {
        const matchedUnit =
          allUnits.find((u: any) => {
            const uName = String(u.name || "").trim().toLowerCase();
            const uNum = normalizeUnitNum(u.unitNumber);
            if (rawName && targetUnitNum) {
              return (uName === rawName || rawName.includes(uName) || uName.includes(rawName)) && uNum === targetUnitNum;
            }
            if (rawName && !targetUnitNum) {
              return uName === rawName || rawName.includes(uName);
            }
            if (targetUnitNum) {
              return uNum === targetUnitNum;
            }
            return false;
          }) || null;

        if (matchedUnit) {
          unit = matchedUnit;
          if (unit.propertyId && !property) {
            property = allProperties.find((p: any) => p.id === unit.propertyId) || null;
          }
        }
      }
    }

    const assignmentStatus: string =
      tenantRow?.assignment_status ||
      (unit && unit.status === "occupied" ? "confirmed" : hasTarget(tenantRow) ? "pending" : "");

    const rentAmount = Number(
      tenantRow?.rent_amount ||
        unit?.rentAmount ||
        property?.monthlyRevenue ||
        (property as any)?.rentAmount ||
        0
    );

    const assignment =
      tenantRow && (hasTarget(tenantRow) || unit || property)
        ? {
            tenantId: tenantRow.id,
            name: tenantRow.name || userRecord.name || "",
            assignmentStatus: assignmentStatus || (unit || property ? "confirmed" : ""),
            status: tenantRow.status || "active",
            kind: (unit ? "unit" : property ? "property" : tenantRow.unit_number ? "unit" : "property") as
              | "unit"
              | "property"
              | null,
            propertyName: tenantRow.property_name || unit?.name || property?.name || null,
            unitNumber: tenantRow.unit_number || unit?.unitNumber || null,
            unitId: unit?.id || tenantRow.unit_id || null,
            rentAmount,
            contractStart: tenantRow.contract_start || null,
            contractEnd: tenantRow.contract_end || null,
          }
        : unit
          ? {
              tenantId: userId,
              name: userRecord.name || "",
              assignmentStatus: "confirmed",
              status: "active",
              kind: "unit" as const,
              propertyName: unit.name || property?.name || null,
              unitNumber: unit.unitNumber || null,
              unitId: unit.id,
              rentAmount,
              contractStart: null,
              contractEnd: null,
            }
          : null;

    // 3. Load this tenant's property/unit inquiries from chat_messages
    let inquiries: any[] = [];
    if (email) {
      try {
        const { data: chatRows } = await client
          .from("chat_messages")
          .select("*")
          .ilike("sender_email", email)
          .order("created_at", { ascending: false });

        inquiries = (chatRows || []).map((row: any) => {
          const text = String(row.text || "");
          const unitMatch = text.match(/\[Unit\s+([^\]]+)\]/i);
          const parsedUnitNum = unitMatch ? unitMatch[1].trim() : null;
          const propTagMatch = text.match(/\[Property:\s*([^\]]+)\]/i);
          const parsedPropName = propTagMatch ? propTagMatch[1].trim() : null;

          let matchedProp = row.property_id
            ? allProperties.find((p: any) => p.id === row.property_id) || null
            : null;

          if (!matchedProp && (parsedPropName || text)) {
            const lowerText = text.toLowerCase();
            matchedProp =
              allProperties.find(
                (p: any) =>
                  p.name &&
                  ((parsedPropName && String(p.name).toLowerCase() === parsedPropName.toLowerCase()) ||
                    lowerText.includes(String(p.name).toLowerCase()))
              ) || null;
          }

          let matchedUnit: any = null;
          if (row.property_id && !matchedProp) {
            // Sometimes property_id in chat_messages holds an independent unit ID
            matchedUnit = allUnits.find((u: any) => u.id === row.property_id) || null;
          }
          if (!matchedUnit && parsedUnitNum) {
            const normNum = normalizeUnitNum(parsedUnitNum);
            matchedUnit =
              allUnits.find(
                (u: any) =>
                  normalizeUnitNum(u.unitNumber) === normNum &&
                  (!matchedProp || u.propertyId === matchedProp.id)
              ) || null;
          }
          if (!matchedUnit && !matchedProp && text) {
            const lowerText = text.toLowerCase();
            matchedUnit =
              allUnits.find((u: any) => u.name && lowerText.includes(String(u.name).toLowerCase())) || null;
          }

          const cleanMessage = text
            .replace(/\[Property:[^\]]*\]\s*/gi, "")
            .replace(/\[Unit[^\]]*\]\s*/gi, "")
            .trim();

          const isApprovedForTenant = Boolean(
            assignment?.assignmentStatus === "confirmed" &&
              ((matchedUnit && assignment.unitId === matchedUnit.id) ||
                (matchedProp &&
                  assignment.propertyName &&
                  String(matchedProp.name).toLowerCase() === String(assignment.propertyName).toLowerCase()))
          );

          const inqRent = Number(
            (isApprovedForTenant ? assignment?.rentAmount : 0) ||
              matchedUnit?.rentAmount ||
              matchedProp?.monthlyRevenue ||
              0
          );

          const coverUrl =
            matchedUnit?.imageUrl ||
            matchedUnit?.imageUrls?.[0] ||
            matchedProp?.imageUrl ||
            matchedProp?.imageUrls?.[0] ||
            null;

          return {
            id: row.id,
            kind: matchedUnit || parsedUnitNum ? "unit" : "property",
            propertyId: matchedProp?.id || null,
            unitId: matchedUnit?.id || null,
            title: matchedUnit
              ? `Unit ${normalizeUnitNum(matchedUnit.unitNumber).toUpperCase() || matchedUnit.unitNumber} – ${
                  matchedUnit.name || matchedProp?.name || "Condominium Unit"
                }`
              : parsedUnitNum
                ? `Unit ${parsedUnitNum}${
                    matchedProp?.name || parsedPropName ? ` – ${matchedProp?.name || parsedPropName}` : ""
                  }`
                : matchedProp?.name || parsedPropName || "Property Inquiry",
            address: matchedUnit
              ? [matchedUnit.address || matchedProp?.location, matchedUnit.city, matchedUnit.province]
                  .filter(Boolean)
                  .join(", ")
              : matchedProp?.location || "",
            rentAmount: inqRent,
            imageUrl: coverUrl,
            message: cleanMessage || text,
            status: isApprovedForTenant ? "approved" : row.status || "new",
            replyText: row.reply_text || null,
            repliedAt: row.replied_at || null,
            agentName: row.agent_name || null,
            createdAt: row.created_at,
          };
        });
      } catch (inqErr) {
        console.warn("Could not load tenant inquiries:", inqErr);
      }
    }

    return NextResponse.json(
      sanitizeResponse({
        success: true,
        assignment,
        unit,
        property,
        inquiries,
      })
    );
  } catch (error) {
    console.error("Get my rental error:", error);
    return NextResponse.json({
      success: true,
      assignment: null,
      unit: null,
      property: null,
      inquiries: [],
    });
  }
}
