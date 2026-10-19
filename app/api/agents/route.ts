import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, getProperties, initDatabase } from "@/lib/db";
import { withSecurityHeaders, withCorsHeaders } from "@/lib/api-security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await initDatabase();
    // This endpoint is used by the public landing-page contact/chat forms and tenant directory.
    // Return only the fields a visitor needs; never expose account secrets.
    const [users, properties] = await Promise.all([
      getAllUsers().catch(() => []),
      getProperties().catch(() => []),
    ]);

    const agents = users.filter((u: any) => u.role === "agent");

    // Map any properties assigned to an agent to their location
    const agentLocationMap = new Map<string, string>();
    for (const p of properties) {
      const pAgentId = p.agentId || p.agent_id;
      if (pAgentId && !agentLocationMap.has(pAgentId) && (p.location || p.city)) {
        agentLocationMap.set(pAgentId, p.location || p.city);
      }
    }

    const safeAgents = agents.map((u: any) => {
      const explicitLoc = (u.address || u.location || "").trim();
      const derivedLoc = explicitLoc || agentLocationMap.get(u.id) || "Cebu, Philippines";
      return {
        id: u.id,
        name: u.name,
        role: "agent",
        email: u.email,
        phone: u.phone || "",
        experience: u.experience || "",
        avatarUrl: typeof u.avatarUrl === "string" ? u.avatarUrl : null,
        location: derivedLoc,
        address: explicitLoc || derivedLoc,
        createdAt: typeof (u.createdAt || u.created_at) === "string" ? (u.createdAt || u.created_at) : null,
      };
    });
    const response = NextResponse.json({ success: true, users: safeAgents });
    return withSecurityHeaders(withCorsHeaders(request, response));
  } catch (error) {
    console.warn("Agents unavailable:", error instanceof Error ? error.message : error);
    const response = NextResponse.json({ success: false, users: [], degraded: true }, { status: 503 });
    return withSecurityHeaders(withCorsHeaders(request, response));
  }
}
