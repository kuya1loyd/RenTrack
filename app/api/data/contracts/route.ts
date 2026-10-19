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
      type: "system",
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
      // Owner sees contracts where they are owner_id OR all contracts if owner manages the portfolio
      query = query.or(`owner_id.eq.${auth.userId}`);
    } else if (auth.user.role === "agent") {
      // Agent sees contracts where they are agent_id OR property is assigned to them
      const { data: assignedProps } = await admin.from("properties").select("id").eq("agent_id", auth.userId);
      const propIds = (assignedProps || []).map((p: any) => p.id).filter(Boolean);
      if (propIds.length > 0) {
        query = query.or(`agent_id.eq.${auth.userId},property_id.in.(${propIds.join(",")})`);
      } else {
        query = query.eq("agent_id", auth.userId);
      }
    } else {
      // Tenant view: find all IDs associated with this tenant user (by users.id or tenants.email)
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
        return NextResponse.json({ success: false, error: "Choose the property and tenant requesting the contract" }, { status: 400 });
      }

      const { data: property, error: propertyError } = await admin.from("properties").select("id, name, created_by, agent_id").eq("id", propertyId).maybeSingle();
      if (propertyError) throw propertyError;
      if (!property) {
        return NextResponse.json({ success: false, error: "Selected property not found" }, { status: 404 });
      }
      if (auth.user.role === "agent" && property.agent_id && property.agent_id !== auth.userId) {
        return NextResponse.json({ success: false, error: "You can request contracts for properties assigned to you" }, { status: 403 });
      }

      const { data: tenant, error: tenantError } = await admin.from("tenants").select("id, name, email, unit_id").eq("id", tenantId).maybeSingle();
      if (tenantError) throw tenantError;
      if (!tenant) {
        return NextResponse.json({ success: false, error: "Selected tenant not found" }, { status: 404 });
      }

      // Find owner for this property
      let ownerId = property.created_by;
      if (!ownerId) {
        const { data: firstOwner } = await admin.schema("public").from("users").select("id").eq("role", "owner").limit(1).maybeSingle();
        ownerId = firstOwner?.id || auth.userId;
      }

      const now = new Date().toISOString();
      const id = `contract_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const { data: contract, error } = await admin.from("rental_contracts").insert({
        id,
        owner_id: ownerId,
        agent_id: auth.userId,
        property_id: property.id,
        property_name: property.name,
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        title,
        message: message || null,
        status: "requested",
        created_at: now,
        updated_at: now,
      }).select("*").single();
      if (error) throw error;

      if (ownerId) {
        await notify(ownerId, "owner", "Contract requested", `${auth.user.name} requested a contract for ${tenant.name} at ${property.name}.`);
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

    if (contractId) {
      // Fulfilling an existing contract request
      const { data, error } = await admin.from("rental_contracts").select("*").eq("id", contractId).maybeSingle();
      if (error) throw error;
      if (!data || data.status !== "requested") {
        return NextResponse.json({ success: false, error: "This contract request is no longer available" }, { status: 404 });
      }
      contract = data;
    } else {
      // Creating a new direct contract
      const propertyId = String(form.get("propertyId") || "");
      const agentId = String(form.get("agentId") || "");
      const tenantId = String(form.get("tenantId") || "");
      const recipientType = form.get("recipientType") === "agent" ? "agent" : "tenant";
      const title = String(form.get("title") || file.name || "Rental contract").trim().slice(0, 200);

      if (!propertyId) {
        return NextResponse.json({ success: false, error: "Choose a property" }, { status: 400 });
      }
      if (recipientType === "agent" && !agentId) {
        return NextResponse.json({ success: false, error: "Choose an agent to receive the contract" }, { status: 400 });
      }
      if (recipientType === "tenant" && !tenantId) {
        return NextResponse.json({ success: false, error: "Choose a tenant to receive the contract" }, { status: 400 });
      }

      const { data: property, error: propertyError } = await admin.from("properties").select("id, name, created_by, agent_id").eq("id", propertyId).maybeSingle();
      if (propertyError) throw propertyError;
      if (!property) {
        return NextResponse.json({ success: false, error: "Property not found" }, { status: 404 });
      }

      // Check agent property assignment if agent is sending
      if (auth.user.role === "agent" && property.agent_id && property.agent_id !== auth.userId) {
        return NextResponse.json({ success: false, error: "You can only send contracts for your assigned properties" }, { status: 403 });
      }

      // Determine owner ID
      let ownerId = property.created_by;
      if (!ownerId && auth.user.role === "owner") {
        ownerId = auth.userId;
      }
      if (!ownerId) {
        const { data: defaultOwner } = await admin.schema("public").from("users").select("id").eq("role", "owner").limit(1).maybeSingle();
        ownerId = defaultOwner?.id || auth.userId;
      }

      let effectiveAgentId = recipientType === "agent" ? agentId : (auth.user.role === "agent" ? auth.userId : (property.agent_id || null));
      let tenant: any = null;
      let effectiveTenantId: string | null = null;
      let tenantName: string | null = null;

      if (tenantId) {
        const { data: tenantData } = await admin.from("tenants").select("id, name, email, unit_id").eq("id", tenantId).maybeSingle();
        tenant = tenantData;
        if (tenant) {
          tenantName = tenant.name;
          // Look up tenant's user account in public.users
          const { data: userById } = await admin.schema("public").from("users").select("id, role").eq("id", tenant.id).maybeSingle();
          if (userById?.id && userById.role === "tenant") {
            recipientTenantUserId = userById.id;
          } else if (tenant.email) {
            const { data: userByEmail } = await admin.schema("public").from("users").select("id, role").ilike("email", tenant.email.trim()).maybeSingle();
            if (userByEmail?.id) recipientTenantUserId = userByEmail.id;
          }
          effectiveTenantId = recipientTenantUserId || tenant.id;
        }
      }

      contract = {
        id: `contract_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        owner_id: ownerId,
        agent_id: effectiveAgentId,
        property_id: property.id,
        property_name: property.name,
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
    const values = {
      file_upload_id: uploadedId,
      file_name: file.name.replace(/[\r\n]/g, "").slice(0, 200),
      file_mime_type: file.type || "application/pdf",
      status: "sent",
      updated_at: now,
    };

    const result = contractId
      ? await admin.from("rental_contracts").update(values).eq("id", contractId).select("*").single()
      : await admin.from("rental_contracts").insert({ ...contract, ...values, created_at: now }).select("*").single();
    if (result.error) throw result.error;

    // Send notifications
    if (result.data.agent_id && result.data.agent_id !== auth.userId) {
      await notify(result.data.agent_id, "agent", "Contract received", `${auth.user.name} sent “${result.data.title}” for ${result.data.property_name}.`);
    }
    const tenantTargetUserId = recipientTenantUserId || result.data.tenant_id;
    if (tenantTargetUserId && tenantTargetUserId !== auth.userId) {
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
