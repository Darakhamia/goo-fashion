import type { Gender, Occasion, Product, StyleKeyword } from "@/lib/types";
import type { SortOption, View } from "./BrowseClient";

/*
 * Back to the catalogue where it was left (2026-10-24).
 *
 * Open a piece from /browse after "Show more" and a long scroll, press Back,
 * and the catalogue used to start over: page 1, twenty cards, the filters
 * picked on the page gone, the scroll clamped to the top. Now Back (the
 * browser's, the phone's swipe, the header's arrow) brings it back as it was:
 * the tab, search, filters, sort, page and "Show more" pages, the scroll, and
 * the same order of cards — "Featured" is reshuffled every minute, so a fresh
 * catalogue would put other pieces where these were.
 *
 * Each visit stamps its history entry (`history.state.gooBrowse`) and saves its
 * view under that stamp in sessionStorage when it is left. Back and Forward
 * return to a stamped entry, so the catalogue finds its view — also after the
 * piece's page was reloaded in between, and each of several catalogues in the
 * history finds its own. A link to /browse (the menu, a breadcrumb) makes a new
 * entry with no stamp: a new visit, from the top, as before. A reload is a new
 * visit too, though the browser keeps the stamp for it (`loadedByBackForward`).
 * Next keeps the stamp on Back and Forward; a router refresh wipes it, and the
 * catalogue stamps its entry again.
 *
 * The pieces themselves are kept in memory, so Back within the page shows the
 * cards at once instead of fetching them first.
 */

export type SavedView = {
  /** The catalogue's address: a view is restored only there. */
  url: string;
  view: View;
  search: string;
  sort: SortOption;
  brands: string[];
  subcategories: string[];
  occasions: Occasion[];
  gender: Gender | null;
  maxPrice: number | null;
  colorGroupIds: number[];
  aiOnly: boolean;
  styles: StyleKeyword[];
  likedOnly: boolean;
  page: number;
  extraPages: number;
  scrollY: number;
  /** The pieces' ids in the order the cards stood. */
  order: string[];
};

const KEY = "goo-browse-views";
/** Views kept: the latest visits in this tab, each ~150 KB of ids on a full catalogue. */
const KEEP = 3;

type Saved = Record<string, SavedView & { at: number }>;

const here = () => location.pathname + location.search;

function readAll(): Saved {
  try {
    return (JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Saved | null) ?? {};
  } catch {
    return {};
  }
}

/** The visit this history entry was stamped with, if any. */
export function entryVisit(): string | null {
  const stamp = (window.history.state as { gooBrowse?: unknown } | null)?.gooBrowse;
  return typeof stamp === "string" ? stamp : null;
}

/** The view saved for this history entry, when it is the catalogue at this address. */
export function entryView(): SavedView | null {
  const visit = entryVisit();
  const view = visit ? readAll()[visit] : undefined;
  return view && view.url === here() ? view : null;
}

/**
 * This page was loaded by Back or Forward. A reload, or the same address opened
 * again, keeps the entry and its stamp too, but is a new visit.
 */
export function loadedByBackForward(): boolean {
  const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === "back_forward";
}

export function newVisit(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Stamps the current history entry, keeping what Next keeps there. Only while
 * it is still the catalogue's address: the entry of the page that replaced it
 * is not the catalogue's.
 */
export function stampEntry(visit: string, url: string) {
  const state: unknown = window.history.state;
  // Next's own state not there yet: an entry stamped without it would make
  // Next reload the page on the way back to it.
  if (!state || typeof state !== "object" || here() !== url || entryVisit() === visit) return;
  window.history.replaceState({ ...state, gooBrowse: visit }, "");
}

export function saveView(visit: string, view: SavedView) {
  try {
    const all = readAll();
    all[visit] = { ...view, at: Date.now() };
    const latest = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, KEEP);
    sessionStorage.setItem(KEY, JSON.stringify(Object.fromEntries(latest)));
  } catch {
    // Storage full or blocked: Back starts over, as it did before.
  }
}

/** The pieces the catalogue last had, in their order: shown at once on the way back. */
let kept: Product[] | null = null;

export const keptCatalogue = () => kept;

export function keepCatalogue(products: Product[]) {
  kept = products;
}

/**
 * `products` in the saved order: the pieces it names first, as they stood, and
 * any new ones after them. A piece gone since is simply not there.
 */
export function inOrder(products: Product[], order: string[]): Product[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  const at = (p: Product) => rank.get(p.id) ?? order.length;
  return [...products].sort((a, b) => at(a) - at(b));
}
