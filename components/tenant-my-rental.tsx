"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Home,
  Layers,
  MapPin,
  MessageCircle,
} from "lucide-react";
import type { Property, Unit } from "@/lib/data";
import { safeParseJson } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SESSION_KEY } from "@/lib/auth";

export interface MyRentalAssignment {
  tenantId: string;
  name: string;
  assignmentStatus: string;
  status: string;
  kind: "unit" | "property" | null;
  propertyName: string | null;
  unitNumber: string | null;
  unitId: string | null;
  rentAmount: number;
  contractStart: string | null;
  contractEnd: string | null;
}

export interface TenantInquiryItem {
  id: string;
  kind: "unit" | "property";
  propertyId: string | null;
  unitId: string | null;
  title: string;
  address: string;
  rentAmount: number;
  imageUrl: string | null;
  message: string;
  status: "approved" | "replied" | "read" | "new" | string;
  replyText: string | null;
  repliedAt: string | null;
  agentName: string | null;
  createdAt: string;
}

export interface MyRentalState {
  loading: boolean;
  error: boolean;
  assignment: MyRentalAssignment | null;
  unit: Unit | null;
  property: Property | null;
  inquiries: TenantInquiryItem[];
  reload: () => void;
}

/** Reads the tenant's own assigned unit / property AND inquiries straight from Supabase. */
export function useMyRental(enabled = true): MyRentalState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [assignment, setAssignment] = useState<MyRentalAssignment | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [inquiries, setInquiries] = useState<TenantInquiryItem[]>([]);

  const load = useCallback(async () => {
    if (!enabled) return;
    setError(false);
    try {
      let query = "";
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.id && parsed?.email) {
            query = `?userId=${encodeURIComponent(parsed.id)}&email=${encodeURIComponent(parsed.email)}`;
          }
        }
      } catch {}

      const res = await fetch(`/api/data/tenants/me${query}`, { credentials: "include", cache: "no-store" });
      const data = await safeParseJson(res);
      if (!res.ok || !data.success) throw new Error(data.error || "Failed");
      setAssignment(data.assignment || null);
      setUnit(data.unit || null);
      setProperty(data.property || null);
      setInquiries(Array.isArray(data.inquiries) ? data.inquiries : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
    const handler = () => void load();
    window.addEventListener("focus", handler);
    window.addEventListener("renttrack-tenants-updated", handler);
    return () => {
      window.removeEventListener("focus", handler);
      window.removeEventListener("renttrack-tenants-updated", handler);
    };
  }, [load]);

  return { loading, error, assignment, unit, property, inquiries, reload: load };
}

