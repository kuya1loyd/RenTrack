"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wrench, Shield, ArrowRight, RefreshCw, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function MaintenancePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [isOperational, setIsOperational] = useState(false);
  const [reason, setReason] = useState<string>("Property & Units Repair (Scheduled repair & maintenance across properties and units)");
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [downtime, setDowntime] = useState<string>("10 minutes");

  const isStaff = user?.role === "admin";

  useEffect(() => {
    fetch("/api/admin/maintenance/mode", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.reason) setReason(data.reason);
        if (data?.startedAt) setStartedAt(data.startedAt);
        if (data?.estimatedDowntime) setDowntime(data.estimatedDowntime);
        if (data && data.enabled === false) {
          router.push(isStaff ? "/dashboard/admin" : "/");
        }
      })
      .catch(() => {});
  }, [isStaff, router]);

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/admin/maintenance/mode", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (data && data.enabled === false) {
        setIsOperational(true);
        setTimeout(() => {
          router.push(isStaff ? "/dashboard/admin" : "/");
        }, 1500);
      } else {
        if (data?.reason) setReason(data.reason);
        if (data?.startedAt) setStartedAt(data.startedAt);
        if (data?.estimatedDowntime) setDowntime(data.estimatedDowntime);
        setTimeout(() => setChecking(false), 800);
      }
    } catch {
      setTimeout(() => setChecking(false), 800);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 px-4 py-12">
      <div className="max-w-lg w-full text-center">
        {/* Brand Header */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <Image
              src="/images/landing/logo.png"
              alt="RentTrack"
              width={64}
              height={64}
              className="h-16 w-16 rounded-2xl shadow-md object-contain bg-white p-1"
            />
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white ring-2 ring-white">
              <Wrench className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* Staff Access Banner */}
        {isStaff && (
          <div className="mb-6 p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200 text-left flex items-start gap-3 shadow-sm">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Administrator Access Active</p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                Maintenance mode only applies to tenants and visitors. As an {user.role}, your panel access is always open.
              </p>
              <div className="mt-3">
                <Link href={user.role === "admin" ? "/dashboard/admin" : "/dashboard/owner"}>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-medium gap-1.5 shadow-sm">
                    Enter {user.role === "admin" ? "Admin" : "Owner"} Dashboard
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-black/40 border border-slate-200/80 dark:border-slate-800 p-8 sm:p-10">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center mb-6">
            <Wrench className="h-8 w-8 text-amber-600 dark:text-amber-400 animate-bounce" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
            System Under Maintenance
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            We are currently performing scheduled maintenance and performance optimizations. We will be back online shortly.
          </p>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 p-5 mb-6 text-left space-y-3">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Platform Status</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Scheduled Maintenance
              </span>
            </div>
            {reason && (
              <div className="flex items-center justify-between text-xs sm:text-sm pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Maintenance Reason</span>
                <span className="font-semibold text-amber-800 dark:text-amber-300 text-right text-xs sm:text-sm">{reason}</span>
              </div>
            )}
            {startedAt && (
              <div className="flex items-center justify-between text-xs sm:text-sm pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Date &amp; Time Started</span>
                <span className="font-semibold text-slate-900 dark:text-white text-right text-xs sm:text-sm">
                  {new Date(startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at {new Date(startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs sm:text-sm pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Estimated Downtime</span>
              <span className="font-semibold text-slate-900 dark:text-white">{downtime || "10 minutes"}</span>
            </div>
            <div className="flex items-center justify-between text-xs sm:text-sm pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Your Data &amp; Payments</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Safe &amp; Secured
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {isOperational ? (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                System is back online! Redirecting you now...
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={handleCheckStatus}
                disabled={checking}
                className="w-full border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
                {checking ? "Checking System Status..." : "Check System Status"}
              </Button>
            )}

            {!isStaff && !isLoading && (
              <div className="pt-2">
                <Link
                  href="/login"
                  className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors underline underline-offset-4"
                >
                  Administrator or Staff Sign In
                </Link>
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} RentTrack • HedgeHomes Realty and Brokerage
        </p>
      </div>
    </div>
  );
}
