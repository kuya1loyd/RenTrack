import { createHash } from "node:crypto";
import type { SecureContext } from "@/lib/api-security";
import { getAdminSupabase } from "@/lib/db";
import {
  resolveMoveOutTenant, resolveMoveOutUnit,
  type MoveOutIdentity, type MoveOutTenantRow, type MoveOutUnitRow, type MoveOutTenancy,
} from "@/lib/move-out-policy";

const tenantColumns = "id, name, email, unit_id, property_name, unit_number, rent_amount, contract_start, contract_end, assignment_status, status";
const unitColumns = "id, property_id, unit_number, rent_amount, status, tenant_id";
const issueMessages: Record<string, string> = {
  unassigned: "No current unit is assigned to your account. If you already live in a unit, ask your property manager to confirm the assignment before requesting a move-out.",
  unverified_email: "Your rental record could not be linked to this account. Ask your property manager to check your account and unit assignment.",
  ambiguous_identity: "More than one rental record matches your account. Your property manager needs to check the records before you can submit a move-out request.",
  inactive: "Your tenancy has already ended. There is no active tenancy to end right now.",
  pending_assignment: "Your unit assignment is awaiting confirmation. Ask your property manager to confirm your current tenancy first.",
  stale_assignment: "Your rental record and current unit assignment do not match. Ask your property manager to update the assignment before requesting a move-out.",
  ambiguous_assignment: "More than one current unit is linked to your account. Ask your property manager to check the assignment before submitting a request.",
};

// Escape LIKE wildcards so an account email can only match that exact email.
function exactEmailPattern(email: string) {
  return email.trim().replace(/[\\%_]/g, "\\$&");
}

export async function loadMoveOutContext(auth: SecureContext) {
  const client = getAdminSupabase();
  const identity: MoveOutIdentity = {
    userId: auth.userId,
    email: typeof auth.user.email === "string" ? auth.user.email : "",
    emailVerified: auth.user.emailVerified === true,
  };
  const { data: direct, error: directError } = await client.from("tenants").select(tenantColumns).eq("id", identity.userId).maybeSingle();
  if (directError) throw directError;
  let candidates: MoveOutTenantRow[] = direct ? [direct] : [];
  if (!direct && identity.emailVerified && identity.email) {
    const { data, error } = await client.from("tenants").select(tenantColumns).ilike("email", exactEmailPattern(identity.email)).limit(2);
    if (error) throw error;
    candidates = data || [];
  }
  const resolved = resolveMoveOutTenant(identity, candidates);
  const tenant = resolved.tenant;
  const identityIds = Array.from(new Set([identity.userId, ...(tenant ? [tenant.id] : [])]));
  let units: MoveOutUnitRow[] = [];
  if (tenant?.unit_id) {
    const { data, error } = await client.from("units").select(unitColumns).eq("id", tenant.unit_id).maybeSingle();
    if (error) throw error;
    if (data) units = [data];
  } else if (tenant) {
    const { data, error } = await client.from("units").select(unitColumns).in("tenant_id", identityIds).eq("status", "occupied").limit(2);
    if (error) throw error;
    units = data || [];
  }
  const assignment = tenant ? resolveMoveOutUnit(tenant, identityIds, units) : { unit: null, issue: resolved.issue };
  const unit = assignment.unit;
  let propertyName = tenant?.property_name || null;
  if (unit?.property_id) {
    const { data, error } = await client.from("properties").select("name").eq("id", unit.property_id).maybeSingle();
    if (error) throw error;
    propertyName = data?.name || propertyName;
  }
  const issue = assignment.issue;
  const tenancy: MoveOutTenancy = {
    eligible: !!unit,
    issue,
    message: issue ? issueMessages[issue] || issueMessages.unassigned : "Your current tenancy is eligible for a move-out request.",
    tenant: tenant ? {
      id: tenant.id,
      name: tenant.name,
      unitId: unit?.id || null,
      unitNumber: unit?.unit_number || null,
      propertyName: unit ? propertyName : null,
      rentAmount: Number(unit?.rent_amount ?? tenant.rent_amount ?? 0),
      contractStart: tenant.contract_start || null,
      contractEnd: tenant.contract_end || null,
      assignmentStatus: unit ? "confirmed" : tenant.assignment_status || "",
      status: tenant.status || "active",
    } : null,
  };
  return { tenant, unit, identityIds, tenancy };
}

