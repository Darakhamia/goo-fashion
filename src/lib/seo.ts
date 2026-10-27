/**
 * Server-safe SEO helpers: canonical URL, meta-price formatting, and
 * structured-data (JSON-LD) builders. No "use client" — safe to import
 * from server components, generateMetadata, sitemap, etc.
 */
import type { Metadata } from "next";
import type { Outfit, Product } from "@/lib/types";
import { CURRENCIES, DISPLAY_FALLBACK_RATES, currencyInfo, withCurrencySymbol } from "@/lib/currency";
import { seasonLabel, seasonsPhrase } from "@/lib/seasons";

/** Canonical site origin — always the non-www apex domain. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://goo-fashion.com").replace(/\/$/, "");

/**
 * The brand as search results and link cards show it. "GOO" alone is a common
 * word that other sites own in search; "GOO Fashion" matches the domain and the
 * legal pages (docs/SEO_PLAN.md, Р-2).
 */
export const SITE_NAME = "GOO Fashion";

/** Build an absolute, canonical (non-www) URL for a given path. */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

// ── Page metadata ───────────────────────────────────────────────────────────

/** What the root layout's title template appends. */
const TITLE_SUFFIX = ` | ${SITE_NAME}`;
/** About what a results page shows of a title before cutting it. */
const TITLE_MAX = 60;

/**
 * A data-driven title (a product's or an outfit's name) as page metadata: with
 * the brand suffix when that still fits in a search result, on its own when
 * the suffix would only push the end of the name out of sight.
 */
export function fittedTitle(title: string): Metadata["title"] {
  return title.length + TITLE_SUFFIX.length <= TITLE_MAX ? title : { absolute: title };
}

type OgImages = NonNullable<Metadata["openGraph"]>["images"];

/** The branded card drawn by app/opengraph-image.tsx. */
export const DEFAULT_OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "GOO Fashion — AI stylist and outfit builder",
};

interface PageMetadataInput {
  /** Without the brand: the root layout's title template appends " | GOO Fashion". */
  title: string;
  description: string;
  /** This page's own path. It becomes the canonical URL and og:url. */
  path: string;
  /** Link-card images. Left out, the site-wide card from app/opengraph-image. */
  images?: OgImages;
  /** Keep the page out of the index; its links are still followed. */
  noindex?: boolean;
}

/**
 * Metadata for a page that has no data-driven tags of its own: title,
 * description, a canonical pointing at the page itself and Open Graph tags that
 * describe it. Every indexable page needs its own canonical — one inherited from
 * the root layout told Google the whole site was a copy of the homepage.
 */
export function pageMetadata({ title, description, path, images, noindex }: PageMetadataInput): Metadata {
  return {
    title,
    description,
    // A page kept out of the index names no canonical: the two signals would
    // contradict each other.
    ...(noindex
      ? { robots: { index: false, follow: true } }
      : { alternates: { canonical: path } }),
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      type: "website",
      // Named explicitly: a page that sets its own openGraph block no longer
      // inherits the image Next derives from app/opengraph-image.tsx.
      images: images ?? [DEFAULT_OG_IMAGE],
    },
  };
}

// ── Currency ────────────────────────────────────────────────────────────────
// Signs and their position come from the site-wide table in lib/currency.

/**
 * Map a raw currency value (ISO code or bare symbol) to a valid ISO 4217 code.
 * Some legacy rows store "$" instead of "USD".
 */
export function normalizeCurrencyCode(currency?: string): string {
  if (!currency) return "USD";
  const raw = currency.trim();
  const bySymbol = CURRENCIES.find((c) => c.symbol === raw);
  if (bySymbol) return bySymbol.code;
  const code = raw.toUpperCase();
  return currencyInfo(code) ? code : "USD";
}

/**
 * Format a price for meta tags / titles: rounded to a whole number, en-US
 * thousands separators, a single currency sign in the conventional position.
 * Deterministic (does not depend on server locale).
 */
export function formatMetaPrice(amount: number, currency?: string): string {
  const info = currencyInfo(normalizeCurrencyCode(currency)) ?? CURRENCIES[0];
  const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(amount));
  return withCurrencySymbol(num, info);
}

