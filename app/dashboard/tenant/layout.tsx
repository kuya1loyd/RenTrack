"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { LogOut, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import TenantNavbar from "@/components/tenant-navbar";
import MessagingPanel from "@/components/messaging-panel";
import MessagingModal from "@/components/messaging-modal";
import { Conversation, getProperties, getUnits, Property, Unit } from "@/lib/data";
import styles from "@/components/tenant-panel.module.css";

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // Global Tenant Messaging Modal State
  const [showMessages, setShowMessages] = useState(false);
  const [activeChatUser, setActiveChatUser] = useState<NonNullable<Conversation["otherUser"]> | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([getProperties(user), getUnits(user)])
      .then(([p, u]) => {
        setProperties(p || []);
        setUnits(u || []);
      })
      .catch(() => {});
  }, [user]);

  const propertiesWithUnits = properties.map((property) => ({
    ...property,
    unitNames: units.filter((unit) => unit.propertyId === property.id).map((unit) => unit.unitNumber),
  }));

  useEffect(() => {
    const handleOpenMessages = (event: Event) => {
      const customEvent = event as CustomEvent<{ otherUser?: Conversation["otherUser"] }>;
      if (customEvent.detail?.otherUser) {
        setActiveChatUser(customEvent.detail.otherUser as NonNullable<Conversation["otherUser"]>);
        setShowMessages(false);
      } else {
        setShowMessages(true);
      }
    };

    window.addEventListener("renttrack-open-messages", handleOpenMessages);
    return () => window.removeEventListener("renttrack-open-messages", handleOpenMessages);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f9ff]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="mx-auto h-16 w-16 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin mb-4" />
          <p className="text-gray-600 font-medium">Loading your dashboard...</p>
        </motion.div>
      </div>
    );
  }

  if (!user || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f9ff]">
        <div className="text-center">
          <p className="text-gray-600 font-medium">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <TenantNavbar />

      {/* Main Content */}
      <main id="tenant-main-content" className={styles.main}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={styles.content}
        >
          {children}
        </motion.div>
      </main>

      <footer className="w-full py-5 text-center text-xs text-slate-500 border-t border-slate-200/80 bg-white/70 backdrop-blur-xs mt-auto">
        © 2026 RentTrack. All rights reserved.
      </footer>

      {/* Global Tenant Messaging Panel Modal */}
      <AnimatePresence>
        {showMessages && (
          <MessagingPanel
            isOpen={showMessages}
            onClose={() => setShowMessages(false)}
            onSelectConversation={(conv) => {
              if (conv.otherUser) {
                setActiveChatUser(conv.otherUser as NonNullable<Conversation["otherUser"]>);
              }
              setShowMessages(false);
            }}
            asModal
          />
        )}
      </AnimatePresence>

      {/* Direct Chat Messaging Modal */}
      {activeChatUser && (
        <MessagingModal
          isOpen={true}
          onClose={() => setActiveChatUser(null)}
          otherUser={activeChatUser}
          properties={propertiesWithUnits}
        />
      )}

      {showLogoutModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
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
              <p className="text-sm text-gray-500 mb-6">Are you sure you want to log out of your account?</p>
              <div className="flex w-full gap-3">
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
