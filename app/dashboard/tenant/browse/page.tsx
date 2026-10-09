"use client";

import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Flag,
  Search,
  X,
  Building2,
  MapPin,
  Check,
  ChevronDown,
  Layers,
  DoorOpen,
  RotateCcw,
  AlertCircle,
  Home,
  SlidersHorizontal,
  Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import {
  getProperties,
  getUnits,
  createRating,
  createComplaint,
  Property,
  Unit,
} from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

type SortOption = "price-asc" | "price-desc" | "name-asc" | "units-desc";

const SORT_LABELS: Record<SortOption, string> = {
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  "name-asc": "Name: A to Z",
  "units-desc": "Most Available Units",
};

export default function TenantBrowsePage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | "house" | "condominium">("all");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [selectedSort, setSelectedSort] = useState<SortOption>("name-asc");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Selected property for details modal
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  // Rating modal state
  const [ratingTarget, setRatingTarget] = useState<{ type: "property" | "unit"; id: string; name: string } | null>(null);
  const [userRating, setUserRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Complaint modal state
  const [complaintTarget, setComplaintTarget] = useState<{ type: "property" | "unit"; id: string; name: string } | null>(null);
  const [complaintSubject, setComplaintSubject] = useState("");
  const [complaintMessage, setComplaintMessage] = useState("");
  const [complaintPriority, setComplaintPriority] = useState("medium");
  const [isSubmittingComplaint, setIsSubmittingComplaint] = useState(false);

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
        }
      } catch {
        if (isMounted) {
          setProperties([]);
          setUnits([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Derived filtered & sorted properties
  const filteredProperties = useMemo(() => {
    const list = properties.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType =
        selectedType === "all" || p.type?.toLowerCase() === selectedType.toLowerCase();

      const propertyUnits = units.filter((u) => u.propertyId === p.id);
      const vacantCount = propertyUnits.filter((u) => u.status === "vacant").length;
      const matchesAvailability = !availableOnly || vacantCount > 0;

      return matchesSearch && matchesType && matchesAvailability;
    });

    return list.sort((a, b) => {
      const aUnits = units.filter((u) => u.propertyId === a.id);
      const bUnits = units.filter((u) => u.propertyId === b.id);
      const aVacant = aUnits.filter((u) => u.status === "vacant").length;
      const bVacant = bUnits.filter((u) => u.status === "vacant").length;

      const aRent = aUnits.length > 0 ? Math.min(...aUnits.map((u) => u.rentAmount || 0)) : (a.monthlyRevenue || 0);
      const bRent = bUnits.length > 0 ? Math.min(...bUnits.map((u) => u.rentAmount || 0)) : (b.monthlyRevenue || 0);

      switch (selectedSort) {
        case "price-asc":
          return aRent - bRent;
        case "price-desc":
          return bRent - aRent;
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "units-desc":
          return bVacant - aVacant;
        default:
          return 0;
      }
    });
  }, [properties, units, searchTerm, selectedType, availableOnly, selectedSort]);

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedType("all");
    setAvailableOnly(false);
    setSelectedSort("name-asc");
  };

  const handleSubmitRating = async () => {
    if (!user) {
      toast.error("Please sign in to submit a rating");
      return;
    }
    if (!ratingTarget || userRating === 0) {
      toast.error("Please select a star rating");
      return;
    }
    setIsSubmittingRating(true);
    try {
      await createRating({
        userId: user.id,
        targetType: ratingTarget.type,
        targetId: ratingTarget.id,
        rating: userRating,
        comment: ratingComment,
      });
      toast.success("Rating submitted! Thank you for your feedback.");
      setRatingTarget(null);
      setUserRating(0);
      setRatingComment("");
    } catch {
      toast.error("Failed to submit rating");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleSubmitComplaint = async () => {
    if (!user) {
      toast.error("Please sign in to submit a complaint");
      return;
    }
    if (!complaintTarget || !complaintSubject.trim() || !complaintMessage.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsSubmittingComplaint(true);
    try {
      await createComplaint({
        tenantId: user.id,
        targetType: complaintTarget.type,
        targetId: complaintTarget.id,
        subject: complaintSubject.trim(),
        message: complaintMessage.trim(),
        priority: complaintPriority,
      });
      toast.success("Complaint submitted! Management will review it shortly.");
      setComplaintTarget(null);
      setComplaintSubject("");
      setComplaintMessage("");
      setComplaintPriority("medium");
    } catch {
      toast.error("Failed to submit complaint");
    } finally {
      setIsSubmittingComplaint(false);
    }
  };

  const vacantTotal = useMemo(
    () => units.filter((u) => u.status === "vacant").length,
    [units]
  );

  return (
    <div className="space-y-6">
      {/* Sleek, Professional Dark Navy Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-[#071326] px-6 py-7 sm:px-8 sm:py-8 text-white shadow-xs border border-slate-800/80">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-medium text-slate-200 mb-2.5 backdrop-blur-xs">
              <Building2 className="h-3.5 w-3.5 text-blue-400" />
              <span>Available Rentals Marketplace</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Find Your Next Home
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl font-normal">
              Browse verified rental properties, explore vacant units, and connect with property managers.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-center min-w-[100px]">
              <p className="text-xl font-extrabold text-white leading-none">{properties.length}</p>
              <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wider">Properties</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-center min-w-[100px]">
              <p className="text-xl font-extrabold text-emerald-400 leading-none">{vacantTotal}</p>
              <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wider">Vacant Units</p>
            </div>
          </div>
        </div>

        {/* Ambient subtle glow */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by property name, location, or neighborhood..."
              className="pl-10 pr-9 h-10 rounded-xl border-slate-200 bg-slate-50/50 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Quick Filter Buttons & Sorting */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Property Type Pills */}
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50/80 p-1">
              <button
                type="button"
                onClick={() => setSelectedType("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedType === "all"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Types
              </button>
              <button
                type="button"
                onClick={() => setSelectedType("house")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedType === "house"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Houses
              </button>
              <button
                type="button"
                onClick={() => setSelectedType("condominium")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedType === "condominium"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Condos
              </button>
            </div>

            {/* Vacant Only Toggle */}
            <button
              type="button"
              onClick={() => setAvailableOnly(!availableOnly)}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-medium transition-colors ${
                availableOnly
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 font-semibold"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${availableOnly ? "bg-emerald-500" : "bg-slate-300"}`} />
              <span>Vacant Units Only</span>
            </button>

            {/* Sort Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSortOpen(!isSortOpen)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                <span>{SORT_LABELS[selectedSort]}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {isSortOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg z-30"
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
                      className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs text-left transition-colors ${
                        selectedSort === optionKey
                          ? "bg-blue-50 text-blue-700 font-semibold"
                          : "text-slate-700 hover:bg-slate-50 font-medium"
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
      </div>

      {/* Featured Properties Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Featured Properties
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {filteredProperties.length} {filteredProperties.length === 1 ? "property" : "properties"}
              {searchTerm ? ` matching "${searchTerm}"` : ""}
            </p>
          </div>

          {(searchTerm || selectedType !== "all" || availableOnly) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Clear filters</span>
            </button>
          )}
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
            <div className="h-8 w-8 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-medium text-slate-500">Loading properties...</p>
          </div>
        ) : filteredProperties.length === 0 ? (
          /* Clean, Dignified Empty State (No cartoon emojis) */
          <div className="rounded-2xl border border-slate-200 bg-white p-12 sm:p-16 text-center shadow-xs">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 mx-auto mb-3.5">
              <Building2 className="h-7 w-7 stroke-[1.4]" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800">
              No properties found
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1.5 leading-relaxed">
              We couldn&apos;t find any rental properties matching your current search or filters. Try adjusting your query or resetting filters.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="rounded-xl text-xs gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Filters
              </Button>
            </div>
          </div>
        ) : (
          /* Professional Property Cards Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProperties.map((property) => {
              const propertyUnits = units.filter((u) => u.propertyId === property.id);
              const vacantUnits = propertyUnits.filter((u) => u.status === "vacant");
              const vacantCount = vacantUnits.length;
              const startingRent =
                vacantUnits.length > 0
                  ? Math.min(...vacantUnits.map((u) => u.rentAmount || 0))
                  : propertyUnits.length > 0
                  ? Math.min(...propertyUnits.map((u) => u.rentAmount || 0))
                  : property.monthlyRevenue || 0;

              return (
                <div
                  key={property.id}
                  className="group rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all duration-200"
                >
                  <div>
                    {/* Property Image Header */}
                    <div className="relative h-48 w-full bg-slate-100 overflow-hidden flex items-center justify-center">
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
                          <Building2 className="h-12 w-12 stroke-[1.2]" />
                          <span className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wider">
                            RentTrack Listing
                          </span>
                        </div>
                      )}

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white/90 backdrop-blur-xs text-slate-700 shadow-xs capitalize">
                          {property.type === "house" ? "House" : "Condo"}
                        </span>
                      </div>

                      <div className="absolute top-3 right-3 flex items-center gap-1.5">
                        {vacantCount > 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                            {vacantCount} Available
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900/70 backdrop-blur-xs text-white">
                            Occupied
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="font-bold text-slate-900 text-base truncate group-hover:text-blue-600 transition-colors">
                          {property.name}
                        </h3>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-medium text-slate-600 border-slate-200 shrink-0 capitalize"
                        >
                          {property.status}
                        </Badge>
                      </div>

                      <p className="text-xs text-slate-500 mb-3.5 flex items-center gap-1.5 truncate">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{property.location}</span>
                      </p>

                      {/* Stats Strip */}
                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50/70 p-2.5 border border-slate-100 text-xs mb-4">
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-slate-400">Total Units</p>
                          <p className="font-bold text-slate-800 mt-0.5">
                            {property.units || propertyUnits.length || 0} units
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-slate-400">
                            {startingRent > 0 ? "Rent Starts At" : "Revenue"}
                          </p>
                          <p className="font-bold text-slate-900 mt-0.5 truncate">
                            {startingRent > 0 ? formatCurrency(startingRent) : "Contact Agent"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0">
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => setSelectedProperty(property)}
                        className="flex-1 h-8.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium gap-1.5 shadow-xs"
                      >
                        <DoorOpen className="h-3.5 w-3.5" />
                        <span>View Units</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRatingTarget({ type: "property", id: property.id, name: property.name });
                          setUserRating(0);
                          setRatingComment("");
                        }}
                        className="h-8.5 px-2.5 rounded-xl border-slate-200 hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-200 text-slate-600 text-xs font-medium gap-1 transition-colors"
                        title="Rate Property"
                      >
                        <Star className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Rate</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setComplaintTarget({ type: "property", id: property.id, name: property.name });
                          setComplaintSubject("");
                          setComplaintMessage("");
                          setComplaintPriority("medium");
                        }}
                        className="h-8.5 px-2.5 rounded-xl border-slate-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-slate-600 text-xs font-medium gap-1 transition-colors"
                        title="Submit Complaint"
                      >
                        <Flag className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Report</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Property Details Modal */}
      {selectedProperty && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedProperty(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header Image */}
            <div className="relative h-48 w-full bg-slate-100 flex items-center justify-center">
              {selectedProperty.imageUrl ? (
                <Image
                  src={selectedProperty.imageUrl}
                  alt={selectedProperty.name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <Building2 className="h-12 w-12 stroke-[1.2]" />
                  <span className="text-[11px] font-medium text-slate-400 mt-1 uppercase tracking-wider">
                    RentTrack Property
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSelectedProperty(null)}
                className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/90 backdrop-blur-xs hover:bg-white flex items-center justify-center text-slate-700 shadow-xs transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedProperty.name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{selectedProperty.location}</span>
                  </p>
                </div>
                <Badge variant="outline" className="capitalize text-xs font-semibold">
                  {selectedProperty.type}
                </Badge>
              </div>

              {selectedProperty.description && (
                <p className="text-xs text-slate-600 mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 leading-relaxed">
                  {selectedProperty.description}
                </p>
              )}

              {/* Units List */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Units in this Property
                  </h4>
                  <span className="text-xs font-semibold text-slate-700">
                    {units.filter((u) => u.propertyId === selectedProperty.id).length} total
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {units.filter((u) => u.propertyId === selectedProperty.id).length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No units listed for this property yet.
                    </div>
                  ) : (
                    units
                      .filter((u) => u.propertyId === selectedProperty.id)
                      .map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50/50 transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 font-bold text-xs">
                              {u.unitNumber}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">Unit {u.unitNumber}</p>
                              {u.floor && (
                                <p className="text-[11px] text-slate-400">Floor {u.floor}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-900">
                              {formatCurrency(u.rentAmount || 0)}/mo
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                u.status === "vacant"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {u.status}
                            </span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRatingTarget({ type: "property", id: selectedProperty.id, name: selectedProperty.name });
                      setUserRating(0);
                      setRatingComment("");
                    }}
                    className="rounded-xl text-xs gap-1.5"
                  >
                    <Star className="h-3.5 w-3.5 text-yellow-500" />
                    <span>Rate Property</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setComplaintTarget({ type: "property", id: selectedProperty.id, name: selectedProperty.name });
                      setComplaintSubject("");
                      setComplaintMessage("");
                      setComplaintPriority("medium");
                    }}
                    className="rounded-xl text-xs gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    <span>Report Issue</span>
                  </Button>
                </div>
                <Button
                  size="sm"
                  onClick={() => setSelectedProperty(null)}
                  className="rounded-xl text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Professional Rating Modal */}
      {ratingTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setRatingTarget(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6 border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setRatingTarget(null)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-bold text-slate-900">Rate {ratingTarget.name}</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Share your honest feedback and experience with this {ratingTarget.type}.
            </p>

            <div className="flex items-center gap-2 mb-5 justify-center py-2 bg-slate-50 rounded-xl border border-slate-100">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setUserRating(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`h-7 w-7 transition-colors ${
                      star <= userRating ? "text-yellow-400 fill-yellow-400" : "text-slate-300"
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-xs font-bold text-slate-700 min-w-[32px]">
                {userRating > 0 ? `${userRating} / 5` : ""}
              </span>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Feedback Comment (optional)
              </label>
              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Share details about cleanliness, maintenance, responsiveness..."
                className="w-full h-24 rounded-xl border border-slate-200 p-3 text-xs resize-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setRatingTarget(null)}
                className="flex-1 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitRating}
                disabled={isSubmittingRating || userRating === 0}
                className="flex-1 rounded-xl text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubmittingRating ? "Submitting..." : "Submit Rating"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Professional Complaint Modal */}
      {complaintTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setComplaintTarget(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6 border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setComplaintTarget(null)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-bold text-slate-900">Report an Issue</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Submit a formal report or complaint regarding {complaintTarget.name}.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Subject *
                </label>
                <Input
                  value={complaintSubject}
                  onChange={(e) => setComplaintSubject(e.target.value)}
                  placeholder="e.g., Water leakage, electrical issue, noise complaint"
                  className="rounded-xl text-xs h-9.5"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Priority
                </label>
                <select
                  value={complaintPriority}
                  onChange={(e) => setComplaintPriority(e.target.value)}
                  className="w-full h-9.5 rounded-xl border border-slate-200 text-xs px-3 bg-white text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="low">Low - Routine inquiry or notice</option>
                  <option value="medium">Medium - Standard maintenance request</option>
                  <option value="high">High - Urgent attention needed</option>
                  <option value="urgent">Urgent - Emergency hazard or outage</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Detailed Description *
                </label>
                <textarea
                  value={complaintMessage}
                  onChange={(e) => setComplaintMessage(e.target.value)}
                  placeholder="Provide complete details to help management resolve this promptly..."
                  className="w-full h-28 rounded-xl border border-slate-200 p-3 text-xs resize-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setComplaintTarget(null)}
                  className="flex-1 rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitComplaint}
                  disabled={
                    isSubmittingComplaint ||
                    !complaintSubject.trim() ||
                    !complaintMessage.trim()
                  }
                  className="flex-1 rounded-xl text-xs bg-red-600 hover:bg-red-700 text-white"
                >
                  {isSubmittingComplaint ? "Submitting..." : "Submit Complaint"}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
