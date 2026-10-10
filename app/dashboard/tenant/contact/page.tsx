"use client";

import { FormEvent, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare,
  Send,
  Building2,
  ArrowRight,
  HelpCircle,
  Sparkles,
  LifeBuoy,
  Clock3,
  CheckCircle2,
  Check,
  AlertCircle,
  Inbox,
  Filter,
  CornerDownRight,
  ShieldCheck,
  Radio,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { createComplaint, getComplaints, replyToComplaint, Complaint } from "@/lib/data";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { cn, formatDate, getTimeAgo } from "@/lib/utils";

const QUICK_TOPICS = {
  manager: [
    "Maintenance & Repair",
    "Lease Term & Renewal",
    "Rent & Payment Inquiry",
    "Move-Out Notice",
    "Unit Rules & Parking",
  ],
  support: [
    "Payment & Receipt Issue",
    "Account & Password",
    "ID Verification Status",
    "Bug Report / Glitch",
    "General Platform Help",
  ],
};

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "text-slate-600 bg-slate-100 border-slate-200" },
  { value: "medium", label: "Normal", color: "text-blue-700 bg-blue-50 border-blue-200" },
  { value: "high", label: "High", color: "text-amber-700 bg-amber-50 border-amber-200" },
  { value: "urgent", label: "Urgent", color: "text-rose-700 bg-rose-50 border-rose-200" },
];

