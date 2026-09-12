/**
 * "Ask the store for data, not for a page" — across every platform that can
 * answer that way.
 *
 * Three do, each in its own module: Shopify (`shopify.ts`), WooCommerce
 * (`woocommerce.ts`) and Squarespace (`squarespace.ts`). This is the one door
 * the pipeline knocks on, so `parse-page.ts` and `crawl.ts` never learn which
 * platform answered — they get a product, or a list of product URLs, or
 * nothing, and fall back to HTML in the last case exactly as before.
 *
 * Why it is worth probing three addresses before fetching one page:
 *
 *   - **It is free.** No proxy, no headless browser, no scraping provider. The
 *     store publishes these endpoints for its own front end.
 *   - **It usually works where the page does not.** Bot management sits in
 *     front of pages, because pages are what a scraper is expected to want.
 *   - **It carries more.** Every photo, every variant, colour and size as data
 *     — and no model call, which is the one part of the HTML path that costs
 *     money on stores with no structured data.
 *
 * A wrong guess costs one request per platform per host, and the answer is
 * remembered for the rest of the run (`store-json.ts`), so the cost is paid
 * once rather than once per product. The order the three are tried in is nudged
 * by whatever the URL itself gives away, so the common case pays nothing.
 */
import { discoverShopifyProducts, fetchShopifyProduct, productJsonUrl, resetShopifyCache } from "./shopify";
import { discoverSquarespaceProducts, fetchSquarespaceProduct } from "./squarespace";
import { discoverWooProducts, fetchWooProduct, resetWooCache } from "./woocommerce";
import { resetStoreJsonCache, type StorefrontPlatform, type StorefrontProductResult } from "./store-json";
import type { ParserFetchSettings } from "./types";

export type { StorefrontProductResult } from "./store-json";

/**
 * How long the probes may spend in total before the caller gets on with the
 * HTML it was always able to fetch. Each probe is already capped at
 * `PROBE_TIMEOUT_MS`, so this bounds the chain rather than any one request: the
 * route these run inside has 60 seconds for fetching, extraction and an AI
 * call, and two dead ends must not eat it.
 */
const PROBE_BUDGET_MS = 12_000;

const DEFAULT_ORDER: StorefrontPlatform[] = ["shopify", "woocommerce", "squarespace"];

/**
 * Stores address things in ways that give the platform away — Shopify's
 * `/collections/…/products/…`, Woo's `/product-category/…`, the `/wp-…` paths
 * WordPress serves its own assets from. Where the URL says something, the
 * platform it points at is tried first; where it says nothing, the order is the
 * install-base order and the negative memory makes the difference invisible
 * after the first URL.
 */
export function platformOrder(url: string): StorefrontPlatform[] {
  let path = "";
  try {
    const u = new URL(url);
    path = `${u.pathname}${u.search}`.toLowerCase();
  } catch {
    return DEFAULT_ORDER;
  }

  const first: StorefrontPlatform | null = /\/collections\/|\/products\/|\/products\.json/.test(path)
    ? "shopify"
    : /\/product-category\/|\/product-tag\/|\/product\/|\/wp-json\/|\/wp-content\/|[?&]product_cat=/.test(path)
      ? "woocommerce"
      : null;

  return first ? [first, ...DEFAULT_ORDER.filter((p) => p !== first)] : DEFAULT_ORDER;
}

/**
 * One product, read from whichever storefront API answers for this URL. Null
 * means "no platform claimed it" — the caller fetches the page.
 */
export async function fetchStorefrontProduct(
  pageUrl: string,
  settings: ParserFetchSettings,
  apiKey: string,
): Promise<StorefrontProductResult | null> {
  const deadline = Date.now() + PROBE_BUDGET_MS;

  for (const platform of platformOrder(pageUrl)) {
    if (Date.now() > deadline) break;
    const found =
      platform === "shopify"
        ? await fetchShopifyProduct(pageUrl, settings, apiKey)
        : platform === "woocommerce"
          ? await fetchWooProduct(pageUrl, settings, apiKey)
          : await fetchSquarespaceProduct(pageUrl, settings, apiKey);
    if (found) return found;
  }
  return null;
}

export interface StorefrontDiscovery {
  platform: StorefrontPlatform;
  urls: string[];
  /** The pasted URL addressed one product rather than a listing. */
  isSingleProduct: boolean;
}

export interface StorefrontDiscoverOptions {
  limit: number;
  maxPages: number;
  deadline?: number;
  /**
   * The pasted URL looks like a product page.
   *
   * This is the guard that keeps a catalogue-wide answer away from someone who
   * pasted one sneaker: a refused product page must not come back as sixty
   * unrelated products. Squarespace never needs it — its payload says which the
   * URL was — but Shopify and Woo decide from the URL, so they honour it.
   */
  startIsProduct: boolean;
}

/**
 * Product URLs for a pasted listing, from whichever storefront API answers.
 * Null means no platform claimed the URL and the caller should walk the HTML.
 */
export async function discoverStorefront(
  startUrl: string,
  settings: ParserFetchSettings,
  apiKey: string,
  opts: StorefrontDiscoverOptions,
): Promise<StorefrontDiscovery | null> {
  const budget = Date.now() + PROBE_BUDGET_MS;
  const spent = () => Date.now() > budget || (opts.deadline !== undefined && Date.now() > opts.deadline);

  for (const platform of platformOrder(startUrl)) {
    if (spent()) break;

    if (platform === "shopify") {
      // Shopify's two addresses are told apart by the URL, which is all it can
      // do: `/products/<handle>.json` answers one product and `/products.json`
      // the whole store.
      if (productJsonUrl(startUrl)) {
        const single = await fetchShopifyProduct(startUrl, settings, apiKey);
        if (single) return { platform, urls: [single.sourceUrl], isSingleProduct: true };
      } else if (!opts.startIsProduct) {
        const urls = await discoverShopifyProducts(startUrl, settings, apiKey, opts);
        if (urls.length) return { platform, urls, isSingleProduct: false };
      }
      continue;
    }

    if (platform === "woocommerce") {
      if (opts.startIsProduct) {
        const single = await fetchWooProduct(startUrl, settings, apiKey);
        if (single) return { platform, urls: [single.sourceUrl], isSingleProduct: true };
        continue;
      }
      const urls = await discoverWooProducts(startUrl, settings, apiKey, opts);
      if (urls.length) return { platform, urls, isSingleProduct: false };
      continue;
    }

    const found = await discoverSquarespaceProducts(startUrl, settings, apiKey, opts);
    if (found?.urls.length) {
      return { platform, urls: found.urls, isSingleProduct: found.isSingleProduct };
    }
  }

  return null;
}

/** Test seam: forget every platform guess and every remembered endpoint. */
export function resetStorefrontCache(): void {
  resetShopifyCache();
  resetWooCache();
  resetStoreJsonCache();
}
