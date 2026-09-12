/**
 * WooCommerce's own JSON, instead of WooCommerce's HTML.
 *
 * Every WooCommerce store since 5.x carries the Store API — the read-only half
 * of Woo's REST surface that the block-based cart and product grids talk to. It
 * needs no key, no nonce and no account:
 *
 *   /wp-json/wc/store/v1/products?slug=<slug>   → one product, in full
 *   /wp-json/wc/store/v1/products?per_page=100  → a page of the catalogue
 *   /wp-json/wc/store/v1/products?category=<id> → a page of one category
 *
 * It matters for the same two reasons Shopify's does. It carries more than the
 * page: every photo in `images[]`, the price and the struck-through price as
 * numbers, and colour and size as named attribute terms rather than as markup
 * to mine. And it is an API rather than a page, so it is routinely served on a
 * store whose HTML sits behind bot management.
 *
 * It matters *more* than Shopify's in one way. A brand's own Woo store is the
 * archetype of the shop that ships no JSON-LD, no product OpenGraph tags and no
 * microdata — the case `ai-extract.ts` exists to rescue at the cost of a model
 * call per product. Read as data, those stores need no call at all.
 *
 * Two bases are tried, because the Store API moved under `/v1` in 2021 and
 * older installs still answer the unversioned path. Which one works is
 * remembered per host, and a host that answers neither is remembered as not
 * WooCommerce for the rest of the run.
 */
import { stripTags } from "./extract";
import {
  COLOR_OPTION,
  SIZE_OPTION,
  getStoreJson,
  hostOf,
  isNotPlatform,
  isObj,
  markNotPlatform,
  type StorefrontProductResult,
} from "./store-json";
import type { ParserFetchSettings, RawExtract } from "./types";

/** The Store API's own cap on `per_page`. */
const PAGE_SIZE = 100;

/** Newest first: the versioned route, then the one older installs still serve. */
const BASES = ["/wp-json/wc/store/v1", "/wp-json/wc/store"];

/** Which base answered, per host, so the second one is tried once and not again. */
const baseByHost = new Map<string, string>();

/** A slug is one path segment of a permalink, and always carries a word. */
const SLUG = /^[a-z0-9][a-z0-9\-_.%]*$/i;

/** Paths that are a listing on a Woo store, whatever their last segment looks like. */
const LISTING_SEGMENTS = new Set([
  "product-category", "product-tag", "product-brand", "shop", "store", "catalog", "catalogue",
]);

interface WooImage {
  src?: string;
}

interface WooPrices {
  price?: string | number;
  regular_price?: string | number;
  sale_price?: string | number;
  price_range?: { min_amount?: string | number; max_amount?: string | number } | null;
  currency_code?: string;
  currency_minor_unit?: number;
}

interface WooTerm {
  name?: string;
}

interface WooAttribute {
  name?: string;
  taxonomy?: string;
  terms?: WooTerm[];
}

export interface WooProduct {
  name?: string;
  slug?: string;
  permalink?: string;
  description?: string;
  short_description?: string;
  prices?: WooPrices;
  images?: WooImage[];
  attributes?: WooAttribute[];
  brands?: { name?: string }[];
}

/**
 * Is this a Store API product rather than some other JSON that happened to come
 * back? A name and a permalink, plus either photos or prices — no other route we
 * might hit by accident answers in that shape.
 */
export function isWooProduct(v: unknown): v is WooProduct {
  if (!isObj(v)) return false;
  if (typeof v.name !== "string" || !v.name) return false;
  if (typeof v.permalink !== "string" || !/^https?:\/\//.test(v.permalink)) return false;
  return Array.isArray(v.images) || isObj(v.prices);
}

/**
 * The product slug a Woo permalink addresses, or null when the URL is a listing
 * rather than a product.
 *
 * Woo lets the shop owner choose the prefix — `/product/<slug>`, `/shop/<slug>`,
 * a localised word, or no prefix at all — so the prefix cannot be tested for.
 * The last segment is the slug in every one of those layouts; what rules a URL
 * out is a listing marker anywhere in the path, which is unambiguous.
 */
export function wooProductSlug(pageUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(pageUrl);
  } catch {
    return null;
  }
  const segments = u.pathname.split("/").filter(Boolean);
  if (!segments.length) return null;
  if (segments.some((s) => LISTING_SEGMENTS.has(s.toLowerCase()))) return null;
  // `/shop/page/2` and friends: the pagination tail is not a slug.
  if (segments.length >= 2 && /^\d+$/.test(segments[segments.length - 1]) && segments[segments.length - 2].toLowerCase() === "page") {
    return null;
  }
  const last = segments[segments.length - 1];
  if (!SLUG.test(last)) return null;
  // A slug is a name, not a number — `/2024/` is an archive, not a product.
  if (!/[a-z]/i.test(last)) return null;
  return last;
}

