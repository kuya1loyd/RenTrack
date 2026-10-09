"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  Mail,
  Send,
  XCircle,
  X,
  AlertCircle,
  HelpCircle,
  Building2,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import type { MoveOutRequestRow, MoveOutTenancy } from "@/lib/move-out-policy";
import { formatDate } from "@/lib/utils";
import { safeParseJson } from "@/lib/data";

type MoveOutResponse = {
  success?: boolean;
  error?: string;
  requests?: MoveOutRequestRow[];
  request?: MoveOutRequestRow;
  tenancy?: MoveOutTenancy;
};

const statusPresentation = {
  pending: { label: "Awaiting review", className: "border-amber-200 bg-amber-50 text-amber-800", icon: Clock3 },
  approved: { label: "Approved", className: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CheckCircle2 },
  rejected: { label: "Not approved", className: "border-rose-200 bg-rose-50 text-rose-800", icon: XCircle },
} as const;

export default function TenantMoveOutPage() {
  const { user } = useAuth();
  const [tenancy, setTenancy] = useState<MoveOutTenancy | null>(null);
  const [requests, setRequests] = useState<MoveOutRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [reason, setReason] = useState("");
  const [desiredMoveOutDate, setDesiredMoveOutDate] = useState("");
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
      setSubmitSuccess("Your move-out request has been sent to the property manager for review.");
    } catch {
      setSubmitError("We could not submit your move-out request. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* TOP CARD / HERO BANNER (With Landing Page Background) */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        {/* Background Picture: The Landing Page Image */}
        <div
          className="absolute inset-0 pointer-events-none bg-cover bg-center"
          style={{
            backgroundImage: `url('/images/favicon/Landing%20page%20and%20login%20page.png')`,
            backgroundPosition: "center 52%",
          }}
        />

        {/* Soft frosted gradient overlay for high contrast and elegance */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-blue-50/94 via-slate-50/90 to-blue-50/88 backdrop-blur-[2px]" />

        {/* Header Content */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              TENANCY
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 mt-0.5">
              Move Out / End Tenancy
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Submit a request to end your current tenancy and track its review status.
            </p>
          </div>

          <Link
            href="/dashboard/tenant"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
            <span>Back to dashboard</span>
          </Link>
        </div>

        {/* INNER WHITE CARD: COMPACT & HORIZONTAL */}
        <div className="relative z-10 mt-4 rounded-xl border border-slate-200/90 bg-white/95 backdrop-blur-xs p-4 sm:p-5 shadow-xs">
          {loading ? (
            <div className="flex min-h-24 items-center justify-center gap-2.5 text-xs sm:text-sm text-slate-600">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />
              <span>Checking your current tenancy and request history...</span>
            </div>
          ) : loadError ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-1">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <div>
                  <p className="font-semibold text-slate-900 text-xs sm:text-sm">Move-out information unavailable</p>
                  <p className="text-xs text-slate-500 mt-0.5">{loadError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRetryCount((c) => c + 1)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
              >
                Try again
              </button>
            </div>
          ) : tenancy?.eligible ? (
            /* Eligible with assigned unit */
            <div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">
                      {tenancy.tenant?.propertyName || "Active Rental Property"}
                      {tenancy.tenant?.unitNumber ? ` · Unit ${tenancy.tenant.unitNumber}` : ""}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Confirmed Tenancy · Ready for Move-Out Request
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3" />
                  Unit Confirmed
                </span>
              </div>

              {pendingRequest ? (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <div>
                    <p className="font-semibold text-xs sm:text-sm">Your move-out request is awaiting review</p>
                    <p className="mt-0.5 text-xs text-amber-900 leading-relaxed">
                      A request is currently pending with your property manager. You will be notified once reviewed.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={submitRequest} className="mt-4 space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Target Move-Out Date
                    </label>
                    <input
                      type="date"
                      value={desiredMoveOutDate}
                      onChange={(e) => setDesiredMoveOutDate(e.target.value)}
                      className="w-full sm:w-56 h-9 px-3 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Reason for moving out
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                      required
                      placeholder="Share a brief reason for your request (e.g. lease expiry, relocation)..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {submitError && (
                    <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 font-medium">
                      {submitError}
                    </p>
                  )}
                  {submitSuccess && (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 font-medium">
                      {submitSuccess}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        <span>Submit Move-Out Request</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* Unconfirmed / Not eligible state: COMPACT HORIZONTAL ROW */
            <div className="flex flex-row items-center gap-4 sm:gap-6">
              {/* Compact illustration on the left */}
              <div className="relative shrink-0 flex items-center justify-center w-24 sm:w-28 h-20 sm:h-24">
                <svg
                  className="w-full h-full"
                  viewBox="0 0 200 150"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Backdrop soft cyan circle */}
                  <circle cx="100" cy="78" r="54" fill="#e6f7f6" />

                  {/* Character Torso & Shirt */}
                  <path
                    d="M68 126C68 108 76 96 90 96H104C118 96 126 108 126 126V134H68V126Z"
                    fill="#ffffff"
                    stroke="#1e293b"
                    strokeWidth="2.5"
                  />
                  {/* Character Neck */}
                  <rect x="91" y="80" width="12" height="18" fill="#fbd3b6" stroke="#1e293b" strokeWidth="2.5" />

                  {/* Character Head */}
                  <circle cx="97" cy="72" r="16" fill="#fbd3b6" stroke="#1e293b" strokeWidth="2.5" />
                  <path d="M94 72V74" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
                  <path d="M102 72V74" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
                  <path d="M96 79C98 81 101 81 103 79" stroke="#1e293b" strokeWidth="1.8" strokeLinecap="round" />
                  {/* Hair */}
                  <path
                    d="M84 68C83 58 92 52 104 53C113 54 116 61 113 69C111 65 108 63 103 64C97 65 92 68 84 68Z"
                    fill="#1e293b"
                  />

                  {/* Stacked Cardboard Boxes */}
                  <rect x="110" y="104" width="38" height="28" rx="2" fill="#d49b6a" stroke="#1e293b" strokeWidth="2.5" />
                  <line x1="129" y1="104" x2="129" y2="132" stroke="#b47849" strokeWidth="2" />
                  <rect x="115" y="84" width="30" height="20" rx="2" fill="#e0aa7b" stroke="#1e293b" strokeWidth="2.5" />
                  <line x1="130" y1="84" x2="130" y2="104" stroke="#b47849" strokeWidth="2" />

                  {/* Box held in hands */}
                  <rect x="86" y="104" width="26" height="20" rx="2" fill="#e0aa7b" stroke="#1e293b" strokeWidth="2.5" />
                  <path d="M78 112L87 114" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M110 114L116 112" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Golden Key */}
                  <g transform="translate(136, 60) rotate(-45)">
                    <circle cx="10" cy="10" r="7" fill="#f59e0b" stroke="#1e293b" strokeWidth="2" />
                    <circle cx="10" cy="10" r="3" fill="#ffffff" stroke="#1e293b" strokeWidth="1.5" />
                    <rect x="16" y="8" width="16" height="4" rx="1" fill="#f59e0b" stroke="#1e293b" strokeWidth="2" />
                    <rect x="26" y="12" width="3" height="4" fill="#f59e0b" stroke="#1e293b" strokeWidth="1.5" />
                    <rect x="21" y="12" width="3" height="3" fill="#f59e0b" stroke="#1e293b" strokeWidth="1.5" />
                  </g>

                  {/* Floating Pill Progress Bar above key */}
                  <g transform="translate(122, 38)">
                    <rect x="0" y="0" width="46" height="14" rx="7" fill="#ffffff" stroke="#1e293b" strokeWidth="2" />
                    <rect x="2" y="2" width="26" height="10" rx="5" fill="#10b981" />
                  </g>
                </svg>
              </div>

              {/* Notice text & buttons on the right */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-amber-500 text-amber-600 text-[10px] font-bold shrink-0">
                    i
                  </span>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    Your Tenancy Details Need Confirmation
                  </h2>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Our system shows you don't have a confirmed unit assignment. To proceed with a move-out request, your property manager must verify your current tenancy details.
                </p>

                {/* Two buttons */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1.5">
                  <Link
                    href="/dashboard/tenant/messages"
                    onClick={(e) => {
                      e.preventDefault();
                      window.dispatchEvent(new CustomEvent("renttrack-open-messages"));
                    }}
                    style={{ backgroundColor: "#0d9488", color: "#ffffff" }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-xs hover:opacity-95 transition-opacity cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Contact Property Manager</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setShowStatusModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5 text-slate-500" />
                    <span>View Tenancy Status</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM CARD: MY MOVE-OUT REQUESTS */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <h2 className="text-sm sm:text-base font-bold text-slate-900">
          My Move-Out Requests
        </h2>

        {requests.length === 0 ? (
          /* Compact Empty state matching screenshot */
          <div className="flex flex-col items-center justify-center py-10 sm:py-12 text-center">
            {/* Inbox drawer icon with question mark */}
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-400 mb-2.5">
              <svg
                className="h-6 w-6 stroke-[1.5]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 14l3-7h10l3 7v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5z" />
                <path d="M4 14h5a3 3 0 0 0 6 0h5" />
                <path d="M10 7.5a2 2 0 0 1 2.5-1.5c.9.4 1.5 1.2 1.5 2 0 1.5-1.5 1.8-1.5 2.5" />
                <circle cx="12.5" cy="12.5" r="0.5" fill="currentColor" />
              </svg>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              You have no move-out requests submitted.
            </p>

            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              className="mt-3 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium shadow-xs transition-colors cursor-pointer"
            >
              New Request Guide
            </button>
          </div>
        ) : (
          /* Requests table / list when requests exist */
          <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {requests.map((req) => {
              const statusCfg = statusPresentation[req.status];
              const StatusIcon = statusCfg.icon;

              return (
                <div
                  key={req.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-slate-900">
                      {req.property_name || "Move-Out Request"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Submitted on {formatDate(req.created_at)}
                    </p>
                    {req.reason && req.reason !== "Tenant requested to move out" && (
                      <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {req.reason}
                      </p>
                    )}
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shrink-0 border ${statusCfg.className}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    <span>{statusCfg.label}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* VIEW TENANCY STATUS MODAL */}
      <AnimatePresence>
        {showStatusModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
            onClick={() => setShowStatusModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
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
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Tenant</span>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 truncate">{user?.name || "Tenant"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Account Role</span>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 capitalize">{user?.role || "Tenant"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Assigned Unit</span>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5">
                      {tenancy?.tenant?.unitNumber ? `Unit ${tenancy.tenant.unitNumber}` : "None Assigned"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Tenancy Status</span>
                    <p className="text-xs sm:text-sm font-bold text-amber-600 mt-0.5">
                      {tenancy?.tenant?.status || "Prospective Tenant"}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/50 text-xs text-slate-600 space-y-1.5">
                  <p className="font-semibold text-slate-800">Requirements for Move-Out Request:</p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px]">
                    <li>Active confirmed lease or unit assignment by property owner.</li>
                    <li>No conflicting move-out requests in review.</li>
                    <li>Identity verification completed.</li>
                  </ul>
                </div>

                <div className="flex gap-2 pt-1">
                  <Link
                    href="/dashboard/tenant/messages"
                    onClick={(e) => {
                      e.preventDefault();
                      window.dispatchEvent(new CustomEvent("renttrack-open-messages"));
                    }}
                    style={{ backgroundColor: "#0d9488", color: "#ffffff" }}
                    className="flex-1 h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs hover:opacity-95 transition-opacity cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Contact Manager</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowStatusModal(false)}
                    className="flex-1 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* NEW REQUEST GUIDE MODAL */}
      <AnimatePresence>
        {showGuideModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
            onClick={() => setShowGuideModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-slate-700" />
                  <h3 className="text-sm font-bold text-slate-900">Move-Out Process Guide</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-3.5">
                <p className="text-xs text-slate-500">
                  Follow these standard steps when preparing to vacate your rental unit:
                </p>

                <div className="space-y-2.5">
                  {[
                    {
                      step: "1",
                      title: "30-Day Prior Notice",
                      desc: "Submit your request at least 30 days before your intended vacating date to allow lease inspection.",
                    },
                    {
                      step: "2",
                      title: "Manager Review & Scheduling",
                      desc: "The property manager reviews your contract terms and schedules a pre-inspection walk-through.",
                    },
                    {
                      step: "3",
                      title: "Inspection & Unit Turnover",
                      desc: "Ensure the unit is clean and in good order. Any damages will be reconciled with the security deposit.",
                    },
                    {
                      step: "4",
                      title: "Settlement & Key Handover",
                      desc: "Return all unit keys, gate access cards, and complete final billing clearance.",
                    },
                  ].map((s) => (
                    <div key={s.step} className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-bold shrink-0">
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
                  className="w-full h-9 mt-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  Understood
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
