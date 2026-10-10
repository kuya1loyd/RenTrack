import { NextRequest, NextResponse } from "next/server";
import {
  findUserById,
  getPayments,
  getProperties,
  getTenants,
  getUnits,
  getAdminSupabase,
  initDatabase,
} from "@/lib/db";
import { requireAuth, withSecurityHeaders } from "@/lib/api-security";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const allowedRoles = ["admin", "owner", "agent", "tenant"];
    if (!allowedRoles.includes(auth.user.role)) {
      return withSecurityHeaders(NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 }));
    }

    await initDatabase();
    const [allProperties, allUnits, allTenants, payments] = await Promise.all([
      getProperties(),
      getUnits(),
      auth.user.role === "tenant" ? getTenants() : Promise.resolve([]),
      auth.user.role === "tenant" ? Promise.resolve([]) : getPayments(),
    ]);

    let properties = allProperties;
    if (auth.user.role === "owner") {
      properties = allProperties.filter((property: any) => property.createdBy === auth.userId);
    } else if (auth.user.role === "agent") {
      const agent = await findUserById(auth.userId);
      properties = allProperties.filter((property: any) =>
        property.agentId === auth.userId || (agent?.createdBy && property.createdBy === agent.createdBy)
      );
    } else if (auth.user.role === "tenant") {
      const tenant = allTenants.find((record: any) => record.id === auth.userId);
      const assignedUnit = allUnits.find((unit: any) => unit.id === tenant?.unitId);
      properties = assignedUnit
        ? allProperties.filter((property: any) => property.id === assignedUnit.propertyId)
        : [];
    }

    const unitsByProperty = new Map<string, any[]>();
    for (const unit of allUnits) {
      const propertyUnits = unitsByProperty.get(unit.propertyId) || [];
      propertyUnits.push(unit);
      unitsByProperty.set(unit.propertyId, propertyUnits);
    }

    const propertyByUnitId = new Map(allUnits.map((unit: any) => [unit.id, unit.propertyId]));

    const PHILIPPINE_CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
      butuan: { lat: 8.9475, lng: 125.5406 },
      cebu: { lat: 10.3157, lng: 123.8854 },
      manila: { lat: 14.5995, lng: 120.9842 },
      davao: { lat: 7.1907, lng: 125.4553 },
      makati: { lat: 14.5547, lng: 121.0244 },
      quezon: { lat: 14.6760, lng: 121.0437 },
      taguig: { lat: 14.5176, lng: 121.0509 },
      pasig: { lat: 14.5764, lng: 121.0851 },
      mandaluyong: { lat: 14.5794, lng: 121.0359 },
    };

    function resolveFallbackCoordinates(loc?: string): { lat: number; lng: number } {
      const lower = String(loc || "").toLowerCase();
      for (const [city, coords] of Object.entries(PHILIPPINE_CITY_COORDINATES)) {
        if (lower.includes(city)) return coords;
      }
      return PHILIPPINE_CITY_COORDINATES.butuan;
    }

    const mappedProperties = properties.map((property: any) => {
      let lat = property.latitude !== null && property.latitude !== undefined && Number.isFinite(Number(property.latitude))
        ? Number(property.latitude)
        : null;
      let lng = property.longitude !== null && property.longitude !== undefined && Number.isFinite(Number(property.longitude))
        ? Number(property.longitude)
        : null;

      // If missing coordinates, fallback to known location and persist in background
      if (lat === null || lng === null) {
        const fallback = resolveFallbackCoordinates(property.location);
        lat = fallback.lat;
        lng = fallback.lng;

        // Persist coordinates to database in the background
        void (async () => {
          try {
            await getAdminSupabase()
              .from("properties")
              .update({ latitude: lat, longitude: lng })
              .eq("id", property.id);
          } catch {
            // ignore background update error
          }
        })();
      }

      const propertyUnits = unitsByProperty.get(property.id) || [];
      const occupiedUnits = propertyUnits.length
        ? propertyUnits.filter((unit) => unit.status === "occupied").length
        : Number(property.occupiedUnits || 0);
      const totalUnits = propertyUnits.length || Number(property.units || 0);
      const availableUnits = propertyUnits.length
        ? propertyUnits.filter((unit) => unit.status === "vacant").length
        : Math.max(totalUnits - occupiedUnits, 0);
      const outstandingReceivables = payments.reduce((total: number, payment: any) => {
        const paymentPropertyId = propertyByUnitId.get(payment.unitId) ||
          allProperties.find((candidate: any) => candidate.name === payment.propertyName)?.id;
        const balance = Number(payment.balance || 0);
        return paymentPropertyId === property.id && payment.status !== "paid" && balance > 0
          ? total + balance
          : total;
      }, 0);

      return {
        id: property.id,
        name: property.name,
        type: property.type,
        address: property.location,
        latitude: lat,
        longitude: lng,
        totalUnits,
        occupiedUnits,
        availableUnits,
        occupancy: totalUnits ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
        ...(auth.user.role === "tenant" ? {} : { outstandingReceivables }),
        status: property.status,
      };
    });

    return withSecurityHeaders(NextResponse.json({
      success: true,
      properties: mappedProperties,
      unmappedCount: 0,
    }, { headers: { "Cache-Control": "no-store" } }));
  } catch (error) {
    console.error("Property map lookup failed:", error);
    return withSecurityHeaders(NextResponse.json({ success: false, error: "Unable to load mapped properties" }, { status: 500 }));
  }
}