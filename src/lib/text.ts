/**
 * Small text helpers shared by the taxonomy matchers and the parser.
 *
 * No imports and nothing environment-specific, so the storefront and the
 * server can both use them.
 */

/** `value` with every regex metacharacter escaped, to match it literally. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Contains a letter from the basic Cyrillic block (U+0400–U+04FF). */
export function isCyrillic(value: string): boolean {
  return /[Ѐ-ӿ]/.test(value);
}

/**
 * Text as the taxonomy dictionaries match it: lowercase, "ё" → "е", every run
 * of non-letters/digits one space, and padded with a space on both sides so a
 * term can be anchored on spaces.
 */
export function normalize(text: string): string {
  return ` ${(text ?? "").toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
}
