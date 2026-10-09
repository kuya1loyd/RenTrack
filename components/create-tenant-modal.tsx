"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserPlus, Eye, EyeOff, Mail, Phone, MapPin, Lock, CheckCircle2, AlertCircle, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CreateTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    email: string;
    phone: string;
    address: string;
    password: string;
  }) => Promise<void>;
  submitting: boolean;
}

export default function CreateTenantModal({ isOpen, onClose, onSubmit, submitting }: CreateTenantModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
    setForm({ name: "", email: "", phone: "", address: "", password: "" });
    setShowPassword(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl max-h-[90vh] rounded-3xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
          >
            {/* Header with gradient */}
            <div className="relative bg-gradient-to-br from-blue-600 to-blue-700 px-6 py-5">
              <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/20 p-2.5 backdrop-blur-sm">
                    <UserPlus className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Create New Tenant</h3>
                    <p className="text-xs text-blue-100 mt-0.5">Set up a tenant account</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="rounded-lg bg-white/10 p-2 text-white/80 hover:bg-white/20 hover:text-white transition-all cursor-pointer z-50 pointer-events-auto"
                  aria-label="Close modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="max-h-[calc(90vh-140px)] overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Personal Information Section */}
                <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="rounded-lg bg-blue-100 p-1.5">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900">Personal Information</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1.5">
                        <User className="h-3 w-3 text-gray-400" />
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Juan Dela Cruz"
                        required
                        className="h-10 rounded-xl border-gray-200 bg-white focus:border-blue-500 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1.5">
                        <Mail className="h-3 w-3 text-gray-400" />
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="juan@example.com"
                        required
                        className="h-10 rounded-xl border-gray-200 bg-white focus:border-blue-500 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1.5">
                        <Phone className="h-3 w-3 text-gray-400" />
                        Phone Number
                      </label>
                      <Input
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+63 XXX XXX XXXX"
                        className="h-10 rounded-xl border-gray-200 bg-white focus:border-blue-500 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1.5">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        Address
                      </label>
                      <Input
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        placeholder="Tenant address"
                        className="h-10 rounded-xl border-gray-200 bg-white focus:border-blue-500 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>

                {/* Account Security Section */}
                <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="rounded-lg bg-purple-100 p-1.5">
                      <Lock className="h-4 w-4 text-purple-600" />
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900">Account Security</h4>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1.5">
                      <Lock className="h-3 w-3 text-gray-400" />
                      Initial Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder="Min. 8 characters"
                        required
                        className="h-10 rounded-xl border-gray-200 bg-white pr-10 focus:border-blue-500 focus:ring-blue-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">Tenant will be required to change this on first login</p>
                  </div>
                </div>

                {/* Info Banner */}
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-blue-900">Account Creation Notice</p>
                      <p className="text-xs text-blue-700 mt-1">
                        A verification email will be sent to the tenant&#39;s email address. They must verify their account before accessing the dashboard.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 border-t border-gray-100 bg-white px-6 py-4">
                <div className="flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                    disabled={submitting}
                    className="h-10 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Creating Account...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Create Tenant Account
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
