"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  Building2, Plus, Search, MapPin, Home, Users, DollarSign, Edit, Trash2, Eye, X, Check, Upload,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Modal } from "@/components/ui/modal";
import { cn, formatCurrency } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getProperties, getUnits, addProperty, deleteProperty, safeParseJson, Property, Unit, notifyAdmins } from "@/lib/data";
import { toast } from "sonner";
import UnitImageCarousel from "@/components/unit-image-carousel";

const fadeInUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };
const PROPERTY_FEATURES = ["1 Bedroom", "2 Bedrooms", "3 Bedrooms", "4+ Bedrooms", "1 Bathroom", "2 Bathrooms", "3+ Bathrooms", "Parking Space", "Furnished", "Air Conditioning", "Wi-Fi", "Laundry Area", "Kitchen", "Outdoor Area", "Gated Property"];
const PROPERTY_CONDITIONS = ["Excellent – Ready to Move In", "Very Good – Well Maintained", "Good – Minor Wear and Tear", "Fair – Some Repairs Needed", "Needs Improvement – Repairs Required"];
const AVAILABILITY_STATUSES = ["Available", "Occupied", "Reserved", "Under Maintenance"] as const;

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
  const [, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [formData, setFormData] = useState({ name: "", location: "", latitude: "", longitude: "", type: "house" as "house" | "condominium", units: 0, features: [] as string[], condition: "", availabilityStatus: "Available" as typeof AVAILABILITY_STATUSES[number], imageUrl: "" });
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

  const filteredProperties = properties.filter((p) =>
    p && p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    if (Boolean(formData.latitude) !== Boolean(formData.longitude)) {
      toast.error("Enter both latitude and longitude to map this property");
      return;
    }
    if (!user) return;
    try {
      const submitData = {
        ...formData,
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
      setFormData({ name: "", location: "", latitude: "", longitude: "", type: "house", units: 0, features: [], condition: "", availabilityStatus: "Available", imageUrl: "" });
      setPropertyImage(null);
      setImagePreview("");
      notifyAdmins({ title: "New Property Created", message: `${formData.name} was added by ${user.name}`, type: "property", read: false });
      toast.success("Property added successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add property");
    }
  };

  const handleEdit = async () => {
    if (isSaving) return;
    if (!selectedProperty || !formData.name || !formData.location) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (Boolean(formData.latitude) !== Boolean(formData.longitude)) {
      toast.error("Enter both latitude and longitude to map this property");
      return;
    }
    setIsSaving(true);
    try {
      const submitData = {
        ...formData,
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
      setProperties((current) => current.map((property) => property.id === selectedProperty.id ? { ...property, ...submitData } : property));
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
    setFormData({ name: property.name, location: property.location, latitude: property.latitude?.toString() || "", longitude: property.longitude?.toString() || "", type: property.type, units: property.units, features: property.features || [], condition: property.condition || "", availabilityStatus: property.availabilityStatus || "Available", imageUrl: property.imageUrl || "" });
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
              <Button onClick={() => { setFormData({ name: "", location: "", latitude: "", longitude: "", type: "house", units: 0, features: [], condition: "", availabilityStatus: "Available", imageUrl: "" }); setPropertyImage(null); setImagePreview(""); setShowAddModal(true); }}
              className="bg-white text-orange-700 hover:bg-orange-50 shadow-lg"><Plus className="h-4 w-4 mr-1.5" />Add Property</Button>
          )}
        </div>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <Input placeholder="Search properties..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-10" />
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
                      <div className="absolute top-4 right-4">
                        <Badge variant="outline" className={cn(
                          "bg-white/90 backdrop-blur-sm",
                          property.status === "active" ? "text-green-600 border-green-200" : "text-gray-600 border-gray-200"
                        )}>
                          {property.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="absolute bottom-4 left-4 flex items-center gap-2 min-w-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg flex-shrink-0">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-white drop-shadow-md truncate">{property.name}</h3>
                          <div className="flex items-center gap-1 text-xs text-white/80 truncate">
                            <MapPin className="h-3 w-3 flex-shrink-0" />{property.location}
                          </div>
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-sm font-semibold text-foreground">
                            <Home className="h-3.5 w-3.5 text-primary-500" />{propertyUnits.length}
                          </div>
                          <p className="text-[10px] text-text-secondary mt-0.5">Total Units</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-sm font-semibold text-foreground">
                            <Users className="h-3.5 w-3.5 text-secondary-500" />{occupied}
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Latitude</label>
              <Input type="number" step="any" min="-90" max="90" value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} placeholder="e.g. 8.9475" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Longitude</label>
              <Input type="number" step="any" min="-180" max="180" value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} placeholder="e.g. 125.5406" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Type</label>
            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as "house" | "condominium" })}
              className="w-full h-12 rounded-xl border border-border bg-surface text-foreground px-4">
              <option value="house">House</option>
              <option value="condominium">Condominium</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Property Features</label>
            <FeaturePicker value={formData.features} onChange={(features) => setFormData({ ...formData, features })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Current Property Condition</label>
              <select value={formData.condition} onChange={(e) => setFormData({ ...formData, condition: e.target.value })} className="h-12 w-full rounded-xl border border-border bg-surface px-4">
                <option value="">Select condition...</option>
                {PROPERTY_CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Availability Status</label>
              <select value={formData.availabilityStatus} onChange={(e) => setFormData({ ...formData, availabilityStatus: e.target.value as typeof AVAILABILITY_STATUSES[number] })} className="h-12 w-full rounded-xl border border-border bg-surface px-4">
                {AVAILABILITY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
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
                <p className="text-sm font-semibold text-foreground mt-1">{selectedProperty.units}</p>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Latitude</label>
              <Input type="number" step="any" min="-90" max="90" value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} placeholder="e.g. 8.9475" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Longitude</label>
              <Input type="number" step="any" min="-180" max="180" value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} placeholder="e.g. 125.5406" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Type</label>
            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as "house" | "condominium" })}
              className="w-full h-12 rounded-xl border border-border bg-surface text-foreground px-4">
              <option value="house">House</option>
              <option value="condominium">Condominium</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Property Features</label>
            <FeaturePicker value={formData.features} onChange={(features) => setFormData({ ...formData, features })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Current Property Condition</label>
              <select value={formData.condition} onChange={(e) => setFormData({ ...formData, condition: e.target.value })} className="h-12 w-full rounded-xl border border-border bg-surface px-4">
                <option value="">Select condition...</option>
                {PROPERTY_CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Availability Status</label>
              <select value={formData.availabilityStatus} onChange={(e) => setFormData({ ...formData, availabilityStatus: e.target.value as typeof AVAILABILITY_STATUSES[number] })} className="h-12 w-full rounded-xl border border-border bg-surface px-4">
                {AVAILABILITY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
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
    </motion.div>
  );
}
