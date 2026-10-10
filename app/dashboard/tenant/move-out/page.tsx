"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  FileText,
  Send,
  XCircle,
  X,
  AlertCircle,
  HelpCircle,
  Building2,
  MessageSquare,
  Calendar,
  Sparkles,
  Check,
  Key,
  ShieldCheck,
  ChevronRight,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import type { MoveOutRequestRow, MoveOutTenancy } from "@/lib/move-out-policy";
import { formatCurrency, formatDate } from "@/lib/utils";
import { safeParseJson } from "@/lib/data";

type MoveOutResponse = {
  success?: boolean;
  error?: string;
  requests?: MoveOutRequestRow[];
  request?: MoveOutRequestRow;
  tenancy?: MoveOutTenancy;
};

const statusPresentation = {
  pending: {
    label: "Awaiting review",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Clock3,
  },
  approved: {
    label: "Approved",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Not approved",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-800",
    icon: XCircle,
  },
} as const;

const QUICK_REASONS = [
  "Lease Term Expiring",
  "Job / Career Relocation",
  "Personal / Family Reason",
  "Upsizing or Downsizing",
  "Purchased New Home",
];

export default function TenantMoveOutPage() {
  const { user } = useAuth();
  const [tenancy, setTenancy] = useState<MoveOutTenancy | null>(null);
  const [requests, setRequests] = useState<MoveOutRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  // Form State
  const [reason, setReason] = useState("");
  const [desiredMoveOutDate, setDesiredMoveOutDate] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");

    fetch("/api/move-out", {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await safeParseJson(response)) as MoveOutResponse;
        if (!response.ok || !data.success || !data.tenancy) {
          throw new Error(data.error || "We could not load your tenancy and move-out requests.");
        }
        setTenancy(data.tenancy);
        setRequests(data.requests || []);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : "We could not load your tenancy and move-out requests.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [user, retryCount]);

  const pendingRequest = requests.find((request) => request.status === "pending");

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedReason = reason.trim();
    setSubmitError("");
    setSubmitSuccess("");

    if (!trimmedReason) {
      setSubmitError("Please provide a reason for your move-out request.");
      return;
    }
    if (trimmedReason.length > 2000) {
      setSubmitError("Your reason must be 2,000 characters or fewer.");
      return;
    }

    setSubmitting(true);
    try {
      const fullReason = desiredMoveOutDate
        ? `Desired Move-Out Date: ${desiredMoveOutDate}\n\nReason: ${trimmedReason}`
        : trimmedReason;

      const response = await fetch("/api/move-out", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: fullReason }),
      });
      const data = (await safeParseJson(response)) as MoveOutResponse;

      if (data.tenancy) setTenancy(data.tenancy);
      if (data.request) {
        setRequests((current) => [data.request!, ...current.filter((item) => item.id !== data.request!.id)]);
      }

      if (!response.ok || !data.success) {
        setSubmitError(data.error || "We could not submit your move-out request. Please try again.");
        return;
      }

      setReason("");
      setDesiredMoveOutDate("");
      setTermsAccepted(false);
      setSubmitSuccess("Your move-out request has been sent to the property manager for review.");
    } catch {
      setSubmitError("We could not submit your move-out request. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const handleSelectQuickReason = (tag: string) => {
    if (!reason.includes(tag)) {
      setReason((prev) => (prev ? `${prev}. ${tag}` : tag));
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. HERO BANNER - Rich, Clear Background Image & Personalized */}
      <section className="relative overflow-hidden rounded-2xl border border-white/10 p-6 sm:p-8 shadow-xl min-h-[200px] flex items-center">
        {/* Clear Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none"
          style={{
            backgroundImage: "url('/images/favicon/Landing page and login page.png')",
            backgroundPosition: "center 55%",
          }}
        />

        {/* Crisp Readability Scrim Overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(90deg, rgba(7, 19, 38, 0.90) 0%, rgba(7, 19, 38, 0.70) 50%, rgba(7, 19, 38, 0.25) 85%, rgba(7, 19, 38, 0.1) 100%)",
          }}
        />

        {/* Header Content */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[10px] font-bold uppercase tracking-widest text-blue-200 shadow-xs mb-2.5">
              <Sparkles className="h-3 w-3 text-blue-300 animate-pulse" />
              <span>Tenancy Management</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
              Move Out / End Tenancy
            </h1>

            <p className="mt-1 text-xs sm:text-sm text-slate-200 leading-relaxed drop-shadow-xs">
              Submit a formal request to end your current tenancy, schedule a handover inspection, and track approval status.
            </p>
          </div>
        </div>
      </section>

      {/* 2. MAIN CONTENT AREA */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="flex flex-col items-center justify-center gap-3 text-slate-600">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            <p className="text-sm font-semibold text-slate-800">Checking your tenancy records and request history...</p>
          </div>
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div>
              <p className="font-bold text-sm text-slate-900">Move-out Information Unavailable</p>
              <p className="text-xs text-slate-600 mt-0.5">{loadError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRetryCount((c) => c + 1)}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      ) : !tenancy?.eligible ? (
        /* Not eligible / Unconfirmed Tenancy */
        <div className="rounded-2xl border border-amber-200/90 bg-amber-50/50 p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Building2 className="h-8 w-8" />
            </div>

            <div className="flex-1 space-y-1.5 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                <Info className="h-3 w-3" />
                <span>Verification Required</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Your Tenancy Details Need Confirmation
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                You do not currently have a confirmed active lease or assigned unit in the system. To proceed with an official move-out request, your property manager must confirm your active tenancy details.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 shrink-0 w-full md:w-auto">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("renttrack-open-messages"))}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Contact Landlord</span>
              </button>
              <button
                type="button"
                onClick={() => setShowStatusModal(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <FileText className="h-4 w-4 text-slate-500" />
                <span>View Status</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Confirmed & Eligible Tenancy */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Tenancy Banner + Move-Out Form (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Confirmed Property & Unit Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
                    <Building2 className="h-6 w-6 stroke-[1.4]" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
                      {tenancy.tenant?.propertyName || "Assigned Property"}
                      {tenancy.tenant?.unitNumber ? ` · Unit ${tenancy.tenant.unitNumber}` : ""}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Confirmed Tenancy · Ready for Move-Out Request
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-auto shadow-2xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Unit Confirmed</span>
                </span>
              </div>

              {/* Tenancy Specifications Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Monthly Rent</span>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 truncate">
                    {tenancy.tenant?.rentAmount ? formatCurrency(tenancy.tenant.rentAmount) : "Not set"}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Lease End Date</span>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 truncate">
                    {tenancy.tenant?.contractEnd ? formatDate(tenancy.tenant.contractEnd) : "Standard Monthly"}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Notice Guideline</span>
                  <p className="text-xs sm:text-sm font-bold text-blue-600 mt-0.5 truncate">
                    30-Day Notice
                  </p>
                </div>
              </div>
            </div>

            {/* Submission Form or Awaiting Review Banner */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">
                  {pendingRequest ? "Active Move-Out Request" : "Submit Move-Out Notice"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {pendingRequest
                    ? "Your request has been submitted and is currently under review by your landlord."
                    : "Fill out your requested departure date and provide details for your property manager."}
                </p>
              </div>

              {pendingRequest ? (
                /* Pending Request Card */
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 text-amber-950 space-y-3">
                  <div className="flex items-start gap-3">
                    <Clock3 className="mt-0.5 h-5 w-5 text-amber-700 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-950">
                        Request Awaiting Landlord Review
                      </p>
                      <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                        Submitted on {formatDate(pendingRequest.created_at)}. Your landlord or property manager will inspect the request and get in touch with you regarding turnover scheduling.
                      </p>
                    </div>
                  </div>

                  {pendingRequest.reason && (
                    <div className="p-3 rounded-lg bg-white/80 border border-amber-200/80 text-xs text-slate-700">
                      <span className="font-semibold text-slate-900 block mb-0.5">Submitted Details:</span>
                      <p className="whitespace-pre-line leading-relaxed">{pendingRequest.reason}</p>
                    </div>
                  )}

                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[11px] text-amber-900 font-medium">
                      Need to amend or expedite?
                    </span>
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent("renttrack-open-messages"))}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Chat Manager</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Submission Form */
                <form onSubmit={submitRequest} className="space-y-4">
                  {/* Desired Move-out Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                      Target Move-Out Date <span className="text-slate-400 font-normal lowercase">(optional)</span>
                    </label>
                    <div className="relative max-w-xs">
                      <Calendar className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="date"
                        value={desiredMoveOutDate}
                        onChange={(e) => setDesiredMoveOutDate(e.target.value)}
                        className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Giving at least 30 days prior notice aligns with standard tenancy lease policies.
                    </p>
                  </div>

                  {/* Reason for Moving Out */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Reason for Moving Out <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {reason.length} / 2,000
                      </span>
                    </div>

                    {/* Quick reason suggestions */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {QUICK_REASONS.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleSelectQuickReason(tag)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 text-[11px] font-medium text-slate-600 transition-colors cursor-pointer"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      required
                      placeholder="Share reason or notes for your request (e.g. lease expiry, relocation, work assignment)..."
                      className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors"
                    />
                  </div>

                  {/* Agreement Checkbox */}
                  <div className="flex items-start gap-2.5 pt-1">
                    <input
                      id="terms-acknowledgement"
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="terms-acknowledgement" className="text-xs text-slate-600 leading-relaxed cursor-pointer select-none">
                      I understand that move-out inspection, clearance of outstanding bills, and key handover are required prior to final security deposit reconciliation.
                    </label>
                  </div>

                  {submitError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-medium flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {submitSuccess && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 font-medium flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>{submitSuccess}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting || !termsAccepted}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed px-5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                          <span>Submitting Request...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          <span>Submit Move-Out Request</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Move-Out Steps Roadmap & Manager Assistance (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* 4-Step Process Guide Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Move-Out Process Steps</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(true)}
                  className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Full details
                </button>
              </div>

              <div className="space-y-3.5 pt-1">
                {[
                  {
                    step: "1",
                    title: "Notice Submission",
                    desc: "State your target departure date and reason. Your manager is alerted instantly.",
                  },
                  {
                    step: "2",
                    title: "Manager Review & Walkthrough",
                    desc: "Lease terms are checked and a pre-move inspection is scheduled.",
                  },
                  {
                    step: "3",
                    title: "Clearance & Turnover",
                    desc: "Clean the unit, settle pending utility dues, and return room & gate keys.",
                  },
                  {
                    step: "4",
                    title: "Deposit Reconciliation",
                    desc: "Security deposit is refunded based on the final inspection clearance.",
                  },
                ].map((s) => (
                  <div key={s.step} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0 mt-0.5">
                      {s.step}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{s.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Need Assistance Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 to-blue-50/30 p-5 sm:p-6 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">Have Questions Before Moving?</h4>
                  <p className="text-[11px] text-slate-500">Coordinate directly with your property manager</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                If you have questions regarding deposit terms, lease transfer options, or scheduling walkthroughs, send an inquiry directly.
              </p>

              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("renttrack-open-messages"))}
                className="w-full h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                <span>Contact Landlord in Messages</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MY MOVE-OUT REQUESTS HISTORY CARD */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              My Move-Out Requests
            </h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
              {requests.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
          >
            Policy Guide
          </button>
        </div>

        {requests.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-10 sm:py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 mb-3">
              <FileText className="h-7 w-7 stroke-[1.4]" />
            </div>

            <p className="text-sm text-slate-700 font-bold">
              You have no move-out requests submitted.
            </p>
            <p className="text-xs text-slate-400 max-w-sm mt-0.5">
              Once you submit an official notice, your pending request and its status review history will appear here.
            </p>

            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              className="mt-4 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              New Request Guide
            </button>
          </div>
        ) : (
          /* Requests List */
          <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {requests.map((req) => {
              const statusCfg = statusPresentation[req.status];
              const StatusIcon = statusCfg.icon;

              return (
                <div
                  key={req.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">
                        {req.property_name || "Move-Out Notice"}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.badgeClass}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        <span>{statusCfg.label}</span>
                      </span>
                    </div>

                    <p className="text-xs text-slate-500">
                      Submitted on {formatDate(req.created_at)}
                      {req.reviewed_at && ` • Reviewed on ${formatDate(req.reviewed_at)}`}
                    </p>

                    {req.reason && req.reason !== "Tenant requested to move out" && (
                      <div className="text-xs text-slate-700 mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100 max-w-2xl whitespace-pre-line leading-relaxed">
                        {req.reason}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent("renttrack-open-messages"))}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                      <span>Message Manager</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. VIEW TENANCY STATUS MODAL */}
      <AnimatePresence>
        {showStatusModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs cursor-pointer"
            onClick={() => setShowStatusModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-700" />
                  <h3 className="text-sm font-bold text-slate-900">Current Tenancy Status</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Tenant Name</span>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 truncate">{user?.name || "Tenant"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Role</span>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 capitalize">{user?.role || "Tenant"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Assigned Unit</span>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 truncate">
                      {tenancy?.tenant?.unitNumber ? `Unit ${tenancy.tenant.unitNumber}` : "None Assigned"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Tenancy Status</span>
                    <p className="text-xs sm:text-sm font-bold text-emerald-600 mt-0.5 capitalize">
                      {tenancy?.tenant?.assignmentStatus === "confirmed" ? "Active Lease" : tenancy?.tenant?.status || "Prospective"}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/50 text-xs text-slate-600 space-y-1.5">
                  <p className="font-semibold text-slate-800">Move-Out Requirements:</p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px]">
                    <li>Active confirmed tenancy or unit assignment.</li>
                    <li>No conflicting move-out requests in review.</li>
                    <li>Identity verification complete.</li>
                  </ul>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowStatusModal(false);
                      window.dispatchEvent(new CustomEvent("renttrack-open-messages"));
                    }}
                    className="flex-1 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Contact Manager</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowStatusModal(false)}
                    className="flex-1 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. NEW REQUEST GUIDE MODAL */}
      <AnimatePresence>
        {showGuideModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs cursor-pointer"
            onClick={() => setShowGuideModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">Move-Out Process Guide</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-500">
                  Follow these standard guidelines when planning to vacate your rental residence:
                </p>

                <div className="space-y-3">
                  {[
                    {
                      step: "1",
                      title: "30-Day Prior Notice",
                      desc: "Submit your request at least 30 days before your intended departure date to allow lease inspection and schedule preparation.",
                    },
                    {
                      step: "2",
                      title: "Manager Review & Scheduling",
                      desc: "The property manager reviews your contract terms, acknowledges your notice, and coordinates pre-inspection.",
                    },
                    {
                      step: "3",
                      title: "Inspection & Unit Turnover",
                      desc: "Ensure the unit is clean and in good order. Any damages will be reconciled with the security deposit.",
                    },
                    {
                      step: "4",
                      title: "Settlement & Key Handover",
                      desc: "Return all room keys, gate access cards, and complete final utility clearance.",
                    },
                  ].map((s) => (
                    <div key={s.step} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-bold shrink-0 mt-0.5">
                        {s.step}
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{s.title}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="w-full h-10 mt-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Understood
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="pt-4 border-t border-slate-200/60 text-center text-[11px] text-slate-400">
        © 2026 RentTrack. All rights reserved.
      </footer>
    </div>
  );
}