/** The category slug a `/product-category/…` URL addresses — the deepest one. */
export function wooCategorySlug(pageUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(pageUrl);
  } catch {
    return null;
  }
  const segments = u.pathname.split("/").filter(Boolean);
  const at = segments.findIndex((s) => s.toLowerCase() === "product-category");
  if (at === -1) return null;
  const rest = segments.slice(at + 1).filter((s) => s.toLowerCase() !== "page" && !/^\d+$/.test(s));
  const last = rest[rest.length - 1];
  return last && SLUG.test(last) ? last : null;
}

/**
 * Money out of the Store API, which reports minor units — `"4200"` with
 * `currency_minor_unit: 2` is 42.00. Older builds send a decimal string
 * instead and ship no minor unit, so the presence of that field decides how the
 * number is read rather than its shape: guessing would put a price 100× off on
 * a tag.
 */
function money(amount: unknown, minorUnit: unknown): string | undefined {
  const raw =
    typeof amount === "string" ? amount.trim() : typeof amount === "number" ? String(amount) : "";
  if (!raw) return undefined;
  if (typeof minorUnit !== "number" || !Number.isFinite(minorUnit)) {
    return /^\d+(?:\.\d+)?$/.test(raw) ? raw : undefined;
  }
  if (/^\d+\.\d+$/.test(raw)) return raw;
  if (!/^\d+$/.test(raw)) return undefined;
  const unit = Math.max(0, Math.min(6, Math.round(minorUnit)));
  if (unit === 0) return raw;
  const padded = raw.padStart(unit + 1, "0");
  return `${padded.slice(0, padded.length - unit)}.${padded.slice(padded.length - unit)}`;
}

function termValues(attributes: WooAttribute[], match: RegExp): string[] {
  for (const a of attributes) {
    const name = typeof a?.name === "string" ? a.name.trim() : "";
    // `pa_color` is the taxonomy behind an attribute the shop may have named
    // anything, so it is worth testing alongside the label.
    const taxonomy = typeof a?.taxonomy === "string" ? a.taxonomy.replace(/^pa_/, "").trim() : "";
    if (!match.test(name) && !match.test(taxonomy)) continue;
    const values = (a.terms ?? []).map((t) => String(t?.name ?? "").trim()).filter(Boolean);
    if (values.length) return values;
  }
  return [];
}

const BRAND_ATTRIBUTE = /^(?:brand|brands|marke|marque|marca|бренд)$/i;

/**
 * Turn one Store API product into the same RawExtract the HTML path produces,
 * so everything downstream — normalisation, colour, import — is shared and
 * cannot drift.
 */
export function rawFromWooProduct(product: WooProduct, sourceUrl: string): RawExtract {
  const images = (product.images ?? [])
    .map((i) => (typeof i?.src === "string" ? i.src.trim() : ""))
    .filter(Boolean);

  const prices = product.prices ?? {};
  const minorUnit = prices.currency_minor_unit;
  // A variable product reports its span in `price_range`; its `price` is the
  // same lowest number, so the range is read only when it is there.
  const price =
    money(prices.price_range?.min_amount, minorUnit) ?? money(prices.price, minorUnit);
  const regular = money(prices.regular_price, minorUnit);
  const attributes = product.attributes ?? [];

  const brandFromList = (product.brands ?? [])
    .map((b) => String(b?.name ?? "").trim())
    .filter(Boolean)[0];

  return {
    name: product.name?.trim() || undefined,
    // `brands[]` is the Store API's own field (WooCommerce 9.4+); before that a
    // single-brand store usually shipped it as a plain attribute.
    brand: brandFromList || termValues(attributes, BRAND_ATTRIBUTE)[0],
    price,
    priceOriginal: regular && price && Number(regular) > Number(price) ? regular : undefined,
    currency:
      typeof prices.currency_code === "string" && /^[A-Za-z]{3}$/.test(prices.currency_code)
        ? prices.currency_code.toUpperCase()
        : undefined,
    image: images[0],
    images,
    color: termValues(attributes, COLOR_OPTION)[0],
    sizes: termValues(attributes, SIZE_OPTION),
    material: undefined,
    description: product.description
      ? stripTags(product.description).slice(0, 5_000)
      : product.short_description
        ? stripTags(product.short_description).slice(0, 5_000)
        : undefined,
    url: sourceUrl,
    strategies: ["woocommerce-json"],
  };
}