// ── Outfit SEO (unique titles/descriptions) ──────────────────────────────────

const GENERIC_OUTFIT_NAMES = new Set([
  "community look", "look", "outfit", "untitled", "untitled look", "new look",
]);

function isGenericName(name?: string): boolean {
  const n = (name ?? "").trim().toLowerCase();
  // The builder's own default ("Outfit 51") and its numbered variants.
  return !n || GENERIC_OUTFIT_NAMES.has(n) || /^(community |my )?(outfit|look)( #?\d+)?$/.test(n);
}

export interface OutfitSeo {
  /** Used for <h1>. */
  heading: string;
  title: string;
  description: string;
}

/**
 * Derive a unique, descriptive title/description/heading for an outfit from its
 * own data (brands + style + piece count + price) so Google does not cluster
 * the generically-named "Community Look" pages as duplicates.
 *
 * Example: "Y-3 + SP5DER streetwear look — 3 pieces from $765" (the root layout's
 * title template adds the brand).
 */
export function buildOutfitSeo(outfit: Outfit): OutfitSeo {
  const brands = [...new Set(outfit.items.map((i) => i.product?.brand).filter(Boolean))] as string[];
  const brandLabel = brands.slice(0, 2).join(" + ");
  const style = outfit.styleKeywords?.[0];
  const pieces = outfit.items.length;
  const price = formatMetaPrice(outfit.totalPriceMin, outfit.currency);

  const descriptor = [brandLabel, style].filter(Boolean).join(" ").trim();

  // Prefer a data-derived heading; fall back to a real custom name, then the
  // season or the piece count.
  const seasons = outfit.seasons ?? [];
  const heading = descriptor
    ? `${descriptor} look`
    : !isGenericName(outfit.name)
      ? outfit.name
      : seasons.length
        ? `${seasonLabel(seasons[0])} outfit`
        : pieces
          ? `${pieces}-piece outfit`
          : "Outfit";

  const piecesLabel = pieces ? `${pieces} piece${pieces === 1 ? "" : "s"}` : "";
  // The piece count goes first when the whole title would be cut off in results.
  const full = [heading, piecesLabel && `${piecesLabel} from ${price}`].filter(Boolean).join(" — ");
  const title = full.length + TITLE_SUFFIX.length <= TITLE_MAX ? full : `${heading} from ${price}`;

  const byBrands = brands.length ? ` featuring ${brands.slice(0, 3).join(", ")}` : "";
  const kind = [seasonsPhrase(seasons), style].filter(Boolean).join(" ");
  const description = (
    `Shop this ${kind ? `${kind} ` : ""}look${byBrands}. ` +
    `${piecesLabel ? `${piecesLabel} ` : ""}styled together, complete from ${price} across leading retailers.`
  ).slice(0, 160);

  return { heading, title, description };
}

// ── Colour variants ─────────────────────────────────────────────────────────

/**
 * The product that stands for a colour group in search: the one marked as the
 * group's main product, otherwise the newest — the same one the catalogue and
 * the sitemap list (`groupVariants` in lib/data/db). Every colour of the group
 * points its canonical here: they share a name, a description and a retailer,
 * so as separate pages they were near-duplicates with one title between them
 * (docs/SEO_PLAN.md, SEO-12, Р-3).
 */
export function primaryVariantId(product: Product): string {
  const group = product.variants ?? [];
  if (group.length < 2) return product.id;
  const marked = group.find((v) => v.isGroupPrimary);
  if (marked) return marked.id;
  const newest = [...group].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];
  return newest?.createdAt ? newest.id : product.id;
}

/**
 * The name to show for an outfit: its own, unless that is a placeholder like
 * "Outfit 51" or "Community Look" — then the heading its page is built under,
 * from its brands and style ("Carhartt WIP + Air Jordan streetwear look").
 */
export function outfitDisplayName(outfit: Outfit): string {
  return isGenericName(outfit.name) ? buildOutfitSeo(outfit).heading : outfit.name;
}

// ── Product meta description ─────────────────────────────────────────────────

