"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  CreditCard,
  FileText,
  AlertCircle,
  Clock,
  Eye,
  Home,
  Building2,
  Calendar,
  X,
  Upload,
  Check,
  Copy,
  ChevronDown,
  QrCode,
  Download,
  Maximize2,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { formatCurrency, formatDate, parseGcashReference } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  getPayments,
  addPayment,
  getTenants,
  getTenantPaymentSummary,
  safeParseJson,
  addNotification,
  notifyAdmins,
  Payment,
  TenantRecord,
} from "@/lib/data";
import { toast } from "sonner";
import ReceiptModal from "@/components/receipt-modal";
import TenantContracts from "@/components/tenant-contracts";
import { ManagementBanner } from "@/components/management-panel";

export default function TenantPaymentsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenant, setTenant] = useState<TenantRecord | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "contract" | "payments">("payments");

  // Payment Submission Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<"regular" | "partial" | "advance" | "outstanding">("regular");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"gcash" | "cash">("gcash");
  const [gcashRefNumber, setGcashRefNumber] = useState("");
  const [copiedGcashNumber, setCopiedGcashNumber] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [ocrDetected, setOcrDetected] = useState(false);
  const [desiredStart, setDesiredStart] = useState("");
  const [desiredEnd, setDesiredEnd] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Modals
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<Payment | null>(null);
  const [isQrExpanded, setIsQrExpanded] = useState(false);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    getPayments(user)
      .then((raw) => {
        if (!isMounted) return;
        const normalized = (raw || []).map((item: any) => ({
          ...item,
          status: item.status || "pending",
          receiptUrl: item.receiptUrl || null,
          paymentMethod: item.paymentMethod || "gcash",
          amountPaid: item.amountPaid || 0,
          amountDue: item.amountDue || 0,
          balance: item.balance || 0,
          paymentDate: item.paymentDate || "",
          notes: item.notes || "",
          gcashNumber: item.gcashNumber || undefined,
        }));
        setPayments(normalized);
      })
      .catch(() => {
        if (isMounted) setPayments([]);
      });

    getTenants()
      .then((records) => {
        if (!isMounted) return;
        const found = records.find((t) => t.id === user.id);
        setTenant(found || null);
      })
      .catch(() => {
        if (isMounted) setTenant(null);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Handle Escape key navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isQrExpanded) {
          setIsQrExpanded(false);
        } else if (isPaymentModalOpen && !isUploading) {
          setIsPaymentModalOpen(false);
        } else if (isLedgerModalOpen) {
          setIsLedgerModalOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isQrExpanded, isPaymentModalOpen, isUploading, isLedgerModalOpen]);

  const tenantPaymentSummary = user
    ? getTenantPaymentSummary(payments, user.id)
    : { totalPaid: 0, outstanding: 0, hasAwaitingConfirmation: false, waitingForConfirmation: null, hasConfirmedPayment: false };

  // Outstanding balance defaults to 0 if none
  const outstandingBalance = tenantPaymentSummary.outstanding;
  const displayBalance = outstandingBalance;

  const myPayments = payments;
  const latestPayment = myPayments.length > 0 ? myPayments[0] : null;
  const rentAmount = tenant?.rentAmount && tenant.rentAmount > 0 ? tenant.rentAmount : (latestPayment?.amountDue && latestPayment.amountDue > 0 ? latestPayment.amountDue : 0);

  const openPaymentModal = (type: "regular" | "partial" | "advance" | "outstanding" = "regular") => {
    setPaymentType(type);
    if (type === "regular") {
      setPaymentAmount(rentAmount > 0 ? String(rentAmount) : "0.00");
    } else if (type === "partial") {
      setPaymentAmount(rentAmount > 0 ? String(Math.round(rentAmount / 2)) : "0.00");
    } else if (type === "advance") {
      setPaymentAmount(rentAmount > 0 ? String(rentAmount) : "0.00");
    } else {
      setPaymentAmount(displayBalance > 0 ? String(displayBalance) : "0.00");
    }
    setPaymentMethod("gcash");
    setGcashRefNumber("");
    setReceiptFile(null);
    setIsScanningReceipt(false);
    setOcrDetected(false);
    setPaymentNotes("");
    setIsPaymentModalOpen(true);
  };

  const handleSelectPaymentType = (type: "regular" | "partial" | "advance" | "outstanding") => {
    setPaymentType(type);
    if (type === "regular") {
      setPaymentAmount(rentAmount > 0 ? String(rentAmount) : "0.00");
    } else if (type === "partial") {
      setPaymentAmount(rentAmount > 0 ? String(Math.round(rentAmount / 2)) : "0.00");
    } else if (type === "advance") {
      setPaymentAmount(rentAmount > 0 ? String(rentAmount) : "0.00");
    } else {
      setPaymentAmount(displayBalance > 0 ? String(displayBalance) : "0.00");
    }
  };

  // Automatic Fast OCR Reader for Uploaded GCash Receipt
  const handleReceiptUpload = async (file: File | null) => {
    setReceiptFile(file);
    if (!file) {
      setOcrDetected(false);
      setIsScanningReceipt(false);
      return;
    }

    // Quick filename check (e.g., if user renamed receipt to reference number)
    const filenameRef = parseGcashReference(file.name);
    if (filenameRef) {
      setGcashRefNumber(filenameRef);
      setOcrDetected(true);
      toast.success(`GCash Reference Number detected: ${filenameRef}`);
      return;
    }

    // If paying via GCash, scan for reference number (checks both mime type and file extension)
    const isImageFile = (file.type && file.type.startsWith("image/")) || /\.(jpe?g|png|webp|bmp|gif|tiff)$/i.test(file.name);
    if (paymentMethod === "gcash" && isImageFile) {
      setIsScanningReceipt(true);

      // 1. Try instant client-side scan with tesseract.js in browser Web Worker
      try {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        const ret = await worker.recognize(file);
        await worker.terminate();
        const text = ret?.data?.text || "";
        const extracted = parseGcashReference(text);
        if (extracted) {
          setGcashRefNumber(extracted);
          setOcrDetected(true);
          toast.success(`GCash Reference Number detected: ${extracted}`);
          setIsScanningReceipt(false);
          return;
        }
      } catch (clientOcrErr) {
        console.warn("Client-side OCR notice, falling back to server:", clientOcrErr);
      }

      // 2. Server API fallback
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const ocrFormData = new FormData();
        ocrFormData.append("file", file);
        const res = await fetch("/api/ocr/extract-reference", {
          method: "POST",
          body: ocrFormData,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const data = await safeParseJson(res);
        if (data.success && data.referenceNumber) {
          setGcashRefNumber(data.referenceNumber);
          setOcrDetected(true);
          toast.success(`GCash Reference Number detected: ${data.referenceNumber}`);
        } else {
          setOcrDetected(false);
          toast.info("Receipt attached. You can confirm or enter the Reference Number below.");
        }
      } catch {
        clearTimeout(timeoutId);
        setOcrDetected(false);
      } finally {
        setIsScanningReceipt(false);
      }
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(paymentAmount);
    if (!paymentAmount || isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    // If GCash, require either an uploaded receipt OR a manual reference number
    if (paymentMethod === "gcash" && !gcashRefNumber.trim() && !receiptFile) {
      toast.error("Please upload your GCash receipt screenshot or enter a Reference Number");
      return;
    }

    if (desiredStart && desiredEnd && new Date(desiredEnd) <= new Date(desiredStart)) {
      toast.error("End date must be after start date");
      return;
    }
    if (!user) return;

    const isGcash = paymentMethod === "gcash";
    const effectiveRefNumber = gcashRefNumber.trim() || `GC-${Date.now().toString().slice(-8)}`;

    setIsUploading(true);

    try {
      let uploadedReceiptUrl: string | undefined;
      if (receiptFile) {
        const formData = new FormData();
        formData.append("file", receiptFile);
        formData.append("type", "receipt");
        const uploadResponse = await fetch("/api/auth/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const uploadData = await safeParseJson(uploadResponse);
        if (!uploadResponse.ok || !uploadData.success || !uploadData.url) {
          throw new Error(uploadData.error || "Receipt upload failed");
        }
        uploadedReceiptUrl = uploadData.url;
      }

      const dueDate = new Date();
      dueDate.setDate(5);
      if (dueDate < new Date()) dueDate.setMonth(dueDate.getMonth() + 1);

      const typeLabel =
        paymentType === "advance"
          ? "Advance rent payment"
          : paymentType === "partial"
          ? "Partial payment"
          : paymentType === "outstanding"
          ? "Pay outstanding balance"
          : "Regular rent payment";

      const compiledNotes = paymentNotes
        ? `${typeLabel}: ${paymentNotes}`
        : `${typeLabel}${paymentMethod === "gcash" ? ` via GCash (Ref #${effectiveRefNumber})` : " via Cash"}`;

      // CRITICAL: Rent balance is NOT deducted yet while pending! It will automatically deduct once approved by the owner!
      const currentBalance = paymentType === "regular" ? (rentAmount > 0 ? rentAmount : displayBalance) : displayBalance;

      const created = await addPayment({
        tenantId: user.id,
        tenantName: user.name,
        unitId: tenant?.unitId || "",
        propertyName: tenant?.propertyName || "",
        amountPaid: amountNum,
        amountDue: paymentType === "regular" ? rentAmount : amountNum,
        balance: currentBalance, // Keeps existing balance; owner approval automatically deducts!
        paymentDate: new Date().toISOString().split("T")[0],
        dueDate: dueDate.toISOString().split("T")[0],
        status: "pending", // Pending owner review & approval
        paymentMethod: paymentMethod === "gcash" ? "gcash" : "cash",
        paymentMethodNote: paymentMethod === "gcash" ? `GCash Ref: ${effectiveRefNumber}` : "Cash Payment",
        gcashNumber: paymentMethod === "gcash" ? effectiveRefNumber : undefined,
        stayStart: desiredStart || undefined,
        stayEnd: desiredEnd || undefined,
        notes: compiledNotes,
        receiptUrl: uploadedReceiptUrl,
        createdBy: user.id,
      });

      // Automatic notifications: Forward receipt to Owner & Agent for approval
      try {
        await notifyAdmins({
          title: "New Payment Receipt for Owner Approval",
          message: `Tenant ${user.name} submitted a payment of ₱${amountNum.toLocaleString("en-PH", { minimumFractionDigits: 2 })} via ${paymentMethod === "gcash" ? "GCash" : "Cash"} for ${tenant?.propertyName || "Property"}${tenant?.unitNumber ? ` (Unit ${tenant.unitNumber})` : ""}. Please review and approve to deduct rent.`,
          type: "payment",
          read: false,
        });

        if (tenant?.assignedAgentId) {
          await addNotification({
            userId: tenant.assignedAgentId,
            title: "Tenant Payment Submitted",
            message: `Tenant ${user.name} submitted a payment of ₱${amountNum.toLocaleString("en-PH", { minimumFractionDigits: 2 })} for ${tenant?.propertyName || "Property"}. Forwarded to Owner for approval.`,
            type: "payment",
            read: false,
          });
        }

        await addNotification({
          userId: user.id,
          title: "Payment Receipt Submitted",
          message: `Your payment of ₱${amountNum.toLocaleString("en-PH", { minimumFractionDigits: 2 })} with receipt has been forwarded to the property owner and agent. Rent will be automatically deducted once the owner approves.`,
          type: "payment",
          read: false,
        });
      } catch (notifErr) {
        console.warn("Notification dispatch notice:", notifErr);
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("renttrack-payment-submitted"));
      }

      const receiptToView: Payment = {
        ...created,
        id: created?.id || `pay_${Date.now()}`,
        tenantName: user.name || tenant?.name || created?.tenantName || "Verified Tenant",
        tenantId: user.id,
        propertyName: tenant?.propertyName || created?.propertyName || "Rental Property",
        unitNumber: tenant?.unitNumber || (created as any)?.unitNumber || (tenant?.unitId ? `Unit ${tenant.unitId}` : "Assigned Unit"),
        unitId: tenant?.unitId || created?.unitId || "",
        amountPaid: amountNum,
        amountDue: created?.amountDue ?? (paymentType === "regular" ? rentAmount : amountNum),
        balance: created?.balance ?? currentBalance,
        paymentDate: created?.paymentDate || new Date().toISOString().split("T")[0],
        dueDate: created?.dueDate || dueDate.toISOString().split("T")[0],
        status: "pending",
        paymentMethod: paymentMethod === "gcash" ? "gcash" : "cash",
        paymentMethodNote: paymentMethod === "gcash" ? `GCash Ref: ${effectiveRefNumber}` : "Cash Payment",
        gcashNumber: paymentMethod === "gcash" ? effectiveRefNumber : undefined,
        stayStart: desiredStart || undefined,
        stayEnd: desiredEnd || undefined,
        notes: compiledNotes,
        receiptUrl: uploadedReceiptUrl || created?.receiptUrl || undefined,
        createdBy: user.id,
      };

      setPayments((current) => [receiptToView, ...current.filter((p) => p.id !== receiptToView.id)]);

      // Close submission modal immediately
      setIsPaymentModalOpen(false);

      // Immediately display real official receipt
      setViewingReceipt(receiptToView);

      toast.success("Payment receipt submitted! Forwarded to owner & agent for approval.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit payment");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <ManagementBanner
        financial
        category="FINANCIAL MANAGEMENT"
        title="Financial Transactions"
        description="Track and manage all tenant payments and transactions."
        icon={CreditCard}
      />

      {/* Navigation Tabs Pill Bar (Overview, Rental Contract, Payments) */}
      <div className="flex items-center">
        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "overview"
                ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("contract")}
            className={`px-4 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "contract"
                ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Rental Contract
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("payments")}
            className={`px-4 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "payments"
                ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Payments
          </button>
        </div>
      </div>

      {/* TAB 1: PAYMENTS (Default view) */}
      {activeTab === "payments" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {/* Main Card: Payment Center */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
            {/* Header */}
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <CreditCard className="h-5 w-5 text-blue-600" />
                Payment Center
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Submit a payment and keep track of your rental balance.
              </p>
            </div>

            {/* Two Side-by-Side Cards (Grid) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Card: Outstanding balance */}
              <div className="lg:col-span-8 rounded-2xl border border-slate-200 p-6 bg-white flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-slate-900">
                      Outstanding balance
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsLedgerModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-600 text-xs font-semibold border border-slate-200/80 transition-colors cursor-pointer"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      Payment Ledger
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4 my-5">
                    <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                      ₱{displayBalance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-800">
                        Outstanding balance
                      </span>
                      <span className="text-xs text-slate-500">
                        {displayBalance === 0 ? "₱0.00 — all payments up to date" : "Based on verified rental records"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary Pay Rent Action Button */}
                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => openPaymentModal("regular")}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm sm:text-base shadow-xs hover:shadow transition-all cursor-pointer"
                  >
                    <CreditCard className="h-5 w-5" />
                    <span>Pay Rent / Submit Payment</span>
                  </button>
                </div>
              </div>

              {/* Right Card: Rental Info */}
              <div className="lg:col-span-4 rounded-2xl border border-slate-200 p-6 bg-white flex flex-col justify-between">
                <div>
                  <span className="text-sm sm:text-base font-semibold text-slate-900">Rental Info</span>
                  <p className="text-base sm:text-lg font-bold text-slate-900 mt-3">
                    {tenant?.propertyName
                      ? `${tenant.propertyName}${tenant.unitNumber ? ` - Unit ${tenant.unitNumber}` : ""}`
                      : "Verified Rental Unit"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {tenant?.rentAmount ? `${formatCurrency(tenant.rentAmount)} / month` : "₱0.00 / month"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab("contract")}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-xs transition-colors w-full mt-5 cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-slate-600" />
                  <span>View Rental Contract</span>
                </button>
              </div>
            </div>

            {/* Payment History Section */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-slate-900">Payment History & Receipts</h2>
                <span className="text-xs text-slate-500">
                  {myPayments.length} recorded {myPayments.length === 1 ? "transaction" : "transactions"}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                {/* Table Header Bar */}
                <div className="grid grid-cols-5 bg-slate-50/90 border-b border-slate-200 px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <div>DATE</div>
                  <div>TYPE</div>
                  <div>AMOUNT</div>
                  <div>STATUS</div>
                  <div className="text-right">OFFICIAL RECEIPT</div>
                </div>

                {/* Table Body */}
                {myPayments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <svg
                      className="h-12 w-12 text-slate-300 stroke-[1.5]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <line x1="10" y1="9" x2="8" y2="9" />
                    </svg>
                    <p className="text-sm font-semibold text-slate-700 mt-3">No payments yet</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Your transactions and real official receipts will appear here once submitted
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {myPayments.map((p) => {
                      const typeLabel = p.notes?.includes("Advance")
                        ? "Advance Rent"
                        : p.notes?.includes("Partial")
                        ? "Partial Payment"
                        : p.notes?.includes("Outstanding")
                        ? "Outstanding Balance"
                        : "Regular Rent";

                      const isPaid = (p.status || "").toLowerCase() === "paid";
                      const isPending = (p.status || "").toLowerCase() === "pending";

                      return (
                        <div
                          key={p.id}
                          className="grid grid-cols-5 items-center px-6 py-4 hover:bg-slate-50/60 transition-colors text-sm"
                        >
                          <div className="text-slate-700 font-medium">{formatDate(p.paymentDate || "")}</div>
                          <div className="text-slate-600 capitalize">{typeLabel}</div>
                          <div className="font-semibold text-slate-900">{formatCurrency(p.amountPaid || 0)}</div>
                          <div>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                                isPaid
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : isPending
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}
                            >
                              {p.status || "pending"}
                            </span>
                          </div>
                          <div className="text-right">
                            <button
                              type="button"
                              onClick={() => setViewingReceipt(p)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 transition-colors cursor-pointer"
                              title="View Official Receipt"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>View Receipt</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* TAB 2: OVERVIEW */}
      {activeTab === "overview" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Account Overview</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Quick summary of your tenant profile and activity</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 p-5 bg-slate-50/50">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Unit</span>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  {tenant?.propertyName ? `${tenant.propertyName} · Unit ${tenant.unitNumber || "1"}` : "Unit Assigned"}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Status: {tenant?.status || "Active Tenant"}</p>
              </div>

              <div className="rounded-xl border border-slate-200 p-5 bg-slate-50/50">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Paid</span>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  ₱{tenantPaymentSummary.totalPaid.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{myPayments.filter((p) => p.status === "paid").length} confirmed payments</p>
              </div>

              <div className="rounded-xl border border-slate-200 p-5 bg-slate-50/50">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Outstanding Balance</span>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  ₱{displayBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {displayBalance === 0 ? "₱0.00 — all payments up to date" : "Based on verified rental records"}
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab("payments")}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Go to Payment Center
              </button>
              <Link
                href="/dashboard/tenant"
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
              >
                Go to Main Dashboard
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      {/* TAB 3: RENTAL CONTRACT */}
      {activeTab === "contract" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <FileText className="h-5 w-5 text-slate-700" />
                  Rental Contract Details
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Your lease agreement, term dates, and property details
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("payments")}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                ← Back to Payments
              </button>
            </div>

            {tenant ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: "Property", value: tenant.propertyName || "Not assigned", icon: Building2 },
                  { label: "Unit Number", value: tenant.unitNumber || "Not assigned", icon: Home },
                  { label: "Monthly Rent", value: formatCurrency(tenant.rentAmount || 0), icon: CreditCard },
                  {
                    label: "Contract Start",
                    value: tenant.contractStart ? formatDate(tenant.contractStart) : "Not set",
                    icon: Calendar,
                  },
                  {
                    label: "Contract End",
                    value: tenant.contractEnd ? formatDate(tenant.contractEnd) : "Not set",
                    icon: Calendar,
                  },
                  {
                    label: "Lease Status",
                    value: tenant.contractEnd && new Date(tenant.contractEnd) < new Date() ? "Expired" : "Active",
                    icon: Clock,
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{item.label}</p>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 rounded-xl border border-dashed border-slate-200">
                <Home className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No rental contract assigned yet</p>
                <p className="text-xs text-slate-400 mt-1">Contact your landlord or agent to be assigned to a unit.</p>
              </div>
            )}
          </div>

          <TenantContracts />
        </motion.div>
      )}

      {/* COMPACT PAYMENT SUBMISSION MODAL */}
      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Dark blur backdrop - non-interactive so scrolls and drags don't close modal */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" aria-hidden="true" />

            <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-lg my-auto rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden cursor-default max-h-[92vh] flex flex-col"
              >
                {/* Modal Header */}
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Submit Payment
                      </h3>
                      <p className="text-xs text-slate-500">
                        Submit rent payment for record & receipt
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer z-50 pointer-events-auto"
                    aria-label="Close payment modal"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Form Body - Sleek, Dropdown-based, Scrollable */}
                <form
                  onSubmit={handlePaymentSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.target as HTMLElement)?.tagName === "INPUT") {
                      e.preventDefault();
                    }
                  }}
                  className="p-5 space-y-3.5 overflow-y-auto"
                >
                {/* 1. Payment Type DROPDOWN */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Payment type
                  </label>
                  <div className="relative">
                    <select
                      value={paymentType}
                      onChange={(e) => handleSelectPaymentType(e.target.value as any)}
                      className="w-full h-10 px-3 pr-8 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
                    >
                      <option value="regular">
                        Regular rent payment {rentAmount > 0 ? `(₱${rentAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })})` : "(₱0.00)"}
                      </option>
                      <option value="partial">Partial payment</option>
                      <option value="advance">Advance rent payment</option>
                      <option value="outstanding">
                        Pay outstanding balance (₱{displayBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })})
                      </option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                {/* 2. Amount Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Payment Amount (₱)
                    </label>
                    <span className="text-[11px] text-slate-500">
                      {paymentType === "regular" && `Monthly rent: ${formatCurrency(rentAmount)}`}
                      {paymentType === "partial" && "Enter custom partial amount"}
                      {paymentType === "advance" && "Advance payment for upcoming term"}
                      {paymentType === "outstanding" && `Full outstanding: ${formatCurrency(displayBalance)}`}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                      ₱
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full h-10 pl-7 pr-3 rounded-xl border border-slate-300 text-base font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>

                {/* 3. Payment Method: GCash and Cash */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* GCash */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("gcash")}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                        paymentMethod === "gcash"
                          ? "border-blue-600 bg-blue-50/80 text-blue-900 ring-2 ring-blue-600/20 shadow-xs"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                        G
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-xs sm:text-sm text-slate-900">GCash</span>
                          <span className="text-[9px] bg-blue-100 text-blue-700 font-bold px-1 rounded-full">
                            Rec
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">E-Wallet</p>
                      </div>
                    </button>

                    {/* Cash */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("cash")}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                        paymentMethod === "cash"
                          ? "border-emerald-600 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-600/20 shadow-xs"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                        ₱
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-xs sm:text-sm text-slate-900">Cash</span>
                        <p className="text-[10px] text-slate-500 truncate">Direct cash</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* GCash Details Card & QR Code Display */}
                {paymentMethod === "gcash" && (
                  <div className="space-y-3 p-3.5 rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50/80 to-blue-50/30 shadow-xs">
                    {/* Header info */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-blue-200/80 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-6 px-2 rounded-md bg-blue-600 text-white font-extrabold text-[10px] tracking-wider flex items-center justify-center">
                          GCASH
                        </span>
                        <div>
                          <p className="font-bold text-blue-950 text-xs">Account: RentTrack Mgmt</p>
                          <p className="text-[10px] text-blue-700">Official Merchant E-Wallet</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs text-blue-950 bg-white px-2 py-1 rounded-lg border border-blue-200 shadow-2xs">
                          0917-892-4521
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText("09178924521");
                            setCopiedGcashNumber(true);
                            toast.success("GCash number copied!");
                            setTimeout(() => setCopiedGcashNumber(false), 2000);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          {copiedGcashNumber ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedGcashNumber ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                    </div>

                    {/* QR Code Display Card */}
                    <div className="bg-white rounded-xl border border-blue-200/90 p-3 sm:p-4 shadow-xs">
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        {/* QR Code Image with scan border & hover zoom */}
                        <div className="relative group shrink-0">
                          <div
                            onClick={() => setIsQrExpanded(true)}
                            className="relative w-40 h-40 sm:w-44 sm:h-44 rounded-xl border-2 border-blue-500/30 p-1.5 bg-white shadow-xs cursor-pointer hover:border-blue-600 hover:shadow-md transition-all flex items-center justify-center overflow-hidden"
                            title="Click to view full QR code"
                          >
                            <img
                              src="/images/qr.jpg"
                              alt="RentTrack GCash InstaPay QR Code"
                              className="w-full h-full object-contain rounded-lg"
                            />
                            <div className="absolute inset-0 bg-blue-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl backdrop-blur-2xs">
                              <span className="px-2.5 py-1 rounded-lg bg-white/95 text-blue-950 text-[10px] font-bold shadow-xs flex items-center gap-1">
                                <Maximize2 className="h-3 w-3 text-blue-600" />
                                <span>Enlarge QR</span>
                              </span>
                            </div>
                          </div>
                          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-bold tracking-wider uppercase shadow-xs whitespace-nowrap">
                            InstaPay / QR Ph
                          </span>
                        </div>

                        {/* QR Instructions & Actions */}
                        <div className="flex-1 text-center sm:text-left space-y-2.5 min-w-0 w-full sm:w-auto">
                          <div>
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                              <QrCode className="h-3 w-3" />
                              <span>Scan to Pay</span>
                            </div>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 mt-1">
                              Scan with GCash or any QR Ph app
                            </h4>
                            <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                              Open your GCash app, tap <strong className="text-blue-900">QR</strong>, and scan this code or upload from your gallery.
                            </p>
                          </div>

                          <div className="rounded-lg bg-blue-50/90 border border-blue-200/80 p-2 text-left">
                            <div className="flex items-baseline justify-between text-xs">
                              <span className="text-[11px] text-slate-600 font-medium">Exact Amount:</span>
                              <span className="text-sm font-extrabold text-blue-950">
                                ₱{Number(paymentAmount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-0.5">
                            <a
                              href="/images/qr.jpg"
                              download="RentTrack-GCash-QR.jpg"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold shadow-xs transition-colors cursor-pointer"
                            >
                              <Download className="h-3 w-3" />
                              <span>Save / Download QR</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Step guidance */}
                    <div className="rounded-xl border border-blue-200/70 bg-white/80 p-2.5 text-[11px] space-y-1">
                      <p className="font-bold text-slate-800 text-[11px]">How to complete payment:</p>
                      <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[10px]">
                        <li>Scan or pay via GCash to recipient <strong>RentTrack Mgmt</strong>.</li>
                        <li>Upload your payment screenshot below — <strong>the Reference Number will be automatically read!</strong></li>
                        <li>Review and submit payment to generate your official electronic receipt.</li>
                      </ol>
                    </div>

                    {/* 1. Upload GCash Receipt / Screenshot (Automatic OCR Reading, No Preview Box) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-800 uppercase tracking-wider">
                          Upload GCash Receipt Screenshot
                        </label>
                        {isScanningReceipt && (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-semibold normal-case animate-pulse">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Scanning receipt...
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsScanningReceipt(false)}
                              className="text-[10px] text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
                            >
                              Skip
                            </button>
                          </div>
                        )}
                        {ocrDetected && !isScanningReceipt && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold normal-case bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Auto-read from receipt
                          </span>
                        )}
                      </div>

                      <div className={`relative border-2 border-dashed rounded-xl p-3.5 transition-colors text-center cursor-pointer ${
                        receiptFile
                          ? "border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50/70"
                          : "border-blue-200 hover:border-blue-400 bg-blue-50/40 hover:bg-blue-50/70"
                      }`}>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => handleReceiptUpload(e.target.files?.[0] || null)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="flex flex-col items-center justify-center gap-1 pointer-events-none">
                          {receiptFile ? (
                            <>
                              <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
                                <CheckCircle2 className="h-4 w-4" />
                              </div>
                              <p className="text-xs font-bold text-slate-900 truncate max-w-[280px]">
                                {receiptFile.name}
                              </p>
                              <p className="text-[10px] text-emerald-700 font-medium">
                                ✓ Receipt attached • Click or drop to replace
                              </p>
                            </>
                          ) : (
                            <>
                              <Upload className="h-5 w-5 text-blue-600" />
                              <p className="text-xs font-semibold text-slate-800">
                                Click or drag GCash receipt screenshot here
                              </p>
                              <p className="text-[10px] text-slate-500">
                                PNG or JPG • Reference Number will be automatically scanned
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 2. GCash Reference Number (Auto-read or manual, NO required asterisk) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-slate-800 uppercase tracking-wider">
                          GCash Reference Number
                        </label>
                        {ocrDetected && (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                            <Sparkles className="h-2.5 w-2.5" />
                            Auto-read successfully
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Enter or auto-detect Reference No. (e.g. 1002 9841 8294)"
                          value={gcashRefNumber}
                          onChange={(e) => {
                            setGcashRefNumber(e.target.value);
                            setOcrDetected(false);
                            if (isScanningReceipt) setIsScanningReceipt(false);
                          }}
                          className={`w-full h-10 px-3 pr-9 rounded-lg border text-xs font-mono font-semibold focus:outline-hidden focus:ring-2 transition-colors ${
                            ocrDetected
                              ? "border-emerald-400 bg-emerald-50/50 text-emerald-950 focus:ring-emerald-500"
                              : "border-blue-300 bg-white text-slate-900 focus:ring-blue-500"
                          }`}
                        />
                        {ocrDetected && (
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Upload receipt screenshot above to auto-detect, or type manually if preferred.
                      </p>
                    </div>

                    {/* Approval Notice */}
                    <div className="rounded-xl bg-blue-50/70 border border-blue-200/80 p-2.5 text-[11px] text-blue-950 flex items-start gap-2">
                      <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <p>
                        <strong>Approval Workflow:</strong> Your receipt is automatically routed to the property owner and assigned agent for review. Rent will be automatically deducted from your balance once approved by the owner.
                      </p>
                    </div>
                  </div>
                )}

                {/* Additional Remarks / Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Notes / Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Payment for rent"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs text-slate-700"
                  />
                </div>

                {/* Submit / Cancel Actions */}
                <div className="flex items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="px-5 h-11 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="flex-1 h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isUploading ? (
                      <>
                        <div className="h-4 w-4 shrink-0 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span className="whitespace-nowrap font-medium">Issuing Receipt...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 shrink-0 text-white" />
                        <span className="whitespace-nowrap font-medium">Submit Payment & Issue Receipt</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>

      {/* PAYMENT LEDGER MODAL */}
      <AnimatePresence>
        {isLedgerModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" aria-hidden="true" />
            <div className="min-h-full flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-2xl my-auto rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden cursor-default"
              >
                <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Tenant Payment Ledger</h3>
                    <p className="text-xs text-slate-500">Statement of rent charges, payments, and balance</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLedgerModalOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer z-50 pointer-events-auto"
                    aria-label="Close ledger modal"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase">Monthly Rate</p>
                      <p className="text-base font-bold text-slate-900 mt-1">{formatCurrency(rentAmount)}</p>
                    </div>
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase">Total Paid</p>
                      <p className="text-base font-bold text-emerald-600 mt-1">
                        ₱{tenantPaymentSummary.totalPaid.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase">Outstanding</p>
                      <p className="text-base font-bold text-rose-600 mt-1">
                        ₱{displayBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
                    <div className="grid grid-cols-5 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <div>Date</div>
                      <div>Description</div>
                      <div>Amount</div>
                      <div>Status</div>
                      <div className="text-right">Receipt</div>
                    </div>
                    {myPayments.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">No payment ledger records recorded.</div>
                    ) : (
                      <div className="divide-y divide-slate-100 text-xs">
                        {myPayments.map((p) => (
                          <div key={p.id} className="grid grid-cols-5 px-4 py-3 items-center">
                            <div className="text-slate-700">{formatDate(p.paymentDate || "")}</div>
                            <div className="text-slate-600 truncate">{p.notes || "Rent payment"}</div>
                            <div className="font-semibold text-slate-900">{formatCurrency(p.amountPaid || 0)}</div>
                            <div>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                  p.status === "paid"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {p.status || "pending"}
                              </span>
                            </div>
                            <div className="text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsLedgerModalOpen(false);
                                  setViewingReceipt(p);
                                }}
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                              >
                                <FileText className="h-3 w-3" /> View
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsLedgerModalOpen(false)}
                    className="w-full h-10 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Close Ledger
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ENLARGED QR CODE MODAL */}
      <AnimatePresence>
        {isQrExpanded && (
          <div className="fixed inset-0 z-[70] overflow-y-auto">
            <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" aria-hidden="true" />
            <div className="min-h-full flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative max-w-sm w-full bg-white rounded-2xl shadow-2xl p-6 text-center space-y-4"
              >
                <button
                  type="button"
                  onClick={() => setIsQrExpanded(false)}
                  className="absolute top-3 right-3 h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close QR preview"
                >
                  <X className="h-4 w-4" />
                </button>

                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wider mb-1">
                    Official Merchant QR Ph
                  </span>
                  <h3 className="text-base font-bold text-slate-900">RentTrack GCash Payment</h3>
                  <p className="text-xs text-slate-500">Scan using GCash, Maya, or any QR Ph banking app</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-blue-300 flex justify-center">
                  <img
                    src="/images/qr.jpg"
                    alt="GCash QR Code"
                    className="w-64 h-64 object-contain rounded-xl shadow-xs bg-white p-2"
                  />
                </div>

                <div className="bg-blue-50/80 rounded-xl p-3 border border-blue-200/80 text-xs">
                  <div className="flex justify-between font-semibold text-slate-700">
                    <span>Merchant:</span>
                    <span className="font-bold text-slate-950">RentTrack Mgmt</span>
                  </div>
                  <div className="flex justify-between font-semibold text-slate-700 mt-1">
                    <span>Mobile:</span>
                    <span className="font-mono font-bold text-blue-900">0917-892-4521</span>
                  </div>
                  <div className="flex justify-between font-semibold text-slate-700 mt-1 pt-1 border-t border-blue-200/70">
                    <span>Amount to pay:</span>
                    <span className="font-bold text-blue-950">₱{Number(paymentAmount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <a
                    href="/images/qr.jpg"
                    download="RentTrack-GCash-QR.jpg"
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Image</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setIsQrExpanded(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>



      {/* REAL OFFICIAL RECEIPT MODAL */}
      <ReceiptModal
        isOpen={Boolean(viewingReceipt)}
        onClose={() => setViewingReceipt(null)}
        receiptUrl={viewingReceipt?.receiptUrl || null}
        payment={viewingReceipt || undefined}
      />
    </div>
  );
}
