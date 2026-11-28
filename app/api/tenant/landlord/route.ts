import { NextRequest, NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import { requireRole } from "@/lib/api-security";
import { resolveTenantManager } from "@/lib/move-out-service";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["tenant"]);
    if (auth instanceof NextResponse) return auth;

    await initDatabase();
    const management = await resolveTenantManager(auth);

    if (!management.owner && !management.agent && !management.manager) {
      return NextResponse.json({
        success: false,
        error: "The owner or manager of your assigned property could not be resolved.",
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      owner: management.owner,
      agent: management.agent,
      manager: management.manager,
    });
  } catch (error) {
    console.error("Resolve tenant landlord error:", error);
    return NextResponse.json({ success: false, error: "We could not find the owner of your assigned property. Please try again." }, { status: 500 });
  }
}
