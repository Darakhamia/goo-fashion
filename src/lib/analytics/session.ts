"use client";

// Session ID survives navigation within a tab. New tab = new session.
// Stored in sessionStorage so it resets on browser close.

const SESSION_KEY = "goo-analytics-session";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "s-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = uuid();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return uuid();
  }
}

export function parseUTM(search: string): {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
} {
  try {
    const p = new URLSearchParams(search);
    return {
      utmSource:   p.get("utm_source")   ?? undefined,
      utmMedium:   p.get("utm_medium")   ?? undefined,
      utmCampaign: p.get("utm_campaign") ?? undefined,
    };
  } catch {
    return {};
  }
}

export function detectDevice(ua: string): "mobile" | "tablet" | "desktop" {
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(s)) return "tablet";
  if (/mobi|iphone|ipod|android.+mobile|blackberry|windows phone/.test(s)) return "mobile";
  return "desktop";
}

export function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua))       return "Edge";
  if (/opr\//i.test(ua))       return "Opera";
  if (/chrome/i.test(ua))      return "Chrome";
  if (/safari/i.test(ua))      return "Safari";
  if (/firefox/i.test(ua))     return "Firefox";
  return "Other";
}

export function detectOS(ua: string): string {
  if (/windows/i.test(ua))     return "Windows";
  if (/mac os x|macintosh/i.test(ua)) return "macOS";
  if (/android/i.test(ua))     return "Android";
  if (/iphone|ipad|ipod/i.test(ua))  return "iOS";
  if (/linux/i.test(ua))       return "Linux";
  return "Other";
}

// Post a payload without blocking navigation.
// sendBeacon falls back to fetch(keepalive) for older browsers.
export function beacon(url: string, data: unknown): void {
  try {
    const body = JSON.stringify(data);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    /* swallow — analytics must never break the page */
  }
}
