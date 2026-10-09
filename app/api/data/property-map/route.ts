import { NextRequest, NextResponse } from "next/server";
import {
  findUserById,
  getPayments,
  getProperties,
  getTenants,
  getUnits,
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
    const mappedProperties = properties
      .filter((property: any) => property.latitude !== null
        && property.latitude !== undefined
        && property.longitude !== null
        && property.longitude !== undefined
        && Number.isFinite(Number(property.latitude))
        && Number.isFinite(Number(property.longitude)))
      .map((property: any) => {
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
          latitude: Number(property.latitude),
          longitude: Number(property.longitude),
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
      unmappedCount: properties.length - mappedProperties.length,
    }, { headers: { "Cache-Control": "no-store" } }));
  } catch (error) {
    console.error("Property map lookup failed:", error);
    return withSecurityHeaders(NextResponse.json({ success: false, error: "Unable to load mapped properties" }, { status: 500 }));
  }
}