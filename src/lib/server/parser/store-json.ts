/**
 * The shared half of "ask the store for data, not for a page".
 *
 * Three platforms answer a public JSON address no theme can turn off, and each
 * has its own module: Shopify (`shopify.ts`), WooCommerce (`woocommerce.ts`)
 * and Squarespace (`squarespace.ts`). What they have in common lives here — the
 * probe, its timeout, the option-name vocabulary, and the memory of which hosts
 * have already proved they are *not* a given platform.
 *
 * That memory is what makes guessing affordable. Asking a store "are you
 * WooCommerce?" costs a request, and the answer is the same for every URL on
 * that host, so a wrong guess is paid for once per run rather than once per
 * product. Without it, a hundred-product collect on a Squarespace store would
 * spend a hundred pointless requests looking for Shopify.
 */
import { fetchHtml } from "./fetch";
import type { ParserFetchSettings, RawExtract } from "./types";

export type StorefrontPlatform = "shopify" | "woocommerce" | "squarespace";

/** One product, read out of a storefront's own JSON rather than its markup. */
export interface StorefrontProductResult {
  platform: StorefrontPlatform;
  raw: RawExtract;
  /** The address the product is sold at — what the catalogue dedupes on. */
  sourceUrl: string;
  /** The JSON address it was actually read from, for the admin's diagnostics. */
  jsonUrl: string;
  /** Size of the JSON we read, for the admin's diagnostics. */
  bytes: number;
}

export function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/**
 * Option and attribute names that mean colour or size, in the languages a
 * European storefront actually ships them in. All three platforms hand these
 * over as named option sets, so the vocabulary is shared rather than copied.
 */
export const SIZE_OPTION = /^(?:size|sizes|talla|taille|größe|grosse|taglia|розмір|размер)$/i;
export const COLOR_OPTION = /^(?:colou?r|couleur|farbe|colore|color\s*way|колір|цвет)$/i;

/**
 * A guess costs a request, so cap what a wrong guess can cost in time. On a
 * store that is not the platform being probed these addresses 404 immediately;
 * the ones that hang are the ones that were never going to answer, and the
 * crawl behind us still has its own budget to spend on the HTML that does work.
 */
export const PROBE_TIMEOUT_MS = 8_000;

export function probeSettings(settings: ParserFetchSettings): ParserFetchSettings {
  return settings.timeoutMs <= PROBE_TIMEOUT_MS
    ? settings
    : { ...settings, timeoutMs: PROBE_TIMEOUT_MS };
}

export interface StoreJsonResult {
  json: unknown;
  status: number;
  bytes: number;
}

/**
 * GET a URL through the configured fetch layer and parse it as JSON.
 *
 * The body is read whatever the status says, because a refusal can be the
 * answer: WordPress reports an unknown REST route as a 404 carrying
 * `{"code":"rest_no_route"}`, and that is precisely how `woocommerce.ts` tells
 * "this site has no Store API here" from "this site is not WordPress at all".
 * Nothing is lost by parsing it — an anti-bot interstitial is HTML and fails
 * the shape test below like any other page.
 */
export async function getStoreJson(
  url: string,
  settings: ParserFetchSettings,
  apiKey: string,
): Promise<StoreJsonResult> {
  const res = await fetchHtml(url, probeSettings(settings), apiKey);
  const bytes = res.html?.length ?? 0;
  if (!res.html) return { json: null, status: res.status, bytes };
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
 * Hosts already known not to be a given platform. Per process, which for a
 * serverless function means per warm instance — the right lifetime for a guess
 * this cheap to re-make.
 */
const notPlatform = new Set<string>();

export function markNotPlatform(host: string, platform: StorefrontPlatform): void {
  if (host) notPlatform.add(`${platform}:${host}`);
}

export function isNotPlatform(host: string, platform: StorefrontPlatform): boolean {
  return !!host && notPlatform.has(`${platform}:${host}`);
}

/** Test seam: forget what we learned about every host. */
export function resetStoreJsonCache(): void {
  notPlatform.clear();
}
