"use client";

// ─── PostgreSQL-backed Data Store ───────────────────────────────────────────

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Property {
  id: string;
  name: string;
  location: string;
  type: "house" | "condominium";
  units: number;
  occupiedUnits: number;
  latitude?: number;
  longitude?: number;
  monthlyRevenue: number;
  status: "active" | "inactive";
  description?: string;
  createdAt: string;
  createdBy: string;
  imageUrl?: string;
  imageUrls?: string[];
  agentId?: string;
  features?: string[];
  condition?: string;
  availabilityStatus?: "Available" | "Occupied" | "Reserved" | "Under Maintenance";
}

export interface Unit {
  id: string;
  propertyId: string;
  unitNumber: string;
  floor?: number;
  status: "occupied" | "vacant" | "maintenance";
  rentAmount: number;
  tenantName?: string;
  tenantId?: string;
  leaseEnd?: string;
  imageUrl?: string;
  imageUrls?: string[];
}

export interface TenantRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  occupation?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  unitId?: string;
  propertyName?: string;
  unitNumber?: string;
  contractStart?: string;
  contractEnd?: string;
  rentAmount?: number;
  status: "active" | "inactive";
  assignmentStatus?: "pending" | "confirmed" | "rejected";
  createdBy?: string;
  isAssisted?: boolean;
  assistReason?: string;
  createdAt: string;
  avatarUrl?: string;
  idVerificationUrl?: string;
  idVerificationStatus?: string;
  profileVisibility?: boolean;
  showEmail?: boolean;
  showPhone?: boolean;
  allowMessages?: boolean;
  dataSharing?: boolean;
  experience?: string;
  gender?: string;
  birthdate?: string;
  country?: string;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  address?: string;
  createdAt: string;
  avatarUrl?: string;
  idVerificationUrl?: string;
  idVerificationStatus?: string;
  isOnline?: boolean;
  lastLoginAt?: string | null;
  lastSeenAt?: string | null;
  experience?: string;
  gender?: string;
  birthdate?: string;
  country?: string;
  commissionRate?: number;
}

export interface Payment {
  id: string;
  tenantId: string;
  tenantName: string;
  unitId: string;
  propertyName: string;
  amountPaid: number;
  amountDue: number;
  balance: number;
  paymentDate: string;
  dueDate: string;
  status: "paid" | "pending" | "overdue" | "partial";
  paymentMethod: "cash" | "upload_receipt" | "gcash";
  paymentMethodNote?: string;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  cardLast4?: string;
  cardExpiry?: string;
  gcashNumber?: string;
  gcashName?: string;
  receiptUrl?: string;
  stayStart?: string;
  stayEnd?: string;
  notes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  createdBy: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "payment" | "tenant" | "property" | "system" | "id_verification";
  read: boolean;
  createdAt: string;
}

export interface AgentApplication {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address: "Cebu" | "Manila" | "Davao" | "Butuan";
  gender?: string;
  birthdate?: string;
  resumeName?: string;
  resumeMimeType?: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  actor: string;
  action: string;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: string;
}

// ─── API Helper ────────────────────────────────────────────────────────────

export async function safeParseJson(res: Response) {
  try {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await res.json();
    }
    const text = await res.text();
    return { success: false, error: text || `Server error (${res.status})` };
  } catch {
    return { success: false, error: `Invalid response from server (${res.status})` };
  }
}

async function apiGet(url: string) {
  try {
    const res = await fetch(url, { credentials: "include", next: { revalidate: 0 } });
    if (!res.ok) {
      return { success: false, error: `Request failed with status ${res.status}` };
    }
    return await safeParseJson(res);
  } catch {
    return { success: false, error: "Request unavailable" };
  }
}

async function apiPost(url: string, body: any) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    return await safeParseJson(res);
  } catch {
    return { success: false, error: "Network request failed" };
  }
}

async function apiPostForm(url: string, formData: FormData) {
  try {
    const res = await fetch(url, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    return await safeParseJson(res);
  } catch {
    return { success: false, error: "Network request failed" };
  }
}

async function apiPatch(url: string, body: any) {
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    return await safeParseJson(res);
  } catch {
    return { success: false, error: "Network request failed" };
  }
}

async function apiDelete(url: string, body: any) {
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    return await safeParseJson(res);
  } catch {
    return { success: false, error: "Network request failed" };
  }
}

// ─── Properties ────────────────────────────────────────────────────────────

