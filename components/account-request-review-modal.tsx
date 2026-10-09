"use client";

import { useMemo, useState } from "react";
import { motion, useDragControls } from "framer-motion";
import { X, UserPlus, Mail, Phone, MapPin, CalendarDays, KeyRound, Home, PhilippinePeso } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Conversation, sendMessage, markAllMessagesRead, safeParseJson } from "@/lib/data";

interface AccountRequestReviewModalProps {
  request: Conversation | null;
  onClose: () => void;
  onCreated: () => void;
}

type RequestDetails = {
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
};

function parseRequest(body: string): RequestDetails {
  const value = (label: string, fallback = "") => {
    const match = body.match(new RegExp(`^${label}:\\s*(.*)$`, "mi"));
    return match?.[1]?.trim() || fallback;
  };

  return {
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
  const [creating, setCreating] = useState(false);
  const dragControls = useDragControls();
  const details = useMemo(() => (request ? parseRequest(request.lastMessage.body) : null), [request]);

  if (!request || !details) return null;

  const handleCreate = async () => {
    if (!details.name || !details.email || !password) {
      toast.error("Name, email, and a temporary password are required");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: details.name,
          email: details.email,
          password,
          role: "tenant",
          phone: details.phone === "N/A" ? "" : details.phone,
          address: details.address === "N/A" ? "" : details.address,
        }),
      });
      const result = await safeParseJson(response);
      if (!result.success) {
        toast.error(result.error || "Failed to create tenant account");
        return;
      }

      await Promise.allSettled([
        markAllMessagesRead(request.userId),
        sendMessage({
          receiverId: request.userId,
          subject: "Account Creation Request Approved",
          body: `The tenant account request for ${details.name} was approved. The account is ready for email verification and login.`,
        }),
      ]);
      toast.success(result.emailSent
        ? `Tenant account created. Login details and verification code were emailed to ${details.email}`
        : `Tenant account created, but the credentials email could not be sent`);
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
        className="pointer-events-auto w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
      >
        <div
          className="flex cursor-move select-none touch-none items-center justify-between border-b border-gray-200 px-5 py-4"
          onPointerDown={(event) => {
            if (!(event.target as HTMLElement).closest("button")) dragControls.start(event);
          }}
        >
          <div>
            <h2 className="text-base font-semibold text-gray-900">Account Creation Request</h2>
            <p className="mt-1 text-xs text-gray-500">Review the agent&apos;s tenant details before creating access.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close request">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          <Detail icon={<UserPlus className="h-4 w-4" />} label="Full name" value={details.name} />
          <Detail icon={<Mail className="h-4 w-4" />} label="Email" value={details.email} />
          <Detail icon={<Phone className="h-4 w-4" />} label="Phone" value={details.phone} />
          <Detail icon={<MapPin className="h-4 w-4" />} label="Address" value={details.address} />
          <Detail icon={<Home className="h-4 w-4" />} label="Property name" value={details.propertyName} />
          <Detail icon={<Home className="h-4 w-4" />} label="Unit number" value={details.unitNumber} />
          <Detail icon={<PhilippinePeso className="h-4 w-4" />} label="Monthly rent" value={details.monthlyRent} />
          <Detail icon={<CalendarDays className="h-4 w-4" />} label="Contract start" value={details.contractStart} />
          <Detail icon={<CalendarDays className="h-4 w-4" />} label="Contract end" value={details.contractEnd} />
          <div className="sm:col-span-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Reason / notes</p>
            <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{details.reason}</p>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-700" htmlFor="request-password">
              <KeyRound className="h-3.5 w-3.5" /> Temporary password
            </label>
            <input id="request-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Set a password for the tenant" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" autoComplete="new-password" />
            <p className="mt-1 text-[11px] text-gray-500">Give this password to the tenant securely. They can change it after signing in.</p>
          </div>
        </div>
        <div className="flex gap-2 border-t border-gray-200 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="button" onClick={handleCreate} disabled={creating} className="flex-1 bg-blue-600 text-white hover:bg-blue-700">{creating ? "Creating..." : "Approve & Create Account"}</Button>
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