export function MyRentalCard({
  state,
  filter = "all",
  hideWhenEmpty = false,
}: {
  state: MyRentalState;
  filter?: "all" | "unit" | "property";
  hideWhenEmpty?: boolean;
}) {
  const { loading, assignment, unit, property } = state;

  if (loading) {
    if (hideWhenEmpty) return null;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-500 shadow-xs">
        Loading your rental…
      </div>
    );
  }

  const hasAssignment = Boolean(assignment && (assignment.unitId || assignment.propertyName || assignment.unitNumber));
  const kind = unit ? "unit" : property ? "property" : assignment?.kind || null;

  if (!hasAssignment || (filter !== "all" && kind && kind !== filter)) {
    if (filter !== "all" || hideWhenEmpty) return null;
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center shadow-xs">
        <Home className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-2 text-sm font-semibold text-slate-800">No rental assigned yet</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Once an agent assigns you a condo unit or house and the owner approves it, it will appear here.
        </p>
      </div>
    );
  }

  const isConfirmed = assignment?.assignmentStatus === "confirmed";
  const images = unit?.imageUrls?.length
    ? unit.imageUrls
    : unit?.imageUrl
      ? [unit.imageUrl]
      : property?.imageUrls?.length
        ? property.imageUrls
        : property?.imageUrl
          ? [property.imageUrl]
          : [];
  const cover = images[0] || null;
  const unitNumber = assignment?.unitNumber || unit?.unitNumber || null;
  const buildingName = unit?.name || property?.name || assignment?.propertyName || "My Rental";
  const title = unit
    ? `${unitNumber ? `Unit ${String(unitNumber).replace(/^unit\s*#?\s*/i, "")}` : "Condo Unit"} – ${buildingName}`
    : buildingName;
  const address = unit
    ? [unit.address, unit.city, unit.province].filter(Boolean).join(", ")
    : property?.location || "";
  const rent = assignment?.rentAmount || unit?.rentAmount || property?.monthlyRevenue || 0;
  const amenities: string[] = Array.from(
    new Set([
      ...(((unit as any)?.amenities as string[]) || []),
      ...(((unit as any)?.features as string[]) || []),
      ...((property?.features as string[]) || []),
    ])
  ).filter(Boolean);

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
      <div className="flex flex-col md:flex-row">
        <div className="relative h-44 w-full shrink-0 bg-slate-100 md:h-auto md:w-72">
          {cover ? (
            <Image src={cover} alt={title} fill unoptimized className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-300">
              {kind === "unit" ? <Layers className="h-12 w-12" /> : <Home className="h-12 w-12" />}
            </div>
          )}
          <span
            className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs ${
              isConfirmed ? "bg-blue-600" : "bg-amber-500"
            }`}
          >
            {isConfirmed ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {isConfirmed ? "Your Home • Approved" : "Awaiting Owner Approval"}
          </span>
        </div>
        <div className="flex-1 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
              {kind === "unit" ? "My Assigned Condominium Unit" : "My Assigned House / Property"}
            </p>
            <Link
              href="/dashboard/tenant/payments?tab=contract"
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/80 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors shadow-2xs"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Rental Contract</span>
            </Link>
          </div>
          <h3 className="mt-1 text-lg font-extrabold text-slate-900">{title}</h3>
          {address && (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span>{address}</span>
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-[10px] font-semibold uppercase text-slate-400">Monthly Rent</p>
              <p className="mt-0.5 font-bold text-slate-900">{rent > 0 ? formatCurrency(rent) : "Not set"}</p>
            </div>
            {kind === "unit" && unit?.floor !== undefined && unit?.floor !== null && String(unit.floor) !== "" && (
              <div className="rounded-xl bg-slate-50 p-2.5">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Floor</p>
                <p className="mt-0.5 font-bold text-slate-900">Floor {unit.floor}</p>
              </div>
            )}
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-[10px] font-semibold uppercase text-slate-400">Lease Status</p>
              <p className={`mt-0.5 font-bold ${isConfirmed ? "text-emerald-700" : "text-amber-700"}`}>
                {isConfirmed ? "Active (Approved)" : "Pending Approval"}
              </p>
            </div>
            {assignment?.contractStart && (
              <div className="rounded-xl bg-slate-50 p-2.5">
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-400">
                  <CalendarDays className="h-3 w-3" /> Lease
                </p>
                <p className="mt-0.5 font-bold text-slate-900">
                  {formatDate(assignment.contractStart)}
                  {assignment.contractEnd ? ` – ${formatDate(assignment.contractEnd)}` : ""}
                </p>
              </div>
            )}
          </div>
          {amenities.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {amenities.slice(0, 10).map((a) => (
                <span key={a} className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {a}
                </span>
              ))}
            </div>
          )}
          {!isConfirmed && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-700">
              <Building2 className="h-3.5 w-3.5" /> The property owner is reviewing this placement.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function MyInquiriesSection({
  state,
  compact = false,
}: {
  state: MyRentalState;
  compact?: boolean;
}) {
  const { loading, inquiries } = state;

  if (loading) {
    if (compact) return null;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500 shadow-xs">
        Loading your inquiries…
      </div>
    );
  }

  if (!inquiries.length) {
    if (compact) return null;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
        <MessageCircle className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-3 text-base font-bold text-slate-800">No unit or property inquiries yet</h3>
        <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
          When you send an inquiry on a condominium unit or house property, it will appear here along with its monthly rent, agent reply, and approval status.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard/tenant/properties-page"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Browse Properties
          </Link>
          <Link
            href="/dashboard/tenant/units"
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Browse Condo Units
          </Link>
        </div>
      </div>
    );
  }

  const displayed = compact ? inquiries.slice(0, 3) : inquiries;

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">My Inquired Units &amp; Properties</h3>
            <p className="text-xs text-slate-500">Units and properties you inquired about and their approval/reply status</p>
          </div>
        </div>
        {compact && (
          <Link
            href="/dashboard/tenant/inquiries"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            <span>View all ({inquiries.length})</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {displayed.map((inq) => {
          const statusBadge =
            inq.status === "approved"
              ? { label: "Approved & Assigned", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }
              : inq.status === "replied" || inq.replyText
                ? { label: "Agent Replied", cls: "bg-blue-50 text-blue-700 border-blue-200" }
                : inq.status === "read"
                  ? { label: "Viewed by Agent", cls: "bg-amber-50 text-amber-700 border-amber-200" }
                  : { label: "Inquiry Sent", cls: "bg-slate-100 text-slate-700 border-slate-200" };

          return (
            <div
              key={inq.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/40 p-4 transition-all hover:border-blue-200 hover:bg-white"
            >
              <div>
                <div className="flex items-start gap-3.5">
                  <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    {inq.imageUrl ? (
                      <Image src={inq.imageUrl} alt={inq.title} fill unoptimized className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-400">
                        {inq.kind === "unit" ? <Layers className="h-6 w-6" /> : <Home className="h-6 w-6" />}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                        {inq.kind === "unit" ? "Condominium Unit" : "Subdivision / House"}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusBadge.cls}`}>
                        {statusBadge.label}
                      </span>
                    </div>
                    <h4 className="mt-0.5 truncate text-sm font-bold text-slate-900">{inq.title}</h4>
                    {inq.address && (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500">
                        <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="truncate">{inq.address}</span>
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-3 text-xs">
                      <span className="font-extrabold text-slate-900">
                        {inq.rentAmount > 0 ? `${formatCurrency(inq.rentAmount)} /mo` : "Rent upon inquiry"}
                      </span>
                      {inq.agentName && (
                        <span className="truncate text-[11px] text-slate-500">• Agent: {inq.agentName}</span>
                      )}
                    </div>
                  </div>
                </div>

                {inq.message && (
                  <p className="mt-3 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-600 line-clamp-2">
                    <span className="font-semibold text-slate-800">Your inquiry: </span>
                    {inq.message}
                  </p>
                )}

                {inq.replyText && (
                  <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs text-blue-950">
                    <span className="font-bold text-blue-800">
                      Reply{inq.agentName ? ` from ${inq.agentName}` : ""}:{" "}
                    </span>
                    {inq.replyText}
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-200/70 pt-2.5 text-[11px] text-slate-400">
                <span>Inquired {formatDate(inq.createdAt)}</span>
                <Link
                  href={inq.kind === "unit" ? "/dashboard/tenant/units" : "/dashboard/tenant/properties-page"}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  View in {inq.kind === "unit" ? "Available Unit" : "Available Property"} →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
