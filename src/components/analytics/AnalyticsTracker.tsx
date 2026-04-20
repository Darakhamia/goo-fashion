"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  beacon,
  getSessionId,
  parseUTM,
  detectDevice,
  detectBrowser,
  detectOS,
} from "@/lib/analytics/session";

// Paths we never track (admin surfaces, API routes).
function shouldSkip(path: string): boolean {
  return (
    path.startsWith("/admin") ||
    path.startsWith("/api/")  ||
    path === "/robots.txt"    ||
    path === "/sitemap.xml"
  );
}

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

  // ── Page view ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pathname || shouldSkip(pathname)) return;
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;

    const ua = navigator.userAgent;
    const device  = detectDevice(ua);
    const browser = detectBrowser(ua);
    const os      = detectOS(ua);
    const { utmSource, utmMedium, utmCampaign } = parseUTM(window.location.search);

    // Load timing (if available)
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const load_ms = nav ? Math.round(nav.loadEventEnd - nav.startTime) : null;
    const ttfb_ms = nav ? Math.round(nav.responseStart - nav.requestStart) : null;

    beacon("/api/analytics/pageview", {
      session_id: getSessionId(),
      path:     pathname,
      referrer: document.referrer || null,
      utm_source:   utmSource   ?? null,
      utm_medium:   utmMedium   ?? null,
      utm_campaign: utmCampaign ?? null,
      device,
      browser,
      os,
      load_ms: load_ms && load_ms > 0 && load_ms < 600_000 ? load_ms : null,
      ttfb_ms: ttfb_ms && ttfb_ms > 0 && ttfb_ms < 600_000 ? ttfb_ms : null,
    });
  }, [pathname]);

  // ── Web vitals (attach once) ────────────────────────────────────────────
  useEffect(() => {
    if (vitalsAttached.current) return;
    vitalsAttached.current = true;

    const device = detectDevice(navigator.userAgent);
    let cancelled = false;
    import("web-vitals").then((wv) => {
      if (cancelled) return;
      const current = () => location.pathname;
      wv.onLCP((m)  => reportVital(m, current(), device));
      wv.onINP((m)  => reportVital(m, current(), device));
      wv.onCLS((m)  => reportVital(m, current(), device));
      wv.onFCP((m)  => reportVital(m, current(), device));
      wv.onTTFB((m) => reportVital(m, current(), device));
    }).catch(() => {
      /* web-vitals not installed — skip silently */
    });

    return () => { cancelled = true; };
  }, []);

  return null;
}
