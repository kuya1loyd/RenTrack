"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users, Settings, Activity, FileText, Stethoscope,
  Heart, CheckCircle2, XCircle, Search, Trash2,
  UserPlus, RefreshCw, Sliders,
  Bell, Home, Building2, CreditCard, Star, Plus,
  LayoutDashboard, MapPinned, HeartPulse, SlidersHorizontal,
  Eye, Pencil, KeyRound, Copy, Mail, MessageSquare, Phone,
  Shield, ShieldOff, RotateCcw, Download, ChevronDown, MoreHorizontal,
  Calendar, Check, Sparkles, Filter, UserCheck, MapPin, Clock, ExternalLink, Briefcase, AlertCircle, X, User,
} from "lucide-react";
import PropertyLocationMap from "@/components/property-location-map-loader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Modal } from "@/components/ui/modal";
import { cn, formatCurrency, formatDate, formatDateTime, getTimeAgo, getInitials, isSampleAccount } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  getUsers, getProperties, getUnits, getTenants, getNotifications,
  getPayments, getComplaints, getAllRatings, getAuditLogs,
  UserRecord, Property, Unit, TenantRecord, Notification, Payment, Complaint, Rating, AuditLog,
  deleteUser, updateUser, adminResetUserPassword,
  updateComplaintStatus,
  getComplaintById,
} from "@/lib/data";
import { toast } from "sonner";
import { useSearchParams, useRouter } from "next/navigation";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import MessagingPanel from "@/components/messaging-panel";
import MessagingModal from "@/components/messaging-modal";
import CreateTenantModal from "@/components/create-tenant-modal";
import { ManagementBanner } from "@/components/management-panel";
import { downloadExcelReport } from "@/lib/report-downloads";
import { useAdminData, useAdminDataset } from "@/lib/admin-data-store";
import SettingsPage from "@/app/dashboard/settings/page";

