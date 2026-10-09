"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  User, Key, Save, Eye, EyeOff, Edit3, Shield, Camera, Mail, Phone, MapPin, Calendar as CalendarIcon, CheckCircle2, ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { calculateProfileCompleteness, type UserProfile } from "@/lib/profile";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

type Tab = "overview" | "edit-profile";

export default function SettingsPage({ embedded = false }: { embedded?: boolean } = {}) {
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
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

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
    setIsChangingPassword(true);
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
      setIsChangingPassword(false);
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
  };
  const profileCompleteness = calculateProfileCompleteness(profile);

  const dashboardHref = user.role === "admin"
    ? "/dashboard/admin"
    : user.role === "tenant"
    ? "/dashboard/tenant"
    : user.role === "owner"
    ? "/dashboard/owner"
    : user.role === "agent"
    ? "/dashboard/agent"
    : "/dashboard";

  const dashboardName = user.role === "admin"
    ? "Admin Dashboard"
    : user.role === "tenant"
    ? "Tenant Dashboard"
    : user.role === "owner"
    ? "Owner Dashboard"
    : user.role === "agent"
    ? "Agent Dashboard"
    : "Dashboard";

  const settingsContent = (
    <div className={embedded ? "w-full space-y-5" : "w-full max-w-5xl mx-auto space-y-5"}>
      {/* Compact, Perfect-Fit Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-[#071326] p-5 sm:p-6 text-white shadow-md">
        {/* Navigation pill inside card */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="text-white font-medium">Settings Console</span>
            <span>•</span>
            <span>Manage profile, credentials and security</span>
          </div>
          <Link
            href={dashboardHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 px-2.5 py-1 text-[11px] font-medium text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to {dashboardName}</span>
          </Link>
        </div>
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
                    {user.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "U"}
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
                  {user.role}
                </span>
                {user.idVerificationStatus === "approved" && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Verified
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
              Profile Strength
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

        {/* Ambient subtle glow */}
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-blue-600/15 blur-2xl pointer-events-none" />
      </div>

      {/* Compact Pill Tabs Navigation */}
      <div className="flex items-center">
        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
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
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-5"
        >
          {/* Personal Information Overview Card */}
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

          {/* Password & Security Quick Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <span>Password &amp; Security</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update your account password and review credential security settings.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("edit-profile")}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
            >
              <Key className="h-3.5 w-3.5 text-slate-500" />
              <span>Change Password</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* TAB 2: EDIT PROFILE (includes Profile Information and Password & Security together) */}
      {activeTab === "edit-profile" && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Section 1: Update Profile Details */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-blue-600" />
                <span>Personal Information</span>
              </h2>
              <span className="text-[11px] font-medium text-slate-400">Update your account details</span>
            </div>

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
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSaving ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Password & Security (Together in Edit Profile) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Key className="h-4 w-4 text-blue-600" />
                <span>Password &amp; Security</span>
              </h2>
              <span className="text-[11px] font-medium text-slate-400">Account credentials</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Enter your current password and choose a strong new password with at least 6 characters.
            </p>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                      placeholder="Current password"
                      className="w-full h-10 pl-3.5 pr-10 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showPassword ? "Hide password" : "Show password"}
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
                    placeholder="Min. 6 characters"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Key className="h-3.5 w-3.5" />
                  <span>{isChangingPassword ? "Updating Password..." : "Update Password"}</span>
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      )}
    </div>
  );

  if (embedded) {
    return settingsContent;
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col">
      {/* Top Navigation Bar with Back Button and Brand */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur px-4 sm:px-6 lg:px-8 py-3 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={dashboardHref}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-all hover:-translate-x-0.5"
            >
              <ArrowLeft className="h-4 w-4 text-slate-500" />
              <span>Back to {dashboardName}</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-medium text-slate-500">Account Settings</span>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/images/landing/logo.png" alt="RentTrack" width={26} height={26} className="h-6.5 w-6.5 object-contain" />
              <span className="font-bold text-slate-900 text-sm hidden sm:inline">RentTrack</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {settingsContent}
      </main>
    </div>
  );
}
