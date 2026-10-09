"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import {
  LayoutDashboard, Home, MapPinned, CreditCard, Send, LogOut, ChevronRight, Menu, X, Award,
  Loader2, ChevronDown, ChevronLeft, Bell, Mail, User, FileText, Settings,
} from "lucide-react";
import { getNotifications, getUnreadMessageCount, getUnreadInquiryCount, markNotificationRead, markAllNotificationsRead, Notification } from "@/lib/data";
import { getProperties, Property } from "@/lib/data";
import MessagingPanel from "@/components/messaging-panel";
import MessagingModal from "@/components/messaging-modal";
import { getNotificationDashboardHref } from "@/lib/notification-routing";

const navItems = [
  { label: "Dashboard", tab: "overview", href: "/dashboard/agent#overview", icon: LayoutDashboard },
  { label: "Financial Transactions", tab: "payments", href: "/dashboard/agent#payments", icon: CreditCard },
  { label: "Contracts", tab: "contracts", href: "/dashboard/agent#contracts", icon: FileText },
  { label: "Certificates", tab: "certificates", href: "/dashboard/agent#certificates", icon: Award },
  { label: "Landing Inquiries", tab: "inquiries", href: "/dashboard/agent#inquiries", icon: Mail },
  { label: "Units", tab: "units", href: "/dashboard/agent#units", icon: Home },
  { label: "Property Map", tab: "map", href: "/dashboard/agent#map", icon: MapPinned },
];

const agentContentTabs = ["messages", "profile", "tenants"];

function normalizeAgentTab(tab: string) {
  if (tab === "properties" || tab === "assign") return "units";
  if (tab === "history") return "payments";
  return tab;
}

