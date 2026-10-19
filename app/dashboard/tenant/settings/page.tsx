"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Key, Save, Eye, EyeOff, Edit3, Shield, Camera, Upload, Mail, Phone, MapPin, Calendar as CalendarIcon, CheckCircle2, X, Check, Lock, ArrowRight, ShieldCheck, Sparkles,
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
    <div className="w-full space-y-6 pb-12">
      {/* Expansive, Executive Profile Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#071326] via-[#0b1f3a] to-[#071326] p-6 sm:p-8 md:p-10 text-white shadow-xl border border-blue-900/30">
        <div className="relative z-10 flex flex-col lg:flex-row items-center lg:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            {/* Large Avatar with Camera Upload */}
            <div className="relative shrink-0">
              <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full overflow-hidden border-4 border-white/20 bg-slate-800 flex items-center justify-center shadow-xl">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.name}
                    width={112}
                    height={112}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-extrabold text-white">
                    {user.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "T"}
                  </span>
                )}
              </div>
              <label
                className="absolute bottom-1 right-1 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg cursor-pointer transition-all hover:scale-105 active:scale-95"
                title="Change profile photo"
              >
                <Camera className="h-4 w-4" />
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
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">{user.name}</h1>
                <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-300 capitalize border border-blue-400/30">
                  Verified Tenant
                </span>
                {user.idVerificationStatus === "approved" ? (
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> ID Verified
                  </span>
                ) : user.idVerificationStatus === "rejected" ? (
                  <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-300 border border-rose-400/30">
                    ID Rejected
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300 border border-amber-400/30">
                    Pending ID Verification
                  </span>
                )}
              </div>
              <p className="text-sm sm:text-base text-slate-300 font-medium">{user.email}</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-400 pt-1">
                <span>Member since {user.createdAt ? formatDate(user.createdAt) : "October 2025"}</span>
                <span>•</span>
                <span>Role: Resident / Tenant</span>
                <span>•</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Account Active
                </span>
              </div>
            </div>
          </div>

          {/* Profile Completeness Card */}
          <div className="w-full sm:w-auto rounded-2xl border border-white/15 bg-white/10 p-4 sm:p-5 text-center sm:text-right backdrop-blur-md min-w-[240px]">
            <div className="flex items-center justify-between sm:justify-end gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Profile Completeness
              </span>
              <span className="text-lg font-black text-white">{profileCompleteness.percentage}%</span>
            </div>
            <div className="w-full h-3 rounded-full bg-white/15 overflow-hidden mt-2 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-700 shadow-sm"
                style={{ width: `${profileCompleteness.percentage}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-2 text-left sm:text-right">
              {profileCompleteness.percentage === 100
                ? "✨ Your profile is 100% complete and verified!"
                : "Complete all fields to streamline rental approval."}
            </p>
          </div>
        </div>

        {/* Ambient subtle glow */}
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
      </div>

      {/* Modern Navigation Tabs */}
      <div className="flex items-center">
        <div className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "overview"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <User className="h-4 w-4" />
            <span>Overview</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("edit-profile")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "edit-profile"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Edit3 className="h-4 w-4" />
            <span>Edit Profile</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("password")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "password"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Key className="h-4 w-4" />
            <span>Password &amp; Security</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("id-verification")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "id-verification"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>ID Verification</span>
          </button>
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* Main Column: Personal Details & Identity */}
          <div className="lg:col-span-8 space-y-6">
            {/* Personal Information */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
              <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Personal Information</h2>
                    <p className="text-xs text-slate-500">Your registered contact and identity details</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("edit-profile")}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Edit3 className="h-4 w-4" />
                  <span>Edit Information</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-6">
                <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                    <User className="h-4 w-4 text-blue-600" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Full Name</span>
                  </div>
                  <p className="text-base font-bold text-slate-900">{user.name || "Not set"}</p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Email Address</span>
                  </div>
                  <p className="text-base font-bold text-slate-900 truncate" title={user.email}>{user.email || "Not set"}</p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                    <Phone className="h-4 w-4 text-blue-600" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Phone Number</span>
                  </div>
                  <p className="text-base font-bold text-slate-900">{phone || user.phone || "Not set"}</p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                    <User className="h-4 w-4 text-blue-600" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Gender</span>
                  </div>
                  <p className="text-base font-bold text-slate-900 capitalize">{gender || "Not specified"}</p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                    <CalendarIcon className="h-4 w-4 text-blue-600" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Birthdate</span>
                  </div>
                  <p className="text-base font-bold text-slate-900">
                    {birthdate ? formatDate(birthdate) : "Not specified"}
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Residential Address</span>
                  </div>
                  <p className="text-base font-bold text-slate-900 truncate" title={address}>{address || "Not set"}</p>
                </div>
              </div>
            </div>

            {/* Identity Document Verification Card */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
              <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Identity &amp; Document Verification</h2>
                    <p className="text-xs text-slate-500">Government ID submitted for lease agreement authorization</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("id-verification")}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="h-4 w-4 text-blue-600" />
                  <span>{user.idVerificationUrl ? "Update ID" : "Upload ID"}</span>
                </button>
              </div>

              <div className="pt-6">
                {user.idVerificationUrl ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 flex flex-col sm:flex-row items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                      <div
                        onClick={() => setShowIdPreview(true)}
                        className="relative h-20 w-32 rounded-xl overflow-hidden border-2 border-slate-300 bg-white cursor-pointer group shadow-sm shrink-0"
                        title="Click to view full ID"
                      >
                        <Image
                          src={user.idVerificationUrl}
                          alt="Government ID"
                          fill
                          unoptimized
                          className="object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Eye className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                              user.idVerificationStatus === "approved"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : user.idVerificationStatus === "rejected"
                                ? "bg-rose-100 text-rose-800 border border-rose-300"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}
                          >
                            {user.idVerificationStatus === "approved" ? "Verified" : user.idVerificationStatus === "rejected" ? "Rejected" : "Pending Review"}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 mt-1">Official ID on File</p>
                        <p className="text-xs text-slate-500">Encrypted and securely stored on RentTrack verified systems.</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowIdPreview(true)}
                      className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                    >
                      Inspect Document
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-6 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-amber-950">No Government ID Uploaded</h4>
                      <p className="text-xs text-amber-800 max-w-xl">
                        Please upload a valid government-issued ID (PhilSys, Driver’s License, Passport, etc.) to complete your resident verification.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("id-verification")}
                      className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer"
                    >
                      Upload ID Now
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar: Profile Checklist & Account Security */}
          <div className="lg:col-span-4 space-y-6">
            {/* Profile Checklist */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Profile Checklist</h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 items-center justify-center">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className="font-semibold text-slate-800">Full Name &amp; Email</span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600">Complete</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-6 w-6 rounded-full ${phone ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"} items-center justify-center`}>
                      {phone ? <Check className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-amber-500" />}
                    </span>
                    <span className="font-semibold text-slate-800">Phone Number</span>
                  </div>
                  {phone ? (
                    <span className="text-[11px] font-bold text-emerald-600">Added</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab("edit-profile")}
                      className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      Add
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-6 w-6 rounded-full ${address ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"} items-center justify-center`}>
                      {address ? <Check className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-amber-500" />}
                    </span>
                    <span className="font-semibold text-slate-800">Address Info</span>
                  </div>
                  {address ? (
                    <span className="text-[11px] font-bold text-emerald-600">Added</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab("edit-profile")}
                      className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      Add
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-6 w-6 rounded-full ${user.idVerificationUrl ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"} items-center justify-center`}>
                      {user.idVerificationUrl ? <Check className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-rose-500" />}
                    </span>
                    <span className="font-semibold text-slate-800">Government ID</span>
                  </div>
                  {user.idVerificationUrl ? (
                    <span className="text-[11px] font-bold text-emerald-600">Uploaded</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab("id-verification")}
                      className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      Upload
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Account Security Box */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <Lock className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Security &amp; Protection</h3>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Password Status:</span>
                  <span className="font-bold text-emerald-600">Protected</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Session Security:</span>
                  <span className="font-bold text-slate-800">Secure HTTP-Only</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Account Type:</span>
                  <span className="font-bold text-blue-600 uppercase">Tenant</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab("password")}
                className="w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Key className="h-3.5 w-3.5 text-slate-500" />
                <span>Change Password</span>
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
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-3 pb-5 border-b border-slate-100 mb-6">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Edit3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Update Profile Details</h2>
                <p className="text-xs text-slate-500">Ensure your contact and personal information is accurate</p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 09171234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Birthdate
                  </label>
                  <input
                    type="date"
                    value={birthdate}
                    onChange={(e) => setBirthdate(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Complete Address
                  </label>
                  <input
                    type="text"
                    placeholder="City, Province or full residential address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTab("overview")}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSaving ? "Saving Changes..." : "Save Changes"}</span>
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
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs max-w-3xl">
            <div className="flex items-center gap-3 pb-5 border-b border-slate-100 mb-6">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Change Account Password</h2>
                <p className="text-xs text-slate-500">Ensure your account remains safe with a strong, updated password</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Current Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className="w-full h-11 pl-4 pr-11 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full h-11 px-4 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full h-11 px-4 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
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
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Government Identity Verification</h2>
                <p className="text-xs text-slate-500">
                  Upload a valid government-issued ID to complete tenant verification and unlock lease privileges.
                </p>
              </div>
            </div>

            {user.idVerificationUrl ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                  <div
                    onClick={() => setShowIdPreview(true)}
                    className="relative h-28 w-44 rounded-2xl overflow-hidden border-2 border-slate-300 bg-white cursor-pointer group shadow-sm shrink-0"
                    title="Click to view full ID"
                  >
                    <Image
                      src={user.idVerificationUrl}
                      alt="Uploaded ID"
                      fill
                      unoptimized
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Eye className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        user.idVerificationStatus === "approved"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : user.idVerificationStatus === "rejected"
                          ? "bg-rose-100 text-rose-800 border border-rose-300"
                          : "bg-amber-100 text-amber-800 border border-amber-300"
                      }`}
                    >
                      {user.idVerificationStatus === "approved" ? "Verified" : user.idVerificationStatus === "rejected" ? "Rejected" : "Pending Verification"}
                    </span>
                    <h3 className="text-base font-bold text-slate-900">Official Government ID on File</h3>
                    <p className="text-xs text-slate-500 max-w-md">
                      Your identity document has been safely submitted and is attached to your verified tenant account.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowIdPreview(true)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 bg-white text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
                  >
                    View Full ID
                  </button>
                  <label className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-xs cursor-pointer transition-colors flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    <span>{isUploadingId ? "Uploading..." : "Replace ID"}</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={handleIdUpload}
                      disabled={isUploadingId}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-3 p-12 rounded-3xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/20 transition-all cursor-pointer">
                <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-xs">
                  <Upload className="h-7 w-7" />
                </div>
                <div className="text-center">
                  <span className="text-base font-bold text-slate-900 block">
                    {isUploadingId ? "Uploading your ID..." : "Click to upload your Government ID"}
                  </span>
                  <span className="text-xs text-slate-500 mt-1 block">
                    Supported formats: PhilSys National ID, Driver’s License, Passport, UMID (JPG, PNG, or PDF max 5MB)
                  </span>
                </div>
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
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm cursor-pointer"
                onClick={() => setShowIdPreview(false)}
              >
                <div
                  className="relative max-w-3xl w-full rounded-3xl bg-white p-6 shadow-2xl overflow-hidden cursor-default space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <h3 className="text-base font-bold text-slate-900">ID Document Preview</h3>
                    <button
                      type="button"
                      onClick={() => setShowIdPreview(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      aria-label="Close ID preview"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="relative h-[65vh] w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
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
