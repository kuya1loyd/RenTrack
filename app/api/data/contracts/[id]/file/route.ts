import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase, getUpload, ensureRentalContractsSchema } from "@/lib/db";
import { requireRole } from "@/lib/api-security";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(request, ["admin", "owner", "agent", "tenant"]);
    if (auth instanceof NextResponse) return auth;
    await ensureRentalContractsSchema();
    const { id } = await params;
    const admin = getAdminSupabase();

    const { data: contract, error } = await admin
      .from("rental_contracts")
      .select("id, owner_id, agent_id, tenant_id, property_id, file_upload_id, file_name, file_mime_type, status")
      .eq("id", id)
      .eq("status", "sent")
      .maybeSingle();

    if (error) throw error;
    if (!contract || !contract.file_upload_id) {
      return NextResponse.json({ success: false, error: "Contract file not found" }, { status: 404 });
    }

    // Verify permission
    let authorized = auth.user.role === "admin";
    if (!authorized && auth.user.role === "owner") {
      authorized = contract.owner_id === auth.userId;
      if (!authorized && contract.property_id) {
        const { data: prop } = await admin.from("properties").select("created_by").eq("id", contract.property_id).maybeSingle();
        if (prop?.created_by === auth.userId) authorized = true;
      }
    } else if (!authorized && auth.user.role === "agent") {
      authorized = contract.agent_id === auth.userId;
      if (!authorized && contract.property_id) {
        const { data: prop } = await admin.from("properties").select("agent_id").eq("id", contract.property_id).maybeSingle();
        if (prop?.agent_id === auth.userId) authorized = true;
      }
    } else if (!authorized && auth.user.role === "tenant") {
      if (contract.tenant_id === auth.userId) {
        authorized = true;
      } else {
        const { data: tenantRecords } = await admin.from("tenants").select("id").or(`id.eq.${auth.userId},email.ilike.${auth.user.email}`);
        const matchingIds = (tenantRecords || []).map((t: any) => t.id);
        if (matchingIds.includes(contract.tenant_id)) authorized = true;
      }
    }

    if (!authorized) {
      return NextResponse.json({ success: false, error: "You do not have access to this contract file" }, { status: 403 });
    }

    const upload = await getUpload(contract.file_upload_id);
    if (!upload?.data || upload.data.length === 0) {
      return NextResponse.json({ success: false, error: "Contract file data could not be retrieved" }, { status: 404 });
    }

    const name = String(contract.file_name || "rental-contract").replace(/[\r\n"\\]/g, "_");
    return new NextResponse(Buffer.from(upload.data), {
      headers: {
        "Content-Type": contract.file_mime_type || upload.mime_type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Download rental contract error:", error);
    return NextResponse.json({ success: false, error: "Could not download this contract" }, { status: 500 });
  }
}
