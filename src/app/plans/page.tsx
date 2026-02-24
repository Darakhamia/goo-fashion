"use client";

import { useState } from "react";
import Link from "next/link";
import { plans } from "@/lib/data/plans";

export default function PlansPage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const yearlyDiscount = 0.2; // 20% off

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        {/* Header */}
        <div className="pt-16 md:pt-24 mb-16 text-center max-w-xl mx-auto">
          <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-[var(--foreground-subtle)] mb-4">
            Plans
          </p>
          <h1 className="font-display text-4xl md:text-6xl font-light text-[var(--foreground)] mb-5 leading-tight">
            Simple.
            <br />
            <em>Honest pricing.</em>
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
            Start for free. Upgrade when you&apos;re ready. No dark patterns, no hidden fees.
          </p>

          {/* Billing Toggle */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={() => setBilling("monthly")}
              className={`text-xs tracking-[0.1em] uppercase transition-colors duration-200 ${
                billing === "monthly"
                  ? "text-[var(--foreground)]"
                  : "text-[var(--foreground-muted)]"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling(billing === "monthly" ? "yearly" : "monthly")}
              className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${
                billing === "yearly" ? "bg-[var(--foreground)]" : "bg-[var(--border-strong)]"
              }`}
              aria-label="Toggle billing"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[var(--background)] transition-transform duration-300 ${
                  billing === "yearly" ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`text-xs tracking-[0.1em] uppercase transition-colors duration-200 ${
                billing === "yearly"
                  ? "text-[var(--foreground)]"
                  : "text-[var(--foreground-muted)]"
              }`}
            >
              Yearly{" "}
              <span className="text-[var(--foreground-subtle)] normal-case tracking-normal">
                −20%
              </span>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border)] max-w-5xl mx-auto">
          {plans.map((plan) => {
            const displayPrice =
              billing === "yearly" && plan.price > 0
                ? Math.floor(plan.price * (1 - yearlyDiscount))
                : plan.price;

            return (
              <div
                key={plan.id}
                className={`flex flex-col p-8 md:p-10 relative ${
                  plan.highlighted
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "bg-[var(--background)]"
                }`}
              >
                {/* Highlighted badge */}
                {plan.highlighted && (
                  <div className="absolute top-4 right-4">
                    <span className="text-[8px] tracking-[0.18em] uppercase font-medium text-[var(--foreground)] bg-[var(--background)] px-2.5 py-1.5">
                      Popular
                    </span>
                  </div>
                )}

                {/* Plan name */}
                <p
                  className={`text-[10px] tracking-[0.2em] uppercase font-medium mb-2 ${
                    plan.highlighted
                      ? "text-[var(--fg-on-dark-60)]"
                      : "text-[var(--foreground-subtle)]"
                  }`}
                >
                  {plan.name}
                </p>

                {/* Price */}
                <div className="mb-8 pb-8 border-b border-current/10">
                  <div className="flex items-end gap-1">
                    <span className="font-display text-5xl font-light">
                      {plan.price === 0 ? "Free" : `$${displayPrice}`}
                    </span>
                    {plan.price > 0 && (
                      <span
                        className={`text-sm mb-2 ${
                          plan.highlighted
                            ? "text-[var(--fg-on-dark-60)]"
                            : "text-[var(--foreground-muted)]"
                        }`}
                      >
                        / mo
                      </span>
                    )}
                  </div>
                  {billing === "yearly" && plan.price > 0 && (
                    <p
                      className={`text-xs mt-1 ${
                        plan.highlighted
                          ? "text-[var(--fg-on-dark-60)]"
                          : "text-[var(--foreground-muted)]"
                      }`}
                    >
                      Billed ${Math.floor(plan.price * (1 - yearlyDiscount) * 12)} / year
                    </p>
                  )}
                </div>

                {/* AI Outfits */}
                <div className="mb-6">
                  <p
                    className={`text-[10px] tracking-[0.14em] uppercase mb-1.5 ${
                      plan.highlighted
                        ? "text-[var(--fg-on-dark-60)]"
                        : "text-[var(--foreground-subtle)]"
                    }`}
                  >
                    AI Outfits
                  </p>
                  <p className="font-display text-xl font-light">
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
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        className={`mt-0.5 shrink-0 ${
                          plan.highlighted
                            ? "text-[var(--background)]"
                            : "text-[var(--foreground)]"
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
                          plan.highlighted
                            ? "text-[var(--fg-on-dark-80)]"
                            : "text-[var(--foreground-muted)]"
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
                  className={`text-xs tracking-[0.14em] uppercase font-medium px-6 py-4 text-center transition-opacity duration-200 hover:opacity-80 ${
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

        {/* FAQ / Trust section */}
        <div className="mt-20 md:mt-28 max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] tracking-[0.2em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
              Questions
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-light text-[var(--foreground)]">
              Good to know
            </h2>
          </div>

          <div className="space-y-px">
            {[
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
                a: "You set your size and body profile during onboarding. The AI considers your proportions when selecting and combining pieces.",
              },
            ].map((faq) => (
              <details
                key={faq.q}
                className="group border-b border-[var(--border)]"
              >
                <summary className="flex items-center justify-between py-5 cursor-pointer list-none">
                  <p className="text-sm text-[var(--foreground)]">{faq.q}</p>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    className="shrink-0 text-[var(--foreground-muted)] group-open:rotate-180 transition-transform duration-200"
                  >
                    <path
                      d="M2 4L6 8L10 4"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </summary>
                <p className="pb-5 text-sm text-[var(--foreground-muted)] leading-relaxed max-w-xl">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-20 md:mt-28 mb-8 text-center">
          <p className="text-sm text-[var(--foreground-muted)] mb-4">
            Not sure which plan is right for you?
          </p>
          <Link
            href="/stylist"
            className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground)] link-underline"
          >
            Try the AI Stylist for free →
          </Link>
        </div>
      </div>
    </div>
  );
}
