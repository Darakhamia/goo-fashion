"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getStoredConsent, setStoredConsent, type CookieConsent } from "@/lib/consent";
import { useOverlayPresence } from "@/lib/hooks/useOverlayPresence";
import { hasBuyBar } from "@/components/layout/MobileBottomNav";

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

  const ov = useOverlayPresence(visible && !pathname?.startsWith("/goo-studio"));
  if (!ov.rendered) return null;

  const choose = (value: CookieConsent) => {
    setStoredConsent(value);
    setVisible(false);
  };

  // Phones (mockup v2, §12.14): a surface plaque 8px above the bottom nav (or
  // above the 64px buy bar that replaces it), no drop shadow — `shadow-none!`
  // outranks the inline one — and the two choices as pills, the soft "Decline"
  // first and the filled "Accept" second.
  const above = pathname && hasBuyBar(pathname)
    ? "bottom-[calc(env(safe-area-inset-bottom)+78px)]"
    : "bottom-[calc(env(safe-area-inset-bottom)+64px)]";

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      onTransitionEnd={ov.onTransitionEnd}
      className={ov.cls(`fixed left-3 right-3 ${above} md:left-6 md:right-auto md:bottom-6 md:w-[360px] z-[60] rounded-3xl md:rounded-2xl border border-[var(--border)] bg-[var(--surface)] md:bg-[var(--background)] overflow-hidden p-4 md:p-5 max-md:shadow-none! ov-rise`)}
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.28)" }}
    >
      <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-2 max-md:text-[15px] max-md:font-semibold max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground)] max-md:mb-1.5">
        Cookies
      </p>
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-[13px] max-md:leading-[1.5]">
        We&rsquo;d like to set one optional analytics cookie (PostHog, EU-hosted) to understand how GOO is
        used. Essential sign-in cookies are always on. Details in our{" "}
        <Link href="/cookie" className="text-[var(--foreground)] link-underline">Cookie Policy</Link>.
      </p>
      <div className="flex gap-2 mt-4 max-md:mt-3.5">
        <button
          onClick={() => choose("accepted")}
          className="flex-1 h-11 md:h-10 rounded-xl flex items-center justify-center text-[11px] tracking-[0.1em] uppercase font-semibold bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-opacity max-md:rounded-full max-md:text-[15px] max-md:normal-case max-md:tracking-normal"
        >
          Accept
        </button>
        <button
          onClick={() => choose("declined")}
          className="flex-1 h-11 md:h-10 rounded-xl border border-[var(--border)] flex items-center justify-center text-[11px] tracking-[0.1em] uppercase font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors max-md:order-first max-md:rounded-full max-md:border-0 max-md:bg-[var(--fg-overlay-08)] max-md:text-[15px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground)]"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
