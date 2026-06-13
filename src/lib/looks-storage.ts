"use client";

// ── Saved builder look ────────────────────────────────────────────────────────
export interface SavedLook {
  id: string;
  savedAt: string;
  name?: string;
  description?: string;
  pieces: { slot: string; productId: string; variantId?: string | null; imageUrl?: string; name?: string }[];
  totalPrice: number;
  styleKeywords: string[];
  generatedImage?: string | null;
  generatedStyle?: "mannequin" | "flatlay" | "tryon";
}

const STORAGE_KEY = "goo-saved-outfits";
// Ids confirmed to exist on the account. Used to tell a look that was *deleted
// on another device* apart from one that simply *never synced* from this device.
const SYNCED_KEY = "goo-synced-looks";
// Must match the limit used by GET /api/user/looks. A response shorter than this
// is the user's complete list, which lets us safely detect remote deletions.
const SERVER_LIMIT = 200;

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadLocalLooks(): SavedLook[] {
  if (!isBrowser()) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalLooks(looks: SavedLook[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(looks));
  } catch {}
}

function getSyncedIds(): Set<string> {
  if (!isBrowser()) return new Set();
  try {
    const parsed = JSON.parse(localStorage.getItem(SYNCED_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch {
    return new Set();
  }
}

function setSyncedIds(ids: Set<string>): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(SYNCED_KEY, JSON.stringify([...ids]));
  } catch {}
}

function markSynced(id: string): void {
  const ids = getSyncedIds();
  if (!ids.has(id)) {
    ids.add(id);
    setSyncedIds(ids);
  }
}

function sortBySavedAt(looks: SavedLook[]): SavedLook[] {
  return [...looks].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
  );
}

/**
 * Persist a single look to the account.
 *
 * Uses `keepalive` so the request survives client-side navigation and the app
 * being backgrounded — the main reason looks created on mobile never reached
 * the server. Retries transient/network failures. Marks the look as
 * server-synced on success so future syncs can reason about remote deletions.
 */
export async function pushLook(look: SavedLook): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("/api/user/looks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(look),
        keepalive: true,
      });
      if (res.ok) {
        markSynced(look.id);
        return true;
      }
      // Client errors (other than rate limiting) won't succeed on retry.
      if (res.status < 500 && res.status !== 429) return false;
    } catch {
      // network error — fall through to retry
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  return false;
}

/** Remove a look from the account and from the local synced bookkeeping. */
export async function deleteLookFromServer(id: string): Promise<void> {
  const ids = getSyncedIds();
  if (ids.delete(id)) setSyncedIds(ids);
  try {
    await fetch(`/api/user/looks?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      keepalive: true,
    });
  } catch {}
}

/**
 * Reconcile this device with the account so every device shows the same looks:
 *  - looks created on this device that never reached the server are pushed up;
 *  - looks deleted on another device are dropped locally;
 *  - the account is the source of truth for everything else.
 *
 * The merged result is cached to localStorage (so edits and offline viewing
 * keep working) and returned for display. Falls back to local-only data when
 * the user is signed out or the server is unreachable, so nothing is ever lost.
 */
export async function syncLooks(isLoggedIn: boolean): Promise<SavedLook[]> {
  const local = loadLocalLooks();
  if (!isLoggedIn) return sortBySavedAt(local);

  let server: SavedLook[];
  try {
    const res = await fetch("/api/user/looks", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || !Array.isArray(json)) return sortBySavedAt(local);
    server = json as SavedLook[];
  } catch {
    return sortBySavedAt(local);
  }

  const serverIds = new Set(server.map((l) => l.id));
  const listComplete = server.length < SERVER_LIMIT;
  const synced = getSyncedIds();

  const localOnly: SavedLook[] = [];
  for (const look of local) {
    if (serverIds.has(look.id)) continue; // account has the authoritative copy
    if (synced.has(look.id) && listComplete) {
      // Was on the account before and is now gone from a complete list ⇒ it was
      // deleted on another device. Drop it here too.
      synced.delete(look.id);
      continue;
    }
    localOnly.push(look); // never synced (or list truncated) — keep and push up
  }

  // Push the stranded local looks to the account (idempotent upsert).
  await Promise.allSettled(localOnly.map((l) => pushLook(l)));

  const localById = new Map(local.map((l) => [l.id, l]));
  const merged = sortBySavedAt([
    ...server.map((s) => ({
      ...s,
      name: s.name ?? localById.get(s.id)?.name,
      description: s.description ?? localById.get(s.id)?.description,
    })),
    ...localOnly,
  ]);

  // Cache the union and record every id we now know lives on the account.
  saveLocalLooks(merged);
  const nextSynced = getSyncedIds();
  serverIds.forEach((id) => nextSynced.add(id));
  setSyncedIds(nextSynced);

  return merged;
}
