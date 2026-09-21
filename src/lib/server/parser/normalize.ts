/**
 * Normalise a RawExtract into a ParsedProduct, reusing the shared field helpers
 * so URL imports behave exactly like CSV imports (price/currency/category/gender
 * inference are identical).
 */
import {
  cleanName,
  tidyProductName,
  parsePrice,
  extractCurrencyFromDisplay,
  matchCategory,
  inferGenderFromText,
  canonicalColor,
} from "@/lib/server/product-fields";
import type { RawExtract, ParserSiteConfig, ParsedProduct } from "./types";
import { upgradeImageUrl, imageKey } from "./gallery";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/** Resolve a possibly-relative image URL against the page URL. */
function absoluteUrl(src: string, base: string): string | null {
  if (!src) return null;
  try {
    if (src.startsWith("//")) return new URL(base).protocol + src;
    return new URL(src, base).toString();
  } catch {
    return null;
  }
}

/**
 * Work out what currency a price is in, or admit that we do not know.
 *
 * Returning `""` rather than `"USD"` is the point of this function. Defaulting
 * to dollars put a 4 000 ₴ jacket in the catalogue as a $4 000 jacket — wrong on
 * the product page, wrong in every price filter, and wrong in the stylist's
 * budget, all silently. An unknown currency is now a fact the caller can act on.
 *
 * The hints are tried strongest first:
 *   1. an explicit ISO code from structured data (`priceCurrency`, og);
 *   2. a symbol inside whichever strings we were given;
 *   3. the visible price text, which only a rendered page can supply —
 *      structured-data prices arrive as bare numbers with the symbol already
 *      stripped, so this is the only hint a symbol-only store ever offers;
 *   4. a currency the admin declared for the whole store before the run.
 *
 * The admin's declaration comes last deliberately: it is a blanket statement
 * about a store, so anything the page itself says about a specific product
 * outranks it.
 */
function normalizeCurrency(
  rawCurrency: string | undefined,
  rawPrice: string | undefined,
  priceDisplay: string | undefined,
  fallbackCurrency: string | undefined,
): string {
  const c = (rawCurrency ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(c)) return c;

  const sniffed =
    extractCurrencyFromDisplay(rawCurrency ?? "") ||
    extractCurrencyFromDisplay(rawPrice ?? "") ||
    extractCurrencyFromDisplay(priceDisplay ?? "");
  if (sniffed) return sniffed.toUpperCase();

  const declared = (fallbackCurrency ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(declared)) return declared;

  return "";
}

export interface NormalizeOptions {
  /**
   * The trailing text this store appends to every page title, worked out by a
   * caller that has seen several of its pages. Subtracted from the name.
   */
  titleSuffix?: string;
  /**
   * The price exactly as it appears on screen ("4 000 ₴"), when a rendered page
   * was available. Used only as a currency hint; the amount itself still comes
   * from the structured fields.
   */
  priceDisplay?: string;
  /**
   * Currency the admin declared for this store before the run. A declaration of
   * the source currency only — no conversion happens client-side, so the rate
   * stays one server-side rate rather than one per admin.
   */
  fallbackCurrency?: string;
}