export async function getProperties(_user?: any): Promise<Property[]> {
  const result = await apiGet("/api/data/properties");
  return result.success ? result.properties : [];
}

export async function addProperty(data: Omit<Property, "id" | "createdAt" | "createdBy">, _userId: string): Promise<Property> {
  const result = await apiPost("/api/data/properties", data);
  if (!result.success || !result.property) {
    throw new Error(result.error || "Failed to create property");
  }
  return result.property || result;
}

export async function updateProperty(id: string, data: Partial<Property>): Promise<Property | null> {
  const result = await apiPatch("/api/data/properties/patch", { id, data });
  return result.success ? result.property || data as any : null;
}

export async function deleteProperty(id: string): Promise<boolean> {
  const result = await apiDelete("/api/data/properties", { id });
  return result.success;
}

// ─── Units ─────────────────────────────────────────────────────────────────

export async function getUnits(_user?: any): Promise<Unit[]> {
  const result = await apiGet("/api/data/units");
  return result.success ? result.units : [];
}

export async function addUnit(data: Omit<Unit, "id">): Promise<Unit> {
  const result = await apiPost("/api/data/units", data);
  if (!result.success || !result.unit) {
    throw new Error(result.error || "Failed to create unit");
  }
  return result.unit || result;
}

export async function updateUnit(id: string, data: Partial<Unit>): Promise<Unit | null> {
  const result = await apiPatch("/api/data/units/patch", { id, data });
  return result.success ? result.unit || data as any : null;
}

export async function deleteUnit(id: string): Promise<boolean> {
  const result = await apiDelete("/api/data/units", { id });
  return result.success;
}

// ─── Tenants ───────────────────────────────────────────────────────────────

export async function getTenants(_user?: any): Promise<TenantRecord[]> {
  const result = await apiGet("/api/data/tenants");
  return result.success ? result.tenants : [];
}

export async function addTenant(data: Omit<TenantRecord, "id" | "createdAt" | "createdBy">, _userId: string): Promise<TenantRecord> {
  const result = await apiPost("/api/data/tenants", data);
  return result.tenant;
}

export async function updateTenantAssignment(tenantId: string, data: {
  unitId?: string; propertyName?: string; unitNumber?: string;
  contractStart?: string; contractEnd?: string; rentAmount?: number;
  assignmentStatus?: string;
}): Promise<TenantRecord | null> {
  const result = await apiPatch("/api/data/tenants", { tenantId, ...data });
  return result.tenant || null;
}

export async function updateTenantVerification(tenantId: string, status: "approved" | "rejected" | "pending", _comment?: string): Promise<TenantRecord | null> {
  const result = await apiPatch("/api/data/tenants", { tenantId, idVerificationStatus: status });
  return result.tenant || null;
}

export async function updateTenantStatus(tenantId: string, status: "active" | "inactive"): Promise<TenantRecord | null> {
  const result = await apiPatch("/api/data/tenants", { tenantId, status });
  return result.tenant || null;
}

// ─── Payments ──────────────────────────────────────────────────────────────

export async function getPayments(_user?: any): Promise<Payment[]> {
  const result = await apiGet("/api/data/payments");
  return result.success ? result.payments : [];
}

export async function getPendingPaymentsCount(): Promise<number> {
  const payments = await getPayments();
  return payments.filter((p) => p.status === "pending" || p.status === "overdue").length;
}

export async function addPayment(data: Omit<Payment, "id">, security?: { paymentPin?: string; otpCode?: string }, tenantId?: string): Promise<Payment> {
  const body: any = { data };
  if (security) {
    body.paymentPin = security.paymentPin;
    body.otpCode = security.otpCode;
  }
  if (tenantId) {
    body.tenantId = tenantId;
  }
  const result = await apiPost("/api/data/payments", body);
  return result.payment;
}

export async function updatePayment(id: string, data: Partial<Payment>): Promise<Payment | null> {
  const result = await apiPatch("/api/data/payments", { id, data });
  return result.payment || null;
}

export async function verifyPayment(payment: Payment, verifiedBy: string, status: "paid" | "rejected"): Promise<Payment | null> {
  const updateData: any = { verifiedBy, verifiedAt: new Date().toISOString() };
  if (status === "paid") {
    const amountDue = Number(payment.amountDue || 0);
    const amountPaid = Number(payment.amountPaid || 0);
    const newBalance = Math.max(0, amountDue - amountPaid);
    const isFullyPaid = amountDue > 0 ? amountPaid >= amountDue : amountPaid > 0;
    updateData.balance = newBalance;
    updateData.status = isFullyPaid ? "paid" : "partial";
  } else {
    updateData.status = "pending";
  }
  const result = await apiPatch("/api/data/payments", { id: payment.id, data: updateData });
  return result.payment || null;
}

