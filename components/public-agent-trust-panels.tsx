"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Award, BadgeCheck, FileText, LoaderCircle, MessageSquare, Star } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { safeParseJson } from "@/lib/data";

type Certificate = {
  id: string;
  title: string;
  issuer?: string | null;
  issuedOn?: string | null;
  fileName: string;
  mimeType: string;
  createdAt: string;
  url: string;
};

type AgentBadge = {
  key: string;
  label: string;
  category: string;
  description: string;
  awardedAt: string;
};

type Review = {
  rating: number;
  comment: string;
  createdAt: string;
  reviewer: { name?: string | null; displayName?: string | null } | string | null;
};

type ReviewData = {
  reviews: Review[];
  canReview: boolean;
  alreadyReviewed: boolean;
};

function displayDate(value?: string | null) {
  if (!value) return "Date not provided";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(date)
    : "Date not provided";
}

async function getPayload<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store" });
  const data = await safeParseJson(response);
  if (!response.ok || !data.success) throw new Error(data.error || "This information is temporarily unavailable.");
  return data as T;
}

export default function PublicAgentTrustPanels({ agentId }: { agentId: string }) {
  const { user, isAuthenticated } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [badges, setBadges] = useState<AgentBadge[]>([]);
  const [reviewData, setReviewData] = useState<ReviewData>({ reviews: [], canReview: false, alreadyReviewed: false });
  const [certStatus, setCertStatus] = useState<"loading" | "ready" | "error">("loading");
  const [badgeStatus, setBadgeStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reviewStatus, setReviewStatus] = useState<"loading" | "ready" | "error">("loading");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");

  const loadReviews = useCallback(async () => {
    const data = await getPayload<{
      reviews?: Review[];
      canReview?: boolean;
      alreadyReviewed?: boolean;
    }>(`/api/agents/${encodeURIComponent(agentId)}/reviews`);
    setReviewData({
      reviews: Array.isArray(data.reviews) ? data.reviews : [],
      canReview: Boolean(data.canReview),
      alreadyReviewed: Boolean(data.alreadyReviewed),
    });
  }, [agentId]);

  useEffect(() => {
    let active = true;
    const load = async <T,>(url: string, setStatus: (value: "loading" | "ready" | "error") => void, setData: (value: T) => void) => {
      try {
        const data = await getPayload<T>(url);
        if (active) setData(data);
        if (active) setStatus("ready");
      } catch {
        if (active) setStatus("error");
      }
    };
    void load<{ certificates?: Certificate[] }>(
      `/api/agents/${encodeURIComponent(agentId)}/certificates`,
      setCertStatus,
      (data) => setCertificates(Array.isArray(data.certificates) ? data.certificates : []),
    );
    void load<{ badges?: AgentBadge[] }>(
      `/api/agents/${encodeURIComponent(agentId)}/badges`,
      setBadgeStatus,
      (data) => setBadges(Array.isArray(data.badges) ? data.badges : []),
    );
    void load<{
      reviews?: Review[];
      canReview?: boolean;
      alreadyReviewed?: boolean;
    }>(
      `/api/agents/${encodeURIComponent(agentId)}/reviews`,
      setReviewStatus,
      (data) => setReviewData({
        reviews: Array.isArray(data.reviews) ? data.reviews : [],
        canReview: Boolean(data.canReview),
        alreadyReviewed: Boolean(data.alreadyReviewed),
      }),
    );
    return () => { active = false; };
  }, [agentId]);

  const averageRating = useMemo(() => {
    if (reviewData.reviews.length === 0) return null;
    return reviewData.reviews.reduce((sum, review) => sum + review.rating, 0) / reviewData.reviews.length;
  }, [reviewData.reviews]);

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!comment.trim()) {
      setReviewMessage("Please add a comment before submitting your review.");
      return;
    }
    setSubmitting(true);
    setReviewMessage("");
    try {
      const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}/reviews`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() }),
      });
      const data = await safeParseJson(response);
      if (!response.ok || !data.success) throw new Error(data.error || "Your review could not be submitted.");
      setComment("");
      setReviewData((current) => ({ ...current, canReview: false, alreadyReviewed: true }));
      setReviewMessage("Thank you — your review has been submitted.");
      try {
        await loadReviews();
      } catch {
        setReviewMessage("Your review was submitted successfully. Reload the page later to refresh the review list.");
      }
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : "Your review could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  };

  const isTenant = isAuthenticated && user?.role === "tenant";

  return (
    <div className="mt-10 space-y-8">
      <section aria-labelledby="agent-badges-title" className="border-t border-slate-200 pt-7">
        <div className="mb-4 flex items-start gap-3">
          <span className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><Award size={19} aria-hidden="true" /></span>
          <div>
            <h2 id="agent-badges-title" className="text-xl font-semibold tracking-tight text-slate-900">Achievements &amp; Rewards</h2>
            <p className="mt-1 text-sm text-slate-600">Recognition awarded by this Rent Manager’s owner.</p>
          </div>
        </div>
        {badgeStatus === "loading" ? (
          <p className="flex items-center gap-2 py-4 text-sm text-slate-600" role="status"><LoaderCircle className="animate-spin" size={16} /> Loading achievements…</p>
        ) : badgeStatus === "error" ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">Achievements are temporarily unavailable.</p>
        ) : badges.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">No achievements or rewards have been awarded yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {badges.map((badge) => (
              <li key={`${badge.key}-${badge.awardedAt}`} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <BadgeCheck className="mt-0.5 shrink-0 text-amber-700" size={19} aria-hidden="true" />
                    <div>
                      <h3 className="font-semibold text-slate-900">{badge.label}</h3>
                      <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800">{badge.category}</p>
                    </div>
                  </div>
                  <time className="shrink-0 text-xs text-slate-600" dateTime={badge.awardedAt}>{displayDate(badge.awardedAt)}</time>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">{badge.description}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="agent-certificates-title" className="border-t border-slate-200 pt-7">
        <div className="mb-4 flex items-start gap-3">
          <span className="rounded-xl bg-orange-50 p-2.5 text-orange-700"><FileText size={19} aria-hidden="true" /></span>
          <div>
            <h2 id="agent-certificates-title" className="text-xl font-semibold tracking-tight text-slate-900">Certificates</h2>
            <p className="mt-1 text-sm text-slate-600">Credentials shared by this Rent Manager.</p>
          </div>
        </div>
        {certStatus === "loading" ? (
          <p className="flex items-center gap-2 py-4 text-sm text-slate-600" role="status"><LoaderCircle className="animate-spin" size={16} /> Loading certificates…</p>
        ) : certStatus === "error" ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">Certificates are temporarily unavailable.</p>
        ) : certificates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">No certificates have been shared yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {certificates.map((certificate) => (
              <li key={certificate.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-900">{certificate.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {[certificate.issuer, certificate.issuedOn ? `Issued ${displayDate(certificate.issuedOn)}` : null].filter(Boolean).join(" · ") || certificate.fileName}
                  </p>
                </div>
                {certificate.url ? (
                  <a href={certificate.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-orange-800 underline decoration-orange-300 underline-offset-4 hover:text-orange-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2">
                    View certificate <span className="sr-only">: {certificate.title}</span>
                  </a>
                ) : (
                  <span className="text-sm text-slate-500">File link unavailable</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="agent-reviews-title" className="border-t border-slate-200 pt-7">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-orange-50 p-2.5 text-orange-700"><MessageSquare size={19} aria-hidden="true" /></span>
            <div>
              <h2 id="agent-reviews-title" className="text-xl font-semibold tracking-tight text-slate-900">Client Reviews</h2>
              <p className="mt-1 text-sm text-slate-600">Feedback from tenants who contacted this Rent Manager while signed in.</p>
            </div>
          </div>
          {averageRating !== null && (
            <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900" aria-label={`Average rating ${averageRating.toFixed(1)} out of 5, ${reviewData.reviews.length} reviews`}>
              <Star size={15} fill="currentColor" aria-hidden="true" /> {averageRating.toFixed(1)} <span className="font-normal text-amber-800">({reviewData.reviews.length})</span>
            </p>
          )}
        </div>
        {reviewStatus === "loading" ? (
          <p className="flex items-center gap-2 py-4 text-sm text-slate-600" role="status"><LoaderCircle className="animate-spin" size={16} /> Loading reviews…</p>
        ) : reviewStatus === "error" ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">Reviews are temporarily unavailable.</p>
        ) : (
          <>
            {reviewData.reviews.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">No client reviews have been shared yet.</p>
            ) : (
              <ul className="space-y-3">
                {reviewData.reviews.map((review, index) => {
                  const reviewerName = typeof review.reviewer === "string"
                    ? review.reviewer
                    : review.reviewer?.displayName || review.reviewer?.name || "Verified tenant";
                  return (
                    <li key={`${review.createdAt}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-slate-900">{reviewerName}</h3>
                          <time className="mt-0.5 block text-xs text-slate-600" dateTime={review.createdAt}>{displayDate(review.createdAt)}</time>
                        </div>
                        <div className="flex items-center gap-0.5 text-amber-600" aria-label={`${review.rating} out of 5 stars`}>
                          {Array.from({ length: 5 }, (_, starIndex) => (
                            <Star key={starIndex} size={15} fill={starIndex < review.rating ? "currentColor" : "none"} aria-hidden="true" />
                          ))}
                        </div>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{review.comment}</p>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-5">
              {isTenant && reviewData.alreadyReviewed ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900" role="status">You’ve already submitted your review for this Rent Manager. Thank you for sharing your experience.</p>
              ) : isTenant && reviewData.canReview ? (
                <form onSubmit={submitReview} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                  <h3 className="font-semibold text-slate-900">Share your experience</h3>
                  <p className="mt-1 text-sm text-slate-600">Your review helps other tenants make an informed choice.</p>
                  <fieldset className="mt-4">
                    <legend className="mb-2 text-sm font-medium text-slate-800">Your rating</legend>
                    <div role="radiogroup" aria-label="Choose a rating from one to five stars" className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <label key={value} className="cursor-pointer rounded-md p-1 text-amber-600 hover:bg-amber-50 focus-within:outline-none focus-within:ring-2 focus-within:ring-orange-600">
                          <input className="sr-only" type="radio" name="agent-review-rating" value={value} checked={rating === value} onChange={() => setRating(value)} aria-label={`${value} ${value === 1 ? "star" : "stars"}`} />
                          <Star size={22} fill={value <= rating ? "currentColor" : "none"} aria-hidden="true" />
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="mt-4 block text-sm font-medium text-slate-800">
                    Comment
                    <textarea required maxLength={1000} rows={4} value={comment} onChange={(event) => setComment(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200" placeholder="What would you like other tenants to know?" />
                  </label>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button type="submit" disabled={submitting} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-orange-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
                      {submitting && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
                      {submitting ? "Submitting…" : "Submit review"}
                    </button>
                    {reviewMessage && (
                      <p
                        className={`text-sm ${reviewMessage.startsWith("Thank you") ? "text-emerald-800" : "text-red-700"}`}
                        role={reviewMessage.startsWith("Thank you") ? "status" : "alert"}
                      >
                        {reviewMessage}
                      </p>
                    )}
                  </div>
                </form>
              ) : isTenant ? (
                <p className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950">To review later, first send this Rent Manager an inquiry while signed in to your tenant account. Anonymous inquiries don’t qualify. Once your signed-in inquiry is associated with your tenant account, you can leave one review.</p>
              ) : (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">To leave a review later, sign in as a tenant before sending an inquiry. Anonymous inquiries don’t qualify. Only inquiries associated with a signed-in tenant account can unlock one review.</p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
