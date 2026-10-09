"use client";

/**
 * Admin data store — a shared, cached "super useState" for the admin dashboard.
 *
 * - `useAdminDataset("users")` is a drop-in replacement for `useState`: it returns `[value, setValue]`,
 *   and the setter accepts a value or an updater function, exactly like React's.
 * - Data lives in <AdminDataProvider> (mounted in the admin layout), so it survives tab switches and
 *   page remounts. A module-level cache also keeps it across client-side navigation away and back.
 * - Cached data renders instantly; stale datasets are re-fetched quietly in the background.
 * - Every dataset is applied as soon as its own request finishes, so one slow endpoint no longer
 *   blocks the rest of the dashboard.
 * - Concurrent requests for the same dataset are de-duplicated.
 *
 * The cache is in memory only (never written to localStorage/sessionStorage) because it holds user PII.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type SetStateAction } from "react";
import {
  getUsers, getProperties, getUnits, getTenants, getNotifications,
  getPayments, getComplaints, getAllRatings, getAuditLogs,
  type UserRecord, type Property, type Unit, type TenantRecord, type Notification,
  type Payment, type Complaint, type Rating, type AuditLog,
} from "@/lib/data";

export type HealthData = { success: boolean; checks: Record<string, string> } | null;

export interface AdminDataState {
  users: UserRecord[];
  properties: Property[];
  units: Unit[];
  tenants: TenantRecord[];
  notifications: Notification[];
  payments: Payment[];
  complaints: Complaint[];
  ratings: Rating[];
  auditLogs: AuditLog[];
  systemConfig: Record<string, string>;
  maintenanceMode: boolean;
  healthData: HealthData;
}

export type AdminDatasetKey = keyof AdminDataState;

export interface RefreshOptions {
  /** Ignore the cache age and always re-fetch. */
  force?: boolean;
}

const EMPTY_STATE: AdminDataState = {
  users: [],
  properties: [],
  units: [],
  tenants: [],
  notifications: [],
  payments: [],
  complaints: [],
  ratings: [],
  auditLogs: [],
  systemConfig: {},
  maintenanceMode: false,
  healthData: null,
};

export const ADMIN_DATASET_KEYS = Object.keys(EMPTY_STATE) as AdminDatasetKey[];

/** Cached data younger than this is shown without re-fetching on mount. */
const STALE_AFTER_MS = 30_000;

