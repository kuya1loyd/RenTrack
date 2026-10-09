"use client";

import { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { safeParseJson } from "@/lib/data";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await safeParseJson(res);
      if (data.success) {
        setIsSuccess(true);
        toast.success("If an account exists with this email, you will receive a password reset link.");
      } else {
        toast.error(data.error || "Failed to send reset email");
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await safeParseJson(res);
      if (data.success) {
        setIsSuccess(true);
        toast.success("Password reset successfully! You can now log in with your new password.");
      } else {
        setError(data.error || "Failed to reset password");
        toast.error(data.error || "Failed to reset password");
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess && !token) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-2xl text-center"
      >
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Check Your Email</h1>
        <p className="text-text-secondary mb-6">If an account exists with this email, you will receive a password reset link shortly.</p>
        <Button onClick={() => router.push("/login?mode=signin")} className="w-full">Back to Login</Button>
      </motion.div>
    );
  }

  if (isSuccess && token) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-2xl text-center"
      >
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Password Reset Successful</h1>
        <p className="text-text-secondary mb-6">Your password has been reset. You can now log in with your new password.</p>
        <Button onClick={() => router.push("/login?mode=signin")} className="w-full">Go to Login</Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-2xl"
    >
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground">{token ? "Reset Your Password" : "Forgot Password?"}</h1>
        <p className="text-text-secondary mt-2">
          {token ? "Enter your new password below" : "Enter your email address and we'll send you a reset link"}
        </p>
      </div>

      {token ? (
        <form onSubmit={handleConfirmReset} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <Input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <Input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Resetting..." : "Reset Password"}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => router.push("/login?mode=signin")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Login
          </Button>
        </form>
      ) : (
        <form onSubmit={handleRequestReset} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <Input
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send Reset Link"}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => router.push("/login?mode=signin")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Login
          </Button>
        </form>
      )}
    </motion.div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-surface flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/favicon/Agusan del Norte.jpg')" }} />
      <div className="absolute inset-0 bg-gradient-to-br from-primary-900/85 via-primary-900/70 to-secondary-900/80" />
      <Suspense fallback={<div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-2xl text-center">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
