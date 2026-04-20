"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { PAID_PLAN_IDS, PLANS, type PlanId } from "@/lib/plans";

// ── Plan presentation — marketing copy, kept separate from the feature gate map ─

const PLAN_COPY: Record<"basic" | "pro" | "premium", string[]> = {
  basic: [
    "50 image generations / mo",
    "~300 AI messages / mo",
    "Outfit builder",
    "Basic AI stylist",
    "Standard speed",
  ],
  pro: [
    "180 image generations / mo",
    "~1,000 AI messages / mo",
    "Priority generation",
    "Better AI stylist",
    "Save outfits",
    "Higher image quality",
  ],
  premium: [
    "450 image generations / mo",
    "~3,000 AI messages / mo",
    "Very fast generation",
    "Near-unlimited AI usage",
    "Stylist memory",
    "Exclusive styles",
  ],
};

// ── Check icon ────────────────────────────────────────────────────────────────

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[var(--foreground)] shrink-0 mt-0.5">
      <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Inner page (reads search params) ─────────────────────────────────────────

function SubscribeInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();

  const rawPlanId = searchParams.get("plan");
  const planId: Exclude<PlanId, "free"> = PAID_PLAN_IDS.includes(rawPlanId as PlanId)
    ? (rawPlanId as Exclude<PlanId, "free">)
    : "basic";
  const plan = PLANS[planId];
  const features = PLAN_COPY[planId];

  const currentPlan = (user?.publicMetadata as { plan?: string })?.plan ?? "free";
  const alreadyOnPlan = currentPlan === planId;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubscribe = async () => {
    if (!isSignedIn) {
      // Clerk redirect flow — comes back here after sign-in.
      router.push(`/sign-in?redirect_url=${encodeURIComponent(`/subscribe?plan=${planId}`)}`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/demo-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Upgrade failed. Try again.");
        return;
      }
      // Reload the Clerk session so publicMetadata.plan is fresh everywhere.
      await user?.reload();
      setSuccess(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success state ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="pt-16 min-h-screen">
        <div className="max-w-[520px] mx-auto px-6 md:px-8 py-16 md:py-24 text-center">
          <div className="w-14 h-14 mx-auto mb-8 border border-[var(--foreground)] flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5L10 17.5L19 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--foreground-subtle)] mb-3">
            You are in
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)] leading-[1.05] mb-5">
            Welcome to {plan.name}
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] max-w-sm mx-auto leading-relaxed mb-10">
            Your account has been upgraded. AI Stylist and image generation are unlocked.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push("/builder")}
              className="bg-[var(--foreground)] text-[var(--background)] font-mono text-[10px] tracking-[0.14em] uppercase px-6 py-4 hover:opacity-80 transition-opacity"
            >
              Open builder
            </button>
            <button
              onClick={() => router.push("/profile")}
              className="border border-[var(--border-strong)] text-[var(--foreground)] font-mono text-[10px] tracking-[0.12em] uppercase px-6 py-4 hover:bg-[var(--surface)] transition-colors"
            >
              Go to profile
            </button>
          </div>
          <p className="mt-10 text-[10px] text-[var(--foreground-subtle)] leading-relaxed">
            Demo mode — no card was charged. Billing will be wired up in a future release.
          </p>
        </div>
      </div>
    );
  }

  // ── Main state ───────────────────────────────────────────────────────────
  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-[520px] mx-auto px-6 md:px-8 py-16 md:py-24">

        {/* Back link */}
        <button
          onClick={() => router.push("/plans")}
          className="flex items-center gap-2 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors mb-12 group"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="group-hover:-translate-x-0.5 transition-transform">
            <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to plans
        </button>

        {/* Header */}
        <div className="mb-10">
          <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--foreground-subtle)] mb-3">
            Subscribe
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)] leading-[1.05]">
            {plan.name} plan
          </h1>
        </div>

        {/* Summary block */}
        <div className="border border-[var(--border)] p-6 mb-8">
          <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-1">
            You are subscribing to
          </p>
          <p className="font-display text-2xl font-light text-[var(--foreground)]">
            {plan.name} — <span className="text-[var(--foreground)]">${plan.price} / month</span>
          </p>
        </div>

        {/* Features */}
        <div className="mb-10">
          <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-5">
            What&apos;s included
          </p>
          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <Check />
                <span className="text-sm text-[var(--foreground-muted)] leading-relaxed">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Error toast */}
        {error && (
          <p className="mb-4 text-xs text-red-500 border border-red-300 px-3 py-2">
            {error}
          </p>
        )}

        {/* CTA */}
        <button
          onClick={handleSubscribe}
          disabled={submitting || !isLoaded || alreadyOnPlan}
          className="w-full font-mono text-[10px] tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-6 py-4 transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {alreadyOnPlan
            ? `You are on ${plan.name}`
            : submitting
            ? "Activating..."
            : !isSignedIn
            ? "Sign in to continue"
            : `Activate ${plan.name} (demo)`}
        </button>

        {/* Demo notice */}
        <p className="mt-4 text-center text-xs text-[var(--foreground-subtle)] leading-relaxed">
          Demo checkout — no card required, no charges made. Your Clerk account is
          upgraded instantly so you can try the gated features.
        </p>

      </div>
    </div>
  );
}

// ── Page (wrapped in Suspense for useSearchParams) ────────────────────────────

export default function SubscribePage() {
  return (
    <Suspense>
      <SubscribeInner />
    </Suspense>
  );
}
