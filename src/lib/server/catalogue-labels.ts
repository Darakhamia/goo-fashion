/**
 * Loads the catalogue's hand-filled labelling, and decides what counts as a
 * meaningful word in it.
 *
 * Shared by the mining report and the label audit so the two cannot drift:
 * an audit that tokenised differently from the report that justified it would
 * flag products the report never scored.
 */
import { supabase } from "@/lib/supabase";
import { tokenize } from "@/lib/server/mining";

const PAGE = 1000;

export interface LabelledProduct {
  id: string;
  name: string;
  description: string;
  brand: string;
  gender: string | null;
  category: string;
  subcategory: string | null;
  colors: string[];
  colorGroups: string[];
  styleKeywords: string[];
  embedding: number[] | null;
}

/** A vector column comes back from PostgREST as "[0.1,0.2,…]". */
function parseEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw !== "string" || !raw.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function words(text: string): string[] {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Brand words, so a brand that sells one kind of thing cannot mine into a rule. */
export function brandTokens(brand: string): Set<string> {
  return new Set(words(brand));
}

/** Size vocabulary — "Size: L" is in half the names and means nothing here. */
const SIZE_NOISE = new Set([
  "size", "sizes", "xxs", "xs", "sm", "md", "lg", "xl", "xxl", "xxxl",
  "eu", "uk", "us", "cm", "mm", "one", "onesize", "fit", "regular", "oversized",
]);

/** Words that name a gender: excluded from garment mining, central to its own. */
const GENDER_NOISE = new Set([
  "women", "womens", "woman", "female", "ladies", "girl", "girls",
  "men", "mens", "man", "male", "boy", "boys", "unisex",
  "женск", "мужск",
]);

/**
 * Colour vocabulary, taken from the catalogue rather than a fixed list.
 *
 * An early run mined "cloud white → footwear" and "core black → footwear":
 * real colourways of one brand's line, useless on anyone else's products. The
 * words to exclude are exactly the ones the catalogue already uses as colour
 * names, so it can say them itself.
 */
export function colourNoise(rows: LabelledProduct[]): Set<string> {
  const noise = new Set<string>();
  for (const row of rows) {
    for (const colour of row.colors) for (const w of words(colour)) noise.add(w);
    for (const group of row.colorGroups) for (const w of words(group)) noise.add(w);
  }
  return noise;
}

/**
 * The token builders both callers use.
 *
 * Garment keys come from the NAME only: a description is marketing copy that
 * name-drops other garments ("wears well with jeans"), which reads to a token
 * counter as evidence for the wrong bucket. They also drop the brand's own
 * words, colour vocabulary, sizing boilerplate and gender words — none of
 * which says what a thing IS.
 */
export function makeKeyBuilders(rows: LabelledProduct[]) {
  const colours = colourNoise(rows);
  const garmentNoise = (r: LabelledProduct) =>
    new Set([...brandTokens(r.brand), ...colours, ...SIZE_NOISE, ...GENDER_NOISE]);
  const genderNoise = (r: LabelledProduct) =>
    new Set([...brandTokens(r.brand), ...colours, ...SIZE_NOISE]);

  return {
    /** Name tokens, for category and subcategory. */
    garmentKeys: (r: LabelledProduct) => tokenize(r.name, garmentNoise(r)),
    /** Name and description, for style keywords. */
    proseKeys: (r: LabelledProduct) => tokenize(`${r.name} ${r.description}`, garmentNoise(r)),
    /** Keeps the gender words, which turned out to be the whole signal. */
    genderKeys: (r: LabelledProduct) => tokenize(`${r.name} ${r.description}`, genderNoise(r)),
  };
}

export async function loadLabelledProducts(
  withEmbedding = false,
): Promise<LabelledProduct[] | { error: string }> {
  const groups = await supabase!.from("color_groups").select("id, name");
  const groupName = new Map<number, string>();
  for (const g of (groups.data ?? []) as { id: number; name: string }[]) {
    groupName.set(g.id, g.name);
  }

  const columns = [
    "id", "name", "description", "brand", "gender",
    "category", "subcategory", "colors", "color_group_ids", "style_keywords",
    ...(withEmbedding ? ["embedding"] : []),
  ].join(", ");

  const rows: LabelledProduct[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase!
      .from("products")
      .select(columns)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) return { error: error.message };

    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    for (const r of batch) {
      rows.push({
        id: String(r.id),
        name: String(r.name ?? ""),
        description: String(r.description ?? ""),
        brand: String(r.brand ?? ""),
        gender: (r.gender as string) ?? null,
        category: String(r.category ?? ""),
        subcategory: (r.subcategory as string) ?? null,
        colors: (r.colors as string[]) ?? [],
        colorGroups: ((r.color_group_ids as number[]) ?? [])
          .map((id) => groupName.get(id))
          .filter((n): n is string => !!n),
        styleKeywords: (r.style_keywords as string[]) ?? [],
        embedding: withEmbedding ? parseEmbedding(r.embedding) : null,
      });
    }
    if (batch.length < PAGE) break;
  }
  return rows;
}
