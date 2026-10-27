/**
 * What a piece is to an outfit: the part of the body it dresses, the colours
 * it brings and who it is cut for. The generator (lib/server/ai-outfits) reads
 * pieces through these, and so does the check that every outfit the model
 * proposes has to pass — the model chooses, these rules decide what counts.
 */
import type { Category, ColorGroup, Gender, Product } from "@/lib/types";
import { canonicalColor, colorWordsIn, type BaseColor } from "@/lib/server/product-fields";

/** The part of an outfit a piece fills. A one-piece (dress, jumpsuit) is the top and the bottom at once. */
export type OutfitSlot = "outerwear" | "top" | "bottom" | "one_piece" | "shoes" | "accessory";

export const OUTFIT_SLOTS: readonly OutfitSlot[] = ["outerwear", "top", "bottom", "one_piece", "shoes", "accessory"];

const SLOT_OF: Partial<Record<Category, OutfitSlot>> = {
  outerwear: "outerwear",
  blazers: "outerwear",
  tops: "top",
  shirts: "top",
  knitwear: "top",
  bottoms: "bottom",
  jeans: "bottom",
  shorts: "bottom",
  skirts: "bottom",
  dresses: "one_piece",
  jumpsuits: "one_piece",
  footwear: "shoes",
  accessories: "accessory",
  bags: "accessory",
  // swimwear: not part of a dressed outfit
};

/** The slot a category fills, or undefined for one an outfit does not use (swimwear). */
export function outfitSlot(category: string): OutfitSlot | undefined {
  return SLOT_OF[category as Category];
}

/** Most pieces of each slot one outfit takes. */
export const SLOT_LIMIT: Record<OutfitSlot, number> = {
  outerwear: 1,
  top: 1,
  bottom: 1,
  one_piece: 1,
  shoes: 1,
  accessory: 2,
};

/**
 * The builder's slots, which a look's pieces are stored under — a generated
 * look opens in the builder like any other. A dress sits in "bottom" there.
 */
export function builderSlots(slots: OutfitSlot[]): string[] {
  let accessories = 0;
  return slots.map((s) => {
    if (s === "one_piece") return "bottom";
    if (s === "accessory") return accessories++ === 0 ? "accessories" : "accessories2";
    return s;
  });
}

// ── Colour ───────────────────────────────────────────────────────────────────

/** A colour family a piece belongs to: the twelve base colours, and several at once. */
export type ColourFamily = BaseColor | "multicolor";

/**
 * Colours that go with anything. An outfit may hold any number of them beside
 * its one or two real colours.
 */
export const NEUTRALS: ReadonlySet<ColourFamily> = new Set<ColourFamily>(["black", "white", "grey", "beige", "brown"]);

const GROUP_FAMILY: Record<string, ColourFamily> = {
  black: "black", white: "white", grey: "grey", gray: "grey", beige: "beige", brown: "brown",
  blue: "blue", green: "green", red: "red", pink: "pink", yellow: "yellow", orange: "orange",
  violet: "violet", purple: "violet", multicolor: "multicolor", multicolour: "multicolor",
};

/** The family a colour group (the Browse colour filter) stands for. */
export function familyOfGroup(group: Pick<ColorGroup, "name">): ColourFamily | undefined {
  return GROUP_FAMILY[group.name.trim().toLowerCase()];
}

/**
 * The colour families of a piece: its colour filter groups when it has them,
 * else its colour names, else colour words in its name. Empty when nothing
 * says — such a piece is treated as going with anything.
 */
export function pieceFamilies(product: Product, groupsById: Map<number, ColorGroup>): ColourFamily[] {
  const out = new Set<ColourFamily>();
  for (const id of product.colorGroupIds ?? []) {
    const group = groupsById.get(id);
    const family = group && familyOfGroup(group);
    if (family) out.add(family);
  }
  if (!out.size) {
    for (const label of product.colors ?? []) {
      const base = canonicalColor(label, "field");
      if (base) out.add(base);
    }
  }
  if (!out.size) {
    const named = colorWordsIn(product.name ?? "");
    if (named.length) out.add(named[named.length - 1]);
  }
  return [...out];
}

/**
 * Blue denim is worn like a neutral: jeans go with every colour a shirt can be.
 * Only for the denim itself — a blue coat is a colour.
 */
export function isDenim(product: Product): boolean {
  return product.category === "jeans" || /\b(denim|jeans?)\b/i.test(`${product.subcategory ?? ""} ${product.name ?? ""}`);
}

/** The families a piece adds to an outfit's palette, neutrals and denim left out. */
export function accentFamilies(product: Product, families: ColourFamily[]): ColourFamily[] {
  return families.filter((f) => !NEUTRALS.has(f) && !(f === "blue" && isDenim(product)));
}

// ── Gender ───────────────────────────────────────────────────────────────────

/** Can this piece be worn in an outfit for `gender`? Unmarked and unisex pieces fit both. */
export function fitsGender(piece: Pick<Product, "gender">, gender: Gender | null): boolean {
  if (!gender || gender === "unisex") return true;
  return !piece.gender || piece.gender === "unisex" || piece.gender === gender;
}

/** The gender an outfit is cut for: men's or women's when any piece says so, else null. */
export function outfitGender(pieces: Pick<Product, "gender">[]): Gender | null | "mixed" {
  const marked = new Set(pieces.map((p) => p.gender).filter((g): g is "men" | "women" => g === "men" || g === "women"));
  if (marked.size > 1) return "mixed";
  return marked.size ? [...marked][0] : null;
}
