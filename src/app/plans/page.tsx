"use client";

import { useState } from "react";

// ── Plan definitions ──────────────────────────────────────────────────────────

const PLANS = [
  {
    id: "basic",
    name: "Basic",
    price: 10,
    cta: "Start Basic",
    highlighted: false,
    badge: null as string | null,
    images: "50",
    messages: "~300",
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
    cta: "Choose Pro",
    highlighted: true,
    badge: "Most popular" as string | null,
    images: "180",
    messages: "~1,000",
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
    cta: "Go Premium",
    highlighted: false,
    badge: null as string | null,
    images: "450",
    messages: "~3,000",
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

// ── Comparison rows ───────────────────────────────────────────────────────────

type Cell = string | boolean;

const COMPARISON: { label: string; basic: Cell; pro: Cell; premium: Cell }[] = [
  { label: "Price",               basic: "$10 / mo",   pro: "$25 / mo",   premium: "$45 / mo"  },
  { label: "Image generations",   basic: "50",          pro: "180",        premium: "450"        },
  { label: "AI messages",         basic: "~300",        pro: "~1,000",     premium: "~3,000"     },
  { label: "Generation speed",    basic: "Standard",    pro: "Priority",   premium: "Very fast"  },
  { label: "Image quality",       basic: "Standard",    pro: "High",       premium: "High"       },
  { label: "Outfit builder",      basic: true,          pro: true,         premium: true         },
  { label: "Save outfits",        basic: false,         pro: true,         premium: true         },
  { label: "Stylist memory",      basic: false,         pro: false,        premium: true         },
  { label: "Exclusive styles",    basic: false,         pro: false,        premium: true         },
];

// ── FAQ ───────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: "Can I cancel anytime?",
    a: "Yes — no contracts, no cancellation fees. Cancel in one click from your account settings. You keep access until the end of the current billing period.",
  },
  {
    q: "What happens if I run out of images?",
    a: "Image generation pauses until your next billing cycle. You can still use the AI stylist for advice and browse the full catalog. Upgrading instantly unlocks more.",
  },
  {
    q: "Is there a free plan?",
    a: "Not at the moment. All plans start at $10/month. We're keeping things simple during early access — a free tier may come later.",
  },
  {
    q: "Do unused credits roll over?",
    a: "No — generations and AI messages reset each month. This keeps performance consistent for everyone on the platform.",
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function Check({ highlighted }: { highlighted: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={highlighted ? "text-[var(--background)]" : "text-[var(--foreground)]"}>
      <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Cross() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-[var(--border-strong)]">
      <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[var(--border)]">
      <button
        className="w-full flex items-center justify-between py-5 text-left gap-6 group"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm text-[var(--foreground)]">{q}</span>
        <svg
          width="11" height="11" viewBox="0 0 12 12" fill="none"
          className={`shrink-0 text-[var(--foreground-muted)] transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? "200px" : "0px" }}
      >
        <p className="pb-5 text-sm text-[var(--foreground-muted)] leading-relaxed max-w-xl">
          {a}
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlansPage() {
  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-[1100px] mx-auto px-6 md:px-12">

        {/* ── Header ── */}
        <div className="pt-16 md:pt-24 mb-16 text-center animate-fade-up">
          <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--foreground-subtle)] mb-4">
            Pricing
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-light text-[var(--foreground)] leading-[1.05] mb-5">
            Choose your plan
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] max-w-sm mx-auto leading-relaxed">
            All plans include the full GOO catalog, the outfit builder, and the AI stylist.
          </p>
        </div>

        {/* ── Plan Cards ── */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 mb-24 stagger-children"
          style={{ gap: "1px", background: "var(--border)" }}
        >
          {PLANS.map((plan, i) => (
            <div
              key={plan.id}
              className={`flex flex-col p-8 md:p-10 relative animate-fade-up ${
                plan.highlighted ? "bg-[var(--foreground)]" : "bg-[var(--background)]"
              }`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute top-6 right-6">
                  <span className="font-mono text-[8px] tracking-[0.18em] uppercase font-semibold text-[var(--foreground)] bg-[var(--background)] px-2.5 py-1.5">
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Name */}
              <p className={`font-mono text-[10px] tracking-[0.2em] uppercase font-medium mb-3 ${
                plan.highlighted ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-subtle)]"
              }`}>
                {plan.name}
              </p>

              {/* Price */}
              <div className="mb-8 pb-8 border-b border-current/10">
                <div className="flex items-end gap-1.5">
                  <span className={`font-display text-6xl font-light leading-none ${
                    plan.highlighted ? "text-[var(--background)]" : "text-[var(--foreground)]"
                  }`}>
                    ${plan.price}
                  </span>
                  <span className={`text-sm mb-1 ${
                    plan.highlighted ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"
                  }`}>
                    / mo
                  </span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-3.5 flex-1 mb-10">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0">
                      <Check highlighted={plan.highlighted} />
                    </span>
                    <span className={`text-xs leading-relaxed ${
                      plan.highlighted ? "text-[var(--fg-on-dark-80)]" : "text-[var(--foreground-muted)]"
                    }`}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                className={`font-mono text-[10px] tracking-[0.14em] uppercase font-medium px-6 py-4 text-center transition-opacity duration-200 hover:opacity-75 cursor-pointer ${
                  plan.highlighted
                    ? "bg-[var(--background)] text-[var(--foreground)]"
                    : "border border-[var(--border-strong)] text-[var(--foreground)]"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* ── Comparison Table ── */}
        <div className="mb-24">
          <div className="text-center mb-10">
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-3">
              Compare
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-light text-[var(--foreground)]">
              What&apos;s included
            </h2>
          </div>

          {/* Scrollable on mobile */}
          <div className="overflow-x-auto">
            <div style={{ minWidth: 560 }}>

              {/* Column headers */}
              <div
                className="grid"
                style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1px", background: "var(--border)", marginBottom: "1px" }}
              >
                <div className="bg-[var(--background)] py-3 px-4" />
                {PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    className={`py-3 px-4 ${plan.highlighted ? "bg-[var(--foreground)]" : "bg-[var(--background)]"}`}
                  >
                    <p className={`font-mono text-[10px] tracking-[0.16em] uppercase font-medium ${
                      plan.highlighted ? "text-[var(--background)]" : "text-[var(--foreground)]"
                    }`}>
                      {plan.name}
                    </p>
                  </div>
                ))}
              </div>

              {/* Rows */}
              {COMPARISON.map((row, idx) => (
                <div
                  key={row.label}
                  className="grid"
                  style={{
                    gridTemplateColumns: "1fr 1fr 1fr 1fr",
                    gap: "1px",
                    background: "var(--border)",
                    marginBottom: idx < COMPARISON.length - 1 ? "1px" : 0,
                  }}
                >
                  {/* Label */}
                  <div className={`py-3.5 px-4 ${idx % 2 === 0 ? "bg-[var(--background)]" : "bg-[var(--surface)]"}`}>
                    <span className="text-xs text-[var(--foreground-muted)]">{row.label}</span>
                  </div>

                  {/* Values */}
                  {(["basic", "pro", "premium"] as const).map((planId) => {
                    const val = row[planId];
                    const isHighlighted = planId === "pro";
                    const baseBg = idx % 2 === 0 ? "bg-[var(--background)]" : "bg-[var(--surface)]";
                    return (
                      <div
                        key={planId}
                        className={`py-3.5 px-4 flex items-center ${
                          isHighlighted ? "bg-[var(--fg-overlay-05)]" : baseBg
                        }`}
                      >
                        {typeof val === "boolean" ? (
                          val ? <Check highlighted={false} /> : <Cross />
                        ) : (
                          <span className={`text-xs ${
                            isHighlighted ? "text-[var(--foreground)] font-medium" : "text-[var(--foreground-muted)]"
                          }`}>
                            {val}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── FAQ ── */}
        <div className="mb-24 max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-3">
              Questions
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-light text-[var(--foreground)]">
              Good to know
            </h2>
          </div>

          <div className="border-t border-[var(--border)]">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>

        {/* ── Bottom CTA ── */}
        <div className="mb-20 text-center">
          <p className="font-display text-2xl md:text-3xl font-light text-[var(--foreground)] mb-3">
            Not sure which plan?
          </p>
          <p className="text-sm text-[var(--foreground-muted)] mb-8">
            Start with Basic and upgrade anytime — no friction.
          </p>
          <button className="font-mono text-[10px] tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-4 hover:opacity-80 transition-opacity duration-200 cursor-pointer">
            Start Basic →
          </button>
        </div>

      </div>
    </div>
  );
}
