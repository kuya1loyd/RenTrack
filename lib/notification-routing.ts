type NotificationRoutingInput = {
  title?: string | null;
  message?: string | null;
  type?: string | null;
};

export type NotificationDashboardRole = "admin" | "owner" | "agent" | "tenant" | string;

const defaultHref: Record<string, string> = {
  admin: "/dashboard/admin?tab=overview",
  owner: "/dashboard/owner#overview",
  agent: "/dashboard/agent#overview",
  tenant: "/dashboard/tenant",
};

/** Resolve a notification to a section that exists in the recipient's dashboard. */
export function getNotificationDashboardHref(
  notification: NotificationRoutingInput,
  role: NotificationDashboardRole,
): string {
  const title = (notification.title || "").toLowerCase();
  const message = (notification.message || "").toLowerCase();
  const type = (notification.type || "").toLowerCase();
  const text = `${title} ${message}`;
  const isAdmin = role === "admin";
  const isOwner = role === "owner";
  const isAgent = role === "agent";
  const isTenant = role === "tenant";

  // Account creation requests open the existing review modal in the admin/owner layouts.
  if (title.includes("account creation request")) return defaultHref[role] || "/dashboard";

  if (/contract/.test(text)) {
    if (isOwner) return "/dashboard/owner#contracts";
    if (isAgent) return "/dashboard/agent#contracts";
  }

  if (text.includes("agent applicant") || text.includes("agent application") || text.includes("applied to become an agent") || text.includes("agent email verified")) {
    if (isOwner) return "/dashboard/owner?view=applicants#agents";
    if (isAdmin) return "/dashboard/admin?tab=users";
    if (isTenant) return "/dashboard/tenant/settings";
    return defaultHref[role] || "/dashboard";
  }

  if (type === "payment" || /payment|receipt|rent|balance/.test(text)) {
    if (isAdmin) return "/dashboard/admin?tab=payments";
    if (isOwner) return "/dashboard/owner#financial";
    if (isAgent) return "/dashboard/agent#payments";
    if (isTenant) return "/dashboard/tenant/payments";
  }

  if (type === "id_verification" || /verification|verify id|uploaded an id|id upload/.test(text)) {
    if (isAdmin) return "/dashboard/tenants";
    if (isOwner) return "/dashboard/tenants";
    if (isAgent) return "/dashboard/agent#verifications";
    if (isTenant) return "/dashboard/tenant/settings";
  }

  if (/inquiry|visitor reply/.test(text)) {
    if (isAdmin) return "/dashboard/admin?tab=messages";
    if (isOwner) return "/dashboard/owner#messages";
    if (isAgent) return "/dashboard/agent#inquiries";
    if (isTenant) return "/dashboard/tenant/messages";
  }

  if (/support|complaint|rating/.test(text)) {
    if (isAdmin) return "/dashboard/admin?tab=complaints";
    if (isOwner) return "/dashboard/owner#messages";
    if (isAgent) return "/dashboard/agent#messages";
    if (isTenant) return "/dashboard/tenant/contact";
  }

  if (/message|chat|reply/.test(text) || type === "message") {
    if (isAdmin) return "/dashboard/admin?tab=messages";
    if (isOwner) return "/dashboard/owner#messages";
    if (isAgent) return "/dashboard/agent#messages";
    if (isTenant) return "/dashboard/tenant/messages";
  }

  if (/assignment|assigned|tenant/.test(text) || type === "tenant") {
    if (isAdmin) return "/dashboard/admin?tab=tenants";
    if (isOwner) return "/dashboard/owner#assignments";
    if (isAgent) return "/dashboard/agent#units";
    if (isTenant) return "/dashboard/tenant/units";
  }

  if (type === "property" || /property|unit/.test(text)) {
    const isUnit = /unit/.test(text);
    if (isAdmin) return `/dashboard/admin?tab=${isUnit ? "units" : "properties"}`;
    if (isOwner) return "/dashboard/owner#units";
    if (isAgent) return "/dashboard/agent#units";
    if (isTenant) return isUnit ? "/dashboard/tenant/units" : "/dashboard/tenant/properties-page";
  }

  if (type === "system") {
    if (isAdmin) return "/dashboard/admin?tab=overview";
    if (isOwner) return "/dashboard/owner#overview";
    if (isAgent) return "/dashboard/agent#overview";
    if (isTenant) return "/dashboard/tenant/news";
  }

  return defaultHref[role] || "/dashboard";
}
