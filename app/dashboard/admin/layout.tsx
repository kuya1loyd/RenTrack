"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getNotifications, markNotificationRead, markAllNotificationsRead, markAllMessagesRead, getUnreadCount, getConversations, getUnreadMessageCount, getProperties, getUnits, Notification, Conversation, Property, Unit } from "@/lib/data";
import AdminSidebar from "@/components/admin-sidebar";
import AccountRequestReviewModal from "@/components/account-request-review-modal";
import MessagingPanel from "@/components/messaging-panel";
import MessagingModal from "@/components/messaging-modal";
import { Avatar } from "@/components/ui/avatar";
import { Bell, ChevronDown, Menu, User, Settings } from "lucide-react";
import { getNotificationDashboardHref } from "@/lib/notification-routing";
import { AdminDataProvider } from "@/lib/admin-data-store";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const reduceMotion = useReducedMotion();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [accountRequests, setAccountRequests] = useState<Conversation[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedAccountRequest, setSelectedAccountRequest] = useState<Conversation | null>(null);

  // Messaging Modal State
  const [showMessages, setShowMessages] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, router]);

  const refreshNotificationsCount = useCallback(async () => {
    if (!user) return;
    try {
      const count = await getUnreadCount(user.id);
      setUnreadNotificationsCount(count);
    } catch {
      // ignore
    }
  }, [user]);

  const refreshMessagesCount = useCallback(async () => {
    try {
      const count = await getUnreadMessageCount();
      setUnreadMessagesCount(count);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (user) {
      getNotifications(user.id).then(setNotifications).catch(() => setNotifications([]));
      refreshNotificationsCount();
      refreshMessagesCount();
      Promise.all([getProperties(user), getUnits(user)])
        .then(([p, u]) => {
          setProperties(p || []);
          setUnits(u || []);
        })
        .catch(() => {});
      getConversations().then((convs) => {
        setConversations(convs);
        const requests = convs.filter((c) => c.lastMessage?.subject === "Account Creation Request");
        setAccountRequests(requests);
      }).catch(() => {
        setConversations([]);
        setAccountRequests([]);
      });
    }
  }, [user, refreshNotificationsCount, refreshMessagesCount]);

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
    const handleRefresh = () => {
      if (!user) return;
      getNotifications(user.id).then(setNotifications).catch(() => {});
      refreshNotificationsCount();
      refreshMessagesCount();
      getConversations().then((convs) => {
        setConversations(convs);
        const requests = convs.filter((c) => c.lastMessage?.subject === "Account Creation Request");
        setAccountRequests(requests);
      }).catch(() => {});
    };

    const handleMessagesRead = (e: Event) => {
      const customEvent = e as CustomEvent<{ otherUserId?: string }>;
      const otherId = customEvent.detail?.otherUserId;
      if (otherId) {
        setConversations((prev) => prev.map((c) => c.userId === otherId ? { ...c, unreadCount: 0 } : c));
      }
      refreshMessagesCount();
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
  }, [user, refreshNotificationsCount, refreshMessagesCount]);

  useEffect(() => {
    if (!user) return;
    const refreshNotifications = () => {
      getNotifications(user.id).then(setNotifications).catch(() => {});
      refreshNotificationsCount();
      refreshMessagesCount();
    };
    const interval = window.setInterval(refreshNotifications, 30_000);
    window.addEventListener("focus", refreshNotifications);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshNotifications);
    };
  }, [user, refreshNotificationsCount, refreshMessagesCount]);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

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
      router.push(getNotificationDashboardHref(notification, user?.role || "admin"));
    }
  };

  const handleOpenNotifications = async () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications && user) {
      try {
        const updated = await getNotifications(user.id);
        setNotifications(updated);
        refreshNotificationsCount();
      } catch {
        // ignore
      }
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50/30">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="mx-auto h-16 w-16 rounded-full border-4 border-gray-200 border-t-gray-900 animate-spin mb-4" />
          <p className="text-gray-600 font-medium">Loading admin panel...</p>
        </motion.div>
      </div>
    );
  }

  if (!user || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <p className="text-gray-600 font-medium">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminDataProvider userId={user.id}>
    <div className="min-h-screen flex w-full max-w-full overflow-x-hidden bg-[#f3f7fc]">
      {/* Sidebar - fixed on all screens */}
      <AdminSidebar mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />

      {/* Main Area - offset for fixed sidebar */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.22 }}
          className="flex min-h-screen w-full min-w-0 max-w-full flex-1 flex-col lg:ml-56 lg:w-[calc(100%-14rem)] lg:max-w-[calc(100%-14rem)] overflow-x-hidden"
        >
          {/* Top Header */}
          <motion.header
            initial={reduceMotion ? false : { y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
            className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6"
          >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-sm font-semibold text-slate-900">Admin Panel</h2>
          </div>

          {/* Right side - Notifications */}
          <div className="flex items-center gap-2">

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={handleOpenNotifications}
                className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Bell className="h-5 w-5" />
                {Math.max(unreadNotificationsCount, notifications.filter((n) => !n.read).length) > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg"
                  >
                    {Math.max(unreadNotificationsCount, notifications.filter((n) => !n.read).length) > 99
                      ? "99+"
                      : Math.max(unreadNotificationsCount, notifications.filter((n) => !n.read).length)}
                  </motion.span>
                )}
              </button>

              <AnimatePresence initial={false}>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full mt-2 right-0 w-80 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-50"
                  >
                    <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
                      <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                      {notifications.some((n) => !n.read) && (
                        <button
                          onClick={async () => {
                            if (!user) return;
                            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                            setUnreadNotificationsCount(0);
                            await markAllNotificationsRead(user.id).catch(() => {});
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-gray-500">No notifications yet</p>
                      ) : (
                        notifications.slice(0, 10).map((n) => (
                            <button
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              className={`w-full text-left p-4 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                                !n.read ? "bg-blue-50/40" : ""
                              }`}
                            >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
                              {!n.read && <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.message}</p>
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
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Avatar src={user.avatarUrl || "/images/admin-avatar.jpg"} alt={`${user.name} profile picture`} fallback={user.name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase()} size="sm" />
                <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300">{user.name?.split(' ')[0] || "Admin"}</span>
                <ChevronDown className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full mt-2 right-0 w-72 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl z-50 overflow-hidden"
                    >
                      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            Admin
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{user.email}</p>
                      </div>
                      <div className="p-2 space-y-1">
                        <Link
                          href="/dashboard/admin?tab=settings"
                          onClick={() => setShowUserMenu(false)}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors w-full cursor-pointer ${
                            activeTab === "settings"
                              ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-semibold"
                              : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                        >
                          <Settings className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span>Settings</span>
                        </Link>


                        {conversations.length > 0 && (
                          <div className="border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setShowUserMenu(false);
                                setShowMessages(true);
                              }}
                              className="w-full text-left px-3 py-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-text-secondary hover:text-foreground cursor-pointer"
                            >
                              <span>Messages</span>
                              <span className="text-blue-600 font-medium normal-case">Open Inbox</span>
                            </button>
                            {conversations.slice(0, 5).map((conv) => (
                              <button
                                key={conv.userId}
                                type="button"
                                onClick={() => {
                                  setShowUserMenu(false);
                                  setConversations((prev) => prev.map((c) => c.userId === conv.userId ? { ...c, unreadCount: 0 } : c));
                                  setUnreadMessagesCount((prev) => Math.max(0, prev - (conv.unreadCount || 1)));
                                  void markAllMessagesRead(conv.userId);
                                  if (conv.lastMessage?.subject === "Account Creation Request") {
                                    setSelectedAccountRequest(conv);
                                  } else {
                                    setSelectedConversation(conv);
                                  }
                                }}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-secondary transition-colors cursor-pointer"
                              >
                                <p className="text-xs font-medium text-foreground truncate">{conv.otherUser?.name || "Unknown"}</p>
                                <p className="text-[10px] text-text-secondary truncate">{conv.lastMessage?.body?.split('\n').slice(0, 2).join(' ')}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.header>

        {/* Page Content */}
        <main className="flex-1 w-full min-w-0 max-w-full overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <motion.div
            key={activeTab}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="w-full min-w-0 max-w-full"
          >
            {children}
          </motion.div>
        </main>

        {/* Messaging Panel Modal */}
        <AnimatePresence>
          {showMessages && (
            <MessagingPanel
              isOpen={showMessages}
              onClose={() => setShowMessages(false)}
              onSelectConversation={(conv) => {
                setConversations((prev) => prev.map((c) => c.userId === conv.userId ? { ...c, unreadCount: 0 } : c));
                setUnreadMessagesCount((prev) => Math.max(0, prev - (conv.unreadCount || 1)));
                void markAllMessagesRead(conv.userId);
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
            properties={properties.map((p) => ({
              ...p,
              unitNames: units.filter((u) => u.propertyId === p.id).map((u) => u.unitNumber),
            }))}
          />
        )}

        <AccountRequestReviewModal
          request={selectedAccountRequest}
          onClose={() => setSelectedAccountRequest(null)}
          onCreated={() => {
            getConversations().then((convs) => {
              setConversations(convs);
              setAccountRequests(convs.filter((conv) => conv.lastMessage?.subject === "Account Creation Request"));
            }).catch(() => {});
          }}
        />
      </motion.div>
    </div>
    </AdminDataProvider>
  );
}
