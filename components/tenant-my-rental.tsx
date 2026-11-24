"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Building2, CalendarDays, CheckCircle2, Clock, Home, Layers, MapPin } from "lucide-react";
import type { Property, Unit } from "@/lib/data";
import { safeParseJson } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/utils";

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

export interface MyRentalState {
  loading: boolean;
  error: boolean;
  assignment: MyRentalAssignment | null;
  unit: Unit | null;
  property: Property | null;
  reload: () => void;
}

/** Reads the tenant's own assigned unit / property straight from the database. */
export function useMyRental(enabled = true): MyRentalState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [assignment, setAssignment] = useState<MyRentalAssignment | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [property, setProperty] = useState<Property | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setError(false);
    try {
      const res = await fetch("/api/data/tenants/me", { credentials: "include", cache: "no-store" });
      const data = await safeParseJson(res);
      if (!res.ok || !data.success) throw new Error(data.error || "Failed");
      setAssignment(data.assignment || null);
      setUnit(data.unit || null);
      setProperty(data.property || null);
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

  return { loading, error, assignment, unit, property, reload: load };
}

export function MyRentalCard({ state, filter = "all" }: { state: MyRentalState; filter?: "all" | "unit" | "property" }) {
  const { loading, assignment, unit, property } = state;

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-500 shadow-xs">
        Loading your rental…
      </div>
    );
  }

  const hasAssignment = Boolean(assignment && (assignment.unitId || assignment.propertyName || assignment.unitNumber));
  const kind = unit ? "unit" : property ? "property" : assignment?.kind || null;

  if (!hasAssignment || (filter !== "all" && kind && kind !== filter)) {
    if (filter !== "all" && hasAssignment) return null;
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
    ? `${unitNumber ? `Unit ${String(unitNumber).replace(/^unit\s*/i, "")}` : "Condo Unit"} – ${buildingName}`
    : buildingName;
  const address = unit
    ? [unit.address, unit.city, unit.province].filter(Boolean).join(", ")
    : property?.location || "";
  const rent = assignment?.rentAmount || unit?.rentAmount || property?.monthlyRevenue || 0;
  const amenities: string[] = Array.from(
    new Set([...(((unit as any)?.amenities as string[]) || []), ...(((unit as any)?.features as string[]) || []), ...((property?.features as string[]) || [])])
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
            {isConfirmed ? "Your Home" : "Awaiting Owner Approval"}
          </span>
        </div>
        <div className="flex-1 p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
            {kind === "unit" ? "My Condominium Unit" : "My House / Property"}
          </p>
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
                {isConfirmed ? "Active" : "Pending"}
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
              <Building2 className="h-3.5 w-3.5" /> The owner still needs to approve this assignment.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
