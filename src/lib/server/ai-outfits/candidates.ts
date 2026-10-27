/**
 * The pieces the model may build outfits from.
 *
 * The catalogue runs to thousands of pieces; the model gets a short list per
 * slot, drawn at random so two runs do not hand it the same shirts, and
 * filtered by what the brief asks for. What is filtered and what is only
 * preferred follows the CEO's decision of 2026-10-27:
 *
 *   gender  filtered — a men's run sees no women's pieces;
 *   styles  filtered — pieces of another style are left out; untagged basics
 *           stay, a plain white tee belongs to every style;
 *   colours a preference — pieces in the chosen colours and neutrals stay,
 *           other colours go; the chosen ones come first in the list;
 *   brands  a preference — every brand stays, the chosen ones fill most of
 *           each slot's list, so each outfit can feature one of them.
 */
import type { ColorGroup, Gender, Product, StyleKeyword } from "@/lib/types";
import { isProductAvailable } from "@/lib/availability";
import {
  accentFamilies,
  fitsGender,
  NEUTRALS,
  outfitSlot,
  pieceFamilies,
  type ColourFamily,
  type OutfitSlot,
} from "./pieces";

export interface GenerationBrief {
  /** Outfits wanted. */
  count: number;
  /** Styles to build in; none = the model chooses. */
  styles: StyleKeyword[];
  /** Colour families to build around; none = the model chooses. */
  colours: ColourFamily[];
  /** Brands to feature; none = any. */
  brands: string[];
  /** Who the outfits are for; null = the model chooses per outfit. */
  gender: Exclude<Gender, "unisex"> | null;
}

export interface Candidate {
  /** What the model calls it: "c12". Short, so it costs few tokens and is hard to misspell. */
  key: string;
  product: Product;
  slot: OutfitSlot;
  families: ColourFamily[];
  /** Families that count against the palette: neither neutral nor denim. */
  accents: ColourFamily[];
  /** By one of the brief's brands. */
  preferredBrand: boolean;
  /** In one of the brief's colours. */
  onPalette: boolean;
}

/** Pieces of each slot the model is shown. Enough to choose from, few enough to read closely. */
export const SLOT_SHOWN: Record<OutfitSlot, number> = {
  top: 28,
  bottom: 22,
  one_piece: 12,
  shoes: 22,
  outerwear: 18,
  accessory: 16,
};

/** Share of a slot's list given to the brief's brands, and to its colours, when it names any. */
const PREFERRED_SHARE = 0.6;
/** Pieces of one brand in a slot's list, so one big store does not fill it. */
const PER_BRAND = 4;
/** Colourways of one model in a slot's list. */
const PER_MODEL = 2;

