"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  FileText,
  Home,
  MapPin,
  Search,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useAuth } from "@/lib/auth";
import {
  getPayments,
  getTenantPaymentSummary,
  getProperties,
  getUnits,
  safeParseJson,
  Payment,
  Property,
  Unit,
} from "@/lib/data";
import type { MoveOutTenancy } from "@/lib/move-out-policy";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function TenantDashboard() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenant, setTenant] = useState<MoveOutTenancy["tenant"]>(null);
  const [tenancyLoading, setTenancyLoading] = useState(true);
  const [tenancyError, setTenancyError] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [availableHomesLoading, setAvailableHomesLoading] = useState(true);
  const [availableHomesError, setAvailableHomesError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const controller = new AbortController();
    setTenancyLoading(true);
    setTenancyError(false);
    getPayments(user).then((items) => { if (mounted) setPayments(items); }).catch(() => undefined);
    fetch("/api/move-out", { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await safeParseJson(response);
        if (!response.ok || !data.success || !data.tenancy) throw new Error("Rental unavailable");
        if (mounted) setTenant(data.tenancy.tenant);
      })
      .catch(() => { if (mounted) setTenancyError(true); })
      .finally(() => { if (mounted) setTenancyLoading(false); });
    return () => { mounted = false; controller.abort(); };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setAvailableHomesLoading(false);
      return;
    }

    let mounted = true;
    setAvailableHomesLoading(true);
    setAvailableHomesError(false);
    Promise.all([getProperties(user), getUnits(user)])
      .then(([propertyData, unitData]) => {
        if (!mounted) return;
        setProperties(propertyData);
        setUnits(unitData);
      })
      .catch(() => {
        if (mounted) setAvailableHomesError(true);
      })
      .finally(() => {
        if (mounted) setAvailableHomesLoading(false);
      });

    return () => { mounted = false; };
  }, [user]);

  const tenantPayments = user ? payments.filter((payment) => payment.tenantId === user.id || payment.tenantId === tenant?.id) : [];
  
  const availableProperties = useMemo(() => {
    return properties.filter((property) =>
      property.status === "active" &&
      units.some((unit) => unit.propertyId === property.id && unit.status === "vacant")
    );
  }, [properties, units]);

  const filteredAvailableProperties = useMemo(() => {
    if (!searchQuery.trim()) return availableProperties;
    const q = searchQuery.toLowerCase();
    return availableProperties.filter((property) =>
      property.name.toLowerCase().includes(q) ||
      property.location.toLowerCase().includes(q)
    );
  }, [availableProperties, searchQuery]);

  const availableUnits = useMemo(() => {
    return units.filter((unit) =>
      unit.status === "vacant" &&
      properties.some((property) => property.id === unit.propertyId && property.status === "active")
    );
  }, [units, properties]);

  const tenantPaymentSummary = user
    ? getTenantPaymentSummary(tenantPayments.map((payment) => ({ ...payment, tenantId: user.id })), user.id)
    : { totalPaid: 0, outstanding: 0, hasAwaitingConfirmation: false, waitingForConfirmation: null, hasConfirmedPayment: false };

  const monthlyRent = tenant?.rentAmount ?? 0;
  const totalPaid = tenantPaymentSummary.totalPaid;
  const outstanding = tenantPaymentSummary.outstanding;
  const nextPayment = tenantPayments.find((payment) => payment.status === "pending" || payment.status === "overdue");
  const paidCount = tenantPayments.filter((payment) => payment.status === "paid").length;
  const pendingCount = tenantPayments.filter((payment) => payment.status === "pending").length;
  const overdueCount = tenantPayments.filter((payment) => payment.status === "overdue").length;
  const statusData = [
    { name: "Paid", value: paidCount, color: "#16a34a" },
    { name: "Pending", value: pendingCount, color: "#f59e0b" },
    { name: "Overdue", value: overdueCount, color: "#ef4444" },
  ];

  const tenantStatusLabel = tenant?.unitId
    ? tenant.assignmentStatus === "confirmed"
      ? "Active Tenant"
      : "Assigned Tenant"
    : "Prospective Tenant";

  const rentalDetails = [
    { label: "Property Name", value: tenant?.propertyName || "Not assigned", icon: Building2 },
    { label: "Unit / Room", value: tenant?.unitNumber || "Not assigned", icon: Home },
    { label: "Monthly Rent", value: monthlyRent > 0 ? formatCurrency(monthlyRent) : "Not set", icon: CreditCard },
    { label: "Lease Start Date", value: tenant?.contractStart ? formatDate(tenant.contractStart) : "Not set", icon: Calendar },
    { label: "Lease End Date", value: tenant?.contractEnd ? formatDate(tenant.contractEnd) : "Not set", icon: Calendar },
    { label: "Lease Status", value: tenant?.assignmentStatus === "confirmed" ? "Active" : tenant?.assignmentStatus || "Not assigned", icon: CheckCircle2 },
  ].map((detail) => ({ ...detail, value: tenancyLoading ? "Loading..." : tenancyError ? "Unavailable" : detail.value }));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 pb-10">
      {/* HERO BANNER */}
      <section className="relative overflow-hidden rounded-2xl border border-[#d8e7fd] bg-[#e8f2ff] p-6 sm:p-7 shadow-xs">
        <div
          className="absolute inset-0 bg-cover pointer-events-none"
          style={{
            backgroundImage: "url('/images/favicon/Landing page and login page.png')",
            backgroundPosition: "center 53%",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(90deg, #edf5ff 0%, #e8f2ff 38%, rgba(232, 242, 255, 0.92) 52%, rgba(232, 242, 255, 0.15) 85%)",
          }}
        />
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#39619c]">TENANT OVERVIEW</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#071f45] sm:text-3xl">
              Welcome back, {user?.name?.split(" ")[0] || "Junrich"}.
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#3d5d90]">
              Your rental, payments, and home search in one place.
            </p>
            <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-white/95 px-3 py-1 text-xs font-medium text-slate-700 shadow-2xs">
              <Home className="h-3.5 w-3.5 text-blue-600" />
              <span>Status: {tenantStatusLabel}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/dashboard/tenant/browse"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0872ff] hover:bg-[#005bdf] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs transition-colors"
            >
              <span>Browse available homes</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Awaiting Payment Confirmation Alert */}
      {tenantPaymentSummary.hasAwaitingConfirmation && tenantPaymentSummary.waitingForConfirmation && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-sm">Payment already submitted</p>
            <p className="mt-1 text-xs sm:text-sm text-amber-800">
              You already paid {formatCurrency(tenantPaymentSummary.waitingForConfirmation.amountPaid || 0)} and it is waiting for the owner to confirm.
              Once confirmed, your outstanding balance will be updated automatically.
            </p>
          </div>
        </div>
      )}

      {/* 4 METRIC CARDS */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
        {/* Monthly Rent */}
        <div className="flex items-start gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Home className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">Monthly Rent</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {tenancyLoading ? "Loading…" : tenancyError ? "Unavailable" : monthlyRent > 0 ? formatCurrency(monthlyRent) : "Not set"}
            </p>
            <p className="mt-1 truncate text-[11px] text-slate-400">
              {tenant?.unitNumber ? `Unit ${tenant.unitNumber} assigned` : "No active rental assigned"}
            </p>
          </div>
        </div>

        {/* Total Paid */}
        <div className="flex items-start gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-600 text-xs font-bold leading-none">
              ₱
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">Total Paid</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(totalPaid)}
            </p>
            <p className="mt-1 truncate text-[11px] text-slate-400">
              {paidCount} completed payments
            </p>
          </div>
        </div>

        {/* Outstanding Balance */}
        <div className="flex items-start gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <CreditCard className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">Outstanding Balance</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {tenantPayments.length > 0 ? (outstanding > 0 ? formatCurrency(outstanding) : "₱0.00") : "No record"}
            </p>
            <p className="mt-1 truncate text-[11px] text-slate-400">
              {tenantPayments.length > 0 ? (outstanding > 0 ? "Payment required" : "No balance due") : "No payment records yet"}
            </p>
          </div>
        </div>

        {/* Next Payment Due */}
        <div className="flex items-start gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Calendar className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">Next Payment Due</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {nextPayment?.dueDate ? formatDate(nextPayment.dueDate) : tenantPayments.length > 0 ? "None" : "No records"}
            </p>
            <p className="mt-1 truncate text-[11px] text-slate-400">
              {nextPayment ? formatCurrency(nextPayment.amountDue) : "No payment records yet"}
            </p>
          </div>
        </div>
      </div>

      {/* FIND YOUR NEXT PLACE */}
      <section aria-labelledby="available-homes-heading" className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">FIND YOUR NEXT PLACE</p>
            <h2 id="available-homes-heading" className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">
              Available homes &amp; units
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Browse active properties with vacant units ready to rent.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1 sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by city, neighborhood, or building name..."
                className="h-9.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/tenant/properties-page"
                className="inline-flex h-9.5 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>Properties</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/dashboard/tenant/units"
                className="inline-flex h-9.5 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>Units</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Content of Available homes */}
        {availableHomesLoading ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading available homes">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : availableHomesError ? (
          <div role="status" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5 text-xs text-amber-900">
            Available homes could not be loaded. Please refresh the page to try again.
          </div>
        ) : filteredAvailableProperties.length === 0 ? (
          <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-12 px-4 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Building2 className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-800">No vacant homes right now</p>
            <p className="mt-1 text-xs text-slate-500">Check back later or browse all listed properties.</p>
            <Link
              href="/dashboard/tenant/browse"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-800 hover:text-blue-600 transition-colors"
            >
              <span>Explore listings</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAvailableProperties.slice(0, 6).map((property) => {
              const vacantUnits = units.filter((u) => u.propertyId === property.id && u.status === "vacant");
              const startingRent = vacantUnits.length > 0 ? Math.min(...vacantUnits.map((u) => u.rentAmount)) : 0;
              return (
                <article key={property.id} className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition-all hover:border-blue-200 hover:shadow-md">
                  <div className="relative h-36 overflow-hidden bg-slate-100">
                    {property.imageUrl ? (
                      <Image
                        src={property.imageUrl}
                        alt={property.name}
                        fill
                        unoptimized
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-400">
                        <Building2 className="h-8 w-8" />
                      </div>
                    )}
                    <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800 shadow-sm backdrop-blur">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      {vacantUnits.length} {vacantUnits.length === 1 ? "unit" : "units"} available
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="truncate text-sm font-bold text-slate-900">{property.name}</h3>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" /> {property.location}
                    </p>
                    <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3">
                      <p className="text-xs text-slate-500">
                        From <span className="font-bold text-slate-900">{formatCurrency(startingRent)}</span>
                        <span className="text-slate-400"> / mo</span>
                      </p>
                      <Link
                        href="/dashboard/tenant/properties-page"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        <span>View</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* PAYMENT STATUS & RENTAL INFORMATION */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Payment Status Card */}
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Payment Status</h3>
                <p className="text-xs text-slate-500">Current payment records</p>
              </div>
            </div>
            <Link
              href="/dashboard/tenant/payments"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              <span>View all</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="pt-5">
            {tenantPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
                <CreditCard className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-600">No payment records yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Your payment breakdown will appear here once active.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-5">
                <div className="h-44" role="img" aria-label={`Payment status: ${paidCount} paid, ${pendingCount} pending, ${overdueCount} overdue`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} innerRadius={42} outerRadius={68} paddingAngle={3} dataKey="value" stroke="none">
                        {statusData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {statusData.map((status) => (
                    <div key={status.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-slate-600">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                        {status.name}
                      </span>
                      <span className="font-bold text-slate-900">{status.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Rental Information Card */}
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Rental Information</h3>
                <p className="text-xs text-slate-500">Your current lease details</p>
              </div>
            </div>
            <Link
              href="/dashboard/tenant/properties-page"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              <span>View details</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="pt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {rentalDetails.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <Icon className="h-4 w-4 text-blue-600 mb-1.5" />
                <p className="text-[10px] text-slate-500">{label}</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-800" title={value}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Recent Payments Section */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Payments</h3>
            <p className="text-xs text-slate-500">Your latest transactions and receipts</p>
          </div>
          <Link
            href="/dashboard/tenant/payments"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            <span>All payments</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {tenantPayments.slice(0, 5).length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">No payments recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {tenantPayments.slice(0, 5).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-xs font-semibold text-slate-900">{formatDate(payment.paymentDate)}</p>
                  <p className="text-[11px] text-slate-400 capitalize mt-0.5">
                    {payment.paymentMethod?.replace(/_/g, " ")} {payment.receiptUrl ? "• Receipt attached" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-emerald-600">{formatCurrency(payment.amountPaid)}</span>
                  <Badge
                    variant={payment.status === "paid" ? "success" : payment.status === "overdue" ? "destructive" : "warning"}
                    className="text-[10px] capitalize"
                  >
                    {payment.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
}
