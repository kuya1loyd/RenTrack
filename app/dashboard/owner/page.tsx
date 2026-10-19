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
  Copy, MoreHorizontal, Mail, MessageSquare, Phone, MapPinned, MapPin, DoorOpen, Bed,
  LayoutGrid, List, Wallet, History as HistoryIcon,
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
import { TenancyHistoryModal } from "@/components/tenancy-history-modal";
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

function PropertyMetrics({ total, active, inactive, revenue }: { total: number; active: number; inactive: number; revenue: string }) {
  return (
    <section className={management.metrics} aria-label="Portfolio metrics">
      <article className={management.metric}>
        <span className={`${management.metricIcon} ${management.blue}`}><Building2 aria-hidden="true" /></span>
        <div className={management.metricCopy}><p>Total Properties</p><strong>{total}</strong><small>Registered in portfolio</small></div>
      </article>
      <article className={management.metric}>
        <span className={`${management.metricIcon} ${management.green}`}><CheckCircle2 aria-hidden="true" /></span>
        <div className={management.metricCopy}><p>Active Properties</p><strong>{active}</strong><small>{total ? Math.round((active / total) * 100) : 0}% active</small></div>
      </article>
      <article className={management.metric}>
        <span className={`${management.metricIcon} ${management.amber}`}><Home aria-hidden="true" /></span>
        <div className={management.metricCopy}><p>Inactive Properties</p><strong>{inactive}</strong><small>{total ? Math.round((inactive / total) * 100) : 0}% inactive</small></div>
      </article>
      <article className={management.metric}>
        <span className={`${management.metricIcon} ${management.cyan}`}><Wallet aria-hidden="true" /></span>
        <div className={management.metricCopy}><p>Monthly Revenue</p><strong>{revenue}</strong><small>Combined monthly revenue</small></div>
      </article>
    </section>
  );
}

function OccupancyMetrics({ totalUnits, rate, occupied, vacant, propertiesCount }: { totalUnits: number; rate: number; occupied: number; vacant: number; propertiesCount: number }) {
  return (
    <section className={management.metrics} aria-label="Occupancy metrics">
      <article className={management.metric}>
        <span className={`${management.metricIcon} ${management.blue}`}><Building2 aria-hidden="true" /></span>
        <div className={management.metricCopy}><p>Monitored Properties</p><strong>{propertiesCount}</strong><small>{totalUnits} total units in care</small></div>
      </article>
      <article className={management.metric}>
        <span className={`${management.metricIcon} ${management.cyan}`}><BarChart3 aria-hidden="true" /></span>
        <div className={management.metricCopy}><p>Portfolio Occupancy</p><strong>{rate}%</strong><small>Live average occupancy</small></div>
      </article>
      <article className={management.metric}>
        <span className={`${management.metricIcon} ${management.green}`}><CheckCircle2 aria-hidden="true" /></span>
        <div className={management.metricCopy}><p>Occupied Units</p><strong>{occupied}</strong><small>{totalUnits ? Math.round((occupied / totalUnits) * 100) : 0}% capacity reached</small></div>
      </article>
      <article className={management.metric}>
        <span className={`${management.metricIcon} ${management.amber}`}><DoorOpen aria-hidden="true" /></span>
        <div className={management.metricCopy}><p>Available Vacancies</p><strong>{vacant}</strong><small>Ready for tenant assignment</small></div>
      </article>
    </section>
  );
}


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

const PROPERTY_TYPES = [
  { value: "house", label: "House / Villa" },
  { value: "residential", label: "Residential Property" },
  { value: "building", label: "Commercial / Building" },
  { value: "condominium", label: "Condominium Complex" },
];

