/**
 * Server-safe SEO helpers: canonical URL, meta-price formatting, and
 * structured-data (JSON-LD) builders. No "use client" — safe to import
 * from server components, generateMetadata, sitemap, etc.
 */
import type { Outfit, Product } from "@/lib/types";

/** Canonical site origin — always the non-www apex domain. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://goo-fashion.com").replace(/\/$/, "");

/** Build an absolute, canonical (non-www) URL for a given path. */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

// ── Currency ────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", UAH: "₴", CZK: "Kč", JPY: "¥", TRY: "₺",
};
// Currencies conventionally written after the amount.
const SUFFIX_CURRENCIES = new Set(["EUR", "UAH", "CZK", "TRY"]);

/**
 * Map a raw currency value (ISO code or bare symbol) to a valid ISO 4217 code.
 * Some legacy rows store "$" instead of "USD".
 */
export function normalizeCurrencyCode(currency?: string): string {
  if (!currency) return "USD";
  const raw = currency.trim();
  const bySymbol = Object.entries(CURRENCY_SYMBOL).find(([, sym]) => sym === raw);
  if (bySymbol) return bySymbol[0];
  const code = raw.toUpperCase();
  return CURRENCY_SYMBOL[code] ? code : "USD";
}

/**
 * Format a price for meta tags / titles: rounded to a whole number, en-US
 * thousands separators, a single currency sign in the conventional position.
 * Deterministic (does not depend on server locale).
 */
export function formatMetaPrice(amount: number, currency?: string): string {
  const code = normalizeCurrencyCode(currency);
  const symbol = CURRENCY_SYMBOL[code] ?? "$";
  const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(amount));
  return SUFFIX_CURRENCIES.has(code) ? `${num} ${symbol}` : `${symbol}${num}`;
}

// ── Outfit SEO (unique titles/descriptions) ──────────────────────────────────

const GENERIC_OUTFIT_NAMES = new Set([
  "community look", "look", "outfit", "untitled", "untitled look", "new look",
]);

function isGenericName(name?: string): boolean {
  return !name || GENERIC_OUTFIT_NAMES.has(name.trim().toLowerCase());
}

export interface OutfitSeo {
  /** Used for <h1> and og:title core (no " | GOO" suffix). */
  heading: string;
  title: string;
  description: string;
}

/**
 * Derive a unique, descriptive title/description/heading for an outfit from its
 * own data (brands + style + piece count + price) so Google does not cluster
 * the generically-named "Community Look" pages as duplicates.
 *
 * Example: "Y-3 + SP5DER streetwear look — 3 pieces from $765 | GOO"
 */
export function buildOutfitSeo(outfit: Outfit): OutfitSeo {
  const brands = [...new Set(outfit.items.map((i) => i.product?.brand).filter(Boolean))] as string[];
  const brandLabel = brands.slice(0, 2).join(" + ");
  const style = outfit.styleKeywords?.[0];
  const pieces = outfit.items.length;
  const price = formatMetaPrice(outfit.totalPriceMin, outfit.currency);

  const descriptor = [brandLabel, style].filter(Boolean).join(" ").trim();

  // Prefer a data-derived heading; fall back to a real custom name, then occasion.
  const heading = descriptor
    ? `${descriptor} look`
    : !isGenericName(outfit.name)
      ? outfit.name
      : `${outfit.occasion} outfit`;

  const piecesLabel = pieces ? `${pieces} piece${pieces === 1 ? "" : "s"}` : "";
  const titleCore = [heading, piecesLabel && `${piecesLabel} from ${price}`]
    .filter(Boolean)
    .join(" — ");
  const title = `${titleCore} | GOO`;

  const byBrands = brands.length ? ` featuring ${brands.slice(0, 3).join(", ")}` : "";
  const season = outfit.season && outfit.season !== "all" ? `${outfit.season} ` : "";
  const description = (
    `Shop this ${season}${outfit.occasion} look${byBrands}. ` +
    `${piecesLabel ? `${piecesLabel} ` : ""}styled together, complete from ${price} across leading retailers.`
  ).slice(0, 160);

  return { heading, title, description };
}

// ── Product styling copy (thin-affiliate mitigation) ─────────────────────────

const COMPLEMENTARY: Record<string, string[]> = {
  outerwear: ["tops", "bottoms", "footwear"],
  blazers: ["shirts", "bottoms", "footwear"],
  tops: ["bottoms", "outerwear", "footwear"],
  shirts: ["bottoms", "outerwear", "footwear"],
  knitwear: ["bottoms", "outerwear", "footwear"],
  bottoms: ["tops", "footwear", "outerwear"],
  jeans: ["tops", "footwear", "outerwear"],
  shorts: ["tops", "footwear", "accessories"],
  skirts: ["tops", "footwear", "outerwear"],
  dresses: ["footwear", "outerwear", "bags"],
  jumpsuits: ["footwear", "outerwear", "accessories"],
  footwear: ["bottoms", "tops", "outerwear"],
  bags: ["outerwear", "footwear", "accessories"],
  accessories: ["outerwear", "footwear", "bags"],
  swimwear: ["accessories", "footwear", "outerwear"],
};

export interface StylingNotes {
  /** Short, unique styling paragraph derived from the product's own attributes. */
  text: string;
  /** Complementary categories to pair with, for a "wear it with" cue. */
  pairWith: string[];
}

