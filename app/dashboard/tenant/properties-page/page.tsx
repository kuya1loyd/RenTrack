"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Building2,
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
import { getProperties, Property } from "@/lib/data";
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

export default function TenantPropertiesPage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSort, setSelectedSort] = useState<SortOption>("price-asc");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  // Filters state
  const [filterType, setFilterType] = useState<string>("all");
  const [maxRent, setMaxRent] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const props = await getProperties(user);
        if (isMounted) {
          setProperties(props);
          if (user) {
            setFavoriteIds(getTenantPropertyIds(user.id, "favorites"));
          }
        }
      } catch {
        if (isMounted) toast.error("Failed to load properties");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Filtering & Sorting
  const filteredAndSortedProperties = useMemo(() => {
    let list = properties.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType =
        filterType === "all" ||
        p.type?.toLowerCase() === filterType.toLowerCase();

      const matchesMaxRent =
        !maxRent ||
        Number(maxRent) <= 0 ||
        (p.monthlyRevenue || 0) <= Number(maxRent);

      return matchesSearch && matchesType && matchesMaxRent;
    });

    switch (selectedSort) {
      case "price-asc":
        list.sort((a, b) => (a.monthlyRevenue || 0) - (b.monthlyRevenue || 0));
        break;
      case "price-desc":
        list.sort((a, b) => (b.monthlyRevenue || 0) - (a.monthlyRevenue || 0));
        break;
      case "name-asc":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "units-desc":
        list.sort((a, b) => (b.units || 0) - (a.units || 0));
        break;
    }

    return list;
  }, [properties, searchTerm, selectedSort, filterType, maxRent]);

  const handleResetSearch = () => {
    setSearchTerm("");
    setFilterType("all");
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
      {/* Management Banner matching tenant dashboard styling */}
      <ManagementBanner
        category="PROPERTY DIRECTORY"
        title="My Properties"
        description="Browse available rental properties and explore units in your area."
        icon={Building2}
      />

      {/* Search & Filter Controls Bar (Exact match to screenshot 2) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search properties by city, neighborhood, or building name..."
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
              filterType !== "all" || maxRent ? "ring-2 ring-blue-500 text-blue-600" : ""
            }`}
          >
            <SlidersHorizontal className="h-4 w-4 text-slate-600" />
            <span>Filter</span>
            {(filterType !== "all" || maxRent) && (
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
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Loading properties...</p>
        </div>
      ) : filteredAndSortedProperties.length === 0 ? (
        /* Empty State Card (Exact match to screenshot 2) */
        <div className="rounded-2xl border border-slate-200 bg-white p-12 sm:p-20 text-center shadow-xs">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 mx-auto mb-4">
            <Building2 className="h-9 w-9 stroke-[1.4]" />
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-800">
            No properties available yet
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
        /* Property Cards Grid */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {filteredAndSortedProperties.map((property) => {
            const isFav = favoriteIds.includes(property.id);
            return (
              <div
                key={property.id}
                className="group rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all duration-200"
              >
                <div>
                  {/* Property Cover / Image Header */}
                  <div className="relative h-48 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
                    {property.imageUrl ? (
                      <Image
                        src={property.imageUrl}
                        alt={property.name}
                        fill
                        unoptimized
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
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
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          property.status === "active"
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-700 text-white"
                        }`}
                      >
                        {property.status === "active" ? "Available" : "Occupied"}
                      </span>
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
                  </div>
                </div>

                {/* Footer with Price and View Details */}
                <div className="px-5 pb-5 pt-2 flex items-center justify-between">
                  <div>
                    <span className="text-lg font-extrabold text-slate-900">
                      {formatCurrency(property.monthlyRevenue || 0)}
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
                  <h3 className="text-base font-bold text-slate-900">Filter Properties</h3>
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
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Property Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {["all", "apartment", "house", "commercial"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFilterType(t)}
                        className={`h-9 rounded-xl border text-xs font-semibold capitalize transition-colors ${
                          filterType === t
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {t === "all" ? "All Types" : t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Maximum Monthly Rent (₱)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 15000"
                    value={maxRent}
                    onChange={(e) => setMaxRent(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterType("all");
                      setMaxRent("");
                    }}
                    className="flex-1 h-10 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
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

      {/* PROPERTY DETAILS MODAL */}
      <AnimatePresence>
        {selectedProperty && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs cursor-pointer"
            onClick={() => setSelectedProperty(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative h-52 w-full bg-slate-100 flex items-center justify-center">
                {selectedProperty.imageUrl ? (
                  <Image
                    src={selectedProperty.imageUrl}
                    alt={selectedProperty.name}
                    fill
                    unoptimized
                    className="object-cover"
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

              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedProperty.name}</h3>
                  <p className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{selectedProperty.location}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Type</span>
                    <p className="text-sm font-bold text-slate-800 capitalize mt-0.5">
                      {selectedProperty.type || "Apartment"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Total Units</span>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">
                      {selectedProperty.units || 1} units
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
                    <span className="text-xs text-slate-500">Rent starts at</span>
                    <p className="text-xl font-extrabold text-slate-900">
                      {formatCurrency(selectedProperty.monthlyRevenue || 0)}
                      <span className="text-xs font-normal text-slate-500"> /mo</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      toast.success("Inquiry sent!", {
                        description: `We notified the owner/agent about your interest in ${selectedProperty.name}.`,
                      });
                      setSelectedProperty(null);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    Inquire Unit
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
