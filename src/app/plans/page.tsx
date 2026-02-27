"use client";

import { useState } from "react";
import Link from "next/link";
import { plans } from "@/lib/data/plans";

const YEARLY_DISCOUNT = 0.2;

const FAQ = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. No contracts, no cancellation fees. Cancel in one click. Your access continues until the end of the billing period.",
  },
  {
    q: "What happens to my saved outfits if I downgrade?",
    a: "Your outfits remain saved and accessible. You just won't be able to generate new ones beyond the Free tier limit until you re-upgrade.",
  },
  {
    q: "Is price comparison data real-time?",
    a: "Prices are updated regularly throughout the day. We show the last-known price and link directly to the retailer for accurate final pricing.",
  },
  {
    q: "How does the AI stylist know my size?",
    a: "You set your size and body profile in your Style Profile. The AI considers your proportions when selecting and combining pieces.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[var(--border)]">
      <button
        className="w-full flex items-center justify-between py-5 text-left gap-6 group"
        onClick={() => setOpen(!open)}
      >
        <p className="text-sm text-[var(--foreground)] group-hover:text-[var(--foreground)] transition-colors">
          {q}
        </p>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
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

export default function PlansPage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <div className="pt-16 min-h-screen overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">

        {/* ── Header ── */}
        <div className="pt-16 md:pt-24 mb-6 text-center max-w-xl mx-auto animate-fade-up">
          <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-[var(--foreground-subtle)] mb-4">
            Pricing
          </p>
          <h1 className="font-display text-5xl md:text-7xl font-light text-[var(--foreground)] mb-5 leading-[1.05]">
            Simple.<br />
            <em className="text-[var(--foreground-muted)]">Honest.</em>
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
            Start for free. Upgrade when you&apos;re ready.<br className="hidden md:block" />
            No dark patterns, no hidden fees.
          </p>
        </div>

        {/* ── Billing Toggle ── */}
        <div className="mb-16 flex items-center justify-center gap-4 animate-fade-up" style={{ animationDelay: "80ms" }}>
          <button
            onClick={() => setBilling("monthly")}
            className={`text-xs tracking-[0.1em] uppercase transition-colors duration-200 ${
              billing === "monthly" ? "text-[var(--foreground)]" : "text-[var(--foreground-subtle)]"
            }`}
          >
            Monthly
          </button>

          <button
            onClick={() => setBilling(billing === "monthly" ? "yearly" : "monthly")}
            className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${
              billing === "yearly" ? "bg-[var(--foreground)]" : "bg-[var(--border-strong)]"
            }`}
            aria-label="Toggle billing"
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-[var(--background)] transition-all duration-300 ${
                billing === "yearly" ? "left-6" : "left-1"
              }`}
            />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setBilling("yearly")}
              className={`text-xs tracking-[0.1em] uppercase transition-colors duration-200 ${
                billing === "yearly" ? "text-[var(--foreground)]" : "text-[var(--foreground-subtle)]"
              }`}
            >
              Yearly
            </button>
            <span
              className={`text-[9px] tracking-[0.08em] uppercase font-medium px-2 py-0.5 border transition-all duration-300 ${
                billing === "yearly"
                  ? "border-[var(--foreground)] text-[var(--foreground)] opacity-100 translate-y-0"
                  : "border-transparent text-transparent opacity-0 -translate-y-1"
              }`}
            >
              −20%
            </span>
          </div>
        </div>

        {/* ── Plan Cards ── */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 max-w-5xl mx-auto stagger-children"
          style={{ gap: "1px", background: "var(--border)" }}
        >
          {plans.map((plan, i) => {
            const displayPrice =
              billing === "yearly" && plan.price > 0
                ? Math.floor(plan.price * (1 - YEARLY_DISCOUNT))
                : plan.price;

            return (
              <div
                key={plan.id}
                className={`flex flex-col p-8 md:p-10 relative animate-fade-up ${
                  plan.highlighted
                    ? "bg-[var(--foreground)]"
                    : "bg-[var(--background)]"
                }`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {/* Highlighted badge */}
                {plan.highlighted && (
                  <div className="absolute top-6 right-6">
                    <span className="text-[8px] tracking-[0.18em] uppercase font-semibold text-[var(--foreground)] bg-[var(--background)] px-2.5 py-1.5">
                      Most popular
                    </span>
                  </div>
                )}

                {/* Plan name */}
                <p
                  className={`text-[10px] tracking-[0.2em] uppercase font-medium mb-3 ${
                    plan.highlighted ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-subtle)]"
                  }`}
                >
                  {plan.name}
                </p>

                {/* Price */}
                <div className="mb-8 pb-8 border-b border-current/10">
                  <div className="flex items-end gap-1.5">
                    <span
                      className={`font-display text-6xl font-light leading-none transition-all duration-300 ${
                        plan.highlighted ? "text-[var(--background)]" : "text-[var(--foreground)]"
                      }`}
                    >
                      {plan.price === 0 ? "Free" : `$${displayPrice}`}
                    </span>
                    {plan.price > 0 && (
                      <span
                        className={`text-sm mb-1 ${
                          plan.highlighted ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"
                        }`}
                      >
                        / mo
                      </span>
                    )}
                  </div>
                  {billing === "yearly" && plan.price > 0 && (
                    <p
                      className={`text-xs mt-2 animate-fade-in ${
                        plan.highlighted ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"
                      }`}
                    >
                      ${Math.floor(plan.price * (1 - YEARLY_DISCOUNT) * 12)} billed annually
                    </p>
                  )}
                </div>

                {/* AI Outfits callout */}
                <div className="mb-6">
                  <p
                    className={`text-[9px] tracking-[0.14em] uppercase mb-1 ${
                      plan.highlighted ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-subtle)]"
                    }`}
                  >
                    AI Outfits
                  </p>
                  <p
                    className={`font-display text-2xl font-light ${
                      plan.highlighted ? "text-[var(--background)]" : "text-[var(--foreground)]"
                    }`}
                  >
                    {plan.aiOutfitsPerMonth === "unlimited"
                      ? "Unlimited"
                      : `${plan.aiOutfitsPerMonth} / month`}
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-10 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <svg
                        width="12" height="12" viewBox="0 0 12 12" fill="none"
                        className={`mt-0.5 shrink-0 ${
                          plan.highlighted ? "text-[var(--background)]" : "text-[var(--foreground-muted)]"
                        }`}
                      >
                        <path
                          d="M2 6L5 9L10 3"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span
                        className={`text-xs leading-relaxed ${
                          plan.highlighted ? "text-[var(--fg-on-dark-80)]" : "text-[var(--foreground-muted)]"
                        }`}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href={plan.price === 0 ? "/stylist" : `/checkout?plan=${plan.id}`}
                  className={`text-xs tracking-[0.14em] uppercase font-medium px-6 py-4 text-center transition-opacity duration-200 hover:opacity-75 ${
                    plan.highlighted
                      ? "bg-[var(--background)] text-[var(--foreground)]"
                      : "border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {plan.price === 0 ? "Start Free" : `Get ${plan.name}`}
                </Link>
              </div>
            );
          })}
        </div>

        {/* ── Trust strip ── */}
        <div className="mt-14 border-t border-b border-[var(--border)] py-4 overflow-hidden">
          <div className="flex items-center gap-12 animate-[marquee_18s_linear_infinite] w-max">
            {[
              "Cancel anytime",
              "No dark patterns",
              "Privacy first",
              "No hidden fees",
              "Free forever tier",
              "Real-time prices",
              "Cancel anytime",
              "No dark patterns",
              "Privacy first",
              "No hidden fees",
              "Free forever tier",
              "Real-time prices",
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-12 shrink-0">
                <span className="text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] whitespace-nowrap">
                  {text}
                </span>
                <span className="w-px h-3 bg-[var(--border-strong)]" />
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ ── */}
        <div className="mt-20 md:mt-28 max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] tracking-[0.2em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
              Questions
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-light text-[var(--foreground)]">
              Good to know
            </h2>
          </div>

          <div className="space-y-0">
            {FAQ.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>

        {/* ── Bottom CTA ── */}
        <div className="mt-20 md:mt-28 mb-16 text-center">
          <p className="font-display text-2xl md:text-3xl font-light text-[var(--foreground)] mb-4">
            Still deciding?
          </p>
          <p className="text-sm text-[var(--foreground-muted)] mb-6">
            Try the AI Stylist free — no card required.
          </p>
          <Link
            href="/stylist"
            className="inline-block text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-4 hover:opacity-80 transition-opacity duration-200"
          >
            Start with Free →
          </Link>
        </div>

      </div>
    </div>
  );
}
