"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X, MessageSquare, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials, cn } from "@/lib/utils";
import { getConversations, markAllMessagesRead, Conversation } from "@/lib/data";
import { toast } from "sonner";

interface MessagingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation?: (conv: Conversation) => void;
  fullPage?: boolean;
  floating?: boolean;
  asModal?: boolean;
}

export default function MessagingPanel({
  isOpen,
  onClose,
  onSelectConversation,
  fullPage = false,
  floating = false,
  asModal = false,
}: MessagingPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [mounted, setMounted] = useState(false);

  const isModalMode = (floating || asModal) && !fullPage;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      const timeout = new Promise<Conversation[]>((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), 10000)
      );
      Promise.race([getConversations(), timeout])
        .then((convs) => {
          setConversations(convs as Conversation[]);
        })
        .catch((err) => {
          if (err instanceof Error && err.message === "Request timeout") {
            toast.error("Loading messages timed out. Please try again.");
          } else {
            toast.error("Failed to load conversations");
          }
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isModalMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isModalMode, onClose]);

  const handleConversationClick = async (conv: Conversation) => {
    setConversations((prev) =>
      prev.map((c) => (c.userId === conv.userId ? { ...c, unreadCount: 0 } : c))
    );
    onSelectConversation?.(conv);
    onClose();
    await markAllMessagesRead(conv.userId).catch(() => undefined);
  };

  const filteredConversations = conversations.filter((conversation) => {
    const searchableText = `${conversation.otherUser?.name || ""} ${conversation.lastMessage?.subject || ""} ${conversation.lastMessage?.body || ""}`;
    return searchableText.toLowerCase().includes(searchTerm.trim().toLowerCase());
  });

  // Modal mode (centered dialog with backdrop)
  if (isModalMode) {
    if (!isOpen) return null;

    const modalContent = (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-lg rounded-2xl bg-white dark:bg-surface border border-slate-200 dark:border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex h-14 items-center justify-between border-b border-border px-5 bg-white dark:bg-surface">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Messages</h3>
                <p className="text-xs text-text-tertiary">Select a conversation to chat</p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              aria-label="Close messages"
              className="rounded-xl p-2 text-text-tertiary hover:bg-surface-secondary hover:text-foreground transition-colors cursor-pointer z-50 pointer-events-auto"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search bar */}
          <div className="p-3 border-b border-border bg-slate-50/50 dark:bg-surface-secondary/40">
            <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-white dark:bg-surface px-3 text-text-tertiary focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900/30 transition-all">
              <Search className="h-4 w-4 shrink-0 text-text-tertiary" />
              <span className="sr-only">Search messages</span>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search conversations..."
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-text-tertiary"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="text-xs text-text-tertiary hover:text-foreground cursor-pointer"
                >
                  Clear
                </button>
              )}
            </label>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto max-h-[460px] divide-y divide-border">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-7 w-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs text-text-tertiary">Loading conversations...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center text-sm text-text-secondary">
                <div className="h-12 w-12 rounded-2xl bg-surface-secondary flex items-center justify-center mb-3 text-text-tertiary">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <p className="font-medium text-foreground">
                  {searchTerm.trim() ? "No matching messages" : "No messages yet"}
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  {searchTerm.trim() ? "Try searching with a different term" : "Your conversations will appear here"}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv, index) => (
                <motion.button
                  key={conv.userId}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => handleConversationClick(conv)}
                  className={cn(
                    "w-full text-left p-3.5 hover:bg-surface-secondary transition-colors cursor-pointer flex items-start gap-3",
                    conv.unreadCount > 0 && "bg-blue-50/60 dark:bg-blue-900/10"
                  )}
                >
                  <div className="relative shrink-0 mt-0.5">
                    <Avatar
                      src={conv.otherUser?.avatarUrl}
                      fallback={conv.otherUser?.name ? getInitials(conv.otherUser.name) : "?"}
                      size="md"
                    />
                    {conv.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white shadow-xs">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-sm truncate", conv.unreadCount > 0 ? "font-bold text-foreground" : "font-semibold text-foreground")}>
                        {conv.otherUser?.name || "Unknown User"}
                      </p>
                      <span className="text-[11px] text-text-tertiary shrink-0">
                        {new Date(conv.lastMessage.createdAt).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <p className={cn("text-xs truncate mt-0.5", conv.unreadCount > 0 ? "text-foreground font-medium" : "text-text-secondary")}>
                      {conv.lastMessage.subject && <span className="font-medium">{conv.lastMessage.subject}: </span>}
                      {conv.lastMessage.body}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <Badge variant="outline" className="text-[10px] capitalize py-0 px-2 h-5">
                        {conv.otherUser?.role || "user"}
                      </Badge>
                      {conv.unreadCount > 0 && (
                        <span className="text-[10px] font-semibold text-blue-600">
                          {conv.unreadCount} unread
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              ))
            )}
          </div>
        </motion.div>
      </div>
    );

    if (mounted && typeof document !== "undefined") {
      return createPortal(modalContent, document.body);
    }
    return modalContent;
  }

  // Embedded or dropdown mode
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: 8, scale: 0.95, filter: "blur(4px)" }}
      transition={{ duration: 0.2 }}
      className={cn(
        "border border-border bg-surface shadow-dropdown overflow-hidden z-50",
        fullPage ? "relative w-full rounded-xl" : "absolute right-0 mt-2 w-80 rounded-xl sm:w-96"
      )}
    >
      <div className="flex h-12 items-stretch justify-between border-b border-border">
        <div className="flex h-full min-w-0 flex-1 items-stretch">
          <div className="flex min-w-37.5 items-center justify-center border-b-[3px] border-primary-600 px-5 text-sm font-semibold text-foreground">Messages</div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close messages"
          className="mr-3 self-center rounded-lg p-1.5 text-text-tertiary hover:bg-surface-secondary hover:text-foreground transition-colors cursor-pointer z-50 pointer-events-auto"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <label className="mx-3 mt-3 flex h-11 items-center gap-2 rounded-lg border border-border bg-surface-secondary/60 px-3 text-text-tertiary">
        <Search className="h-4 w-4 shrink-0" />
        <span className="sr-only">Search messages</span>
        <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search or start a new conversation" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-text-tertiary" />
      </label>
      <div className={cn(fullPage ? "min-h-90 max-h-140" : "max-h-80", "overflow-y-auto")}>
        {loading ? (
          <div className="p-8 text-center">
            <div className="h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex min-h-60 flex-col items-center justify-center p-8 text-center text-sm text-text-secondary">
            <MessageSquare className="mb-3 h-9 w-9 text-text-tertiary" />
            {searchTerm.trim() ? "No matching messages" : "No messages yet"}
          </div>
        ) : (
          filteredConversations.map((conv, index) => (
            <motion.button
              key={conv.userId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => handleConversationClick(conv)}
              className={cn(
                "w-full text-left p-4 border-b border-border last:border-0 hover:bg-surface-secondary transition-colors cursor-pointer",
                conv.unreadCount > 0 && "bg-primary-50/50 dark:bg-primary-900/10"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <Avatar
                    src={conv.otherUser?.avatarUrl}
                    fallback={conv.otherUser?.name ? getInitials(conv.otherUser.name) : "?"}
                    size="sm"
                  />
                  {conv.unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary-500 text-[8px] font-bold text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground truncate">
                      {conv.otherUser?.name || "Unknown User"}
                    </p>
                    <span className="text-[10px] text-text-tertiary">
                      {new Date(conv.lastMessage.createdAt).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary truncate mt-0.5">
                    {conv.lastMessage.subject && `${conv.lastMessage.subject} - `}
                    {conv.lastMessage.body}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {conv.otherUser?.role || "user"}
                    </Badge>
                    {conv.unreadCount > 0 && (
                      <span className="text-[10px] font-medium text-primary-600">
                        {conv.unreadCount} new
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.button>
          ))
        )}
      </div>
    </motion.div>
  );
}
