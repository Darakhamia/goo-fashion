"use client";

/**
 * The product ids this browser has opened, most recent first.
 *
 * Kept in localStorage rather than on the account: it is a browsing
 * convenience, it has to work signed out, and it should not follow someone
 * onto another device.
 */

const KEY = "goo-recently-viewed";

/** Enough for a couple of rows once the current product is filtered out. */
const LIMIT = 12;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
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
export function getRecentlyViewed(): string[] {
  return read().slice(0, LIMIT);
}

/** Moves `id` to the front, keeping the list unique and capped. */
export function recordProductView(id: string): void {
  if (typeof window === "undefined" || !id) return;
  const next = [id, ...read().filter((existing) => existing !== id)].slice(0, LIMIT);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Quota or private mode — the row just stays as it was.
  }
}
