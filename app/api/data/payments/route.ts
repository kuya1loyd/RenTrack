import { readFileSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  getPayments,
  getPaymentsForUser,
  createPayment,
  findUserById,
  getAllUsers,
  getTenants,
  createNotification,
  getUnits,
  getProperties,
  getAdminSupabase,
  snakeToCamel,
} from "@/lib/db";
import { sendEmail, isSmtpConfigured, createRentTrackEmailTemplate } from "@/lib/mail";
import { formatCurrency } from "@/lib/utils";
import {
  requireAuth, requireRole, validateApiRequest, withRateLimit,
  sanitizeResponse, withSecurityHeaders, withCorsHeaders,
  sanitizeObject, getClientIp
} from "@/lib/api-security";
import { logAudit } from "@/lib/db";
import { randomBytes } from "crypto";

function getReceiptLogoDataUrl(siteUrl?: string) {
  const localLogoPath = path.join(process.cwd(), "public", "images", "landing", "logo.png");

  try {
    const logoBuffer = readFileSync(localLogoPath);
    return `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch {
    const baseUrl = siteUrl ? siteUrl.replace(/\/$/, "") : "";
    return baseUrl ? `${baseUrl}/images/landing/logo.png` : "/images/landing/logo.png";
  }
}

function buildAutomaticReceiptUrl(details: { id: string; amount: number; date: string; method: string; tenant: string; property: string; unit: string; notes: string }, siteUrl?: string) {
  const escapeXml = (value: string) => value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character] || character));
  const paymentType = details.notes.toLowerCase().includes("advance") ? "Advance Payment" : details.notes.toLowerCase().includes("outstanding") ? "Outstanding Balance" : "Regular Payment";
  const amountFormatted = formatCurrency(details.amount);
  const dateFormatted = details.date;
  const methodFormatted = details.method.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
  const now = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

  const logoHref = getReceiptLogoDataUrl(siteUrl);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="820" height="980" viewBox="0 0 820 980">
    <defs>
      <linearGradient id="g1" x1="0" x2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="50%" stop-color="#1d4ed8"/>
        <stop offset="100%" stop-color="#0ea5e9"/>
      </linearGradient>
      <linearGradient id="g2" x1="0" x2="1">
        <stop offset="0%" stop-color="#f8fafc"/>
        <stop offset="100%" stop-color="#eef2ff"/>
      </linearGradient>
    </defs>

    <rect width="820" height="980" fill="#f8fafc"/>
    <rect x="40" y="40" width="740" height="900" rx="26" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>

    <rect x="40" y="40" width="740" height="150" rx="26" fill="url(#g1)"/>
    <rect x="70" y="70" width="58" height="58" rx="16" fill="rgba(255,255,255,0.12)"/>
    <image href="${logoHref}" x="82" y="82" width="34" height="34" preserveAspectRatio="xMidYMid meet"/>

    <text x="145" y="98" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#ffffff">RentTrack</text>
    <text x="146" y="122" font-family="Arial, sans-serif" font-size="13" fill="#dbeafe">Official rental payment receipt</text>

    <rect x="566" y="86" width="170" height="40" rx="20" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.32)"/>
    <text x="651" y="111" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="#fef3c7">Awaiting review</text>

    <text x="70" y="238" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#111827">Payment Receipt</text>
    <text x="70" y="268" font-family="Arial, sans-serif" font-size="13" fill="#64748b">Thank you for your payment. This receipt is issued for record and confirmation.</text>

    <rect x="70" y="292" width="680" height="130" rx="18" fill="url(#g2)" stroke="#dbeafe"/>
    <text x="98" y="325" font-family="Arial, sans-serif" font-size="12" letter-spacing="1.2" fill="#64748b">PAID AMOUNT</text>
    <text x="98" y="382" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#0f172a">${escapeXml(amountFormatted)}</text>
    <rect x="522" y="320" width="190" height="70" rx="14" fill="#0f172a"/>
    <text x="617" y="346" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" letter-spacing="1.5" fill="#cbd5e1">RECEIPT NO.</text>
    <text x="617" y="369" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#ffffff">${escapeXml(details.id.slice(0, 12).toUpperCase())}</text>

    <rect x="70" y="450" width="680" height="1" fill="#e2e8f0"/>

    <text x="70" y="492" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#334155">Tenant Information</text>
    <text x="70" y="520" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#0f172a">${escapeXml(details.tenant)}</text>
    <text x="70" y="547" font-family="Arial, sans-serif" font-size="14" fill="#475569">${escapeXml(details.property || "Rental property")}</text>
    <text x="70" y="572" font-family="Arial, sans-serif" font-size="14" fill="#475569">Unit ${escapeXml(details.unit || "N/A")}</text>

    <text x="420" y="492" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#334155">Payment Details</text>
    <text x="420" y="525" font-family="Arial, sans-serif" font-size="13" fill="#64748b">Date</text>
    <text x="420" y="548" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#0f172a">${escapeXml(dateFormatted)}</text>
    <text x="420" y="580" font-family="Arial, sans-serif" font-size="13" fill="#64748b">Payment Type</text>
    <text x="420" y="603" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#0f172a">${escapeXml(paymentType)}</text>
    <text x="420" y="635" font-family="Arial, sans-serif" font-size="13" fill="#64748b">Payment Method</text>
    <text x="420" y="658" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#0f172a">${escapeXml(methodFormatted)}</text>

    <rect x="70" y="700" width="680" height="152" rx="20" fill="#f8fafc" stroke="#e2e8f0"/>
    <text x="96" y="734" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#334155">Summary</text>

    <text x="96" y="770" font-family="Arial, sans-serif" font-size="14" fill="#64748b">Amount Paid</text>
    <text x="700" y="770" text-anchor="end" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#111827">${escapeXml(amountFormatted)}</text>

    <text x="96" y="802" font-family="Arial, sans-serif" font-size="14" fill="#64748b">Notes</text>
    <text x="700" y="802" text-anchor="end" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#0f172a">${escapeXml(details.notes || "Payment submitted")}</text>

    <text x="96" y="834" font-family="Arial, sans-serif" font-size="14" fill="#64748b">Issued on</text>
    <text x="700" y="834" text-anchor="end" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#0f172a">${escapeXml(now)}</text>

    <rect x="70" y="872" width="680" height="1" fill="#e2e8f0"/>
    <text x="70" y="900" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8">This payment is pending confirmation by the property owner. Once verified, the balance is updated automatically.</text>
    <text x="70" y="918" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8">Generated by RentTrack • Property management, simplified.</text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

async function reconcileTenantPaymentLedger(tenantId: string, confirmedPaymentId: string, confirmedAmount: number) {
  if (!tenantId || !confirmedAmount) return;

  const tenantPayments = (await getPayments())
    .filter((payment: any) => payment.tenantId === tenantId && payment.id !== confirmedPaymentId)
    .sort((a: any, b: any) => new Date(a.paymentDate || a.createdAt).getTime() - new Date(b.paymentDate || b.createdAt).getTime());

  let remainingToApply = Number(confirmedAmount || 0);

  for (const payment of tenantPayments) {
    if (remainingToApply <= 0) break;

    const currentBalance = Math.max(0, Number(payment.balance || 0));
    if (currentBalance <= 0) continue;

    const appliedAmount = Math.min(remainingToApply, currentBalance);
    const nextBalance = Math.max(0, currentBalance - appliedAmount);
    const nextStatus = nextBalance === 0 ? "paid" : (payment.status === "overdue" ? "overdue" : "partial");

    if (appliedAmount > 0) {
      await getAdminSupabase()
        .from("payments")
        .update({
          balance: nextBalance,
          status: nextStatus,
        })
        .eq("id", payment.id);
    }

    remainingToApply -= appliedAmount;
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const payments = await getPaymentsForUser(auth.userId, auth.user.role);
    return NextResponse.json({ success: true, payments: payments.map(p => sanitizeResponse(p)) });
  } catch (error) {
    console.error("Get payments error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch payments" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await withRateLimit(request, `create_payment:${getClientIp(request)}`);
    if (rateLimit) return rateLimit;

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const user = auth.user;
    if (!["tenant", "agent", "admin", "owner"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Not allowed to submit payments" }, { status: 403 });
    }

    const body = await request.json();
    const paymentInput = body.data || body;
    const sanitized = sanitizeObject(paymentInput, [
      { key: "tenantId", type: "string", maxLength: 100 },
      { key: "tenantName", type: "string", maxLength: 200 },
      { key: "unitId", type: "string", maxLength: 100 },
      { key: "propertyName", type: "string", maxLength: 200 },
      { key: "amountPaid", type: "number" },
      { key: "amountDue", type: "number" },
      { key: "balance", type: "number" },
      { key: "paymentDate", type: "string", maxLength: 20 },
      { key: "dueDate", type: "string", maxLength: 20 },
      { key: "status", type: "string", maxLength: 20 },
      { key: "paymentMethod", type: "string", maxLength: 30 },
      { key: "paymentMethodNote", type: "string", maxLength: 100 },
      { key: "bankName", type: "string", maxLength: 100 },
      { key: "accountNumber", type: "string", maxLength: 100 },
      { key: "accountHolder", type: "string", maxLength: 200 },
      { key: "cardLast4", type: "string", maxLength: 4 },
      { key: "cardExpiry", type: "string", maxLength: 7 },
      { key: "gcashNumber", type: "string", maxLength: 20 },
      { key: "gcashName", type: "string", maxLength: 200 },
      { key: "receiptUrl", type: "string", maxLength: 10000 },
      { key: "stayStart", type: "string", maxLength: 20 },
      { key: "stayEnd", type: "string", maxLength: 20 },
      { key: "notes", type: "string", maxLength: 500 },
    ]);

    const amountPaid = Number(sanitized.amountPaid);
    if (!amountPaid || amountPaid <= 0) {
      return NextResponse.json({ success: false, error: "Valid payment amount is required" }, { status: 400 });
    }

    if (amountPaid > 1000000) {
      return NextResponse.json({ success: false, error: "Payment amount exceeds maximum allowed" }, { status: 400 });
    }

    const targetTenantId = user.role === "tenant" ? user.id : (sanitized.tenantId || user.id);

    if (user.role === "tenant" && targetTenantId !== user.id) {
      await logAudit(auth.userId, "payment_cross_tenant_blocked", { targetTenantId, userRole: user.role }, auth.ip, auth.userAgent);
      return NextResponse.json({ success: false, error: "You can only submit payments for your own account" }, { status: 403 });
    }

    const targetTenant = await findUserById(targetTenantId);
    if (!targetTenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }

    const tenants = await getTenants();
    const tenantRecord = tenants.find(t => t.id === targetTenantId);
    const tenantName = targetTenant?.name || sanitized.tenantName || user.name;
    const unitId = sanitized.unitId || tenantRecord?.unitId || "";
    const propertyName = sanitized.propertyName || tenantRecord?.propertyName || "";

    let inquiryAgent: any = null;
    if (targetTenant?.email) {
      try {
        const { data: inquiry } = await getAdminSupabase()
          .from("chat_messages")
          .select("agent_id, agent_name, created_at")
          .ilike("sender_email", targetTenant.email)
          .not("agent_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (inquiry?.agent_id) {
          inquiryAgent = await findUserById(inquiry.agent_id);
        }
      } catch (err) {
        console.warn("Could not resolve original inquiry agent:", err);
      }
    }

    let unitRentAmount = 0;
    if (unitId) {
      const units = await getUnits();
      const unit = units.find(u => u.id === unitId);
      if (unit) {
        unitRentAmount = Number(unit.rentAmount) || 0;
      }
    }
    if (!unitRentAmount && tenantRecord) {
      unitRentAmount = Number(tenantRecord.rentAmount) || 0;
    }

    const serverAmountDue = unitRentAmount;
    const serverBalance = Math.max(0, serverAmountDue - amountPaid);

    const paymentId = `pay_${Date.now()}_${randomBytes(4).toString("hex")}`;
    const paymentDate = sanitized.paymentDate || new Date().toISOString().split("T")[0];
    const paymentNotes = sanitized.notes || "Payment submitted";
    const automaticReceiptUrl = sanitized.receiptUrl || buildAutomaticReceiptUrl({
      id: paymentId,
      amount: amountPaid,
      date: paymentDate,
      method: sanitized.paymentMethod || "cash",
      tenant: tenantName,
      property: propertyName,
      unit: tenantRecord?.unitNumber || unitId,
      notes: paymentNotes,
    }, process.env.NEXT_PUBLIC_SITE_URL);
    const payment = await createPayment({
      id: paymentId,
      tenantId: targetTenantId,
      tenantName,
      unitId,
      propertyName,
      amountPaid,
      amountDue: serverAmountDue,
      balance: serverBalance,
      paymentDate,
      dueDate: sanitized.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      status: "pending",
      paymentMethod: sanitized.paymentMethod || "cash",
      paymentMethodNote: sanitized.paymentMethodNote || null,
      bankName: sanitized.bankName || null,
      accountNumber: sanitized.accountNumber || null,
      accountHolder: sanitized.accountHolder || null,
      cardLast4: sanitized.cardLast4 || null,
      cardExpiry: sanitized.cardExpiry || null,
      gcashNumber: sanitized.gcashNumber || null,
      gcashName: sanitized.gcashName || null,
      notes: paymentNotes,
      receiptUrl: automaticReceiptUrl,
      createdBy: user.id,
    }, user.id);

    try {
      await createNotification({
        userId: targetTenantId,
        title: "Payment already submitted",
        message: `You already paid ${formatCurrency(amountPaid)} and it is waiting for the owner to confirm. Once confirmed, your outstanding balance will be updated automatically.`,
        type: "payment"
      });
    } catch (err) {
      console.error("Failed to create in-app notification:", err);
    }

    // Notify only admins, the property owner, and the specific assigned agent of the unit
    try {
      let assignedAgentId: string | null = inquiryAgent?.id || null;
      let propertyOwnerId: string | null = null;

      if (unitId) {
        const units = await getUnits();
        const unit = units.find((u) => u.id === unitId);
        if (unit?.propertyId) {
          const properties = await getProperties();
          const prop = properties.find((p) => p.id === unit.propertyId);
          if (prop) {
            if (prop.agentId) assignedAgentId = prop.agentId;
            if (prop.ownerId) propertyOwnerId = prop.ownerId;
          }
        }
      }

      const allUsers = await getAllUsers();
      const targetReviewers = allUsers.filter((candidate: any) => {
        if (candidate.role === "admin") return true;
        if (candidate.role === "owner") {
          return !propertyOwnerId || candidate.id === propertyOwnerId;
        }
        if (candidate.role === "agent") {
          return assignedAgentId ? candidate.id === assignedAgentId : false;
        }
        return false;
      });

      await Promise.all(targetReviewers.map((reviewer: any) => createNotification({
        userId: reviewer.id,
        title: "New Payment Pending Verification",
        message: `${tenantName} submitted ${formatCurrency(amountPaid)} for verification (${propertyName || "Rental Unit"}).`,
        type: "payment",
      })));
    } catch (err) {
      console.error("Failed to notify targeted reviewers about payment:", err);
    }

    if (inquiryAgent) {
      try {
        await createNotification({
          userId: inquiryAgent.id,
          title: "Payment Submitted by Your Inquiry Tenant",
          message: `${tenantName} submitted ${formatCurrency(amountPaid)} for ${propertyName || "their rental"}. This payment is ready for your review.`,
          type: "payment",
        });
        if (inquiryAgent.email && isSmtpConfigured()) {
          await sendEmail({
            to: inquiryAgent.email,
            subject: `${tenantName} submitted a payment`,
            html: createRentTrackEmailTemplate({
              title: "Payment submitted by your inquiry tenant",
              body: `${tenantName} submitted a payment that is ready for your review.`,
              messageBlock: `Amount: ${formatCurrency(amountPaid)}\nProperty: ${propertyName || "Not specified"}\nPayment ID: ${payment.id}`,
              footerNote: "Please sign in to RentTrack to review and verify this payment.",
            }),
          });
        }
      } catch (err) {
        console.error("Failed to notify original inquiry agent:", err);
      }
    }

    try {
      if (targetTenant?.email && isSmtpConfigured()) {
        const subject = "Payment receipt received";
        const html = createRentTrackEmailTemplate({
          title: "Payment Receipt Received",
          body: `Hi ${tenantName},<br /><br />A payment of <strong>${formatCurrency(amountPaid)}</strong> was submitted for you.<br /><br />Receipt ID: <code>${payment.id}</code><br /><br />It is pending verification by our team.`,
          footerNote: "If you did not make this payment, please contact support immediately.",
        });
        await sendEmail({ to: targetTenant.email, subject, html, bcc: process.env.SMTP_USER });
      }
    } catch (err) {
      console.error("Failed to send payment notification email:", err);
    }

    await logAudit(auth.userId, "payment_created", { paymentId: payment.id, amount: amountPaid, method: sanitized.paymentMethod }, auth.ip, auth.userAgent);
    const response = NextResponse.json({ success: true, payment: sanitizeResponse(payment) });
    return withSecurityHeaders(withCorsHeaders(request, response));
  } catch (error) {
    console.error("Create payment error:", error);
    return NextResponse.json({ success: false, error: "Failed to create payment" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "owner", "agent", "tenant"]);
    if (auth instanceof NextResponse) return auth;

    const validation = validateApiRequest(request);
    if (validation) return validation;

    const { id, data } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: "Payment ID is required" }, { status: 400 });
    }

    const sanitized = sanitizeObject(data, [
      { key: "status", type: "string", maxLength: 20 },
      { key: "notes", type: "string", maxLength: 500 },
      { key: "balance", type: "number" },
      { key: "verifiedBy", type: "string", maxLength: 100 },
      { key: "receiptUrl", type: "string", maxLength: 10000 },
    ]);

    if (auth.user.role === "tenant") {
      const ownPayments = await getPaymentsForUser(auth.userId, "tenant");
      const ownsPayment = ownPayments.some((candidate: any) => candidate.id === id);
      const allowedKeys = ["receiptUrl", "notes"];
      const requestedKeys = Object.keys(sanitized);
      if (!ownsPayment || requestedKeys.some((key) => !allowedKeys.includes(key))) {
        return NextResponse.json({ success: false, error: "Tenants may only attach a receipt to their own payment" }, { status: 403 });
      }
    }

    if (sanitized.status && !["paid", "pending", "overdue", "partial"].includes(sanitized.status)) {
      return NextResponse.json({ success: false, error: "Invalid payment status" }, { status: 400 });
    }

    const currentPayment = (await getPaymentsForUser(auth.userId, auth.user.role)).find((candidate: any) => candidate.id === id);
    if (!currentPayment) {
      return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 });
    }
    if (sanitized.status === "paid") {
      const amountDue = Number(currentPayment.amountDue || 0);
      const amountPaid = Number(currentPayment.amountPaid || 0);
      const calculatedBalance = Math.max(0, amountDue - amountPaid);
      const isFullyPaid = amountDue > 0 ? amountPaid >= amountDue : amountPaid > 0;
      sanitized.balance = calculatedBalance;
      sanitized.status = isFullyPaid ? "paid" : "partial";
      console.log("[Payment] Confirming payment:", {
        id: currentPayment.id,
        amountDue,
        amountPaid,
        calculatedBalance,
        resolvedStatus: sanitized.status,
        oldBalance: currentPayment.balance,
      });
    }

    if (sanitized.status === "paid" && currentPayment.amountPaid > 0 && currentPayment.tenantId) {
      try {
        await reconcileTenantPaymentLedger(currentPayment.tenantId, currentPayment.id, currentPayment.amountPaid);
      } catch (err) {
        console.error("[Payment] Failed to apply payment to pending balances:", err);
      }
    }

    const updateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(sanitized)) {
      const snakeKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      updateData[snakeKey] = value;
    }

    const { data: updatedPayment, error: updateError } = await getAdminSupabase()
      .from("payments")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError || !updatedPayment) {
      return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 });
    }

    const payment = snakeToCamel(updatedPayment);
    if (!payment) {
      return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 });
    }
    if (sanitized.status === "paid" || sanitized.status === "partial") {
      try {
        await createNotification({
          userId: payment.tenantId,
          title: "Payment Confirmed",
          message: `Your payment of ${formatCurrency(payment.amountPaid)} was confirmed by ${auth.user.name}.`,
          type: "payment",
        });
        let assignedAgentId: string | null = null;
        if (payment.unitId) {
          const units = await getUnits();
          const unit = units.find((u) => u.id === payment.unitId);
          if (unit?.propertyId) {
            const properties = await getProperties();
            const prop = properties.find((p) => p.id === unit.propertyId);
            if (prop?.agentId) {
              assignedAgentId = prop.agentId;
            }
          }
        }

        if (assignedAgentId && assignedAgentId !== auth.userId) {
          await createNotification({
            userId: assignedAgentId,
            title: "Payment Confirmed",
            message: `${payment.tenantName || "A tenant"}'s payment of ${formatCurrency(payment.amountPaid)} was confirmed.`,
            type: "payment",
          });
        }
      } catch (notificationError) {
        console.error("Failed to notify payment confirmation recipients:", notificationError);
      }
    }
    await logAudit(auth.userId, "payment_updated", { paymentId: id, updates: Object.keys(sanitized) }, auth.ip, auth.userAgent);
    const response = NextResponse.json({ success: true, payment: sanitizeResponse(payment) });
    return withSecurityHeaders(withCorsHeaders(request, response));
  } catch (error) {
    console.error("Update payment error:", error);
    return NextResponse.json({ success: false, error: "Failed to update payment" }, { status: 500 });
  }
}
