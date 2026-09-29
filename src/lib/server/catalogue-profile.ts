/**
 * What the editor's own labelling says about a brand and a store — the part of
 * a product's style and gender that its page does not say.
 *
 * Style, in the order the CEO set on 2026-09-29: the description decides, the
 * brand fills in.
 *
 *   words     what the style dictionary reads in the piece's own name and
 *             description — which manner it names and what it is *for*
 *             (`taxonomy/styles`). Always used, and never outvoted;
 *   brand     the one style the brand stands for: the built-in list first
 *             (Adidas sporty, Gucci classic — `taxonomy/brand-styles`), then,
 *             for a brand not on it, the style the editor gave most of its
 *             pieces;
 *   store     for a brand with neither — a new one — the style the editor gave
 *             most pieces bought from the same store.
 *
 * Mixed so the brand never outweighs the page: words naming two styles or
 * more are the answer; words naming one get the brand's style beside it; no
 * words, and the brand's style stands alone.
 *
 * (Until 2026-09-29 the words counted only per style where the catalogue had
 * shown them to agree with the editor, the brand's habit could outrank them,
 * and a dark-toned piece was filed "dark". The vocabulary was cut to five
 * styles that day and the order above replaced the calibration.)
 *
 * Gender. A store's site says "Men" and "Women", or "All" and "Women", and what
 * "All" means is the brand's convention: men's at one, unisex at the next. The
 * convention is learned from what the editor chose for the pieces whose page
 * said nothing — per brand, then per store — after the admin's explicit store
 * setting (`retailer_domains.default_gender`), which beats both.
 *
 * Everything here is built from the catalogue as a pure function, so the mining
 * report can build it from one part of the catalogue and score it on another.
 */
import type { Gender, StyleKeyword } from "@/lib/types";
import { STYLE_KEYWORD_LIST, isStyleKeyword, normalizeStyleKeywords } from "@/lib/style-keywords";
import { brandStyle } from "@/lib/taxonomy/brand-styles";
import { genderFromPage } from "@/lib/taxonomy/gender";
import { domainCandidates, domainFromUrl } from "@/lib/server/retailer-domains";
import { loadLabelledProducts, type LabelledProduct } from "@/lib/server/catalogue-labels";

// ── Thresholds ───────────────────────────────────────────────────────────────

/** A brand needs this many style-tagged pieces before its habits count. */
export const BRAND_MIN_PIECES = 3;
/** A store's habits count, for a brand with none, from this many style-tagged pieces. */
export const STORE_STYLE_MIN = 5;
/** A style is the brand's when at least this share of its pieces carry it. */
export const BRAND_STYLE_SHARE = 0.6;
/** A gender is a brand's or store's convention at this share of its silent pieces. */
export const GENDER_SHARE = 0.8;
export const BRAND_GENDER_MIN = 3;
export const STORE_GENDER_MIN = 5;
/** At most this many styles per piece; the editor averages about two. */
export const MAX_STYLES = 3;

// ── Shapes ───────────────────────────────────────────────────────────────────

export interface Tally {
  n: number;
  counts: Record<string, number>;
}

export interface CatalogueProfile {
  /** Products carrying at least one style tag. */
  styled: number;
  brandStyles: Map<string, Tally>;
  /** The styles the editor gave pieces bought from each store, keyed as `storeKey`. */
  storeStyles: Map<string, Tally>;
  /** Gender the editor chose for pieces whose page stated none. */
  brandGender: Map<string, Tally>;
  storeGender: Map<string, Tally>;
}

