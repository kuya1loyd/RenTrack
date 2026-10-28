"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Building2, Plus, Search, MapPin, Home, Users, DollarSign, Edit, Trash2, Eye, X, Check, Upload, History as HistoryIcon, Wrench, RotateCcw,
} from "lucide-react";
import { TenancyHistoryModal } from "@/components/tenancy-history-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Modal } from "@/components/ui/modal";
import { AnimatedFilterDropdown } from "@/components/ui/animated-filter-dropdown";
import { cn, formatCurrency } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getProperties, getUnits, addProperty, deleteProperty, safeParseJson, Property, Unit, notifyAdmins, PROPERTY_MAINTENANCE_REASONS } from "@/lib/data";
import { toast } from "sonner";
import UnitImageCarousel from "@/components/unit-image-carousel";

const fadeInUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };
const PROPERTY_FEATURES = ["1 Bedroom", "2 Bedrooms", "3 Bedrooms", "4+ Bedrooms", "1 Bathroom", "2 Bathrooms", "3+ Bathrooms", "Parking Space", "Furnished", "Air Conditioning", "Wi-Fi", "Laundry Area", "Kitchen", "Outdoor Area", "Gated Property"];
const PROPERTY_CONDITIONS = ["Excellent – Ready to Move In", "Very Good – Well Maintained", "Good – Minor Wear and Tear", "Fair – Some Repairs Needed", "Needs Improvement – Repairs Required"];
const AVAILABILITY_STATUSES = ["Available", "Occupied", "Reserved", "Under Maintenance"] as const;

const initialFormData = {
  name: "",
  location: "",
  latitude: "",
  longitude: "",
  monthlyRevenue: 0,
  type: "house" as "house" | "residential" | "building" | "condominium" | string,
  units: 0,
  features: [] as string[],
  condition: "",
  availabilityStatus: "Available" as typeof AVAILABILITY_STATUSES[number],
  maintenanceReason: PROPERTY_MAINTENANCE_REASONS[0] as string,
  imageUrl: "",
};

