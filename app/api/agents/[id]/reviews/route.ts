import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureAgentProfileTables, getPublicRentManager } from "@/lib/agent-profile-api";
import { getAdminSupabase, findUserById } from "@/lib/db";
import { getSessionUserId } from "@/lib/security";
import { requireRole, validateApiRequest, withRateLimit, withSecurityHeaders } from "@/lib/api-security";

type RouteContext = { params: Promise<{ id: string }> };

function json(body: Record<string, unknown>, status = 200) {
  return withSecurityHeaders(NextResponse.json(body, { status }));
}

async function findTenantInquiry(agentId: string, tenantId: string) {
  const { data, error } = await getAdminSupabase()
    .from("chat_messages")
    .select("id")
    .eq("agent_id", agentId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    await ensureAgentProfileTables();
    if (!await getPublicRentManager(id)) return json({ success: false, error: "Rent Manager not found" }, 404);

    const client = getAdminSupabase();
    const { data: reviews, error } = await client
      .from("agent_reviews")
      .select("id, tenant_id, rating, comment, created_at")
      .eq("agent_id", id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const tenantIds = [...new Set((reviews || []).map((review) => review.tenant_id))];
    const namesByTenantId = new Map<string, string>();
    if (tenantIds.length > 0) {
      const { data: tenants, error: tenantsError } = await client.from("users").select("id, name").in("id", tenantIds);
      if (tenantsError) throw tenantsError;
      for (const tenant of tenants || []) namesByTenantId.set(tenant.id, tenant.name);
    }

    let canReview = false;
    let alreadyReviewed = false;
    const sessionUserId = getSessionUserId(request);
    if (sessionUserId) {
      const tenant = await findUserById(sessionUserId);
      if (tenant?.role === "tenant") {
        alreadyReviewed = (reviews || []).some((review) => review.tenant_id === sessionUserId);
        if (!alreadyReviewed) canReview = Boolean(await findTenantInquiry(id, sessionUserId));
      }
    }

    return json({
      success: true,
      reviews: (reviews || []).map((review) => {
        const fullName = namesByTenantId.get(review.tenant_id) || "RentTrack tenant";
        const [firstName, ...lastNames] = fullName.trim().split(/\s+/);
        const reviewer = lastNames.length ? `${firstName} ${lastNames[lastNames.length - 1][0]}.` : firstName;
        return { rating: review.rating, comment: review.comment, createdAt: review.created_at, reviewer };
      }),
      canReview,
      alreadyReviewed,
    });
  } catch (error) {
    console.error("Get Rent Manager reviews error:", error);
    return json({ success: false, error: "Could not load Rent Manager reviews" }, 500);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireRole(request, ["tenant"]);
    if (auth instanceof NextResponse) return auth;
    const validationError = validateApiRequest(request);
    if (validationError) return validationError;
    const rateLimit = await withRateLimit(request, `tenant_agent_review:${auth.userId}`);
    if (rateLimit) return rateLimit;

    const { id } = await params;
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ success: false, error: "Enter a rating and review" }, 400);
    }
    const input = body as Record<string, unknown>;
    const rating = input.rating;
    const comment = typeof input.comment === "string" ? input.comment.trim() : "";
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return json({ success: false, error: "Choose a rating from 1 to 5 stars" }, 400);
    }
    if (!comment || comment.length > 1000) {
      return json({ success: false, error: "Write a review of 1 to 1,000 characters" }, 400);
    }

    await ensureAgentProfileTables();
    if (!await getPublicRentManager(id)) return json({ success: false, error: "Rent Manager not found" }, 404);
    if (!auth.user.email) return json({ success: false, error: "Your account needs an email address before you can review" }, 400);

    const client = getAdminSupabase();
    const { data: existing, error: existingError } = await client
      .from("agent_reviews")
      .select("id")
      .eq("agent_id", id)
      .eq("tenant_id", auth.userId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return json({ success: false, error: "You have already reviewed this Rent Manager" }, 409);

    const inquiry = await findTenantInquiry(id, auth.userId);
    if (!inquiry) {
      return json({ success: false, error: "You can review this Rent Manager after you have sent them an inquiry" }, 403);
    }

    const { data: review, error } = await client.from("agent_reviews").insert({
      id: `arev_${randomUUID()}`,
      agent_id: id,
      tenant_id: auth.userId,
      inquiry_id: inquiry.id,
      rating,
      comment,
      created_at: new Date().toISOString(),
    }).select("rating, comment, created_at").single();
    if (error) {
      if (error.code === "23505") return json({ success: false, error: "You have already reviewed this Rent Manager" }, 409);
      throw error;
    }

    return json({ success: true, review: { ...review, reviewer: auth.user.name } }, 201);
  } catch (error) {
    console.error("Submit Rent Manager review error:", error);
    return json({ success: false, error: "Could not submit your review" }, 500);
  }
}
