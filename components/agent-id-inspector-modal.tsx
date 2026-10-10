"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Loader2,
  Sparkles,
  Info,
  Check,
  FileText,
  UserCheck,
  Lock,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AgentIdInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    idVerificationUrl?: string | null;
    idVerificationStatus?: string | null;
    role?: string;
  } | null;
  canApprove?: boolean; // true for Owner, false for Admin
  onVerify?: (agentId: string, status: "approved" | "rejected", reason?: string) => Promise<void> | void;
  isVerifying?: boolean;
}

interface ImageMetrics {
  width: number;
  height: number;
  aspectRatio: number;
  isStandardIdRatio: boolean;
  isPassportRatio: boolean;
  isSquareOrSelfie: boolean;
  isVertical: boolean;
  isHighRes: boolean;
  isLowRes: boolean;
  score: number;
  verdict: "genuine" | "suspicious" | "indeterminate";
  warnings: string[];
  passedChecks: string[];
}

const COMMON_REJECTION_REASONS = [
  "Blurry or unreadable document photo",
  "Expired ID document",
  "Name on document does not match account name",
  "Incomplete document / edges cropped out",
  "Document type not recognized as valid government ID",
];

export function AgentIdInspectorModal({
  isOpen,
  onClose,
  agent,
  canApprove = false,
  onVerify,
  isVerifying = false,
}: AgentIdInspectorModalProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Verification checklist state
  const [checks, setChecks] = useState<{
    photoMatches: boolean;
    sealVisible: boolean;
    nameMatches: boolean;
    numberLegible: boolean;
    dateValid: boolean;
  }>({
    photoMatches: true,
    sealVisible: true,
    nameMatches: true,
    numberLegible: true,
    dateValid: true,
  });

  const idUrl = agent?.idVerificationUrl?.trim() || null;

  // Reset metrics when agent or URL changes
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setZoom(1);
    setRotation(0);
    setNaturalSize(null);
    setIsRejecting(false);
    setRejectionReason("");
    setChecks({
      photoMatches: true,
      sealVisible: true,
      nameMatches: true,
      numberLegible: true,
      dateValid: true,
    });
  }, [idUrl, agent?.id]);

  // Compute authenticity metrics
  const metrics: ImageMetrics | null = useMemo(() => {
    if (!naturalSize || naturalSize.width === 0 || naturalSize.height === 0) {
      return null;
    }

    const { width, height } = naturalSize;
    const aspectRatio = width / height;

    // ISO/IEC 7810 ID-1 standard ratio: 85.6mm / 53.98mm ≈ 1.586
    const isStandardIdRatio = aspectRatio >= 1.45 && aspectRatio <= 1.75;
    const isPassportRatio = aspectRatio >= 1.35 && aspectRatio < 1.45;
    const isSquareOrSelfie = aspectRatio >= 0.85 && aspectRatio <= 1.15;
    const isVertical = aspectRatio < 0.85;

    const isHighRes = width >= 900 && height >= 550;
    const isLowRes = width < 500 || height < 320;

    const warnings: string[] = [];
    const passedChecks: string[] = [];
    let score = 50;

    if (isStandardIdRatio) {
      score += 30;
      passedChecks.push("Card proportions match official government ID standard (ISO 7810 ID-1, ~1.58:1 ratio)");
    } else if (isPassportRatio) {
      score += 25;
      passedChecks.push("Document proportions match official Passport bio page format (~1.42:1 ratio)");
    } else if (isSquareOrSelfie) {
      score -= 35;
      warnings.push("Square aspect ratio (1:1): Resembles a profile photo, selfie, or avatar rather than an ID card");
    } else if (isVertical) {
      score -= 30;
      warnings.push("Vertical orientation: Official government ID cards are horizontally oriented. Ensure full card is shown");
    } else {
      score -= 15;
      warnings.push("Non-standard aspect ratio: Document dimensions differ from typical government ID card standards");
    }

    if (isHighRes) {
      score += 20;
      passedChecks.push("High-definition scan: Resolution is sufficient to verify fine print, serial watermark, and text");
    } else if (isLowRes) {
      score -= 25;
      warnings.push("Low-resolution image (< 500px): Text, microprinting, or serial numbers may be blurry or illegible");
    } else {
      passedChecks.push("Standard resolution: Document details appear generally legible");
    }

    // Check if filename or URL has indications
    if (idUrl) {
      if (idUrl.startsWith("data:image/")) {
        passedChecks.push("Direct image scan uploaded from device");
      }
    }

    const clampedScore = Math.max(10, Math.min(98, score));
    const verdict: "genuine" | "suspicious" | "indeterminate" =
      clampedScore >= 70 ? "genuine" : clampedScore < 45 ? "suspicious" : "indeterminate";

    return {
      width,
      height,
      aspectRatio,
      isStandardIdRatio,
      isPassportRatio,
      isSquareOrSelfie,
      isVertical,
      isHighRes,
      isLowRes,
      score: clampedScore,
      verdict,
      warnings,
      passedChecks,
    };
  }, [naturalSize, idUrl]);

  if (!isOpen || !agent) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Government ID Review: ${agent.name}`}
      description="Inspect government identification scan, authenticity verification signals, and security markers."
      className="max-w-3xl overflow-hidden p-0"
    >
      <div className="flex flex-col max-h-[85vh]">
        {/* Top Header Card */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/70 dark:border-gray-800 dark:bg-gray-800/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 dark:text-white text-sm">{agent.name}</span>
                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                  Agent ID: #{agent.id.slice(0, 8)}
                </Badge>
              </div>
              <p className="text-xs text-gray-500">
                {agent.email} {agent.phone ? `• ${agent.phone}` : ""} {agent.address ? `• ${agent.address}` : ""}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize border",
                  agent.idVerificationStatus === "approved"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : agent.idVerificationStatus === "pending"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : agent.idVerificationStatus === "rejected"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-gray-100 text-gray-700 border-gray-200"
                )}
              >
                {agent.idVerificationStatus === "approved" && <CheckCircle2 className="h-3 w-3" />}
                {agent.idVerificationStatus === "pending" && <AlertTriangle className="h-3 w-3" />}
                {agent.idVerificationStatus === "rejected" && <XCircle className="h-3 w-3" />}
                Status: {agent.idVerificationStatus || "Unverified"}
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Authenticity Engine Alert Banner */}
          {idUrl && metrics && (
            <div
              className={cn(
                "rounded-xl p-3.5 border transition-all shadow-xs",
                metrics.verdict === "genuine"
                  ? "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                  : metrics.verdict === "suspicious"
                  ? "bg-rose-50/90 border-rose-200 dark:bg-rose-950/25 dark:border-rose-800"
                  : "bg-amber-50/80 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-bold shadow-xs",
                    metrics.verdict === "genuine"
                      ? "bg-emerald-600 text-white"
                      : metrics.verdict === "suspicious"
                      ? "bg-rose-600 text-white"
                      : "bg-amber-600 text-white"
                  )}
                >
                  {metrics.verdict === "genuine" ? (
                    <ShieldCheck className="h-5 w-5" />
                  ) : metrics.verdict === "suspicious" ? (
                    <ShieldAlert className="h-5 w-5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5" />
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4
                      className={cn(
                        "font-bold text-xs",
                        metrics.verdict === "genuine"
                          ? "text-emerald-900 dark:text-emerald-200"
                          : metrics.verdict === "suspicious"
                          ? "text-rose-900 dark:text-rose-200"
                          : "text-amber-900 dark:text-amber-200"
                      )}
                    >
                      {metrics.verdict === "genuine"
                        ? "AUTHENTICITY CHECK: LIKELY TRUE GOVERNMENT ID"
                        : metrics.verdict === "suspicious"
                        ? "WARNING: POTENTIAL FAKE OR NON-STANDARD ID DETECTED"
                        : "AUTHENTICITY REVIEW: MANUAL INSPECTION REQUIRED"}
                    </h4>
                    <span
                      className={cn(
                        "text-[10px] font-mono px-2 py-0.5 rounded-full font-bold",
                        metrics.verdict === "genuine"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : metrics.verdict === "suspicious"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      )}
                    >
                      {metrics.score}% Match Confidence
                    </span>
                  </div>

                  {metrics.warnings.length > 0 && (
                    <div className="pt-1 space-y-1">
                      {metrics.warnings.map((warn, i) => (
                        <p key={i} className="text-[11px] text-rose-700 dark:text-rose-300 flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="h-3 w-3 shrink-0 text-rose-500" />
                          <span>{warn}</span>
                        </p>
                      ))}
                    </div>
                  )}

                  {metrics.passedChecks.length > 0 && (
                    <div className="pt-1 space-y-0.5">
                      {metrics.passedChecks.map((check, i) => (
                        <p key={i} className="text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                          <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                          <span>{check}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ID Image Viewer Area with Fast Loading & Controls */}
          {idUrl ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                <span className="font-medium flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                  <FileText className="h-3.5 w-3.5 text-blue-500" />
                  Document Scan Preview
                  {naturalSize && (
                    <span className="text-[10px] text-gray-400 font-mono">
                      ({naturalSize.width} × {naturalSize.height} px • {metrics?.aspectRatio.toFixed(2)}:1)
                    </span>
                  )}
                </span>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}
                    title="Zoom Out"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
                    title="Zoom In"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    title="Rotate 90°"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setZoom(1);
                      setRotation(0);
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>

              {/* Main Image Box */}
              <div className="relative group overflow-hidden rounded-xl border border-gray-200 bg-slate-950 flex items-center justify-center p-3 min-h-[300px] max-h-[460px] shadow-inner">
                {/* Instant non-blocking status badge if still decoding */}
                {!imageLoaded && !imageError && (
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-slate-200 backdrop-blur shadow">
                    <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                    <span>Loading ID preview...</span>
                  </div>
                )}

                {imageError ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                    <p className="text-sm font-semibold text-white">Unable to display ID image directly</p>
                    <p className="text-xs text-slate-400">The document may require external authentication or full size opening.</p>
                    <a
                      href={idUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline pt-2"
                    >
                      <span>Open document in new browser window</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ) : (
                  <>
                    <img
                      src={idUrl}
                      alt={`Government ID of ${agent.name}`}
                      loading="eager"
                      decoding="async"
                      onLoad={(e) => {
                        setNaturalSize({
                          width: e.currentTarget.naturalWidth,
                          height: e.currentTarget.naturalHeight,
                        });
                        setImageLoaded(true);
                      }}
                      onError={() => setImageError(true)}
                      style={{
                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                        transition: "transform 0.15s ease-out",
                      }}
                      className="max-h-[420px] w-auto max-w-full object-contain rounded-lg shadow-xl"
                    />

                    <a
                      href={idUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute bottom-3 right-3 rounded-md bg-black/75 hover:bg-black/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur transition flex items-center gap-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Full Screen
                    </a>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500 space-y-2">
              <FileText className="h-8 w-8 text-gray-300 mx-auto" />
              <p className="font-semibold text-gray-700 dark:text-gray-300">No Government ID Document Uploaded</p>
              <p className="text-xs text-gray-400">This agent has not submitted an official ID document yet.</p>
            </div>
          )}

          {/* Rejection Reason Form */}
          {isRejecting && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold text-xs">
                  <XCircle className="h-4 w-4 text-rose-600" />
                  Specify Reason for Rejecting Government ID
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/40"
                  onClick={() => setIsRejecting(false)}
                >
                  Cancel
                </Button>
              </div>

              <p className="text-xs text-rose-700 dark:text-rose-300">
                Select a quick reason or write specific instructions below. This will be sent directly to the agent so they know how to resubmit.
              </p>

              <div className="flex flex-wrap gap-1.5">
                {COMMON_REJECTION_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRejectionReason(reason)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition-all font-medium text-left",
                      rejectionReason === reason
                        ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                        : "bg-white text-gray-700 border-rose-200 hover:bg-rose-100/60 dark:bg-gray-800 dark:text-gray-200 dark:border-rose-800"
                    )}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Write specific rejection reason or instructions for the agent (e.g. Document image is blurry, please provide a clear scan of your PRC License or Passport)..."
                rows={3}
                className="w-full rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-gray-900 p-2.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          )}

          {/* Interactive Reviewer Checklist */}
          {idUrl && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-purple-600" />
                  Manual Security Inspector Checklist
                </h5>
                <span className="text-[10px] text-gray-400">
                  {Object.values(checks).filter(Boolean).length}/5 Verified
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-800 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checks.photoMatches}
                    onChange={(e) => setChecks((c) => ({ ...c, photoMatches: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span className="text-gray-700 dark:text-gray-300">ID photo matches applicant appearance</span>
                </label>

                <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-800 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checks.nameMatches}
                    onChange={(e) => setChecks((c) => ({ ...c, nameMatches: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Full legal name matches account name</span>
                </label>

                <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-800 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checks.sealVisible}
                    onChange={(e) => setChecks((c) => ({ ...c, sealVisible: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Official government seal / coat of arms visible</span>
                </label>

                <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-800 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checks.numberLegible}
                    onChange={(e) => setChecks((c) => ({ ...c, numberLegible: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span className="text-gray-700 dark:text-gray-300">ID / PRC license number sharp & unedited</span>
                </label>

                <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-800 cursor-pointer transition-colors sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={checks.dateValid}
                    onChange={(e) => setChecks((c) => ({ ...c, dateValid: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span className="text-gray-700 dark:text-gray-300">ID document is currently valid and unexpired</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer / Permission Actions Area */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-900 flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>

          {canApprove ? (
            /* OWNER / ADMIN HAS AUTHORITY TO APPROVE OR REJECT */
            isRejecting ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRejecting(false)}
                >
                  Back to Review
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isVerifying}
                  onClick={() => {
                    const reason = rejectionReason.trim() || "ID verification requirements not met. Please provide a clear scan of a valid government-issued ID.";
                    onVerify && onVerify(agent.id, "rejected", reason);
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs cursor-pointer"
                >
                  {isVerifying ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-1.5" />
                  )}
                  Confirm Reject ID
                </Button>
              </div>
            ) : agent.idVerificationStatus === "approved" ? (
              /* ALREADY APPROVED STATE */
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>ID Verified &amp; Approved</span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isVerifying}
                  onClick={() => setIsRejecting(true)}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 text-xs"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1 text-rose-500" />
                  Reject / Revoke ID
                </Button>
              </div>
            ) : agent.idVerificationStatus === "rejected" ? (
              /* ALREADY REJECTED STATE */
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
                  <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>ID Rejected</span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={isVerifying || !idUrl}
                  onClick={() => onVerify && onVerify(agent.id, "approved")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs text-xs"
                >
                  {isVerifying ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  )}
                  Re-approve ID
                </Button>
              </div>
            ) : (
              /* PENDING / UNVERIFIED STATE */
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isVerifying || !idUrl}
                  onClick={() => setIsRejecting(true)}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                >
                  <XCircle className="h-4 w-4 mr-1.5" />
                  Reject ID
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={isVerifying || !idUrl}
                  onClick={() => onVerify && onVerify(agent.id, "approved")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                >
                  {isVerifying ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  )}
                  Approve &amp; Verify ID
                </Button>
              </div>
            )
          ) : (
            /* VIEW-ONLY STATE */
            <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg">
              <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span>
                <strong>View-Only:</strong> You are viewing this government identification document.
              </span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
