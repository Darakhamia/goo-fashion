"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { planPriceLabel, PLAN_PRICE_UAH, type PlanId } from "@/lib/plans";

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
  { label: "Price",               basic: `$10 (${PLAN_PRICE_UAH.basic} ₴)`, pro: `$25 (${PLAN_PRICE_UAH.pro} ₴)`, premium: `$45 (${PLAN_PRICE_UAH.premium} ₴)` },
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
    a: `Not at the moment. Plans start at $10 (${PLAN_PRICE_UAH.basic} ₴)/month. We're keeping things simple during early access — a free tier may come later.`,
  },
  {
    q: "Do unused credits roll over?",
    a: "No — generations and AI messages reset each month. This keeps performance consistent for everyone on the platform.",
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

/* On a phone the highlighted card is a ringed plaque, not a dark fill, so its
   marks stay in the page's foreground colour below md. */
function Check({ highlighted }: { highlighted: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`max-md:w-[15px] max-md:h-[15px] ${highlighted ? "text-[var(--foreground)] md:text-[var(--background)]" : "text-[var(--foreground)]"}`}>
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
    <div>
      <button
        className="w-full min-h-14 md:min-h-0 flex items-center justify-between py-3 md:py-5 text-left gap-3 md:gap-6 group"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="text-[15px] md:text-sm text-[var(--foreground)]">{q}</span>
        <svg
          width="11" height="11" viewBox="0 0 12 12" fill="none"
          className={`shrink-0 max-md:w-4 max-md:h-4 text-[var(--foreground-muted)] transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: open ? "200px" : "0px" }}
      >
        <p className="pb-4 md:pb-5 text-[14px] md:text-sm text-[var(--foreground-muted)] leading-relaxed max-w-xl">
          {a}
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

// Pro is highlighted unless the link says otherwise: the upgrade prompt sends
// people to /plans?highlight=<plan> for the plan the feature actually needs.
const DEFAULT_HIGHLIGHT = PLANS.find((p) => p.highlighted)?.id ?? "pro";

function PlansContent({ highlightId }: { highlightId: string }) {
  const router = useRouter();
  const plans = PLANS.map((p) => ({ ...p, highlighted: p.id === highlightId }));

  function handleSelectPlan(planId: string) {
    router.push(`/subscribe?plan=${planId}`);
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[1100px] mx-auto px-3 md:px-12">

        {/* ── Header ── Phones: a calm left-aligned title (DESIGN_SYSTEM.md §12.1). */}
        <div className="px-1 pt-5 mb-5 md:px-0 md:pt-24 md:mb-16 md:text-center animate-fade-up">
          <p className="hidden md:block font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--foreground-subtle)] mb-4">
            Pricing
          </p>
          {/* Desktop keeps the -0.022em the size rule gave text-5xl (§12.13, tracking trap). */}
          <h1 className="text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] md:text-6xl md:leading-[1.05] md:font-black md:uppercase md:tracking-[-0.022em] text-[var(--foreground)] mb-2 md:mb-5">
            Choose your plan
          </h1>
          <p className="text-[15px] leading-[1.45] md:text-sm md:leading-relaxed text-[var(--foreground-muted)] max-w-sm md:mx-auto">
            All plans include the full GOO catalog, the outfit builder, and the AI stylist.
          </p>
        </div>

        {/* ── Plan Cards ── */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-2.5 md:gap-5 mb-9 md:mb-24"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ show: { transition: { staggerChildren: 0.1 } } }}
        >
          {plans.map((plan) => (
            <motion.div
              key={plan.id}
              variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              // Phones: every card is a plaque; the highlighted one gets a ring
              // rather than the desktop's dark fill (mockup v2 «Б · Тарифы»).
              className={`flex flex-col p-[18px] md:p-10 relative rounded-[20px] md:rounded-2xl bg-[var(--surface)] md:border transition-colors duration-200 ${
                plan.highlighted
                  ? "shadow-[inset_0_0_0_1.5px_var(--foreground)] md:bg-[var(--foreground)] md:border-[var(--foreground)] md:shadow-lg"
                  : "md:bg-[var(--background)] md:border-[var(--border)] md:hover:border-[var(--foreground-muted)] md:hover:shadow-md"
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute top-[18px] right-[18px] md:top-6 md:right-6">
                  <span className={`h-[26px] flex items-center text-[12px] font-semibold bg-[var(--foreground)] text-[var(--background)] md:h-auto md:inline md:font-mono md:text-[8px] md:tracking-[0.18em] md:uppercase md:text-[var(--foreground)] md:bg-[var(--background)] px-2.5 md:py-1 rounded-full ${
                    plan.highlighted ? "" : "md:border md:border-[var(--border)]"
                  }`}>
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Name */}
              <p className={`text-[16px] max-md:leading-[26px] font-semibold mb-2.5 text-[var(--foreground)] md:font-mono md:text-[10px] md:tracking-[0.2em] md:uppercase md:font-medium md:mb-3 ${
                plan.highlighted ? "md:text-[var(--fg-on-dark-60)]" : "md:text-[var(--foreground-subtle)]"
              }`}>
                {plan.name}
              </p>

              {/* Price */}
              <div className="mb-3.5 md:mb-8 md:pb-8 md:border-b md:border-current/10">
                <div className="flex items-baseline gap-1 md:items-end md:gap-1.5">
                  {/* Desktop keeps the -0.022em the size rule gave text-6xl (§12.13). */}
                  <span className={`text-[38px] font-bold tracking-[-0.03em] md:text-6xl md:font-black md:tracking-[-0.022em] leading-none ${
                    plan.highlighted ? "text-[var(--foreground)] md:text-[var(--background)]" : "text-[var(--foreground)]"
                  }`}>
                    ${plan.price}
                  </span>
                  <span className={`text-[15px] md:text-sm md:mb-1 ${
                    plan.highlighted ? "text-[var(--foreground-muted)] md:text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"
                  }`}>
                    / mo
                  </span>
                </div>
                <p className={`text-[13px] mt-1 md:text-xs md:mt-2 ${
                  plan.highlighted ? "text-[var(--foreground-muted)] md:text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"
                }`}>
                  charged as {planPriceLabel(plan.id as PlanId)} / mo
                </p>
              </div>

              {/* Features */}
              <ul className="space-y-2 md:space-y-3.5 flex-1 mb-4 md:mb-10">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 md:items-start md:gap-3">
                    <span className="md:mt-0.5 shrink-0 max-md:flex">
                      <Check highlighted={plan.highlighted} />
                    </span>
                    <span className={`text-[14px] leading-snug md:text-xs md:leading-relaxed ${
                      plan.highlighted ? "text-[var(--foreground)] md:text-[var(--fg-on-dark-80)]" : "text-[var(--foreground)] md:text-[var(--foreground-muted)]"
                    }`}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => handleSelectPlan(plan.id)}
                // Phones: the highlighted plan's pill is the one primary on the card list.
                className={`h-12 rounded-full text-[15px] font-semibold md:h-auto md:py-4 md:rounded-xl md:font-mono md:text-[10px] md:tracking-[0.14em] md:uppercase md:font-medium px-6 text-center transition-[color,background-color,border-color,opacity] duration-200 hover:opacity-80 cursor-pointer ${
                  plan.highlighted
                    ? "bg-[var(--foreground)] text-[var(--background)] md:bg-[var(--background)] md:text-[var(--foreground)]"
                    : "bg-[var(--fg-overlay-08)] text-[var(--foreground)] md:bg-transparent md:border md:border-[var(--border-strong)] md:hover:bg-[var(--surface)]"
                }`}
              >
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Comparison Table ── */}
        <div className="mb-9 md:mb-24">
          <div className="px-1 mb-3 md:px-0 md:text-center md:mb-10">
            <p className="hidden md:block font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-3">
              Compare
            </p>
            {/* Desktop keeps the -0.015em the size rule gave text-3xl (§12.13). */}
            <h2 className="text-[20px] font-semibold tracking-[-0.01em] md:text-4xl md:font-bold md:uppercase md:tracking-[-0.015em] text-[var(--foreground)]">
              What&apos;s included
            </h2>
          </div>

          {/* Phones: four narrow columns on one plaque, no sideways scroll
              (mockup v2 «Б · Тарифы»). Prices move to the line under it. */}
          <div className="md:hidden rounded-2xl bg-[var(--surface)] overflow-hidden">
            <div className="h-10 grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center px-3 text-[12px] text-[var(--foreground-muted)]">
              <span />
              {plans.map((plan) => (
                <span key={plan.id} className={`text-center ${plan.highlighted ? "text-[var(--foreground)] font-semibold" : ""}`}>{plan.name}</span>
              ))}
            </div>
            {COMPARISON.filter((row) => row.label !== "Price").map((row) => (
              <div key={row.label} className="min-h-11 py-1.5 grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center gap-x-1 px-3 shadow-[inset_0_1px_0_var(--border)] text-[13px]">
                <span className="text-[var(--foreground-muted)] leading-tight">{row.label}</span>
                {(["basic", "pro", "premium"] as const).map((planId) => {
                  const val = row[planId];
                  return (
                    <span key={planId} className={`text-center leading-tight text-[var(--foreground)] ${planId === highlightId ? "font-semibold" : ""}`}>
                      {typeof val === "boolean" ? (
                        val ? <span aria-label="Included">✓</span> : <span aria-label="Not included" className="text-[var(--foreground-muted)]">—</span>
                      ) : val}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="md:hidden mt-2 px-1 text-[12px] leading-relaxed text-[var(--foreground-muted)]">
            Prices: {plans.map((plan) => `${plan.name} $${plan.price} (${planPriceLabel(plan.id as PlanId)})`).join(", ")} a month.
          </p>

          {/* Scrollable on mobile */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-[var(--border)]">
            <div style={{ minWidth: 560 }}>

              {/* Column headers */}
              <div className="grid border-b border-[var(--border)]" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
                <div className="bg-[var(--surface)] py-3.5 px-4" />
                {plans.map((plan, i) => (
                  <div
                    key={plan.id}
                    className={`py-3.5 px-4 ${plan.highlighted ? "bg-[var(--foreground)]" : "bg-[var(--surface)]"} ${i < plans.length - 1 ? "border-r border-[var(--border)]" : ""}`}
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
                  className={`grid ${idx < COMPARISON.length - 1 ? "border-b border-[var(--border)]" : ""}`}
                  style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}
                >
                  {/* Label */}
                  <div className={`py-3.5 px-4 border-r border-[var(--border)] ${idx % 2 === 0 ? "bg-[var(--background)]" : "bg-[var(--surface)]"}`}>
                    <span className="text-xs text-[var(--foreground-muted)]">{row.label}</span>
                  </div>

                  {/* Values */}
                  {(["basic", "pro", "premium"] as const).map((planId, ci) => {
                    const val = row[planId];
                    const isHighlighted = planId === highlightId;
                    const baseBg = idx % 2 === 0 ? "bg-[var(--background)]" : "bg-[var(--surface)]";
                    return (
                      <div
                        key={planId}
                        className={`py-3.5 px-4 flex items-center ${ci < 2 ? "border-r border-[var(--border)]" : ""} ${
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
        <div className="mb-7 md:mb-24 max-w-2xl mx-auto">
          <div className="px-1 mb-3 md:px-0 md:text-center md:mb-10">
            <p className="hidden md:block font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-3">
              Questions
            </p>
            <h2 className="text-[20px] font-semibold tracking-[-0.01em] md:text-4xl md:font-bold md:uppercase md:tracking-[-0.015em] text-[var(--foreground)]">
              Good to know
            </h2>
          </div>

          {/* Phones: an accordion of rows on one plaque (§12.11). */}
          <div className="rounded-2xl bg-[var(--surface)] md:bg-transparent md:border md:border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
            {FAQ_ITEMS.map((item) => (
              <div key={item.q} className="px-4 md:px-6">
                <FaqItem q={item.q} a={item.a} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom CTA ── */}
        {/* Phones: a closing plaque (mockup v2 «Б · Тарифы»). */}
        <div className="mb-8 md:mb-20 text-center rounded-[20px] bg-[var(--surface)] px-[18px] py-[22px] md:rounded-none md:bg-transparent md:p-0">
          <p className="text-[18px] font-semibold mb-1.5 md:text-3xl md:font-bold md:mb-3 text-[var(--foreground)]">
            Not sure which plan?
          </p>
          <p className="text-[14px] md:text-sm text-[var(--foreground-muted)] mb-4 md:mb-8">
            Start with Basic and upgrade anytime — no friction.
          </p>
          <button
            onClick={() => handleSelectPlan("basic")}
            className="h-[46px] px-[22px] rounded-full text-[15px] font-semibold md:h-auto md:px-8 md:py-4 md:rounded-xl md:font-mono md:text-[10px] md:tracking-[0.14em] md:uppercase md:font-medium text-[var(--background)] bg-[var(--foreground)] hover:opacity-80 transition-opacity duration-200 cursor-pointer"
          >
            Start Basic →
          </button>
        </div>

      </div>
    </div>
  );
}

function PlansWithHighlight() {
  const highlight = useSearchParams().get("highlight");
  const highlightId = PLANS.find((p) => p.id === highlight)?.id ?? DEFAULT_HIGHLIGHT;
  return <PlansContent highlightId={highlightId} />;
}

// useSearchParams needs a Suspense boundary. The fallback is the same page with
// the default highlight, so the prerendered HTML still carries the full content.
export default function PlansPage() {
  return (
    <Suspense fallback={<PlansContent highlightId={DEFAULT_HIGHLIGHT} />}>
      <PlansWithHighlight />
    </Suspense>
  );
}
