"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard, Home, UserPlus, ClipboardCheck, Clock, ArrowUpRight, CalendarDays,
  CreditCard, FileText, Send, Download,
  CheckCircle2, Mail, User, Award,
  Search, Plus, X, Users, ChevronDown, XCircle, Building2, RotateCcw, Phone,
} from "lucide-react";
import PropertyLocationMap from "@/components/property-location-map-loader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import AssignTenantModal from "@/components/assign-tenant-modal";
import AccountRequestModal from "@/components/account-request-modal";
import ReceiptModal from "@/components/receipt-modal";
import { useAuth } from "@/lib/auth";
import {
  getProperties, getUnits, getTenants, getPayments,
  getConversations, notifyAdmins, updateTenantStatus,
  getInquiries, updateInquiryStatus, safeParseJson,
  updateInquiryProperty, Property, Unit, TenantRecord, Payment, Conversation, ChatInquiry,
} from "@/lib/data";
import { cn, formatCurrency, formatDate, formatDateTime, getTimeAgo, getInitials } from "@/lib/utils";
import { downloadExcelReport, downloadPdfReport } from "@/lib/report-downloads";
import { toast } from "sonner";
import MessagingModal from "@/components/messaging-modal";
import ProfilePanel from "@/components/profile-panel";
import AgentCertificateManager from "@/components/agent-certificate-manager";
import ContractsPanel from "@/components/contracts-panel";
import UnitImageCarousel from "@/components/unit-image-carousel";
import { ManagementBanner, UnitMetrics, UnitStatus, ManagementPagination } from "@/components/management-panel";
import management from "@/components/management-panel.module.css";

type Step = "overview" | "units" | "properties" | "assign" | "tenants" | "payments" | "history" | "messages" | "inquiries" | "contracts" | "profile" | "map" | "certificates";

const LIST_PAGE_SIZE = 10;

function PaginationControls({ page, total, onPageChange }: { page: number; total: number; onPageChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const start = total === 0 ? 0 : (currentPage - 1) * LIST_PAGE_SIZE + 1;
  const end = Math.min(currentPage * LIST_PAGE_SIZE, total);

  return (
    <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <span>Showing {start}–{end} of {total}</span>
      <div className="flex items-center gap-2">
        <button type="button" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} className="rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
        <span className="tabular-nums">Page {currentPage} of {pages}</span>
        <button type="button" disabled={currentPage >= pages} onClick={() => onPageChange(currentPage + 1)} className="rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}

function searchablePaymentText(payment: Payment) {
  return `${payment.id} ${payment.tenantName} ${payment.propertyName} ${payment.unitId} ${payment.status} ${payment.paymentMethod} ${payment.paymentDate} ${formatDate(payment.paymentDate)} ${payment.amountPaid} ${payment.amountDue} ${payment.balance} ${formatCurrency(payment.amountPaid)} ${formatCurrency(payment.amountDue)} ${formatCurrency(payment.balance)}`;
}

function searchablePropertyText(property: Property) {
  return `${property.name} ${property.location} ${property.type} ${(property.features || []).join(" ")}`;
}

function searchableUnitText(unit: Unit) {
  return `unit ${unit.id} ${unit.unitNumber} ${unit.floor || ""} ${unit.status} ${unit.rentAmount} ${formatCurrency(unit.rentAmount)}`;
}

function searchableInquiryText(inquiry: ChatInquiry) {
  return `${inquiry.senderName} ${inquiry.senderEmail} ${inquiry.senderPhone || ""} ${inquiry.text} ${inquiry.replyText || ""} ${inquiry.visitorReply || ""} ${inquiry.status} ${inquiry.propertyId ? "property" : "general"}`;
}

const flowSteps: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Dashboard", icon: LayoutDashboard },
  { key: "map", label: "Property Map", icon: Home },
  { key: "units", label: "Units", icon: Home },
  { key: "tenants", label: "Tenants", icon: Users },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "contracts", label: "Contracts", icon: FileText },
  { key: "certificates", label: "Certificates", icon: Award },
  { key: "messages", label: "Messages", icon: Send },
  { key: "inquiries", label: "Inquiries", icon: Mail },
  { key: "profile", label: "Profile", icon: User },
];

