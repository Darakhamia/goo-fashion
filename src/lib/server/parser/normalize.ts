/**
 * Normalise a RawExtract into a ParsedProduct, reusing the shared field helpers
 * so URL imports behave exactly like CSV imports (price/currency/category/gender
 * inference are identical).
 */
import {
  cleanName,
  parsePrice,
  extractCurrencyFromDisplay,
  inferCategoryFromName,
  parseRetailCategory,
  inferGenderFromText,
} from "@/lib/server/product-fields";
import type { RawExtract, ParserSiteConfig, ParsedProduct } from "./types";

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

function normalizeCurrency(rawCurrency: string | undefined, rawPrice: string | undefined): string {
  const c = (rawCurrency ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(c)) return c;
  return (extractCurrencyFromDisplay(rawCurrency ?? "") || extractCurrencyFromDisplay(rawPrice ?? "") || "USD").toUpperCase();
}

export function normalizeExtract(
  raw: RawExtract,
  sourceUrl: string,
  config?: ParserSiteConfig | null,
): ParsedProduct {
  const issues: string[] = [];

  const name = cleanName(raw.name ?? "");
  if (!name) issues.push("missing name");

  const brand = (config?.brandOverride || raw.brand || "").trim();

  const price = parsePrice(raw.price ?? "");
  if (!price) issues.push("missing price");
  const priceOriginal = parsePrice(raw.priceOriginal ?? "");

  const currency = normalizeCurrency(raw.currency, raw.price);

  // Category: explicit override → URL path hint → product name inference
  let category = config?.categoryOverride;
  if (!category) {
    const fromUrl = parseRetailCategory(safePath(sourceUrl)).category;
    const fromName = inferCategoryFromName(`${name} ${raw.description ?? ""}`);
    // Prefer the name-based guess unless the URL path clearly says otherwise.
    category = fromName !== "accessories" ? fromName : fromUrl;
  }

  // Gender: explicit override → URL → name/description
  const gender =
    config?.genderOverride ??
    inferGenderFromText(sourceUrl) ??
    inferGenderFromText(`${name} ${raw.description ?? ""}`);

  // Images: resolve to absolute URLs → dedupe, cap at 12. Store the originals
  // as-is; higher-resolution variants are requested at render time (with a
  // fallback to these URLs) so a rewrite that a CDN rejects never loses a photo.
  const images = [...new Set(
    (raw.images ?? [])
      .map((u) => absoluteUrl(u, sourceUrl))
      .filter((u): u is string => !!u),
  )].slice(0, 12);
  const rawPrimary = raw.image && absoluteUrl(raw.image, sourceUrl);
  const imageUrl = rawPrimary || images[0] || "";
  if (!imageUrl) issues.push("no image");

  const colors = raw.color ? [raw.color] : [];
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

function safePath(url: string): string {
  try {
    return new URL(url).pathname.replace(/[-_/]+/g, " ");
  } catch {
    return "";
  }
}
