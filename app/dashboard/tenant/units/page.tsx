"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  Home,
  MapPin,
  Square,
  Search,
  Heart,
  X,
  SlidersHorizontal,
  ChevronDown,
  Bell,
  Check,
  Sparkles,
  Phone,
  Mail,
  Calendar,
  Share2,
  Users,
  MessageCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getProperties, getUnits, Property, Unit, safeParseJson } from "@/lib/data";
import type { MoveOutTenancy } from "@/lib/move-out-policy";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import {
  getTenantPropertyIds,
  recordRecentPropertyView,
  toggleFavoriteProperty,
} from "@/lib/tenant-property-storage";
import { ManagementBanner } from "@/components/management-panel";
import { MyRentalCard, useMyRental } from "@/components/tenant-my-rental";

type SortOption =
  | "price-asc"
  | "price-desc"
  | "name-asc"
  | "units-desc";

const SORT_LABELS: Record<SortOption, string> = {
  "price-asc": "Sort: Recent, Price: Low to High",
  "price-desc": "Sort: Price: High to Low",
  "name-asc": "Sort: Name: A to Z",
  "units-desc": "Sort: Most Units",
};

export default function TenantUnitsPage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [tenant, setTenant] = useState<MoveOutTenancy["tenant"]>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSort, setSelectedSort] = useState<SortOption>("price-asc");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedUnitModal, setSelectedUnitModal] = useState<Unit | null>(null);
  const [selectedUnitByProperty, setSelectedUnitByProperty] = useState<Record<string, string>>({});
  const myRental = useMyRental(Boolean(user));

  // Filters state
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "assigned" | "vacant">("all");
  const [maxRent, setMaxRent] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [props, unts] = await Promise.all([
          getProperties(user),
          getUnits(user),
        ]);
        if (isMounted) {
          setProperties(props);
          setUnits(unts);
          if (user) {
            setFavoriteIds(getTenantPropertyIds(user.id, "favorites"));
          }
        }
      } catch {
        if (isMounted) toast.error("Failed to load units and properties");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    fetch("/api/move-out", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const data = await safeParseJson(res);
        if (data.success && data.tenancy && isMounted) {
          setTenant(data.tenancy.tenant);
        }
      })
      .catch(() => {});

    (async () => {
      try {
        let res = await fetch("/api/agents");
        if (!res.ok) res = await fetch("/api/auth/users/agents");
        const data = await safeParseJson(res);
        if (data.success && Array.isArray(data.users) && isMounted) {
          setAgents(data.users);
        }
      } catch {}
    })();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const isMyUnit = (unit: Unit) => {
    if (!user) return false;
    if (unit.tenantId === user.id) return true;
    if (myRental.unit?.id && unit.id === myRental.unit.id) return true;
    if (myRental.assignment?.unitId && unit.id === myRental.assignment.unitId) return true;
    if (myRental.assignment?.tenantId && unit.tenantId === myRental.assignment.tenantId) return true;
    if (tenant?.id && unit.tenantId === tenant.id) return true;
    if (tenant?.unitId && unit.id === tenant.unitId) return true;
    if (tenant?.unitNumber && unit.unitNumber.toLowerCase() === tenant.unitNumber.toLowerCase() && (!tenant.propertyName || (unit.name || "").toLowerCase() === tenant.propertyName.toLowerCase())) return true;
    return false;
  };

  const isAssignedProperty = (property: Property) => {
    if (!tenant) return false;
    if (tenant.propertyName && property.name.toLowerCase() === tenant.propertyName.toLowerCase()) return true;
    if (tenant.unitId && units.some((u) => u.id === tenant.unitId && u.propertyId === property.id)) return true;
    return units.some(
      (u) =>
        u.propertyId === property.id &&
        (u.tenantId === user?.id ||
          (tenant?.id && u.tenantId === tenant.id) ||
          (tenant?.unitId && u.id === tenant.unitId) ||
          (tenant?.unitNumber && u.unitNumber.toLowerCase() === tenant.unitNumber.toLowerCase()))
    );
  };

  const getPropertyRent = (property: Property) => {
    const propertyUnits = units.filter((u) => u.propertyId === property.id);
    const vacantUnits = propertyUnits.filter((u) => u.status === "vacant");
    if (vacantUnits.length > 0) return Math.min(...vacantUnits.map((u) => u.rentAmount || 0));
    if (propertyUnits.length > 0) return Math.min(...propertyUnits.map((u) => u.rentAmount || 0));
    if (property.monthlyRevenue && property.monthlyRevenue > 0) return property.monthlyRevenue;
    if (isAssignedProperty(property) && tenant?.rentAmount) return tenant.rentAmount;
    return 10000;
  };

  const locationAgent = useMemo(() => {
    if (!selectedProperty) return null;
    const propLocation = String(selectedProperty.location || "").toLowerCase().trim();
    const propAgentId = (selectedProperty as any).agentId || (selectedProperty as any).agent_id;

    const REGIONS = [
      { name: "Cebu", tokens: ["cebu", "mandaue", "lapu-lapu", "lapu lapu", "talisay", "consolacion", "minglanilla", "liloan", "cordova"] },
      { name: "Butuan", tokens: ["butuan", "cabadbaran", "agusan"] },
      { name: "Davao", tokens: ["davao", "tagum", "panabo", "samal"] },
      { name: "Metro Manila", tokens: ["manila", "makati", "quezon", "taguig", "bgc", "pasig", "mandaluyong", "paranaque", "pasay", "alabang", "muntinlupa", "las pinas"] },
      { name: "Cagayan de Oro", tokens: ["cagayan de oro", "cdo", "misamis"] },
    ];

    const propRegion = REGIONS.find((r) => r.tokens.some((token) => propLocation.includes(token)));

    const matched = agents.filter((agent) => {
      const agentLoc = String(agent.location || agent.address || "").toLowerCase().trim();
      const agentRegion = REGIONS.find((r) => r.tokens.some((token) => agentLoc.includes(token)));

      if (propRegion && agentRegion && propRegion.name !== agentRegion.name) {
        return false;
      }
      if (propRegion && agentRegion && propRegion.name === agentRegion.name) {
        return true;
      }
      if (agentLoc && propLocation && (propLocation.includes(agentLoc) || agentLoc.includes(propLocation))) {
        return true;
      }
      if (propAgentId && agent.id === propAgentId && (!agentRegion || !propRegion || agentRegion.name === propRegion.name)) {
        return true;
      }
      return false;
    });

    return matched[0] || null;
  }, [selectedProperty, agents]);

  // Filtering & Sorting
  const filteredAndSortedProperties = useMemo(() => {
    const list = properties.filter((p) => {
      const propertyUnits = units.filter((u) => u.propertyId === p.id);
      const hasMyUnit = propertyUnits.some(isMyUnit);
      const hasVacant = propertyUnits.some((u) => u.status === "vacant");

      // Match search query
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        propertyUnits.some(
          (u) =>
            u.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.floor && u.floor.toString().includes(searchTerm))
        );

      // Match property type
      const matchesType =
        filterType === "all" || p.type?.toLowerCase() === filterType.toLowerCase();

      // Match status
      let matchesStatus = true;
      if (filterStatus === "assigned") {
        matchesStatus = hasMyUnit || isAssignedProperty(p);
      } else if (filterStatus === "vacant") {
        matchesStatus = hasVacant;
      }

      // Match max rent
      const matchesMaxRent =
        !maxRent ||
        Number(maxRent) <= 0 ||
        getPropertyRent(p) <= Number(maxRent);

      return matchesSearch && matchesType && matchesStatus && matchesMaxRent;
    });

    switch (selectedSort) {
      case "price-asc":
        list.sort((a, b) => getPropertyRent(a) - getPropertyRent(b));
        break;
      case "price-desc":
        list.sort((a, b) => getPropertyRent(b) - getPropertyRent(a));
        break;
      case "name-asc":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "units-desc":
        list.sort((a, b) => (b.units || 0) - (a.units || 0));
        break;
    }

    return list;
  }, [properties, units, tenant, user, searchTerm, selectedSort, filterType, filterStatus, maxRent]);

  const filteredCondoUnits = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = units.filter((u) => {
      const uType = (u.type || "").toLowerCase();
      if (["house", "villa", "residential"].includes(uType)) return false;

      const parentProperty = u.propertyId ? properties.find((p) => p.id === u.propertyId) : undefined;
      if (parentProperty && ["house", "villa", "residential"].includes((parentProperty.type || "").toLowerCase())) {
        return false;
      }

      if (filterType !== "all" && filterType !== "condominium" && filterType !== "condo") {
        if (parentProperty) {
          if ((parentProperty.type || "").toLowerCase() !== filterType.toLowerCase()) return false;
        } else {
          return false;
        }
      }

      const haystack = [
        u.unitNumber,
        u.name,
        u.address,
        u.city,
        u.province,
        u.floor !== undefined && u.floor !== null ? String(u.floor) : "",
        parentProperty?.name,
        parentProperty?.location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (q && !haystack.includes(q)) return false;

      if (filterStatus === "assigned" && !isMyUnit(u)) return false;
      if (filterStatus === "vacant" && u.status !== "vacant") return false;

      if (maxRent && Number(maxRent) > 0 && (u.rentAmount || 0) > Number(maxRent)) return false;

      return true;
    });

    list.sort((a, b) => {
      const aMine = isMyUnit(a) ? 1 : 0;
      const bMine = isMyUnit(b) ? 1 : 0;
      if (aMine !== bMine) return bMine - aMine;

      switch (selectedSort) {
        case "price-asc":
          return (a.rentAmount || 0) - (b.rentAmount || 0);
        case "price-desc":
          return (b.rentAmount || 0) - (a.rentAmount || 0);
        case "name-asc":
          return (a.name || a.unitNumber || "").localeCompare(b.name || b.unitNumber || "");
        case "units-desc":
          return Number(b.floor || 0) - Number(a.floor || 0);
        default:
          return 0;
      }
    });

    return list;
  }, [units, properties, tenant, user, myRental.unit, myRental.assignment, searchTerm, selectedSort, filterType, filterStatus, maxRent]);

  const handleResetSearch = () => {
    setSearchTerm("");
    setFilterType("all");
    setFilterStatus("all");
    setMaxRent("");
    setSelectedSort("price-asc");
  };

  const handleNotifyMe = () => {
    toast.success("Notification alert set!", {
      description: "We'll notify you whenever landlords post new available rentals.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Management Banner matching tenant properties styling */}
      <ManagementBanner
        category="UNIT DIRECTORY"
        title="Available & Assigned Units"
        description="Browse available condominium units and view your assigned unit."
        icon={Building2}
      />

      {/* Tenant's Acquired / Assigned Condominium Unit */}
      <MyRentalCard state={myRental} filter="unit" />

      {/* Search & Filter Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search properties or units by number, neighborhood, or building name..."
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSearchTerm("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer z-10 pointer-events-auto"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Right action buttons: Filter & Sort */}
        <div className="flex items-center gap-2.5">
          {/* Filter button */}
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className={`h-11 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium shadow-xs flex items-center gap-2 transition-colors cursor-pointer ${
              filterType !== "all" || filterStatus !== "all" || maxRent
                ? "ring-2 ring-blue-500 text-blue-600"
                : ""
            }`}
          >
            <SlidersHorizontal className="h-4 w-4 text-slate-600" />
            <span>Filter</span>
            {(filterType !== "all" || filterStatus !== "all" || maxRent) && (
              <span className="h-2 w-2 rounded-full bg-blue-600" />
            )}
          </button>

          {/* Sort button with dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSortOpen((open) => !open)}
              className="h-11 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>{SORT_LABELS[selectedSort]}</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>

            {isSortOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-30"
                onClick={() => setIsSortOpen(false)}
              >
                {(Object.keys(SORT_LABELS) as SortOption[]).map((optionKey) => (
                  <button
                    key={optionKey}
                    type="button"
                    onClick={() => {
                      setSelectedSort(optionKey);
                      setIsSortOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                      selectedSort === optionKey
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{SORT_LABELS[optionKey]}</span>
                    {selectedSort === optionKey && <Check className="h-3.5 w-3.5 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-xs">
          <div className="h-9 w-9 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Loading condominium units...</p>
        </div>
      ) : filteredCondoUnits.length === 0 ? (
        /* Empty State Card */
        <div className="rounded-2xl border border-slate-200 bg-white p-12 sm:p-20 text-center shadow-xs">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 mx-auto mb-4">
            <Building2 className="h-9 w-9 stroke-[1.4]" />
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-800">
            No condominium units available yet
          </h2>

          <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto mt-2 leading-relaxed">
            Please check back later or modify your search filters. New rental assignments and vacant homes appear here when added by landlords.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button
              type="button"
              onClick={handleResetSearch}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium shadow-xs transition-colors cursor-pointer"
            >
              Reset Search
            </button>
            <button
              type="button"
              onClick={handleNotifyMe}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Bell className="h-4 w-4 text-slate-600" />
              <span>Get Notified of New Listings</span>
            </button>
          </div>
        </div>
      ) : (
        /* Condominium Unit Cards Grid */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {filteredCondoUnits.map((unit) => {
            const isAssigned = isMyUnit(unit);
            const parentProperty = unit.propertyId ? properties.find((p) => p.id === unit.propertyId) : undefined;
            const buildingName = unit.name || parentProperty?.name || "Condominium Unit";
            const unitLabel = String(unit.unitNumber || "").replace(/^unit\s*/i, "");
            const address = [unit.address || parentProperty?.location, unit.city, unit.province].filter(Boolean).join(", ");
            const coverImage = unit.imageUrl || unit.imageUrls?.[0] || parentProperty?.imageUrl || parentProperty?.imageUrls?.[0] || null;
            const statusLabel = isAssigned
              ? "Your Home"
              : unit.status === "vacant"
                ? "Available"
                : unit.status === "maintenance"
                  ? "Under Maintenance"
                  : "Occupied";
            const statusClass = isAssigned
              ? "bg-blue-600 text-white"
              : unit.status === "vacant"
                ? "bg-emerald-500 text-white"
                : unit.status === "maintenance"
                  ? "bg-amber-500 text-white"
                  : "bg-slate-700 text-white";

            return (
              <div
                key={unit.id}
                className={`group rounded-2xl border bg-white shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md transition-all duration-200 ${
                  isAssigned ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="relative h-48 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
                    {coverImage ? (
                      <Image
                        src={coverImage}
                        alt={`Unit ${unitLabel} – ${buildingName}`}
                        fill
                        unoptimized
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <Building2 className="h-14 w-14 stroke-[1.2]" />
                        <span className="text-[11px] font-medium text-slate-400 mt-1 uppercase tracking-wider">Condominium Unit</span>
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-xs ${statusClass}`}>
                        {isAssigned && <Check className="h-3 w-3" />}
                        {statusLabel}
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {unitLabel ? `Unit ${unitLabel} – ${buildingName}` : buildingName}
                    </h3>
                    {address && (
                      <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{address}</span>
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-3.5 pt-3.5 border-t border-slate-100">
                      <span className="font-medium text-slate-700 flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        Condominium Unit
                      </span>
                      {unit.floor !== undefined && unit.floor !== null && String(unit.floor) !== "" && (
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <Square className="h-3.5 w-3.5 text-slate-400" />
                          Floor {unit.floor}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-5 pb-5 pt-2 flex items-center justify-between">
                  <div>
                    <span className="text-lg font-extrabold text-slate-900">{formatCurrency(unit.rentAmount || 0)}</span>
                    <span className="text-xs text-slate-400 font-normal"> /mo</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (parentProperty) {
                        if (user) recordRecentPropertyView(user.id, parentProperty.id);
                        setSelectedUnitByProperty((prev) => ({ ...prev, [parentProperty.id]: unit.id }));
                        setSelectedProperty(parentProperty);
                      } else {
                        setSelectedUnitModal(unit);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    View Details
                  </button>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* FILTER MODAL */}
      <AnimatePresence>
        {isFilterOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs cursor-pointer"
            onClick={() => setIsFilterOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-slate-700" />
                  <h3 className="text-base font-bold text-slate-900">Filter Properties &amp; Units</h3>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFilterOpen(false);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer z-50 pointer-events-auto"
                  aria-label="Close filter"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Property Type */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Property Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "all", label: "All Types" },
                      { id: "apartment", label: "Apartments" },
                      { id: "condominium", label: "Condominiums" },
                      { id: "house", label: "Properties" },
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setFilterType(type.id)}
                        className={`h-10 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          filterType === type.id
                            ? "bg-blue-50 border-blue-600 text-blue-700"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Unit Availability Status */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Unit Availability
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "all", label: "All Units" },
                      { id: "assigned", label: "My Home" },
                      { id: "vacant", label: "Available" },
                    ].map((stat) => (
                      <button
                        key={stat.id}
                        type="button"
                        onClick={() => setFilterStatus(stat.id as "all" | "assigned" | "vacant")}
                        className={`h-10 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          filterStatus === stat.id
                            ? "bg-blue-50 border-blue-600 text-blue-700"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {stat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max Monthly Rent */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Max Monthly Rent (₱)
                  </label>
                  <input
                    type="number"
                    value={maxRent}
                    onChange={(e) => setMaxRent(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Filter Actions */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleResetSearch}
                    className="flex-1 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    className="flex-1 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROPERTY & UNIT DETAILS MODAL */}
      <AnimatePresence>
        {selectedProperty && (() => {
          const propertyUnits = units.filter((u) => u.propertyId === selectedProperty.id);
          const defaultUnit =
            propertyUnits.find(isMyUnit) ||
            propertyUnits.find((u) => u.status === "vacant") ||
            propertyUnits[0];
          const selectedUnitId = selectedUnitByProperty[selectedProperty.id] || defaultUnit?.id;
          const currentUnit = propertyUnits.find((u) => u.id === selectedUnitId) || defaultUnit;
          const isCurrentUnitAssigned = currentUnit ? isMyUnit(currentUnit) : isAssignedProperty(selectedProperty);
          const modalCoverImage = currentUnit?.imageUrl || currentUnit?.imageUrls?.[0] || selectedProperty.imageUrl || selectedProperty.imageUrls?.[0] || null;

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs cursor-pointer"
              onClick={() => setSelectedProperty(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden cursor-default max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Cover Image */}
                <div className="relative h-52 w-full bg-slate-100 flex items-center justify-center shrink-0">
                  {modalCoverImage ? (
                    <Image
                      src={modalCoverImage}
                      alt={selectedProperty.name}
                      fill
                      unoptimized
                      className="object-cover"
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.src = "/images/landing/feature-property.jpg";
                      }}
                    />
                  ) : (
                    <Building2 className="h-16 w-16 text-slate-300" />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProperty(null);
                    }}
                    className="absolute top-3 right-3 z-50 h-9 w-9 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center text-slate-700 shadow-lg hover:bg-white hover:text-slate-950 transition-all cursor-pointer pointer-events-auto"
                    aria-label="Close property details"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900">{selectedProperty.name}</h3>
                      {isCurrentUnitAssigned && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-200">
                          <Check className="h-3 w-3" /> Your Home {currentUnit ? `• Unit ${currentUnit.unitNumber}` : ""}
                        </span>
                      )}
                    </div>
                    <p className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>{selectedProperty.location}</span>
                    </p>
                  </div>

                  {/* Unit Selector inside Modal */}
                  {propertyUnits.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <label className="text-[11px] text-slate-600 uppercase font-semibold flex items-center gap-1 mb-1.5">
                        <Home className="h-3.5 w-3.5 text-slate-400" />
                        Selected Unit
                      </label>
                      <div className="relative">
                        <select
                          value={selectedUnitId || ""}
                          onChange={(e) => {
                            setSelectedUnitByProperty((prev) => ({
                              ...prev,
                              [selectedProperty.id]: e.target.value,
                            }));
                          }}
                          className="w-full h-10 pl-3 pr-8 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
                        >
                          {propertyUnits.map((u) => {
                            const isAssigned = isMyUnit(u);
                            return (
                              <option key={u.id} value={u.id}>
                                Unit {u.unitNumber} {u.floor ? `(Floor ${u.floor})` : ""} — {formatCurrency(u.rentAmount)}
                                {isAssigned ? " • Your Home" : u.status === "vacant" ? " • Available" : u.status === "maintenance" ? ` • Under Maintenance${u.maintenanceReason ? ` (${u.maintenanceReason})` : ""}` : " • Occupied"}
                              </option>
                            );
                          })}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <span className="text-[11px] text-slate-500 uppercase font-semibold">Type</span>
                      <p className="text-sm font-bold text-slate-800 capitalize mt-0.5">
                        {selectedProperty.type || "Apartment"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 uppercase font-semibold">Floor</span>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">
                        {currentUnit?.floor ? `Floor ${currentUnit.floor}` : "Ground Floor"}
                      </p>
                    </div>
                  </div>

                  {selectedProperty.description && (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {selectedProperty.description}
                    </p>
                  )}

                  {/* Agent in this Location */}
                  {locationAgent && (
                    <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-blue-700 uppercase font-bold flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          Agent in this Location
                        </span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 text-blue-600 shrink-0" />
                          {locationAgent.location || selectedProperty.location}
                        </span>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {locationAgent.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{locationAgent.name}</p>
                            <p className="text-[11px] text-slate-500 truncate">{locationAgent.email}</p>
                          </div>
                        </div>
                        <Link
                          href={`/agents/${locationAgent.id}?propertyId=${encodeURIComponent(selectedProperty.id)}&propertyName=${encodeURIComponent(selectedProperty.name)}${currentUnit?.unitNumber ? `&unitNumber=${encodeURIComponent(currentUnit.unitNumber)}` : ""}&unitId=${encodeURIComponent(currentUnit?.id || "")}#message`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0 shadow-2xs transition"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>Inquire</span>
                        </Link>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <div>
                      <span className="text-xs text-slate-500">
                        {isCurrentUnitAssigned ? "Your Monthly Rent" : "Monthly Rent"}
                      </span>
                      <p className="text-xl font-extrabold text-slate-900">
                        {formatCurrency(currentUnit?.rentAmount ?? getPropertyRent(selectedProperty))}
                        <span className="text-xs font-normal text-slate-500"> /mo</span>
                      </p>
                    </div>

                    {isCurrentUnitAssigned ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                          <Check className="h-4 w-4 text-emerald-600" />
                          Assigned &amp; Approved
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            toast.info("Active Lease", {
                              description: `You are currently assigned to ${selectedProperty.name}${currentUnit?.unitNumber ? ` (Unit ${currentUnit.unitNumber})` : ""}. Your lease was assigned by your agent and approved by the owner.`,
                            });
                            setSelectedProperty(null);
                          }}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                        >
                          Active Lease
                        </button>
                      </div>
                    ) : (
                      <Link
                        href={locationAgent ? `/agents/${locationAgent.id}?propertyId=${encodeURIComponent(selectedProperty.id)}&propertyName=${encodeURIComponent(selectedProperty.name)}${currentUnit?.unitNumber ? `&unitNumber=${encodeURIComponent(currentUnit.unitNumber)}` : ""}&unitId=${encodeURIComponent(currentUnit?.id || "")}#message` : `/agents`}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>Inquire Unit</span>
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* INDEPENDENT CONDOMINIUM UNIT DETAILS MODAL */}
      <AnimatePresence>
        {selectedUnitModal && (() => {
          const isAssigned = isMyUnit(selectedUnitModal);
          const unitLabel = String(selectedUnitModal.unitNumber || "").replace(/^unit\s*/i, "");
          const buildingName = selectedUnitModal.name || "Condominium Unit";
          const title = unitLabel ? `Unit ${unitLabel} – ${buildingName}` : buildingName;
          const address = [selectedUnitModal.address, selectedUnitModal.city, selectedUnitModal.province].filter(Boolean).join(", ");
          const cover = selectedUnitModal.imageUrl || selectedUnitModal.imageUrls?.[0] || null;
          const amenities = Array.from(
            new Set([
              ...(((selectedUnitModal as any).amenities as string[]) || []),
              ...(((selectedUnitModal as any).features as string[]) || []),
            ])
          ).filter(Boolean);

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs cursor-pointer"
              onClick={() => setSelectedUnitModal(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden cursor-default max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative h-52 w-full bg-slate-100 flex items-center justify-center shrink-0">
                  {cover ? (
                    <Image src={cover} alt={title} fill unoptimized className="object-cover" />
                  ) : (
                    <Building2 className="h-16 w-16 text-slate-300" />
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedUnitModal(null)}
                    className="absolute top-3 right-3 z-50 h-9 w-9 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center text-slate-700 shadow-lg hover:bg-white hover:text-slate-950 transition-all cursor-pointer"
                    aria-label="Close unit details"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900">{title}</h3>
                      {isAssigned && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-200">
                          <Check className="h-3 w-3" /> Your Home
                        </span>
                      )}
                    </div>
                    {address && (
                      <p className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{address}</span>
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <span className="text-[11px] text-slate-500 uppercase font-semibold">Type</span>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">Condominium Unit</p>
                    </div>
                    {selectedUnitModal.floor !== undefined && selectedUnitModal.floor !== null && String(selectedUnitModal.floor) !== "" && (
                      <div>
                        <span className="text-[11px] text-slate-500 uppercase font-semibold">Floor</span>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">Floor {selectedUnitModal.floor}</p>
                      </div>
                    )}
                    {selectedUnitModal.condition && (
                      <div>
                        <span className="text-[11px] text-slate-500 uppercase font-semibold">Condition</span>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">{selectedUnitModal.condition}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-[11px] text-slate-500 uppercase font-semibold">Availability</span>
                      <p className="text-sm font-bold text-slate-800 capitalize mt-0.5">
                        {isAssigned ? "Your Home (Occupied)" : selectedUnitModal.status === "vacant" ? "Available" : selectedUnitModal.status}
                      </p>
                    </div>
                  </div>

                  {amenities.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase text-slate-500 mb-2">Amenities &amp; Facilities</p>
                      <div className="flex flex-wrap gap-1.5">
                        {amenities.map((amenity) => (
                          <span key={amenity} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {amenity}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <div>
                      <span className="text-xs text-slate-500">
                        {isAssigned ? "Your Monthly Rent" : "Monthly Rent"}
                      </span>
                      <p className="text-xl font-extrabold text-slate-900">
                        {formatCurrency(selectedUnitModal.rentAmount || 0)}
                        <span className="text-xs font-normal text-slate-500"> /mo</span>
                      </p>
                    </div>

                    {isAssigned ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                        <Check className="h-4 w-4 text-emerald-600" />
                        Assigned &amp; Approved
                      </span>
                    ) : (
                      <Link
                        href={`/agents?unitId=${encodeURIComponent(selectedUnitModal.id)}&unitNumber=${encodeURIComponent(selectedUnitModal.unitNumber || "")}&propertyName=${encodeURIComponent(buildingName)}`}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>Inquire Unit</span>
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
