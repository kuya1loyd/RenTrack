"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  FileText,
  MapPin,
  Search,
  UserRound,
  X,
} from "lucide-react";
import PublicAgentCard from "@/components/public-agent-card";
import agentCardStyles from "@/components/public-agent-card.module.css";
import { safeParseJson } from "@/lib/data";

type Agent = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  experience?: string;
  location?: string;
  avatarUrl?: string | null;
  createdAt?: string | null;
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [listingCounts, setListingCounts] = useState<Record<string, number> | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let response = await fetch("/api/agents");
        if (!response.ok) response = await fetch("/api/auth/users/agents");
        const data = await safeParseJson(response);
        if (!response.ok || !data.success) throw new Error("Unable to load agents");
        if (mounted) setAgents(Array.isArray(data.users) ? data.users : []);
      } catch {
        if (mounted) setLoadError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    fetch("/api/data/properties")
      .then(async (response) => {
        const data = await safeParseJson(response);
        if (!response.ok || !data.success || data.degraded || !Array.isArray(data.properties)) return;
        const counts: Record<string, number> = {};
        for (const property of data.properties) {
          if (typeof property.agentId === "string") counts[property.agentId] = (counts[property.agentId] || 0) + 1;
        }
        if (mounted) setListingCounts(counts);
      })
      .catch(() => { /* Agent profiles remain available when listing counts cannot load. */ });
    return () => { mounted = false; };
  }, []);

  const locations = Array.from(new Set(agents.map((agent) => agent.location?.trim()).filter((value): value is string => Boolean(value))))
    .sort((first, second) => first.localeCompare(second));
  const query = search.trim().toLocaleLowerCase();
  const filteredAgents = agents
    .filter((agent) => (
      (!query || `${agent.name} ${agent.email} ${agent.experience || ""} ${agent.location || ""}`.toLocaleLowerCase().includes(query))
      && (!location || agent.location?.trim().toLocaleLowerCase() === location.toLocaleLowerCase())
    ));

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex min-h-[72px] max-w-[1660px] flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2 sm:min-h-[76px] sm:flex-nowrap sm:gap-4 sm:px-8 sm:py-0 lg:px-12">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link href="/" aria-label="RentTrack home" className="flex shrink-0 items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-800 focus-visible:ring-offset-2 sm:gap-4">
              <Image
                src="/images/brand/renttrack-apartment-flyer.png"
                alt="Apartment flyer logo for rentals"
                width={72}
                height={72}
                priority
                className="h-16 w-16 shrink-0 object-contain sm:h-[72px] sm:w-[72px]"
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-xl font-bold leading-tight tracking-[-0.035em] text-slate-950 sm:text-2xl">RentTrack</span>
                <span className="mt-1 text-[10px] font-medium leading-4 text-slate-500 sm:text-xs">Rental Management Network</span>
              </span>
            </Link>
          </div>
          <Link
            href="/"
            className="ml-auto inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 transition hover:border-amber-700 hover:bg-amber-50 hover:text-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-800 focus-visible:ring-offset-2 sm:gap-2 sm:px-4 sm:text-sm"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to rentals
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1660px] px-5 sm:px-8 lg:px-12">
        <motion.section
          aria-labelledby="agents-title"
          className="my-8 grid gap-10 rounded-2xl border border-slate-200 bg-white px-5 py-10 shadow-sm sm:my-10 sm:px-8 sm:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:px-10 lg:py-16"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <div>
            <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-900">
              <span aria-hidden="true" className="h-px w-8 bg-amber-700" />
              RentTrack network
            </p>
            <h1 id="agents-title" className="mt-5 max-w-2xl text-[2.75rem] font-semibold leading-[1.04] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-[68px]">
              Meet our <span className="text-amber-900">agents</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-[17px] sm:leading-8">
              Browse owner-managed agents and connect with the person who can help you find the right home.
            </p>
          </div>

          <form
            role="search"
            aria-label="Find an agent"
            onSubmit={(event) => event.preventDefault()}
            className="rounded-2xl border border-amber-100 bg-[#fffdfa] p-4 shadow-sm sm:p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Directory filters</p>
                <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-slate-950">Find an agent</h2>
              </div>
              <p aria-live="polite" className="inline-flex shrink-0 items-baseline gap-1.5 rounded-full border border-amber-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                <span className="text-lg font-bold leading-none tracking-tight text-amber-900">
                  {loading ? "…" : loadError ? "—" : filteredAgents.length}
                </span>
                <span>{loading || loadError ? "managers" : filteredAgents.length === 1 ? "manager" : "managers"}</span>
              </p>
            </div>
            <p id="agent-search-hint" className="mt-1 text-xs leading-5 text-slate-600">
              Search by name or refine the directory by location.
            </p>
            <div className="mt-3.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, email, or skill..."
                  className="h-9.5 w-full rounded-full border border-slate-300 bg-white pl-8.5 pr-7 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <label className="flex h-9.5 w-full sm:w-48 shrink-0 min-w-0 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 text-slate-500 shadow-2xs transition-all duration-200 hover:border-amber-500 hover:shadow-md hover:-translate-y-0.5 focus-within:border-amber-700 focus-within:ring-2 focus-within:ring-amber-100 cursor-pointer">
                <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-amber-800" />
                <span className="sr-only">Filter by location</span>
                <select
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  className="h-full w-full min-w-0 appearance-none bg-transparent pr-1 text-xs font-medium text-slate-700 outline-none cursor-pointer"
                >
                  <option value="">All locations</option>
                  {locations.map((agentLocation) => <option key={agentLocation} value={agentLocation}>{agentLocation}</option>)}
                </select>
                <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0 text-slate-400" />
              </label>
            </div>
          </form>
        </motion.section>

        <div className="flex min-h-[57px] flex-wrap items-center justify-between gap-3 border-y border-slate-200 py-3">
          <p className="text-sm font-semibold text-slate-800">Owner-managed agents</p>
          <p className="text-xs text-slate-500">Browse public Rent Manager profiles</p>
        </div>

        <section aria-label="Agent directory" className="pb-20 pt-8 sm:pt-10">
          {loading ? (
            <div role="status" className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <span className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-amber-50 text-amber-900">
                <Building2 aria-hidden="true" className="h-6 w-6" />
                <span aria-hidden="true" className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-amber-600 ring-4 ring-white motion-reduce:animate-none" />
              </span>
              <p className="mt-4 text-sm font-semibold text-slate-800">Finding your local network</p>
              <p className="mt-1 text-sm text-slate-500">Loading owner-managed agents…</p>
              <span className="sr-only">Loading agents</span>
            </div>
          ) : loadError ? (
            <div role="alert" className="mx-auto flex min-h-64 max-w-2xl flex-col items-center justify-center px-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-700"><MapPin aria-hidden="true" className="h-5 w-5" /></span>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">The directory is taking a break</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">Agents could not be loaded right now. Please try again later.</p>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div role="status" className="flex min-h-[310px] flex-col items-center justify-center px-5 py-12 text-center sm:min-h-[340px]">
              <div aria-hidden="true" className="relative flex h-[76px] w-[76px] items-center justify-center rounded-2xl bg-amber-50 text-amber-900">
                <FileText className="h-10 w-10 stroke-[1.5]" />
                <span className="absolute -bottom-2 -right-3 flex h-9 w-9 items-center justify-center rounded-full border-4 border-white bg-amber-800 text-white">
                  <UserRound className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-7 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-900 sm:text-[11px]">
                <span aria-hidden="true" className="h-px w-7 bg-amber-600" />
                A little room to explore
                <span aria-hidden="true" className="h-px w-7 bg-amber-600" />
              </p>
              <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-2xl">
                {agents.length ? "No agents match your filter." : "No owner-managed agents are available yet."}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                {agents.length ? "Try adjusting your search keyword or selecting All locations." : "When owner-managed agents join RentTrack, you’ll find their profiles here."}
              </p>
            </div>
          ) : (
            <div className={agentCardStyles.directoryGrid}>
              {filteredAgents.map((agent) => (
                <PublicAgentCard
                  key={agent.id}
                  agent={agent}
                  headingLevel={2}
                  variant="compact"
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