const UNIT_TYPES = [
  { value: "condo", label: "Condominium Unit" },
  { value: "dorm", label: "Dormitory Room" },
  { value: "hotel", label: "Hotel Room" },
  { value: "studio", label: "Studio Unit" },
  { value: "apartment", label: "Apartment Unit" },
];

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
  const [newUnitForm, setNewUnitForm] = useState({ propertyId: "", unitNumber: "", address: "", floor: "", type: "condo", condition: "", status: "vacant" as Unit["status"], rentAmount: "", imageUrl: "", imageUrls: [] as string[] });
  const [propertyForm, setPropertyForm] = useState({ name: "", address: "", city: "", province: "", latitude: "", longitude: "", monthlyRevenue: "", type: "house" as "house" | "residential" | "building" | "condominium", features: [] as string[], condition: "", availabilityStatus: "Available" as typeof AVAILABILITY_STATUSES[number], imageUrl: "", imageUrls: [] as string[], agentId: "" });
  const [isUploadingPropertyImage, setIsUploadingPropertyImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewAssignment, setReviewAssignment] = useState<TenantRecord | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [viewingReceipt, setViewingReceipt] = useState<Payment | null>(null);
  const [viewingReport, setViewingReport] = useState<"rental" | "property" | null>(null);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [editPropertyForm, setEditPropertyForm] = useState({ name: "", location: "", latitude: "", longitude: "", monthlyRevenue: "", type: "house" as "house" | "residential" | "building" | "condominium" | string, status: "active" as "active" | "inactive", features: [] as string[], condition: "", availabilityStatus: "Available" as typeof AVAILABILITY_STATUSES[number], imageUrl: "", imageUrls: [] as string[], agentId: "" });
  const [editUnitPropertyId, setEditUnitPropertyId] = useState<string | null>(null);
  const [editUnitForm, setEditUnitForm] = useState({ unitNumber: "", address: "", floor: "", type: "condo", condition: "", status: "vacant" as "vacant" | "occupied" | "maintenance", rentAmount: "", imageUrl: "", imageUrls: [] as string[] });
  const [isUploadingEditPropertyImage, setIsUploadingEditPropertyImage] = useState(false);
  const [isUploadingEditUnitImage, setIsUploadingEditUnitImage] = useState(false);
  const [createTenantSubmitting, setCreateTenantSubmitting] = useState(false);
  const [showCreateTenantModal, setShowCreateTenantModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  // Data is fetched once into state; these UI filters operate on that cached data instantly.
  const [unitsView, setUnitsView] = useState<"properties" | "units" | "occupancy">("units");
  const [propertySearch, setPropertySearch] = useState("");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("all");
  const [propertyStatusFilter, setPropertyStatusFilter] = useState("all");
  const [propertySort, setPropertySort] = useState("name-asc");
  const [propertyPage, setPropertyPage] = useState(1);
  const [propertiesDisplayMode, setPropertiesDisplayMode] = useState<"table" | "grid">("table");

  const [unitSearch, setUnitSearch] = useState("");
  const [unitStatusFilter, setUnitStatusFilter] = useState("all");
  const [unitSort, setUnitSort] = useState("unit-asc");
  const [unitPage, setUnitPage] = useState(1);

  const [occupancySearch, setOccupancySearch] = useState("");
  const [occupancyFilter, setOccupancyFilter] = useState<"all" | "full" | "partial" | "vacant">("all");
  const [occupancyTypeFilter, setOccupancyTypeFilter] = useState("all");
  const [occupancySort, setOccupancySort] = useState("rate-desc");
  const [occupancyPage, setOccupancyPage] = useState(1);
  const [occupancyDisplayMode, setOccupancyDisplayMode] = useState<"grid" | "table">("table");
  const [historyTarget, setHistoryTarget] = useState<{ unitId?: string; propertyId?: string; title: string } | null>(null);
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

  useEffect(() => {
    const handleTabSwitch = (e?: Event) => {
      const customDetail = (e as CustomEvent)?.detail;
      const hash = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
      const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const tabParam = params?.get("tab") || hash || customDetail?.tab;

      if (tabParam === "properties" || tabParam === "units" || tabParam === "occupancy") {
        setActiveTab(tabParam as Step);
      } else if (tabParam && ["overview", "units", "properties", "occupancy", "tenants", "create-tenant", "agents", "assignments", "financial", "contracts", "messages", "profile", "map", "move-out-requests"].includes(tabParam)) {
        setActiveTab(tabParam as Step);
      }
    };

    handleTabSwitch();
    window.addEventListener("hashchange", handleTabSwitch);
    window.addEventListener("renttrack-switch-tab", handleTabSwitch);
    return () => {
      window.removeEventListener("hashchange", handleTabSwitch);
      window.removeEventListener("renttrack-switch-tab", handleTabSwitch);
    };
  }, []);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    setLoadError(false);
    try {
      const [propsRes, unitsRes, tenantsRes, paymentsRes, agentsRes] = await Promise.allSettled([
        getProperties(user),
        getUnits(user),
        getTenants(user),
        getPayments(user),
        getOwnerAgents(),
      ]);

      if (propsRes.status === "fulfilled" && Array.isArray(propsRes.value)) {
        setProperties(propsRes.value);
      }
      if (unitsRes.status === "fulfilled" && Array.isArray(unitsRes.value)) {
        setUnits(unitsRes.value);
      }
      if (tenantsRes.status === "fulfilled" && Array.isArray(tenantsRes.value)) {
        setTenants(tenantsRes.value);
      }
      if (paymentsRes.status === "fulfilled" && Array.isArray(paymentsRes.value)) {
        setPayments(paymentsRes.value);
      }
      if (agentsRes.status === "fulfilled" && Array.isArray(agentsRes.value)) {
        setAgents(agentsRes.value);
      }

      try {
        const moveOutRes = await fetch("/api/move-out");
        const moveOutData = await safeParseJson(moveOutRes);
        if (moveOutData.success) {
          setMoveOutRequests(moveOutData.requests || []);
        }
      } catch (e) {
        console.warn("Move out load error:", e);
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
    if (!propertyForm.name || !propertyForm.address || !propertyForm.city || !propertyForm.province) {
      toast.error("Please fill in property name, address, city, and province");
      return;
    }
    setIsSubmitting(true);
    try {
      await addProperty({
        name: propertyForm.name,
        location: `${propertyForm.address}, ${propertyForm.city}, ${propertyForm.province}`,
        type: propertyForm.type,
        units: 0,
        occupiedUnits: 0,
        monthlyRevenue: Number(propertyForm.monthlyRevenue) || 0,
        status: "active",
        imageUrl: propertyForm.imageUrl || undefined,
        imageUrls: propertyForm.imageUrls,
        features: propertyForm.features,
        condition: propertyForm.condition || undefined,
        availabilityStatus: propertyForm.availabilityStatus,
        agentId: propertyForm.agentId || undefined,
      }, user?.id || "");
      toast.success("Property created successfully! You can now add units to this property.");
      setShowCreateProperty(false);
      setPropertyForm({ name: "", address: "", city: "", province: "", latitude: "", longitude: "", monthlyRevenue: "", type: "house", features: [], condition: "", availabilityStatus: "Available", imageUrl: "", imageUrls: [], agentId: "" });
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
      monthlyRevenue: (property.monthlyRevenue || (property as any).rentAmount || "").toString(),
      type: (property.type as "house" | "residential" | "building" | "condominium") || "house",
      status: property.status,
      features: property.features || [],
      condition: property.condition || "",
      availabilityStatus: property.availabilityStatus || "Available",
      imageUrl: property.imageUrl || "",
      imageUrls: property.imageUrls || (property.imageUrl ? [property.imageUrl] : []),
      agentId: property.agentId || "",
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
        monthlyRevenue: (property.monthlyRevenue || (property as any).rentAmount || "").toString(),
        type: (property.type as "house" | "residential" | "building" | "condominium") || "house",
        status: property.status,
        features: property.features || [],
        condition: property.condition || "",
        availabilityStatus: property.availabilityStatus || "Available",
        imageUrl: property.imageUrl || "",
        imageUrls: property.imageUrls || (property.imageUrl ? [property.imageUrl] : []),
        agentId: property.agentId || "",
      });
    }
    setEditUnitForm({
      unitNumber: unit.unitNumber,
      address: unit.address || property?.location || "",
      floor: unit.floor?.toString() || "",
      type: unit.type || "condo",
      condition: unit.condition || "",
      status: unit.status,
      rentAmount: unit.rentAmount.toString(),
      imageUrl: unit.imageUrl || "",
      imageUrls: unit.imageUrls || (unit.imageUrl ? [unit.imageUrl] : []),
    });
  };

  const handleAssignAgent = async (propertyId: string, agentId: string) => {
    try {
      const updated = await updateProperty(propertyId, { agentId: agentId || "" });
      if (updated) {
        setProperties((current) =>
          current.map((p) => (p.id === propertyId ? { ...p, agentId: agentId || undefined } : p))
        );
        toast.success(agentId ? "Assigned agent updated" : "Agent unassigned");
      }
    } catch {
      toast.error("Failed to update assigned agent");
    }
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
        monthlyRevenue: editPropertyForm.monthlyRevenue ? Number(editPropertyForm.monthlyRevenue) : 0,
        type: editPropertyForm.type,
        status: editPropertyForm.status,
        features: editPropertyForm.features,
        condition: editPropertyForm.condition || undefined,
        availabilityStatus: editPropertyForm.availabilityStatus,
        imageUrl: editPropertyForm.imageUrl || undefined,
        imageUrls: editPropertyForm.imageUrls,
        agentId: editPropertyForm.agentId || "",
      });
      if (!updatedProperty) throw new Error("Failed to update property");
      setProperties(properties.map(p => p.id === editingProperty.id ? {
        ...p,
        ...editPropertyForm,
        monthlyRevenue: editPropertyForm.monthlyRevenue ? Number(editPropertyForm.monthlyRevenue) : 0,
        latitude: editPropertyForm.latitude ? Number(editPropertyForm.latitude) : undefined,
        longitude: editPropertyForm.longitude ? Number(editPropertyForm.longitude) : undefined,
        agentId: editPropertyForm.agentId || undefined,
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
        const unit = await addUnit({ propertyId: editingProperty.id, unitNumber: nextNumber, address: editingProperty.location || "", status: "vacant", rentAmount: 0 });
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
      const updatedUnitResult = await updateUnit(editingUnit.id, {
        unitNumber: editUnitForm.unitNumber,
        address: editUnitForm.address || undefined,
        floor: editUnitForm.floor ? parseInt(editUnitForm.floor) : undefined,
        type: editUnitForm.type || "condo",
        condition: editUnitForm.condition || undefined,
        status: editUnitForm.status,
        rentAmount: Number(editUnitForm.rentAmount),
        imageUrl: editUnitForm.imageUrl || undefined,
        imageUrls: editUnitForm.imageUrls,
      });
      if (!updatedUnitResult) throw new Error("Failed to update unit");
      const updatedUnit: Unit = {
        ...editingUnit,
        unitNumber: editUnitForm.unitNumber,
        address: editUnitForm.address || undefined,
        floor: editUnitForm.floor ? parseInt(editUnitForm.floor) : undefined,
        type: editUnitForm.type || "condo",
        condition: editUnitForm.condition || undefined,
        status: editUnitForm.status,
        rentAmount: Number(editUnitForm.rentAmount),
        imageUrl: editUnitForm.imageUrl || undefined,
        imageUrls: editUnitForm.imageUrls,
      };
      setUnits((current) => current.map((unit) => unit.id === updatedUnit.id ? updatedUnit : unit));
      toast.success("Unit updated successfully");
      setEditingUnit(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update unit");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const readHash = () => {
      const rawHash = window.location.hash.replace("#", "").split("?")[0];
      const normalized = rawHash === "payments" ? "financial" : rawHash === "move-out" ? "move-out-requests" : rawHash;
      if (normalized && flowSteps.some((s) => s.key === normalized)) {
        setActiveTab(normalized as Step);
      }
    };
    const handleOwnerTabChange = (event: Event) => {
      const tabKey = (event as CustomEvent<string>).detail;
      const normalizedKey = tabKey === "move-out" ? "move-out-requests" : tabKey === "payments" ? "financial" : tabKey;
      const tab = flowSteps.find((step) => step.key === normalizedKey);
      if (tab) {
        setActiveTab(tab.key);
        if (tab.key === "units") {
          setUnitSearch("");
          setUnitStatusFilter("all");
        }
      }
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
  const pendingAssignments = tenants.filter((t) => t.assignmentStatus === "pending" && (t.unitId || t.propertyName));
  const pendingPayments = payments.filter((p) => p.status === "pending");
  const overduePayments = payments.filter((p) => p.status === "overdue");
  const normalizedUnitSearch = unitSearch.trim().toLowerCase();
  const filteredUnits = units.filter((unit) => {
    const prop = properties.find((p) => p.id === unit.propertyId);
    const searchable = `${unit.unitNumber} ${unit.tenantName || ""} ${unit.address || ""} ${prop?.name || ""} ${prop?.location || ""} ${(unit as any).propertyName || prop?.name || ""}`.toLowerCase();
    const searchMatches = !normalizedUnitSearch || searchable.includes(normalizedUnitSearch);
    const statusMatches = unitStatusFilter === "all" || unit.status === unitStatusFilter;
    return searchMatches && statusMatches;
  });
  const normalizedPropertySearch = propertySearch.trim().toLowerCase();
  const filteredProperties = properties.filter((property) => {
    const searchMatches = !normalizedPropertySearch || `${property.name} ${property.location}`.toLowerCase().includes(normalizedPropertySearch);
    const typeMatches = propertyTypeFilter === "all" || property.type === propertyTypeFilter;
    const statusMatches = propertyStatusFilter === "all" || property.status === propertyStatusFilter;
    return searchMatches && typeMatches && statusMatches;
  });
  const filteredTenants = tenants.filter((tenant) =>
    (tenantFilter === "all" || tenant.status === tenantFilter) &&
    `${tenant.name} ${tenant.email} ${tenant.phone || ""}`.toLowerCase().includes(tenantSearch.trim().toLowerCase())
  );
  const sortedUnits = [...filteredUnits].sort((a, b) => {
    if (unitSort === "rent-desc") return b.rentAmount - a.rentAmount;
    if (unitSort === "rent-asc") return a.rentAmount - b.rentAmount;
    if (unitSort === "status") {
      const order: Record<string, number> = { vacant: 1, maintenance: 2, occupied: 3 };
      return (order[a.status] || 99) - (order[b.status] || 99);
    }
    const comparison = a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
    return unitSort === "unit-desc" ? -comparison : comparison;
  });
  const currentUnitPage = Math.min(unitPage, Math.max(1, Math.ceil(sortedUnits.length / 10)));
  const visibleUnits = sortedUnits.slice((currentUnitPage - 1) * 10, currentUnitPage * 10);

  const sortedProperties = [...filteredProperties].sort((a, b) => {
    if (propertySort === "location-asc") return (a.location || "").localeCompare(b.location || "");
    if (propertySort === "location-desc") return (b.location || "").localeCompare(a.location || "");
    if (propertySort === "revenue-desc") return (b.monthlyRevenue || 0) - (a.monthlyRevenue || 0);
    if (propertySort === "revenue-asc") return (a.monthlyRevenue || 0) - (b.monthlyRevenue || 0);
    const comp = a.name.localeCompare(b.name);
    return propertySort === "name-desc" ? -comp : comp;
  });
  const currentPropertyPage = Math.min(propertyPage, Math.max(1, Math.ceil(sortedProperties.length / 10)));
  const visibleProperties = sortedProperties.slice((currentPropertyPage - 1) * 10, currentPropertyPage * 10);

  const normalizedOccupancySearch = occupancySearch.trim().toLowerCase();
  const filteredOccupancyProperties = properties.filter((property) => {
    const propertyUnits = units.filter((u) => u.propertyId === property.id);
    const occupied = propertyUnits.filter((u) => u.status === "occupied").length;
    const rate = propertyUnits.length ? Math.round((occupied / propertyUnits.length) * 100) : 0;
    const searchMatches = !normalizedOccupancySearch || `${property.name} ${property.location || ""}`.toLowerCase().includes(normalizedOccupancySearch);
    const typeMatches = occupancyTypeFilter === "all" || property.type === occupancyTypeFilter;
    const statusMatches =
      occupancyFilter === "all"
        ? true
        : occupancyFilter === "full"
          ? rate === 100
          : occupancyFilter === "partial"
            ? rate > 0 && rate < 100
            : rate === 0;
    return searchMatches && typeMatches && statusMatches;
  });

  const sortedOccupancyProperties = [...filteredOccupancyProperties].sort((a, b) => {
    const aUnits = units.filter((u) => u.propertyId === a.id);
    const bUnits = units.filter((u) => u.propertyId === b.id);
    const aOcc = aUnits.filter((u) => u.status === "occupied").length;
    const bOcc = bUnits.filter((u) => u.status === "occupied").length;
    const aRate = aUnits.length ? Math.round((aOcc / aUnits.length) * 100) : 0;
    const bRate = bUnits.length ? Math.round((bOcc / bUnits.length) * 100) : 0;

    if (occupancySort === "rate-asc") return aRate - bRate;
    if (occupancySort === "rate-desc") return bRate - aRate;
    if (occupancySort === "units-desc") return bUnits.length - aUnits.length;
    return a.name.localeCompare(b.name);
  });

  const currentOccupancyPage = Math.min(occupancyPage, Math.max(1, Math.ceil(sortedOccupancyProperties.length / 8)));
  const visibleOccupancyProperties = sortedOccupancyProperties.slice((currentOccupancyPage - 1) * 8, currentOccupancyPage * 8);

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

  useEffect(() => { setUnitPage(1); }, [unitSearch, unitStatusFilter, unitSort]);
  useEffect(() => { setPropertyPage(1); }, [propertySearch, propertyStatusFilter, propertyTypeFilter, propertySort]);
  useEffect(() => { setOccupancyPage(1); }, [occupancySearch, occupancyFilter, occupancyTypeFilter, occupancySort]);
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
    const unitIds = new Set(units.filter((unit) => Boolean(unit.propertyId && propertyIds.has(unit.propertyId))).map((unit) => unit.id));
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

  const downloadPropertiesExport = () => {
    const rows: Array<Array<string | number>> = [
      ["Property Name", "Address / Location", "Occupied Units", "Vacant Units", "Assigned Agent", "Status"],
      ...sortedProperties.map((property) => {
        const propUnits = units.filter((u) => u.propertyId === property.id);
        const occ = propUnits.filter((u) => u.status === "occupied").length;
        const vac = propUnits.filter((u) => u.status === "vacant").length;
        const assignedAgent = agents.find((a) => a.id === property.agentId);
        const agentDisplay = assignedAgent
          ? `${assignedAgent.name}${assignedAgent.address ? ` (${assignedAgent.address})` : ""}`
          : "Unassigned";
        return [
          property.name,
          property.location,
          occ,
          vac,
          agentDisplay,
          property.status,
        ];
      }),
    ];
    downloadExcelReport(`owner-properties-${new Date().toISOString().slice(0, 10)}.xls`, [{ name: "Properties", rows }]);
  };

  const downloadUnitsExport = () => {
    const rows: Array<Array<string | number>> = [
      ["Unit No.", "Address", "Property type", "Monthly rent", "Status", "Tenant"],
      ...sortedUnits.map((unit) => {
        const property = properties.find((item) => item.id === unit.propertyId);
        return [
          unit.unitNumber,
          unit.address || property?.location || property?.name || "",
          property?.type || "",
          unit.rentAmount,
          unit.status === "vacant" ? "Available" : unit.status === "occupied" ? "Occupied" : "Under Maintenance",
          unit.tenantName || tenants.find((tenant) => tenant.unitId === unit.id)?.name || "",
        ];
      }),
    ];
    downloadExcelReport(`owner-units-${new Date().toISOString().slice(0, 10)}.xls`, [{ name: "Units", rows }]);
  };

  const downloadOccupancyExport = () => {
    const rows: Array<Array<string | number>> = [
      ["Property Name", "Address / Location", "Property Type", "Total Units", "Occupied Units", "Vacant Units", "Occupancy Rate (%)", "Status"],
      ...sortedOccupancyProperties.map((property) => {
        const propUnits = units.filter((u) => u.propertyId === property.id);
        const occ = propUnits.filter((u) => u.status === "occupied").length;
        const vac = propUnits.filter((u) => u.status === "vacant").length;
        const rate = propUnits.length ? Math.round((occ / propUnits.length) * 100) : 0;
        return [
          property.name,
          property.location || "—",
          property.type === "condominium" ? "Condominium" : "Residential House",
          propUnits.length,
          occ,
          vac,
          `${rate}%`,
          property.status,
        ];
      }),
    ];
    downloadExcelReport(`owner-occupancy-${new Date().toISOString().slice(0, 10)}.xls`, [{ name: "Occupancy", rows }]);
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
  };

  const openAddUnit = () => {
    const defaultProp = properties[0];

    setNewUnitForm({
      propertyId: defaultProp?.id || "",
      unitNumber: "",
      address: defaultProp?.location || "",
      floor: "",
      type: "condo",
      condition: "",
      status: "vacant",
      rentAmount: "",
      imageUrl: "",
      imageUrls: [],
    });
    setShowAddUnit(true);
  };

  const handleAddUnit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newUnitForm.unitNumber.trim() || !newUnitForm.address.trim() || Number(newUnitForm.rentAmount) < 0) {
      toast.error("Please provide unit number, address, and rent amount");
      return;
    }
    setIsSubmitting(true);
    try {
      const newUnit = await addUnit({
        propertyId: newUnitForm.propertyId || undefined,
        unitNumber: newUnitForm.unitNumber.trim(),
        address: newUnitForm.address.trim(),
        floor: newUnitForm.floor ? Number(newUnitForm.floor) : undefined,
        type: newUnitForm.type || "condo",
        condition: newUnitForm.condition || undefined,
        status: newUnitForm.status,
        rentAmount: Number(newUnitForm.rentAmount),
        imageUrl: newUnitForm.imageUrl || undefined,
        imageUrls: newUnitForm.imageUrls,
      });
      setUnits((current) => [...current, newUnit]);
      if (newUnitForm.propertyId) {
        setProperties((current) => current.map((property) => property.id === newUnitForm.propertyId ? { ...property, units: property.units + 1 } : property));
      }
      setShowAddUnit(false);
      setNewUnitForm({ propertyId: "", unitNumber: "", address: "", floor: "", type: "condo", condition: "", status: "vacant", rentAmount: "", imageUrl: "", imageUrls: [] });
      toast.success("Unit added successfully");
      await loadData();
    } catch {
      toast.error("Failed to add unit");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
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
              { label: "Properties", value: properties.length, icon: Building2, tone: "blue", tab: "properties" as const },
              { label: "Available units", value: availableUnits.length, icon: ClipboardCheck, tone: "emerald", tab: "units" as const },
              { label: "Occupied units", value: occupiedUnits.length, icon: BarChart3, tone: "cyan", tab: "occupancy" as const },
              { label: "Pending approvals", value: pendingAssignments.length, icon: Clock, tone: "amber", tab: "assignments" as const },
              { label: "Pending payments", value: pendingPayments.length, icon: CreditCard, tone: "rose", tab: "financial" as const },
            ].map((stat) => (
              <button
                key={stat.label}
                type="button"
                onClick={() => {
                  setActiveTab(stat.tab);
                  window.location.hash = stat.tab;
                }}
                className="rounded-lg border border-[#dce8f5] bg-white p-3 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-colors hover:border-blue-200 hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:p-4 cursor-pointer"
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
                  return (
                    <button key={property.id} type="button" onClick={() => { setActiveTab("properties"); window.location.hash = "properties"; }} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 cursor-pointer">
                      <UnitImageCarousel
                        images={property.imageUrls || (property.imageUrl ? [property.imageUrl] : [])}
                        alt={property.name}
                        title={property.name}
                        subtitle={property.location || ""}
                        className="h-12 w-16 shrink-0 rounded-md border border-slate-200 cursor-pointer"
                        imageClassName="group-hover:scale-100"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-slate-900">{property.name}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-slate-500">{property.location}</span>
                        <span className="mt-1 block text-[10px] text-slate-500">{property.type === "condominium" ? "Condominium" : "Residential House"} • Added {formatDate(property.createdAt)}</span>
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

      {/* RENTAL UNITS PAGE */}
      {activeTab === "units" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn(management.page, "space-y-6")}>
          <ManagementBanner
            category="Units Management"
            title="Rental Units"
            description="Browse, filter, and manage individual rental units across your portfolio."
            icon={ClipboardCheck}
          />

          <section id="units-section" className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span>Rental Units</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {filteredUnits.length} {filteredUnits.length === 1 ? "unit" : "units"}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Browse, filter, and manage individual units across your portfolio.</p>
            </div>

            <div className={management.toolbar}>
              <label className={management.search}>
                <Search aria-hidden="true" />
                <input
                  type="search"
                  value={unitSearch}
                  onChange={(event) => setUnitSearch(event.target.value)}
                  placeholder="Search units by unit number, address, or tenant..."
                  aria-label="Search units"
                />
              </label>
              <label className={management.filterCompact}>
                <span>Status</span>
                <select aria-label="Filter by unit status" value={unitStatusFilter} onChange={(event) => setUnitStatusFilter(event.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="vacant">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="maintenance">Under Maintenance</option>
                </select>
              </label>
              <div className={management.toolbarActions}>
                <button type="button" className={management.reset} onClick={() => { setUnitSearch(""); setUnitStatusFilter("all"); }}>
                  <RotateCcw aria-hidden="true" />Reset
                </button>
                <Button onClick={downloadUnitsExport} className={management.export}>
                  <Download className="h-4 w-4" />Export
                </Button>
                <Button
                  onClick={openAddUnit}
                  className="h-11 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold cursor-pointer shadow-xs transition-colors flex items-center gap-1.5 px-3.5"
                >
                  <Plus className="h-4 w-4" />
                  Add Unit
                </Button>
              </div>
            </div>

            <UnitMetrics
              total={units.length}
              available={availableUnits.length}
              occupied={occupiedUnits.length}
              maintenance={units.filter((unit) => unit.status === "maintenance").length}
            />

            <div className={management.tablePanel} aria-label="Rental units">
              <div className={management.tableHeader}>
                <h3 className={management.tableTitle}>Units List</h3>
                <div className={management.tableControls}>
                  <select value={unitSort} onChange={(event) => setUnitSort(event.target.value)} aria-label="Sort units">
                    <option value="unit-asc">Sort by: Unit No. (A-Z)</option>
                    <option value="unit-desc">Unit No. (Z-A)</option>
                    <option value="rent-asc">Rent (Lowest first)</option>
                    <option value="rent-desc">Rent (Highest first)</option>
                    <option value="status">Status (Available first)</option>
                  </select>
                </div>
              </div>
              {initialLoad ? (
                <div className={management.empty} role="status">Loading units...</div>
              ) : loadError ? (
                <div className={management.empty} role="alert">
                  <strong>Unable to load your portfolio</strong>
                  <Button variant="outline" onClick={() => void loadData()}>Try again</Button>
                </div>
              ) : filteredUnits.length === 0 ? (
                <div className={management.empty}>
                  <Home aria-hidden="true" />
                  <strong>{units.length ? "No units match these filters" : "No units yet"}</strong>
                  <p>{units.length ? "Adjust your search or reset the filters to see your units." : "Add a property and its units to start managing your portfolio."}</p>
                  {units.length > 0 && (
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <Button variant="outline" onClick={() => { setUnitSearch(""); setUnitStatusFilter("all"); }}>
                        <RotateCcw className="mr-1 h-4 w-4" />Reset filters
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className={management.tableScroll}>
                    <table className={management.table}>
                      <thead>
                        <tr>
                          <th>Unit Photo</th>
                          <th>Unit No.</th>
                          <th>Address</th>
                          <th>Type</th>
                          <th>Monthly Rent</th>
                          <th>Status</th>
                          <th>Tenant</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleUnits.map((unit) => {
                          const property = properties.find((item) => item.id === unit.propertyId);
                          const isOccupied = unit.status === "occupied";
                          const assignedTenant = isOccupied ? tenants.find((tenant) => tenant.unitId === unit.id && tenant.status !== "archived" && tenant.status !== "inactive") : null;
                          const tenantName = isOccupied ? (unit.tenantName || assignedTenant?.name) : null;
                          const unitImgs = unit.imageUrls?.length ? unit.imageUrls : unit.imageUrl ? [unit.imageUrl] : property?.imageUrls?.length ? property.imageUrls : property?.imageUrl ? [property.imageUrl] : [];
                          return (
                            <tr key={unit.id}>
                              <td>
                                <UnitImageCarousel
                                  images={unitImgs}
                                  alt={`Unit ${unit.unitNumber}`}
                                  title={`Unit ${unit.unitNumber}`}
                                  subtitle={`${unit.address || property?.location || ""} • Floor ${unit.floor ?? "—"} • ${formatCurrency(unit.rentAmount)}/mo`}
                                  className="h-10 w-14 shrink-0 rounded-md border border-slate-200 cursor-pointer shadow-2xs hover:shadow-md transition-all"
                                  imageClassName="group-hover:scale-100"
                                />
                              </td>
                              <td className="font-semibold">{unit.unitNumber}</td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
                                  <span className="text-sm font-medium text-slate-800 truncate max-w-[200px]" title={unit.address || property?.location || "—"}>
                                    {unit.address || property?.location || "—"}
                                  </span>
                                </div>
                              </td>
                              <td className="capitalize">{property?.type || "—"}</td>
                              <td className="whitespace-nowrap tabular-nums">{formatCurrency(unit.rentAmount)}</td>
                              <td><UnitStatus status={unit.status} /></td>
                              <td>{tenantName ? <span className={management.tenantCell}><User aria-hidden="true" />{tenantName}</span> : "—"}</td>
                              <td>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="ghost" aria-label={`Actions for unit ${unit.unitNumber}`} className="h-8 w-8 text-blue-700">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => handleEditUnit(unit)} icon={<Eye className="h-4 w-4" />}>
                                      Edit unit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setHistoryTarget({ unitId: unit.id, title: `Tenancy history · ${unit.unitNumber}` })} icon={<HistoryIcon className="h-4 w-4" />}>
                                      Tenancy history
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleDeleteUnit(unit)} icon={<Trash2 className="h-4 w-4" />} className="text-red-600">
                                      Delete unit
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
                  <ManagementPagination page={currentUnitPage} total={filteredUnits.length} noun="units" onPageChange={setUnitPage} />
                </>
              )}
            </div>
          </section>
        </motion.div>
      )}

      {/* PROPERTIES PAGE */}
      {activeTab === "properties" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn(management.page, "space-y-6")}>
          <ManagementBanner
            category="Property Portfolio"
            title="Properties"
            description="Browse, filter, and manage registered properties across your portfolio."
            icon={Building2}
          />

          <section id="properties-section" className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span>Properties List</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {filteredProperties.length} {filteredProperties.length === 1 ? "property" : "properties"}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Browse, filter, and manage your property portfolio.</p>
            </div>

            <div className={management.toolbar}>
              <label className={management.search}>
                <Search aria-hidden="true" />
                <input
                  type="search"
                  value={propertySearch}
                  onChange={(event) => setPropertySearch(event.target.value)}
                  placeholder="Search properties by name or address..."
                  aria-label="Search properties"
                />
              </label>
              <label className={management.filterCompact}>
                <span>Property type</span>
                <select aria-label="Filter by property type" value={propertyTypeFilter} onChange={(event) => setPropertyTypeFilter(event.target.value)}>
                  <option value="all">All types</option>
                  <option value="house">House / Residential</option>
                  <option value="condominium">Condominium</option>
                </select>
              </label>
              <label className={management.filterCompact}>
                <span>Status</span>
                <select aria-label="Filter by property status" value={propertyStatusFilter} onChange={(event) => setPropertyStatusFilter(event.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <div className={management.toolbarActions}>
                <button type="button" className={management.reset} onClick={() => { setPropertySearch(""); setPropertyTypeFilter("all"); setPropertyStatusFilter("all"); }}>
                  <RotateCcw aria-hidden="true" />Reset
                </button>
                <Button onClick={downloadPropertiesExport} className={management.export}>
                  <Download className="h-4 w-4" />Export
                </Button>
                <Button
                  onClick={openAddProperty}
                  className="h-11 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold cursor-pointer shadow-xs transition-colors flex items-center gap-1.5 px-3.5"
                >
                  <Building2 className="h-4 w-4" />
                  Add Property
                </Button>
              </div>
            </div>

            <PropertyMetrics
              total={properties.length}
              active={properties.filter(p => p.status === "active").length}
              inactive={properties.filter(p => p.status === "inactive").length}
              revenue={formatCurrency(properties.reduce((sum, p) => sum + (p.monthlyRevenue || 0), 0))}
            />

            <div className={management.tablePanel} aria-label="Properties">
              <div className={management.tableHeader}>
                <h3 className={management.tableTitle}>Properties List</h3>
                <div className={management.tableControls}>
                  <select value={propertySort} onChange={(event) => setPropertySort(event.target.value)} aria-label="Sort properties">
                    <option value="name-asc">Sort by: Name (A-Z)</option>
                    <option value="name-desc">Name (Z-A)</option>
                    <option value="location-asc">Location (A-Z)</option>
                    <option value="location-desc">Location (Z-A)</option>
                    <option value="revenue-desc">Highest Revenue</option>
                    <option value="revenue-asc">Lowest Revenue</option>
                  </select>
                </div>
              </div>
              {initialLoad ? (
                <div className={management.empty} role="status">Loading properties...</div>
              ) : loadError ? (
                <div className={management.empty} role="alert">
                  <strong>Unable to load your properties</strong>
                  <Button variant="outline" onClick={() => void loadData()}>Try again</Button>
                </div>
              ) : filteredProperties.length === 0 ? (
                <div className={management.empty}>
                  <Building2 aria-hidden="true" />
                  <strong>{properties.length ? "No properties match these filters" : "No properties yet"}</strong>
                  <p>{properties.length ? "Adjust your search or reset the filters to see your properties." : "Register your properties to start managing your portfolio."}</p>
                  {properties.length > 0 && (
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <Button variant="outline" onClick={() => { setPropertySearch(""); setPropertyTypeFilter("all"); setPropertyStatusFilter("all"); }}>
                        <RotateCcw className="mr-1 h-4 w-4" />Reset filters
                      </Button>
                    </div>
                  )}
                </div>
              ) : propertiesDisplayMode === "table" ? (
                <>
                  <div className={management.tableScroll}>
                    <table className={management.table}>
                      <thead>
                        <tr>
                          <th>Property Photo</th>
                          <th>Property Name</th>
                          <th>Address</th>
                          <th>Property Type</th>
                          <th>Monthly Revenue</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleProperties.map((property) => {
                          const propRevenue = property.monthlyRevenue || 0;
                          const propImgs = property.imageUrls?.length ? property.imageUrls : property.imageUrl ? [property.imageUrl] : [];
                          return (
                            <tr key={property.id}>
                              <td>
                                <UnitImageCarousel
                                  images={propImgs}
                                  alt={property.name}
                                  title={property.name}
                                  subtitle={property.location || ""}
                                  className="h-10 w-14 shrink-0 rounded-md border border-slate-200 cursor-pointer shadow-2xs hover:shadow-md transition-all"
                                  imageClassName="group-hover:scale-100"
                                />
                              </td>
                              <td className="font-semibold">{property.name}</td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
                                  <span className="text-sm font-medium text-slate-800 truncate max-w-[200px]" title={property.location}>
                                    {property.location || "—"}
                                  </span>
                                </div>
                              </td>
                              <td className="capitalize text-slate-700 font-medium">
                                {property.type === "condominium" ? "Condominium" : "Residential House"}
                              </td>
                              <td className="font-semibold text-slate-900 tabular-nums">
                                {formatCurrency(propRevenue)}
                              </td>
                              <td>
                                <Badge variant={property.status === "active" ? "success" : "outline"} className="capitalize">
                                  {property.status}
                                </Badge>
                              </td>
                              <td>
                                <div className="flex items-center justify-end pr-2">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="icon" variant="ghost" aria-label={`Actions for ${property.name}`} className="h-8 w-8 text-blue-700">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onSelect={() => handleEditProperty(property)} icon={<Eye className="h-4 w-4" />}>
                                        Edit property
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onSelect={() => setHistoryTarget({ propertyId: property.id, title: `Tenancy history · ${property.name}` })} icon={<HistoryIcon className="h-4 w-4" />}>
                                        Tenancy history
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onSelect={() => handleDeleteProperty(property)} icon={<Trash2 className="h-4 w-4" />} className="text-red-600">
                                        Delete property
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <ManagementPagination page={currentPropertyPage} total={filteredProperties.length} noun="properties" onPageChange={setPropertyPage} />
                </>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-4">
                  {filteredProperties.map((property) => {
                    const propImgs = property.imageUrls?.length ? property.imageUrls : property.imageUrl ? [property.imageUrl] : [];
                    return (
                      <Card key={property.id} className="overflow-hidden group hover:shadow-md transition-shadow">
                        <div className="relative h-48 w-full bg-slate-100 overflow-hidden border-b border-border">
                          <UnitImageCarousel
                            images={propImgs}
                            alt={property.name}
                            title={property.name}
                            subtitle={property.location || ""}
                            className="h-full w-full rounded-none border-0"
                            imageClassName="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute top-3 right-3 z-10 pointer-events-none">
                            <Badge variant={property.status === "active" ? "success" : "outline"} className="capitalize backdrop-blur-md bg-white/90 shadow-2xs">
                              {property.status}
                            </Badge>
                          </div>
                          <div className="absolute top-3 left-3 z-10 pointer-events-none">
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-900/75 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs">
                              <Camera className="h-3 w-3" />
                              {propImgs.length} photo{propImgs.length === 1 ? "" : "s"}
                            </span>
                          </div>
                        </div>
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-lg font-semibold">{property.name}</h3>
                                <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-700 border-slate-200 capitalize">
                                  {property.type === "condominium" ? "Condominium" : "House / Residential"}
                                </Badge>
                              </div>
                              <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{property.location}</p>
                            </div>
                            <Badge variant={property.status === "active" ? "success" : "outline"} className="capitalize">{property.status}</Badge>
                          </div>
                          <div className="mt-4 rounded-xl bg-surface-secondary p-3 text-sm flex items-center justify-between">
                            <div>
                              <p className="text-xs text-text-tertiary font-medium">Monthly Revenue</p>
                              <p className="font-bold text-slate-900">{formatCurrency(property.monthlyRevenue || 0)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-text-tertiary font-medium">Type</p>
                              <p className="font-semibold text-slate-700 capitalize">{property.type === "condominium" ? "Condominium" : "Residential"}</p>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleEditProperty(property)}><Eye className="mr-1 h-3.5 w-3.5" />Edit</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteProperty(property)}><Trash2 className="mr-1 h-3.5 w-3.5" />Delete</Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {filteredProperties.length === 0 && (
                    <Card className="col-span-full">
                      <CardContent className="p-12 text-center">
                        <Home className="mx-auto mb-3 h-10 w-10 text-text-tertiary" />
                        <p className="font-medium text-text-secondary">{properties.length ? "No matching properties" : "No properties yet"}</p>
                        <p className="mt-1 text-sm text-text-tertiary">{properties.length ? "Try another search or filter." : "Click below to register your first property."}</p>
                        {properties.length === 0 && (
                          <Button className="mt-4" onClick={openAddProperty}>
                            <Plus className="mr-1 h-4 w-4" /> Add Property
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </section>
        </motion.div>
      )}

      {/* OCCUPANCY OVERVIEW PAGE */}
      {activeTab === "occupancy" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn(management.page, "space-y-6")}>
          <ManagementBanner
            category="Portfolio Health"
            title="Occupancy Overview"
            description="Real-time availability, tenant occupancy, and unit progress tracks across your property portfolio."
            icon={BarChart3}
            actions={
              <Button
                onClick={downloadOccupancyExport}
                className="h-9 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold cursor-pointer shadow-xs transition-colors flex items-center gap-1.5 px-3.5"
              >
                <Download className="h-4 w-4" />
                Export Report
              </Button>
            }
          />

          <section id="occupancy-section" className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span>Property Occupancy Breakdown</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {filteredOccupancyProperties.length} {filteredOccupancyProperties.length === 1 ? "property" : "properties"}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Real-time availability, capacity trackers, and tenant occupancy per property.</p>
            </div>

            <div className={management.toolbar}>
              <label className={management.search}>
                <Search aria-hidden="true" />
                <input
                  type="search"
                  value={occupancySearch}
                  onChange={(event) => setOccupancySearch(event.target.value)}
                  placeholder="Search occupancy by property name or location..."
                  aria-label="Search occupancy"
                />
              </label>
              <label className={management.filterCompact}>
                <span>Occupancy</span>
                <select aria-label="Filter by occupancy" value={occupancyFilter} onChange={(event) => setOccupancyFilter(event.target.value as any)}>
                  <option value="all">All occupancies</option>
                  <option value="full">100% Fully Occupied</option>
                  <option value="partial">Partially Occupied</option>
                  <option value="vacant">0% Vacant</option>
                </select>
              </label>
              <label className={management.filterCompact}>
                <span>Property type</span>
                <select aria-label="Filter by property type" value={occupancyTypeFilter} onChange={(event) => setOccupancyTypeFilter(event.target.value)}>
                  <option value="all">All types</option>
                  <option value="house">House / Residential</option>
                  <option value="condominium">Condominium</option>
                </select>
              </label>
              <div className={management.toolbarActions}>
                <button type="button" className={management.reset} onClick={() => { setOccupancySearch(""); setOccupancyFilter("all"); setOccupancyTypeFilter("all"); }}>
                  <RotateCcw aria-hidden="true" />Reset
                </button>
                <Button onClick={downloadOccupancyExport} className={management.export}>
                  <Download className="h-4 w-4" />Export
                </Button>
              </div>
            </div>

            <OccupancyMetrics
              totalUnits={units.length}
              rate={units.length ? Math.round((occupiedUnits.length / units.length) * 100) : 0}
              occupied={occupiedUnits.length}
              vacant={availableUnits.length}
              propertiesCount={properties.length}
            />

            <div className={management.tablePanel} aria-label="Property Occupancy">
              <div className={management.tableHeader}>
                <h3 className={management.tableTitle}>Portfolio Breakdown</h3>
                <div className={management.tableControls}>
                  <select value={occupancySort} onChange={(event) => setOccupancySort(event.target.value)} aria-label="Sort occupancy">
                    <option value="rate-desc">Sort by: Highest Occupancy</option>
                    <option value="rate-asc">Lowest Occupancy</option>
                    <option value="name-asc">Property Name (A-Z)</option>
                    <option value="units-desc">Most Units</option>
                  </select>
                </div>
              </div>

              {initialLoad ? (
                <div className={management.empty} role="status">Loading occupancy data...</div>
              ) : loadError ? (
                <div className={management.empty} role="alert">
                  <strong>Unable to load occupancy data</strong>
                  <Button variant="outline" onClick={() => void loadData()}>Try again</Button>
                </div>
              ) : filteredOccupancyProperties.length === 0 ? (
                <div className={management.empty}>
                  <Building2 aria-hidden="true" />
                  <strong>{properties.length ? "No properties match these occupancy filters" : "No properties yet"}</strong>
                  <p>{properties.length ? "Adjust your search or reset the filters to see occupancy." : "Register properties and units to monitor portfolio occupancy."}</p>
                </div>
              ) : occupancyDisplayMode === "table" ? (
                <>
                  <div className={management.tableScroll}>
                    <table className={management.table}>
                      <thead>
                        <tr>
                          <th>Property Photo</th>
                          <th>Property Name</th>
                          <th>Location</th>
                          <th>Type</th>
                          <th>Total Units</th>
                          <th>Occupied</th>
                          <th>Vacant</th>
                          <th>Occupancy Rate</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleOccupancyProperties.map((property) => {
                          const propertyUnits = units.filter((u) => u.propertyId === property.id);
                          const occupied = propertyUnits.filter((u) => u.status === "occupied").length;
                          const vacant = propertyUnits.filter((u) => u.status === "vacant").length;
                          const rate = propertyUnits.length ? Math.round((occupied / propertyUnits.length) * 100) : 0;
                          const propImgs = property.imageUrls?.length ? property.imageUrls : property.imageUrl ? [property.imageUrl] : [];

                          return (
                            <tr key={property.id}>
                              <td>
                                <UnitImageCarousel
                                  images={propImgs}
                                  alt={property.name}
                                  title={property.name}
                                  subtitle={property.location || ""}
                                  className="h-10 w-14 shrink-0 rounded-md border border-slate-200 cursor-pointer shadow-2xs hover:shadow-md transition-all"
                                  imageClassName="group-hover:scale-100"
                                />
                              </td>
                              <td className="font-semibold text-slate-900">{property.name}</td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
                                  <span className="text-sm font-medium text-slate-800 truncate max-w-[200px]" title={property.location}>
                                    {property.location || "—"}
                                  </span>
                                </div>
                              </td>
                              <td className="capitalize text-slate-700 font-medium">
                                {property.type === "condominium" ? "Condominium" : "Residential House"}
                              </td>
                              <td className="font-semibold tabular-nums">{propertyUnits.length}</td>
                              <td className="text-blue-700 font-semibold tabular-nums">{occupied}</td>
                              <td className="text-emerald-700 font-semibold tabular-nums">{vacant}</td>
                              <td>
                                <div className="flex items-center gap-2 min-w-[120px]">
                                  <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className={`h-full rounded-full ${
                                        rate === 100
                                          ? "bg-emerald-500"
                                          : rate >= 60
                                          ? "bg-blue-600"
                                          : rate > 0
                                          ? "bg-amber-500"
                                          : "bg-slate-300"
                                      }`}
                                      style={{ width: `${rate}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold tabular-nums text-slate-800">{rate}%</span>
                                </div>
                              </td>
                              <td>
                                <Badge
                                  className={`shrink-0 font-bold text-xs px-2.5 py-0.5 rounded-full border ${
                                    rate === 100
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : rate >= 60
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : rate > 0
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-slate-50 text-slate-600 border-slate-200"
                                  }`}
                                >
                                  {rate === 100 ? "Full" : rate > 0 ? `${rate}% Active` : "Vacant"}
                                </Badge>
                              </td>
                              <td>
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setHistoryTarget({ propertyId: property.id, title: `Tenancy history · ${property.name}` })}
                                    className="h-8 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    <HistoryIcon className="mr-1 h-3.5 w-3.5" />History
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setUnitSearch(property.name);
                                      setActiveTab("units");
                                      window.location.hash = "units";
                                    }}
                                    className="h-8 text-xs font-semibold text-blue-700 hover:bg-blue-50 border-blue-200"
                                  >
                                    View Units
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <ManagementPagination page={currentOccupancyPage} total={filteredOccupancyProperties.length} noun="properties" onPageChange={setOccupancyPage} />
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4">
                    {visibleOccupancyProperties.map((property) => {
                      const propertyUnits = units.filter((unit) => unit.propertyId === property.id);
                      const occupied = propertyUnits.filter((unit) => unit.status === "occupied").length;
                      const vacant = propertyUnits.filter((unit) => unit.status === "vacant").length;
                      const maintenance = propertyUnits.filter((unit) => unit.status === "maintenance").length;
                      const rate = propertyUnits.length ? Math.round((occupied / propertyUnits.length) * 100) : 0;
                      const propImgs = property.imageUrls?.length ? property.imageUrls : property.imageUrl ? [property.imageUrl] : [];

                      return (
                        <div
                          key={property.id}
                          className="group relative rounded-2xl border border-slate-200/90 bg-white p-5 hover:border-blue-300 hover:shadow-md transition-all duration-200"
                        >
                          <div className="flex items-start gap-4">
                            <UnitImageCarousel
                              images={propImgs}
                              alt={property.name}
                              title={property.name}
                              subtitle={property.location || ""}
                              className="h-16 w-20 shrink-0 rounded-xl border border-slate-200 shadow-2xs"
                              imageClassName="group-hover:scale-105"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="truncate font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                  {property.name}
                                </h3>
                                <Badge
                                  className={`shrink-0 font-bold text-xs px-2.5 py-0.5 rounded-full border ${
                                    rate === 100
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : rate >= 60
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : rate > 0
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-slate-50 text-slate-600 border-slate-200"
                                  }`}
                                >
                                  {rate}% Occupied
                                </Badge>
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 truncate">
                                <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                <span className="truncate">{property.location || "Location not specified"}</span>
                              </div>
                              <div className="mt-1.5 flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] font-semibold text-slate-600 bg-slate-50 border-slate-200 capitalize">
                                  {property.type === "condominium" ? "Condominium" : "Residential House"}
                                </Badge>
                                <span className="text-[11px] text-slate-400 font-medium">
                                  {propertyUnits.length} total {propertyUnits.length === 1 ? "unit" : "units"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Progress Track */}
                          <div className="mt-4">
                            <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                              <span className="text-slate-600">Occupancy Progress</span>
                              <span className="text-slate-900 font-bold">{occupied} of {propertyUnits.length} units</span>
                            </div>
                            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 p-0.5">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  rate === 100
                                    ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                                    : rate >= 60
                                    ? "bg-gradient-to-r from-blue-500 to-indigo-600"
                                    : rate > 0
                                    ? "bg-gradient-to-r from-amber-400 to-orange-500"
                                    : "bg-transparent"
                                }`}
                                style={{ width: `${rate}%` }}
                              />
                            </div>
                          </div>

                          {/* Stat chips */}
                          <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 font-semibold text-blue-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                              {occupied} Occupied
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 font-semibold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                              {vacant} Vacant
                            </span>
                            {maintenance > 0 && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 font-semibold text-amber-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                {maintenance} Maintenance
                              </span>
                            )}
                          </div>

                          {/* Individual Units Pills */}
                          {propertyUnits.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-slate-100">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Unit Breakdown</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUnitSearch(property.name);
                                    setActiveTab("units");
                                    window.location.hash = "units";
                                  }}
                                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                                >
                                  View all in Units &rarr;
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {propertyUnits.slice(0, 8).map((unit) => (
                                  <span
                                    key={unit.id}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                                      unit.status === "occupied"
                                        ? "bg-blue-50/60 text-blue-700 border-blue-200/80"
                                        : unit.status === "vacant"
                                        ? "bg-emerald-50/60 text-emerald-700 border-emerald-200/80"
                                        : "bg-amber-50/60 text-amber-700 border-amber-200/80"
                                    }`}
                                  >
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${
                                        unit.status === "occupied"
                                          ? "bg-blue-600"
                                          : unit.status === "vacant"
                                          ? "bg-emerald-600"
                                          : "bg-amber-500"
                                      }`}
                                    />
                                    Unit {unit.unitNumber}
                                  </span>
                                ))}
                                {propertyUnits.length > 8 && (
                                  <span className="text-[11px] font-semibold text-slate-400 self-center">
                                    +{propertyUnits.length - 8} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <ManagementPagination page={currentOccupancyPage} total={filteredOccupancyProperties.length} noun="properties" onPageChange={setOccupancyPage} />
                </>
              )}
            </div>
          </section>
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
                {pendingAssignments.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <p className="text-text-secondary font-medium">All caught up!</p>
                    <p className="text-xs text-text-tertiary mt-1">No pending assignments to review</p>
                  </div>
                ) : (
                  pendingAssignments.map((tenant) => (
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
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
              {/* Top Row: Search Input & Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 min-w-0 max-w-xl">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    type="search"
                    value={financialSearch}
                    onChange={(event) => setFinancialSearch(event.target.value)}
                    placeholder="Search by tenant, unit, reference, or transaction ID..."
                    aria-label="Search payments"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-500/15"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setFinancialSearch("");
                      setFinancialDateRange("all");
                      setFinancialMethodFilter("all");
                      setFinancialStatusFilter("all");
                      setFinancialUnitFilter("all");
                    }}
                    className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 cursor-pointer shadow-2xs active:scale-[0.98]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </button>
                  <Button
                    onClick={downloadFinancialExport}
                    className="h-11 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-xs transition-all duration-200 hover:bg-blue-700 cursor-pointer active:scale-[0.98] flex items-center gap-1.5"
                  >
                    <Download className="h-4 w-4" />
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={downloadFinancialPdf}
                    className="h-11 rounded-xl border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 cursor-pointer active:scale-[0.98] flex items-center gap-1.5"
                  >
                    <Download className="h-4 w-4" />
                    PDF
                  </Button>
                </div>
              </div>

              {/* Bottom Row: 4 Filter Dropdowns in a unified, evenly-spaced grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
                <label className="relative flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 ml-1">Date Range</span>
                  <div className="relative">
                    <select
                      aria-label="Filter payments by date range"
                      value={financialDateRange}
                      onChange={(event) => setFinancialDateRange(event.target.value)}
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-700 outline-none transition-all duration-200 hover:border-blue-300 hover:bg-white hover:shadow-2xs focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-500/15 cursor-pointer pr-8"
                    >
                      <option value="all">All dates</option>
                      <option value="30">Last 30 days</option>
                      <option value="90">Last 90 days</option>
                      <option value="year">This year</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  </div>
                </label>

                <label className="relative flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 ml-1">Payment Method</span>
                  <div className="relative">
                    <select
                      aria-label="Filter payments by method"
                      value={financialMethodFilter}
                      onChange={(event) => setFinancialMethodFilter(event.target.value)}
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-700 outline-none transition-all duration-200 hover:border-blue-300 hover:bg-white hover:shadow-2xs focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-500/15 cursor-pointer pr-8"
                    >
                      <option value="all">All methods</option>
                      <option value="cash">Cash</option>
                      <option value="upload_receipt">Receipt upload</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  </div>
                </label>

                <label className="relative flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 ml-1">Status</span>
                  <div className="relative">
                    <select
                      aria-label="Filter payments by status"
                      value={financialStatusFilter}
                      onChange={(event) => setFinancialStatusFilter(event.target.value)}
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-700 outline-none transition-all duration-200 hover:border-blue-300 hover:bg-white hover:shadow-2xs focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-500/15 cursor-pointer pr-8"
                    >
                      <option value="all">All statuses</option>
                      <option value="paid">Verified / Paid</option>
                      <option value="pending">Pending</option>
                      <option value="overdue">Overdue</option>
                      <option value="partial">Partial</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  </div>
                </label>

                <label className="relative flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 ml-1">Unit</span>
                  <div className="relative">
                    <select
                      aria-label="Filter payments by unit"
                      value={financialUnitFilter}
                      onChange={(event) => setFinancialUnitFilter(event.target.value)}
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-700 outline-none transition-all duration-200 hover:border-blue-300 hover:bg-white hover:shadow-2xs focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-500/15 cursor-pointer pr-8 truncate"
                    >
                      <option value="all">All units</option>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {properties.find((property) => property.id === unit.propertyId)?.name || "Property"} • Unit {unit.unitNumber}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  </div>
                </label>
              </div>
            </div>
            <FinancialMetrics collected={formatCurrency(filteredCollected)} pending={formatCurrency(filteredPayments.filter((payment) => payment.status === "pending").reduce((total, payment) => total + payment.amountPaid, 0))} outstanding={formatCurrency(filteredOutstanding)} transactions={filteredPayments.length} pendingCount={filteredPayments.filter((payment) => payment.status === "pending").length} openCount={filteredPayments.filter((payment) => payment.status !== "paid").length} />
            <div className={management.tabs} aria-label="Financial views">{([
              ["payments", "Payments"], ["approvals", "Pending approvals"],
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

      {/* Add Condominium Room / Unit Modal */}
      {showAddUnit && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddUnit(false)} />
          <form onSubmit={handleAddUnit} className="relative w-full max-w-lg rounded-2xl border border-indigo-100 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="mb-5 flex items-start justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                  <DoorOpen className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">Add Unit</h3>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                      Rental Unit
                    </Badge>
                  </div>
                  <p className="text-xs text-text-secondary">Add an individual rental unit and enter its address and details.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowAddUnit(false)} className="rounded-lg p-2 text-text-secondary hover:text-foreground hover:bg-surface-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Associated Property (Optional) */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Associated Property (Optional)</label>
                <select
                  value={newUnitForm.propertyId}
                  onChange={(event) => {
                    const pId = event.target.value;
                    const p = properties.find((item) => item.id === pId);
                    setNewUnitForm((curr) => ({
                      ...curr,
                      propertyId: pId,
                      address: curr.address ? curr.address : (p?.location || ""),
                    }));
                  }}
                  className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Standalone Unit (No Property)</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name} ({property.location})
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit Address */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Unit Address *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                  <Input
                    required
                    value={newUnitForm.address}
                    onChange={(event) => setNewUnitForm({ ...newUnitForm, address: event.target.value })}
                    placeholder="e.g. Mandaue, Cebu, Mindanao"
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Unit Number & Floor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Unit Number *</label>
                  <Input
                    required
                    value={newUnitForm.unitNumber}
                    onChange={(event) => setNewUnitForm({ ...newUnitForm, unitNumber: event.target.value })}
                    placeholder="e.g. Unit 40, 102-A"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Floor Level</label>
                  <Input
                    type="number"
                    min="0"
                    value={newUnitForm.floor}
                    onChange={(event) => setNewUnitForm({ ...newUnitForm, floor: event.target.value })}
                    placeholder="e.g. 4"
                  />
                </div>
              </div>

              {/* Monthly Rent */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Monthly Rent (₱) *</label>
                <Input
                  required
                  type="number"
                  min="0"
                  value={newUnitForm.rentAmount}
                  onChange={(event) => setNewUnitForm({ ...newUnitForm, rentAmount: event.target.value })}
                  placeholder="e.g. 15000"
                />
              </div>

              {/* Classification & Unit Condition */}
              <div className="rounded-xl border border-border bg-surface-secondary/40 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Classification &amp; Unit Condition</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Unit Type</label>
                    <select
                      value={newUnitForm.type}
                      onChange={(event) => setNewUnitForm({ ...newUnitForm, type: event.target.value })}
                      className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
                    >
                      {UNIT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Unit Condition</label>
                    <select
                      value={newUnitForm.condition}
                      onChange={(event) => setNewUnitForm({ ...newUnitForm, condition: event.target.value })}
                      className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
                    >
                      <option value="">Select condition...</option>
                      {PROPERTY_CONDITIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Unit Status</label>
                    <select
                      value={newUnitForm.status}
                      onChange={(event) => setNewUnitForm({ ...newUnitForm, status: event.target.value as Unit["status"] })}
                      className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
                    >
                      <option value="vacant">Vacant (Available)</option>
                      <option value="occupied">Occupied</option>
                      <option value="maintenance">Under Maintenance</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Unit Photos */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Unit Interior Photos</label>
                <div className="flex flex-col gap-3">
                  <label className="inline-flex w-fit items-center gap-2 px-4 py-2 rounded-xl border border-blue-200 bg-blue-50/50 text-blue-700 cursor-pointer hover:bg-blue-50 transition-colors">
                    <Camera className="h-4 w-4" />
                    <span className="text-sm font-medium">{newUnitForm.imageUrls.length ? "Add More Unit Photos" : "Upload Unit Photos"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={async (event) => {
                        const files = Array.from(event.target.files || []);
                        if (!files.length) return;
                        try {
                          const urls = await Promise.all(
                            files.map(async (file) => {
                              const upload = new FormData();
                              upload.append("file", file);
                              upload.append("type", "unit");
                              try {
                                const response = await fetch("/api/auth/upload", { method: "POST", credentials: "include", body: upload });
                                const result = await safeParseJson(response);
                                if (result.success && result.url) return result.url as string;
                                throw new Error(result.error || "Upload failed");
                              } catch {
                                return new Promise<string>((resolve) => {
                                  const reader = new FileReader();
                                  reader.onload = () => resolve(reader.result as string);
                                  reader.onerror = () => resolve("");
                                  reader.readAsDataURL(file);
                                });
                              }
                            })
                          );
                          const validUrls = urls.filter(Boolean);
                          setNewUnitForm((current) => ({
                            ...current,
                            imageUrl: current.imageUrl || validUrls[0],
                            imageUrls: [...current.imageUrls, ...validUrls],
                          }));
                          event.target.value = "";
                          toast.success(`${validUrls.length} unit photo${validUrls.length === 1 ? "" : "s"} added`);
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Upload failed");
                        }
                      }}
                    />
                  </label>
                  {newUnitForm.imageUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {newUnitForm.imageUrls.map((url, index) => (
                        <div key={`${url}-${index}`} className="relative group">
                          <Image
                            src={url}
                            alt={`Unit preview ${index + 1}`}
                            width={64}
                            height={64}
                            unoptimized
                            className="h-16 w-16 rounded-lg object-cover border border-border"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = newUnitForm.imageUrls.filter((_, i) => i !== index);
                              setNewUnitForm({ ...newUnitForm, imageUrls: updated, imageUrl: updated[0] || "" });
                            }}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-md hover:bg-red-600 transition-colors"
                            title="Remove photo"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setShowAddUnit(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white hover:bg-blue-700 font-medium">
                {isSubmitting ? "Adding Unit..." : "Add Unit"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Create Property / Building Modal */}
      {showCreateProperty && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateProperty(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-blue-100 bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-border bg-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">Add Property / Building</h3>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                      Building &amp; Estate
                    </Badge>
                  </div>
                  <p className="text-xs text-text-secondary">Register an entire building, condominium development, or property in a city.</p>
                </div>
              </div>
              <button onClick={() => setShowCreateProperty(false)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-foreground hover:bg-surface-secondary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProperty} className="p-6 space-y-5">
              {/* Building Name & Location */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Property / Building Name *</label>
                  <Input value={propertyForm.name} onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })} placeholder="e.g. J Tower Residence, Avida Towers Riala" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Street Address *</label>
                  <Input value={propertyForm.address} onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })} placeholder="e.g. A.S. Fortuna St, Mandaue City" required />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">City *</label>
                    <Input value={propertyForm.city} onChange={(e) => setPropertyForm({ ...propertyForm, city: e.target.value })} placeholder="e.g. Mandaue City / Cebu City" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Province *</label>
                    <Input value={propertyForm.province} onChange={(e) => setPropertyForm({ ...propertyForm, province: e.target.value })} placeholder="e.g. Cebu" required />
                  </div>
                </div>
              </div>

              {/* Classification & Availability */}
              <div className="rounded-xl border border-border bg-surface-secondary/40 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Classification &amp; Property Condition</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Property Type</label>
                    <select value={propertyForm.type} onChange={(e) => setPropertyForm({ ...propertyForm, type: e.target.value as any })} className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm">
                      {PROPERTY_TYPES.map((pt) => (
                        <option key={pt.value} value={pt.value}>{pt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Property Condition</label>
                    <select value={propertyForm.condition} onChange={(e) => setPropertyForm({ ...propertyForm, condition: e.target.value })} className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm">
                      <option value="">Select condition...</option>
                      {PROPERTY_CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Property Status</label>
                    <select value={propertyForm.availabilityStatus} onChange={(e) => setPropertyForm({ ...propertyForm, availabilityStatus: e.target.value as typeof AVAILABILITY_STATUSES[number] })} className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm">
                      {AVAILABILITY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Monthly Rent / Amount */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Monthly Rent (₱)</label>
                <Input
                  type="number"
                  min="0"
                  value={propertyForm.monthlyRevenue}
                  onChange={(e) => setPropertyForm({ ...propertyForm, monthlyRevenue: e.target.value })}
                  placeholder="e.g. 15000"
                />
              </div>


              {/* Building Amenities */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Building Amenities &amp; Facilities</label>
                <FeaturePicker value={propertyForm.features} onChange={(features) => setPropertyForm({ ...propertyForm, features })} />
              </div>

              {/* Building Exterior Photos */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Building &amp; Facade Photos</label>
                <div className="flex flex-col gap-3">
                  <label className="inline-flex w-fit items-center gap-2 px-4 py-2 rounded-xl border border-blue-200 bg-blue-50/50 text-blue-700 cursor-pointer hover:bg-blue-50 transition-colors">
                    <Camera className="h-4 w-4" />
                    <span className="text-sm font-medium">{propertyForm.imageUrls.length ? "Add More Building Photos" : "Upload Building Photos"}</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePropertyImageUpload} disabled={isUploadingPropertyImage} />
                  </label>
                  {isUploadingPropertyImage && <span className="text-xs text-text-secondary">Uploading...</span>}
                  {propertyForm.imageUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {propertyForm.imageUrls.map((url, index) => (
                        <div key={`${url}-${index}`} className="relative group">
                          <Image src={url} alt={`Property preview ${index + 1}`} width={80} height={80} unoptimized className="h-20 w-20 rounded-lg object-cover border border-border" />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = propertyForm.imageUrls.filter((_, i) => i !== index);
                              setPropertyForm({ ...propertyForm, imageUrls: updated, imageUrl: updated[0] || "" });
                            }}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-md hover:bg-red-600 transition-colors"
                            title="Remove photo"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setShowCreateProperty(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white hover:bg-blue-700 font-medium">
                  {isSubmitting ? "Registering..." : "Add Property"}
                </Button>
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
                  <label className="block text-sm font-medium mb-1.5">Property Type</label>
                  <select value={editPropertyForm.type} onChange={(e) => setEditPropertyForm({ ...editPropertyForm, type: e.target.value as any })} className="h-10 px-3 rounded-xl border border-border bg-surface-secondary text-sm w-full">
                    {PROPERTY_TYPES.map((pt) => (
                      <option key={pt.value} value={pt.value}>{pt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Listing Status</label>
                  <select value={editPropertyForm.status} onChange={(e) => setEditPropertyForm({ ...editPropertyForm, status: e.target.value as "active" | "inactive" })} className="h-10 px-3 rounded-xl border border-border bg-surface-secondary text-sm w-full">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Monthly Rent (₱)</label>
                <Input
                  type="number"
                  min="0"
                  value={editPropertyForm.monthlyRevenue}
                  onChange={(e) => setEditPropertyForm({ ...editPropertyForm, monthlyRevenue: e.target.value })}
                  placeholder="e.g. 15000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Property Features</label>
                <FeaturePicker value={editPropertyForm.features} onChange={(features) => setEditPropertyForm({ ...editPropertyForm, features })} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Property Condition</label>
                  <select value={editPropertyForm.condition} onChange={(e) => setEditPropertyForm({ ...editPropertyForm, condition: e.target.value })} className="h-10 w-full rounded-xl border border-border bg-surface-secondary px-3 text-sm">
                    <option value="">Select condition...</option>
                    {PROPERTY_CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Property Status</label>
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
              <div>
                <label className="block text-sm font-medium mb-1.5">Unit Number *</label>
                <Input value={editUnitForm.unitNumber} onChange={(e) => setEditUnitForm({ ...editUnitForm, unitNumber: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Unit Address *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                  <Input
                    required
                    value={editUnitForm.address}
                    onChange={(e) => setEditUnitForm({ ...editUnitForm, address: e.target.value })}
                    placeholder="e.g. Mandaue, Cebu, Mindanao"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Floor</label>
                  <Input type="number" value={editUnitForm.floor} onChange={(e) => setEditUnitForm({ ...editUnitForm, floor: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Monthly Rent (₱) *</label>
                  <Input type="number" min="0" value={editUnitForm.rentAmount} onChange={(e) => setEditUnitForm({ ...editUnitForm, rentAmount: e.target.value })} required />
                </div>
              </div>

              {/* Classification & Unit Condition */}
              <div className="rounded-xl border border-border bg-surface-secondary/40 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Classification &amp; Unit Condition</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Unit Type</label>
                    <select
                      value={editUnitForm.type}
                      onChange={(e) => setEditUnitForm({ ...editUnitForm, type: e.target.value })}
                      className="h-10 px-3 rounded-xl border border-border bg-white text-sm w-full"
                    >
                      {UNIT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Unit Condition</label>
                    <select
                      value={editUnitForm.condition}
                      onChange={(e) => setEditUnitForm({ ...editUnitForm, condition: e.target.value })}
                      className="h-10 px-3 rounded-xl border border-border bg-white text-sm w-full"
                    >
                      <option value="">Select condition...</option>
                      {PROPERTY_CONDITIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Unit Status</label>
                    <select
                      value={editUnitForm.status}
                      onChange={(e) => setEditUnitForm({ ...editUnitForm, status: e.target.value as "vacant" | "occupied" | "maintenance" })}
                      className="h-10 px-3 rounded-xl border border-border bg-white text-sm w-full"
                    >
                      <option value="vacant">Vacant</option>
                      <option value="occupied">Occupied</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                </div>
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

      <TenancyHistoryModal
        isOpen={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        title={historyTarget?.title || "Tenancy history"}
        unitId={historyTarget?.unitId}
        propertyId={historyTarget?.propertyId}
      />
    </div>
  );
}
