/**
 * Outfit ideas by style — /outfits/streetwear, /outfits/minimal: the outfits
 * the stylists and the AI put together, grouped by the style they are filed
 * under (docs/SEO_PLAN.md, SEO-17). Outfits are what GOO has that a store
 * doesn't, and "streetwear outfit ideas" is a search people make.
 */
import { cache } from "react";
import { readAllOutfits } from "@/lib/data/db";
import { outfitStylePath } from "@/lib/landing-paths";
import { STYLE_KEYWORD_LIST, styleLabel } from "@/lib/style-keywords";
import { displayedPriceLabel } from "@/lib/seo";
import { LANDING_MIN_PRODUCTS, listPhrase, type LandingCopy, type LandingLink } from "@/lib/server/landing";
import type { Outfit, StyleKeyword } from "@/lib/types";

export interface OutfitLanding {
  style: StyleKeyword;
  /** "Streetwear". */
  label: string;
  path: string;
  /** Newest first. */
  outfits: Outfit[];
  indexable: boolean;
}

/** Every outfit, newest first — the same order on every render. */
const loadOutfits = cache(async (): Promise<Outfit[]> => {
  const { outfits, error } = await readAllOutfits();
  if (error) throw new Error(`Could not read the outfits: ${error}`);
  return [...outfits].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
});

/** Pure: the style pages a list of outfits makes, biggest first, each with at least one outfit. */
export function outfitLandingsFrom(outfits: Outfit[]): OutfitLanding[] {
  return STYLE_KEYWORD_LIST.map((style) => {
    const list = outfits.filter((o) => (o.styleKeywords ?? []).includes(style));
    return {
      style,
      label: styleLabel(style),
      path: outfitStylePath(style),
      outfits: list,
      indexable: list.length >= LANDING_MIN_PRODUCTS,
    };
  })
    .filter((l) => l.outfits.length > 0)
    .sort((a, b) => b.outfits.length - a.outfits.length);
}

export async function allOutfitLandings(): Promise<OutfitLanding[]> {
  return outfitLandingsFrom(await loadOutfits());
}

export async function outfitLanding(style: string): Promise<OutfitLanding | undefined> {
  return (await allOutfitLandings()).find((l) => l.style === style);
}

/** Title, heading and opening paragraph from the outfits themselves. */
export function outfitLandingCopy(page: OutfitLanding): LandingCopy {
  const n = page.outfits.length;
  const brandCounts = new Map<string, number>();
  for (const o of page.outfits) {
    for (const brand of new Set(o.items.map((i) => i.product?.brand).filter(Boolean) as string[])) {
      brandCounts.set(brand, (brandCounts.get(brand) ?? 0) + 1);
    }
  }
  const brands = [...brandCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([b]) => b);
  const top = brands.slice(0, 3);
  const priced = page.outfits.filter((o) => o.totalPriceMin > 0);
  const low = priced.length ? priced.reduce((a, b) => (a.totalPriceMin <= b.totalPriceMin ? a : b)) : undefined;
  const high = priced.length ? priced.reduce((a, b) => (a.totalPriceMin >= b.totalPriceMin ? a : b)) : undefined;
  const prices =
    low && high
      ? low === high
        ? `, a complete look for ${displayedPriceLabel(low.totalPriceMin, low.currency)}`
        : `, complete looks from ${displayedPriceLabel(low.totalPriceMin, low.currency)} to ${displayedPriceLabel(high.totalPriceMin, high.currency)}`
      : "";
  const what = page.label.toLowerCase();
  return {
    title: `${page.label} Outfit Ideas`,
    heading: `${page.label} outfits`,
    intro:
      `${n} ${what} ${n === 1 ? "outfit" : "outfits"} put together from pieces you can buy` +
      `${top.length ? ` — ${listPhrase(top, brands.length > top.length ? "more" : undefined)}` : ""}${prices}.` +
      ` Open one to see every piece and its price at each store, then shop the look or rebuild it in the outfit builder.`,
  };
}

/** The other styles, as links. */
export async function otherStyles(page: OutfitLanding): Promise<LandingLink[]> {
  return (await allOutfitLandings())
    .filter((l) => l.style !== page.style)
    .map((l) => ({ name: l.label, path: l.path, count: l.outfits.length }));
}
