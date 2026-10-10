"use client";

import React, { useState, useRef } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  UploadCloud,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  Lock,
  Building2,
  CreditCard,
  FileText,
  Mail,
  Loader2,
  Info,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { User } from "@/lib/auth";

interface AgentVerificationGateProps {
  user: Omit<User, "password"> | null;
  refreshUser: () => Promise<void>;
}

export function AgentVerificationGate({ user, refreshUser }: AgentVerificationGateProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showReuploadForm, setShowReuploadForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const status = user?.idVerificationStatus || "unverified";
  const hasExistingId = Boolean(user?.idVerificationUrl);
  const idUrl = user?.idVerificationUrl || null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file: File) => {
    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please select a valid image (JPEG, PNG, WEBP) or PDF scan of your ID.");
      return;
    }

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10MB. Please choose a smaller photo or scan.");
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleSubmitId = async () => {
    if (!selectedFile) {
      toast.error("Please choose a government ID file to upload.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("type", "id_verification");
      if (user?.id) {
        formData.append("userId", user.id);
      }

      const res = await fetch("/api/auth/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to upload ID document");
      }

      toast.success("Government ID submitted successfully! The property owner has been notified.");
      setSelectedFile(null);
      setPreviewUrl(null);
      setShowReuploadForm(false);
      await refreshUser();
    } catch (err: any) {
      console.error("ID upload error:", err);
      toast.error(err.message || "Failed to submit ID document. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCheckStatus = async () => {
    setIsCheckingStatus(true);
    try {
      await refreshUser();
      if (user?.idVerificationStatus === "approved") {
        toast.success("Congratulations! Your ID has been approved by the owner.");
      } else {
        toast.info("Verification status refreshed: currently " + (user?.idVerificationStatus || "pending review") + ".");
      }
    } catch {
      toast.error("Could not refresh verification status. Please try again.");
    } finally {
      setIsCheckingStatus(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl py-6 px-3 sm:px-6 space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl border border-amber-200 bg-linear-to-r from-amber-500/10 via-amber-400/5 to-transparent p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Agent Account Activation Required</h1>
                <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900 text-xs font-semibold">
                  Access Restricted
                </Badge>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-gray-600">
                To comply with brokerage security and anti-fraud policies, your account must be verified by the property owner before accessing properties, units, and client agreements.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCheckStatus}
            disabled={isCheckingStatus}
            className="shrink-0 h-9 border-amber-300 bg-white hover:bg-amber-50 text-amber-900 font-semibold text-xs shadow-2xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isCheckingStatus ? "animate-spin" : ""}`} />
            <span>Check Approval Status</span>
          </Button>
        </div>
      </div>

      {/* Main Status & Action Card */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {status === "pending" && !showReuploadForm ? (
          /* PENDING REVIEW STATE */
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                  <Clock className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Government ID Submitted — Awaiting Owner Approval</h2>
                  <p className="text-xs text-gray-500">Your document was submitted and is in the owner's review queue.</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                Pending Owner Review
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Document Preview */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Submitted Document Scan</p>
                {idUrl ? (
                  <div className="relative group overflow-hidden rounded-xl border border-gray-200 bg-gray-50 max-h-60 flex items-center justify-center">
                    <img
                      src={idUrl}
                      alt="Submitted Government ID"
                      className="max-h-56 w-auto object-contain transition-transform group-hover:scale-105"
                    />
                    <a
                      href={idUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium text-xs gap-1.5"
                    >
                      <Eye className="h-4 w-4" /> View Full Document
                    </a>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-xs text-gray-500">
                    Document registered on file.
                  </div>
                )}
              </div>

              {/* Checklist & Next Steps */}
              <div className="space-y-4">
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-blue-600" /> What the Owner Verifies:
                  </h3>
                  <ul className="text-xs text-blue-800/90 space-y-1.5 list-disc list-inside">
                    <li>Full legal name matches account name ({user?.name})</li>
                    <li>Official government seal and photo clarity</li>
                    <li>PRC license or valid ID registration credentials</li>
                    <li>Valid expiration date & official card standards</li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <Button
                    type="button"
                    onClick={handleCheckStatus}
                    disabled={isCheckingStatus}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isCheckingStatus ? "animate-spin" : ""}`} />
                    Refresh Approval Status
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowReuploadForm(true)}
                    className="flex-1 border-gray-200 text-gray-700 hover:bg-gray-50 text-xs h-9"
                  >
                    Upload Different Document
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : status === "rejected" && !showReuploadForm ? (
          /* REJECTED STATE */
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-rose-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Government ID Verification Rejected</h2>
                  <p className="text-xs text-gray-500">The property owner could not authenticate your submitted document.</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                <XCircle className="h-3.5 w-3.5 text-rose-600" />
                Verification Rejected
              </span>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 space-y-2">
              <p className="text-xs font-bold text-rose-900">Requirements not met:</p>
              <p className="text-xs text-rose-800">
                Please ensure your photograph is clear, text and serial numbers are legible, and your full name on the ID matches your account profile name.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={() => setShowReuploadForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 px-6 shadow-xs"
              >
                Upload Valid Government ID Scan
              </Button>
            </div>
          </div>
        ) : (
          /* UPLOAD FORM (NEW AGENT OR RE-UPLOADING) */
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Upload Government Identification Document</h2>
                  <p className="text-xs text-gray-500">Supported: PRC License, Driver's License, Passport, UMID, National ID</p>
                </div>
              </div>
              {showReuploadForm && hasExistingId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReuploadForm(false)}
                  className="text-xs text-gray-500"
                >
                  Cancel
                </Button>
              )}
            </div>

            {/* Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                isDragOver
                  ? "border-blue-500 bg-blue-50/60 scale-[1.01]"
                  : selectedFile
                  ? "border-emerald-300 bg-emerald-50/30"
                  : "border-gray-200 bg-gray-50/50 hover:border-blue-300 hover:bg-blue-50/20"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />

              {previewUrl ? (
                <div className="space-y-3">
                  <img
                    src={previewUrl}
                    alt="ID Preview"
                    className="mx-auto max-h-48 rounded-lg border border-gray-200 object-contain shadow-xs"
                  />
                  <div className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{selectedFile?.name} ({(selectedFile ? selectedFile.size / 1024 / 1024 : 0).toFixed(2)} MB)</span>
                  </div>
                  <p className="text-[11px] text-gray-400">Click to choose a different photo</p>
                </div>
              ) : selectedFile ? (
                <div className="space-y-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 mx-auto">
                    <FileCheck2 className="h-6 w-6" />
                  </div>
                  <p className="text-xs font-semibold text-gray-900">{selectedFile.name}</p>
                  <p className="text-[11px] text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Ready to submit</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 mx-auto shadow-2xs">
                    <UploadCloud className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Drag &amp; drop your ID file here, or <span className="text-blue-600 hover:underline">browse files</span>
                    </p>
                    <p className="mt-1 text-xs text-gray-500">High-resolution scan or photo (PNG, JPG, WEBP, PDF up to 10MB)</p>
                  </div>
                </div>
              )}
            </div>

            {/* Quality Tips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 text-center">
                <span className="block text-xs font-bold text-gray-900">1. Clear &amp; In Focus</span>
                <span className="text-[11px] text-gray-500">All text, ID numbers, and photo clearly legible.</span>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 text-center">
                <span className="block text-xs font-bold text-gray-900">2. All 4 Corners</span>
                <span className="text-[11px] text-gray-500">Entire card visible with no cropped borders.</span>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 text-center">
                <span className="block text-xs font-bold text-gray-900">3. Valid &amp; Unexpired</span>
                <span className="text-[11px] text-gray-500">Must be an active, unexpired government document.</span>
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {showReuploadForm && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowReuploadForm(false)}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
              )}
              <Button
                type="button"
                onClick={handleSubmitId}
                disabled={!selectedFile || isUploading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 px-6 shadow-xs"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    Submitting ID...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                    Submit ID for Owner Review
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Locked Features Preview */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-500" />
            Locked Features Awaiting Verification
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">These management sections will automatically unlock once the owner approves your ID.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3.5">
            <Building2 className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-gray-700">Property Portfolios</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Assigned properties, unit occupancy, and map.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3.5">
            <CreditCard className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-gray-700">Financial Transactions</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Rent collections, commissions, and statements.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3.5">
            <FileText className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-gray-700">Rental Contracts</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Create and issue legal lease agreements.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3.5">
            <Mail className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-gray-700">Client Inquiries &amp; Chat</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Direct tenant messaging and prospect inquiries.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
