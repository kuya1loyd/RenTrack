"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { safeParseJson } from "@/lib/data";

const FormCard = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <div className="w-full max-w-md px-2">
    <div className="mb-6 text-center">
      <Link href="/" className="inline-block hover:scale-105 transition-transform">
        <Image src="/images/landing/logo.png" alt="RentTrack" width={64} height={64} className="h-16 w-16 rounded-full object-contain" />
      </Link>
    </div>

    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="rounded-3xl border border-border bg-surface/95 p-6 pb-5 shadow-xl shadow-black/4"
    >
      <h2 className="text-2xl font-bold text-text-primary tracking-tight text-center">{title}</h2>
      {subtitle && <p className="mt-1.5 text-sm text-text-secondary leading-relaxed text-center">{subtitle}</p>}

      <div className="mt-4">{children}</div>
    </motion.div>

    <p className="mt-5 text-center text-xs text-text-tertiary">
      © {new Date().getFullYear()} RentTrack. All rights reserved.
    </p>
  </div>
);

function LoginContent() {
  const searchParams = useSearchParams();
  const prefilledEmail = searchParams.get("email") || "";
  const isVerified = searchParams.get("verified") === "true";
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (prefilledEmail) {
      setEmail(prefilledEmail);
    }
    if (isVerified) {
      toast.success("Account verified successfully! Please enter your password to sign in.");
    }
  }, [prefilledEmail, isVerified]);

  const { setUser } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please fill in all fields"); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await safeParseJson(res);
      console.log("Login response:", data);
      if (data.success) {
        toast.success("Login successful!");
        setUser(data.user);
        const role = data.user.role;
        if (role === "tenant") {
          router.push("/dashboard/tenant");
        } else if (role === "agent") {
          router.push("/dashboard/agent");
        } else {
          router.push("/dashboard");
        }
      } else {
        if (data.needsVerification) {
          toast.info(data.error || "Please verify your account before logging in. A verification code has been sent to your email.");
          router.push(`/verify-otp?email=${encodeURIComponent(data.email || email)}`);
          return;
        }
        toast.error(data.error || "Login failed");
      }
    } catch { toast.error("An error occurred. Please try again."); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-surface">
      {/* Background image — Butuan City */}
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/favicon/Landing page and login page.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-primary-900/85 via-primary-900/70 to-secondary-900/80" />

      {/* Animated gradient orbs */}
      <motion.div
        animate={{ x: [0, 14, 0], y: [0, -16, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-gradient-to-br from-primary-300/10 to-accent-300/10 blur-3xl"
      />
      <motion.div
        animate={{ x: [0, -10, 0], y: [0, 22, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-gradient-to-br from-secondary-300/8 to-primary-300/8 blur-3xl"
      />
      <motion.div
        animate={{ x: [0, 12, 0], y: [0, 10, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/3 -right-20 h-64 w-64 rounded-full bg-gradient-to-br from-blue-400/10 to-cyan-300/10 blur-3xl"
      />
      <motion.div
        animate={{ x: [0, -8, 0], y: [0, -12, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-20 left-1/4 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-400/10 to-purple-300/10 blur-3xl"
      />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, -30, 0],
              x: [0, 15, 0],
              opacity: [0.1, 0.6, 0.1],
            }}
            transition={{
              duration: 5 + i * 0.4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2,
            }}
            className="absolute rounded-full bg-white"
            style={{
              left: `${10 + i * 4.5}%`,
              top: `${20 + (i % 5) * 18}%`,
              width: `${2 + (i % 3)}px`,
              height: `${2 + (i % 3)}px`,
            }}
          />
        ))}
      </div>

      {/* Subtle scan line */}
      <motion.div
        animate={{ y: ["-100%", "100%"] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-white/5 to-transparent"
      />

      {/* Subtle grid */}
      <div className="absolute inset-0 [background-image:linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [background-size:36px_36px] opacity-[0.03] pointer-events-none" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        {!mounted ? (
          <div className="flex items-center justify-center">
            <div className="h-6 w-6 border-2 border-text-tertiary border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : (
          <motion.div
            key="credentials"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.45, ease: [0.21, 0.47, 0.32, 0.98] }}
          >
            <FormCard
              title="RentTrack"
              subtitle="Property management made simple. Sign in to access your dashboard."
            >
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary group-focus-within:text-primary-600 transition-colors" />
                    <Input
                      type="email"
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 h-9 text-sm rounded-xl border-border bg-surface-secondary focus:border-primary-500 focus:ring-primary-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary group-focus-within:text-primary-600 transition-colors" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 pr-9 h-9 text-sm rounded-xl border-border bg-surface-secondary focus:border-primary-500 focus:ring-primary-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-text-secondary">
                    Forgot password?{" "}
                    <motion.button
                      type="button"
                      onClick={() => router.push("/reset-password")}
                      className="text-primary-600 font-semibold cursor-pointer"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Reset here
                    </motion.button>
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="gradient"
                  size="default"
                  className="w-full h-10 cursor-pointer"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Sign in
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </form>
            </FormCard>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface">
          <div className="h-6 w-6 border-2 border-text-tertiary border-t-primary-600 rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
