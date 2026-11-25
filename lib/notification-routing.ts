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

/** Contract notices are never maintenance/system alerts, even when saved with a generic type. */
export function isContractNotification(notification: NotificationRoutingInput): boolean {
  const text = `${notification.title || ""} ${notification.message || ""}`.toLowerCase();
  return /\b(?:rental\s+contract|contract|lease\s+agreement)\b/.test(text);
}

/** Checks whether a notification is an informational system maintenance or platform alert. */
export function isMaintenanceNotification(notification: NotificationRoutingInput): boolean {
  if (isContractNotification(notification)) return false;
  const title = (notification.title || "").toLowerCase();
  const message = (notification.message || "").toLowerCase();
  const type = (notification.type || "").toLowerCase();
  const text = `${title} ${message}`;
  return (
    type === "system" ||
    /\b(?:system\s+maintenance|scheduled\s+maintenance|maintenance|downtime|system\s+update|platform\s+update|upgrade)\b/i.test(text)
  );
}

/** Resolve a notification to a section that exists in the recipient's dashboard. */
export function getNotificationDashboardHref(
  notification: NotificationRoutingInput,
  role: NotificationDashboardRole,
): string {
  const title = (notification.title || "").toLowerCase();
  const message = (notification.message || "").toLowerCase();
  const type = (notification.type || "").toLowerCase();
  // Strip app brand name "renttrack" so regexes matching \brent\b don't falsely match brand mentions
  const cleanText = `${title} ${message}`.replace(/renttrack/gi, " ");
  const isAdmin = role === "admin";
  const isOwner = role === "owner";
  const isAgent = role === "agent";
  const isTenant = role === "tenant";

  // Contract notices go straight to the contracts page for each role.
  if (isContractNotification(notification)) {
    if (isOwner) return "/dashboard/owner#contracts";
    if (isAgent) return "/dashboard/agent#contracts";
    if (isAdmin) return "/dashboard/admin?tab=overview";
    if (isTenant) return "/dashboard/tenant/payments?tab=contract";
  }

  // System maintenance and platform announcements evaluated first so that messages
  // containing maintenance updates (e.g. system upgrades or maintenance periods)
  // are never mistaken for payment or lease notices.
  if (
    type === "system" ||
    /\b(?:system\s+maintenance|scheduled\s+maintenance|system\s+update|platform\s+update|maintenance|downtime|announcement|server\s+maintenance|under\s+maintenance)\b/i.test(cleanText)
  ) {
    if (isAdmin) return "/dashboard/admin?tab=overview";
    if (isOwner) return "/dashboard/owner#overview";
    if (isAgent) return "/dashboard/agent#overview";
    if (isTenant) return "/dashboard/tenant/news";
  }

  // Account creation requests open the existing review modal in the admin/owner layouts.
  if (title.includes("account creation request")) return defaultHref[role] || "/dashboard";

  if (/move-out|move out/.test(cleanText)) {
    if (isOwner) return "/dashboard/owner#move-out-requests";
    if (isAdmin) return "/dashboard/admin?tab=overview";
    if (isAgent) return "/dashboard/agent#overview";
    if (isTenant) return "/dashboard/tenant";
  }

  if (/contract|lease\s+agreement/.test(cleanText)) {
    if (isOwner) return "/dashboard/owner#contracts";
    if (isAgent) return "/dashboard/agent#contracts";
    if (isTenant) return "/dashboard/tenant/payments?tab=contract";
  }

  if (
    cleanText.includes("agent applicant") ||
    cleanText.includes("agent application") ||
    cleanText.includes("applied to become an agent") ||
    cleanText.includes("agent email verified")
  ) {
    if (isOwner) return "/dashboard/owner#agents";
    if (isAdmin) return "/dashboard/admin?tab=users";
    if (isTenant) return "/dashboard/tenant/settings";
    return defaultHref[role] || "/dashboard";
  }

  if (
    type === "payment" ||
    /\b(?:payment|payments|receipt|receipts|balance|billing|invoice|paid|due\s+date|monthly\s+rent|overdue)\b/i.test(cleanText) ||
    (/\brent\b/i.test(cleanText) && /\b(?:paid|due|amount|balance|fee|deposit|invoice|pay|overdue|receipt)\b/i.test(cleanText))
  ) {
    if (isAdmin) return "/dashboard/admin?tab=payments";
    if (isOwner) return "/dashboard/owner#financial";
    if (isAgent) return "/dashboard/agent#payments";
    if (isTenant) return "/dashboard/tenant/payments";
  }

  if (/account verified|tenant account verified|verified their account|account created|user registered/.test(cleanText)) {
    if (isAdmin) return "/dashboard/admin?tab=users";
    if (isOwner) return "/dashboard/owner#overview";
    if (isAgent) return "/dashboard/agent#overview";
    if (isTenant) return "/dashboard/tenant";
    return defaultHref[role] || "/dashboard";
  }

  if (type === "id_verification" || /verification|verify id|verified|uploaded an id|id upload/.test(cleanText)) {
    if (isOwner) return "/dashboard/owner#agents";
    if (isAdmin) return "/dashboard/admin?tab=users";
    if (isAgent) return "/dashboard/agent#verifications";
    if (isTenant) return "/dashboard/tenant/settings";
  }

  if (/inquiry|visitor reply/.test(cleanText)) {
    if (isAdmin) return "/dashboard/admin?tab=messages";
    if (isOwner) return "/dashboard/owner#messages";
    if (isAgent) return "/dashboard/agent#inquiries";
    if (isTenant) return "/dashboard/tenant/messages";
  }

  if (/support|complaint|rating/.test(cleanText)) {
    if (isAdmin) return "/dashboard/admin?tab=complaints";
    if (isOwner) return "/dashboard/owner#messages";
    if (isAgent) return "/dashboard/agent#messages";
    if (isTenant) return "/dashboard/tenant/contact";
  }

  if (/message|chat|reply/.test(cleanText) || type === "message") {
    if (isAdmin) return "/dashboard/admin?tab=messages";
    if (isOwner) return "/dashboard/owner#messages";
    if (isAgent) return "/dashboard/agent#messages";
    if (isTenant) return "/dashboard/tenant/messages";
  }

  if (type === "tenant" || /\b(?:assignment|assigned|assigned\s+unit|lease\s+assigned|new\s+tenant)\b/i.test(cleanText)) {
    if (isAdmin) return "/dashboard/admin?tab=tenants";
    if (isOwner) return "/dashboard/owner#assignments";
    if (isAgent) return "/dashboard/agent#units";
    if (isTenant) return "/dashboard/tenant/units";
  }

  if (type === "property" || /\b(?:property|properties|rental\s+unit|unit\s+\d+|apartment|condo)\b/i.test(cleanText)) {
    const isUnit = /\bunit\b/.test(cleanText);
    if (isAdmin) return `/dashboard/admin?tab=${isUnit ? "units" : "properties"}`;
    if (isOwner) return isUnit ? "/dashboard/owner#units" : "/dashboard/owner#properties";
    if (isAgent) return "/dashboard/agent#units";
    if (isTenant) return isUnit ? "/dashboard/tenant/units" : "/dashboard/tenant/properties-page";
  }

  return defaultHref[role] || "/dashboard";
}