export async function resetTenantPayments(tenantId: string): Promise<boolean> {
  const result = await apiDelete("/api/data/payments/reset", { tenantId });
  return Boolean(result?.success);
}

export interface MonthlyTrend {
  month: string;
  collected: number;
  pending: number;
  overdue: number;
}

export async function getPaymentTrends(_user?: any): Promise<MonthlyTrend[]> {
  const result = await apiGet("/api/data/payments/trends");
  return result.success ? result.trends : [];
}

// ─── Notifications ─────────────────────────────────────────────────────────

export async function getNotifications(userId?: string): Promise<Notification[]> {
  const url = userId ? `/api/data/notifications?userId=${userId}&_t=${Date.now()}` : `/api/data/notifications?_t=${Date.now()}`;
  const result = await apiGet(url);
  return result.success ? result.notifications : [];
}

export async function addNotification(data: Omit<Notification, "id" | "createdAt">): Promise<Notification> {
  const result = await apiPost("/api/data/notifications", data);
  return result.notification;
}

export async function notifyAdmins(data: Omit<Notification, "id" | "createdAt" | "userId"> & { recipientRole?: string }): Promise<void> {
  const result = await apiPost("/api/notifications/send-to-admins", data);
  if (!result.success) {
    throw new Error(result.error || "Failed to send notification");
  }
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const result = await apiPatch("/api/data/notifications", { id });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("renttrack-notifications-updated"));
  }
  return result.success;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await apiPatch("/api/data/notifications", { userId, action: "markAllRead" });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("renttrack-notifications-updated"));
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await apiGet(`/api/data/notifications?userId=${userId}&count=true&_t=${Date.now()}`);
  return result.success ? result.count : 0;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  subject?: string;
  body: string;
  read: boolean;
  createdAt: string;
  attachmentUrl?: string;
  attachmentType?: string;
}

export interface Conversation {
  userId: string;
  otherUser: { id: string; name: string; email: string; role: string; avatarUrl?: string } | null;
  lastMessage: Message;
  unreadCount: number;
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function sendMessage(data: { receiverId: string; subject?: string; body: string; attachmentUrl?: string; attachmentType?: string }): Promise<Message> {
  const result = await apiPost("/api/messages", data);
  return result.message || result;
}

export async function getConversations(): Promise<Conversation[]> {
  const result = await apiGet("/api/messages");
  return result.success ? result.conversations : [];
}

export async function getMessages(otherUserId: string): Promise<Message[]> {
  const result = await apiGet(`/api/messages/${encodeURIComponent(otherUserId)}`);
  return result.success ? result.messages : [];
}

export async function markAllMessagesRead(otherUserId: string): Promise<void> {
  await apiPatch(`/api/messages/${encodeURIComponent(otherUserId)}`, { action: "markAllRead" });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("renttrack-notifications-updated"));
  }
}

export async function getUnreadMessageCount(): Promise<number> {
  const result = await apiGet("/api/messages?count=true");
  return result.success ? result.count : 0;
}

export async function uploadMessageAttachment(file: File, type: "image" | "audio"): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);
  const result = await apiPostForm("/api/messages/upload", formData);
  if (!result.success) throw new Error(result.error || "Upload failed");
  return result.url;
}

export async function getAgents(): Promise<UserRecord[]> {
  const result = await apiGet("/api/auth/users/agents");
  if (result.success && Array.isArray(result.users)) {
    return result.users.filter((user: UserRecord) => user.role === "agent");
  }
  return [];
}

export async function getOwnerAgents(): Promise<UserRecord[]> {
  const result = await apiGet("/api/auth/users?role=agent");
  if (!result.success || !Array.isArray(result.users)) {
    throw new Error(result.error || "Failed to load owner agents");
  }
  return result.users;
}

