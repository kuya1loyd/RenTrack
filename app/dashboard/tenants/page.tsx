"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Users, Search, CheckCircle2, XCircle, Trash2, Shield, Eye, X, MoreHorizontal
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getTenants, safeParseJson, TenantRecord, addNotification } from "@/lib/data";
import { toast } from "sonner";

const fadeInUp = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function TenantsPage() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [tenantStatusFilter, setTenantStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<TenantRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TenantRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showIdModal, setShowIdModal] = useState(false);
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", phone: "", address: "", role: "tenant" as "tenant" | "agent" | "owner" });
  const [creating, setCreating] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const canVerify = user && (user.role === "admin" || user.role === "owner" || user.role === "agent");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const records = await getTenants(user);
        setTenants(records);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredTenants = tenants.filter((t) =>
    `${t.name} ${t.email} ${t.phone || ""} ${t.propertyName || ""} ${t.unitNumber || ""}`.toLowerCase().includes(searchTerm.trim().toLowerCase()) &&
    (tenantStatusFilter === "all" || t.status === tenantStatusFilter)
  );

  const handleVerify = async (tenantId: string, status: "approved" | "rejected") => {
    try {
      const res = await fetch("/api/auth/verify-id", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: tenantId, status }),
      });
      const result = await safeParseJson(res);
      if (result.success) {
        toast.success(`ID verification ${status}`);
        setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, idVerificationStatus: status } : t));
        if (selectedTenant?.id === tenantId) {
          setSelectedTenant(prev => prev ? { ...prev, idVerificationStatus: status } : null);
        }
      } else {
        toast.error(result.error || "Failed to update verification");
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/data/tenants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: deleteTarget.id }),
      });
      const result = await safeParseJson(res);
      if (result.success) {
        toast.success("Tenant deleted successfully");
        setTenants(prev => prev.filter(t => t.id !== deleteTarget.id));
        setDeleteTarget(null);
        if (selectedTenant?.id === deleteTarget.id) setSelectedTenant(null);
      } else {
        toast.error(result.error || "Failed to delete tenant");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name || !createForm.email || !createForm.password) {
      toast.error("Name, email, and password are required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createForm),
      });
      const result = await safeParseJson(res);
      if (result.success) {
        if (result.emailSent) {
          toast.success(`Account created. Login details were emailed to ${createForm.email}.`);
        } else {
          toast.error(result.emailStatus === "not_configured"
            ? "Account created, but no login email was sent because SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS."
            : "Account created, but the login email could not be delivered. Check SMTP settings and server logs.");
        }
        setCreateForm({ name: "", email: "", password: "", phone: "", address: "", role: "tenant" });
        setShowCreateTenant(false);
        const records = await getTenants(user);
        setTenants(records);
      } else {
        toast.error(result.error || "Failed to create account");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setCreating(false);
    }
  };

  const activeCount = tenants.filter((t) => t.status === "active").length;
  const avgRent = tenants.length > 0 ? tenants.reduce((s, t) => s + (t.rentAmount || 0), 0) / tenants.length : 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-4">
      <section className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-[#eaf3ff] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Resident management</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Tenants</h2>
          <p className="mt-1 text-xs text-slate-600">Review tenant profiles, lease dates, status, and rent.</p>
        </div>
        <Button onClick={() => setShowCreateTenant(true)} className="h-9 bg-blue-700 text-white hover:bg-blue-800">
          <Users className="h-4 w-4 mr-2" />
          Create Tenant
        </Button>
      </section>

      <div className="flex flex-col gap-2 rounded-xl border border-[#dce8f5] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:p-4">
        <label className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search tenants, properties, or unit..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-9 rounded-lg border-slate-200 pl-9" aria-label="Search tenants" />
        </label>
        <select aria-label="Filter tenants by status" value={tenantStatusFilter} onChange={(event) => setTenantStatusFilter(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { label: "Total tenants", value: tenants.length, tone: "text-blue-700 bg-blue-50" },
          { label: "Active", value: activeCount, tone: "text-emerald-700 bg-emerald-50" },
          { label: "Inactive", value: tenants.length - activeCount, tone: "text-slate-700 bg-slate-100" },
          { label: "Average rent", value: formatCurrency(avgRent), tone: "text-amber-700 bg-amber-50" },
        ].map((stat, i) => (
          <Card key={i} className="border-[#dce8f5] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]"><CardContent className="flex items-center justify-between gap-2 p-3 sm:p-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
              <p className="mt-1 truncate text-base font-bold tabular-nums text-slate-900 sm:text-lg">{stat.value}</p>
            </div>
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", stat.tone)}><Users className="h-4 w-4" /></span>
          </CardContent></Card>
        ))}
      </div>

      <div className="space-y-4">
        <Card className="overflow-hidden border-[#dce8f5] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="border-b border-slate-100 bg-[#f6f9fd] px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Tenant directory</h3>
            <p className="mt-1 text-xs text-slate-500">{filteredTenants.length} tenant{filteredTenants.length === 1 ? "" : "s"} match your filters</p>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div role="status" className="px-4 py-10 text-center text-sm text-slate-500">
                <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                Loading tenants…
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                <p className="text-xs text-slate-600">No tenants match these filters.</p>
              </div>
            ) : (
              <>
                <table className="hidden w-full min-w-[760px] border-collapse text-left sm:table">
                  <thead className="bg-white text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <tr><th className="px-4 py-3">Tenant</th><th className="px-4 py-3">Property / unit</th><th className="px-4 py-3">Contract dates</th><th className="px-4 py-3">Monthly rent</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTenants.map((tenant) => (
                      <tr key={tenant.id} className={cn("text-xs transition-colors hover:bg-blue-50/40", selectedTenant?.id === tenant.id && "bg-blue-50/70")}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar src={tenant.avatarUrl} fallback={getInitials(tenant.name)} size="sm" />
                            <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{tenant.name}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{tenant.email}</p></div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><p className="font-medium text-slate-800">{tenant.propertyName || "—"}</p><p className="mt-0.5 text-[10px] text-slate-500">{tenant.unitNumber ? `Unit ${tenant.unitNumber}` : "—"}</p></td>
                        <td className="px-4 py-3 text-[10px] text-slate-600"><p>Start: {tenant.contractStart ? formatDate(tenant.contractStart) : "—"}</p><p className="mt-0.5">End: {tenant.contractEnd ? formatDate(tenant.contractEnd) : "—"}</p></td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-slate-900">{tenant.rentAmount != null ? `${formatCurrency(tenant.rentAmount)}/mo` : "—"}</td>
                        <td className="px-4 py-3"><Badge variant={tenant.status === "active" ? "success" : "outline"} className="text-[10px] capitalize">{tenant.status}</Badge></td>
                        <td className="px-4 py-3 text-right"><Button type="button" size="sm" variant="outline" className="h-7 px-2.5 text-[10px]" onClick={() => setSelectedTenant(tenant)}><Eye className="mr-1 h-3 w-3" />Details</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="divide-y divide-slate-100 sm:hidden">
                  {filteredTenants.map((tenant) => (
                    <button key={tenant.id} type="button" onClick={() => setSelectedTenant(tenant)} className={cn("flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-blue-50/40", selectedTenant?.id === tenant.id && "bg-blue-50/70")}>
                      <Avatar src={tenant.avatarUrl} fallback={getInitials(tenant.name)} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-slate-900">{tenant.name}</span><Badge variant={tenant.status === "active" ? "success" : "outline"} className="text-[10px] capitalize">{tenant.status}</Badge></span>
                        <span className="mt-0.5 block truncate text-[10px] text-slate-500">{tenant.propertyName || "No property"} · {tenant.unitNumber ? `Unit ${tenant.unitNumber}` : "No unit"}</span>
                        <span className="mt-1 block text-[10px] text-slate-500">Lease {tenant.contractStart ? formatDate(tenant.contractStart) : "—"} – {tenant.contractEnd ? formatDate(tenant.contractEnd) : "—"}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>

        {selectedTenant && <Card className="flex flex-col overflow-hidden border-[#dce8f5] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          {selectedTenant ? (
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar src={selectedTenant.avatarUrl} fallback={selectedTenant.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)} size="lg" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{selectedTenant.name}</h3>
                    <p className="text-sm text-text-secondary">{selectedTenant.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedTenant.idVerificationStatus && (
                    <Badge variant="outline" className={cn(
                      "text-[10px] px-1.5 py-0",
                      selectedTenant.idVerificationStatus === "approved" ? "bg-green-50 text-green-600 border-green-200" :
                      selectedTenant.idVerificationStatus === "rejected" ? "bg-red-50 text-red-600 border-red-200" :
                      "bg-yellow-50 text-yellow-600 border-yellow-200"
                    )}>
                      ID: {selectedTenant.idVerificationStatus}
                    </Badge>
                  )}
                  {canVerify && (
                    <div className="relative" ref={dropdownRef}>
                      <Button variant="ghost" size="sm" onClick={() => setOpenDropdownId(openDropdownId === selectedTenant.id ? null : selectedTenant.id)}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                      <AnimatePresence>
                        {openDropdownId === selectedTenant.id && (
                          <motion.div
                            initial={{ opacity: 0, y: -5, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -5, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-20"
                          >
                            <button
                              onClick={() => {
                                addNotification({
                                  userId: selectedTenant.id,
                                  title: "ID Verification Required",
                                  message: "Please upload a valid ID to verify your identity and enable booking/reservation features.",
                                  type: "id_verification",
                                  read: false,
                                }).then(() => toast.success("ID verification request sent to tenant")).catch(() => toast.error("Failed to send notification"));
                                setOpenDropdownId(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Shield className="h-4 w-4 text-blue-500" />
                              Request ID
                            </button>
                            <button
                              onClick={() => { setOpenDropdownId(null); setDeleteTarget(selectedTenant); }}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Phone</label>
                    <p className="text-sm font-medium text-foreground">{selectedTenant.phone || "Not set"}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Address</label>
                    <p className="text-sm font-medium text-foreground">{selectedTenant.address || "Not set"}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Property</label>
                    <p className="text-sm font-medium text-foreground">{selectedTenant.propertyName || "-"}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Unit Number</label>
                    <p className="text-sm font-medium text-foreground">{selectedTenant.unitNumber ? `Unit Number: ${selectedTenant.unitNumber}` : "-"}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Rent Amount</label>
                    <p className="text-sm font-medium text-foreground">{formatCurrency(selectedTenant.rentAmount || 0)}/mo</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Status</label>
                    <Badge variant="outline" className={cn(
                      "text-[10px] px-1.5 py-0 capitalize",
                      selectedTenant.status === "active" ? "bg-green-50 text-green-600 border-green-200" : "bg-gray-50 text-gray-600 border-gray-200"
                    )}>{selectedTenant.status}</Badge>
                  </div>
                </div>

                {selectedTenant.idVerificationUrl && (
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-2">ID Verification</label>
                    <div
                      onClick={() => setShowIdModal(true)}
                      className="relative rounded-xl border border-border overflow-hidden cursor-pointer group"
                    >
                      <Image
                        src={selectedTenant.idVerificationUrl}
                        alt="ID Verification"
                        width={640}
                        height={480}
                        unoptimized
                        className="w-full h-auto max-h-[40vh] object-contain bg-gray-50 blur-sm group-hover:blur-none transition-all duration-300"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/5 transition-colors">
                        <div className="h-10 w-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                          <Eye className="h-5 w-5 text-gray-700" />
                        </div>
                      </div>
                    </div>
                    {canVerify && selectedTenant.idVerificationStatus === "pending" && selectedTenant.idVerificationUrl && (
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" onClick={() => handleVerify(selectedTenant.id, "approved")} className="bg-green-600 hover:bg-green-700">
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleVerify(selectedTenant.id, "rejected")} className="text-red-600 hover:text-red-700">
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-text-secondary">Select a tenant to view details</p>
              </div>
            </div>
          )}
        </Card>}

        <AnimatePresence>
          {showIdModal && selectedTenant?.idVerificationUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setShowIdModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative bg-white rounded-2xl shadow-2xl p-4 max-w-3xl max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowIdModal(false)}
                  className="absolute top-4 right-4 h-8 w-8 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center transition-colors z-10"
                >
                  <X className="h-4 w-4" />
                </button>
                <Image
                  src={selectedTenant.idVerificationUrl}
                  alt="ID Verification"
                  width={1280}
                  height={960}
                  unoptimized
                  className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Tenant">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button>
            <Button onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showCreateTenant} onClose={() => setShowCreateTenant(false)} title="Create Tenant Account">
        <form onSubmit={handleCreateTenant} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Full Name</label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              placeholder="Juan Dela Cruz"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Email Address</label>
            <input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              placeholder="juan@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Password</label>
            <input
              type="text"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              placeholder="Min. 8 characters"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Phone Number</label>
            <input
              type="tel"
              value={createForm.phone}
              onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              placeholder="+63 917 123 4567"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Address</label>
            <input
              type="text"
              value={createForm.address}
              onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              placeholder="Street, City, Province"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowCreateTenant(false)} disabled={creating} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={creating} className="flex-1 bg-blue-600 hover:bg-blue-700">
              {creating ? "Creating..." : "Create Account"}
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