export function normalizeExtract(
  raw: RawExtract,
  sourceUrl: string,
  config?: ParserSiteConfig | null,
  opts?: NormalizeOptions,
): ParsedProduct {
  const issues: string[] = [];

  const brand = (config?.brandOverride || raw.brand || "").trim();

  // The size suffix goes first (it is about the garment), then the store's
  // furniture (it is about the shop). Both are conservative: anything that
  // cannot be justified is left on the name.
  const name = tidyProductName(cleanName(raw.name ?? ""), {
    host: hostOf(sourceUrl),
    brand,
    titleSuffix: opts?.titleSuffix,
  });
  if (!name) issues.push("missing name");

  const price = parsePrice(raw.price ?? "");
  if (!price) issues.push("missing price");
  const priceOriginal = parsePrice(raw.priceOriginal ?? "");

  const currency = normalizeCurrency(
    raw.currency,
    raw.price,
    opts?.priceDisplay ?? raw.priceDisplay,
    opts?.fallbackCurrency,
  );
  // Only worth flagging when there is a price to be wrong about: a page with no
  // price at all already carries "missing price", and saying both would just
  // report one absence twice.
  if (price && !currency) issues.push("unknown currency");

  // Category: explicit override → product name/description → URL path hint.
  // Prefer the name-based guess; only fall back to the URL path when the name
  // yields nothing, and to "accessories" only when neither signal matches.
  const category =
    config?.categoryOverride ??
    // The name only. Measured on held-out products, name-only classifies at
    // 92% against 88% when the description is included: descriptions name-drop
    // other garments, and "pairs well with shorts" reads as "is shorts".
    matchCategory(name) ??
    matchCategory(safePath(sourceUrl)) ??
    "accessories";

  // Gender: explicit override → URL → name/description
  const gender =
    config?.genderOverride ??
    inferGenderFromText(sourceUrl) ??
    inferGenderFromText(`${name} ${raw.description ?? ""}`);

  // Images: resolve to absolute URLs, ask the CDN for the full-resolution
  // original, then dedupe by photo identity rather than by string.
  //
  // Both steps earn their keep. Structured data hands back the same photo at
  // several renditions — a live Cuyana page advertises `…_2785_1024x.jpg`,
  // `…_2785.jpg` and `…_2785_600x600_crop_center.jpg` as three separate images —
  // so string dedupe stored one photo three times and mirrored it three times.
  // And a page that requests `?width=300` markup would otherwise have its
  // gallery mirrored at 300px, which is useless for a catalog.
  const byPhoto = new Map<string, string>();
  for (const u of raw.images ?? []) {
    const abs = absoluteUrl(u, sourceUrl);
    if (!abs) continue;
    const full = upgradeImageUrl(abs, sourceUrl) ?? abs;
    const key = imageKey(full);
    if (!byPhoto.has(key)) byPhoto.set(key, full);
  }
  const images = [...byPhoto.values()].slice(0, 12);

  const rawAbs = raw.image && absoluteUrl(raw.image, sourceUrl);
  const rawPrimary = rawAbs ? (upgradeImageUrl(rawAbs, sourceUrl) ?? rawAbs) : null;
  // Take the gallery's spelling of the primary photo when they are the same
  // picture. They routinely differ as strings while naming one file, and the
  // mirror deduplicates on the string — so without this the hero shot is
  // downloaded and stored twice.
  const imageUrl = (rawPrimary && byPhoto.get(imageKey(rawPrimary))) || rawPrimary || images[0] || "";
  if (!imageUrl) issues.push("no image");

  // Colour, in order of how directly the page said it: its own colour field
  // first (kept verbatim — the catalogue shows the store's word for it), then
  // the product title, then the URL slug. The last two are only trusted when
  // they name a colour the catalogue knows, so "Air Force" stays a shoe.
  const colors = [colorFrom(raw.color, name, sourceUrl)].filter(Boolean) as string[];
  const sizes = raw.sizes ?? [];

  return {
    name,
    brand,
    category,
    gender,
    description: raw.description ?? "",
    imageUrl,
    images: images.length ? images : (imageUrl ? [imageUrl] : []),
    colors,
    sizes,
    material: raw.material ?? "",
    price,
    priceOriginal,
    currency,
    sourceUrl,
    strategies: raw.strategies ?? [],
    issues,
    valid: issues.length === 0,
  };
}

/**
 * The colour to file a product under.
 *
 * A colour the page states is kept exactly as written — "Core Black" stays
 * "Core Black", because the catalogue shows the store's own word for it and
 * reads the base colour out of it separately for the swatch and the filter.
 *
 * When the page states none, the title and then the URL's product slug are read
 * for one. Both are guarded by the catalogue's colour vocabulary, so "Nike Air
 * Force 1" contributes nothing while "Wool Runner — Natural Black" contributes
 * Black. Only the last path segment is read: a `/collections/black-friday/`
 * ancestor is a sale, not a colourway.
 */
function colorFrom(stated: string | undefined, name: string, sourceUrl: string): string | undefined {
  // Even a stated colour we cannot classify ("as pictured", "multi") is the
  // store's answer, and a better label than one we made up.
  const said = (stated ?? "").trim();
  if (said) return said;

  const slug = (() => {
    try {
      const last = new URL(sourceUrl).pathname.split("/").filter(Boolean).pop() ?? "";
      return last.replace(/\.(?:html?|aspx?|php|jsp)$/i, "").replace(/[-_]+/g, " ");
    } catch {
      return "";
    }
  })();

  const base = canonicalColor(name) ?? canonicalColor(slug);
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : undefined;
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname.replace(/[-_/]+/g, " ");
  } catch {
    return "";
  }
}
