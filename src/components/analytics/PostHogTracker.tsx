"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * PostHog product analytics — session replays, funnels, heatmaps, retention.
 * Activates only when NEXT_PUBLIC_POSTHOG_KEY is set; otherwise renders nothing
 * and ships no extra work. The library itself is imported dynamically so it
 * stays out of the bundle when unconfigured.
 */
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

export default function PostHogTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!POSTHOG_KEY) return;
    import("posthog-js").then(({ default: posthog }) => {
      if (!posthog.__loaded) {
        posthog.init(POSTHOG_KEY, {
          api_host: POSTHOG_HOST,
          capture_pageview: false, // we capture manually on route change below
          capture_pageleave: true,
          persistence: "localStorage+cookie",
        });
      }
    });
  }, []);

  // Capture SPA route changes as pageviews
  useEffect(() => {
    if (!POSTHOG_KEY || !pathname) return;
    if (pathname.startsWith("/goo-studio")) return; // don't track admin surfaces
    import("posthog-js").then(({ default: posthog }) => {
      if (!posthog.__loaded) return;
      const url = searchParams?.size
        ? `${window.location.origin}${pathname}?${searchParams.toString()}`
        : `${window.location.origin}${pathname}`;
      posthog.capture("$pageview", { $current_url: url });
    });
  }, [pathname, searchParams]);

  return null;
}