function FeaturePicker({ value, onChange }: { value: string[]; onChange: (features: string[]) => void }) {
  return <div className="rounded-xl border border-border bg-surface-secondary p-3">
    <select value="" onChange={(e) => e.target.value && onChange(value.includes(e.target.value) ? value : [...value, e.target.value])} className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm">
      <option value="">Select features...</option>
      {PROPERTY_FEATURES.filter((feature) => !value.includes(feature)).map((feature) => <option key={feature} value={feature}>{feature}</option>)}
    </select>
    {value.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{value.map((feature) => <button type="button" key={feature} onClick={() => onChange(value.filter((item) => item !== feature))} className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200">{feature} <span aria-hidden="true">x</span></button>)}</div>}
  </div>;
}

export default function PropertiesPage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [maintenanceReasonFilter, setMaintenanceReasonFilter] = useState("all");
  const [, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [historyProperty, setHistoryProperty] = useState<Property | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [propertyImage, setPropertyImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const canManage = user && (user.role === "admin" || user.role === "owner");

  useEffect(() => {
    (async () => {
      try {
        const [props, unitsData] = await Promise.all([getProperties(user), getUnits(user)]);
        setProperties(props);
        setUnits(unitsData);
      } catch (err) {
        console.error("Failed to load properties", err);
        toast.error("Failed to load properties");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const filteredProperties = properties.filter((p) => {
    if (!p) return false;
    const matchesSearch = !searchTerm ||
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.location?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" ||
      p.availabilityStatus === statusFilter ||
      p.status === statusFilter;
    const matchesType = typeFilter === "all" || p.type === typeFilter;
    const matchesReason = maintenanceReasonFilter === "all" ||
      p.maintenanceReason === maintenanceReasonFilter ||
      (p.condition && p.condition.toLowerCase().includes(maintenanceReasonFilter.toLowerCase()));
    return matchesSearch && matchesStatus && matchesType && matchesReason;
  });

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete "${name}"? This action cannot be undone.`)) {
      try {
        await deleteProperty(id);
        setProperties((current) => current.filter((property) => property.id !== id));
        toast.success("Property deleted");
      } catch {
        toast.error("Failed to delete property");
      }
    }
  };

  const handleAdd = async () => {
    if (!formData.name || !formData.location) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!user) return;
    try {
      const activeReason = formData.maintenanceReason || PROPERTY_MAINTENANCE_REASONS[0];
      const submitData = {
        ...formData,
        condition: formData.availabilityStatus === "Under Maintenance" ? `Maintenance: ${activeReason}` : (formData.condition || undefined),
        maintenanceReason: formData.availabilityStatus === "Under Maintenance" ? activeReason : undefined,
        latitude: formData.latitude ? Number(formData.latitude) : undefined,
        longitude: formData.longitude ? Number(formData.longitude) : undefined,
      };
      if (propertyImage) {
        submitData.imageUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(propertyImage);
        });
      }
      const created = await addProperty(submitData as any, user.id);
      console.log("Added property result:", created);
      if (created?.id && created?.name) {
        setProperties(prev => [created, ...prev]);
      } else {
        const props = await getProperties(user);
        setProperties(props);
      }
      setShowAddModal(false);
      setFormData(initialFormData);
      setPropertyImage(null);
      setImagePreview("");
      notifyAdmins({ title: "New Property Created", message: `${formData.name} was added by ${user.name}`, type: "property", read: false });
      toast.success("Property added successfully");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to add property");
    }
  };

  const handleEdit = async () => {
    if (isSaving) return;
    if (!selectedProperty || !formData.name || !formData.location) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsSaving(true);
    try {
      const activeReason = formData.maintenanceReason || PROPERTY_MAINTENANCE_REASONS[0];
      const submitData = {
        ...formData,
        condition: formData.availabilityStatus === "Under Maintenance" ? `Maintenance: ${activeReason}` : (formData.condition || undefined),
        maintenanceReason: formData.availabilityStatus === "Under Maintenance" ? activeReason : undefined,
        latitude: formData.latitude ? Number(formData.latitude) : undefined,
        longitude: formData.longitude ? Number(formData.longitude) : undefined,
      };
      if (propertyImage) {
        const reader = new FileReader();
        submitData.imageUrl = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(propertyImage);
        });
      }
      const response = await fetch("/api/data/properties/patch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: selectedProperty.id, data: submitData }),
      });
      const result = await safeParseJson(response);
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to update property");
      setProperties((current) => current.map((property) => property.id === selectedProperty.id ? ({ ...property, ...submitData } as Property) : property));
      setShowEditModal(false);
      setSelectedProperty(null);
      setPropertyImage(null);
      setImagePreview("");
      toast.success("Property updated successfully");
    } catch {
      toast.error("Failed to update property");
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (property: Property) => {
    setSelectedProperty(property);
    const existingReason = property.maintenanceReason || (property.condition?.startsWith("Maintenance: ") ? property.condition.replace("Maintenance: ", "") : PROPERTY_MAINTENANCE_REASONS[0]);
    setFormData({
      name: property.name,
      location: property.location,
      latitude: property.latitude?.toString() || "",
      longitude: property.longitude?.toString() || "",
      monthlyRevenue: property.monthlyRevenue || (property as any).rentAmount || 0,
      type: (property.type as any) || "house",
      units: property.units,
      features: property.features || [],
      condition: property.condition || "",
      availabilityStatus: property.availabilityStatus || "Available",
      maintenanceReason: existingReason,
      imageUrl: property.imageUrl || "",
    });
    setImagePreview(property.imageUrl || "");
    setPropertyImage(null);
    setShowEditModal(true);
  };

  const openView = (property: Property) => {
    setSelectedProperty(property);
    setShowViewModal(true);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 p-8 sm:p-10">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-medium mb-3">
              <Building2 className="h-3 w-3" />
              Property Portfolio
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Properties</h2>
            <p className="text-white/70 text-sm mt-1.5">Manage your rental properties and their units</p>
          </div>
          {canManage && (
              <Button onClick={() => { setFormData(initialFormData); setPropertyImage(null); setImagePreview(""); setShowAddModal(true); }}
              className="bg-white text-orange-700 hover:bg-orange-50 shadow-lg"><Plus className="h-4 w-4 mr-1.5" />Add Property</Button>
          )}
        </div>
      </div>
      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <Input placeholder="Search properties by name or location..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-10" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AnimatedFilterDropdown
            label="Type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[
              { value: "all", label: "All Types" },
              { value: "house", label: "House" },
              { value: "condominium", label: "Condominium" },
            ]}
          />

          <AnimatedFilterDropdown
            label="Status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              if (e.target.value !== "Under Maintenance") setMaintenanceReasonFilter("all");
            }}
            options={[
              { value: "all", label: "All Statuses" },
              { value: "Available", label: "Available" },
              { value: "Occupied", label: "Occupied" },
              { value: "Reserved", label: "Reserved" },
              { value: "Under Maintenance", label: "Under Maintenance" },
            ]}
          />

          <AnimatedFilterDropdown
            label="House Repair Reason"
            icon={<Wrench className="h-3.5 w-3.5 text-amber-500" />}
            value={maintenanceReasonFilter}
            onChange={(e) => {
              const val = e.target.value;
              setMaintenanceReasonFilter(val);
              if (val !== "all") {
                setStatusFilter("Under Maintenance");
              }
            }}
            pulseOnMaintenance={maintenanceReasonFilter !== "all" || statusFilter === "Under Maintenance"}
            containerClassName={maintenanceReasonFilter !== "all" ? "border-amber-300 bg-amber-50/50" : undefined}
            options={[
              { value: "all", label: "All House Repair Reasons" },
              ...PROPERTY_MAINTENANCE_REASONS.map((r) => ({ value: r, label: r })),
            ]}
          />

          {(searchTerm || statusFilter !== "all" || typeFilter !== "all" || maintenanceReasonFilter !== "all") && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setTypeFilter("all");
                setMaintenanceReasonFilter("all");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </motion.button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredProperties.length === 0 ? (
          <div className="md:col-span-2 text-center py-16">
            <Building2 className="h-12 w-12 text-text-tertiary mx-auto mb-4" />
            <p className="text-text-secondary font-medium">No properties yet</p>
            <p className="text-text-tertiary text-sm mt-1">Add your first property to get started</p>
          </div>
        ) : (
          filteredProperties.map((property, i) => {
            const propertyUnits = units.filter((u) => u.propertyId === property.id);
            const occupied = propertyUnits.filter(u => u.status === "occupied").length;
            const rate = propertyUnits.length > 0 ? Math.round((occupied / propertyUnits.length) * 100) : 0;

            return (
              <motion.div key={property.id} variants={fadeInUp} custom={i}>
                <motion.div whileHover={{ y: -2, transition: { duration: 0.2 } }}>
                  <Card className="overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="h-44 relative bg-gray-100 overflow-hidden">
                      <UnitImageCarousel
                        images={property.imageUrls?.length ? property.imageUrls : property.imageUrl ? [property.imageUrl] : []}
                        alt={property.name}
                        className="h-full w-full"
                        imageClassName="object-cover"
                      />
                      <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
                        <Badge variant="outline" className={cn(
                          "backdrop-blur-sm font-semibold shadow-xs",
                          property.availabilityStatus === "Under Maintenance"
                            ? "bg-amber-50/95 text-amber-800 border-amber-300"
                            : property.status === "active" ? "bg-white/90 text-green-600 border-green-200" : "bg-white/90 text-gray-600 border-gray-200"
                        )}>
                          {property.availabilityStatus === "Under Maintenance" ? (
                            <span className="flex items-center gap-1.5">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                              </span>
                              Under Maintenance
                            </span>
                          ) : (
                            property.availabilityStatus || (property.status === "active" ? "Active" : "Inactive")
                          )}
                        </Badge>
                      </div>
                      <div className="absolute bottom-4 left-4 flex items-center gap-2 min-w-0 pr-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg flex-shrink-0">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-white drop-shadow-md truncate">{property.name}</h3>
                          <div className="flex items-center gap-1 text-xs text-white/80 truncate">
                            <MapPin className="h-3 w-3 flex-shrink-0" />{property.location}
                          </div>
                          {property.availabilityStatus === "Under Maintenance" && (
                            <div className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-500/90 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                              <Wrench className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate max-w-[190px]" title={property.maintenanceReason || (property.condition?.startsWith("Maintenance: ") ? property.condition.replace("Maintenance: ", "") : "Building Infrastructure Servicing")}>
                                {property.maintenanceReason || (property.condition?.startsWith("Maintenance: ") ? property.condition.replace("Maintenance: ", "") : "Building Infrastructure Servicing")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-sm font-semibold text-foreground">
                            <Home className="h-3.5 w-3.5 text-primary-500" />
                            {property.type?.toLowerCase() === "house" ? "—" : propertyUnits.length}
                          </div>
                          <p className="text-[10px] text-text-secondary mt-0.5">Total Units</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-sm font-semibold text-foreground">
                            <Users className="h-3.5 w-3.5 text-secondary-500" />
                            {property.type?.toLowerCase() === "house" ? "—" : occupied}
                          </div>
                          <p className="text-[10px] text-text-secondary mt-0.5">Occupied</p>
                        </div>
                         <div className="text-center">
                           <div className="flex items-center justify-center gap-1 text-sm font-semibold text-foreground">
                             <DollarSign className="h-3.5 w-3.5 text-accent-500" />{formatCurrency(property.monthlyRevenue || 0)}
                           </div>
                           <p className="text-[10px] text-text-secondary mt-0.5">Monthly</p>
                         </div>
                      </div>
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-text-secondary">Occupancy Rate</span>
                          <span className="font-medium text-foreground">{rate}%</span>
                        </div>
                        <Progress value={rate} className="h-1.5"
                          indicatorClassName={cn(rate >= 80 ? "bg-green-500" : rate >= 50 ? "bg-amber-500" : "bg-red-500")} />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all" onClick={() => openView(property)}>
                          <Eye className="h-3.5 w-3.5 mr-1" />View
                        </Button>
                        {canManage && (
                          <>
                            <Button size="sm" variant="outline" className="flex-1 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all" onClick={() => openEdit(property)}>
                              <Edit className="h-3.5 w-3.5 mr-1" />Edit
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1" onClick={() => setHistoryProperty(property)}>
                              <HistoryIcon className="h-3.5 w-3.5 mr-1" />History
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all"
                              onClick={() => handleDelete(property.id, property.name)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Add Property Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Property" description="Add a new rental property to your portfolio">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Property Name *</label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Sunrise Apartments" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Location *</label>
            <Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="e.g. Butuan City" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Property Type</label>
            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full h-12 rounded-xl border border-border bg-surface text-foreground px-4">
              <option value="house">House / Villa</option>
              <option value="residential">Residential Property</option>
              <option value="building">Commercial / Building</option>
              <option value="condominium">Condominium Complex</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Property Features</label>
            <FeaturePicker value={formData.features} onChange={(features) => setFormData({ ...formData, features })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Property Condition</label>
              <select value={formData.condition} onChange={(e) => setFormData({ ...formData, condition: e.target.value })} className="h-12 w-full rounded-xl border border-border bg-surface px-4">
                <option value="">Select condition...</option>
                {PROPERTY_CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Property Status</label>
              <select value={formData.availabilityStatus} onChange={(e) => setFormData({ ...formData, availabilityStatus: e.target.value as typeof AVAILABILITY_STATUSES[number] })} className="h-12 w-full rounded-xl border border-border bg-surface px-4">
                {AVAILABILITY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
          </div>

          {formData.availabilityStatus === "Under Maintenance" && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-amber-300 bg-amber-50/70 p-3.5 space-y-1.5 dark:border-amber-800 dark:bg-amber-950/30"
            >
              <label className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-amber-600" />
                Chosen Reason for Property Maintenance *
              </label>
              <select
                value={formData.maintenanceReason || PROPERTY_MAINTENANCE_REASONS[0]}
                onChange={(e) => setFormData({ ...formData, maintenanceReason: e.target.value })}
                className="h-10 w-full rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950 shadow-xs focus:border-amber-500 focus:outline-none dark:border-amber-700 dark:bg-gray-800 dark:text-amber-100"
              >
                {PROPERTY_MAINTENANCE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                This reason is displayed across the portfolio view and communicated in maintenance summaries.
              </p>
            </motion.div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Monthly Rent (₱)</label>
            <Input type="number" min="0" value={formData.monthlyRevenue || ""} onChange={(e) => setFormData({ ...formData, monthlyRevenue: parseInt(e.target.value) || 0 })} placeholder="e.g. 15000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Property Image</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors" onClick={() => document.getElementById("property-image-upload")?.click()}>
              {imagePreview ? (
                <Image src={imagePreview} alt="Preview" width={640} height={320} unoptimized className="mx-auto mb-2 max-h-40 rounded-lg object-contain" />
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm font-medium text-gray-700">Click to upload property image</p>
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG up to 5MB</p>
                </>
              )}
              <input id="property-image-upload" type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setPropertyImage(file);
                  const reader = new FileReader();
                  reader.onload = (ev) => setImagePreview(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }
              }} />
            </div>
            {imagePreview && (
              <Button type="button" variant="ghost" size="sm" className="mt-2 text-red-500 hover:text-red-600" onClick={() => { setPropertyImage(null); setImagePreview(""); }}>
                <X className="h-4 w-4 mr-1" />Remove Image
              </Button>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Number of Units</label>
            <Input type="number" value={formData.units || ""} onChange={(e) => setFormData({ ...formData, units: parseInt(e.target.value) || 0 })} placeholder="e.g. 10" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleAdd} className="flex-1"><Check className="h-4 w-4 mr-1.5" />Add Property</Button>
            <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* View Property Modal */}
      <Modal isOpen={showViewModal} onClose={() => setShowViewModal(false)} title={selectedProperty?.name || "Property Details"} description={selectedProperty?.location}>
        {selectedProperty && (
          <div className="space-y-4">
            {selectedProperty.imageUrl && (
              <Image src={selectedProperty.imageUrl} alt={selectedProperty.name} width={640} height={384} unoptimized className="h-48 w-full rounded-xl object-cover" />
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-surface-secondary">
                <p className="text-xs text-text-secondary">Type</p>
                <p className="text-sm font-semibold text-foreground capitalize mt-1">{selectedProperty.type}</p>
              </div>
              <div className="space-y-3">
                <div><p className="text-xs text-text-secondary">Availability</p><p className="text-sm font-semibold text-foreground mt-1">{selectedProperty.availabilityStatus || "Available"}</p></div>
                <div><p className="text-xs text-text-secondary">Condition</p><p className="text-sm font-semibold text-foreground mt-1">{selectedProperty.condition || "Not specified"}</p></div>
                <div><p className="text-xs text-text-secondary">Property Features</p><div className="mt-2 flex flex-wrap gap-2">{(selectedProperty.features || []).length ? selectedProperty.features?.map((feature) => <Badge key={feature} variant="secondary">{feature}</Badge>) : <span className="text-sm text-text-secondary">None selected</span>}</div></div>
              </div>
              <div className="p-4 rounded-xl bg-surface-secondary">
                <p className="text-xs text-text-secondary">Status</p>
                <p className="text-sm font-semibold text-foreground capitalize mt-1">{selectedProperty.status}</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-secondary">
                <p className="text-xs text-text-secondary">Total Units</p>
                <p className="text-sm font-semibold text-foreground mt-1">
                  {selectedProperty.type?.toLowerCase() === "house" ? "—" : selectedProperty.units}
                </p>
              </div>
                 <div className="p-4 rounded-xl bg-surface-secondary">
                   <p className="text-xs text-text-secondary">Monthly Revenue</p>
                   <p className="text-sm font-semibold text-foreground mt-1">{formatCurrency(selectedProperty.monthlyRevenue || 0)}</p>
                 </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setShowViewModal(false)}>Close</Button>
          </div>
        )}
      </Modal>

      {/* Edit Property Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Property" description="Update property details">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Property Name *</label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Location *</label>
            <Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Property Type</label>
            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full h-12 rounded-xl border border-border bg-surface text-foreground px-4">
              <option value="house">House / Villa</option>
              <option value="residential">Residential Property</option>
              <option value="building">Commercial / Building</option>
              <option value="condominium">Condominium Complex</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Property Features</label>
            <FeaturePicker value={formData.features} onChange={(features) => setFormData({ ...formData, features })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Property Condition</label>
              <select value={formData.condition} onChange={(e) => setFormData({ ...formData, condition: e.target.value })} className="h-12 w-full rounded-xl border border-border bg-surface px-4">
                <option value="">Select condition...</option>
                {PROPERTY_CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Property Status</label>
              <select value={formData.availabilityStatus} onChange={(e) => setFormData({ ...formData, availabilityStatus: e.target.value as typeof AVAILABILITY_STATUSES[number] })} className="h-12 w-full rounded-xl border border-border bg-surface px-4">
                {AVAILABILITY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
          </div>

          {formData.availabilityStatus === "Under Maintenance" && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-amber-300 bg-amber-50/70 p-3.5 space-y-1.5 dark:border-amber-800 dark:bg-amber-950/30"
            >
              <label className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-amber-600" />
                Chosen Reason for Property Maintenance *
              </label>
              <select
                value={formData.maintenanceReason || PROPERTY_MAINTENANCE_REASONS[0]}
                onChange={(e) => setFormData({ ...formData, maintenanceReason: e.target.value })}
                className="h-10 w-full rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950 shadow-xs focus:border-amber-500 focus:outline-none dark:border-amber-700 dark:bg-gray-800 dark:text-amber-100"
              >
                {PROPERTY_MAINTENANCE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                This reason is displayed across the portfolio view and communicated in maintenance summaries.
              </p>
            </motion.div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Monthly Rent (₱)</label>
            <Input type="number" min="0" value={formData.monthlyRevenue || ""} onChange={(e) => setFormData({ ...formData, monthlyRevenue: parseInt(e.target.value) || 0 })} placeholder="e.g. 15000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Property Image</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors" onClick={() => document.getElementById("property-image-edit")?.click()}>
              {imagePreview ? (
                <Image src={imagePreview} alt="Preview" width={640} height={320} unoptimized className="mx-auto mb-2 max-h-40 rounded-lg object-contain" />
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm font-medium text-gray-700">Click to upload property image</p>
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG up to 5MB</p>
                </>
              )}
              <input id="property-image-edit" type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setPropertyImage(file);
                  const reader = new FileReader();
                  reader.onload = (ev) => setImagePreview(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }
              }} />
            </div>
            {imagePreview && (
              <Button type="button" variant="ghost" size="sm" className="mt-2 text-red-500 hover:text-red-600" onClick={() => { setPropertyImage(null); setImagePreview(""); }}>
                <X className="h-4 w-4 mr-1" />Remove Image
              </Button>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleEdit} disabled={isSaving} className="flex-1"><Check className="h-4 w-4 mr-1.5" />{isSaving ? "Saving..." : "Save Changes"}</Button>
            <Button variant="outline" onClick={() => setShowEditModal(false)} className="flex-1">Cancel</Button>
          </div>
        </div>
      </Modal>
      <TenancyHistoryModal
        isOpen={!!historyProperty}
        onClose={() => setHistoryProperty(null)}
        title={`Tenancy history · ${historyProperty?.name || ""}`}
        propertyId={historyProperty?.id}
      />
    </motion.div>
  );
}
