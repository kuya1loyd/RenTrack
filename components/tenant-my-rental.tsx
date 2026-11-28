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
  CreditCard,
  Eye,
  FileText,
  Home,
  Layers,
  MapPin,
  MessageCircle,
  Sparkles,
  ShieldCheck,
  UserCheck,
  ArrowRight,
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
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-sm animate-pulse">
        <div className="mx-auto h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mb-3" />
        <p className="font-semibold text-slate-700">Loading your approved rental details…</p>
      </div>
    );
  }

  const hasAssignment = Boolean(assignment && (assignment.unitId || assignment.propertyName || assignment.unitNumber));
  const kind = unit ? "unit" : property ? "property" : assignment?.kind || null;

  if (!hasAssignment || (filter !== "all" && kind && kind !== filter)) {
    if (filter !== "all" || hideWhenEmpty) return null;
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-gradient-to-b from-slate-50/60 to-white p-8 text-center shadow-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
          <Home className="h-7 w-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900">No Rental Assigned Yet</h3>
        <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
          Once an agent assigns you a condominium unit or house property and the owner confirms it, your official rental contract and home details will be featured here.
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
    <section className="relative overflow-hidden rounded-3xl border border-blue-200/90 bg-gradient-to-br from-white via-blue-50/25 to-white shadow-md shadow-blue-950/5">
      {/* Top Accent Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 bg-white/80 px-6 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-[11px] font-black uppercase tracking-widest text-blue-700">
            {kind === "unit" ? "My Assigned Condominium Residence" : "My Assigned House & Lot Property"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/tenant/payments?tab=contract"
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Rental Contract</span>
          </Link>
          <Link
            href="/dashboard/tenant/payments"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <CreditCard className="h-3.5 w-3.5 text-slate-500" />
            <span>Payments</span>
          </Link>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Cover Photo */}
        <div className="relative h-60 w-full shrink-0 bg-slate-100 lg:h-auto lg:w-80 overflow-hidden">
          {cover ? (
            <Image src={cover} alt={title} fill unoptimized className="object-cover transition-transform duration-500 hover:scale-105" />
          ) : (
            <div className="flex h-full min-h-[220px] items-center justify-center text-slate-300 bg-slate-100">
              {kind === "unit" ? <Layers className="h-16 w-16" /> : <Home className="h-16 w-16" />}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent lg:hidden" />
          <span
            className={`absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md backdrop-blur-md ${
              isConfirmed ? "bg-emerald-600/95" : "bg-amber-600/95"
            }`}
          >
            {isConfirmed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            {isConfirmed ? "Your Home • Approved" : "Awaiting Owner Approval"}
          </span>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 sm:p-7">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{title}</h3>
            {address && (
              <p className="flex items-start gap-1.5 text-xs font-medium text-slate-600 mt-0.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>{address}</span>
              </p>
            )}
          </div>

          {/* Metric Stats Cards */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Monthly Rent</p>
              <p className="mt-1 text-lg font-black text-blue-950">{rent > 0 ? formatCurrency(rent) : "Not set"}</p>
              <p className="mt-0.5 text-[10px] text-blue-600/80 font-medium">Standard Lease</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {kind === "unit" ? "Floor & Space" : "Property Specs"}
              </p>
              <p className="mt-1 text-base font-extrabold text-slate-900">
                {kind === "unit" && unit?.floor ? `Floor ${unit.floor}` : unit?.type || property?.type || "Standard"}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500 font-medium">Designated Space</p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Lease Status</p>
              <p className={`mt-1 text-base font-black ${isConfirmed ? "text-emerald-800" : "text-amber-800"}`}>
                {isConfirmed ? "Active (Approved)" : "Pending Review"}
              </p>
              <p className="mt-0.5 text-[10px] text-emerald-700/80 font-medium">Owner Confirmed</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <CalendarDays className="h-3 w-3 text-slate-400" /> Lease Term
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900 truncate">
                {assignment?.contractStart ? formatDate(assignment.contractStart) : "Active Contract"}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500 font-medium">
                {assignment?.contractEnd ? `Ends ${formatDate(assignment.contractEnd)}` : "Ongoing Tenancy"}
              </p>
            </div>
          </div>

          {/* Amenities Badges */}
          {amenities.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5 pt-2">
              <span className="text-[11px] font-bold text-slate-400 mr-1">Amenities:</span>
              {amenities.slice(0, 8).map((a) => (
                <span key={a} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  <span>{a}</span>
                </span>
              ))}
              {amenities.length > 8 && (
                <span className="rounded-xl bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                  +{amenities.length - 8} more
                </span>
              )}
            </div>
          )}

          {/* Footer note */}
          <div className="mt-4 flex items-center justify-between border-t border-blue-100/70 pt-3 text-[11px]">
            <span className="flex items-center gap-1.5 font-semibold text-slate-600">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <span>Registered Lease with RentTrack Property Management</span>
            </span>
            <Link
              href="/dashboard/tenant/payments"
              className="font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
            >
              <span>View Payments Ledger</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
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
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500 shadow-sm animate-pulse">
        <div className="mx-auto h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mb-3" />
        <p className="font-semibold text-slate-700">Loading your inquiry history…</p>
      </div>
    );
  }

  if (!inquiries.length) {
    if (compact) return null;
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3">
          <MessageCircle className="h-7 w-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900">No Unit or Property Inquiries Yet</h3>
        <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
          When you send an inquiry on any condominium unit or house listing, it will be tracked here with live agent review progress, reply messages, and placement approval.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard/tenant/properties-page"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            Browse Properties
          </Link>
          <Link
            href="/dashboard/tenant/units"
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            Browse Condo Units
          </Link>
        </div>
      </div>
    );
  }

  const displayed = compact ? inquiries.slice(0, 3) : inquiries;

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/20">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">My Inquired Units &amp; Properties</h3>
            <p className="text-xs text-slate-500">Track inquiries you submitted, agent responses, and placement statuses</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            {inquiries.length} {inquiries.length === 1 ? "Inquiry" : "Inquiries"}
          </span>
          {compact && (
            <Link
              href="/dashboard/tenant/inquiries"
              className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <span>View all</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {displayed.map((inq) => {
          const isApproved = inq.status === "approved";
          const isReplied = inq.status === "replied" || Boolean(inq.replyText);
          const isRead = inq.status === "read";

          const statusBadge = isApproved
            ? { label: "Approved & Assigned", icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-800 border-emerald-200" }
            : isReplied
              ? { label: "Agent Replied", icon: MessageCircle, cls: "bg-blue-50 text-blue-800 border-blue-200" }
              : isRead
                ? { label: "Viewed by Agent", icon: Eye, cls: "bg-amber-50 text-amber-800 border-amber-200" }
                : { label: "Inquiry Sent", icon: Clock, cls: "bg-slate-100 text-slate-700 border-slate-200" };

          const StatusIcon = statusBadge.icon;

          return (
            <div
              key={inq.id}
              className={`flex flex-col justify-between rounded-2xl border p-5 transition-all shadow-xs hover:shadow-md ${
                isApproved
                  ? "border-emerald-200 bg-gradient-to-br from-emerald-50/20 via-white to-white"
                  : "border-slate-200 bg-white hover:border-blue-200"
              }`}
            >
              <div>
                {/* Top Badge Row */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-700">
                    {inq.kind === "unit" ? "Condominium Unit" : "Subdivision / House"}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusBadge.cls}`}>
                    <StatusIcon className="h-3 w-3" />
                    <span>{statusBadge.label}</span>
                  </span>
                </div>

                {/* Property Snapshot */}
                <div className="flex items-start gap-3.5">
                  <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-2xs">
                    {inq.imageUrl ? (
                      <Image src={inq.imageUrl} alt={inq.title} fill unoptimized className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-400">
                        {inq.kind === "unit" ? <Layers className="h-7 w-7" /> : <Home className="h-7 w-7" />}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-base font-extrabold text-slate-900">{inq.title}</h4>
                    {inq.address && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 line-clamp-1">
                        <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="truncate">{inq.address}</span>
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-black text-slate-900 text-sm">
                        {inq.rentAmount > 0 ? `${formatCurrency(inq.rentAmount)} /mo` : "Rent upon inquiry"}
                      </span>
                      {inq.agentName && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                          <UserCheck className="h-3 w-3 text-blue-600" />
                          <span>Agent: {inq.agentName}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress Stepper Bar */}
                <div className="mt-4 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                    <span className={inq.status ? "text-blue-700 font-extrabold" : ""}>1. Sent</span>
                    <span className={isRead || isReplied || isApproved ? "text-blue-700 font-extrabold" : ""}>2. Viewed</span>
                    <span className={isReplied || isApproved ? "text-blue-700 font-extrabold" : ""}>3. Replied</span>
                    <span className={isApproved ? "text-emerald-700 font-extrabold" : ""}>4. Approved</span>
                  </div>
                  <div className="relative mt-1.5 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isApproved ? "w-full bg-emerald-600" : isReplied ? "w-3/4 bg-blue-600" : isRead ? "w-1/2 bg-amber-500" : "w-1/4 bg-blue-400"
                      }`}
                    />
                  </div>
                </div>

                {/* Inquiry Message Box */}
                {inq.message && (
                  <div className="mt-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3.5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                      <span className="flex items-center gap-1 text-slate-700">
                        <MessageCircle className="h-3 w-3 text-slate-400" /> Your Inquiry
                      </span>
                      <span>{formatDate(inq.createdAt)}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-800 leading-relaxed italic">
                      &ldquo;{inq.message}&rdquo;
                    </p>
                  </div>
                )}

                {/* Agent Reply Box */}
                {inq.replyText && (
                  <div className="mt-2.5 rounded-2xl border border-blue-200 bg-blue-50/80 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[10px] font-bold text-blue-700 mb-1">
                      <span className="flex items-center gap-1">
                        <UserCheck className="h-3 w-3 text-blue-600" /> Agent Response{inq.agentName ? ` (${inq.agentName})` : ""}
                      </span>
                      {inq.repliedAt && <span className="text-blue-500">{formatDate(inq.repliedAt)}</span>}
                    </div>
                    <p className="text-xs font-semibold text-blue-950 leading-relaxed">
                      {inq.replyText}
                    </p>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <span className="text-[11px] text-slate-400">
                  Ref: {inq.id.slice(0, 10)}
                </span>
                <Link
                  href={inq.kind === "unit" ? "/dashboard/tenant/units" : "/dashboard/tenant/properties-page"}
                  className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800 hover:underline"
                >
                  <span>View in {inq.kind === "unit" ? "Available Units" : "Available Properties"}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

