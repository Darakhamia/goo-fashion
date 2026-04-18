"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

// ── Plan definitions (mirrored from /plans) ───────────────────────────────────

const PLANS = [
  {
    id: "basic",
    name: "Basic",
    price: 10,
    features: [
      "50 image generations / mo",
      "~300 AI messages / mo",
      "Outfit builder",
      "Basic AI stylist",
      "Standard speed",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 25,
    features: [
      "180 image generations / mo",
      "~1,000 AI messages / mo",
      "Priority generation",
      "Better AI stylist",
      "Save outfits",
      "Higher image quality",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: 45,
    features: [
      "450 image generations / mo",
      "~3,000 AI messages / mo",
      "Very fast generation",
      "Near-unlimited AI usage",
      "Stylist memory",
      "Exclusive styles",
    ],
  },
];

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

  const planId = searchParams.get("plan") ?? "basic";
  const plan = PLANS.find((p) => p.id === planId) ?? PLANS[0];

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
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <Check />
                <span className="text-sm text-[var(--foreground-muted)] leading-relaxed">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <button
          disabled
          className="w-full font-mono text-[10px] tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-6 py-4 opacity-40 cursor-not-allowed"
        >
          Continue to payment
        </button>

        {/* Placeholder notice */}
        <p className="mt-4 text-center text-xs text-[var(--foreground-subtle)] leading-relaxed">
          Payment is not yet available. This page is a placeholder — billing will be wired up in a future release.
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
