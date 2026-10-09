"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Key, Save, Eye, EyeOff, Edit3, Shield, Camera, Upload, Mail, Phone, MapPin, Calendar as CalendarIcon, CheckCircle2, X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { calculateProfileCompleteness, type UserProfile } from "@/lib/profile";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

type Tab = "overview" | "edit-profile" | "password" | "id-verification";

export default function TenantSettingsPage() {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [gender, setGender] = useState(user?.gender || "");
  const [birthdate, setBirthdate] = useState(user?.birthdate || "");
  const [address, setAddress] = useState(user?.address || "");
  const userIdRef = useRef(user?.id || null);
  const didSyncRef = useRef(false);

  // ID preview state
  const [showIdPreview, setShowIdPreview] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (didSyncRef.current && userIdRef.current === user.id) return;
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone || "");
    setGender(user.gender || "");
    setBirthdate(user.birthdate || "");
    setAddress(user.address || "");
    userIdRef.current = user.id;
    didSyncRef.current = true;
  }, [user]);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingId, setIsUploadingId] = useState(false);

  const safeParseResponse = async (res: Response) => {
    try {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        return await res.json();
      }
      return { success: false, error: `Server returned status ${res.status}` };
    } catch {
      return { success: false, error: "Failed to read server response" };
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "avatar");
      const res = await fetch("/api/auth/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const result = await safeParseResponse(res);
      if (result.success && result.url) {
        await fetch("/api/auth/update", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: user?.id, avatarUrl: result.url }),
        });
        toast.success("Profile picture updated");
        await refreshUser();
      } else {
        toast.error(result.error || "Failed to upload image");
      }
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingId(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "id_verification");
      const res = await fetch("/api/auth/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const result = await safeParseResponse(res);
      if (result.success && result.url) {
        await fetch("/api/auth/update", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: user?.id, idVerificationUrl: result.url }),
        });
        toast.success("Valid ID submitted for verification");
        await refreshUser();
      } else {
        toast.error(result.error || "ID upload failed");
      }
    } catch {
      toast.error("An error occurred during upload");
    } finally {
      setIsUploadingId(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/auth/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: user?.id, name, email, phone, gender, birthdate, address }),
      });
      const result = await safeParseResponse(res);
      if (result.success) {
        toast.success("Profile updated successfully");
        await refreshUser();
      } else {
        toast.error(result.error || "Failed to update profile");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await safeParseResponse(res);
      if (result.success) {
        toast.success("Password updated successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(result.error || "Failed to update password");
      }
    } catch {
      toast.error("Failed to update password");
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const profile: UserProfile = {
    name: user.name,
    email: user.email,
    phone: user.phone,
    gender,
    birthdate,
    address,
    avatarUrl: user.avatarUrl,
    idVerificationUrl: user.idVerificationUrl,
  };
  const profileCompleteness = calculateProfileCompleteness(profile);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5">
      {/* Compact, Perfect-Fit Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-[#071326] p-5 sm:p-6 text-white shadow-xs">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            {/* Avatar with Camera Upload */}
            <div className="relative shrink-0">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full overflow-hidden border-2 border-white/20 bg-slate-800 flex items-center justify-center shadow-md">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.name}
                    width={80}
                    height={80}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold text-white">
                    {user.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "T"}
                  </span>
                )}
              </div>
              <label
                className="absolute bottom-0 right-0 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md cursor-pointer transition-colors"
                title="Change profile photo"
              >
                <Camera className="h-3.5 w-3.5" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={isUploadingAvatar}
                />
              </label>
            </div>

            {/* User Details */}
            <div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{user.name}</h1>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-200 capitalize border border-white/15">
                  Tenant
                </span>
                {user.idVerificationStatus === "approved" ? (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> ID Verified
                  </span>
                ) : user.idVerificationStatus === "rejected" ? (
                  <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-400/30">
                    ID Rejected
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-400/30">
                    Pending ID Verification
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">{user.email}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Member since {user.createdAt ? formatDate(user.createdAt) : "Recently"}
              </p>
            </div>
          </div>

          {/* Quick Stat Pill */}
          <div className="self-center sm:self-start rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-center backdrop-blur-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Profile Completeness
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-20 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${profileCompleteness.percentage}%` }}
                />
              </div>
              <span className="text-xs font-bold text-white">{profileCompleteness.percentage}%</span>
            </div>
          </div>
        </div>

        {/* Subtle ambient light */}
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-blue-600/15 blur-2xl pointer-events-none" />
      </div>

      {/* Compact Pill Tabs Navigation */}
      <div className="flex items-center">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "overview"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>Overview</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("edit-profile")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "edit-profile"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Edit Profile</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("password")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "password"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Key className="h-3.5 w-3.5" />
            <span>Password &amp; Security</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("id-verification")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "id-verification"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>ID Verification</span>
          </button>
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              <span>Personal Information</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Full Name</span>
                <p className="text-sm font-semibold text-slate-900 mt-1">{user.name || "Not set"}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</span>
                <p className="text-sm font-semibold text-slate-900 mt-1 truncate">{user.email || "Not set"}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone Number</span>
                <p className="text-sm font-semibold text-slate-900 mt-1">{phone || user.phone || "Not set"}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gender</span>
                <p className="text-sm font-semibold text-slate-900 mt-1 capitalize">{gender || "Not specified"}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Birthdate</span>
                <p className="text-sm font-semibold text-slate-900 mt-1">
                  {birthdate ? formatDate(birthdate) : "Not specified"}
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Address</span>
                <p className="text-sm font-semibold text-slate-900 mt-1 truncate">{address || "Not set"}</p>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveTab("edit-profile")}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit Information</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* TAB 2: EDIT PROFILE */}
      {activeTab === "edit-profile" && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-blue-600" />
              <span>Update Profile Information</span>
            </h2>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 09171234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Birthdate
                  </label>
                  <input
                    type="date"
                    value={birthdate}
                    onChange={(e) => setBirthdate(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Address
                  </label>
                  <input
                    type="text"
                    placeholder="City, Province or full address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTab("overview")}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSaving ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      )}

      {/* TAB 3: PASSWORD */}
      {activeTab === "password" && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs max-w-xl">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Key className="h-4 w-4 text-blue-600" />
              <span>Change Account Password</span>
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Enter your current password and choose a strong new password with at least 6 characters.
            </p>

            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full h-10 pl-3.5 pr-10 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 6 characters)"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {isSaving ? "Updating Password..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      )}

      {/* TAB 4: ID VERIFICATION */}
      {activeTab === "id-verification" && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs max-w-2xl space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <span>Identity Verification</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Upload a government-issued ID to complete tenant verification and unlock lease privileges.
              </p>
            </div>

            {user.idVerificationUrl ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => setShowIdPreview(true)}
                    className="relative h-16 w-24 rounded-lg overflow-hidden border border-slate-200 bg-white cursor-pointer group shadow-xs"
                  >
                    <Image
                      src={user.idVerificationUrl}
                      alt="Uploaded ID"
                      fill
                      unoptimized
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Eye className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        user.idVerificationStatus === "approved"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : user.idVerificationStatus === "rejected"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {user.idVerificationStatus === "approved" ? "Verified" : user.idVerificationStatus === "rejected" ? "Rejected" : "Pending Review"}
                    </span>
                    <p className="text-xs text-slate-600 mt-1">ID document on file</p>
                  </div>
                </div>

                <label className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 bg-white text-xs font-semibold text-slate-700 shadow-xs cursor-pointer transition-colors">
                  <span>Replace ID</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleIdUpload}
                    disabled={isUploadingId}
                  />
                </label>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 transition-colors cursor-pointer">
                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <Upload className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-slate-800">
                  {isUploadingId ? "Uploading ID..." : "Click to upload Government ID"}
                </span>
                <span className="text-[11px] text-slate-400">Supported: JPG, PNG, or PDF (max 5MB)</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleIdUpload}
                  disabled={isUploadingId}
                />
              </label>
            )}
          </div>

          {/* Full Preview Modal */}
          <AnimatePresence>
            {showIdPreview && user.idVerificationUrl && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
                onClick={() => setShowIdPreview(false)}
              >
                <div
                  className="relative max-w-2xl w-full rounded-2xl bg-white p-4 shadow-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowIdPreview(false);
                    }}
                    className="absolute top-3 right-3 z-50 p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer pointer-events-auto"
                    aria-label="Close ID preview"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <h3 className="text-sm font-bold text-slate-900 mb-3">ID Document Preview</h3>
                  <div className="relative h-96 w-full rounded-xl overflow-hidden bg-slate-100">
                    <Image
                      src={user.idVerificationUrl}
                      alt="ID Document"
                      fill
                      unoptimized
                      className="object-contain"
                    />
                  </div>
                </div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
