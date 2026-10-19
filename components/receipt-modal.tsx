"use client";

import React, { useState } from "react";
import { Download, Printer, X, CheckCircle, FileText, Image as ImageIcon, ShieldCheck, Copy, Check } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptUrl?: string | null;
  payment?: {
    id?: string;
    tenantName?: string;
    tenantId?: string;
    propertyName?: string;
    unitId?: string;
    unitNumber?: string;
    amountPaid?: number;
    amountDue?: number;
    balance?: number;
    paymentDate?: string;
    dueDate?: string;
    status?: string;
    paymentMethod?: string;
    paymentMethodNote?: string;
    gcashNumber?: string;
    notes?: string;
    receiptUrl?: string;
    stayStart?: string;
    stayEnd?: string;
    createdAt?: string;
  };
}

function numberToWordsPHP(num: number): string {
  if (!num || isNaN(num) || num <= 0) return "Zero Pesos Only";

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertGroup(n: number): string {
    let str = "";
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
    } else if (n > 0) {
      str += ones[n];
    }
    return str.trim();
  }

  const intPart = Math.floor(num);
  const cents = Math.round((num - intPart) * 100);

  let result = "";
  if (intPart >= 1000000) {
    const millions = Math.floor(intPart / 1000000);
    result += convertGroup(millions) + " Million ";
  }
  if ((intPart % 1000000) >= 1000) {
    const thousands = Math.floor((intPart % 1000000) / 1000);
    result += convertGroup(thousands) + " Thousand ";
  }
  const remainder = intPart % 1000;
  if (remainder > 0) {
    result += convertGroup(remainder) + " ";
  }
  result = result.trim() + " Pesos";
  if (cents > 0) {
    result += " and " + convertGroup(cents) + " Cents";
  }
  return result + " Only";
}

