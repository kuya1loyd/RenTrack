"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  User, Save, Edit3, Shield, Upload, Key, Eye, EyeOff
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { optimizeAvatar } from "@/lib/image-upload";
import { toast } from "sonner";
import { ManagementBanner } from "@/components/management-panel";

type Tab = "general" | "edit-profile";

const tabs: { id: Tab; label: string; icon: typeof User }[] = [
  { id: "general", label: "General", icon: User },
  { id: "edit-profile", label: "Edit Profile", icon: Edit3 },
];

export default function ProfilePanel() {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [gender, setGender] = useState(user?.gender || "");
  const [birthdate, setBirthdate] = useState(user?.birthdate || "");
  const [address, setAddress] = useState(user?.address || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingId, setIsUploadingId] = useState(false);
  const userIdRef = useRef(user?.id || null);
  const didSyncRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (didSyncRef.current && userIdRef.current === user.id) return;
    if (didSyncRef.current && userIdRef.current !== user.id) {
      setName(user.name);
      setEmail(user.email);
      setPhone(user.phone || "");
      setGender(user.gender || "");
      setBirthdate(user.birthdate || "");
      setAddress(user.address || "");
      userIdRef.current = user.id;
      didSyncRef.current = true;
      return;
    }
    if (!didSyncRef.current) {
      setName(user.name);
      setEmail(user.email);
      setPhone(user.phone || "");
      setGender(user.gender || "");
      setBirthdate(user.birthdate || "");
      setAddress(user.address || "");
      userIdRef.current = user.id;
      didSyncRef.current = true;
    }
  }, [user]);

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

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    try {
      const res = await fetch("/api/auth/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: user?.id, currentPassword, newPassword }),
      });
      const result = await safeParseResponse(res);
      if (result.success) {
        toast.success("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
      } else {
        toast.error(result.error || "Failed to change password");
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const optimizedFile = await optimizeAvatar(file);
      const formData = new FormData();
      formData.append("file", optimizedFile);
      formData.append("type", "avatar");
      const res = await fetch("/api/auth/upload", { method: "POST", body: formData, credentials: "include" });
      const result = await safeParseResponse(res);
      if (result.success) {
        toast.success("Profile picture updated");
        await refreshUser();
      } else {
        toast.error(result.error || "Failed to upload profile picture");
      }
    } catch {
      toast.error("An error occurred");
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
      const res = await fetch("/api/auth/upload", { method: "POST", body: formData, credentials: "include" });
      const result = await safeParseResponse(res);
      if (result.success) {
        toast.success("ID uploaded for verification");
        await refreshUser();
      } else {
        toast.error(result.error || "Failed to upload ID");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsUploadingId(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-6">
      <ManagementBanner
        category="MY PROFILE"
        title="My Profile"
        description="Manage your account profile, contact information, and security credentials."
        icon={User}
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)} className="space-y-6">
        <div className="flex items-center">
          <TabsList className="inline-flex w-auto h-auto items-center gap-1.5 bg-white border border-gray-200 p-1.5 rounded-2xl shadow-xs">
            {tabs.map((tab, index) => {
              const Icon = tab.icon;
              return (
                <motion.div
                  key={tab.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <TabsTrigger
                    value={tab.id}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </TabsTrigger>
                </motion.div>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="general" className="space-y-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
            <Card className="hover:shadow-lg transition-all duration-300 hover:scale-[1.01]">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <motion.div
                    whileHover={{ rotate: 10, scale: 1.1 }}
                    className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center"
                  >
                    <User className="h-5 w-5 text-blue-600" />
                  </motion.div>
                  <div>
                    <CardTitle>General</CardTitle>
                    <CardDescription>View your profile information</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Avatar src={user?.avatarUrl} fallback={user?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "U"} size="lg" className="shadow-md" />
                  </motion.div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{user?.name || "Not set"}</p>
                    <p className="text-xs text-text-secondary">{user?.email || "Not set"}</p>
                  </div>
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <motion.div whileHover={{ scale: 1.02 }} className="p-3 rounded-xl hover:bg-surface-secondary transition-colors">
                     <label className="block text-sm font-medium text-text-secondary mb-1">Full Name</label>
                     <p className="text-sm font-medium text-foreground">{user?.name || "Not set"}</p>
                   </motion.div>
                   <motion.div whileHover={{ scale: 1.02 }} className="p-3 rounded-xl hover:bg-surface-secondary transition-colors">
                     <label className="block text-sm font-medium text-text-secondary mb-1">Account Email</label>
                     <p className="text-sm font-medium text-foreground">{user?.email || "Not set"}</p>
                   </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} className="p-3 rounded-xl hover:bg-surface-secondary transition-colors">
                      <label className="block text-sm font-medium text-text-secondary mb-1">Phone Number</label>
                      <p className="text-sm font-medium text-foreground">{phone || user?.phone || "Not set"}</p>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} className="p-3 rounded-xl hover:bg-surface-secondary transition-colors">
                      <label className="block text-sm font-medium text-text-secondary mb-1">Address</label>
                      <p className="text-sm font-medium text-foreground">{address || user?.address || "Not set"}</p>
                    </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <Card className="hover:shadow-lg transition-all duration-300 hover:scale-[1.01]">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <motion.div
                    whileHover={{ rotate: -10, scale: 1.1 }}
                    className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center"
                  >
                    <Shield className="h-5 w-5 text-emerald-600" />
                  </motion.div>
                  <div>
                    <CardTitle>Personal Details</CardTitle>
                    <CardDescription>Your personal information</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <motion.div whileHover={{ scale: 1.02 }} className="p-3 rounded-xl hover:bg-surface-secondary transition-colors">
                    <label className="block text-sm font-medium text-text-secondary mb-1">Phone Number</label>
                    <p className="text-sm font-medium text-foreground">{phone || user?.phone || "Not set"}</p>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.02 }} className="p-3 rounded-xl hover:bg-surface-secondary transition-colors">
                    <label className="block text-sm font-medium text-text-secondary mb-1">Gender</label>
                    <p className="text-sm font-medium text-foreground">{gender || "Not specified"}</p>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.02 }} className="p-3 rounded-xl hover:bg-surface-secondary transition-colors">
                    <label className="block text-sm font-medium text-text-secondary mb-1">Birthdate</label>
                    <p className="text-sm font-medium text-foreground">{birthdate ? new Date(birthdate).toLocaleDateString() : "Not specified"}</p>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.02 }} className="p-3 rounded-xl hover:bg-surface-secondary transition-colors">
                    <label className="block text-sm font-medium text-text-secondary mb-1">Address</label>
                    <p className="text-sm font-medium text-foreground">{address || user?.address || "Not set"}</p>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="edit-profile">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
            <Card className="hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <motion.div
                    whileHover={{ rotate: 15, scale: 1.1 }}
                    className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center"
                  >
                    <Edit3 className="h-5 w-5 text-blue-600" />
                  </motion.div>
                  <div>
                    <CardTitle>Edit Profile</CardTitle>
                    <CardDescription>Update your personal details, contact information, and password</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="flex items-center gap-6 mb-6">
                    <div className="relative">
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <Avatar
                          src={user?.avatarUrl}
                          fallback={user?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "U"}
                          size="xl"
                          className="shadow-lg"
                        />
                      </motion.div>
                      <motion.label
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary-500 text-white flex items-center justify-center cursor-pointer hover:bg-primary-600 transition-colors shadow-md"
                      >
                        <Upload className="h-4 w-4" />
                        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={isUploadingAvatar} />
                      </motion.label>
                    </div>
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <p className="font-medium text-foreground">{user?.name}</p>
                      <Badge variant="outline" className="mt-1 capitalize">{user?.role}</Badge>
                      {isUploadingAvatar && <p className="text-xs text-text-secondary mt-1">Uploading...</p>}
                    </motion.div>
                  </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     {[
                       { label: "Full Name", value: name, onChange: setName, placeholder: "" },
                       { label: "Email", value: email, onChange: setEmail, type: "email", placeholder: "" },
                       { label: "Phone", value: phone, onChange: setPhone, placeholder: "+63 XXX XXX XXXX" },
                       { label: "Address", value: address, onChange: setAddress, placeholder: "Your full address" },
                       { label: "Gender", value: gender, onChange: setGender, type: "select", options: ["", "Male", "Female", "Other", "Prefer not to say"] },
                       { label: "Birthdate", value: birthdate, onChange: setBirthdate, type: "date", placeholder: "" },
                     ].map((field, index) => (
                       <motion.div
                         key={field.label}
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         transition={{ delay: index * 0.05 }}
                       >
                         <label className="block text-sm font-medium text-foreground mb-1.5">{field.label}</label>
                         {field.type === "select" ? (
                           <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                             {field.options?.map((opt) => (
                               <option key={opt} value={opt}>{opt || `Select ${field.label.toLowerCase()}`}</option>
                             ))}
                           </Select>
                         ) : (
                           <Input
                             type={field.type || "text"}
                             value={field.value}
                             onChange={(e) => field.onChange(e.target.value)}
                             placeholder={field.placeholder}
                             className="transition-all duration-200 focus:scale-[1.01]"
                           />
                         )}
                       </motion.div>
                     ))}
                     {(user?.role === "tenant" || user?.role === "agent") && (
                       <motion.div
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         transition={{ delay: 0.4 }}
                         className="sm:col-span-2 pt-4 border-t border-border"
                       >
                         <label className="block text-sm font-medium text-foreground mb-2">ID Verification</label>
                         <p className="text-xs text-text-secondary mb-3">Upload a valid ID to verify your identity and enable booking/reservation features.</p>
                         {user?.idVerificationUrl ? (
                           <motion.div
                             whileHover={{ scale: 1.01 }}
                             className="flex items-center gap-3 p-3 rounded-lg bg-surface-secondary"
                           >
                             <img src={user.idVerificationUrl} alt="ID" className="h-16 w-24 object-cover rounded shadow-sm" />
                             <div>
                               <Badge variant="outline" className={
                                 user?.idVerificationStatus === "approved" ? "bg-green-50 text-green-600 border-green-200" :
                                 user?.idVerificationStatus === "rejected" ? "bg-red-50 text-red-600 border-red-200" :
                                 "bg-yellow-50 text-yellow-600 border-yellow-200"
                               }>
                                 {user?.idVerificationStatus || "Pending"}
                               </Badge>
                               <p className="text-xs text-text-secondary mt-1">ID uploaded</p>
                             </div>
                           </motion.div>
                         ) : (
                           <motion.label
                             whileHover={{ scale: 1.01 }}
                             whileTap={{ scale: 0.99 }}
                             className="flex items-center justify-center gap-2 h-24 rounded-lg border-2 border-dashed border-border hover:border-primary-300 cursor-pointer transition-colors"
                           >
                             <Upload className="h-5 w-5 text-text-tertiary" />
                             <span className="text-sm text-text-secondary">Click to upload ID</span>
                             <input type="file" accept="image/*" className="hidden" onChange={handleIdUpload} disabled={isUploadingId} />
                           </motion.label>
                         )}
                         {isUploadingId && <p className="text-xs text-text-secondary mt-1">Uploading ID...</p>}
                       </motion.div>
                     )}
                   </div>
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                      {isSaving ? (
                        <span className="flex items-center gap-1.5">
                          <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Save className="h-4 w-4 mr-1.5" />
                          Save Changes
                        </span>
                      )}
                    </Button>
                  </motion.div>
                </form>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-6 pt-6 border-t border-border"
                >
                  <h3 className="text-sm font-semibold text-foreground mb-4">Change Password</h3>
                  <div className="space-y-4 max-w-xl">
                    <motion.div whileFocus={{ scale: 1.01 }} className="relative">
                      <label className="block text-sm font-medium text-foreground mb-1.5">Current Password</label>
                      <Input type={showPassword ? "text" : "password"} value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)} className="pr-10 transition-all duration-200" />
                      <motion.button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="absolute right-3 top-8 text-text-tertiary"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </motion.button>
                    </motion.div>
                    <motion.div whileFocus={{ scale: 1.01 }}>
                      <label className="block text-sm font-medium text-foreground mb-1.5">New Password</label>
                      <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters" className="transition-all duration-200" />
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button type="button" onClick={handleChangePassword} variant="outline">
                        <Key className="h-4 w-4 mr-1.5" /> Update Password
                      </Button>
                    </motion.div>
                  </div>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
