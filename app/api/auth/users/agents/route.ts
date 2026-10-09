import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, initDatabase } from "@/lib/db";
import { withSecurityHeaders, withCorsHeaders } from "@/lib/api-security";

export async function GET(request: NextRequest) {
  try {
    await initDatabase();
    // This endpoint is used by the public landing-page contact/chat forms.
    // Return only the fields a visitor needs; never expose account secrets.
    const users = await Promise.race([
      getAllUsers(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Agent lookup timed out")), 1500);
      }),
    ]);
    const ownerIds = new Set(users.filter((u: any) => u.role === "owner").map((u: any) => u.id));
    const agents = users.filter((u: any) => u.role === "agent" && u.createdBy && ownerIds.has(u.createdBy));
    const publicLocations = new Set(["Cebu", "Manila", "Davao", "Butuan"]);
    const safeAgents = agents.map((u: any) => ({
      id: u.id,
      name: u.name,
      role: "agent",
      email: u.email,
      phone: u.phone || "",
      experience: u.experience || "",
      avatarUrl: typeof u.avatarUrl === "string" ? u.avatarUrl : null,
      location: publicLocations.has(u.address) ? u.address : "",
      createdAt: typeof (u.createdAt || u.created_at) === "string" ? (u.createdAt || u.created_at) : null,
    }));
    const response = NextResponse.json({ success: true, users: safeAgents });
    return withSecurityHeaders(withCorsHeaders(request, response));
  } catch (error) {
    console.warn("Agents unavailable:", error instanceof Error ? error.message : error);
    // Distinguish an unavailable directory from a successfully loaded empty one.
    const response = NextResponse.json({ success: false, users: [], degraded: true }, { status: 503 });
    return withSecurityHeaders(withCorsHeaders(request, response));
  }
}
