"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Sparkles,
  ShieldCheck,
  Clock,
  Wallet,
  MessageSquare,
  ExternalLink,
  ChevronDown,
  X,
  Eye,
  Check,
  ChevronRight,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useAuth } from "@/lib/auth";
import {
  getPayments,
  getTenantPaymentSummary,
  safeParseJson,
  Payment,
} from "@/lib/data";
import type { MoveOutTenancy } from "@/lib/move-out-policy";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export default function TenantDashboard() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenant, setTenant] = useState<MoveOutTenancy["tenant"]>(null);
  const [tenancyLoading, setTenancyLoading] = useState(true);
  const [tenancyError, setTenancyError] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

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

  const tenantPayments = user ? payments.filter((payment) => payment.tenantId === user.id || payment.tenantId === tenant?.id) : [];

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

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const handleOpenMessages = () => {
    window.dispatchEvent(new CustomEvent("renttrack-open-messages"));
  };

  const rentalDetails = [
    { label: "Property Name", value: tenant?.propertyName || "Not assigned", icon: Building2 },
    { label: "Unit / Room", value: tenant?.unitNumber ? `Unit ${tenant.unitNumber}` : "Not assigned", icon: Home },
    { label: "Monthly Rent", value: monthlyRent > 0 ? formatCurrency(monthlyRent) : "Not set", icon: CreditCard },
    { label: "Lease Start Date", value: tenant?.contractStart ? formatDate(tenant.contractStart) : "Not set", icon: Calendar },
    { label: "Lease End Date", value: tenant?.contractEnd ? formatDate(tenant.contractEnd) : "Not set", icon: Calendar },
    { label: "Lease Status", value: tenant?.assignmentStatus === "confirmed" ? "Active" : tenant?.assignmentStatus || "Not assigned", icon: CheckCircle2 },
  ].map((detail) => ({ ...detail, value: tenancyLoading ? "Loading..." : tenancyError ? "Unavailable" : detail.value }));

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 pb-10"
    >
      {/* HERO BANNER - Clear, Beautiful Resort Background & Personalized */}
      <motion.section
        variants={itemVariants}
        className="relative overflow-hidden rounded-2xl border border-white/10 p-6 sm:p-8 shadow-xl min-h-[220px] flex items-center"
      >
        {/* Clear, High-Resolution Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none"
          style={{
            backgroundImage: "url('/images/favicon/Landing page and login page.png')",
            backgroundPosition: "center 55%",
          }}
        />

        {/* Crisp readability gradient: transparent on the right so the resort pool & lights are crystal clear, subtle dark scrim on the left for text */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(90deg, rgba(7, 19, 38, 0.88) 0%, rgba(7, 19, 38, 0.65) 45%, rgba(7, 19, 38, 0.20) 80%, rgba(7, 19, 38, 0.05) 100%)",
          }}
        />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between w-full">
          <div className="min-w-0 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[10px] font-bold uppercase tracking-widest text-blue-200 shadow-xs">
              <Sparkles className="h-3 w-3 text-blue-300 animate-pulse" />
              <span>Tenant Hub</span>
            </div>

            <h1 className="mt-2.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
              {greeting}, {user?.name?.split(" ")[0] || "Junrich"}.
            </h1>

            <p className="mt-1.5 text-xs sm:text-sm text-slate-200 max-w-xl leading-relaxed drop-shadow-xs">
              Welcome back to your personalized home dashboard. Track your monthly payments, inspect lease records, and manage your tenancy.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-950/70 backdrop-blur-md px-3 py-1 text-xs font-semibold text-emerald-200 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Status: {tenantStatusLabel}</span>
              </span>

              {tenant?.propertyName && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/40 bg-[#071326]/80 backdrop-blur-md px-3 py-1 text-xs font-semibold text-blue-200 shadow-sm">
                  <Building2 className="h-3.5 w-3.5 text-blue-300" />
                  <span>{tenant.propertyName}</span>
                  {tenant?.unitNumber && <span className="font-bold">• Unit {tenant.unitNumber}</span>}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Awaiting Payment Confirmation Alert */}
      {tenantPaymentSummary.hasAwaitingConfirmation && tenantPaymentSummary.waitingForConfirmation && (
        <motion.div
          variants={itemVariants}
          className="flex items-start gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/90 p-4 text-amber-900 shadow-xs backdrop-blur-xs"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 animate-bounce" />
          <div className="flex-1 text-xs">
            <p className="font-bold text-sm text-amber-950">Payment Receipt Under Verification</p>
            <p className="mt-0.5 text-amber-800">
              You submitted a payment receipt of {formatCurrency(tenantPaymentSummary.waitingForConfirmation.amountPaid || 0)}. It is currently waiting for property owner confirmation. Once verified, your balance updates immediately.
            </p>
          </div>
        </motion.div>
      )}

      {/* 4 METRIC CARDS with Hover Elevation & Micro-Interactions */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
      >
        {/* Metric 1: Monthly Rent */}
        <motion.div
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="group flex items-start gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:border-blue-300 hover:shadow-md transition-all"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <Home className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Monthly Rent</p>
            <p className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              {tenancyLoading ? "Loading…" : tenancyError ? "Unavailable" : monthlyRent > 0 ? formatCurrency(monthlyRent) : "Not set"}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
              <span>{tenant?.unitNumber ? `Unit ${tenant.unitNumber} assigned` : "No lease assigned"}</span>
            </p>
          </div>
        </motion.div>

        {/* Metric 2: Total Paid */}
        <motion.div
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="group flex items-start gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Paid</p>
            <p className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              {formatCurrency(totalPaid)}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500 flex items-center gap-1">
              <Check className="h-3 w-3 text-emerald-500 shrink-0" />
              <span>{paidCount} verified payments</span>
            </p>
          </div>
        </motion.div>

        {/* Metric 3: Outstanding Balance */}
        <motion.div
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="group flex items-start gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:border-violet-300 hover:shadow-md transition-all"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Outstanding Balance</p>
            <p className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              {tenantPayments.length > 0 ? (outstanding > 0 ? formatCurrency(outstanding) : "₱0.00") : "No record"}
            </p>
            <p className="mt-1 truncate text-xs font-medium">
              {outstanding > 0 ? (
                <span className="text-amber-600 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Payment due
                </span>
              ) : (
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Up to date
                </span>
              )}
            </p>
          </div>
        </motion.div>

        {/* Metric 4: Next Payment Due */}
        <motion.div
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="group flex items-start gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:border-amber-300 hover:shadow-md transition-all"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Next Payment Due</p>
            <p className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 truncate">
              {nextPayment?.dueDate ? formatDate(nextPayment.dueDate) : tenantPayments.length > 0 ? "None" : "No records"}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500">
              {nextPayment ? `Amount: ${formatCurrency(nextPayment.amountDue)}` : "No upcoming balances"}
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* PAYMENT STATUS & RENTAL INFORMATION - 2-Column Balanced Grid */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 gap-5 lg:grid-cols-2"
      >
        {/* Payment Status Card */}
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Payment Breakdown</h3>
                  <p className="text-xs text-slate-500">Historical &amp; active payment records</p>
                </div>
              </div>
              <Link
                href="/dashboard/tenant/payments"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                <span>View all</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="pt-4">
              {tenantPayments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                  <CreditCard className="h-10 w-10 text-slate-300 mb-2 stroke-[1.3]" />
                  <p className="text-xs font-semibold text-slate-700">No payment records yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
                    Your transactions and verified receipts will appear here once submitted.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 py-2">
                  <div className="h-40" role="img" aria-label={`Payment status chart`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusData} innerRadius={42} outerRadius={65} paddingAngle={4} dataKey="value" stroke="none">
                          {statusData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2.5">
                    {statusData.map((status) => (
                      <div key={status.name} className="flex items-center justify-between p-2 rounded-xl bg-slate-50/80 text-xs">
                        <span className="flex items-center gap-2 text-slate-700 font-medium">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                          {status.name}
                        </span>
                        <span className="font-bold text-slate-900">{status.value} records</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Outstanding: <strong className="text-slate-900">{formatCurrency(outstanding)}</strong>
            </span>
            <Link
              href="/dashboard/tenant/payments"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Make a Payment</span>
            </Link>
          </div>
        </section>

        {/* Rental Information Card */}
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Rental Agreement</h3>
                  <p className="text-xs text-slate-500">Your current registered tenancy</p>
                </div>
              </div>
              <Link
                href="/dashboard/tenant/properties-page"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                <span>Full details</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="pt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {rentalDetails.map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 hover:bg-slate-50 transition-colors">
                  <Icon className="h-4 w-4 text-blue-600 mb-1.5" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                  <p className="mt-0.5 truncate text-xs font-bold text-slate-800" title={value}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Need assistance with your home?
            </span>
            <button
              type="button"
              onClick={handleOpenMessages}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
              <span>Contact Landlord</span>
            </button>
          </div>
        </section>
      </motion.div>

      {/* Recent Payments Section */}
      <motion.section
        variants={itemVariants}
        className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Payment History</h3>
            <p className="text-xs text-slate-500">Your latest transactions and uploaded receipts</p>
          </div>
          <Link
            href="/dashboard/tenant/payments"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            <span>All payments</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {tenantPayments.slice(0, 5).length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            <CreditCard className="h-8 w-8 text-slate-300 mx-auto mb-2 stroke-[1.3]" />
            <p className="font-semibold text-slate-600">No payment records yet.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Submit your first proof of payment in the payments page.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tenantPayments.slice(0, 5).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between py-3 hover:bg-slate-50/50 px-2 rounded-xl transition-colors">
                <div>
                  <p className="text-xs font-bold text-slate-900">{formatDate(payment.paymentDate)}</p>
                  <p className="text-[11px] text-slate-400 capitalize mt-0.5 flex items-center gap-1.5">
                    <span>{payment.paymentMethod?.replace(/_/g, " ")}</span>
                    {payment.receiptUrl && (
                      <button
                        type="button"
                        onClick={() => setViewingReceipt(payment.receiptUrl!)}
                        className="text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                      >
                        <Eye className="h-3 w-3" /> View receipt
                      </button>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-extrabold text-slate-900">{formatCurrency(payment.amountPaid)}</span>
                  <Badge
                    variant={payment.status === "paid" ? "success" : payment.status === "overdue" ? "destructive" : "warning"}
                    className="text-[10px] capitalize px-2 py-0.5"
                  >
                    {payment.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* RECEIPT PREVIEW MODAL */}
      <AnimatePresence>
        {viewingReceipt && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs cursor-pointer"
            onClick={() => setViewingReceipt(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-lg w-full bg-white rounded-2xl shadow-2xl p-4 cursor-default overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setViewingReceipt(null)}
                className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center cursor-pointer z-10"
              >
                <X className="h-4 w-4" />
              </button>
              <h4 className="text-sm font-bold text-slate-900 mb-3">Receipt Document</h4>
              <div className="relative h-96 w-full rounded-xl overflow-hidden bg-slate-100">
                <Image src={viewingReceipt} alt="Receipt" fill unoptimized className="object-contain" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
