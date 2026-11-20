"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  DoorOpen,
  HelpCircle,
  Home,
  Info,
  Layers,
  LogOut,
  Map,
  Menu,
  MessageCircle,
  Search,
  Settings,
  X,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  getNotifications,
  getUnreadMessageCount,
  markNotificationRead,
  markAllNotificationsRead,
  Notification,
} from "@/lib/data";
import { getNotificationDashboardHref, isMaintenanceNotification } from "@/lib/notification-routing";

export default function TenantNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [mobilePropertyOpen, setMobilePropertyOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState<"all" | "unread" | "previous">("all");
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadMessageCount(0);
      return;
    }

    let mounted = true;
    const refresh = () => {
      getNotifications(user.id)
        .then((items) => { if (mounted) setNotifications(items); })
        .catch(() => { if (mounted) setNotifications([]); });
      getUnreadMessageCount()
        .then((count) => { if (mounted) setUnreadMessageCount(count); })
        .catch(() => { if (mounted) setUnreadMessageCount(0); });
    };

    refresh();
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("renttrack-notifications-updated", refresh);
    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("renttrack-notifications-updated", refresh);
    };
  }, [user]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setAccountOpen(false);
        setOptionsOpen(false);
        setPropertyOpen(false);
        setNotificationsOpen(false);
        setConfirmLogout(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("[data-tenant-account]")) setAccountOpen(false);
      if (!target.closest("[data-tenant-options]")) setOptionsOpen(false);
      if (!target.closest("[data-tenant-property]")) setPropertyOpen(false);
      if (!target.closest("[data-tenant-notifications]")) setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, []);

  const initials = user?.name?.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "T";
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const isActive = (href: string) => {
    const route = href.split("#")[0];
    return route === "/dashboard/tenant"
      ? pathname === route && !href.includes("#")
      : pathname === route || pathname.startsWith(`${route}/`);
  };

  const toggleNotifications = () => {
    setNotificationsOpen((open) => !open);
    setAccountOpen(false);
    setOptionsOpen(false);
    setPropertyOpen(false);
    setMobileOpen(false);
  };

  const openNotification = async (notification: Notification) => {
    if (!user) return;
    if (!notification.read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
      await markNotificationRead(notification.id).catch(() => { });
    }
    setNotificationsOpen(false);
    setMobileOpen(false);
    setSelectedNotification(notification);
  };

  const getActionLabel = (href: string) => {
    if (href.includes("/payments")) return "Go to Payments";
    if (href.includes("/units")) return "View My Unit";
    if (href.includes("/properties-page") || href.includes("/properties")) return "Browse Properties";
    if (href.includes("/news")) return "View Announcements";
    if (href.includes("/messages")) return "Open Messages";
    if (href.includes("/contact")) return "Contact Support";
    if (href.includes("/settings")) return "Account Settings";
    return "View Page";
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    await logout();
    router.push("/");
  };

  return (
    <nav data-tenant-navbar aria-label="Tenant navigation">
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 text-slate-800 shadow-xs transition-colors">
        {/* Left: Brand + Nav Links */}
        <div className="flex items-center gap-6 lg:gap-8">
          <Link
            href="/dashboard/tenant"
            className="flex items-center gap-3 transition-transform hover:scale-[1.02]"
            onClick={() => { setMobileOpen(false); setAccountOpen(false); setOptionsOpen(false); setPropertyOpen(false); }}
            aria-label="RentTrack dashboard"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-xs">
              <Image src="/images/landing/logo.png" alt="RentTrack" width={36} height={36} className="h-full w-full object-contain" />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">Rent<span className="text-blue-600">Track</span></span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/dashboard/tenant"
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                isActive("/dashboard/tenant")
                  ? "bg-blue-50 text-blue-700 shadow-xs"
                  : "text-slate-700 hover:bg-slate-100/90 hover:text-slate-950 font-medium"
              )}
            >
              <Home className={cn("h-4 w-4", isActive("/dashboard/tenant") ? "text-blue-600" : "text-slate-600")} />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/dashboard/tenant/payments"
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                isActive("/dashboard/tenant/payments")
                  ? "bg-blue-50 text-blue-700 shadow-xs"
                  : "text-slate-700 hover:bg-slate-100/90 hover:text-slate-950 font-medium"
              )}
            >
              <CreditCard className={cn("h-4 w-4", isActive("/dashboard/tenant/payments") ? "text-blue-600" : "text-slate-600")} />
              <span>My Payments</span>
            </Link>

            {/* My Property Dropdown */}
            <div
              className="relative"
              data-tenant-property
              onMouseEnter={() => setPropertyOpen(true)}
              onMouseLeave={() => setPropertyOpen(false)}
            >
              <button
                type="button"
                onClick={() => {
                  setPropertyOpen((prev) => !prev);
                  setOptionsOpen(false);
                  setAccountOpen(false);
                  setNotificationsOpen(false);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  isActive("/dashboard/tenant/properties-page") || isActive("/dashboard/tenant/units") || propertyOpen
                    ? "bg-blue-50 text-blue-700 shadow-xs"
                    : "text-slate-700 hover:bg-slate-100/90 hover:text-slate-950 font-medium"
                )}
                aria-expanded={propertyOpen}
                aria-haspopup="true"
              >
                <Building2 className={cn("h-4 w-4", (isActive("/dashboard/tenant/properties-page") || isActive("/dashboard/tenant/units") || propertyOpen) ? "text-blue-600" : "text-slate-600")} />
                <span>My Property</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200 text-slate-500", propertyOpen && "rotate-180 text-blue-600")} />
              </button>

              <AnimatePresence>
                {propertyOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 mt-2 min-w-[190px] rounded-xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-xl z-50"
                  >
                    <Link
                      href="/dashboard/tenant/properties-page"
                      onClick={() => setPropertyOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                        isActive("/dashboard/tenant/properties-page")
                          ? "bg-blue-50 text-blue-700 font-semibold"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      <Building2 className="h-4 w-4 text-blue-600" />
                      <span>My Property</span>
                    </Link>
                    <Link
                      href="/dashboard/tenant/units"
                      onClick={() => setPropertyOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                        isActive("/dashboard/tenant/units")
                          ? "bg-blue-50 text-blue-700 font-semibold"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      <Layers className="h-4 w-4 text-blue-600" />
                      <span>My Units</span>
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Link
              href="/dashboard/tenant/contact"
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                isActive("/dashboard/tenant/contact")
                  ? "bg-blue-50 text-blue-700 shadow-xs"
                  : "text-slate-700 hover:bg-slate-100/90 hover:text-slate-950 font-medium"
              )}
            >
              <HelpCircle className={cn("h-4 w-4", isActive("/dashboard/tenant/contact") ? "text-blue-600" : "text-slate-600")} />
              <span>Support</span>
            </Link>

            {/* Options Dropdown */}
            <div
              className="relative"
              data-tenant-options
              onMouseEnter={() => setOptionsOpen(true)}
              onMouseLeave={() => setOptionsOpen(false)}
            >
              <button
                type="button"
                onClick={() => { setOptionsOpen((prev) => !prev); setPropertyOpen(false); setAccountOpen(false); setNotificationsOpen(false); }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  optionsOpen || isActive("/dashboard/tenant/move-out") || isActive("/dashboard/tenant/map")
                    ? "bg-blue-50 text-blue-700 shadow-xs"
                    : "text-slate-700 hover:bg-slate-100/90 hover:text-slate-950 font-medium"
                )}
                aria-expanded={optionsOpen}
                aria-haspopup="true"
              >
                <span>Options</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200 text-slate-500", optionsOpen && "rotate-180 text-blue-600")} />
              </button>

              <AnimatePresence>
                {optionsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 mt-2 min-w-[200px] rounded-xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-xl z-50"
                  >
                    <Link
                      href="/dashboard/tenant/move-out"
                      onClick={() => setOptionsOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                    >
                      <DoorOpen className="h-4 w-4 text-slate-500" />
                      <span>Move-out Request</span>
                    </Link>
                    <div className="my-1 border-t border-slate-100" />
                    <Link
                      href="/dashboard/tenant/map"
                      onClick={() => setOptionsOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                    >
                      <Map className="h-4 w-4 text-slate-500" />
                      <span>Property Map</span>
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right: Notification Bell + User Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Notifications Button with Dropdown (anchored like other panels) */}
          <div className="relative" data-tenant-notifications>
            <button
              type="button"
              onClick={toggleNotifications}
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
              aria-expanded={notificationsOpen}
              className={cn(
                "relative rounded-lg p-2 text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                notificationsOpen && "bg-slate-100 text-blue-600"
              )}
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-xs ring-2 ring-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Panel */}
            <AnimatePresence>
              {notificationsOpen && user && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden z-50 text-slate-800"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 p-4">
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">Notifications</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {unreadCount ? `${unreadCount} unread update${unreadCount > 1 ? "s" : ""}` : "You're all caught up"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!user) return;
                            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                            await markAllNotificationsRead(user.id).catch(() => { });
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 font-semibold transition cursor-pointer"
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setNotificationsOpen(false)}
                        aria-label="Close notifications"
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Tabs: All / Unread / Previous Notifications */}
                  {notifications.length > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 bg-slate-50/70 text-xs">
                      <button
                        type="button"
                        onClick={() => setNotificationTab("all")}
                        className={cn(
                          "px-2.5 py-1 rounded-lg font-medium transition cursor-pointer",
                          notificationTab === "all"
                            ? "bg-white text-blue-700 shadow-2xs font-semibold"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        All ({notifications.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotificationTab("unread")}
                        className={cn(
                          "px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 cursor-pointer",
                          notificationTab === "unread"
                            ? "bg-white text-blue-700 shadow-2xs font-semibold"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <span>Unread</span>
                        {unreadCount > 0 && (
                          <span className="rounded-full bg-blue-600 px-1.5 py-0.2 text-[10px] text-white font-bold leading-tight">
                            {unreadCount}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotificationTab("previous")}
                        className={cn(
                          "px-2.5 py-1 rounded-lg font-medium transition cursor-pointer",
                          notificationTab === "previous"
                            ? "bg-white text-blue-700 shadow-2xs font-semibold"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        Previous ({notifications.filter((n) => n.read).length})
                      </button>
                    </div>
                  )}

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-sm text-slate-500">
                        <Check className="mx-auto mb-2 h-5 w-5 text-emerald-600" aria-hidden="true" />
                        <p className="font-semibold text-slate-800">No notifications yet</p>
                        <p className="text-xs text-slate-400 mt-1">Updates and announcements will appear here.</p>
                      </div>
                    ) : (() => {
                      const unreadItems = notifications.filter((n) => !n.read);
                      const previousItems = notifications.filter((n) => n.read);
                      const displayItems =
                        notificationTab === "unread"
                          ? unreadItems
                          : notificationTab === "previous"
                            ? previousItems
                            : notifications;

                      if (notificationTab === "unread" && unreadItems.length === 0) {
                        return (
                          <div className="p-8 text-center text-sm text-slate-500">
                            <Check className="mx-auto mb-2 h-5 w-5 text-emerald-600" aria-hidden="true" />
                            <p className="font-semibold text-slate-800">No unread notifications</p>
                            <p className="text-xs text-slate-400 mt-1">Check the Previous tab to review past notifications.</p>
                          </div>
                        );
                      }

                      if (notificationTab === "previous" && previousItems.length === 0) {
                        return (
                          <div className="p-8 text-center text-sm text-slate-500">
                            <Clock className="mx-auto mb-2 h-5 w-5 text-slate-400" aria-hidden="true" />
                            <p className="font-semibold text-slate-800">No previous notifications</p>
                            <p className="text-xs text-slate-400 mt-1">Notifications marked as read will be archived here.</p>
                          </div>
                        );
                      }

                      const renderItem = (n: Notification) => {
                        const isMaint = isMaintenanceNotification(n);
                        const type = (n.type || "").toLowerCase();
                        const cleanText = `${n.title || ""} ${n.message || ""}`.replace(/renttrack/gi, " ");
                        const isSystem = isMaint || type === "system";
                        const isPayment = !isSystem && (type === "payment" || /\b(?:payment|payments|receipt|receipts|balance|billing|invoice|paid|due\s+date|monthly\s+rent)\b/i.test(cleanText) || (/\brent\b/i.test(cleanText) && /\b(?:paid|due|amount|balance|fee|deposit|invoice|pay|overdue|receipt)\b/i.test(cleanText)));
                        const isProperty = !isSystem && !isPayment && (type === "property" || /\b(?:property|properties|rental\s+unit|apartment|condo)\b/i.test(cleanText));
                        const isTenant = !isSystem && !isPayment && !isProperty && (type === "tenant" || /\b(?:assignment|assigned|assigned\s+unit|lease|tenancy)\b/i.test(cleanText));

                        return (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => void openNotification(n)}
                            className={cn(
                              "w-full text-left p-3.5 transition-colors hover:bg-slate-50 flex items-start gap-3 cursor-pointer",
                              !n.read && "bg-blue-50/40"
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5",
                                isPayment && "bg-emerald-50 text-emerald-600",
                                isProperty && "bg-amber-50 text-amber-600",
                                isSystem && "bg-purple-50 text-purple-600",
                                isTenant && "bg-blue-50 text-blue-600",
                                !isPayment && !isProperty && !isSystem && !isTenant && "bg-slate-100 text-slate-600"
                              )}
                            >
                              {isPayment && <CreditCard className="h-4 w-4" />}
                              {isProperty && <Building2 className="h-4 w-4" />}
                              {isSystem && <Settings className="h-4 w-4" />}
                              {isTenant && <Home className="h-4 w-4" />}
                              {!isPayment && !isProperty && !isSystem && !isTenant && <Bell className="h-4 w-4" />}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <p className={cn("text-xs font-semibold truncate", !n.read ? "text-slate-900 font-bold" : "text-slate-700")}>
                                  {n.title}
                                </p>
                                {!n.read && <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                                {n.message}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-1">
                                {formatDate(n.createdAt)}
                              </p>
                            </div>
                          </button>
                        );
                      };

                      if (notificationTab === "all" && unreadItems.length > 0 && previousItems.length > 0) {
                        return (
                          <div>
                            <div className="px-3.5 py-1.5 bg-blue-50/60 text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                              New ({unreadItems.length})
                            </div>
                            {unreadItems.map(renderItem)}
                            <div className="px-3.5 py-1.5 bg-slate-100/70 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-t border-slate-100">
                              Previous Notifications ({previousItems.length})
                            </div>
                            {previousItems.map(renderItem)}
                          </div>
                        );
                      }

                      return displayItems.map(renderItem);
                    })()}
                  </div>

                  {notifications.length > 0 && (
                    <div className="p-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-500">Click notification to read closely</span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!user) return;
                            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                            await markAllNotificationsRead(user.id).catch(() => { });
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 font-semibold transition cursor-pointer"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User Account Pill */}
          {user && (
            <div className="relative" data-tenant-account>
              <button
                type="button"
                onClick={() => { setAccountOpen((prev) => !prev); setPropertyOpen(false); setOptionsOpen(false); setNotificationsOpen(false); }}
                aria-label="Open tenant account menu"
                aria-expanded={accountOpen}
                className="flex items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white/90 px-2.5 py-1.5 transition-colors hover:bg-white hover:border-slate-300 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 text-left"
              >
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-900 font-bold text-xs ring-1 ring-blue-300/80">
                  {user.avatarUrl && !avatarError ? (
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    initials
                  )}
                  {unreadMessageCount > 0 ? (
                    <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 border-2 border-white" />
                  ) : (
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                  )}
                </div>
                <div className="hidden sm:block min-w-0 max-w-[130px]">
                  <p className="truncate text-xs font-bold text-slate-900 leading-tight">
                    {user.name || "Tenant"}
                  </p>
                  <p className="text-[10px] font-medium text-slate-600 leading-tight mt-0.5">
                    Tenant
                  </p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              </button>

              <AnimatePresence>
                {accountOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 min-w-[220px] rounded-xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-xl z-50"
                  >
                    <div className="p-2 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-900 truncate">{user.name || "Tenant"}</p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{user.email}</p>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAccountOpen(false);
                          window.dispatchEvent(new CustomEvent("renttrack-open-messages"));
                        }}
                        className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer text-left"
                      >
                        <MessageCircle className="h-4 w-4 text-slate-500" />
                        <span className="flex-1">Messages</span>
                        {unreadMessageCount > 0 && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                            {unreadMessageCount}
                          </span>
                        )}
                      </button>

                      <Link
                        href="/dashboard/tenant/settings"
                        onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                      >
                        <Settings className="h-4 w-4 text-slate-500" />
                        <span>Account settings</span>
                      </Link>

                      <div className="my-1 border-t border-slate-100" />

                      <button
                        type="button"
                        onClick={() => { setConfirmLogout(true); setAccountOpen(false); }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <LogOut className="h-4 w-4 text-rose-500" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            className="md:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.22 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-white/95 backdrop-blur-xl p-4 text-slate-900 shadow-2xl md:hidden overflow-y-auto border-r border-slate-200"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-xs">
                    <Image src="/images/landing/logo.png" alt="RentTrack" width={32} height={32} className="h-full w-full object-contain" />
                  </span>
                  <span className="font-bold text-slate-900 text-base">Rent<span className="text-blue-600">Track</span></span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-1">
                <Link
                  href="/dashboard/tenant"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive("/dashboard/tenant")
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Home className="h-4 w-4" />
                  <span>Dashboard</span>
                </Link>

                <Link
                  href="/dashboard/tenant/payments"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive("/dashboard/tenant/payments")
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <CreditCard className="h-4 w-4" />
                  <span>My Payments</span>
                </Link>

                {/* My Property Dropdown in Mobile */}
                <div>
                  <button
                    type="button"
                    onClick={() => setMobilePropertyOpen((prev) => !prev)}
                    className={cn(
                      "w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer text-left",
                      isActive("/dashboard/tenant/properties-page") || isActive("/dashboard/tenant/units") || mobilePropertyOpen
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4" />
                      <span>My Property</span>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", mobilePropertyOpen && "rotate-180")} />
                  </button>
                  {mobilePropertyOpen && (
                    <div className="ml-7 mt-1 space-y-1 border-l border-slate-200 pl-3">
                      <Link
                        href="/dashboard/tenant/properties-page"
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                          isActive("/dashboard/tenant/properties-page")
                            ? "bg-blue-50 text-blue-700 font-semibold"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        )}
                      >
                        <Building2 className="h-3.5 w-3.5 text-slate-500" />
                        <span>My Property</span>
                      </Link>
                      <Link
                        href="/dashboard/tenant/units"
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                          isActive("/dashboard/tenant/units")
                            ? "bg-blue-50 text-blue-700 font-semibold"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        )}
                      >
                        <Layers className="h-3.5 w-3.5 text-slate-500" />
                        <span>My Units</span>
                      </Link>
                    </div>
                  )}
                </div>

                {[
                  { label: "Support", href: "/dashboard/tenant/contact", icon: HelpCircle },
                  { label: "Move-out Request", href: "/dashboard/tenant/move-out", icon: DoorOpen },
                  { label: "Property Map", href: "/dashboard/tenant/map", icon: Map },
                  { label: "Messages", href: "/dashboard/tenant/messages", icon: MessageCircle, isModal: true },
                  { label: "Settings", href: "/dashboard/tenant/settings", icon: Settings },
                ].map(({ label, href, icon: Icon, isModal }: any) =>
                  isModal ? (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setMobileOpen(false);
                        window.dispatchEvent(new CustomEvent("renttrack-open-messages"));
                      }}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer text-left"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                      {unreadMessageCount > 0 && (
                        <span className="ml-auto rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                          {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                        </span>
                      )}
                    </button>
                  ) : (
                    <Link
                      key={label}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive(href)
                          ? "bg-blue-50 text-blue-700 font-semibold"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </Link>
                  )
                )}
              </div>

              <div className="mt-6 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => { setConfirmLogout(true); setMobileOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Notification Detail Modal - Read Closely */}
      <AnimatePresence>
        {selectedNotification && (() => {
          const isMaint = isMaintenanceNotification(selectedNotification);
          const type = (selectedNotification.type || "").toLowerCase();
          const cleanText = `${selectedNotification.title || ""} ${selectedNotification.message || ""}`.replace(/renttrack/gi, " ");
          const isSystem = isMaint || type === "system";
          const isPayment = !isSystem && (type === "payment" || /\b(?:payment|payments|receipt|receipts|balance|billing|invoice|paid|due\s+date|monthly\s+rent)\b/i.test(cleanText) || (/\brent\b/i.test(cleanText) && /\b(?:paid|due|amount|balance|fee|deposit|invoice|pay|overdue|receipt)\b/i.test(cleanText)));
          const isProperty = !isSystem && !isPayment && (type === "property" || /\b(?:property|properties|rental\s+unit|apartment|condo)\b/i.test(cleanText));
          const isTenant = !isSystem && !isPayment && !isProperty && (type === "tenant" || /\b(?:assignment|assigned|assigned\s+unit|lease|tenancy)\b/i.test(cleanText));

          let category = "General Notice";
          let badgeClass = "bg-slate-100 text-slate-700 border-slate-200";
          let iconBg = "bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-slate-900/20";
          let accentGradient = "from-slate-500/10 via-slate-500/5 to-transparent";
          let IconComponent = Bell;

          if (isSystem) {
            category = "System Maintenance";
            badgeClass = "bg-purple-50 text-purple-700 border-purple-200/80";
            iconBg = "bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-purple-500/25";
            accentGradient = "from-purple-500/10 via-indigo-500/5 to-transparent";
            IconComponent = Settings;
          } else if (isPayment) {
            category = "Payment & Billing";
            badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
            iconBg = "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/25";
            accentGradient = "from-emerald-500/10 via-teal-500/5 to-transparent";
            IconComponent = CreditCard;
          } else if (isProperty) {
            category = "Property Update";
            badgeClass = "bg-amber-50 text-amber-700 border-amber-200/80";
            iconBg = "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-amber-500/25";
            accentGradient = "from-amber-500/10 via-orange-500/5 to-transparent";
            IconComponent = Building2;
          } else if (isTenant) {
            category = "Unit & Tenancy";
            badgeClass = "bg-blue-50 text-blue-700 border-blue-200/80";
            iconBg = "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/25";
            accentGradient = "from-blue-500/10 via-sky-500/5 to-transparent";
            IconComponent = Home;
          }

          const targetHref = getNotificationDashboardHref(selectedNotification, user?.role || "tenant");
          const actionLabel = getActionLabel(targetHref);

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelectedNotification(null);
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 14 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden text-slate-800"
              >
                {/* Decorative subtle ambient tint */}
                <div className={cn("absolute top-0 inset-x-0 h-28 bg-gradient-to-b pointer-events-none opacity-80", accentGradient)} />

                {/* Header */}
                <div className="relative p-6 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm", iconBg)}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border", badgeClass)}>
                            {category}
                          </span>
                          {isSystem && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Notice
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>{formatDate(selectedNotification.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedNotification(null)}
                      className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                      aria-label="Close notification"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-slate-950 leading-snug mt-4">
                    {selectedNotification.title}
                  </h3>
                </div>

                {/* Body */}
                <div className="px-6 py-2 pb-6 space-y-3 max-h-[60vh] overflow-y-auto">
                  {isSystem && (
                    <div className="rounded-2xl bg-amber-50/70 border border-amber-200/60 p-3.5 flex items-start gap-3">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                        <Info className="h-3.5 w-3.5" />
                      </div>
                      <p className="text-xs text-amber-900 leading-relaxed font-medium">
                        Scheduled maintenance advisory. Core services may temporarily undergo updates. Operations will resume normally as scheduled.
                      </p>
                    </div>
                  )}

                  <div className="rounded-2xl bg-slate-50/90 border border-slate-200/80 p-4.5 text-sm text-slate-700 leading-relaxed whitespace-pre-line shadow-2xs">
                    {selectedNotification.message}
                  </div>
                </div>

                {/* Footer with smart contextual actions */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
                  {isSystem ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedNotification(null)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedNotification(null)}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition active:scale-[0.98] cursor-pointer"
                      >
                        <Check className="h-4 w-4" />
                        <span>Got it, Understood</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedNotification(null)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedNotification(null);
                          router.push(targetHref);
                        }}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-[0.98] cursor-pointer",
                          isPayment ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"
                        )}
                      >
                        <span>{actionLabel}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {confirmLogout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onMouseDown={(event) => { if (event.target === event.currentTarget && !logoutLoading) setConfirmLogout(false); }}
          >
            <motion.section
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="tenant-logout-title"
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-slate-900"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 id="tenant-logout-title" className="text-lg font-bold text-slate-900">Sign out?</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                You can sign back in whenever you need to manage your rental.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  disabled={logoutLoading}
                  onClick={() => setConfirmLogout(false)}
                  className="min-h-10 flex-1 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={logoutLoading}
                  onClick={() => void handleLogout()}
                  className="min-h-10 flex-1 rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  {logoutLoading ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
