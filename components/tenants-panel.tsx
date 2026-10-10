"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, UserPlus, Mail, Phone, MapPin, Eye, Trash2,
  MessageSquare, Pencil, Shield, ShieldOff, Search,
  Copy, MoreHorizontal, ChevronDown, Check, Building2,
  CalendarDays, User, Home, AlertTriangle, X, CheckCircle2, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TenantRecord, Property, Unit, updateTenantStatus, safeParseJson } from "@/lib/data";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { ManagementBanner } from "@/components/management-panel";
import MessagingModal from "@/components/messaging-modal";

interface TenantsPanelProps {
  tenants: TenantRecord[];
  properties: Property[];
  units: Unit[];
  onReload: () => void;
  onCreateTenant: () => void;
}


export default function TenantsPanel({
  tenants,
  properties,
  units,
  onReload,
  onCreateTenant,
}: TenantsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "pending">("all");
  const [viewingTenant, setViewingTenant] = useState<TenantRecord | null>(null);
  const [editingTenant, setEditingTenant] = useState<TenantRecord | null>(null);
  const [deleteTenantTarget, setDeleteTenantTarget] = useState<TenantRecord | null>(null);
  const [messagingTenant, setMessagingTenant] = useState<TenantRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPropertyId, setEditPropertyId] = useState("");
  const [editUnitId, setEditUnitId] = useState("");
  const [editRent, setEditRent] = useState("");
  const [editContractStart, setEditContractStart] = useState("");
  const [editContractEnd, setEditContractEnd] = useState("");

  const filteredTenants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tenants.filter((tenant) => {
      if (statusFilter === "active" && tenant.status !== "active") return false;
      if (statusFilter === "inactive" && tenant.status === "active") return false;
      if (statusFilter === "pending" && tenant.assignmentStatus !== "pending") return false;

      if (!q) return true;
      const haystack = [
        tenant.id,
        tenant.name,
        tenant.email,
        tenant.phone || "",
        tenant.address || "",
        tenant.propertyName || "",
        tenant.unitNumber || "",
        tenant.status,
        tenant.assignmentStatus || "",
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [tenants, searchQuery, statusFilter]);

  const activeCount = useMemo(() => tenants.filter((t) => t.status === "active").length, [tenants]);
  const inactiveCount = useMemo(() => tenants.filter((t) => t.status !== "active").length, [tenants]);
  const pendingCount = useMemo(() => tenants.filter((t) => t.assignmentStatus === "pending").length, [tenants]);

  const handleToggleBlock = async (tenant: TenantRecord) => {
    const nextStatus = tenant.status === "active" ? "inactive" : "active";
    try {
      const res = await updateTenantStatus(tenant.id, nextStatus);
      if (res) {
        toast.success(nextStatus === "active" ? "Tenant unblocked" : "Tenant blocked");
        onReload();
      } else {
        toast.error("Failed to update tenant status");
      }
    } catch {
      toast.error("Failed to update tenant status");
    }
  };

  const handleOpenEdit = (tenant: TenantRecord) => {
    const matchedUnit = units.find((u) => u.id === tenant.unitId);
    setEditingTenant(tenant);
    setEditName(tenant.name || "");
    setEditPhone(tenant.phone || "");
    setEditAddress(tenant.address || "");
    setEditPropertyId(matchedUnit?.propertyId || "");
    setEditUnitId(tenant.unitId || "");
    setEditRent(tenant.rentAmount != null ? String(tenant.rentAmount) : "");
    setEditContractStart(tenant.contractStart || "");
    setEditContractEnd(tenant.contractEnd || "");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/data/tenants`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: editingTenant.id,
          tenantId: editingTenant.id,
          name: editName,
          phone: editPhone,
          address: editAddress,
          propertyId: editPropertyId || undefined,
          unitId: editUnitId || undefined,
          rentAmount: editRent ? Number(editRent) : undefined,
          contractStart: editContractStart || undefined,
          contractEnd: editContractEnd || undefined,
        }),
      });
      const data = await safeParseJson(res);
      if (data.success) {
        toast.success("Tenant updated successfully");
        setEditingTenant(null);
        onReload();
      } else {
        toast.error(data.error || "Failed to update tenant");
      }
    } catch {
      toast.error("An error occurred while updating tenant");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTenant = async () => {
    if (!deleteTenantTarget) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/data/tenants?id=${deleteTenantTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await safeParseJson(res);
      if (data.success) {
        toast.success("Tenant removed successfully");
        setDeleteTenantTarget(null);
        onReload();
      } else {
        toast.error(data.error || "Failed to remove tenant");
      }
    } catch {
      toast.error("An error occurred while deleting tenant");
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableUnitsForProperty = useMemo(() => {
    if (!editPropertyId) return [];
    return units.filter((u) => u.propertyId === editPropertyId);
  }, [units, editPropertyId]);


  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Hero ManagementBanner */}
      <ManagementBanner
        category="TENANT MANAGEMENT"
        title="Tenant Directory"
        description="Manage tenants, assignments, lease contracts, and status controls."
        icon={User}
      />

      {/* Toolbar & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          {/* Status Dropdown Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <span>
                  {statusFilter === "all"
                    ? `All tenants (${tenants.length})`
                    : statusFilter === "active"
                    ? `Active tenants (${activeCount})`
                    : statusFilter === "inactive"
                    ? `Blocked / Inactive (${inactiveCount})`
                    : `Pending assignment (${pendingCount})`}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
              <DropdownMenuItem
                onSelect={() => setStatusFilter("all")}
                className="flex items-center justify-between text-xs cursor-pointer"
              >
                <span>All tenants</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                  {tenants.length}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setStatusFilter("active")}
                className="flex items-center justify-between text-xs cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Active tenants
                </span>
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  {activeCount}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setStatusFilter("inactive")}
                className="flex items-center justify-between text-xs cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  Blocked / Inactive
                </span>
                <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                  {inactiveCount}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setStatusFilter("pending")}
                className="flex items-center justify-between text-xs cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  Pending assignment
                </span>
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  {pendingCount}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, phone, unit..."
              className="h-9 pl-8 pr-8 text-xs border-slate-200 bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={onCreateTenant}
            className="h-9 gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3.5 text-xs font-semibold text-white shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            Create Tenant
          </Button>
        </div>
      </div>

      {/* Supabase Database Table */}
      <div className="w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
              tenants table
            </span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-700">
              {filteredTenants.length} {filteredTenants.length === 1 ? "record" : "records"}
            </span>
          </div>
        </div>

        {filteredTenants.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Users className="mx-auto mb-3 h-9 w-9 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">{tenants.length ? "No tenants match this filter" : "No tenants yet"}</p>
            <p className="mt-1 text-xs text-slate-500">{tenants.length ? "Try another search or status filter." : "Click 'Create Tenant' to register your first tenant."}</p>
          </div>
        ) : (
          <div className="table-scroll-box w-full max-w-full min-w-0 overflow-x-auto overflow-y-auto max-h-[680px]">
            <table className="w-full min-w-[1400px] border-collapse text-left text-xs text-slate-800">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur-xs text-[11px] font-semibold uppercase tracking-wider text-slate-600 whitespace-nowrap shadow-2xs">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold text-slate-700">Tenant</th>
                  <th scope="col" className="px-3 py-3 font-semibold text-slate-700">User ID</th>
                  <th scope="col" className="px-3 py-3 font-semibold text-slate-700">Email</th>
                  <th scope="col" className="px-3 py-3 font-semibold text-slate-700">Phone</th>
                  <th scope="col" className="px-3 py-3 font-semibold text-slate-700">Role</th>
                  <th scope="col" className="px-3 py-3 font-semibold text-slate-700">Property</th>
                  <th scope="col" className="px-3 py-3 font-semibold text-slate-700">Unit</th>
                  <th scope="col" className="px-3 py-3 font-semibold text-slate-700">Address</th>
                  <th scope="col" className="px-3 py-3 font-semibold text-slate-700">Rent</th>
                  <th scope="col" className="px-3 py-3 font-semibold text-slate-700">Lease Term</th>
                  <th scope="col" className="px-3 py-3 font-semibold text-slate-700">Status</th>
                  <th scope="col" className="px-3 py-3 font-semibold text-slate-700">Joined</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTenants.map((tenant) => {
                  const isBlocked = tenant.status !== "active";
                  const isConfirmed = tenant.assignmentStatus === "confirmed";
                  const isPending = tenant.assignmentStatus === "pending";

                  return (
                    <tr key={tenant.id} className="group hover:bg-slate-50/80 transition-colors">
                      {/* Tenant */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="relative shrink-0">
                            <Avatar src={tenant.avatarUrl} fallback={getInitials(tenant.name)} size="sm" />
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center">
                              <span
                                className={`relative inline-flex h-2 w-2 rounded-full border border-white ${
                                  isBlocked ? "bg-red-400" : "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"
                                }`}
                              />
                            </span>
                          </div>
                          <span className="font-semibold text-slate-900 capitalize truncate max-w-[150px] text-xs">
                            {tenant.name}
                          </span>
                        </div>
                      </td>

                      {/* User ID */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <button
                          type="button"
                          aria-label={`Copy tenant ID for ${tenant.name}`}
                          title="Copy tenant ID"
                          onClick={() => {
                            navigator.clipboard?.writeText(tenant.id).then(
                              () => toast.success("Tenant ID copied"),
                              () => toast.error("Could not copy tenant ID")
                            );
                          }}
                          className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 hover:text-blue-600 transition-colors bg-slate-50 px-2 py-0.5 rounded border border-slate-200"
                        >
                          <span>#{tenant.id.slice(0, 8)}</span>
                          <Copy className="h-2.5 w-2.5 text-slate-400" />
                        </button>
                      </td>

                      {/* Email */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <a href={`mailto:${tenant.email}`} className="inline-flex items-center gap-1.5 text-blue-600 hover:underline truncate max-w-[160px] text-xs" title={tenant.email}>
                          <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate">{tenant.email}</span>
                        </a>
                      </td>

                      {/* Phone */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                          <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                          {tenant.phone ? (
                            <a href={`tel:${tenant.phone}`} className="hover:text-blue-600 transition-colors">
                              {tenant.phone}
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                          Tenant
                        </span>
                      </td>

                      {/* Property */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-900 truncate max-w-[140px]">
                            {tenant.propertyName || "No Property Assigned"}
                          </span>
                        </div>
                      </td>

                      {/* Unit */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        {tenant.unitNumber ? (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
                            Unit {tenant.unitNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Address */}
                      <td className="px-3 py-3.5 whitespace-nowrap max-w-[160px]">
                        <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 truncate">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate" title={tenant.address || "No address provided"}>
                            {tenant.address || <span className="text-slate-400 italic">No address provided</span>}
                          </span>
                        </div>
                      </td>

                      {/* Rent */}
                      <td className="px-3 py-3.5 whitespace-nowrap text-xs font-semibold text-emerald-700">
                        {tenant.rentAmount != null && tenant.rentAmount > 0 ? (
                          <span>₱{tenant.rentAmount.toLocaleString()} / mo</span>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>

                      {/* Lease Term */}
                      <td className="px-3 py-3.5 text-slate-600 whitespace-nowrap">
                        {tenant.contractStart || tenant.contractEnd ? (
                          <div className="flex flex-col gap-0.5 text-[11px]">
                            <span className="font-medium text-slate-800">
                              {tenant.contractStart ? formatDate(tenant.contractStart) : "—"}
                            </span>
                            <span className="text-slate-400">
                              to {tenant.contractEnd ? formatDate(tenant.contractEnd) : "Ongoing"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              tenant.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                tenant.status === "active" ? "bg-emerald-500" : "bg-red-500"
                              }`}
                            />
                            {tenant.status === "active" ? "Active" : "Blocked"}
                          </span>
                          {tenant.assignmentStatus && (
                            <span
                              className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                                isConfirmed
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : isPending
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {tenant.assignmentStatus}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Joined */}
                      <td className="px-3 py-3.5 text-slate-500 whitespace-nowrap text-[11px]">
                        {tenant.createdAt ? formatDate(tenant.createdAt) : "—"}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              aria-label={`Actions for ${tenant.name}`}
                              className="group/dotbtn h-8 w-8 shrink-0 border-slate-200 text-slate-600 transition-all duration-200 hover:scale-110 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 active:scale-95 focus-visible:ring-1 focus-visible:ring-blue-500"
                            >
                              <MoreHorizontal className="h-4 w-4 transition-transform duration-200 group-hover/dotbtn:rotate-90" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" side="bottom" className="w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                            <DropdownMenuItem
                              onSelect={() => setViewingTenant(tenant)}
                              className="flex items-center gap-2 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer p-2 rounded-lg"
                            >
                              <Eye className="h-3.5 w-3.5 text-blue-500" />
                              <span>View details</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => handleOpenEdit(tenant)}
                              className="flex items-center gap-2 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer p-2 rounded-lg"
                            >
                              <Pencil className="h-3.5 w-3.5 text-amber-500" />
                              <span>Edit tenant</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => setMessagingTenant(tenant)}
                              className="flex items-center gap-2 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer p-2 rounded-lg"
                            >
                              <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                              <span>Message</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => handleToggleBlock(tenant)}
                              className={`flex items-center gap-2 text-xs cursor-pointer p-2 rounded-lg ${
                                tenant.status === "active" ? "text-amber-700 hover:bg-amber-50" : "text-emerald-700 hover:bg-emerald-50"
                              }`}
                            >
                              {tenant.status === "active" ? (
                                <>
                                  <ShieldOff className="h-3.5 w-3.5 text-amber-500" />
                                  <span>Block tenant</span>
                                </>
                              ) : (
                                <>
                                  <Shield className="h-3.5 w-3.5 text-emerald-500" />
                                  <span>Unblock tenant</span>
                                </>
                              )}
                            </DropdownMenuItem>
                            <div className="my-1 border-t border-slate-100" />
                            <DropdownMenuItem
                              onSelect={() => setDeleteTenantTarget(tenant)}
                              className="flex items-center gap-2 text-xs text-red-600 hover:bg-red-50 cursor-pointer p-2 rounded-lg"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              <span>Delete tenant</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Tenant Modal */}
      <AnimatePresence>
        {viewingTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-4">
                <div className="flex items-center gap-3">
                  <Avatar src={viewingTenant.avatarUrl} fallback={getInitials(viewingTenant.name)} size="md" />
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{viewingTenant.name}</h3>
                    <p className="font-mono text-xs text-slate-500">{viewingTenant.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingTenant(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Email</p>
                    <p className="mt-1 font-mono text-slate-800 break-all">{viewingTenant.email}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Phone</p>
                    <p className="mt-1 font-mono text-slate-800">{viewingTenant.phone || "—"}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Address</p>
                  <p className="mt-1 font-medium text-slate-800">{viewingTenant.address || "No address provided"}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Property</p>
                    <p className="mt-1 font-medium text-slate-800">{viewingTenant.propertyName || "Unassigned"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Unit Number</p>
                    <p className="mt-1 font-mono font-semibold text-slate-800">{viewingTenant.unitNumber ? `Unit ${viewingTenant.unitNumber}` : "—"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Monthly Rent</p>
                    <p className="mt-1 font-mono font-bold text-slate-900">
                      {viewingTenant.rentAmount ? `₱${viewingTenant.rentAmount.toLocaleString()}` : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Status</p>
                    <Badge
                      variant={viewingTenant.status === "active" ? "default" : "destructive"}
                      className="mt-1 text-[10px] uppercase font-bold"
                    >
                      {viewingTenant.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Contract Start</p>
                    <p className="mt-1 font-mono text-slate-800">{viewingTenant.contractStart ? formatDate(viewingTenant.contractStart) : "—"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Contract End</p>
                    <p className="mt-1 font-mono text-slate-800">{viewingTenant.contractEnd ? formatDate(viewingTenant.contractEnd) : "—"}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingTenant(null)}
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Tenant Modal */}
      <AnimatePresence>
        {editingTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900">Edit Tenant</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTenant(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block mb-1 font-semibold text-slate-700">Full Name</label>
                  <Input
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-semibold text-slate-700">Phone</label>
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="e.g. 09123456789"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-semibold text-slate-700">Address</label>
                  <Input
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="Tenant residential address"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 font-semibold text-slate-700">Property</label>
                    <select
                      value={editPropertyId}
                      onChange={(e) => {
                        setEditPropertyId(e.target.value);
                        setEditUnitId("");
                      }}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800"
                    >
                      <option value="">No property</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 font-semibold text-slate-700">Unit</label>
                    <select
                      value={editUnitId}
                      onChange={(e) => setEditUnitId(e.target.value)}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800"
                      disabled={!editPropertyId}
                    >
                      <option value="">No unit</option>
                      {availableUnitsForProperty.map((u) => (
                        <option key={u.id} value={u.id}>
                          Unit {u.unitNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block mb-1 font-semibold text-slate-700">Monthly Rent (₱)</label>
                  <Input
                    type="number"
                    value={editRent}
                    onChange={(e) => setEditRent(e.target.value)}
                    className="h-9 text-xs font-mono"
                    placeholder="15000"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 font-semibold text-slate-700">Contract Start</label>
                    <Input
                      type="date"
                      value={editContractStart}
                      onChange={(e) => setEditContractStart(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-semibold text-slate-700">Contract End</label>
                    <Input
                      type="date"
                      value={editContractEnd}
                      onChange={(e) => setEditContractEnd(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => setEditingTenant(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTenantTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm overflow-hidden rounded-2xl border border-red-200 bg-white p-5 shadow-2xl text-center"
            >
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Tenant</h3>
              <p className="mt-1 text-xs text-slate-500">
                Are you sure you want to delete <span className="font-semibold text-slate-800">{deleteTenantTarget.name}</span>? This action cannot be undone.
              </p>

              <div className="mt-5 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={isSubmitting}
                  onClick={() => setDeleteTenantTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={handleDeleteTenant}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {isSubmitting ? "Deleting..." : "Delete Tenant"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Messaging Modal */}
      {messagingTenant && (
        <MessagingModal
          isOpen={!!messagingTenant}
          onClose={() => setMessagingTenant(null)}
          otherUser={{
            id: messagingTenant.id,
            name: messagingTenant.name,
            email: messagingTenant.email,
            role: "tenant",
            avatarUrl: messagingTenant.avatarUrl,
            allowMessages: true,
          }}
          properties={properties}
        />
      )}
    </motion.div>
  );
}
