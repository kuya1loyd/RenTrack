"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LayoutDashboard, Users, Building2, CreditCard, Bell, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPendingPaymentsCount, getUnreadMessageCount, getNotifications, markNotificationRead, markAllNotificationsRead, Notification } from "@/lib/data";
import { useAuth } from "@/lib/auth";

const navItems = [
  { label: "Dashboard", href: "/dashboard/agent", icon: LayoutDashboard },
  { label: "Tenants", href: "/dashboard/agent/tenants", icon: Users },
  { label: "Properties", href: "/dashboard/agent/properties", icon: Building2 },
  { label: "Payments", href: "/dashboard/agent/payments", icon: CreditCard },
];

export default function AgentNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    getPendingPaymentsCount().then(setPendingPaymentsCount).catch(() => setPendingPaymentsCount(0));
  }, []);

  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      getPendingPaymentsCount().then(setPendingPaymentsCount).catch(() => {});
      getUnreadMessageCount().then(setUnreadMessages).catch(() => {});
      getNotifications(user.id).then(setNotifications).catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 30000);
    window.addEventListener("renttrack-notifications-updated", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("renttrack-notifications-updated", refresh);
    };
  }, [user]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const totalBadges = pendingPaymentsCount + unreadMessages + unreadCount;

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) {
      await markNotificationRead(n.id).catch(() => {});
      if (user) getNotifications(user.id).then(setNotifications).catch(() => {});
      window.dispatchEvent(new Event("renttrack-notifications-updated"));
    }
    setShowNotifications(false);
    setMobileOpen(false);

    const title = (n.title || "").toLowerCase();
    const type = (n.type || "").toLowerCase();
    const msg = (n.message || "").toLowerCase();

    if (type === "payment" || title.includes("payment") || msg.includes("payment") || msg.includes("receipt")) {
      router.push("/dashboard/agent#payments");
    } else if (type === "tenant" || title.includes("tenant") || title.includes("assignment") || msg.includes("assigned") || msg.includes("tenant")) {
      router.push("/dashboard/agent#tenants");
    } else if (title.includes("message") || msg.includes("message") || type === "message") {
      router.push("/dashboard/agent#messages");
    } else if (type === "id_verification" || title.includes("verification")) {
      router.push("/dashboard/agent#verifications");
    } else if (type === "property" || title.includes("property") || msg.includes("property")) {
      router.push("/dashboard/agent#properties");
    } else {
      router.push("/dashboard/agent");
    }
  };

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        scrolled ? "bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl shadow-sm border-b border-gray-200 dark:border-gray-800" : "bg-transparent"
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/dashboard/agent" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-linear-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-sm">RT</span>
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              Rent<span className="text-blue-600">Track</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                 <Link
                   key={item.href}
                   href={item.href}
                   className={cn(
                     "relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200",
                     isActive
                       ? "text-blue-600 bg-blue-50 dark:bg-blue-900/30 shadow-sm"
                       : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
                   )}
                 >
                   <Icon className="h-4 w-4" />
                   <span>{item.label}</span>
                   {item.label === "Payments" && pendingPaymentsCount > 0 && (
                     <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                       {pendingPaymentsCount}
                     </span>
                   )}
                 </Link>
                );
              })}
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile menu toggle */}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 md:hidden">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {/* Notification Bell */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Bell className="h-5 w-5" />
                {totalBadges > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg"
                  >
                    {totalBadges > 99 ? "99+" : totalBadges}
                  </motion.span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl overflow-hidden z-50"
                  >
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={async () => {
                            if (user) {
                              await markAllNotificationsRead(user.id).catch(() => {});
                              getNotifications(user.id).then(setNotifications).catch(() => {});
                            }
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-sm text-gray-500">
                          No notifications yet
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className={cn(
                              "w-full text-left p-4 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors",
                              !n.read && "bg-blue-50/50 dark:bg-blue-900/10"
                            )}
                          >
                            <div className="flex gap-3">
                              <div className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
                                n.type === "payment" && "bg-green-50 text-green-600",
                                n.type === "tenant" && "bg-blue-50 text-blue-600",
                                n.type === "property" && "bg-amber-50 text-amber-600",
                                n.type === "system" && "bg-purple-50 text-purple-600",
                                n.type === "id_verification" && "bg-red-50 text-red-600",
                              )}>
                                {n.type === "payment" && <CreditCard className="h-4 w-4" />}
                                {n.type === "tenant" && <Users className="h-4 w-4" />}
                                {n.type === "property" && <Building2 className="h-4 w-4" />}
                                {(n.type === "system" || n.type === "id_verification") && <Settings className="h-4 w-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                                  {new Date(n.createdAt).toLocaleDateString("en-PH", {
                                    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                                  })}
                                </p>
                              </div>
                              {!n.read && <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800"
          >
             <div className="px-4 py-3 space-y-1">
               {navItems.map((item) => (
                 <Link
                   key={item.href}
                   href={item.href}
                   onClick={() => setMobileOpen(false)}
                   className={cn(
                     "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                     pathname === item.href
                       ? "text-blue-600 bg-blue-50 dark:bg-blue-900/30"
                       : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                   )}
                 >
                   <item.icon className="h-4 w-4" />
                   {item.label}
                   {item.label === "Payments" && pendingPaymentsCount > 0 && (
                     <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                       {pendingPaymentsCount}
                     </span>
                   )}
                 </Link>
               ))}
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
