import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase, getUpload, deleteUpload, ensureRentalContractsSchema } from "@/lib/db";
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

async function notify(userId: string, userType: "owner" | "agent" | "tenant", title: string, message: string) {
  const { error } = await getAdminSupabase().from("notifications").insert({
    id: `not_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    user_id: userId,
    user_type: userType,
    title,
    message,
    type: "system",
    read: false,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["owner", "agent", "tenant"]);
    if (auth instanceof NextResponse) return auth;
    const ownerView = auth.user.role === "owner";
    const recipientField = ownerView ? "owner_id" : auth.user.role === "agent" ? "agent_id" : "tenant_id";
    const { data, error } = await getAdminSupabase()
      .schema("public")
      .from("rental_contracts")
      .select("*")
      .eq(recipientField, auth.userId)
      .order("created_at", { ascending: false });
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
    const auth = await requireRole(request, ["owner", "agent"]);
    if (auth instanceof NextResponse) return auth;
    await ensureRentalContractsSchema();
    const admin = getAdminSupabase();
    const isMultipart = request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data");

    if (!isMultipart) {
      if (auth.user.role !== "agent") return NextResponse.json({ success: false, error: "Only agents can request a contract" }, { status: 403 });
      const body = await request.json();
      const propertyId = String(body.propertyId || "");
      const tenantId = String(body.tenantId || "");
      const title = String(body.title || "Tenant contract request").trim().slice(0, 200);
      const message = String(body.message || "").trim().slice(0, 1000);
      if (!propertyId || !tenantId) return NextResponse.json({ success: false, error: "Choose the property and tenant requesting the contract" }, { status: 400 });

      const { data: property, error: propertyError } = await admin.from("properties").select("id, name, created_by, agent_id").eq("id", propertyId).maybeSingle();
      if (propertyError) throw propertyError;
      if (!property || property.agent_id !== auth.userId || !property.created_by) {
        return NextResponse.json({ success: false, error: "You can request contracts for properties assigned to you" }, { status: 403 });
      }
      const { data: tenant, error: tenantError } = await admin.from("tenants").select("id, name, unit_id").eq("id", tenantId).maybeSingle();
      if (tenantError) throw tenantError;
      if (!tenant?.unit_id) return NextResponse.json({ success: false, error: "The selected tenant is not assigned to a unit" }, { status: 400 });
      const { data: unit, error: unitError } = await admin.from("units").select("id, property_id").eq("id", tenant.unit_id).maybeSingle();
      if (unitError) throw unitError;
      if (!unit || unit.property_id !== propertyId) return NextResponse.json({ success: false, error: "The selected tenant does not belong to this property" }, { status: 400 });
      const { data: owner } = await admin.schema("public").from("users").select("id, role").eq("id", property.created_by).maybeSingle();
      if (!owner || owner.role !== "owner") return NextResponse.json({ success: false, error: "The property owner could not be verified" }, { status: 400 });

      const now = new Date().toISOString();
      const id = `contract_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const { data: contract, error } = await admin.from("rental_contracts").insert({
        id, owner_id: owner.id, agent_id: auth.userId, property_id: property.id, property_name: property.name,
        tenant_id: tenant.id, tenant_name: tenant.name, title, message: message || null, status: "requested",
        created_at: now, updated_at: now,
      }).select("*").single();
      if (error) throw error;
      await notify(owner.id, "owner", "Contract requested", `${auth.user.name} requested a contract for ${tenant.name} at ${property.name}.`);
      return NextResponse.json({ success: true, contract: mapContract(contract) }, { status: 201 });
    }

    if (auth.user.role !== "owner") return NextResponse.json({ success: false, error: "Only owners can send contract documents" }, { status: 403 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ success: false, error: "Choose a PDF or Word contract file" }, { status: 400 });
    if (!CONTRACT_MIME_TYPES.has(file.type) || file.size > MAX_CONTRACT_SIZE) {
      return NextResponse.json({ success: false, error: "Use a PDF or Word file smaller than 15 MB" }, { status: 400 });
    }

    const contractId = String(form.get("contractId") || "");
    let contract: any = null;
    if (contractId) {
      const { data, error } = await admin.from("rental_contracts").select("*").eq("id", contractId).eq("owner_id", auth.userId).maybeSingle();
      if (error) throw error;
      if (!data || data.status !== "requested") return NextResponse.json({ success: false, error: "This contract request is no longer available" }, { status: 404 });
      contract = data;
    } else {
      const propertyId = String(form.get("propertyId") || "");
      const agentId = String(form.get("agentId") || "");
      const tenantId = String(form.get("tenantId") || "");
      const recipientType = form.get("recipientType") === "tenant" ? "tenant" : "agent";
      const title = String(form.get("title") || file.name || "Rental contract").trim().slice(0, 200);
      if (!propertyId || (recipientType === "agent" && !agentId) || (recipientType === "tenant" && !tenantId)) {
        return NextResponse.json({ success: false, error: recipientType === "tenant" ? "Choose a property and tenant" : "Choose a property and agent" }, { status: 400 });
      }
      const { data: property, error: propertyError } = await admin.from("properties").select("id, name, created_by").eq("id", propertyId).maybeSingle();
      if (propertyError) throw propertyError;
      if (!property || property.created_by !== auth.userId) return NextResponse.json({ success: false, error: "You can only send contracts for your properties" }, { status: 403 });
      if (recipientType === "agent") {
        const { data: agent, error: agentError } = await admin.schema("public").from("users").select("id, role").eq("id", agentId).maybeSingle();
        if (agentError) throw agentError;
        if (!agent || agent.role !== "agent") return NextResponse.json({ success: false, error: "Choose a valid agent" }, { status: 400 });
      }
      let tenant: any = null;
      if (tenantId) {
        const { data, error } = await admin.from("tenants").select("id, name, unit_id").eq("id", tenantId).maybeSingle();
        if (error) throw error;
        tenant = data;
        const { data: unit, error: unitError } = tenant?.unit_id
          ? await admin.from("units").select("id, property_id").eq("id", tenant.unit_id).maybeSingle()
          : { data: null, error: null };
        if (unitError) throw unitError;
        if (!tenant || unit?.property_id !== propertyId) return NextResponse.json({ success: false, error: "The selected tenant does not belong to this property" }, { status: 400 });
        if (recipientType === "tenant") {
          const { data: tenantUser, error: tenantUserError } = await admin.schema("public").from("users").select("id, role").eq("id", tenant.id).maybeSingle();
          if (tenantUserError) throw tenantUserError;
          if (!tenantUser || tenantUser.role !== "tenant") return NextResponse.json({ success: false, error: "The selected tenant does not have an active account" }, { status: 400 });
        }
      }
      contract = {
        id: `contract_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        owner_id: auth.userId, agent_id: recipientType === "agent" ? agentId : null, property_id: property.id, property_name: property.name,
        tenant_id: tenant?.id || null, tenant_name: tenant?.name || null, title,
      };
    }

    const fileBytes = Buffer.from(await file.arrayBuffer());
    uploadedId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { error: uploadError } = await admin.from("uploads").insert({
      id: uploadedId, user_id: auth.userId, user_type: "owner", type: "contract",
      data: fileBytes.toString("base64"), mime_type: file.type, size: file.size, created_at: new Date().toISOString(),
    });
    if (uploadError) throw uploadError;

    const now = new Date().toISOString();
    const values = {
      file_upload_id: uploadedId, file_name: file.name.replace(/[\r\n]/g, "").slice(0, 200),
      file_mime_type: file.type, status: "sent", updated_at: now,
    };
    const result = contractId
      ? await admin.from("rental_contracts").update(values).eq("id", contractId).eq("owner_id", auth.userId).select("*").single()
      : await admin.from("rental_contracts").insert({ ...contract, ...values, created_at: now }).select("*").single();
    if (result.error) throw result.error;
    if (result.data.agent_id) {
      await notify(result.data.agent_id, "agent", "Contract received", `${auth.user.name} sent “${result.data.title}” for ${result.data.property_name}.`);
    }
    if (!contractId && !result.data.agent_id && result.data.tenant_id) {
      await notify(result.data.tenant_id, "tenant", "Rental contract received", `${auth.user.name} sent “${result.data.title}” for ${result.data.property_name}.`);
    }
    return NextResponse.json({ success: true, contract: mapContract(result.data) }, { status: contractId ? 200 : 201 });
  } catch (error) {
    if (uploadedId) await deleteUpload(uploadedId).catch(() => undefined);
    console.error("Save rental contract error:", error);
    return NextResponse.json({ success: false, error: "Could not save the contract. Confirm the contract schema and upload type are installed." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["owner"]);
    if (auth instanceof NextResponse) return auth;
    await ensureRentalContractsSchema();
    const body = await request.json();
    const id = String(body.id || "");
    if (!id || body.action !== "reject") return NextResponse.json({ success: false, error: "Invalid contract request update" }, { status: 400 });
    const admin = getAdminSupabase();
    const { data: existing, error: lookupError } = await admin.from("rental_contracts").select("*").eq("id", id).eq("owner_id", auth.userId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing || existing.status !== "requested") return NextResponse.json({ success: false, error: "This request is no longer available" }, { status: 404 });
    const { data, error } = await admin.from("rental_contracts").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
    if (error) throw error;
    await notify(data.agent_id, "agent", "Contract request declined", `Your request for ${data.tenant_name || "a tenant"} at ${data.property_name} was declined.`);
    return NextResponse.json({ success: true, contract: mapContract(data) });
  } catch (error) {
    console.error("Update rental contract error:", error);
    return NextResponse.json({ success: false, error: "Could not update the contract request" }, { status: 500 });
  }
}
