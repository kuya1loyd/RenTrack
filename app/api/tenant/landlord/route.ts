import { NextRequest, NextResponse } from "next/server";
import { findUserById, getAdminSupabase, initDatabase } from "@/lib/db";
import { requireRole } from "@/lib/api-security";
import { loadMoveOutContext } from "@/lib/move-out-service";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["tenant"]);
    if (auth instanceof NextResponse) return auth;

    await initDatabase();
    const context = await loadMoveOutContext(auth);
    if (!context.unit?.property_id) {
      return NextResponse.json({
        success: false,
        error: context.tenancy.message || "A current assigned unit is required to find your landlord.",
      }, { status: 409 });
    }

    const { data: property, error: propertyError } = await getAdminSupabase()
      .from("properties")
      .select("created_by, agent_id")
      .eq("id", context.unit.property_id)
      .maybeSingle();
    if (propertyError) throw propertyError;
    if (!property?.created_by) {
      return NextResponse.json({ success: false, error: "The owner of your assigned property could not be resolved." }, { status: 404 });
    }

    let owner = await findUserById(property.created_by);
    if (owner?.role === "agent" && owner.createdBy) {
      owner = await findUserById(owner.createdBy);
    }
    if (owner?.role !== "owner" && property.agent_id && property.agent_id !== property.created_by) {
      const agent = await findUserById(property.agent_id);
      const assignedOwner = agent?.createdBy ? await findUserById(agent.createdBy) : null;
      if (assignedOwner?.role === "owner") owner = assignedOwner;
    }
    if (!owner || owner.role !== "owner") {
      return NextResponse.json({ success: false, error: "The owner of your assigned property could not be resolved." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      owner: {
        id: owner.id,
        name: owner.name || "Property Owner",
        email: owner.email || "",
        role: owner.role,
        ...(owner.avatarUrl ? { avatarUrl: owner.avatarUrl } : {}),
      },
    });
  } catch (error) {
    console.error("Resolve tenant landlord error:", error);
    return NextResponse.json({ success: false, error: "We could not find the owner of your assigned property. Please try again." }, { status: 500 });
  }
}
