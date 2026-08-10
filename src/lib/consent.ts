export type CookieConsent = "accepted" | "declined";

const STORAGE_KEY = "goo-cookie-consent";
const EVENT_NAME = "goo:cookie-consent";

export function getStoredConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

export function setStoredConsent(value: CookieConsent) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // storage unavailable (private mode) — the choice lives for this page only
  }
  window.dispatchEvent(new CustomEvent<CookieConsent>(EVENT_NAME, { detail: value }));
}

export function onConsentChange(handler: (value: CookieConsent) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<CookieConsent>).detail);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
