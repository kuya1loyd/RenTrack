import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase, initDatabase } from "@/lib/db";
import { requireRole } from "@/lib/api-security";
import { canApproveMoveOut, parseMoveOutReview, type MoveOutRequestRow } from "@/lib/move-out-policy";
import { getMoveOutManagementUnitIds, getMoveOutReviewIdentityIds, moveOutReviewSql } from "@/lib/move-out-service";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(request, ["admin", "owner"]);
    if (auth instanceof NextResponse) return auth;
    const { id: routeId } = await context.params;
    const body = await request.json().catch(() => ({}));
    await initDatabase();
    const client = getAdminSupabase();

    // Check for archive / unarchive actions
    if (body.action === "archive" || body.status === "archived") {
      const { data: updated, error: archError } = await client
        .from("move_out_requests")
        .update({ is_archived: true, status: "archived" })
        .eq("id", routeId)
        .select("*")
        .single();
      if (archError) throw archError;
      return NextResponse.json({ success: true, request: updated });
    }
    if (body.action === "unarchive") {
      const { data: updated, error: unarchError } = await client
        .from("move_out_requests")
        .update({ is_archived: false, status: "pending" })
        .eq("id", routeId)
        .select("*")
        .single();
      if (unarchError) throw unarchError;
      return NextResponse.json({ success: true, request: updated });
    }

    let action;
    try {
      action = parseMoveOutReview(routeId, body);
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof SyntaxError ? "Invalid request JSON" : error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
    }
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
      let isAuthorized = false;
      if (unit && (unit as any).created_by === auth.userId) {
        isAuthorized = true;
      }
      if (!isAuthorized && unit?.property_id) {
        const { data: property, error: propertyError } = await client.from("properties").select("created_by, agent_id").eq("id", unit.property_id).maybeSingle();
        if (propertyError) throw propertyError;
        if (property?.created_by === auth.userId) {
          isAuthorized = true;
        } else if (property?.agent_id) {
          const { data: agentUser } = await client.schema("public").from("users").select("created_by").eq("id", property.agent_id).maybeSingle();
          if (agentUser?.created_by === auth.userId) isAuthorized = true;
        }
      }
      if (!isAuthorized && moveOutRequest.unit_id) {
        const managedUnitIds = await getMoveOutManagementUnitIds(auth);
        if (managedUnitIds.includes(moveOutRequest.unit_id)) {
          isAuthorized = true;
        }
      }
      if (!isAuthorized && tenant) {
        const { data: tenantRecord } = await client.from("tenants").select("created_by").eq("id", tenant.id).maybeSingle();
        if (tenantRecord?.created_by === auth.userId) isAuthorized = true;
      }
      if (!isAuthorized) {
        const { data: ownerUser } = await client.schema("public").from("users").select("role").eq("id", auth.userId).maybeSingle();
        if (ownerUser?.role === "owner") isAuthorized = true;
      }
      if (!isAuthorized) return NextResponse.json({ success: false, error: "You can only review requests for your properties" }, { status: 403 });
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
    if (action.status === "approved") {
      try {
        if (moveOutRequest.unit_id) {
          await client.from("units").update({ status: "vacant", tenant_id: null, tenant_name: null }).eq("id", moveOutRequest.unit_id);
        }
        if (moveOutRequest.tenant_id) {
          await client.from("tenants").update({
            status: "inactive",
            unit_id: null,
            property_name: null,
            unit_number: null,
            assignment_status: "",
            rent_amount: 0,
          }).eq("id", moveOutRequest.tenant_id);
        }
      } catch (directUpdateErr) {
        console.warn("Direct move-out update warning:", directUpdateErr);
      }
    }
    const { data: updatedRequest, error: updatedError } = await client.from("move_out_requests").select("*").eq("id", action.id).single();
    if (updatedError) throw updatedError;
    return NextResponse.json({ success: true, request: updatedRequest });
  } catch (error) {
    console.error("Review move-out request error:", error);
    return NextResponse.json({ success: false, error: "Failed to review move-out request" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(request, ["admin", "owner"]);
    if (auth instanceof NextResponse) return auth;
    const { id: routeId } = await context.params;
    await initDatabase();
    const client = getAdminSupabase();

    const { data: moveOutRequest, error: fetchError } = await client
      .from("move_out_requests")
      .select("*")
      .eq("id", routeId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!moveOutRequest) {
      return NextResponse.json({ success: false, error: "Move-out request not found" }, { status: 404 });
    }

    if (auth.user.role === "owner") {
      let isAuthorized = false;
      if (moveOutRequest.unit_id) {
        const managedUnitIds = await getMoveOutManagementUnitIds(auth);
        if (managedUnitIds.includes(moveOutRequest.unit_id)) isAuthorized = true;
      }
      if (!isAuthorized && moveOutRequest.tenant_id) {
        const { data: tenant } = await client.from("tenants").select("created_by").eq("id", moveOutRequest.tenant_id).maybeSingle();
        if (tenant?.created_by === auth.userId) isAuthorized = true;
      }
      if (!isAuthorized) {
        const { data: ownerUser } = await client.schema("public").from("users").select("role").eq("id", auth.userId).maybeSingle();
        if (ownerUser?.role === "owner") isAuthorized = true;
      }
      if (!isAuthorized) {
        return NextResponse.json({ success: false, error: "You can only delete requests for your properties" }, { status: 403 });
      }
    }

    const { error: deleteError } = await client.from("move_out_requests").delete().eq("id", routeId);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true, message: "Move-out request deleted successfully" });
  } catch (error) {
    console.error("Delete move-out request error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete move-out request" }, { status: 500 });
  }
}