/**
 * Text some feeds put in the description field that says nothing about the
 * piece: a reseller's condition or shipping line, the same on every product it
 * lists. As a meta description it made dozens of pages share one snippet. It
 * stays on the page itself, where the condition note is useful to a shopper.
 */
const BOILERPLATE_DESCRIPTIONS = [
  /^pre-verified and ready to ship/i,
  /^verified before shipping/i,
  /^items are new and unworn, but have imperfections/i,
  /^new with box/i,
  /^used, /i,
];

/** Whether a product description is a reseller's stock line, not copy about the piece. */
export function isBoilerplateDescription(text?: string): boolean {
  const t = (text ?? "").trim();
  return BOILERPLATE_DESCRIPTIONS.some((re) => re.test(t));
}

/**
 * Text cut to fit a search snippet: line breaks, bullets and runs of spaces
 * collapse to single spaces, and a cut lands on a word boundary with an
 * ellipsis instead of halfway through a word.
 */
export function clipText(text: string, max = 155): string {
  // A bulleted list reads as one run of clauses: "boots. Lace-up; padded collar".
  const flat = text
    .replace(/\s*\n+\s*[·•▪]\s*/g, (_m, at: number, all: string) =>
      /[.!?:;,]$/.test(all.slice(0, at).trimEnd()) ? " " : "; ",
    )
    .replace(/[\s·•▪]+/g, " ")
    .trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const atWord = cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:–—-]+$/, "");
  return `${atWord || cut}…`;
}

/** The product's colour as a plain word, or undefined: retailers also write "25 Years/Black/Silver". */
function plainColor(product: Product): string | undefined {
  const first = product.colors?.[0] ?? "";
  return /^[a-z][a-z -]{2,19}$/i.test(first) ? first : undefined;
}

/** Shortest description worth showing as a snippet; anything less is filler. */
const MIN_OWN_DESCRIPTION = 60;

/**
 * The meta description of a product page: its own copy when there is enough of
 * it, otherwise a line built from the product — what it is, who makes it, the
 * lowest price and how many stores carry it.
 */