export async function registerAgent(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  experience?: string;
  gender?: string;
  birthdate?: string;
  country?: string;
}): Promise<UserRecord & { needsOtp?: boolean; devOtp?: string; emailSent?: boolean; emailStatus?: "sent" | "not_configured" | "failed" }> {
  const result = await apiPost("/api/auth/users", { ...data, role: "agent" });
  if (result && result.success) {
    return {
      ...(result.user || {}),
      id: result.user?.id || result.userId,
      name: data.name,
      email: data.email,
      role: "agent",
      phone: data.phone,
      address: data.address,
      createdAt: new Date().toISOString(),
      experience: data.experience,
      gender: data.gender,
      birthdate: data.birthdate,
      country: data.country,
      needsOtp: result.needsOtp,
      devOtp: result.devOtp,
      emailSent: result.emailSent === true,
      emailStatus: result.emailStatus,
    } as UserRecord & { needsOtp?: boolean; devOtp?: string; emailSent?: boolean; emailStatus?: "sent" | "not_configured" | "failed" };
  }

  throw new Error(result?.error || result?.message || "Failed to register agent");
}

export async function getAgentApplications(status?: string): Promise<AgentApplication[]> {
  const result = await apiGet(`/api/agent-applications${status ? `?status=${encodeURIComponent(status)}` : ""}`);
  return result.success ? result.applications : [];
}

export async function reviewAgentApplication(id: string, status: "approved" | "rejected", rejectionReason?: string) {
  return apiPatch("/api/agent-applications", { id, status, rejectionReason });
}

export async function reopenAgentApplication(id: string) {
  return apiPatch("/api/agent-applications", { id, action: "reopen" });
}

export async function deleteRejectedAgentApplication(id: string) {
  return apiDelete("/api/agent-applications", { id });
}

// ─── Dashboard Data ────────────────────────────────────────────────────────

export interface DashboardData {
  properties: Property[];
  units: Unit[];
  tenants: TenantRecord[];
  payments: Payment[];
  trends: MonthlyTrend[];
  propertiesCount: number;
  unitsCount: number;
  tenantsCount: number;
  occupiedUnitsCount: number;
  vacantUnitsCount: number;
  totalRevenue: number;
  totalReceivables: number;
  totalCollected: number;
}

export async function getDashboardData(user?: any): Promise<DashboardData> {
  const results = await Promise.allSettled([
    getProperties(user),
    getUnits(user),
    getTenants(user),
    getPayments(user),
    getPaymentTrends(user),
  ]);

  const properties = results[0].status === "fulfilled" ? results[0].value : [];
  const units = results[1].status === "fulfilled" ? results[1].value : [];
  const tenants = results[2].status === "fulfilled" ? results[2].value : [];
  const payments = results[3].status === "fulfilled" ? results[3].value : [];
  const trends = results[4].status === "fulfilled" ? results[4].value : [];

  const totalRevenue = units
    .filter((u) => u.status === "occupied")
    .reduce((sum, u) => sum + (u.rentAmount || 0), 0);

  const totalReceivables = payments
    .filter((p) => p.status === "overdue" || p.status === "partial" || p.status === "pending")
    .reduce((sum, p) => sum + (p.balance || 0), 0);

  const totalCollected = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (p.amountPaid || 0), 0);

  return {
    properties,
    units,
    tenants,
    payments,
    trends,
    propertiesCount: properties.length,
    unitsCount: units.length,
    tenantsCount: tenants.length,
    occupiedUnitsCount: units.filter((u) => u.status === "occupied").length,
    vacantUnitsCount: units.filter((u) => u.status === "vacant").length,
    totalRevenue,
    totalReceivables,
    totalCollected,
  };
}

// ─── Computed Helpers ──────────────────────────────────────────────────────

export async function getPropertiesCount(): Promise<number> {
  const props = await getProperties();
  return props.length;
}

export async function getUnitsCount(): Promise<number> {
  const units = await getUnits();
  return units.length;
}

export async function getTenantsCount(): Promise<number> {
  const tenants = await getTenants();
  return tenants.length;
}

export async function getOccupiedUnitsCount(): Promise<number> {
  const units = await getUnits();
  return units.filter((u) => u.status === "occupied").length;
}

export async function getVacantUnitsCount(): Promise<number> {
  const units = await getUnits();
  return units.filter((u) => u.status === "vacant").length;
}

export async function getTotalRevenue(): Promise<number> {
  const units = await getUnits();
  return units.filter((u) => u.status === "occupied").reduce((sum, u) => sum + u.rentAmount, 0);
}

export async function getTotalReceivables(user?: any): Promise<number> {
  const payments = await getPayments(user);
  return payments
    .filter((p) => p.status === "overdue" || p.status === "partial" || p.status === "pending")
    .reduce((sum, p) => sum + p.balance, 0);
}

