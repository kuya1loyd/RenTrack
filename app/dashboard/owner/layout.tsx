"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import {
  LayoutDashboard, Home, MapPinned, FileText,
  CreditCard, BarChart3, LogOut, ChevronRight, Menu, X,
  Loader2, ChevronDown, ChevronLeft, Users, User, Bell, MessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { cn, getInitials } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getNotifications, getAgentApplications, markNotificationRead, getUnreadCount, getPendingPaymentsCount, getConversations, getProperties, getUnits, Notification, Conversation, Property, Unit } from "@/lib/data";
import { getTenants } from "@/lib/data";
import Link from "next/link";
import MessagingPanel from "@/components/messaging-panel";
import MessagingModal from "@/components/messaging-modal";
import AccountRequestReviewModal from "@/components/account-request-review-modal";
import { Avatar } from "@/components/ui/avatar";
import { getNotificationDashboardHref } from "@/lib/notification-routing";

type OwnerNavLink = {
  label: string;
  tab: string;
  href: string;
  icon: LucideIcon;
  group?: string;
};

const navItems: OwnerNavLink[] = [
  { label: "Dashboard", tab: "overview", href: "/dashboard/owner#overview", icon: LayoutDashboard },
  { label: "Properties & Units", tab: "units", href: "/dashboard/owner#units", icon: Home, group: "Management" },
  { label: "Tenants", tab: "create-tenant", href: "/dashboard/owner#create-tenant", icon: User, group: "Management" },
  { label: "Agents", tab: "agents", href: "/dashboard/owner#agents", icon: Users, group: "Management" },
  { label: "Property Map", tab: "map", href: "/dashboard/owner#map", icon: MapPinned, group: "Management" },
  { label: "Contracts", tab: "contracts", href: "/dashboard/owner#contracts", icon: FileText, group: "Management" },
  { label: "Financial Transactions", tab: "financial", href: "/dashboard/owner#financial", icon: CreditCard },
  { label: "Move-out Requests", tab: "move-out-requests", href: "/dashboard/owner#move-out-requests", icon: LogOut },
];

function getTabFromHash(hash: string) {
  if (hash === "payments" || hash === "reports") return "financial";
  if (hash === "move-out") return "move-out-requests";
  return navItems.find((item) => item.href.endsWith(`#${hash}`))?.tab || "";
}

function getActiveTab(pathname: string, hash: string) {
  if (pathname === "/dashboard/owner/agents" || pathname.startsWith("/dashboard/owner/agents/")) return "agents";
  if (pathname === "/dashboard/owner") return getTabFromHash(hash) || "overview";
  return getTabFromHash(hash);
}

