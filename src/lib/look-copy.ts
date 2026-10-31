/**
 * A plain sentence about a look, from the look itself: its season and style,
 * its brands, its piece count and price.
 *
 * The last resort of the copy checks' standard wording (ai-outfits/copy.ts):
 * when the copywriter's description is refused and the sentence built from
 * the pieces comes out too short. Free, instant, cannot fail.
 * It used to be the shopper's Suggest too, with a name in the same shape
 * ("OUR LEGACY + BALENCIAGA minimal look"); Suggest now asks the studio's
 * copywriter (CEO, 2026-10-31), and the name went with it.
 *
 * The price goes in as dollars, the currency a look's total is kept in; the
 * pages that show the text convert any price in it to the reader's currency
 * (`lib/money-text`).
 */
import type { Season } from "@/lib/types";
import { seasonsPhrase } from "@/lib/seasons";

export interface LookCopyInput {
  /** Brands in the look, in piece order; duplicates are collapsed here. */
  brands: string[];
  styleKeywords: string[];
  pieceCount: number;
  /** Formatted in US dollars, e.g. "$2,035" — this module does no maths. */
  price?: string;
  seasons?: Season[];
}

const clean = (values: string[]) =>
  [...new Set(values.map((v) => String(v ?? "").trim()).filter(Boolean))];

/** "Shop this autumn minimal look featuring …. 4 pieces styled together, complete from $1,200 …" */
export function suggestLookDescription(input: LookCopyInput): string {
  const brands = clean(input.brands);
  const byBrands = brands.length ? ` featuring ${brands.slice(0, 3).join(", ")}` : "";
  const kind = [seasonsPhrase(input.seasons ?? []), clean(input.styleKeywords)[0]].filter(Boolean).join(" ");
  const pieces = input.pieceCount ? `${input.pieceCount} piece${input.pieceCount === 1 ? "" : "s"}` : "";
  const from = input.price ? `, complete from ${input.price} across leading retailers` : "";

  return (
    `Shop this ${kind ? `${kind} ` : ""}look${byBrands}. ` +
    `${pieces ? `${pieces} styled together` : "Styled together"}${from}.`
  ).slice(0, 300);
}