export default function ReceiptModal({ isOpen, onClose, receiptUrl, payment }: ReceiptModalProps) {
  const [activeView, setActiveView] = useState<"receipt" | "attachment">("receipt");
  const [copiedRef, setCopiedRef] = useState(false);

  if (!isOpen) return null;
  if (!payment && !receiptUrl) return null;

  const rawUrl = receiptUrl || payment?.receiptUrl || null;
  const isPdf = Boolean(rawUrl && rawUrl.toLowerCase().endsWith(".pdf"));

  const amountPaid = Number(payment?.amountPaid || 0);
  const amountDue = Number(payment?.amountDue || amountPaid || 0);
  const balance = Number(payment?.balance ?? Math.max(0, amountDue - amountPaid));

  const isPaid = (payment?.status || "").toLowerCase() === "paid";
  const isPending = (payment?.status || "").toLowerCase() === "pending";
  const orNumber = payment?.id
    ? `RT-OR-${payment.id.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase()}`
    : `RT-OR-${Date.now().toString().slice(-8)}`;

  const paymentDate = payment?.paymentDate
    ? new Date(payment.paymentDate).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date().toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

  const methodRaw = (payment?.paymentMethod || "").toLowerCase();
  const isGcash =
    methodRaw === "gcash" ||
    Boolean(payment?.gcashNumber) ||
    Boolean(payment?.notes?.toLowerCase().includes("gcash")) ||
    Boolean(payment?.paymentMethodNote?.toLowerCase().includes("gcash"));

  const displayMethod = isGcash ? "GCash E-Wallet" : "Cash (Over-the-Counter)";

  // Extract reference number if present in notes or note
  const refMatch =
    payment?.notes?.match(/(?:ref(?:erence)?\s*(?:#|no\.?)?:?\s*)([A-Za-z0-9]+)/i) ||
    payment?.paymentMethodNote?.match(/(?:ref(?:erence)?\s*(?:#|no\.?)?:?\s*)([A-Za-z0-9]+)/i);
  const referenceNumber = refMatch ? refMatch[1] : payment?.gcashNumber || null;

  // Resolve payment type description
  const notesLower = (payment?.notes || "").toLowerCase();
  let paymentTypeDescription = "Regular Monthly Rent Payment";
  if (notesLower.includes("advance")) {
    paymentTypeDescription = "Advance Rent Payment";
  } else if (notesLower.includes("partial")) {
    paymentTypeDescription = "Partial Rental Payment";
  } else if (notesLower.includes("outstanding")) {
    paymentTypeDescription = "Outstanding Balance Settlement";
  }

  const handlePrint = () => {
    window.print();
  };

  const handleSave = () => {
    if (rawUrl && activeView === "attachment") {
      const downloadLink = document.createElement("a");
      downloadLink.href = rawUrl;
      downloadLink.download = `${orNumber}-proof.jpg`;
      downloadLink.rel = "noopener";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
    } else {
      window.print();
    }
  };

  const handleCopyRef = () => {
    if (!orNumber) return;
    navigator.clipboard.writeText(orNumber);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  return (
    <>
      {/* Print Specific CSS */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #official-receipt-print-area,
          #official-receipt-print-area * {
            visibility: visible !important;
          }
          #official-receipt-print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: 2px solid #334155 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="fixed inset-0 z-[80] overflow-y-auto">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" aria-hidden="true" />
        <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
          <div
            className="relative w-full max-w-2xl my-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh]"
          >
          {/* Top Bar (Title, View Switcher & Close) */}
          <div className="no-print bg-slate-900 px-4 py-3.5 text-white sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 shrink-0">
            {/* Left: Title, Status Pill & Meta */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">Official Rental Receipt</h2>
                <span
                  className={`text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                    isPaid
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : isPending
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  }`}
                >
                  {isPaid ? "Paid & Verified" : isPending ? "Pending Owner Approval" : "Official Copy"}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                Receipt #{orNumber} • Issued: {paymentDate}
              </p>
            </div>

            {/* Right: View Switcher (if proof exists) & Close Button */}
            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
              {rawUrl && (
                <div className="inline-flex rounded-xl bg-slate-800/90 p-1 border border-slate-700/80 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveView("receipt")}
                    className={`px-3 py-1.5 rounded-lg font-semibold text-center transition-all text-xs cursor-pointer ${
                      activeView === "receipt"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    Official Document
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView("attachment")}
                    className={`px-3 py-1.5 rounded-lg font-semibold text-center transition-all text-xs cursor-pointer ${
                      activeView === "attachment"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    Proof Attachment
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="h-8.5 w-8.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                aria-label="Close receipt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Modal Scrollable Body */}
          <div className="overflow-y-auto p-3 sm:p-5 bg-slate-100 flex justify-center">
            {activeView === "attachment" && rawUrl ? (
              <div className="w-full max-w-xl bg-white rounded-2xl p-4 border border-slate-200 shadow-sm text-center">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Attached Payment Screenshot / Proof
                  </span>
                  <a
                    href={rawUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Open Original in New Tab ↗
                  </a>
                </div>
                {isPdf ? (
                  <iframe src={rawUrl} title="Payment Attachment" className="h-[65vh] w-full rounded-xl border border-slate-200" />
                ) : (
                  <div className="flex justify-center bg-slate-900/5 rounded-xl p-3 border border-slate-200 max-h-[62vh] overflow-y-auto">
                    <img
                      src={rawUrl}
                      alt="Payment Attachment"
                      className="max-h-full w-auto max-w-full rounded-lg object-contain shadow-sm"
                    />
                  </div>
                )}
              </div>
            ) : (
              /* AUTHENTIC PHILIPPINE OFFICIAL RENTAL RECEIPT DOCUMENT */
              <div
                id="official-receipt-print-area"
                className="w-full max-w-xl bg-white border-4 border-double border-slate-900 shadow-2xl rounded-2xl p-6 sm:p-7 text-slate-900 relative font-sans print:border-2 print:border-slate-800"
              >
                {/* Pending Owner Approval Alert Banner (Hidden when printed) */}
                {isPending && (
                  <div className="no-print bg-amber-50 border-2 border-amber-300 rounded-xl p-3 mb-5 text-xs text-amber-950 flex items-start gap-2.5 shadow-xs">
                    <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-900 uppercase tracking-wide text-[11px]">
                        Payment Submitted • Awaiting Owner Approval
                      </p>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        Your payment receipt has been submitted and forwarded to the property owner and agent. Your rental balance will be automatically deducted upon owner approval.
                      </p>
                    </div>
                  </div>
                )}

                {/* Subtle Security Background Watermark */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.025] select-none overflow-hidden">
                  <span className="text-8xl sm:text-9xl font-black text-slate-900 uppercase rotate-[-25deg] tracking-widest">
                    OFFICIAL
                  </span>
                </div>

                {/* Top Header: Business & Document Info */}
                <div className="border-b-2 border-slate-900 pb-4 mb-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    {/* Brand & Business Details */}
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white font-extrabold text-sm tracking-tight shadow-xs">
                          RT
                        </span>
                        <div>
                          <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-950 uppercase leading-none">
                            RentTrack Management
                          </h1>
                          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mt-0.5">
                            Real Estate & Tenancy Leasing Administration
                          </p>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1.5 leading-tight">
                        Authorized Property Leasing & Tenancy Records • Metro Manila, Philippines
                      </p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                        TIN: 482-901-382-000-NV • DHSUD Reg. No. NCR-B-2024-8192
                      </p>
                    </div>

                    {/* Official Receipt Number & Date Box */}
                    <div className="w-full sm:w-auto text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                      <div className="inline-block bg-slate-50 border-2 border-rose-600 rounded-xl p-2.5 text-left sm:text-right min-w-[210px] shadow-2xs">
                        <div className="flex items-center justify-between sm:justify-end gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-rose-700">
                            Official Receipt No.
                          </span>
                          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full ${
                            isPaid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                          }`}>
                            {isPaid ? "PAID" : "PENDING"}
                          </span>
                        </div>
                        <div className="flex items-center sm:justify-end gap-1.5 mt-0.5">
                          <span className="text-base font-mono font-black text-rose-700 tracking-wider">
                            {orNumber}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyRef}
                            className="no-print p-0.5 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            title="Copy OR Number"
                          >
                            {copiedRef ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                        <div className="mt-1 pt-1 border-t border-rose-200 text-[10px] text-slate-600 flex justify-between gap-2">
                          <span className="font-medium text-slate-500">Date Issued:</span>
                          <span className="font-bold text-slate-900">{paymentDate}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subheader Title Banner */}
                <div className="bg-slate-900 text-white py-2 px-4 rounded-lg text-center mb-4 shadow-xs">
                  <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest">
                    ACKNOWLEDGMENT RECEIPT FOR RENTAL PAYMENT
                  </h2>
                  <p className="text-[10px] text-slate-300 font-medium tracking-wide mt-0.5">
                    KATIBAYAN NG PAGBABAYAD SA UPA • OFFICIAL ELECTRONIC RECEIPT
                  </p>
                </div>

                {/* Payor & Property Information Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-slate-300 rounded-xl p-3.5 bg-slate-50/70 mb-4 text-xs">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Received From (Payor / Tenant):
                    </p>
                    <p className="text-sm font-extrabold text-slate-950">
                      {payment?.tenantName || "Verified Tenant"}
                    </p>
                    <p className="text-slate-600">
                      <span className="font-medium text-slate-500">Rental Property: </span>
                      <span className="font-bold text-slate-800">{payment?.propertyName || "Assigned Property"}</span>
                    </p>
                    <p className="text-slate-600">
                      <span className="font-medium text-slate-500">Unit Number: </span>
                      <span className="font-bold text-slate-800">
                        {payment?.unitNumber ? `Unit ${payment.unitNumber}` : payment?.unitId || "Assigned Unit"}
                      </span>
                    </p>
                  </div>

                  <div className="space-y-1.5 sm:border-l sm:border-slate-300 sm:pl-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Payment Details:
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900">{displayMethod}</span>
                      {isGcash && (
                        <span className="bg-blue-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-2xs">
                          GCASH
                        </span>
                      )}
                    </div>
                    {referenceNumber && (
                      <p className="text-slate-600 font-mono text-[11px]">
                        <span className="font-medium font-sans text-slate-500">Reference No: </span>
                        <span className="font-bold text-blue-950 bg-white px-1.5 py-0.5 rounded border border-blue-200">
                          {referenceNumber}
                        </span>
                      </p>
                    )}
                    <p className="text-slate-600">
                      <span className="font-medium text-slate-500">Transaction Status: </span>
                      <span
                        className={`font-extrabold uppercase text-[11px] ${
                          isPaid ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {isPaid ? "Confirmed & Cleared" : "Pending Owner Approval"}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Particulars Table */}
                <div className="border border-slate-300 rounded-xl overflow-hidden mb-4 shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white border-b border-slate-900 text-[10px] uppercase tracking-wider">
                        <th className="py-2.5 px-3 font-extrabold">Item Description / Particulars</th>
                        <th className="py-2.5 px-3 font-extrabold hidden sm:table-cell">Billing Period</th>
                        <th className="py-2.5 px-3 font-extrabold hidden sm:table-cell">Payment Mode</th>
                        <th className="py-2.5 px-3 font-extrabold text-right">Amount (PHP)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      <tr>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900 text-xs sm:text-sm">
                            {paymentTypeDescription}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {payment?.notes || `Rental payment for ${payment?.propertyName || "rental property"}`}
                          </p>
                        </td>
                        <td className="py-3 px-3 hidden sm:table-cell text-slate-700 font-medium">
                          {payment?.stayStart && payment?.stayEnd
                            ? `${formatDate(payment.stayStart)} - ${formatDate(payment.stayEnd)}`
                            : "Current Tenancy Cycle"}
                        </td>
                        <td className="py-3 px-3 hidden sm:table-cell text-slate-700 font-medium">
                          {isGcash ? "GCash E-Wallet" : "Cash"}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-slate-950 text-sm font-mono">
                          {formatCurrency(amountPaid)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Amount in Words */}
                <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 mb-4 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">
                      Amount in Words:
                    </span>
                    <span className="font-extrabold text-slate-950 italic text-xs sm:text-sm uppercase">
                      *** {numberToWordsPHP(amountPaid)} ***
                    </span>
                  </div>
                </div>

                {/* Financial Summary & Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 mb-5">
                  {/* Left: Notes & Terms */}
                  <div className="sm:col-span-7 space-y-1.5 text-[11px] text-slate-600 border border-slate-200 rounded-xl p-3 bg-white">
                    <p className="font-bold text-slate-800 uppercase tracking-wide text-[10px]">
                      Acknowledgment Terms:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-[10px] leading-relaxed text-slate-600">
                      <li>Official acknowledgment of rental payment submitted via the RentTrack tenant system.</li>
                      <li>Valid record for tenancy ledger settlement and rental verification.</li>
                      <li>Unpaid balances remain subject to standard lease agreement terms.</li>
                    </ul>
                  </div>

                  {/* Right: Balance Calculations */}
                  <div className="sm:col-span-5 bg-slate-50 rounded-xl border border-slate-300 p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600 text-[11px]">
                      <span>Monthly Rent Due:</span>
                      <span className="font-bold text-slate-900 font-mono">{formatCurrency(amountDue)}</span>
                    </div>
                    <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1.5">
                      <span className="text-slate-800">Amount Paid:</span>
                      <span className="text-emerald-700 text-sm font-mono">{formatCurrency(amountPaid)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1.5 text-[11px]">
                      <span>Remaining Balance:</span>
                      <span className="font-bold text-slate-900 font-mono">{formatCurrency(balance)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Section: Official Seal & Authorized Signature */}
                <div className="pt-4 border-t-2 border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-6 relative">
                  {/* Official Circular Rubber Stamp */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center -rotate-6 transition-transform">
                      <div className={`h-24 w-24 rounded-full border-4 border-dashed flex flex-col items-center justify-center p-1 text-center shadow-xs ${
                        isPaid ? "border-emerald-700 bg-emerald-50/50" : "border-amber-700 bg-amber-50/50"
                      }`}>
                        <div className={`h-20 w-20 rounded-full border flex flex-col items-center justify-center p-1 ${
                          isPaid ? "border-emerald-700" : "border-amber-700"
                        }`}>
                          <p className={`text-[6px] font-black uppercase tracking-tighter ${isPaid ? "text-emerald-800" : "text-amber-800"}`}>
                            RENTTRACK MGMT
                          </p>
                          <div className={`my-0.5 border-y w-full py-0.5 ${isPaid ? "border-emerald-700" : "border-amber-700"}`}>
                            <span className={`text-[11px] font-black tracking-widest uppercase ${isPaid ? "text-emerald-700" : "text-amber-700"}`}>
                              {isPaid ? "★ PAID ★" : "★ PENDING ★"}
                            </span>
                          </div>
                          <p className={`text-[6px] font-bold uppercase ${isPaid ? "text-emerald-800" : "text-amber-800"}`}>
                            OFFICIAL SEAL
                          </p>
                          <p className={`text-[5px] font-semibold ${isPaid ? "text-emerald-700" : "text-amber-700"}`}>
                            {isPaid ? "VERIFIED DOCUMENT" : "PENDING APPROVAL"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className={`flex items-center gap-1 text-xs font-bold ${isPaid ? "text-emerald-700" : "text-amber-700"}`}>
                        <ShieldCheck className="h-4 w-4" />
                        <span>{isPaid ? "Verified Official Receipt" : "Awaiting Owner Approval"}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 max-w-[200px] mt-0.5 leading-snug">
                        {isPaid
                          ? "Official electronic document verified with landlord approval."
                          : "Submitted for approval. Rent will be automatically deducted once confirmed."}
                      </p>
                    </div>
                  </div>

                  {/* Authorized Signatory (Clean, Real Official Signatory) */}
                  <div className="text-center sm:text-right">
                    <div className="inline-block text-center">
                      {/* Stylized Digital Signature Graphic */}
                      <div className="h-10 flex flex-col items-center justify-center">
                        <span className="font-serif italic font-bold text-base text-slate-900 select-none tracking-wider underline decoration-slate-400">
                          RentTrack Property Admin
                        </span>
                        <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">
                          ✓ DIGITALLY CERTIFIED & RECORDED
                        </span>
                      </div>
                      <div className="w-52 border-t-2 border-slate-900 pt-1">
                        <p className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          Authorized Representative
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          Property Management & Leasing Office
                        </p>
                        <p className="text-[9px] text-slate-400">
                          RentTrack Real Estate Administration
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Barcode / Hash String */}
                <div className="mt-5 pt-3 border-t border-slate-200 text-center space-y-1">
                  <div className="inline-block font-mono text-[9px] tracking-[0.25em] text-slate-400 uppercase select-none">
                    ||||| ||| ||||||| |||| |||||| ||||| ||||||| ||| |||||
                  </div>
                  <p className="text-[9px] font-mono text-slate-500">
                    DIGITAL VERIFICATION: {orNumber} • AUTH-KEY: {payment?.id || "RT-REC-VERIFIED"}
                  </p>
                  <p className="text-[8px] text-slate-400 leading-tight">
                    Issued pursuant to the Electronic Commerce Act of 2000 (R.A. 8792) • RentTrack Cloud Real Estate Systems • All rights reserved.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Footer Actions Bar (Non-print) */}
          <div className="no-print border-t border-slate-200 bg-white px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <span className="text-[11px] text-slate-500 font-medium text-center sm:text-left">
              Official Electronic Receipt • R.A. 8792 • RentTrack Property Systems
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Save PDF</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
  );
}
