"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";
import { AGENT_BADGES, AgentBadgeKey } from "@/lib/agent-badges";
import { safeParseJson } from "@/lib/data";

type AssignedBadge = {
  key: string;
  label?: string;
  category?: string;
  description?: string;
  awardedAt: string;
};

function formatDate(value?: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(date)
    : "Date unavailable";
}

export default function OwnerAgentBadges({ agentId }: { agentId: string }) {
  const [badges, setBadges] = useState<AssignedBadge[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);

  const loadBadges = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}/badges`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await safeParseJson(response);
      if (!response.ok || !data.success || !Array.isArray(data.badges)) {
        throw new Error(data.error || "Assigned badges could not be loaded.");
      }
      setBadges(data.badges);
      setStatus("ready");
    } catch (loadFailure) {
      setError(loadFailure instanceof Error ? loadFailure.message : "Assigned badges could not be loaded.");
      setStatus("error");
    }
  }, [agentId]);

  useEffect(() => {
    void loadBadges();
  }, [loadBadges]);

  const assignedKeys = useMemo(() => new Set(badges.map((badge) => badge.key)), [badges]);
  const availableBadges = AGENT_BADGES.filter((badge) => !assignedKeys.has(badge.key));

  const awardBadge = async () => {
    if (!selectedKey || assignedKeys.has(selectedKey)) return;
    setBusyKey(selectedKey);
    setFeedback(null);
    try {
      const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}/badges`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badgeKey: selectedKey }),
      });
      const data = await safeParseJson(response);
      if (!response.ok || !data.success) throw new Error(data.error || "The badge could not be awarded.");
      setSelectedKey("");
      setFeedback({ message: "Badge awarded.", error: false });
      await loadBadges();
    } catch (awardFailure) {
      setFeedback({ message: awardFailure instanceof Error ? awardFailure.message : "The badge could not be awarded.", error: true });
    } finally {
      setBusyKey(null);
    }
  };

  const revokeBadge = async (badgeKey: string) => {
    if (confirmKey !== badgeKey) {
      setConfirmKey(badgeKey);
      return;
    }
    setBusyKey(badgeKey);
    setConfirmKey(null);
    setFeedback(null);
    try {
      const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}/badges`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badgeKey }),
      });
      const data = await safeParseJson(response);
      if (!response.ok || !data.success) throw new Error(data.error || "The badge could not be revoked.");
      setFeedback({ message: "Badge revoked.", error: false });
      await loadBadges();
    } catch (revokeFailure) {
      setFeedback({ message: revokeFailure instanceof Error ? revokeFailure.message : "The badge could not be revoked.", error: true });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section aria-labelledby="owner-agent-badges-title" className="border-t border-slate-200 pt-5">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><Award size={18} aria-hidden="true" /></span>
        <div>
          <h4 id="owner-agent-badges-title" className="font-semibold text-slate-900">Achievements &amp; Rewards</h4>
          <p className="mt-1 text-xs leading-5 text-slate-600">Award or revoke recognition for this agent. Changes appear on their public profile.</p>
        </div>
      </div>

      {status === "loading" ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-600" role="status"><LoaderCircle size={16} className="animate-spin" /> Loading assigned badges…</p>
      ) : status === "error" ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void loadBadges()} className="mt-2 font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600">Try again</button>
        </div>
      ) : (
        <>
          {badges.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">No achievements or rewards have been awarded yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {badges.map((badge) => {
                const catalogBadge = AGENT_BADGES.find((item) => item.key === badge.key);
                const label = badge.label || catalogBadge?.label || badge.key;
                const category = badge.category || catalogBadge?.category || "Recognition";
                const description = badge.description || catalogBadge?.description || "";
                return (
                  <li key={`${badge.key}-${badge.awardedAt}`} className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <ShieldCheck className="mt-0.5 shrink-0 text-amber-700" size={17} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{label}<span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-amber-800">{category}</span></p>
                        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
                        <time dateTime={badge.awardedAt} className="mt-1 block text-xs text-slate-500">Awarded {formatDate(badge.awardedAt)}</time>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {confirmKey === badge.key ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-700">Revoke badge?</span>
                          <button type="button" disabled={busyKey === badge.key} onClick={() => void revokeBadge(badge.key)} className="rounded-md px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50">Confirm</button>
                          <button type="button" onClick={() => setConfirmKey(null)} className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500">Cancel</button>
                        </div>
                      ) : (
                        <button type="button" disabled={busyKey !== null} onClick={() => void revokeBadge(badge.key)} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:cursor-not-allowed disabled:opacity-50">
                          {busyKey === badge.key ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          Revoke
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor={`badge-choice-${agentId}`}>Choose an achievement or reward</label>
            <select id={`badge-choice-${agentId}`} value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)} disabled={availableBadges.length === 0 || busyKey !== null} className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:bg-slate-100">
              <option value="">{availableBadges.length ? "Choose a badge to award…" : "All available badges are assigned"}</option>
              {availableBadges.map((badge) => (
                <option key={badge.key} value={badge.key as AgentBadgeKey}>{badge.label} — {badge.category}</option>
              ))}
            </select>
            <button type="button" disabled={!selectedKey || busyKey !== null} onClick={() => void awardBadge()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
              {busyKey === selectedKey && selectedKey ? <LoaderCircle size={16} className="animate-spin" /> : <Award size={16} />}
              Award badge
            </button>
          </div>
        </>
      )}
      {feedback && <p className={`mt-3 text-sm ${feedback.error ? "text-red-700" : "text-emerald-800"}`} role={feedback.error ? "alert" : "status"}>{feedback.message}</p>}
    </section>
  );
}