export default function TenantContactPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialTab =
    searchParams.get("target") === "support" || searchParams.get("tab") === "support"
      ? "support"
      : "manager";
  const [activeTab, setActiveTab] = useState<"manager" | "support">(initialTab);
  const [requests, setRequests] = useState<Complaint[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [submitting, setSubmitting] = useState(false);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "resolved" | "closed">("all");

  const loadRequests = () => {
    if (user) {
      setLoadingRequests(true);
      getComplaints(user.id)
        .then((data) => setRequests(data || []))
        .catch(() => setRequests([]))
        .finally(() => setLoadingRequests(false));
    }
  };

  useEffect(loadRequests, [user]);

  // Tab counts
  const managerRequests = useMemo(
    () => requests.filter((r) => r.targetType !== "support"),
    [requests]
  );
  const supportRequests = useMemo(
    () => requests.filter((r) => r.targetType === "support"),
    [requests]
  );

  // Active list based on tab
  const tabRequests = activeTab === "manager" ? managerRequests : supportRequests;

  // Filtered list
  const filteredRequests = useMemo(() => {
    if (statusFilter === "all") return tabRequests;
    if (statusFilter === "pending") {
      return tabRequests.filter((r) => r.status === "open" || !r.status);
    }
    if (statusFilter === "resolved") {
      return tabRequests.filter((r) => r.status === "resolved");
    }
    if (statusFilter === "closed") {
      return tabRequests.filter((r) => r.status === "closed");
    }
    return tabRequests;
  }, [tabRequests, statusFilter]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error("Subject and message are required");
      return;
    }
    setSubmitting(true);
    try {
      const targetType = activeTab === "manager" ? "property" : "support";
      const request = await createComplaint({
        tenantId: user?.id || "",
        targetType,
        targetId: activeTab === "manager" ? "manager" : "support",
        subject: subject.trim(),
        message: message.trim(),
        priority,
      });
      setRequests((current) => [request, ...current]);
      setSubject("");
      setMessage("");
      setPriority("medium");
      toast.success(
        activeTab === "manager"
          ? "Message sent to your property manager"
          : "Support ticket submitted successfully"
      );
    } catch {
      toast.error("Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendReply = async (complaintId: string) => {
    if (!replyText.trim()) {
      toast.error("Reply cannot be empty");
      return;
    }
    setReplying(true);
    try {
      const updated = await replyToComplaint(complaintId, replyText.trim());
      if (updated) {
        setRequests((current) =>
          current.map((item) => (item.id === complaintId ? updated : item))
        );
        setReplyText("");
        setReplyingId(null);
        toast.success("Reply submitted");
      }
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setReplying(false);
    }
  };

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "T";

  return (
    <div className="w-full space-y-4 pb-10">
      {/* 1. HERO BANNER */}
      <section className="relative overflow-hidden rounded-2xl border border-white/10 p-5 sm:p-7 shadow-xl min-h-[160px] flex items-center">
        {/* Background Resort Image */}
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none"
          style={{
            backgroundImage: "url('/images/favicon/Landing page and login page.png')",
            backgroundPosition: "center 55%",
          }}
        />

        {/* Crisp Gradient Scrim */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, rgba(7, 19, 38, 0.92) 0%, rgba(7, 19, 38, 0.75) 50%, rgba(7, 19, 38, 0.35) 85%, rgba(7, 19, 38, 0.15) 100%)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[10px] font-bold uppercase tracking-widest text-blue-200 shadow-xs mb-2.5">
              <Sparkles className="h-3 w-3 text-blue-300 animate-pulse" />
              <span>Communications & Support</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
              Contact & Support
            </h1>

            <p className="mt-1 text-xs sm:text-sm text-slate-200 leading-relaxed drop-shadow-xs">
              Connect directly with your property manager, assigned agent, or RentTrack support.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/15 text-xs text-slate-200 shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="font-semibold text-white">Active Support Channels</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. RECIPIENT TABS */}
      <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/90 flex flex-col sm:flex-row gap-1.5 shadow-xs">
        <button
          type="button"
          onClick={() => {
            setActiveTab("manager");
            setStatusFilter("all");
          }}
          className={cn(
            "flex-1 flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer",
            activeTab === "manager"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/70"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                activeTab === "manager"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-200 text-slate-600"
              )}
            >
              <Building2 className="h-4.5 w-4.5" />
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-900">Contact Property Manager & Agent</div>
              <div className="text-[11px] font-normal text-slate-500 hidden sm:block">
                Direct tenancy inquiries, repairs & lease notices
              </div>
            </div>
          </div>
          {managerRequests.length > 0 && (
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0",
                activeTab === "manager"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-slate-200 text-slate-700"
              )}
            >
              {managerRequests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("support");
            setStatusFilter("all");
          }}
          className={cn(
            "flex-1 flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer",
            activeTab === "support"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/70"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                activeTab === "support"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-200 text-slate-600"
              )}
            >
              <LifeBuoy className="h-4.5 w-4.5" />
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-900">RentTrack Platform Support</div>
              <div className="text-[11px] font-normal text-slate-500 hidden sm:block">
                Account access, billing, payments & technical help
              </div>
            </div>
          </div>
          {supportRequests.length > 0 && (
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0",
                activeTab === "support"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-slate-200 text-slate-700"
              )}
            >
              {supportRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* 3. QUICK ACTION CARDS */}
      {activeTab === "manager" ? (
        <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/70 via-white to-white p-5 shadow-xs hover:border-blue-300 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 mb-3">
              <MessageSquare className="h-3 w-3" />
              Direct Chat
            </span>
            <h3 className="text-base font-bold text-slate-900">Message Property Team</h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Open real-time messaging with your property manager and landlord.
            </p>
          </div>
          <div className="shrink-0">
            <Link
              href="/dashboard/tenant/messages"
              onClick={(e) => {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent("renttrack-open-messages"));
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <span>Open Direct Messages</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : (

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 via-white to-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  Status
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 shrink-0">
                  <Radio className="h-5 w-5" />
                </div>
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900">All Systems Operational</h3>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Payment gateways, file attachments, and notification engines are functioning normally.
              </p>
            </div>
            <div className="mt-4 pt-2 text-[11px] font-medium text-emerald-700 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Average response time is under 24 hours.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                  <HelpCircle className="h-3 w-3" />
                  Self-Service
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shrink-0">
                  <HelpCircle className="h-5 w-5" />
                </div>
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900">Common Help Topics</h3>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Need help with GCash receipts, move-out inspections, or ID approvals? Submit a ticket below with full details.
              </p>
            </div>
            <div className="mt-4 pt-2">
              <span className="text-[11px] font-semibold text-blue-600">
                Support team available Mon – Sat (8AM – 6PM)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. MAIN WORKSPACE: FORM & REQUESTS FEED */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 items-start">
        {/* LEFT COLUMN: SUBMISSION FORM */}
        <div className="lg:col-span-2">
          <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden sticky top-24">
            <CardHeader className="border-b border-slate-100 bg-slate-50/70 p-5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    {activeTab === "manager" ? "New Message to Manager" : "New Support Ticket"}
                  </CardTitle>
                  <p className="text-[11px] text-slate-500">
                    {activeTab === "manager"
                      ? "Direct communication regarding your unit and tenancy"
                      : "RentTrack platform assistance and technical bugs"}
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5">
              <form onSubmit={submit} className="space-y-4">
                {/* Quick Topic Chips */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Suggested Categories
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_TOPICS[activeTab].map((topic) => (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => setSubject(topic)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer",
                          subject === topic
                            ? "bg-blue-50 border-blue-300 text-blue-700 font-semibold"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject Input */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Subject / Category <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder={
                      activeTab === "manager"
                        ? "e.g. Water leak in bathroom, Lease renewal query..."
                        : "e.g. Payment receipt error, Login verification..."
                    }
                    className="h-10 rounded-xl border-slate-200 text-xs sm:text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>

                {/* Priority Selector */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Priority Level
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PRIORITY_OPTIONS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setPriority(item.value as any)}
                        className={cn(
                          "py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer",
                          priority === item.value
                            ? "ring-2 ring-blue-500 " + item.color
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message Textarea */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Message <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {message.length} characters
                    </span>
                  </div>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={5}
                    placeholder={
                      activeTab === "manager"
                        ? "Describe your request, question, or issue in detail for your property manager..."
                        : "Describe the issue or assistance needed from RentTrack support..."
                    }
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs sm:text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 resize-none"
                  />
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={submitting || !subject.trim() || !message.trim()}
                  className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {submitting
                    ? "Sending..."
                    : activeTab === "manager"
                    ? "Send to Property Manager"
                    : "Submit Support Ticket"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: MESSAGES & REQUESTS FEED */}
        <div className="lg:col-span-3 min-w-0">
          <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden min-w-0">
            {/* Header with Title and Filter Tabs */}
            <CardHeader className="border-b border-slate-100 bg-slate-50/70 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    {activeTab === "manager" ? "Messages & Requests" : "My Support Requests"}
                  </CardTitle>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {tabRequests.length} total recorded inquiry
                    {tabRequests.length === 1 ? "" : "ies"}
                  </p>
                </div>

                {/* Status Filter Chips */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto overflow-x-auto max-w-full">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0",
                      statusFilter === "all"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    All ({tabRequests.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("pending")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0",
                      statusFilter === "pending"
                        ? "bg-amber-600 text-white"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    Open (
                    {
                      tabRequests.filter((r) => r.status === "open" || !r.status).length
                    }
                    )
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("resolved")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0",
                      statusFilter === "resolved"
                        ? "bg-emerald-600 text-white"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    Resolved ({tabRequests.filter((r) => r.status === "resolved").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("closed")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0",
                      statusFilter === "closed"
                        ? "bg-slate-600 text-white"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    Closed ({tabRequests.filter((r) => r.status === "closed").length})
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 min-w-0">
              {loadingRequests ? (
                <div className="py-14 text-center">
                  <div className="inline-flex items-center gap-2 text-slate-500 text-xs font-semibold">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    Loading your communication history...
                  </div>
                </div>
              ) : filteredRequests.length > 0 ? (
                <div className="space-y-4 min-w-0">
                  {filteredRequests.map((request) => {
                    const isClosed = request.status === "closed";
                    const isResolved = request.status === "resolved";
                    const isPending = !isClosed && !isResolved;

                    return (
                      <div
                        key={request.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs hover:border-slate-300 transition-all min-w-0 overflow-hidden"
                      >
                        {/* Header: User Avatar + Subject + Badges */}
                        <div className="flex items-start gap-3.5 min-w-0">
                          <Avatar
                            src={user?.avatarUrl}
                            fallback={userInitials}
                            size="md"
                            className="shrink-0 mt-0.5 border border-slate-200 shadow-2xs"
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              {/* Subject */}
                              <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug break-words [overflow-wrap:anywhere] min-w-0 flex-1">
                                {request.subject}
                              </h3>

                              {/* Status Badge */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isPending && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                    <Clock3 className="h-3 w-3 text-amber-600" />
                                    Awaiting Response
                                  </span>
                                )}
                                {isResolved && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                    Resolved
                                  </span>
                                )}
                                {isClosed && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                    <Check className="h-3 w-3 text-slate-500" />
                                    Closed
                                  </span>
                                )}

                                {(isResolved || isClosed) && request.responseBy && (
                                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                                    Resolved by Admin
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Timestamp & Meta */}
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                              <span>
                                {request.createdAt
                                  ? `${formatDate(request.createdAt)} (${getTimeAgo(request.createdAt)})`
                                  : "Recently submitted"}
                              </span>
                              {request.priority && (
                                <>
                                  <span>•</span>
                                  <span
                                    className={cn(
                                      "capitalize font-medium",
                                      request.priority === "urgent"
                                        ? "text-rose-600 font-bold"
                                        : request.priority === "high"
                                        ? "text-amber-600"
                                        : "text-slate-500"
                                    )}
                                  >
                                    Priority: {request.priority}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Original Message Body */}
                            <div className="mt-2.5 rounded-xl bg-slate-50/80 p-3 text-xs sm:text-sm text-slate-700 leading-relaxed border border-slate-100 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                              {request.message}
                            </div>

                            {/* Response Section (From Manager or Support) */}
                            {request.responseText && (
                              <div className="mt-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 p-3.5 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                                    <p className="text-xs font-bold text-blue-900">
                                      {activeTab === "manager"
                                        ? "Property Manager Response"
                                        : "RentTrack Support Response"}
                                    </p>
                                    {request.responseBy && (
                                      <span className="text-[11px] text-blue-700 font-medium">
                                        • {request.responseBy}
                                      </span>
                                    )}
                                  </div>
                                  {request.responseAt && (
                                    <span className="text-[10px] text-blue-600/80">
                                      {getTimeAgo(request.responseAt)}
                                    </span>
                                  )}
                                </div>
                                <p className="whitespace-pre-wrap text-xs sm:text-sm text-slate-800 break-words [overflow-wrap:anywhere] leading-relaxed">
                                  {request.responseText}
                                </p>
                              </div>
                            )}

                            {/* Tenant Reply Section (Follow-up) */}
                            {request.tenantReplyText && (
                              <div className="mt-3 rounded-xl bg-slate-100/80 border border-slate-200/80 p-3 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <div className="flex items-center gap-2">
                                    <Avatar
                                      src={user?.avatarUrl}
                                      fallback={userInitials}
                                      size="xs"
                                    />
                                    <p className="text-xs font-bold text-slate-800">
                                      Your Follow-up Reply
                                    </p>
                                  </div>
                                  {request.tenantReplyAt && (
                                    <span className="text-[10px] text-slate-400">
                                      {getTimeAgo(request.tenantReplyAt)}
                                    </span>
                                  )}
                                </div>
                                <p className="whitespace-pre-wrap text-xs sm:text-sm text-slate-700 break-words [overflow-wrap:anywhere] leading-relaxed">
                                  {request.tenantReplyText}
                                </p>
                              </div>
                            )}

                            {/* Reply Action Form / Trigger */}
                            {request.responseText && !isClosed && (
                              <div className="mt-3.5">
                                {replyingId === request.id ? (
                                  <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-3 space-y-2.5">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
                                      <CornerDownRight className="h-3.5 w-3.5 text-blue-600" />
                                      <span>Write your reply to this message</span>
                                    </div>
                                    <textarea
                                      value={replyText}
                                      onChange={(event) => setReplyText(event.target.value)}
                                      rows={3}
                                      placeholder="Type your follow-up reply or acknowledgment here..."
                                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 resize-none"
                                    />
                                    <div className="flex items-center justify-end gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setReplyingId(null);
                                          setReplyText("");
                                        }}
                                        className="rounded-xl text-xs h-8 cursor-pointer"
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => sendReply(request.id)}
                                        disabled={!replyText.trim() || replying}
                                        className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 shadow-xs cursor-pointer"
                                      >
                                        <Send className="mr-1.5 h-3 w-3" />
                                        {replying ? "Sending..." : "Submit Reply"}
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setReplyingId(request.id);
                                      setReplyText("");
                                    }}
                                    className="rounded-xl text-xs h-8 border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
                                  >
                                    <MessageSquare className="mr-1.5 h-3 w-3 text-blue-600" />
                                    Reply to Response
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-14 px-4 text-center flex flex-col items-center justify-center">
                  <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                    <Inbox className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {statusFilter !== "all"
                      ? `No ${statusFilter} inquiries found`
                      : activeTab === "manager"
                      ? "No property inquiries yet"
                      : "No support tickets submitted"}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm leading-relaxed">
                    {statusFilter !== "all"
                      ? "Try switching to the 'All' filter tab to view all of your past communications."
                      : activeTab === "manager"
                      ? "Have a repair request, lease inquiry, or question for your landlord? Use the form on the left to start a thread."
                      : "Need assistance with payments, account settings, or bug reports? Submit a support request on the left."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

