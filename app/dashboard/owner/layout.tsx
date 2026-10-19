"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import {
  LayoutDashboard, Home, MapPinned, FileText,
  CreditCard, BarChart3, LogOut, ChevronRight, Menu, X,
  Loader2, ChevronDown, ChevronLeft, Users, User, Bell, MessageSquare,
  ClipboardCheck, Building2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { cn, getInitials } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getNotifications, getAgentApplications, markNotificationRead, markAllMessagesRead, getUnreadCount, getPendingPaymentsCount, getConversations, getProperties, getUnits, Notification, Conversation, Property, Unit } from "@/lib/data";
import { getTenants } from "@/lib/data";
import Link from "next/link";
import MessagingPanel from "@/components/messaging-panel";
import MessagingModal from "@/components/messaging-modal";
import AccountRequestReviewModal from "@/components/account-request-review-modal";
import { Avatar } from "@/components/ui/avatar";
import { getNotificationDashboardHref } from "@/lib/notification-routing";

type OwnerNavSubItem = {
  label: string;
  tab: string;
  href: string;
  icon: LucideIcon;
};

type OwnerNavLink = {
  label: string;
  tab: string;
  href?: string;
  icon: LucideIcon;
  group?: string;
  children?: OwnerNavSubItem[];
};

const navItems: OwnerNavLink[] = [
  { label: "Dashboard", tab: "overview", href: "/dashboard/owner#overview", icon: LayoutDashboard },
  {
    label: "Units",
    tab: "units",
    href: "/dashboard/owner#units",
    icon: ClipboardCheck,
    group: "Management",
    children: [
      { label: "Properties", tab: "properties", href: "/dashboard/owner#properties", icon: Building2 },
      { label: "Occupancy", tab: "occupancy", href: "/dashboard/owner#occupancy", icon: BarChart3 },
    ],
  },
  { label: "Tenants", tab: "create-tenant", href: "/dashboard/owner#create-tenant", icon: User, group: "Management" },
  { label: "Agents", tab: "agents", href: "/dashboard/owner#agents", icon: Users, group: "Management" },
  { label: "Property Map", tab: "map", href: "/dashboard/owner#map", icon: MapPinned, group: "Management" },
  { label: "Contracts", tab: "contracts", href: "/dashboard/owner#contracts", icon: FileText, group: "Management" },
  { label: "Financial Transactions", tab: "financial", href: "/dashboard/owner#financial", icon: CreditCard },
  { label: "Move-out Requests", tab: "move-out-requests", href: "/dashboard/owner#move-out-requests", icon: LogOut },
];

const validOwnerTabs = new Set([
  "overview", "properties", "units", "assignments", "agents", "map",
  "create-tenant", "contracts", "occupancy", "payments", "receivables",
  "reports", "financial", "profile", "move-out-requests", "move-out"
]);