async function fetchJson(url: string) {
  try {
    const res = await fetch(url, { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await res.json();
    }
    return null;
  } catch {
    return null;
  }
}

const loaders: { [K in AdminDatasetKey]: (userId: string) => Promise<AdminDataState[K]> } = {
  users: () => getUsers(),
  properties: () => getProperties(),
  units: () => getUnits(),
  tenants: () => getTenants(),
  notifications: (userId) => getNotifications(userId),
  payments: () => getPayments(),
  complaints: () => getComplaints(),
  ratings: () => getAllRatings(),
  auditLogs: () => getAuditLogs(40),
  systemConfig: async () => {
    try {
      const data = await fetchJson("/api/admin/config");
      return (data?.success && data?.config) ? (data.config as Record<string, string>) : {};
    } catch {
      return {};
    }
  },
  maintenanceMode: async () => {
    try {
      const data = await fetchJson("/api/admin/maintenance/mode");
      return Boolean(data?.success && data?.enabled);
    } catch {
      return false;
    }
  },
  healthData: async () => {
    try {
      return (await fetchJson("/api/health")) as HealthData;
    } catch {
      return null;
    }
  },
};

interface StoreSnapshot {
  ownerId: string | null;
  data: AdminDataState;
}

// Module-level cache: persists while the browser tab is open, across client-side navigations.
let cache: StoreSnapshot = { ownerId: null, data: EMPTY_STATE };
const loadedAt = new Map<AdminDatasetKey, number>();
const inFlight = new Map<string, Promise<unknown>>();

function snapshotFor(userId: string | null | undefined): StoreSnapshot {
  if (userId && cache.ownerId === userId) return cache;
  return { ownerId: userId ?? null, data: EMPTY_STATE };
}

interface AdminDataContextValue {
  data: AdminDataState;
  setDataset: <K extends AdminDatasetKey>(key: K, action: SetStateAction<AdminDataState[K]>) => void;
  refresh: (keys?: AdminDatasetKey[], options?: RefreshOptions) => Promise<void>;
  isRefreshing: boolean;
}

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

export function AdminDataProvider({ userId, children }: { userId?: string | null; children: ReactNode }) {
  const [store, setStore] = useState<StoreSnapshot>(() => snapshotFor(userId));
  const [pendingCount, setPendingCount] = useState(0);
  const userIdRef = useRef<string | null>(userId ?? null);

  // Mirror state into the module cache so a remounted provider starts from the latest data.
  useEffect(() => {
    if (store.ownerId) cache = store;
  }, [store]);

  const setDataset = useCallback(<K extends AdminDatasetKey>(key: K, action: SetStateAction<AdminDataState[K]>) => {
    setStore((prev) => {
      const current = prev.data[key];
      const next = typeof action === "function"
        ? (action as (previous: AdminDataState[K]) => AdminDataState[K])(current)
        : action;
      if (Object.is(next, current)) return prev;
      return { ...prev, data: { ...prev.data, [key]: next } };
    });
  }, []);

  const refresh = useCallback(async (keys: AdminDatasetKey[] = ADMIN_DATASET_KEYS, options: RefreshOptions = {}) => {
    const ownerId = userIdRef.current;
    if (!ownerId) return;

    const now = Date.now();
    const targets = options.force
      ? keys
      : keys.filter((key) => cache.ownerId !== ownerId || now - (loadedAt.get(key) ?? 0) > STALE_AFTER_MS);
    if (targets.length === 0) return;

    setPendingCount((count) => count + 1);
    try {
      await Promise.allSettled(targets.map(async (key) => {
        const requestKey = `${ownerId}:${key}`;
        let request = inFlight.get(requestKey);
        if (!request) {
          request = loaders[key](ownerId).finally(() => inFlight.delete(requestKey));
          inFlight.set(requestKey, request);
        }
        try {
          const value = await request;
          // Drop results that arrive after the signed-in user changed.
          if (userIdRef.current !== ownerId) return;
          loadedAt.set(key, Date.now());
          setStore((prev) => (prev.ownerId === ownerId
            ? { ...prev, data: { ...prev.data, [key]: value } }
            : prev));
        } catch (error) {
          console.error(`Admin data: failed to load "${key}"`, error);
        }
      }));
    } finally {
      setPendingCount((count) => Math.max(0, count - 1));
    }
  }, []);

  // Switch to the right user's cache (or an empty store) and revalidate in the background.
  useEffect(() => {
    const nextUserId = userId ?? null;
    if (userIdRef.current !== nextUserId) loadedAt.clear();
    userIdRef.current = nextUserId;
    if (!nextUserId) return;
    setStore((prev) => (prev.ownerId === nextUserId ? prev : snapshotFor(nextUserId)));
    void refresh();
  }, [userId, refresh]);

  const value = useMemo<AdminDataContextValue>(() => ({
    data: store.data,
    setDataset,
    refresh,
    isRefreshing: pendingCount > 0,
  }), [store.data, setDataset, refresh, pendingCount]);

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (!context) throw new Error("useAdminData must be used inside <AdminDataProvider>.");
  return context;
}

/** Drop-in replacement for `useState`, backed by the shared admin data cache. */
export function useAdminDataset<K extends AdminDatasetKey>(key: K) {
  const { data, setDataset } = useAdminData();
  const setValue = useCallback(
    (action: SetStateAction<AdminDataState[K]>) => setDataset(key, action),
    [key, setDataset],
  );
  return [data[key], setValue] as const;
}