function getTabFromHash() {
  const hash = normalizeAgentTab(window.location.hash.replace("#", ""));
  if (hash && (navItems.some((item) => item.tab === hash) || agentContentTabs.includes(hash))) return hash;
  return "overview";
}

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAuthenticated, isLoading, refreshUser } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(getTabFromHash);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalSearchNoResults, setGlobalSearchNoResults] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unreadInquiryCount, setUnreadInquiryCount] = useState(0);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [isMessagingOpen, setIsMessagingOpen] = useState(false);
  const [agentProperties, setAgentProperties] = useState<Property[]>([]);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    (async () => {
      try {
        const props = await getProperties(user);
        setAgentProperties(props);
      } catch (err) {
        console.error("Failed to load properties for messaging", err);
      }
    })();
  }, [user]);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const customEvent = event as CustomEvent<{ otherUser?: any }>;
      if (customEvent.detail?.otherUser) {
        setSelectedConversation({
          otherUser: customEvent.detail.otherUser,
          userId: customEvent.detail.otherUser.id,
        });
        setIsMessagingOpen(true);
        setShowMessages(false);
      } else {
        setShowMessages(true);
      }
    };
    window.addEventListener("renttrack-open-messages", handleOpen);
    return () => window.removeEventListener("renttrack-open-messages", handleOpen);
  }, []);

  useEffect(() => {
    const readHash = () => {
      const rawHash = window.location.hash.replace("#", "");
      const hash = normalizeAgentTab(rawHash);
      if (hash && (navItems.some((item) => item.tab === hash) || agentContentTabs.includes(hash))) {
        setActiveTab(hash as any);
        if (rawHash !== hash) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${hash}`);
      }
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  useEffect(() => {
    const handleGlobalSearchResult = (event: Event) => {
      const { query, found } = (event as CustomEvent<{ query: string; found: boolean }>).detail || {};
      setGlobalSearchNoResults(query && !found ? query : "");
    };
    window.addEventListener("agent-global-search-result", handleGlobalSearchResult);
    return () => window.removeEventListener("agent-global-search-result", handleGlobalSearchResult);
  }, []);

  useEffect(() => {
    const activeButton = document.getElementById(`sidebar-${activeTab}`);
    if (activeButton) {
      activeButton.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeTab]);

  const refreshCounts = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadMessageCount(0);
      setUnreadInquiryCount(0);
      return;
    }

    const [nextNotifications, nextMessages, nextInquiries] = await Promise.all([
      getNotifications(user.id).catch((error) => {
        console.error("Failed to load agent notifications:", error);
        return [];
      }),
      getUnreadMessageCount().catch((error) => {
        console.error("Failed to load unread agent messages:", error);
        return 0;
      }),
      getUnreadInquiryCount().catch((error) => {
        console.error("Failed to load unread agent inquiries:", error);
        return 0;
      }),
    ]);
    setNotifications(nextNotifications);
    setUnreadMessageCount(nextMessages);
    setUnreadInquiryCount(nextInquiries);
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    refreshUser();
    const interval = window.setInterval(() => {
      void refreshUser();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [user?.id, refreshUser]);

  useEffect(() => {
    if (!user) return;
    refreshCounts();
    const handleUpdated = () => {
      void refreshCounts();
    };
    const handleProfileUpdated = () => {
      void refreshUser();
      setTimeout(() => refreshCounts(), 300);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshCounts();
    };
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshCounts();
    }, 30_000);
    window.addEventListener("renttrack-notifications-updated", handleUpdated);
    window.addEventListener("renttrack-profile-updated", handleProfileUpdated);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("renttrack-notifications-updated", handleUpdated);
      window.removeEventListener("renttrack-profile-updated", handleProfileUpdated);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [user, refreshCounts, refreshUser]);

  const handleLogout = async () => {
    setLogoutLoading(true);
    logout();
    router.push("/login");
  };

  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.read && !notification.title.toLowerCase().startsWith("new landing inquiry")
  ).length;
  const unreadCount = unreadNotificationCount + unreadInquiryCount;
  const unreadBadge = unreadCount > 99 ? "99+" : unreadCount;

  const openAgentTab = (tab: string) => {
    const normalizedTab = normalizeAgentTab(tab);
    setActiveTab(normalizedTab as any);
    window.location.hash = normalizedTab;
  };

  const submitGlobalSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = globalSearch.trim();
    if (!query) return;
    setGlobalSearchNoResults("");
    window.sessionStorage.setItem("agent-global-search", query);
    window.dispatchEvent(new CustomEvent("agent-global-search", { detail: { query } }));
  };

  const handleOpenNotifications = async () => {
    const nextOpen = !showNotifications;
    setShowNotifications(nextOpen);

    if (!nextOpen || !user) return;

    try {
      await refreshUser();
      await markAllNotificationsRead(user.id);
      setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
      window.dispatchEvent(new Event("renttrack-notifications-updated"));
    } catch (err) {
      console.error("Failed to refresh user or mark notifications as read:", err);
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) {
      await markNotificationRead(n.id).catch(() => {});
      setNotifications((current) => current.map((notification) => notification.id === n.id ? { ...notification, read: true } : notification));
      window.dispatchEvent(new Event("renttrack-notifications-updated"));
    }
    setShowNotifications(false);

    const href = getNotificationDashboardHref(n, "agent");
    const destination = new URL(href, window.location.origin);
    const tab = normalizeAgentTab(destination.hash.replace("#", ""));
    if (destination.pathname === window.location.pathname && destination.hash) {
      if (tab) setActiveTab(tab as any);
      return;
    }
    router.push(`${destination.pathname}${destination.search}${destination.hash}`);
  };

  useEffect(() => {
    if (!user || !isAuthenticated) {
      router.push("/login");
    }
  }, [user, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
      <div className="min-h-screen flex-1 bg-[#f3f7fc]">
      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileSidebarOpen(true)} className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="Open navigation menu">
              <Menu className="h-5 w-5" />
            </button>
            <span className="shrink-0 text-sm font-semibold text-slate-900">Agent Panel</span>
          </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-label="Open profile menu"
              aria-expanded={showUserMenu}
              className="relative rounded-lg p-1.5 hover:bg-surface-secondary"
            >
              <Avatar src={user.avatarUrl} fallback={user.name.split(" ").map((name: string) => name[0]).join("").toUpperCase().slice(0, 2)} size="sm" />
            </button>
            <AnimatePresence initial={false}>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-surface shadow-dropdown overflow-hidden z-50"
                >
                  <div className="p-3 border-b border-border">
                    <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                    <p className="text-xs text-text-secondary truncate">{user.email}</p>
                  </div>
                  <div className="p-1.5">
                    <button onClick={() => { setShowUserMenu(false); setShowMessages(true); }} className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-text-secondary hover:bg-surface-secondary hover:text-foreground w-full transition-colors cursor-pointer">
                      <Send className="h-4 w-4" />
                      <span className="flex-1 text-left">Messages</span>
                      {unreadMessageCount > 0 && <span className="min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-xs">{unreadMessageCount}</span>}
                    </button>
                    <button onClick={() => { setShowUserMenu(false); openAgentTab("profile"); }} className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-text-secondary hover:bg-surface-secondary hover:text-foreground w-full transition-colors">
                      <User className="h-4 w-4" /> My Profile
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="relative">
            <button onClick={() => setShowNotifications(!showNotifications)} aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`} aria-expanded={showNotifications} className="p-2 rounded-lg hover:bg-surface-secondary relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadBadge}
                </span>
              )}
            </button>
            <AnimatePresence initial={false}>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl border border-border bg-surface shadow-dropdown overflow-hidden z-50"
                >
                  <div className="p-3 border-b border-border flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-foreground text-sm">Notifications</h3>
                    {unreadNotificationCount > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          await markAllNotificationsRead(user.id);
                          setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
                          window.dispatchEvent(new Event("renttrack-notifications-updated"));
                        }}
                        className="text-xs text-primary-600 hover:text-primary-700"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs text-text-secondary">No notifications yet</p>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <button
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={cn(
                            "w-full text-left p-3 border-b border-border last:border-0 hover:bg-surface-secondary transition-colors cursor-pointer",
                            !n.read && "bg-primary-50/50"
                          )}
                        >
                          <p className="text-xs font-medium text-foreground">{n.title}</p>
                          <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-2">{n.message}</p>
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

      <div className="flex h-screen w-full">
        {/* Sidebar */}
        <div className={cn("hidden lg:flex h-full shrink-0 flex-col border-r border-white/10 bg-[#07111f] text-slate-200 transition-[width] duration-200 motion-reduce:transition-none", sidebarOpen ? "w-56" : "w-16")}>
          <div className="border-b border-white/10 p-4">
            <Link href="/dashboard/agent" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full overflow-hidden">
                <Image src="/images/landing/logo.png" alt="RentTrack" width={32} height={32} className="h-full w-full object-contain" />
              </div>
              {sidebarOpen && <span className="min-w-0"><span className="block text-sm font-bold leading-tight text-white">RentTrack</span><span className="mt-0.5 block text-[10px] leading-tight text-slate-400">Property Management</span></span>}
            </Link>
          </div>
          <nav aria-label="Agent navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.tab;
              return (
                <button
                  key={item.tab}
                  id={`sidebar-${item.tab}`}
                  onClick={() => {
                    setActiveTab(item.tab);
                    window.location.hash = item.tab;
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 motion-reduce:transition-none motion-reduce:hover:translate-x-0",
                    isActive
                      ? "bg-blue-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.22)]"
                      : "text-slate-400 hover:translate-x-0.5 hover:bg-white/[0.06] hover:text-white"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-500")} />
                  {sidebarOpen && <span className="truncate">{item.label}</span>}
                  {item.tab === "inquiries" && unreadInquiryCount > 0 && (
                    <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {unreadInquiryCount}
                    </span>
                  )}
                  {isActive && sidebarOpen && <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)]" />}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto space-y-2 border-t border-white/10 p-3">
            <button
              onClick={() => setShowLogoutModal(true)}
              className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {sidebarOpen && <span className="truncate">Logout</span>}
            </button>
          </div>
          </div>

        {/* Mobile sidebar */}
        <AnimatePresence>
          {mobileSidebarOpen && (
            <motion.div
              initial={reduceMotion ? false : { x: -300 }}
              animate={{ x: 0 }}
              exit={reduceMotion ? undefined : { x: -300 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="lg:hidden fixed inset-0 z-50 bg-black/50"
              onClick={() => setMobileSidebarOpen(false)}
            >
              <motion.div
                initial={reduceMotion ? false : { x: -300 }}
                animate={{ x: 0 }}
                exit={reduceMotion ? undefined : { x: -300 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.21, 0.47, 0.32, 0.98] }}
                className="flex h-full w-64 flex-col border-r border-white/10 bg-[#07111f] text-slate-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-white/10 p-4">
                  <Link href="/dashboard/agent" className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full overflow-hidden">
                      <Image src="/images/landing/logo.png" alt="RentTrack" width={32} height={32} className="h-full w-full object-contain" />
                    </div>
                    <span><span className="block text-sm font-bold leading-tight text-white">RentTrack</span><span className="mt-0.5 block text-[10px] leading-tight text-slate-400">Property Management</span></span>
                  </Link>
                  <button onClick={() => setMobileSidebarOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" aria-label="Close navigation menu">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <nav aria-label="Agent navigation" className="flex-1 space-y-1 overflow-y-auto p-3">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.tab;
                    return (
                      <button
                        key={item.tab}
                        id={`sidebar-${item.tab}`}
                        onClick={() => {
                          setActiveTab(item.tab);
                          window.location.hash = item.tab;
                          setMobileSidebarOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 motion-reduce:transition-none motion-reduce:hover:translate-x-0",
                          isActive
                            ? "bg-blue-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.22)]"
                            : "text-slate-400 hover:translate-x-0.5 hover:bg-white/[0.06] hover:text-white"
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-500")} />
                        <span className="truncate">{item.label}</span>
                        {item.tab === "inquiries" && unreadInquiryCount > 0 && (
                          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                            {unreadInquiryCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
                <div className="mt-auto space-y-2 border-t border-white/10 p-3">
                  <button
                    onClick={() => setShowLogoutModal(true)}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="truncate">Logout</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Desktop header */}
        <div className="hidden lg:flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <h1 className="whitespace-nowrap text-lg font-semibold text-slate-900">Agent Panel</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  onClick={handleOpenNotifications}
                  aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
                  aria-expanded={showNotifications}
                  className="relative p-2 rounded-lg hover:bg-surface-secondary transition-colors text-text-secondary hover:text-foreground"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unreadBadge}
                    </span>
                  )}
                </button>
                <AnimatePresence initial={false}>
                  {showNotifications && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-border bg-surface shadow-dropdown overflow-hidden"
                    >
                      <div className="p-4 border-b border-border flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-foreground">Notifications</h3>
                        {unreadNotificationCount > 0 && (
                          <button
                            type="button"
                            onClick={async () => {
                              await markAllNotificationsRead(user.id);
                              setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
                              window.dispatchEvent(new Event("renttrack-notifications-updated"));
                            }}
                            className="text-xs text-primary-600 hover:text-primary-700"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="px-4 py-8 text-center text-sm text-text-secondary">No notifications yet</p>
                        ) : (
                          notifications.slice(0, 10).map((n) => (
                            <button
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              className={cn(
                                "w-full text-left p-4 border-b border-border last:border-0 hover:bg-surface-secondary transition-colors cursor-pointer",
                                !n.read && "bg-primary-50/50"
                              )}
                            >
                              <p className="text-sm font-medium text-foreground">{n.title}</p>
                              <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{n.message}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-secondary transition-all relative"
                >
                  <div className="relative">
                    <Avatar src={user.avatarUrl} fallback={user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)} size="sm" />
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface ${user.idVerificationStatus === "approved" ? "bg-green-500" : user.idVerificationStatus === "rejected" ? "bg-red-500" : user.idVerificationStatus === "pending" ? "bg-yellow-500" : "bg-slate-400"}`} title={user.idVerificationStatus === "approved" ? "Verified" : user.idVerificationStatus === "rejected" ? "Rejected" : user.idVerificationStatus === "pending" ? "Pending" : "Unverified"} />
                  </div>
                  <span className="text-[10px] font-medium text-text-secondary hidden sm:block">
                    {user.idVerificationStatus === "approved" ? "Verified" : user.idVerificationStatus === "rejected" ? "Rejected" : user.idVerificationStatus === "pending" ? "Pending" : "Unverified"}
                  </span>
                  <span className="hidden sm:block text-sm font-medium text-foreground">{user.name.split(' ')[0]}</span>
                  <ChevronDown className={`h-4 w-4 text-text-secondary transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence initial={false}>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-surface shadow-dropdown overflow-hidden"
                    >
                      <div className="p-3 border-b border-border">
                        <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                        <p className="text-xs text-text-secondary truncate">{user.email}</p>
                      </div>
                      <div className="p-1.5">
                        <button
                          onClick={() => { setShowUserMenu(false); setShowMessages(true); }}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-text-secondary hover:bg-surface-secondary hover:text-foreground w-full transition-colors cursor-pointer"
                        >
                          <Send className="h-4 w-4" />
                          <span className="flex-1 text-left">Messages</span>
                          {unreadMessageCount > 0 && <span className="min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">{unreadMessageCount}</span>}
                        </button>
                        <button
                          onClick={() => { setShowUserMenu(false); openAgentTab("profile"); }}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-text-secondary hover:bg-surface-secondary hover:text-foreground w-full transition-colors"
                        >
                          <User className="h-4 w-4" />
                          My Profile
                        </button>
                        <Link
                          href="/dashboard/settings"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-text-secondary hover:bg-surface-secondary hover:text-foreground w-full transition-colors"
                        >
                          <Settings className="h-4 w-4" />
                          <span>Account settings</span>
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto bg-[#f3f7fc]">
            <div className="w-full p-4 sm:p-6">
              {globalSearchNoResults && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">No results found for “{globalSearchNoResults}” in transactions, contracts, inquiries, or units.</p>}
              {children}
            </div>
          </main>
        </div>

        {/* Mobile main content */}
        <main className="lg:hidden flex-1 overflow-y-auto bg-[#f3f7fc]">
          <div className="w-full p-4">
            {globalSearchNoResults && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">No results found for “{globalSearchNoResults}” in transactions, contracts, inquiries, or units.</p>}
            {children}
          </div>
        </main>

        {showLogoutModal && createPortal(
          <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowLogoutModal(false)} />
            <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
                  {logoutLoading ? (
                    <Loader2 className="h-7 w-7 animate-spin" />
                  ) : (
                    <LogOut className="h-7 w-7" />
                  )}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{logoutLoading ? "Logging out..." : "Log Out"}</h3>
                <p className="text-sm text-gray-500 mb-6">{logoutLoading ? "Please wait while we securely log you out." : "Are you sure you want to log out of your account?"}</p>
                <div className="flex w-full gap-3">
                  <button onClick={() => setShowLogoutModal(false)} disabled={logoutLoading} className="flex-1 px-4 py-2 rounded-xl border border-border hover:bg-surface-secondary transition-colors disabled:opacity-50">Cancel</button>
                  <button onClick={handleLogout} disabled={logoutLoading} className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50">{logoutLoading ? "Logging out..." : "Log Out"}</button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        <AnimatePresence>
          {showMessages && (
            <MessagingPanel
              isOpen={showMessages}
              onClose={() => setShowMessages(false)}
              onSelectConversation={(conv) => {
                setSelectedConversation(conv);
                setIsMessagingOpen(true);
                setShowMessages(false);
              }}
              asModal
            />
          )}
        </AnimatePresence>

        {selectedConversation && (
          <MessagingModal
            isOpen={isMessagingOpen}
            onClose={() => {
              setIsMessagingOpen(false);
              setSelectedConversation(null);
            }}
            otherUser={{
              id: selectedConversation.otherUser?.id || "",
              name: selectedConversation.otherUser?.name || "Unknown",
              email: selectedConversation.otherUser?.email || "",
              role: selectedConversation.otherUser?.role || "tenant",
              avatarUrl: selectedConversation.otherUser?.avatarUrl,
              allowMessages: true,
            }}
            properties={agentProperties.map(p => ({ id: p.id, name: p.name, location: p.location, type: p.type, units: p.units, rentAmount: p.monthlyRevenue }))}
          />
        )}
      </div>
    </div>
  );
}
