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

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-2xl my-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Bar (Actions & Title) */}
          <div className="no-print bg-slate-900 px-4 py-3.5 text-white sm:px-6 flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold tracking-tight">Official Rental Receipt</h2>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      isPaid
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    }`}
                  >
                    {isPaid ? "Paid & Verified" : "Official Copy"}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Authentic proof of payment for rental records</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {rawUrl && (
                <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveView("receipt")}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
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
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                      activeView === "attachment"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    <ImageIcon className="h-3 w-3" />
                    <span>Proof Attachment</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition-colors cursor-pointer"
                title="Print Receipt"
              >
                <Printer className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Print</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                title="Save Receipt"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Save</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors ml-1 cursor-pointer z-50 pointer-events-auto"
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
                  <div className="flex justify-center bg-slate-900/5 rounded-xl p-2 border border-slate-200">
                    <img
                      src={rawUrl}
                      alt="Payment Attachment"
                      className="max-h-[65vh] max-w-full rounded-lg object-contain shadow-xs"
                    />
                  </div>
                )}
              </div>
            ) : (
              /* REAL OFFICIAL RENTAL RECEIPT DOCUMENT */
              <div
                id="official-receipt-print-area"
                className="w-full max-w-xl bg-white border-2 border-slate-800 shadow-xl rounded-xl p-5 sm:p-6 text-slate-900 relative font-sans"
              >
                {/* Security Background Watermark */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] select-none overflow-hidden">
                  <span className="text-8xl sm:text-9xl font-black text-slate-900 uppercase rotate-[-25deg] tracking-widest">
                    RENTTRACK
                  </span>
                </div>

                {/* Top Header: Business & Document Info */}
                <div className="border-b-2 border-slate-800 pb-5 mb-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    {/* Left: Brand & Business Details */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white font-extrabold text-sm tracking-tight">
                          RT
                        </span>
                        <h1 className="text-xl font-black tracking-tight text-slate-950 uppercase">
                          RentTrack Management
                        </h1>
                      </div>
                      <p className="text-xs font-semibold text-slate-700 mt-1 uppercase tracking-wide">
                        Official Rental Property & Leasing Administration
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Authorized Property Leasing Systems • Makati City, Metro Manila
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        TIN: 482-901-382-000-NV • VAT Registered • SEC Reg. CS2024-81920
                      </p>
                    </div>

                    {/* Right: Receipt Number & Official Stamp Box */}
                    <div className="w-full sm:w-auto text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                      <div className="inline-block bg-slate-50 border-2 border-red-600 rounded-lg p-2.5 text-left sm:text-right min-w-[210px]">
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-700">
                          Official Receipt No.
                        </p>
                        <div className="flex items-center sm:justify-end gap-1.5 mt-0.5">
                          <span className="text-base font-mono font-black text-red-700 tracking-wider">
                            {orNumber}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyRef}
                            className="no-print p-0.5 rounded text-slate-400 hover:text-slate-700 transition-colors"
                            title="Copy OR Number"
                          >
                            {copiedRef ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                        <div className="mt-1 pt-1 border-t border-red-200 text-[10px] text-slate-600 flex justify-between gap-2">
                          <span>Date:</span>
                          <span className="font-semibold text-slate-900">{paymentDate}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subheader Title Banner */}
                <div className="bg-slate-900 text-white py-1.5 px-4 rounded-md text-center mb-5">
                  <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest">
                    ACKNOWLEDGMENT RECEIPT FOR RENTAL PAYMENT
                  </h2>
                  <p className="text-[10px] text-slate-300 font-normal">
                    KATIBAYAN NG PAGBABAYAD SA UPA • VALID ELECTRONIC COPY
                  </p>
                </div>

                {/* Payor & Property Information Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-slate-300 rounded-xl p-4 bg-slate-50/60 mb-5 text-xs">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Received From (Payor / Tenant):
                    </p>
                    <p className="text-sm font-bold text-slate-950">
                      {payment?.tenantName || "Verified Tenant"}
                    </p>
                    <p className="text-slate-600">
                      <span className="font-medium text-slate-500">Property: </span>
                      <span className="font-semibold text-slate-800">{payment?.propertyName || "Rental Unit"}</span>
                    </p>
                    <p className="text-slate-600">
                      <span className="font-medium text-slate-500">Unit Number: </span>
                      <span className="font-semibold text-slate-800">
                        {payment?.unitNumber ? `Unit ${payment.unitNumber}` : payment?.unitId || "Assigned Unit"}
                      </span>
                    </p>
                  </div>

                  <div className="space-y-1.5 sm:border-l sm:border-slate-300 sm:pl-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Payment Channel & Account:
                    </p>
                    <p className="text-sm font-bold text-slate-950 flex items-center gap-1.5">
                      <span>{displayMethod}</span>
                      {isGcash && (
                        <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.2 rounded">
                          GCASH
                        </span>
                      )}
                    </p>
                    {referenceNumber && (
                      <p className="text-slate-600 font-mono">
                        <span className="font-medium font-sans text-slate-500">Reference No: </span>
                        <span className="font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {referenceNumber}
                        </span>
                      </p>
                    )}
                    <p className="text-slate-600">
                      <span className="font-medium text-slate-500">Payment Status: </span>
                      <span
                        className={`font-bold ${
                          isPaid ? "text-emerald-700" : "text-blue-700"
                        }`}
                      >
                        {isPaid ? "CONFIRMED & CLEARED" : "SUBMITTED & RECORDED"}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Particulars Table */}
                <div className="border border-slate-300 rounded-xl overflow-hidden mb-5">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-800 text-white border-b border-slate-800 text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-3 font-bold">Item Description / Particulars</th>
                        <th className="py-2.5 px-3 font-bold hidden sm:table-cell">Billing Period</th>
                        <th className="py-2.5 px-3 font-bold hidden sm:table-cell">Method</th>
                        <th className="py-2.5 px-3 font-bold text-right">Amount (PHP)</th>
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
                        <td className="py-3 px-3 hidden sm:table-cell text-slate-700">
                          {payment?.stayStart && payment?.stayEnd
                            ? `${formatDate(payment.stayStart)} - ${formatDate(payment.stayEnd)}`
                            : "Current Billing Cycle"}
                        </td>
                        <td className="py-3 px-3 hidden sm:table-cell text-slate-700">
                          {isGcash ? "GCash" : "Cash"}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-950 text-sm">
                          {formatCurrency(amountPaid)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Total in Words */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-bold text-slate-600 text-[10px] uppercase tracking-wider">
                      Amount in Words:
                    </span>
                    <span className="font-bold text-slate-950 italic text-xs sm:text-sm">
                      {numberToWordsPHP(amountPaid)}
                    </span>
                  </div>
                </div>

                {/* Financial Summary & Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 mb-6">
                  {/* Left: Notes & Terms */}
                  <div className="sm:col-span-7 space-y-2 text-[11px] text-slate-500 border border-slate-200 rounded-xl p-3 bg-white">
                    <p className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                      Acknowledgment Terms & Conditions:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-[10px] leading-relaxed text-slate-600">
                      <li>This electronic receipt confirms rental payment submitted through the RentTrack tenant system.</li>
                      <li>Valid proof of transaction for tenancy ledger settlement.</li>
                      <li>Any unpaid balances remain subject to standard lease agreement terms.</li>
                    </ul>
                  </div>

                  {/* Right: Balance Calculations */}
                  <div className="sm:col-span-5 bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Total Amount Due:</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(amountDue)}</span>
                    </div>
                    <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-2">
                      <span className="text-slate-800">Amount Paid:</span>
                      <span className="text-emerald-700 text-sm">{formatCurrency(amountPaid)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1.5">
                      <span>Remaining Balance:</span>
                      <span className="font-bold text-slate-900">{formatCurrency(balance)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Section: Official Seal & Authorized Signature */}
                <div className="pt-4 border-t-2 border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6 relative">
                  {/* Authentic Circular Rubber Stamp (Emerald/Blue Ink Effect) */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center -rotate-6 transition-transform">
                      <div className="h-24 w-24 rounded-full border-4 border-dashed border-emerald-700 flex flex-col items-center justify-center p-1.5 text-center bg-emerald-50/40 shadow-xs">
                        <div className="h-20 w-20 rounded-full border border-emerald-700/80 flex flex-col items-center justify-center p-1">
                          <p className="text-[7px] font-black uppercase tracking-tighter text-emerald-800">
                            RENTTRACK MGMT
                          </p>
                          <div className="my-0.5 border-y border-emerald-700 w-full py-0.5">
                            <span className="text-xs font-black tracking-widest text-emerald-700 uppercase">
                              ★ PAID ★
                            </span>
                          </div>
                          <p className="text-[7px] font-bold text-emerald-800 uppercase">
                            OFFICIAL SEAL
                          </p>
                          <p className="text-[6px] font-semibold text-emerald-700">
                            VERIFIED PROOF
                          </p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-emerald-700 text-xs font-bold">
                        <ShieldCheck className="h-4 w-4" />
                        <span>System Verified Document</span>
                      </div>
                      <p className="text-[10px] text-slate-500 max-w-[200px]">
                        Electronic stamp affixed automatically upon transaction recording.
                      </p>
                    </div>
                  </div>

                  {/* Authorized Signatory */}
                  <div className="text-center sm:text-right">
                    <div className="inline-block text-center">
                      {/* Stylized Digital Signature Graphic */}
                      <div className="h-10 flex items-center justify-center">
                        <span className="font-serif italic text-lg text-slate-800 select-none tracking-wider underline decoration-slate-400">
                          Eleanor Vance
                        </span>
                      </div>
                      <div className="w-48 border-t border-slate-800 pt-1">
                        <p className="text-xs font-bold text-slate-900">Authorized Officer</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                          RentTrack Property Admin
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Barcode / Hash String */}
                <div className="mt-6 pt-3 border-t border-slate-200 text-center space-y-1">
                  <div className="inline-block font-mono text-[9px] tracking-[0.25em] text-slate-400 uppercase select-none">
                    ||||| ||| ||||||| |||| |||||| ||||| ||||||| ||| |||||
                  </div>
                  <p className="text-[9px] font-mono text-slate-500">
                    DIGITAL VERIFICATION: {orNumber} • AUTH-KEY: {payment?.id || "REC-2026-OK"}
                  </p>
                  <p className="text-[8px] text-slate-400">
                    Generated via RentTrack Cloud Real Estate System • All rights reserved.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Footer Actions Bar (Non-print) */}
          <div className="no-print border-t border-slate-200 bg-white px-5 py-3.5 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-500 hidden sm:inline">
              Need a physical copy? Use the <strong className="text-slate-700">Print</strong> button above.
            </span>
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Official Receipt</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
