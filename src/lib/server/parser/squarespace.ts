/**
 * Squarespace's own JSON, instead of Squarespace's HTML.
 *
 * Every Squarespace page answers its own address with `?format=json` — the
 * payload the site's own front end is built from. No key, no separate API host,
 * and nothing the template can switch off:
 *
 *   /shop/<slug>?format=json   → `item`  — one product, in full
 *   /shop?format=json          → `items` — a page of the store
 *
 * Which of the two comes back is the store telling us what the URL was, which
 * is worth more than it sounds: on every other platform we have to decide
 * "product or listing?" from the shape of the URL before asking anything, and
 * Squarespace's own prefixes (`/shop/`, `/store/`, or whatever the owner typed)
 * carry no marker to decide it by. Here the answer decides, so a pasted product
 * never returns a catalogue and a pasted category never returns one product.
 *
 * The payload also carries the whole gallery in `items[]` and every variant
 * with its price, sale price and named attributes — a Squarespace product page
 * read as markup gives up one photo and a guess.
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

interface SquarespaceMoney {
  value?: string;
  currency?: string;
}

interface SquarespaceVariant {
  price?: number;
  salePrice?: number;
  onSale?: boolean;
  priceMoney?: SquarespaceMoney;
  salePriceMoney?: SquarespaceMoney;
  attributes?: Record<string, string>;
}

interface SquarespaceStructuredContent {
  productType?: number;
  variants?: SquarespaceVariant[];
}

export interface SquarespaceItem {
  title?: string;
  fullUrl?: string;
  assetUrl?: string;
  excerpt?: string;
  body?: string;
  items?: { assetUrl?: string }[];
  structuredContent?: SquarespaceStructuredContent;
}

/**
 * Is this a Squarespace page payload at all? `collection` or `website` plus one
 * of `item`/`items` is the shape every one of them has, and no JSON we might hit
 * by accident — an API, a config file — carries that pair.
 */
export function isSquarespacePayload(v: unknown): v is Record<string, unknown> {
  if (!isObj(v)) return false;
  if (!isObj(v.collection) && !isObj(v.website)) return false;
  return isObj(v.item) || Array.isArray(v.items);
}

/**
 * Is this item a product rather than a blog post or a gallery image? Commerce
 * items are the ones carrying `structuredContent` with variants or a product
 * type; everything else on a Squarespace site has neither.
 */
export function isSquarespaceProduct(v: unknown): v is SquarespaceItem {
  if (!isObj(v)) return false;
  if (typeof v.title !== "string" || !v.title.trim()) return false;
  const sc = v.structuredContent;
  if (!isObj(sc)) return false;
  return Array.isArray(sc.variants) || typeof sc.productType === "number";
}

