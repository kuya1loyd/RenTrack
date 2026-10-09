"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, CalendarDays, Check, MapPin, MessageCircle, ThumbsUp, UserRound, X, BriefcaseBusiness } from "lucide-react";
import { useAuth } from "@/lib/auth";
import styles from "./public-agent-card.module.css";

export type PublicAgentCardData = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  experience?: string;
  location?: string;
  avatarUrl?: string | null;
  createdAt?: string | null;
};

const savedAgentOverrides = new Map<string, boolean>();
const saveChangeEvent = "renttrack-agent-save-change";

function normalizeAvatarUrl(src?: string | null) {
  if (!src) return null;

  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith("//")) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
      if (currentOrigin && parsed.origin === currentOrigin) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
      }
      return trimmed;
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function subscribeToSavedAgents(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(saveChangeEvent, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(saveChangeEvent, listener);
  };
}

function isAgentSaved(id: string) {
  if (savedAgentOverrides.has(id)) return savedAgentOverrides.get(id) || false;
  try {
    return window.localStorage.getItem(`renttrack:saved-agent:${id}`) === "1";
  } catch {
    return false;
  }
}

export default function PublicAgentCard({
  agent,
  listingCount,
  headingLevel = 3,
  variant = "default",
  landscape = false,
}: {
  agent: PublicAgentCardData;
  listingCount?: number;
  headingLevel?: 2 | 3;
  variant?: "default" | "compact";
  landscape?: boolean;
}) {
  const [failedAvatar, setFailedAvatar] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const saved = useSyncExternalStore(subscribeToSavedAgents, () => isAgentSaved(agent.id), () => false);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const profileHref = `/agents/${encodeURIComponent(agent.id)}`;
  const avatar = !failedAvatar ? normalizeAvatarUrl(agent.avatarUrl) : null;
  const initials = agent.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const memberDate = agent.createdAt ? new Date(agent.createdAt) : null;
  const validMemberDate = memberDate && Number.isFinite(memberDate.getTime()) ? memberDate : null;
  const memberSince = validMemberDate
    ? new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "Asia/Manila" }).format(validMemberDate)
    : null;
  const memberYear = validMemberDate
    ? new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Manila" }).format(validMemberDate)
    : null;
  const experience = agent.experience?.trim() || null;

  useEffect(() => {
    if (!chatOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("[data-dialog-initial-focus]")?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setChatOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault();
        focusable[0].focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [chatOpen]);

  function handleChatClick() {
    if (authLoading) return;
    if (isAuthenticated) {
      router.push(`${profileHref}#message`);
      return;
    }
    setChatOpen(true);
  }

  function toggleSaved() {
    const nextSaved = !saved;
    savedAgentOverrides.set(agent.id, nextSaved);
    try {
      const key = `renttrack:saved-agent:${agent.id}`;
      if (nextSaved) window.localStorage.setItem(key, "1");
      else window.localStorage.removeItem(key);
      savedAgentOverrides.delete(agent.id);
    } catch {
      // Keep saving available for this session when browser storage is disabled.
    }
    window.dispatchEvent(new Event(saveChangeEvent));
  }

  if (variant === "compact") {
    return (
      <article className={`${styles.card} ${styles.compactCard}`}>
        <div className={`${styles.portrait} ${styles.compactPortrait} ${landscape ? styles.compactLandscape : ""}`}>
          {avatar ? (
            <Image
              src={avatar}
              alt={`${agent.name}, RentTrack agent`}
              fill
              unoptimized
              sizes="(max-width: 639px) 80vw, 300px"
              className={styles.image}
              onError={() => setFailedAvatar(true)}
            />
          ) : (
            <div role="img" aria-label={`${agent.name}, no profile photo available`} className={styles.fallbackPortrait}>
              <UserRound aria-hidden="true" className={styles.silhouette} strokeWidth={1.1} />
              <span aria-hidden="true" className={styles.initials}>{initials || "RT"}</span>
            </div>
          )}
          <Link href={profileHref} aria-label={`View ${agent.name}'s profile`} className={styles.compactOverlayLink} />
          <span aria-hidden="true" className={styles.brand}>Rent<span>Track</span></span>
          <button
            type="button"
            aria-label={`${saved ? "Unsave" : "Save"} ${agent.name}`}
            aria-pressed={saved}
            title={`${saved ? "Remove" : "Save"} this agent ${saved ? "from" : "on"} this device`}
            onClick={toggleSaved}
            className={`${styles.saveButton} ${saved ? styles.saved : ""}`}
          >
            <ThumbsUp aria-hidden="true" size={18} />
          </button>
        </div>
        <div className={styles.compactIdentity}>
          <Heading className={styles.compactName}>
            <Link href={profileHref}>{agent.name}</Link>
          </Heading>
          <p className={styles.compactRole}>Owner-Managed Agent</p>
        </div>
      </article>
    );
  }

  return (
    <article className={styles.card}>
      <div className={styles.portrait}>
        {avatar ? (
          <Image
            src={avatar}
            alt={`${agent.name}, RentTrack agent`}
            fill
            unoptimized
            sizes="(max-width: 639px) 90vw, (max-width: 1023px) 45vw, (max-width: 1279px) 30vw, (max-width: 1535px) 23vw, 19vw"
            className={styles.image}
            onError={() => setFailedAvatar(true)}
          />
        ) : (
          <div role="img" aria-label={`${agent.name}, no profile photo available`} className={styles.fallbackPortrait}>
            <UserRound aria-hidden="true" className={styles.silhouette} strokeWidth={1.1} />
            <span aria-hidden="true" className={styles.initials}>{initials || "RT"}</span>
          </div>
        )}
        <span aria-hidden="true" className={styles.brand}>Rent<span>Track</span></span>
        <button
          type="button"
          aria-label={`${saved ? "Unsave" : "Save"} ${agent.name}`}
          aria-pressed={saved}
          title={`${saved ? "Remove" : "Save"} this agent ${saved ? "from" : "on"} this device`}
          onClick={toggleSaved}
          className={`${styles.saveButton} ${saved ? styles.saved : ""}`}
        >
          <ThumbsUp aria-hidden="true" size={21} />
        </button>
      </div>

      <div className={styles.identity}>
        <Heading className={styles.name}>{agent.name}</Heading>
        <p className={styles.metadata} title={agent.location || undefined}>
          <MapPin aria-hidden="true" size={15} />
          <span>{agent.location || "Location not listed"}</span>
        </p>
        <p className={styles.metadata}>
          <CalendarDays aria-hidden="true" size={15} />
          <span>{memberSince || "Member date not listed"}</span>
        </p>
      </div>

      <dl className={styles.metrics}>
        <div className={styles.metric}>
          <dt>Listings</dt>
          <dd title={typeof listingCount === "number" ? `${listingCount} property listings` : "Listing count unavailable"}>
            <Building2 aria-hidden="true" size={15} />
            <span>{typeof listingCount === "number" ? listingCount : "—"}</span>
          </dd>
        </div>
        <div className={styles.metric}>
          <dt>Experience</dt>
          <dd title={experience || "Experience not provided"}>
            <BriefcaseBusiness aria-hidden="true" size={15} />
            <span>{experience || "—"}</span>
          </dd>
        </div>
        <div className={styles.metric}>
          <dt>Joined</dt>
          <dd title={memberSince || "Member date unavailable"}>
            <CalendarDays aria-hidden="true" size={15} />
            <span>{memberYear || "—"}</span>
          </dd>
        </div>
      </dl>

      <div className={styles.actions}>
        <Link href={profileHref} aria-label={`View ${agent.name}'s profile`} title={`View ${agent.name}'s profile`} className={styles.profileButton}>
          <UserRound aria-hidden="true" size={20} />
        </Link>
        <button
          type="button"
          aria-label={`Let's chat with ${agent.name}`}
          className={styles.chatButton}
          onClick={handleChatClick}
          disabled={authLoading}
        >
          <MessageCircle aria-hidden="true" size={18} />
          <span>LET&apos;S CHAT</span>
        </button>
      </div>
      {chatOpen && (
        <div
          className={styles.dialogBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setChatOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            className={styles.memberDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
          >
            <span aria-hidden="true" className={styles.dialogAccent} />
            <button
              type="button"
              className={styles.dialogClose}
              aria-label="Close member sign-in dialog"
              onClick={() => setChatOpen(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
            <p className={styles.dialogEyebrow}>RENTTRACK MEMBERS</p>
            <h2 id={titleId} className={styles.dialogTitle}>A better rental starts with a conversation.</h2>
            <p id={descriptionId} className={styles.dialogDescription}>
              Sign in to connect with {agent.name} and keep your rental conversations in one place.
            </p>
            <ul className={styles.dialogBenefits}>
              <li><Check size={16} aria-hidden="true" /> Message Rent Managers directly</li>
              <li><Check size={16} aria-hidden="true" /> Keep track of your inquiries</li>
              <li><Check size={16} aria-hidden="true" /> Save properties and people you like</li>
            </ul>
            <Link
              href="/login"
              className={styles.dialogPrimary}
              data-dialog-initial-focus
              onClick={() => setChatOpen(false)}
            >
              Sign In
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <button
              type="button"
              className={styles.dialogDismiss}
              onClick={() => setChatOpen(false)}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