export async function getTotalCollected(user?: any): Promise<number> {
  const payments = await getPayments(user);
  return payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amountPaid, 0);
}

export function getTenantPaymentSummary(payments: Payment[], tenantId: string) {
  const tenantPayments = payments.filter((payment) => payment.tenantId === tenantId);
  const totalPaid = tenantPayments
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + (payment.amountPaid || 0), 0);

  const pendingOrOverduePayments = tenantPayments.filter((payment) => {
    if (!(payment.amountPaid > 0)) return false;
    return ["pending", "overdue", "partial"].includes(payment.status || "pending");
  });

  const outstanding = tenantPayments
    .filter((payment) => ["pending", "overdue", "partial"].includes(payment.status || "pending"))
    .reduce((sum, payment) => sum + Math.max(0, payment.balance || 0), 0);

  const waitingForConfirmation = pendingOrOverduePayments.length > 0
    ? [...pendingOrOverduePayments].sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0]
    : null;

  return {
    totalPaid,
    outstanding,
    hasAwaitingConfirmation: Boolean(waitingForConfirmation),
    waitingForConfirmation,
    hasConfirmedPayment: tenantPayments.some((payment) => payment.status === "paid" && payment.amountPaid > 0),
  };
}

export function getOccupancyRate(_propertyId: string): number {
  return 0; // Will be implemented when needed
}

// ─── Ratings ────────────────────────────────────────────────────────────────

export interface Rating {
  id: string;
  userId: string;
  targetType: "property" | "unit" | "support";
  targetId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  userName?: string;
  userEmail?: string;
}

export interface RatingSummary {
  average: number;
  total: number;
}

export async function createRating(data: { userId: string; targetType: "property" | "unit"; targetId: string; rating: number; comment?: string }): Promise<Rating> {
  const result = await apiPost("/api/data/ratings", data);
  return result.rating;
}

export async function getRatings(targetType: string, targetId: string): Promise<Rating[]> {
  const result = await apiGet(`/api/data/ratings?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`);
  return result.success ? result.ratings : [];
}

export async function getRatingsByUser(userId: string): Promise<Rating[]> {
  const result = await apiGet(`/api/data/ratings?userId=${encodeURIComponent(userId)}`);
  return result.success ? result.ratings : [];
}

export async function getAverageRating(targetType: string, targetId: string): Promise<RatingSummary> {
  const result = await apiGet(`/api/data/ratings?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`);
  return result.success ? result.average : { average: 0, total: 0 };
}

export async function getAllRatings(): Promise<Rating[]> {
  const result = await apiGet("/api/admin/ratings");
  return result.success ? result.ratings : [];
}

// ─── Complaints ─────────────────────────────────────────────────────────────

export interface Complaint {
  id: string;
  tenantId: string;
  targetType: "property" | "unit" | "support";
  targetId: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  assignedTo?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  tenantName?: string;
  tenantEmail?: string;
  responseText?: string;
  responseBy?: string;
  responseAt?: string;
  tenantReplyText?: string;
  tenantReplyBy?: string;
  tenantReplyAt?: string;
}

export async function createComplaint(data: { tenantId: string; targetType: "property" | "unit" | "support"; targetId: string; subject: string; message: string; priority?: string }): Promise<Complaint> {
  const result = await apiPost("/api/data/complaints", data);
  return result.complaint;
}

export async function getComplaints(tenantId?: string): Promise<Complaint[]> {
  const url = tenantId ? `/api/data/complaints?tenantId=${encodeURIComponent(tenantId)}` : "/api/data/complaints";
  const result = await apiGet(url);
  return result.success ? result.complaints : [];
}

export async function getComplaintById(id: string): Promise<Complaint | null> {
  const result = await apiGet(`/api/data/complaints/${id}`);
  return result.success ? result.complaint : null;
}

export async function updateComplaintStatus(id: string, status: string, assignedTo?: string, responseText?: string, responseBy?: string): Promise<Complaint | null> {
  const result = await apiPatch("/api/data/complaints", { id, status, assignedTo, responseText, responseBy });
  return result.complaint || null;
}

export async function replyToComplaint(id: string, replyText: string): Promise<Complaint | null> {
  const result = await apiPatch("/api/data/complaints/tenant-reply", { id, replyText });
  return result.complaint || null;
}

// ─── Admin User Management ────────────────────────────────────────────────

export async function getUsers(): Promise<UserRecord[]> {
  const result = await apiGet("/api/auth/users");
  return result.success ? result.users : [];
}

