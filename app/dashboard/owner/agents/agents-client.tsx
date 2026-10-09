"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Users, UserPlus, Mail, Phone, MapPin, X, Eye, EyeOff, Trash2, MessageSquare, Pencil, Clock3, Shield, Search, Receipt, Save, CalendarDays, Building2, UsersRound, MoreHorizontal, Copy, Fingerprint, BriefcaseBusiness, Globe2, Cake, UserRound, Percent, Database, Table } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getOwnerAgents, registerAgent, deleteUser, deleteRejectedAgentApplication, updateUser, UserRecord, getAgentApplications, reviewAgentApplication, reopenAgentApplication, markAgentApplicationApproved, AgentApplication, getProperties, getUnits, getTenants, getPayments, Payment } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import MessagingModal from "@/components/messaging-modal";
import ReceiptModal from "@/components/receipt-modal";
import OwnerAgentBadges from "@/components/owner-agent-badges";
import { ManagementBanner } from "@/components/management-panel";

function getPasswordErrors(password: string) {
  const errors: string[] = [];
  if (password.length < 8) errors.push("at least 8 characters");
  if (!/[A-Z]/.test(password)) errors.push("one uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("one lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("one number");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("one special character");
  return errors;
}

function getPresenceLabel(lastSeenAt?: string | null, isOnline?: boolean) {
  if (!lastSeenAt) return "Not active yet";
  const lastSeen = new Date(lastSeenAt).getTime();
  if (Number.isNaN(lastSeen)) return "Unknown activity";

  const minutesAgo = Math.max(0, Math.floor((Date.now() - lastSeen) / 60_000));
  if (isOnline && minutesAgo < 2) return "Online now";
  if (minutesAgo < 1) return "Active just now";
  if (minutesAgo < 60) return `Active ${minutesAgo} minute${minutesAgo === 1 ? "" : "s"} ago`;
  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo < 24) return `Active ${hoursAgo} hour${hoursAgo === 1 ? "" : "s"} ago`;
  return `Active ${Math.floor(hoursAgo / 24)} day${Math.floor(hoursAgo / 24) === 1 ? "" : "s"} ago`;
}

function isRecentlyOnline(lastSeenAt?: string | null, isOnline?: boolean) {
  if (!isOnline || !lastSeenAt) return false;
  const lastSeen = new Date(lastSeenAt).getTime();
  return !Number.isNaN(lastSeen) && Date.now() - lastSeen < 2 * 60_000;
}

type CommissionPayment = Payment & {
  propertyLabel: string;
  unitLabel: string;
};