async function parseJsonSafely(res: Response) {
  try {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await res.json();
    }
    const text = await res.text();
    return { success: false, error: text || `HTTP ${res.status}` };
  } catch {
    return { success: false, error: `Invalid response (${res.status})` };
  }
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") || "overview";

  // Shared, cached datasets ("super useState") — see lib/admin-data-store.tsx
  const { refresh: refreshAdminData } = useAdminData();
  const [users, setUsers] = useAdminDataset("users");
  const [properties] = useAdminDataset("properties");
  const [units] = useAdminDataset("units");
  const [tenants, setTenants] = useAdminDataset("tenants");
  const [notifications, setNotifications] = useAdminDataset("notifications");
  const [payments] = useAdminDataset("payments");
  const [paymentPeriod, setPaymentPeriod] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [paymentReferenceDate, setPaymentReferenceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<"all" | "regular" | "advance">("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [complaints, setComplaints] = useAdminDataset("complaints");
  const [complaintSearch, setComplaintSearch] = useState("");
  const [complaintStatusFilter, setComplaintStatusFilter] = useState("all");
  const [complaintCategoryFilter, setComplaintCategoryFilter] = useState("all");
  const [ratings] = useAdminDataset("ratings");
  const [ratingSearch, setRatingSearch] = useState("");
  const [ratingTargetFilter, setRatingTargetFilter] = useState("all");
  const [ratingScoreFilter, setRatingScoreFilter] = useState("all");
  const [auditLogs] = useAdminDataset("auditLogs");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [propertySearch, setPropertySearch] = useState("");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("all");
  const [propertyStatusFilter, setPropertyStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "owner" | "agent" | "tenant">("all");
  const [userStatusFilter, setUserStatusFilter] = useState<"all" | "approved" | "pending" | "rejected" | "verified">("all");
  const [userSort, setUserSort] = useState<"newest" | "oldest" | "name-asc" | "name-desc" | "role">("newest");
  const [selectedUserDetails, setSelectedUserDetails] = useState<UserRecord | null>(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "owner" as "owner" | "agent" | "tenant" | "admin",
    phone: "",
    address: "",
  });
  const [unitSearch, setUnitSearch] = useState("");
  const [unitStatusFilter, setUnitStatusFilter] = useState<"all" | "occupied" | "vacant" | "maintenance">("all");
  const [unitPropertyFilter, setUnitPropertyFilter] = useState("all");
  const [unitTypeFilter, setUnitTypeFilter] = useState("all");
  const [tenantSearch, setTenantSearch] = useState("");
  const [tenantStatusFilter, setTenantStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [tenantPropertyFilter, setTenantPropertyFilter] = useState("all");
  const [diagnosisResults, setDiagnosisResults] = useState<Record<string, string> | null>(null);
  const [isRunningDiagnosis, setIsRunningDiagnosis] = useState(false);
  const [healthData] = useAdminDataset("healthData");
  const [systemConfig, setSystemConfig] = useAdminDataset("systemConfig");
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState<string>("");
  const [maintenanceMode, setMaintenanceMode] = useAdminDataset("maintenanceMode");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [isMessagingOpen, setIsMessagingOpen] = useState(false);
  const [showNewMessageDialog, setShowNewMessageDialog] = useState(false);
  const [newMessageSearch, setNewMessageSearch] = useState("");
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "" });
  const [resettingPassword, setResettingPassword] = useState<UserRecord | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);
  const [complaintReply, setComplaintReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<TenantRecord | null>(null);

  /** Force-refresh every admin dataset (used after mutations). Each dataset renders as soon as it arrives. */
  const loadData = useCallback(() => refreshAdminData(undefined, { force: true }), [refreshAdminData]);

  const openComplaint = useCallback(async (complaint: Complaint) => {
    try {
      const fresh = await getComplaintById(complaint.id);
      setSelectedComplaint(fresh || complaint);
    } catch {
      setSelectedComplaint(complaint);
    }
    if (complaint.tenantId) {
      try {
        const tenantList = await getTenants();
        setTenants(tenantList);
        const tenant = tenantList.find(t => t.id === complaint.tenantId);
        setSelectedTenant(tenant || null);
      } catch {
        // ignore
      }
    }
    router.push("/dashboard/admin?tab=complaints");
  }, [router]);

  useEffect(() => {
    // Cached data shows instantly; only stale datasets are re-fetched in the background.
    void refreshAdminData();
  }, [refreshAdminData]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      getNotifications(user.id).then(setNotifications).catch(() => {});
      if (activeTab === "complaints") {
        getComplaints().then(setComplaints).catch(() => {});
      }
    }, 10000);
    const handleFocus = () => {
      getNotifications(user.id).then(setNotifications).catch(() => {});
      if (activeTab === "complaints") {
        getComplaints().then(setComplaints).catch(() => {});
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [user, activeTab]);

  useEffect(() => {
    const refreshAllUsers = async () => {
      try {
        const [usersData, tenantsData] = await Promise.all([
          getUsers(),
          getTenants(),
        ]);
        setUsers(usersData);
        setTenants(tenantsData);
      } catch {
        // ignore
      }
    };
    window.addEventListener("renttrack-profile-updated", refreshAllUsers);
    return () => window.removeEventListener("renttrack-profile-updated", refreshAllUsers);
  }, []);

  const isAdvancePayment = (payment: Payment) => /advance/i.test(payment.notes || "") || payment.amountPaid > payment.amountDue;

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const paymentDate = new Date(payment.paymentDate || "");
      const selectedDate = new Date(`${paymentReferenceDate}T00:00:00`);
      if (Number.isNaN(paymentDate.getTime())) return false;

      const matchesPeriod = paymentPeriod === "yearly"
        ? paymentDate.getFullYear() === selectedDate.getFullYear()
        : paymentPeriod === "quarterly"
          ? paymentDate.getFullYear() === selectedDate.getFullYear() &&
            Math.floor(paymentDate.getMonth() / 3) === Math.floor(selectedDate.getMonth() / 3)
          : paymentDate.getFullYear() === selectedDate.getFullYear() &&
            paymentDate.getMonth() === selectedDate.getMonth();
      const matchesType = paymentTypeFilter === "all" ||
        (paymentTypeFilter === "advance" ? isAdvancePayment(payment) : !isAdvancePayment(payment));
      const matchesStatus = paymentStatusFilter === "all" || payment.status === paymentStatusFilter;
      const q = paymentSearch.trim().toLowerCase();
      const matchesSearch = !q || [
        payment.id,
        payment.tenantName,
        payment.propertyName,
        payment.unitId,
        payment.paymentMethod,
        String(payment.amountPaid),
      ].join(" ").toLowerCase().includes(q);

      return matchesPeriod && matchesType && matchesStatus && matchesSearch;
    });
  }, [payments, paymentPeriod, paymentReferenceDate, paymentTypeFilter, paymentStatusFilter, paymentSearch]);

  const filteredComplaints = useMemo(() => {
    const q = complaintSearch.trim().toLowerCase();
    return complaints.filter((c) => {
      if (complaintStatusFilter !== "all" && c.status !== complaintStatusFilter) return false;
      if (complaintCategoryFilter !== "all") {
        if (complaintCategoryFilter === "support" && c.targetType !== "support") return false;
        if (complaintCategoryFilter === "property" && c.targetType !== "property") return false;
        if (complaintCategoryFilter === "unit" && c.targetType !== "unit") return false;
      }
      if (!q) return true;
      const haystack = [
        c.subject,
        c.message || "",
        c.tenantName || "",
        c.tenantId || "",
        c.status,
        c.targetType || "",
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [complaints, complaintSearch, complaintStatusFilter, complaintCategoryFilter]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter((log) => {
      if (auditActionFilter !== "all" && log.action !== auditActionFilter) return false;
      if (!q) return true;
      const haystack = [
        log.action,
        log.actor,
        log.ipAddress || "",
        String(log.details?.source || ""),
        JSON.stringify(log.details || {}),
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [auditLogs, auditSearch, auditActionFilter]);

  const filteredRatings = useMemo(() => {
    const q = ratingSearch.trim().toLowerCase();
    return ratings.filter((r) => {
      if (ratingTargetFilter !== "all" && r.targetType !== ratingTargetFilter) return false;
      if (ratingScoreFilter !== "all" && String(r.rating) !== ratingScoreFilter) return false;
      if (!q) return true;
      const haystack = [
        r.userName || "",
        r.userId,
        r.targetId,
        r.comment || "",
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [ratings, ratingSearch, ratingTargetFilter, ratingScoreFilter]);

  const filteredProperties = useMemo(() => {
    const q = propertySearch.trim().toLowerCase();
    return properties.filter((p) => {
      if (propertyTypeFilter !== "all" && p.type !== propertyTypeFilter) return false;
      if (propertyStatusFilter !== "all" && p.status !== propertyStatusFilter) return false;
      if (!q) return true;
      return `${p.name} ${p.location} ${p.type} ${p.status}`.toLowerCase().includes(q);
    });
  }, [properties, propertySearch, propertyTypeFilter, propertyStatusFilter]);

  const filteredUnits = useMemo(() => {
    const q = unitSearch.trim().toLowerCase();
    return units.filter((u) => {
      const prop = properties.find((p) => p.id === u.propertyId);
      if (unitStatusFilter !== "all" && u.status !== unitStatusFilter) return false;
      if (unitPropertyFilter !== "all" && u.propertyId !== unitPropertyFilter) return false;
      if (unitTypeFilter !== "all" && prop?.type !== unitTypeFilter) return false;
      if (!q) return true;
      const haystack = [
        u.unitNumber,
        prop?.name || "",
        u.tenantName || "",
        u.status,
        String(u.rentAmount),
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [units, properties, unitSearch, unitStatusFilter, unitPropertyFilter, unitTypeFilter]);

  const filteredTenantsList = useMemo(() => {
    const q = tenantSearch.trim().toLowerCase();
    return tenants.filter((t) => {
      if (tenantStatusFilter !== "all" && t.status !== tenantStatusFilter) return false;
      if (tenantPropertyFilter !== "all" && t.propertyName !== tenantPropertyFilter) return false;
      if (!q) return true;
      const haystack = [t.name, t.email, t.phone || "", t.unitNumber || "", t.propertyName || "", t.status].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [tenants, tenantSearch, tenantStatusFilter, tenantPropertyFilter]);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (userStatusFilter !== "all" && (u.idVerificationStatus || "pending") !== userStatusFilter) return false;
      if (!q) return true;
      const haystack = [
        u.id,
        u.name,
        u.email,
        u.phone || "",
        u.address || "",
        u.role,
        u.idVerificationStatus || "",
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    }).sort((a, b) => {
      if (userSort === "oldest") return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      if (userSort === "name-asc") return (a.name || "").localeCompare(b.name || "");
      if (userSort === "name-desc") return (b.name || "").localeCompare(a.name || "");
      if (userSort === "role") return a.role.localeCompare(b.role);
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [users, roleFilter, userStatusFilter, searchTerm, userSort]);

  const userCounts = useMemo(() => ({
    total: users.length,
    admin: users.filter((u) => u.role === "admin").length,
    owner: users.filter((u) => u.role === "owner").length,
    agent: users.filter((u) => u.role === "agent").length,
    tenant: users.filter((u) => u.role === "tenant").length,
    approved: users.filter((u) => u.idVerificationStatus === "approved").length,
    verified: users.filter((u) => u.idVerificationStatus === "approved" || isSampleAccount(u.email) || u.role === "admin" || u.role === "owner").length,
    pending: users.filter((u) => !u.idVerificationStatus || u.idVerificationStatus === "pending").length,
    rejected: users.filter((u) => u.idVerificationStatus === "rejected").length,
  }), [users]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.email || !newUserForm.password) {
      toast.error("Name, email, and password are required");
      return;
    }
    if (newUserForm.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setIsCreatingUser(true);
    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newUserForm),
      });
      const data = await parseJsonSafely(res);
      if (data.success) {
        toast.success(`Account for ${newUserForm.name} created successfully. Verification code sent to ${newUserForm.email}.`);
        setShowCreateUserModal(false);
        setNewUserForm({
          name: "",
          email: "",
          password: "",
          role: "owner",
          phone: "",
          address: "",
        });
        await loadData();
      } else {
        toast.error(data.error || "Failed to create user");
      }
    } catch {
      toast.error("An error occurred while creating user");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const exportUsersToExcel = () => {
    const rows: Array<Array<string>> = [
      ["User ID", "Name", "Email", "Phone", "Role", "Assigned Property / Unit", "Address", "Verification Status", "Status", "Joined Date"],
      ...filteredUsers.map((u) => {
        const matchedTenant = tenants.find((t) => t.email.toLowerCase() === u.email.toLowerCase() || t.id === u.id);
        const phone = u.phone || matchedTenant?.phone || "Not provided";
        const address = u.address || matchedTenant?.address || "Not provided";
        const isVerified = Boolean(
          u.role === "admin" ||
          u.role === "owner" ||
          isSampleAccount(u.email) ||
          u.idVerificationStatus === "approved" ||
          (u as any).id_verification_status === "approved" ||
          (u as any).idVerified ||
          (u as any).verified ||
          (u as any).idVerificationUrl ||
          matchedTenant?.idVerificationUrl ||
          (matchedTenant as any)?.isVerified
        );
        let propUnit = "System Admin";
        if (u.role === "tenant") {
          const pName = matchedTenant?.propertyName || (matchedTenant?.unitId && properties.find((p) => p.id === units.find((un) => un.id === matchedTenant?.unitId)?.propertyId)?.name);
          const uNum = matchedTenant?.unitNumber || (matchedTenant?.unitId && units.find((un) => un.id === matchedTenant?.unitId)?.unitNumber);
          propUnit = [pName, uNum ? `Unit ${uNum}` : ""].filter(Boolean).join(" - ") || "Unassigned";
        } else if (u.role === "owner") {
          const count = properties.filter((p) => p.createdBy === u.id || p.createdBy === u.email).length;
          propUnit = `${count} Owned`;
        } else if (u.role === "agent") {
          const count = properties.filter((p) => p.agentId === u.id).length;
          propUnit = `${count} Managed`;
        }
        return [
          u.id,
          u.name || "",
          u.email,
          phone,
          u.role,
          propUnit,
          address,
          isVerified ? "Verified ID" : "Pending",
          "Active",
          u.createdAt ? formatDate(u.createdAt) : "",
        ];
      }),
    ];
    downloadExcelReport(`renttrack-users-${new Date().toISOString().slice(0, 10)}.xls`, [
      { name: "Users", rows },
    ]);
    toast.success("User directory exported");
  };

  useEffect(() => {
    if (activeTab === "complaints") {
      getTenants().then(setTenants).catch(() => {});
      getComplaints().then(setComplaints).catch(() => {});
    }
  }, [activeTab]);

  const saveConfig = async (key: string, value: string) => {
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [key]: value }),
      });
      const data = await parseJsonSafely(res);
      if (data.success && data.config) {
        setSystemConfig(data.config);
        toast.success(`${key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} updated`);
      } else {
        toast.error(data.error || "Failed to update config");
      }
    } catch {
      toast.error("Failed to update config");
    }
  };

  const handleCreateTenant = async (formData: {
    name: string;
    email: string;
    phone: string;
    address: string;
    password: string;
  }) => {
    if (!formData.name || !formData.email || !formData.password) {
      toast.error("Name, email, and password are required");
      return;
    }
    setIsCreatingTenant(true);
    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: formData.name, email: formData.email, phone: formData.phone, address: formData.address, password: formData.password, role: "tenant" }),
      });
      const data = await parseJsonSafely(res);
      if (data.success) {
        await fetch("/api/data/tenants", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ id: data.user?.id, name: formData.name, email: formData.email, phone: formData.phone, address: formData.address }) });
        if (data.emailSent) {
          toast.success(`Tenant account created. Login details and verification code were emailed to ${formData.email}.`);
        } else {
          toast.error(data.emailStatus === "not_configured"
            ? "Tenant account created, but no login email was sent because SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS."
            : "Tenant account created, but the login email could not be delivered. Check SMTP settings and server logs.");
        }
        setShowCreateTenant(false);
        loadData();
      } else {
        toast.error(data.error || "Failed to create tenant account");
      }
    } catch {
      toast.error("Failed to create tenant account");
    } finally {
      setIsCreatingTenant(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      toast.success("User deleted successfully");
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const handleEditUser = (u: UserRecord) => {
    setEditingUser(u);
    setEditForm({ name: u.name, email: u.email });
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    try {
      const updated = await updateUser(editingUser.id, { name: editForm.name, email: editForm.email });
      if (updated) {
        setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...updated } : u));
        toast.success("User updated successfully");
        setEditingUser(null);
      } else {
        toast.error("Failed to update user");
      }
    } catch {
      toast.error("Failed to update user");
    }
  };

  const handleResetPassword = async () => {
    if (!resettingPassword || !newPassword) return;
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    try {
      await adminResetUserPassword(resettingPassword.id, newPassword);
      toast.success("Password reset successfully");
      setResettingPassword(null);
      setNewPassword("");
    } catch {
      toast.error("Failed to reset password");
    }
  };

  const occupiedUnits = units.filter((unit) => unit.status === "occupied").length;
  const availableUnits = units.filter((unit) => unit.status === "vacant").length;
  const rentingTenants = tenants.filter((tenant) => tenant.status === "active" && tenant.assignmentStatus === "confirmed").length;
  const roleCounts = {
    admin: users.filter((account) => account.role === "admin").length,
    owner: users.filter((account) => account.role === "owner").length,
    agent: users.filter((account) => account.role === "agent").length,
    tenant: users.filter((account) => account.role === "tenant").length,
  };
  const userRoleMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.role));
    return map;
  }, [users]);

  const userUpdates = useMemo(() => {
    const updates: { id: string; title: string; detail: string; role: string; date: string }[] = [];
    notifications.forEach((notification) => {
      const role = userRoleMap.get(notification.userId);
      if (role === "owner" || role === "tenant" || role === "agent") {
        updates.push({
          id: `notification-${notification.id}`,
          title: notification.title,
          detail: notification.message,
          role,
          date: notification.createdAt,
        });
      }
    });
    auditLogs.forEach((log) => {
      if (!log.userId) return;
      const role = userRoleMap.get(log.userId);
      if (role === "owner" || role === "tenant" || role === "agent") {
        updates.push({
          id: `audit-${log.id}`,
          title: log.action.replace(/_/g, " "),
          detail: `${log.actor} • ${formatDate(log.createdAt)}`,
          role,
          date: log.createdAt,
        });
      }
    });
    return updates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);
  }, [notifications, auditLogs, userRoleMap]);

  const getRoleBadge = (role: string) => {
    if (role === "owner") return { label: "Owner", className: "bg-amber-50 text-amber-700 border-amber-200" };
    if (role === "tenant") return { label: "Tenant", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    if (role === "agent") return { label: "Agent", className: "bg-blue-50 text-blue-700 border-blue-200" };
    return { label: role, className: "bg-gray-50 text-gray-700 border-gray-200" };
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6 w-full max-w-none">
      {/* Map Tab */}
      {activeTab === "map" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <ManagementBanner
            category="GEOGRAPHIC OVERVIEW"
            title="Property Map"
            description="Explore interactive locations, occupancy distribution, and property statuses."
            icon={MapPinned}
          />
          <PropertyLocationMap hideHeader />
        </motion.div>
      )}

      {activeTab === "overview" && (
        <div className="space-y-5">
          <ManagementBanner
            category="SYSTEM OVERVIEW"
            title="Admin Dashboard"
            description="Monitor platform properties, occupancy trends, user accounts, and platform health."
            icon={LayoutDashboard}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Properties", value: properties.length, icon: Building2, tone: "text-blue-600 bg-blue-50" },
              { label: "Total Units", value: units.length, icon: Home, tone: "text-indigo-600 bg-indigo-50" },
              { label: "Occupied Units", value: occupiedUnits, icon: Users, tone: "text-emerald-600 bg-emerald-50" },
              { label: "Available Units", value: availableUnits, icon: Home, tone: "text-amber-600 bg-amber-50" },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-gray-200 shadow-sm transition-all hover:shadow-md dark:border-gray-700">
                  <CardContent className="flex items-center justify-between p-5">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
                      <motion.p
                        className="mt-2 text-3xl font-bold text-gray-900 dark:text-white"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      >
                        {stat.value}
                      </motion.p>
                    </div>
                    <motion.div
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 10 }}
                      className={cn("flex h-11 w-11 items-center justify-center rounded-xl", stat.tone)}
                    >
                      <stat.icon className="h-5 w-5" />
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {[
              { title: "Unit Occupancy", description: "Occupied and available rental units", primary: occupiedUnits, secondary: availableUnits, primaryLabel: "Occupied Units", secondaryLabel: "Available Units", primaryColor: "#2563eb", secondaryColor: "#cbd5e1" },
              { title: "Rental Status", description: "Tenants renting versus units available", primary: rentingTenants, secondary: availableUnits, primaryLabel: "Currently Renting", secondaryLabel: "Available Units", primaryColor: "#16a34a", secondaryColor: "#cbd5e1" },
            ].map((chart) => {
              const total = chart.primary + chart.secondary;
              const primaryPercent = total ? Math.round((chart.primary / total) * 100) : 0;
              return <motion.div key={chart.title} whileHover={{ y: -2 }} transition={{ duration: 0.2 }}><Card className="border-gray-200 shadow-sm dark:border-gray-700">
                <CardHeader><CardTitle className="text-base text-gray-900 dark:text-white">{chart.title}</CardTitle><CardDescription>{chart.description}</CardDescription></CardHeader>
                <CardContent className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[220px_1fr]">
                  <div className="h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: chart.primaryLabel, value: chart.primary }, { name: chart.secondaryLabel, value: chart.secondary }]} innerRadius={58} outerRadius={88} paddingAngle={3} dataKey="value" stroke="none"><Cell fill={chart.primaryColor} /><Cell fill={chart.secondaryColor} /></Pie><Tooltip /></PieChart></ResponsiveContainer></div>
                  <div className="space-y-4">{[[chart.primaryLabel, chart.primary, chart.primaryColor, primaryPercent], [chart.secondaryLabel, chart.secondary, chart.secondaryColor, 100 - primaryPercent]].map(([label, value, color, percent]) => <motion.div key={String(label)} whileHover={{ x: 2 }} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 dark:border-gray-700 transition-all"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: String(color) }} /><span className="text-sm text-gray-600 dark:text-gray-300">{label}</span></div><span className="text-sm font-semibold text-gray-900 dark:text-white">{value} <span className="ml-1 text-xs font-normal text-gray-400">({percent}%)</span></span></motion.div>)}</div>
                </CardContent>
              </Card>
              </motion.div>
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="border-gray-200 shadow-sm dark:border-gray-700"><CardHeader><CardTitle className="text-base text-gray-900 dark:text-white">User Overview</CardTitle><CardDescription>Accounts by role</CardDescription></CardHeader><CardContent className="space-y-3">{[["Total Users", users.length], ["Administrators", roleCounts.admin], ["Property Owners", roleCounts.owner], ["Agents", roleCounts.agent], ["Tenants", roleCounts.tenant]].map(([label, value]) => <motion.div key={String(label)} whileHover={{ x: 2 }} className="flex justify-between text-sm transition-all"><span className="text-gray-500 dark:text-gray-400">{label}</span><span className="font-semibold text-gray-900 dark:text-white">{value}</span></motion.div>)}</CardContent></Card>
            <Card className="border-gray-200 shadow-sm dark:border-gray-700"><CardHeader><CardTitle className="text-base text-gray-900 dark:text-white">Recent Updates</CardTitle><CardDescription>Latest activity from owners, tenants, and agents</CardDescription></CardHeader><CardContent className="space-y-3">{userUpdates.length ? userUpdates.map((update) => { const badge = getRoleBadge(update.role); return <motion.div key={update.id} whileHover={{ x: 2 }} className="flex gap-2 border-b border-gray-100 pb-3 last:border-0 dark:border-gray-700 cursor-default transition-all"><Activity className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-medium capitalize text-gray-900 dark:text-white">{update.title}</p><span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}>{badge.label}</span></div><p className="truncate text-xs text-gray-500 dark:text-gray-400">{update.detail}</p></div></motion.div>; }) : <p className="py-4 text-center text-sm text-gray-500">No updates from owners, tenants, or agents yet</p>}</CardContent></Card>
            <Card className="border-gray-200 shadow-sm dark:border-gray-700 hover:shadow-md transition-all cursor-pointer" onClick={() => router.push("/dashboard/admin?tab=complaints")}><CardHeader><CardTitle className="text-base text-gray-900 dark:text-white">Recent Complaints</CardTitle><CardDescription>Latest tenant complaints</CardDescription></CardHeader><CardContent className="space-y-3">{complaints.slice(0, 5).length ? complaints.slice(0, 5).map((c) => { const tenant = tenants.find(t => t.id === c.tenantId); return (<motion.div key={c.id} whileHover={{ scale: 1.01 }} className="flex gap-3 border-b border-gray-100 pb-3 last:border-0 dark:border-gray-700 cursor-pointer transition-all" onClick={() => openComplaint(c)}><Avatar src={tenant?.avatarUrl} fallback={(tenant?.name || c.tenantName || c.tenantId || "T").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()} size="sm" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2 flex-wrap"><p className="truncate text-sm font-medium text-gray-900 dark:text-white">{c.subject}</p><motion.span whileHover={{ scale: 1.05 }} className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all", c.priority === "urgent" && "bg-red-50 text-red-700 border-red-200", c.priority === "high" && "bg-orange-50 text-orange-700 border-orange-200", c.priority === "medium" && "bg-amber-50 text-amber-700 border-amber-200", c.priority === "low" && "bg-gray-50 text-gray-700 border-gray-200")}>{c.priority}</motion.span></div><p className="truncate text-xs text-gray-500 dark:text-gray-400">{tenant?.name || c.tenantName || c.tenantId}</p><div className="mt-1">                                <motion.span whileHover={{ scale: 1.05 }} className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all", c.status === "open" && "bg-red-50 text-red-700 border-red-200", c.status === "in_progress" && "bg-amber-50 text-amber-700 border-amber-200", c.status === "resolved" && "bg-emerald-50 text-emerald-700 border-emerald-200", c.status === "closed" && "bg-gray-50 text-gray-700 border-gray-200")}>{c.status.replace("_", " ")}</motion.span>
                                {c.tenantReplyText && <motion.span whileHover={{ scale: 1.05 }} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-blue-200 bg-blue-50 text-blue-700">Tenant Replied</motion.span>}</div></div></motion.div>); }) : <p className="py-4 text-center text-sm text-gray-500">No complaints yet</p>}</CardContent></Card>
          </div>
        </div>
      )}

      {/* User Accounts Tab */}
      {activeTab === "users" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <ManagementBanner
            category="SYSTEM ADMINISTRATION"
            title="User Accounts Directory"
            description="Complete registry of administrators, property owners, agents, and tenants across the system."
            icon={Users}
          />

          {/* Quick Metrics Badges */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 my-6">
            <motion.div
              whileHover={{ y: -2 }}
              onClick={() => setRoleFilter("all")}
              className={cn(
                "cursor-pointer rounded-xl border p-3.5 transition-all shadow-sm",
                roleFilter === "all" ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500" : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900"
              )}
            >
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>All Accounts</span>
                <Users className="h-4 w-4 text-gray-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{userCounts.total}</p>
            </motion.div>

            <motion.div
              whileHover={{ y: -2 }}
              onClick={() => setRoleFilter("admin")}
              className={cn(
                "cursor-pointer rounded-xl border p-3.5 transition-all shadow-sm",
                roleFilter === "admin" ? "border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 ring-1 ring-purple-500" : "border-gray-200 bg-white hover:border-purple-200 dark:border-gray-800 dark:bg-gray-900"
              )}
            >
              <div className="flex items-center justify-between text-xs text-purple-600 dark:text-purple-400">
                <span>Admins</span>
                <Shield className="h-4 w-4 text-purple-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-purple-700 dark:text-purple-300">{userCounts.admin}</p>
            </motion.div>

            <motion.div
              whileHover={{ y: -2 }}
              onClick={() => setRoleFilter("owner")}
              className={cn(
                "cursor-pointer rounded-xl border p-3.5 transition-all shadow-sm",
                roleFilter === "owner" ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500" : "border-gray-200 bg-white hover:border-blue-200 dark:border-gray-800 dark:bg-gray-900"
              )}
            >
              <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400">
                <span>Owners</span>
                <Building2 className="h-4 w-4 text-blue-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-blue-700 dark:text-blue-300">{userCounts.owner}</p>
            </motion.div>

            <motion.div
              whileHover={{ y: -2 }}
              onClick={() => setRoleFilter("agent")}
              className={cn(
                "cursor-pointer rounded-xl border p-3.5 transition-all shadow-sm",
                roleFilter === "agent" ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-1 ring-amber-500" : "border-gray-200 bg-white hover:border-amber-200 dark:border-gray-800 dark:bg-gray-900"
              )}
            >
              <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
                <span>Agents</span>
                <Users className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-300">{userCounts.agent}</p>
            </motion.div>

            <motion.div
              whileHover={{ y: -2 }}
              onClick={() => setRoleFilter("tenant")}
              className={cn(
                "cursor-pointer rounded-xl border p-3.5 transition-all shadow-sm",
                roleFilter === "tenant" ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500" : "border-gray-200 bg-white hover:border-emerald-200 dark:border-gray-800 dark:bg-gray-900"
              )}
            >
              <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
                <span>Tenants</span>
                <UserCheck className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300">{userCounts.tenant}</p>
            </motion.div>

            <motion.div
              whileHover={{ y: -2 }}
              onClick={() => setUserStatusFilter(userStatusFilter === "verified" ? "all" : "verified")}
              className={cn(
                "cursor-pointer rounded-xl border p-3.5 transition-all shadow-sm",
                userStatusFilter === "verified" ? "border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 ring-1 ring-teal-500" : "border-gray-200 bg-white hover:border-teal-200 dark:border-gray-800 dark:bg-gray-900"
              )}
            >
              <div className="flex items-center justify-between text-xs text-teal-600 dark:text-teal-400">
                <span>Verified IDs</span>
                <CheckCircle2 className="h-4 w-4 text-teal-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-teal-700 dark:text-teal-300">{userCounts.verified}</p>
            </motion.div>
          </div>

          {/* Filtering, Dropdown, Search Bar & Actions Toolbar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 mb-6 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, email, address, or role..."
                  className="h-10 w-full rounded-xl border-gray-200 bg-gray-50/50 pl-10 text-sm focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-800"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Dropdowns */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Role Dropdown */}
                <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                  <span className="text-xs font-medium text-gray-500">Role:</span>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as any)}
                    className="bg-transparent text-xs font-semibold text-gray-800 outline-none dark:text-gray-200 cursor-pointer"
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">System Administrator</option>
                    <option value="owner">Property Owner</option>
                    <option value="agent">Agent</option>
                    <option value="tenant">Tenant</option>
                  </select>
                </div>

                {/* Verification / Status Dropdown */}
                <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                  <span className="text-xs font-medium text-gray-500">Status:</span>
                  <select
                    value={userStatusFilter}
                    onChange={(e) => setUserStatusFilter(e.target.value as any)}
                    className="bg-transparent text-xs font-semibold text-gray-800 outline-none dark:text-gray-200 cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="verified">Verified ID</option>
                    <option value="unverified">Pending / Unverified</option>
                  </select>
                </div>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                  <span className="text-xs font-medium text-gray-500">Sort:</span>
                  <select
                    value={userSort}
                    onChange={(e) => setUserSort(e.target.value as any)}
                    className="bg-transparent text-xs font-semibold text-gray-800 outline-none dark:text-gray-200 cursor-pointer"
                  >
                    <option value="name">Name (A–Z)</option>
                    <option value="email">Email (A–Z)</option>
                    <option value="role">Role</option>
                    <option value="date_desc">Newest First</option>
                    <option value="date_asc">Oldest First</option>
                  </select>
                </div>

                {/* Reset Filters */}
                {(searchTerm || roleFilter !== "all" || userStatusFilter !== "all" || userSort !== "newest") && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSearchTerm("");
                      setRoleFilter("all");
                      setUserStatusFilter("all");
                      setUserSort("newest");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900 dark:text-gray-400"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </motion.button>
                )}

                {/* Export Excel */}
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportUsersToExcel}
                    className="h-9 rounded-xl border-gray-200 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5 text-gray-500" />
                    Export Excel
                  </Button>
                </motion.div>

                {/* Add User Button */}
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="sm"
                    onClick={() => setShowCreateUserModal(true)}
                    className="h-9 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add Account
                  </Button>
                </motion.div>
              </div>
            </div>
          </div>

          <Card className="border border-gray-200 shadow-sm dark:border-gray-800">
            <CardHeader className="border-b border-gray-100 bg-gray-50/60 px-6 py-4 dark:border-gray-800 dark:bg-gray-800/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-gray-900 dark:text-white">
                    Accounts Registry
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Showing {filteredUsers.length} of {users.length} registered accounts
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-semibold text-xs dark:bg-blue-950/40 dark:text-blue-300">
                  {filteredUsers.length} records
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800">
                    <Search className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">No accounts match the current filters</h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Try adjusting your search keywords or resetting the dropdown filters.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setSearchTerm(""); setRoleFilter("all"); setUserStatusFilter("all"); }}
                    className="mt-4 h-8 rounded-lg text-xs"
                  >
                    Clear Filters
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow className="bg-gray-50/60 dark:bg-gray-800/40 text-[10px] uppercase tracking-wider text-gray-500 font-semibold border-b border-gray-100 dark:border-gray-800">
                        <TableHead className="pl-4 pr-2 py-2.5 h-10 font-semibold">Account & ID</TableHead>
                        <TableHead className="px-2 py-2.5 h-10 font-semibold">Contact (Email & Phone)</TableHead>
                        <TableHead className="px-2 py-2.5 h-10 font-semibold">Role</TableHead>
                        <TableHead className="px-2 py-2.5 h-10 font-semibold">Property / Unit</TableHead>
                        <TableHead className="px-2 py-2.5 h-10 font-semibold">Address</TableHead>
                        <TableHead className="px-2 py-2.5 h-10 font-semibold">Verification</TableHead>
                        <TableHead className="px-2 py-2.5 h-10 font-semibold">Status & Activity</TableHead>
                        <TableHead className="px-2 py-2.5 h-10 font-semibold">Joined</TableHead>
                        <TableHead className="pr-4 pl-2 py-2.5 h-10 text-right font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u, i) => {
                        const matchedTenant = tenants.find(
                          (t) => t.email.toLowerCase() === u.email.toLowerCase() || t.id === u.id
                        );
                        const userPhone = u.phone || matchedTenant?.phone || null;
                        const userAddress = u.address || matchedTenant?.address || null;
                        const isVerified = Boolean(
                          u.role === "admin" ||
                          u.role === "owner" ||
                          isSampleAccount(u.email) ||
                          u.idVerificationStatus === "approved" ||
                          (u as any).id_verification_status === "approved" ||
                          (u as any).idVerified ||
                          (u as any).verified ||
                          (u as any).idVerificationUrl ||
                          matchedTenant?.idVerificationUrl ||
                          (matchedTenant as any)?.isVerified
                        );

                        // Detailed Property / Unit metadata
                        let propTitle = "Platform Superuser";
                        let propSubtitle: string | undefined = undefined;
                        let unitBadge: string | undefined = undefined;

                        if (u.role === "tenant") {
                          const pName = matchedTenant?.propertyName || (matchedTenant?.unitId && properties.find((p) => p.id === units.find((un) => un.id === matchedTenant?.unitId)?.propertyId)?.name);
                          const uNum = matchedTenant?.unitNumber || (matchedTenant?.unitId && units.find((un) => un.id === matchedTenant?.unitId)?.unitNumber);
                          propTitle = pName || "No Property Assigned";
                          propSubtitle = matchedTenant?.rentAmount ? formatCurrency(matchedTenant.rentAmount) + "/mo" : undefined;
                          unitBadge = uNum ? `Unit ${uNum}` : undefined;
                        } else if (u.role === "owner") {
                          const ownedProps = properties.filter((p) => p.createdBy === u.id || p.createdBy === u.email);
                          propTitle = ownedProps.length === 1 ? "1 Property Owned" : `${ownedProps.length} Properties Owned`;
                          propSubtitle = ownedProps.length > 0 ? ownedProps.map((p) => p.name).slice(0, 2).join(", ") : "No properties listed";
                        } else if (u.role === "agent") {
                          const agentProps = properties.filter((p) => p.agentId === u.id);
                          propTitle = agentProps.length === 1 ? "1 Managed Property" : `${agentProps.length} Managed Properties`;
                          propSubtitle = agentProps.length > 0 ? agentProps.map((p) => p.name).slice(0, 2).join(", ") : "No properties assigned";
                        }

                        return (
                          <motion.tr
                            key={u.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.02, duration: 0.2 }}
                            className="border-b border-border/50 hover:bg-surface-secondary transition-all duration-200"
                          >
                            {/* Account & ID */}
                            <TableCell className="pl-4 pr-2 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="relative shrink-0">
                                  <Avatar
                                    src={u.avatarUrl}
                                    fallback={getInitials(u.name || "User")}
                                    size="sm"
                                  />
                                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-white bg-emerald-500 dark:border-gray-900" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[120px] text-xs">
                                    {u.name || "Unnamed"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(u.id);
                                      toast.success("User ID copied");
                                    }}
                                    className="inline-flex items-center gap-1 font-mono text-[10px] text-gray-400 hover:text-blue-600 transition-colors"
                                    title="Click to copy User ID"
                                  >
                                    <span>#{u.id.slice(0, 8)}</span>
                                    <Copy className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              </div>
                            </TableCell>

                            {/* Contact (Email & Phone) */}
                            <TableCell className="px-2 py-2.5">
                              <div className="flex flex-col gap-0.5 text-xs">
                                <a href={`mailto:${u.email}`} className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 hover:text-blue-600 transition-colors">
                                  <Mail className="h-3 w-3 text-gray-400 shrink-0" />
                                  <span className="truncate max-w-[150px]">{u.email}</span>
                                </a>
                                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-[11px]">
                                  <Phone className="h-3 w-3 text-gray-400 shrink-0" />
                                  {userPhone ? (
                                    <a href={`tel:${userPhone}`} className="hover:text-blue-600 transition-colors">
                                      {userPhone}
                                    </a>
                                  ) : (
                                    <span>—</span>
                                  )}
                                </div>
                              </div>
                            </TableCell>

                            {/* Role */}
                            <TableCell className="px-2 py-2.5">
                              <span
                                className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border",
                                  u.role === "admin" && "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
                                  u.role === "owner" && "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
                                  u.role === "agent" && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
                                  u.role === "tenant" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
                                )}
                              >
                                {u.role === "admin" ? "Admin" : u.role === "owner" ? "Owner" : u.role === "agent" ? "Agent" : "Tenant"}
                              </span>
                            </TableCell>

                            {/* Property / Unit */}
                            <TableCell className="px-2 py-2.5">
                              <div className="flex flex-col gap-0.5 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="h-3 w-3 text-gray-400 shrink-0" />
                                  <span className="font-medium text-gray-900 dark:text-white truncate max-w-[130px]">
                                    {propTitle}
                                  </span>
                                  {unitBadge && (
                                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                                      {unitBadge}
                                    </span>
                                  )}
                                </div>
                                {propSubtitle && (
                                  <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[140px] pl-4.5">
                                    {propSubtitle}
                                  </span>
                                )}
                              </div>
                            </TableCell>

                            {/* Address */}
                            <TableCell className="px-2 py-2.5 max-w-[130px]">
                              <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                                <MapPin className="h-3 w-3 text-gray-400 shrink-0" />
                                <span className="truncate">{userAddress || "—"}</span>
                              </div>
                            </TableCell>

                            {/* Verification */}
                            <TableCell className="px-2 py-2.5">
                              {isVerified ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Verified ID
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800">
                                  <Clock className="h-3 w-3" />
                                  Pending
                                </span>
                              )}
                            </TableCell>

                            {/* Status & Activity */}
                            <TableCell className="px-2 py-2.5">
                              <div className="flex flex-col gap-0.5 text-xs">
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Active
                                </span>
                                <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                  {(u as any).lastLoginAt ? `Active ${getTimeAgo((u as any).lastLoginAt)}` : "Registered"}
                                </span>
                              </div>
                            </TableCell>

                            {/* Joined */}
                            <TableCell className="px-2 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {u.createdAt ? formatDate(u.createdAt) : "—"}
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="pr-4 pl-2 py-2.5 text-right">
                              <div className="flex items-center justify-end">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <motion.button
                                      whileHover={{ scale: 1.15, backgroundColor: "rgba(239, 246, 255, 0.9)" }}
                                      whileTap={{ scale: 0.9 }}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 shadow-2xs transition-all hover:border-blue-300 hover:text-blue-600 focus:outline-none dark:border-gray-700 dark:text-gray-400"
                                      aria-label="User actions"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </motion.button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    sideOffset={6}
                                    className="w-56 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl backdrop-blur-md dark:border-gray-700 dark:bg-gray-900"
                                  >
                                    <DropdownMenuItem
                                      onSelect={() => setSelectedUserDetails(u)}
                                      className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer transition-all duration-150 hover:translate-x-1"
                                    >
                                      <Eye className="h-3.5 w-3.5 text-blue-500 transition-transform duration-150 group-hover:scale-110" />
                                      <span>View Complete Details</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      onSelect={() => handleEditUser(u)}
                                      className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-amber-50 hover:text-amber-700 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer transition-all duration-150 hover:translate-x-1"
                                    >
                                      <Pencil className="h-3.5 w-3.5 text-amber-500 transition-transform duration-150 group-hover:scale-110" />
                                      <span>Edit Profile</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      onSelect={() => setResettingPassword(u)}
                                      className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer transition-all duration-150 hover:translate-x-1"
                                    >
                                      <KeyRound className="h-3.5 w-3.5 text-purple-500 transition-transform duration-150 group-hover:scale-110" />
                                      <span>Reset Password</span>
                                    </DropdownMenuItem>

                                    <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

                                    <DropdownMenuItem
                                      onSelect={() => {
                                        navigator.clipboard.writeText(u.id);
                                        toast.success("User ID copied to clipboard");
                                      }}
                                      className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800 cursor-pointer transition-all duration-150 hover:translate-x-1"
                                    >
                                      <Copy className="h-3.5 w-3.5 text-gray-400 transition-transform duration-150 group-hover:scale-110" />
                                      <span>Copy User ID</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      onSelect={() => {
                                        navigator.clipboard.writeText(u.email);
                                        toast.success("Email copied to clipboard");
                                      }}
                                      className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800 cursor-pointer transition-all duration-150 hover:translate-x-1"
                                    >
                                      <Mail className="h-3.5 w-3.5 text-gray-400 transition-transform duration-150 group-hover:scale-110" />
                                      <span>Copy Email</span>
                                    </DropdownMenuItem>

                                    <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

                                    <DropdownMenuItem
                                      onSelect={() => handleDeleteUser(u.id)}
                                      className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer transition-all duration-150 hover:translate-x-1"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-red-500 transition-transform duration-150 group-hover:scale-110" />
                                      <span>Delete Account</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
        )}
      </CardContent>
    </Card>
  </motion.div>
      )}

      {/* Properties Tab */}
      {activeTab === "properties" && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
          <ManagementBanner
            category="PORTFOLIO ASSETS"
            title="Properties Management"
            description="Monitor and configure buildings, complexes, and multi-unit developments across the portfolio."
            icon={Building2}
          />

          {/* Filter Toolbar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={propertySearch}
                  onChange={(e) => setPropertySearch(e.target.value)}
                  placeholder="Search properties by name or location..."
                  className="h-10 w-full rounded-xl border-gray-200 bg-gray-50/50 pl-10 text-sm focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-800"
                />
                {propertySearch && (
                  <button onClick={() => setPropertySearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:text-gray-600">
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                  <span className="text-xs font-medium text-gray-500">Type:</span>
                  <select
                    value={propertyTypeFilter}
                    onChange={(e) => setPropertyTypeFilter(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-gray-800 outline-none dark:text-gray-200 cursor-pointer"
                  >
                    <option value="all">All Types</option>
                    <option value="condominium">Condominium</option>
                    <option value="house">House</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                  <span className="text-xs font-medium text-gray-500">Status:</span>
                  <select
                    value={propertyStatusFilter}
                    onChange={(e) => setPropertyStatusFilter(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-gray-800 outline-none dark:text-gray-200 cursor-pointer"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {(propertySearch || propertyTypeFilter !== "all" || propertyStatusFilter !== "all") && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setPropertySearch("");
                      setPropertyTypeFilter("all");
                      setPropertyStatusFilter("all");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </motion.button>
                )}
              </div>
            </div>
          </div>

          <Card className="overflow-hidden border border-gray-200 shadow-sm dark:border-gray-800">
            <CardHeader className="border-b border-gray-100 bg-gray-50/60 px-6 py-4 dark:border-gray-800 dark:bg-gray-800/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-gray-900 dark:text-white">Properties Registry</CardTitle>
                  <CardDescription className="text-xs">Showing {filteredProperties.length} of {properties.length} properties</CardDescription>
                </div>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-semibold text-xs">
                  {filteredProperties.length} properties
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredProperties.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-500">No properties match your search or filter.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/40 text-[11px] uppercase tracking-wider text-gray-500">
                        <TableHead className="pl-6">Name</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Units</TableHead>
                        <TableHead className="pr-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProperties.map((p, i) => (
                        <motion.tr
                          key={p.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03, duration: 0.2 }}
                          className="border-b border-gray-100 hover:bg-surface-secondary transition-colors"
                        >
                          <TableCell className="pl-6 font-semibold text-gray-900 dark:text-white">{p.name}</TableCell>
                          <TableCell className="text-text-secondary text-xs">{p.location}</TableCell>
                          <TableCell>
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize",
                              p.type === "house" && "bg-blue-50 text-blue-700 border border-blue-200",
                              p.type === "condominium" && "bg-purple-50 text-purple-700 border border-purple-200",
                            )}>
                              {p.type}
                            </span>
                          </TableCell>
                          <TableCell className="font-semibold text-xs">{p.units}</TableCell>
                          <TableCell className="pr-6">
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize",
                              p.status === "active" && "bg-green-50 text-green-700 border border-green-200",
                              p.status === "inactive" && "bg-gray-50 text-gray-600 border border-gray-200",
                            )}>
                              {p.status}
                            </span>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Units Tab */}
      {activeTab === "units" && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
          <ManagementBanner
            category="RENTAL INVENTORY"
            title="Units Directory"
            description="Track occupancy, lease status, and rental rates for individual units across all properties."
            icon={Home}
          />

          {/* Filter Toolbar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={unitSearch}
                  onChange={(e) => setUnitSearch(e.target.value)}
                  placeholder="Search by unit number or property name..."
                  className="h-10 w-full rounded-xl border-gray-200 bg-gray-50/50 pl-10 text-sm focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-800"
                />
                {unitSearch && (
                  <button onClick={() => setUnitSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:text-gray-600">
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                  <span className="text-xs font-medium text-gray-500">Property:</span>
                  <select
                    value={unitPropertyFilter}
                    onChange={(e) => setUnitPropertyFilter(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-gray-800 outline-none dark:text-gray-200 cursor-pointer"
                  >
                    <option value="all">All Properties</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                  <span className="text-xs font-medium text-gray-500">Status:</span>
                  <select
                    value={unitStatusFilter}
                    onChange={(e) => setUnitStatusFilter(e.target.value as any)}
                    className="bg-transparent text-xs font-semibold text-gray-800 outline-none dark:text-gray-200 cursor-pointer"
                  >
                    <option value="all">All Status</option>
                    <option value="occupied">Occupied</option>
                    <option value="vacant">Vacant</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>

                {(unitSearch || unitPropertyFilter !== "all" || unitStatusFilter !== "all") && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setUnitSearch("");
                      setUnitPropertyFilter("all");
                      setUnitStatusFilter("all");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </motion.button>
                )}
              </div>
            </div>
          </div>

          <Card className="overflow-hidden border border-gray-200 shadow-sm dark:border-gray-800">
            <CardHeader className="border-b border-gray-100 bg-gray-50/60 px-6 py-4 dark:border-gray-800 dark:bg-gray-800/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-gray-900 dark:text-white">Units Registry</CardTitle>
                  <CardDescription className="text-xs">Showing {filteredUnits.length} of {units.length} units</CardDescription>
                </div>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-semibold text-xs">
                  {filteredUnits.length} units
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredUnits.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-500">No units match your search or filter.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/40 text-[11px] uppercase tracking-wider text-gray-500">
                        <TableHead className="pl-6">Unit Number</TableHead>
                        <TableHead>Property</TableHead>
                        <TableHead>Floor</TableHead>
                        <TableHead>Rent</TableHead>
                        <TableHead className="pr-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUnits.map((u, i) => (
                        <motion.tr
                          key={u.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03, duration: 0.2 }}
                          className="border-b border-gray-100 hover:bg-surface-secondary transition-colors"
                        >
                          <TableCell className="pl-6 font-semibold text-gray-900 dark:text-white">{u.unitNumber}</TableCell>
                          <TableCell className="text-text-secondary text-xs">{properties.find((p) => p.id === u.propertyId)?.name || u.propertyId}</TableCell>
                          <TableCell className="text-xs">{u.floor ?? "-"}</TableCell>
                          <TableCell className="font-semibold text-xs text-gray-900 dark:text-white">{formatCurrency(u.rentAmount || 0)}</TableCell>
                          <TableCell className="pr-6">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize",
                              u.status === "occupied" && "bg-green-50 text-green-700 border border-green-200",
                              u.status === "vacant" && "bg-blue-50 text-blue-700 border border-blue-200",
                              u.status === "maintenance" && "bg-amber-50 text-amber-700 border border-amber-200",
                            )}>
                              {u.status}
                            </span>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tenants Tab */}
      {activeTab === "tenants" && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
          <ManagementBanner
            category="LEASING & OCCUPANCY"
            title="Tenants Registry"
            description="Manage resident profiles, assigned units, and verification records across all properties."
            icon={UserPlus}
          />

          {/* Filter Toolbar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={tenantSearch}
                  onChange={(e) => setTenantSearch(e.target.value)}
                  placeholder="Search tenants by name, email, or phone..."
                  className="h-10 w-full rounded-xl border-gray-200 bg-gray-50/50 pl-10 text-sm focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-800"
                />
                {tenantSearch && (
                  <button onClick={() => setTenantSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:text-gray-600">
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                  <span className="text-xs font-medium text-gray-500">Status:</span>
                  <select
                    value={tenantStatusFilter}
                    onChange={(e) => setTenantStatusFilter(e.target.value as any)}
                    className="bg-transparent text-xs font-semibold text-gray-800 outline-none dark:text-gray-200 cursor-pointer"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                  <span className="text-xs font-medium text-gray-500">Property:</span>
                  <select
                    value={tenantPropertyFilter}
                    onChange={(e) => setTenantPropertyFilter(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-gray-800 outline-none dark:text-gray-200 cursor-pointer"
                  >
                    <option value="all">All Properties</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {(tenantSearch || tenantStatusFilter !== "all" || tenantPropertyFilter !== "all") && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setTenantSearch("");
                      setTenantStatusFilter("all");
                      setTenantPropertyFilter("all");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </motion.button>
                )}

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button size="sm" onClick={() => setShowCreateTenant(true)} className="h-9 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Create Tenant
                  </Button>
                </motion.div>
              </div>
            </div>
          </div>

          <Card className="overflow-hidden border border-gray-200 shadow-sm dark:border-gray-800">
            <CardHeader className="border-b border-gray-100 bg-gray-50/60 px-6 py-4 dark:border-gray-800 dark:bg-gray-800/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-gray-900 dark:text-white">Tenants Registry</CardTitle>
                  <CardDescription className="text-xs">Showing {filteredTenantsList.length} of {tenants.length} tenants</CardDescription>
                </div>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-semibold text-xs">
                  {filteredTenantsList.length} tenants
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredTenantsList.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-500">No tenants match your search or filter.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/40 text-[11px] uppercase tracking-wider text-gray-500">
                        <TableHead className="pl-6">Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Unit Number</TableHead>
                        <TableHead className="pr-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTenantsList.map((t, i) => (
                        <motion.tr
                          key={t.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03, duration: 0.2 }}
                          className="border-b border-gray-100 hover:bg-surface-secondary transition-colors"
                        >
                          <TableCell className="pl-6 font-semibold text-gray-900 dark:text-white">{t.name}</TableCell>
                          <TableCell className="text-text-secondary text-xs">{t.email}</TableCell>
                          <TableCell className="text-text-secondary text-xs">{t.phone || "—"}</TableCell>
                          <TableCell className="text-xs font-medium">{t.unitNumber || "-"}</TableCell>
                          <TableCell className="pr-6">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize",
                              t.status === "active" && "bg-green-50 text-green-700 border border-green-200",
                              t.status === "inactive" && "bg-gray-50 text-gray-600 border border-gray-200",
                            )}>
                              {t.status}
                            </span>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
          <ManagementBanner
            financial
            category="FINANCIAL MANAGEMENT"
            title="Financial Transactions"
            description="Track and manage all tenant payments, receipts, and transaction records across properties."
            icon={CreditCard}
          />

          {/* Filter Toolbar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  placeholder="Search by tenant name or unit ID..."
                  className="h-10 w-full rounded-xl border-gray-200 bg-gray-50/50 pl-10 text-sm focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-800"
                />
                {paymentSearch && (
                  <button onClick={() => setPaymentSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:text-gray-600">
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                  <span className="text-xs font-medium text-gray-500">Period:</span>
                  <select
                    value={paymentPeriod}
                    onChange={(e) => setPaymentPeriod(e.target.value as any)}
                    className="bg-transparent text-xs font-semibold text-gray-800 outline-none dark:text-gray-200 cursor-pointer"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                  <span className="text-xs font-medium text-gray-500">Status:</span>
                  <select
                    value={paymentStatusFilter}
                    onChange={(e) => setPaymentStatusFilter(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-gray-800 outline-none dark:text-gray-200 cursor-pointer"
                  >
                    <option value="all">All Status</option>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="overdue">Overdue</option>
                    <option value="partial">Partial</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                  <span className="text-xs font-medium text-gray-500">Type:</span>
                  <select
                    value={paymentTypeFilter}
                    onChange={(e) => setPaymentTypeFilter(e.target.value as any)}
                    className="bg-transparent text-xs font-semibold text-gray-800 outline-none dark:text-gray-200 cursor-pointer"
                  >
                    <option value="all">All Types</option>
                    <option value="regular">Regular</option>
                    <option value="advance">Advance</option>
                  </select>
                </div>

                <Input
                  type="date"
                  value={paymentReferenceDate}
                  onChange={(e) => setPaymentReferenceDate(e.target.value)}
                  className="h-9 w-36 rounded-xl border-gray-200 text-xs"
                />

                {(paymentSearch || paymentStatusFilter !== "all" || paymentTypeFilter !== "all" || paymentReferenceDate) && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setPaymentSearch("");
                      setPaymentStatusFilter("all");
                      setPaymentTypeFilter("all");
                      setPaymentReferenceDate("");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </motion.button>
                )}
              </div>
            </div>
          </div>

          <Card className="overflow-hidden border border-gray-200 shadow-sm dark:border-gray-800">
            <CardHeader className="border-b border-gray-100 bg-gray-50/60 px-6 py-4 dark:border-gray-800 dark:bg-gray-800/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-gray-900 dark:text-white">Transaction Records</CardTitle>
                  <CardDescription className="text-xs">Showing {filteredPayments.length} of {payments.length} transactions</CardDescription>
                </div>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-semibold text-xs">
                  {filteredPayments.length} payments
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredPayments.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-500">
                  {payments.length === 0 ? "No payments found" : "No payments match the selected filters"}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/40 text-[11px] uppercase tracking-wider text-gray-500">
                        <TableHead className="pl-6">Tenant</TableHead>
                        <TableHead>Unit Number</TableHead>
                        <TableHead>Amount Paid</TableHead>
                        <TableHead>Payment Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="pr-6">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.map((p, i) => (
                        <motion.tr
                          key={p.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03, duration: 0.2 }}
                          className="border-b border-gray-100 hover:bg-surface-secondary transition-colors"
                        >
                          <TableCell className="pl-6 font-semibold text-gray-900 dark:text-white">{p.tenantName}</TableCell>
                          <TableCell className="text-text-secondary text-xs">{p.unitId}</TableCell>
                          <TableCell className="font-semibold text-xs text-gray-900 dark:text-white">{formatCurrency(p.amountPaid || 0)}</TableCell>
                          <TableCell>
                            <span className="whitespace-nowrap text-xs text-gray-600">
                              {isAdvancePayment(p) ? "Advance Payment" : "Regular Payment"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize",
                              p.status === "paid" && "bg-green-50 text-green-700 border border-green-200",
                              p.status === "pending" && "bg-amber-50 text-amber-700 border border-amber-200",
                              p.status === "overdue" && "bg-red-50 text-red-700 border border-red-200",
                              p.status === "partial" && "bg-blue-50 text-blue-700 border border-blue-200",
                            )}>
                              {p.status}
                            </span>
                          </TableCell>
                          <TableCell className="pr-6 text-text-secondary text-xs">{p.paymentDate ? formatDate(p.paymentDate) : "—"}</TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Ratings Tab */}
      {activeTab === "ratings" && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
          <ManagementBanner
            category="FEEDBACK & REPUTATION"
            title="Ratings & Reviews"
            description="Review tenant feedback, service ratings, and property evaluations across the platform."
            icon={Star}
          />

          {/* Filter Toolbar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={ratingSearch}
                  onChange={(e) => setRatingSearch(e.target.value)}
                  placeholder="Search by user or comment..."
                  className="h-10 w-full rounded-xl border-gray-200 bg-gray-50/50 pl-10 text-sm focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-800"
                />
                {ratingSearch && (
                  <button onClick={() => setRatingSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:text-gray-600">
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                  <span className="text-xs font-medium text-gray-500">Target:</span>
                  <select
                    value={ratingTargetFilter}
                    onChange={(e) => setRatingTargetFilter(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-gray-800 outline-none dark:text-gray-200 cursor-pointer"
                  >
                    <option value="all">All Targets</option>
                    <option value="property">Property</option>
                    <option value="unit">Unit</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                  <span className="text-xs font-medium text-gray-500">Score:</span>
                  <select
                    value={ratingScoreFilter}
                    onChange={(e) => setRatingScoreFilter(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-gray-800 outline-none dark:text-gray-200 cursor-pointer"
                  >
                    <option value="all">All Scores</option>
                    <option value="5">5 Stars</option>
                    <option value="4">4 Stars</option>
                    <option value="3">3 Stars</option>
                    <option value="2">2 Stars</option>
                    <option value="1">1 Star</option>
                  </select>
                </div>

                {(ratingSearch || ratingTargetFilter !== "all" || ratingScoreFilter !== "all") && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setRatingSearch("");
                      setRatingTargetFilter("all");
                      setRatingScoreFilter("all");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </motion.button>
                )}
              </div>
            </div>
          </div>

          <Card className="overflow-hidden border border-gray-200 shadow-sm dark:border-gray-800">
            <CardHeader className="border-b border-gray-100 bg-gray-50/60 px-6 py-4 dark:border-gray-800 dark:bg-gray-800/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-gray-900 dark:text-white">Ratings Overview</CardTitle>
                  <CardDescription className="text-xs">Showing {filteredRatings.length} of {ratings.length} reviews</CardDescription>
                </div>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-semibold text-xs">
                  {filteredRatings.length} reviews
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredRatings.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-500">No ratings match your search or filter.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/40 text-[11px] uppercase tracking-wider text-gray-500">
                        <TableHead className="pl-6">User</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Comment</TableHead>
                        <TableHead className="pr-6">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRatings.map((r, i) => (
                        <motion.tr
                          key={r.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03, duration: 0.2 }}
                          className="border-b border-gray-100 hover:bg-surface-secondary transition-colors"
                        >
                          <TableCell className="pl-6 font-semibold text-gray-900 dark:text-white">{r.userName || r.userId}</TableCell>
                          <TableCell>
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize",
                              r.targetType === "property" && "bg-blue-50 text-blue-700 border border-blue-200",
                              r.targetType === "unit" && "bg-purple-50 text-purple-700 border border-purple-200",
                            )}>
                              {r.targetType} ({r.targetId})
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-amber-600">{r.rating}/5 ★</span>
                          </TableCell>
                          <TableCell className="text-text-secondary text-xs max-w-xs truncate">{r.comment || "—"}</TableCell>
                          <TableCell className="pr-6 text-text-secondary text-xs">{r.createdAt ? formatDate(r.createdAt) : "—"}</TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Complaints Tab */}
      {activeTab === "complaints" && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
          <ManagementBanner
            category="TENANT SUPPORT"
            title="Complaints & Disputes"
            description="Monitor service tickets, tenant complaints, maintenance issues, and resolution timelines."
            icon={AlertCircle}
          />

          {/* Filter Toolbar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={complaintSearch}
                  onChange={(e) => setComplaintSearch(e.target.value)}
                  placeholder="Search complaints by subject, tenant, or issue..."
                  className="h-10 w-full rounded-xl border-gray-200 bg-gray-50/50 pl-10 text-sm focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-800"
                />
                {complaintSearch && (
                  <button onClick={() => setComplaintSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:text-gray-600">
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                  <span className="text-xs font-medium text-gray-500">Status:</span>
                  <select
                    value={complaintStatusFilter}
                    onChange={(e) => setComplaintStatusFilter(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-gray-800 outline-none dark:text-gray-200 cursor-pointer"
                  >
                    <option value="all">All Status</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                  <span className="text-xs font-medium text-gray-500">Category:</span>
                  <select
                    value={complaintCategoryFilter}
                    onChange={(e) => setComplaintCategoryFilter(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-gray-800 outline-none dark:text-gray-200 cursor-pointer"
                  >
                    <option value="all">All Categories</option>
                    <option value="support">Support Requests</option>
                    <option value="property">Property Complaints</option>
                    <option value="unit">Unit Maintenance</option>
                  </select>
                </div>

                {(complaintSearch || complaintStatusFilter !== "all" || complaintCategoryFilter !== "all") && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setComplaintSearch("");
                      setComplaintStatusFilter("all");
                      setComplaintCategoryFilter("all");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </motion.button>
                )}
              </div>
            </div>
          </div>

          <Card className="border border-gray-200 shadow-sm dark:border-gray-800">
            <CardHeader className="border-b border-gray-100 bg-gray-50/60 px-6 py-4 dark:border-gray-800 dark:bg-gray-800/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-gray-900 dark:text-white">Complaints Management</CardTitle>
                  <CardDescription className="text-xs">Showing {filteredComplaints.length} of {complaints.length} tickets</CardDescription>
                </div>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-semibold text-xs">
                  {filteredComplaints.length} complaints
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {filteredComplaints.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No complaints found matching the selected filters</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="lg:col-span-1 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject</TableHead>
                          <TableHead>Tenant</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredComplaints.map((c) => {
                          const tenant = tenants.find(t => t.id === c.tenantId);
                        return (
                           <motion.tr
                             key={c.id}
                             initial={{ opacity: 0, x: -20 }}
                             animate={{ opacity: 1, x: 0 }}
                             onClick={() => openComplaint(c)}
                             whileHover={{ scale: 1.005 }}
                             className={`border-b border-border/50 cursor-pointer transition-all ${selectedComplaint?.id === c.id ? "bg-blue-50" : "hover:bg-surface-secondary"}`}
                           >
                            <TableCell className="font-medium max-w-[170px] truncate" title={c.subject}>{c.subject}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar src={tenant?.avatarUrl} fallback={(tenant?.name || c.tenantName || c.tenantId || "T").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()} size="sm" />
                                <span className="text-text-secondary">{c.tenantName || c.tenantId}</span>
                              </div>
                            </TableCell>
                             <TableCell>
                               <div className="flex flex-wrap items-center gap-1.5">
                                 <motion.span
                                   whileHover={{ scale: 1.05 }}
                                   className={cn(
                                     "inline-flex whitespace-nowrap items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all",
                                     c.status === "open" && "bg-red-50 text-red-700 border-red-200",
                                     c.status === "in_progress" && "bg-amber-50 text-amber-700 border-amber-200",
                                     c.status === "resolved" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                                     c.status === "closed" && "bg-gray-50 text-gray-700 border-gray-200",
                                   )}
                                 >
                                   {c.status}
                                 </motion.span>
                                 {c.tenantReplyText && (
                                   <motion.span whileHover={{ scale: 1.05 }} className="inline-flex whitespace-nowrap items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-blue-200 bg-blue-50 text-blue-700">Tenant Replied</motion.span>
                                 )}
                               </div>
                             </TableCell>
                          </motion.tr>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="lg:col-span-2">
                  {selectedComplaint ? (
                    <div className="rounded-xl border border-gray-200 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <Avatar src={selectedTenant?.avatarUrl} fallback={(selectedTenant?.name || selectedComplaint.tenantName || selectedComplaint.tenantId || "T").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()} size="md" className="shrink-0" />
                           <div className="min-w-0 flex-1">
                             <h3 className="text-lg font-semibold text-gray-900 break-all">{selectedComplaint.subject}</h3>
                              <div className="mt-1 flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-gray-500 shrink-0">Tenant: {selectedComplaint.tenantName || selectedComplaint.tenantId}</span>
                                <motion.span whileHover={{ scale: 1.05 }} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-blue-200 bg-blue-50 text-blue-700">
                                  {selectedComplaint.targetType === "support"
                                    ? "Support Request"
                                    : selectedComplaint.targetType === "unit"
                                    ? "Unit Maintenance"
                                    : "Property Issue"}
                                </motion.span>
                                <motion.span whileHover={{ scale: 1.05 }} className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all", selectedComplaint.status === "open" && "bg-red-50 text-red-700 border-red-200", selectedComplaint.status === "in_progress" && "bg-amber-50 text-amber-700 border-amber-200", selectedComplaint.status === "resolved" && "bg-emerald-50 text-emerald-700 border-emerald-200", selectedComplaint.status === "closed" && "bg-gray-50 text-gray-700 border-gray-200")}>{selectedComplaint.status.replace("_", " ")}</motion.span>
                                {selectedComplaint.tenantReplyText && (
                                  <motion.span whileHover={{ scale: 1.05 }} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-blue-200 bg-blue-50 text-blue-700">Tenant Replied</motion.span>
                                )}
                              </div>
                              {selectedTenant && (
                               <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 break-all">
                                 <span>{selectedTenant.email}</span>
                                 {selectedTenant.phone && <span>• {selectedTenant.phone}</span>}
                                 {selectedTenant.address && <span>• {selectedTenant.address}</span>}
                               </div>
                             )}
                           </div>
                         </div>
                         {selectedComplaint.status !== "resolved" && selectedComplaint.status !== "closed" && (
                           <Button size="sm" onClick={async () => {
                             try {
                               const updated = await updateComplaintStatus(selectedComplaint.id, "resolved", selectedComplaint.assignedTo || user?.id, selectedComplaint.responseText, user?.name);
                               if (updated) {
                                 setSelectedComplaint(updated);
                                 setComplaints((current) => current.map((item) => item.id === selectedComplaint.id ? updated : item));
                                 toast.success("Complaint marked as resolved");
                               }
                             } catch { toast.error("Failed to update status"); }
                           }}>Mark as Resolved</Button>
                         )}
                         {selectedComplaint.status !== "closed" && (
                           <Button size="sm" variant="outline" onClick={async () => {
                             try {
                               const updated = await updateComplaintStatus(selectedComplaint.id, "closed", selectedComplaint.assignedTo || user?.id, selectedComplaint.responseText, user?.name);
                               if (updated) {
                                 setSelectedComplaint(updated);
                                 setComplaints((current) => current.map((item) => item.id === selectedComplaint.id ? updated : item));
                                 toast.success("Complaint closed");
                               }
                             } catch { toast.error("Failed to close complaint"); }
                           }}>Mark as Closed</Button>
                         )}
                      </div>
                      <div className="mt-4 rounded-lg bg-gray-50 p-4 transition-colors hover:bg-gray-100">
                        <p className="text-xs font-semibold text-gray-500">Original Request</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 break-all">{selectedComplaint.message}</p>
                      </div>
                      {selectedComplaint.tenantReplyText && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 rounded-lg bg-blue-50 p-4 transition-colors hover:bg-blue-100"
                        >
                          <p className="text-xs font-semibold text-blue-700">Tenant Reply</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 break-all">{selectedComplaint.tenantReplyText}</p>
                        </motion.div>
                      )}
                      {selectedComplaint.responseText && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 rounded-lg bg-emerald-50 p-4 transition-colors hover:bg-emerald-100"
                        >
                          <p className="text-xs font-semibold text-emerald-700">Support Response</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 break-all">{selectedComplaint.responseText}</p>
                        </motion.div>
                      )}
                      <motion.form
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-4"
                        onSubmit={async (event) => {
                          event.preventDefault();
                          if (!complaintReply.trim()) return;
                          setReplying(true);
                          try {
                              const updated = await updateComplaintStatus(selectedComplaint.id, "in_progress", user?.id, complaintReply, user?.name);
                            if (updated) {
                              setSelectedComplaint(updated);
                              setComplaints((current) => current.map((item) => item.id === selectedComplaint.id ? updated : item));
                              setComplaintReply("");
                              toast.success("Support response sent");
                            }
                          } catch { toast.error("Failed to send response"); }
                          finally { setReplying(false); }
                        }}
                      >
                        <textarea value={complaintReply} onChange={(event) => setComplaintReply(event.target.value)} rows={3} placeholder="Write a response to the tenant..." className="w-full rounded-lg border border-gray-200 p-3 text-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                          <Button type="submit" className="mt-2" disabled={replying}>{replying ? "Sending..." : "Send Response"}</Button>
                        </motion.div>
                      </motion.form>
                    </div>
                  ) : (
                    <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-200">
                      <p className="text-sm text-gray-500">Select a complaint to view details and reply</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
      )}

      {/* Messages Tab */}
      {activeTab === "messages" && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
          <ManagementBanner
            category="COMMUNICATIONS"
            title="System Messages"
            description="Direct communication channels with property owners, agents, and staff across the platform."
            icon={MessageSquare}
          />
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
              <p className="text-sm text-gray-500">Live chat messages and inquiries</p>
            </div>
            <Button onClick={() => setShowNewMessageDialog(true)} className="h-9 shrink-0">
              <Plus className="mr-2 h-4 w-4" />New Message
            </Button>
          </div>
          <MessagingPanel
            isOpen
            onClose={() => undefined}
            fullPage
            onSelectConversation={(conversation) => {
              setSelectedConversation(conversation);
              setIsMessagingOpen(true);
            }}
          />
        </motion.div>
      )}

      {/* New Message Dialog */}
      <Modal
        isOpen={showNewMessageDialog}
        onClose={() => {
          setShowNewMessageDialog(false);
          setNewMessageSearch("");
        }}
        title="New Message"
        description="Select a user to start a conversation"
      >
        <div className="space-y-3">
          <Input
            placeholder="Search users..."
            value={newMessageSearch}
            onChange={(e) => setNewMessageSearch(e.target.value)}
            className="h-10"
          />
          <div className="max-h-80 overflow-y-auto space-y-2">
            {users
              .filter((u) => u.id !== user?.id)
              .filter((u) => {
                const search = newMessageSearch.toLowerCase();
                return (
                  !search ||
                  u.name.toLowerCase().includes(search) ||
                  u.email.toLowerCase().includes(search) ||
                  u.role.toLowerCase().includes(search)
                );
              })
              .map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setSelectedConversation({
                      userId: u.id,
                      otherUser: {
                        id: u.id,
                        name: u.name,
                        email: u.email,
                        role: u.role,
                        avatarUrl: u.avatarUrl,
                      },
                      lastMessage: null,
                      unreadCount: 0,
                    });
                    setIsMessagingOpen(true);
                    setShowNewMessageDialog(false);
                    setNewMessageSearch("");
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                >
                  <Avatar
                    src={u.avatarUrl}
                    fallback={u.name ? u.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() : "?"}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">
                    {u.role}
                  </Badge>
                </button>
              ))}
            {users.filter((u) => u.id !== user?.id).length === 0 && (
              <p className="text-center text-sm text-gray-500 py-8">No users available to message</p>
            )}
          </div>
        </div>
      </Modal>

      {/* Messaging Modal */}
      {selectedConversation && (
        <MessagingModal
          isOpen={isMessagingOpen}
          onClose={() => {
            setIsMessagingOpen(false);
            setSelectedConversation(null);
          }}
          otherUser={{
            id: selectedConversation.otherUser?.id || "",
            name: selectedConversation.otherUser?.name || "Unknown",
            email: selectedConversation.otherUser?.email || "",
            role: selectedConversation.otherUser?.role || "tenant",
            avatarUrl: selectedConversation.otherUser?.avatarUrl,
            allowMessages: true,
          }}
        />
      )}

      {/* System Activity Tab */}
      {activeTab === "activity" && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
          <ManagementBanner
            category="SYSTEM OPERATIONS"
            title="Activity Logs"
            description="Real-time telemetry and user interaction audit trail across the platform."
            icon={Activity}
          />
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Activity className="h-5 w-5 text-gray-600" />
                System Activity
              </CardTitle>
              <CardDescription>Real-time system events and user activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {notifications.length === 0 ? (
                  <p className="text-center py-8 text-gray-500">No recent activity</p>
                ) : (
                  notifications.slice(0, 20).map((n, i) => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                      className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg",
                          n.type === "payment" && "bg-green-50 text-green-600",
                          n.type === "tenant" && "bg-blue-50 text-blue-600",
                          n.type === "property" && "bg-amber-50 text-amber-600",
                          n.type === "system" && "bg-purple-50 text-purple-600",
                        )}>
                          <Activity className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{n.title}</p>
                          <p className="text-xs text-gray-500">{n.message}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs border-gray-200">{n.type}</Badge>
                    </motion.div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === "audit" && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
          <ManagementBanner
            category="SECURITY & GOVERNANCE"
            title="Audit Trail"
            description="Detailed operational records, user authentications, and compliance events."
            icon={FileText}
          />

          {/* Filter Toolbar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search audit trail by actor, action, IP, or details..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="pl-9 h-10 border-gray-200"
                />
                {auditSearch && (
                  <button
                    onClick={() => setAuditSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
                >
                  <option value="all">All Actions</option>
                  {Array.from(new Set(auditLogs.map((l) => l.action))).map((act) => (
                    <option key={act} value={act}>{act}</option>
                  ))}
                </select>
                {(auditSearch || auditActionFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAuditSearch("");
                      setAuditActionFilter("all");
                    }}
                    className="h-10 text-gray-500 hover:text-gray-900"
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-gray-900">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-600" />
                  Audit Logs ({filteredAuditLogs.length})
                </div>
              </CardTitle>
              <CardDescription>System activity and user action records</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredAuditLogs.length === 0 ? (
                <div className="text-center py-16">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg font-medium">No audit logs found</p>
                  <p className="text-gray-400 mt-2">All system activities are logged and monitored</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAuditLogs.map((log, i) => (
                    <motion.div
                      key={`audit-${log.id}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.25 }}
                      className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{log.action}</p>
                          <p className="text-xs text-gray-500">
                            {log.actor} • {formatDateTime(log.createdAt)}
                            {log.ipAddress && log.ipAddress !== "system" && ` • IP: ${log.ipAddress}`}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {String(log.details?.source || "audit")}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Diagnosis Tab */}
      {activeTab === "diagnosis" && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
          <ManagementBanner
            category="HEALTH & TELEMETRY"
            title="System Diagnosis"
            description="Perform automated health checks across database, API services, and storage endpoints."
            icon={Stethoscope}
          />
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Stethoscope className="h-5 w-5 text-gray-600" />
                System Diagnosis
              </CardTitle>
              <CardDescription>Run diagnostics to check system health</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "database", label: "Database Connection" },
                  { key: "apiServer", label: "API Server" },
                  { key: "authentication", label: "Authentication Service" },
                  { key: "fileStorage", label: "File Storage" },
                ].map((item, i) => {
                  const status = diagnosisResults?.[item.key] ?? "pending";
                  const isHealthy = status === "healthy";
                  const isUnhealthy = status === "unhealthy";
                  const isLoading = status === "pending" && isRunningDiagnosis;

                  return (
                    <motion.div
                      key={item.key}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1, duration: 0.3 }}
                      className="flex items-center justify-between p-4 rounded-xl bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                          isHealthy ? "bg-green-50 text-green-600" :
                          isUnhealthy ? "bg-red-50 text-red-600" :
                          "bg-gray-100 text-gray-400"
                        }`}>
                          {isLoading ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : isHealthy ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : isUnhealthy ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{item.label}</span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-lg capitalize ${
                        isHealthy ? "text-green-600 bg-green-50" :
                        isUnhealthy ? "text-red-600 bg-red-50" :
                        isLoading ? "text-gray-500 bg-gray-100" : "text-gray-400 bg-gray-50"
                      }`}>
                        {isLoading ? "Checking..." : status}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={async () => {
                    setIsRunningDiagnosis(true);
                    setDiagnosisResults({
                      database: "pending",
                      apiServer: "pending",
                      authentication: "pending",
                      fileStorage: "pending",
                    });
                    try {
                      const res = await fetch("/api/health");
                      const data = await parseJsonSafely(res);
                      if (res.ok && data.success && data.checks) {
                        setDiagnosisResults(data.checks);
                        toast.success("Diagnostics completed - All systems healthy");
                      } else {
                        setDiagnosisResults(data.checks || {
                          database: "unhealthy",
                          apiServer: "healthy",
                          authentication: "unknown",
                          fileStorage: "unknown",
                        });
                        toast.error("Diagnostics completed - Some systems are unhealthy");
                      }
                    } catch {
                      setDiagnosisResults({
                        database: "unhealthy",
                        apiServer: "healthy",
                        authentication: "unknown",
                        fileStorage: "unknown",
                      });
                      toast.error("Diagnostics failed - Unable to connect to server");
                    } finally {
                      setIsRunningDiagnosis(false);
                    }
                  }}
                  disabled={isRunningDiagnosis}
                  className="w-full mt-4"
                >
                  {isRunningDiagnosis ? (
                    <><RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />Running Diagnostics...</>
                  ) : (
                    <><Stethoscope className="h-4 w-4 mr-1.5" />Run Diagnostics</>
                  )}
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* System Health Tab */}
      {activeTab === "health" && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
          <ManagementBanner
            category="TELEMETRY MONITORING"
            title="System Health Monitoring"
            description="Real-time performance metrics, microservice availability, and platform infrastructure uptime."
            icon={HeartPulse}
          />
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Heart className="h-5 w-5 text-gray-600" />
                System Health Monitoring
              </CardTitle>
              <CardDescription>Real-time system status and performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Database", status: healthData?.checks?.database ?? "Loading..." },
                  { label: "API Status", status: healthData?.checks?.apiServer ?? "Loading..." },
                  { label: "Active Users", status: users.length.toString() },
                  { label: "Properties", status: properties.length.toString() },
                ].map((item, i) => (
                  <div key={i} className="p-4 rounded-xl bg-gray-50">
                    <p className="text-sm text-gray-500 mb-1">{item.label}</p>
                    <p className={`text-base font-semibold px-2 py-1 rounded-lg inline-block capitalize ${
                      item.status === "healthy" ? "text-green-600 bg-green-50" :
                      item.status === "unhealthy" ? "text-red-600 bg-red-50" :
                      "text-gray-500 bg-gray-100"
                    }`}>{item.status}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Configuration Tab */}
      {activeTab === "configuration" && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
          <ManagementBanner
            category="GLOBAL SETTINGS"
            title="System Configuration"
            description="Manage global tenant thresholds, maintenance windows, and application settings."
            icon={SlidersHorizontal}
          />
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Sliders className="h-5 w-5 text-gray-600" />
                System Configuration
              </CardTitle>
              <CardDescription>Manage system settings and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { key: "system_name", label: "System Name", description: "Application display name", type: "text" as const },
                  { key: "max_users", label: "Max Users", description: "Maximum concurrent users", type: "text" as const },
                  { key: "session_timeout", label: "Session Timeout", description: "Auto-logout duration", type: "text" as const },
                  { key: "email_notifications", label: "Email Notifications", description: "System email alerts", type: "toggle" as const },
                ].map((config) => {
                  const isEditing = editingConfig === config.key;
                  const rawValue = systemConfig[config.key];
                  const isEmailEnabled = config.key === "email_notifications" ? (rawValue ?? "Enabled") !== "Disabled" : false;
                  const value = config.key === "email_notifications" ? (isEmailEnabled ? "Enabled" : "Disabled") : (rawValue ?? "");

                  return (
                    <div key={config.key} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{config.label}</p>
                        <p className="text-xs text-gray-500">{config.description}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {isEditing && config.type === "text" ? (
                          <>
                            <Input
                              value={configDraft}
                              onChange={(e) => setConfigDraft(e.target.value)}
                              className="h-8 w-40 text-sm border-gray-200"
                              autoFocus
                              onKeyDown={async (e) => {
                                if (e.key === "Enter") {
                                  await saveConfig(config.key, configDraft);
                                  setEditingConfig(null);
                                } else if (e.key === "Escape") {
                                  setEditingConfig(null);
                                }
                              }}
                            />
                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                              <Button size="sm" onClick={async () => { await saveConfig(config.key, configDraft); setEditingConfig(null); }}>Save</Button>
                            </motion.div>
                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                              <Button size="sm" variant="ghost" onClick={() => setEditingConfig(null)}>Cancel</Button>
                            </motion.div>
                          </>
                        ) : config.type === "toggle" ? (
                          <button
                            onClick={async () => {
                              const newValue = !isEmailEnabled ? "Enabled" : "Disabled";
                              try {
                                const res = await fetch("/api/admin/config", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ [config.key]: newValue }),
                                });
                                const data = await parseJsonSafely(res);
                                if (data.success && data.config) {
                                  setSystemConfig(data.config);
                                  toast.success(`Email notifications ${newValue === "Enabled" ? "enabled" : "disabled"}`);
                                } else {
                                  toast.error(data.error || "Failed to update config");
                                }
                              } catch {
                                toast.error("Failed to update config");
                              }
                            }}
                            className="relative inline-flex h-6 w-11 items-center rounded-full border border-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
                            style={{ backgroundColor: isEmailEnabled ? "#22c55e" : "#e5e7eb" }}
                          >
                            <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform" style={{ transform: isEmailEnabled ? "translateX(20px)" : "translateX(2px)" }} />
                          </button>
                        ) : (
                          <>
                            <span className="text-sm font-semibold text-gray-900">{value}</span>
                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                              <Button size="sm" variant="outline" className="border-gray-200" onClick={() => { setEditingConfig(config.key); setConfigDraft(value); }}>Edit</Button>
                            </motion.div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                      <Settings className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Maintenance Mode</p>
                      <p className="text-xs text-gray-500">Temporarily pause access for non-admin users</p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const newMode = !maintenanceMode;
                      try {
                        const res = await fetch("/api/admin/maintenance/mode", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ enabled: newMode }),
                        });
                        const data = await parseJsonSafely(res);
                        if (data.success) {
                          setMaintenanceMode(data.enabled);
                          document.cookie = `maintenance_mode=${data.enabled ? "true" : "false"}; path=/; max-age=${data.enabled ? 86400 : 0}`;
                          toast.success(`Maintenance mode ${data.enabled ? "enabled" : "disabled"}`);
                        } else {
                          toast.error(data.error || "Failed to update maintenance mode");
                        }
                      } catch {
                        toast.error("Failed to update maintenance mode");
                      }
                    }}
                    className="relative inline-flex h-6 w-11 items-center rounded-full border border-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
                    style={{ backgroundColor: maintenanceMode ? "#22c55e" : "#e5e7eb" }}
                  >
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform" style={{ transform: maintenanceMode ? "translateX(20px)" : "translateX(2px)" }} />
                  </button>
                </div>
                {maintenanceMode && (
                  <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    Maintenance mode is active. Non-admin users will be redirected to the maintenance page.
                  </p>
                )}
              </div>

              <div className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">System Announcement</p>
                    <p className="text-xs text-gray-500">Send a maintenance or system notice to all users</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <Input
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    placeholder="Announcement title, e.g. Scheduled Maintenance"
                    className="h-10"
                  />
                  <textarea
                    value={announcementMessage}
                    onChange={(e) => setAnnouncementMessage(e.target.value)}
                    rows={4}
                    placeholder="Describe the maintenance window, expected downtime, and when systems will be back online..."
                    className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                  />
                  <Button
                    onClick={async () => {
                      if (!announcementTitle.trim() || !announcementMessage.trim()) {
                        toast.error("Title and message are required");
                        return;
                      }
                      setIsSendingAnnouncement(true);
                      try {
                        const res = await fetch("/api/admin/announcements", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ title: announcementTitle.trim(), message: announcementMessage.trim() }),
                        });
                        const data = await parseJsonSafely(res);
                        if (data.success) {
                          toast.success(`Announcement sent to ${data.count} users`);
                          setAnnouncementTitle("");
                          setAnnouncementMessage("");
                        } else {
                          toast.error(data.error || "Failed to send announcement");
                        }
                      } catch {
                        toast.error("Failed to send announcement");
                      } finally {
                        setIsSendingAnnouncement(false);
                      }
                    }}
                    disabled={isSendingAnnouncement}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isSendingAnnouncement ? "Sending..." : "Send Announcement"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Account Settings Tab */}
      {activeTab === "settings" && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
          <ManagementBanner
            category="ADMINISTRATOR ACCOUNT"
            title="Settings"
            description="Manage your profile information, credentials, and password security."
            icon={Settings}
          />
          <SettingsPage embedded />
        </motion.div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingUser(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit User</h3>
              <button onClick={() => setEditingUser(null)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <XCircle className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="h-10 rounded-xl border-gray-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="h-10 rounded-xl border-gray-200" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setEditingUser(null)}>Cancel</Button>
              <Button className="flex-1 bg-gray-900 hover:bg-gray-800 text-white" onClick={handleSaveEdit}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingPassword && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setResettingPassword(null); setNewPassword(""); }} />
          <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Reset Password</h3>
              <button onClick={() => { setResettingPassword(null); setNewPassword(""); }} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <XCircle className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Set a new password for <strong>{resettingPassword.name}</strong> ({resettingPassword.email})</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters" className="h-10 rounded-xl border-gray-200" />
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => { setResettingPassword(null); setNewPassword(""); }}>Cancel</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleResetPassword} disabled={!newPassword || newPassword.length < 8}>Reset Password</Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Tenant Modal */}
      {showCreateTenant && (
        <CreateTenantModal
          isOpen={showCreateTenant}
          onClose={() => setShowCreateTenant(false)}
          onSubmit={async (formData) => {
            await handleCreateTenant(formData);
          }}
          submitting={isCreatingTenant}
        />
      )}

      {/* User Details Modal */}
      {selectedUserDetails && (() => {
        const modalTenant = tenants.find(
          (t) => t.email.toLowerCase() === selectedUserDetails.email.toLowerCase() || t.id === selectedUserDetails.id
        );
        const modalPhone = selectedUserDetails.phone || modalTenant?.phone || "Not provided";
        const modalAddress = selectedUserDetails.address || modalTenant?.address || "Not provided";
        const modalIsVerified = Boolean(
          selectedUserDetails.role === "admin" ||
          selectedUserDetails.role === "owner" ||
          isSampleAccount(selectedUserDetails.email) ||
          selectedUserDetails.idVerificationStatus === "approved" ||
          (selectedUserDetails as any).id_verification_status === "approved" ||
          (selectedUserDetails as any).idVerified ||
          (selectedUserDetails as any).verified ||
          (selectedUserDetails as any).idVerificationUrl ||
          modalTenant?.idVerificationUrl ||
          (modalTenant as any)?.isVerified
        );
        const modalIdDocUrl = (selectedUserDetails as any).idVerificationUrl || modalTenant?.idVerificationUrl;

        // Relationship info
        const ownedProps = selectedUserDetails.role === "owner"
          ? properties.filter((p) => p.createdBy === selectedUserDetails.id || p.createdBy === selectedUserDetails.email)
          : [];
        const managedProps = selectedUserDetails.role === "agent"
          ? properties.filter((p) => p.agentId === selectedUserDetails.id)
          : [];

        return (
          <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedUserDetails(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-gray-100 pb-5 dark:border-gray-800">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar
                      src={selectedUserDetails.avatarUrl}
                      fallback={(selectedUserDetails.name || "U").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                      size="lg"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-gray-900" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedUserDetails.name || "Unnamed Account"}</h3>
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border capitalize",
                        selectedUserDetails.role === "admin" && "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300",
                        selectedUserDetails.role === "owner" && "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
                        selectedUserDetails.role === "agent" && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
                        selectedUserDetails.role === "tenant" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
                      )}>
                        {selectedUserDetails.role}
                      </span>
                      {modalIsVerified ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Verified ID
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800">
                          <Clock className="h-3 w-3" />
                          Pending ID
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-gray-500 dark:text-gray-400">
                      <span>{selectedUserDetails.email}</span>
                      <span>•</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedUserDetails.id);
                          toast.success("User ID copied");
                        }}
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-gray-400 hover:text-blue-600 transition-colors"
                        title="Click to copy ID"
                      >
                        <span>ID: {selectedUserDetails.id}</span>
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUserDetails(null)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              {/* Body Details */}
              <div className="mt-5 space-y-4 text-xs">
                {/* 1. Contact & Personal Profile */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-xs flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-blue-500" />
                    Personal & Contact Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white p-2.5 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <span className="text-gray-400 text-[11px]">Email Address</span>
                      <p className="mt-0.5 font-medium text-gray-900 dark:text-white break-all">{selectedUserDetails.email}</p>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <span className="text-gray-400 text-[11px]">Phone Number</span>
                      <p className="mt-0.5 font-medium text-gray-900 dark:text-white">{modalPhone}</p>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 sm:col-span-2">
                      <span className="text-gray-400 text-[11px]">Physical Address</span>
                      <p className="mt-0.5 font-medium text-gray-900 dark:text-white">{modalAddress}</p>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <span className="text-gray-400 text-[11px]">Gender & Country</span>
                      <p className="mt-0.5 font-medium text-gray-900 dark:text-white capitalize">
                        {[(selectedUserDetails as any).gender || modalTenant?.gender, (selectedUserDetails as any).country || modalTenant?.country || "Philippines"].filter(Boolean).join(" • ") || "Philippines"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <span className="text-gray-400 text-[11px]">Birthdate</span>
                      <p className="mt-0.5 font-medium text-gray-900 dark:text-white">
                        {(selectedUserDetails as any).birthdate ? formatDate((selectedUserDetails as any).birthdate) : (modalTenant?.birthdate ? formatDate(modalTenant.birthdate) : "Not specified")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Role-specific Property / Lease Information */}
                {selectedUserDetails.role === "tenant" && (
                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-xs flex items-center gap-2">
                      <Home className="h-3.5 w-3.5 text-emerald-500" />
                      Tenancy & Unit Assignment
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-lg bg-white p-2.5 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                        <span className="text-gray-400 text-[11px]">Assigned Property</span>
                        <p className="mt-0.5 font-semibold text-gray-900 dark:text-white">
                          {modalTenant?.propertyName || "No Property Assigned"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white p-2.5 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                        <span className="text-gray-400 text-[11px]">Unit Number</span>
                        <p className="mt-0.5 font-semibold text-gray-900 dark:text-white">
                          {modalTenant?.unitNumber ? `Unit ${modalTenant.unitNumber}` : "Unassigned"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white p-2.5 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                        <span className="text-gray-400 text-[11px]">Monthly Rent</span>
                        <p className="mt-0.5 font-bold text-emerald-600 dark:text-emerald-400">
                          {modalTenant?.rentAmount ? formatCurrency(modalTenant.rentAmount) : "—"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white p-2.5 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                        <span className="text-gray-400 text-[11px]">Lease Term</span>
                        <p className="mt-0.5 font-medium text-gray-900 dark:text-white">
                          {modalTenant?.contractStart ? `${formatDate(modalTenant.contractStart)} – ${formatDate(modalTenant.contractEnd)}` : "Ongoing"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white p-2.5 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                        <span className="text-gray-400 text-[11px]">Emergency Contact</span>
                        <p className="mt-0.5 font-medium text-gray-900 dark:text-white">
                          {modalTenant?.emergencyContact ? `${modalTenant.emergencyContact} (${modalTenant.emergencyPhone || "No phone"})` : "Not provided"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white p-2.5 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                        <span className="text-gray-400 text-[11px]">Occupation / Employer</span>
                        <p className="mt-0.5 font-medium text-gray-900 dark:text-white">
                          {modalTenant?.occupation || "Not specified"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedUserDetails.role === "owner" && (
                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-xs flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-blue-500" />
                      Properties Portfolio ({ownedProps.length})
                    </h4>
                    {ownedProps.length === 0 ? (
                      <p className="text-gray-500 text-xs italic">No properties registered under this owner yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {ownedProps.map((p) => (
                          <div key={p.id} className="flex items-center justify-between rounded-lg bg-white p-2.5 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">{p.name}</p>
                              <p className="text-[11px] text-gray-500">{p.location} • {p.type}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {p.units} units
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedUserDetails.role === "agent" && (
                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-xs flex items-center gap-2">
                      <Briefcase className="h-3.5 w-3.5 text-amber-500" />
                      Managed Properties ({managedProps.length})
                    </h4>
                    {managedProps.length === 0 ? (
                      <p className="text-gray-500 text-xs italic">No properties currently assigned to this agent.</p>
                    ) : (
                      <div className="space-y-2">
                        {managedProps.map((p) => (
                          <div key={p.id} className="flex items-center justify-between rounded-lg bg-white p-2.5 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">{p.name}</p>
                              <p className="text-[11px] text-gray-500">{p.location}</p>
                            </div>
                            <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                              Assigned Agent
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. KYC Verification & Security */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-xs flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-purple-500" />
                    Identity Verification & KYC Document
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white p-2.5 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <span className="text-gray-400 text-[11px]">Verification Status</span>
                      <p className="mt-1">
                        {modalIsVerified ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Verified & Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            <Clock className="h-3.5 w-3.5" />
                            Pending Verification
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <span className="text-gray-400 text-[11px]">Uploaded ID Proof</span>
                      <p className="mt-1">
                        {modalIdDocUrl ? (
                          <a
                            href={modalIdDocUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                          >
                            <span>View Document</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : selectedUserDetails.role === "admin" || selectedUserDetails.role === "owner" || isSampleAccount(selectedUserDetails.email) ? (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">System Pre-Verified</span>
                        ) : (
                          <span className="text-xs text-gray-400">No document attached</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Activity & System Telemetry */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-xs flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-indigo-500" />
                    System Telemetry & Audit
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white p-2.5 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <span className="text-gray-400 text-[11px]">Account Created</span>
                      <p className="mt-0.5 font-medium text-gray-900 dark:text-white">
                        {selectedUserDetails.createdAt ? formatDateTime(selectedUserDetails.createdAt) : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <span className="text-gray-400 text-[11px]">Last Activity / Login</span>
                      <p className="mt-0.5 font-medium text-gray-900 dark:text-white">
                        {(selectedUserDetails as any).lastLoginAt ? formatDateTime((selectedUserDetails as any).lastLoginAt) : "Recently active"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap gap-2.5 border-t border-gray-100 pt-4 dark:border-gray-800">
                <Button
                  variant="outline"
                  className="flex-1 text-xs text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                  onClick={() => {
                    setSelectedConversation({
                      userId: selectedUserDetails.id,
                      otherUser: {
                        id: selectedUserDetails.id,
                        name: selectedUserDetails.name,
                        email: selectedUserDetails.email,
                        role: selectedUserDetails.role,
                        avatarUrl: selectedUserDetails.avatarUrl,
                      },
                      lastMessage: null,
                      unreadCount: 0,
                    });
                    setIsMessagingOpen(true);
                    setSelectedUserDetails(null);
                  }}
                >
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                  Message User
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => {
                    handleEditUser(selectedUserDetails);
                    setSelectedUserDetails(null);
                  }}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
                  Edit Profile
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-xs text-purple-600 hover:bg-purple-50 border-purple-200"
                  onClick={() => {
                    setResettingPassword(selectedUserDetails);
                    setSelectedUserDetails(null);
                  }}
                >
                  <KeyRound className="mr-1.5 h-3.5 w-3.5 text-purple-500" />
                  Reset Password
                </Button>
                <Button
                  className="bg-blue-600 text-xs text-white hover:bg-blue-700 px-5"
                  onClick={() => setSelectedUserDetails(null)}
                >
                  Done
                </Button>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* Create User Modal */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateUserModal(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create New Account</h3>
              <button onClick={() => setShowCreateUserModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                <Input
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  placeholder="e.g. Maria Santos"
                  className="h-9.5 rounded-xl border-gray-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                <Input
                  type="email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  placeholder="e.g. maria.santos@gmail.com"
                  className="h-9.5 rounded-xl border-gray-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Initial Password</label>
                <Input
                  type="password"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  placeholder="Min 6 characters"
                  className="h-9.5 rounded-xl border-gray-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Account Role</label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as any })}
                  className="h-9.5 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-800 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 cursor-pointer"
                >
                  <option value="tenant">Tenant (Renter)</option>
                  <option value="owner">Property Owner</option>
                  <option value="agent">Real Estate Agent</option>
                  <option value="admin">System Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Address (Optional)</label>
                <Input
                  value={newUserForm.address}
                  onChange={(e) => setNewUserForm({ ...newUserForm, address: e.target.value })}
                  placeholder="e.g. Metro Manila, Philippines"
                  className="h-9.5 rounded-xl border-gray-200 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1 text-xs" onClick={() => setShowCreateUserModal(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700"
                onClick={handleCreateUser}
                disabled={!newUserForm.name || !newUserForm.email || !newUserForm.password}
              >
                Create Account
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