export default function AgentDashboard() {
  const { user, isAuthenticated, isLoading, refreshUser } = useAuth();
  const reduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<Step>("overview");
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [isMessagingOpen, setIsMessagingOpen] = useState(false);
  const [inquiries, setInquiries] = useState<ChatInquiry[]>([]);
  const [updatingInquiryType, setUpdatingInquiryType] = useState<string | null>(null);
  const [replyingInquiry, setReplyingInquiry] = useState<string | null>(null);
  const [inquiryReply, setInquiryReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [viewingThread, setViewingThread] = useState<ChatInquiry | null>(null);
  const [threadMessages, setThreadMessages] = useState<ChatInquiry[]>([]);
  const [threadReply, setThreadReply] = useState("");
  const [threadSending, setThreadSending] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const lastLocalReplyAt = useRef<string | null>(null);

  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<TenantRecord | null>(null);
  const [tenantSearch, setTenantSearch] = useState("");
  const [tenantListSearch, setTenantListSearch] = useState("");
  const [tenantListFilter, setTenantListFilter] = useState("all");
  const [unitSearch, setUnitSearch] = useState("");
  const [unitStatusFilter, setUnitStatusFilter] = useState("all");
  const [unitPropertyFilter, setUnitPropertyFilter] = useState("all");
  const [unitTypeFilter, setUnitTypeFilter] = useState("all");
  const [assignmentPropertyFilter, setAssignmentPropertyFilter] = useState("all");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("all");
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentSort, setPaymentSort] = useState<{ key: "paymentDate" | "tenantName" | "unitId" | "paymentMethod" | "amountPaid" | "status" | "id"; direction: "asc" | "desc" }>({ key: "paymentDate", direction: "desc" });
  const [unitPage, setUnitPage] = useState(1);
  const [unitSort, setUnitSort] = useState("unit-asc");
  const [inquiryPage, setInquiryPage] = useState(1);
  const [paymentDateFrom, setPaymentDateFrom] = useState("");
  const [paymentDateTo, setPaymentDateTo] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [messageFilter, setMessageFilter] = useState("all");
  const [inquirySearch, setInquirySearch] = useState("");
  const [inquiryFilter, setInquiryFilter] = useState("all");
  const [inquiryTypeFilter, setInquiryTypeFilter] = useState("all");
  const [inquiryDateFrom, setInquiryDateFrom] = useState("");
  const [inquiryDateTo, setInquiryDateTo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAccountRequestModal, setShowAccountRequestModal] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [, setIsRefreshing] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<Payment | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return [];
    setIsRefreshing(true);
    setLoadError(false);
    try {
      const [props, unitsData, tenantsData, paymentsData, convs, inquiriesData] = await Promise.all([
        getProperties(user),
        getUnits(user),
        getTenants(user),
        getPayments(user),
        getConversations(),
        getInquiries(),
      ]);
      const assignedProperties = props.filter((property) => property.agentId === user.id);
      const assignedPropertyIds = new Set(assignedProperties.map((property) => property.id));
      const assignedUnits = unitsData.filter((unit) => assignedPropertyIds.has(unit.propertyId));
      setProperties(assignedProperties);
      setUnits(assignedUnits);
      setTenants(tenantsData);
      const managedTenantIds = new Set(tenantsData.map((tenant) => tenant.id));
      const filteredPayments = paymentsData.filter((payment: Payment) =>
        payment.createdBy === user.id || payment.verifiedBy === user.id || managedTenantIds.has(payment.tenantId)
      );
      setPayments(filteredPayments);
      setConversations(convs);
      const filteredInquiries = inquiriesData.filter((inq: any) => inq.agentId === user.id);
      setInquiries(filteredInquiries);
      setInitialLoad(false);
      return filteredInquiries;
    } catch (err) {
      console.error("Agent dashboard load error:", err);
      setLoadError(true);
      return [];
    } finally {
      setInitialLoad(false);
      setIsRefreshing(false);
    }
  }, [user]);

  const closeThread = () => {
    setViewingThread(null);
    setThreadMessages([]);
    setThreadReply("");
    lastLocalReplyAt.current = null;
  };

  const markInquiryRead = async (inquiryId: string) => {
    try {
      await updateInquiryStatus(inquiryId, "read");
      setInquiries((prev) => prev.map((item) => item.id === inquiryId ? { ...item, status: "read" } : item));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("renttrack-notifications-updated"));
      }
    } catch {
      toast.error("Failed to mark as read");
    }
  };

  const changeInquiryProperty = async (inquiry: ChatInquiry, propertyId: string | null) => {
    if (updatingInquiryType === inquiry.id || propertyId === (inquiry.propertyId || null)) return;
    setUpdatingInquiryType(inquiry.id);
    try {
      await updateInquiryProperty(inquiry.id, propertyId);
      setInquiries((current) => current.map((item) => item.id === inquiry.id ? { ...item, propertyId: propertyId || undefined } : item));
      toast.success(propertyId ? "Inquiry linked to property" : "Inquiry changed to general");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update inquiry category");
    } finally {
      setUpdatingInquiryType(null);
    }
  };

   const sendThreadReply = async () => {
    if (!viewingThread || !threadReply.trim()) return;
    setThreadSending(true);
    try {
      const result = await updateInquiryStatus(viewingThread.id, "replied", threadReply.trim());
      if (!result || !result.success) {
         toast.error("Failed to send reply");
        setThreadSending(false);
        return;
      }
      const reply = threadReply.trim();
      const nowIso = new Date().toISOString();
      lastLocalReplyAt.current = nowIso;
      setThreadMessages((prev) => {
        const targetEmail = viewingThread.senderEmail;
        const refreshed = prev.filter((item) => item.senderEmail && targetEmail && item.senderEmail.toLowerCase().trim() === targetEmail.toLowerCase().trim());
        return refreshed.map((item) => item.id === viewingThread.id ? { ...item, status: "replied", replyText: reply, repliedAt: nowIso, agentName: user?.name } : item);
      });
      setInquiries((prev) => prev.map((item) => item.id === viewingThread.id ? { ...item, status: "replied", replyText: reply, repliedAt: nowIso, agentName: user?.name } : item));
      setThreadReply("");
      toast.success(result.emailSent ? "Reply sent and email notification delivered" : "Reply saved, but email notification could not be sent");
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setThreadSending(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const refreshProfileData = () => {
      loadData();
    };
    window.addEventListener("renttrack-profile-updated", refreshProfileData);
    return () => window.removeEventListener("renttrack-profile-updated", refreshProfileData);
  }, [loadData]);

  useEffect(() => {
    if (activeTab === "profile") {
      refreshUser();
    }
  }, [activeTab, refreshUser]);

  useEffect(() => {
    if (!viewingThread) return;
    let cancelled = false;
    const refreshThread = async () => {
      try {
        const result = await getInquiries();
        if (cancelled) return;
        const thread = result.filter((item) => item.senderEmail && viewingThread.senderEmail && item.senderEmail.toLowerCase().trim() === viewingThread.senderEmail.toLowerCase().trim()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setThreadMessages((prev) => {
          const prevMap = new Map(prev.map((item) => [item.id, item]));
          return thread.map((serverItem) => {
            const localItem = prevMap.get(serverItem.id);
            if (localItem && localItem.replyText && localItem.repliedAt && localItem.repliedAt >= (serverItem.repliedAt || "")) {
              return localItem;
            }
            return serverItem;
          });
        });
        setInquiries(result);
      } catch {
        // ignore background poll errors
      }
    };
    refreshThread();
    const interval = window.setInterval(refreshThread, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [viewingThread]);

  useEffect(() => {
    if (activeTab !== "inquiries" || inquiries.length === 0) return;
    const unread = inquiries.filter((item) => item.status === "new");
    if (unread.length === 0) return;

    const unreadIds = unread.map((item) => item.id);
    Promise.allSettled(unreadIds.map((id) => updateInquiryStatus(id, "read")))
      .then(() => {
        setInquiries((prev) => prev.map((item) => unreadIds.includes(item.id) ? { ...item, status: "read" } : item));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("renttrack-notifications-updated"));
        }
      })
      .catch(() => toast.error("Failed to update inquiry status"));
  }, [activeTab, inquiries]);

  const listAnimation = {
    hidden: { opacity: 0, y: 10 },
    visible: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.22, delay: index * 0.04, ease: [0.25, 0.1, 0.25, 1] as const },
    }),
  } as const;

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadMessages]);

  const userRef = useRef(user);
  const loadDataRef = useRef(loadData);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  useEffect(() => {
    const readHash = () => {
      const rawHash = window.location.hash.replace("#", "");
      const hash = rawHash === "properties" || rawHash === "assign" ? "units" : rawHash === "history" ? "payments" : rawHash;
      if (hash && flowSteps.some((s) => s.key === hash)) {
        setActiveTab(hash as Step);
        if (rawHash !== hash) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${hash}`);
        if (hash === "overview" && userRef.current) {
          loadDataRef.current();
        }
      }
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/";
    }
  }, [isLoading, isAuthenticated]);

  const vacantUnits = units.filter((u) => u.status === "vacant");
  const pendingTenants = tenants.filter((t) => t.assignmentStatus === "pending");
  const activeTenants = tenants.filter((t) => t.status === "active");
  const pendingPayments = payments.filter((p) => p.status === "pending");
  const overduePayments = payments.filter((p) => p.status === "overdue");
  const pendingInquiryCount = inquiries.filter((inquiry) => !["replied", "closed"].includes(inquiry.status.toLowerCase())).length;
  const unreadConversationCount = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
  const paymentYear = new Date().getFullYear();
  const monthlyPayments = Array.from({ length: 12 }, (_, month) => {
    const monthPayments = payments.filter((payment) => {
      const paymentDate = new Date(payment.paymentDate);
      return !Number.isNaN(paymentDate.getTime()) &&
        paymentDate.getFullYear() === paymentYear &&
        paymentDate.getMonth() === month;
    });
    return {
      month: new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(paymentYear, month, 1)),
      count: monthPayments.length,
      amount: monthPayments.reduce((total, payment) => total + payment.amountPaid, 0),
    };
  });
  const hasPaymentActivity = monthlyPayments.some((month) => month.count > 0);
  const maxMonthlyPayments = Math.max(1, ...monthlyPayments.map((month) => month.count));
  const normalizedUnitSearch = unitSearch.trim().toLowerCase();
  const filteredUnitProperties = properties.map((property) => {
    const propertySearchText = searchablePropertyText(property).toLowerCase();
    const propertyMatchesSearch = propertySearchText.includes(normalizedUnitSearch);
    const propertyUnits = units.filter((unit) => unit.propertyId === property.id);
    const visibleUnits = propertyUnits.filter((unit) =>
      (unitStatusFilter === "all" || unit.status === unitStatusFilter) &&
      (unitTypeFilter === "all" || property.type === unitTypeFilter) &&
      (!normalizedUnitSearch || propertyMatchesSearch || searchableUnitText(unit).toLowerCase().includes(normalizedUnitSearch))
    );
    return { property, propertyUnits, visibleUnits, propertyMatchesSearch };
  }).filter(({ property, propertyUnits, visibleUnits, propertyMatchesSearch }) =>
    (unitPropertyFilter === "all" || property.id === unitPropertyFilter) &&
    (propertyMatchesSearch || visibleUnits.length > 0) &&
    (visibleUnits.length > 0 || (propertyUnits.length === 0 && unitStatusFilter === "all" && unitTypeFilter === "all" && propertyMatchesSearch))
  );
  const filteredUnitRows = filteredUnitProperties.flatMap(({ property, visibleUnits }) =>
    visibleUnits.map((unit) => ({ property, unit }))
  );
  const bannerProperty = properties.find((property) => property.imageUrls?.length || property.imageUrl);
  const bannerUnit = units.find((unit) => unit.imageUrls?.length || unit.imageUrl);
  const bannerPhotoImages = bannerProperty?.imageUrls?.length
    ? bannerProperty.imageUrls
    : bannerProperty?.imageUrl
      ? [bannerProperty.imageUrl]
      : bannerUnit?.imageUrls?.length
        ? bannerUnit.imageUrls
        : bannerUnit?.imageUrl
          ? [bannerUnit.imageUrl]
          : [];
  const bannerPhotoAlt = bannerProperty
    ? `${bannerProperty.name} property photo`
    : bannerUnit
      ? `Unit ${bannerUnit.unitNumber} photo`
      : "";
  const filteredVacantUnits = vacantUnits.filter((unit) =>
    assignmentPropertyFilter === "all" || unit.propertyId === assignmentPropertyFilter
  );
  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch = `${tenant.name} ${tenant.email} ${tenant.phone || ""} ${tenant.propertyName || ""} ${tenant.unitNumber || ""} ${tenant.assistReason || ""}`
      .toLowerCase().includes(tenantListSearch.trim().toLowerCase());
    const matchesFilter = tenantListFilter === "all" ||
      (tenantListFilter === "assisted" && tenant.isAssisted) ||
      (tenantListFilter === "active" && tenant.status === "active") ||
      (tenantListFilter === "pending" && tenant.assignmentStatus === "pending") ||
      (tenantListFilter === "inactive" && tenant.status === "inactive") ||
      (tenantListFilter === "unassigned" && !tenant.unitId);
    return matchesSearch && matchesFilter;
  });
  const filteredPayments = payments.filter((payment) => {
    const matchesStatus = paymentFilter === "all" || payment.status === paymentFilter;
    const matchesType = paymentTypeFilter === "all" || payment.paymentMethod === paymentTypeFilter;
    const paymentDate = payment.paymentDate.slice(0, 10);
    const matchesDate = (!paymentDateFrom || paymentDate >= paymentDateFrom) &&
      (!paymentDateTo || paymentDate <= paymentDateTo);
    const matchesSearch = searchablePaymentText(payment)
      .toLowerCase()
      .includes(paymentSearch.trim().toLowerCase());
    return matchesStatus && matchesType && matchesDate && matchesSearch;
  });
  const sortedPayments = useMemo(() => [...filteredPayments].sort((a, b) => {
    const left = a[paymentSort.key];
    const right = b[paymentSort.key];
    const comparison = typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
    return paymentSort.direction === "asc" ? comparison : -comparison;
  }), [filteredPayments, paymentSort]);
  const visiblePayments = sortedPayments.slice((paymentPage - 1) * LIST_PAGE_SIZE, paymentPage * LIST_PAGE_SIZE);
  const sortedUnitRows = [...filteredUnitRows].sort((a, b) => {
    if (unitSort === "rent-desc") return b.unit.rentAmount - a.unit.rentAmount;
    if (unitSort === "rent-asc") return a.unit.rentAmount - b.unit.rentAmount;
    if (unitSort === "property") return a.property.name.localeCompare(b.property.name);
    const comparison = a.unit.unitNumber.localeCompare(b.unit.unitNumber, undefined, { numeric: true });
    return unitSort === "unit-desc" ? -comparison : comparison;
  });
  const currentUnitPage = Math.min(unitPage, Math.max(1, Math.ceil(sortedUnitRows.length / LIST_PAGE_SIZE)));
  const visibleUnitRows = sortedUnitRows.slice((currentUnitPage - 1) * LIST_PAGE_SIZE, currentUnitPage * LIST_PAGE_SIZE);
  const filteredCollected = filteredPayments
    .filter((payment) => payment.status === "paid")
    .reduce((total, payment) => total + payment.amountPaid, 0);
  const filteredOutstanding = filteredPayments
    .filter((payment) => payment.status !== "paid")
    .reduce((total, payment) => total + payment.balance, 0);
  const filteredOverdueAmount = filteredPayments
    .filter((payment) => payment.status === "overdue")
    .reduce((total, payment) => total + payment.balance, 0);
  const filteredReceiptCount = filteredPayments.filter((payment) => payment.receiptUrl).length;
  const filteredConversations = conversations.filter((conversation) => {
    const matchesSearch = `${conversation.otherUser?.name || ""} ${conversation.otherUser?.email || ""} ${conversation.lastMessage?.subject || ""} ${conversation.lastMessage?.body || ""}`
      .toLowerCase().includes(messageSearch.trim().toLowerCase());
    const matchesFilter = messageFilter === "all" ||
      (messageFilter === "unread" && conversation.unreadCount > 0) ||
      (messageFilter === "read" && conversation.unreadCount === 0);
    return matchesSearch && matchesFilter;
  });
  const filteredInquiries = inquiries.filter((inquiry) => {
    const matchesSearch = searchableInquiryText(inquiry)
      .toLowerCase().includes(inquirySearch.trim().toLowerCase());
    const matchesFilter = inquiryFilter === "all" || inquiry.status === inquiryFilter;
    const inquiryDate = inquiry.createdAt.slice(0, 10);
    const matchesDate = (!inquiryDateFrom || inquiryDate >= inquiryDateFrom) &&
      (!inquiryDateTo || inquiryDate <= inquiryDateTo);
    const matchesType = inquiryTypeFilter === "all" ||
      (inquiryTypeFilter === "property" && Boolean(inquiry.propertyId)) ||
      (inquiryTypeFilter === "general" && !inquiry.propertyId);
    return matchesSearch && matchesFilter && matchesDate && matchesType;
  });
  const visibleInquiries = filteredInquiries.slice((inquiryPage - 1) * LIST_PAGE_SIZE, inquiryPage * LIST_PAGE_SIZE);
  useEffect(() => { setPaymentPage(1); }, [paymentFilter, paymentTypeFilter, paymentDateFrom, paymentDateTo, paymentSearch]);
  useEffect(() => { setUnitPage(1); }, [unitSearch, unitStatusFilter, unitPropertyFilter, unitTypeFilter, unitSort]);
  useEffect(() => { setInquiryPage(1); }, [inquirySearch, inquiryFilter, inquiryTypeFilter, inquiryDateFrom, inquiryDateTo]);
  useEffect(() => {
    const handleGlobalSearch = async (event: Event) => {
      const query = (event as CustomEvent<{ query: string }>).detail?.query?.trim();
      if (!query) return;
      const normalized = query.toLowerCase();
      const includesQuery = (text: string) => text.toLowerCase().includes(normalized);
      const matchesPayment = payments.some((payment) => includesQuery(searchablePaymentText(payment)));
      const matchesUnit = properties.some((property) => {
        const propertyMatches = includesQuery(searchablePropertyText(property));
        const propertyUnits = units.filter((unit) => unit.propertyId === property.id);
        return propertyUnits.some((unit) => propertyMatches || includesQuery(searchableUnitText(unit))) ||
          (propertyUnits.length === 0 && propertyMatches);
      });
      const matchesInquiry = inquiries.some((inquiry) => includesQuery(searchableInquiryText(inquiry)));

      let matchesContract = false;
      if (!matchesPayment && !matchesInquiry && !matchesUnit) {
        try {
          const response = await fetch("/api/data/contracts", { credentials: "include", cache: "no-store" });
          const data = await safeParseJson(response);
          if (!response.ok || !data.success || !Array.isArray(data.contracts)) {
            throw new Error(data.error || "Could not search contracts");
          }
          matchesContract = data.contracts.some((contract: {
            id?: string; title?: string; propertyName?: string; tenantName?: string;
            tenantId?: string; fileName?: string; message?: string; status?: string;
          }) => {
            const tenant = tenants.find((item) => item.id === contract.tenantId);
            const unit = units.find((item) => item.id === tenant?.unitId);
            const searchableText = `${contract.id || ""} ${contract.title || ""} ${contract.propertyName || ""} ${contract.tenantName || ""} ${contract.fileName || ""} ${contract.message || ""} ${contract.status || ""} ${unit?.unitNumber || ""}`;
            return includesQuery(searchableText);
          });
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not search contracts");
        }
      }

      const target: Step | null = matchesPayment ? "payments"
        : matchesInquiry ? "inquiries"
          : matchesUnit ? "units"
            : matchesContract ? "contracts"
              : null;
      window.dispatchEvent(new CustomEvent("agent-global-search-result", {
        detail: { query, found: Boolean(target) },
      }));
      if (!target) {
        window.sessionStorage.removeItem("agent-global-search");
        return;
      }
      if (target === "payments") {
        setPaymentSearch(query);
        setPaymentFilter("all");
        setPaymentTypeFilter("all");
        setPaymentDateFrom("");
        setPaymentDateTo("");
      } else if (target === "inquiries") {
        setInquirySearch(query);
        setInquiryFilter("all");
        setInquiryTypeFilter("all");
        setInquiryDateFrom("");
        setInquiryDateTo("");
      } else if (target === "units") {
        setUnitSearch(query);
        setUnitStatusFilter("all");
        setUnitPropertyFilter("all");
        setUnitTypeFilter("all");
      }
      if (target === "contracts") window.sessionStorage.setItem("agent-global-search", query);
      else window.sessionStorage.removeItem("agent-global-search");
      setActiveTab(target);
      window.location.hash = target;
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("agent-contract-search", { detail: { query } }));
      }, 150);
    };
    window.addEventListener("agent-global-search", handleGlobalSearch);
    return () => window.removeEventListener("agent-global-search", handleGlobalSearch);
  }, [payments, properties, units, inquiries, tenants]);
  const unitCounts = {
    total: units.length,
    available: vacantUnits.length,
    occupied: units.filter((unit) => unit.status === "occupied").length,
    maintenance: units.filter((unit) => unit.status === "maintenance").length,
  };
  const inquiryCounts = {
    total: inquiries.length,
    new: inquiries.filter((inquiry) => inquiry.status === "new").length,
    inProgress: inquiries.filter((inquiry) => inquiry.status === "read" || inquiry.status === "replied").length,
    closed: inquiries.filter((inquiry) => inquiry.status === "closed").length,
  };
  const myTenants = tenants;

  const handleForwardToOwner = async (payment: Payment) => {
    try {
      const stayInfo = payment.stayStart && payment.stayEnd ? `\nDesired stay: ${formatDate(payment.stayStart)} - ${formatDate(payment.stayEnd)}` : "";
      await notifyAdmins({
        title: "Payment Pending Owner Review",
        message: `${payment.tenantName} submitted a payment of ${formatCurrency(payment.amountPaid)} for property "${payment.propertyName}". Please review the automatic receipt and confirm.${stayInfo}`,
        type: "payment",
        read: false,
      });
      toast.success("Payment forwarded to owner for confirmation!");
    } catch {
      toast.error("Failed to forward payment");
    }
  };

  const downloadFinancialExport = () => {
    const rows: Array<Array<string | number>> = [
      ["Transaction ID", "Tenant", "Property", "Unit", "Amount due", "Amount paid", "Balance", "Status", "Date", "Method"],
      ...filteredPayments.map((payment) => [payment.id, payment.tenantName, payment.propertyName, payment.unitId, payment.amountDue, payment.amountPaid, payment.balance, payment.status, payment.paymentDate, payment.paymentMethod]),
    ];
    downloadExcelReport(`financial-transactions-${new Date().toISOString().slice(0, 10)}.xls`, [{ name: "Payments", rows }]);
  };

  const downloadFinancialPdf = () => {
    const lines = [
      `Transactions: ${filteredPayments.length}`,
      `Collected: PHP ${filteredCollected.toFixed(2)}`,
      `Outstanding: PHP ${filteredOutstanding.toFixed(2)}`,
      "",
      ...filteredPayments.map((payment) => `${payment.paymentDate} | ${payment.tenantName} | ${payment.propertyName} / ${payment.unitId} | ${payment.status} | Paid PHP ${payment.amountPaid.toFixed(2)} | Balance PHP ${payment.balance.toFixed(2)}`),
    ];
    downloadPdfReport(`financial-transactions-${new Date().toISOString().slice(0, 10)}.pdf`, "RentTrack Financial Transactions", lines);
  };

  const downloadUnitsExport = () => {
    const rows: Array<Array<string | number>> = [
      ["Unit", "Property", "Property type", "Status", "Monthly rent", "Features"],
      ...filteredUnitRows.map(({ property, unit }) => [
        unit.unitNumber,
        property.name,
        property.type,
        unit.status,
        unit.rentAmount,
        (property.features || []).join(", "),
      ]),
    ];
    downloadExcelReport(`agent-units-${new Date().toISOString().slice(0, 10)}.xls`, [{ name: "Units", rows }]);
  };

  const togglePaymentSort = (key: typeof paymentSort.key) => {
    setPaymentSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
    setPaymentPage(1);
  };

  return (
    <div className="w-full">
            {activeTab === "contracts" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <ContractsPanel mode="agent" />
              </motion.div>
            )}
            {activeTab === "certificates" && user?.role === "agent" && user.id && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <ManagementBanner
                  category="CREDENTIALS & COMPLIANCE"
                  title="Agent Certificates"
                  description="Upload, manage, and verify your real estate broker and agent accreditations."
                  icon={Award}
                />
                <AgentCertificateManager agentId={user.id} />
              </motion.div>
            )}
            {activeTab === "map" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <ManagementBanner
                  category="GEOGRAPHIC OVERVIEW"
                  title="Property Map"
                  description="Explore all managed properties and rental units across the region."
                  icon={Home}
                />
                <PropertyLocationMap hideHeader />
              </motion.div>
            )}

            {/* OVERVIEW */}
            {activeTab === "overview" && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.3 }}
                className="space-y-4 sm:space-y-5"
              >
                <ManagementBanner
                  category="AGENT WORKSPACE"
                  title={user?.name ? `Welcome back, ${user.name.split(" ")[0]}` : "Agent Dashboard"}
                  description="Here's what's happening across your assigned properties."
                  icon={LayoutDashboard}
                />

                <section aria-label="Portfolio metrics" className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
                  {[
                    { label: "Assigned Units", value: units.length, description: "In your portfolio", icon: Home, tone: "bg-blue-50 text-blue-600", tab: "units" as const },
                    { label: "Active Tenants", value: activeTenants.length, description: "Active leases", icon: Users, tone: "bg-emerald-50 text-emerald-600", tab: "tenants" as const },
                    { label: "Available Units", value: vacantUnits.length, description: "Ready to lease", icon: Home, tone: "bg-violet-50 text-violet-600", tab: "units" as const },
                    { label: "Pending Placements", value: pendingTenants.length, description: "To confirm", icon: Clock, tone: "bg-amber-50 text-amber-600", tab: "units" as const },
                    { label: "Payment Reviews", value: pendingPayments.length, description: "Submitted items", icon: CreditCard, tone: "bg-rose-50 text-rose-600", tab: "payments" as const },
                    { label: "Open Inquiries", value: pendingInquiryCount, description: "Awaiting reply", icon: Mail, tone: "bg-cyan-50 text-cyan-700", tab: "inquiries" as const },
                  ].map((stat) => (
                    <motion.button
                      key={stat.label}
                      type="button"
                      onClick={() => { setActiveTab(stat.tab); window.location.hash = stat.tab; }}
                      whileHover={reduceMotion ? undefined : { y: -2 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                      className="group rounded-lg border border-[#dce8f5] bg-white p-2.5 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-[box-shadow,border-color] duration-200 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none sm:rounded-xl sm:p-4"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[10px] font-semibold text-slate-700 sm:text-xs">{stat.label}</span>
                        <span className={cn("hidden h-7 w-7 shrink-0 items-center justify-center rounded-full sm:flex sm:h-8 sm:w-8", stat.tone)}>
                          <stat.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </span>
                      </span>
                      <span className="mt-1.5 flex items-baseline justify-between gap-1 sm:mt-2">
                        <span className="text-xl font-bold leading-none tracking-tight text-slate-950 sm:text-2xl">{initialLoad || loadError ? "—" : stat.value}</span>
                        <ArrowUpRight className="hidden h-3.5 w-3.5 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:block" />
                      </span>
                      <span className="mt-1 block truncate text-[9px] text-slate-500 sm:mt-1.5 sm:text-[11px]">{stat.description}</span>
                    </motion.button>
                  ))}
                </section>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {/* Rental Overview Chart */}
                  <section className="rounded-xl border border-[#dce8f5] bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-base font-bold text-slate-900">Rental Overview</h2>
                          <p className="mt-1 text-xs text-slate-500">Recorded payments by month · {paymentYear}</p>
                        </div>
                        <span className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500">
                          <CalendarDays className="h-3.5 w-3.5" /> {paymentYear}
                        </span>
                      </div>
                      {initialLoad ? (
                        <div role="status" className="mt-5 flex min-h-40 items-center justify-center rounded-lg border border-slate-100 bg-slate-50/70 text-xs font-medium text-slate-500">
                          Loading payment activity…
                        </div>
                      ) : loadError ? (
                        <div role="status" className="mt-5 flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-amber-200 bg-amber-50/50 px-4 text-center">
                          <p className="text-sm font-semibold text-slate-700">Payment activity unavailable</p>
                          <button type="button" onClick={() => void loadData()} className="mt-2 text-xs font-semibold text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Try again</button>
                        </div>
                      ) : hasPaymentActivity ? (
                        <div className="mt-5">
                          <div className="flex h-36 items-end gap-1.5 border-b border-l border-slate-200 bg-[linear-gradient(to_bottom,transparent_24%,#e8eff7_25%,transparent_26%,transparent_49%,#e8eff7_50%,transparent_51%,transparent_74%,#e8eff7_75%,transparent_76%)] px-2 sm:gap-2">
                            {monthlyPayments.map((month) => (
                              <div key={month.month} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                                <span className="mb-1 text-center text-[10px] font-medium text-slate-500">
                                  {month.count || ""}
                                </span>
                                <div
                                  title={`${month.month}: ${month.count} ${month.count === 1 ? "payment" : "payments"} · ${formatCurrency(month.amount)}`}
                                  className={cn(
                                    "mx-auto w-full max-w-7 rounded-t-sm bg-blue-500/85 transition-[height] duration-300",
                                    month.count === 0 && "h-px bg-slate-200"
                                  )}
                                  style={month.count > 0 ? { height: `${Math.max(8, (month.count / maxMonthlyPayments) * 100)}%` } : undefined}
                                />
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex justify-between gap-1 pl-2 text-[10px] text-slate-500">
                            {monthlyPayments.map((month) => <span key={month.month}>{month.month}</span>)}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-5 flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-4 text-center">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                            <CalendarDays className="h-5 w-5" />
                          </div>
                          <p className="mt-3 text-sm font-semibold text-slate-700">No transaction data yet</p>
                          <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">Payment activity for {paymentYear} will appear here when it is recorded.</p>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Agent Overview */}
                  <section className="rounded-xl border border-[#dce8f5] bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-base font-bold text-slate-900">Agent Overview</h2>
                          <p className="mt-1 text-xs text-slate-500">Operational status and task shortcuts</p>
                        </div>
                        <span className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50/50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                          Active Workspace
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { label: "Pending assignments", value: pendingTenants.length, onClick: () => { setSelectedTenant(null); setSelectedUnit(null); setShowAssignModal(true); }, icon: Users, tone: "bg-blue-50 text-blue-600" },
                          { label: "Payment reviews", value: pendingPayments.length, onClick: () => { setActiveTab("payments"); window.location.hash = "payments"; }, icon: CreditCard, tone: "bg-emerald-50 text-emerald-600" },
                          { label: "Available units", value: vacantUnits.length, onClick: () => { setActiveTab("units"); window.location.hash = "units"; }, icon: Home, tone: "bg-violet-50 text-violet-600" },
                          { label: "Payments overdue", value: overduePayments.length, onClick: () => { setActiveTab("payments"); window.location.hash = "payments"; }, icon: Clock, tone: "bg-amber-50 text-amber-600" },
                          { label: "Tenant inquiries", value: pendingInquiryCount, onClick: () => { setActiveTab("inquiries"); window.location.hash = "inquiries"; }, icon: Mail, tone: "bg-orange-50 text-orange-600" },
                          { label: "Unread messages", value: unreadConversationCount, onClick: () => { setActiveTab("messages"); window.location.hash = "messages"; }, icon: Send, tone: "bg-cyan-50 text-cyan-700" },
                        ].map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={item.onClick}
                            className="group flex w-full items-center gap-2.5 rounded-lg border border-slate-100 p-2.5 text-left transition-all hover:border-blue-200 hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", item.tone)}>
                              <item.icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{item.label}</span>
                            <span className="text-xs font-bold tabular-nums text-slate-900">{initialLoad || loadError ? "—" : item.value}</span>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <Button
                        size="sm"
                        className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                        onClick={() => { setSelectedTenant(null); setSelectedUnit(null); setShowAssignModal(true); }}
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Assign Tenant
                      </Button>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-slate-700 hover:bg-slate-50 border-slate-200 gap-1"
                          onClick={() => { setActiveTab("tenants"); window.location.hash = "tenants"; }}
                        >
                          <Users className="h-3.5 w-3.5 text-slate-500" /> Directory
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-slate-700 hover:bg-slate-50 border-slate-200 gap-1"
                          onClick={() => { setActiveTab("inquiries"); window.location.hash = "inquiries"; }}
                        >
                          <Mail className="h-3.5 w-3.5 text-slate-500" /> Inquiries
                        </Button>
                      </div>
                    </div>
                  </section>
                </div>

                {/* ASSISTED TENANTS PREVIEW IN OVERVIEW */}
                <section className="w-full overflow-hidden rounded-xl border border-[#dce8f5] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-4 sm:px-5">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Tenants You Assist</h2>
                      <p className="mt-1 text-xs text-slate-500">Tenants in your assigned properties, contracts, and inquiries</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setActiveTab("tenants"); window.location.hash = "tenants"; }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      View all tenants <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {initialLoad ? (
                    <div role="status" className="px-5 py-9 text-center text-xs font-medium text-slate-500">Loading assisted tenants…</div>
                  ) : loadError ? (
                    <div role="status" className="px-5 py-9 text-center text-xs text-red-600">Assisted tenant data unavailable</div>
                  ) : tenants.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {tenants.slice(0, 5).map((tenant) => (
                        <div key={tenant.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:px-5 hover:bg-slate-50/70 transition-colors">
                          <div className="flex items-center gap-3">
                            <Avatar src={tenant.avatarUrl} fallback={getInitials(tenant.name)} size="sm" />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-xs text-slate-900">{tenant.name}</p>
                                {tenant.isAssisted && (
                                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                                    {tenant.assistReason || "Assisted"}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {tenant.propertyName ? `${tenant.propertyName}${tenant.unitNumber ? ` · Unit #${tenant.unitNumber}` : ""}` : "Awaiting unit placement"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={tenant.status === "active" ? "success" : tenant.status === "inactive" ? "outline" : "warning"} className="text-[10px] capitalize">
                              {tenant.status || "pending"}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2.5 text-xs text-blue-600 hover:bg-blue-50 border-blue-200 gap-1"
                              onClick={() => {
                                setSelectedConversation({
                                  otherUser: {
                                    id: tenant.id,
                                    name: tenant.name,
                                    email: tenant.email,
                                    role: "tenant",
                                    avatarUrl: tenant.avatarUrl,
                                  },
                                  lastMessage: null,
                                  unreadCount: 0,
                                });
                                setIsMessagingOpen(true);
                              }}
                            >
                              <Send className="h-3 w-3" /> Message
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 py-9 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                        <Users className="h-5 w-5" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-700">No tenants assigned yet</p>
                      <p className="mt-1 text-xs text-slate-500">Tenants who apply or reside in your properties will appear here.</p>
                    </div>
                  )}
                </section>

                {/* RECENT UNITS */}
                <section className="w-full overflow-hidden rounded-xl border border-[#dce8f5] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-4 sm:px-5">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Recent Units</h2>
                      <p className="mt-1 text-xs text-slate-500">Units currently assigned to your portfolio</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setActiveTab("units"); window.location.hash = "units"; }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      View all units <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {initialLoad ? (
                    <div role="status" className="px-5 py-9 text-center text-xs font-medium text-slate-500">Loading assigned units…</div>
                  ) : loadError ? (
                    <div role="status" className="px-5 py-9 text-center">
                      <p className="text-sm font-semibold text-slate-700">Assigned units unavailable</p>
                      <button type="button" onClick={() => void loadData()} className="mt-2 text-xs font-semibold text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Try again</button>
                    </div>
                  ) : units.length > 0 ? (
                    <>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[600px] text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3 sm:px-5">Property</th>
                            <th className="px-4 py-3">Unit no.</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Monthly rent</th>
                            <th className="px-4 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {units.slice(0, 6).map((unit) => {
                            const property = properties.find((item) => item.id === unit.propertyId);
                            const statusClass = unit.status === "occupied"
                              ? "bg-emerald-50 text-emerald-700"
                              : unit.status === "maintenance"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-blue-50 text-blue-700";
                            return (
                              <tr key={unit.id} className="transition-colors hover:bg-slate-50/80">
                                <td className="px-4 py-3.5 sm:px-5">
                                  <span className="block font-semibold text-slate-800">{property?.name || "—"}</span>
                                  <span className="mt-0.5 block text-[10px] text-slate-500">{property?.location || "Property details unavailable"}</span>
                                </td>
                                <td className="px-4 py-3.5 font-medium text-slate-700">{unit.unitNumber}</td>
                                <td className="px-4 py-3.5">
                                  <span className={cn("inline-flex rounded-full px-2 py-1 text-[10px] font-semibold capitalize", statusClass)}>{unit.status}</span>
                                </td>
                                <td className="px-4 py-3.5 font-medium text-slate-700">{formatCurrency(unit.rentAmount)}</td>
                                <td className="px-4 py-3.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => { setActiveTab("units"); window.location.hash = "units"; }}
                                    className="rounded-md px-2 py-1 font-semibold text-blue-600 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                  >
                                    Open
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="divide-y divide-slate-100 md:hidden">
                      {units.slice(0, 6).map((unit) => {
                        const property = properties.find((item) => item.id === unit.propertyId);
                        const statusClass = unit.status === "occupied"
                          ? "bg-emerald-50 text-emerald-700"
                          : unit.status === "maintenance"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-blue-50 text-blue-700";
                        return (
                          <article key={unit.id} className="flex items-center justify-between gap-3 px-4 py-3">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-slate-800">{property?.name || "â€”"} Â· Unit {unit.unitNumber}</p>
                              <p className="mt-0.5 truncate text-[10px] text-slate-500">{formatCurrency(unit.rentAmount)} / month</p>
                            </div>
                            <span className={cn("shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold capitalize", statusClass)}>{unit.status}</span>
                          </article>
                        );
                      })}
                    </div>
                    </>
                  ) : (
                    <div className="px-5 py-9 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                        <Home className="h-5 w-5" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-700">No units assigned yet</p>
                      <p className="mt-1 text-xs text-slate-500">Assigned units will appear here.</p>
                    </div>
                  )}
                </section>
              </motion.div>
            )}

            {/* UNITS */}
            {activeTab === "units" && (
              <motion.div initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={management.page}>
                <ManagementBanner />
                <div className={management.toolbar}>
                  <label className={management.search}>
                    <Search aria-hidden="true" />
                    <input type="search" value={unitSearch} onChange={(event) => setUnitSearch(event.target.value)} placeholder="Search by unit number, property, or location..." aria-label="Search properties or units" />
                  </label>
                  <label className={management.filterCompact}><span>Property</span>
                    <select value={unitPropertyFilter} onChange={(event) => setUnitPropertyFilter(event.target.value)} aria-label="Filter units by property">
                      <option value="all">All properties</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                    </select>
                  </label>
                  <label className={management.filterCompact}><span>Property type</span>
                    <select value={unitTypeFilter} onChange={(event) => setUnitTypeFilter(event.target.value)} aria-label="Filter units by property type">
                      <option value="all">All types</option><option value="house">House</option><option value="condominium">Condominium</option>
                    </select>
                  </label>
                  <label className={management.filterCompact}><span>Status</span>
                    <select value={unitStatusFilter} onChange={(event) => setUnitStatusFilter(event.target.value)} aria-label="Filter units by status">
                      <option value="all">All statuses</option><option value="vacant">Available</option><option value="occupied">Occupied</option><option value="maintenance">Under Maintenance</option>
                    </select>
                  </label>
                  <div className={management.toolbarActions}>
                    <button type="button" className={management.reset} onClick={() => { setUnitSearch(""); setUnitStatusFilter("all"); setUnitPropertyFilter("all"); setUnitTypeFilter("all"); }}><RotateCcw aria-hidden="true" />Reset</button>
                    <Button onClick={downloadUnitsExport} className={management.export}><Download className="h-4 w-4" />Export</Button>
                    <Button onClick={() => { setSelectedUnit(null); setSelectedTenant(null); setShowAssignModal(true); }} className="h-9 gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3"><UserPlus className="h-3.5 w-3.5" /> Assign Tenant</Button>
                  </div>
                </div>
                <UnitMetrics total={unitCounts.total} available={unitCounts.available} occupied={unitCounts.occupied} maintenance={unitCounts.maintenance} />
                <section className={management.tablePanel} aria-label="Units">
                  <div className={management.tableHeader}>
                    <h2 className={management.tableTitle}>Units <span className={management.count}>{filteredUnitRows.length} units</span></h2>
                    <div className={management.tableControls}>
                      <select value={unitSort} onChange={(event) => setUnitSort(event.target.value)} aria-label="Sort units">
                        <option value="unit-asc">Sort by: Unit No. (A–Z)</option><option value="unit-desc">Unit No. (Z–A)</option><option value="property">Property (A–Z)</option><option value="rent-asc">Rent (Lowest first)</option><option value="rent-desc">Rent (Highest first)</option>
                      </select>
                    </div>
                  </div>
                  {initialLoad ? <div role="status" className={management.empty}>Loading units…</div>
                    : loadError ? <div role="alert" className={management.empty}><strong>Unable to load unit data</strong><Button variant="outline" onClick={() => void loadData()}>Try again</Button></div>
                    : properties.length === 0 ? <div className={management.empty}><Home aria-hidden="true" /><strong>No properties assigned yet</strong><p>Properties will appear here once the owner assigns them to you.</p></div>
                    : filteredUnitRows.length === 0 ? <div className={management.empty}><Search aria-hidden="true" /><strong>No units match these filters</strong><p>Adjust your search or reset the filters to see available units.</p></div>
                    : <>
                      <div className={management.tableScroll}>
                        <table className={management.table}>
                          <thead><tr><th>Unit No.</th><th>Property</th><th>Property Type</th><th>Monthly Rent</th><th>Status</th><th>Tenant</th><th>Actions</th></tr></thead>
                          <tbody>{visibleUnitRows.map(({ property, unit }) => {
                            const assignedTenant = tenants.find((tenant) => tenant.unitId === unit.id);
                            const tenantName = unit.tenantName || assignedTenant?.name;
                            return <tr key={unit.id}>
                              <td className="font-semibold">{unit.unitNumber}</td>
                              <td><span className={management.propertyCell}><Building2 aria-hidden="true" />{property.name}</span></td>
                              <td className="capitalize">{property.type}</td>
                              <td className="whitespace-nowrap tabular-nums">{formatCurrency(unit.rentAmount)}</td>
                              <td><UnitStatus status={unit.status} /></td>
                              <td>{tenantName ? <span className={management.tenantCell}><User aria-hidden="true" />{tenantName}</span> : "—"}</td>
                              <td>{unit.status === "vacant" ? <Button variant="outline" className="border-blue-200 text-blue-600" onClick={() => { setSelectedUnit(unit); setSelectedTenant(null); setShowAssignModal(true); }}>Assign tenant</Button> : "—"}</td>
                            </tr>;
                          })}</tbody>
                        </table>
                      </div>
                      <ManagementPagination page={currentUnitPage} total={filteredUnitRows.length} noun="units" onPageChange={setUnitPage} />
                    </>}
                </section>
              </motion.div>
            )}

            {activeTab === "tenants" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  <ManagementBanner
                    category="TENANT MANAGEMENT"
                    title="Tenant Directory & Assistance"
                    description="View, manage, and directly assist tenants residing in your assigned properties or contracts."
                    icon={Users}
                  />

                  {/* Portfolio Metrics */}
                  <section aria-label="Tenant portfolio metrics" className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {[
                      { label: "Assisted Tenants", value: tenants.filter((t) => t.isAssisted).length, tone: "bg-blue-50 text-blue-700" },
                      { label: "Active In Units", value: activeTenants.length, tone: "bg-emerald-50 text-emerald-700" },
                      { label: "Pending Assignment", value: pendingTenants.length, tone: "bg-amber-50 text-amber-700" },
                      { label: "Total In System", value: tenants.length, tone: "bg-slate-50 text-slate-700" },
                    ].map((metric) => (
                      <div key={metric.label} className="rounded-lg border border-[#dce8f5] bg-white px-3 py-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:px-4">
                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{metric.label}</p>
                        <p className={cn("mt-1 inline-flex min-w-8 items-center justify-center rounded-md px-2 py-0.5 text-lg font-bold tabular-nums", metric.tone)}>
                          {initialLoad || loadError ? "—" : metric.value}
                        </p>
                      </div>
                    ))}
                  </section>

                  {/* Search and Filters */}
                  <div className="flex flex-col gap-3 rounded-xl border border-[#dce8f5] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:p-4">
                    <label className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={tenantListSearch}
                        onChange={(event) => setTenantListSearch(event.target.value)}
                        placeholder="Search by tenant name, email, property, unit, or status..."
                        aria-label="Search tenants"
                        className="h-9.5 rounded-lg border-slate-200 pl-9 text-xs"
                      />
                    </label>
                    <select
                      value={tenantListFilter}
                      onChange={(event) => setTenantListFilter(event.target.value)}
                      aria-label="Filter tenants"
                      className="h-9.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 sm:w-56"
                    >
                      <option value="all">All Tenants ({tenants.length})</option>
                      <option value="assisted">Assisted by You ({tenants.filter((t) => t.isAssisted).length})</option>
                      <option value="active">Active Leases ({activeTenants.length})</option>
                      <option value="pending">Pending Assignment ({pendingTenants.length})</option>
                      <option value="unassigned">Unassigned ({tenants.filter((t) => !t.unitId).length})</option>
                      <option value="inactive">Past / Inactive ({tenants.filter((t) => t.status === "inactive").length})</option>
                    </select>

                    <Button
                      onClick={() => setShowAccountRequestModal(true)}
                      className="h-9.5 gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4"
                    >
                      <UserPlus className="h-4 w-4" /> Request Tenant Account
                    </Button>
                  </div>

                  {/* Tenant List */}
                  <Card className="overflow-hidden border-[#dce8f5] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                    <CardHeader className="border-b border-slate-100 bg-[#f6f9fd] px-4 py-3 sm:px-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <CardTitle className="text-sm font-semibold text-slate-900">Tenants Portfolio & Assistance</CardTitle>
                          <CardDescription className="text-xs">
                            Tenants currently residing in your properties, inquiring for leases, or registered with your agency
                          </CardDescription>
                        </div>
                        <span className="text-xs font-medium text-slate-500">
                          Showing {filteredTenants.length} of {tenants.length} tenants
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-5">
                      <div className="space-y-3">
                        {initialLoad ? (
                          <div role="status" className="py-12 text-center text-sm text-slate-500">Loading tenant records…</div>
                        ) : loadError ? (
                          <div role="status" className="py-12 text-center">
                            <p className="text-sm font-semibold text-red-600">Tenant records could not be loaded.</p>
                            <button type="button" onClick={() => void loadData()} className="mt-2 text-xs font-semibold text-blue-700 hover:text-blue-900">Try again</button>
                          </div>
                        ) : filteredTenants.length === 0 ? (
                          <div className="text-center py-12">
                            <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-700 font-semibold text-sm">No tenants match your search or filter</p>
                            <p className="text-xs text-slate-500 mt-1">Try switching filters or clearing your search query.</p>
                          </div>
                        ) : (
                          filteredTenants.map((tenant) => (
                            <div
                              key={tenant.id}
                              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300 transition-all space-y-3.5"
                            >
                              {/* Top Row: Identity, Contact, Assistance Badge, Status */}
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                  <Avatar src={tenant.avatarUrl} fallback={getInitials(tenant.name)} size="md" className="ring-2 ring-blue-100 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-bold text-slate-900 text-sm truncate">{tenant.name}</p>
                                      {tenant.isAssisted ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
                                          <CheckCircle2 className="h-3 w-3 text-blue-600" />
                                          Assisted: {tenant.assistReason || "Assigned Property"}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                          {tenant.propertyName ? tenant.propertyName : "Available Renter"}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                                      <span className="flex items-center gap-1">
                                        <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        <a href={`mailto:${tenant.email}`} className="hover:text-blue-600 hover:underline truncate max-w-[200px]">{tenant.email}</a>
                                      </span>
                                      {tenant.phone && (
                                        <span className="flex items-center gap-1">
                                          <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                          <a href={`tel:${tenant.phone}`} className="hover:text-blue-600 hover:underline">{tenant.phone}</a>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge
                                    variant={tenant.status === "active" ? "success" : tenant.status === "inactive" ? "outline" : "warning"}
                                    className="text-xs capitalize font-medium"
                                  >
                                    {tenant.status || "pending"}
                                  </Badge>
                                  {tenant.idVerificationStatus && (
                                    <Badge
                                      variant={tenant.idVerificationStatus === "approved" ? "success" : tenant.idVerificationStatus === "rejected" ? "danger" : "outline"}
                                      className="text-[11px]"
                                    >
                                      {tenant.idVerificationStatus === "approved" ? "ID Verified" : tenant.idVerificationStatus === "rejected" ? "ID Rejected" : "ID Pending"}
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Middle Row: Property & Unit Assignment Details */}
                              <div className="rounded-lg bg-slate-50/90 border border-slate-100 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                                {tenant.propertyName || tenant.unitNumber ? (
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-slate-700">
                                    <span className="flex items-center gap-1.5 font-semibold text-slate-900">
                                      <Building2 className="h-4 w-4 text-blue-600" />
                                      {tenant.propertyName || "Assigned Property"}
                                    </span>
                                    {tenant.unitNumber && (
                                      <span className="flex items-center gap-1 text-slate-600 font-medium">
                                        <Home className="h-3.5 w-3.5 text-slate-400" />
                                        Unit #{tenant.unitNumber}
                                      </span>
                                    )}
                                    {Number(tenant.rentAmount) > 0 && (
                                      <span className="font-semibold text-emerald-700">
                                        {formatCurrency(tenant.rentAmount)} / mo
                                      </span>
                                    )}
                                    {(tenant.contractStart || tenant.contractEnd) && (
                                      <span className="flex items-center gap-1 text-slate-500">
                                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                                        {tenant.contractStart ? formatDate(tenant.contractStart) : "—"} to {tenant.contractEnd ? formatDate(tenant.contractEnd) : "—"}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-amber-700 font-medium">
                                    <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                                    <span>Awaiting unit assignment — Ready to place in one of your managed units</span>
                                  </div>
                                )}
                              </div>

                              {/* Bottom Row: Direct Actions */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                                <div className="flex flex-wrap items-center gap-2">
                                  {/* Message Tenant Button */}
                                  <Button
                                    size="sm"
                                    className="h-8 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 shadow-sm"
                                    onClick={() => {
                                      setSelectedConversation({
                                        otherUser: {
                                          id: tenant.id,
                                          name: tenant.name,
                                          email: tenant.email,
                                          role: "tenant",
                                          avatarUrl: tenant.avatarUrl,
                                        },
                                        lastMessage: null,
                                        unreadCount: 0,
                                      });
                                      setIsMessagingOpen(true);
                                    }}
                                  >
                                    <Send className="h-3.5 w-3.5" /> Message Tenant
                                  </Button>

                                  {!tenant.unitId && (
                                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 border-blue-200" onClick={() => { setSelectedTenant(tenant); setSelectedUnit(null); setShowAssignModal(true); }}><UserPlus className="h-3.5 w-3.5" /> Assign to Unit</Button>
                                  )}

                                  {tenant.status === "active" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-xs text-emerald-700 hover:bg-emerald-50 border-emerald-200 font-medium"
                                      onClick={async () => {
                                        if (!window.confirm(`Mark ${tenant.name}'s stay as done?`)) return;
                                        const updated = await updateTenantStatus(tenant.id, "inactive");
                                        if (updated) {
                                          setTenants((current) => current.map((item) => item.id === tenant.id ? { ...item, status: "inactive" } : item));
                                          toast.success(`${tenant.name}'s stay is marked done`);
                                        } else {
                                          toast.error("Could not complete the tenant stay");
                                        }
                                      }}
                                    >
                                      Stay Done
                                    </Button>
                                  )}
                                </div>

                                <DropdownMenu modal={false}>
                                  <DropdownMenuTrigger asChild>
                                    <button className="h-8 px-2.5 rounded-lg flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200">
                                      More Actions <ChevronDown className="h-3.5 w-3.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" sideOffset={4} side="bottom">
                                    <DropdownMenuItem onSelect={() => { setSelectedTenant(tenant); setSelectedUnit(null); setShowAssignModal(true); }}>
                                      Assign / Change Unit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => window.location.href = `mailto:${tenant.email}`}>
                                      Send Direct Email
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* PAYMENTS */}
            {activeTab === "payments" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <ManagementBanner
                  financial
                  category="FINANCIAL MANAGEMENT"
                  title="Financial Transactions"
                  description="Track payments, balances, receipts, and submitted remittances across assigned units."
                  icon={CreditCard}
                />
                <div className="rounded-xl border border-[#dce8f5] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-4">
                  <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(220px,1fr)_minmax(0,1fr)]">
                      <label className="relative min-w-0">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          type="search"
                          value={paymentSearch}
                          onChange={(event) => setPaymentSearch(event.target.value)}
                          placeholder="Search tenant, property, unit, or reference..."
                          aria-label="Search payments"
                          className="h-9 rounded-lg border-slate-200 pl-9 text-sm"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 text-[10px] font-medium text-slate-500">
                          From<input type="date" value={paymentDateFrom} onChange={(event) => setPaymentDateFrom(event.target.value)} aria-label="Payments from date" className="min-w-0 flex-1 bg-transparent py-2 text-xs text-slate-700 outline-none" />
                        </label>
                        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 text-[10px] font-medium text-slate-500">
                          To<input type="date" value={paymentDateTo} onChange={(event) => setPaymentDateTo(event.target.value)} aria-label="Payments to date" className="min-w-0 flex-1 bg-transparent py-2 text-xs text-slate-700 outline-none" />
                        </label>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                      <select
                        value={paymentTypeFilter}
                        onChange={(event) => setPaymentTypeFilter(event.target.value)}
                        aria-label="Filter payments by transaction type"
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700"
                      >
                        <option value="all">All types</option>
                        {Array.from(new Set(payments.map((payment) => payment.paymentMethod))).map((method) => (
                          <option key={method} value={method}>{method.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                      <select
                        value={paymentFilter}
                        onChange={(event) => setPaymentFilter(event.target.value)}
                        aria-label="Filter payments by status"
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700"
                      >
                        <option value="all">All statuses</option>
                        <option value="paid">Paid</option>
                        <option value="pending">Pending</option>
                        <option value="overdue">Overdue</option>
                        <option value="partial">Partial</option>
                      </select>
                      <Button variant="outline" onClick={downloadFinancialExport} className="h-9 rounded-lg border-slate-200 px-3 text-xs">
                        <Download className="mr-1.5 h-3.5 w-3.5" />Excel
                      </Button>
                      <Button variant="outline" onClick={downloadFinancialPdf} className="h-9 rounded-lg border-slate-200 px-3 text-xs">
                        <Download className="mr-1.5 h-3.5 w-3.5" />PDF
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                  {[
                    { label: "Collected", value: formatCurrency(filteredCollected), note: "Paid transactions", tone: "emerald" },
                    { label: "Outstanding", value: formatCurrency(filteredOutstanding), note: `${filteredPayments.filter((payment) => payment.status !== "paid").length} open items`, tone: "amber" },
                    { label: "Overdue", value: formatCurrency(filteredOverdueAmount), note: `${filteredPayments.filter((payment) => payment.status === "overdue").length} overdue`, tone: "rose" },
                    { label: "Receipts", value: String(filteredReceiptCount), note: `${filteredReceiptCount} attached`, tone: "blue" },
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-lg border border-[#dce8f5] bg-white px-3 py-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:px-4 sm:py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{metric.label}</p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <p className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">{metric.value}</p>
                        <span className={cn(
                          "inline-flex h-2.5 w-2.5 rounded-full",
                          metric.tone === "emerald" && "bg-green-500",
                          metric.tone === "amber" && "bg-amber-500",
                          metric.tone === "rose" && "bg-red-500",
                          metric.tone === "blue" && "bg-blue-500"
                        )} />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500 sm:text-xs">{metric.note}</p>
                    </div>
                  ))}
                </div>

                <Card className="overflow-hidden border-[#dce8f5] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                  <CardHeader className="border-b border-slate-100 bg-[#f6f9fd] px-4 py-3 sm:px-5">
                    <CardTitle className="text-sm font-semibold text-slate-900">Payment records</CardTitle>
                    <CardDescription className="mt-1 text-xs text-slate-500">
                      {filteredPayments.length} transaction{filteredPayments.length === 1 ? "" : "s"} match your search and filters
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {initialLoad ? (
                      <div role="status" className="px-6 py-12 text-center text-sm text-slate-500">Loading payment activity…</div>
                    ) : loadError ? (
                      <div role="status" className="px-6 py-12 text-center text-sm text-red-600">Unable to load payment data. Please refresh to try again.</div>
                    ) : filteredPayments.length > 0 ? (
                      <>
                        <div className="hidden overflow-x-auto md:block">
                          <table className="w-full min-w-[920px] border-collapse text-left">
                            <thead className="bg-[#f6f9fd]">
                              <tr className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                <th className="px-4 py-3"><button type="button" onClick={() => togglePaymentSort("paymentDate")} className="hover:text-blue-700">Date{paymentSort.key === "paymentDate" ? paymentSort.direction === "asc" ? " ↑" : " ↓" : ""}</button></th>
                                <th className="px-4 py-3"><button type="button" onClick={() => togglePaymentSort("tenantName")} className="hover:text-blue-700">Tenant{paymentSort.key === "tenantName" ? paymentSort.direction === "asc" ? " ↑" : " ↓" : ""}</button></th>
                                <th className="px-4 py-3"><button type="button" onClick={() => togglePaymentSort("unitId")} className="hover:text-blue-700">Unit{paymentSort.key === "unitId" ? paymentSort.direction === "asc" ? " ↑" : " ↓" : ""}</button></th>
                                <th className="px-4 py-3"><button type="button" onClick={() => togglePaymentSort("paymentMethod")} className="hover:text-blue-700">Type{paymentSort.key === "paymentMethod" ? paymentSort.direction === "asc" ? " ↑" : " ↓" : ""}</button></th>
                                <th className="px-4 py-3"><button type="button" onClick={() => togglePaymentSort("amountPaid")} className="hover:text-blue-700">Amount{paymentSort.key === "amountPaid" ? paymentSort.direction === "asc" ? " ↑" : " ↓" : ""}</button></th>
                                <th className="px-4 py-3"><button type="button" onClick={() => togglePaymentSort("status")} className="hover:text-blue-700">Status{paymentSort.key === "status" ? paymentSort.direction === "asc" ? " ↑" : " ↓" : ""}</button></th>
                                <th className="px-4 py-3"><button type="button" onClick={() => togglePaymentSort("id")} className="hover:text-blue-700">Reference{paymentSort.key === "id" ? paymentSort.direction === "asc" ? " ↑" : " ↓" : ""}</button></th><th className="px-4 py-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {visiblePayments.map((payment) => (
                                <tr key={payment.id} className="text-xs text-slate-700 transition-colors hover:bg-blue-50/40">
                                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(payment.paymentDate)}</td>
                                  <td className="px-4 py-3"><span className="font-semibold text-slate-900">{payment.tenantName}</span><span className="mt-0.5 block text-[10px] text-slate-500">{payment.propertyName}</span></td>
                                  <td className="whitespace-nowrap px-4 py-3">Unit {units.find((unit) => unit.id === payment.unitId)?.unitNumber || payment.unitId}</td>
                                  <td className="whitespace-nowrap px-4 py-3 capitalize">{payment.paymentMethod.replace("_", " ")}</td>
                                  <td className="whitespace-nowrap px-4 py-3"><span className="font-semibold tabular-nums text-slate-900">{formatCurrency(payment.amountPaid)}</span><span className="ml-1 text-[10px] text-slate-500">of {formatCurrency(payment.amountDue)}</span></td>
                                  <td className="px-4 py-3"><Badge variant={payment.status === "paid" ? "success" : payment.status === "pending" ? "warning" : payment.status === "partial" ? "info" : "destructive"} className="text-[10px] capitalize">{payment.status}</Badge></td>
                                  <td className="max-w-32 truncate px-4 py-3 font-mono text-[10px] text-slate-500" title={payment.id}>{payment.id}</td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-1.5">
                                      {payment.receiptUrl && <Button size="sm" variant="outline" className="h-7 rounded-md px-2 text-[10px]" onClick={() => setViewingReceipt(payment)}><FileText className="mr-1 h-3 w-3" />Receipt</Button>}
                                      {payment.status === "pending" && <Button size="sm" variant="outline" className="h-7 rounded-md px-2 text-[10px]" onClick={() => handleForwardToOwner(payment)}><Send className="mr-1 h-3 w-3" />Forward</Button>}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="divide-y divide-slate-100 md:hidden">
                          {visiblePayments.map((payment) => (
                            <div key={payment.id} className="space-y-2.5 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900">{payment.tenantName}</p>
                                  <p className="mt-0.5 truncate text-[11px] text-slate-500">{payment.propertyName} · Unit {units.find((unit) => unit.id === payment.unitId)?.unitNumber || payment.unitId}</p>
                                </div>
                                <Badge variant={payment.status === "paid" ? "success" : payment.status === "pending" ? "warning" : payment.status === "partial" ? "info" : "destructive"} className="shrink-0 text-[10px] capitalize">{payment.status}</Badge>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="text-slate-500">{formatDate(payment.paymentDate)} · {payment.paymentMethod.replace("_", " ")}</span>
                                <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(payment.amountPaid)} <span className="font-normal text-slate-500">/ {formatCurrency(payment.amountDue)}</span></span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="max-w-40 truncate font-mono text-[10px] text-slate-400" title={payment.id}>Ref {payment.id}</span>
                                <div className="flex gap-1.5">
                                  {payment.receiptUrl && <Button size="sm" variant="outline" className="h-7 rounded-md px-2 text-[10px]" onClick={() => setViewingReceipt(payment)}><FileText className="mr-1 h-3 w-3" />Receipt</Button>}
                                  {payment.status === "pending" && <Button size="sm" variant="outline" className="h-7 rounded-md px-2 text-[10px]" onClick={() => handleForwardToOwner(payment)}><Send className="mr-1 h-3 w-3" />Forward</Button>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex min-h-[220px] items-center justify-center px-6 py-10">
                        <div className="max-w-sm text-center">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface-secondary text-text-secondary">
                            <Search className="h-5 w-5" />
                          </div>
                          <h3 className="mt-4 text-base font-semibold text-foreground">
                            {payments.length === 0 ? "No payment records yet" : "No transactions found"}
                          </h3>
                          <p className="mt-2 text-sm text-text-secondary">
                            {payments.length === 0 ? "Payment activity will appear here." : "Try a different search or status filter to see payment activity."}
                          </p>
                        </div>
                      </div>
                    )}
                    {!initialLoad && !loadError && filteredPayments.length > 0 && <PaginationControls page={paymentPage} total={filteredPayments.length} onPageChange={setPaymentPage} />}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* MESSAGES */}
            {activeTab === "messages" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <ManagementBanner
                  category="COMMUNICATION HUB"
                  title="Agent Messages"
                  description="Communicate with property owners, tenants, and landing page prospective renters."
                  icon={Send}
                />
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row">
                  <label className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                    <Input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Search messages or contacts" aria-label="Search messages" className="pl-9" />
                  </label>
                  <select value={messageFilter} onChange={(event) => setMessageFilter(event.target.value)} aria-label="Filter messages" className="h-10 rounded-xl border border-border bg-surface-secondary px-3 text-sm text-foreground sm:w-52">
                    <option value="all">All messages</option>
                    <option value="unread">Unread</option>
                    <option value="read">Read</option>
                  </select>
                </div>
                <Card>
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      {conversations.length === 0 ? (
                        <div className="text-center py-12">
                          <p className="text-text-secondary font-medium">No messages yet</p>
                          <p className="text-xs text-text-tertiary mt-1">Start a conversation with an owner or tenant</p>
                        </div>
                      ) : filteredConversations.length === 0 ? (
                        <p className="py-8 text-center text-sm text-text-secondary">No messages match your search or filter.</p>
                      ) : (
                        filteredConversations.map((conv, index) => (
                          <motion.div
                            key={conv.userId}
                            custom={index}
                            initial="hidden"
                            animate="visible"
                            variants={listAnimation}
                            whileHover={{ y: -2, scale: 1.01 }}
                            onClick={() => { setSelectedConversation(conv); setIsMessagingOpen(true); }}
                            className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-surface-secondary transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                               <Avatar src={conv.otherUser?.avatarUrl} fallback={conv.otherUser?.name ? getInitials(conv.otherUser.name) : "?"} />
                              <div>
                                <p className="font-medium text-foreground">{conv.otherUser?.name || "Unknown"}</p>
                                <p className="text-xs text-text-secondary truncate max-w-50">{conv.lastMessage.subject && `${conv.lastMessage.subject} - `}{conv.lastMessage.body}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-text-tertiary">{new Date(conv.lastMessage.createdAt).toLocaleDateString()}</span>
                              {conv.unreadCount > 0 && <Badge variant="default" className="bg-blue-600 text-white text-[10px]">{conv.unreadCount}</Badge>}
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* INQUIRIES */}
            {activeTab === "inquiries" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <ManagementBanner
                  category="LEAD MANAGEMENT"
                  title="Landing Inquiries"
                  description="Follow up with prospective tenants who contacted you through RentTrack."
                  icon={Mail}
                />
                <div className="rounded-xl border border-[#dce8f5] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-4">
                  <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
                    <label className="relative min-w-0 flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input value={inquirySearch} onChange={(event) => setInquirySearch(event.target.value)} placeholder="Search name, email, or message…" aria-label="Search inquiries" className="h-9 rounded-lg border-slate-200 pl-9 text-sm" />
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <select value={inquiryTypeFilter} onChange={(event) => setInquiryTypeFilter(event.target.value)} aria-label="Filter inquiries by category" className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700">
                        <option value="all">All categories</option><option value="property">Property</option><option value="general">General</option>
                      </select>
                      <select value={inquiryFilter} onChange={(event) => setInquiryFilter(event.target.value)} aria-label="Filter inquiries by status" className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700">
                        <option value="all">All statuses</option><option value="new">New</option><option value="read">In progress</option><option value="replied">Replied</option><option value="closed">Closed</option>
                      </select>
                      <label className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2 text-[10px] text-slate-500">From<input type="date" value={inquiryDateFrom} onChange={(event) => setInquiryDateFrom(event.target.value)} aria-label="Inquiries from date" className="min-w-0 flex-1 bg-transparent text-[10px] text-slate-700 outline-none" /></label>
                      <label className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2 text-[10px] text-slate-500">To<input type="date" value={inquiryDateTo} onChange={(event) => setInquiryDateTo(event.target.value)} aria-label="Inquiries to date" className="min-w-0 flex-1 bg-transparent text-[10px] text-slate-700 outline-none" /></label>
                    </div>
                    <Button variant="outline" onClick={() => { setInquirySearch(""); setInquiryFilter("all"); setInquiryTypeFilter("all"); setInquiryDateFrom(""); setInquiryDateTo(""); }} className="h-9 rounded-lg border-slate-200 px-3 text-xs">Clear</Button>
                  </div>
                </div>
                <section aria-label="Inquiry metrics" className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                  {[
                    { label: "Total inquiries", value: inquiryCounts.total, tone: "text-blue-700 bg-blue-50" },
                    { label: "New", value: inquiryCounts.new, tone: "text-amber-700 bg-amber-50" },
                    { label: "In progress", value: inquiryCounts.inProgress, tone: "text-indigo-700 bg-indigo-50" },
                    { label: "Closed", value: inquiryCounts.closed, tone: "text-emerald-700 bg-emerald-50" },
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-lg border border-[#dce8f5] bg-white px-3 py-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:px-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{metric.label}</p>
                      <p className={cn("mt-1 inline-flex min-w-8 items-center justify-center rounded-md px-2 py-0.5 text-lg font-bold tabular-nums", metric.tone)}>{metric.value}</p>
                    </div>
                  ))}
                </section>
                <Card className="overflow-hidden border-[#dce8f5] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                  <CardHeader className="border-b border-slate-100 bg-[#f6f9fd] px-4 py-3 sm:px-5">
                    <CardTitle className="text-sm font-semibold text-slate-900">Inquiry records</CardTitle>
                    <CardDescription className="mt-1 text-xs text-slate-500">
                      {filteredInquiries.length} inquir{filteredInquiries.length === 1 ? "y" : "ies"} match your search and filters
                      <span id="inquiry-category-help" className="mt-1 block text-slate-600">General means no specific property; choosing a property links the inquiry to that listing.</span>
                    </CardDescription>
                  </CardHeader>
                  {initialLoad ? (
                    <div role="status" className="px-4 py-12 text-center text-sm text-slate-500">Loading inquiries…</div>
                  ) : loadError ? (
                    <div role="status" className="px-4 py-12 text-center text-sm text-red-600">Unable to load inquiries. Please refresh to try again.</div>
                  ) : inquiries.length === 0 ? (
                    <div className="px-4 py-12 text-center"><Mail className="mx-auto mb-3 h-9 w-9 text-slate-300" /><p className="text-sm font-semibold text-slate-700">No inquiries yet</p><p className="mt-1 text-xs text-slate-500">New landing page messages will appear here.</p></div>
                  ) : filteredInquiries.length === 0 ? (
                    <div className="px-4 py-12 text-center text-sm text-slate-500">No inquiries match these filters.</div>
                  ) : (
                    <>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[900px] border-collapse text-left">
                        <thead className="bg-[#f6f9fd]"><tr className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          <th className="px-4 py-3">Name / email</th><th className="px-4 py-3">Inquiry about</th><th className="px-4 py-3">Message</th><th className="px-4 py-3">Received</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {visibleInquiries.map((inq) => (
                            <tr key={inq.id} className="align-middle text-xs text-slate-700 transition-colors hover:bg-blue-50/40">
                              <td className="max-w-52 px-4 py-3">
                                <p className="truncate font-semibold text-slate-900">{inq.senderName}</p>
                                <p className="mt-0.5 truncate text-[10px] text-slate-500">{inq.senderEmail}</p>
                                {inq.senderPhone && <p className="mt-0.5 text-[10px] text-slate-500">{inq.senderPhone}</p>}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">
                                <select
                                  aria-label={`Inquiry about for ${inq.senderName}`}
                                  aria-describedby="inquiry-category-help"
                                  value={inq.propertyId || ""}
                                  disabled={updatingInquiryType === inq.id}
                                  onChange={(event) => void changeInquiryProperty(inq, event.target.value || null)}
                                  className="max-w-44 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 disabled:opacity-60"
                                >
                                  <option value="">General</option>
                                  {inq.propertyId && !properties.some((property) => property.id === inq.propertyId) && (
                                    <option value={inq.propertyId}>Current property</option>
                                  )}
                                  {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                                </select>
                              </td>
                              <td className="max-w-sm px-4 py-3">
                                <p className="line-clamp-2 whitespace-pre-wrap text-slate-700">{inq.text}</p>
                                {inq.replyText && <p className="mt-1 line-clamp-1 text-[10px] text-blue-700">Reply: {inq.replyText}</p>}
                                {inq.visitorReply && <p className="mt-1 line-clamp-1 text-[10px] text-slate-500">Visitor: {inq.visitorReply}</p>}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-600" title={formatDateTime(inq.createdAt)}>{getTimeAgo(inq.repliedAt || inq.createdAt)}</td>
                              <td className="px-4 py-3"><Badge variant={inq.status === "new" ? "default" : inq.status === "closed" ? "outline" : "info"} className="text-[10px] capitalize">{inq.status === "read" ? "In progress" : inq.status}</Badge></td>
                              <td className="px-4 py-3 text-right">
                                <DropdownMenu modal={false}>
                                  <DropdownMenuTrigger asChild><button type="button" className="inline-flex h-7 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50">Actions<ChevronDown className="ml-1 h-3.5 w-3.5" /></button></DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" sideOffset={4} side="bottom">
                                    <DropdownMenuItem onSelect={() => { setReplyingInquiry(inq.id); setInquiryReply(inq.replyText || ""); }}>Reply</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setShowAccountRequestModal(true)} className="text-amber-700 hover:bg-amber-50">Request Account</DropdownMenuItem>
                                    {inq.status === "new" && <DropdownMenuItem onSelect={() => markInquiryRead(inq.id)}>Mark Read</DropdownMenuItem>}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="divide-y divide-slate-100 md:hidden">
                      {visibleInquiries.map((inq) => (
                        <article key={inq.id} className="space-y-2.5 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">{inq.senderName}</p>
                              <p className="mt-0.5 truncate text-[11px] text-slate-500">{inq.senderEmail}</p>
                            </div>
                            <Badge variant={inq.status === "new" ? "default" : inq.status === "closed" ? "outline" : "info"} className="shrink-0 text-[10px] capitalize">{inq.status === "read" ? "In progress" : inq.status}</Badge>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                            <label className="flex min-w-0 items-center gap-1.5">
                              <span className="shrink-0">Inquiry about</span>
                              <select
                                aria-label={`Inquiry about for ${inq.senderName}`}
                                aria-describedby="inquiry-category-help"
                                value={inq.propertyId || ""}
                                disabled={updatingInquiryType === inq.id}
                                onChange={(event) => void changeInquiryProperty(inq, event.target.value || null)}
                                className="min-w-0 max-w-[150px] rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-700 disabled:opacity-60"
                              >
                                <option value="">General</option>
                                {inq.propertyId && !properties.some((property) => property.id === inq.propertyId) && (
                                  <option value={inq.propertyId}>Current property</option>
                                )}
                                {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                              </select>
                            </label>
                            <span title={formatDateTime(inq.createdAt)}>{getTimeAgo(inq.createdAt)}</span>
                          </div>
                          <p className="line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-slate-700">{inq.text}</p>
                          {inq.replyText && <p className="line-clamp-2 text-[11px] text-blue-700">Reply: {inq.replyText}</p>}
                          {inq.visitorReply && <p className="line-clamp-2 text-[11px] text-slate-500">Visitor: {inq.visitorReply}</p>}
                          <div className="flex justify-end">
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild><button type="button" className="inline-flex h-7 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50">Actions<ChevronDown className="ml-1 h-3.5 w-3.5" /></button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end" sideOffset={4} side="bottom">
                                <DropdownMenuItem onSelect={() => { setReplyingInquiry(inq.id); setInquiryReply(inq.replyText || ""); }}>Reply</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setShowAccountRequestModal(true)} className="text-amber-700 hover:bg-amber-50">Request Account</DropdownMenuItem>
                                {inq.status === "new" && <DropdownMenuItem onSelect={() => markInquiryRead(inq.id)}>Mark Read</DropdownMenuItem>}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </article>
                      ))}
                    </div>
                    </>
                  )}
                </Card>
                {!initialLoad && !loadError && filteredInquiries.length > 0 && <PaginationControls page={inquiryPage} total={filteredInquiries.length} onPageChange={setInquiryPage} />}
                <AccountRequestModal
                  isOpen={showAccountRequestModal}
                  onClose={() => setShowAccountRequestModal(false)}
                  agentName={user?.name || "Agent"}
                />
              </motion.div>
            )}

        {/* Landing inquiry reply modal */}
        {replyingInquiry && (() => {
          const inquiry = inquiries.find((item) => item.id === replyingInquiry);
          if (!inquiry) return null;
          return (
            <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="inquiry-reply-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !replying) setReplyingInquiry(null); }}>
              <div className="w-full max-w-lg rounded-2xl bg-surface shadow-2xl border border-border" onMouseDown={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                  <div>
                    <h2 id="inquiry-reply-title" className="text-lg font-semibold text-foreground">Reply to {inquiry.senderName}</h2>
                    <p className="text-xs text-text-secondary mt-1">{inquiry.senderEmail}</p>
                  </div>
                  <button type="button" aria-label="Close reply dialog" onClick={() => { if (!replying) setReplyingInquiry(null); }} className="rounded-lg p-2 text-text-secondary hover:bg-surface-secondary hover:text-foreground">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4 px-6 py-5">
                  <div className="rounded-lg bg-surface-secondary p-3">
                    <p className="text-xs font-medium text-text-secondary mb-1">Visitor message</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{inquiry.text}</p>
                  </div>
                   <form onSubmit={async (event) => {
                     event.preventDefault();
                     const reply = inquiryReply.trim();
                     if (!reply) return;
                     setReplying(true);
                     try {
                       const result = await updateInquiryStatus(inquiry.id, "replied", reply);
                       setInquiries((current) => current.map((item) => item.id === inquiry.id ? { ...item, status: "replied", replyText: reply, repliedAt: new Date().toISOString(), agentName: user?.name } : item));
                       setReplyingInquiry(null);
                       setInquiryReply("");
                       if (result && (result as any).emailSent) {
                         toast.success("Reply sent and email notification delivered");
                       } else {
                         toast.success("Reply saved, but email notification could not be sent");
                       }
                     } catch {
                       toast.error("Failed to send reply");
                     } finally {
                       setReplying(false);
                     }
                   }}>
                    <textarea autoFocus value={inquiryReply} onChange={(event) => setInquiryReply(event.target.value)} placeholder="Write your reply..." rows={5} className="w-full resize-none rounded-lg border border-border bg-surface p-3 text-sm text-foreground placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                    <div className="mt-4 flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setReplyingInquiry(null)} disabled={replying}>Cancel</Button>
                      <Button type="submit" disabled={replying || !inquiryReply.trim()}>{replying ? "Sending..." : "Send Reply"}</Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          );
        })()}

        {viewingThread && (
          <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) closeThread(); }}>
            <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-surface shadow-2xl border border-border" onMouseDown={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Conversation with {viewingThread.senderName}</h2>
                  <p className="text-xs text-text-secondary mt-1">{viewingThread.senderEmail}{viewingThread.senderPhone ? ` • ${viewingThread.senderPhone}` : ""}</p>
                </div>
                <button type="button" onClick={closeThread} className="rounded-lg p-2 text-text-secondary hover:bg-surface-secondary hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {threadMessages.length === 0 ? (
                  <p className="text-sm text-text-secondary text-center py-8">No messages in this conversation.</p>
                ) : (
                  threadMessages.map((msg) => (
                    msg.replyText ? (
                      <div key={msg.id} className="space-y-2">
                        <div className="flex justify-start">
                          <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-surface-secondary text-foreground">
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                            <p className="text-[10px] text-text-tertiary mt-1">{formatDateTime(msg.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-blue-600 text-white">
                            <p className="text-sm whitespace-pre-wrap">{msg.replyText}</p>
                            <p className="text-[10px] text-blue-100 mt-1">{formatDateTime(msg.repliedAt || msg.createdAt)}</p>
                            <p className="text-[10px] text-blue-100 mt-0.5">You • {msg.agentName || user?.name}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div key={msg.id} className="flex justify-start">
                        <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-surface-secondary text-foreground">
                          <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                          <p className="text-[10px] text-text-tertiary mt-1">{formatDateTime(msg.createdAt)}</p>
                        </div>
                      </div>
                    )
                  ))
                )}
                <div ref={threadEndRef} />
              </div>
              <div className="border-t border-border p-4">
                <form onSubmit={async (event) => {
                  event.preventDefault();
                  await sendThreadReply();
                }}>
                  <div className="flex gap-2">
                    <textarea
                      value={threadReply}
                      onChange={(event) => setThreadReply(event.target.value)}
                      placeholder="Write your reply..."
                      rows={2}
                      className="flex-1 resize-none rounded-lg border border-border bg-surface p-3 text-sm text-foreground placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                    <Button type="submit" disabled={threadSending || !threadReply.trim()}>{threadSending ? "Sending..." : "Send"}</Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Messaging Modal */}
        {selectedConversation && (
          <MessagingModal
            isOpen={isMessagingOpen}
            onClose={() => { setIsMessagingOpen(false); setSelectedConversation(null); }}
            otherUser={{
              id: selectedConversation.otherUser?.id || "",
              name: selectedConversation.otherUser?.name || "Unknown",
              email: selectedConversation.otherUser?.email || "",
              role: selectedConversation.otherUser?.role || "tenant",
              avatarUrl: selectedConversation.otherUser?.avatarUrl,
              allowMessages: true,
            }}
            properties={properties.map(p => ({ id: p.id, name: p.name, location: p.location, type: p.type, units: p.units, rentAmount: p.monthlyRevenue }))}
          />
        )}

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <ProfilePanel />
        )}

        {/* Receipt Modal */}
        <ReceiptModal
          isOpen={!!viewingReceipt}
          onClose={() => setViewingReceipt(null)}
          receiptUrl={viewingReceipt?.receiptUrl || null}
          payment={viewingReceipt || undefined}
        />
        {/* Assign Tenant Modal */}
        <AssignTenantModal
          isOpen={showAssignModal}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedTenant(null);
            setSelectedUnit(null);
          }}
          tenants={tenants}
          units={units}
          properties={properties}
          initialTenant={selectedTenant}
          initialUnit={selectedUnit}
          onSuccess={async () => {
            await loadData();
          }}
          onRequestTenantAccount={() => setShowAccountRequestModal(true)}
        />

        {showAccountRequestModal && (
          <AccountRequestModal
            isOpen={showAccountRequestModal}
            onClose={() => setShowAccountRequestModal(false)}
            agentName={user?.name || "Agent"}
          />
        )}
       </div>
  );
}