export default function OwnerAgentsPage() {
  const searchParams = useSearchParams();
  const [agents, setAgents] = useState<UserRecord[]>([]);
  const [agentStats, setAgentStats] = useState<Record<string, { properties: number; tenants: number; payments: number }>>({});
  const [commissionData, setCommissionData] = useState<Record<string, { collected: number; payments: CommissionPayment[] }>>({});
  const [commissionDataStatus, setCommissionDataStatus] = useState<"loading" | "ready" | "error">("loading");
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [deleteAgent, setDeleteAgent] = useState<UserRecord | null>(null);
  const [viewingAgent, setViewingAgent] = useState<UserRecord | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [isCommissionOpen, setIsCommissionOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [commissionPeriod, setCommissionPeriod] = useState("all");
  const [commissionRateInput, setCommissionRateInput] = useState("0");
  const [savingCommission, setSavingCommission] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<CommissionPayment | null>(null);
  const [editingAgent, setEditingAgent] = useState<UserRecord | null>(null);
  const [messagingAgent, setMessagingAgent] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [applications, setApplications] = useState<AgentApplication[]>([]);
  const [approvedApplications, setApprovedApplications] = useState<AgentApplication[]>([]);
  const [rejectedApplications, setRejectedApplications] = useState<AgentApplication[]>([]);
  const [agentView, setAgentView] = useState<"agents" | "applicants" | "approved" | "rejected">("agents");
  const [agentStatusFilter, setAgentStatusFilter] = useState<"all" | "pending">("all");
  const [selectedApplication, setSelectedApplication] = useState<AgentApplication | null>(null);
  const [applicationToDelete, setApplicationToDelete] = useState<AgentApplication | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [agentSearch, setAgentSearch] = useState("");
  const [applicantSearch, setApplicantSearch] = useState("");
  const [approvedApplicantSearch, setApprovedApplicantSearch] = useState("");
  const [rejectedApplicantSearch, setRejectedApplicantSearch] = useState("");
  const [selectedApplicantId, setSelectedApplicantId] = useState("");

  useEffect(() => {
    const requestedView = searchParams.get("view");
    if (requestedView === "agents" || requestedView === "applicants" || requestedView === "approved" || requestedView === "rejected") {
      setAgentView(requestedView);
      setAgentStatusFilter("all");
    }
  }, [searchParams]);

  const [agentForm, setAgentForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    gender: "",
    appliedDate: new Date().toISOString().slice(0, 10),
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAgentPassword, setShowAgentPassword] = useState(false);
  const [dismissedBadges, setDismissedBadges] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setCommissionDataStatus("loading");
    try {
      const agentRecords = await getOwnerAgents();
      setAgents(agentRecords);
      const [pendingApps, approvedApps, rejectedApps] = await Promise.all([
        getAgentApplications("pending"),
        getAgentApplications("approved"),
        getAgentApplications("rejected"),
      ]);
      setApplications(pendingApps);
      setApprovedApplications(approvedApps);
      setRejectedApplications(rejectedApps);

      const stats: Record<string, { properties: number; tenants: number; payments: number }> = {};
      const [properties, units, tenants, payments] = await Promise.all([
        getProperties(), getUnits(), getTenants(), getPayments(),
      ]);
      const commissions: Record<string, { collected: number; payments: CommissionPayment[] }> = {};
      const unitsById = new Map(units.map((unit) => [unit.id, unit]));
      const propertiesById = new Map(properties.map((property) => [property.id, property]));
      agentRecords.forEach((agent) => {
        const agentPropertyIds = new Set(properties.filter((property) => property.agentId === agent.id).map((property) => property.id));
        const agentUnitIds = new Set(units.filter((unit) => agentPropertyIds.has(unit.propertyId)).map((unit) => unit.id));
        const agentTenantIds = new Set(tenants.filter((tenant) => agentUnitIds.has(tenant.unitId || "")).map((tenant) => tenant.id));
        const agentPayments = payments.filter((payment) => agentTenantIds.has(payment.tenantId) && agentUnitIds.has(payment.unitId));
        const collectedPayments = agentPayments
          .filter((payment) => payment.status === "paid")
          .sort((left, right) => right.paymentDate.localeCompare(left.paymentDate))
          .map((payment) => {
            const unit = unitsById.get(payment.unitId);
            const property = unit ? propertiesById.get(unit.propertyId) : undefined;
            return {
              ...payment,
              propertyLabel: property?.name || payment.propertyName || "Property unavailable",
              unitLabel: unit ? `Unit ${unit.unitNumber}` : "Unit unavailable",
            };
          });
        stats[agent.id] = {
          properties: agentPropertyIds.size,
          tenants: agentTenantIds.size,
          payments: agentPayments.length,
        };
        commissions[agent.id] = {
          collected: collectedPayments.reduce((total, payment) => total + payment.amountPaid, 0),
          payments: collectedPayments,
        };
      });
      setAgentStats(stats);
      setCommissionData(commissions);
      setCommissionDataStatus("ready");
    } catch (err) {
      console.error("Agents page load error:", err);
      setCommissionDataStatus("error");
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openRegister = () => {
    setSelectedApplicantId("");
    setAgentForm({
      name: "",
      email: "",
      password: "",
      phone: "",
      address: "",
      gender: "",
      appliedDate: new Date().toISOString().slice(0, 10),
    });
    setShowAgentPassword(false);
    setIsRegisterOpen(true);
  };

  const closeRegister = () => {
    setIsRegisterOpen(false);
    setShowAgentPassword(false);
    setSelectedApplicantId("");
    setAgentForm({
      name: "",
      email: "",
      password: "",
      phone: "",
      address: "",
      gender: "",
      appliedDate: new Date().toISOString().slice(0, 10),
    });
  };

  const handleSelectApplicant = (applicantId: string) => {
    setSelectedApplicantId(applicantId);
    if (!applicantId) return;
    const applicant = applications.find((a) => a.id === applicantId);
    if (applicant) {
      setAgentForm((prev) => ({
        ...prev,
        name: applicant.name || prev.name,
        email: applicant.email || prev.email,
        phone: applicant.phone || prev.phone,
        address: applicant.address || prev.address,
        gender: applicant.gender || prev.gender,
        appliedDate: applicant.createdAt ? applicant.createdAt.slice(0, 10) : prev.appliedDate,
      }));
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!agentForm.name || !agentForm.email || !agentForm.password) {
      toast.error("Name, email, and password are required");
      return;
    }
    const passwordErrors = getPasswordErrors(agentForm.password);
    if (passwordErrors.length > 0) {
      toast.error(`Password must contain ${passwordErrors.join(", ")}`);
      return;
    }
    setIsSubmitting(true);
    try {
      const agent = await registerAgent({
        name: agentForm.name,
        email: agentForm.email,
        password: agentForm.password,
        phone: agentForm.phone || undefined,
        address: agentForm.address || undefined,
        gender: agentForm.gender || undefined,
        birthdate: agentForm.appliedDate || undefined,
        appliedDate: agentForm.appliedDate || undefined,
      });
      setAgents([agent, ...agents]);
      setSelectedAgentId(agent.id);
      setCommissionRateInput(String(agent.commissionRate ?? 0));

      const applicantToApprove = selectedApplicantId
        ? applications.find((a) => a.id === selectedApplicantId)
        : applications.find((a) => a.email.toLowerCase() === agentForm.email.toLowerCase());

      if (applicantToApprove) {
        try {
          await markAgentApplicationApproved(applicantToApprove.id);
          setApplications((current) => current.filter((a) => a.id !== applicantToApprove.id));
          setApprovedApplications((current) => [{ ...applicantToApprove, status: "approved" }, ...current]);
        } catch (appErr) {
          console.warn("Could not mark application as approved:", appErr);
        }
      }

      closeRegister();
      if (agent.emailSent) {
        toast.success(`Agent account created. Login details were emailed to ${agent.email}.`);
      } else {
        toast.error(agent.emailStatus === "not_configured"
          ? "Agent account created, but no login email was sent because SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS."
          : "Agent account created, but the login email could not be delivered. Check SMTP settings and server logs.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to register agent";
      if (process.env.NODE_ENV !== "production") {
        console.error("[RegisterAgent]", err);
      }
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteAgent) return;
    setIsSubmitting(true);
    try {
      await deleteUser(deleteAgent.id);
      setAgents(agents.filter(a => a.id !== deleteAgent.id));
      setDeleteAgent(null);
      toast.success("Agent deleted successfully!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete agent";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAgent = (agent: UserRecord) => {
    setEditingAgent(agent);
    setEditForm({ name: agent.name, email: agent.email, phone: agent.phone || "", address: agent.address || "" });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const updated = await updateUser(editingAgent.id, editForm);
      if (updated) {
        setAgents(agents.map(a => a.id === editingAgent.id ? { ...a, ...editForm } : a));
        toast.success("Agent updated successfully!");
        setEditingAgent(null);
      }
    } catch {
      toast.error("Failed to update agent");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCommission = (agent: UserRecord) => {
    setSelectedAgentId(agent.id);
    setCommissionRateInput(String(agent.commissionRate ?? 0));
    setCommissionPeriod("all");
    setSelectedPaymentId("");
    setIsCommissionOpen(true);
  };

  const handleSaveCommission = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const commissionAgent = agents.find((agent) => agent.id === selectedAgentId);
    if (!commissionAgent || savingCommission) return;
    const rate = Number(commissionRateInput);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      toast.error("Enter a commission rate from 0 to 100");
      return;
    }
    setSavingCommission(true);
    try {
      const updated = await updateUser(commissionAgent.id, { commissionRate: rate });
      if (!updated) throw new Error("Could not save commission rate");
      setAgents((current) => current.map((agent) => agent.id === commissionAgent.id ? { ...agent, commissionRate: rate } : agent));
      toast.success("Commission rate saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save commission rate");
    } finally {
      setSavingCommission(false);
    }
  };

  const handleOpenMessage = (agent: UserRecord) => {
    setMessagingAgent(agent);
  };

  const handleReviewApplication = async (status: "approved" | "rejected", reason?: string) => {
    if (!selectedApplication || isSubmitting) return;
    if (status === "rejected" && !reason?.trim()) {
      toast.error("Enter a reason before rejecting this application");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await reviewAgentApplication(selectedApplication.id, status, reason?.trim());
      if (!result?.success) throw new Error(result?.error || "Unable to review application");

      setApplications((current) => current.filter((item) => item.id !== selectedApplication.id));
      setRejectedApplications((current) => current.filter((item) => item.id !== selectedApplication.id));
      if (status === "approved" && result.agent) {
        setAgents((current) => [result.agent, ...current]);
        setApprovedApplications((current) => [{ ...selectedApplication, status: "approved" }, ...current]);
        if (result.emailSent) {
          toast.success("Applicant approved and agent account created. Credentials were emailed.");
        } else {
          toast.error(`Agent account was created, but the credentials email failed. Temporary password: ${result.temporaryPassword}`);
        }
      } else {
        setRejectedApplications((current) => [{ ...selectedApplication, status: "rejected", rejectionReason: reason?.trim(), reviewedAt: new Date().toISOString() }, ...current]);
        toast[result.emailSent ? "success" : "error"](result.emailSent ? "Applicant rejected and emailed" : "Applicant rejected, but the email could not be sent");
      }
      setSelectedApplication(null);
      setRejectionReason("");
      setShowRejectionForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to review application");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnToReview = async (application: AgentApplication) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await reopenAgentApplication(application.id);
      if (!result?.success) throw new Error(result?.error || "Unable to reopen application");
      setRejectedApplications((current) => current.filter((item) => item.id !== application.id));
      setApplications((current) => [result.application, ...current]);
      setSelectedApplication(null);
      toast.success("Application returned to pending review");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reopen application");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveRejectedApplication = async () => {
    if (!applicationToDelete || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await deleteRejectedAgentApplication(applicationToDelete.id);
      if (!result?.success) throw new Error(result?.error || "Unable to remove rejected application");
      setRejectedApplications((current) => current.filter((item) => item.id !== applicationToDelete.id));
      setApplicationToDelete(null);
      if (selectedApplication?.id === applicationToDelete.id) setSelectedApplication(null);
      toast.success("Rejected application removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove rejected application");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatLoginTime = (value?: string | null) => {
    if (!value) return "Not logged in yet";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  const filteredAgents = agents.filter((agent) =>
    (agentStatusFilter === "all" || agent.idVerificationStatus === "pending") &&
    `${agent.id} ${agent.name} ${agent.email} ${agent.phone || ""} ${agent.address || ""} ${agent.experience || ""}`.toLowerCase().includes(agentSearch.trim().toLowerCase())
  );
  const filteredApplications = applications.filter((application) =>
    `${application.name} ${application.email} ${application.address}`.toLowerCase().includes(applicantSearch.trim().toLowerCase())
  );
  const filteredApprovedApplications = approvedApplications.filter((application) =>
    `${application.name} ${application.email} ${application.address}`.toLowerCase().includes(approvedApplicantSearch.trim().toLowerCase())
  );
  const filteredRejectedApplications = rejectedApplications.filter((application) =>
    `${application.name} ${application.email} ${application.address} ${application.rejectionReason || ""}`.toLowerCase().includes(rejectedApplicantSearch.trim().toLowerCase())
  );
  const selectedAgent = filteredAgents.find((agent) => agent.id === selectedAgentId) || filteredAgents[0] || null;
  const selectedRate = selectedAgent?.commissionRate ?? 0;
  const selectedAgentPaidRentPayments = selectedAgent ? commissionData[selectedAgent.id]?.payments || [] : [];
  const selectedAgentPaidRentMonths = Array.from(new Set(
    selectedAgentPaidRentPayments
      .map((payment) => payment.paymentDate.slice(0, 7))
      .filter((month) => /^\d{4}-\d{2}$/.test(month))
  )).sort((left, right) => right.localeCompare(left));
  const selectedAgentPayments = commissionPeriod === "all"
    ? selectedAgentPaidRentPayments
    : selectedAgentPaidRentPayments.filter((payment) => payment.paymentDate.slice(0, 7) === commissionPeriod);
  const selectedPayment = selectedAgentPayments.find((payment) => payment.id === selectedPaymentId) || selectedAgentPayments[0] || null;
  const collectedRent = selectedAgentPayments.reduce((total, payment) => total + payment.amountPaid, 0);
  const earnedCommission = collectedRent * selectedRate / 100;
  const allTimeCollectedRent = selectedAgentPaidRentPayments.reduce((total, payment) => total + payment.amountPaid, 0);
  const allTimeEarnedCommission = allTimeCollectedRent * selectedRate / 100;
  const commissionPeriodLabel = commissionPeriod === "all"
    ? "All time"
    : new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(`${commissionPeriod}-01T12:00:00`));

  useEffect(() => {
    const visibleAgent = filteredAgents.find((agent) => agent.id === selectedAgentId) || filteredAgents[0] || null;
    if (visibleAgent && visibleAgent.id !== selectedAgentId) {
      setSelectedAgentId(visibleAgent.id);
      setCommissionRateInput(String(visibleAgent.commissionRate ?? 0));
      setCommissionPeriod("all");
      setSelectedPaymentId("");
    } else if (!visibleAgent && selectedAgentId) {
      setSelectedAgentId("");
    }
  }, [filteredAgents, selectedAgentId]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-6">
      <ManagementBanner
        category="AGENT MANAGEMENT"
        title={agentView === "agents" ? "Agents & Property Managers" : agentView === "applicants" ? "Agent Applicants" : agentView === "approved" ? "Approved Applicants" : "Rejected Applicants"}
        description="Manage your licensed agent team, monitor performance, and review rent-based commission statements."
        icon={Users}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Agent status filters" className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {[
            { label: "All agents", view: "agents" as const, filter: "all" as const, count: agents.length, active: agentView === "agents" && agentStatusFilter === "all" },
            { label: "Pending", view: "agents" as const, filter: "pending" as const, count: agents.filter((agent) => agent.idVerificationStatus === "pending").length, active: agentView === "agents" && agentStatusFilter === "pending" },
            { label: "Applicants", view: "applicants" as const, filter: "all" as const, count: applications.length, active: agentView === "applicants" },
            { label: "Approved", view: "approved" as const, filter: "all" as const, count: approvedApplications.length, active: agentView === "approved" },
            { label: "Rejected", view: "rejected" as const, filter: "all" as const, count: rejectedApplications.length, active: agentView === "rejected" },
          ].map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => { setAgentView(tab.view); setAgentStatusFilter(tab.filter); }}
              aria-current={tab.active ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${tab.active ? "bg-blue-700 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
            >
              {tab.label}<span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${tab.active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>{tab.count}</span>
            </button>
          ))}
        </nav>

        <Button
          onClick={openRegister}
          className="self-start sm:self-auto h-9 gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 text-xs font-semibold text-white shadow-sm"
        >
          <UserPlus className="h-4 w-4" />
          Register Agent
        </Button>
      </div>

      {agentView === "applicants" && (
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input value={applicantSearch} onChange={(event) => setApplicantSearch(event.target.value)} placeholder="Search applicants by name, email, or location" className="pl-9" />
          </div>
          {filteredApplications.length === 0 ? (
            <div className="rounded-2xl border border-border p-10 text-center text-text-secondary">
              {applications.length === 0 ? "No pending applicants." : "No applicants match your search."}
            </div>
          ) : filteredApplications.map((application) => (
            <button type="button" key={application.id} onClick={() => { setRejectionReason(""); setShowRejectionForm(false); setSelectedApplication(application); }} className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface p-4 text-left hover:bg-surface-secondary">
              <div><p className="font-semibold text-foreground">{application.name}</p><p className="text-sm text-text-secondary">{application.email} · {application.address}</p></div>
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">New applicant</Badge>
            </button>
          ))}
        </div>
      )}

      {agentView === "approved" && (
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input value={approvedApplicantSearch} onChange={(event) => setApprovedApplicantSearch(event.target.value)} placeholder="Search approved applicants by name, email, or location" className="pl-9" />
          </div>
          {filteredApprovedApplications.length === 0 ? (
            <div className="rounded-2xl border border-border p-10 text-center text-text-secondary">
              {approvedApplications.length === 0 ? "No approved applicants yet." : "No approved applicants match your search."}
            </div>
          ) : (
            filteredApprovedApplications.map((application) => (
              <button
                type="button"
                key={application.id}
                onClick={() => {
                  setRejectionReason("");
                  setShowRejectionForm(false);
                  setSelectedApplication(application);
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 text-left transition hover:bg-emerald-50/80"
              >
                <div>
                  <p className="font-semibold text-foreground">{application.name}</p>
                  <p className="text-sm text-text-secondary">{application.email} · {application.address}</p>
                  {application.createdAt && (
                    <p className="text-xs text-text-tertiary mt-1">
                      Applied: {new Date(application.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-800">
                  Approved · Account Created
                </Badge>
              </button>
            ))
          )}
        </div>
      )}

      {agentView === "rejected" && (
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input value={rejectedApplicantSearch} onChange={(event) => setRejectedApplicantSearch(event.target.value)} placeholder="Search rejected applicants by name, email, or location" className="pl-9" />
          </div>
          {filteredRejectedApplications.length === 0 ? (
            <div className="rounded-2xl border border-border p-10 text-center text-text-secondary">
              {rejectedApplications.length === 0 ? "No rejected applicants." : "No rejected applicants match your search."}
            </div>
          ) : (
            filteredRejectedApplications.map((application) => (
              <div key={application.id} className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50/40 p-3">
                <button type="button" onClick={() => { setSelectedApplication(application); setShowRejectionForm(false); setRejectionReason(""); }} className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-xl p-1 text-left transition hover:bg-red-50">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-foreground">{application.name}</span>
                    <span className="block truncate text-sm text-text-secondary">{application.email} · {application.address}</span>
                    {application.rejectionReason && <span className="mt-2 block text-sm text-red-700">Reason: {application.rejectionReason}</span>}
                  </span>
                  <Badge variant="outline" className="shrink-0 border-red-200 bg-red-50 text-red-700">Rejected · View</Badge>
                </button>
                <button type="button" title="Remove rejected applicant" aria-label={`Remove rejected application for ${application.name}`} disabled={isSubmitting} onClick={() => setApplicationToDelete(application)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-100 disabled:opacity-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {agentView === "agents" && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input value={agentSearch} onChange={(event) => setAgentSearch(event.target.value)} placeholder="Search agents by name, email, or location" className="pl-9" />
          </div>
        </div>
      )}

      {/* Register Modal */}
      <AnimatePresence>
        {isRegisterOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/30" onClick={closeRegister} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="relative w-full max-w-2xl max-h-[90vh] rounded-3xl border border-border bg-white shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <h3 className="text-base font-semibold">Register New Agent</h3>
                  <p className="text-[10px] text-text-secondary mt-0.5">Agents can manage tenants, units, and payments.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      closeRegister();
                      setAgentView("applicants");
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                  >
                    View Applications ({applications.length}) →
                  </button>
                  <button
                    onClick={closeRegister}
                    className="h-8 w-8 rounded-xl flex items-center justify-center text-text-secondary hover:text-foreground hover:bg-surface-secondary transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <form onSubmit={handleRegister} autoComplete="off" className="max-h-[calc(90vh-90px)] overflow-y-auto p-4 space-y-3">
                {applications.length > 0 && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="select-applicant" className="text-[11px] font-semibold text-blue-900 block">
                        Choose from Pending Applicants (Optional):
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          closeRegister();
                          setAgentView("applicants");
                        }}
                        className="text-[10px] font-medium text-blue-700 hover:underline"
                      >
                        View all applicants ({applications.length})
                      </button>
                    </div>
                    <Select
                      id="select-applicant"
                      value={selectedApplicantId}
                      onChange={(e) => handleSelectApplicant(e.target.value)}
                      className="bg-white text-xs border-blue-200"
                    >
                      <option value="">-- Manual Registration (New Agent) --</option>
                      {applications.map((app) => (
                        <option key={app.id} value={app.id}>
                          {app.name} ({app.email}) — Applied {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : ""}
                        </option>
                      ))}
                    </Select>
                    {selectedApplicantId && (
                      <p className="text-[10px] text-blue-700">
                        Applicant details loaded. Registering will create their account and mark their application as approved.
                      </p>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <label className="text-[10px] font-medium text-text-secondary mb-0.5 block">Full Name *</label>
                    <Input placeholder="e.g. Juan Dela Cruz" value={agentForm.name} onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })} required />
                  </div>
                  <div className="min-w-0">
                    <label className="text-[10px] font-medium text-text-secondary mb-0.5 block">Email *</label>
                    <Input name="agent-registration-email" autoComplete="off" placeholder="agent@example.com" type="email" value={agentForm.email} onChange={(e) => setAgentForm({ ...agentForm, email: e.target.value })} required />
                  </div>
                  <div className="min-w-0">
                    <label className="text-[10px] font-medium text-text-secondary mb-0.5 block">Password *</label>
                    <div className="relative">
                      <Input name="agent-registration-password" autoComplete="new-password" placeholder="8+ chars, uppercase, number, symbol" type={showAgentPassword ? "text" : "password"} minLength={8} value={agentForm.password} onChange={(e) => setAgentForm({ ...agentForm, password: e.target.value })} className="pr-10" required />
                      <button type="button" onClick={() => setShowAgentPassword((visible) => !visible)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-secondary" aria-label={showAgentPassword ? "Hide password" : "Show password"}>
                        {showAgentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <label className="text-[10px] font-medium text-text-secondary mb-0.5 block">Phone</label>
                    <Input placeholder="e.g. 09123456789" value={agentForm.phone} onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })} />
                  </div>
                  <div className="min-w-0">
                    <label className="text-[10px] font-medium text-text-secondary mb-0.5 block">Address</label>
                    <Select value={agentForm.address} onChange={(e) => setAgentForm({ ...agentForm, address: e.target.value })}>
                      <option value="">Select city</option><option value="Cebu">Cebu</option><option value="Manila">Manila</option><option value="Davao">Davao</option><option value="Butuan">Butuan</option>
                    </Select>
                  </div>
                  <div className="min-w-0">
                    <label className="text-[10px] font-medium text-text-secondary mb-0.5 block">Gender</label>
                    <Select value={agentForm.gender} onChange={(e) => setAgentForm({ ...agentForm, gender: e.target.value })}>
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </Select>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <label className="text-[10px] font-medium text-text-secondary mb-0.5 block">Applied Date</label>
                    <Input type="date" value={agentForm.appliedDate} onChange={(e) => setAgentForm({ ...agentForm, appliedDate: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="submit" disabled={isSubmitting} className="flex-1 h-8 text-[10px]">
                    {isSubmitting ? "Registering..." : "Register Agent"}
                  </Button>
                  <Button type="button" variant="outline" onClick={closeRegister} className="flex-1 h-8 text-[10px]">Cancel</Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedApplication && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
            <motion.div initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">Applicant Information</h3>
                  <Badge className={
                    selectedApplication.status === "rejected"
                      ? "mt-2 bg-red-100 text-red-700"
                      : selectedApplication.status === "approved"
                      ? "mt-2 bg-emerald-100 text-emerald-800"
                      : "mt-2 bg-amber-100 text-amber-700"
                  }>
                    {selectedApplication.status === "rejected"
                      ? "Rejected"
                      : selectedApplication.status === "approved"
                      ? "Approved · Account Created"
                      : "Pending review"}
                  </Badge>
                </div>
                <button onClick={() => { setSelectedApplication(null); setShowRejectionForm(false); setRejectionReason(""); }}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <p><b>Name</b><br />{selectedApplication.name}</p>
                <p><b>Email</b><br />{selectedApplication.email}</p>
                <p><b>Phone</b><br />{selectedApplication.phone || "N/A"}</p>
                <p><b>Location</b><br />{selectedApplication.address}</p>
                <p><b>Gender</b><br />{selectedApplication.gender || "N/A"}</p>
                <p><b>Date Applied</b><br />{selectedApplication.createdAt ? new Date(selectedApplication.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "N/A"}</p>
              </div>
              {selectedApplication.status === "rejected" && selectedApplication.rejectionReason && (
                <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"><b>Rejection reason:</b> {selectedApplication.rejectionReason}</p>
              )}
              <a href={`/api/agent-applications/${selectedApplication.id}/resume`} target="_blank" rel="noreferrer" className="mt-5 block rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-center text-sm font-medium text-blue-700">
                View Resume
              </a>
              {selectedApplication.status === "approved" ? (
                <div className="mt-5 flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      const appEmail = selectedApplication.email.toLowerCase();
                      const matchingAgent = agents.find((a) => a.email.toLowerCase() === appEmail);
                      setSelectedApplication(null);
                      setAgentView("agents");
                      if (matchingAgent) {
                        setSelectedAgentId(matchingAgent.id);
                      }
                    }}
                  >
                    View in Agent Roster
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedApplication(null)}>
                    Close
                  </Button>
                </div>
              ) : selectedApplication.status === "rejected" ? (
                <div className="mt-5 flex justify-end">
                  <Button disabled={isSubmitting} onClick={() => handleReturnToReview(selectedApplication)}>
                    {isSubmitting ? "Returning..." : "Return to pending applicants"}
                  </Button>
                </div>
              ) : showRejectionForm ? (
                <div className="mt-5 space-y-3">
                  <label htmlFor="application-rejection-reason" className="block text-sm font-medium text-slate-800">Reason for rejection *</label>
                  <textarea id="application-rejection-reason" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={1000} rows={4} required className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="Explain why this application is being rejected" />
                  <div className="flex gap-2">
                    <Button className="flex-1" disabled={isSubmitting || !rejectionReason.trim()} onClick={() => handleReviewApplication("rejected", rejectionReason)}>
                      {isSubmitting ? "Sending..." : "Reject & Email Applicant"}
                    </Button>
                    <Button variant="outline" disabled={isSubmitting} onClick={() => setShowRejectionForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex flex-col sm:flex-row gap-2">
                  <Button className="flex-1" disabled={isSubmitting} onClick={() => handleReviewApplication("approved")}>
                    {isSubmitting ? "Creating account..." : "Approve & Create Account"}
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      const app = selectedApplication;
                      setSelectedApplication(null);
                      openRegister();
                      handleSelectApplicant(app.id);
                    }}
                  >
                    Open in Register Form
                  </Button>
                  <Button variant="outline" disabled={isSubmitting} onClick={() => setShowRejectionForm(true)}>
                    Reject
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {applicationToDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="remove-application-title">
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600"><Trash2 className="h-5 w-5" /></div>
              <h3 id="remove-application-title" className="text-lg font-semibold text-slate-900">Remove rejected applicant?</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">This permanently deletes {applicationToDelete.name}&apos;s application and resume.</p>
              <div className="mt-5 flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => setApplicationToDelete(null)}>Cancel</Button>
                <Button type="button" variant="destructive" disabled={isSubmitting} onClick={handleRemoveRejectedApplication}>{isSubmitting ? "Removing..." : "Remove application"}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteAgent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/30" onClick={() => setDeleteAgent(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="relative w-full max-w-sm rounded-2xl border border-border bg-white shadow-2xl"
            >
              <div className="p-5 text-center">
                <div className="mx-auto h-10 w-10 rounded-full bg-red-100 flex items-center justify-center mb-3">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Delete Agent</h3>
                <p className="text-xs text-text-secondary">Are you sure you want to delete <span className="font-medium text-foreground">{deleteAgent.name}</span>? This action cannot be undone.</p>
              </div>
              <div className="flex gap-2 p-4 pt-0">
                <Button type="button" variant="outline" onClick={() => setDeleteAgent(null)} className="flex-1 h-9 text-xs">Cancel</Button>
                <Button type="button" onClick={handleDelete} disabled={isSubmitting} className="flex-1 h-9 text-xs bg-red-600 hover:bg-red-700 text-white">
                  {isSubmitting ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {agentView === "agents" && (
        <div className="min-w-0">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="agent-roster-title">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h3 id="agent-roster-title" className="text-sm font-bold text-slate-900">Agent roster</h3>
                <p className="mt-0.5 text-xs text-slate-500">Choose an agent to view their paid-rent statement.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600">{filteredAgents.length}</span>
            </div>

            {commissionDataStatus === "error" && (
              <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-red-100 bg-red-50 px-4 py-2.5 text-xs text-red-700">
                <span>Agent payment information could not be refreshed.</span>
                <button type="button" onClick={() => void loadData()} className="font-semibold underline underline-offset-2">Retry</button>
              </div>
            )}

            {filteredAgents.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Users className="mx-auto mb-3 h-9 w-9 text-slate-300" />
                <p className="text-sm font-semibold text-slate-700">{agents.length ? "No agents match this filter" : "No agents yet"}</p>
                <p className="mt-1 text-xs text-slate-500">{agents.length ? "Try another search or status filter." : "Register your first agent to get started."}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs text-slate-800">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold text-slate-700">Agent & ID</th>
                      <th scope="col" className="px-3 py-3 font-semibold text-slate-700">Contact & Address</th>
                      <th scope="col" className="px-3 py-3 font-semibold text-slate-700">Role & Verification</th>
                      <th scope="col" className="px-3 py-3 font-semibold text-slate-700">Rate</th>
                      <th scope="col" className="px-3 py-3 font-semibold text-slate-700">Portfolio</th>
                      <th scope="col" className="px-3 py-3 font-semibold text-slate-700">Collections & Earnings</th>
                      <th scope="col" className="px-3 py-3 font-semibold text-slate-700">Activity & Joined</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAgents.map((agent) => {
                      const agentPayments = commissionData[agent.id]?.payments || [];
                      const agentCollected = agentPayments.reduce((total, payment) => total + payment.amountPaid, 0);
                      const rate = agent.commissionRate ?? 0;
                      const isSelected = selectedAgent?.id === agent.id;
                      const online = isRecentlyOnline(agent.lastSeenAt, agent.isOnline);
                      const ready = commissionDataStatus === "ready";

                      return (
                        <tr key={agent.id} className={`group ${isSelected ? "bg-blue-50/70" : "hover:bg-slate-50/80 transition-colors"}`}>
                          {/* Agent & ID */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="relative shrink-0">
                                <Avatar src={agent.avatarUrl} fallback={getInitials(agent.name)} size="sm" />
                                <span
                                  className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center"
                                  title={getPresenceLabel(agent.lastSeenAt, agent.isOnline)}
                                >
                                  {online && (
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                  )}
                                  <span
                                    className={`relative inline-flex h-2 w-2 rounded-full border border-white ${
                                      online ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" : "bg-slate-400"
                                    }`}
                                  />
                                </span>
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-slate-900 capitalize truncate max-w-[140px]">
                                  {agent.name}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Copy agent ID for ${agent.name}`}
                                  title="Copy agent ID"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(agent.id).then(
                                      () => toast.success("Agent ID copied"),
                                      () => toast.error("Could not copy the agent ID")
                                    );
                                  }}
                                  className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-400 hover:text-blue-600 transition-colors"
                                >
                                  <span>#{agent.id.slice(0, 8)}</span>
                                  <Copy className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            </div>
                          </td>

                          {/* Contact & Address */}
                          <td className="px-3 py-3.5">
                            <div className="flex flex-col gap-1 text-xs">
                              <div className="flex items-center gap-1.5">
                                <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                                {agent.email ? (
                                  <a href={`mailto:${agent.email}`} className="text-blue-600 hover:underline truncate max-w-[170px]" title={agent.email}>
                                    {agent.email}
                                  </a>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                                {agent.phone ? (
                                  <a href={`tel:${agent.phone}`} className="hover:text-blue-600">
                                    {agent.phone}
                                  </a>
                                ) : (
                                  <span>—</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                                <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[180px]" title={agent.address || "No address provided"}>
                                  {agent.address || <span className="text-slate-400 italic">No address provided</span>}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Role & Verification */}
                          <td className="px-3 py-3.5">
                            <div className="flex flex-col gap-1 items-start">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 capitalize">
                                {agent.role || "Agent"}
                              </span>
                              <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-medium ${
                                agent.idVerificationStatus === "approved"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : agent.idVerificationStatus === "pending"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : agent.idVerificationStatus === "rejected"
                                  ? "bg-red-50 text-red-700 border border-red-200"
                                  : "bg-slate-100 text-slate-600"
                              }`}>
                                {agent.idVerificationStatus ? `${agent.idVerificationStatus} ID` : "unverified"}
                              </span>
                            </div>
                          </td>

                          {/* Rate */}
                          <td className="px-3 py-3.5 font-mono text-xs font-semibold tabular-nums text-slate-700">
                            {rate}%
                          </td>

                          {/* Portfolio */}
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums">
                              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 border border-blue-100" title="Properties">
                                {agentStats[agent.id]?.properties ?? 0} props
                              </span>
                              <span className="rounded bg-purple-50 px-1.5 py-0.5 text-purple-700 border border-purple-100" title="Tenants">
                                {agentStats[agent.id]?.tenants ?? 0} tenants
                              </span>
                            </div>
                          </td>

                          {/* Collections & Earnings */}
                          <td className="px-3 py-3.5">
                            <div className="flex flex-col gap-0.5 font-mono text-xs tabular-nums">
                              <span className="text-slate-600 text-[11px]">
                                Rent: {ready ? formatCurrency(agentCollected) : "…"}
                              </span>
                              <span className="font-semibold text-emerald-700">
                                Comm: {ready ? formatCurrency(agentCollected * rate / 100) : "…"}
                              </span>
                            </div>
                          </td>

                          {/* Activity & Joined */}
                          <td className="px-3 py-3.5">
                            <div className="flex flex-col gap-0.5 text-[11px]">
                              <span className={`inline-flex items-center gap-1 font-medium ${online ? "text-emerald-700" : "text-slate-500"}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-slate-400"}`} />
                                {online ? "Online" : agent.lastLoginAt ? formatLoginTime(agent.lastLoginAt) : "Offline"}
                              </span>
                              <span className="text-slate-400 text-[10px]">
                                Joined {agent.createdAt ? formatDate(agent.createdAt) : "—"}
                              </span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 text-right">
                            <span className="flex items-center gap-1.5 justify-end">
                              <Button type="button" size="sm" onClick={() => openCommission(agent)} className="h-7 px-2.5 text-[11px] font-semibold">
                                <span className="mr-1 font-bold text-[12px] leading-none">₱</span>Statement
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    aria-label={`Actions for ${agent.name}`}
                                    className="group/dotbtn h-7 w-7 shrink-0 border-slate-200 text-slate-600 transition-all duration-200 hover:scale-110 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 active:scale-95 focus-visible:ring-1 focus-visible:ring-blue-500"
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5 transition-transform duration-200 group-hover/dotbtn:rotate-90" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" side="bottom">
                                  <DropdownMenuItem onSelect={() => setViewingAgent(agent)} icon={<Eye className="h-4 w-4" />}>View</DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => handleEditAgent(agent)} icon={<Pencil className="h-4 w-4" />}>Edit</DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => handleOpenMessage(agent)} icon={<MessageSquare className="h-4 w-4" />}>Message</DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => setDeleteAgent(agent)} icon={<Trash2 className="h-4 w-4 text-red-500" />} className="text-red-600 hover:bg-red-50">Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="sticky left-0 flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 font-mono text-[11px] text-slate-500">
                  <div>
                    <span>{filteredAgents.length} {filteredAgents.length === 1 ? "record" : "records"}</span>
                  </div>
                  <div>
                    <span>8 columns</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      <Modal
        isOpen={isCommissionOpen && agentView === "agents" && !!selectedAgent}
        onClose={() => setIsCommissionOpen(false)}
        title={selectedAgent ? `${selectedAgent.name} commission statement` : "Commission statement"}
        description="Review collected rent and commission calculated from paid payments only."
        className="flex max-h-[calc(100dvh-1rem)] max-w-6xl flex-col overflow-hidden sm:max-h-[calc(100dvh-2rem)]"
      >
        {selectedAgent && (
          <div className="max-h-[calc(100dvh-10rem)] space-y-4 overflow-y-auto pr-1 sm:max-h-[calc(100dvh-11rem)]">
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-end sm:justify-between">
              <label htmlFor="commission-agent-select" className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-slate-700">
                Agent
                <select
                  id="commission-agent-select"
                  value={selectedAgent.id}
                  onChange={(event) => {
                    const agent = filteredAgents.find((item) => item.id === event.target.value);
                    if (agent) openCommission(agent);
                  }}
                  className="h-9 min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {filteredAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                </select>
              </label>
              <label htmlFor="commission-period" className="flex shrink-0 items-center gap-2 text-xs font-medium text-slate-600">
                <CalendarDays className="h-4 w-4 text-slate-500" />
                Commission period
                <select id="commission-period" value={commissionPeriod} onChange={(event) => { setCommissionPeriod(event.target.value); setSelectedPaymentId(""); }} className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <option value="all">All time</option>
                  {selectedAgentPaidRentMonths.map((month) => (
                    <option key={month} value={month}>{new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(`${month}-01T12:00:00`))}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.8fr)]">
              <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="commission-ledger-title">
                <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 id="commission-ledger-title" className="text-sm font-bold text-slate-900">Paid-rent commission breakdown</h3>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{selectedAgent.name} · {commissionPeriodLabel} · paid rent only</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">{selectedAgentPayments.length} paid {selectedAgentPayments.length === 1 ? "payment" : "payments"}</span>
                </div>
                <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200">
                  <div className="bg-white px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Collected rent</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{commissionDataStatus === "ready" ? formatCurrency(collectedRent) : "—"}</p>
                  </div>
                  <div className="bg-white px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Commission on paid rent · {selectedRate}%</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-emerald-700">{commissionDataStatus === "ready" ? formatCurrency(earnedCommission) : "—"}</p>
                  </div>
                </div>
                <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[10px] leading-relaxed text-slate-600">Earned commission is calculated from payments marked paid for tenants in this agent’s linked units. Pending, partial, and overdue amounts are excluded; this is not a payout ledger.</p>
                {commissionDataStatus === "loading" ? (
                  <p role="status" className="px-4 py-10 text-center text-xs text-slate-500">Loading paid payment history…</p>
                ) : selectedAgentPayments.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <Receipt className="mx-auto mb-2 h-7 w-7 text-slate-300" />
                    <p className="text-xs font-semibold text-slate-700">No paid rent in this period</p>
                    <p className="mt-1 text-[10px] text-slate-500">Recorded paid payments will appear here with their calculated commission.</p>
                  </div>
                ) : (
                  <>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[680px] border-collapse text-left">
                        <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-2 py-2">Property / tenant</th><th className="px-2 py-2 text-right">Rent collected</th><th className="px-2 py-2 text-right">Commission on paid rent</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Paid date</th><th className="px-2 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedAgentPayments.map((payment) => (
                            <tr key={payment.id} className={`${selectedPayment?.id === payment.id ? "bg-blue-50/60" : "hover:bg-slate-50"}`}>
                              <td className="max-w-[210px] px-2 py-1.5">
                                <button type="button" onClick={() => setSelectedPaymentId(payment.id)} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                                  <span className="block truncate text-xs font-semibold text-slate-800">{payment.propertyLabel}</span>
                                  <span className="mt-0.5 block truncate text-[10px] text-slate-500">{payment.unitLabel} · {payment.tenantName}</span>
                                </button>
                              </td>
                              <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs tabular-nums text-slate-700">{formatCurrency(payment.amountPaid)}</td>
                              <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs font-semibold tabular-nums text-emerald-700">{formatCurrency(payment.amountPaid * selectedRate / 100)}</td>
                              <td className="px-2 py-1.5"><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Paid</span></td>
                              <td className="whitespace-nowrap px-2 py-1.5 text-xs text-slate-600">{payment.paymentDate ? formatDate(payment.paymentDate) : "Date unavailable"}</td>
                              <td className="px-2 py-1.5">
                                <button type="button" onClick={() => setSelectedPaymentId(payment.id)} aria-label={`View payment details for ${payment.tenantName}`} className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Details</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <ul className="divide-y divide-slate-100 md:hidden">
                      {selectedAgentPayments.map((payment) => (
                        <li key={payment.id} className={`p-2 ${selectedPayment?.id === payment.id ? "bg-blue-50/60" : ""}`}>
                          <button type="button" onClick={() => setSelectedPaymentId(payment.id)} className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                            <span className="flex items-start justify-between gap-3">
                              <span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-800">{payment.propertyLabel} · {payment.unitLabel}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{payment.tenantName}</span></span>
                              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Paid</span>
                            </span>
                            <span className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] text-slate-500">
                              <span>{payment.paymentDate ? formatDate(payment.paymentDate) : "Date unavailable"}</span>
                              <span className="font-semibold tabular-nums text-slate-700">{formatCurrency(payment.amountPaid)} rent</span>
                              <span className="font-semibold tabular-nums text-emerald-700">{formatCurrency(payment.amountPaid * selectedRate / 100)} paid-rent commission</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>

              <section className="min-w-0 space-y-4" aria-label="Selected agent and payment details">
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 bg-[#f4f8fd] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">Commission statement</p>
                    <div className="mt-2 flex items-center gap-3">
                      <Avatar src={selectedAgent.avatarUrl} fallback={getInitials(selectedAgent.name)} size="md" />
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-slate-900">{selectedAgent.name}</h3>
                        <p className="truncate text-xs text-slate-500">{selectedAgent.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-medium text-slate-500">{commissionPeriod === "all" ? "All-time paid rent" : `${commissionPeriodLabel} paid rent`}</p>
                        <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">{commissionDataStatus === "ready" ? formatCurrency(collectedRent) : "—"}</p>
                      </div>
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
                        <p className="text-[10px] font-medium text-emerald-800">{commissionPeriod === "all" ? "All-time paid-rent commission" : `${commissionPeriodLabel} paid-rent commission`}</p>
                        <p className="mt-1 text-sm font-bold tabular-nums text-emerald-800">{commissionDataStatus === "ready" ? formatCurrency(earnedCommission) : "—"}</p>
                      </div>
                    </div>
                    {commissionPeriod !== "all" && (
                      <p className="text-[10px] text-slate-500">All time: {commissionDataStatus === "ready" ? formatCurrency(allTimeEarnedCommission) : "—"} commission on {commissionDataStatus === "ready" ? formatCurrency(allTimeCollectedRent) : "—"} paid rent.</p>
                    )}
                    <form onSubmit={handleSaveCommission} className="border-t border-slate-100 pt-3">
                      <label htmlFor="agent-commission-rate" className="block text-xs font-semibold text-slate-800">Commission rate</label>
                      <p className="mt-1 text-[10px] text-slate-500">Owner-controlled · applied to paid rent only.</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="flex h-9 min-w-0 flex-1 items-center rounded-md border border-slate-300 bg-white px-2.5 focus-within:ring-2 focus-within:ring-blue-500">
                          <input id="agent-commission-rate" type="number" min="0" max="100" step="0.01" required value={commissionRateInput} onChange={(event) => setCommissionRateInput(event.target.value)} className="w-full border-0 bg-transparent text-sm font-semibold text-slate-900 outline-none" aria-describedby="commission-rate-help" />
                          <span className="text-sm text-slate-500">%</span>
                        </span>
                        <Button type="submit" size="sm" disabled={savingCommission} className="h-9 shrink-0">
                          {savingCommission ? "Saving…" : <><Save className="mr-1.5 h-3.5 w-3.5" />Save rate</>}
                        </Button>
                      </div>
                      <p id="commission-rate-help" className="mt-2 text-[10px] leading-relaxed text-slate-500">Paid-rent commission = amount paid × saved rate. Pending, partial, and overdue payments are excluded.</p>
                    </form>
                    <div className="border-t border-dashed border-slate-300 pt-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-slate-700">Paid-rent commission · {commissionPeriodLabel}</span>
                        <span className="text-sm font-bold tabular-nums text-emerald-700">{commissionDataStatus === "ready" ? formatCurrency(earnedCommission) : "—"}</span>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">Breakdown of collected rent, not a commission payout or salary record.</p>
                    </div>
                  </div>
                </section>
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="payment-detail-title">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Selected paid payment</p>
                      <h3 id="payment-detail-title" className="mt-0.5 text-sm font-bold text-slate-900">Payment detail</h3>
                    </div>
                    <Receipt className="h-4 w-4 text-blue-700" />
                  </div>
                  {selectedPayment ? (
                    <div className="p-4">
                      <div className="rounded-lg border border-dashed border-slate-300 bg-[#fbfdff] p-4">
                        <div className="border-b border-dashed border-slate-300 pb-3 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Collected rent</p>
                          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{formatCurrency(selectedPayment.amountPaid)}</p>
                          <p className="mt-1 text-[10px] text-slate-500">Payment date · {selectedPayment.paymentDate ? formatDate(selectedPayment.paymentDate) : "Date unavailable"}</p>
                        </div>
                        <dl className="space-y-2 pt-3 text-xs">
                          <div className="flex justify-between gap-3"><dt className="text-slate-500">Tenant</dt><dd className="max-w-[65%] truncate text-right font-semibold text-slate-800">{selectedPayment.tenantName}</dd></div>
                          <div className="flex justify-between gap-3"><dt className="text-slate-500">Property</dt><dd className="max-w-[65%] truncate text-right font-semibold text-slate-800">{selectedPayment.propertyLabel}</dd></div>
                          <div className="flex justify-between gap-3"><dt className="text-slate-500">Unit</dt><dd className="text-right font-semibold text-slate-800">{selectedPayment.unitLabel}</dd></div>
                          <div className="flex justify-between gap-3"><dt className="text-slate-500">Payment method</dt><dd className="text-right font-semibold capitalize text-slate-800">{selectedPayment.paymentMethod === "upload_receipt" ? "Uploaded receipt" : "Cash"}{selectedPayment.paymentMethodNote ? ` · ${selectedPayment.paymentMethodNote}` : ""}</dd></div>
                          <div className="flex justify-between gap-3"><dt className="text-slate-500">Payment status</dt><dd className="font-semibold text-emerald-700">Paid</dd></div>
                          <div className="flex justify-between gap-3 border-t border-dashed border-slate-300 pt-2"><dt className="text-slate-600">Commission on paid rent · {selectedRate}%</dt><dd className="font-bold tabular-nums text-emerald-700">{formatCurrency(selectedPayment.amountPaid * selectedRate / 100)}</dd></div>
                        </dl>
                      </div>
                      {selectedPayment.receiptUrl ? (
                        <button type="button" onClick={() => setReceiptPayment(selectedPayment)} className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 text-xs font-semibold text-blue-800 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                          <Receipt className="h-3.5 w-3.5" />Open rent payment receipt
                        </button>
                      ) : (
                        <p className="mt-3 text-center text-[10px] text-slate-500">No uploaded receipt is attached to this payment. This statement is a commission calculation, not a payout receipt.</p>
                      )}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-xs text-slate-500">Select a paid payment from the ledger to view its details.</div>
                  )}
                </section>
              </section>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Agent Modal */}
      {editingAgent && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingAgent(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-white shadow-2xl">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Edit Agent</h3>
                <p className="text-sm text-text-secondary">Update agent information</p>
              </div>
              <button onClick={() => setEditingAgent(null)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-foreground hover:bg-surface-secondary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Full Name *</label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Email *</label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Phone</label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Address</label>
                <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingAgent(null)} className="flex-1">Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1">{isSubmitting ? "Saving..." : "Save Changes"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Messaging Modal */}
      {messagingAgent && (
        <MessagingModal
          isOpen={!!messagingAgent}
          onClose={() => setMessagingAgent(null)}
          otherUser={{
            id: messagingAgent.id,
            name: messagingAgent.name,
            email: messagingAgent.email,
            role: messagingAgent.role,
            avatarUrl: messagingAgent.avatarUrl,
            allowMessages: true,
          }}
          properties={[]}
        />
      )}

      {/* Agent Details Modal */}
      <AnimatePresence>
        {viewingAgent && (
          <motion.div
            key="agent-details-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setViewingAgent(null)} />
            <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Agent Details</h3>
                  <p className="text-sm text-text-secondary">Agent profile and information</p>
                </div>
                <button onClick={() => setViewingAgent(null)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-foreground hover:bg-surface-secondary transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-start gap-4">
                  <Avatar src={viewingAgent.avatarUrl} fallback={getInitials(viewingAgent.name)} size="lg" />
                  <div className="flex-1">
                    <h4 className="text-base font-semibold text-foreground">{viewingAgent.name}</h4>
                    <p className="text-sm text-text-secondary">{viewingAgent.email}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] font-medium capitalize">agent</Badge>
                      {!dismissedBadges.has(`${viewingAgent.id}-presence`) && (
                        <motion.div
                          key="presence"
                          initial={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.2 }}
                        >
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${viewingAgent.isOnline ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-50 text-slate-600 border border-slate-200"}`}
                            onClick={() => setDismissedBadges(prev => new Set(prev).add(`${viewingAgent.id}-presence`))}
                            style={{ cursor: 'pointer' }}
                            title="Click to dismiss"
                          >
                            <span className={`relative flex h-2 w-2 ${viewingAgent.isOnline ? "text-emerald-500" : "text-slate-400"}`}>
                              {viewingAgent.isOnline && (
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                              )}
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${viewingAgent.isOnline ? "bg-emerald-500" : "bg-slate-400"}`}></span>
                            </span>
                            {viewingAgent.isOnline ? "Online" : "Offline"}
                          </span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-surface-secondary">
                    <p className="text-xs text-text-secondary mb-1">Last Login</p>
                    <p className="text-sm font-medium text-foreground">{formatLoginTime(viewingAgent.lastLoginAt)}</p>
                  </div>
                  {viewingAgent.phone && (
                    <div className="p-4 rounded-xl bg-surface-secondary">
                      <p className="text-xs text-text-secondary mb-1">Phone</p>
                      <p className="text-sm font-medium text-foreground">{viewingAgent.phone}</p>
                    </div>
                  )}
                  <div className="p-4 rounded-xl bg-surface-secondary">
                    <p className="text-xs text-text-secondary mb-1">Address</p>
                    <p className="text-sm font-medium text-foreground">{viewingAgent.address || "No address provided"}</p>
                  </div>
                  {viewingAgent.gender && (
                    <div className="p-4 rounded-xl bg-surface-secondary">
                      <p className="text-xs text-text-secondary mb-1">Gender</p>
                      <p className="text-sm font-medium text-foreground">{viewingAgent.gender}</p>
                    </div>
                  )}
                  {viewingAgent.birthdate && (
                    <div className="p-4 rounded-xl bg-surface-secondary">
                      <p className="text-xs text-text-secondary mb-1">Birthdate</p>
                      <p className="text-sm font-medium text-foreground">{viewingAgent.birthdate}</p>
                    </div>
                  )}
                </div>

                {agentStats[viewingAgent.id] && (
                  <div>
                    <p className="text-xs text-text-secondary mb-2">Performance</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-3 rounded-xl bg-surface-secondary text-center">
                        <p className="text-[10px] text-text-secondary">Properties</p>
                        <p className="text-lg font-semibold text-foreground">{agentStats[viewingAgent.id].properties}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-surface-secondary text-center">
                        <p className="text-[10px] text-text-secondary">Tenants</p>
                        <p className="text-lg font-semibold text-foreground">{agentStats[viewingAgent.id].tenants}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-surface-secondary text-center">
                        <p className="text-[10px] text-text-secondary">Payments</p>
                        <p className="text-lg font-semibold text-foreground">{agentStats[viewingAgent.id].payments}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-xl border border-border">
                  <p className="text-xs text-text-secondary mb-2">Account Information</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">Member Since</span>
                      <span className="text-foreground font-medium">{new Date(viewingAgent.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">Account ID</span>
                      <span className="text-foreground font-mono text-[10px]">{viewingAgent.id}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">Role</span>
                      <span className="text-foreground font-medium capitalize">{viewingAgent.role}</span>
                    </div>
                  </div>
                  <OwnerAgentBadges key={viewingAgent.id} agentId={viewingAgent.id} />
                </div>
              </div>
              <div className="p-6 border-t border-border">
                <Button variant="outline" onClick={() => setViewingAgent(null)} className="w-full">Close</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ReceiptModal
        isOpen={!!receiptPayment}
        onClose={() => setReceiptPayment(null)}
        receiptUrl={receiptPayment?.receiptUrl || null}
        payment={receiptPayment || undefined}
      />
    </motion.div>
  );
}