export function productMetaDescription(product: Product, lowestPrice: string): string {
  const own = (product.description ?? "").trim();
  if (own.replace(/\s+/g, " ").length >= MIN_OWN_DESCRIPTION && !isBoilerplateDescription(own)) {
    return clipText(own);
  }
  const color = plainColor(product);
  const byBrand = product.name.toLowerCase().includes(product.brand.toLowerCase()) ? "" : ` by ${product.brand}`;
  const inColor = color && !product.name.toLowerCase().includes(color.toLowerCase()) ? ` in ${color.toLowerCase()}` : "";
  const stores = product.retailers?.length ?? 0;
  const where = stores > 1 ? `Compare prices at ${stores} stores` : "Compare prices";
  return clipText(`${product.name}${byBrand}${inColor}, from ${lowestPrice}. ${where} and buy from the original retailer on GOO.`);
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
 * A price as the page's first HTML prints it, which is what Google compares
 * product markup against: in dollars, converted with the storefront's fallback
 * rates and rounded to whole units, exactly as `applyFormat` displays it
 * (lib/context/currency-context). The store's own euro figure here sat next to
 * a "$250" on the page for every product priced in euros.
 *
 * A currency the storefront has no rate for keeps its own amount and code: the
 * page cannot show it in dollars either, and the markup should not invent one.
 */
function displayedPrice(amount: number, currency?: string): { price: number; priceCurrency: string } {
  const code = normalizeCurrencyCode(currency);
  if (code === "USD") return { price: Math.round(amount), priceCurrency: "USD" };
  const rate = DISPLAY_FALLBACK_RATES[code];
  if (!rate || rate <= 0) return { price: Number(amount.toFixed(2)), priceCurrency: code };
  return { price: Math.round(amount / rate), priceCurrency: "USD" };
}

/** `displayedPrice` as text, the way the page prints it: "$250". */
export function displayedPriceLabel(amount: number, currency?: string): string {
  const { price, priceCurrency } = displayedPrice(amount, currency);
  return formatMetaPrice(price, priceCurrency);
}

/** Build an Offer / AggregateOffer block from a product's retailers. */
function buildOffers(product: Product, productUrl: string): Record<string, unknown> {
  const retailers = product.retailers ?? [];

  if (retailers.length === 0) {
    return {
      "@type": "Offer",
      ...displayedPrice(product.priceMin, product.currency),
      availability: "https://schema.org/InStock",
      url: productUrl,
    };
  }

  const offers = retailers.map((r) => ({
    "@type": "Offer",
    ...displayedPrice(r.price, r.currency ?? product.currency),
    availability: availabilityUrl(r.availability),
    url: r.url || productUrl,
    seller: { "@type": "Organization", name: r.name },
  }));

  if (offers.length === 1) return offers[0];

  // The range is stated in one currency, so it spans the offers that are in it.
  const currency = offers[0].priceCurrency;
  const prices = offers.filter((o) => o.priceCurrency === currency).map((o) => o.price);
  return {
    "@type": "AggregateOffer",
    lowPrice: Math.min(...prices),
    highPrice: Math.max(...prices),
    offerCount: offers.length,
    priceCurrency: currency,
    offers,
  };
}

/**
 * The item's condition when a reseller's note says it isn't simply new. Left
 * out otherwise: most of the catalogue is new stock, and the markup should not
 * assert what the record doesn't say.
 */
function itemCondition(product: Product): string | undefined {
  const text = `${product.name} ${product.description ?? ""}`.toLowerCase();
  if (/\b(pre-owned|preowned|second-hand|used condition|gently used|worn once)\b/.test(text)) {
    return "https://schema.org/UsedCondition";
  }
  if (/\b(imperfections?|defects?|damaged)\b/.test(text)) return "https://schema.org/DamagedCondition";
  return undefined;
}

export function productJsonLd(product: Product): Record<string, unknown> {
  const url = absoluteUrl(`/product/${product.id}`);
  const images = product.images?.length
    ? product.images
    : product.imageUrl
      ? [product.imageUrl]
      : undefined;
  const color = plainColor(product);
  const condition = itemCondition(product);
  const offers = buildOffers(product, url);
  if (condition) {
    const list = (offers.offers as Record<string, unknown>[] | undefined) ?? [offers];
    for (const offer of list) offer.itemCondition = condition;
  }

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    brand: { "@type": "Brand", name: product.brand },
    ...(images ? { image: images } : {}),
    ...(product.description ? { description: product.description } : {}),
    ...(product.category ? { category: product.category } : {}),
    ...(product.material ? { material: product.material } : {}),
    ...(color ? { color } : {}),
    // Codes that identify the item anywhere — how search engines match this
    // page to the same product elsewhere. gtin is verified before it is stored.
    ...(product.gtin ? { gtin: product.gtin } : {}),
    ...(product.mpn ? { mpn: product.mpn } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    offers,
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
    name: SITE_NAME,
    alternateName: "GOO",
    url: SITE_URL,
    // app/icon.png: the real 512×512 brand mark (the site icon), not a
    // system-font render. Google wants a real image of at least 112×112.
    logo: absoluteUrl("/icon.png"),
    description: "AI-powered fashion stylist and aggregator — curated outfits and premium fashion from leading retailers.",
    // sameAs: the brand's profiles go here once there are any (SEO-26).
  };
}

/**
 * The site's name for Google's "site name" in results — "GOO" alone is a word
 * other sites own (docs/SEO_PLAN.md, Р-2). No SearchAction: Google retired the
 * sitelinks search box it fed in November 2024.
 */
export function websiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: ["GOO", "goo-fashion.com"],
    url: SITE_URL,
  };
}

/** The default byline of the journal — the brand itself, not a person. */
function isHouseAuthor(name: string): boolean {
  return /^goo( fashion)?( journal| team)?$/i.test(name.trim());
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
    // Posts written "by GOO" are the publication's, not a person's: marking the
    // brand up as a Person is the kind of authorship signal Google discounts.
    author: isHouseAuthor(post.authorName)
      ? { "@type": "Organization", name: SITE_NAME, url: SITE_URL }
      : { "@type": "Person", name: post.authorName },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: absoluteUrl("/icon.png") },
    },
    ...(post.category ? { articleSection: post.category } : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(`/blog/${post.slug}`) },
  };
}
