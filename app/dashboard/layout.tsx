"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import {
  Building2,
  LayoutDashboard,
  Home,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  AlertTriangle,
  User,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useRouter, usePathname } from "next/navigation";
import { cn, getInitials } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import IncomingCallOverlay from "@/components/incoming-call-overlay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getNotifications, markNotificationRead, markAllNotificationsRead, getUnreadMessageCount, Notification } from "@/lib/data";
import Link from "next/link";
import MessagingPanel from "@/components/messaging-panel";
import MessagingModal from "@/components/messaging-modal";
import { getNotificationDashboardHref } from "@/lib/notification-routing";

interface NavItem {
  label: string;
  href: string;
  icon: typeof Building2;
  roles: string[];
}

const navItems: NavItem[] = [
  { label: "My Dashboard", href: "/dashboard/tenant", icon: LayoutDashboard, roles: ["tenant"] },
  { label: "Overview", href: "/dashboard/owner", icon: LayoutDashboard, roles: ["admin", "owner", "agent"] },
  { label: "Properties", href: "/dashboard/properties", icon: Building2, roles: ["admin"] },
  { label: "Units", href: "/dashboard/units", icon: Home, roles: ["admin", "owner", "agent"] },
  { label: "Tenants", href: "/dashboard/tenants", icon: Users, roles: ["admin", "owner", "agent"] },
  { label: "Agents", href: "/dashboard/owner/agents", icon: Users, roles: ["owner"] },
  { label: "Payments", href: "/dashboard/payments", icon: CreditCard, roles: ["owner", "agent", "tenant"] },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart3, roles: ["admin", "owner"] },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["admin", "owner", "tenant"] },
];

