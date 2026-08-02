"use client";

/**
 * The products and outfits this browser has opened, most recent first.
 *
 * Kept in localStorage rather than on the account: it is a browsing
 * convenience, it has to work signed out, and it should not follow someone
 * onto another device.
 */

export type ViewKind = "product" | "outfit";

/** Products keep the original key so existing histories survive. */
const KEYS: Record<ViewKind, string> = {
  product: "goo-recently-viewed",
  outfit: "goo-recently-viewed-outfits",
};

/** Enough for a couple of rows once the current item is filtered out. */
const LIMIT = 12;

function read(kind: ViewKind): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEYS[kind]);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    // Malformed JSON, or storage blocked in private mode — treat as empty
    // rather than taking the page down over a browsing nicety.
    return [];
  }
}

/** Ids in view order, most recent first. */
export function getRecentlyViewed(kind: ViewKind): string[] {
  return read(kind).slice(0, LIMIT);
}

/** Moves `id` to the front of its list, keeping it unique and capped. */
export function recordView(kind: ViewKind, id: string): void {
  if (typeof window === "undefined" || !id) return;
  const next = [id, ...read(kind).filter((existing) => existing !== id)].slice(0, LIMIT);
  try {
    window.localStorage.setItem(KEYS[kind], JSON.stringify(next));
  } catch {
    // Quota or private mode — the row just stays as it was.
  }
}
