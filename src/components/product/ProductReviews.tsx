"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import type { ProductReview } from "@/lib/types";

interface Props {
  productId: string;
}

function Stars({ value, size = 12, interactive = false, onChange }: {
  value: number;
  size?: number;
  interactive?: boolean;
  onChange?: (v: number) => void;
}) {
  const [hov, setHov] = useState(0);
  const display = interactive ? (hov || value) : value;
  return (
    <span className="inline-flex gap-0.5" onMouseLeave={() => interactive && setHov(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width={size} height={size}
          viewBox="0 0 12 12"
          fill={i <= display ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
          className={interactive ? "cursor-pointer text-[var(--foreground)]" : i <= display ? "text-[var(--foreground)]" : "text-[var(--border-strong)]"}
          onMouseEnter={() => interactive && setHov(i)}
          onClick={() => interactive && onChange?.(i)}
        >
          <polygon points="6,1 7.5,4.5 11,4.8 8.5,7 9.3,10.5 6,8.7 2.7,10.5 3.5,7 1,4.8 4.5,4.5" />
        </svg>
      ))}
    </span>
  );
}

function ReviewCard({ review }: { review: ProductReview }) {
  const date = new Date(review.createdAt).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
  return (
    <div className="py-5 border-b border-[var(--border)] last:border-0">
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[10px] font-medium text-[var(--foreground)] uppercase shrink-0">
            {review.userName?.[0] ?? "?"}
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--foreground)]">{review.userName}</p>
            <p className="text-[10px] text-[var(--foreground-subtle)]">{date}</p>
          </div>
        </div>
        <Stars value={review.rating} size={11} />
      </div>
      {review.text && (
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed pl-10">{review.text}</p>
      )}
    </div>
  );
}

export default function ProductReviews({ productId }: Props) {
  const { user, isLoaded } = useUser();
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Write review form state
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");

  const fetchPage = async (p: number, append = false) => {
    if (p === 1) setLoading(true); else setLoadingMore(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews?page=${p}`);
      const data = await res.json();
      setReviews((prev) => append ? [...prev, ...data.reviews] : data.reviews);
      setTotal(data.total ?? 0);
      setHasMore(data.hasMore ?? false);
      setPage(p);
    } catch { /* silent */ }
    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => { fetchPage(1); }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    setSubmitMsg("");
    const res = await fetch(`/api/products/${productId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, text }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.status === 409) {
      setSubmitMsg("You have already reviewed this product.");
    } else if (!res.ok) {
      setSubmitMsg(data.error ?? "Something went wrong.");
    } else {
      setSubmitMsg("Thank you! Your review is pending approval.");
      setRating(0);
      setText("");
    }
  };

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="mt-16 border-t border-[var(--border)] pt-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-1">
            Reviews
          </p>
          {total > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <Stars value={Math.round(avgRating)} size={13} />
              <span className="text-xs text-[var(--foreground-muted)]">
                {avgRating.toFixed(1)} · {total} review{total !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Review list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="py-5 border-b border-[var(--border)] animate-pulse">
              <div className="flex gap-3 mb-2">
                <div className="w-7 h-7 rounded-full bg-[var(--surface)]" />
                <div className="flex flex-col gap-1.5">
                  <div className="h-3 w-24 bg-[var(--surface)] rounded" />
                  <div className="h-2.5 w-16 bg-[var(--surface)] rounded" />
                </div>
              </div>
              <div className="h-3 w-3/4 bg-[var(--surface)] rounded ml-10" />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-[var(--foreground-subtle)] mb-8">No reviews yet. Be the first!</p>
      ) : (
        <>
          <div>
            {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
          </div>
          {hasMore && (
            <button
              onClick={() => fetchPage(page + 1, true)}
              disabled={loadingMore}
              className="mt-6 text-[10px] tracking-[0.14em] uppercase border border-[var(--border)] px-5 py-2.5 text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : `Load more (${total - reviews.length} remaining)`}
            </button>
          )}
        </>
      )}

      {/* Write a review */}
      {isLoaded && (
        <div className="mt-10 pt-8 border-t border-[var(--border)]">
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-5">
            Write a review
          </p>
          {!user ? (
            <p className="text-sm text-[var(--foreground-muted)]">
              <a href="/sign-in" className="underline hover:text-[var(--foreground)] transition-colors">Sign in</a> to leave a review.
            </p>
          ) : (
            <div className="flex flex-col gap-4 max-w-lg">
              <div>
                <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] mb-2">Your rating</p>
                <Stars value={rating} size={20} interactive onChange={setRating} />
              </div>
              <div>
                <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] mb-2">Your review <span className="normal-case tracking-normal">(optional)</span></p>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Share your thoughts on the fit, quality, etc."
                  rows={3}
                  className="w-full border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-sm bg-transparent text-[var(--foreground)] resize-none placeholder:text-[var(--foreground-subtle)] transition-colors"
                />
              </div>
              {submitMsg && (
                <p className="text-xs text-[var(--foreground-muted)]">{submitMsg}</p>
              )}
              <button
                onClick={handleSubmit}
                disabled={!rating || submitting}
                className="self-start bg-[var(--foreground)] text-[var(--background)] px-6 py-2.5 text-xs tracking-[0.12em] uppercase transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting…" : "Submit review"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
