export interface MoveOutIdentity {
  userId: string;
  email: string;
  emailVerified: boolean;
}

export interface MoveOutTenantRow {
  id: string;
  name: string;
  email?: string | null;
  unit_id?: string | null;
  property_name?: string | null;
  unit_number?: string | null;
  rent_amount?: number | string | null;
  contract_start?: string | null;
  contract_end?: string | null;
  assignment_status?: string | null;
  status?: string | null;
}

export interface MoveOutUnitRow {
  id: string;
  property_id?: string | null;
  unit_number?: string | null;
  rent_amount?: number | string | null;
  status: string;
  tenant_id?: string | null;
}

export interface MoveOutRequestRow {
  id: string;
  tenant_id: string;
  tenant_name?: string | null;
  unit_id?: string | null;
  property_name?: string | null;
  reason?: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at?: string | null;
}

export interface MoveOutTenancy {
  eligible: boolean;
  issue: string | null;
  message: string;
  tenant: {
    id: string;
    name: string;
    unitId: string | null;
    unitNumber: string | null;
    propertyName: string | null;
    rentAmount: number;
    contractStart: string | null;
    contractEnd: string | null;
    assignmentStatus: string;
    status: string;
  } | null;
}

export function resolveMoveOutTenant(identity: MoveOutIdentity, records: MoveOutTenantRow[]) {
  const direct = records.find((record) => record.id === identity.userId);
  if (direct) return { tenant: direct, issue: null };
  if (!identity.emailVerified) return { tenant: null, issue: "unverified_email" };
  const email = identity.email.trim().toLowerCase();
  const matches = email ? records.filter((record) => record.email?.trim().toLowerCase() === email) : [];
  if (matches.length > 1) return { tenant: null, issue: "ambiguous_identity" };
  return { tenant: matches[0] || null, issue: matches.length ? null : "unassigned" };
}

export function resolveMoveOutUnit(tenant: MoveOutTenantRow, identityIds: string[], units: MoveOutUnitRow[]) {
  if (tenant.status === "inactive") return { unit: null, issue: "inactive" };
  if (tenant.assignment_status === "rejected") return { unit: null, issue: "unassigned" };
  const linkedUnits = units.filter((unit) => unit.status === "occupied" && !!unit.tenant_id && identityIds.includes(unit.tenant_id));
  if (tenant.unit_id) {
    const unit = units.find((candidate) => candidate.id === tenant.unit_id);
    const linkedById = !!unit?.tenant_id && identityIds.includes(unit.tenant_id);
    if (unit?.status === "occupied" && (linkedById || (!unit.tenant_id && tenant.assignment_status !== "pending"))) {
      return { unit, issue: null };
    }
    return { unit: null, issue: tenant.assignment_status === "pending" ? "pending_assignment" : "stale_assignment" };
  }
  if (linkedUnits.length > 1) return { unit: null, issue: "ambiguous_assignment" };
  return { unit: linkedUnits[0] || null, issue: linkedUnits.length ? null : "unassigned" };
}

export function normalizeMoveOutReason(reason: unknown): string {
  if (reason !== undefined && typeof reason !== "string") throw new Error("Reason must be text");
  const value = typeof reason === "string" ? reason.trim() : "";
  if (value.length > 2000) throw new Error("Reason must be 2,000 characters or fewer");
  return value || "Tenant requested to move out";
}

export function findPendingMoveOut(requests: MoveOutRequestRow[], identityIds: string[]) {
  return requests.find((request) => request.status === "pending" && identityIds.includes(request.tenant_id)) || null;
}

export function parseMoveOutReview(routeId: string, body: unknown) {
  if (!routeId || routeId.length > 200 || !body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid request");
  }
  const values = body as Record<string, unknown>;
  if (values.id !== undefined && values.id !== routeId) throw new Error("Request ID does not match the URL");
  if (values.status !== "approved" && values.status !== "rejected") throw new Error("Choose approved or rejected");
  return { id: routeId, status: values.status } as const;
}

export function canApproveMoveOut(request: MoveOutRequestRow, tenant: MoveOutTenantRow, identityIds: string[], unit: MoveOutUnitRow | null) {
  if (request.status !== "pending" || request.tenant_id !== tenant.id || !request.unit_id || unit?.id !== request.unit_id) return false;
  const current = resolveMoveOutUnit(tenant, identityIds, unit ? [unit] : []);
  return current.unit?.id === request.unit_id;
}