export async function getMoveOutManagementUnitIds(auth: SecureContext) {
  const client = getAdminSupabase();
  const field = auth.user.role === "agent" ? "agent_id" : "created_by";
  const { data: properties, error: propertyError } = await client.from("properties").select("id").eq(field, auth.userId);
  if (propertyError) throw propertyError;
  const propertyIds = (properties || []).map((property) => property.id);
  if (!propertyIds.length) return [];
  const { data: units, error: unitError } = await client.from("units").select("id").in("property_id", propertyIds);
  if (unitError) throw unitError;
  return (units || []).map((unit) => unit.id as string);
}

export async function getMoveOutReviewIdentityIds(tenant: MoveOutTenantRow) {
  const ids = [tenant.id];
  if (tenant.email) {
    const { data, error } = await getAdminSupabase().schema("public").from("users").select("id, email")
      .eq("role", "tenant").eq("email_verified", true).ilike("email", exactEmailPattern(tenant.email)).limit(2);
    if (error) throw error;
    if (data?.length === 1) ids.push(data[0].id);
  }
  return Array.from(new Set(ids));
}

// Concurrent submissions produce the same primary key; a rejected request gives
// the next attempt a new key without adding a schema-level migration.
export function moveOutSubmissionId(tenantId: string, unitId: string, previousRequestId?: string) {
  return `move_out_${createHash("sha256").update(JSON.stringify([tenantId, unitId, previousRequestId || "initial"])).digest("hex").slice(0, 32)}`;
}

function sqlText(value: string) {
  return `E'${value.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

export function moveOutReviewSql(options: {
  id: string; status: "approved" | "rejected"; reviewerId: string;
  ownerId: string | null; tenantIdentityIds: string[];
}) {
  const { id, status, reviewerId, ownerId, tenantIdentityIds } = options;
  const literals = [id, reviewerId, ownerId || "", ...tenantIdentityIds];
  let delimiter = "$renttrack_move_out$";
  while (literals.some((value) => value.includes(delimiter))) delimiter = `${delimiter.slice(0, -1)}_$`;
  const identities = tenantIdentityIds.map(sqlText).join(", ") || "NULL";
  return `DO ${delimiter}
DECLARE
  current_request move_out_requests%ROWTYPE;
  current_tenant tenants%ROWTYPE;
  current_unit units%ROWTYPE;
BEGIN
  SELECT * INTO current_request FROM move_out_requests WHERE id = ${sqlText(id)} FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Move-out request not found' USING ERRCODE = 'P0002'; END IF;
  IF current_request.status <> 'pending' THEN RAISE EXCEPTION 'This request has already been reviewed' USING ERRCODE = '40001'; END IF;
  SELECT * INTO current_tenant FROM tenants WHERE id = current_request.tenant_id FOR UPDATE;
  SELECT * INTO current_unit FROM units WHERE id = current_request.unit_id FOR UPDATE;
  ${ownerId ? `IF NOT EXISTS (SELECT 1 FROM properties WHERE id = current_unit.property_id AND created_by = ${sqlText(ownerId)}) THEN
    RAISE EXCEPTION 'You can only review requests for your properties' USING ERRCODE = '42501';
  END IF;` : ""}
  ${status === "approved" ? `IF current_tenant.id IS NULL OR current_unit.id IS NULL
    OR current_tenant.status = 'inactive' OR COALESCE(current_tenant.assignment_status, '') = 'rejected'
    OR (current_tenant.unit_id IS NOT NULL AND current_tenant.unit_id <> current_unit.id)
    OR current_unit.status <> 'occupied'
    OR (current_unit.tenant_id IS NOT NULL AND current_unit.tenant_id NOT IN (${identities}))
    OR (current_unit.tenant_id IS NULL AND (current_tenant.unit_id IS DISTINCT FROM current_unit.id OR COALESCE(current_tenant.assignment_status, '') = 'pending')) THEN
    RAISE EXCEPTION 'The current unit assignment has changed; check the tenancy before approving' USING ERRCODE = '40001';
  END IF;
  UPDATE units SET status = 'vacant', tenant_id = NULL, tenant_name = NULL WHERE id = current_unit.id;
  UPDATE tenants SET status = 'inactive', unit_id = NULL, property_name = NULL, unit_number = NULL, assignment_status = '', rent_amount = 0 WHERE id = current_tenant.id;` : ""}
  UPDATE move_out_requests SET status = ${sqlText(status)}, reviewed_by = ${sqlText(reviewerId)}, reviewed_at = NOW() WHERE id = current_request.id;
END;
${delimiter};`;
}
