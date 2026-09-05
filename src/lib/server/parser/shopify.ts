/**
 * Shopify's own JSON, instead of Shopify's HTML.
 *
 * Every Shopify storefront answers three addresses that no theme can turn off:
 *
 *   /products/<handle>.json               → one product, in full
 *   /collections/<handle>/products.json   → a page of a collection
 *   /products.json                        → a page of the whole catalogue
 *
 * They matter for two independent reasons.
 *
 * **They carry more than the page does.** The product JSON lists *every* photo
 * in `images[]`, every variant with its price and compare-at price, and the
 * option sets — colour and size — as data rather than as markup. That is the
 * whole job of `extract.ts` + `gallery.ts` done exactly, with no identity tests
 * and no guessing about which `<img>` belongs to the product.
 *
 * **They are usually not defended.** Anti-bot sits in front of pages, because
 * pages are what a scraper is expected to want; the JSON endpoints are part of
 * the storefront API and routinely answer 200 on a host whose HTML answers 403.
 * That is what makes this the cheapest fix for a blocked crawl — no proxy, no
 * headless browser, no provider bill.
 *
 * The store has to actually be Shopify, and the only honest test is to ask: a
 * URL shaped like `/products/<handle>` on a non-Shopify store returns 404 or a
 * page. So a store that answers with something that is not a Shopify product is
 * remembered as "not Shopify" for the run, and the caller falls back to HTML.
 */
import { fetchHtml } from "./fetch";
import { stripTags } from "./extract";
import type { ParserFetchSettings, RawExtract } from "./types";

/** Shopify's own cap on `products.json`. */
const PAGE_SIZE = 250;

/** A handle is one path segment of a slug. */
const HANDLE = /^[a-z0-9][a-z0-9\-_.%]*$/i;

interface ShopifyImage {
  src?: string;
  position?: number;
}

interface ShopifyVariant {
  price?: string | number;
  compare_at_price?: string | number | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  available?: boolean;
}

interface ShopifyOption {
  name?: string;
  values?: string[];
}

