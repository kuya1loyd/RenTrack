"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, MessageSquare, Star } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { safeParseJson } from "@/lib/data";

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
  const [reviewData, setReviewData] = useState<ReviewData>({ reviews: [], canReview: false, alreadyReviewed: false });
  const [reviewStatus, setReviewStatus] = useState<"loading" | "ready" | "error">("loading");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");

  const loadReviews = useCallback(async () => {
    try {
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
      setReviewStatus("ready");
    } catch {
      setReviewStatus("error");
    }
  }, [agentId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getPayload<{
          reviews?: Review[];
          canReview?: boolean;
          alreadyReviewed?: boolean;
        }>(`/api/agents/${encodeURIComponent(agentId)}/reviews`);
        if (active) {
          setReviewData({
            reviews: Array.isArray(data.reviews) ? data.reviews : [],
            canReview: Boolean(data.canReview),
            alreadyReviewed: Boolean(data.alreadyReviewed),
          });
          setReviewStatus("ready");
        }
      } catch {
        if (active) setReviewStatus("error");
      }
    })();
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
      <section aria-labelledby="agent-reviews-title" className="border-t border-slate-200 pt-7">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-orange-50 p-2.5 text-orange-700"><MessageSquare size={19} aria-hidden="true" /></span>
            <div>
              <h2 id="agent-reviews-title" className="text-xl font-semibold tracking-tight text-slate-900">Client Reviews &amp; Feedback</h2>
              <p className="mt-1 text-sm text-slate-600">Verified tenant ratings and reviews for this Rent Manager.</p>
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
