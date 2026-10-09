"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, UserPlus, Home, Search, CheckCircle2, ClipboardCheck,
  Building2, CalendarDays, Plus, AlertCircle, Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { TenantRecord, Unit, Property, updateTenantAssignment, notifyAdmins } from "@/lib/data";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import { toast } from "sonner";

interface AssignTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenants: TenantRecord[];
  units: Unit[];
  properties: Property[];
  initialTenant?: TenantRecord | null;
  initialUnit?: Unit | null;
  onSuccess: () => Promise<void>;
  onRequestTenantAccount?: () => void;
}

export default function AssignTenantModal({
  isOpen,
  onClose,
  tenants,
  units,
  properties,
  initialTenant = null,
  initialUnit = null,
  onSuccess,
  onRequestTenantAccount,
}: AssignTenantModalProps) {
  const [selectedTenant, setSelectedTenant] = useState<TenantRecord | null>(initialTenant);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(initialUnit);
  const [tenantSearch, setTenantSearch] = useState("");
  const [assignmentPropertyFilter, setAssignmentPropertyFilter] = useState("all");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [assignForm, setAssignForm] = useState({
    propertyName: "",
    unitNumber: "",
    rentAmount: 0,
    contractStart: "",
  });

  // Sync initial selections when modal opens or initial props change
  useEffect(() => {
    if (isOpen) {
      setSelectedTenant(initialTenant);
      setSelectedUnit(initialUnit);
      setTenantSearch("");
      setAssignmentPropertyFilter("all");
    }
  }, [isOpen, initialTenant, initialUnit]);

  // Update assign form when unit changes
  useEffect(() => {
    if (selectedUnit) {
      const prop = properties.find((p) => p.id === selectedUnit.propertyId);
      setAssignForm({
        propertyName: prop?.name || "",
        unitNumber: selectedUnit.unitNumber || "",
        rentAmount: selectedUnit.rentAmount || 0,
        contractStart: new Date().toISOString().slice(0, 10),
      });
    }
  }, [selectedUnit, properties]);

  if (!isOpen) return null;

  const vacantUnits = units.filter((unit) => unit.status === "vacant");
  const filteredVacantUnits = vacantUnits.filter((unit) => {
    if (assignmentPropertyFilter === "all") return true;
    return unit.propertyId === assignmentPropertyFilter;
  });

  // Show unassigned tenants, but if an active tenant was passed as initialTenant, also keep them in list
  const unassignedTenants = tenants.filter(
    (t) => !t.unitId || (selectedTenant && t.id === selectedTenant.id)
  );

  const filteredTenants = unassignedTenants.filter(
    (t) =>
      t.name.toLowerCase().includes(tenantSearch.toLowerCase()) ||
      t.email.toLowerCase().includes(tenantSearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) {
      toast.error("Please select a tenant to assign");
      return;
    }
    if (!selectedUnit) {
      toast.error("Please select a vacant unit");
      return;
    }

    setIsSubmitting(true);
    try {
      const property = properties.find((p) => p.id === selectedUnit.propertyId);
      const propName = assignForm.propertyName || property?.name || "";
      const unitNum = assignForm.unitNumber || selectedUnit.unitNumber;

      const updated = await updateTenantAssignment(selectedTenant.id, {
        unitId: selectedUnit.id,
        propertyName: propName,
        unitNumber: unitNum,
        rentAmount: assignForm.rentAmount || selectedUnit.rentAmount,
        contractStart: assignForm.contractStart || undefined,
        assignmentStatus: "pending",
      });

      if (updated) {
        toast.success("Assignment submitted for owner confirmation!");
        notifyAdmins({
          title: "New Assignment Pending",
          message: `${selectedTenant.name} has been assigned to ${propName} Unit ${unitNum}. Please review and confirm.`,
          type: "tenant",
          read: false,
        }).catch(() => {});

        await onSuccess();
        onClose();
      } else {
        toast.error("Could not complete tenant assignment");
      }
    } catch (err) {
      console.error("Assign tenant error:", err);
      toast.error("Failed to assign tenant");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ type: "spring", damping: 25, stiffness: 320 }}
          className="relative w-full max-w-5xl max-h-[92vh] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-tenant-modal-title"
        >
          {/* Header */}
          <div className="relative border-b border-slate-100 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 px-6 py-5 text-white">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm text-white shadow-inner">
                  <UserPlus className="h-6 w-6" />
                </div>
                <div>
                  <h2 id="assign-tenant-modal-title" className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                    Assign a tenant
                  </h2>
                  <p className="text-xs sm:text-sm text-blue-100 mt-0.5">
                    Select a tenant and assign them to an available unit
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                aria-label="Close dialog"
                className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer z-50 pointer-events-auto"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              {/* Step 1: Select Tenant */}
              <Card className="flex flex-col border-slate-200 shadow-xs">
                <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                        <UserPlus className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-900">Step 1: Select Tenant</CardTitle>
                        <CardDescription className="text-xs text-slate-500">Choose a tenant without a unit assignment</CardDescription>
                      </div>
                    </div>
                    {onRequestTenantAccount && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onClose();
                          onRequestTenantAccount();
                        }}
                        className="h-8 gap-1 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                      >
                        <Plus className="h-3.5 w-3.5" /> Request Account
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-5 flex-1 flex flex-col">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search tenants..."
                      value={tenantSearch}
                      onChange={(e) => setTenantSearch(e.target.value)}
                      className="pl-9 h-9.5 text-xs rounded-lg"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 max-h-72 min-h-[180px] pr-1">
                    {unassignedTenants.length === 0 ? (
                      <div className="text-center py-10 px-4">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                          <UserPlus className="h-5 w-5" />
                        </div>
                        <p className="text-slate-700 font-medium text-xs">No unassigned tenants</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">All tenants have been assigned to units</p>
                      </div>
                    ) : filteredTenants.length === 0 ? (
                      <div className="text-center py-8 px-4">
                        <p className="text-slate-700 font-medium text-xs">No matching tenants</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Try a different search term</p>
                      </div>
                    ) : (
                      filteredTenants.map((tenant) => {
                        const isSelected = selectedTenant?.id === tenant.id;
                        return (
                          <div
                            key={tenant.id}
                            onClick={() => setSelectedTenant(isSelected ? null : tenant)}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                              isSelected
                                ? "border-blue-500 bg-blue-50/80 shadow-xs ring-1 ring-blue-400/40"
                                : "border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                            )}
                          >
                            <Avatar
                              src={tenant.avatarUrl}
                              fallback={getInitials(tenant.name)}
                              size="sm"
                              className={isSelected ? "ring-2 ring-blue-300" : ""}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{tenant.name}</p>
                              <p className="text-xs text-slate-500 truncate">{tenant.email}</p>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Step 2: Select Vacant Unit */}
              <Card className="flex flex-col border-slate-200 shadow-xs">
                <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Home className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-slate-900">Step 2: Select Vacant Unit</CardTitle>
                      <CardDescription className="text-xs text-slate-500">Available units for assignment</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-5 flex-1 flex flex-col">
                  {vacantUnits.length > 0 && (
                    <label className="mb-3 space-y-1 block">
                      <span className="text-xs font-medium text-slate-600">Filter by property</span>
                      <select
                        value={assignmentPropertyFilter}
                        onChange={(event) => setAssignmentPropertyFilter(event.target.value)}
                        aria-label="Filter vacant units by property"
                        className="h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
                      >
                        <option value="all">All properties ({vacantUnits.length} vacant)</option>
                        {properties
                          .filter((property) => vacantUnits.some((unit) => unit.propertyId === property.id))
                          .map((property) => (
                            <option key={property.id} value={property.id}>
                              {property.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}

                  <div className="flex-1 overflow-y-auto space-y-2 max-h-72 min-h-[180px] pr-1">
                    {properties.length === 0 ? (
                      <div className="text-center py-10 px-4">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                          <Home className="h-5 w-5" />
                        </div>
                        <p className="text-slate-700 font-medium text-xs">No properties to assign yet</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Units will be available here after the owner registers a property</p>
                      </div>
                    ) : vacantUnits.length === 0 ? (
                      <div className="text-center py-10 px-4">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                          <Home className="h-5 w-5" />
                        </div>
                        <p className="text-slate-700 font-medium text-xs">No vacant units available</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">No registered units are currently marked vacant</p>
                      </div>
                    ) : filteredVacantUnits.length === 0 ? (
                      <div className="text-center py-8 px-4">
                        <p className="text-slate-700 font-medium text-xs">No vacant units for this property</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Choose another property or select all properties</p>
                      </div>
                    ) : (
                      filteredVacantUnits.map((unit) => {
                        const property = properties.find((p) => p.id === unit.propertyId);
                        const isSelected = selectedUnit?.id === unit.id;
                        return (
                          <div
                            key={unit.id}
                            onClick={() => setSelectedUnit(isSelected ? null : unit)}
                            className={cn(
                              "p-3 rounded-xl border cursor-pointer transition-all",
                              isSelected
                                ? "border-emerald-500 bg-emerald-50/80 shadow-xs ring-1 ring-emerald-400/40"
                                : "border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                  {unit.unitNumber}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900 leading-snug">
                                    {property?.name || "Managed Property"}
                                  </p>
                                  <p className="text-xs text-slate-500">Unit #{unit.unitNumber}</p>
                                </div>
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                              )}
                            </div>
                            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
                              <span className="text-slate-500">Floor {unit.floor || "N/A"}</span>
                              <span className="font-semibold text-emerald-700">{formatCurrency(unit.rentAmount)} / mo</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Step 3: Review & Confirm */}
            {selectedTenant && selectedUnit ? (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Card className="border-blue-200 bg-blue-50/20 shadow-sm">
                  <CardHeader className="p-4 sm:p-5 border-b border-blue-100 bg-blue-50/50">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <ClipboardCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-900">Step 3: Review & Confirm</CardTitle>
                        <CardDescription className="text-xs text-slate-500">Verify the assignment details before submitting</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 space-y-5">
                    {/* Summary row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Selected Tenant</p>
                        <div className="flex items-center gap-3">
                          <Avatar src={selectedTenant.avatarUrl} fallback={getInitials(selectedTenant.name)} size="md" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{selectedTenant.name}</p>
                            <p className="text-xs text-slate-600 truncate">{selectedTenant.email}</p>
                            {selectedTenant.phone && (
                              <p className="text-[11px] text-slate-500">{selectedTenant.phone}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1.5 text-xs">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Selected Unit</p>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Property:</span>
                          <span className="font-semibold text-slate-900">
                            {properties.find((p) => p.id === selectedUnit.propertyId)?.name || "Managed Property"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Unit Number:</span>
                          <span className="font-semibold text-slate-900">#{selectedUnit.unitNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Floor:</span>
                          <span className="font-medium text-slate-700">{selectedUnit.floor || "N/A"}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-100 pt-1">
                          <span className="text-slate-600 font-medium">Monthly Rent:</span>
                          <span className="font-bold text-emerald-700">{formatCurrency(selectedUnit.rentAmount)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Form inputs */}
                    <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-slate-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Property Name
                          </label>
                          <Input
                            value={assignForm.propertyName}
                            onChange={(e) => setAssignForm({ ...assignForm, propertyName: e.target.value })}
                            placeholder="Property name"
                            className="h-9.5 text-xs rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Unit Number
                          </label>
                          <Input
                            value={assignForm.unitNumber}
                            onChange={(e) => setAssignForm({ ...assignForm, unitNumber: e.target.value })}
                            placeholder="Unit number"
                            className="h-9.5 text-xs rounded-lg"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Monthly Rent (₱)
                          </label>
                          <Input
                            type="number"
                            value={assignForm.rentAmount || ""}
                            onChange={(e) => setAssignForm({ ...assignForm, rentAmount: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                            className="h-9.5 text-xs rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Contract Start Date
                          </label>
                          <Input
                            type="date"
                            value={assignForm.contractStart}
                            onChange={(e) => setAssignForm({ ...assignForm, contractStart: e.target.value })}
                            className="h-9.5 text-xs rounded-lg"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-3 pt-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={onClose}
                          disabled={isSubmitting}
                          className="h-10 text-xs px-4"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={isSubmitting}
                          className="h-10 gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 shadow-sm"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Assigning Tenant...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              Assign Tenant & Submit for Confirmation
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-slate-400" />
                  <span>
                    {!selectedTenant && !selectedUnit
                      ? "Select both a tenant and a vacant unit above to proceed to confirmation."
                      : !selectedTenant
                      ? "Please select a tenant in Step 1 to proceed."
                      : "Please select a vacant unit in Step 2 to proceed."}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="h-8 text-xs px-3"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