function getTabFromHash(hash: string) {
  if (!hash) return "";
  const cleanHash = hash.replace(/^#/, "").split("?")[0];
  if (cleanHash === "payments") return "financial";
  if (cleanHash === "move-out") return "move-out-requests";
  if (validOwnerTabs.has(cleanHash)) return cleanHash;
  for (const item of navItems) {
    if (item.href?.endsWith(`#${cleanHash}`)) return item.tab;
    if (item.children) {
      const child = item.children.find((c) => c.href.endsWith(`#${cleanHash}`));
      if (child) return child.tab;
    }
  }
  return "";
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
  const [unitsDropdownOpen, setUnitsDropdownOpen] = useState(false);

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
        setConversations(convs);
        const requests = convs.filter((c) => c.lastMessage?.subject === "Account Creation Request");
        setAccountRequests(requests);
      }).catch(() => { });
    };

    const handleMessagesRead = (e: Event) => {
      const customEvent = e as CustomEvent<{ otherUserId?: string }>;
      const otherId = customEvent.detail?.otherUserId;
      if (otherId) {
        setConversations((prev) => prev.map((c) => c.userId === otherId ? { ...c, unreadCount: 0 } : c));
      }
      getConversations().then((convs) => {
        setConversations(convs);
        setAccountRequests(convs.filter((c) => c.lastMessage?.subject === "Account Creation Request"));
      }).catch(() => {});
    };

    window.addEventListener("renttrack-notifications-updated", handleRefresh);
    window.addEventListener("renttrack-messages-read", handleMessagesRead);
    return () => {
      window.removeEventListener("renttrack-notifications-updated", handleRefresh);
      window.removeEventListener("renttrack-messages-read", handleMessagesRead);
    };
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
    setShowNotifications(false);
    setShowUserMenu(false);
    setMobileSidebarOpen(false);

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
        const hashPart = destination.hash ? destination.hash.replace(/^#/, "").split("?")[0] : "";
        const targetTab = getTabFromHash(hashPart) || hashPart || "overview";

        if (destination.pathname === "/dashboard/owner" || pathname === "/dashboard/owner") {
          if (targetTab) {
            setActiveTab(targetTab);
            window.location.hash = targetTab;
            window.dispatchEvent(new CustomEvent("owner-dashboard-tab-change", { detail: targetTab }));
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
      const isFirstInGroup = expanded && item.group && navItems[index - 1]?.group !== item.group;

      if (item.children) {
        const isExactActive = activeTab === item.tab;
        const isChildActive = item.children.some((c) => c.tab === activeTab);
        const isOpen = unitsDropdownOpen;

        return (
          <Fragment key={item.tab}>
            {isFirstInGroup && (
              <div className="pt-4 pb-1.5 px-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {item.group}
                </p>
              </div>
            )}
            <div className="space-y-1">
              <div
                className={cn(
                  "group relative flex w-full items-center justify-between rounded-xl text-[13px] font-medium transition-all duration-150",
                  isExactActive
                    ? "bg-blue-600 text-white font-semibold shadow-sm shadow-blue-500/20"
                    : isChildActive
                      ? "bg-white/[0.08] text-white font-semibold"
                      : "text-slate-300 hover:bg-white/[0.08] hover:text-white"
                )}
              >
                <Link
                  id={`${mobile ? "mobile-" : ""}sidebar-${item.tab}`}
                  title={expanded ? undefined : item.label}
                  href={item.href || "/dashboard/owner#units"}
                  onClick={() => {
                    handleNavigationClick("units", mobile);
                  }}
                  className={cn(
                    "flex flex-1 items-center gap-3 px-3 py-2.5 min-w-0 focus-visible:outline-none rounded-xl",
                    !expanded && "justify-center px-0 py-2.5 w-full"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0 transition-colors", (isExactActive || isChildActive) ? "text-white" : "text-slate-400 group-hover:text-white")} />
                  {expanded && <span className="truncate">{item.label}</span>}
                </Link>
                {expanded && (
                  <button
                    type="button"
                    aria-label="Toggle properties and occupancy dropdown"
                    title={isOpen ? "Collapse dropdown" : "Expand dropdown"}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setUnitsDropdownOpen((prev) => !prev);
                    }}
                    className="p-2.5 pr-3 text-slate-400 hover:text-white transition-colors cursor-pointer rounded-r-xl"
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", isOpen && "rotate-180", (isExactActive || isChildActive) && "text-white")} />
                  </button>
                )}
              </div>

              {expanded && isOpen && (
                <div className="space-y-1 pl-3.5 ml-4 border-l border-slate-800/80 my-1">
                  {item.children.map((sub) => {
                    const isSubActive = activeTab === sub.tab;
                    const SubIcon = sub.icon;
                    return (
                      <Link
                        key={sub.tab}
                        id={`${mobile ? "mobile-" : ""}sidebar-${sub.tab}`}
                        href={sub.href}
                        onClick={() => handleNavigationClick(sub.tab, mobile)}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer",
                          isSubActive
                            ? "bg-blue-600 text-white font-semibold shadow-xs shadow-blue-500/20"
                            : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                        )}
                      >
                        <SubIcon className={cn("h-3.5 w-3.5 shrink-0 transition-colors", isSubActive ? "text-white" : "text-slate-400 group-hover:text-white")} />
                        <span className="truncate">{sub.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </Fragment>
        );
      }

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
          {isFirstInGroup && (
            <div className="pt-4 pb-1.5 px-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {item.group}
              </p>
            </div>
          )}
          <Link
            id={`${mobile ? "mobile-" : ""}sidebar-${item.tab}`}
            title={expanded ? undefined : item.label}
            href={item.href || "#"}
            onClick={() => handleNavigationClick(item.tab, mobile)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
              isActive
                ? "bg-blue-600 text-white font-semibold shadow-sm shadow-blue-500/20"
                : "text-slate-300 hover:bg-white/[0.08] hover:text-white",
              !expanded && "justify-center px-0 py-2.5"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-white" : "text-slate-400 group-hover:text-white")} />
            {expanded && <span className="truncate">{item.label}</span>}
            {badgeCount > 0 && (
              <span className={cn(
                "flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-xs",
                expanded ? "ml-auto" : "absolute -top-1 -right-1 h-4 min-w-4 text-[9px]"
              )}>
                {badgeCount}
              </span>
            )}
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
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setMobileSidebarOpen(true)} className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="Open navigation menu">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 flex items-center justify-center">
            <Image src="/images/landing/logo.png" alt="RentTrack" width={28} height={28} className="h-7 w-7 object-contain" />
          </div>
          <span className="font-semibold text-sm text-slate-900">Owner Portal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button onClick={() => handleOpenNotifications()} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 relative">
              <Bell className="h-5 w-5" />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
            <AnimatePresence initial={false}>
              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-[65] bg-black/25 backdrop-blur-2xs lg:hidden"
                    onClick={() => setShowNotifications(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    onClick={(e) => e.stopPropagation()}
                    className="fixed left-3 right-3 top-14 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden z-[70]"
                  >
                    <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900 text-sm">Notifications</h3>
                        {notifications.filter(n => !n.read).length > 0 && (
                          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                            {notifications.filter(n => !n.read).length}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                        aria-label="Close notifications"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <p className="px-3 py-6 text-center text-xs text-slate-500">No notifications yet</p>
                      ) : (
                        notifications.slice(0, 10).map((n) => (
                          <button
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className="w-full text-left p-3 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                              {!n.read && (
                                <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          <button onClick={() => setShowLogoutModal(true)} className="p-2 rounded-lg hover:bg-rose-50 text-rose-600">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100dvh-53px)] lg:h-screen w-full overflow-hidden">
        {/* Sidebar */}
        <aside className={cn("hidden h-full shrink-0 flex-col border-r border-slate-800/80 bg-[#0a1120] text-slate-200 transition-[width] duration-200 motion-reduce:transition-none lg:flex", desktopSidebarOpen ? "w-60" : "w-16")}>
          {/* Header */}
          <div className={cn("flex items-center gap-3 border-b border-slate-800/80 py-4", desktopSidebarOpen ? "px-4" : "justify-center px-2")}>
            <Link href="/dashboard/owner" className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 shrink-0 flex items-center justify-center">
                <Image src="/images/landing/logo.png" alt="RentTrack" width={32} height={32} className="h-full w-full object-contain" />
              </div>
              {desktopSidebarOpen && (
                <div className="min-w-0">
                  <span className="block text-sm font-bold tracking-tight text-white leading-tight">RentTrack</span>
                  <span className="block text-[11px] font-medium text-slate-400 leading-tight mt-0.5">Owner Portal</span>
                </div>
              )}
            </Link>
          </div>

          {/* Navigation Links */}
          <nav aria-label="Owner navigation" className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
            {renderNavigation()}
          </nav>

          {/* Sidebar Footer Logout */}
          <div className="border-t border-slate-800/80 p-2.5">
            <button
              onClick={() => setShowLogoutModal(true)}
              title={desktopSidebarOpen ? undefined : "Logout"}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-xs font-semibold text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 cursor-pointer",
                !desktopSidebarOpen && "justify-center px-0 py-2.5"
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {desktopSidebarOpen && <span>Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* Mobile sidebar */}
        <AnimatePresence>
          {mobileSidebarOpen && (
            <motion.div
              initial={reduceMotion ? false : { x: -300 }}
              animate={{ x: 0 }}
              exit={reduceMotion ? undefined : { x: -300 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs"
              onClick={() => setMobileSidebarOpen(false)}
            >
              <motion.div
                initial={reduceMotion ? false : { x: -300 }}
                animate={{ x: 0 }}
                exit={reduceMotion ? undefined : { x: -300 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.21, 0.47, 0.32, 0.98] }}
                className="flex h-full w-64 flex-col border-r border-slate-800 bg-[#0a1120] text-slate-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-800 p-4">
                  <Link href="/dashboard/owner" className="flex items-center gap-2.5">
                    <div className="h-8 w-8 flex items-center justify-center">
                      <Image src="/images/landing/logo.png" alt="RentTrack" width={28} height={28} className="h-full w-full object-contain" />
                    </div>
                    <div>
                      <span className="block text-sm font-bold text-white">RentTrack</span>
                      <span className="block text-[10px] text-slate-400">Owner Portal</span>
                    </div>
                  </Link>
                  <button onClick={() => setMobileSidebarOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" aria-label="Close navigation menu">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <nav aria-label="Owner navigation" className="flex-1 overflow-y-auto p-3 space-y-0.5">
                  {renderNavigation(true)}
                </nav>
                <div className="border-t border-slate-800 p-3">
                  <button
                    onClick={() => {
                      setMobileSidebarOpen(false);
                      setShowLogoutModal(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Desktop header */}
        <div className="hidden lg:flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title={desktopSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              >
                {desktopSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <div>
                <h1 className="text-sm font-bold text-slate-900 tracking-tight">Owner Portal</h1>
                <p className="text-[11px] text-slate-500 -mt-0.5">Overview &amp; Management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={handleOpenNotifications}
                  className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Open notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </button>
                <AnimatePresence initial={false}>
                  {showNotifications && (
                    <>
                      <div className="fixed inset-0 z-[65]" onClick={() => setShowNotifications(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        className="absolute right-0 top-full z-[70] mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                          {notifications.filter(n => !n.read).length > 0 && (
                            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                              {notifications.filter(n => !n.read).length} unread
                            </span>
                          )}
                        </div>
                        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                          {notifications.length === 0 ? (
                            <p className="px-3 py-6 text-center text-xs text-slate-500">No notifications yet</p>
                          ) : notifications.slice(0, 10).map((notification) => (
                            <button key={notification.id} onClick={() => handleNotificationClick(notification)} className="w-full p-3 text-left hover:bg-slate-50 transition-colors">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-semibold text-slate-900">{notification.title}</p>
                                {!notification.read && (
                                  <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                                )}
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{notification.message}</p>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2.5 p-1.5 pl-2 rounded-xl hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200"
                >
                  <Avatar src={user.avatarUrl} fallback={getInitials(user.name)} size="sm" className="ring-1 ring-slate-200" />
                  <span className="hidden sm:block text-xs font-semibold text-slate-800">{user.name?.split(' ')[0] || "Owner"}</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence initial={false}>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden z-[70]"
                    >
                      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                        <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
                      </div>
                      <div className="p-2 space-y-0.5">
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            setActiveTab("profile");
                            window.location.hash = "profile";
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          <User className="h-4 w-4 text-slate-500" />
                          My Profile
                        </button>
                        <div className="border-t border-slate-100 pt-1 mt-1">
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              setShowMessages(true);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <MessageSquare className="h-4 w-4 text-slate-500" />
                            <span>Messages</span>
                            {conversations.some((conv) => conv.unreadCount > 0) && (
                              <span className="ml-auto rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {conversations.reduce((count, conv) => count + conv.unreadCount, 0)}
                              </span>
                            )}
                          </button>
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
                setConversations((prev) => prev.map((c) => c.userId === conv.userId ? { ...c, unreadCount: 0 } : c));
                void markAllMessagesRead(conv.userId);
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
