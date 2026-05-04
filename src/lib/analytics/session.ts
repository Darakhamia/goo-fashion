"use client";

// Session ID persists across navigations on the same device.
// A new session is created only after 30 minutes of inactivity.
// Stored in localStorage so it survives browser close/reopen within the window.

const SESSION_KEY = "goo_sid";
const SESSION_TS_KEY = "goo_sid_ts";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "s-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    const lastTs = Number(localStorage.getItem(SESSION_TS_KEY) ?? "0");
    const now = Date.now();

    if (existing && now - lastTs < SESSION_TIMEOUT_MS) {
      localStorage.setItem(SESSION_TS_KEY, String(now));
      return existing;
    }

    const id = uuid();
    localStorage.setItem(SESSION_KEY, id);
    localStorage.setItem(SESSION_TS_KEY, String(now));
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
