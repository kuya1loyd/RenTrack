import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase, initDatabase } from "@/lib/db";
import { requireRole } from "@/lib/api-security";
import { findPendingMoveOut, normalizeMoveOutReason, type MoveOutRequestRow } from "@/lib/move-out-policy";
import { getMoveOutManagementUnitIds, loadMoveOutContext, moveOutSubmissionId } from "@/lib/move-out-service";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["tenant", "admin", "owner", "agent"]);
    if (auth instanceof NextResponse) return auth;
    await initDatabase();
    const { searchParams } = new URL(request.url);
    let query = getAdminSupabase().from("move_out_requests").select("*");
    let tenancy;
    if (auth.user.role === "tenant") {
      const context = await loadMoveOutContext(auth);
      // Tenant-controlled query parameters cannot broaden their history.
      query = query.in("tenant_id", context.identityIds);
      tenancy = context.tenancy;
    } else {
      if (auth.user.role !== "admin") {
        const unitIds = await getMoveOutManagementUnitIds(auth);
        if (!unitIds.length) return NextResponse.json({ success: true, requests: [] });
        query = query.in("unit_id", unitIds);
      }
      const tenantId = searchParams.get("tenantId");
      if (tenantId) query = query.eq("tenant_id", tenantId);
    }
    const status = searchParams.get("status");
    if (status && !["pending", "approved", "rejected"].includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid request status" }, { status: 400 });
    }
    if (status) query = query.eq("status", status);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ success: true, requests: data || [], ...(tenancy ? { tenancy } : {}) });
  } catch (error) {
    console.error("Get move-out requests error:", error);
    return NextResponse.json({ success: false, error: "We could not load your tenancy and move-out requests. Please try again." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["tenant"]);
    if (auth instanceof NextResponse) return auth;
    let reason: string;
    try {
      const body: unknown = await request.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid request");
      reason = normalizeMoveOutReason((body as Record<string, unknown>).reason);
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof SyntaxError ? "Invalid request JSON" : error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
    }
    await initDatabase();
    const context = await loadMoveOutContext(auth);
    if (!context.tenancy.eligible || !context.tenant || !context.unit) {
      return NextResponse.json({ success: false, error: context.tenancy.message, tenancy: context.tenancy }, { status: 409 });
    }
    const client = getAdminSupabase();
    const { data: history, error: historyError } = await client.from("move_out_requests").select("*")
      .in("tenant_id", context.identityIds).order("created_at", { ascending: false }).order("id", { ascending: false });
    if (historyError) throw historyError;
    const pending = findPendingMoveOut((history || []) as MoveOutRequestRow[], context.identityIds);
    if (pending) return NextResponse.json({ success: false, error: "You already have a move-out request awaiting review.", request: pending }, { status: 409 });
    const { data: moveOutRequest, error } = await client.from("move_out_requests").insert({
      id: moveOutSubmissionId(context.tenant.id, context.unit.id, history?.[0]?.id),
      tenant_id: context.tenant.id,
      tenant_name: context.tenant.name,
      unit_id: context.unit.id,
      property_name: context.tenancy.tenant?.propertyName,
      reason,
      status: "pending",
    }).select("*").single();
    if (error?.code === "23505") {
      const { data: existing, error: duplicateError } = await client.from("move_out_requests").select("*")
        .in("tenant_id", context.identityIds).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (duplicateError) throw duplicateError;
      return NextResponse.json({ success: false, error: "You already have a move-out request awaiting review.", ...(existing ? { request: existing } : {}) }, { status: 409 });
    }
    if (error) throw error;

    try {
      const { getAllUsers, createNotification } = await import("@/lib/db");
      const users = await getAllUsers();
      const adminRecipients = users.filter((u: any) => ["admin", "owner"].includes(u.role));
      const tenantName = context.tenant.name || auth.user?.name || "A tenant";
      for (const admin of adminRecipients) {
        await createNotification({
          userId: admin.id,
          title: "New Move-Out Request",
          message: `${tenantName} submitted a move-out request for ${context.tenancy.tenant?.propertyName || "their unit"}.`,
          type: "system",
        });
      }
    } catch (notifErr) {
      console.error("Failed to notify admins of move-out request:", notifErr);
    }

    return NextResponse.json({ success: true, request: moveOutRequest }, { status: 201 });
  } catch (error) {
    console.error("Create move-out request error:", error);
    return NextResponse.json({ success: false, error: "We could not submit your move-out request. Please try again." }, { status: 500 });
  }
}