// ── Talking to the store ──────────────────────────────────────────────────────

interface WooQueryResult {
  list: unknown[];
  bytes: number;
  url: string;
}

/**
 * Ask the Store API one question, and work out which base answers it.
 *
 * A WordPress site with no Store API replies to an unknown route with JSON
 * carrying a `code` — that is WordPress saying "not here", and it means the
 * other base is worth one try. Anything that is not JSON at all is not a
 * WordPress REST site, so there is nothing to try twice.
 */
async function wooQuery(
  origin: string,
  route: string,
  params: Record<string, string>,
  settings: ParserFetchSettings,
  apiKey: string,
): Promise<WooQueryResult | null> {
  const host = hostOf(origin);
  if (isNotPlatform(host, "woocommerce")) return null;

  const known = baseByHost.get(host);
  const bases = known ? [known] : BASES;
  const query = new URLSearchParams(params).toString();

  for (const base of bases) {
    const url = `${origin}${base}${route}${query ? `?${query}` : ""}`;
    const { json, bytes } = await getStoreJson(url, settings, apiKey);
    if (Array.isArray(json)) {
      baseByHost.set(host, base);
      return { list: json, bytes, url };
    }
    // A known-good base that answers with an error is not evidence about the
    // platform — only about this question.
    if (known) return null;
    if (isObj(json) && typeof json.code === "string") continue;
    break;
  }

  markNotPlatform(host, "woocommerce");
  return null;
}

/**
 * Try to read a product page as Store API JSON. Returns null when the URL is a
 * listing, the host has already proved not to be WooCommerce, or no product
 * carries that slug — in every one of those cases the caller falls back to
 * fetching the HTML.
 */
export async function fetchWooProduct(
  pageUrl: string,
  settings: ParserFetchSettings,
  apiKey: string,
): Promise<StorefrontProductResult | null> {
  const slug = wooProductSlug(pageUrl);
  if (!slug) return null;
  let origin: string;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return null;
  }

  const answer = await wooQuery(origin, "/products", { slug }, settings, apiKey);
  if (!answer) return null;
  const node = answer.list.find(isWooProduct);
  if (!node) return null;

  // The permalink is the store's own address for the product; the pasted URL
  // may carry tracking parameters or a stale prefix, and the catalogue dedupes
  // on this field.
  const sourceUrl = (node.permalink ?? pageUrl).split("#")[0];
  return {
    platform: "woocommerce",
    raw: rawFromWooProduct(node, sourceUrl),
    sourceUrl,
    jsonUrl: answer.url,
    bytes: answer.bytes,
  };
}

/**
 * Walk a Woo catalogue — or one of its categories — through the Store API and
 * return the product URLs, in catalogue order.
 *
 * A category is addressed by id rather than by slug, so a `/product-category/…`
 * URL costs one extra request to translate. When that translation fails the
 * walk stops instead of falling back to the whole catalogue: the admin pasted
 * one category, and answering with the entire store is not a smaller version of
 * the same answer.
 */
export async function discoverWooProducts(
  startUrl: string,
  settings: ParserFetchSettings,
  apiKey: string,
  opts: { limit: number; maxPages: number; deadline?: number },
): Promise<string[]> {
  let origin: string;
  try {
    origin = new URL(startUrl).origin;
  } catch {
    return [];
  }

  const categorySlug = wooCategorySlug(startUrl);
  let categoryId = "";
  if (categorySlug) {
    const found = await wooQuery(
      origin,
      "/products/categories",
      { slug: categorySlug },
      settings,
      apiKey,
    );
    if (!found) return [];
    const node = found.list.find((c) => isObj(c) && typeof c.id === "number");
    if (!isObj(node)) return [];
    categoryId = String(node.id);
  }

  const urls: string[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= Math.max(1, opts.maxPages); page++) {
    if (opts.deadline && Date.now() > opts.deadline) break;
    const answer = await wooQuery(
      origin,
      "/products",
      {
        per_page: String(PAGE_SIZE),
        page: String(page),
        ...(categoryId ? { category: categoryId } : {}),
      },
      settings,
      apiKey,
    );
    if (!answer || answer.list.length === 0) break;

    for (const item of answer.list) {
      if (!isWooProduct(item)) continue;
      const url = (item.permalink ?? "").split("#")[0];
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
      if (urls.length >= opts.limit) return urls;
    }
    if (answer.list.length < PAGE_SIZE) break;
  }

  return urls;
}

/** Test seam: forget which base a host answered on. */
export function resetWooCache(): void {
  baseByHost.clear();
}
