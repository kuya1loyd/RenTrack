"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
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
  const [tenant, setTenant] = useState<MoveOutTenancy["tenant"]>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSort, setSelectedSort] = useState<SortOption>("price-asc");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedUnitByProperty, setSelectedUnitByProperty] = useState<Record<string, string>>({});

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

    return () => {
      isMounted = false;
    };
  }, [user]);

  const isMyUnit = (unit: Unit) => {
    if (!user) return false;
    if (unit.tenantId === user.id) return true;
    if (tenant?.id && unit.tenantId === tenant.id) return true;
    if (tenant?.unitId && unit.id === tenant.unitId) return true;
    if (tenant?.unitNumber && unit.unitNumber.toLowerCase() === tenant.unitNumber.toLowerCase()) return true;
    return false;
  };

  const isAssignedProperty = (property: Property) => {
    if (!tenant) return false;
    if (tenant.propertyName && property.name.toLowerCase() === tenant.propertyName.toLowerCase()) return true;
    if (tenant.propertyId && property.id === tenant.propertyId) return true;
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

  // Filtering & Sorting
  const filteredAndSortedProperties = useMemo(() => {
    let list = properties.filter((p) => {
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
        description="Browse available rental properties and explore units in your area."
        icon={Building2}
      />

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
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Loading units and properties...</p>
        </div>
      ) : filteredAndSortedProperties.length === 0 ? (
        /* Empty State Card */
        <div className="rounded-2xl border border-slate-200 bg-white p-12 sm:p-20 text-center shadow-xs">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 mx-auto mb-4">
            <Building2 className="h-9 w-9 stroke-[1.4]" />
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-800">
            No units or properties available yet
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
        /* Property & Unit Cards Grid */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {filteredAndSortedProperties.map((property) => {
            const isFav = favoriteIds.includes(property.id);
            const propertyUnits = units.filter((u) => u.propertyId === property.id);
            const defaultUnit =
              propertyUnits.find(isMyUnit) ||
              propertyUnits.find((u) => u.status === "vacant") ||
              propertyUnits[0];
            const selectedUnitId = selectedUnitByProperty[property.id] || defaultUnit?.id;
            const currentUnit = propertyUnits.find((u) => u.id === selectedUnitId) || defaultUnit;
            const isCurrentUnitAssigned = currentUnit ? isMyUnit(currentUnit) : isAssignedProperty(property);
            const displayRent = currentUnit?.rentAmount ?? getPropertyRent(property);
            const coverImage = currentUnit?.imageUrl || property.imageUrl;

            return (
              <div
                key={property.id}
                className="group rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all duration-200"
              >
                <div>
                  {/* Property Cover / Image Header */}
                  <div className="relative h-48 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
                    {coverImage ? (
                      <Image
                        src={coverImage}
                        alt={property.name}
                        fill
                        unoptimized
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          target.src = "/images/landing/feature-property.jpg";
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <Building2 className="h-14 w-14 stroke-[1.2]" />
                        <span className="text-[11px] font-medium text-slate-400 mt-1 uppercase tracking-wider">
                          RentTrack Property
                        </span>
                      </div>
                    )}

                    {/* Favorite Button */}
                    <button
                      type="button"
                      aria-label={isFav ? "Remove favorite" : "Add to favorites"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!user) return;
                        const added = toggleFavoriteProperty(user.id, property.id);
                        setFavoriteIds((prev) =>
                          added ? [...prev, property.id] : prev.filter((id) => id !== property.id)
                        );
                      }}
                      className="absolute top-3 left-3 h-8 w-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-rose-500 shadow-sm hover:scale-105 transition-transform cursor-pointer"
                    >
                      <Heart className={`h-4 w-4 ${isFav ? "fill-rose-500" : ""}`} />
                    </button>

                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                      {isCurrentUnitAssigned ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white flex items-center gap-1 shadow-xs">
                          <Check className="h-3 w-3" />
                          Your Home {currentUnit ? `• Unit ${currentUnit.unitNumber}` : ""}
                        </span>
                      ) : (
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            currentUnit?.status === "vacant" || property.status === "active"
                              ? "bg-emerald-500 text-white"
                              : "bg-slate-700 text-white"
                          }`}
                        >
                          {currentUnit?.status === "vacant" || property.status === "active" ? "Available" : "Occupied"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {property.name}
                    </h3>

                    <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{property.location}</span>
                    </p>

                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-3.5 pt-3.5 border-t border-slate-100">
                      <span className="capitalize font-medium text-slate-700 flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        {property.type || "Apartment"}
                      </span>
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <Square className="h-3.5 w-3.5 text-slate-400" />
                        {property.units || 1} units
                      </span>
                    </div>

                    {/* Unit Dropdown */}
                    {propertyUnits.length > 0 && (
                      <div className="mt-3.5 pt-3.5 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                            <Home className="h-3 w-3 text-slate-400" />
                            Select Unit
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {propertyUnits.length} {propertyUnits.length === 1 ? "unit" : "units"}
                          </span>
                        </div>
                        <div className="relative">
                          <select
                            value={selectedUnitId || ""}
                            onChange={(e) => {
                              e.stopPropagation();
                              setSelectedUnitByProperty((prev) => ({
                                ...prev,
                                [property.id]: e.target.value,
                              }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full h-9 pl-3 pr-8 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none transition-colors"
                          >
                            {propertyUnits.map((u) => {
                              const isAssigned = isMyUnit(u);
                              return (
                                <option key={u.id} value={u.id}>
                                  Unit {u.unitNumber} {u.floor ? `(Floor ${u.floor})` : ""} — {formatCurrency(u.rentAmount)}
                                  {isAssigned ? " • Your Home" : u.status === "vacant" ? " • Available" : " • Occupied"}
                                </option>
                              );
                            })}
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer with Price and View Details */}
                <div className="px-5 pb-5 pt-2 flex items-center justify-between">
                  <div>
                    <span className="text-lg font-extrabold text-slate-900">
                      {formatCurrency(displayRent)}
                    </span>
                    <span className="text-xs text-slate-400 font-normal"> /mo</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (user) recordRecentPropertyView(user.id, property.id);
                      setSelectedProperty(property);
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
                      { id: "house", label: "Houses" },
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
          const modalCoverImage = currentUnit?.imageUrl || selectedProperty.imageUrl;

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
                                {isAssigned ? " • Your Home" : u.status === "vacant" ? " • Available" : " • Occupied"}
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
                      <button
                        type="button"
                        onClick={() => {
                          toast.success("Inquiry sent!", {
                            description: `We notified the owner/agent about your interest in ${selectedProperty.name}${currentUnit?.unitNumber ? ` (Unit ${currentUnit.unitNumber})` : ""}.`,
                          });
                          setSelectedProperty(null);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        Inquire Unit
                      </button>
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
