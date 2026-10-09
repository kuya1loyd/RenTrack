import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AGENT_BADGES, getAgentBadge } from "@/lib/agent-badges";
import { ensureAgentProfileTables, getPublicRentManager } from "@/lib/agent-profile-api";
import { getAdminSupabase } from "@/lib/db";
import { requireRole, validateApiRequest, withRateLimit, withSecurityHeaders } from "@/lib/api-security";

type RouteContext = { params: Promise<{ id: string }> };

function json(body: Record<string, unknown>, status = 200) {
  return withSecurityHeaders(NextResponse.json(body, { status }));
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    await ensureAgentProfileTables();
    if (!await getPublicRentManager(id)) return json({ success: false, error: "Rent Manager not found" }, 404);

    const { data, error } = await getAdminSupabase()
      .from("agent_badges")
      .select("badge_key, awarded_at")
      .eq("agent_id", id)
      .order("awarded_at", { ascending: false });
    if (error) throw error;

    const badges = (data || []).flatMap((row) => {
      const catalogEntry = getAgentBadge(row.badge_key);
      return catalogEntry ? [{ ...catalogEntry, awardedAt: row.awarded_at }] : [];
    });
    return json({ success: true, badges });
  } catch (error) {
    console.error("Get agent badges error:", error);
    return json({ success: false, error: "Could not load Rent Manager achievements" }, 500);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireRole(request, ["owner"]);
    if (auth instanceof NextResponse) return auth;
    const validationError = validateApiRequest(request);
    if (validationError) return validationError;
    const rateLimit = await withRateLimit(request, `owner_agent_badge:${auth.userId}`);
    if (rateLimit) return rateLimit;

    const { id } = await params;
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ success: false, error: "Choose a badge to award" }, 400);
    }
    const badgeKey = (body as Record<string, unknown>).badgeKey;
    if (typeof badgeKey !== "string" || !getAgentBadge(badgeKey)) {
      return json({ success: false, error: "Choose a valid RentTrack badge" }, 400);
    }

    await ensureAgentProfileTables();
    const client = getAdminSupabase();
    const { data: agent, error: agentError } = await client
      .from("users")
      .select("id, role, created_by")
      .eq("id", id)
      .maybeSingle();
    if (agentError) throw agentError;
    if (!agent || agent.role !== "agent" || agent.created_by !== auth.userId) {
      return json({ success: false, error: "You can only award badges to agents you manage" }, 403);
    }

    const { error } = await client.from("agent_badges").upsert({
      id: randomUUID(),
      agent_id: id,
      badge_key: badgeKey,
      awarded_by: auth.userId,
      awarded_at: new Date().toISOString(),
    }, { onConflict: "agent_id,badge_key", ignoreDuplicates: true });
    if (error) throw error;
    return json({ success: true, badge: getAgentBadge(badgeKey) });
  } catch (error) {
    console.error("Award agent badge error:", error);
    return json({ success: false, error: "Could not award this badge" }, 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireRole(request, ["owner"]);
    if (auth instanceof NextResponse) return auth;
    const validationError = validateApiRequest(request);
    if (validationError) return validationError;
    const rateLimit = await withRateLimit(request, `owner_agent_badge:${auth.userId}`);
    if (rateLimit) return rateLimit;

    const { id } = await params;
    const body: unknown = await request.json().catch(() => null);
    const badgeKey = body && typeof body === "object" ? (body as Record<string, unknown>).badgeKey : null;
    if (typeof badgeKey !== "string" || !AGENT_BADGES.some((badge) => badge.key === badgeKey)) {
      return json({ success: false, error: "Choose a valid RentTrack badge" }, 400);
    }

    await ensureAgentProfileTables();
    const client = getAdminSupabase();
    const { data: agent, error: agentError } = await client
      .from("users")
      .select("id, role, created_by")
      .eq("id", id)
      .maybeSingle();
    if (agentError) throw agentError;
    if (!agent || agent.role !== "agent" || agent.created_by !== auth.userId) {
      return json({ success: false, error: "You can only manage badges for agents you manage" }, 403);
    }

    const { error } = await client.from("agent_badges").delete().eq("agent_id", id).eq("badge_key", badgeKey);
    if (error) throw error;
    return json({ success: true });
  } catch (error) {
    console.error("Remove agent badge error:", error);
    return json({ success: false, error: "Could not remove this badge" }, 500);
  }
}
