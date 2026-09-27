"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  beacon,
  getSessionId,
  getCountryCode,
  parseUTM,
  detectDevice,
  detectBrowser,
  detectOS,
} from "@/lib/analytics/session";
import { isUntrackedPath as shouldSkip } from "@/lib/analytics/paths";

// ──────────────────────────────────────────────────────────────────────────
// Core Web Vitals reporter — uses next/web-vitals dynamic import (~2KB gz).
// ──────────────────────────────────────────────────────────────────────────
type Metric = {
  name: string;
  value: number;
  rating?: string;
};

function reportVital(m: Metric, path: string, device: string) {
  beacon("/api/analytics/web-vitals", {
    session_id: getSessionId(),
    path,
    metric: m.name,
    value: m.value,
    rating: m.rating ?? null,
    device,
  });
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);
  const vitalsAttached = useRef(false);
  // The browser keeps one navigation-timing entry per tab: the hard load. A
  // client-side transition has no load of its own, so reading that entry again
  // stamped every later page with the first page's timings.
  const hardLoadPending = useRef(true);

  // ── Page view ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pathname) return;
    // Consumed even when the view is skipped: a tab that opened on the admin
    // panel has no public page whose load it measured.
    const isHardLoad = hardLoadPending.current;
    hardLoadPending.current = false;
    if (shouldSkip(pathname)) return;
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;

    const ua = navigator.userAgent;
    const device  = detectDevice(ua);
    const browser = detectBrowser(ua);
    const os      = detectOS(ua);
    const { utmSource, utmMedium, utmCampaign } = parseUTM(window.location.search);

    const nav = isHardLoad
      ? (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)
      : undefined;
    const load_ms = nav ? Math.round(nav.loadEventEnd - nav.startTime) : null;
    // Same definition as web-vitals' TTFB (from the start of the navigation),
    // so the two cannot disagree.
    const ttfb_ms = nav ? Math.round(nav.responseStart - nav.startTime) : null;

    // Resolve country via Cloudflare trace (cached 24h), then beacon.
    getCountryCode().then((country) => {
      beacon("/api/analytics/pageview", {
        session_id: getSessionId(),
        path:     pathname,
        referrer: document.referrer || null,
        utm_source:   utmSource   ?? null,
        utm_medium:   utmMedium   ?? null,
        utm_campaign: utmCampaign ?? null,
        country,
        device,
        browser,
        os,
        load_ms: load_ms && load_ms > 0 && load_ms < 600_000 ? load_ms : null,
        ttfb_ms: ttfb_ms && ttfb_ms > 0 && ttfb_ms < 600_000 ? ttfb_ms : null,
      });
    });
  }, [pathname]);

  // ── Web vitals (attach once) ────────────────────────────────────────────
  useEffect(() => {
    if (vitalsAttached.current) return;
    vitalsAttached.current = true;
    // LCP, FCP and TTFB measure the tab's hard load; one that opened on the
    // admin panel measured an admin page, whatever path it reports from.
    if (shouldSkip(location.pathname)) return;

    const device = detectDevice(navigator.userAgent);
    let cancelled = false;
    import("web-vitals").then((wv) => {
      if (cancelled) return;
      // CLS and INP report late — on leaving the tab — so check the path again.
      const report = (m: Metric) => {
        const path = location.pathname;
        if (!shouldSkip(path)) reportVital(m, path, device);
      };
      wv.onLCP(report);
      wv.onINP(report);
      wv.onCLS(report);
      wv.onFCP(report);
      wv.onTTFB(report);
    }).catch(() => {
      /* web-vitals not installed — skip silently */
    });

    return () => { cancelled = true; };
  }, []);

  return null;
}
