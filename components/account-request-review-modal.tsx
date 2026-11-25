"use client";

import { useMemo, useState } from "react";
import { motion, useDragControls } from "framer-motion";
import { X, UserPlus, Mail, Phone, MapPin, CalendarDays, KeyRound, Home, PhilippinePeso, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Conversation, AccountCreationRequest, sendMessage, markAllMessagesRead, safeParseJson } from "@/lib/data";

interface AccountRequestReviewModalProps {
  request: AccountCreationRequest | Conversation | any | null;
  onClose: () => void;
  onCreated: () => void;
}

type RequestDetails = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  propertyName: string;
  unitNumber: string;
  monthlyRent: string;
  contractStart: string;
  contractEnd: string;
  reason: string;
  agentId?: string;
};

function parseRequest(body: string): RequestDetails {
  const value = (label: string, fallback = "") => {
    const match = body.match(new RegExp(`^(?:\\*\\*)?${label}(?:\\*\\*)?:\\s*(.*)$`, "mi"));
    return match?.[1]?.trim() || fallback;
  };

  const idMatch = body.match(/\[Request ID:\s*([a-zA-Z0-9_-]+)\]/i);

  return {
    id: idMatch?.[1] || "",
    name: value("Name"),
    email: value("Email"),
    phone: value("Phone", "N/A"),
    address: value("Address", "N/A"),
    propertyName: value("Property Name", "N/A"),
    unitNumber: value("Unit Number", "N/A"),
    monthlyRent: value("Monthly Rent", "N/A"),
    contractStart: value("Contract Start", "N/A"),
    contractEnd: value("Contract End", "N/A"),
    reason: value("Reason", "No reason provided"),
  };
}

export default function AccountRequestReviewModal({ request, onClose, onCreated }: AccountRequestReviewModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const dragControls = useDragControls();

  const details = useMemo<RequestDetails | null>(() => {
    if (!request) return null;
    // 1. If request is already an AccountCreationRequest or has direct name/email fields
    if (request.name || request.email) {
      return {
        id: request.id || "",
        name: request.name || "",
        email: request.email || "",
        phone: request.phone && request.phone !== "N/A" ? request.phone : "N/A",
        address: request.address && request.address !== "N/A" ? request.address : "N/A",
        propertyName: request.propertyName || request.property_name || "N/A",
        unitNumber: request.unitNumber || request.unit_number || "N/A",
        monthlyRent: request.monthlyRent || request.monthly_rent || "N/A",
        contractStart: request.contractStart || request.contract_start || "N/A",
        contractEnd: request.contractEnd || request.contract_end || "N/A",
        reason: request.reason || "No reason provided",
        agentId: request.agentId || request.agent_id || "",
      };
    }
    // 2. If it's a Conversation with lastMessage
    if (request.lastMessage?.body) {
      const parsed = parseRequest(request.lastMessage.body);
      return {
        ...parsed,
        id: parsed.id || request.id || "",
        agentId: request.otherUser?.id || request.userId || "",
      };
    }
    return null;
  }, [request]);

  if (!request || !details) return null;

  const handleCreate = async () => {
    if (!details.name || !details.email || !password) {
      toast.error("Name, email, and a temporary password are required");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/data/account-requests/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          requestId: details.id,
          name: details.name,
          email: details.email,
          password,
          phone: details.phone === "N/A" ? "" : details.phone,
          address: details.address === "N/A" ? "" : details.address,
          propertyName: details.propertyName === "N/A" ? "" : details.propertyName,
          unitNumber: details.unitNumber === "N/A" ? "" : details.unitNumber,
          agentId: details.agentId,
        }),
      });
      const result = await safeParseJson(response);
      if (!result.success) {
        toast.error(result.error || "Failed to create tenant account");
        return;
      }

      if (request.userId) {
        await markAllMessagesRead(request.userId).catch(() => {});
      }

      if (result.alreadyApproved) {
        toast.info("This tenant account request was already approved.");
      } else {
        toast.success(
          result.emailSent
            ? `Tenant account created. Login details were emailed to ${details.email}.`
            : `Tenant account created successfully for ${details.name}.`
        );
      }
      setPassword("");
      onCreated();
      onClose();
    } catch {
      toast.error("An error occurred while creating the tenant account");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <motion.div
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0.05}
        className="pointer-events-auto flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
      >
        <div
          className="flex cursor-move select-none touch-none items-center justify-between border-b border-gray-200 px-4 py-3"
          onPointerDown={(event) => {
            if (!(event.target as HTMLElement).closest("button")) dragControls.start(event);
          }}
        >
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Account Creation Request</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">Review the agent&apos;s tenant details before creating access.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close request">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2.5 overflow-y-auto p-4 sm:grid-cols-2 max-h-[calc(85vh-120px)]">
          <Detail icon={<UserPlus className="h-3.5 w-3.5" />} label="Full name" value={details.name} />
          <Detail icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={details.email} />
          {details.phone && details.phone !== "N/A" && (
            <Detail icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={details.phone} />
          )}
          {details.address && details.address !== "N/A" && (
            <Detail icon={<MapPin className="h-3.5 w-3.5" />} label="Address" value={details.address} />
          )}
          {details.propertyName && details.propertyName !== "N/A" && (
            <Detail icon={<Home className="h-3.5 w-3.5" />} label="Property name" value={details.propertyName} />
          )}
          {details.unitNumber && details.unitNumber !== "N/A" && (
            <Detail icon={<Home className="h-3.5 w-3.5" />} label="Unit number" value={details.unitNumber} />
          )}
          {details.monthlyRent && details.monthlyRent !== "N/A" && (
            <Detail icon={<PhilippinePeso className="h-3.5 w-3.5" />} label="Monthly rent" value={details.monthlyRent} />
          )}
          {details.contractStart && details.contractStart !== "N/A" && (
            <Detail icon={<CalendarDays className="h-3.5 w-3.5" />} label="Contract start" value={details.contractStart} />
          )}
          {details.contractEnd && details.contractEnd !== "N/A" && (
            <Detail icon={<CalendarDays className="h-3.5 w-3.5" />} label="Contract end" value={details.contractEnd} />
          )}
          <div className="sm:col-span-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Reason / notes</p>
            <p className="rounded-lg bg-gray-50 p-2.5 text-xs text-gray-700">{details.reason}</p>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-gray-700" htmlFor="request-password">
              <KeyRound className="h-3.5 w-3.5" /> Temporary password
            </label>
            <div className="relative">
              <input
                id="request-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Set a password for the tenant"
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 pr-8 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-gray-500">Give this password to the tenant securely. They can change it after signing in.</p>
          </div>
        </div>
        <div className="flex gap-2 border-t border-gray-200 px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-9 text-xs">Cancel</Button>
          <Button type="button" onClick={handleCreate} disabled={creating} className="flex-1 h-9 text-xs bg-blue-600 text-white hover:bg-blue-700">{creating ? "Creating..." : "Approve & Create Account"}</Button>
        </div>
      </motion.div>
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-gray-100 bg-gray-50 p-3">
      <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{icon}{label}</p>
      <p className="break-words text-sm text-gray-800">{value || "N/A"}</p>
    </div>
  );
}
