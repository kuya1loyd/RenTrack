export type TenantPropertyList = "favorites" | "recently-viewed";

function storageKey(userId: string, list: TenantPropertyList) {
  return `renttrack:${userId}:${list}`;
}

export function getTenantPropertyIds(userId: string, list: TenantPropertyList): string[] {
  if (!userId || typeof window === "undefined") return [];
  try {
    const savedIds: unknown = JSON.parse(window.localStorage.getItem(storageKey(userId, list)) || "[]");
    return Array.isArray(savedIds) ? savedIds.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function saveTenantPropertyIds(userId: string, list: TenantPropertyList, ids: string[]) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId, list), JSON.stringify(ids));
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

export function toggleFavoriteProperty(userId: string, propertyId: string): boolean {
  const currentIds = getTenantPropertyIds(userId, "favorites");
  const isFavorite = currentIds.includes(propertyId);
  saveTenantPropertyIds(userId, "favorites", isFavorite ? currentIds.filter((id) => id !== propertyId) : [propertyId, ...currentIds]);
  return !isFavorite;
}

export function recordRecentPropertyView(userId: string, propertyId: string) {
  const currentIds = getTenantPropertyIds(userId, "recently-viewed");
  saveTenantPropertyIds(userId, "recently-viewed", [propertyId, ...currentIds.filter((id) => id !== propertyId)].slice(0, 20));
}

export function removeRecentPropertyView(userId: string, propertyId: string) {
  saveTenantPropertyIds(userId, "recently-viewed", getTenantPropertyIds(userId, "recently-viewed").filter((id) => id !== propertyId));
}