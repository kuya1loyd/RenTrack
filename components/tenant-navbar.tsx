"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  CreditCard,
  DoorOpen,
  HelpCircle,
  Home,
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
import { getNotificationDashboardHref } from "@/lib/notification-routing";

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
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
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
      await markNotificationRead(notification.id).catch(() => {});
    }
    setNotificationsOpen(false);
    setMobileOpen(false);
    router.push(getNotificationDashboardHref(notification, user.role));
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    await logout();
    router.push("/");
  };

  return (
    <nav data-tenant-navbar aria-label="Tenant navigation">
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-[#071326] px-4 sm:px-6 lg:px-8 text-white shadow-sm">
        {/* Left: Brand + Nav Links */}
        <div className="flex items-center gap-6 lg:gap-8">
          <Link
            href="/dashboard/tenant"
            className="flex items-center gap-3"
            onClick={() => { setMobileOpen(false); setAccountOpen(false); setOptionsOpen(false); setPropertyOpen(false); }}
            aria-label="RentTrack dashboard"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-sm">
              <Image src="/images/landing/logo.png" alt="RentTrack" width={36} height={36} className="h-full w-full object-contain" />
            </span>
            <span className="text-lg font-bold tracking-tight text-white">RentTrack</span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/dashboard/tenant"
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                isActive("/dashboard/tenant")
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              <Home className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/dashboard/tenant/payments"
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                isActive("/dashboard/tenant/payments")
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              <CreditCard className="h-4 w-4" />
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
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
                aria-expanded={propertyOpen}
                aria-haspopup="true"
              >
                <Building2 className="h-4 w-4" />
                <span>My Property</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", propertyOpen && "rotate-180")} />
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
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              <HelpCircle className="h-4 w-4" />
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
                  optionsOpen
                    ? "bg-white/15 text-white"
                    : "bg-white/10 text-slate-200 hover:bg-white/15 hover:text-white"
                )}
                aria-expanded={optionsOpen}
                aria-haspopup="true"
              >
                <span>Options</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", optionsOpen && "rotate-180")} />
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
          {/* Notifications Button with Badge */}
          <button
            type="button"
            data-tenant-notifications
            onClick={toggleNotifications}
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
            aria-expanded={notificationsOpen}
            className="relative rounded-lg p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Bell className="h-4.5 w-4.5" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-[#071326]">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {/* User Account Pill */}
          {user && (
            <div className="relative" data-tenant-account>
              <button
                type="button"
                onClick={() => { setAccountOpen((prev) => !prev); setPropertyOpen(false); setOptionsOpen(false); setNotificationsOpen(false); }}
                aria-label="Open tenant account menu"
                aria-expanded={accountOpen}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 text-left"
              >
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-800 font-bold text-xs">
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
                    <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 border-2 border-[#071326]" />
                  ) : (
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-[#071326]" />
                  )}
                </div>
                <div className="hidden sm:block min-w-0 max-w-[130px]">
                  <p className="truncate text-xs font-semibold text-white leading-tight">
                    {user.name || "Tenant"}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    Tenant
                  </p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
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
            className="md:hidden rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
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
              className="fixed inset-y-0 left-0 z-50 w-72 bg-[#071326] p-4 text-white shadow-2xl md:hidden overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-sm">
                    <Image src="/images/landing/logo.png" alt="RentTrack" width={32} height={32} className="h-full w-full object-contain" />
                  </span>
                  <span className="font-bold text-white text-base">RentTrack</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
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
                      ? "bg-white/15 text-white"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
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
                      ? "bg-white/15 text-white"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
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
                        ? "bg-white/15 text-white"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4" />
                      <span>My Property</span>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", mobilePropertyOpen && "rotate-180")} />
                  </button>
                  {mobilePropertyOpen && (
                    <div className="ml-7 mt-1 space-y-1 border-l border-white/10 pl-3">
                      <Link
                        href="/dashboard/tenant/properties-page"
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                          isActive("/dashboard/tenant/properties-page")
                            ? "bg-white/15 text-white font-semibold"
                            : "text-slate-300 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        <span>My Property</span>
                      </Link>
                      <Link
                        href="/dashboard/tenant/units"
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                          isActive("/dashboard/tenant/units")
                            ? "bg-white/15 text-white font-semibold"
                            : "text-slate-300 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <Layers className="h-3.5 w-3.5 text-slate-400" />
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
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer text-left"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                      {unreadMessageCount > 0 && (
                        <span className="ml-auto rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
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
                          ? "bg-white/15 text-white"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </Link>
                  )
                )}
              </div>

              <div className="mt-6 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => { setConfirmLogout(true); setMobileOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Notifications Popover */}
      <AnimatePresence>
        {notificationsOpen && user && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            aria-label="Notifications"
            data-tenant-notifications
            className="fixed right-4 top-18 z-50 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden text-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {unreadCount ? `${unreadCount} unread` : "You're all caught up"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!user) return;
                      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                      await markAllNotificationsRead(user.id).catch(() => {});
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(false)}
                  aria-label="Close notifications"
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Check className="mx-auto mb-2 h-5 w-5 text-emerald-600" aria-hidden="true" />
                <p className="text-sm font-medium text-slate-800">Nothing new</p>
                <p className="mt-1 text-xs text-slate-500">New updates will show up here.</p>
              </div>
            ) : (
              <div className="max-h-[min(24rem,65vh)] overflow-y-auto divide-y divide-slate-100">
                {notifications.slice(0, 8).map((notification) => (
                  <button
                    type="button"
                    key={notification.id}
                    onClick={() => void openNotification(notification)}
                    className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", notification.read ? "bg-slate-200" : "bg-blue-600")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-900">{notification.title}</span>
                      <span className="mt-0.5 block line-clamp-2 text-xs leading-4 text-slate-500">{notification.message}</span>
                      <span className="mt-1 block text-[10px] text-slate-400">{formatDate(notification.createdAt)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.section>
        )}
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