/** The same page, asked for as data. */
export function formatJsonUrl(pageUrl: string): string | null {
  try {
    const u = new URL(pageUrl);
    u.hash = "";
    u.searchParams.set("format", "json");
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * A variant's money, preferring the decimal Squarespace states outright.
 *
 * `priceMoney.value` is a plain decimal string and is what current payloads
 * carry. The bare `price` field beside it is in minor units, which is only
 * readable as a fallback — and a fallback worth taking, because a product with
 * no price is not importable at all.
 */
function variantMoney(
  money: SquarespaceMoney | undefined,
  minor: number | undefined,
): { amount: number; currency?: string } | null {
  const value = typeof money?.value === "string" ? money.value.trim() : "";
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    const amount = Number(value);
    if (amount > 0) {
      return {
        amount,
        currency:
          typeof money?.currency === "string" && /^[A-Za-z]{3}$/.test(money.currency)
            ? money.currency.toUpperCase()
            : undefined,
      };
    }
  }
  if (typeof minor === "number" && Number.isFinite(minor) && minor > 0) {
    return { amount: minor / 100 };
  }
  return null;
}

function attributeValues(variants: SquarespaceVariant[], match: RegExp): string[] {
  const values: string[] = [];
  for (const v of variants) {
    const attrs = isObj(v?.attributes) ? v.attributes : null;
    if (!attrs) continue;
    for (const [key, value] of Object.entries(attrs)) {
      if (!match.test(String(key).trim())) continue;
      const text = String(value ?? "").trim();
      if (text && !values.includes(text)) values.push(text);
    }
  }
  return values;
}

/** The absolute address a Squarespace item is sold at. */
export function itemUrl(item: SquarespaceItem, origin: string): string {
  const path = typeof item.fullUrl === "string" ? item.fullUrl : "";
  if (!path) return "";
  try {
    return new URL(path, origin).toString();
  } catch {
    return "";
  }
}

/**
 * Turn one Squarespace item into the same RawExtract the HTML path produces, so
 * everything downstream — normalisation, colour, import — is shared and cannot
 * drift.
 */
export function rawFromSquarespaceItem(item: SquarespaceItem, sourceUrl: string): RawExtract {
  const images: string[] = [];
  const push = (url: unknown) => {
    const src = typeof url === "string" ? url.trim() : "";
    if (src && !images.includes(src)) images.push(src);
  };
  // The item's own asset is the primary photo; `items[]` is the gallery behind
  // it, in the order the shop arranged it.
  push(item.assetUrl);
  for (const media of item.items ?? []) push(media?.assetUrl);

  const variants = item.structuredContent?.variants ?? [];
  let price = Infinity;
  let was = 0;
  let currency: string | undefined;
  for (const v of variants) {
    const list = variantMoney(v?.priceMoney, v?.price);
    const sale = v?.onSale ? variantMoney(v?.salePriceMoney, v?.salePrice) : null;
    const effective = sale ?? list;
    if (effective) price = Math.min(price, effective.amount);
    if (list) was = Math.max(was, list.amount);
    currency = currency ?? effective?.currency ?? list?.currency;
  }

  const body = item.body ?? item.excerpt;

  return {
    name: item.title?.trim() || undefined,
    // Squarespace has no brand field: a single-brand store is the norm there,
    // and the normalizer's own inference is a better guess than a wrong one.
    brand: undefined,
    price: price === Infinity ? undefined : price.toFixed(2),
    priceOriginal: was > (price === Infinity ? 0 : price) ? was.toFixed(2) : undefined,
    currency,
    image: images[0],
    images,
    color: attributeValues(variants, COLOR_OPTION)[0],
    sizes: attributeValues(variants, SIZE_OPTION),
    material: undefined,
    description: body ? stripTags(body).slice(0, 5_000) : undefined,
    url: sourceUrl,
    strategies: ["squarespace-json"],
  };
}

// ── Talking to the store ──────────────────────────────────────────────────────

interface Payload {
  json: Record<string, unknown>;
  bytes: number;
  url: string;
}

/** Ask a Squarespace page for itself as data, or learn that it is not one. */
async function payload(
  pageUrl: string,
  settings: ParserFetchSettings,
  apiKey: string,
): Promise<Payload | null> {
  const host = hostOf(pageUrl);
  if (isNotPlatform(host, "squarespace")) return null;
  const url = formatJsonUrl(pageUrl);
  if (!url) return null;

  const { json, bytes } = await getStoreJson(url, settings, apiKey);
  if (!isSquarespacePayload(json)) {
    // A non-Squarespace site ignores the parameter and answers with its page,
    // so this says nothing about the URL and everything about the host.
    markNotPlatform(host, "squarespace");
    return null;
  }
  return { json, bytes, url };
}

/**
 * Try to read a page as Squarespace JSON. Returns null when the host is not
 * Squarespace, or when the page is a listing rather than one product — the
 * payload's own shape decides which.
 */
export async function fetchSquarespaceProduct(
  pageUrl: string,
  settings: ParserFetchSettings,
  apiKey: string,
): Promise<StorefrontProductResult | null> {
  const answer = await payload(pageUrl, settings, apiKey);
  if (!answer) return null;
  const item = answer.json.item;
  if (!isSquarespaceProduct(item)) return null;

  let origin = "";
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return null;
  }
  const sourceUrl = itemUrl(item, origin) || pageUrl.split("#")[0];
  return {
    platform: "squarespace",
    raw: rawFromSquarespaceItem(item, sourceUrl),
    sourceUrl,
    jsonUrl: answer.url,
    bytes: answer.bytes,
  };
}

export interface SquarespaceDiscovery {
  urls: string[];
  /** The pasted URL turned out to address one product, not a store page. */
  isSingleProduct: boolean;
}

/**
 * Walk a Squarespace store page and return the product URLs, following the
 * payload's own `pagination.nextPageUrl` rather than guessing a page parameter.
 *
 * Returns null when the host is not Squarespace. When the pasted URL turns out
 * to be a product page, that one product is the answer — the store said so, and
 * returning its whole catalogue instead would be a worse answer than none.
 */
export async function discoverSquarespaceProducts(
  startUrl: string,
  settings: ParserFetchSettings,
  apiKey: string,
  opts: { limit: number; maxPages: number; deadline?: number },
): Promise<SquarespaceDiscovery | null> {
  let origin = "";
  try {
    origin = new URL(startUrl).origin;
  } catch {
    return null;
  }

  const urls: string[] = [];
  const seen = new Set<string>();
  const visited = new Set<string>();
  let next: string | null = startUrl;

  for (let page = 1; page <= Math.max(1, opts.maxPages) && next; page++) {
    if (opts.deadline && Date.now() > opts.deadline) break;
    visited.add(next);
    const answer = await payload(next, settings, apiKey);
    if (!answer) return page === 1 ? null : { urls, isSingleProduct: false };

    if (page === 1 && isSquarespaceProduct(answer.json.item)) {
      const url = itemUrl(answer.json.item as SquarespaceItem, origin) || startUrl.split("#")[0];
      return { urls: [url], isSingleProduct: true };
    }

    const items = Array.isArray(answer.json.items) ? answer.json.items : [];
    for (const item of items) {
      if (!isSquarespaceProduct(item)) continue;
      const url = itemUrl(item, origin);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
      if (urls.length >= opts.limit) return { urls, isSingleProduct: false };
    }

    const pagination = isObj(answer.json.pagination) ? answer.json.pagination : null;
    const nextPath = typeof pagination?.nextPageUrl === "string" ? pagination.nextPageUrl : "";
    next = nextPath ? itemUrl({ fullUrl: nextPath }, origin) || null : null;
    // A store page that offers itself as its own next page would otherwise
    // spend the whole page budget standing still.
    if (next && visited.has(next)) next = null;
  }

  return { urls, isSingleProduct: false };
}