export interface ProfileInput {
  brand: string;
  name: string;
  description: string;
  sourceUrl: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Brands compared by their letters: "Gallery Dept." and "gallery dept" are one brand. */
export function brandKey(brand: string): string {
  return (brand ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

const add = (map: Map<string, Tally>, key: string, value: string) => {
  if (!key) return;
  const t = map.get(key) ?? { n: 0, counts: {} };
  t.n++;
  t.counts[value] = (t.counts[value] ?? 0) + 1;
  map.set(key, t);
};

/** The value holding at least `min` of a tally, if any does. */
function dominant(t: Tally | undefined, minShare: number, minN: number): { value: string; share: number } | undefined {
  if (!t || t.n < minN) return undefined;
  let best: { value: string; share: number } | undefined;
  for (const [value, count] of Object.entries(t.counts)) {
    const s = count / t.n;
    if (s >= minShare && (!best || s > best.share)) best = { value, share: s };
  }
  return best;
}

/** Where the piece was bought, as the store settings key it. */
export function storeKey(sourceUrl: string | null | undefined): string {
  return sourceUrl ? domainFromUrl(sourceUrl) : "";
}

/** Did the page itself say who the piece is for? */
function pageStatesGender(p: ProfileInput): boolean {
  return !!genderFromPage({ name: p.name, url: p.sourceUrl ?? undefined, description: p.description });
}

// ── Building ─────────────────────────────────────────────────────────────────

export function buildCatalogueProfile(rows: LabelledProduct[]): CatalogueProfile {
  const brandStyles = new Map<string, Tally>();
  const storeStyles = new Map<string, Tally>();
  const brandGender = new Map<string, Tally>();
  const storeGender = new Map<string, Tally>();
  let styled = 0;

  for (const r of rows) {
    const styles = r.styleKeywords.filter(isStyleKeyword);
    const brand = brandKey(r.brand);
    if (styles.length) {
      styled++;
      // A brand's piece counts once towards its total and once per style it carries.
      const t = brandStyles.get(brand) ?? { n: 0, counts: {} };
      t.n++;
      for (const s of styles) t.counts[s] = (t.counts[s] ?? 0) + 1;
      if (brand) brandStyles.set(brand, t);

      const store = storeKey(r.sourceUrl);
      if (store) {
        const st = storeStyles.get(store) ?? { n: 0, counts: {} };
        st.n++;
        for (const s of styles) st.counts[s] = (st.counts[s] ?? 0) + 1;
        storeStyles.set(store, st);
      }
    }

    if (r.gender && !pageStatesGender(r)) {
      add(brandGender, brand, r.gender);
      add(storeGender, storeKey(r.sourceUrl), r.gender);
    }
  }

  return { styled, brandStyles, storeStyles, brandGender, storeGender };
}

// ── Proposing ────────────────────────────────────────────────────────────────

export interface StyleProposal {
  styles: StyleKeyword[];
  /** One line per style kept, saying what argued for it. */
  reasons: string[];
  /** When nothing was proposed: what each signal lacked, so the admin sees why. */
  missing?: string;
}

/** The one style a tally leans to: the largest share, if it reaches `BRAND_STYLE_SHARE`. */
function leaning(t: Tally | undefined, minN: number): { style: StyleKeyword; share: number } | undefined {
  const top = dominant(t, BRAND_STYLE_SHARE, minN);
  return top && isStyleKeyword(top.value) ? { style: top.value, share: top.share } : undefined;
}

/**
 * The styles to file a piece under: the description's, then the brand's (see
 * the header for the order and how they mix).
 *
 * `keywordStyles` are what the style dictionary read off the page — its name,
 * description, material and the label it was filed under.
 */
export function proposeStyles(
  piece: {
    brand: string;
    keywordStyles: StyleKeyword[];
    /** The page's address: the store whose habits speak for a brand with none. */
    sourceUrl?: string | null;
  },
  profile: CatalogueProfile,
): StyleProposal {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const words = normalizeStyleKeywords(piece.keywordStyles).slice(0, MAX_STYLES);

  // The brand's style: the list, then the editor's habit for this brand, then
  // — for a brand with neither — the store's.
  let brand: { style: StyleKeyword; reason: string } | undefined;
  const listed = brandStyle(piece.brand);
  const brandTally = profile.brandStyles.get(brandKey(piece.brand));
  let storeTally: Tally | undefined;
  let storeName = storeKey(piece.sourceUrl);
  if (listed) {
    brand = { style: listed.style, reason: `${listed.style}: ${listed.entry} is a ${listed.style} brand` };
  } else {
    const habit = leaning(brandTally, BRAND_MIN_PIECES);
    if (habit) {
      brand = { style: habit.style, reason: `${habit.style}: ${pct(habit.share)} of ${piece.brand}'s ${brandTally!.n} pieces` };
    } else if (!brandTally || brandTally.n < BRAND_MIN_PIECES) {
      // A brand the editor has not styled yet is read through the store it
      // came from: a boutique carries brands in one manner, as a brand makes
      // pieces in one.
      for (const candidate of domainCandidates(storeKey(piece.sourceUrl))) {
        const tally = profile.storeStyles.get(candidate);
        if (!tally) continue;
        storeTally = tally;
        storeName = candidate;
        break;
      }
      const store = leaning(storeTally, STORE_STYLE_MIN);
      if (store) {
        brand = { style: store.style, reason: `${store.style}: ${pct(store.share)} of ${storeTally!.n} styled pieces from ${storeName}` };
      }
    }
  }

  const reasons = words.map((s) => `${s}: from the description`);
  const kept = new Set<StyleKeyword>(words);
  // Two styles or more from the words are the answer; one gets the brand's
  // beside it; none leaves the brand's alone.
  if (brand && words.length < 2 && !kept.has(brand.style)) {
    kept.add(brand.style);
    reasons.push(brand.reason);
  }

  if (!kept.size) {
    // Said on the run's row, because "no style" otherwise reads as a fault.
    const brandSays = brandTally && brandTally.n >= BRAND_MIN_PIECES
      ? `${piece.brand}'s ${brandTally.n} styled pieces share no style`
      : `${piece.brand || "the brand"} is not in the brand list and has ${brandTally?.n ?? 0} styled pieces (${BRAND_MIN_PIECES} needed)`;
    const storeSays = brandTally && brandTally.n >= BRAND_MIN_PIECES
      ? ""
      : storeTally && storeTally.n >= STORE_STYLE_MIN
        ? `, ${storeName}'s pieces share no style`
        : `, ${storeName || "the store"} has ${storeTally?.n ?? 0} (${STORE_STYLE_MIN} needed)`;
    return {
      styles: [],
      reasons: [],
      missing: `no style: the description names none, ${brandSays}${storeSays}`,
    };
  }
  return { styles: STYLE_KEYWORD_LIST.filter((s) => kept.has(s)), reasons };
}

export interface GenderProposal {
  gender: Gender;
  /** Which of the three decided it. */
  source: "store-setting" | "brand" | "store";
  reason: string;
}

const GENDERS: readonly string[] = ["women", "men", "unisex"];

/**
 * Who a piece is for when its page does not say: the admin's setting for the
 * store, then the brand's habit, then the store's habit. Undefined when none of
 * them is settled enough to trust — an empty gender is honest, a guessed one
 * files the piece where shoppers of the other gender never see it.
 */
export function proposeGender(
  piece: { brand: string; sourceUrl: string | null; storeDefault?: Gender },
  profile: CatalogueProfile,
): GenderProposal | undefined {
  if (piece.storeDefault) return { gender: piece.storeDefault, source: "store-setting", reason: "the store's setting" };

  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const brand = dominant(profile.brandGender.get(brandKey(piece.brand)), GENDER_SHARE, BRAND_GENDER_MIN);
  if (brand && GENDERS.includes(brand.value)) {
    const n = profile.brandGender.get(brandKey(piece.brand))!.n;
    return { gender: brand.value as Gender, source: "brand", reason: `${pct(brand.share)} of ${piece.brand}'s ${n} unmarked pieces` };
  }

  for (const candidate of domainCandidates(storeKey(piece.sourceUrl))) {
    const tally = profile.storeGender.get(candidate);
    const store = dominant(tally, GENDER_SHARE, STORE_GENDER_MIN);
    if (store && GENDERS.includes(store.value)) {
      return { gender: store.value as Gender, source: "store", reason: `${pct(store.share)} of ${candidate}'s ${tally!.n} unmarked pieces` };
    }
  }
  return undefined;
}

// ── Loading ──────────────────────────────────────────────────────────────────

/**
 * Reused for ten minutes. A crawl imports hundreds of pages in a row and must
 * not re-read the catalogue for each; the editor's tagging changes slowly, and
 * a profile ten minutes old is as good as a fresh one.
 */
const CACHE_TTL_MS = 10 * 60_000;
let cache: { profile: CatalogueProfile; at: number } | null = null;

const EMPTY: CatalogueProfile = buildCatalogueProfile([]);

/** The live catalogue's profile. Never throws: a catalogue it cannot read is an empty one. */
export async function loadCatalogueProfile(): Promise<CatalogueProfile> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.profile;
  try {
    const rows = await loadLabelledProducts(false);
    const profile = "error" in rows ? EMPTY : buildCatalogueProfile(rows);
    cache = { profile, at: Date.now() };
    return profile;
  } catch {
    return EMPTY;
  }
}
