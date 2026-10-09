import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase, initDatabase } from "@/lib/db";
import { requireRole } from "@/lib/api-security";
import { canApproveMoveOut, parseMoveOutReview, type MoveOutRequestRow } from "@/lib/move-out-policy";
import { getMoveOutReviewIdentityIds, moveOutReviewSql } from "@/lib/move-out-service";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(request, ["admin", "owner"]);
    if (auth instanceof NextResponse) return auth;
    const { id: routeId } = await context.params;
    let action;
    try {
      action = parseMoveOutReview(routeId, await request.json());
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof SyntaxError ? "Invalid request JSON" : error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
    }
    await initDatabase();
    const client = getAdminSupabase();
    const { data: moveOutRequest, error: fetchError } = await client.from("move_out_requests").select("*").eq("id", action.id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!moveOutRequest) return NextResponse.json({ success: false, error: "Move-out request not found" }, { status: 404 });
    if (moveOutRequest.status !== "pending") return NextResponse.json({ success: false, error: "This request has already been reviewed" }, { status: 409 });
    const [{ data: tenant, error: tenantError }, { data: unit, error: unitError }] = await Promise.all([
      client.from("tenants").select("id, name, email, unit_id, status, assignment_status").eq("id", moveOutRequest.tenant_id).maybeSingle(),
      client.from("units").select("id, property_id, status, tenant_id").eq("id", moveOutRequest.unit_id || "").maybeSingle(),
    ]);
    if (tenantError) throw tenantError;
    if (unitError) throw unitError;
    if (auth.user.role === "owner") {
      const { data: property, error: propertyError } = await client.from("properties").select("created_by").eq("id", unit?.property_id || "").maybeSingle();
      if (propertyError) throw propertyError;
      if (property?.created_by !== auth.userId) return NextResponse.json({ success: false, error: "You can only review requests for your properties" }, { status: 403 });
    }
    const identityIds = tenant ? await getMoveOutReviewIdentityIds(tenant) : [];
    if (action.status === "approved" && (!tenant || !canApproveMoveOut(moveOutRequest as MoveOutRequestRow, tenant, identityIds, unit))) {
      return NextResponse.json({ success: false, error: "The current unit assignment has changed. Check the tenancy before approving this request." }, { status: 409 });
    }
    // Lock and recheck all affected rows, then update the tenancy and request in
    // one transaction. A reassigned unit must never be vacated by an old request.
    const { error: reviewError } = await client.rpc("exec_sql", { sql: moveOutReviewSql({
      ...action, reviewerId: auth.userId,
      ownerId: auth.user.role === "owner" ? auth.userId : null,
      tenantIdentityIds: identityIds,
    }), params: [] });
    if (reviewError) {
      const status = reviewError.code === "40001" ? 409 : reviewError.code === "42501" ? 403 : reviewError.code === "P0002" ? 404 : 500;
      if (status !== 500) return NextResponse.json({ success: false, error: reviewError.message }, { status });
      throw reviewError;
    }
    const { data: updatedRequest, error: updatedError } = await client.from("move_out_requests").select("*").eq("id", action.id).single();
    if (updatedError) throw updatedError;
    return NextResponse.json({ success: true, request: updatedRequest });
  } catch (error) {
    console.error("Review move-out request error:", error);
    return NextResponse.json({ success: false, error: "Failed to review move-out request" }, { status: 500 });
  }
}
