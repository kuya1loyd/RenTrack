"use client";

import { useEffect, useId, useRef, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, description, children, className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const id = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      (focusable || dialogRef.current)?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      ));
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isOpen]);

  const titleId = `modal-title-${id}`;
  const descriptionId = description ? `${titleId}-description` : undefined;

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
            className="absolute inset-0 bg-black/30"
          />
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
            className={cn(
              "relative w-full max-w-md rounded-3xl border border-gray-200 bg-white shadow-2xl",
              className
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
          >
            <div className="flex items-center justify-between p-6 pb-4">
              <div>
                <h3 id={titleId} className="text-xl font-bold text-gray-900 tracking-tight">{title}</h3>
                {description && (
                  <p id={descriptionId} className="text-sm text-gray-500 mt-1">{description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                aria-label={`Close ${title}`}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer z-50 pointer-events-auto"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 pb-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
