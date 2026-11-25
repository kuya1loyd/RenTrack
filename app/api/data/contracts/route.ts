import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase, createUpload, deleteUpload, ensureRentalContractsSchema } from "@/lib/db";
import { requireRole } from "@/lib/api-security";

const MAX_CONTRACT_SIZE = 15 * 1024 * 1024;
const CONTRACT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function mapContract(row: any) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    agentId: row.agent_id || undefined,
    propertyId: row.property_id,
    propertyName: row.property_name,
    tenantId: row.tenant_id || undefined,
    tenantName: row.tenant_name || undefined,
    title: row.title,
    message: row.message || undefined,
    fileName: row.file_name || undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function resolveContractTarget(admin: ReturnType<typeof getAdminSupabase>, targetId: string) {
  const { data: property, error: propertyError } = await admin
    .from("properties")
    .select("id, name, created_by, agent_id")
    .eq("id", targetId)
    .maybeSingle();
  if (propertyError) throw propertyError;
  if (property) {
    return {
      id: property.id as string,
      name: property.name as string,
      created_by: (property.created_by as string | null) || null,
      agent_id: (property.agent_id as string | null) || null,
      kind: "property" as const,
    };
  }

  const { data: unit, error: unitError } = await admin
    .from("units")
    .select("id, name, unit_number, property_id, created_by, agent_id")
    .eq("id", targetId)
    .maybeSingle();
  if (unitError) throw unitError;
  if (unit) {
    let parentOwner: string | null = null;
    let parentAgent: string | null = null;
    let parentName: string | null = null;
    if (unit.property_id) {
      const { data: parentProp } = await admin
        .from("properties")
        .select("name, created_by, agent_id")
        .eq("id", unit.property_id)
        .maybeSingle();
      parentOwner = parentProp?.created_by || null;
      parentAgent = parentProp?.agent_id || null;
      parentName = parentProp?.name || null;
    }
    const cleanNum = String(unit.unit_number || "").replace(/^unit\s*#?\s*/i, "").trim();
    const building = String(unit.name || parentName || "").trim();
    const displayName = cleanNum && building
      ? `Unit ${cleanNum} – ${building}`
      : cleanNum
        ? `Unit ${cleanNum}`
        : building || "Condominium Unit";

    return {
      id: unit.id as string,
      name: displayName,
      created_by: (unit.created_by as string | null) || parentOwner,
      agent_id: (unit.agent_id as string | null) || parentAgent,
      kind: "unit" as const,
    };
  }

  return null;
}

async function resolveContractTenant(admin: ReturnType<typeof getAdminSupabase>, tenantId: string) {
  const { data: tenantById } = await admin
    .from("tenants")
    .select("id, name, email, unit_id")
    .eq("id", tenantId)
    .maybeSingle();

  const { data: userById } = await admin
    .schema("public")
    .from("users")
    .select("id, name, email, role")
    .eq("id", tenantId)
    .maybeSingle();

  let tenantRow = tenantById;
  let userRow = userById;

  if (!tenantRow && userRow?.email) {
    const { data: tenantByEmail } = await admin
      .from("tenants")
      .select("id, name, email, unit_id")
      .ilike("email", String(userRow.email).trim())
      .maybeSingle();
    tenantRow = tenantByEmail;
  }

  if (!userRow && tenantRow?.email) {
    const { data: userByEmail } = await admin
      .schema("public")
      .from("users")
      .select("id, name, email, role")
      .ilike("email", String(tenantRow.email).trim())
      .maybeSingle();
    userRow = userByEmail;
  }

  if (!tenantRow && !userRow) return null;

  return {
    effectiveId: userRow?.id || tenantRow?.id || tenantId,
    userId: userRow?.id || null,
    name: tenantRow?.name || userRow?.name || "Tenant",
    email: tenantRow?.email || userRow?.email || null,
  };
}

async function notify(userId: string, userType: "owner" | "agent" | "tenant", title: string, message: string) {
  try {
    const { data: user } = await getAdminSupabase().schema("public").from("users").select("id").eq("id", userId).maybeSingle();
    if (!user) {
      console.warn(`[notify] Skipped notification for non-user id: ${userId}`);
      return;
    }
    const { error } = await getAdminSupabase().from("notifications").insert({
      id: `not_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      user_id: userId,
      user_type: userType,
      title,
      message,
      type: "property",
      read: false,
      created_at: new Date().toISOString(),
    });
    if (error) console.warn("[notify] notification insert warning:", error.message);
  } catch (err) {
    console.warn("[notify] failed to send notification:", err);
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "owner", "agent", "tenant"]);
    if (auth instanceof NextResponse) return auth;
    await ensureRentalContractsSchema();
    const admin = getAdminSupabase();

    let query = admin.schema("public").from("rental_contracts").select("*").order("created_at", { ascending: false });

    if (auth.user.role === "admin") {
      // Admin sees all contracts
    } else if (auth.user.role === "owner") {
      query = query.or(`owner_id.eq.${auth.userId}`);
    } else if (auth.user.role === "agent") {
      const [{ data: assignedProps }, { data: assignedUnits }] = await Promise.all([
        admin.from("properties").select("id").eq("agent_id", auth.userId),
        admin.from("units").select("id").eq("agent_id", auth.userId),
      ]);
      const targetIds = [
        ...(assignedProps || []).map((p: any) => p.id),
        ...(assignedUnits || []).map((u: any) => u.id),
      ].filter(Boolean);
      if (targetIds.length > 0) {
        query = query.or(`agent_id.eq.${auth.userId},property_id.in.(${targetIds.join(",")})`);
      } else {
        query = query.eq("agent_id", auth.userId);
      }
    } else {
      const { data: tenantRecords } = await admin.from("tenants").select("id").or(`id.eq.${auth.userId},email.ilike.${auth.user.email}`);
      const tenantIds = Array.from(new Set([auth.userId, ...(tenantRecords || []).map((t: any) => t.id)].filter(Boolean)));
      if (tenantIds.length > 0) {
        query = query.in("tenant_id", tenantIds);
      } else {
        query = query.eq("tenant_id", auth.userId);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true, contracts: (data || []).map(mapContract) });
  } catch (error) {
    console.error("Get rental contracts error:", error);
    const message = error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "Unknown database error";
    const code = typeof error === "object" && error && "code" in error
      ? ` (${String(error.code)})`
      : "";
    return NextResponse.json({
      success: false,
      error: process.env.NODE_ENV === "development"
        ? `Could not load contracts: ${message}${code}`
        : "Could not load contracts. Confirm the rental_contracts schema is installed.",
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let uploadedId: string | null = null;
  try {
    const auth = await requireRole(request, ["admin", "owner", "agent"]);
    if (auth instanceof NextResponse) return auth;
    await ensureRentalContractsSchema();
    const admin = getAdminSupabase();
    const isMultipart = request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data");

    // Case 1: Non-multipart JSON (Agent requesting a contract from Owner)
    if (!isMultipart) {
      if (auth.user.role !== "agent" && auth.user.role !== "admin") {
        return NextResponse.json({ success: false, error: "Only agents can request a contract" }, { status: 403 });
      }
      const body = await request.json();
      const propertyId = String(body.propertyId || "");
      const tenantId = String(body.tenantId || "");
      const title = String(body.title || "Tenant contract request").trim().slice(0, 200);
      const message = String(body.message || "").trim().slice(0, 1000);
      if (!propertyId || !tenantId) {
        return NextResponse.json({ success: false, error: "Choose the property or unit and tenant requesting the contract" }, { status: 400 });
      }

      const target = await resolveContractTarget(admin, propertyId);
      if (!target) {
        return NextResponse.json({ success: false, error: "Selected property or condominium unit not found" }, { status: 404 });
      }

      const resolvedTenant = await resolveContractTenant(admin, tenantId);
      if (!resolvedTenant) {
        return NextResponse.json({ success: false, error: "Selected tenant not found" }, { status: 404 });
      }

      let ownerId = target.created_by;
      if (!ownerId) {
        const { data: firstOwner } = await admin.schema("public").from("users").select("id").eq("role", "owner").limit(1).maybeSingle();
        ownerId = firstOwner?.id || auth.userId;
      }

      const now = new Date().toISOString();
      const id = `contract_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const insertPayload = {
        id,
        owner_id: ownerId,
        agent_id: auth.userId,
        property_id: target.id,
        property_name: target.name,
        tenant_id: resolvedTenant.effectiveId,
        tenant_name: resolvedTenant.name,
        title,
        message: message || null,
        status: "requested",
        created_at: now,
        updated_at: now,
      };

      let { data: contract, error } = await admin.from("rental_contracts").insert(insertPayload).select("*").single();
      if (error) {
        try {
          await (admin.rpc as any)("exec_sql", {
            sql: "ALTER TABLE public.rental_contracts DROP CONSTRAINT IF EXISTS rental_contracts_property_id_fkey; ALTER TABLE public.rental_contracts DROP CONSTRAINT IF EXISTS rental_contracts_tenant_id_fkey;",
          });
        } catch {}
        const retry = await admin.from("rental_contracts").insert(insertPayload).select("*").single();
        contract = retry.data;
        error = retry.error;
      }
      if (error) throw error;

      if (ownerId) {
        await notify(ownerId, "owner", "Contract requested", `${auth.user.name} requested a contract for ${resolvedTenant.name} at ${target.name}.`);
      }
      return NextResponse.json({ success: true, contract: mapContract(contract) }, { status: 201 });
    }

    // Case 2: Multipart Form Data (Sending a contract document - Owner or Agent)
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Choose a PDF or Word contract file" }, { status: 400 });
    }
    if (!CONTRACT_MIME_TYPES.has(file.type) && !/\.(pdf|doc|docx)$/i.test(file.name)) {
      return NextResponse.json({ success: false, error: "Use a PDF or Word file smaller than 15 MB" }, { status: 400 });
    }
    if (file.size > MAX_CONTRACT_SIZE) {
      return NextResponse.json({ success: false, error: "Contract file exceeds maximum size of 15 MB" }, { status: 400 });
    }

    const contractId = String(form.get("contractId") || "");
    let contract: any = null;
    let recipientTenantUserId: string | null = null;
    let deliverToTenant = false;

    if (contractId) {
      const { data, error } = await admin.from("rental_contracts").select("*").eq("id", contractId).maybeSingle();
      if (error) throw error;
      if (!data || data.status !== "requested") {
        return NextResponse.json({ success: false, error: "This contract request is no longer available" }, { status: 404 });
      }
      contract = data;
      // Fulfilling an agent's request delivers the file to the agent only; the tenant is not notified.
      deliverToTenant = false;
    } else {
      const propertyId = String(form.get("propertyId") || "");
      const agentId = String(form.get("agentId") || "");
      const tenantId = String(form.get("tenantId") || "");
      const recipientType = form.get("recipientType") === "agent" ? "agent" : "tenant";
      const title = String(form.get("title") || file.name || "Rental contract").trim().slice(0, 200);

      if (!propertyId) {
        return NextResponse.json({ success: false, error: "Choose a property or condominium unit" }, { status: 400 });
      }
      if (recipientType === "agent" && !agentId) {
        return NextResponse.json({ success: false, error: "Choose an agent to receive the contract" }, { status: 400 });
      }
      if (recipientType === "tenant" && !tenantId) {
        return NextResponse.json({ success: false, error: "Choose a tenant to receive the contract" }, { status: 400 });
      }

      const target = await resolveContractTarget(admin, propertyId);
      if (!target) {
        return NextResponse.json({ success: false, error: "Selected property or condominium unit not found" }, { status: 404 });
      }

      let ownerId = target.created_by;
      if (!ownerId && auth.user.role === "owner") {
        ownerId = auth.userId;
      }
      if (!ownerId) {
        const { data: defaultOwner } = await admin.schema("public").from("users").select("id").eq("role", "owner").limit(1).maybeSingle();
        ownerId = defaultOwner?.id || auth.userId;
      }

      const effectiveAgentId = recipientType === "agent" ? agentId : (auth.user.role === "agent" ? auth.userId : (target.agent_id || null));
      let effectiveTenantId: string | null = null;
      let tenantName: string | null = null;

      if (tenantId) {
        const resolvedTenant = await resolveContractTenant(admin, tenantId);
        if (resolvedTenant) {
          tenantName = resolvedTenant.name;
          if (recipientType === "tenant") {
            recipientTenantUserId = resolvedTenant.userId;
            effectiveTenantId = resolvedTenant.effectiveId;
            deliverToTenant = true;
          }
        }
      }

      contract = {
        id: `contract_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        owner_id: ownerId,
        agent_id: effectiveAgentId,
        property_id: target.id,
        property_name: target.name,
        tenant_id: effectiveTenantId,
        tenant_name: tenantName,
        title,
      };
    }

    const fileBytes = Buffer.from(await file.arrayBuffer());
    uploadedId = await createUpload({
      userId: auth.userId,
      userType: auth.user.role,
      type: "contract",
      buffer: fileBytes,
      mimeType: file.type || "application/pdf",
      size: file.size || fileBytes.length,
    });

    const now = new Date().toISOString();
    const values: Record<string, any> = {
      file_upload_id: uploadedId,
      file_name: file.name.replace(/[\r\n]/g, "").slice(0, 200),
      file_mime_type: file.type || "application/pdf",
      status: "sent",
      updated_at: now,
    };
    // Contracts sent to an agent (including fulfilled agent requests) must not appear in the tenant's portal.
    if (contractId) values.tenant_id = null;

    let result = contractId
      ? await admin.from("rental_contracts").update(values).eq("id", contractId).select("*").single()
      : await admin.from("rental_contracts").insert({ ...contract, ...values, created_at: now }).select("*").single();

    if (result.error && !contractId) {
      try {
        await (admin.rpc as any)("exec_sql", {
          sql: "ALTER TABLE public.rental_contracts DROP CONSTRAINT IF EXISTS rental_contracts_property_id_fkey; ALTER TABLE public.rental_contracts DROP CONSTRAINT IF EXISTS rental_contracts_tenant_id_fkey;",
        });
      } catch {}
      result = await admin.from("rental_contracts").insert({ ...contract, ...values, created_at: now }).select("*").single();
    }
    if (result.error) throw result.error;

    // Send notifications
    if (result.data.agent_id && result.data.agent_id !== auth.userId) {
      await notify(result.data.agent_id, "agent", "Contract received", `${auth.user.name} sent “${result.data.title}” for ${result.data.property_name}.`);
    }
    const tenantTargetUserId = deliverToTenant || auth.user.role === "agent" ? (recipientTenantUserId || result.data.tenant_id) : null;
    if (tenantTargetUserId && tenantTargetUserId !== auth.userId && !contractId) {
      await notify(tenantTargetUserId, "tenant", "Rental contract received", `${auth.user.name} sent “${result.data.title}” for ${result.data.property_name}.`);
    }
    if (result.data.owner_id && result.data.owner_id !== auth.userId && auth.user.role === "agent") {
      await notify(result.data.owner_id, "owner", "Contract issued", `${auth.user.name} issued contract “${result.data.title}” for ${result.data.property_name}.`);
    }

    return NextResponse.json({ success: true, contract: mapContract(result.data) }, { status: contractId ? 200 : 201 });
  } catch (error) {
    if (uploadedId) await deleteUpload(uploadedId).catch(() => undefined);
    console.error("Save rental contract error:", error);
    const message = error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "Failed to save contract record";
    return NextResponse.json({ success: false, error: `Could not save the contract: ${message}` }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "owner", "agent"]);
    if (auth instanceof NextResponse) return auth;
    await ensureRentalContractsSchema();
    const body = await request.json();
    const id = String(body.id || "");
    if (!id || body.action !== "reject") return NextResponse.json({ success: false, error: "Invalid contract request update" }, { status: 400 });
    const admin = getAdminSupabase();

    const lookupQuery = admin.from("rental_contracts").select("*").eq("id", id);
    if (auth.user.role === "owner") {
      lookupQuery.eq("owner_id", auth.userId);
    } else if (auth.user.role === "agent") {
      lookupQuery.eq("agent_id", auth.userId);
    }
    const { data: existing, error: lookupError } = await lookupQuery.maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing || existing.status !== "requested") return NextResponse.json({ success: false, error: "This request is no longer available" }, { status: 404 });

    const { data, error } = await admin.from("rental_contracts").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
    if (error) throw error;

    if (data.agent_id && data.agent_id !== auth.userId) {
      await notify(data.agent_id, "agent", "Contract request declined", `Your request for ${data.tenant_name || "a tenant"} at ${data.property_name} was declined.`);
    }
    return NextResponse.json({ success: true, contract: mapContract(data) });
  } catch (error) {
    console.error("Update rental contract error:", error);
    return NextResponse.json({ success: false, error: "Could not update the contract request" }, { status: 500 });
  }
}
