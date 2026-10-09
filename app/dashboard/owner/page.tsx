"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import PropertyLocationMap from "@/components/property-location-map-loader";
import {
  LayoutDashboard, Home, ClipboardCheck, Clock,
  CreditCard, FileText, BarChart3, FileSpreadsheet,
  CheckCircle2, UserPlus, User,
  Eye, Download, X, Plus, Camera, Users, Trash2, ChevronDown,
  Shield, ShieldOff, LogOut, MoreVertical, Search, Building2, RotateCcw,
  Copy, MoreHorizontal, Mail, MessageSquare, Phone, MapPinned,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import {
  getProperties, getUnits, getTenants, getPayments,
  updateTenantAssignment, verifyPayment, addProperty, addUnit,
  deleteProperty, deleteUnit, updateProperty, updateUnit,
  updateTenantStatus, safeParseJson,
  Property, Unit, TenantRecord, Payment, UserRecord, getOwnerAgents,
} from "@/lib/data";
import OwnerAgentsPage from "./agents/agents-client";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { downloadExcelReport, downloadPdfReport } from "@/lib/report-downloads";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import MessagingModal from "@/components/messaging-modal";
import ProfilePanel from "@/components/profile-panel";
import CreateTenantModal from "@/components/create-tenant-modal";
import TenantsPanel from "@/components/tenants-panel";
import ReceiptModal from "@/components/receipt-modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import UnitImageCarousel from "@/components/unit-image-carousel";
import ContractsPanel from "@/components/contracts-panel";
import { ManagementBanner, UnitMetrics, UnitStatus, FinancialMetrics, PaymentStatus, ManagementPagination } from "@/components/management-panel";
import management from "@/components/management-panel.module.css";

type Step = "overview" | "properties" | "units" | "assignments" | "agents" | "map" | "create-tenant" | "contracts" | "occupancy" | "payments" | "receivables" | "reports" | "financial" | "profile" | "move-out-requests";

const flowSteps: { key: Step; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Dashboard", icon: LayoutDashboard },
  { key: "properties", label: "Properties", icon: Home },
  { key: "units", label: "Rental Units", icon: ClipboardCheck },
  { key: "assignments", label: "Pending Approvals", icon: FileText },
  { key: "agents", label: "Agents", icon: Users },
  { key: "map", label: "Property Map", icon: MapPinned },
  { key: "create-tenant", label: "Create Tenant", icon: UserPlus },
  { key: "contracts", label: "Rental Contracts", icon: FileText },
  { key: "occupancy", label: "Occupancy", icon: Home },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "receivables", label: "Receivables", icon: CreditCard },
  { key: "reports", label: "Receipts & Reports", icon: BarChart3 },
  { key: "financial", label: "Financial Transactions", icon: CreditCard },
  { key: "move-out-requests", label: "Move-Out Requests", icon: LogOut },
  { key: "profile", label: "My Profile", icon: User },
];

const PROPERTY_FEATURES = [
  "1 Bedroom", "2 Bedrooms", "3 Bedrooms", "4+ Bedrooms",
  "1 Bathroom", "2 Bathrooms", "3+ Bathrooms", "Parking Space",
  "Furnished", "Air Conditioning", "Wi-Fi", "Laundry Area",
  "Kitchen", "Outdoor Area", "Gated Property",
];
const PROPERTY_CONDITIONS = [
  "Excellent - Ready to Move In",
  "Very Good - Well Maintained",
  "Good - Minor Wear and Tear",
  "Fair - Some Repairs Needed",
  "Needs Improvement - Repairs Required",
];
const AVAILABILITY_STATUSES = ["Available", "Occupied", "Reserved", "Under Maintenance"] as const;