/**
 * Generate a short, deterministic styling paragraph from a product's existing
 * attributes (brand, style, material, colour, category). This adds original
 * on-page copy so catalog pages aren't pure thin-affiliate duplicates of the
 * source feed. It only uses data already rendered on the page.
 */
export function buildStylingNotes(product: Product): StylingNotes {
  const style = product.styleKeywords?.[0];
  const color = product.colors?.[0]?.toLowerCase();
  const category = product.category;
  const pairWith = COMPLEMENTARY[category] ?? ["footwear", "accessories"];

  const lead = style
    ? `A ${style} ${category} piece from ${product.brand}`
    : `A ${category} piece from ${product.brand}`;
  const colorBit = color ? ` Its ${color} tone keeps it easy to combine across a wardrobe.` : "";
  const materialBit = product.material ? ` Made from ${product.material.toLowerCase()}.` : "";
  const pairBit = ` Style it with ${pairWith.slice(0, 2).join(" and ")} to finish the look.`;

  const text = `${lead}.${materialBit}${colorBit}${pairBit}`.replace(/\s+/g, " ").trim();
  return { text, pairWith };
}

// ── JSON-LD builders ─────────────────────────────────────────────────────────

const AVAILABILITY: Record<string, string> = {
  "in stock": "https://schema.org/InStock",
  "low stock": "https://schema.org/LimitedAvailability",
  "sold out": "https://schema.org/OutOfStock",
};

function availabilityUrl(a?: string): string {
  return AVAILABILITY[(a ?? "").toLowerCase()] ?? "https://schema.org/InStock";
}

/**
 * JSON-LD prices must match what's shown on the page — Google flags rich
 * results when they diverge, so keep cents instead of rounding.
 */
function jsonLdPrice(amount: number): number {
  return Number(amount.toFixed(2));
}

/** Build an Offer / AggregateOffer block from a product's retailers. */
function buildOffers(product: Product, productUrl: string): Record<string, unknown> {
  const retailers = product.retailers ?? [];

  if (retailers.length === 0) {
    return {
      "@type": "Offer",
      price: jsonLdPrice(product.priceMin),
      priceCurrency: normalizeCurrencyCode(product.currency),
      availability: "https://schema.org/InStock",
      url: productUrl,
    };
  }

  if (retailers.length === 1) {
    const r = retailers[0];
    return {
      "@type": "Offer",
      price: jsonLdPrice(r.price),
      priceCurrency: normalizeCurrencyCode(r.currency),
      availability: availabilityUrl(r.availability),
      url: r.url || productUrl,
      seller: { "@type": "Organization", name: r.name },
    };
  }

  const prices = retailers.map((r) => r.price);
  return {
    "@type": "AggregateOffer",
    lowPrice: jsonLdPrice(Math.min(...prices)),
    highPrice: jsonLdPrice(Math.max(...prices)),
    offerCount: retailers.length,
    priceCurrency: normalizeCurrencyCode(retailers[0].currency ?? product.currency),
    offers: retailers.map((r) => ({
      "@type": "Offer",
      price: jsonLdPrice(r.price),
      priceCurrency: normalizeCurrencyCode(r.currency),
      availability: availabilityUrl(r.availability),
      url: r.url || productUrl,
      seller: { "@type": "Organization", name: r.name },
    })),
  };
}

export function productJsonLd(product: Product): Record<string, unknown> {
  const url = absoluteUrl(`/product/${product.id}`);
  const images = product.images?.length
    ? product.images
    : product.imageUrl
      ? [product.imageUrl]
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    brand: { "@type": "Brand", name: product.brand },
    ...(images ? { image: images } : {}),
    ...(product.description ? { description: product.description } : {}),
    ...(product.category ? { category: product.category } : {}),
    ...(product.material ? { material: product.material } : {}),
    offers: buildOffers(product, url),
    url,
  };
}

export function outfitJsonLd(outfit: Outfit, heading: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: heading,
    numberOfItems: outfit.items.length,
    itemListElement: outfit.items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(`/product/${item.product.id}`),
      name: item.product.name,
      ...(item.product.imageUrl ? { image: item.product.imageUrl } : {}),
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; url?: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      ...(it.url ? { item: it.url } : {}),
    })),
  };
}

export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "GOO",
    url: SITE_URL,
    logo: absoluteUrl("/logo.png"),
    description: "AI-powered fashion stylist and aggregator — curated outfits and premium fashion from leading retailers.",
  };
}

export function websiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "GOO",
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/browse?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function blogPostingJsonLd(post: {
  title: string;
  excerpt?: string;
  coverImageUrl?: string;
  publishedAt?: string;
  updatedAt?: string;
  authorName: string;
  category?: string;
  slug: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    ...(post.excerpt ? { description: post.excerpt } : {}),
    ...(post.coverImageUrl ? { image: post.coverImageUrl } : {}),
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    ...(post.updatedAt ? { dateModified: post.updatedAt } : {}),
    author: { "@type": "Person", name: post.authorName },
    publisher: {
      "@type": "Organization",
      name: "GOO",
      logo: { "@type": "ImageObject", url: absoluteUrl("/favicon.ico") },
    },
    ...(post.category ? { articleSection: post.category } : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(`/blog/${post.slug}`) },
  };
}
