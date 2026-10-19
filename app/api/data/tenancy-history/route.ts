import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase, getProperties, initDatabase, snakeToCamel } from "@/lib/db";
import { requireRole } from "@/lib/api-security";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "owner"]);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const unitId = searchParams.get("unitId");
    const propertyId = searchParams.get("propertyId");

    await initDatabase();
    const client = getAdminSupabase();
    let query = client.from("tenancy_history").select("*").order("start_date", { ascending: false });
    if (unitId) query = query.eq("unit_id", unitId);
    if (propertyId) query = query.eq("property_id", propertyId);

    if (auth.user.role === "owner") {
      const properties = await getProperties();
      const ownedIds = properties.filter((p: any) => p.createdBy === auth.userId).map((p: any) => p.id);
      if (ownedIds.length === 0) return NextResponse.json({ success: true, history: [] });
      query = query.in("property_id", ownedIds);
    }

    const { data, error } = await query.limit(500);
    if (error) throw error;
    return NextResponse.json({ success: true, history: (data || []).map((row: any) => snakeToCamel(row)) });
  } catch (error) {
    console.error("Tenancy history error:", error);
    return NextResponse.json({ success: true, history: [], degraded: true });
  }
}
