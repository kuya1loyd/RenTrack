import { NextRequest, NextResponse } from "next/server";
import { getTenants, createTenant, deleteTenant, syncTenantUnit } from "@/lib/db";
import { getAdminSupabase } from "@/lib/db";
import {
  requireAuth, requireRole, validateApiRequest, withRateLimit,
  sanitizeResponse, withSecurityHeaders, withCorsHeaders,
  sanitizeObject, getClientIp
} from "@/lib/api-security";
import { logAudit } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    let tenants = await getTenants();
    if (auth.user.role === "agent") {
      try {
        const adminClient = getAdminSupabase();

        // 1. Properties assigned to agent
        const { data: assignedProperties } = await adminClient
          .from("properties")
          .select("id, name")
          .eq("agent_id", auth.userId);
        const propertyIds = (assignedProperties || []).map((p: any) => p.id);
        const propertyNames = new Set(
          (assignedProperties || []).map((p: any) => String(p.name || "").trim().toLowerCase()).filter(Boolean)
        );

        // 2. Units in assigned properties
        const { data: assignedUnits } = propertyIds.length
          ? await adminClient.from("units").select("id").in("property_id", propertyIds)
          : { data: [] };
        const assignedUnitIds = new Set((assignedUnits || []).map((u: any) => u.id));

        // 3. Rental contracts with this agent
        const { data: contracts } = await adminClient
          .from("rental_contracts")
          .select("tenant_id, tenant_name")
          .eq("agent_id", auth.userId);
        const contractTenantIds = new Set((contracts || []).map((c: any) => c.tenant_id).filter(Boolean));
        const contractTenantNames = new Set(
          (contracts || []).map((c: any) => String(c.tenant_name || "").trim().toLowerCase()).filter(Boolean)
        );

        // 4. Inquiries / chat messages with this agent
        const { data: inquiries } = await adminClient
          .from("chat_messages")
          .select("sender_email")
          .eq("agent_id", auth.userId);
        const inquiryEmails = new Set(
          (inquiries || []).map((i: any) => String(i.sender_email || "").trim().toLowerCase()).filter(Boolean)
        );

        // 5. Direct messages with this agent
        const { data: directMessages } = await adminClient
          .from("messages")
          .select("sender_id, receiver_id")
          .or(`sender_id.eq.${auth.userId},receiver_id.eq.${auth.userId}`);
        const messagePartnerIds = new Set(
          (directMessages || []).flatMap((m: any) => [m.sender_id, m.receiver_id]).filter((id: string) => id && id !== auth.userId)
        );

        // Tag every tenant with assistance relationship
        tenants = tenants.map((tenant) => {
          let assistReason: string | null = null;
          if (tenant.createdBy === auth.userId) {
            assistReason = "Registered Client";
          } else if (tenant.unitId && assignedUnitIds.has(tenant.unitId)) {
            assistReason = tenant.propertyName ? `Assigned to ${tenant.propertyName}` : "Assigned Unit";
          } else if (tenant.propertyName && propertyNames.has(String(tenant.propertyName).trim().toLowerCase())) {
            assistReason = `Property: ${tenant.propertyName}`;
          } else if (contractTenantIds.has(tenant.id) || contractTenantNames.has(String(tenant.name || "").trim().toLowerCase())) {
            assistReason = "Rental Contract";
          } else if (inquiryEmails.has(String(tenant.email || "").trim().toLowerCase())) {
            assistReason = "Client Inquiry";
          } else if (messagePartnerIds.has(tenant.id)) {
            assistReason = "Direct Contact";
          }
          return {
            ...tenant,
            isAssisted: Boolean(assistReason),
            assistReason: assistReason || "Available Renter",
          };
        });

        // Sort: Assisted tenants appear first
        tenants.sort((a: any, b: any) => (b.isAssisted ? 1 : 0) - (a.isAssisted ? 1 : 0));
      } catch (err) {
        console.error("Filter agent tenants error:", err);
      }
    }
    return NextResponse.json({ success: true, tenants: tenants.map(t => sanitizeResponse(t)) });
  } catch (error) {
    console.error("Get tenants error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch tenants" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await withRateLimit(request, `create_tenant:${getClientIp(request)}`);
    if (rateLimit) return rateLimit;

    const auth = await requireRole(request, ["admin", "owner"]);
    if (auth instanceof NextResponse) return auth;

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const body = await request.json();
    const sanitized = sanitizeObject(body, [
      { key: "id", type: "string", maxLength: 100 },
      { key: "name", type: "string", maxLength: 200 },
      { key: "email", type: "string", maxLength: 200 },
      { key: "phone", type: "string", maxLength: 50 },
      { key: "address", type: "string", maxLength: 500 },
      { key: "occupation", type: "string", maxLength: 100 },
      { key: "emergencyContact", type: "string", maxLength: 200 },
      { key: "emergencyPhone", type: "string", maxLength: 50 },
      { key: "unitId", type: "string", maxLength: 100 },
      { key: "propertyName", type: "string", maxLength: 200 },
      { key: "unitNumber", type: "string", maxLength: 50 },
      { key: "contractStart", type: "string", maxLength: 20 },
      { key: "contractEnd", type: "string", maxLength: 20 },
      { key: "rentAmount", type: "number" },
    ]);

    if (!sanitized.name) {
      return NextResponse.json({ success: false, error: "Tenant name is required" }, { status: 400 });
    }
    if (sanitized.rentAmount !== undefined && Number(sanitized.rentAmount) <= 0) {
      return NextResponse.json({ success: false, error: "Rent must be a positive amount" }, { status: 400 });
    }
    if (sanitized.contractStart && sanitized.contractEnd && new Date(sanitized.contractEnd) <= new Date(sanitized.contractStart)) {
      return NextResponse.json({ success: false, error: "Lease end date must be after the start date" }, { status: 400 });
    }
    if (sanitized.unitId) {
      const { data: unit, error: unitError } = await getAdminSupabase().from("units").select("id, status, unit_number").eq("id", sanitized.unitId).maybeSingle();
      if (unitError || !unit || unit.status !== "vacant" || (sanitized.unitNumber && unit.unit_number !== sanitized.unitNumber)) {
        return NextResponse.json({ success: false, error: "The selected unit is no longer available" }, { status: 409 });
      }
    } else if (sanitized.propertyName || sanitized.unitNumber) {
      return NextResponse.json({ success: false, error: "A valid available unit is required for a property assignment" }, { status: 400 });
    }

    const tenant = await createTenant(sanitized, auth.userId);
    if (sanitized.unitId) await syncTenantUnit(tenant.id, sanitized.unitId, "confirmed");
    await logAudit(auth.userId, "tenant_created", { tenantId: tenant.id, name: tenant.name }, auth.ip, auth.userAgent);
    return NextResponse.json({ success: true, tenant: sanitizeResponse(tenant) });
  } catch (error) {
    console.error("Create tenant error:", error);
    return NextResponse.json({ success: false, error: "Failed to create tenant" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "owner", "agent"]);
    if (auth instanceof NextResponse) return auth;

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const body = await request.json();
    const tenantId = body.tenantId || body.id;
    const { tenantId: _tId, id: _id, ...updates } = body;

    if (!tenantId) {
      return NextResponse.json({ success: false, error: "Tenant ID is required" }, { status: 400 });
    }

    const camelToSnake: Record<string, string> = {
      unitId: "unit_id",
      propertyName: "property_name",
      unitNumber: "unit_number",
      contractStart: "contract_start",
      contractEnd: "contract_end",
      rentAmount: "rent_amount",
      assignmentStatus: "assignment_status",
    };

    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      const snake = camelToSnake[key] || key;
      if (value === undefined || value === null) continue;
      cleaned[snake] = value;
    }

    const { data, error } = await getAdminSupabase()
      .from("tenants")
      .update(cleaned)
      .eq("id", tenantId)
      .select("*")
      .single();

    if (error) {
      const code = String((error as any)?.code || "");
      const message = String(error?.message || "");
      const details = String((error as any)?.details || "");

      if (code === "PGRST116" || message.includes("0 rows") || details.includes("0 rows")) {
        const { data: userRow, error: userError } = await getAdminSupabase()
          .schema("public").from("users")
          .select("*")
          .eq("id", tenantId)
          .eq("role", "tenant")
          .maybeSingle();

        if (userError || !userRow) throw error;

        const { data: existingTenant } = await getAdminSupabase()
          .from("tenants")
          .select("*")
          .eq("id", tenantId)
          .maybeSingle();

        const mapTenant = (row: any) => sanitizeResponse({
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          address: row.address,
          occupation: row.occupation,
          emergencyContact: row.emergency_contact,
          emergencyPhone: row.emergency_phone,
          unitId: row.unit_id,
          propertyName: row.property_name,
          unitNumber: row.unit_number,
          contractStart: row.contract_start,
          contractEnd: row.contract_end,
          rentAmount: row.rent_amount,
          status: row.status,
          assignmentStatus: row.assignment_status,
          createdBy: row.created_by,
          createdAt: row.created_at,
          avatarUrl: null,
          idVerificationUrl: null,
          idVerificationStatus: null,
        });

        if (!existingTenant) {
          const { error: insertError } = await getAdminSupabase().from("tenants").insert({
            id: tenantId,
            name: (userRow as any).name,
            email: (userRow as any).email,
            phone: (userRow as any).phone || null,
            address: (userRow as any).address || null,
            status: "active",
            ...cleaned,
          });
          if (insertError) throw insertError;
          const { data: inserted, error: insertedError } = await getAdminSupabase().from("tenants").select("*").eq("id", tenantId).single();
          if (insertedError) throw insertedError;
          return NextResponse.json({ success: true, tenant: mapTenant(inserted) });
        }

        const { data: relinked, error: relinkError } = await getAdminSupabase()
          .from("tenants")
          .update(cleaned)
          .eq("id", tenantId)
          .select("*")
          .single();
        if (relinkError) throw relinkError;
        return NextResponse.json({ success: true, tenant: mapTenant(relinked) });
      }

      if (code === "PGRST204" || message.includes("assignmentStatus") || details.includes("assignmentStatus") || (message.toLowerCase().includes("column") && message.toLowerCase().includes("does not exist"))) {
        const mapTenant = (row: any) => sanitizeResponse({
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          address: row.address,
          occupation: row.occupation,
          emergencyContact: row.emergency_contact,
          emergencyPhone: row.emergency_phone,
          unitId: row.unit_id,
          propertyName: row.property_name,
          unitNumber: row.unit_number,
          contractStart: row.contract_start,
          contractEnd: row.contract_end,
          rentAmount: row.rent_amount,
          status: row.status,
          assignmentStatus: row.assignment_status,
          createdBy: row.created_by,
          createdAt: row.created_at,
          avatarUrl: null,
          idVerificationUrl: null,
          idVerificationStatus: null,
        });

        try {
          await getAdminSupabase().rpc("exec_sql", { sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS assignment_status TEXT DEFAULT '' CHECK (assignment_status IN ('', 'pending', 'confirmed', 'rejected'))`, params: [] });
        } catch {
          // ignore migration errors from cached RPC
        }
        const { data: retryData, error: retryError } = await getAdminSupabase()
          .from("tenants")
          .update(cleaned)
          .eq("id", tenantId)
          .select("*")
          .single();
        if (retryError) throw retryError;
        return NextResponse.json({ success: true, tenant: mapTenant(retryData) });
      }

      throw error;
    }

    const mapTenant = (row: any) => sanitizeResponse({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      occupation: row.occupation,
      emergencyContact: row.emergency_contact,
      emergencyPhone: row.emergency_phone,
      unitId: row.unit_id,
      propertyName: row.property_name,
      unitNumber: row.unit_number,
      contractStart: row.contract_start,
      contractEnd: row.contract_end,
      rentAmount: row.rent_amount,
      status: row.status,
      assignmentStatus: row.assignment_status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      avatarUrl: null,
      idVerificationUrl: null,
      idVerificationStatus: null,
    });

    if (cleaned.unit_id !== undefined || cleaned.assignment_status !== undefined) {
      await syncTenantUnit(tenantId, cleaned.unit_id || data.unit_id || null, cleaned.assignment_status || data.assignment_status || "");
    }
    if (cleaned.name || cleaned.phone !== undefined || cleaned.address !== undefined) {
      try {
        const userUpdates: Record<string, any> = {};
        if (cleaned.name) userUpdates.name = cleaned.name;
        if (cleaned.phone !== undefined) userUpdates.phone = cleaned.phone;
        if (cleaned.address !== undefined) userUpdates.address = cleaned.address;
        await getAdminSupabase().schema("public").from("users").update(userUpdates).eq("id", tenantId);
      } catch (err) {
        console.warn("Failed to sync tenant to users table:", err);
      }
    }
    return NextResponse.json({ success: true, tenant: mapTenant(data) });
  } catch (error) {
    console.error("Patch tenant error:", error);
    return NextResponse.json({ success: false, error: "Failed to update tenant" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "owner", "agent"]);
    if (auth instanceof NextResponse) return auth;

    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Tenant ID is required" }, { status: 400 });
    }

    await deleteTenant(userId);
    await logAudit(auth.userId, "tenant_deleted", { tenantId: userId }, auth.ip, auth.userAgent);
    return NextResponse.json({ success: true, message: "Tenant deleted successfully" });
  } catch (error) {
    console.error("Delete tenant error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete tenant" }, { status: 500 });
  }
}
