"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, UserPlus, Mail, Phone, MapPin, Shield, Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { notifyAdmins, getUsers, sendMessage } from "@/lib/data";

interface AccountRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
}

export default function AccountRequestModal({ isOpen, onClose, agentName }: AccountRequestModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    password: "",
    recipientRole: "owner",
    reason: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast.error("Name and email are required");
      return;
    }
    setSubmitting(true);
    try {
      const messageBody = `${agentName} is requesting to create a new tenant account:\n\nName: ${formData.name}\nEmail: ${formData.email}\nPhone: ${formData.phone || "N/A"}\nAddress: ${formData.address || "N/A"}\nReason: ${formData.reason || "No reason provided"}`;
      await notifyAdmins({
        title: "Account Creation Request",
        message: messageBody,
        type: "tenant",
        read: false,
        recipientRole: formData.recipientRole,
      });
      try {
        const users = await getUsers();
        const recipients = users.filter((u) => u.role === formData.recipientRole);
        await Promise.allSettled(
          recipients.map((recipient) =>
            sendMessage({
              receiverId: recipient.id,
              subject: "Account Creation Request",
              body: messageBody,
            })
          )
        );
      } catch {
        // ignore message send failures; notification already delivered
      }
      toast.success(`Account creation request sent to ${formData.recipientRole === "owner" ? "Owner" : "Admin"}!`);
      setFormData({ name: "", email: "", phone: "", address: "", password: "", recipientRole: "admin", reason: "" });
      setShowPassword(false);
      onClose();
    } catch {
      toast.error("Failed to send request");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Request Tenant Account</h2>
            <p className="text-xs text-gray-500 mt-1">Send a request to the property owner to create a new tenant account</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 p-5" autoComplete="off">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Full Name *</label>
              <div className="relative">
                <UserPlus className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Juan Dela Cruz" className="pl-9 text-sm" autoComplete="off" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Email *</label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="juan@example.com" className="pl-9 text-sm" autoComplete="off" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Phone</label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="09XX-XXX-XXXX" className="pl-9 text-sm" autoComplete="off" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Address</label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Enter your address" className="pl-9 text-sm" autoComplete="off" />
              </div>
            </div>
          </div>
          <div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                <Input type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" className="pl-9 pr-9 text-sm" autoComplete="new-password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Send Request To</label>
            <div className="relative">
              <Shield className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
              <select value={formData.recipientRole} onChange={(e) => setFormData({ ...formData, recipientRole: e.target.value })} className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                <option value="owner">Property Owner</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Reason / Notes</label>
                <textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} rows={3} placeholder="Optional details about this request..." className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" autoComplete="off" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={submitting} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
              {submitting ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
