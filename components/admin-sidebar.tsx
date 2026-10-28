"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getUnreadMessageCount, getComplaints, getPayments } from "@/lib/data";
import {
  LayoutDashboard,
  Users,
  Home,
  Building2,
  BarChart3,
  DoorOpen,
  CreditCard,
  FileText,
  HeartPulse,
  MapPinned,
  SlidersHorizontal,
  LogOut,
  MessageSquare,
  User,
  X,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "framer-motion";

interface NavItem {
  label: string;
  href: string;
  tab: string;
  icon: any;
  children?: {
    label: string;
    href: string;
    tab: string;
    icon: any;
  }[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Main",
    items: [
      { label: "Dashboard", href: "/dashboard/admin", tab: "overview", icon: LayoutDashboard },
      { label: "Accounts", href: "/dashboard/admin?tab=users", tab: "users", icon: Users },
    ],
  },
  {
    title: "Management",
    items: [
      {
        label: "Rental Management",
        href: "/dashboard/admin?tab=properties",
        tab: "properties",
        icon: Building2,
        children: [
          { label: "Properties", href: "/dashboard/admin?tab=properties", tab: "properties", icon: Home },
          { label: "Units", href: "/dashboard/admin?tab=units", tab: "units", icon: DoorOpen },
          { label: "Occupancy", href: "/dashboard/admin?tab=occupancy", tab: "occupancy", icon: BarChart3 },
        ],
      },
      { label: "Property Map", href: "/dashboard/admin?tab=map", tab: "map", icon: MapPinned },
      { label: "Payments", href: "/dashboard/admin?tab=payments", tab: "payments", icon: CreditCard },
    ],
  },
  {
    title: "Communication",
    items: [
      { label: "Messages", href: "/dashboard/admin?tab=messages", tab: "messages", icon: MessageSquare },
      { label: "Support", href: "/dashboard/admin?tab=complaints", tab: "complaints", icon: HeartPulse },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Audit Logs", href: "/dashboard/admin?tab=audit", tab: "audit", icon: FileText },
      { label: "Configuration", href: "/dashboard/admin?tab=configuration", tab: "configuration", icon: SlidersHorizontal },
    ],
  },
];

export default function AdminSidebar({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [openComplaintsCount, setOpenComplaintsCount] = useState(0);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const reduceMotion = useReducedMotion();
  const [rentalManagementOpen, setRentalManagementOpen] = useState(false);


  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!user) {
      setUnreadMessageCount(0);
      setOpenComplaintsCount(0);
      setPendingPaymentsCount(0);
      return;
    }

    const refreshCounts = () => {
      getUnreadMessageCount().then(setUnreadMessageCount).catch(() => setUnreadMessageCount(0));
      getComplaints()
        .then((items) => setOpenComplaintsCount(items.filter((c) => c.status === "open" || c.status === "in_progress").length))
        .catch(() => setOpenComplaintsCount(0));
      getPayments()
        .then((items) => setPendingPaymentsCount(items.filter((p) => p.status === "pending").length))
        .catch(() => setPendingPaymentsCount(0));
    };

    refreshCounts();
    const interval = window.setInterval(refreshCounts, 30_000);
    window.addEventListener("focus", refreshCounts);
    window.addEventListener("renttrack-notifications-updated", refreshCounts);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshCounts);
      window.removeEventListener("renttrack-notifications-updated", refreshCounts);
    };
  }, [user]);

  const navigateTo = (tab: string) => {
    if (tab === "messages") {
      window.dispatchEvent(new CustomEvent("renttrack-open-messages"));
      return;
    }
    router.push(`/dashboard/admin?tab=${tab}`);
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    await logout();
    window.location.href = "/";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className={cn("mx-auto mb-4 h-12 w-12 rounded-full border-4 border-blue-600/20 border-t-blue-600", !reduceMotion && "animate-spin")} />
          <p className="text-slate-600 text-sm font-medium">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      {/* Sidebar */}
      <motion.aside
        initial={reduceMotion ? false : { x: -280 }}
        animate={{ x: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="fixed inset-y-0 left-0 z-50 hidden w-56 flex-col border-r border-slate-200/90 bg-white text-slate-800 shadow-xs lg:flex"
      >
        {/* Logo */}
        <Link href="/dashboard/admin" className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-100 px-3">
          <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
            <Image src="/images/landing/logo.png" alt="RentTrack" width={32} height={32} className="h-full w-full object-contain" />
          </span>
          <div>
            <span className="block text-xs font-bold tracking-tight text-slate-900">RentTrack</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Admin Console</span>
          </div>
        </Link>

        {/* Navigation */}
         <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
           {navSections.map((section) => (
             <motion.div
               key={section.title}
               initial={reduceMotion ? false : { opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: reduceMotion ? 0 : 0.22 }}
               className="mb-3"
             >
               <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                 {section.title}
               </p>
               <div className="space-y-1">
                 {section.items.map((item) => {
                   const isActive = activeTab === item.tab;
                   const isChildActive = item.children?.some((child) => child.tab === activeTab);
                   const Icon = item.icon;

                   if (item.children && item.children.length > 0) {
                     const isOpen = rentalManagementOpen;
                     return (
                       <div key={item.tab} className="space-y-1">
                         <div
                           className={cn(
                             "group relative flex w-full items-center justify-between rounded-xl text-[13px] font-medium transition-all duration-150",
                             isActive
                               ? "bg-blue-600 text-white font-semibold shadow-sm shadow-blue-500/25"
                               : isChildActive
                                 ? "bg-slate-100 text-slate-900 font-semibold"
                                 : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                           )}
                         >
                           <button
                             type="button"
                             onClick={() => {
                               
                               setRentalManagementOpen((prev) => !prev);
                             }}
                             className="flex flex-1 items-center gap-2 px-3 py-2 text-left focus-visible:outline-none cursor-pointer"
                           >
                             <Icon className={cn("relative h-4 w-4 shrink-0 transition-colors", (isActive || isChildActive) ? (isActive ? "text-white" : "text-blue-600") : "text-slate-400 group-hover:text-slate-600")} />
                             <span className="relative truncate text-[12px] font-medium">{item.label}</span>
                           </button>

                           <button
                             type="button"
                             aria-label="Toggle properties dropdown"
                             title={isOpen ? "Collapse dropdown" : "Expand dropdown"}
                             onClick={(e) => {
                               e.preventDefault();
                               e.stopPropagation();
                               setRentalManagementOpen((prev) => !prev);
                             }}
                             className={cn(
                               "p-2 pr-2.5 rounded-r-xl transition-colors cursor-pointer",
                               isActive ? "text-white/80 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
                             )}
                           >
                             <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
                           </button>

                           {isActive && (
                             <motion.span
                               layoutId={reduceMotion ? undefined : "admin-sidebar-dot"}
                               className="relative mr-2 h-1.5 w-1.5 rounded-full bg-white"
                               transition={{ duration: reduceMotion ? 0 : 0.2 }}
                             />
                           )}
                         </div>

                         <AnimatePresence initial={false}>
                           {isOpen && (
                             <motion.div
                               initial={{ opacity: 0, height: 0 }}
                               animate={{ opacity: 1, height: "auto" }}
                               exit={{ opacity: 0, height: 0 }}
                               transition={{ duration: 0.2, ease: "easeOut" }}
                               className="overflow-hidden space-y-1 pl-3.5 ml-3 border-l border-slate-200/90 my-1"
                             >
                               {item.children.map((sub) => {
                                 const isSubActive = activeTab === sub.tab;
                                 const SubIcon = sub.icon;
                                 return (
                                   <button
                                     key={sub.tab}
                                     type="button"
                                     onClick={() => navigateTo(sub.tab)}
                                     className={cn(
                                       "group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer",
                                       isSubActive
                                         ? "bg-blue-50 text-blue-700 font-bold"
                                         : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 font-medium"
                                     )}
                                   >
                                     <SubIcon className={cn("h-4 w-4 shrink-0 transition-colors", isSubActive ? "text-white" : "text-slate-400 group-hover:text-slate-600")} />
                                     <span className="truncate">{sub.label}</span>
                                     
                                   </button>
                                 );
                               })}
                             </motion.div>
                           )}
                         </AnimatePresence>
                       </div>
                     );
                   }

                   return (
                      <motion.button
                        key={item.tab}
                        onClick={() => navigateTo(item.tab)}
                         className={cn(
                           "relative flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                           isActive
                             ? "bg-blue-600 text-white font-semibold shadow-sm shadow-blue-500/25"
                             : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                         )}
                         whileHover={reduceMotion ? undefined : { x: 0.5 }}
                         whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                       >
                         <Icon className={cn("relative h-4 w-4 shrink-0 transition-colors", isActive ? "text-white" : "text-slate-400")} />
                         <span className="relative truncate text-[12px] font-medium">{item.label}</span>
                        {item.tab === "messages" && unreadMessageCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs">
                            {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                          </span>
                        )}
                        {item.tab === "complaints" && openComplaintsCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white shadow-xs">
                            {openComplaintsCount}
                          </span>
                        )}
                        {item.tab === "payments" && pendingPaymentsCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-bold text-white shadow-xs">
                            {pendingPaymentsCount}
                          </span>
                        )}
                        {isActive && (
                          <motion.span
                            layoutId={reduceMotion ? undefined : "admin-sidebar-dot"}
                            className="relative ml-auto h-1.5 w-1.5 rounded-full bg-white"
                            transition={{ duration: reduceMotion ? 0 : 0.2 }}
                          />
                       )}
                     </motion.button>
                   );
                 })}
               </div>
             </motion.div>
           ))}
          </nav>

        {/* Logout */}
        <div className="border-t border-slate-100 p-3">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </motion.aside>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs lg:hidden"
            onClick={onMobileClose}
          >
            <motion.aside
              initial={reduceMotion ? false : { x: -280 }}
              animate={{ x: 0 }}
              exit={reduceMotion ? undefined : { x: -280 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="flex h-full w-64 flex-col border-r border-slate-200 bg-white text-slate-800 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 px-4">
                <Link href="/dashboard/admin" className="flex items-center gap-2">
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
                    <Image src="/images/landing/logo.png" alt="RentTrack" width={32} height={32} className="h-full w-full object-contain" />
                  </span>
                  <div>
                    <span className="block text-xs font-bold tracking-tight text-slate-900">RentTrack</span>
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Admin Console</span>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={onMobileClose}
                  aria-label="Close navigation menu"
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto px-3 py-3">
                {navSections.map((section) => (
                  <div key={section.title} className="mb-3">
                    <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{section.title}</p>
                    <div className="space-y-1">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.tab;
                        const isChildActive = item.children?.some((child) => child.tab === activeTab);

                        if (item.children && item.children.length > 0) {
                          const isOpen = rentalManagementOpen;
                          return (
                            <div key={item.tab} className="space-y-1">
                              <div
                                className={cn(
                                  "group relative flex w-full items-center justify-between rounded-xl text-[13px] font-medium transition-all duration-150",
                                  isActive
                                    ? "bg-blue-600 text-white font-semibold shadow-sm shadow-blue-500/25"
                                    : isChildActive
                                      ? "bg-slate-100 text-slate-900 font-semibold"
                                      : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    // toggle dropdown
                                    setRentalManagementOpen((prev) => !prev);
                                  }}
                                  className="flex flex-1 items-center gap-2.5 px-3 py-2 text-left focus-visible:outline-none cursor-pointer"
                                >
                                  <Icon className={cn("h-4 w-4 shrink-0", (isActive || isChildActive) ? (isActive ? "text-white" : "text-blue-600") : "text-slate-400")} />
                                  <span className="truncate">{item.label}</span>
                                </button>
                                <button
                                  type="button"
                                  aria-label="Toggle properties dropdown"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setRentalManagementOpen((prev) => !prev);
                                  }}
                                  className={cn(
                                    "p-2 pr-2.5 rounded-r-xl transition-colors cursor-pointer",
                                    isActive ? "text-white/80 hover:text-white" : "text-slate-400 hover:text-slate-700"
                                  )}
                                >
                                  <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
                                </button>
                              </div>

                              <AnimatePresence initial={false}>
                                {isOpen && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                    className="overflow-hidden space-y-1 pl-3.5 ml-3 border-l border-slate-200/90 my-1"
                                  >
                                    {item.children.map((sub) => {
                                      const isSubActive = activeTab === sub.tab;
                                      const SubIcon = sub.icon;
                                      return (
                                        <button
                                          key={sub.tab}
                                          type="button"
                                          onClick={() => {
                                            navigateTo(sub.tab);
                                            onMobileClose();
                                          }}
                                          className={cn(
                                            "group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer",
                                            isSubActive
                                              ? "bg-blue-50 text-blue-700 font-bold"
                                              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 font-medium"
                                          )}
                                        >
                                          <SubIcon className={cn("h-4 w-4 shrink-0 transition-colors", isSubActive ? "text-white" : "text-slate-400 group-hover:text-slate-600")} />
                                          <span className="truncate">{sub.label}</span>
                                          
                                        </button>
                                      );
                                    })}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        }

                        return (
                          <button
                            key={item.tab}
                            type="button"
                            onClick={() => { navigateTo(item.tab); onMobileClose(); }}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                              isActive
                                ? "bg-blue-600 text-white font-semibold shadow-sm shadow-blue-500/25"
                                : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                            )}
                          >
                            <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-400")} />
                            <span className="truncate">{item.label}</span>
                            {item.tab === "messages" && unreadMessageCount > 0 && (
                              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs">
                                {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                              </span>
                            )}
                            {item.tab === "complaints" && openComplaintsCount > 0 && (
                              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white shadow-xs">
                                {openComplaintsCount}
                              </span>
                            )}
                            {item.tab === "payments" && pendingPaymentsCount > 0 && (
                              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-bold text-white shadow-xs">
                                {pendingPaymentsCount}
                              </span>
                            )}
                            {isActive && <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-white" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
              <div className="border-t border-slate-100 p-3">
                <button
                  type="button"
                  onClick={() => { onMobileClose(); setShowLogoutModal(true); }}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

        {showLogoutModal && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLogoutModal(false)} />
            <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
                  {logoutLoading ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-200 border-t-red-600" />
                  ) : (
                    <LogOut className="h-7 w-7" />
                  )}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{logoutLoading ? "Logging out..." : "Log Out"}</h3>
                <p className="text-sm text-gray-500 mb-6">{logoutLoading ? "Please wait while we securely log you out." : "Are you sure you want to log out of the admin console?"}</p>
                <div className="flex w-full gap-3">
                  <button onClick={() => setShowLogoutModal(false)} disabled={logoutLoading} className="flex-1 px-4 py-2 rounded-xl border border-border hover:bg-surface-secondary transition-colors disabled:opacity-50">Cancel</button>
                  <button onClick={handleLogout} disabled={logoutLoading} className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50">{logoutLoading ? "Logging out..." : "Log Out"}</button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
  );
}
