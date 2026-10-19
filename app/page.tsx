"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { Bell, Shield, MapPin, Home, Search, Menu, ChevronRight, ChevronDown, Star, Phone, Mail, MessageCircle, ArrowRight, CreditCard, BarChart3, Building2, Users, X, UserPlus, BedDouble, Bath, Car, Grid2X2, Ruler, Wifi, Snowflake, Sofa, Utensils, WashingMachine, TreePine, LockKeyhole, SlidersHorizontal, Sparkles, CheckCircle2, DoorOpen, Check, UploadCloud, FileText, ShieldCheck, Award, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import UnitImageCarousel from "@/components/unit-image-carousel";
import PublicAgentCard from "@/components/public-agent-card";
import AgentCarousel from "@/components/agent-carousel";
import { safeParseJson } from "@/lib/data";

const DestinationsMap = dynamic(() => import("@/components/destinations-map"), { ssr: false });

type PublicAgent = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  experience?: string;
  location?: string;
  address?: string;
  avatarUrl?: string | null;
  createdAt?: string | null;
};

const navItems = [
  { label: "Home", href: "/" },
  { label: "Destinations", href: "#destinations" },
  { label: "Agents", href: "#agents" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];
const unitTypeChoices = [
  { label: "Properties", value: "properties" },
  { label: "Units", value: "units" },
];

const unitImages = [
  "/images/landing/feature-property.jpg",
  "/images/landing/feature-tenant.jpg",
  "/images/landing/feature-payment.jpg",
  "/images/landing/feature-dashboard.jpg",
  "/images/landing/feature-notifications.jpg",
  "/images/landing/feature-security.jpg",
];

const features = [
  { icon: Building2, title: "Property Management", desc: "Manage multiple properties and units across different locations. Track occupancy, maintenance, and lease details.", image: "/images/landing/feature-property.jpg" },
  { icon: Users, title: "Tenant Management", desc: "Register tenants, assign units, manage contracts, and maintain complete tenant profiles with ease.", image: "/images/landing/feature-tenant.jpg" },
  { icon: CreditCard, title: "Payment Tracking", desc: "Full, partial, and advance payment support. Upload receipts, auto-calculate balances, and maintain ledgers.", image: "/images/landing/feature-payment.jpg" },
  { icon: BarChart3, title: "Dashboard Analytics", desc: "Real-time dashboards with charts, aging reports, and performance metrics tailored to each user role.", image: "/images/landing/feature-dashboard.jpg" },
  { icon: Bell, title: "Smart Notifications", desc: "Automated email and SMS alerts for payment confirmations, due dates, overdue reminders, and approvals.", image: "/images/landing/feature-notifications.jpg" },
  { icon: Shield, title: "Role-Based Access", desc: "Secure RBAC with Admin, Owner, Agent, and Tenant roles. Audit logs for full accountability and transparency.", image: "/images/landing/feature-security.jpg" },
];

function ContactGroup({ title, contacts, emptyMessage }: { title: string; contacts: { name: string; email: string; phone: string }[]; emptyMessage?: string }) {
  return (
    <section className="border-t border-slate-200 pt-3 first:border-0 first:pt-0">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {contacts.length ? contacts.map((contact, index) => (
        <div key={`${contact.name}-${index}`} className="mt-2 rounded-lg bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-900">{contact.name}</p>
          {contact.email && <a href={`mailto:${contact.email}`} className="mt-1 block break-all text-xs text-blue-700 hover:underline">{contact.email}</a>}
          {contact.phone && <a href={`tel:${contact.phone}`} className="mt-1 block text-xs text-blue-700 hover:underline">{contact.phone}</a>}
          {!contact.email && !contact.phone && <p className="mt-1 text-xs text-slate-500">Use RentTrack support for contact.</p>}
        </div>
      )) : <p className="mt-2 text-xs text-slate-500">{emptyMessage || "No public contact details available."}</p>}
    </section>
  );
}

export default function LandingPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyCountsReady, setPropertyCountsReady] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [agents, setAgents] = useState<PublicAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsUnavailable, setAgentsUnavailable] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openNavDropdown, setOpenNavDropdown] = useState<string | null>(null);
  const [mobileRentalOpen, setMobileRentalOpen] = useState(false);
  const [contactPeople, setContactPeople] = useState<{ admins: { name: string; email: string; phone: string }[]; owners: { name: string; email: string; phone: string }[] } | null>(null);
  const [contactLoading, setContactLoading] = useState(true);
  const [contactError, setContactError] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("");
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");
  const [bedroomFilter, setBedroomFilter] = useState("");
  const [bathroomFilter, setBathroomFilter] = useState("");
  const [furnishingFilter, setFurnishingFilter] = useState("");
  const [showApplicationSuccess, setShowApplicationSuccess] = useState(false);
  const [applicationConfirmationEmailSent, setApplicationConfirmationEmailSent] = useState(false);
  const [showAgentApplication, setShowAgentApplication] = useState(false);
  const [agentApplication, setAgentApplication] = useState({ name: "", email: "", phone: "", address: "", gender: "", birthdate: "" });
  const [agentResume, setAgentResume] = useState<File | null>(null);
  const [agentApplicationSending, setAgentApplicationSending] = useState(false);
  const [activeCategoryTab, setActiveCategoryTab] = useState<"all" | "properties" | "units">("all");
  const [showAllListings, setShowAllListings] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<any | null>(null);
  const [openDropdown, setOpenDropdown] = useState<"type" | "price" | null>(null);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [propRes, unitRes] = await Promise.all([
          fetch("/api/data/properties"),
          fetch("/api/data/units"),
        ]);
        const propData = await safeParseJson(propRes);
        const unitData = await safeParseJson(unitRes);
        console.log("Landing page properties:", propData);
        console.log("Landing page units:", unitData);
        setPropertyCountsReady(Boolean(propRes.ok && propData.success && !propData.degraded && Array.isArray(propData.properties)));
        if (propData.success && Array.isArray(propData.properties)) {
          setProperties(propData.properties);
        }
        if (unitData.success && unitData.units.length > 0) {
          setUnits(unitData.units);
        }
      } catch (err) {
        console.error("Landing page fetch error:", err);
      }
    })();
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch("/api/public/contacts", { cache: "no-store" })
      .then(async (response) => {
        const data = await safeParseJson(response);
        if (!response.ok || !data.success) throw new Error("Contact information is unavailable.");
        if (mounted) setContactPeople({ admins: data.admins || [], owners: data.owners || [] });
      })
      .catch((error) => { if (mounted) setContactError(error instanceof Error ? error.message : "Contact information is unavailable."); })
      .finally(() => { if (mounted) setContactLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!showAgentApplication) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowAgentApplication(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAgentApplication]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-nav-dropdown]")) {
        setOpenNavDropdown(null);
      }
      if (!target?.closest("[data-filter-dropdown]")) {
        setOpenDropdown(null);
      }
      if (!target?.closest("[data-more-filters-container]")) {
        setIsMoreFiltersOpen(false);
        setIsLocationDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClearAllFilters = () => {
    setSearchTerm("");
    setLocationFilter("");
    setPropertyTypeFilter("");
    setMinPriceFilter("");
    setMaxPriceFilter("");
    setBedroomFilter("");
    setBathroomFilter("");
    setFurnishingFilter("");
    setActiveCategoryTab("all");
    setOpenDropdown(null);
    setIsMoreFiltersOpen(false);
    setIsLocationDropdownOpen(false);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let response = await fetch("/api/agents", { cache: "no-store" });
        if (!response.ok) {
          response = await fetch("/api/auth/users/agents", { cache: "no-store" });
        }
        const data = await safeParseJson(response);
        if (!response.ok || !data.success || data.degraded || !Array.isArray(data.users)) {
          throw new Error("Agent information is temporarily unavailable.");
        }
        if (mounted) setAgents(data.users);
      } catch {
        if (mounted) setAgentsUnavailable(true);
      } finally {
        if (mounted) setAgentsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const locations = Array.from(new Set(properties
    .map((property: any) => property.location || property.city || property.province)
    .filter(Boolean)));
  const propertyTypes = Array.from(new Set(properties.map((property: any) => property.type).filter(Boolean)));
  const minPrice = minPriceFilter ? Number(minPriceFilter) : 0;
  const maxPrice = maxPriceFilter ? Number(maxPriceFilter) : Number.POSITIVE_INFINITY;
  const matchesRoomCount = (property: any, kind: "bedroom" | "bathroom", filter: string) => {
    if (!filter) return true;
    const directValue = Number(property?.[`${kind}s`]);
    const featureText = (Array.isArray(property?.features) ? property.features : [])
      .filter((feature: unknown): feature is string => typeof feature === "string")
      .join(" ");
    const match = featureText.match(new RegExp(`(\\d+)\\s*\\+?\\s*${kind}s?`, "i"));
    const count = Number.isFinite(directValue) && directValue > 0 ? directValue : match ? Number(match[1]) : null;
    if (count === null) return false;
    return filter === "4+" ? count >= 4 : count === Number(filter);
  };
  const matchesFurnishing = (property: any) => {
    if (!furnishingFilter) return true;
    return Array.isArray(property?.features) && property.features.some((feature: unknown) => {
      if (typeof feature !== "string") return false;
      const normalized = feature.toLowerCase().replace(/[-_]/g, " ").trim();
      return furnishingFilter === "Furnished"
        ? /^(fully\s+|semi\s+)?furnished\b/.test(normalized)
        : /^unfurnished\b/.test(normalized);
    });
  };

  const matchesPropertyTypeFilter = (rawType: any, isUnit = false) => {
    if (!propertyTypeFilter) return true;
    const filter = propertyTypeFilter.toLowerCase();
    const type = String(rawType || "").toLowerCase();
    if (filter === "properties") {
      return !isUnit;
    }
    if (filter === "units") {
      return isUnit;
    }
    if (filter === "house") {
      return !isUnit && (type === "house" || !type);
    }
    if (filter === "condominium") {
      return type === "condominium";
    }
    return type === filter;
  };

  const matchesPropertyFilters = (property: any, unit?: any) => {
    if (propertyTypeFilter === "units") return false;
    const propertyName = property?.name || "";
    const propertyLocation = property?.location || property?.city || property?.province || unit?.location || unit?.propertyLocation || "";
    const propertyType = property?.type || unit?.type || "";
    const propUnits = units.filter((u: any) => (u.propertyId || u.property_id) === property?.id);
    const rents = propUnits.map((u: any) => Number(u.rentAmount ?? u.rent_amount ?? 0)).filter(Boolean);
    const rentAmount = rents.length ? Math.min(...rents) : Number(unit?.rentAmount ?? unit?.rent_amount ?? property?.monthlyRevenue ?? property?.rentAmount ?? property?.monthlyRent ?? 0);
    const haystack = [propertyName, propertyLocation, property?.address, property?.city, property?.province, propertyType, unit?.unitNumber, unit?.unit_number, unit?.status]
      .filter(Boolean).join(" ").toLowerCase();
    return (!normalizedSearch || haystack.includes(normalizedSearch))
      && (!locationFilter || propertyLocation.toLowerCase().includes(locationFilter.toLowerCase()))
      && matchesPropertyTypeFilter(propertyType, false)
      && (minPrice === 0 || rentAmount >= minPrice)
      && rentAmount <= maxPrice
      && matchesRoomCount(property, "bedroom", bedroomFilter)
      && matchesRoomCount(property, "bathroom", bathroomFilter)
      && matchesFurnishing(property);
  };

  const matchesUnitFilters = (unit: any) => {
    if (propertyTypeFilter === "properties") return false;
    const parentProperty = properties.find((p) => p.id === (unit.propertyId || unit.property_id));
    const unitNumber = String(unit.unitNumber || unit.unit_number || "");
    const propertyName = parentProperty?.name || "";
    const unitLocation = unit.address || parentProperty?.location || parentProperty?.city || parentProperty?.province || "";
    const unitType = parentProperty?.type || unit.type || "";
    const rentAmount = Number(unit.rentAmount ?? unit.rent_amount ?? parentProperty?.rentAmount ?? parentProperty?.monthlyRent ?? 0);
    const haystack = [unitNumber, `unit ${unitNumber}`, propertyName, unitLocation, unit.address, unitType, unit.status, unit.floor ? `floor ${unit.floor}` : ""]
      .filter(Boolean).join(" ").toLowerCase();

    return (!normalizedSearch || haystack.includes(normalizedSearch))
      && (!locationFilter || unitLocation.toLowerCase().includes(locationFilter.toLowerCase()))
      && matchesPropertyTypeFilter(unitType, true)
      && (minPrice === 0 || rentAmount >= minPrice)
      && rentAmount <= maxPrice
      && matchesRoomCount(parentProperty, "bedroom", bedroomFilter)
      && matchesRoomCount(parentProperty, "bathroom", bathroomFilter)
      && matchesFurnishing(parentProperty);
  };

  const filteredProperties = properties.filter((property: any) => matchesPropertyFilters(property));
  const filteredUnits = units.filter((unit: any) => matchesUnitFilters(unit));

  type CombinedListing =
    | { kind: "property"; id: string; property: any }
    | { kind: "unit"; id: string; unit: any };

  const combinedListings: CombinedListing[] = [
    ...(propertyTypeFilter === "units" ? [] : filteredProperties.map((p) => ({ kind: "property" as const, id: `prop-${p.id}`, property: p }))),
    ...(propertyTypeFilter === "properties" ? [] : filteredUnits.map((u) => ({ kind: "unit" as const, id: `unit-${u.id}`, unit: u }))),
  ];

  const displayListings = showAllListings ? combinedListings : combinedListings.slice(0, 9);

  const scrollToSection = (e?: React.MouseEvent | React.UIEvent, targetId?: string) => {
    if (e && "preventDefault" in e) e.preventDefault();
    const id = targetId || "top";
    if (id === "/" || id === "top" || id === "#top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (window.location.hash) {
        window.history.pushState(null, "", window.location.pathname);
      }
      return;
    }

    const cleanId = id.replace(/^#/, "");
    const target = document.getElementById(cleanId);
    if (target) {
      const navOffset = 76;
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navOffset;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: "smooth",
      });
      window.history.pushState(null, "", `#${cleanId}`);
    }
  };

  const selectUnitType = (type: string) => {
    setPropertyTypeFilter(type);
    if (type === "properties") setActiveCategoryTab("properties");
    else if (type === "units") setActiveCategoryTab("units");
    else setActiveCategoryTab("all");
    setOpenNavDropdown(null);
    setMobileMenuOpen(false);
    window.requestAnimationFrame(() => {
      scrollToSection(undefined, "properties");
    });
  };

  const submitAgentApplication = async (event: React.FormEvent) => {
    event.preventDefault();
    if (agentApplicationSending) return;
    if (!agentResume) {
      toast.error("Please upload your resume (PDF or Word document)");
      return;
    }
    setAgentApplicationSending(true);
    try {
      const form = new FormData();
      Object.entries(agentApplication).forEach(([key, value]) => {
        if (value) form.append(key, value);
      });
      form.append("resume", agentResume);
      const response = await fetch("/api/agent-applications", { method: "POST", body: form });
      const result = await safeParseJson(response);
      if (!response.ok || !result.success) throw new Error(result.error || "Application failed");
      setShowAgentApplication(false);
      setAgentApplication({ name: "", email: "", phone: "", address: "", gender: "", birthdate: "" });
      setAgentResume(null);
      setApplicationConfirmationEmailSent(Boolean(result.confirmationEmailSent));
      setShowApplicationSuccess(true);
      toast[result.confirmationEmailSent ? "success" : "error"](result.confirmationEmailSent
        ? "Application submitted. A confirmation email was sent."
        : "Application submitted, but the confirmation email could not be sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Application failed");
    } finally {
      setAgentApplicationSending(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-900" suppressHydrationWarning>
      {/* â”€â”€â”€ Navigation â”€â”€â”€ */}
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-md transition-colors duration-300 hover:bg-white/90">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="relative flex h-16 items-center justify-between">
            <Link
              href="/"
              onClick={(e) => scrollToSection(e, "top")}
              className="nav-letter-animate flex items-center gap-2 transition-transform duration-300 hover:scale-[1.02]"
            >
              <div className="relative h-8 w-8">
                <Image src="/images/landing/logo.png" alt="RentTrack" width={32} height={32} className="h-full w-full rounded-full object-contain" />
              </div>
              <span className="text-lg font-bold text-slate-700 drop-shadow-sm">Rent<span className="text-slate-500">Track</span></span>
            </Link>

            <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-5 xl:flex lg:gap-7">
              <a
                href="/"
                onClick={(e) => scrollToSection(e, "top")}
                className="nav-link-letter text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-slate-950 cursor-pointer"
              >
                Home
              </a>
              {/* For Rent Dropdown */}
              <div className="relative" data-nav-dropdown>
                <button
                  type="button"
                  onClick={() => setOpenNavDropdown(openNavDropdown === "rental" ? null : "rental")}
                  onMouseEnter={() => setOpenNavDropdown("rental")}
                  className={cn(
                    "nav-link-letter inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-200 outline-none select-none cursor-pointer",
                    openNavDropdown === "rental" || propertyTypeFilter
                      ? "text-blue-600 font-semibold"
                      : "text-slate-600 hover:text-slate-950"
                  )}
                  aria-expanded={openNavDropdown === "rental"}
                  aria-haspopup="true"
                >
                  <span>For Rent</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-250",
                      openNavDropdown === "rental" && "rotate-180 text-blue-600"
                    )}
                  />
                </button>

                <AnimatePresence>
                  {openNavDropdown === "rental" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      onMouseLeave={() => setOpenNavDropdown(null)}
                      className="absolute left-1/2 top-full mt-2 w-64 -translate-x-1/2 rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-[0_16px_36px_rgba(15,23,42,0.12)] backdrop-blur-md z-50"
                    >
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        For Rent
                      </div>
                      <a
                        href="#properties"
                        onClick={() => {
                          selectUnitType("properties");
                          setOpenNavDropdown(null);
                        }}
                        className={cn(
                          "group flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-150",
                          propertyTypeFilter === "properties"
                            ? "bg-blue-50 text-blue-700 font-bold"
                            : "text-slate-700 hover:bg-slate-50 hover:text-blue-600"
                        )}
                      >
                        <div>
                          <div className="font-semibold text-slate-800 group-hover:text-blue-600">Properties</div>
                          <div className="text-[10px] font-normal text-slate-500">Houses & condominiums</div>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {filteredProperties.length}
                        </span>
                      </a>

                      <a
                        href="#properties"
                        onClick={() => {
                          selectUnitType("units");
                          setOpenNavDropdown(null);
                        }}
                        className={cn(
                          "group mt-1 flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-150",
                          propertyTypeFilter === "units"
                            ? "bg-indigo-50 text-indigo-700 font-bold"
                            : "text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                        )}
                      >
                        <div>
                          <div className="font-semibold text-slate-800 group-hover:text-indigo-600">Units</div>
                          <div className="text-[10px] font-normal text-slate-500">Individual unit listings</div>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {filteredUnits.length}
                        </span>
                      </a>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <a
                href="#destinations"
                onClick={(e) => scrollToSection(e, "destinations")}
                className="nav-link-letter text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-slate-950 cursor-pointer"
              >
                Destinations
              </a>
              <a
                href="#agents"
                onClick={(e) => scrollToSection(e, "agents")}
                className="nav-link-letter text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-slate-950 cursor-pointer"
              >
                Agents
              </a>
              <a
                href="#about"
                onClick={(e) => scrollToSection(e, "about")}
                className="nav-link-letter text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-slate-950 cursor-pointer"
              >
                About
              </a>
              <a
                href="#contact"
                onClick={(e) => scrollToSection(e, "contact")}
                className="nav-link-letter text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-slate-950 cursor-pointer"
              >
                Contact
              </a>
            </div>

            <div className="hidden items-center gap-2 xl:flex">
              <button type="button" onClick={() => setShowAgentApplication(true)} className="inline-flex h-9 items-center justify-center rounded-lg border border-white/35 bg-white/90 px-3 text-sm font-semibold text-blue-700 transition-all duration-200 hover:bg-white hover:shadow-md">
                <UserPlus className="mr-1.5 h-4 w-4" />Apply as Agent
              </button>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link href="/login?mode=signin" className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-md shadow-blue-950/20 transition-colors hover:bg-blue-500">
                  Sign In
                </Link>
              </motion.div>
            </div>

            <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-expanded={mobileMenuOpen} aria-controls="landing-mobile-navigation" aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"} className="rounded-lg p-2 text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 xl:hidden">
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div id="landing-mobile-navigation" className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-slate-200 bg-white xl:hidden">
            <a
              href="/"
              onClick={(e) => {
                scrollToSection(e, "top");
                setMobileMenuOpen(false);
                setMobileRentalOpen(false);
              }}
              className="block border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
            >
              Home
            </a>
            {/* Mobile For Rent Dropdown */}
            <div className="border-b border-slate-100">
              <button
                type="button"
                onClick={() => setMobileRentalOpen((prev) => !prev)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
              >
                <span>For Rent</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-slate-500 transition-transform duration-200",
                    mobileRentalOpen && "rotate-180 text-blue-600"
                  )}
                />
              </button>
              {mobileRentalOpen && (
                <div className="bg-slate-50/80 px-4 py-1.5 space-y-1 pb-2">
                  <a
                    href="#properties"
                    onClick={(e) => {
                      scrollToSection(e, "properties");
                      selectUnitType("properties");
                      setMobileMenuOpen(false);
                      setMobileRentalOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition cursor-pointer",
                      propertyTypeFilter === "properties" ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <span>Properties</span>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">{filteredProperties.length}</span>
                  </a>
                  <a
                    href="#properties"
                    onClick={(e) => {
                      scrollToSection(e, "properties");
                      selectUnitType("units");
                      setMobileMenuOpen(false);
                      setMobileRentalOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition cursor-pointer",
                      propertyTypeFilter === "units" ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <span>Units</span>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">{filteredUnits.length}</span>
                  </a>
                </div>
              )}
            </div>
            <a
              href="#destinations"
              onClick={(e) => {
                scrollToSection(e, "destinations");
                setMobileMenuOpen(false);
                setMobileRentalOpen(false);
              }}
              className="block border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
            >
              Destinations
            </a>
            <a
              href="#agents"
              onClick={(e) => {
                scrollToSection(e, "agents");
                setMobileMenuOpen(false);
                setMobileRentalOpen(false);
              }}
              className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" />
                <span>Agents</span>
              </div>
              {agents.length > 0 && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                  {agents.length}
                </span>
              )}
            </a>
            <button
              type="button"
              onClick={() => {
                setShowAgentApplication(true);
                setMobileMenuOpen(false);
                setMobileRentalOpen(false);
              }}
              className="flex min-h-11 w-full items-center gap-2 border-b border-slate-100 px-4 py-3 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
            >
              <UserPlus className="h-4 w-4" />Apply as Agent
            </button>
            <a
              href="#about"
              onClick={(e) => {
                scrollToSection(e, "about");
                setMobileMenuOpen(false);
                setMobileRentalOpen(false);
              }}
              className="block border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
            >
              About
            </a>
            <a
              href="#contact"
              onClick={(e) => {
                scrollToSection(e, "contact");
                setMobileMenuOpen(false);
                setMobileRentalOpen(false);
              }}
              className="block border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
            >
              Contact
            </a>
            <div className="px-4 py-3 space-y-2">
              <Link href="/login?mode=signin" className="block w-full rounded-lg bg-blue-600 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700">
                Sign In
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative flex min-h-115 items-center justify-center overflow-hidden sm:min-h-125 lg:min-h-[580px]">
        {/* Animated Background Container */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Ken Burns Zoom & Pan Animation */}
          <motion.div
            className="absolute inset-[-5%] h-[110%] w-[110%]"
            initial={{ scale: 1, x: 0, y: 0 }}
            animate={{
              scale: [1, 1.08, 1.03, 1.09, 1],
              x: ["0%", "1.5%", "-1%", "0.8%", "0%"],
              y: ["0%", "-1.2%", "0.8%", "-0.6%", "0%"],
            }}
            transition={{
              duration: 22,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            }}
          >
            <Image
              src="/images/favicon/Landing page and login page.png"
              alt="HedgeHomes Realty & Brokerage"
              fill
              priority
              quality={100}
              unoptimized
              sizes="100vw"
              className="object-cover object-center filter brightness-[0.95] contrast-[1.05]"
            />
          </motion.div>

          {/* Atmospheric Blue Light Glow */}
          <motion.div
            className="pointer-events-none absolute -left-1/4 -top-1/4 h-[150%] w-[150%] bg-[radial-gradient(ellipse_at_30%_20%,rgba(59,130,246,0.3),transparent_50%)]"
            animate={{
              opacity: [0.35, 0.7, 0.35],
              scale: [1, 1.06, 1],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Warm Golden Architectural Glow */}
          <motion.div
            className="pointer-events-none absolute -bottom-1/3 -right-1/4 h-[140%] w-[140%] bg-[radial-gradient(ellipse_at_75%_75%,rgba(245,158,11,0.22),transparent_45%)]"
            animate={{
              opacity: [0.25, 0.6, 0.25],
              scale: [1.05, 1, 1.05],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Floating Ambient Light Particles */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full bg-white/30 shadow-[0_0_8px_rgba(255,255,255,0.6)] backdrop-blur-xs"
                style={{
                  width: 3 + (i % 3) * 2,
                  height: 3 + (i % 3) * 2,
                  left: `${10 + i * 11}%`,
                  top: `${20 + (i % 5) * 14}%`,
                }}
                animate={{
                  y: [0, -32, 0],
                  x: [0, i % 2 === 0 ? 14 : -14, 0],
                  opacity: [0.15, 0.85, 0.15],
                  scale: [0.8, 1.5, 0.8],
                }}
                transition={{
                  duration: 6 + (i % 4) * 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.7,
                }}
              />
            ))}
          </div>

          {/* Cinematic Diagonal Light Flare Sweep */}
          <motion.div
            className="pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
            animate={{
              x: ["-200%", "250%"],
            }}
            transition={{
              duration: 11,
              repeat: Infinity,
              repeatDelay: 5,
              ease: "easeInOut",
            }}
          />

          {/* Gradient Vignette for Depth & High Typography Contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-black/35 to-black/55" />
          <div className="absolute inset-0 bg-radial-[circle_at_center,transparent_35%,rgba(0,0,0,0.5)_100%]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.15 }}
          className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-center px-4 py-12 text-center sm:px-6 lg:px-8"
        >
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.55, delay: 0.25 }}
              className="mb-5 inline-flex items-center gap-2 rounded-lg border border-blue-200/30 bg-blue-500/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-50 backdrop-blur-md"
            >
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.45, delay: 0.25, ease: "easeOut" }}
              >
                <Home className="h-3.5 w-3.5" />
              </motion.div>
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.35, ease: "easeOut" }}
              >
                HedgeHomes Realty & Brokerage
              </motion.span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.35 }}
              className="mb-4 max-w-xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl"
            >
              <span className="inline-block">Rental Property Marketplace</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.45 }}
              className="mb-7 max-w-xl text-base leading-7 text-blue-50 sm:text-lg"
            >
              Explore rental listings and connect with local property experts.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55 }}
              className="inline-flex flex-col items-center gap-4"
            >
              <motion.a
                href="#properties"
                className="relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl bg-white px-7 text-sm font-semibold text-blue-700 shadow-xl shadow-black/20 transition-all hover:bg-blue-50"
                whileHover={{ scale: 1.04, boxShadow: "0 20px 30px -10px rgba(0,0,0,0.3)" }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.span
                  className="absolute inset-0 bg-linear-to-r from-blue-200/40 to-transparent"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
                <span className="relative z-10 inline-flex items-center gap-2">
                  Browse Properties
                  <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                    <ChevronRight className="h-4 w-4" />
                  </motion.div>
                </span>
              </motion.a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.7 }}
              className="hidden"
            >
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                  <motion.path d="M 60 90 Q 120 20 200 50" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeDasharray="8 5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, delay: 1, repeat: Infinity, repeatType: "reverse" }} />
                  <motion.path d="M 200 50 Q 260 90 340 80" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeDasharray="8 5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, delay: 1.3, repeat: Infinity, repeatType: "reverse" }} />
                  <motion.path d="M 60 90 Q 100 140 160 120" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeDasharray="8 5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, delay: 1.6, repeat: Infinity, repeatType: "reverse" }} />
                </svg>
                {[
                  { name: "Cebu", x: "15%", y: "60%", delay: 0.9 },
                  { name: "Butuan", x: "40%", y: "28%", delay: 1.1 },
                  { name: "Davao", x: "68%", y: "72%", delay: 1.3 },
                  { name: "Manila", x: "85%", y: "36%", delay: 1.5 },
                ].map((city) => (
                  <motion.div
                    key={city.name}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: city.delay }}
                    className="absolute"
                    style={{ left: city.x, top: city.y, transform: "translate(-50%, -50%)" }}
                  >
                    <motion.div animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }} className="absolute rounded-full bg-blue-400/60" style={{ width: 44, height: 44, marginLeft: -22, marginTop: -22 }} />
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} className="relative flex flex-col items-center">
                      <div className="h-4 w-4 rounded-full bg-blue-400 shadow-lg shadow-blue-500/60 ring-2 ring-white/30" />
                      <span className="mt-1.5 whitespace-nowrap text-xs font-bold text-white drop-shadow-md sm:text-sm">{city.name}</span>
                    </motion.div>
                  </motion.div>
                ))}
              </div>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="mt-3 text-xs font-medium text-white/70 sm:text-sm">
                Our service areas: Cebu • Manila • Butuan • Davao
              </motion.p>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Properties for Rent */}
      <motion.section id="properties" className="bg-white py-12 sm:py-14 scroll-mt-20" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-600">Explore RentTrack</p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Featured Properties &amp; Units</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">Browse rental properties and units managed by owners and agents.</p>
            </div>
            <a href="#contact" onClick={(e) => scrollToSection(e, "contact")} className="text-sm font-semibold text-blue-600 transition-colors hover:text-blue-800 cursor-pointer">Need help finding a place? <span aria-hidden="true">→</span></a>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative z-40 mb-8 rounded-[28px] border border-slate-200 bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)] hover:shadow-[0_14px_32px_rgba(37,99,235,0.08)] transition-shadow duration-300"
          >
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
              <label className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-full border border-slate-200 px-4 xl:min-w-75">
                <MapPin className="h-5 w-5 shrink-0 text-blue-600" />
                <span className="sr-only">Search by address or location</span>
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Enter an address, street, barangay, city or province" className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" />
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
              </label>
              <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
                <span className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-800"><Home className="h-4 w-4 text-blue-600" />For Rent</span>
                {/* ─── Property Type Custom Dropdown ─── */}
                <div className="relative" data-filter-dropdown="type">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setOpenDropdown(openDropdown === "type" ? null : "type");
                      setIsMoreFiltersOpen(false);
                    }}
                    className={cn(
                      "relative flex h-12 min-w-38 items-center justify-between gap-2 rounded-full border px-4 text-sm font-medium transition-all duration-200 outline-none select-none",
                      openDropdown === "type"
                        ? "border-blue-500 bg-blue-50/50 text-blue-900 ring-4 ring-blue-500/15 shadow-sm"
                        : propertyTypeFilter
                          ? "border-blue-400 bg-blue-50/30 text-blue-900 font-semibold"
                          : "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate">
                        {propertyTypeFilter === "properties"
                          ? "Properties"
                          : propertyTypeFilter === "units"
                            ? "Units"
                            : "Any Type"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {propertyTypeFilter && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white shadow-xs">
                          1
                        </span>
                      )}
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-slate-500 transition-transform duration-250 ease-out",
                          openDropdown === "type" && "rotate-180 text-blue-600"
                        )}
                      />
                    </div>
                  </motion.button>

                  <AnimatePresence>
                    {openDropdown === "type" && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute left-0 top-[calc(100%+8px)] min-w-54 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-[0_16px_36px_rgba(15,23,42,0.14)] backdrop-blur-md z-50"
                      >
                        {[
                          { label: "Any Type", value: "", count: filteredProperties.length + filteredUnits.length },
                          { label: "Properties", value: "properties", count: filteredProperties.length },
                          { label: "Units", value: "units", count: filteredUnits.length },
                        ].map((item) => {
                          const isSelected = propertyTypeFilter === item.value;
                          return (
                            <motion.button
                              key={item.label}
                              type="button"
                              whileHover={{ x: 3, backgroundColor: isSelected ? "rgba(239, 246, 255, 1)" : "rgba(241, 245, 249, 0.85)" }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                setPropertyTypeFilter(item.value);
                                if (item.value === "properties") setActiveCategoryTab("properties");
                                else if (item.value === "units") setActiveCategoryTab("units");
                                else setActiveCategoryTab("all");
                                setOpenDropdown(null);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-colors text-left",
                                isSelected
                                  ? "bg-blue-50 text-blue-700 font-bold"
                                  : "text-slate-700"
                              )}
                            >
                              <span>{item.label}</span>
                              <span className="text-[11px] font-normal text-slate-400">({item.count})</span>
                            </motion.button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ─── Price Range Custom Dropdown ─── */}
                <div className="relative" data-filter-dropdown="price">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setOpenDropdown(openDropdown === "price" ? null : "price");
                      setIsMoreFiltersOpen(false);
                    }}
                    className={cn(
                      "relative flex h-12 min-w-42 items-center justify-between gap-2 rounded-full border px-4 text-sm font-medium transition-all duration-200 outline-none select-none",
                      openDropdown === "price"
                        ? "border-blue-500 bg-blue-50/50 text-blue-900 ring-4 ring-blue-500/15 shadow-sm"
                        : (minPriceFilter || maxPriceFilter)
                          ? "border-blue-400 bg-blue-50/30 text-blue-900 font-semibold"
                          : "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate">
                        {!minPriceFilter && !maxPriceFilter
                          ? "Price Range"
                          : !minPriceFilter && maxPriceFilter === "10000"
                            ? "Under ₱10,000"
                            : minPriceFilter === "5000" && maxPriceFilter === "20000"
                              ? "₱5,000–₱20,000"
                              : minPriceFilter === "10000" && maxPriceFilter === "50000"
                                ? "₱10,000–₱50,000"
                                : `₱${Number(minPriceFilter || 0).toLocaleString()} - ₱${Number(maxPriceFilter || 0).toLocaleString()}`}
                      </span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-slate-500 transition-transform duration-250 ease-out shrink-0",
                        openDropdown === "price" && "rotate-180 text-blue-600"
                      )}
                    />
                  </motion.button>

                  <AnimatePresence>
                    {openDropdown === "price" && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute left-0 top-[calc(100%+8px)] min-w-56 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-[0_16px_36px_rgba(15,23,42,0.14)] backdrop-blur-md z-50"
                      >
                        {[
                          { label: "Price Range (Any)", min: "", max: "" },
                          { label: "Under ₱10,000", min: "", max: "10000" },
                          { label: "₱5,000 – ₱20,000", min: "5000", max: "20000" },
                          { label: "₱10,000 – ₱50,000", min: "10000", max: "50000" },
                        ].map((item) => {
                          const isSelected = minPriceFilter === item.min && maxPriceFilter === item.max;
                          return (
                            <motion.button
                              key={item.label}
                              type="button"
                              whileHover={{ x: 3, backgroundColor: isSelected ? "rgba(239, 246, 255, 1)" : "rgba(241, 245, 249, 0.85)" }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                setMinPriceFilter(item.min);
                                setMaxPriceFilter(item.max);
                                setOpenDropdown(null);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-colors text-left",
                                isSelected
                                  ? "bg-blue-50 text-blue-700 font-bold"
                                  : "text-slate-700"
                              )}
                            >
                              <span>{item.label}</span>
                            </motion.button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ─── More Filters Custom Popover ─── */}
                <div className="relative z-50" data-more-filters-container>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setIsMoreFiltersOpen(!isMoreFiltersOpen);
                      setOpenDropdown(null);
                    }}
                    className={cn(
                      "inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all duration-200 outline-none select-none",
                      isMoreFiltersOpen
                        ? "border-blue-500 bg-blue-50/50 text-blue-900 ring-4 ring-blue-500/15 shadow-sm"
                        : (bedroomFilter || bathroomFilter || furnishingFilter || locationFilter)
                          ? "border-blue-400 bg-blue-50/30 text-blue-900 font-semibold"
                          : "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50"
                    )}
                  >
                    <span>More Filters</span>
                    {(bedroomFilter || bathroomFilter || furnishingFilter || locationFilter) && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white shadow-xs">
                        {[bedroomFilter, bathroomFilter, furnishingFilter, locationFilter].filter(Boolean).length}
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-slate-500 transition-transform duration-250 ease-out",
                        isMoreFiltersOpen && "rotate-180 text-blue-600"
                      )}
                    />
                  </motion.button>

                  <AnimatePresence>
                    {isMoreFiltersOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="more-filter-panel absolute right-0 top-[calc(100%+8px)] w-[min(680px,calc(100vw-2rem))] rounded-3xl border border-slate-200/90 bg-white/98 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.18)] backdrop-blur-xl z-50"
                      >
                        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                          <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Filter Preferences</div>
                          {(bedroomFilter || bathroomFilter || furnishingFilter || locationFilter) && (
                            <button
                              type="button"
                              onClick={() => {
                                setBedroomFilter("");
                                setBathroomFilter("");
                                setFurnishingFilter("");
                                setLocationFilter("");
                              }}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                            >
                              Reset filters
                            </button>
                          )}
                        </div>

                        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <label className="text-xs font-medium text-slate-600">Bedrooms</label>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {['Any', '1', '2', '3', '4+'].map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  aria-pressed={option === "Any" ? !bedroomFilter : bedroomFilter === option}
                                  onClick={() => setBedroomFilter(option === "Any" || bedroomFilter === option ? "" : option)}
                                  className={cn(
                                    "flex h-9 min-w-9 items-center justify-center rounded-xl border px-2 text-xs font-semibold transition-all duration-150",
                                    ((option === 'Any' && !bedroomFilter) || bedroomFilter === option)
                                      ? "border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-600/20"
                                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
                                  )}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-slate-600">Bathrooms</label>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {['Any', '1', '2', '3', '4+'].map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  aria-pressed={option === "Any" ? !bathroomFilter : bathroomFilter === option}
                                  onClick={() => setBathroomFilter(option === "Any" || bathroomFilter === option ? "" : option)}
                                  className={cn(
                                    "flex h-9 min-w-9 items-center justify-center rounded-xl border px-2 text-xs font-semibold transition-all duration-150",
                                    ((option === 'Any' && !bathroomFilter) || bathroomFilter === option)
                                      ? "border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-600/20"
                                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
                                  )}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-slate-600">Furnishing</label>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {['Furnished', 'Unfurnished'].map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  aria-pressed={furnishingFilter === option}
                                  onClick={() => setFurnishingFilter(furnishingFilter === option ? "" : option)}
                                  className={cn(
                                    "rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-150",
                                    furnishingFilter === option
                                      ? "border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-600/20"
                                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
                                  )}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-slate-600">Location</label>
                            <div className="relative mt-2">
                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
                                className={cn(
                                  "flex h-11 w-full items-center justify-between rounded-xl border px-3 text-xs font-medium transition-all duration-200 outline-none select-none",
                                  isLocationDropdownOpen
                                    ? "border-blue-500 bg-blue-50/40 text-blue-900 ring-2 ring-blue-500/20"
                                    : locationFilter
                                      ? "border-blue-400 bg-blue-50/20 text-blue-900 font-semibold"
                                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                                )}
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="truncate">{locationFilter || "Any location"}</span>
                                </div>
                                <ChevronDown
                                  className={cn(
                                    "h-3.5 w-3.5 text-slate-500 transition-transform duration-200 shrink-0",
                                    isLocationDropdownOpen && "rotate-180 text-blue-600"
                                  )}
                                />
                              </motion.button>

                              <AnimatePresence>
                                {isLocationDropdownOpen && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                                    transition={{ duration: 0.15, ease: "easeOut" }}
                                    className="absolute left-0 top-[calc(100%+4px)] max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200/90 bg-white p-1 shadow-xl z-60"
                                  >
                                    <motion.button
                                      type="button"
                                      whileHover={{ x: 2, backgroundColor: "rgba(241, 245, 249, 0.9)" }}
                                      onClick={() => {
                                        setLocationFilter("");
                                        setIsLocationDropdownOpen(false);
                                      }}
                                      className={cn(
                                        "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition text-left",
                                        !locationFilter ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-700"
                                      )}
                                    >
                                      <span>Any location</span>
                                    </motion.button>
                                    {locations.map((loc) => {
                                      const isSelected = locationFilter === loc;
                                      return (
                                        <motion.button
                                          key={loc}
                                          type="button"
                                          whileHover={{ x: 2, backgroundColor: "rgba(241, 245, 249, 0.9)" }}
                                          onClick={() => {
                                            setLocationFilter(loc);
                                            setIsLocationDropdownOpen(false);
                                          }}
                                          className={cn(
                                            "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition text-left",
                                            isSelected ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-700"
                                          )}
                                        >
                                          <span className="truncate">{loc}</span>
                                        </motion.button>
                                      );
                                    })}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
                          <span>Showing {filteredProperties.length} {filteredProperties.length === 1 ? "property" : "properties"} and {filteredUnits.length} {filteredUnits.length === 1 ? "unit" : "units"}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsMoreFiltersOpen(false);
                              setIsLocationDropdownOpen(false);
                            }}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                          >
                            Done
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ─── Clear Filters Button ─── */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleClearAllFilters}
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-medium text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
                >
                  <span aria-hidden="true" className="text-base leading-none">↻</span>
                  <span>Clear filters</span>
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Active filter summary pill bar (subtle) */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <p className="text-xs font-medium text-slate-500">
              Showing {Math.min(displayListings.length, combinedListings.length)} of {combinedListings.length} total available listings
            </p>
            {propertyTypeFilter && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <span>{propertyTypeFilter === "properties" ? "Properties only" : "Units only"}</span>
                <button
                  type="button"
                  onClick={() => setPropertyTypeFilter("")}
                  className="rounded-full p-0.5 hover:bg-blue-200/60 transition"
                  title="Remove filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>

          {combinedListings.length === 0 ? (
            <div className="text-center py-14 bg-slate-50/80 rounded-2xl border border-slate-200">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Building2 className="h-6 w-6" />
              </div>
              <h4 className="text-base font-semibold text-slate-900">No properties or units match your current filters</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">Try resetting the keyword search, price range, or location filter.</p>
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {displayListings.map((item, i) => {
                  if (item.kind === "property") {
                    const property = item.property;
                    const location = property.location || "Cebu, Manila, Butuan, Davao";
                    const propertyType = property.type === "condominium" ? "Condominium" : "Property";
                    const propertyUnits = units.filter((unit: any) => (unit.propertyId || unit.property_id) === property.id);
                    const ownerPropertyImages = (
                      Array.isArray(property.imageUrls) && property.imageUrls.length > 0
                        ? property.imageUrls
                        : property.imageUrl
                          ? [property.imageUrl]
                          : property.image_url
                            ? [property.image_url]
                            : []
                    ).filter((image: any): image is string => typeof image === "string" && image.trim().length > 0);
                    const fallbackUnitImages = propertyUnits
                      .flatMap((unit: any) => Array.isArray(unit.imageUrls) && unit.imageUrls.length > 0 ? unit.imageUrls : unit.imageUrl ? [unit.imageUrl] : unit.image_url ? [unit.image_url] : [])
                      .filter((image: any): image is string => typeof image === "string" && image.trim().length > 0);
                    const propertyImages = ownerPropertyImages.length > 0
                      ? ownerPropertyImages
                      : fallbackUnitImages.length > 0
                        ? fallbackUnitImages
                        : [unitImages[i % unitImages.length]];
                    const img = propertyImages[0] || property.imageUrl || property.image_url || unitImages[i % unitImages.length];
                    const rents = propertyUnits.map((unit: any) => Number(unit.rentAmount ?? unit.rent_amount ?? 0)).filter(Boolean);
                    const price = rents.length ? Math.min(...rents) : Number(property.monthlyRevenue || property.monthly_revenue || property.rentAmount || property.rent_amount || 0);
                    const isAvailable = propertyUnits.length === 0 || propertyUnits.some((unit: any) => (unit.status || "vacant") === "vacant");
                    const bedrooms = (property.features || []).find((feature: string) => /bedroom/i.test(feature)) || "Bedrooms";
                    const bathrooms = (property.features || []).find((feature: string) => /bathroom/i.test(feature)) || "Bathrooms";

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: (i % 6) * 0.08 }}
                        whileHover={{ y: -6 }}
                        className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_18px_42px_rgba(37,99,235,0.14)]"
                      >
                        <div className="relative h-60 overflow-hidden bg-slate-100">
                          <motion.div className="relative h-full w-full" whileHover={{ scale: 1.04 }} transition={{ duration: 0.45, ease: "easeOut" }}>
                            <UnitImageCarousel images={propertyImages} fallbackImage={img} alt={property.name} className="h-full w-full" imageClassName="object-cover" />
                          </motion.div>
                          <div className="pointer-events-none absolute left-4 top-4 flex max-w-[calc(100%-2rem)] items-center gap-1.5 rounded-[10px] bg-slate-900/85 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur-sm">
                            <Building2 className="h-4 w-4 text-blue-400 shrink-0" />
                            <span className="truncate">Property</span>
                          </div>
                          <div className="pointer-events-none absolute right-4 top-4 rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-sm backdrop-blur-sm">
                            {propertyType}
                          </div>
                        </div>

                        <div className="relative p-5">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-2xl font-bold tracking-tight text-slate-950">
                              ₱{price.toLocaleString()}<span className="ml-1 text-sm font-medium text-slate-500">/mo</span>
                            </p>
                            <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide", isAvailable ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-amber-50 text-amber-700 border border-amber-200")}>
                              {isAvailable ? "Available" : "Occupied"}
                            </span>
                          </div>

                          <h3 className="mt-2 text-lg font-semibold leading-snug text-slate-950 transition-colors group-hover:text-blue-700 truncate">
                            {property.name} <span className="font-normal text-slate-500">— {propertyType}</span>
                          </h3>

                          <p className="mb-4 mt-2 flex items-start gap-1 text-sm leading-5 text-slate-600">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                            <span className="truncate">{location}</span>
                          </p>

                          <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
                            <span className="flex items-center gap-2 text-sm text-slate-700">
                              <BedDouble className="h-4 w-4 text-blue-600" />{bedrooms}
                              <Bath className="ml-2 h-4 w-4 text-blue-600" />{bathrooms}
                            </span>
                            <motion.button whileHover={{ x: 4 }} onClick={() => setSelectedProperty(property)} className="font-semibold text-blue-600 transition-colors hover:text-blue-800 flex items-center gap-1">
                              View Details <ArrowRight className="h-3.5 w-3.5" />
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  }

                  const unit = item.unit;
                  const parentProperty = properties.find((p) => p.id === (unit.propertyId || unit.property_id));
                  const location = unit.address || parentProperty?.location || parentProperty?.city || parentProperty?.province || "Cebu, Manila, Butuan, Davao";
                  const unitOwnerImages = (
                    Array.isArray(unit.imageUrls) && unit.imageUrls.length > 0
                      ? unit.imageUrls
                      : unit.imageUrl
                        ? [unit.imageUrl]
                        : unit.image_url
                          ? [unit.image_url]
                          : []
                  ).filter((img: any): img is string => typeof img === "string" && img.trim().length > 0);
                  const parentPropertyImages = (
                    Array.isArray(parentProperty?.imageUrls) && parentProperty.imageUrls.length > 0
                      ? parentProperty.imageUrls
                      : parentProperty?.imageUrl
                        ? [parentProperty.imageUrl]
                        : parentProperty?.image_url
                          ? [parentProperty.image_url]
                          : []
                  ).filter((img: any): img is string => typeof img === "string" && img.trim().length > 0);
                  const unitImagesList = unitOwnerImages.length > 0
                    ? unitOwnerImages
                    : parentPropertyImages.length > 0
                      ? parentPropertyImages
                      : [unitImages[i % unitImages.length]];
                  const fallbackImg = unitImagesList[0] || unit.imageUrl || unit.image_url || unitImages[i % unitImages.length];
                  const rent = Number(unit.rentAmount ?? unit.rent_amount ?? parentProperty?.rentAmount ?? 0);
                  const isAvailable = (unit.status || "vacant").toLowerCase() === "vacant";
                  const floorLabel = unit.floor ? `Floor ${unit.floor}` : null;
                  const propName = parentProperty?.name || "Independent Unit";
                  const bedrooms = (parentProperty?.features || []).find((feature: string) => /bedroom/i.test(feature));

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: (i % 6) * 0.08 }}
                      whileHover={{ y: -6 }}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-[0_18px_42px_rgba(99,102,241,0.14)]"
                    >
                      <div className="relative h-60 overflow-hidden bg-slate-100">
                        <motion.div className="relative h-full w-full" whileHover={{ scale: 1.04 }} transition={{ duration: 0.45, ease: "easeOut" }}>
                          <UnitImageCarousel images={unitImagesList} fallbackImage={fallbackImg} alt={`Unit ${unit.unitNumber}`} className="h-full w-full" imageClassName="object-cover" />
                        </motion.div>
                        <div className="pointer-events-none absolute left-4 top-4 flex max-w-[calc(100%-2rem)] items-center gap-1.5 rounded-[10px] bg-slate-900/85 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur-sm">
                          <DoorOpen className="h-4 w-4 text-indigo-400 shrink-0" />
                          <span className="truncate">{String(unit.unitNumber || "").toLowerCase().startsWith("unit") ? unit.unitNumber : `Unit ${unit.unitNumber}`}</span>
                        </div>
                        {floorLabel && (
                          <div className="pointer-events-none absolute right-4 top-4 rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-sm backdrop-blur-sm">
                            {floorLabel}
                          </div>
                        )}
                      </div>

                      <div className="relative p-5">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-2xl font-bold tracking-tight text-slate-950">
                            ₱{rent.toLocaleString()}<span className="ml-1 text-sm font-medium text-slate-500">/mo</span>
                          </p>
                          <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide", isAvailable ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200")}>
                            {isAvailable ? "Available" : "Occupied"}
                          </span>
                        </div>

                        <h4 className="mt-2 text-lg font-semibold leading-snug text-slate-950 transition-colors group-hover:text-indigo-700 truncate">
                          {String(unit.unitNumber || "").toLowerCase().startsWith("unit") ? unit.unitNumber : `Unit ${unit.unitNumber}`} <span className="font-normal text-slate-500">— {propName}</span>
                        </h4>

                        <div className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                          <Building2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                          <span className="truncate">{propName}</span>
                        </div>

                        <p className="mb-4 mt-1.5 flex items-start gap-1 text-sm leading-5 text-slate-600">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600" />
                          <span className="truncate">{location}</span>
                        </p>

                        <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
                          <span className="flex items-center gap-2 text-sm text-slate-700">
                            {floorLabel && <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{floorLabel}</span>}
                            {bedrooms && <span className="flex items-center gap-1 text-xs text-slate-600"><BedDouble className="h-3.5 w-3.5 text-indigo-600" />{bedrooms}</span>}
                          </span>
                          <motion.button whileHover={{ x: 4 }} onClick={() => setSelectedUnit(unit)} className="font-semibold text-indigo-600 transition-colors hover:text-indigo-800 flex items-center gap-1">
                            View Details <ArrowRight className="h-3.5 w-3.5" />
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {combinedListings.length > 9 && (
                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={() => setShowAllListings(!showAllListings)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all shadow-xs"
                  >
                    {showAllListings ? "Show Fewer Listings" : `View All ${combinedListings.length} Listings`}
                    <ChevronRight className={cn("h-4 w-4 transition-transform", showAllListings ? "-rotate-90" : "rotate-90")} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.section>

      {/* ─── Most Popular Destinations ─── */}
      <motion.section id="destinations" className="py-16 bg-white scroll-mt-20" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-600 mb-4 shadow-2xs">
              <motion.span animate={{ rotate: [0, 15, -10, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}>
                <Star className="h-4 w-4 fill-blue-600 text-blue-600" />
              </motion.span>
              Destinations
            </span>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight sm:text-4xl">Most Popular Destinations</h2>
            <p className="mt-3 text-gray-600 max-w-2xl mx-auto text-sm sm:text-base">Explore rental properties in the Philippines&apos; most sought-after locations</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 24 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease: "easeOut" }}
            className="relative mx-auto h-88 w-full max-w-5xl overflow-hidden rounded-2xl border border-gray-200 bg-slate-100 shadow-xl shadow-blue-950/10 sm:h-112 lg:h-128"
          >
            <DestinationsMap />
          </motion.div>
        </div>
      </motion.section>

      {/* Agent showcase */}
      <motion.section
        id="agents"
        aria-labelledby="featured-agents-title"
        className="relative overflow-hidden bg-white py-16 text-slate-900 sm:py-20 scroll-mt-20"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="relative mx-auto max-w-[1660px] px-4 sm:px-6 lg:px-10">
          <div className="mb-9 flex flex-col gap-5 sm:mb-11 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                <span aria-hidden="true" className="h-px w-8 bg-blue-600" />
                People behind the homes
              </p>
              <h2 id="featured-agents-title" className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
                Meet your local <span className="text-blue-700">experts</span>
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                Connect with owner-managed agents who can help you find a place to call home.
              </p>
            </div>
            <Link href="/agents" className="inline-flex w-fit items-center gap-2 border-b border-blue-600/60 pb-1 text-sm font-semibold text-blue-700 transition hover:border-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4">
              View all agents <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>

          {agentsLoading ? (
            <div role="status" className="flex min-h-56 items-center justify-center border border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-600">
              Loading local agents… <span className="sr-only">Please wait.</span>
            </div>
          ) : agentsUnavailable ? (
            <div role="alert" className="flex min-h-56 flex-col items-center justify-center border border-amber-200 bg-amber-50/60 px-6 text-center">
              <p className="text-base font-semibold text-slate-900">Agent profiles are temporarily unavailable</p>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">We couldn’t reach the agent directory just now. Please visit the directory again shortly.</p>
              <Link href="/agents" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                Open agent directory <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          ) : agents.length === 0 ? (
            <div role="status" className="flex min-h-56 flex-col items-center justify-center border border-slate-200 bg-slate-50 px-6 text-center">
              <p className="text-base font-semibold text-slate-900">No owner-managed agents are listed yet</p>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">Check back soon to meet the people helping renters find their next home.</p>
            </div>
          ) : (
            <AgentCarousel label="Local agents">
              {agents.map((agent) => (
                <PublicAgentCard
                  key={agent.id}
                  agent={agent}
                  variant="compact"
                />
              ))}
            </AgentCarousel>
          )}
        </div>
      </motion.section>

      {/* ─── Features ─── */}
      <motion.section id="about" className="bg-gray-50/80 py-16 sm:py-20 scroll-mt-20" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-12 text-center"
          >
            <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-600 shadow-2xs">
              <Shield className="h-4 w-4" />Features
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Everything You Need to Manage Rentals</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-600 sm:text-base">Powerful tools for property owners, agents, and tenants</p>
          </motion.div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: "easeOut" }}
                whileHover={{ y: -8 }}
                className="group overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-xs transition-all duration-300 hover:border-blue-200 hover:shadow-[0_20px_40px_-15px_rgba(37,99,235,0.18)]"
              >
                <div className="relative h-44 overflow-hidden bg-linear-to-br from-blue-100 to-indigo-100">
                  <motion.div
                    whileHover={{ scale: 1.07 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="relative h-full w-full"
                  >
                    <Image src={feature.image} alt={feature.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </motion.div>
                </div>
                <div className="p-5">
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <motion.div
                      whileHover={{ scale: 1.15, rotate: 8 }}
                      transition={{ type: "spring", stiffness: 300, damping: 15 }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white"
                    >
                      <feature.icon className="h-4.5 w-4.5" />
                    </motion.div>
                    <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{feature.title}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-gray-600">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ─── Contact ─── */}
      <motion.section id="contact" className="py-16 sm:py-20 bg-white scroll-mt-20" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-600 mb-4 shadow-2xs">
              <Mail className="h-4 w-4" />Contact Us
            </span>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight sm:text-4xl">Get in Touch</h2>
            <p className="mt-3 text-gray-600 max-w-2xl mx-auto text-sm sm:text-base">Have questions about RentTrack? Our team is ready to help.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: MapPin, title: "Location", desc: "Supporting renters and property owners across the Philippines." },
              { icon: Mail, title: "Email", desc: contactPeople?.admins.find((contact) => contact.email)?.email || "Contact details currently unavailable." },
              { icon: Phone, title: "Support", desc: contactPeople?.admins.find((contact) => contact.phone)?.phone || "Send us a message and our team will get back to you." },
            ].map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -6, scale: 1.02 }}
                className="group p-8 text-center bg-gray-50/70 rounded-2xl border border-slate-200/80 transition-all duration-300 hover:bg-white hover:border-blue-200 hover:shadow-lg"
              >
                <motion.div
                  whileHover={{ scale: 1.15, rotate: 6 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-2xs group-hover:bg-blue-600 group-hover:text-white transition-colors"
                >
                  <item.icon className="h-6 w-6" />
                </motion.div>
                <h3 className="text-lg font-semibold mb-3 text-gray-900">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-slate-200 bg-slate-50/80 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-5">
              <Link href="/" onClick={(e) => scrollToSection(e, "top")} className="flex items-center gap-2 mb-2.5 cursor-pointer">
                <div className="relative h-8 w-8">
                  <Image src="/images/landing/logo.png" alt="RentTrack" width={32} height={32} className="h-full w-full rounded-full object-contain" />
                </div>
                <span className="text-base font-bold text-gray-900">Rent<span className="text-blue-600">Track</span></span>
              </Link>
              <p className="max-w-sm text-xs leading-5 text-gray-600">
                HedgeHomes Realty and Brokerage, powered by RentTrack. Rental payment, receivables, and property monitoring for homes and condominiums.
              </p>
            </div>

            <div className="md:col-span-3 sm:pl-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-gray-900 mb-3">Quick Links</h4>
              <ul className="space-y-2">
                {navItems.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      onClick={(e) => scrollToSection(e, item.href)}
                      className="text-xs text-gray-600 hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-gray-900 mb-3">Contact</h4>
              {(() => {
                const owner = contactPeople?.owners?.[0];
                const email = owner?.email || "renttrackowner@gmail.com";
                const phone = owner?.phone || "09395158432";
                return (
                  <ul className="space-y-2 text-xs text-gray-600">
                    <li className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span>Philippines</span>
                    </li>
                    {email && (
                      <li className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <a href={`mailto:${email}`} className="hover:text-blue-600 transition-colors break-all">
                          {email}
                        </a>
                      </li>
                    )}
                    {phone && (
                      <li className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <a href={`tel:${phone}`} className="hover:text-blue-600 transition-colors">
                          {phone}
                        </a>
                      </li>
                    )}
                  </ul>
                );
              })()}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} RentTrack. All rights reserved.
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {selectedProperty && (
          <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setSelectedProperty(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="relative w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl max-h-[92vh]"
            >
              <div className="relative h-64 bg-gray-100 sm:h-80">
                {(() => {
                  const relatedUnits = units.filter((unit: any) => (unit.propertyId || unit.property_id) === selectedProperty.id);
                  const ownerPropertyImages = (
                    Array.isArray(selectedProperty.imageUrls) && selectedProperty.imageUrls.length > 0
                      ? selectedProperty.imageUrls
                      : selectedProperty.imageUrl
                        ? [selectedProperty.imageUrl]
                        : selectedProperty.image_url
                          ? [selectedProperty.image_url]
                          : []
                  ).filter((image: any): image is string => typeof image === "string" && image.trim().length > 0);
                  const fallbackUnitImages = relatedUnits
                    .flatMap((unit: any) => Array.isArray(unit.imageUrls) && unit.imageUrls.length > 0 ? unit.imageUrls : unit.imageUrl ? [unit.imageUrl] : unit.image_url ? [unit.image_url] : [])
                    .filter((image: any): image is string => typeof image === "string" && image.trim().length > 0);
                  const images = ownerPropertyImages.length > 0
                    ? ownerPropertyImages
                    : fallbackUnitImages.length > 0
                      ? fallbackUnitImages
                      : [];
                  return <UnitImageCarousel images={images} alt={selectedProperty.name || selectedProperty.unitNumber || "Property image"} className="h-full w-full" />;
                })()}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProperty(null);
                  }}
                  aria-label="Close property details"
                  className="absolute right-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 backdrop-blur-sm text-gray-700 shadow-lg hover:bg-white hover:text-gray-950 transition-all cursor-pointer pointer-events-auto"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-6 p-6 sm:p-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{selectedProperty.type || "Property"}</p>
                  <h3 className="mt-2 text-2xl font-semibold leading-tight text-gray-950">{selectedProperty.name || selectedProperty.unitNumber || "Property Details"}</h3>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-600"><MapPin className="h-4 w-4 shrink-0" />{selectedProperty.location || selectedProperty.propertyName || "Location not specified"}</p>
                </div>
                {(() => {
                  const selectedFeatures: string[] = Array.isArray(selectedProperty.features) ? selectedProperty.features : [];
                  const featureCards = selectedFeatures.map((feature: string) => {
                    const normalized = feature.toLowerCase();
                    const icon = normalized.includes("bedroom") ? BedDouble
                      : normalized.includes("bathroom") ? Bath
                        : normalized.includes("parking") || normalized.includes("car") ? Car
                          : normalized.includes("wi-fi") || normalized.includes("wifi") ? Wifi
                            : normalized.includes("air conditioning") ? Snowflake
                              : normalized.includes("furnished") ? Sofa
                                : normalized.includes("kitchen") ? Utensils
                                  : normalized.includes("laundry") ? WashingMachine
                                    : normalized.includes("outdoor") ? TreePine
                                      : normalized.includes("gated") ? LockKeyhole
                                        : normalized.includes("floor area") || normalized.includes("sqm") || normalized.includes("m²") ? Grid2X2
                                          : normalized.includes("lot area") ? Ruler
                                            : Home;
                    const label = normalized.includes("bedroom") ? "Bedrooms"
                      : normalized.includes("bathroom") ? "Bathrooms"
                        : normalized.includes("parking") || normalized.includes("car") ? "Car Parks"
                          : normalized.includes("wi-fi") || normalized.includes("wifi") ? "Wi-Fi"
                            : normalized.includes("air conditioning") ? "Air Conditioning"
                              : normalized.includes("furnished") ? "Furnished"
                                : normalized.includes("kitchen") ? "Kitchen"
                                  : normalized.includes("laundry") ? "Laundry Area"
                                    : normalized.includes("outdoor") ? "Outdoor Area"
                                      : normalized.includes("gated") ? "Gated Property"
                                        : feature.replace(/\d+/g, "").trim() || feature;
                    const numericValue = feature.match(/\d+(?:\.\d+)?/)?.[0];
                    const value = numericValue || (normalized.includes("parking") || normalized.includes("car") ? "1" : /^(yes|true)$/i.test(feature.trim()) ? "Yes" : feature.replace(/\d+/g, "").trim() === label ? "Yes" : feature.replace(new RegExp(label, "i"), "").trim() || "Yes");
                    return { feature, icon, label, value };
                  });
                  return featureCards.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {featureCards.map((featureCard: { feature: string; icon: React.ElementType; label: string; value: string }, index: number) => (
                        <div key={`${featureCard.feature}-${index}`} className="rounded-xl bg-gray-50 p-3 text-center sm:text-left">
                          <featureCard.icon className="mx-auto h-5 w-5 text-gray-950 sm:mx-0" />
                          <p className="mt-2 text-lg font-medium text-gray-950">{featureCard.value}</p>
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">{featureCard.label}</p>
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}
                <div className="grid grid-cols-2 gap-4 border-y border-gray-200 py-4">
                  <div><p className="text-xs font-medium text-gray-500">Availability</p><p className="mt-1 text-sm font-semibold text-emerald-700">{selectedProperty.availabilityStatus || "Available"}</p></div>
                  <div><p className="text-xs font-medium text-gray-500">Monthly Rent</p><p className="mt-1 text-lg font-bold text-gray-950">₱{(() => { const directRent = Number(selectedProperty.rentAmount || 0); if (directRent > 0) return directRent.toLocaleString(); const rents = units.filter((unit: any) => (unit.propertyId || unit.property_id) === selectedProperty.id).map((unit: any) => Number(unit.rentAmount ?? unit.rent_amount ?? 0)).filter((rent: number) => rent > 0); return (rents.length ? Math.min(...rents) : Number(selectedProperty.monthlyRevenue || 0)).toLocaleString(); })()}<span className="text-xs font-medium text-gray-500">/mo</span></p></div>
                </div>
                {selectedProperty.condition && <div><p className="text-xs font-medium text-gray-500">Condition</p><p className="mt-1 text-sm font-medium text-gray-950">{selectedProperty.condition}</p></div>}
                {selectedProperty.description && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Description</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{selectedProperty.description}</p>
                  </div>
                )}

                {/* Agents in this Location */}
                {(() => {
                  const propLocation = String(selectedProperty.location || selectedProperty.city || selectedProperty.province || "").toLowerCase().trim();
                  const propAgentId = selectedProperty.agentId || selectedProperty.agent_id;

                  // Regional boundaries to strictly prevent cross-city agent mismatches
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

                    // Strictly block agents from a different region (e.g. Butuan agent for Cebu property)
                    if (propRegion && agentRegion && propRegion.name !== agentRegion.name) {
                      return false;
                    }

                    // 1. Same regional match (e.g. both Cebu or both Butuan)
                    if (propRegion && agentRegion && propRegion.name === agentRegion.name) {
                      return true;
                    }

                    // 2. Direct location substring match
                    if (agentLoc && propLocation && (propLocation.includes(agentLoc) || agentLoc.includes(propLocation))) {
                      return true;
                    }

                    // 3. Legitimate direct assignment without conflict
                    if (propAgentId && agent.id === propAgentId && (!agentRegion || !propRegion || agentRegion.name === propRegion.name)) {
                      return true;
                    }

                    return false;
                  });

                  const sortedAgents = [...matched].sort((a, b) => {
                    const aAssigned = propAgentId && a.id === propAgentId ? 1 : 0;
                    const bAssigned = propAgentId && b.id === propAgentId ? 1 : 0;
                    return bAssigned - aAssigned;
                  });

                  return (
                    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/60 via-white to-slate-50/70 p-5 sm:p-6 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-blue-100/70 pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                            <Users className="h-4 w-4" />
                          </span>
                          <div>
                            <h4 className="text-base font-bold text-slate-900 leading-snug">
                              Agents in this Location
                            </h4>
                            <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3 text-blue-600 shrink-0" />
                              <span>{selectedProperty.location || "Local area"}</span>
                            </p>
                          </div>
                        </div>
                        {sortedAgents.length > 0 && (
                          <span className="self-start sm:self-auto rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                            {sortedAgents.length} {sortedAgents.length === 1 ? "Agent in location" : "Agents in location"}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 space-y-3">
                        {sortedAgents.length > 0 ? (
                          sortedAgents.map((agent) => {
                            const isAssigned = propAgentId && agent.id === propAgentId;
                            const initials = agent.name.trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join("").toUpperCase();

                            return (
                              <div
                                key={agent.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all hover:border-blue-300 hover:shadow-sm"
                              >
                                <div className="flex items-center gap-3.5 min-w-0">
                                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                                    {agent.avatarUrl ? (
                                      <Image
                                        src={agent.avatarUrl}
                                        alt={agent.name}
                                        fill
                                        unoptimized
                                        className="object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-blue-600 to-indigo-600 font-bold text-white text-sm">
                                        {initials || "AG"}
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h5 className="font-bold text-slate-900 text-sm sm:text-base leading-snug truncate">
                                        {agent.name}
                                      </h5>
                                      {isAssigned ? (
                                        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                          Assigned Agent
                                        </span>
                                      ) : (
                                        <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                                          Local Agent
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                                      <span className="flex items-center gap-1 text-slate-700 font-medium">
                                        <MapPin className="h-3 w-3 text-blue-600 shrink-0" />
                                        {agent.location || selectedProperty.location || "Philippines"}
                                      </span>
                                      {agent.experience && (
                                        <span className="text-slate-500">
                                          • {agent.experience}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                                  <Link
                                    href={`/agents/${encodeURIComponent(agent.id)}?propertyId=${encodeURIComponent(selectedProperty.id)}&propertyName=${encodeURIComponent(selectedProperty.name)}#message`}
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] transition-all"
                                  >
                                    <MessageCircle className="h-4 w-4" />
                                    <span>Inquire</span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </Link>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-white/80 p-5 text-center">
                            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                              <Users className="h-5 w-5" />
                            </div>
                            <p className="mt-2 text-sm font-semibold text-slate-800">
                              No agent assigned to {selectedProperty.location || "this location"} yet
                            </p>
                            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                              There are currently no registered agents handling this specific location. For inquiries, lease terms, and site viewing for {selectedProperty.name || "this property"}, you can contact the property owner directly.
                            </p>
                            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                              <Link
                                href="/agents"
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] transition-all"
                              >
                                <MessageCircle className="h-4 w-4" />
                                <span>Inquire with Agents</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="border-t border-gray-200 p-6 sm:px-8">
                <button onClick={() => setSelectedProperty(null)} className="h-11 w-full rounded-xl border border-gray-200 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">Close</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Unit Details Modal ─── */}
      <AnimatePresence>
        {selectedUnit && (
          <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setSelectedUnit(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="relative w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl max-h-[92vh]"
            >
              <div className="relative h-64 bg-gray-100 sm:h-80">
                {(() => {
                  const parentProperty = properties.find((p) => p.id === (selectedUnit.propertyId || selectedUnit.property_id));
                  const unitOwnerImages = (
                    Array.isArray(selectedUnit.imageUrls) && selectedUnit.imageUrls.length > 0
                      ? selectedUnit.imageUrls
                      : selectedUnit.imageUrl
                        ? [selectedUnit.imageUrl]
                        : selectedUnit.image_url
                          ? [selectedUnit.image_url]
                          : []
                  ).filter((img: any): img is string => typeof img === "string" && img.trim().length > 0);
                  const parentPropertyImages = (
                    Array.isArray(parentProperty?.imageUrls) && parentProperty.imageUrls.length > 0
                      ? parentProperty.imageUrls
                      : parentProperty?.imageUrl
                        ? [parentProperty.imageUrl]
                        : parentProperty?.image_url
                          ? [parentProperty.image_url]
                          : []
                  ).filter((img: any): img is string => typeof img === "string" && img.trim().length > 0);
                  const images = unitOwnerImages.length > 0
                    ? unitOwnerImages
                    : parentPropertyImages.length > 0
                      ? parentPropertyImages
                      : [];
                  return <UnitImageCarousel images={images} alt={`Unit ${selectedUnit.unitNumber}`} className="h-full w-full" />;
                })()}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedUnit(null);
                  }}
                  aria-label="Close unit details"
                  className="absolute right-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 backdrop-blur-sm text-gray-700 shadow-lg hover:bg-white hover:text-gray-950 transition-all cursor-pointer pointer-events-auto"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-6 p-6 sm:p-8">
                {(() => {
                  const parentProperty = properties.find((p) => p.id === (selectedUnit.propertyId || selectedUnit.property_id));
                  const rent = Number(selectedUnit.rentAmount ?? selectedUnit.rent_amount ?? parentProperty?.rentAmount ?? 0);
                  const isAvailable = (selectedUnit.status || "vacant").toLowerCase() === "vacant";
                  const location = selectedUnit.address || parentProperty?.location || parentProperty?.city || parentProperty?.province || "Location not specified";

                  return (
                    <>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-indigo-700">
                            <DoorOpen className="h-3.5 w-3.5" /> Unit {selectedUnit.unitNumber}
                          </span>
                          {parentProperty && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                              <Building2 className="h-3 w-3 text-slate-500" /> {parentProperty.name}
                            </span>
                          )}
                          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide", isAvailable ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200")}>
                            {isAvailable ? "Available for Rent" : "Currently Occupied"}
                          </span>
                        </div>
                        <h3 className="mt-2 text-2xl font-bold leading-tight text-gray-950">
                          Unit {selectedUnit.unitNumber} {parentProperty ? `— ${parentProperty.name}` : ""}
                        </h3>
                        <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-600">
                          <MapPin className="h-4 w-4 shrink-0 text-blue-600" />{location}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-y border-gray-200 py-4">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Monthly Rent</p>
                          <p className="mt-1 text-lg font-bold text-slate-900">₱{rent.toLocaleString()}<span className="text-xs font-normal text-slate-500">/mo</span></p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Floor Level</p>
                          <p className="mt-1 text-lg font-bold text-slate-900">{selectedUnit.floor ? `Floor ${selectedUnit.floor}` : "Ground Floor"}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</p>
                          <p className="mt-1 text-lg font-bold text-emerald-700">{isAvailable ? "Available" : "Occupied"}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Type</p>
                          <p className="mt-1 text-lg font-bold text-slate-900 capitalize">{parentProperty?.type || "Unit"}</p>
                        </div>
                      </div>

                      {parentProperty?.features && Array.isArray(parentProperty.features) && parentProperty.features.length > 0 && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Amenities & Building Features</p>
                          <div className="flex flex-wrap gap-2">
                            {parentProperty.features.map((feature: string, idx: number) => (
                              <span key={idx} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Matched Agents for Inquiry */}
                      {(() => {
                        const propLocation = String(location).toLowerCase().trim();
                        const propAgentId = parentProperty?.agentId || parentProperty?.agent_id;

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

                        const sortedAgents = [...matched].sort((a, b) => {
                          const aAssigned = propAgentId && a.id === propAgentId ? 1 : 0;
                          const bAssigned = propAgentId && b.id === propAgentId ? 1 : 0;
                          return bAssigned - aAssigned;
                        });

                        return (
                          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-slate-50/70 p-5 sm:p-6 shadow-xs">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-indigo-100/70 pb-3">
                              <div className="flex items-center gap-2.5">
                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                                  <Users className="h-4 w-4" />
                                </span>
                                <div>
                                  <h4 className="text-base font-bold text-slate-900 leading-snug">
                                    Inquire for Unit {selectedUnit.unitNumber}
                                  </h4>
                                  <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                                    <MapPin className="h-3 w-3 text-indigo-600 shrink-0" />
                                    <span>{location}</span>
                                  </p>
                                </div>
                              </div>
                              {sortedAgents.length > 0 && (
                                <span className="self-start sm:self-auto rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                                  {sortedAgents.length} {sortedAgents.length === 1 ? "Agent available" : "Agents available"}
                                </span>
                              )}
                            </div>

                            <div className="mt-4 space-y-3">
                              {sortedAgents.length > 0 ? (
                                sortedAgents.map((agent) => {
                                  const isAssigned = propAgentId && agent.id === propAgentId;
                                  const initials = agent.name.trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join("").toUpperCase();

                                  return (
                                    <div
                                      key={agent.id}
                                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all hover:border-indigo-300 hover:shadow-sm"
                                    >
                                      <div className="flex items-center gap-3.5 min-w-0">
                                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                                          {agent.avatarUrl ? (
                                            <Image
                                              src={agent.avatarUrl}
                                              alt={agent.name}
                                              fill
                                              unoptimized
                                              className="object-cover"
                                            />
                                          ) : (
                                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-indigo-600 to-blue-600 font-bold text-white text-sm">
                                              {initials || "AG"}
                                            </div>
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <h5 className="font-bold text-slate-900 text-sm sm:text-base leading-snug truncate">
                                              {agent.name}
                                            </h5>
                                            {isAssigned ? (
                                              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                                Assigned Agent
                                              </span>
                                            ) : (
                                              <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                                                Local Agent
                                              </span>
                                            )}
                                          </div>
                                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                                            <span className="flex items-center gap-1 text-slate-700 font-medium">
                                              <MapPin className="h-3 w-3 text-indigo-600 shrink-0" />
                                              {agent.location || location || "Philippines"}
                                            </span>
                                            {agent.experience && (
                                              <span className="text-slate-500">
                                                • {agent.experience}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                                        <Link
                                          href={`/agents/${encodeURIComponent(agent.id)}?propertyId=${encodeURIComponent(parentProperty?.id || "")}&propertyName=${encodeURIComponent(parentProperty?.name || `Unit ${selectedUnit.unitNumber}`)}#message`}
                                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 active:scale-[0.98] transition-all"
                                        >
                                          <MessageCircle className="h-4 w-4" />
                                          <span>Inquire for Unit</span>
                                          <ArrowRight className="h-3.5 w-3.5" />
                                        </Link>
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="rounded-xl border border-dashed border-slate-200 bg-white/80 p-5 text-center">
                                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                    <Users className="h-5 w-5" />
                                  </div>
                                  <p className="mt-2 text-sm font-semibold text-slate-800">
                                    Inquire with our registered agents
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                                    Browse available agents to schedule a visit or ask questions about Unit {selectedUnit.unitNumber}.
                                  </p>
                                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                                    <Link
                                      href="/agents"
                                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 active:scale-[0.98] transition-all"
                                    >
                                      <MessageCircle className="h-4 w-4" />
                                      <span>Find an Agent</span>
                                      <ArrowRight className="h-3.5 w-3.5" />
                                    </Link>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}
              </div>

              <div className="flex items-center gap-3 border-t border-gray-200 p-6 sm:px-8 bg-slate-50/50">
                {(() => {
                  const parentProperty = properties.find((p) => p.id === (selectedUnit.propertyId || selectedUnit.property_id));
                  if (!parentProperty) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        const prop = parentProperty;
                        setSelectedUnit(null);
                        setSelectedProperty(prop);
                      }}
                      className="h-11 flex-1 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      View Full Property ({parentProperty.name})
                    </button>
                  );
                })()}
                <button
                  type="button"
                  onClick={() => setSelectedUnit(null)}
                  className="h-11 flex-1 rounded-xl bg-slate-900 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showApplicationSuccess && (
          <div className="fixed inset-0 z-99999 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="application-success-title">
            <motion.button
              type="button"
              aria-label="Close application submitted dialog"
              className="absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowApplicationSuccess(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white p-7 text-center shadow-2xl"
            >
              <div className="absolute inset-x-0 top-0 h-1.5 bg-linear-to-r from-blue-500 via-indigo-500 to-cyan-400" />
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                </svg>
              </div>
              <h2 id="application-success-title" className="text-xl font-bold text-slate-900">Application submitted!</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Your application is now pending review. {applicationConfirmationEmailSent ? "A confirmation was sent to your email, and we will email you when a decision has been made." : "We could not send a confirmation email, but your application was received."}</p>
              <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setShowApplicationSuccess(false)} className="h-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Done</button>
                <button type="button" onClick={() => { setShowApplicationSuccess(false); document.getElementById("properties")?.scrollIntoView({ behavior: "smooth" }); }} className="h-11 rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">Browse rentals</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAgentApplication && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs cursor-pointer" onClick={() => setShowAgentApplication(false)} />
            <motion.form
              onSubmit={submitAgentApplication}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="agent-application-title"
              className="relative w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200 cursor-default p-4 sm:p-7 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAgentApplication(false);
                }}
                className="absolute right-3.5 top-3.5 sm:right-5 sm:top-5 z-20 h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                aria-label="Close application modal"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              {/* Brokerage Brand Header */}
              <div className="pr-8">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold tracking-wide uppercase bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                    <Building2 className="h-3.5 w-3.5 text-blue-600" />
                    HedgeHomes Realty & Brokerage
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    <ShieldCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-600" />
                    Accredited Network
                  </span>
                </div>
                <h2 id="agent-application-title" className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Apply as a Real Estate Agent
                </h2>
              </div>

              {/* Requirements & Qualification Checklist Box */}
              <div className="mt-4 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-indigo-50/30 p-3.5 sm:p-4 shadow-2xs">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs sm:text-sm">
                    <Award className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>Agent Accreditation Requirements</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
                    Qualifications
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                  <div className="flex items-start gap-2 bg-white/90 p-2 sm:p-2.5 rounded-lg border border-blue-50 shadow-2xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-900 text-xs">PRC / RES Accreditation</p>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">Licensed Broker, PRC Salesperson, or open to brokerage accreditation.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 bg-white/90 p-2 sm:p-2.5 rounded-lg border border-blue-50 shadow-2xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-900 text-xs">Valid Government ID</p>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">PRC ID, Driver&apos;s License, Passport, or UMID.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 bg-white/90 p-2 sm:p-2.5 rounded-lg border border-blue-50 shadow-2xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-900 text-xs">Resume / CV</p>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">Updated CV highlighting real estate or sales experience.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 bg-white/90 p-2 sm:p-2.5 rounded-lg border border-blue-50 shadow-2xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-900 text-xs">Service Coverage</p>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">Active in Cebu, Metro Manila, Davao, or Butuan.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Input Fields */}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    placeholder="e.g. Maria Santos"
                    value={agentApplication.name}
                    onChange={(e) => setAgentApplication({ ...agentApplication, name: e.target.value })}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50/40 px-3.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="email"
                    placeholder="e.g. maria.santos@gmail.com"
                    value={agentApplication.email}
                    onChange={(e) => setAgentApplication({ ...agentApplication, email: e.target.value })}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50/40 px-3.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Phone Number
                  </label>
                  <input
                    placeholder="e.g. 0917 123 4567"
                    value={agentApplication.phone}
                    onChange={(e) => setAgentApplication({ ...agentApplication, phone: e.target.value })}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50/40 px-3.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Service City <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={agentApplication.address}
                    onChange={(e) => setAgentApplication({ ...agentApplication, address: e.target.value })}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-xs sm:text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all cursor-pointer"
                  >
                    <option value="">Select Service City *</option>
                    <option value="Cebu">Cebu (Metro Cebu, Mandaue, Lapu-Lapu)</option>
                    <option value="Manila">Manila (Metro Manila, Makati, BGC, QC)</option>
                    <option value="Davao">Davao (Davao City, Tagum)</option>
                    <option value="Butuan">Butuan (Butuan City, Agusan)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gender
                  </label>
                  <select
                    value={agentApplication.gender}
                    onChange={(e) => setAgentApplication({ ...agentApplication, gender: e.target.value })}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-xs sm:text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all cursor-pointer"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Prefer not to say / Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={agentApplication.birthdate}
                    onChange={(e) => setAgentApplication({ ...agentApplication, birthdate: e.target.value })}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50/40 px-3.5 text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>

                {/* Custom File Upload Box for Resume */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Resume / CV (PDF or Word, max 5 MB) <span className="text-red-500">*</span>
                  </label>
                  <label
                    htmlFor="agent-resume-file"
                    className={`relative flex flex-col items-center justify-center p-3.5 sm:p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                      agentResume
                        ? "border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50/70"
                        : "border-slate-300 bg-slate-50/60 hover:bg-blue-50/50 hover:border-blue-400"
                    }`}
                  >
                    <input
                      id="agent-resume-file"
                      required
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => setAgentResume(e.target.files?.[0] || null)}
                      className="sr-only"
                    />
                    {agentResume ? (
                      <div className="flex items-center gap-3 w-full">
                        <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{agentResume.name}</p>
                          <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                            {(agentResume.size / (1024 * 1024)).toFixed(2)} MB • File attached and ready
                          </p>
                        </div>
                        <span className="text-xs font-bold text-blue-600 hover:text-blue-700 shrink-0 bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs">
                          Change
                        </span>
                      </div>
                    ) : (
                      <div className="text-center py-1">
                        <div className="mx-auto h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-1.5">
                          <UploadCloud className="h-5 w-5" />
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-slate-800">
                          Click to upload or drag &amp; drop your resume
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Accepted formats: PDF, DOC, or DOCX (max 5 MB)
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 space-y-2">
                <button
                  type="submit"
                  disabled={agentApplicationSending}
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-800 active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {agentApplicationSending ? (
                    <>
                      <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>Submitting Application to HedgeHomes...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>Submit Application to HedgeHomes</span>
                    </>
                  )}
                </button>
                <p className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5 pt-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span>Your submission is securely reviewed by HedgeHomes Realty &amp; Brokerage administration.</span>
                </p>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
      <details className="contact-disclosure group fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
        <summary aria-label="Show property owner contact" title="Property owner contact" className="relative flex h-14 w-14 cursor-pointer list-none items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_6px_18px_rgba(15,23,42,0.24)] ring-2 ring-white/80 transition-colors hover:bg-blue-700 [&::-webkit-details-marker]:hidden">
          <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/25 motion-reduce:animate-none" />
          <MessageCircle className="relative h-7 w-7" strokeWidth={2.4} />
          <Phone className="absolute h-3.5 w-3.5 rotate-[-35deg]" strokeWidth={2.7} />
        </summary>
        <aside aria-label="Property owner contact information" className="contact-popover absolute bottom-full right-0 mb-3 max-h-[70vh] w-[min(360px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">RentTrack contacts</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">Property Owner</h2>
          {contactLoading ? <p className="py-6 text-sm text-slate-500">Loading contacts...</p> : contactError ? <p role="alert" className="py-5 text-sm text-red-700">{contactError}</p> : contactPeople && (
            <div className="mt-4 space-y-4">
              <ContactGroup title="Property Owner" contacts={contactPeople.owners} emptyMessage="No owner contact details are public right now." />
            </div>
          )}
        </aside>
      </details>
    </main>
  );
}
