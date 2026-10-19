"use client";

import { useEffect, useState } from "react";
import { History, User, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { formatCurrency } from "@/lib/utils";

type HistoryRow = {
  id: string;
  unitId: string | null;
  propertyName: string | null;
  unitNumber: string | null;
  tenantName: string | null;
  tenantEmail: string | null;
  rentAmount: number | null;
  startDate: string | null;
  endDate: string | null;
};

const fmt = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

export function TenancyHistoryModal({
  isOpen,
  onClose,
  title,
  unitId,
  propertyId,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  unitId?: string;
  propertyId?: string;
}) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const params = new URLSearchParams();
    if (unitId) params.set("unitId", unitId);
    if (propertyId) params.set("propertyId", propertyId);
    let active = true;
    setLoading(true);
    fetch(`/api/data/tenancy-history?${params.toString()}`, { credentials: "include", cache: "no-store" })
      .then((res) => res.json())
      .then((data) => { if (active) setRows(Array.isArray(data.history) ? data.history : []); })
      .catch(() => { if (active) setRows([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, unitId, propertyId]);

  const showUnit = !unitId;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} description="Tenants who occupied this space, with move-in and move-out dates." className="max-w-3xl">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading history...
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-slate-500">
          <History className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">No tenancy history yet</p>
          <p className="text-xs">Tenants will appear here once they are assigned and move in.</p>
        </div>
      ) : (
        <div className="max-h-[55vh] overflow-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-[11px] font-semibold text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Tenant</th>
                {showUnit && <th className="px-3 py-2.5">Unit</th>}
                <th className="px-3 py-2.5">Rent</th>
                <th className="px-3 py-2.5">Start date</th>
                <th className="px-3 py-2.5">Move-out date</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const current = !row.endDate;
                return (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 shrink-0 text-blue-600" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{row.tenantName || "Unknown tenant"}</p>
                          {row.tenantEmail && <p className="truncate text-[10px] text-slate-500">{row.tenantEmail}</p>}
                        </div>
                      </div>
                    </td>
                    {showUnit && (
                      <td className="px-3 py-2.5 text-slate-700">
                        {row.unitNumber || "—"}
                        {row.propertyName && <span className="block text-[10px] text-slate-400">{row.propertyName}</span>}
                      </td>
                    )}
                    <td className="px-3 py-2.5 tabular-nums text-slate-700">{formatCurrency(Number(row.rentAmount) || 0)}</td>
                    <td className="px-3 py-2.5 text-slate-700">{fmt(row.startDate)}</td>
                    <td className="px-3 py-2.5 text-slate-700">{fmt(row.endDate)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${current ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                        {current ? "Current" : "Moved out"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
