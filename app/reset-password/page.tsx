"use client";

import { useState, Suspense } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
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

  return (
    <div className="w-full max-w-md px-2">
      <div className="mb-6 text-center">
        <Link href="/" className="inline-block hover:scale-105 transition-transform" aria-label="RentTrack home">
          <Image
            src="/images/landing/logo.png"
            alt="RentTrack"
            width={64}
            height={64}
            className="h-16 w-16 rounded-full object-contain shadow-lg shadow-black/25"
          />
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="rounded-3xl border border-white/20 bg-surface/95 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/30"
      >
        {isSuccess && !token ? (
          <div className="text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-text-primary mb-2">Check Your Email</h1>
            <p className="text-text-secondary text-sm mb-6 leading-relaxed">
              If an account exists with this email, you will receive a password reset link shortly.
            </p>
            <Button
              variant="gradient"
              onClick={() => router.push("/login?mode=signin")}
              className="w-full h-11"
            >
              Back to Login
            </Button>
          </div>
        ) : isSuccess && token ? (
          <div className="text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-text-primary mb-2">Password Reset Successful</h1>
            <p className="text-text-secondary text-sm mb-6 leading-relaxed">
              Your password has been reset. You can now log in with your new password.
            </p>
            <Button
              variant="gradient"
              onClick={() => router.push("/login?mode=signin")}
              className="w-full h-11"
            >
              Go to Login
            </Button>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                {token ? "Reset Your Password" : "Forgot Password?"}
              </h1>
              <p className="text-text-secondary text-sm mt-2 leading-relaxed">
                {token ? "Enter your new password below" : "Enter your email address and we'll send you a reset link"}
              </p>
            </div>

            {token ? (
              <form onSubmit={handleConfirmReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">New Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary group-focus-within:text-primary-600 transition-colors" />
                    <Input
                      type="password"
                      placeholder="Enter new password (min. 8 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 h-10 rounded-xl border-border bg-surface-secondary focus:border-primary-500 focus:ring-primary-500/20"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Confirm New Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary group-focus-within:text-primary-600 transition-colors" />
                    <Input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 h-10 rounded-xl border-border bg-surface-secondary focus:border-primary-500 focus:ring-primary-500/20"
                      required
                    />
                  </div>
                </div>
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <Button type="submit" variant="gradient" className="w-full h-11 cursor-pointer" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Resetting password...
                    </span>
                  ) : (
                    "Reset Password"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-10 text-text-secondary hover:text-text-primary"
                  onClick={() => router.push("/login?mode=signin")}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Login
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary group-focus-within:text-primary-600 transition-colors" />
                    <Input
                      type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-10 rounded-xl border-border bg-surface-secondary focus:border-primary-500 focus:ring-primary-500/20"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" variant="gradient" className="w-full h-11 cursor-pointer" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending reset link...
                    </span>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-10 text-text-secondary hover:text-text-primary"
                  onClick={() => router.push("/login?mode=signin")}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Login
                </Button>
              </form>
            )}
          </>
        )}
      </motion.div>

      <p className="mt-5 text-center text-xs text-white/70">
        © {new Date().getFullYear()} RentTrack. All rights reserved.
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-surface flex items-center justify-center px-4 py-10">
      {/* Background Container with Animations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Ken Burns Zoom & Pan Animation */}
        <motion.div
          className="absolute inset-[-5%] h-[110%] w-[110%]"
          initial={{ scale: 1, x: 0, y: 0 }}
          animate={{
            scale: [1, 1.08, 1.03, 1.09, 1],
            x: ["0%", "1.5%", "-1%", "0.8%", "0%"],
            y: ["0%", "-1.2%", "0.8%", "-0.6%", "0%"],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
        >
          <Image
            src="/images/favicon/Landing page and login page.png"
            alt="RentTrack Background"
            fill
            priority
            quality={100}
            unoptimized
            sizes="100vw"
            className="object-cover object-center filter brightness-[0.95] contrast-[1.05]"
          />
        </motion.div>

        {/* Atmospheric Blue Light Glow */}
        <motion.div
          className="absolute -left-1/4 -top-1/4 h-[150%] w-[150%] bg-[radial-gradient(ellipse_at_30%_20%,rgba(59,130,246,0.32),transparent_50%)]"
          animate={{
            opacity: [0.35, 0.7, 0.35],
            scale: [1, 1.06, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Warm Golden Architectural Glow */}
        <motion.div
          className="absolute -bottom-1/3 -right-1/4 h-[140%] w-[140%] bg-[radial-gradient(ellipse_at_75%_75%,rgba(245,158,11,0.22),transparent_45%)]"
          animate={{
            opacity: [0.25, 0.6, 0.25],
            scale: [1.05, 1, 1.05],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Animated Gradient Orbs */}
        <motion.div
          animate={{ x: [0, 14, 0], y: [0, -16, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-gradient-to-br from-primary-400/15 to-accent-300/10 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -10, 0], y: [0, 22, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-gradient-to-br from-secondary-400/15 to-primary-300/10 blur-3xl"
        />

        {/* Floating Ambient Light Particles */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 14 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute rounded-full bg-white/40 shadow-[0_0_10px_rgba(255,255,255,0.7)] backdrop-blur-xs"
              style={{
                width: 2 + (i % 3) * 2,
                height: 2 + (i % 3) * 2,
                left: `${6 + i * 7}%`,
                top: `${15 + (i % 6) * 13}%`,
              }}
              animate={{
                y: [0, -35, 0],
                x: [0, i % 2 === 0 ? 14 : -14, 0],
                opacity: [0.15, 0.85, 0.15],
                scale: [0.8, 1.4, 0.8],
              }}
              transition={{
                duration: 6 + (i % 4) * 1.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.45,
              }}
            />
          ))}
        </div>

        {/* Cinematic Diagonal Light Flare Sweep */}
        <motion.div
          className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
          animate={{
            x: ["-200%", "250%"],
          }}
          transition={{
            duration: 11,
            repeat: Infinity,
            repeatDelay: 5,
            ease: "easeInOut",
          }}
        />

        {/* Depth Vignette Overlays for Maximum Legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-black/35 to-black/55" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.55)_100%)]" />
      </div>

      {/* Main Content with Suspense Boundary */}
      <Suspense
        fallback={
          <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/20 bg-surface/95 backdrop-blur-xl p-8 shadow-2xl text-center">
            <div className="h-8 w-8 border-2 border-text-tertiary border-t-primary-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-text-secondary text-sm">Loading...</p>
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
