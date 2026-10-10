import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-security";
import { getAdminSupabase, getTenants } from "@/lib/db";
import { sanitizeResponse } from "@/lib/api-security";

export interface AssistedTenantInfo {
  id: string;
  name: string;
  email: string;
  phone?: string;
  propertyName?: string;
  unitNumber?: string;
  status: string;
  assignmentStatus?: string;
  rentAmount?: number;
  contractStart?: string;
  contractEnd?: string;
  assistReason: string;
  createdAt?: string;
  avatarUrl?: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "agent"]);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const requestedAgentId = searchParams.get("agentId");

    const adminClient = getAdminSupabase();
    const allTenants = await getTenants();

    // 1. Fetch properties
    const { data: properties } = await adminClient.from("properties").select("id, name, agent_id");
    const propertyList = properties || [];

    // Check if there is only 1 agent
    const { data: agentUsers } = await adminClient
      .schema("public")
      .from("users")
      .select("id")
      .eq("role", "agent");
    const allAgentIds = requestedAgentId
      ? [requestedAgentId]
      : (agentUsers || []).map((u: any) => u.id);
    const singleAgentId = allAgentIds.length === 1 ? allAgentIds[0] : null;

    // Map of agentId -> propertyIds and propertyNames
    const agentPropertiesMap = new Map<string, { ids: Set<string>; names: Set<string> }>();
    const allAssignedPropertyIds: string[] = [];

    for (const prop of propertyList) {
      const assignedId = prop.agent_id || singleAgentId;
      if (!assignedId) continue;
      if (!agentPropertiesMap.has(assignedId)) {
        agentPropertiesMap.set(assignedId, { ids: new Set(), names: new Set() });
      }
      const entry = agentPropertiesMap.get(assignedId)!;
      entry.ids.add(prop.id);
      if (prop.name) entry.names.add(String(prop.name).trim().toLowerCase());
      allAssignedPropertyIds.push(prop.id);
    }

    // 2. Fetch units in assigned properties
    const agentUnitsMap = new Map<string, Set<string>>();
    if (allAssignedPropertyIds.length > 0) {
      const { data: units } = await adminClient
        .from("units")
        .select("id, property_id")
        .in("property_id", allAssignedPropertyIds);

      for (const unit of units || []) {
        for (const [agentId, propData] of agentPropertiesMap.entries()) {
          if (propData.ids.has(unit.property_id)) {
            if (!agentUnitsMap.has(agentId)) agentUnitsMap.set(agentId, new Set());
            agentUnitsMap.get(agentId)!.add(unit.id);
          }
        }
      }
    }

    // 3. Fetch rental contracts
    let contractQuery = adminClient.from("rental_contracts").select("agent_id, tenant_id, tenant_name");
    if (requestedAgentId) {
      contractQuery = contractQuery.eq("agent_id", requestedAgentId);
    }
    const { data: contracts } = await contractQuery;
    const agentContractsMap = new Map<string, { tenantIds: Set<string>; tenantNames: Set<string> }>();
    for (const c of contracts || []) {
      if (!c.agent_id) continue;
      if (!agentContractsMap.has(c.agent_id)) {
        agentContractsMap.set(c.agent_id, { tenantIds: new Set(), tenantNames: new Set() });
      }
      const entry = agentContractsMap.get(c.agent_id)!;
      if (c.tenant_id) entry.tenantIds.add(c.tenant_id);
      if (c.tenant_name) entry.tenantNames.add(String(c.tenant_name).trim().toLowerCase());
    }

    // 4. Fetch chat messages
    let chatQuery = adminClient.from("chat_messages").select("agent_id, sender_email");
    if (requestedAgentId) {
      chatQuery = chatQuery.eq("agent_id", requestedAgentId);
    }
    const { data: chats } = await chatQuery;
    const agentChatsMap = new Map<string, Set<string>>();
    for (const chat of chats || []) {
      if (!chat.agent_id || !chat.sender_email) continue;
      if (!agentChatsMap.has(chat.agent_id)) agentChatsMap.set(chat.agent_id, new Set());
      agentChatsMap.get(chat.agent_id)!.add(String(chat.sender_email).trim().toLowerCase());
    }

    // 5. Fetch direct messages
    const { data: directMessages } = await adminClient
      .from("messages")
      .select("sender_id, receiver_id");
    const agentDirectMessagesMap = new Map<string, Set<string>>();
    for (const msg of directMessages || []) {
      if (msg.sender_id && msg.receiver_id) {
        if (!agentDirectMessagesMap.has(msg.sender_id)) agentDirectMessagesMap.set(msg.sender_id, new Set());
        agentDirectMessagesMap.get(msg.sender_id)!.add(msg.receiver_id);

        if (!agentDirectMessagesMap.has(msg.receiver_id)) agentDirectMessagesMap.set(msg.receiver_id, new Set());
        agentDirectMessagesMap.get(msg.receiver_id)!.add(msg.sender_id);
      }
    }

    const result: Record<string, { totalAssisted: number; tenants: AssistedTenantInfo[] }> = {};

    for (const agentId of allAgentIds) {
      const propData = agentPropertiesMap.get(agentId);
      const unitIds = agentUnitsMap.get(agentId) || new Set();
      const contractData = agentContractsMap.get(agentId);
      const chatEmails = agentChatsMap.get(agentId) || new Set();
      const directPartners = agentDirectMessagesMap.get(agentId) || new Set();

      const assistedList: AssistedTenantInfo[] = [];

      for (const tenant of allTenants) {
        let assistReason: string | null = null;

        if ((tenant as any).assignedAgentId === agentId || (tenant as any).assigned_agent_id === agentId) {
          assistReason = "Agent Assignment";
        } else if (tenant.createdBy === agentId) {
          assistReason = "Registered Client";
        } else if (tenant.unitId && unitIds.has(tenant.unitId)) {
          assistReason = tenant.propertyName ? `Assigned to ${tenant.propertyName}` : "Assigned Unit";
        } else if (tenant.propertyName && propData?.names.has(String(tenant.propertyName).trim().toLowerCase())) {
          assistReason = `Property: ${tenant.propertyName}`;
        } else if (allAgentIds.length === 1 && (tenant.unitId || tenant.propertyName || tenant.assignmentStatus === "pending")) {
          assistReason = tenant.propertyName ? `Managed Property (${tenant.propertyName})` : "Pending Assignment Review";
        } else if (
          (contractData && tenant.id && contractData.tenantIds.has(tenant.id)) ||
          (contractData && tenant.name && contractData.tenantNames.has(String(tenant.name).trim().toLowerCase()))
        ) {
          assistReason = "Rental Contract";
        } else if (tenant.email && chatEmails.has(String(tenant.email).trim().toLowerCase())) {
          assistReason = "Client Inquiry";
        } else if (directPartners.has(tenant.id)) {
          assistReason = "Direct Contact";
        }

        if (assistReason) {
          assistedList.push({
            id: tenant.id,
            name: tenant.name,
            email: tenant.email,
            phone: tenant.phone || undefined,
            propertyName: tenant.propertyName || undefined,
            unitNumber: tenant.unitNumber || undefined,
            status: tenant.status || "active",
            assignmentStatus: tenant.assignmentStatus || undefined,
            rentAmount: tenant.rentAmount || undefined,
            contractStart: tenant.contractStart || undefined,
            contractEnd: tenant.contractEnd || undefined,
            assistReason,
            createdAt: tenant.createdAt || undefined,
            avatarUrl: tenant.avatarUrl || null,
          });
        }
      }

      result[agentId] = {
        totalAssisted: assistedList.length,
        tenants: assistedList.map((t) => sanitizeResponse(t)),
      };
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Fetch assisted tenants error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch assisted tenants" }, { status: 500 });
  }
}