/** A seeded random source, so a run can be repeated exactly in a test. */
export function randomSource(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(list: T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const brandKey = (brand: string) => brand.trim().toLowerCase();

/** A piece the generator can use at all: it fills a slot, can be bought, and has a photo and a price. */
function usable(p: Product): boolean {
  return Boolean(outfitSlot(p.category) && p.imageUrl && p.name && p.priceMin > 0 && isProductAvailable(p));
}

export interface CandidatePool {
  candidates: Candidate[];
  byKey: Map<string, Candidate>;
  /** Pieces per slot that passed the brief, before the list was cut to size. */
  matching: Record<OutfitSlot, number>;
}

/**
 * The model's list. `products` are catalogue rows with every colourway its own
 * row (the admin read), so a colourway is chosen for its own colour and photo.
 */
export function buildCandidates(
  products: Product[],
  colorGroups: ColorGroup[],
  brief: GenerationBrief,
  random: () => number,
): CandidatePool {
  const groupsById = new Map(colorGroups.map((g) => [g.id, g]));
  const brands = new Set(brief.brands.map(brandKey));
  const colours = new Set(brief.colours);

  const bySlot = new Map<OutfitSlot, Omit<Candidate, "key">[]>();
  for (const product of products) {
    if (!usable(product)) continue;
    if (!fitsGender(product, brief.gender)) continue;
    if (brief.styles.length && product.styleKeywords?.length && !product.styleKeywords.some((s) => brief.styles.includes(s))) {
      continue;
    }
    const families = pieceFamilies(product, groupsById);
    const accents = accentFamilies(product, families);
    const onPalette = families.some((f) => colours.has(f));
    // A piece in another colour than the brief's is left out; neutrals and
    // pieces that name no colour stay.
    if (colours.size && accents.length && !accents.some((f) => colours.has(f))) continue;

    const slot = outfitSlot(product.category)!;
    const list = bySlot.get(slot) ?? [];
    list.push({ product, slot, families, accents, preferredBrand: brands.has(brandKey(product.brand)), onPalette });
    bySlot.set(slot, list);
  }

  const matching = Object.fromEntries(
    Object.keys(SLOT_SHOWN).map((s) => [s, bySlot.get(s as OutfitSlot)?.length ?? 0]),
  ) as Record<OutfitSlot, number>;

  const picked: Omit<Candidate, "key">[] = [];
  for (const slot of Object.keys(SLOT_SHOWN) as OutfitSlot[]) {
    const shown = SLOT_SHOWN[slot];
    const pool = shuffled(bySlot.get(slot) ?? [], random);
    const preferredCap = Math.ceil(shown * PREFERRED_SHARE);
    const perBrand = new Map<string, number>();
    const perModel = new Map<string, number>();
    const chosen: Omit<Candidate, "key">[] = [];
    let brandTaken = 0;
    let paletteTaken = 0;

    const take = (c: Omit<Candidate, "key">): boolean => {
      if (chosen.length >= shown || chosen.includes(c)) return false;
      const b = brandKey(c.product.brand);
      if (!c.preferredBrand && (perBrand.get(b) ?? 0) >= PER_BRAND) return false;
      const model = c.product.variantGroupId ?? c.product.id;
      if ((perModel.get(model) ?? 0) >= PER_MODEL) return false;
      perBrand.set(b, (perBrand.get(b) ?? 0) + 1);
      perModel.set(model, (perModel.get(model) ?? 0) + 1);
      chosen.push(c);
      return true;
    };

    // The brief's brands first, then its colours, each up to its share; then
    // the rest of the slot in random order.
    if (brands.size) {
      for (const c of pool) if (brandTaken < preferredCap && c.preferredBrand && take(c)) brandTaken++;
    }
    if (colours.size) {
      for (const c of pool) if (paletteTaken < preferredCap && c.onPalette && take(c)) paletteTaken++;
    }
    for (const c of pool) take(c);
    picked.push(...chosen);
  }

  const candidates = picked.map((c, i) => ({ ...c, key: `c${i + 1}` }));
  return { candidates, byKey: new Map(candidates.map((c) => [c.key, c])), matching };
}

/**
 * Why no outfit can be built from this pool, or null when one can: every
 * outfit needs shoes and either a top with a bottom or a one-piece, and the
 * brief's brands and colours have to be in the list to be featured.
 */
export function poolProblem(pool: CandidatePool, brief: GenerationBrief): string | null {
  const has = (slot: OutfitSlot) => pool.candidates.some((c) => c.slot === slot);
  const missing: string[] = [];
  if (!has("shoes")) missing.push("shoes");
  if (!has("one_piece") && !(has("top") && has("bottom"))) {
    if (!has("top")) missing.push("tops");
    if (!has("bottom")) missing.push("bottoms");
  }
  if (missing.length) {
    return `The catalogue has no ${missing.join(" or ")} that fit this brief (gender, styles, colours) — loosen it and try again.`;
  }
  if (brief.brands.length && !pool.candidates.some((c) => c.preferredBrand)) {
    return `None of ${brief.brands.join(", ")} has pieces that fit this brief — choose other brands or loosen the brief.`;
  }
  if (brief.colours.length && !pool.candidates.some((c) => c.onPalette)) {
    return "No piece in the chosen colours fits this brief — choose other colours or loosen the brief.";
  }
  return null;
}

/** Neutral families named in a list, for the prompt's palette rule. */
export const NEUTRAL_NAMES = [...NEUTRALS].join(", ");
