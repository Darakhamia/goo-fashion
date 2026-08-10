"use client";

import { useEffect, useState } from "react";
import { getStoredConsent, setStoredConsent, type CookieConsent } from "@/lib/consent";

const OPTIONS: { value: CookieConsent; label: string }[] = [
  { value: "accepted", label: "Allow" },
  { value: "declined", label: "Decline" },
];

/** Lets a visitor review and change their analytics-cookie choice on the Cookie Policy page. */
export default function CookieSettings() {
  const [choice, setChoice] = useState<CookieConsent | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(getStoredConsent());
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const select = (value: CookieConsent) => {
    setStoredConsent(value);
    setChoice(value);
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-2">
        Analytics cookies
      </p>
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-4">
        {choice === "accepted"
          ? "Currently allowed. Analytics stops the moment you decline."
          : choice === "declined"
            ? "Currently declined. No analytics cookie is set."
            : "No choice saved yet — analytics stays off until you allow it."}
      </p>
      <div className="flex gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => select(option.value)}
            aria-pressed={choice === option.value}
            className={`px-4 py-2 rounded-full border text-[11px] tracking-[0.12em] uppercase font-medium transition-all duration-200 ${
              choice === option.value
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
