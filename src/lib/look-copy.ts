/**
 * Suggested name and description for a look, derived from the look itself.
 *
 * The site has been writing this copy all along — `buildOutfitSeo` composes a
 * heading and a description for the public outfit page out of brands, style,
 * piece count and price, which is where "OUR LEGACY + BALENCIAGA MINIMAL LOOK"
 * comes from. But it runs at render time for SEO and is never stored, so the
 * outfit row underneath still holds whatever the approval step wrote.
 *
 * So this is not new cleverness, it is the same rule made available before the
 * fact: offer the shopper the text the page would have generated anyway, let
 * them keep it or write their own, and store the result. Two consequences worth
 * stating — it costs nothing and cannot fail, because there is no model call in
 * it, and the suggestion matches what the public page will actually render.
 */

export interface LookCopyInput {
  /** Brands in the look, in piece order; duplicates are collapsed here. */
  brands: string[];
  styleKeywords: string[];
  pieceCount: number;
  /** Already formatted for display, e.g. "$2,035" — this module does no maths. */
  price?: string;
  occasion?: string;
  season?: string;
}

const clean = (values: string[]) =>
  [...new Set(values.map((v) => String(v ?? "").trim()).filter(Boolean))];

/**
 * A name in the shape the outfit page uses: two brands, the leading style, and
 * the word "look". Falls back down the same ladder when a look has no brands or
 * no tags, so it always returns something usable rather than an empty string.
 */
export function suggestLookName(input: LookCopyInput): string {
  const brands = clean(input.brands);
  const style = clean(input.styleKeywords)[0];
  const descriptor = [brands.slice(0, 2).join(" + "), style].filter(Boolean).join(" ").trim();

  if (descriptor) return `${descriptor} look`;
  if (input.occasion) return `${input.occasion} look`;
  return input.pieceCount ? `${input.pieceCount}-piece look` : "New look";
}

/**
 * A sentence about what the look is, matching the public page's description so
 * a shopper who accepts the suggestion sees the same words in the catalogue.
 */
export function suggestLookDescription(input: LookCopyInput): string {
  const brands = clean(input.brands);
  const byBrands = brands.length ? ` featuring ${brands.slice(0, 3).join(", ")}` : "";
  const season = input.season && input.season !== "all" ? `${input.season} ` : "";
  const occasion = input.occasion || "casual";
  const pieces = input.pieceCount ? `${input.pieceCount} piece${input.pieceCount === 1 ? "" : "s"}` : "";
  const from = input.price ? `, complete from ${input.price} across leading retailers` : "";

  return (
    `Shop this ${season}${occasion} look${byBrands}. ` +
    `${pieces ? `${pieces} styled together` : "Styled together"}${from}.`
  ).slice(0, 300);
}
