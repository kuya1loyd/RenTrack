"use client";

import React, { useState } from "react";
import { Download, Printer, X } from "lucide-react";
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
    verifiedBy?: string;
    landlordName?: string;
    paidTo?: "agent" | "owner" | string;
    recipientType?: "agent" | "owner" | string;
    recipientName?: string;
    agentName?: string;
    agentId?: string;
    ownerName?: string;
    receivedBy?: string;
  };
}

function ThermalBarcode({ code }: { code: string }) {
  const pattern = [
    2, 1, 1, 2, 3, 1, 2, 2, 1, 3, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1,
    3, 2, 1, 2, 2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 3, 2, 1, 2, 1, 3,
    2, 1, 1, 3, 2, 1, 3, 1, 2, 2, 1, 3, 1, 2, 2, 1, 3, 2, 1, 1,
    2, 1, 3, 1, 2, 2, 1, 1, 3, 2
  ];
  let curX = 0;
  const rects: { x: number; width: number }[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const w = pattern[i];
    if (i % 2 === 0) {
      rects.push({ x: curX, width: w });
    }
    curX += w;
  }

  return (
    <div className="flex flex-col items-center justify-center pt-2">
      <svg
        className="w-48 sm:w-56 h-12"
        viewBox={`0 0 ${curX} 40`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {rects.map((r, idx) => (
          <rect key={idx} x={r.x} y={0} width={r.width} height={40} fill="#000000" />
        ))}
      </svg>
      <span className="font-mono text-[10px] tracking-widest text-slate-700 mt-1 uppercase">
        {code}
      </span>
    </div>
  );
}

export default function ReceiptModal({ isOpen, onClose, receiptUrl, payment }: ReceiptModalProps) {
  const [activeView, setActiveView] = useState<"receipt" | "attachment">("receipt");

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
    : "RT-OR-OFFICIAL";

  const paymentDate = payment?.paymentDate
    ? new Date(payment.paymentDate).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : payment?.createdAt
    ? new Date(payment.createdAt).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";

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

  // Check whether payment was sent to Agent or Owner
  const rawRecipient = String(payment?.recipientType || payment?.paidTo || "").toLowerCase();
  const explicitAgentName = payment?.agentName || null;
  const notesAgentMatch = (payment?.notes || "").match(/(?:paid to agent|via agent|recipient agent|agent:)\s*([a-zA-Z\s.-]+?)(?:via|\(|$|,|·|-|\[|\])/i);
  const parsedAgentName = explicitAgentName || (notesAgentMatch ? notesAgentMatch[1].trim() : null);

  const isSentToAgent =
    rawRecipient === "agent" ||
    Boolean(parsedAgentName) ||
    notesLower.includes("to agent") ||
    notesLower.includes("via agent") ||
    Boolean(payment?.verifiedBy?.toLowerCase().includes("agent"));

  const receiverDisplayName = isSentToAgent
    ? (parsedAgentName
        ? `Agent ${parsedAgentName.replace(/^agent\s+/i, "")}`
        : payment?.receivedBy?.toLowerCase().includes("agent")
          ? payment.receivedBy
          : "Agent (Assigned Property Agent)")
    : (payment?.ownerName
        ? `Owner ${payment.ownerName.replace(/^owner\s+/i, "")}`
        : payment?.receivedBy || (payment?.propertyName ? `${payment.propertyName} Owner` : "Property Owner"));

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
            left: 50% !important;
            transform: translateX(-50%) !important;
            top: 0 !important;
            width: 320px !important;
            max-width: 320px !important;
            margin: 0 !important;
            padding: 16px !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
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
              /* THERMAL PAPER POS RECEIPT (SUPERMARKET STYLE SLIP) */
              <div
                id="official-receipt-print-area"
                className="w-full max-w-[340px] sm:max-w-[360px] bg-white border border-slate-200/90 shadow-xl rounded-md p-6 sm:p-7 text-slate-900 font-sans print:shadow-none print:border-none print:w-[300px] print:p-0 my-2"
                style={{
                  fontFamily:
                    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                }}
              >
                {/* Pending Notice for Tenant/Owner */}
                {isPending && (
                  <div className="no-print bg-amber-50 border border-amber-300 rounded p-2 mb-4 text-[11px] text-amber-900 text-center">
                    <p className="font-bold uppercase tracking-wider">Awaiting Owner Approval</p>
                    <p className="text-[10px] text-amber-800 mt-0.5">Rent ledger will adjust automatically once confirmed.</p>
                  </div>
                )}

                {/* Top Store Header */}
                <div className="text-center space-y-0.5">
                  <h3 className="text-lg font-black tracking-widest uppercase text-slate-950">
                    RENTTRACK
                  </h3>
                  <p className="text-[11px] text-slate-700 font-medium leading-tight">
                    {payment?.propertyName || "Property Management & Rentals"}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Metro Manila, Philippines
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Tel.: +63 920 123 4567
                  </p>
                </div>

                {/* Dotted Divider 1 */}
                <div className="border-b-2 border-dotted border-slate-900 my-3.5" />

                {/* Cashier / Tenant / Unit Meta block */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-600">Tenant (Sender):</span>
                    <span className="font-semibold text-slate-900 truncate max-w-[185px] text-right">
                      {payment?.tenantName || "Tenant"}
                    </span>
                  </div>
                  {payment?.propertyName && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-600">Property:</span>
                      <span className="font-semibold text-slate-900 truncate max-w-[185px] text-right">
                        {payment.propertyName}
                      </span>
                    </div>
                  )}
                  {payment?.unitNumber && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-600">Unit:</span>
                      <span className="font-semibold text-slate-900">Unit {payment.unitNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-600">Payment Sent To:</span>
                    <span className="font-semibold text-slate-900">
                      {isSentToAgent ? "Property Agent" : "Property Owner"}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-600">
                      {isSentToAgent ? "Received By (Agent):" : "Received By (Owner):"}
                    </span>
                    <span className="font-bold text-slate-950 truncate max-w-[185px] text-right">
                      {receiverDisplayName}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-600">Date:</span>
                    <span className="font-semibold text-slate-900">{paymentDate}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-600">Receipt No:</span>
                    <span className="font-mono font-semibold text-slate-900">{orNumber}</span>
                  </div>
                  <div className="flex justify-between items-center pt-0.5">
                    <span className="text-slate-600">Status:</span>
                    <span
                      className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                        isPaid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {isPaid ? "PAID" : "PENDING"}
                    </span>
                  </div>
                  {payment?.verifiedBy && (
                    <div className="flex justify-between items-baseline text-[11px] text-slate-500 pt-0.5 border-t border-dotted border-slate-300">
                      <span>Verified By:</span>
                      <span className="font-medium text-slate-700 truncate max-w-[185px] text-right">
                        {payment.verifiedBy}
                      </span>
                    </div>
                  )}
                </div>

                {/* Dotted Divider 2 */}
                <div className="border-b-2 border-dotted border-slate-900 my-3.5" />

                {/* Column Headers (Name, Qty, Price) */}
                <div className="text-xs">
                  <div className="flex justify-between font-bold text-slate-900 pb-1.5">
                    <span className="flex-1">Name</span>
                    <span className="w-10 text-center">Qty</span>
                    <span className="w-24 text-right">Price</span>
                  </div>

                  {/* Itemized Rows */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-2">
                        <p className="font-medium text-slate-900 leading-snug">{paymentTypeDescription}</p>
                        {payment?.stayStart && payment?.stayEnd && (
                          <p className="text-[10px] text-slate-500 font-mono">
                            {formatDate(payment.stayStart)} - {formatDate(payment.stayEnd)}
                          </p>
                        )}
                        {payment?.notes && (
                          <p className="text-[10px] text-slate-500 italic line-clamp-2">
                            {payment.notes}
                          </p>
                        )}
                      </div>
                      <span className="w-10 text-center text-slate-700 font-mono">1</span>
                      <span className="w-24 text-right font-bold text-slate-900 font-mono">
                        {formatCurrency(amountPaid)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dotted Divider 3 */}
                <div className="border-b-2 border-dotted border-slate-900 my-3.5" />

                {/* Totals Section */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-base sm:text-lg font-black text-slate-950">
                    <span>Sub Total</span>
                    <span className="font-mono">{formatCurrency(amountPaid)}</span>
                  </div>

                  <div className="space-y-1 pt-1 text-xs">
                    <div className="flex justify-between">
                      <span className="uppercase text-slate-700">{displayMethod}</span>
                      <span className="font-bold text-slate-900 font-mono">{formatCurrency(amountPaid)}</span>
                    </div>
                    {referenceNumber && (
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>REF NO.</span>
                        <span className="font-mono font-medium text-slate-800">{referenceNumber}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-700 pt-0.5">
                      <span className="uppercase">CHANGE / BALANCE</span>
                      <span className="font-bold text-slate-900 font-mono">{formatCurrency(balance)}</span>
                    </div>
                  </div>
                </div>

                {/* Short Dotted Divider */}
                <div className="w-3/5 mx-auto border-b-2 border-dotted border-slate-400 my-4" />

                {/* Barcode Section */}
                <ThermalBarcode code={orNumber} />

                {/* Tiny Footer Note */}
                <p className="text-[9px] text-center text-slate-400 mt-2">
                  Thank you for renting with RentTrack!
                </p>
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
