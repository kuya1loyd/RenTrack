"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Bell,
  ChevronDown,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/data";

type AdminNavbarProps = {
  user: { name: string; email: string };
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
};

const adminLinks = [
  { label: "Overview", href: "/dashboard/admin", tab: "overview", icon: LayoutDashboard },
  { label: "Accounts", href: "/dashboard/admin?tab=accounts", tab: "accounts", icon: UsersRound },
  { label: "Test lab", href: "/dashboard/admin?tab=test-lab", tab: "test-lab", icon: FlaskConical },
  { label: "Activity", href: "/dashboard/admin?tab=activity", tab: "activity", icon: Activity },
  { label: "Audit logs", href: "/dashboard/admin?tab=audit", tab: "audit", icon: ScrollText },
  { label: "Diagnosis", href: "/dashboard/admin?tab=diagnosis", tab: "diagnosis", icon: Stethoscope },
  { label: "Health", href: "/dashboard/admin?tab=health", tab: "health", icon: HeartPulse },
  { label: "Config", href: "/dashboard/admin?tab=config", tab: "config", icon: SlidersHorizontal },
];

export function AdminNavbar({
  user,
  notifications,
  onMarkRead,
  onMarkAllRead,
}: AdminNavbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const [openMenu, setOpenMenu] = useState<"alerts" | "profile" | null>(null);
  const activeTab = searchParams.get("tab") || "overview";
  const systemNotifications = notifications.filter((notification) => notification.type !== "payment");
  const unreadCount = systemNotifications.filter((notification) => !notification.read).length;
  const initials = user.name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();

  return (
    <motion.header
      initial={reduceMotion ? false : { opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="sticky top-0 z-50 border-b border-white/10 bg-[#07111f]/95 text-slate-100 shadow-[0_12px_32px_rgba(3,8,20,0.28)] backdrop-blur-xl"
    >
      <div className="mx-auto flex h-[4.45rem] max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard/admin" className="group flex shrink-0 items-center gap-2.5" aria-label="RentTrack system console">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/25 bg-gradient-to-br from-cyan-300/20 to-indigo-500/30 text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.16)] transition-transform duration-300 group-hover:scale-105">
            <ShieldCheck className="h-[18px] w-[18px]" />
          </span>
          <span className="hidden leading-none sm:block">
            <span className="block text-sm font-bold tracking-[0.01em] text-white">RentTrack</span>
            <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">System console</span>
          </span>
        </Link>

        <nav className="hide-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto py-2" aria-label="Administrator modules">
          {adminLinks.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.tab;
            return (
              <Link
                key={item.tab}
                href={item.href}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 lg:px-3",
                  isActive ? "text-white" : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="admin-nav-indicator"
                    className="absolute inset-0 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.10]"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 28 }}
                  />
                )}
                <Icon className={cn("relative h-3.5 w-3.5", isActive ? "text-cyan-200" : "")} />
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-400/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300 xl:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_9px_#6ee7b7]" />
            Operational
          </span>
          <div className="relative">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === "alerts" ? null : "alerts")}
                className="relative grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
                aria-label="System notifications"
                aria-expanded={openMenu === "alerts"}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />}
              </button>
            </motion.div>
            <AnimatePresence>
              {openMenu === "alerts" && (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
                  className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-white/10 bg-[#0c1a2d] shadow-2xl shadow-black/30"
                >
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">System notices</p>
                      <p className="text-[11px] text-slate-400">Operational updates only</p>
                    </div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <button type="button" onClick={onMarkAllRead} className="text-[11px] font-medium text-cyan-300 hover:text-cyan-100">
                        Mark all as read
                      </button>
                    </motion.div>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {systemNotifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-xs text-slate-400">No system notices right now.</p>
                    ) : systemNotifications.slice(0, 5).map((notification) => (
                      <button
                        type="button"
                        key={notification.id}
                        onClick={() => {
                          onMarkRead(notification.id);
                          setOpenMenu(null);
                          const title = (notification.title || "").toLowerCase();
                          const msg = (notification.message || "").toLowerCase();
                          if (title.includes("payment") || msg.includes("payment")) {
                            router.push("/dashboard/payments");
                          } else if (title.includes("user") || title.includes("agent") || title.includes("tenant") || title.includes("account")) {
                            router.push("/dashboard/admin?tab=accounts");
                          } else if (title.includes("property") || title.includes("unit")) {
                            router.push(title.includes("unit") ? "/dashboard/units" : "/dashboard/properties");
                          } else if (title.includes("health") || title.includes("diagnostic")) {
                            router.push("/dashboard/admin?tab=health");
                          } else {
                            router.push("/dashboard/admin?tab=activity");
                          }
                        }}
                        className={cn("flex w-full gap-3 border-b border-white/[0.06] px-4 py-3 text-left transition-colors hover:bg-white/[0.04] cursor-pointer", !notification.read && "bg-cyan-300/[0.035]")}
                      >
                        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-cyan-300/10 text-cyan-200"><Activity className="h-3.5 w-3.5" /></span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-slate-100">{notification.title}</span>
                          <span className="mt-0.5 block line-clamp-2 text-[11px] leading-relaxed text-slate-400">{notification.message}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === "profile" ? null : "profile")}
                className="flex h-9 items-center gap-1.5 rounded-lg px-1 text-slate-300 transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
                aria-label="Administrator account menu"
                aria-expanded={openMenu === "profile"}
              >
                <Avatar fallback={initials} size="sm" />
                <ChevronDown className={cn("hidden h-3.5 w-3.5 transition-transform sm:block", openMenu === "profile" && "rotate-180")} />
              </button>
            </motion.div>
            <AnimatePresence>
              {openMenu === "profile" && (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
                  className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-white/10 bg-[#0c1a2d] p-1.5 shadow-2xl shadow-black/30"
                >
                  <div className="border-b border-white/10 px-3 py-2.5">
                    <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                    <p className="truncate text-[11px] text-slate-400">{user.email}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