function filterOwnerNotifications(items: Notification[]): Notification[] {
  return (items || []).filter((n) => {
    const text = `${n.title || ""} ${n.message || ""}`.toLowerCase();
    return !text.includes("support request") && !text.includes("to support") && !text.includes("new support");
  });
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [showMessages, setShowMessages] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [pendingAssignmentsCount, setPendingAssignmentsCount] = useState(0);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [pendingAgentApplicationsCount, setPendingAgentApplicationsCount] = useState(0);
  const [accountRequests, setAccountRequests] = useState<Conversation[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedAccountRequest, setSelectedAccountRequest] = useState<Conversation | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const unreadMessagesCount = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, router]);

  const refreshNotificationsCount = useCallback(async () => {
    if (!user) return;
    try {
      const items = await getNotifications(user.id);
      const filtered = filterOwnerNotifications(items);
      setUnreadNotificationsCount(filtered.filter((n) => !n.read).length);
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    const handleOpenMessages = (event: Event) => {
      const customEvent = event as CustomEvent<{ otherUser?: Conversation["otherUser"] }>;
      if (customEvent.detail?.otherUser) {
        setSelectedConversation({
          userId: customEvent.detail.otherUser.id,
          otherUser: customEvent.detail.otherUser,
          lastMessage: null as any,
          unreadCount: 0,
        });
        setShowMessages(false);
      } else {
        setShowMessages(true);
      }
    };

    window.addEventListener("renttrack-open-messages", handleOpenMessages);
    return () => window.removeEventListener("renttrack-open-messages", handleOpenMessages);
  }, []);

  useEffect(() => {
    if (user) {
      getNotifications(user.id)
        .then((items) => setNotifications(filterOwnerNotifications(items)))
        .catch(() => setNotifications([]));
      refreshNotificationsCount();
      Promise.all([getProperties(user), getUnits(user)])
        .then(([p, u]) => {
          setProperties(p || []);
          setUnits(u || []);
        })
        .catch(() => {});
      getTenants(user).then((tenants) => {
        const pending = tenants.filter((t: any) => t.assignmentStatus === "pending" && t.unitId).length;
        setPendingAssignmentsCount(pending);
      }).catch(() => setPendingAssignmentsCount(0));
      getPendingPaymentsCount().then(setPendingPaymentsCount).catch(() => setPendingPaymentsCount(0));
      getConversations().then((convs) => {
        setConversations(convs);
        const requests = convs.filter((c) => c.lastMessage?.subject === "Account Creation Request");
        setAccountRequests(requests);
      }).catch(() => {
        setConversations([]);
        setAccountRequests([]);
      });
    }
  }, [user, refreshNotificationsCount]);

  useEffect(() => {
    if (!user) return;
    const refreshNotifications = () => {
      getNotifications(user.id)
        .then((items) => setNotifications(filterOwnerNotifications(items)))
        .catch(() => { });
      refreshNotificationsCount();
    };
    const interval = window.setInterval(refreshNotifications, 30_000);
    window.addEventListener("focus", refreshNotifications);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshNotifications);
    };
  }, [user, refreshNotificationsCount]);

  useEffect(() => {
    if (!user) {
      setPendingAgentApplicationsCount(0);
      return;
    }

    let active = true;
    const refreshPendingApplications = async () => {
      try {
        const applications = await getAgentApplications("pending");
        if (active) setPendingAgentApplicationsCount(applications.length);
      } catch {
        if (active) setPendingAgentApplicationsCount(0);
      }
    };

    void refreshPendingApplications();
    const interval = window.setInterval(refreshPendingApplications, 30_000);
    window.addEventListener("focus", refreshPendingApplications);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshPendingApplications);
    };
  }, [user]);

  useEffect(() => {
    const handleRefresh = () => {
      if (!user) return;
      getNotifications(user.id)
        .then((items) => setNotifications(filterOwnerNotifications(items)))
        .catch(() => { });
      refreshNotificationsCount();
      getTenants(user).then((tenants) => {
        const pending = tenants.filter((t: any) => t.assignmentStatus === "pending" && t.unitId).length;
        setPendingAssignmentsCount(pending);
      }).catch(() => { });
      getPendingPaymentsCount().then(setPendingPaymentsCount).catch(() => { });
      getConversations().then((convs) => {
        const requests = convs.filter((c) => c.lastMessage?.subject === "Account Creation Request");
        setAccountRequests(requests);
      }).catch(() => { });
    };

    window.addEventListener("renttrack-notifications-updated", handleRefresh);
    return () => window.removeEventListener("renttrack-notifications-updated", handleRefresh);
  }, [user, refreshNotificationsCount]);

  useEffect(() => {
    const refreshPending = () => {
      if (user) getTenants(user).then((tenants) => setPendingAssignmentsCount(tenants.filter((tenant: any) => tenant.assignmentStatus === "pending" && tenant.unitId).length)).catch(() => { });
    };
    window.addEventListener("owner-data-changed", refreshPending);
    return () => window.removeEventListener("owner-data-changed", refreshPending);
  }, [user]);

  useEffect(() => {
    const refreshProfile = () => {
      if (user) getTenants(user).then((tenants) => setPendingAssignmentsCount(tenants.filter((tenant: any) => tenant.assignmentStatus === "pending" && tenant.unitId).length)).catch(() => { });
    };
    window.addEventListener("renttrack-profile-updated", refreshProfile);
    return () => window.removeEventListener("renttrack-profile-updated", refreshProfile);
  }, [user]);

  useEffect(() => {
    const refreshPayments = () => {
      if (user) getPendingPaymentsCount().then(setPendingPaymentsCount).catch(() => setPendingPaymentsCount(0));
    };
    window.addEventListener("payment-confirmed", refreshPayments);
    return () => window.removeEventListener("payment-confirmed", refreshPayments);
  }, [user]);

  const handleNotificationClick = async (notification: Notification) => {
    setShowNotifications(false);
    const isAccountCreationRequest = notification.title === "Account Creation Request";
    if (isAccountCreationRequest) {
      const loadedRequest = accountRequests.find((conv) => conv.lastMessage?.body === notification.message)
        || accountRequests[0];
      if (loadedRequest) {
        setSelectedAccountRequest(loadedRequest);
      } else {
        void getConversations().then((convs) => {
          const request = convs.find((conv) => conv.lastMessage?.subject === "Account Creation Request" && conv.lastMessage.body === notification.message)
            || convs.find((conv) => conv.lastMessage?.subject === "Account Creation Request");
          if (request) setSelectedAccountRequest(request);
        }).catch(() => undefined);
      }
    }
    if (!notification.read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
      setUnreadNotificationsCount((prev) => Math.max(0, prev - 1));
      await markNotificationRead(notification.id).catch(() => {});
    }
    if (!isAccountCreationRequest) {
      const href = getNotificationDashboardHref(notification, user?.role || "owner");
      if (href === "/dashboard/owner#messages") {
        setShowMessages(true);
      } else {
        const destination = new URL(href, window.location.origin);
        if (destination.pathname === "/dashboard/owner") {
          const tab = getActiveTab(destination.pathname, destination.hash.slice(1));
          if (tab) {
            setActiveTab(tab);
            window.dispatchEvent(new CustomEvent("owner-dashboard-tab-change", { detail: tab }));
          }
        }
        router.push(href);
      }
    }
  };

  const handleOpenNotifications = async () => {
    setShowNotifications(!showNotifications);
    setShowUserMenu(false);
    if (!showNotifications && user) {
      try {
        const updated = await getNotifications(user.id);
        const filtered = filterOwnerNotifications(updated);
        setNotifications(filtered);
        setUnreadNotificationsCount(filtered.filter((n) => !n.read).length);
      } catch {
      }
    }
  };

  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "messages") {
        setShowMessages(true);
        return;
      }
      const tab = getActiveTab(pathname, hash);
      if (tab) setActiveTab(tab);
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, [pathname]);

  useEffect(() => {
    const activeButton = document.getElementById(`sidebar-${activeTab}`);
    if (activeButton) {
      activeButton.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeTab]);

  useEffect(() => {
    const syncActiveTab = () => {
      const hash = window.location.hash.replace("#", "");
      const tab = getActiveTab(pathname, hash);
      if (tab) setActiveTab(tab);
    };

    syncActiveTab();
    window.addEventListener("hashchange", syncActiveTab);
    return () => window.removeEventListener("hashchange", syncActiveTab);
  }, [pathname]);

  const handleNavigationClick = (tab: string, mobile: boolean) => {
    if (mobile) setMobileSidebarOpen(false);
    if (pathname === "/dashboard/owner") {
      setActiveTab(tab);
      window.dispatchEvent(new CustomEvent("owner-dashboard-tab-change", { detail: tab }));
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    logout();
    router.push("/");
  };

  const renderNavigation = (mobile = false) => {
    const expanded = mobile || desktopSidebarOpen;

    return navItems.map((item, index) => {
      const Icon = item.icon;
      const isActive = activeTab === item.tab;
      const badgeCount = item.tab === "agents"
        ? pendingAgentApplicationsCount
        : item.tab === "financial"
          ? pendingPaymentsCount
          : item.tab === "create-tenant"
            ? pendingAssignmentsCount
            : 0;

      return (
        <Fragment key={item.tab}>
          {expanded && item.group && navItems[index - 1]?.group !== item.group && (
            <p className="mb-2 mt-5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              {item.group}
            </p>
          )}
          <Link
            id={`${mobile ? "mobile-" : ""}sidebar-${item.tab}`}
            title={expanded ? undefined : item.label}
            href={item.href}
            onClick={() => handleNavigationClick(item.tab, mobile)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 motion-reduce:transition-none motion-reduce:hover:translate-x-0",
              isActive
                ? "bg-blue-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.22)]"
                : "text-slate-400 hover:translate-x-0.5 hover:bg-white/[0.06] hover:text-white",
              !expanded && "justify-center px-0"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-500")} />
            {expanded && <span className="truncate">{item.label}</span>}
            {badgeCount > 0 && (
              <span className={cn(
                "flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white",
                expanded ? "ml-auto" : "absolute right-1 top-1 h-2 min-w-0 p-0"
              )}>
                {expanded ? badgeCount : ""}
              </span>
            )}
            {isActive && expanded && <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)]" />}
          </Link>
        </Fragment>
      );
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-gray-900 font-medium text-lg">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  const selectedOtherUser = selectedConversation?.otherUser;

  return (
    <div className="min-h-screen flex-1 bg-[#f3f7fc]">
      {/* Mobile header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 p-4 backdrop-blur lg:hidden">
        <button onClick={() => setMobileSidebarOpen(true)} className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="Open navigation menu">
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-semibold text-sm">Owner Panel</span>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button onClick={() => handleOpenNotifications()} className="p-2 rounded-lg hover:bg-surface-secondary relative">
              <Bell className="h-5 w-5" />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
            <AnimatePresence initial={false}>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-700 bg-surface shadow-dropdown overflow-hidden z-[70]"
                >
                  <div className="p-3 border-b border-slate-700">
                    <h3 className="font-semibold text-foreground text-sm">Notifications</h3>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-3 py-6 text-center text-xs text-text-secondary">No notifications yet</p>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <button
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className="w-full text-left p-3 border-b border-slate-700 last:border-0 hover:bg-surface-secondary transition-colors"
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
          <button onClick={() => setShowLogoutModal(true)} className="p-2 rounded-lg hover:bg-surface-secondary text-red-600">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex h-screen w-full">
        {/* Sidebar */}
        <div className={cn("hidden h-full shrink-0 flex-col border-r border-white/10 bg-[#07111f] text-slate-200 transition-[width] duration-200 motion-reduce:transition-none lg:flex", desktopSidebarOpen ? "w-56" : "w-16")}>
          <div className={cn("border-b border-white/10 py-4", desktopSidebarOpen ? "px-4" : "px-3")}>
            <Link href="/dashboard/owner" className="flex items-center gap-2">
              <div className="h-8 w-8 shrink-0 rounded-full overflow-hidden">
                <Image src="/images/landing/logo.png" alt="RentTrack" width={64} height={64} className="h-full w-full object-contain" />
              </div>
              {desktopSidebarOpen && <span className="text-sm font-bold text-white">Owner Panel</span>}
            </Link>
          </div>
          <nav aria-label="Owner navigation" className="flex-1 overflow-y-auto px-3 py-3">
            {renderNavigation()}
          </nav>
          <div className={cn("mt-auto border-t border-white/10 py-3", desktopSidebarOpen ? "px-3" : "px-2")}>
            <button
              onClick={() => setShowLogoutModal(true)}
              title={desktopSidebarOpen ? undefined : "Logout"}
              className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400", !desktopSidebarOpen && "justify-center px-0")}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {desktopSidebarOpen && <span className="truncate">Logout</span>}
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
                  <Link href="/dashboard/owner" className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-600 to-secondary-600 flex items-center justify-center">
                      <LayoutDashboard className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm font-bold text-white">Owner Panel</span>
                  </Link>
                  <button onClick={() => setMobileSidebarOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" aria-label="Close navigation menu">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <nav aria-label="Owner navigation" className="flex-1 overflow-y-auto p-3">
                  {renderNavigation(true)}
                </nav>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Desktop header */}
        <div className="hidden lg:flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
                className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {desktopSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <h1 className="text-sm font-semibold text-slate-900">Owner Panel</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  onClick={handleOpenNotifications}
                  className="relative rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-secondary hover:text-foreground"
                  aria-label="Open notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </button>
                <AnimatePresence initial={false}>
                  {showNotifications && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      className="absolute right-0 top-full z-[70] mt-2 w-80 overflow-hidden rounded-xl border border-slate-700 bg-surface shadow-dropdown"
                    >
                      <div className="border-b border-slate-700 p-3">
                        <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="px-3 py-6 text-center text-xs text-text-secondary">No notifications yet</p>
                        ) : notifications.slice(0, 10).map((notification) => (
                          <button key={notification.id} onClick={() => handleNotificationClick(notification)} className="w-full border-b border-slate-700 p-3 text-left last:border-0 hover:bg-surface-secondary">
                            <p className="text-sm font-medium text-foreground">{notification.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{notification.message}</p>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-secondary transition-all"
                >
                  <Avatar src={user.avatarUrl} fallback={getInitials(user.name)} size="sm" />
                  <span className="hidden sm:block text-sm font-medium text-foreground">{user.name?.split(' ')[0] || "Owner"}</span>
                  <ChevronDown className={`h-4 w-4 text-text-secondary transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence initial={false}>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-700 bg-surface shadow-dropdown overflow-hidden z-[70]"
                    >
                      <div className="p-3 border-b border-slate-700">
                        <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                        <p className="text-xs text-text-secondary truncate">{user.email}</p>
                      </div>
                      <div className="p-2 space-y-0.5">
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            setActiveTab("profile");
                            window.location.hash = "profile";
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-secondary hover:text-foreground transition-colors"
                        >
                          <User className="h-4 w-4" />
                          My Profile
                        </button>
                        <div className="border-t border-slate-700 pt-1 mt-1">
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              setShowMessages(true);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-text-secondary hover:bg-surface-secondary hover:text-foreground"
                          >
                            <MessageSquare className="h-4 w-4" />
                            <span>Messages</span>
                            {conversations.some((conv) => conv.unreadCount > 0) && (
                              <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {conversations.reduce((count, conv) => count + conv.unreadCount, 0)}
                              </span>
                            )}
                          </button>
                          {conversations.length === 0 ? (
                            <p className="px-3 pb-2 text-[11px] text-text-secondary">No messages yet</p>
                          ) : conversations.slice(0, 5).map((conv) => (
                            <button
                              key={conv.userId}
                              onClick={() => {
                                setShowUserMenu(false);
                                if (conv.lastMessage?.subject === "Account Creation Request") {
                                  setSelectedAccountRequest(conv);
                                } else {
                                  setSelectedConversation(conv);
                                }
                              }}
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-secondary transition-colors"
                            >
                              <p className="text-xs font-medium text-foreground truncate">{conv.otherUser?.name || "Unknown"}</p>
                              <p className="text-[10px] text-text-secondary truncate">{conv.lastMessage?.body?.split('\n').slice(0, 2).join(' ')}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="w-full p-6">
              {children}
            </div>
          </main>
        </div>

        {/* Mobile main content */}
        <main className="lg:hidden flex-1 overflow-y-auto">
          <div className="w-full p-4">
            {children}
          </div>
        </main>

        <AnimatePresence>
          {showMessages && (
            <MessagingPanel
              isOpen={showMessages}
              onClose={() => setShowMessages(false)}
              onSelectConversation={(conv) => {
                setSelectedConversation(conv);
                setShowMessages(false);
              }}
              asModal
            />
          )}
        </AnimatePresence>

        <AccountRequestReviewModal
          request={selectedAccountRequest}
          onClose={() => setSelectedAccountRequest(null)}
          onCreated={() => {
            getConversations().then((convs) => {
              setConversations(convs);
              setAccountRequests(convs.filter((conv) => conv.lastMessage?.subject === "Account Creation Request"));
            }).catch(() => { });
          }}
        />
        {selectedOtherUser && (
          <MessagingModal
            isOpen={true}
            onClose={() => setSelectedConversation(null)}
            otherUser={selectedOtherUser as NonNullable<Conversation["otherUser"]>}
            properties={(properties || []).map((p) => ({
              ...p,
              unitNames: (units || []).filter((u) => u?.propertyId === p.id).map((u) => u.unitNumber),
            }))}
          />
        )}

        {showLogoutModal && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
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
                  <button onClick={() => setShowLogoutModal(false)} disabled={logoutLoading} className="flex-1 px-4 py-2 rounded-xl border border-slate-700 hover:bg-surface-secondary transition-colors disabled:opacity-50">Cancel</button>
                  <button onClick={handleLogout} disabled={logoutLoading} className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50">{logoutLoading ? "Logging out..." : "Log Out"}</button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