export async function getSampleUserIds(): Promise<Set<string>> {
  const users = await getUsers();
  const sampleEmails = ["admin@renttrack.com", "renttrackowner@gmail.com"];
  return new Set(users.filter(u => sampleEmails.includes(u.email.toLowerCase())).map(u => u.id));
}

export async function getAuditLogs(limit = 40): Promise<AuditLog[]> {
  const result = await apiGet(`/api/data/audit-logs?limit=${Math.min(Math.max(limit, 1), 100)}`);
  return result.success ? result.logs : [];
}

export async function resetAgentPassword(userId: string, newPassword: string, currentPassword: string): Promise<void> {
  const result = await apiPost("/api/auth/reset-password", { userId, newPassword, currentPassword });
  if (!result.success) {
    throw new Error(result.error || "Failed to reset password");
  }
}

export async function adminResetUserPassword(userId: string, newPassword: string): Promise<void> {
  const result = await apiPost("/api/auth/reset-password", { userId, newPassword });
  if (!result.success) {
    throw new Error(result.error || "Failed to reset password");
  }
}

export async function deleteUser(userId: string): Promise<boolean> {
  const result = await apiDelete("/api/auth/users", { userId });
  return result.success;
}

export async function updateUserRole(userId: string, role: string): Promise<boolean> {
  const result = await apiPatch("/api/auth/users", { userId, role });
  return result.success;
}

export async function updateUser(userId: string, data: Partial<Pick<UserRecord, "name" | "email" | "phone" | "address" | "idVerificationStatus" | "commissionRate">>): Promise<UserRecord | null> {
  const result = await apiPatch("/api/auth/users/patch", { userId, data });
  if (!result.success) {
    throw new Error(result.error || "Failed to update user");
  }
  if (!result.user) {
    throw new Error("User update response did not include the updated user");
  }
  return result.user;
}

export async function resetAgentData(userId: string): Promise<boolean> {
  const result = await apiPost("/api/auth/users/reset", { userId });
  return result.success;
}

export async function getAgentStats(userId: string): Promise<{ properties: number; tenants: number; payments: number }> {
  const [properties, tenants, payments, units] = await Promise.all([
    getProperties(),
    getTenants(),
    getPayments(),
    getUnits(),
  ]);

  const agentPropertyIds = new Set(
    properties.filter((p) => p.agentId === userId).map((p) => p.id)
  );

  const propertyUnitIds = new Set(
    units.filter((u) => agentPropertyIds.has(u.propertyId)).map((u) => u.id)
  );

  const tenantIdsForAgent = new Set(
    tenants
      .filter((t) => propertyUnitIds.has(t.unitId || ""))
      .map((t) => t.id)
  );

  return {
    properties: agentPropertyIds.size,
    tenants: tenantIdsForAgent.size,
    payments: payments.filter((p) => tenantIdsForAgent.has(p.tenantId || "")).length,
  };
}

export interface ChatInquiry {
  id: string;
  text: string;
  propertyId?: string;
  senderName: string;
  senderEmail: string;
  senderPhone?: string;
  status: string;
  createdAt: string;
  replyText?: string;
  repliedAt?: string;
  agentName?: string;
  visitorReply?: string;
  visitorRepliedAt?: string;
  agentId?: string;
}

export async function getInquiries(): Promise<ChatInquiry[]> {
  const result = await apiGet("/api/chat/inquiries");
  if (!result.success) throw new Error(result.error || "Failed to load inquiries");
  if (!Array.isArray(result.inquiries)) throw new Error("Inquiry response was invalid");
  return result.inquiries;
}

export async function getUnreadInquiryCount(): Promise<number> {
  const result = await apiGet("/api/chat/inquiries?count=true");
  if (!result.success) throw new Error(result.error || "Failed to load unread inquiries");
  return typeof result.count === "number" ? result.count : 0;
}

export async function updateInquiryStatus(id: string, status: string, replyText?: string): Promise<{ success: boolean; emailSent?: boolean }> {
  const result = await apiPatch(`/api/chat/inquiries`, { id, status, replyText });
  if (!result.success) throw new Error(result.error || "Failed to update inquiry");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("renttrack-notifications-updated"));
  }
  return result;
}

export async function updateInquiryProperty(id: string, propertyId: string | null): Promise<void> {
  const result = await apiPatch("/api/chat/inquiries", { id, propertyId });
  if (!result.success) throw new Error(result.error || "Failed to update inquiry category");
}
