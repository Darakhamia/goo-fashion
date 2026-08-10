"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getStoredConsent, onConsentChange } from "@/lib/consent";

/**
 * PostHog product analytics — session replays, funnels, heatmaps, retention.
 * Activates only when NEXT_PUBLIC_POSTHOG_KEY is set AND the visitor accepted
 * analytics cookies via the consent banner; otherwise renders nothing and
 * ships no extra work. The library itself is imported dynamically so it
 * stays out of the bundle when unconfigured or declined.
 */
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

export default function PostHogTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    setConsented(getStoredConsent() === "accepted");
    return onConsentChange((value) => {
      setConsented(value === "accepted");
      if (value === "declined") {
        import("posthog-js").then(({ default: posthog }) => {
          if (posthog.__loaded) posthog.opt_out_capturing();
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!POSTHOG_KEY || !consented) return;
    import("posthog-js").then(({ default: posthog }) => {
      if (!posthog.__loaded) {
        posthog.init(POSTHOG_KEY, {
          api_host: POSTHOG_HOST,
          capture_pageview: false, // we capture manually on route change below
          capture_pageleave: true,
          persistence: "localStorage+cookie",
        });
      } else if (posthog.has_opted_out_capturing()) {
        // Declined earlier in this session, then re-accepted on the cookie page
        posthog.opt_in_capturing();
      }
    });
  }, [consented]);

  // Capture SPA route changes as pageviews
  useEffect(() => {
    if (!POSTHOG_KEY || !consented || !pathname) return;
    if (pathname.startsWith("/goo-studio")) return; // don't track admin surfaces
    import("posthog-js").then(({ default: posthog }) => {
      if (!posthog.__loaded) return;
      const url = searchParams?.size
        ? `${window.location.origin}${pathname}?${searchParams.toString()}`
        : `${window.location.origin}${pathname}`;
      posthog.capture("$pageview", { $current_url: url });
    });
  }, [pathname, searchParams, consented]);

  return null;
}
