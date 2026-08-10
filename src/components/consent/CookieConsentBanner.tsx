"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getStoredConsent, setStoredConsent, type CookieConsent } from "@/lib/consent";

/**
 * Consent banner for the only optional cookie on the site (PostHog analytics).
 * Rendered only while no choice is stored and only when analytics is configured
 * at all — without NEXT_PUBLIC_POSTHOG_KEY there is nothing to consent to.
 */
const POSTHOG_ENABLED = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);

export default function CookieConsentBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(POSTHOG_ENABLED && getStoredConsent() === null);
  }, []);

  if (!visible || pathname?.startsWith("/goo-studio")) return null;

  const choose = (value: CookieConsent) => {
    setStoredConsent(value);
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed left-4 right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.75rem)] md:left-6 md:right-auto md:bottom-6 md:w-[360px] z-[60] rounded-2xl border border-[var(--border)] bg-[var(--background)] overflow-hidden p-5 animate-fade-up"
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.28)" }}
    >
      <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-2">
        Cookies
      </p>
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        We&rsquo;d like to set one optional analytics cookie (PostHog, EU-hosted) to understand how GOO is
        used. Essential sign-in cookies are always on. Details in our{" "}
        <Link href="/cookie" className="text-[var(--foreground)] link-underline">Cookie Policy</Link>.
      </p>
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => choose("accepted")}
          className="flex-1 h-11 md:h-10 rounded-xl flex items-center justify-center text-[11px] tracking-[0.1em] uppercase font-semibold bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-opacity"
        >
          Accept
        </button>
        <button
          onClick={() => choose("declined")}
          className="flex-1 h-11 md:h-10 rounded-xl border border-[var(--border)] flex items-center justify-center text-[11px] tracking-[0.1em] uppercase font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