const roleBadgeColor: Record<string, string> = {
  admin: "bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800",
  owner: "bg-primary-500/10 text-primary-600 border-primary-200 dark:border-primary-800",
  agent: "bg-secondary-500/10 text-secondary-600 border-secondary-200 dark:border-secondary-800",
  tenant: "bg-accent-500/10 text-accent-600 border-accent-200 dark:border-accent-800",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    // If user has a dedicated panel layout (tenant, admin, owner, agent), let that layout manage messaging
    if (user?.role && ["tenant", "admin", "owner", "agent"].includes(user.role)) return;

    const handleOpenMessages = (event: Event) => {
      const customEvent = event as CustomEvent<{ otherUser?: any }>;
      if (customEvent.detail?.otherUser) {
        setSelectedConversation({
          userId: customEvent.detail.otherUser.id,
          otherUser: customEvent.detail.otherUser,
        });
        setShowMessages(false);
      } else {
        setShowMessages(true);
      }
    };

    window.addEventListener("renttrack-open-messages", handleOpenMessages);
    return () => window.removeEventListener("renttrack-open-messages", handleOpenMessages);
  }, [user?.role]);

  useEffect(() => {
    if (user) {
      getNotifications(user.id).then(setNotifications).catch(() => setNotifications([]));
      getUnreadMessageCount().then(setUnreadMessageCount).catch(() => setUnreadMessageCount(0));
    }
  }, [user]);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full border-4 border-primary-200 border-t-primary-500 animate-spin mb-4" />
          <p className="text-text-secondary text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <p className="text-text-secondary">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  const filteredNav = navItems.filter((item) => item.roles.includes(user.role));
  const isTenant = user.role === "tenant";
  const isAdmin = user.role === "admin";
  const isOwner = user.role === "owner";
  const isAgent = user.role === "agent";
  const navLabel = (item: NavItem) => {
    if (item.href === "/dashboard/tenants" && (user.role === "admin" || user.role === "owner")) {
      return "Tenants";
    }
    if (item.href === "/dashboard/tenants" && user.role === "agent") {
      return "Tenants";
    }
    return item.label;
  };

   const isActiveItem = (item: NavItem) => {
     if (item.href === "/dashboard/owner") {
       return pathname === "/dashboard/owner" || pathname === "/dashboard/owner/";
     }
     if (item.href === "/dashboard/owner/agents") {
       return pathname.startsWith("/dashboard/owner/agents");
     }
     return pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
   };

   return (
     <div className={cn("min-h-screen", (!isOwner && !isAgent && !isTenant && !isAdmin) ? "flex bg-surface-secondary" : "")}>
      <AnimatePresence initial={false}>
        {mobileSidebarOpen && !isTenant && !isAdmin && !isAgent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          />
        )}
      </AnimatePresence>

       {!isAdmin && !isOwner && !isAgent && !isTenant && (
         <div className="flex flex-1">
          <aside
            className={cn(
              "fixed lg:relative z-50 h-screen bg-surface border-r border-border flex flex-col transition-all duration-300 ease-[cubic-bezier(0.21,0.47,0.32,0.98)]",
              "lg:block",
              mobileSidebarOpen ? "block translate-x-0" : "hidden lg:block",
              sidebarOpen ? "w-[260px]" : "w-[72px]"
            )}
            style={{ transform: mobileSidebarOpen ? 'translateX(0)' : undefined }}
          >
            <div className={cn("flex items-center h-16 px-4 border-b border-border", sidebarOpen ? "justify-between" : "justify-center")}>
              {sidebarOpen ? (
                <Link href="/" className="flex items-center gap-2">
                  <Image src="/images/landing/logo.png" alt="RentTrack" width={32} height={32} className="h-8 w-8 rounded-full object-contain" />
                  <span className="font-bold text-foreground">Rent<span className="text-primary-500">Track</span></span>
                </Link>
              ) : (
                <Image src="/images/landing/logo.png" alt="RT" width={32} height={32} className="h-8 w-8 rounded-full object-contain" />
              )}
              <button onClick={() => setMobileSidebarOpen(false)} className="lg:hidden p-1 rounded-lg hover:bg-surface-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-0.5">
              {filteredNav.map((item) => {
                const isActive = isActiveItem(item);
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 w-full",
                      isActive
                        ? "bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400"
                        : "text-text-secondary hover:text-foreground hover:bg-surface-tertiary"
                    )}
                  >
                    <IconComponent className={cn("relative h-5 w-5 shrink-0", isActive && "text-primary-600 dark:text-primary-400")} />
                    <span className="relative truncate text-sm font-medium">{navLabel(item)}</span>
                  </Link>
                );
              })}
            </nav>

            <div className={cn("p-3 border-t border-border", sidebarOpen ? "" : "flex flex-col items-center")}>
              <div className={cn("flex items-center gap-3 p-2 rounded-xl bg-surface-secondary", sidebarOpen ? "" : "flex-col")}>
                <Avatar
                  fallback={user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                  size="sm"
                />
                {sidebarOpen && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                    <Badge variant="outline" className={cn("mt-0.5 text-[10px] font-medium capitalize px-1.5 py-0", roleBadgeColor[user.role])}>
                      {user.role}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </aside>

          <div className="flex-1 flex flex-col min-w-0">
            <header className="sticky top-0 z-30 h-16 bg-surface/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-surface-secondary transition-colors">
                <Menu className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  setSidebarLoading(true);
                  setTimeout(() => {
                    setSidebarOpen(!sidebarOpen);
                    setSidebarLoading(false);
                  }, 200);
                }}
                className="hidden lg:block p-2 rounded-lg hover:bg-surface-secondary transition-colors relative"
              >
                {sidebarLoading ? (
                  <div className="h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                )}
              </button>
               <h1 className="text-lg font-semibold text-foreground hidden sm:block">
                 {(() => {
                   const activeItem = navItems.find((item) => isActiveItem(item));
                   if (activeItem) return navLabel(activeItem);
                   if (pathname.startsWith("/dashboard/owner/agents")) return "Agents";
                   if (pathname.startsWith("/dashboard/owner")) return "Owner Dashboard";
                   if (pathname.startsWith("/dashboard/agent")) return "Agent Dashboard";
                   if (pathname.startsWith("/dashboard/admin")) return "Admin Dashboard";
                   return "Dashboard";
                 })()}
               </h1>
            </div>

            <div className="flex items-center gap-2">

                <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-lg hover:bg-surface-secondary transition-colors text-text-secondary hover:text-foreground"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {unreadCount}
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
                      <div className="p-4 border-b border-border">
                        <h3 className="font-semibold text-foreground">Notifications</h3>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-sm text-text-secondary">
                            No notifications yet
                          </div>
                        ) : (
                          notifications.map((n) => (
                              <button
                                key={n.id}
                                onClick={async () => {
                                  if (!n.read) await markNotificationRead(n.id).catch(() => undefined);
                                  getNotifications(user.id).then(setNotifications).catch(() => {});
                                  setShowNotifications(false);
                                  router.push(getNotificationDashboardHref(n, user.role));
                                }}
                              className={cn(
                                "w-full text-left p-4 border-b border-border last:border-0 hover:bg-surface-secondary transition-colors",
                                !n.read && "bg-primary-50/50 dark:bg-primary-900/10"
                              )}
                            >
                              <div className="flex gap-3">
                                <div className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
                                  n.type === "payment" && "bg-green-50 text-green-600",
                                  n.type === "tenant" && "bg-blue-50 text-blue-600",
                                  n.type === "property" && "bg-amber-50 text-amber-600",
                                  n.type === "system" && "bg-purple-50 text-purple-600",
                                )}>
                                  {n.type === "payment" && <CreditCard className="h-4 w-4" />}
                                  {n.type === "tenant" && <Users className="h-4 w-4" />}
                                  {n.type === "property" && <Building2 className="h-4 w-4" />}
                                  {n.type === "system" && <Settings className="h-4 w-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                                  <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{n.message}</p>
                                  <p className="text-[10px] text-text-tertiary mt-1">
                                    {new Date(n.createdAt).toLocaleDateString("en-PH", {
                                      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                                    })}
                                  </p>
                                </div>
                                {!n.read && <div className="h-2 w-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                      {notifications.length > 0 && (
                        <div className="p-3 border-t border-border">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-xs"
                              onClick={async () => {
                                await markAllNotificationsRead(user.id);
                                getNotifications(user.id).then(setNotifications).catch(() => {});
                              }}
                            >
                              Mark all as read
                            </Button>
                        </div>
                      )}
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
                  <span className="hidden sm:block text-sm font-medium text-foreground">{user.name?.split(' ')[0] || "User"}</span>
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
                        <Link
                          href="/dashboard/settings"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-text-secondary hover:text-foreground hover:bg-surface-secondary transition-colors"
                        >
                          <User className="h-4 w-4" />
                          My Profile
                        </Link>
                        <button
                          onClick={() => { setShowUserMenu(false); setShowLogoutModal(true); }}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full transition-colors"
                        >
                          <LogOut className="h-4 w-4" />
                          Logout
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
      )}

       {isTenant && (
         <main className="flex-1 overflow-auto">
           {children}
         </main>
       )}

       {isAdmin && (
         <>{children}</>
       )}

        {isAgent && (
          <>{children}</>
        )}

        {isOwner && (
          <>{children}</>
        )}

        {/* Messaging Panel Modal - Only for fallback generic dashboard layout */}
        {!isTenant && !isAdmin && !isAgent && !isOwner && (
          <>
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

            {/* Direct Conversation Messaging Modal */}
            {selectedConversation?.otherUser && (
              <MessagingModal
                isOpen={Boolean(selectedConversation?.otherUser)}
                onClose={() => setSelectedConversation(null)}
                otherUser={selectedConversation.otherUser}
              />
            )}
          </>
        )}

       <IncomingCallOverlay />

       {showLogoutModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowLogoutModal(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 mb-4">
                {logoutLoading ? (
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-200 border-t-red-600" />
                ) : (
                  <AlertTriangle className="h-6 w-6" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">{logoutLoading ? "Logging out..." : "Log Out"}</h3>
              <p className="text-sm text-text-secondary mb-6">{logoutLoading ? "Please wait while we securely log you out." : "Are you sure you want to log out of your account?"}</p>
              <div className="flex w-full gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowLogoutModal(false)} disabled={logoutLoading}>Cancel</Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" disabled={logoutLoading} onClick={async () => { setLogoutLoading(true); logout(); router.push("/"); }}>Log Out</Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
