"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { Bell, Shield, MapPin, Home, Search, Menu, ChevronRight, ChevronDown, Star, Phone, Mail, MessageCircle, ArrowRight, CreditCard, BarChart3, Building2, Users, X, UserPlus, BedDouble, Bath, Car, Grid2X2, Ruler, Wifi, Snowflake, Sofa, Utensils, WashingMachine, TreePine, LockKeyhole, SlidersHorizontal, Sparkles, CheckCircle2 } from "lucide-react";
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
  avatarUrl?: string | null;
  createdAt?: string | null;
};

const navItems = [
  { label: "Home", href: "/" },
  { label: "Destinations", href: "#destinations" },
  { label: "Contact", href: "#contact" },
  { label: "About", href: "#about" },
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
    let mounted = true;
    fetch("/api/auth/users/agents", { cache: "no-store" })
      .then(async (response) => {
        const data = await safeParseJson(response);
        if (!response.ok || !data.success || data.degraded || !Array.isArray(data.users)) {
          throw new Error("Agent information is temporarily unavailable.");
        }
        if (mounted) setAgents(data.users);
      })
      .catch(() => { if (mounted) setAgentsUnavailable(true); })
      .finally(() => { if (mounted) setAgentsLoading(false); });
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
  const matchesPropertyFilters = (property: any, unit?: any) => {
    const propertyName = property?.name || "";
    const propertyLocation = property?.location || property?.city || property?.province || unit?.location || unit?.propertyLocation || "";
    const propertyType = property?.type || unit?.type || "";
    const rentAmount = Number(unit?.rentAmount ?? unit?.rent_amount ?? property?.rentAmount ?? property?.monthlyRent ?? 0);
    const haystack = [propertyName, propertyLocation, property?.address, property?.city, property?.province, propertyType, unit?.unitNumber, unit?.unit_number, unit?.status]
      .filter(Boolean).join(" ").toLowerCase();
    return (!normalizedSearch || haystack.includes(normalizedSearch))
      && (!locationFilter || propertyLocation === locationFilter)
      && (!propertyTypeFilter || propertyType === propertyTypeFilter)
      && rentAmount >= minPrice
      && rentAmount <= maxPrice
      && matchesRoomCount(property, "bedroom", bedroomFilter)
      && matchesRoomCount(property, "bathroom", bathroomFilter)
      && matchesFurnishing(property);
  };

  const filteredProperties = properties.filter((property: any) => matchesPropertyFilters(property));
  const displayProperties = filteredProperties.slice(0, 6);

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
            <Link href="/" className="nav-letter-animate flex items-center gap-2 transition-transform duration-300 hover:scale-[1.02]">
              <div className="relative h-8 w-8">
                   <Image src="/images/landing/logo.png" alt="RentTrack" width={32} height={32} className="h-full w-full rounded-full object-contain" />
              </div>
              <span className="text-lg font-bold text-slate-700 drop-shadow-sm">Rent<span className="text-slate-500">Track</span></span>
            </Link>

            <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-5 md:flex lg:gap-7">
              {navItems.map((item) => (
                <a key={item.label} href={item.href} className="nav-link-letter text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-slate-950">
                  {item.label}
                </a>
              ))}
              <div className="relative">
                <button type="button" onClick={() => setOpenNavDropdown(openNavDropdown === "properties" ? null : "properties")} aria-expanded={openNavDropdown === "properties"} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 transition-colors hover:text-slate-950">
                  Properties <ChevronDown className={`h-4 w-4 transition-transform ${openNavDropdown === "properties" ? "rotate-180" : ""}`} />
                </button>
                {openNavDropdown === "properties" && (
                  <div className="absolute left-0 top-full z-50 mt-3 min-w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    <a href="#properties" onClick={() => setOpenNavDropdown(null)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700">For Sale</a>
                    <a href="#properties" onClick={() => setOpenNavDropdown(null)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700">For Rent</a>
                    <a href="#destinations" onClick={() => setOpenNavDropdown(null)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700">Projects</a>
                  </div>
                )}
              </div>
              <Link href="/agents" className="nav-link-letter text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-slate-950">Agents</Link>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <button type="button" onClick={() => setShowAgentApplication(true)} className="inline-flex h-9 items-center justify-center rounded-lg border border-white/35 bg-white/90 px-3 text-sm font-semibold text-blue-700 transition-all duration-200 hover:bg-white hover:shadow-md">
                <UserPlus className="mr-1.5 h-4 w-4" />Apply as Agent
              </button>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link href="/login?mode=signin" className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-md shadow-blue-950/20 transition-colors hover:bg-blue-500">
                  Sign In
                </Link>
              </motion.div>
            </div>

            <Link href="/agents" className="mr-2 text-sm font-semibold text-slate-700 transition-colors hover:text-blue-700 md:hidden">Agents</Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="rounded-lg p-2 text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 md:hidden">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white md:hidden">
            <button type="button" onClick={() => setOpenNavDropdown(openNavDropdown === "properties" ? null : "properties")} className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left text-sm font-medium text-slate-700">
              Properties <ChevronDown className={`h-4 w-4 transition-transform ${openNavDropdown === "properties" ? "rotate-180" : ""}`} />
            </button>
            {openNavDropdown === "properties" && <div className="border-b border-slate-100 bg-slate-50 px-4 py-1"><a href="#properties" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm text-slate-600">For Sale</a><a href="#properties" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm text-slate-600">For Rent</a><a href="#destinations" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm text-slate-600">Projects</a></div>}
            <Link href="/agents" onClick={() => setMobileMenuOpen(false)} className="block border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700">Agents</Link>
            {navItems.map((item) => (
              <a key={item.label} href={item.href} onClick={() => setMobileMenuOpen(false)} className="block border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700">
                {item.label}
              </a>
            ))}
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
      <motion.section id="properties" className="bg-white py-12 sm:py-14" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-600">Explore RentTrack</p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Featured Properties</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">Browse rental properties managed by owners and agents.</p>
            </div>
            <a href="#contact" className="text-sm font-semibold text-blue-600 transition-colors hover:text-blue-800">Need help finding a place? <span aria-hidden="true">→</span></a>
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
                <label className="relative flex h-12 min-w-36.25 items-center rounded-full border border-slate-300 px-4">
                  <span className="sr-only">Property type</span>
                  <select value={propertyTypeFilter} onChange={(e) => setPropertyTypeFilter(e.target.value)} className="w-full appearance-none bg-transparent pr-6 text-sm font-medium text-slate-800 outline-none">
                    <option value="">Any Type</option>
                    {propertyTypes.map((type) => <option key={type} value={type}>{type === "condominium" ? "Condominium" : type === "house" ? "House" : type}</option>)}
                  </select>
                  {propertyTypeFilter && <span className="pointer-events-none absolute right-8 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">1</span>}
                  <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-700" />
                </label>
                <label className="relative flex h-12 min-w-38.75 items-center rounded-full border border-slate-300 px-4">
                  <span className="sr-only">Price range</span>
                  <select aria-label="Price range" value={`${minPriceFilter}:${maxPriceFilter}`} onChange={(e) => { const [min, max] = e.target.value.split(":"); setMinPriceFilter(min); setMaxPriceFilter(max); }} className="w-full appearance-none bg-transparent pr-6 text-sm font-medium text-slate-800 outline-none">
                    <option value=":">Price Range</option><option value=":10000">Under ₱10,000</option><option value="5000:20000">₱5,000–₱20,000</option><option value="10000:50000">₱10,000–₱50,000</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-700" />
                </label>
                <details className="group relative z-60">
                  <summary className="inline-flex h-12 cursor-pointer list-none items-center gap-2 rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                    <SlidersHorizontal className="h-4 w-4" />More Filters<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="more-filter-panel absolute right-0 top-full mt-2 w-[min(680px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                    <div className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">More filters</div>
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <label className="text-xs font-medium text-slate-600">Bedrooms</label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {['Any', '1', '2', '3', '4+'].map((option) => (
                            <button key={option} type="button" aria-pressed={option === "Any" ? !bedroomFilter : bedroomFilter === option} onClick={() => setBedroomFilter(option === "Any" || bedroomFilter === option ? "" : option)} className={`flex h-10 min-w-10 items-center justify-center rounded-full border px-2 text-sm font-semibold transition ${((option === 'Any' && !bedroomFilter) || bedroomFilter === option) ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'border-slate-300 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700'}`}>
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Bathrooms</label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {['Any', '1', '2', '3', '4+'].map((option) => (
                            <button key={option} type="button" aria-pressed={option === "Any" ? !bathroomFilter : bathroomFilter === option} onClick={() => setBathroomFilter(option === "Any" || bathroomFilter === option ? "" : option)} className={`flex h-10 min-w-10 items-center justify-center rounded-full border px-2 text-sm font-semibold transition ${((option === 'Any' && !bathroomFilter) || bathroomFilter === option) ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'border-slate-300 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700'}`}>
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Furnishing</label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {['Furnished', 'Unfurnished'].map((option) => (
                            <button key={option} type="button" aria-pressed={furnishingFilter === option} onClick={() => setFurnishingFilter(furnishingFilter === option ? "" : option)} className={`rounded-full border px-3 py-2 text-sm font-medium transition ${furnishingFilter === option ? "border-blue-500 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700"}`}>
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Location</label>
                        <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500">
                          <option value="">Any location</option>
                          {locations.map((location) => <option key={location} value={location}>{location}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
                      <span>Showing {filteredProperties.length} rental {filteredProperties.length === 1 ? "property" : "properties"}</span>
                      <button type="button" onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")} className="font-semibold text-blue-600 hover:text-blue-700">Done</button>
                    </div>
                  </div>
                </details>
                <button type="button" onClick={() => { setSearchTerm(""); setLocationFilter(""); setPropertyTypeFilter(""); setMinPriceFilter(""); setMaxPriceFilter(""); setBedroomFilter(""); setBathroomFilter(""); setFurnishingFilter(""); }} className="inline-flex h-12 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-medium text-slate-400 transition hover:border-slate-300 hover:text-slate-700"><span aria-hidden="true">↻</span>Clear filters</button>
              </div>
            </div>
          </motion.div>

          <div id="properties-results">
          {displayProperties.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Home className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900">No rental properties match right now</h3>
               <p className="text-sm text-gray-600 max-w-md mx-auto">Try adjusting your filters, or check back later for new listings.</p>
               <div className="mt-5">
                 <a href="#contact" className="inline-flex h-9 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg items-center justify-center gap-2 shadow-sm transition-colors">
                 Contact Us<ChevronRight className="ml-2 h-4 w-4" />
               </a>
               </div>
            </div>
          ) : (
            <div className="space-y-10">
              {displayProperties.length > 0 && (
                <div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {displayProperties.map((property: any, i: number) => {
                      const location = property.location || "Cebu, Manila, Butuan, Davao";
                      const propertyType = property.type === "condominium" ? "Condominium" : "House";
                      const propertyUnits = units.filter((unit: any) => (unit.propertyId || unit.property_id) === property.id);
                      const propertyImages = [
                        ...(Array.isArray(property.imageUrls) ? property.imageUrls : property.imageUrl ? [property.imageUrl] : []),
                        ...propertyUnits.flatMap((unit: any) => Array.isArray(unit.imageUrls) ? unit.imageUrls : unit.imageUrl ? [unit.imageUrl] : []),
                      ].filter((image, index, all) => Boolean(image) && all.indexOf(image) === index);
                      const img = propertyImages[0] || property.image_url || unitImages[i % unitImages.length];
                      const rents = propertyUnits.map((unit: any) => Number(unit.rentAmount ?? unit.rent_amount ?? 0)).filter(Boolean);
                      const price = rents.length ? Math.min(...rents) : Number(property.monthlyRevenue || 0);
                      const isAvailable = propertyUnits.length === 0 || propertyUnits.some((unit: any) => (unit.status || "vacant") === "vacant");
                      const bedrooms = (property.features || []).find((feature: string) => /bedroom/i.test(feature)) || "Bedrooms";
                      const bathrooms = (property.features || []).find((feature: string) => /bathroom/i.test(feature)) || "Bathrooms";
                      return (
                        <motion.div
                          key={property.id}
                          initial={{ opacity: 0, y: 24 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.5, delay: i * 0.09 }}
                          whileHover={{ y: -6 }}
                          className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_18px_42px_rgba(37,99,235,0.14)]"
                        >
                          <div className="relative h-60 overflow-hidden bg-slate-100">
                            <motion.div className="relative h-full w-full" whileHover={{ scale: 1.04 }} transition={{ duration: 0.45, ease: "easeOut" }}>
                              <UnitImageCarousel images={propertyImages} fallbackImage={img} alt={property.name} className="h-full w-full" imageClassName="object-cover" />
                            </motion.div>
                            <div className="absolute left-4 top-4 flex max-w-[calc(100%-2rem)] items-start gap-1 rounded-[10px] bg-slate-900/85 px-3 py-2 text-xs font-bold uppercase leading-snug tracking-wide text-white shadow-sm backdrop-blur-sm">
                              <motion.span
                                initial={{ scale: 0 }}
                                whileInView={{ scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.25, delay: i * 0.09 + 0.12 }}
                                className="truncate text-white"
                              >
                                <><MapPin className="mr-1 mt-0.5 inline h-4 w-4 shrink-0 text-white" />{location}</>
                              </motion.span>
                            </div>
                          </div>
                          <div className="relative p-5">
                            <p className="text-2xl font-bold tracking-tight text-slate-950">₱{price.toLocaleString()}<span className="ml-1 text-sm font-medium text-slate-500">/mo</span></p>
                            <h3 className="mt-2 text-lg font-semibold leading-snug text-slate-950 transition-colors group-hover:text-blue-700">{property.name} <span className="font-normal text-slate-500">— {propertyType} for Rent</span></h3>
                            <p className={cn("mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide", isAvailable ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700")}>{isAvailable ? "Available" : "Currently occupied"}</p>
                            <p className="mb-4 mt-3 flex items-start gap-1 text-sm leading-5 text-slate-700">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />{location}
                            </p>
                            <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
                              <span className="flex items-center gap-2 text-sm text-slate-700"><BedDouble className="h-4 w-4 text-blue-600" />{bedrooms} <Bath className="ml-2 h-4 w-4 text-blue-600" />{bathrooms}</span>
                              <motion.button whileHover={{ x: 4 }} onClick={() => setSelectedProperty(property)} className="font-semibold text-blue-600 transition-colors hover:text-blue-800">
                                View Details <span aria-hidden="true">→</span>
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </motion.section>

      {/* Agent showcase */}
      <motion.section
        aria-labelledby="featured-agents-title"
        className="relative overflow-hidden bg-white py-16 text-slate-900 sm:py-20"
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

      {/* ─── Most Popular Destinations ─── */}
      <motion.section id="destinations" className="py-16 bg-white" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
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

      {/* ─── Features ─── */}
      <motion.section id="about" className="bg-gray-50/80 py-16 sm:py-20" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
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
      <motion.section id="contact" className="py-16 sm:py-20 bg-white" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
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
      <footer className="border-t-4 border-amber-500 bg-amber-50/40 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="relative h-9 w-9">
                <Image src="/images/landing/logo.png" alt="RentTrack" width={36} height={36} className="h-full w-full rounded-full object-contain" />
                </div>
                <span className="text-lg font-bold text-gray-900">Rent<span className="text-blue-600">Track</span></span>
              </Link>
              <p className="max-w-md text-sm leading-6 text-gray-600">
                HedgeHomes Realty and Brokerage, powered by RentTrack. Rental payment, receivables, and property monitoring for homes and condominiums.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4 text-gray-900">Quick Links</h4>
              <ul className="space-y-3">
                {navItems.map((item) => (
                  <li key={item.label}>
                    <a href={item.href} className="text-sm text-gray-600 hover:text-blue-600 transition-colors">{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4 text-gray-900">Contact</h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-2 text-sm text-gray-600"><MapPin className="h-4 w-4 text-amber-700" /> Philippines</li>
                {contactPeople?.admins.find((contact) => contact.email)?.email && <li className="flex items-center gap-2 break-all text-sm text-gray-600"><Mail className="h-4 w-4 shrink-0 text-amber-700" /> {contactPeople.admins.find((contact) => contact.email)?.email}</li>}
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
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
                  const images = [
                    ...(Array.isArray(selectedProperty.imageUrls) ? selectedProperty.imageUrls : selectedProperty.imageUrl ? [selectedProperty.imageUrl] : []),
                    ...relatedUnits.flatMap((unit: any) => Array.isArray(unit.imageUrls) && unit.imageUrls.length > 0 ? unit.imageUrls : unit.imageUrl ? [unit.imageUrl] : []),
                  ].filter((image, index, all) => Boolean(image) && all.indexOf(image) === index);
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
              </div>
              <div className="border-t border-gray-200 p-6 sm:px-8">
                <button onClick={() => setSelectedProperty(null)} className="h-11 w-full rounded-xl border border-gray-200 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">Close</button>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 cursor-pointer" onClick={() => setShowAgentApplication(false)} />
            <motion.form onSubmit={submitAgentApplication} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl cursor-default" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAgentApplication(false);
                }}
                className="absolute right-4 top-4 z-50 p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors cursor-pointer pointer-events-auto"
                aria-label="Close application modal"
              >
                <X className="h-5 w-5" />
              </button>
              <h2 className="text-xl font-bold text-gray-900">Apply as an Agent</h2>
              <p className="mt-1 text-sm text-gray-500">Submit your information and resume for owner review.</p>
              <section className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <h3 className="text-sm font-semibold text-gray-900">Application Requirements</h3>
                <p className="mt-1 text-sm leading-6 text-gray-600">Please complete all required information and upload the necessary documents for your application to be reviewed.</p>
              </section>
              <section className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-gray-900">Application Details</h3>
                <div className="mt-3 grid grid-cols-1 gap-3 text-xs leading-5 text-gray-600 sm:grid-cols-2">
                  <p><span className="font-semibold text-gray-800">Application Date:</span> Recorded when your application is submitted.</p>
                  <p><span className="font-semibold text-gray-800">Application Status:</span> Tracks whether your application is pending, approved, or rejected.</p>
                  <p><span className="font-semibold text-gray-800">Applicant Information:</span> Includes the personal and contact details you provide.</p>
                  <p><span className="font-semibold text-gray-800">Resume:</span> Your uploaded PDF or Word document for owner review.</p>
                  <p className="sm:col-span-2"><span className="font-semibold text-gray-800">Review Notes:</span> Additional information recorded by the owner during the review process.</p>
                </div>
              </section>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input required placeholder="Full name *" value={agentApplication.name} onChange={(e) => setAgentApplication({ ...agentApplication, name: e.target.value })} className="h-11 rounded-lg border px-3 text-sm" />
                <input required type="email" placeholder="Email *" value={agentApplication.email} onChange={(e) => setAgentApplication({ ...agentApplication, email: e.target.value })} className="h-11 rounded-lg border px-3 text-sm" />
                <input placeholder="Phone" value={agentApplication.phone} onChange={(e) => setAgentApplication({ ...agentApplication, phone: e.target.value })} className="h-11 rounded-lg border px-3 text-sm" />
                <select required value={agentApplication.address} onChange={(e) => setAgentApplication({ ...agentApplication, address: e.target.value })} className="h-11 rounded-lg border bg-white px-3 text-sm">
                  <option value="">Select city *</option><option value="Cebu">Cebu</option><option value="Manila">Manila</option><option value="Davao">Davao</option><option value="Butuan">Butuan</option>
                </select>
                <select value={agentApplication.gender} onChange={(e) => setAgentApplication({ ...agentApplication, gender: e.target.value })} className="h-11 rounded-lg border bg-white px-3 text-sm"><option value="">Gender</option><option>Male</option><option>Female</option><option>Other</option></select>
                <input type="date" value={agentApplication.birthdate} onChange={(e) => setAgentApplication({ ...agentApplication, birthdate: e.target.value })} className="h-11 rounded-lg border px-3 text-sm" />
                <label className="sm:col-span-2"><span className="mb-1 block text-xs font-medium text-gray-600">Resume (PDF or Word, max 5 MB) *</span><input required type="file" accept=".pdf,.doc,.docx,application/pdf" onChange={(e) => setAgentResume(e.target.files?.[0] || null)} className="w-full rounded-lg border px-3 py-2 text-sm" /></label>
              </div>
              <button type="submit" disabled={agentApplicationSending} className="mt-5 h-11 w-full rounded-lg bg-blue-600 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{agentApplicationSending ? "Submitting..." : "Submit Application"}</button>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
      <details className="contact-disclosure group fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
        <summary aria-label="Show admin and owner contacts" title="Admin and owner contacts" className="relative flex h-14 w-14 cursor-pointer list-none items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_6px_18px_rgba(15,23,42,0.24)] ring-2 ring-white/80 transition-colors hover:bg-blue-700 [&::-webkit-details-marker]:hidden">
          <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/25 motion-reduce:animate-none" />
          <MessageCircle className="relative h-7 w-7" strokeWidth={2.4} />
          <Phone className="absolute h-3.5 w-3.5 rotate-[-35deg]" strokeWidth={2.7} />
        </summary>
        <aside aria-label="Admin and owner contact information" className="contact-popover absolute bottom-full right-0 mb-3 max-h-[70vh] w-[min(360px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">RentTrack contacts</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">Admin &amp; Owner</h2>
          {contactLoading ? <p className="py-6 text-sm text-slate-500">Loading contacts...</p> : contactError ? <p role="alert" className="py-5 text-sm text-red-700">{contactError}</p> : contactPeople && (
            <div className="mt-4 space-y-4">
              <ContactGroup title="Administrator" contacts={contactPeople.admins} />
              <ContactGroup title="Property owners" contacts={contactPeople.owners} emptyMessage="No owner contact details are public right now." />
            </div>
          )}
        </aside>
      </details>
    </main>
  );
}