function FeaturePicker({ value, onChange }: { value: string[]; onChange: (features: string[]) => void }) {
  const toggleFeature = (feature: string) => {
    onChange(value.includes(feature) ? value.filter((item) => item !== feature) : [...value, feature]);
  };
  return (
    <div className="space-y-3">
      <select value="" onChange={(e) => e.target.value && toggleFeature(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm">
        <option value="">Select features...</option>
        {PROPERTY_FEATURES.filter((feature) => !value.includes(feature)).map((feature) => <option key={feature} value={feature}>{feature}</option>)}
      </select>
      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map((feature) => (
            <button type="button" key={feature} onClick={() => toggleFeature(feature)} className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200">
              {feature} <span aria-hidden="true">x</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OwnerDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Step>("overview");
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [agents, setAgents] = useState<UserRecord[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [isMessagingOpen, setIsMessagingOpen] = useState(false);
  const [moveOutRequests, setMoveOutRequests] = useState<any[]>([]);
  const [moveOutSearch, setMoveOutSearch] = useState("");
  const [moveOutStatusFilter, setMoveOutStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [moveOutPropertyFilter, setMoveOutPropertyFilter] = useState("all");
  const [selectedMoveOut, setSelectedMoveOut] = useState<any | null>(null);
  const [, setIsRefreshing] = useState(false);
  const [showCreateProperty, setShowCreateProperty] = useState(false);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newUnitForm, setNewUnitForm] = useState({ propertyId: "", unitNumber: "", floor: "", status: "vacant" as Unit["status"], rentAmount: "", imageUrl: "", imageUrls: [] as string[] });
  const [createStep, setCreateStep] = useState(1);
  const [propertyForm, setPropertyForm] = useState({ name: "", address: "", city: "", province: "", latitude: "", longitude: "", type: "house" as "house" | "condominium", features: [] as string[], condition: "", availabilityStatus: "Available" as typeof AVAILABILITY_STATUSES[number], imageUrl: "", imageUrls: [] as string[] });
  const [unitsForm, setUnitsForm] = useState({ unitNumber: "", floor: "", status: "vacant" as "vacant" | "occupied" | "maintenance", rentAmount: "", imageUrl: "", imageUrls: [] as string[] });
  const [isUploadingPropertyImage, setIsUploadingPropertyImage] = useState(false);
  const [isUploadingUnitImage, setIsUploadingUnitImage] = useState(false);
  const [termsForm, setTermsForm] = useState({ securityDeposit: "", advancePayment: "", duration: "12 months", paymentDueDate: "5th", rentalTerms: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewAssignment, setReviewAssignment] = useState<TenantRecord | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [viewingReceipt, setViewingReceipt] = useState<Payment | null>(null);
  const [viewingReport, setViewingReport] = useState<"rental" | "property" | null>(null);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [editPropertyForm, setEditPropertyForm] = useState({ name: "", location: "", latitude: "", longitude: "", type: "house" as "house" | "condominium", status: "active" as "active" | "inactive", features: [] as string[], condition: "", availabilityStatus: "Available" as typeof AVAILABILITY_STATUSES[number], imageUrl: "", imageUrls: [] as string[] });
  const [editUnitPropertyId, setEditUnitPropertyId] = useState<string | null>(null);
  const [editUnitForm, setEditUnitForm] = useState({ unitNumber: "", floor: "", status: "vacant" as "vacant" | "occupied" | "maintenance", rentAmount: "", imageUrl: "", imageUrls: [] as string[] });
  const [isUploadingEditPropertyImage, setIsUploadingEditPropertyImage] = useState(false);
  const [isUploadingEditUnitImage, setIsUploadingEditUnitImage] = useState(false);
  const [createTenantSubmitting, setCreateTenantSubmitting] = useState(false);
  const [showCreateTenantModal, setShowCreateTenantModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  // Data is fetched once into state; these UI filters operate on that cached data instantly.
  const [unitsView, setUnitsView] = useState<"properties" | "units" | "occupancy">("units");
  const [unitPropertyFilter, setUnitPropertyFilter] = useState("all");
  const [unitStatusFilter, setUnitStatusFilter] = useState("all");
  const [unitSearch, setUnitSearch] = useState("");
  const [unitTypeFilter, setUnitTypeFilter] = useState("all");
  const [unitSort, setUnitSort] = useState("unit-asc");
  const [unitPage, setUnitPage] = useState(1);
  const [initialLoad, setInitialLoad] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tenantFilter, setTenantFilter] = useState("all");
  const [tenantSearch, setTenantSearch] = useState("");
  const [viewingTenant, setViewingTenant] = useState<TenantRecord | null>(null);
  const [financialView, setFinancialView] = useState<"payments" | "approvals" | "reports">("payments");
  const [financialStatusFilter, setFinancialStatusFilter] = useState("all");
  const [financialSearch, setFinancialSearch] = useState("");
  const [financialDateRange, setFinancialDateRange] = useState("all");
  const [financialMethodFilter, setFinancialMethodFilter] = useState("all");
  const [financialUnitFilter, setFinancialUnitFilter] = useState("all");
  const [financialSort, setFinancialSort] = useState("date-desc");
  const [financialPage, setFinancialPage] = useState(1);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    setLoadError(false);
    try {
      const [props, unitsData, tenantsData, paymentsData, agentsData] = await Promise.all([
        getProperties(user),
        getUnits(user),
        getTenants(user),
        getPayments(user),
        getOwnerAgents(),
      ]);
      setProperties(props);
      setUnits(unitsData);
      setTenants(tenantsData);
      setPayments(paymentsData);
      setAgents(agentsData);

      const moveOutRes = await fetch("/api/move-out");
      const moveOutData = await safeParseJson(moveOutRes);
      if (moveOutData.success) {
        setMoveOutRequests(moveOutData.requests || []);
      }
    } catch (err) {
      console.error("Owner dashboard load error:", err);
      setLoadError(true);
    } finally {
      setIsRefreshing(false);
      setInitialLoad(false);
    }
  }, [user]);

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createStep === 1) {
      setCreateStep(2);
      return;
    }
    if (createStep === 2) {
      setCreateStep(3);
      return;
    }
    if (createStep === 3) {
      setCreateStep(4);
      return;
    }
    setIsSubmitting(true);
    try {
      if (Boolean(propertyForm.latitude) !== Boolean(propertyForm.longitude)) {
        toast.error("Enter both latitude and longitude to map this property");
        return;
      }
      if (!unitsForm.unitNumber || !unitsForm.rentAmount || Number(unitsForm.rentAmount) < 0) {
        toast.error("Provide a unit number and a valid rental rate");
        return;
      }
      const newProperty = await addProperty({
        name: propertyForm.name,
        location: `${propertyForm.address}, ${propertyForm.city}, ${propertyForm.province}`,
        type: propertyForm.type,
        latitude: propertyForm.latitude ? Number(propertyForm.latitude) : undefined,
        longitude: propertyForm.longitude ? Number(propertyForm.longitude) : undefined,
        units: 1,
        occupiedUnits: 0,
        monthlyRevenue: 0,
        status: "active",
        imageUrl: propertyForm.imageUrl || undefined,
        imageUrls: propertyForm.imageUrls,
        features: propertyForm.features,
        condition: propertyForm.condition || undefined,
        availabilityStatus: propertyForm.availabilityStatus,
      }, user?.id || "");
      await addUnit({
        propertyId: newProperty.id,
        unitNumber: unitsForm.unitNumber,
        floor: unitsForm.floor ? Number(unitsForm.floor) : undefined,
        status: unitsForm.status,
        rentAmount: Number(unitsForm.rentAmount),
        imageUrl: unitsForm.imageUrl || undefined,
        imageUrls: unitsForm.imageUrls,
      });
      toast.success("Property created successfully!");
      setShowCreateProperty(false);
      setCreateStep(1);
      setPropertyForm({ name: "", address: "", city: "", province: "", latitude: "", longitude: "", type: "house", features: [], condition: "", availabilityStatus: "Available", imageUrl: "", imageUrls: [] });
      setUnitsForm({ unitNumber: "", floor: "", status: "vacant", rentAmount: "", imageUrl: "", imageUrls: [] });
      setTermsForm({ securityDeposit: "", advancePayment: "", duration: "12 months", paymentDueDate: "5th", rentalTerms: "" });
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create property");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTenant = async (formData: {
    name: string;
    email: string;
    phone: string;
    address: string;
    password: string;
  }) => {
    if (!formData.name || !formData.email || !formData.password) {
      toast.error("Name, email, and password are required");
      return;
    }
    setCreateTenantSubmitting(true);
    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: formData.name, email: formData.email, phone: formData.phone, address: formData.address, password: formData.password, role: "tenant" }),
      });
      const data = await safeParseJson(res);
      if (data.success) {
        const tenantResponse = await fetch("/api/data/tenants", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ id: data.user?.id, name: formData.name, email: formData.email, phone: formData.phone, address: formData.address }) });
        const tenantResult = await safeParseJson(tenantResponse);
        if (!tenantResult.success) throw new Error(tenantResult.error || "Unable to create tenant record");
        if (data.emailSent) {
          toast.success(`Tenant account created. Login details were emailed to ${formData.email}.`);
        } else {
          toast.error(data.emailStatus === "not_configured"
            ? "Tenant account created, but no login email was sent because SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS."
            : "Tenant account created, but the login email could not be delivered. Check SMTP settings and server logs.");
        }
        setShowCreateTenantModal(false);
        loadData();
      } else {
        toast.error(data.error || "Failed to create tenant account");
      }
    } catch {
      toast.error("Failed to create tenant account");
    } finally {
      setCreateTenantSubmitting(false);
    }
  };

  const handleBlockTenant = async (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      const updated = await updateTenantStatus(tenantId, newStatus);
      if (updated) {
        setTenants(tenants.map(t => t.id === tenantId ? { ...t, status: newStatus } : t));
        toast.success(newStatus === "inactive" ? "Tenant account blocked" : "Tenant account unblocked");
      }
    } catch {
      toast.error("Failed to update tenant status");
    }
  };

  const handleConfirmAssignment = async (tenantId: string) => {
    try {
      const updated = await updateTenantAssignment(tenantId, { assignmentStatus: "confirmed" });
      if (updated) {
        setTenants(tenants.map(t => t.id === tenantId ? { ...t, assignmentStatus: "confirmed" } : t));
        toast.success("Assignment confirmed! Tenant can now access the system.");
        window.dispatchEvent(new Event("owner-data-changed"));
        setReviewAssignment(null);
      }
    } catch {
      toast.error("Failed to confirm assignment");
    }
  };

  const handlePropertyImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsUploadingPropertyImage(true);
    try {
      const urls = await Promise.all(files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "property");
        try {
          const res = await fetch("/api/auth/upload", { method: "POST", credentials: "include", body: formData });
          const result = await safeParseJson(res);
          if (result.success && result.url) return result.url as string;
          throw new Error(result.error || "Failed to upload image");
        } catch {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve("");
            reader.readAsDataURL(file);
          });
        }
      }));
      const validUrls = urls.filter(Boolean);
      if (validUrls.length > 0) {
        setPropertyForm((current) => ({ ...current, imageUrl: current.imageUrl || validUrls[0], imageUrls: [...current.imageUrls, ...validUrls] }));
        toast.success(`${validUrls.length} property image${validUrls.length === 1 ? "" : "s"} added`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload images");
    } finally {
      setIsUploadingPropertyImage(false);
      e.target.value = "";
    }
  };

  const handleUnitImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsUploadingUnitImage(true);
    try {
      const urls = await Promise.all(files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "unit");
        try {
          const res = await fetch("/api/auth/upload", { method: "POST", credentials: "include", body: formData });
          const result = await safeParseJson(res);
          if (result.success && result.url) return result.url as string;
          throw new Error(result.error || "Failed to upload image");
        } catch {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve("");
            reader.readAsDataURL(file);
          });
        }
      }));
      const validUrls = urls.filter(Boolean);
      if (validUrls.length > 0) {
        setUnitsForm((current) => ({ ...current, imageUrl: current.imageUrl || validUrls[0], imageUrls: [...current.imageUrls, ...validUrls] }));
        toast.success(`${validUrls.length} unit image${validUrls.length === 1 ? "" : "s"} added`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload images");
    } finally {
      setIsUploadingUnitImage(false);
      e.target.value = "";
    }
  };

  const handleRemoveEditUnitImage = async (imageUrl: string) => {
    setEditUnitForm((current) => {
      const imageUrls = current.imageUrls.filter((url) => url !== imageUrl);
      return { ...current, imageUrls, imageUrl: imageUrls[0] || "" };
    });
    const uploadId = imageUrl.match(/\/api\/auth\/upload\/([^/?#]+)/)?.[1];
    if (uploadId) {
      try {
        const response = await fetch(`/api/auth/upload/${uploadId}`, { method: "DELETE", credentials: "include" });
        const result = await safeParseJson(response);
        if (!result.success) throw new Error(result.error || "Failed to delete image");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete image");
      }
    }
  };

  const handleRemoveEditPropertyImage = async (imageUrl: string) => {
    setEditPropertyForm((current) => {
      const imageUrls = current.imageUrls.filter((url) => url !== imageUrl);
      return { ...current, imageUrls, imageUrl: imageUrls[0] || "" };
    });
    const uploadId = imageUrl.match(/\/api\/auth\/upload\/([^/?#]+)/)?.[1];
    if (uploadId) {
      try {
        const response = await fetch(`/api/auth/upload/${uploadId}`, { method: "DELETE", credentials: "include" });
        const result = await safeParseJson(response);
        if (!result.success) throw new Error(result.error || "Failed to delete image");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete image");
      }
    }
  };

  const handleReturnAssignment = async () => {
    if (!reviewAssignment || !returnReason.trim()) {
      toast.error("Please provide a reason for returning the assignment");
      return;
    }
    try {
      const updated = await updateTenantAssignment(reviewAssignment.id, { assignmentStatus: "rejected", unitId: "", propertyName: "", unitNumber: "" });
      if (updated) {
        setTenants(tenants.map(t => t.id === reviewAssignment.id ? { ...t, assignmentStatus: "rejected", unitId: "", propertyName: "", unitNumber: "" } : t));
        toast.success("Assignment returned to agent with reason");
        setReviewAssignment(null);
        setReturnReason("");
        window.dispatchEvent(new Event("owner-data-changed"));
      }
    } catch {
      toast.error("Failed to return assignment");
    }
  };

  const handleDeleteProperty = async (property: Property) => {
    const propertyUnits = units.filter((u) => u.propertyId === property.id);
    const occupied = propertyUnits.filter((u) => u.status === "occupied").length;
    if (occupied > 0) {
      toast.error("Cannot delete property with occupied units");
      return;
    }
    if (!confirm(`Delete "${property.name}"? This cannot be undone.`)) return;
    try {
      await deleteProperty(property.id);
      setProperties(properties.filter((p) => p.id !== property.id));
      setUnits(units.filter((u) => u.propertyId !== property.id));
      toast.success("Property deleted");
    } catch {
      toast.error("Failed to delete property");
    }
  };

  const handleDeleteUnit = async (unit: Unit) => {
    if (!confirm(`Delete Unit ${unit.unitNumber}? This cannot be undone.`)) return;
    try {
      await deleteUnit(unit.id);
      setUnits(units.filter((u) => u.id !== unit.id));
      toast.success("Unit deleted");
    } catch {
      toast.error("Failed to delete unit");
    }
  };

  const handleEditProperty = (property: Property) => {
    setEditingProperty(property);
    setEditPropertyForm({
      name: property.name,
      location: property.location,
      latitude: property.latitude?.toString() || "",
      longitude: property.longitude?.toString() || "",
      type: property.type,
      status: property.status,
      features: property.features || [],
      condition: property.condition || "",
      availabilityStatus: property.availabilityStatus || "Available",
      imageUrl: property.imageUrl || "",
      imageUrls: property.imageUrls || (property.imageUrl ? [property.imageUrl] : []),
    });
  };

  const handleEditUnit = (unit: Unit) => {
    const property = properties.find((item) => item.id === unit.propertyId);
    setEditingUnit(unit);
    setEditUnitPropertyId(property?.id || null);
    if (property) {
      setEditPropertyForm({
        name: property.name,
        location: property.location,
        latitude: property.latitude?.toString() || "",
        longitude: property.longitude?.toString() || "",
        type: property.type,
        status: property.status,
        features: property.features || [],
        condition: property.condition || "",
        availabilityStatus: property.availabilityStatus || "Available",
        imageUrl: property.imageUrl || "",
        imageUrls: property.imageUrls || (property.imageUrl ? [property.imageUrl] : []),
      });
    }
    setEditUnitForm({
      unitNumber: unit.unitNumber,
      floor: unit.floor?.toString() || "",
      status: unit.status,
      rentAmount: unit.rentAmount.toString(),
      imageUrl: unit.imageUrl || "",
      imageUrls: unit.imageUrls || (unit.imageUrl ? [unit.imageUrl] : []),
    });
  };

  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProperty || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const updatedProperty = await updateProperty(editingProperty.id, {
        name: editPropertyForm.name,
        location: editPropertyForm.location,
        latitude: editPropertyForm.latitude ? Number(editPropertyForm.latitude) : undefined,
        longitude: editPropertyForm.longitude ? Number(editPropertyForm.longitude) : undefined,
        type: editPropertyForm.type,
        status: editPropertyForm.status,
        features: editPropertyForm.features,
        condition: editPropertyForm.condition || undefined,
        availabilityStatus: editPropertyForm.availabilityStatus,
        imageUrl: editPropertyForm.imageUrl || undefined,
        imageUrls: editPropertyForm.imageUrls,
      });
      if (!updatedProperty) throw new Error("Failed to update property");
      setProperties(properties.map(p => p.id === editingProperty.id ? {
        ...p,
        ...editPropertyForm,
        latitude: editPropertyForm.latitude ? Number(editPropertyForm.latitude) : undefined,
        longitude: editPropertyForm.longitude ? Number(editPropertyForm.longitude) : undefined,
      } : p));
      toast.success("Property updated");
      setEditingProperty(null);
    } catch {
      toast.error("Failed to update property");
    } finally {
      setIsSubmitting(false);
    }
  };

  const changePropertyUnitCount = async (delta: 1 | -1) => {
    if (!editingProperty) return;
    const propertyUnits = units.filter((unit) => unit.propertyId === editingProperty.id);
    try {
      if (delta > 0) {
        const nextNumber = `Unit ${propertyUnits.length + 1}`;
        const unit = await addUnit({ propertyId: editingProperty.id, unitNumber: nextNumber, status: "vacant", rentAmount: 0 });
        setUnits((current) => [...current, unit]);
      } else {
        const removable = [...propertyUnits].reverse().find((unit) => unit.status === "vacant" && !unit.tenantId);
        if (!removable) {
          toast.error("No vacant unit can be removed. Occupied units are protected.");
          return;
        }
        const removed = await deleteUnit(removable.id);
        if (!removed) throw new Error("Unit deletion failed");
        setUnits((current) => current.filter((unit) => unit.id !== removable.id));
      }
      const nextCount = propertyUnits.length + delta;
      await updateProperty(editingProperty.id, { units: nextCount });
      setProperties((current) => current.map((property) => property.id === editingProperty.id ? { ...property, units: nextCount } : property));
      setEditingProperty((current) => current ? { ...current, units: nextCount } : current);
      toast.success(delta > 0 ? "New vacant unit added" : "Vacant unit removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update unit count");
    }
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnit || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (!editUnitForm.unitNumber.trim() || editUnitForm.rentAmount === "") {
        toast.error("Unit number and monthly rent are required");
        return;
      }
      const unitUpdate = updateUnit(editingUnit.id, {
        unitNumber: editUnitForm.unitNumber,
        floor: editUnitForm.floor ? parseInt(editUnitForm.floor) : undefined,
        status: editUnitForm.status,
        rentAmount: Number(editUnitForm.rentAmount),
        imageUrl: editUnitForm.imageUrl || undefined,
        imageUrls: editUnitForm.imageUrls,
      });
      const propertyUpdate = editUnitPropertyId ? updateProperty(editUnitPropertyId, {
        name: editPropertyForm.name,
        location: editPropertyForm.location,
        latitude: editPropertyForm.latitude ? Number(editPropertyForm.latitude) : undefined,
        longitude: editPropertyForm.longitude ? Number(editPropertyForm.longitude) : undefined,
        type: editPropertyForm.type,
        status: editPropertyForm.status,
        features: editPropertyForm.features,
        condition: editPropertyForm.condition || undefined,
        availabilityStatus: editPropertyForm.availabilityStatus,
        imageUrl: editPropertyForm.imageUrl || undefined,
        imageUrls: editPropertyForm.imageUrls,
      }) : Promise.resolve(null);
      const [updatedUnitResult, updatedPropertyResult] = await Promise.all([unitUpdate, propertyUpdate]);
      if (!updatedUnitResult || (editUnitPropertyId && !updatedPropertyResult)) throw new Error("Failed to update unit and property");
      const updatedUnit: Unit = {
        ...editingUnit,
        unitNumber: editUnitForm.unitNumber,
        floor: editUnitForm.floor ? parseInt(editUnitForm.floor) : undefined,
        status: editUnitForm.status,
        rentAmount: Number(editUnitForm.rentAmount),
        imageUrl: editUnitForm.imageUrl || undefined,
        imageUrls: editUnitForm.imageUrls,
      };
      setUnits((current) => current.map((unit) => unit.id === updatedUnit.id ? updatedUnit : unit));
      if (editUnitPropertyId) {
        setProperties((current) => current.map((property) => property.id === editUnitPropertyId ? {
          ...property,
          ...editPropertyForm,
          latitude: editPropertyForm.latitude ? Number(editPropertyForm.latitude) : undefined,
          longitude: editPropertyForm.longitude ? Number(editPropertyForm.longitude) : undefined,
          imageUrls: editPropertyForm.imageUrls,
        } : property));
      }
      toast.success("Unit updated");
      setEditingUnit(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update unit and property");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "payments" || hash === "reports") {
        setActiveTab("financial");
      } else if (hash && flowSteps.some((s) => s.key === hash)) {
        setActiveTab(hash as Step);
      }
    };
    const handleOwnerTabChange = (event: Event) => {
      const tab = flowSteps.find((step) => step.key === (event as CustomEvent<string>).detail);
      if (tab) setActiveTab(tab.key);
    };

    readHash();
    window.addEventListener("hashchange", readHash);
    window.addEventListener("owner-dashboard-tab-change", handleOwnerTabChange);
    return () => {
      window.removeEventListener("hashchange", readHash);
      window.removeEventListener("owner-dashboard-tab-change", handleOwnerTabChange);
    };
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/";
    }
  }, [isLoading, isAuthenticated]);

  const availableUnits = units.filter((u) => u.status === "vacant");
  const occupiedUnits = units.filter((u) => u.status === "occupied");
  const pendingAssignments = tenants.filter((t) => t.assignmentStatus === "pending" && t.unitId);
  const pendingPayments = payments.filter((p) => p.status === "pending");
  const overduePayments = payments.filter((p) => p.status === "overdue");
  const normalizedUnitSearch = unitSearch.trim().toLowerCase();
  const filteredUnits = units.filter((unit) => {
    const property = properties.find((item) => item.id === unit.propertyId);
    const searchMatches = !normalizedUnitSearch || `${unit.unitNumber} ${unit.tenantName || ""} ${property?.name || ""} ${property?.location || ""}`.toLowerCase().includes(normalizedUnitSearch);
    return searchMatches &&
      (unitPropertyFilter === "all" || unit.propertyId === unitPropertyFilter) &&
      (unitTypeFilter === "all" || property?.type === unitTypeFilter) &&
      (unitStatusFilter === "all" || unit.status === unitStatusFilter);
  });
  const filteredProperties = properties.filter((property) => {
    const propertyUnits = units.filter((unit) => unit.propertyId === property.id);
    const searchMatches = !normalizedUnitSearch || `${property.name} ${property.location} ${propertyUnits.map((unit) => `${unit.unitNumber} ${unit.tenantName || ""}`).join(" ")}`.toLowerCase().includes(normalizedUnitSearch);
    const statusMatches = unitStatusFilter === "all" || propertyUnits.some((unit) => unit.status === unitStatusFilter);
    return searchMatches && statusMatches && (unitTypeFilter === "all" || property.type === unitTypeFilter) && (unitPropertyFilter === "all" || property.id === unitPropertyFilter);
  });
  const filteredTenants = tenants.filter((tenant) =>
    (tenantFilter === "all" || tenant.status === tenantFilter) &&
    `${tenant.name} ${tenant.email} ${tenant.phone || ""}`.toLowerCase().includes(tenantSearch.trim().toLowerCase())
  );
  const sortedUnits = [...filteredUnits].sort((a, b) => {
    if (unitSort === "rent-desc") return b.rentAmount - a.rentAmount;
    if (unitSort === "rent-asc") return a.rentAmount - b.rentAmount;
    if (unitSort === "property") return (properties.find((property) => property.id === a.propertyId)?.name || "").localeCompare(properties.find((property) => property.id === b.propertyId)?.name || "");
    const comparison = a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
    return unitSort === "unit-desc" ? -comparison : comparison;
  });
  const currentUnitPage = Math.min(unitPage, Math.max(1, Math.ceil(sortedUnits.length / 10)));
  const visibleUnits = sortedUnits.slice((currentUnitPage - 1) * 10, currentUnitPage * 10);
  const filteredPayments = payments.filter((payment) => {
    const date = new Date(payment.paymentDate);
    const today = new Date();
    const start = new Date(today);
    if (financialDateRange === "30" || financialDateRange === "90") start.setDate(start.getDate() - Number(financialDateRange));
    if (financialDateRange === "year") start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    const unit = units.find((item) => item.id === payment.unitId);
    return (financialStatusFilter === "all" || payment.status === financialStatusFilter) &&
      (financialMethodFilter === "all" || payment.paymentMethod === financialMethodFilter) &&
      (financialUnitFilter === "all" || payment.unitId === financialUnitFilter) &&
      (financialDateRange === "all" || (!Number.isNaN(date.getTime()) && date >= start && date <= today)) &&
      `${payment.id} ${payment.tenantName} ${payment.propertyName} ${payment.unitId} ${unit?.unitNumber || ""} ${payment.status} ${payment.paymentMethod} ${payment.paymentDate} ${formatDate(payment.paymentDate)} ${payment.amountPaid} ${payment.amountDue} ${payment.balance}`.toLowerCase().includes(financialSearch.trim().toLowerCase());
  });
  const sortedFinancialPayments = [...filteredPayments].sort((a, b) => {
    if (financialSort === "amount-desc") return b.amountPaid - a.amountPaid;
    if (financialSort === "amount-asc") return a.amountPaid - b.amountPaid;
    if (financialSort === "tenant") return a.tenantName.localeCompare(b.tenantName);
    const comparison = a.paymentDate.localeCompare(b.paymentDate);
    return financialSort === "date-asc" ? comparison : -comparison;
  });
  const currentFinancialPage = Math.min(financialPage, Math.max(1, Math.ceil(filteredPayments.length / 10)));
  const visibleFinancialPayments = sortedFinancialPayments.slice((currentFinancialPage - 1) * 10, currentFinancialPage * 10);

  useEffect(() => { setUnitPage(1); }, [unitSearch, unitPropertyFilter, unitStatusFilter, unitTypeFilter, unitSort]);
  useEffect(() => { setFinancialPage(1); }, [financialSearch, financialStatusFilter, financialMethodFilter, financialUnitFilter, financialDateRange, financialSort]);

  const filteredMoveOutRequests = useMemo(() => {
    const q = moveOutSearch.trim().toLowerCase();
    return moveOutRequests.filter((r) => {
      if (moveOutStatusFilter !== "all" && r.status !== moveOutStatusFilter) return false;
      if (moveOutPropertyFilter !== "all" && r.property_name !== moveOutPropertyFilter) return false;
      if (!q) return true;
      const haystack = [
        r.id,
        r.tenant_name,
        r.property_name,
        r.unit_id,
        r.reason,
        r.status,
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [moveOutRequests, moveOutSearch, moveOutStatusFilter, moveOutPropertyFilter]);

  const moveOutCounts = useMemo(() => {
    return {
      all: moveOutRequests.length,
      pending: moveOutRequests.filter((r) => r.status === "pending").length,
      approved: moveOutRequests.filter((r) => r.status === "approved").length,
      rejected: moveOutRequests.filter((r) => r.status === "rejected").length,
    };
  }, [moveOutRequests]);

  const handleUpdateMoveOutStatus = async (id: string, status: "approved" | "rejected") => {
    try {
      const res = await fetch(`/api/move-out/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await safeParseJson(res);
      if (data.success) {
        toast.success(`Move-out request ${status}`);
        setMoveOutRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status } : r))
        );
        setSelectedMoveOut((prev: any) => prev && prev.id === id ? { ...prev, status } : prev);
        loadData();
      } else {
        toast.error(data.error || `Failed to ${status} request`);
      }
    } catch {
      toast.error(`Failed to ${status} request`);
    }
  };

  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const agentIds = Array.from(new Set(properties.map((property) => property.agentId).filter((agentId): agentId is string => Boolean(agentId))));
  const agentCommissions = agentIds.reduce<Record<string, { name: string; collected: number; commission: number; rate: number }>>((summary, agentId) => {
    const propertyIds = new Set(properties.filter((property) => property.agentId === agentId).map((property) => property.id));
    const unitIds = new Set(units.filter((unit) => propertyIds.has(unit.propertyId)).map((unit) => unit.id));
    const tenantIds = new Set(tenants.filter((tenant) => unitIds.has(tenant.unitId || "")).map((tenant) => tenant.id));
    const collected = payments
      .filter((payment) => payment.status === "paid" && tenantIds.has(payment.tenantId))
      .reduce((total, payment) => total + payment.amountPaid, 0);
    const rate = Number(agentById.get(agentId)?.commissionRate) || 0;
    summary[agentId] = {
      name: agentById.get(agentId)?.name || "Assigned agent",
      collected,
      commission: collected * rate / 100,
      rate,
    };
    return summary;
  }, {});

  const downloadUnitsExport = () => {
    const rows: Array<Array<string | number>> = [
      ["Unit No.", "Property", "Property type", "Monthly rent", "Status", "Tenant"],
      ...sortedUnits.map((unit) => { const property = properties.find((item) => item.id === unit.propertyId); return [unit.unitNumber, property?.name || "", property?.type || "", unit.rentAmount, unit.status === "vacant" ? "Available" : unit.status === "occupied" ? "Occupied" : "Under Maintenance", unit.tenantName || tenants.find((tenant) => tenant.unitId === unit.id)?.name || ""]; }),
    ];
    downloadExcelReport(`owner-units-${new Date().toISOString().slice(0, 10)}.xls`, [{ name: "Units", rows }]);
  };

  const downloadFinancialExport = () => {
    const rows: Array<Array<string | number>> = [
      ["Transaction ID", "Tenant", "Property", "Unit", "Amount due", "Amount paid", "Balance", "Status", "Date", "Method"],
      ...filteredPayments.map((payment) => [payment.id, payment.tenantName, payment.propertyName, payment.unitId, payment.amountDue, payment.amountPaid, payment.balance, payment.status, payment.paymentDate, payment.paymentMethod]),
    ];
    downloadExcelReport(`financial-transactions-${new Date().toISOString().slice(0, 10)}.xls`, [{ name: "Payments", rows }]);
  };

  const downloadFinancialPdf = () => {
    const collected = filteredPayments.filter((payment) => payment.status === "paid").reduce((total, payment) => total + payment.amountPaid, 0);
    const outstanding = filteredPayments.filter((payment) => payment.status !== "paid").reduce((total, payment) => total + payment.balance, 0);
    const lines = [
      `Transactions: ${filteredPayments.length}`,
      `Collected: PHP ${collected.toFixed(2)}`,
      `Outstanding: PHP ${outstanding.toFixed(2)}`,
      "",
      ...filteredPayments.map((payment) => `${payment.paymentDate} | ${payment.tenantName} | ${payment.propertyName} / ${payment.unitId} | ${payment.status} | Paid PHP ${payment.amountPaid.toFixed(2)} | Balance PHP ${payment.balance.toFixed(2)}`),
    ];
    downloadPdfReport(`financial-transactions-${new Date().toISOString().slice(0, 10)}.pdf`, "RentTrack Financial Transactions", lines);
  };

  const openAddProperty = () => {
    setShowCreateProperty(true);
    setCreateStep(1);
  };

  const openAddUnit = () => {
    if (properties.length === 0) {
      setShowCreateProperty(true);
      setCreateStep(1);
      return;
    }
    setNewUnitForm((current) => ({
      ...current,
      propertyId: unitPropertyFilter !== "all" ? unitPropertyFilter : properties[0].id,
    }));
    setShowAddUnit(true);
  };

  const handleAddUnit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newUnitForm.propertyId || !newUnitForm.unitNumber || Number(newUnitForm.rentAmount) < 0) {
      toast.error("Choose a property and provide the unit details");
      return;
    }
    setIsSubmitting(true);
    try {
      const newUnit = await addUnit({
        propertyId: newUnitForm.propertyId,
        unitNumber: newUnitForm.unitNumber,
        floor: newUnitForm.floor ? Number(newUnitForm.floor) : undefined,
        status: newUnitForm.status,
        rentAmount: Number(newUnitForm.rentAmount),
        imageUrl: newUnitForm.imageUrl || undefined,
        imageUrls: newUnitForm.imageUrls,
      });
      setUnits((current) => [...current, newUnit]);
      setProperties((current) => current.map((property) => property.id === newUnitForm.propertyId ? { ...property, units: property.units + 1 } : property));
      setShowAddUnit(false);
      setNewUnitForm({ propertyId: "", unitNumber: "", floor: "", status: "vacant", rentAmount: "", imageUrl: "", imageUrls: [] });
      toast.success("Rental unit added");
    } catch {
      toast.error("Failed to add rental unit");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8">
      {/* OVERVIEW */}
      {activeTab === "overview" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <ManagementBanner
            category="PORTFOLIO OVERVIEW"
            title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${user?.name?.split(" ")[0] || "Owner"}`}
            description="Real-time summary of properties, occupancy, revenue, and active portfolio operations."
            icon={LayoutDashboard}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5 sm:gap-3">
            {[
              { label: "Properties", value: properties.length, icon: Home, tone: "blue", tab: "properties" as const },
              { label: "Available units", value: availableUnits.length, icon: Home, tone: "emerald", tab: "units" as const },
              { label: "Occupied units", value: occupiedUnits.length, icon: ClipboardCheck, tone: "cyan", tab: "occupancy" as const },
              { label: "Pending approvals", value: pendingAssignments.length, icon: Clock, tone: "amber", tab: "assignments" as const },
              { label: "Pending payments", value: pendingPayments.length, icon: CreditCard, tone: "rose", tab: "financial" as const },
            ].map((stat) => (
              <button
                key={stat.label}
                type="button"
                onClick={() => { setActiveTab(stat.tab); window.location.hash = stat.tab; }}
                className="rounded-lg border border-[#dce8f5] bg-white p-3 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-colors hover:border-blue-200 hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:p-4"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{stat.label}</span>
                  <span className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    stat.tone === "blue" && "bg-blue-50 text-blue-700",
                    stat.tone === "emerald" && "bg-emerald-50 text-emerald-700",
                    stat.tone === "cyan" && "bg-cyan-50 text-cyan-700",
                    stat.tone === "amber" && "bg-amber-50 text-amber-700",
                    stat.tone === "rose" && "bg-rose-50 text-rose-700",
                  )}><stat.icon className="h-4 w-4" /></span>
                </span>
                <span className="mt-2 block text-2xl font-bold tabular-nums text-slate-950">{stat.value}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="overflow-hidden border-[#dce8f5] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <CardHeader className="border-b border-slate-100 bg-[#f6f9fd] px-4 py-3">
                <CardTitle className="text-sm font-semibold text-slate-900">Recent properties</CardTitle>
                <CardDescription className="mt-1 text-xs text-slate-500">Latest registered properties</CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-slate-100 p-0">
                {properties.slice(0, 5).map((property) => {
                  const propertyUnits = units.filter((unit) => unit.propertyId === property.id);
                  return (
                    <button key={property.id} type="button" onClick={() => { setActiveTab("properties"); window.location.hash = "properties"; }} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
                      <UnitImageCarousel images={property.imageUrls || (property.imageUrl ? [property.imageUrl] : [])} alt={property.name} className="h-12 w-16 shrink-0 rounded-md border border-slate-200" imageClassName="group-hover:scale-100" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-slate-900">{property.name}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-slate-500">{property.location}</span>
                        <span className="mt-1 block text-[10px] text-slate-500">{propertyUnits.length} units • {propertyUnits.filter((unit) => unit.status === "vacant").length} available • Added {formatDate(property.createdAt)}</span>
                      </span>
                      <Badge variant={property.status === "active" ? "success" : "outline"} className="shrink-0 text-[10px] capitalize">{property.status}</Badge>
                    </button>
                  );
                })}
                {properties.length === 0 && <p className="px-4 py-10 text-center text-xs text-slate-500">No properties have been registered yet.</p>}
              </CardContent>
            </Card>
            <Card className="overflow-hidden border-[#dce8f5] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <CardHeader className="border-b border-slate-100 bg-[#f6f9fd] px-4 py-3">
                <CardTitle className="text-sm font-semibold text-slate-900">Pending approvals</CardTitle>
                <CardDescription className="mt-1 text-xs text-slate-500">Latest tenant assignments awaiting review</CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-slate-100 p-0">
                {pendingAssignments.slice(0, 5).map((tenant) => (
                  <button key={tenant.id} type="button" onClick={() => setReviewAssignment(tenant)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-amber-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500">
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-slate-900">{tenant.name}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-slate-500">{tenant.propertyName} • Unit {tenant.unitNumber}</span>
                      <span className="mt-1 block text-[10px] tabular-nums text-slate-600">{formatCurrency(tenant.rentAmount || 0)}/mo</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <Badge variant="warning" className="text-[10px] capitalize">{tenant.assignmentStatus}</Badge>
                      <span className="mt-1 block text-[10px] text-slate-500">{formatDate(tenant.createdAt)}</span>
                    </span>
                  </button>
                ))}
                {pendingAssignments.length === 0 && <p className="px-4 py-10 text-center text-xs text-slate-500">No assignments are waiting for approval.</p>}
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {/* PROPERTIES */}
      {activeTab === "properties" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <ManagementBanner
            category="PROPERTY PORTFOLIO"
            title="Properties"
            description="Manage your real estate assets, buildings, and property portfolios."
            icon={Building2}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => setShowCreateProperty(true)}
              className="h-9 gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 text-xs font-semibold text-white shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Create Property
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {properties.map((property) => {
              const propertyUnits = units.filter((u) => u.propertyId === property.id);
              const vacant = propertyUnits.filter((u) => u.status === "vacant");
              return (
                <Card key={property.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{property.name}</h3>
                        <p className="text-sm text-text-secondary mt-1">{property.location}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={property.status === "active" ? "success" : "outline"} className="capitalize">{property.status}</Badge>
                        <Button size="sm" variant="outline" onClick={() => handleEditProperty(property)}>
                          <Eye className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteProperty(property)}>
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                    <UnitImageCarousel images={property.imageUrls || (property.imageUrl ? [property.imageUrl] : [])} alt={property.name} className="mb-4 h-40 w-full rounded-xl border border-border" />
                    <div className="flex items-center gap-4 text-sm text-text-secondary mb-4">
                      <span className="flex items-center gap-1.5"><Home className="h-4 w-4" />{property.units} units</span>
                      <span className="flex items-center gap-1.5"><ClipboardCheck className="h-4 w-4" />{vacant.length} vacant</span>
                    </div>
                    <div className="space-y-2.5">
                      <p className="text-sm font-medium text-text-secondary">Units:</p>
                      {propertyUnits.length === 0 ? (
                        <p className="text-sm text-text-tertiary">No units registered</p>
                      ) : (
                        propertyUnits.map((unit) => (
                          <div key={unit.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary">
                            <span className="text-sm font-medium">Unit Number: {unit.unitNumber}</span>
                            <Badge variant={unit.status === "vacant" ? "success" : unit.status === "occupied" ? "outline" : "warning"} className="text-xs capitalize">{unit.status}</Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {properties.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="p-12 text-center">
                  <Home className="h-12 w-12 text-text-tertiary mx-auto mb-3" />
                  <p className="text-text-secondary font-medium">No properties yet</p>
                  <p className="text-xs text-text-tertiary mt-1">Create your first property to get started</p>
                </CardContent>
              </Card>
            )}
          </div>
        </motion.div>
      )}

      {/* RENTAL UNITS */}
      {activeTab === "units" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={management.page}>
          <ManagementBanner />
          <div className={management.toolbar}>
            <label className={management.search}><Search aria-hidden="true" /><input type="search" value={unitSearch} onChange={(event) => setUnitSearch(event.target.value)} placeholder="Search by unit number, property, or tenant..." aria-label="Search properties, units, or tenants" /></label>
            <label className={management.filterCompact}><span>Property</span><select aria-label="Filter by property" value={unitPropertyFilter} onChange={(event) => setUnitPropertyFilter(event.target.value)}><option value="all">All properties</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
            <label className={management.filterCompact}><span>Property type</span><select aria-label="Filter by property type" value={unitTypeFilter} onChange={(event) => setUnitTypeFilter(event.target.value)}><option value="all">All types</option><option value="house">House</option><option value="condominium">Condominium</option></select></label>
            <label className={management.filterCompact}><span>Status</span><select aria-label="Filter by unit status" value={unitStatusFilter} onChange={(event) => setUnitStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="vacant">Available</option><option value="occupied">Occupied</option><option value="maintenance">Under Maintenance</option></select></label>
            <div className={management.toolbarActions}><button type="button" className={management.reset} onClick={() => { setUnitSearch(""); setUnitPropertyFilter("all"); setUnitStatusFilter("all"); setUnitTypeFilter("all"); }}><RotateCcw aria-hidden="true" />Reset</button><Button onClick={downloadUnitsExport} className={management.export}><Download className="h-4 w-4" />Export</Button></div>
          </div>
          <UnitMetrics total={units.length} available={availableUnits.length} occupied={occupiedUnits.length} maintenance={units.filter((unit) => unit.status === "maintenance").length} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className={management.tabs} aria-label="Portfolio view">{(["units", "properties", "occupancy"] as const).map((view) => <button key={view} type="button" aria-pressed={unitsView === view} onClick={() => setUnitsView(view)} className="capitalize">{view}</button>)}</div>
            <Button
              onClick={openAddProperty}
              className="h-9 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Properties &amp; Units
            </Button>
          </div>
          {unitsView === "properties" && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProperties.map((property) => {
              const propertyUnits = units.filter((unit) => unit.propertyId === property.id);
              return <Card key={property.id} className="overflow-hidden"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-lg font-semibold">{property.name}</h3><p className="mt-1 line-clamp-2 text-sm text-text-secondary">{property.location}</p></div><Badge variant={property.status === "active" ? "success" : "outline"} className="capitalize">{property.status}</Badge></div><div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-surface-secondary p-3 text-center text-sm"><div><p className="font-bold">{propertyUnits.length}</p><p className="text-xs text-text-tertiary">Units</p></div><div><p className="font-bold text-blue-600">{propertyUnits.filter((unit) => unit.status === "occupied").length}</p><p className="text-xs text-text-tertiary">Occupied</p></div><div><p className="font-bold text-green-600">{propertyUnits.filter((unit) => unit.status === "vacant").length}</p><p className="text-xs text-text-tertiary">Vacant</p></div></div><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { setNewUnitForm((current) => ({ ...current, propertyId: property.id })); setShowAddUnit(true); }}><Plus className="mr-1 h-3.5 w-3.5" />Add Unit</Button><Button size="sm" variant="outline" onClick={() => handleEditProperty(property)}><Eye className="mr-1 h-3.5 w-3.5" />Edit</Button><Button size="sm" variant="destructive" onClick={() => handleDeleteProperty(property)}><Trash2 className="mr-1 h-3.5 w-3.5" />Delete</Button></div>{propertyUnits.length > 0 && <div className="mt-4 space-y-2 border-t border-border pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Units</p>{propertyUnits.slice(0, 4).map((unit) => <div key={unit.id} className="flex items-center justify-between gap-3 text-sm"><span className="truncate">Unit {unit.unitNumber}</span><Badge variant={unit.status === "vacant" ? "success" : unit.status === "occupied" ? "outline" : "warning"} className="capitalize">{unit.status}</Badge></div>)}{propertyUnits.length > 4 && <p className="text-xs text-text-tertiary">and {propertyUnits.length - 4} more</p>}</div>}</CardContent></Card>;
            })}
            {filteredProperties.length === 0 && <Card className="col-span-full"><CardContent className="p-12 text-center"><Home className="mx-auto mb-3 h-10 w-10 text-text-tertiary" /><p className="font-medium text-text-secondary">No matching properties</p><p className="mt-1 text-sm text-text-tertiary">Try another search or filter.</p></CardContent></Card>}
          </div>}
          {unitsView === "units" && <section className={management.tablePanel} aria-label="Rental units">
            <div className={management.tableHeader}>
              <h2 className={management.tableTitle}>Units <span className={management.count}>{filteredUnits.length} units</span></h2>
              <div className={management.tableControls}><select value={unitSort} onChange={(event) => setUnitSort(event.target.value)} aria-label="Sort units"><option value="unit-asc">Sort by: Unit No. (A-Z)</option><option value="unit-desc">Unit No. (Z-A)</option><option value="property">Property (A-Z)</option><option value="rent-asc">Rent (Lowest first)</option><option value="rent-desc">Rent (Highest first)</option></select></div>
            </div>
            {initialLoad ? <div className={management.empty} role="status">Loading units...</div>
              : loadError ? <div className={management.empty} role="alert"><strong>Unable to load your portfolio</strong><Button variant="outline" onClick={() => void loadData()}>Try again</Button></div>
                : filteredUnits.length === 0 ? <div className={management.empty}><Home aria-hidden="true" /><strong>{units.length ? "No units match these filters" : "No units yet"}</strong><p>{units.length ? "Adjust your search or reset the filters to see your units." : "Add a property and its units to start managing your portfolio."}</p><Button variant="outline" onClick={openAddUnit}><Plus className="mr-1 h-4 w-4" />Add unit</Button></div>
                  : <><div className={management.tableScroll}><table className={management.table}>
                    <thead><tr><th>Unit No.</th><th>Property</th><th>Property Type</th><th>Monthly Rent</th><th>Status</th><th>Tenant</th><th>Actions</th></tr></thead>
                    <tbody>{visibleUnits.map((unit) => {
                      const property = properties.find((item) => item.id === unit.propertyId);
                      const tenantName = unit.tenantName || tenants.find((tenant) => tenant.unitId === unit.id)?.name;
                      return <tr key={unit.id}><td className="font-semibold">{unit.unitNumber}</td><td><span className={management.propertyCell}><Building2 aria-hidden="true" />{property?.name || "Unlinked property"}</span></td><td className="capitalize">{property?.type || "—"}</td><td className="whitespace-nowrap tabular-nums">{formatCurrency(unit.rentAmount)}</td><td><UnitStatus status={unit.status} /></td><td>{tenantName ? <span className={management.tenantCell}><User aria-hidden="true" />{tenantName}</span> : "—"}</td><td>
                        <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for unit ${unit.unitNumber}`} className="h-8 w-8 text-blue-700"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => handleEditUnit(unit)} icon={<Eye className="h-4 w-4" />}>Edit unit and property</DropdownMenuItem><DropdownMenuItem onSelect={() => handleDeleteUnit(unit)} icon={<Trash2 className="h-4 w-4" />} className="text-red-600">Delete unit</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                      </td></tr>;
                    })}</tbody>
                  </table></div><ManagementPagination page={currentUnitPage} total={filteredUnits.length} noun="units" onPageChange={setUnitPage} /></>}
          </section>}
          {unitsView === "occupancy" && <Card><CardHeader><CardTitle className="text-lg">Occupancy summary</CardTitle><CardDescription>Filtered unit availability by property</CardDescription></CardHeader><CardContent className="space-y-3">
            {filteredProperties.map((property) => { const propertyUnits = filteredUnits.filter((unit) => unit.propertyId === property.id); const occupied = propertyUnits.filter((unit) => unit.status === "occupied").length; const rate = propertyUnits.length ? Math.round((occupied / propertyUnits.length) * 100) : 0; return <div key={property.id} className="rounded-xl border border-border p-4"><div className="flex justify-between gap-4"><div><p className="font-medium">{property.name}</p><p className="text-xs text-text-secondary">{occupied} of {propertyUnits.length} units occupied</p></div><p className="font-bold text-blue-600">{rate}%</p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${rate}%` }} /></div></div>; })}
          </CardContent></Card>}
        </motion.div>
      )}

      {/* TENANT ASSIGNMENTS */}
      {activeTab === "assignments" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <ManagementBanner
            category="ASSIGNMENT MANAGEMENT"
            title="Pending Approvals"
            description="Review and manage tenant unit assignments submitted by your agents."
            icon={ClipboardCheck}
          />
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                {tenants.filter(t => t.assignmentStatus === "pending" && t.unitId).length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <p className="text-text-secondary font-medium">All caught up!</p>
                    <p className="text-xs text-text-tertiary mt-1">No pending assignments to review</p>
                  </div>
                ) : (
                  tenants.filter(t => t.assignmentStatus === "pending" && t.unitId).map((tenant) => (
                    <div key={tenant.id} className="flex items-center justify-between p-4 rounded-xl border border-amber-200 bg-amber-50">
                      <div className="flex items-center gap-3">
                        <Avatar src={tenant.avatarUrl} fallback={getInitials(tenant.name)} />
                        <div>
                          <p className="font-medium text-foreground">{tenant.name}</p>
                          <p className="text-xs text-text-secondary">{tenant.propertyName} • {tenant.unitNumber}</p>
                          <p className="text-xs text-text-tertiary">{formatCurrency(tenant.rentAmount || 0)}/mo</p>
                          {tenant.phone && <p className="text-xs text-text-secondary">{tenant.phone}</p>}
                          {tenant.address && <p className="text-xs text-text-tertiary">{tenant.address}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => setReviewAssignment(tenant)} className="bg-blue-600 hover:bg-blue-700 text-white">
                          <Eye className="h-4 w-4 mr-1" />Review
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* MOVE-OUT REQUESTS */}
      {(activeTab === "move-out-requests" || (activeTab as string) === "move-out") && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <ManagementBanner
            category="OCCUPANCY MANAGEMENT"
            title="Move-Out Requests"
            description="Review tenant requests to end their tenancy, schedule inspections, and manage unit turnover."
            icon={LogOut}
          />

          {/* Toolbar & Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            {/* Search Input */}
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={moveOutSearch}
                onChange={(e) => setMoveOutSearch(e.target.value)}
                placeholder="Search by tenant, property, unit, or reason..."
                aria-label="Search move-out requests"
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Status Dropdown Filter */}
            <div className="flex items-center gap-1.5">
              <select
                value={moveOutStatusFilter}
                onChange={(e) => setMoveOutStatusFilter(e.target.value as any)}
                aria-label="Filter by status"
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All Statuses ({moveOutCounts.all})</option>
                <option value="pending">Pending ({moveOutCounts.pending})</option>
                <option value="approved">Approved ({moveOutCounts.approved})</option>
                <option value="rejected">Rejected ({moveOutCounts.rejected})</option>
              </select>
            </div>

            {/* Property Dropdown Filter */}
            <div className="flex items-center gap-1.5">
              <select
                value={moveOutPropertyFilter}
                onChange={(e) => setMoveOutPropertyFilter(e.target.value)}
                aria-label="Filter by property"
                className="h-9 max-w-[200px] truncate rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All Properties</option>
                {Array.from(new Set(moveOutRequests.map((r) => r.property_name).filter(Boolean))).map((propName) => (
                  <option key={propName} value={propName}>{propName}</option>
                ))}
              </select>
            </div>

            {/* Reset Button */}
            {(moveOutSearch || moveOutStatusFilter !== "all" || moveOutPropertyFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setMoveOutSearch("");
                  setMoveOutStatusFilter("all");
                  setMoveOutPropertyFilter("all");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            )}
          </div>

          {/* Requests List */}
          <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/75 px-5 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">
                    Move-Out Requests
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Showing {filteredMoveOutRequests.length} of {moveOutRequests.length} total request{moveOutRequests.length === 1 ? "" : "s"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-xs">
                    {moveOutCounts.pending} Pending
                  </Badge>
                  <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 text-xs">
                    {moveOutCounts.approved} Approved
                  </Badge>
                  <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-xs">
                    {moveOutCounts.rejected} Rejected
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredMoveOutRequests.length === 0 ? (
                <div className="py-14 text-center">
                  <LogOut className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-medium text-slate-700">No move-out requests found</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {moveOutRequests.length
                      ? "Try clearing your search or status filter to see other requests."
                      : "When tenants submit move-out notices, they will appear here."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredMoveOutRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex flex-col gap-4 p-4 transition-colors hover:bg-slate-50/60 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <Avatar
                          fallback={getInitials(request.tenant_name || "Tenant")}
                          className="h-10 w-10 border border-slate-200 bg-blue-50 text-xs font-semibold text-blue-700 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900 text-sm">{request.tenant_name || "Tenant"}</span>
                            <Badge
                              variant={
                                request.status === "approved"
                                  ? "success"
                                  : request.status === "rejected"
                                  ? "destructive"
                                  : "warning"
                              }
                              className="text-[10px] capitalize"
                            >
                              {request.status}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-600">
                            {request.property_name || "Property"} • Unit {request.unit_id || "N/A"}
                          </p>
                          {request.reason && (
                            <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 bg-slate-50 rounded-md p-2 border border-slate-100">
                              <span className="font-medium text-slate-700">Reason: </span>
                              {request.reason}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-slate-400">
                            Submitted on {formatDate(request.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {request.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleUpdateMoveOutStatus(request.id, "approved")}
                              className="h-8 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3"
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateMoveOutStatus(request.id, "rejected")}
                              className="h-8 rounded-lg border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium px-3"
                            >
                              Reject
                            </Button>
                          </>
                        )}

                        {/* 3-Dots Dropdown Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-slate-500 hover:text-slate-800"
                              aria-label="More actions"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setSelectedMoveOut(request)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View details
                            </DropdownMenuItem>
                            {request.status === "pending" && (
                              <>
                                <DropdownMenuItem onSelect={() => handleUpdateMoveOutStatus(request.id, "approved")} className="text-green-700">
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Approve request
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleUpdateMoveOutStatus(request.id, "rejected")} className="text-red-600">
                                  <X className="mr-2 h-4 w-4" />
                                  Reject request
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem
                              onSelect={() => {
                                navigator.clipboard.writeText(request.id);
                                toast.success("Request ID copied to clipboard");
                              }}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Copy Request ID
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Move-Out Request Details Modal */}
          {selectedMoveOut && (
            <Modal
              isOpen={!!selectedMoveOut}
              onClose={() => setSelectedMoveOut(null)}
              title="Move-Out Request Details"
            >
              <div className="space-y-4 p-2 text-sm text-slate-700">
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <Avatar fallback={getInitials(selectedMoveOut.tenant_name || "Tenant")} className="h-12 w-12 bg-blue-100 text-blue-700 font-bold" />
                  <div>
                    <h3 className="font-semibold text-slate-900 text-base">{selectedMoveOut.tenant_name}</h3>
                    <p className="text-xs text-slate-500">{selectedMoveOut.property_name} • Unit {selectedMoveOut.unit_id}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Request ID: {selectedMoveOut.id}</p>
                  </div>
                  <div className="ml-auto">
                    <Badge
                      variant={
                        selectedMoveOut.status === "approved"
                          ? "success"
                          : selectedMoveOut.status === "rejected"
                          ? "destructive"
                          : "warning"
                      }
                      className="capitalize"
                    >
                      {selectedMoveOut.status}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reason for Moving Out</label>
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-800">
                    {selectedMoveOut.reason || "No specific reason provided."}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                    <span className="text-slate-400 block mb-0.5">Date Submitted</span>
                    <span className="font-medium text-slate-800">{formatDate(selectedMoveOut.created_at)}</span>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                    <span className="text-slate-400 block mb-0.5">Current Status</span>
                    <span className="font-medium text-slate-800 capitalize">{selectedMoveOut.status}</span>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                  {selectedMoveOut.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateMoveOutStatus(selectedMoveOut.id, "approved")}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Approve Move-Out
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateMoveOutStatus(selectedMoveOut.id, "rejected")}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        Reject Request
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setSelectedMoveOut(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </Modal>
          )}
        </motion.div>
      )}

      {/* AGENTS */}
      {activeTab === "agents" && (
        <OwnerAgentsPage />
      )}

      {/* PROPERTY MAP */}
      {activeTab === "map" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <ManagementBanner
            category="GEOGRAPHIC OVERVIEW"
            title="Property Map"
            description="View geographic locations and status of your properties on an interactive map."
            icon={MapPinned}
          />
          <PropertyLocationMap hideHeader />
        </motion.div>
      )}

      {/* CREATE TENANT / TENANTS DIRECTORY */}
      {activeTab === "create-tenant" && (
        <TenantsPanel
          tenants={tenants}
          properties={properties}
          units={units}
          onReload={loadData}
          onCreateTenant={() => setShowCreateTenantModal(true)}
        />
      )}

      {/* RENTAL CONTRACTS */}
      {activeTab === "contracts" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <ContractsPanel mode="owner" />
        </motion.div>
      )}
      {/* OCCUPANCY */}
      {activeTab === "occupancy" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <ManagementBanner
            category="OCCUPANCY MANAGEMENT"
            title="Occupancy & Leases"
            description="Monitor unit occupancy rates, vacant inventory, and tenancy breakdown across all properties."
            icon={Home}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Card>
              <CardContent className="min-h-[140px] p-6">
                <p className="text-sm font-medium text-text-secondary mb-2">Total Units</p>
                <p className="text-3xl font-bold text-foreground">{units.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="min-h-[140px] p-6">
                <p className="text-sm font-medium text-text-secondary mb-2">Available</p>
                <p className="text-3xl font-bold text-green-600">{availableUnits.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="min-h-[140px] p-6">
                <p className="text-sm font-medium text-text-secondary mb-2">Occupied</p>
                <p className="text-3xl font-bold text-blue-600">{occupiedUnits.length}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Occupancy by Property</CardTitle>
              <CardDescription>Unit status breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                  {properties.map((property) => {
                    const propertyUnits = units.filter((u) => u.propertyId === property.id);
                    const vacant = propertyUnits.filter((u) => u.status === "vacant");
                    const occupied = propertyUnits.filter((u) => u.status === "occupied");
                    return (
                      <div key={property.id} onClick={() => setSelectedProperty(property)} className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors ${selectedProperty?.id === property.id ? "border-blue-500 bg-blue-50" : "border-border hover:bg-surface-secondary"}`}>
                        <div>
                          <p className="text-base font-medium text-foreground">{property.name}</p>
                          <p className="text-sm text-text-secondary">{property.location}</p>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-green-600 font-medium">{vacant.length} available</span>
                          <span className="text-blue-600 font-medium">{occupied.length} occupied</span>
                        </div>
                      </div>
                    );
                  })}
                  {properties.length === 0 && <p className="text-center py-8 text-text-secondary">No properties yet</p>}
                </div>
                {selectedProperty ? (
                  <div className="border border-border rounded-xl p-4">
                    <h4 className="text-base font-semibold text-foreground mb-3">{selectedProperty.name} - Units</h4>
                    <div className="space-y-2">
                      {(() => {
                        const propertyUnits = units.filter((u) => u.propertyId === selectedProperty.id);
                        if (propertyUnits.length === 0) return <p className="text-sm text-text-tertiary">No units registered</p>;
                        return propertyUnits.map((unit) => {
                          const tenant = tenants.find((t) => t.unitId === unit.id || t.unitNumber === unit.unitNumber);
                          return (
                            <div key={unit.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary">
                              <div>
                                <span className="text-sm font-medium">Unit {unit.unitNumber}</span>
                                {tenant && <span className="text-xs text-text-secondary ml-2">({tenant.name})</span>}
                              </div>
                              <Badge variant={unit.status === "vacant" ? "success" : unit.status === "occupied" ? "outline" : "warning"} className="text-xs capitalize">{unit.status}</Badge>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-border rounded-xl flex items-center justify-center p-8">
                    <p className="text-sm text-text-tertiary">Select a property to view its units</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* PAYMENTS */}
      {activeTab === "payments" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <ManagementBanner
            category="FINANCIAL MANAGEMENT"
            title="Payments"
            description="Track payment status, verify transactions, and view receipts across all tenants."
            icon={CreditCard}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card>
              <CardContent className="min-h-[140px] p-6">
                <p className="text-sm font-medium text-text-secondary mb-2">Total Collected</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amountPaid, 0))}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="min-h-[140px] p-6">
                <p className="text-sm font-medium text-text-secondary mb-2">Pending</p>
                <p className="text-3xl font-bold text-amber-600">{pendingPayments.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="min-h-[140px] p-6">
                <p className="text-sm font-medium text-text-secondary mb-2">Overdue</p>
                <p className="text-3xl font-bold text-red-600">{overduePayments.length}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Records</CardTitle>
              <CardDescription>All payment transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {payments.length === 0 ? (
                  <p className="text-center py-8 text-text-secondary">No payment records yet</p>
                ) : (
                  payments.slice().reverse().map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-surface-secondary transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar src={payment.tenantName ? (tenants.find(t => t.name === payment.tenantName)?.avatarUrl || "") : ""} fallback={getInitials(payment.tenantName)} size="sm" />
                        <div>
                          <p className="text-base font-medium text-foreground">{payment.tenantName}</p>
                          <p className="text-sm text-text-secondary">{payment.propertyName} • {formatDate(payment.paymentDate)}</p>
                          {payment.stayStart && payment.stayEnd && (
                            <p className="text-xs text-blue-600">Stay: {formatDate(payment.stayStart)} - {formatDate(payment.stayEnd)}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold text-foreground">{formatCurrency(payment.amountPaid || 0)}</p>
                        <Badge variant={payment.status === "paid" ? "success" : payment.status === "pending" ? "warning" : payment.status === "overdue" ? "destructive" : "outline"} className="text-sm font-semibold capitalize">{payment.status}</Badge>
                        <div className="mt-2 flex justify-end gap-2">
                          {payment.receiptUrl && <Button size="sm" variant="outline" onClick={() => setViewingReceipt(payment)}>View Receipt</Button>}
                          {payment.status === "pending" && <Button size="sm" onClick={async () => { const updated = await verifyPayment(payment, user?.id || "", "paid"); if (updated) { setPayments((current) => current.map((item) => item.id === payment.id ? updated : item)); toast.success("Payment confirmed"); window.dispatchEvent(new Event("payment-confirmed")); } }}>Confirm</Button>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* RECEIVABLES */}
      {activeTab === "receivables" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <ManagementBanner
            category="FINANCIAL MANAGEMENT"
            title="Receivables"
            description="Monitor outstanding balances, track overdue accounts, and manage collection notices."
            icon={CreditCard}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card>
              <CardContent className="min-h-[140px] p-6">
                <p className="text-sm font-medium text-text-secondary mb-2">Total Receivables</p>
                <p className="text-3xl font-bold text-foreground">{formatCurrency(payments.filter((p) => p.status === "pending" || p.status === "overdue").reduce((sum, p) => sum + (p.balance || 0), 0))}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="min-h-[140px] p-6">
                <p className="text-sm font-medium text-text-secondary mb-2">Outstanding</p>
                <p className="text-3xl font-bold text-amber-600">{payments.filter((p) => p.status === "pending").length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="min-h-[140px] p-6">
                <p className="text-sm font-medium text-text-secondary mb-2">Overdue</p>
                <p className="text-3xl font-bold text-red-600">{overduePayments.length}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Receivable Details</CardTitle>
              <CardDescription>Outstanding balances by tenant</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {payments.filter((p) => p.status === "pending" || p.status === "overdue").length === 0 ? (
                  <p className="text-center py-8 text-text-secondary">No outstanding receivables</p>
                ) : (
                  payments.filter((p) => p.status === "pending" || p.status === "overdue").map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-surface-secondary transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar src={payment.tenantName ? (tenants.find(t => t.name === payment.tenantName)?.avatarUrl || "") : ""} fallback={getInitials(payment.tenantName)} size="sm" />
                        <div>
                          <p className="text-base font-medium text-foreground">{payment.tenantName}</p>
                          <p className="text-sm text-text-secondary">{payment.propertyName} • Unit {payment.unitId}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold text-foreground">{formatCurrency(payment.balance || 0)}</p>
                        <p className="text-xs text-text-secondary">Due {formatDate(payment.dueDate)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* FINANCIAL TRANSACTIONS */}
      {activeTab === "financial" && (() => {
        const filteredCollected = filteredPayments
          .filter((payment) => payment.status === "paid")
          .reduce((total, payment) => total + payment.amountPaid, 0);
        const filteredOutstanding = filteredPayments
          .filter((payment) => payment.status !== "paid")
          .reduce((total, payment) => total + payment.balance, 0);
        const filteredReceiptCount = filteredPayments.filter((payment) => payment.receiptUrl).length;

        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={management.page}>
            <ManagementBanner financial />
            <div className={management.toolbar}>
              <label className={management.search}><Search aria-hidden="true" /><input type="search" value={financialSearch} onChange={(event) => setFinancialSearch(event.target.value)} placeholder="Search by tenant, unit, reference, or transaction ID..." aria-label="Search payments" /></label>
              <label className={management.filter}><span>Date Range</span><select aria-label="Filter payments by date range" value={financialDateRange} onChange={(event) => setFinancialDateRange(event.target.value)}><option value="all">All dates</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="year">This year</option></select></label>
              <label className={management.filter}><span>Payment Method</span><select aria-label="Filter payments by method" value={financialMethodFilter} onChange={(event) => setFinancialMethodFilter(event.target.value)}><option value="all">All methods</option><option value="cash">Cash</option><option value="upload_receipt">Receipt upload</option></select></label>
              <label className={management.filter}><span>Status</span><select aria-label="Filter payments by status" value={financialStatusFilter} onChange={(event) => setFinancialStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="paid">Verified / Paid</option><option value="pending">Pending</option><option value="overdue">Overdue</option><option value="partial">Partial</option></select></label>
              <label className={management.filter}><span>Unit</span><select aria-label="Filter payments by unit" value={financialUnitFilter} onChange={(event) => setFinancialUnitFilter(event.target.value)}><option value="all">All units</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{properties.find((property) => property.id === unit.propertyId)?.name || "Property"} • Unit {unit.unitNumber}</option>)}</select></label>
              <div className={management.toolbarActions}>
                <button type="button" className={management.reset} onClick={() => { setFinancialSearch(""); setFinancialDateRange("all"); setFinancialMethodFilter("all"); setFinancialStatusFilter("all"); setFinancialUnitFilter("all"); }}><RotateCcw aria-hidden="true" />Reset</button>
                <Button onClick={downloadFinancialExport} className={management.export}><Download className="h-4 w-4" />Excel</Button><Button variant="outline" onClick={downloadFinancialPdf}><Download className="mr-1.5 h-4 w-4" />PDF</Button>
              </div>
            </div>
            <FinancialMetrics collected={formatCurrency(filteredCollected)} pending={formatCurrency(filteredPayments.filter((payment) => payment.status === "pending").reduce((total, payment) => total + payment.amountPaid, 0))} outstanding={formatCurrency(filteredOutstanding)} transactions={filteredPayments.length} pendingCount={filteredPayments.filter((payment) => payment.status === "pending").length} openCount={filteredPayments.filter((payment) => payment.status !== "paid").length} />
            <div className={management.tabs} aria-label="Financial views">{([
              ["payments", "Payments"], ["approvals", "Pending approvals"], ["reports", "Reports"],
            ] as const).map(([view, label]) => <button key={view} type="button" aria-pressed={financialView === view} onClick={() => setFinancialView(view)}>{label}{view === "approvals" && pendingAssignments.length > 0 && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">{pendingAssignments.length}</span>}</button>)}</div>
            {financialView === "payments" && <section className={management.tablePanel} aria-label="Financial transactions">
              <div className={management.tableHeader}>
                <h2 className={management.tableTitle}>Transactions <span className={management.count}>{filteredPayments.length}</span></h2>
                <div className={management.tableControls}><select value={financialSort} onChange={(event) => setFinancialSort(event.target.value)} aria-label="Sort transactions"><option value="date-desc">Sort by: Date (Newest)</option><option value="date-asc">Date (Oldest)</option><option value="tenant">Tenant (A-Z)</option><option value="amount-desc">Amount (Highest first)</option><option value="amount-asc">Amount (Lowest first)</option></select></div>
              </div>
              {initialLoad ? <div className={management.empty} role="status">Loading transactions...</div>
                : loadError ? <div className={management.empty} role="alert"><strong>Unable to load your transactions</strong><Button variant="outline" onClick={() => void loadData()}>Try again</Button></div>
                  : filteredPayments.length === 0 ? <div className={management.empty}><Search aria-hidden="true" /><strong>No transactions found</strong><p>Payment activity will appear here. Adjust your filters to see other records.</p></div>
                    : <><div className={management.tableScroll}><table className={management.table}>
                      <thead><tr><th>Date</th><th>Tenant</th><th>Unit</th><th>Method</th><th>Amount</th><th>Status</th><th>Reference No.</th><th>Actions</th></tr></thead>
                      <tbody>{visibleFinancialPayments.map((payment) => {
                        const unit = units.find((item) => item.id === payment.unitId);
                        return <tr key={payment.id}>
                          <td className="whitespace-nowrap">{formatDate(payment.paymentDate)}</td>
                          <td><span className={management.tenantCell}><span className={management.initials}>{getInitials(payment.tenantName)}</span>{payment.tenantName}</span></td>
                          <td className="whitespace-nowrap">{unit ? `Unit ${unit.unitNumber}` : payment.unitId || "–"}</td>
                          <td><span className={management.method}>{payment.paymentMethod === "cash" ? "Cash" : "Receipt upload"}</span></td>
                          <td className="whitespace-nowrap tabular-nums">{formatCurrency(payment.amountPaid)}</td>
                          <td><PaymentStatus status={payment.status} /></td><td className="max-w-44 truncate" title={payment.id}>{payment.id}</td>
                          <td><span className={management.actions}>
                            {payment.receiptUrl && <Button size="sm" variant="outline" onClick={() => setViewingReceipt(payment)}>Receipt</Button>}
                            {payment.status === "pending" && <Button size="sm" onClick={async () => {
                              try {
                                const updated = await verifyPayment(payment, user?.id || "", "paid");
                                if (updated) { setPayments((current) => current.map((item) => item.id === payment.id ? updated : item)); toast.success("Payment confirmed"); window.dispatchEvent(new Event("payment-confirmed")); }
                                else toast.error("Unable to confirm this payment");
                              } catch { toast.error("Unable to confirm this payment"); }
                            }}>Confirm</Button>}
                            {!payment.receiptUrl && payment.status !== "pending" && <span>–</span>}
                          </span></td>
                        </tr>;
                      })}</tbody>
                    </table></div><ManagementPagination page={currentFinancialPage} total={filteredPayments.length} noun="transactions" onPageChange={setFinancialPage} /></>}
            </section>}

            {financialView === "approvals" && (
              <Card className="overflow-hidden border-border/80 bg-surface">
                <CardHeader className="border-b border-border bg-surface-secondary/60 px-4 py-3 sm:px-5">
                  <CardTitle className="text-lg font-semibold">Pending approvals</CardTitle>
                  <CardDescription className="mt-1">Tenant assignments waiting for owner review</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {pendingAssignments.length > 0 ? (
                    <div className="divide-y divide-border">
                      {pendingAssignments.map((tenant) => (
                        <div key={tenant.id} className="flex flex-col gap-3 px-4 py-4 sm:px-5 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{tenant.name}</p>
                            <p className="mt-1 text-xs text-text-secondary">
                              {tenant.propertyName} • Unit {tenant.unitNumber}
                            </p>
                          </div>
                          <Button size="sm" onClick={() => setReviewAssignment(tenant)}>
                            Review
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-[180px] items-center justify-center px-6 py-10">
                      <div className="text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface-secondary text-text-secondary">
                          <ClipboardCheck className="h-5 w-5" />
                        </div>
                        <h3 className="mt-4 text-base font-semibold text-foreground">No pending approvals</h3>
                        <p className="mt-2 text-sm text-text-secondary">Assigned tenants are clear and ready to move forward.</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {financialView === "reports" && (
              <div className="space-y-5">
                <Card className="border-border/80 bg-surface">
                  <CardHeader className="border-b border-border bg-surface-secondary/60 px-4 py-3 sm:px-5">
                    <CardTitle className="text-lg font-semibold">Receipt and payment summary</CardTitle>
                    <CardDescription className="mt-1">Totals are based on the payments matching your search and status filter.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
                    <div className="rounded-2xl border border-border bg-surface-secondary p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-secondary">Collected</p>
                      <p className="mt-3 text-2xl font-bold text-green-600">{formatCurrency(filteredCollected)}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-surface-secondary p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-secondary">Outstanding</p>
                      <p className="mt-3 text-2xl font-bold text-amber-600">{formatCurrency(filteredOutstanding)}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-surface-secondary p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-secondary">Receipts attached</p>
                      <p className="mt-3 text-2xl font-bold text-blue-600">{filteredReceiptCount}</p>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-5 md:grid-cols-2">
                  <Card className="border-border/80 bg-surface">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold text-foreground">Rental income</h2>
                          <p className="mt-1 text-sm text-text-secondary">Monthly and annual rental income reports</p>
                        </div>
                        <BarChart3 className="h-5 w-5 text-text-secondary" />
                      </div>
                      <Button variant="outline" className="mt-5 w-full" onClick={() => setViewingReport("rental")}>
                        View report
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-border/80 bg-surface">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold text-foreground">Property reports</h2>
                          <p className="mt-1 text-sm text-text-secondary">Property performance and occupancy reports</p>
                        </div>
                        <FileText className="h-5 w-5 text-text-secondary" />
                      </div>
                      <Button variant="outline" className="mt-5 w-full" onClick={() => setViewingReport("property")}>
                        View report
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-border/80 bg-surface">
                  <CardHeader className="border-b border-border bg-surface-secondary/60 px-4 py-3 sm:px-5">
                    <CardTitle className="text-lg font-semibold">Agent commission</CardTitle>
                    <CardDescription className="mt-1">Calculated from paid rent for tenants assigned to each agent&apos;s linked units, using that agent&apos;s saved commission rate.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4 sm:p-5">
                    {Object.entries(agentCommissions).length > 0 ? (
                      Object.entries(agentCommissions).map(([id, commission]) => (
                        <div key={id} className="flex items-center justify-between rounded-xl border border-border bg-surface-secondary p-4">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{commission.name}</p>
                            <p className="mt-1 text-xs text-text-secondary">Collected rent: {formatCurrency(commission.collected)} • {commission.rate}% rate</p>
                          </div>
                          <p className="text-lg font-bold text-primary-600">{formatCurrency(commission.commission)}</p>
                        </div>
                      ))
                    ) : (
                      <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-border bg-surface-secondary/60 px-6 text-center">
                        <p className="text-sm text-text-secondary">No agent-linked paid rent yet.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </motion.div>
        );
      })()}

      {/* REPORTS */}
      {activeTab === "reports" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <ManagementBanner
            category="FINANCIAL REPORTS"
            title="Receipts & Reports"
            description="Review rental income, financial performance, and export transaction summaries."
            icon={BarChart3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={downloadFinancialPdf} className="border-slate-300 bg-white shadow-sm text-slate-700 hover:bg-slate-50"><Download className="mr-2 h-4 w-4" />Download PDF</Button>
            <Button onClick={downloadFinancialExport} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"><Download className="mr-2 h-4 w-4" />Download Excel</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-secondary-500 to-secondary-600 text-white flex items-center justify-center">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Rental Income</h3>
                </div>
                <p className="text-sm text-text-secondary mb-4">Monthly and annual rental income reports</p>
                <Button variant="outline" className="w-full" onClick={() => setViewingReport("rental")}>View Report</Button>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Property Reports</h3>
                </div>
                <p className="text-sm text-text-secondary mb-4">Property performance and occupancy reports</p>
                <Button variant="outline" className="w-full" onClick={() => setViewingReport("property")}>View Report</Button>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {/* Messaging Modal */}
      {selectedConversation && (
        <MessagingModal
          isOpen={isMessagingOpen}
          onClose={() => { setIsMessagingOpen(false); setSelectedConversation(null); }}
          otherUser={{
            id: selectedConversation.otherUser?.id || "",
            name: selectedConversation.otherUser?.name || "Unknown",
            email: selectedConversation.otherUser?.email || "",
            role: selectedConversation.otherUser?.role || "tenant",
            avatarUrl: selectedConversation.otherUser?.avatarUrl,
            allowMessages: true,
          }}
          properties={[]}
        />
      )}

      {/* Add Unit Modal */}
      {showAddUnit && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddUnit(false)} />
          <form onSubmit={handleAddUnit} className="relative w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between"><div><h3 className="text-lg font-semibold">Add Rental Unit</h3><p className="text-sm text-text-secondary">Add another unit to an existing property.</p></div><button type="button" onClick={() => setShowAddUnit(false)} className="rounded-lg p-2 hover:bg-surface-secondary"><X className="h-4 w-4" /></button></div>
            <div className="space-y-4"><div><label className="mb-1.5 block text-sm font-medium">Property *</label><select required value={newUnitForm.propertyId} onChange={(event) => setNewUnitForm({ ...newUnitForm, propertyId: event.target.value })} className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"><option value="">Select a property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></div><div className="grid grid-cols-2 gap-3"><div><label className="mb-1.5 block text-sm font-medium">Unit number *</label><Input required value={newUnitForm.unitNumber} onChange={(event) => setNewUnitForm({ ...newUnitForm, unitNumber: event.target.value })} placeholder="101" /></div><div><label className="mb-1.5 block text-sm font-medium">Floor</label><Input type="number" min="0" value={newUnitForm.floor} onChange={(event) => setNewUnitForm({ ...newUnitForm, floor: event.target.value })} placeholder="1" /></div></div><div className="grid grid-cols-2 gap-3"><div><label className="mb-1.5 block text-sm font-medium">Monthly rent *</label><Input required type="number" min="0" value={newUnitForm.rentAmount} onChange={(event) => setNewUnitForm({ ...newUnitForm, rentAmount: event.target.value })} placeholder="15000" /></div><div><label className="mb-1.5 block text-sm font-medium">Status</label><select value={newUnitForm.status} onChange={(event) => setNewUnitForm({ ...newUnitForm, status: event.target.value as Unit["status"] })} className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"><option value="vacant">Vacant</option><option value="occupied">Occupied</option><option value="maintenance">Maintenance</option></select></div></div><div><label className="mb-1.5 block text-sm font-medium">Unit photos</label><Input type="file" accept="image/*" multiple onChange={async (event) => { const files = Array.from(event.target.files || []); if (!files.length) return; try { const urls = await Promise.all(files.map(async (file) => { const upload = new FormData(); upload.append("file", file); upload.append("type", "unit"); try { const response = await fetch("/api/auth/upload", { method: "POST", credentials: "include", body: upload }); const result = await safeParseJson(response); if (result.success && result.url) return result.url as string; throw new Error(result.error || "Upload failed"); } catch { return new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = () => resolve(""); reader.readAsDataURL(file); }); } })); const validUrls = urls.filter(Boolean); setNewUnitForm((current) => ({ ...current, imageUrl: current.imageUrl || validUrls[0], imageUrls: [...current.imageUrls, ...validUrls] })); event.target.value = ""; toast.success(`${validUrls.length} image${validUrls.length === 1 ? "" : "s"} added`); } catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed"); } }} /></div>{newUnitForm.imageUrls.length > 0 && <div className="flex flex-wrap gap-2">{newUnitForm.imageUrls.map((url, index) => <Image key={`${url}-${index}`} src={url} alt={`Preview ${index + 1}`} width={64} height={64} unoptimized className="h-16 w-16 rounded-lg object-cover" />)}</div>}</div>
            <div className="mt-6 flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setShowAddUnit(false)}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Adding..." : "Add Unit"}</Button></div>
          </form>
        </div>
      )}

      {/* Create Property Modal */}
      {showCreateProperty && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowCreateProperty(false); setCreateStep(1); }} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Add Property &amp; Units</h3>
                  <p className="text-sm text-text-secondary">Register a property and set up its rental units together</p>
                </div>
                <button onClick={() => { setShowCreateProperty(false); setCreateStep(1); }} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-foreground hover:bg-surface-secondary transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <form onSubmit={handleCreateProperty} className="p-6 space-y-4">
              {createStep === 1 && (
                <div className="space-y-5">
                  <div><h4 className="text-base font-semibold text-foreground">Property Details</h4><p className="mt-1 text-sm text-text-secondary">Start with the property&apos;s location and type.</p></div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Property Name *</label>
                    <Input value={propertyForm.name} onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Address *</label>
                    <Input value={propertyForm.address} onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })} required />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">City *</label>
                      <Input value={propertyForm.city} onChange={(e) => setPropertyForm({ ...propertyForm, city: e.target.value })} required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Province *</label>
                      <Input value={propertyForm.province} onChange={(e) => setPropertyForm({ ...propertyForm, province: e.target.value })} required />
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium">Map coordinates <span className="font-normal text-text-secondary">(optional)</span></p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs text-text-secondary">Latitude</label>
                        <Input type="number" step="any" min="-90" max="90" value={propertyForm.latitude} onChange={(e) => setPropertyForm({ ...propertyForm, latitude: e.target.value })} placeholder="e.g. 8.9475" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs text-text-secondary">Longitude</label>
                        <Input type="number" step="any" min="-180" max="180" value={propertyForm.longitude} onChange={(e) => setPropertyForm({ ...propertyForm, longitude: e.target.value })} placeholder="e.g. 125.5406" />
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-text-secondary">Enter both coordinates to place a marker on the property map.</p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-secondary/40 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Classification & availability</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Property Type</label>
                        <select value={propertyForm.type} onChange={(e) => setPropertyForm({ ...propertyForm, type: e.target.value as "house" | "condominium" })} className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm">
                          <option value="house">House</option><option value="condominium">Condominium</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Current Property Condition</label>
                        <select value={propertyForm.condition} onChange={(e) => setPropertyForm({ ...propertyForm, condition: e.target.value })} className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm">
                          <option value="">Select condition...</option>
                          {PROPERTY_CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Availability Status</label>
                        <select value={propertyForm.availabilityStatus} onChange={(e) => setPropertyForm({ ...propertyForm, availabilityStatus: e.target.value as typeof AVAILABILITY_STATUSES[number] })} className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm">
                          {AVAILABILITY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Property Features</label>
                    <FeaturePicker value={propertyForm.features} onChange={(features) => setPropertyForm({ ...propertyForm, features })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Property Image</label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-surface-secondary cursor-pointer hover:bg-surface-tertiary transition-colors">
                        <Camera className="h-4 w-4" />
                        <span className="text-sm">{propertyForm.imageUrl ? "Change Image" : "Upload Image"}</span>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handlePropertyImageUpload} disabled={isUploadingPropertyImage} />
                      </label>
                      {isUploadingPropertyImage && <span className="text-xs text-text-secondary">Uploading...</span>}
                      {propertyForm.imageUrls.length > 0 && <div className="flex flex-wrap gap-2">{propertyForm.imageUrls.map((url, index) => <Image key={`${url}-${index}`} src={url} alt={`Property preview ${index + 1}`} width={80} height={80} unoptimized className="h-20 w-20 rounded-lg object-cover border border-border" />)}</div>}
                    </div>
                  </div>
                </div>
              )}
              {createStep === 2 && (
                <div className="space-y-4">
                  <h4 className="text-base font-medium text-foreground">Set Up Rental Units</h4>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Unit Number *</label>
                    <Input value={unitsForm.unitNumber} onChange={(e) => setUnitsForm({ ...unitsForm, unitNumber: e.target.value })} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Floor</label>
                    <Input type="number" value={unitsForm.floor} onChange={(e) => setUnitsForm({ ...unitsForm, floor: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Unit Status</label>
                    <select value={unitsForm.status} onChange={(e) => setUnitsForm({ ...unitsForm, status: e.target.value as any })} className="h-10 px-3 rounded-xl border border-border bg-surface-secondary text-sm">
                      <option value="vacant">Vacant</option>
                      <option value="occupied">Occupied</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Unit Image</label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-surface-secondary cursor-pointer hover:bg-surface-tertiary transition-colors">
                        <Camera className="h-4 w-4" />
                        <span className="text-sm">{unitsForm.imageUrl ? "Change Image" : "Upload Image"}</span>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleUnitImageUpload} disabled={isUploadingUnitImage} />
                      </label>
                      {isUploadingUnitImage && <span className="text-xs text-text-secondary">Uploading...</span>}
                      {unitsForm.imageUrls.length > 0 && <div className="flex flex-wrap gap-2">{unitsForm.imageUrls.map((url, index) => <Image key={`${url}-${index}`} src={url} alt={`Unit preview ${index + 1}`} width={80} height={80} unoptimized className="h-20 w-20 rounded-lg object-cover border border-border" />)}</div>}
                    </div>
                  </div>
                </div>
              )}
              {createStep === 3 && (
                <div className="space-y-4">
                  <h4 className="text-base font-medium text-foreground">Rental Rate and Terms</h4>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Monthly Rental Rate (₱) *</label>
                    <Input type="number" value={unitsForm.rentAmount} onChange={(e) => setUnitsForm({ ...unitsForm, rentAmount: e.target.value })} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Security Deposit (₱)</label>
                    <Input type="number" value={termsForm.securityDeposit} onChange={(e) => setTermsForm({ ...termsForm, securityDeposit: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Advance Payment (₱)</label>
                    <Input type="number" value={termsForm.advancePayment} onChange={(e) => setTermsForm({ ...termsForm, advancePayment: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Rental Duration</label>
                      <select value={termsForm.duration} onChange={(e) => setTermsForm({ ...termsForm, duration: e.target.value })} className="h-10 px-3 rounded-xl border border-border bg-surface-secondary text-sm">
                        <option value="6 months">6 Months</option>
                        <option value="12 months">12 Months</option>
                        <option value="24 months">24 Months</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Payment Due Date</label>
                      <select value={termsForm.paymentDueDate} onChange={(e) => setTermsForm({ ...termsForm, paymentDueDate: e.target.value })} className="h-10 px-3 rounded-xl border border-border bg-surface-secondary text-sm">
                        <option value="1st">1st of month</option>
                        <option value="5th">5th of month</option>
                        <option value="10th">10th of month</option>
                        <option value="15th">15th of month</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Rental Terms</label>
                    <textarea value={termsForm.rentalTerms} onChange={(e) => setTermsForm({ ...termsForm, rentalTerms: e.target.value })} className="w-full h-24 px-3 py-2 rounded-xl border border-border bg-surface-secondary text-sm resize-none" />
                  </div>
                </div>
              )}
              {createStep === 4 && (
                <div className="space-y-4">
                  <h4 className="text-base font-medium text-foreground">Review Property</h4>
                  <div className="p-4 rounded-xl border border-border space-y-2">
                    <p className="text-sm"><span className="font-medium">Name:</span> {propertyForm.name}</p>
                    <p className="text-sm"><span className="font-medium">Address:</span> {propertyForm.address}, {propertyForm.city}, {propertyForm.province}</p>
                    <p className="text-sm"><span className="font-medium">Type:</span> {propertyForm.type}</p>
                    <p className="text-sm"><span className="font-medium">Features:</span> {propertyForm.features.length ? propertyForm.features.join(", ") : "None selected"}</p>
                    <p className="text-sm"><span className="font-medium">Condition:</span> {propertyForm.condition || "Not specified"}</p>
                    <p className="text-sm"><span className="font-medium">Availability:</span> {propertyForm.availabilityStatus}</p>
                    <p className="text-sm"><span className="font-medium">Unit:</span> {unitsForm.unitNumber} (Floor {unitsForm.floor || "N/A"})</p>
                    <p className="text-sm"><span className="font-medium">Rent:</span> {formatCurrency(Number(unitsForm.rentAmount) || 0)}/mo</p>
                    <p className="text-sm"><span className="font-medium">Deposit:</span> {formatCurrency(Number(termsForm.securityDeposit) || 0)}</p>
                    <p className="text-sm"><span className="font-medium">Duration:</span> {termsForm.duration}</p>
                  </div>
                </div>
              )}
              {createStep === 5 && (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-lg font-medium text-foreground">Property Created Successfully!</p>
                  <p className="text-sm text-text-secondary mt-1">You can now manage units and assign tenants</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                {createStep < 5 && (
                  <>
                    <Button type="button" variant="outline" onClick={() => setCreateStep(Math.max(1, createStep - 1))} disabled={createStep === 1}>Back</Button>
                    <Button type="submit" disabled={isSubmitting} className="flex-1">{createStep === 4 ? (isSubmitting ? "Adding..." : "Add Property & Units") : "Next"}</Button>
                  </>
                )}
                {createStep === 5 && (
                  <Button type="button" onClick={() => { setShowCreateProperty(false); setCreateStep(1); }} className="flex-1">Done</Button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Assignment Modal */}
      {reviewAssignment && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setReviewAssignment(null); setReturnReason(""); }} />
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-white shadow-2xl">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Review Tenant Assignment</h3>
                <p className="text-sm text-text-secondary">Review the details before confirming</p>
              </div>
              <button onClick={() => { setReviewAssignment(null); setReturnReason(""); }} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-foreground hover:bg-surface-secondary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar src={reviewAssignment.avatarUrl} fallback={getInitials(reviewAssignment.name)} />
                <div>
                  <p className="font-medium text-foreground">{reviewAssignment.name}</p>
                  <p className="text-sm text-text-secondary">{reviewAssignment.email}</p>
                </div>
              </div>
              <div className="p-4 rounded-xl border border-border space-y-2">
                <p className="text-sm"><span className="font-medium">Property:</span> {reviewAssignment.propertyName}</p>
                <p className="text-sm"><span className="font-medium">Unit:</span> {reviewAssignment.unitNumber}</p>
                {reviewAssignment.phone && (
                  <p className="text-sm"><span className="font-medium">Phone:</span> {reviewAssignment.phone}</p>
                )}
                <p className="text-sm"><span className="font-medium">Address:</span> {reviewAssignment.address || "No address provided"}</p>
                <p className="text-sm"><span className="font-medium">Rental Rate:</span> {formatCurrency(reviewAssignment.rentAmount || 0)}/mo</p>
                <p className="text-sm"><span className="font-medium">Status:</span> {reviewAssignment.assignmentStatus}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Reason for returning (if applicable)</label>
                <textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} className="w-full h-20 px-3 py-2 rounded-xl border border-border bg-surface-secondary text-sm resize-none" placeholder="Enter reason if returning to agent..." />
              </div>
            </div>
            <div className="p-6 border-t border-border flex gap-3">
              <Button variant="outline" onClick={() => { setReviewAssignment(null); setReturnReason(""); }} className="flex-1">Cancel</Button>
              <Button variant="outline" onClick={handleReturnAssignment} className="flex-1 text-red-600 hover:text-red-700">Return to Agent</Button>
              <Button onClick={() => handleConfirmAssignment(reviewAssignment.id)} className="flex-1 bg-green-600 hover:bg-green-700 text-white">Confirm Assignment</Button>
            </div>
          </div>
        </div>
      )}
      <ReceiptModal
        isOpen={!!viewingReceipt}
        onClose={() => setViewingReceipt(null)}
        receiptUrl={viewingReceipt?.receiptUrl || null}
        payment={viewingReceipt || undefined}
      />

      {/* Rental Income Report Modal */}
      {viewingReport === "rental" && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setViewingReport(null)} />
          <div className="relative w-full max-w-3xl rounded-2xl border border-border bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Rental Income Report</h3>
                <p className="text-sm text-text-secondary">Monthly and annual rental income overview</p>
              </div>
              <button onClick={() => setViewingReport(null)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-foreground hover:bg-surface-secondary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-text-secondary mb-1">Total Collected</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(payments.filter(p => p.status === "paid").reduce((sum, p) => sum + p.amountPaid, 0))}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-text-secondary mb-1">Total Receivables</p>
                    <p className="text-2xl font-bold text-amber-600">{formatCurrency(payments.filter(p => p.status !== "paid").reduce((sum, p) => sum + (p.balance || 0), 0))}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-text-secondary mb-1">Monthly Revenue</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(properties.reduce((sum, p) => sum + (p.monthlyRevenue || 0), 0))}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-text-secondary mb-1">Overdue Payments</p>
                    <p className="text-2xl font-bold text-red-600">{payments.filter(p => p.status === "overdue").length}</p>
                  </CardContent>
                </Card>
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground mb-3">Payment History</h4>
                <div className="space-y-2">
                  {payments.slice(0, 20).map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary">
                      <div>
                        <p className="text-sm font-medium text-foreground">{payment.tenantName}</p>
                        <p className="text-xs text-text-secondary">{formatDate(payment.paymentDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{formatCurrency(payment.amountPaid)}</p>
                        <Badge variant={payment.status === "paid" ? "success" : payment.status === "pending" ? "warning" : "outline"} className="text-xs capitalize">{payment.status}</Badge>
                      </div>
                    </div>
                  ))}
                  {payments.length === 0 && <p className="text-center py-6 text-text-secondary">No payment records yet</p>}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-border">
              <Button variant="outline" onClick={() => setViewingReport(null)} className="w-full">Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Property Reports Modal */}
      {viewingReport === "property" && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setViewingReport(null)} />
          <div className="relative w-full max-w-3xl rounded-2xl border border-border bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Property Reports</h3>
                <p className="text-sm text-text-secondary">Property performance and occupancy overview</p>
              </div>
              <button onClick={() => setViewingReport(null)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-foreground hover:bg-surface-secondary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-text-secondary mb-1">Total Properties</p>
                    <p className="text-2xl font-bold text-foreground">{properties.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-text-secondary mb-1">Total Units</p>
                    <p className="text-2xl font-bold text-foreground">{units.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-text-secondary mb-1">Occupancy Rate</p>
                    <p className="text-2xl font-bold text-foreground">{units.length > 0 ? Math.round((units.filter(u => u.status === "occupied").length / units.length) * 100) : 0}%</p>
                  </CardContent>
                </Card>
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground mb-3">Property Breakdown</h4>
                <div className="space-y-3">
                  {properties.map((property) => {
                    const propertyUnits = units.filter(u => u.propertyId === property.id);
                    const occupied = propertyUnits.filter(u => u.status === "occupied").length;
                    return (
                      <div key={property.id} className="p-4 rounded-xl border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-foreground">{property.name}</p>
                          <Badge variant={property.status === "active" ? "success" : "outline"} className="capitalize">{property.status}</Badge>
                        </div>
                        <p className="text-xs text-text-secondary mb-2">{property.location}</p>
                        <div className="flex items-center gap-4 text-xs text-text-secondary">
                          <span>{propertyUnits.length} units</span>
                          <span>{occupied} occupied</span>
                          <span>{propertyUnits.length - occupied} vacant</span>
                        </div>
                      </div>
                    );
                  })}
                  {properties.length === 0 && <p className="text-center py-6 text-text-secondary">No properties registered yet</p>}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-border">
              <Button variant="outline" onClick={() => setViewingReport(null)} className="w-full">Close</Button>
            </div>
          </div>
        </div>
      )}
      {editingProperty && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingProperty(null)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Edit Property</h3>
                <p className="text-sm text-text-secondary">Update property details</p>
              </div>
              <button onClick={() => setEditingProperty(null)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-foreground hover:bg-surface-secondary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveProperty} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Property Name *</label>
                <Input value={editPropertyForm.name} onChange={(e) => setEditPropertyForm({ ...editPropertyForm, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Location *</label>
                <Input value={editPropertyForm.location} onChange={(e) => setEditPropertyForm({ ...editPropertyForm, location: e.target.value })} required />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Latitude</label>
                  <Input type="number" step="any" min="-90" max="90" value={editPropertyForm.latitude} onChange={(e) => setEditPropertyForm({ ...editPropertyForm, latitude: e.target.value })} placeholder="e.g. 8.9475" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Longitude</label>
                  <Input type="number" step="any" min="-180" max="180" value={editPropertyForm.longitude} onChange={(e) => setEditPropertyForm({ ...editPropertyForm, longitude: e.target.value })} placeholder="e.g. 125.5406" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Type</label>
                  <select value={editPropertyForm.type} onChange={(e) => setEditPropertyForm({ ...editPropertyForm, type: e.target.value as "house" | "condominium" })} className="h-10 px-3 rounded-xl border border-border bg-surface-secondary text-sm">
                    <option value="house">House</option>
                    <option value="condominium">Condominium</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Status</label>
                  <select value={editPropertyForm.status} onChange={(e) => setEditPropertyForm({ ...editPropertyForm, status: e.target.value as "active" | "inactive" })} className="h-10 px-3 rounded-xl border border-border bg-surface-secondary text-sm">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Property Features</label>
                <FeaturePicker value={editPropertyForm.features} onChange={(features) => setEditPropertyForm({ ...editPropertyForm, features })} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Current Property Condition</label>
                  <select value={editPropertyForm.condition} onChange={(e) => setEditPropertyForm({ ...editPropertyForm, condition: e.target.value })} className="h-10 w-full rounded-xl border border-border bg-surface-secondary px-3 text-sm">
                    <option value="">Select condition...</option>
                    {PROPERTY_CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Availability Status</label>
                  <select value={editPropertyForm.availabilityStatus} onChange={(e) => setEditPropertyForm({ ...editPropertyForm, availabilityStatus: e.target.value as typeof AVAILABILITY_STATUSES[number] })} className="h-10 w-full rounded-xl border border-border bg-surface-secondary px-3 text-sm">
                    {AVAILABILITY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Number of Units</label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="outline" onClick={() => changePropertyUnitCount(-1)} aria-label="Decrease units">- Decrease Unit</Button>
                  <span className="min-w-12 text-center rounded-lg bg-surface-secondary px-3 py-2 text-sm font-semibold">{units.filter((unit) => unit.propertyId === editingProperty.id).length}</span>
                  <Button type="button" variant="outline" onClick={() => changePropertyUnitCount(1)} aria-label="Increase units">+ Increase Unit</Button>
                </div>
                <p className="mt-1 text-xs text-text-secondary">Removing a unit is allowed only when it is vacant.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Property Image</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-surface-secondary cursor-pointer hover:bg-surface-tertiary transition-colors">
                    <Camera className="h-4 w-4" />
                    <span className="text-sm">Add Property Images</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      setIsUploadingEditPropertyImage(true);
                      try {
                        const urls = await Promise.all(files.map(async (file) => {
                          const formData = new FormData();
                          formData.append("file", file);
                          formData.append("type", "property");
                          try {
                            const res = await fetch("/api/auth/upload", { method: "POST", credentials: "include", body: formData });
                            const result = await safeParseJson(res);
                            if (result.success && result.url) return result.url as string;
                            throw new Error(result.error || "Failed to upload image");
                          } catch {
                            return new Promise<string>((resolve) => {
                              const reader = new FileReader();
                              reader.onload = () => resolve(reader.result as string);
                              reader.onerror = () => resolve("");
                              reader.readAsDataURL(file);
                            });
                          }
                        }));
                        const validUrls = urls.filter(Boolean);
                        setEditPropertyForm((current) => ({ ...current, imageUrl: current.imageUrl || validUrls[0], imageUrls: Array.from(new Set([...current.imageUrls, ...validUrls])) }));
                        toast.success(`${validUrls.length} property image${validUrls.length === 1 ? "" : "s"} attached`);
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Failed to upload images");
                      } finally {
                        setIsUploadingEditPropertyImage(false);
                        e.target.value = "";
                      }
                    }} disabled={isUploadingEditPropertyImage} />
                  </label>
                  {isUploadingEditPropertyImage && <span className="text-xs text-text-secondary">Uploading...</span>}
                  {editPropertyForm.imageUrls.map((url, index) => <div key={`${url}-${index}`} className="relative"><Image src={url} alt={`Property preview ${index + 1}`} width={80} height={80} unoptimized className="h-20 w-20 rounded-lg object-cover border border-border" /><button type="button" onClick={() => void handleRemoveEditPropertyImage(url)} aria-label={`Remove property image ${index + 1}`} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white"><X className="h-3 w-3" /></button></div>)}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingProperty(null)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1">{isSubmitting ? "Saving..." : "Save Changes"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editingUnit && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingUnit(null)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Edit Unit</h3>
                <p className="text-sm text-text-secondary">Update unit details</p>
              </div>
              <button onClick={() => setEditingUnit(null)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-foreground hover:bg-surface-secondary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveUnit} className="p-6 space-y-4">
              <div className="rounded-xl border border-border bg-surface-secondary/40 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Property details</p>
                <div className="space-y-3">
                  <div><label className="block text-sm font-medium mb-1.5">Property Name *</label><Input value={editPropertyForm.name} onChange={(e) => setEditPropertyForm({ ...editPropertyForm, name: e.target.value })} required /></div>
                  <div><label className="block text-sm font-medium mb-1.5">Property Location *</label><Input value={editPropertyForm.location} onChange={(e) => setEditPropertyForm({ ...editPropertyForm, location: e.target.value })} required /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-sm font-medium mb-1.5">Property Type</label><select value={editPropertyForm.type} onChange={(e) => setEditPropertyForm({ ...editPropertyForm, type: e.target.value as "house" | "condominium" })} className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"><option value="house">House</option><option value="condominium">Condominium</option></select></div>
                    <div><label className="block text-sm font-medium mb-1.5">Availability</label><select value={editPropertyForm.availabilityStatus} onChange={(e) => setEditPropertyForm({ ...editPropertyForm, availabilityStatus: e.target.value as typeof AVAILABILITY_STATUSES[number] })} className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm">{AVAILABILITY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-sm font-medium mb-1.5">Condition</label><select value={editPropertyForm.condition} onChange={(e) => setEditPropertyForm({ ...editPropertyForm, condition: e.target.value })} className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"><option value="">Select condition...</option>{PROPERTY_CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}</select></div>
                    <div><label className="block text-sm font-medium mb-1.5">Record Status</label><select value={editPropertyForm.status} onChange={(e) => setEditPropertyForm({ ...editPropertyForm, status: e.target.value as "active" | "inactive" })} className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
                  </div>
                  <div><label className="block text-sm font-medium mb-1.5">Features</label><FeaturePicker value={editPropertyForm.features} onChange={(features) => setEditPropertyForm({ ...editPropertyForm, features })} /></div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Property Image</label>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 hover:bg-surface-secondary">
                        <Camera className="h-4 w-4" />
                        <span className="text-sm">Add Property Images</span>
                        <input type="file" accept="image/*" multiple className="hidden" disabled={isUploadingEditPropertyImage} onChange={async (event) => {
                          const files = Array.from(event.target.files || []);
                          if (!files.length) return;
                          setIsUploadingEditPropertyImage(true);
                          try {
                            const urls = await Promise.all(files.map(async (file) => {
                              const uploadData = new FormData();
                              uploadData.append("file", file);
                              uploadData.append("type", "property");
                              try {
                                const response = await fetch("/api/auth/upload", { method: "POST", credentials: "include", body: uploadData });
                                const result = await safeParseJson(response);
                                if (result.success && result.url) return result.url as string;
                                throw new Error(result.error || "Failed to upload image");
                              } catch {
                                return new Promise<string>((resolve) => {
                                  const reader = new FileReader();
                                  reader.onload = () => resolve(reader.result as string);
                                  reader.onerror = () => resolve("");
                                  reader.readAsDataURL(file);
                                });
                              }
                            }));
                            const validUrls = urls.filter(Boolean);
                            setEditPropertyForm((current) => ({ ...current, imageUrl: current.imageUrl || validUrls[0], imageUrls: Array.from(new Set([...current.imageUrls, ...validUrls])) }));
                            toast.success(`${validUrls.length} property image${validUrls.length === 1 ? "" : "s"} attached`);
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Failed to upload images");
                          } finally {
                            setIsUploadingEditPropertyImage(false);
                            event.target.value = "";
                          }
                        }} />
                      </label>
                      {isUploadingEditPropertyImage && <span className="text-xs text-text-secondary">Uploading...</span>}
                      {editPropertyForm.imageUrls.map((url, index) => <div key={`${url}-${index}`} className="relative"><Image src={url} alt={`Property preview ${index + 1}`} width={80} height={80} unoptimized className="h-20 w-20 rounded-lg border border-border object-cover" /><button type="button" onClick={() => void handleRemoveEditPropertyImage(url)} aria-label={`Remove property image ${index + 1}`} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white"><X className="h-3 w-3" /></button></div>)}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Unit Number *</label>
                <Input value={editUnitForm.unitNumber} onChange={(e) => setEditUnitForm({ ...editUnitForm, unitNumber: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Floor</label>
                  <Input type="number" value={editUnitForm.floor} onChange={(e) => setEditUnitForm({ ...editUnitForm, floor: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Status</label>
                  <select value={editUnitForm.status} onChange={(e) => setEditUnitForm({ ...editUnitForm, status: e.target.value as "vacant" | "occupied" | "maintenance" })} className="h-10 px-3 rounded-xl border border-border bg-surface-secondary text-sm">
                    <option value="vacant">Vacant</option>
                    <option value="occupied">Occupied</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Monthly Rent (₱) *</label>
                <Input type="number" min="0" value={editUnitForm.rentAmount} onChange={(e) => setEditUnitForm({ ...editUnitForm, rentAmount: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Unit Image</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-surface-secondary cursor-pointer hover:bg-surface-tertiary transition-colors">
                    <Camera className="h-4 w-4" />
                    <span className="text-sm">{editUnitForm.imageUrl ? "Change Image" : "Upload Image"}</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length === 0) return;
                      setIsUploadingEditUnitImage(true);
                      try {
                        const urls = await Promise.all(files.map(async (file) => {
                          const formData = new FormData();
                          formData.append("file", file);
                          formData.append("type", "unit");
                          try {
                            const res = await fetch("/api/auth/upload", { method: "POST", credentials: "include", body: formData });
                            const result = await safeParseJson(res);
                            if (result.success && result.url) return result.url as string;
                            throw new Error(result.error || "Failed to upload image");
                          } catch {
                            return new Promise<string>((resolve) => {
                              const reader = new FileReader();
                              reader.onload = () => resolve(reader.result as string);
                              reader.onerror = () => resolve("");
                              reader.readAsDataURL(file);
                            });
                          }
                        }));
                        const validUrls = urls.filter(Boolean);
                        setEditUnitForm((current) => ({ ...current, imageUrl: current.imageUrl || validUrls[0], imageUrls: [...current.imageUrls, ...validUrls] }));
                        toast.success(`${validUrls.length} unit image${validUrls.length === 1 ? "" : "s"} attached`);
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Failed to upload images");
                      } finally {
                        setIsUploadingEditUnitImage(false);
                        e.target.value = "";
                      }
                    }} disabled={isUploadingEditUnitImage} />
                  </label>
                  {isUploadingEditUnitImage && <span className="text-xs text-text-secondary">Uploading...</span>}
                  {editUnitForm.imageUrls.length > 0 && <div className="flex flex-wrap gap-2">{editUnitForm.imageUrls.map((url, index) => <div key={`${url}-${index}`} className="group relative"><Image src={url} alt={`Unit preview ${index + 1}`} width={80} height={80} unoptimized className="h-20 w-20 rounded-lg object-cover border border-border" /><button type="button" onClick={() => void handleRemoveEditUnitImage(url)} aria-label={`Remove unit image ${index + 1}`} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-700"><X className="h-3 w-3" /></button></div>)}</div>}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingUnit(null)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1">{isSubmitting ? "Saving..." : "Save Changes"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROFILE */}
      {activeTab === "profile" && (
        <ProfilePanel />
      )}

      {/* Create Tenant Modal */}
      {showCreateTenantModal && (
        <CreateTenantModal
          isOpen={showCreateTenantModal}
          onClose={() => setShowCreateTenantModal(false)}
          onSubmit={async (formData) => {
            await handleCreateTenant(formData);
          }}
          submitting={createTenantSubmitting}
        />
      )}
    </div>
  );
}
