import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase, getUpload, ensureRentalContractsSchema } from "@/lib/db";
import { requireRole } from "@/lib/api-security";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(request, ["owner", "agent", "tenant"]);
    if (auth instanceof NextResponse) return auth;
    await ensureRentalContractsSchema();
    const { id } = await params;
    const field = auth.user.role === "owner" ? "owner_id" : auth.user.role === "agent" ? "agent_id" : "tenant_id";
    const { data: contract, error } = await getAdminSupabase()
      .from("rental_contracts")
      .select("id, file_upload_id, file_name, file_mime_type")
      .eq("id", id)
      .eq(field, auth.userId)
      .eq("status", "sent")
      .maybeSingle();
    if (error) throw error;
    if (!contract?.file_upload_id) return NextResponse.json({ success: false, error: "Contract file not found" }, { status: 404 });
    const upload = await getUpload(contract.file_upload_id);
    if (!upload?.data || upload.data.length === 0) return NextResponse.json({ success: false, error: "Contract file not found" }, { status: 404 });
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