export interface ShopifyProduct {
  title?: string;
  handle?: string;
  vendor?: string;
  body_html?: string;
  product_type?: string;
  images?: ShopifyImage[];
  variants?: ShopifyVariant[];
  options?: ShopifyOption[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Is this a Shopify product node rather than some other JSON that happened to
 * come back? A handle plus either photos or variants is unmistakable, and no
 * other endpoint we might hit by accident answers in that shape.
 */
export function isShopifyProduct(v: unknown): v is ShopifyProduct {
  if (!isObj(v)) return false;
  if (typeof v.handle !== "string" || !v.handle) return false;
  return Array.isArray(v.images) || Array.isArray(v.variants);
}

/**
 * The `.json` twin of a product URL, or null when the URL is not shaped like a
 * Shopify product address. Locale prefixes (`/en-gb/products/…`) are kept —
 * Shopify serves the JSON under them too.
 */
export function productJsonUrl(pageUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(pageUrl);
  } catch {
    return null;
  }
  const segments = u.pathname.split("/").filter(Boolean);
  const at = segments.lastIndexOf("products");
  if (at === -1 || at === segments.length - 1) return null;
  const handle = segments[at + 1].replace(/\.json$/i, "");
  if (!HANDLE.test(handle)) return null;
  return `${u.origin}/${[...segments.slice(0, at + 1), `${handle}.json`].join("/")}`;
}

/**
 * The paged `products.json` for whatever the pasted URL points at: a collection,
 * or the store itself. Returns null only when the URL will not parse.
 */
export function listingJsonUrl(pageUrl: string, page: number): string | null {
  let u: URL;
  try {
    u = new URL(pageUrl);
  } catch {
    return null;
  }
  const segments = u.pathname.split("/").filter(Boolean);
  const at = segments.indexOf("collections");
  const base =
    at >= 0 && segments[at + 1] && HANDLE.test(segments[at + 1])
      ? segments.slice(0, at + 2)
      : // Not a collection: keep a locale prefix if there is one, drop the rest.
        segments.slice(0, segments.length && /^[a-z]{2}([-_][a-z]{2})?$/i.test(segments[0]) ? 1 : 0);
  const path = base.length ? `/${base.join("/")}` : "";
  return `${u.origin}${path}/products.json?limit=${PAGE_SIZE}&page=${Math.max(1, page)}`;
}

/** The storefront address of a product, given the URL its JSON was found under. */
export function productPageUrl(jsonUrl: string, handle: string): string {
  try {
    const u = new URL(jsonUrl);
    const segments = u.pathname.split("/").filter(Boolean);
    // /en-gb/collections/new/products.json → /en-gb/products/<handle>
    const locale = segments.length && /^[a-z]{2}([-_][a-z]{2})?$/i.test(segments[0]) ? `/${segments[0]}` : "";
    return `${u.origin}${locale}/products/${handle}`;
  } catch {
    return "";
  }
}

/** Lowest variant price, and the highest compare-at above it. */
function priceRange(variants: ShopifyVariant[]): { price?: string; priceOriginal?: string } {
  let min = Infinity;
  let was = 0;
  for (const v of variants) {
    const p = Number(v.price);
    if (Number.isFinite(p) && p > 0) min = Math.min(min, p);
    const c = Number(v.compare_at_price);
    if (Number.isFinite(c) && c > 0) was = Math.max(was, c);
  }
  const price = min === Infinity ? undefined : String(min);
  return { price, priceOriginal: was > (min === Infinity ? 0 : min) ? String(was) : undefined };
}

const SIZE_OPTION = /^(?:size|sizes|talla|taille|größe|grosse|taglia|розмір|размер)$/i;
const COLOR_OPTION = /^(?:colou?r|couleur|farbe|colore|color\s*way|колір|цвет)$/i;

function optionValues(options: ShopifyOption[], match: RegExp): string[] {
  for (const o of options) {
    if (typeof o?.name === "string" && match.test(o.name.trim())) {
      return (o.values ?? []).map((v) => String(v).trim()).filter(Boolean);
    }
  }
  return [];
}

/**
 * Turn one Shopify product node into the same RawExtract the HTML path
 * produces, so everything downstream — normalisation, colour, import — is
 * shared and cannot drift.
 */
export function rawFromShopifyProduct(
  product: ShopifyProduct,
  sourceUrl: string,
  currency?: string,
): RawExtract {
  const images = [...(product.images ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((i) => (typeof i?.src === "string" ? i.src.trim() : ""))
    .filter(Boolean);

  const { price, priceOriginal } = priceRange(product.variants ?? []);
  const options = product.options ?? [];

  return {
    name: product.title?.trim() || undefined,
    brand: product.vendor?.trim() || undefined,
    price,
    priceOriginal,
    currency,
    image: images[0],
    images,
    // Shopify splits colourways into separate products far more often than it
    // puts them on one, so the first value is this product's colour rather than
    // a list to choose from. When there is no colour option the field stays
    // empty and the normalizer reads the title, exactly as on any other store.
    color: optionValues(options, COLOR_OPTION)[0],
    sizes: optionValues(options, SIZE_OPTION),
    material: undefined,
    description: product.body_html ? stripTags(product.body_html).slice(0, 5_000) : undefined,
    url: sourceUrl,
    strategies: ["shopify-json"],
  };
}

// ── Talking to the store ──────────────────────────────────────────────────────

/**
 * Hosts already known not to be Shopify, so one 404 is not paid for twice in a
 * crawl of a hundred URLs from the same store. Per process, which for a
 * serverless function means per warm instance — the right lifetime for a guess
 * this cheap to re-make.
 */
const notShopify = new Set<string>();
const currencyByHost = new Map<string, string>();

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/** GET a URL through the configured fetch layer and parse it as JSON. */
async function getJson(
  url: string,
  settings: ParserFetchSettings,
  apiKey: string,
): Promise<{ json: unknown; status: number; bytes: number }> {
  const res = await fetchHtml(url, probeSettings(settings), apiKey);
  const bytes = res.html?.length ?? 0;
  if (!res.ok || !res.html) return { json: null, status: res.status, bytes };
  const body = res.html.trimStart();
  // A theme's 404 page is HTML; only spend a parse on something JSON-shaped.
  if (!body.startsWith("{") && !body.startsWith("[")) return { json: null, status: res.status, bytes };
  try {
    return { json: JSON.parse(body), status: res.status, bytes };
  } catch {
    return { json: null, status: res.status, bytes };
  }
}

/**
 * A guess costs a request, so cap what a wrong guess can cost in time. On a
 * store that is not Shopify these probes 404 immediately; the ones that hang
 * are the ones that were never going to answer, and the crawl behind us still
 * has its own budget to spend on the HTML that does work.
 */
const PROBE_TIMEOUT_MS = 8_000;

function probeSettings(settings: ParserFetchSettings): ParserFetchSettings {
  return settings.timeoutMs <= PROBE_TIMEOUT_MS
    ? settings
    : { ...settings, timeoutMs: PROBE_TIMEOUT_MS };
}

/**
 * The store's currency, from `/meta.json`. Best-effort by design: the product
 * JSON gives prices as bare numbers, and guessing USD for a European store
 * would put a wrong number on a price tag. When the endpoint is not there the
 * field stays undefined and the normalizer's own fallback decides.
 */
async function storeCurrency(
  origin: string,
  settings: ParserFetchSettings,
  apiKey: string,
): Promise<string | undefined> {
  const host = hostOf(origin);
  if (!host) return undefined;
  const cached = currencyByHost.get(host);
  if (cached !== undefined) return cached || undefined;

  const { json } = await getJson(`${origin}/meta.json`, settings, apiKey);
  const value = isObj(json) && typeof json.currency === "string" ? json.currency.trim().toUpperCase() : "";
  currencyByHost.set(host, /^[A-Z]{3}$/.test(value) ? value : "");
  return /^[A-Z]{3}$/.test(value) ? value : undefined;
}

export interface ShopifyProductResult {
  raw: RawExtract;
  /** The address the product is sold at — what the catalogue dedupes on. */
  sourceUrl: string;
  jsonUrl: string;
  /** Size of the JSON we read, for the admin screen's diagnostics. */
  bytes: number;
}

/**
 * Try to read a product page as Shopify JSON. Returns null when the URL is not
 * product-shaped, the host has already proved not to be Shopify, or the answer
 * is anything other than a Shopify product — in every one of those cases the
 * caller falls back to fetching the HTML.
 */
export async function fetchShopifyProduct(
  pageUrl: string,
  settings: ParserFetchSettings,
  apiKey: string,
): Promise<ShopifyProductResult | null> {
  const jsonUrl = productJsonUrl(pageUrl);
  if (!jsonUrl) return null;
  const host = hostOf(pageUrl);
  if (host && notShopify.has(host)) return null;

  const { json, bytes } = await getJson(jsonUrl, settings, apiKey);
  const node = isObj(json) && isObj(json.product) ? json.product : json;
  if (!isShopifyProduct(node)) {
    if (host) notShopify.add(host);
    return null;
  }

  const origin = new URL(jsonUrl).origin;
  const currency = await storeCurrency(origin, settings, apiKey);
  // The page URL the admin pasted is the one the catalogue should link to and
  // dedupe on — the `.json` twin is an implementation detail of the fetch.
  const sourceUrl = pageUrl.split("#")[0];
  return { raw: rawFromShopifyProduct(node, sourceUrl, currency), sourceUrl, jsonUrl, bytes };
}

/**
 * Walk a collection (or a whole store) through `products.json` and return the
 * product URLs, in catalogue order.
 *
 * This replaces reading anchors out of a listing page, which is the step that
 * fails twice over on a defended store: the page may not arrive at all, and
 * when it does, an infinite-scroll grid holds the products in a script rather
 * than in `<a href>`.
 */
export async function discoverShopifyProducts(
  startUrl: string,
  settings: ParserFetchSettings,
  apiKey: string,
  opts: { limit: number; maxPages: number; deadline?: number },
): Promise<string[]> {
  const host = hostOf(startUrl);
  if (host && notShopify.has(host)) return [];

  const urls: string[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= Math.max(1, opts.maxPages); page++) {
    if (opts.deadline && Date.now() > opts.deadline) break;
    const jsonUrl = listingJsonUrl(startUrl, page);
    if (!jsonUrl) break;

    const { json } = await getJson(jsonUrl, settings, apiKey);
    const list = isObj(json) && Array.isArray(json.products) ? json.products : null;
    if (!list) {
      // The first page deciding it is not Shopify is worth remembering; a later
      // page failing just ends the walk (the store may cap `page`).
      if (page === 1 && host) notShopify.add(host);
      break;
    }
    if (list.length === 0) break;

    for (const item of list) {
      if (!isShopifyProduct(item)) continue;
      const url = productPageUrl(jsonUrl, item.handle!);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
      if (urls.length >= opts.limit) return urls;
    }
    if (list.length < PAGE_SIZE) break;
  }

  return urls;
}

/** Test seam: forget what we learned about a host. */
export function resetShopifyCache(): void {
  notShopify.clear();
  currencyByHost.clear();
}
