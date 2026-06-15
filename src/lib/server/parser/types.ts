/**
 * Types for the universal product-page parser.
 *
 * The parser turns a single product URL (Farfetch, SSENSE, Mr Porter, a brand
 * store, …) into a normalised product the admin can preview and import. It is
 * intentionally site-agnostic: the generic extractor reads JSON-LD / OpenGraph /
 * microdata, and per-site "recipes" only add overrides where a site is unusual.
 */
import type { Category, Gender } from "@/lib/types";

/**
 * How HTML is fetched. Most luxury sites sit behind anti-bot (Cloudflare,
 * Akamai, DataDome). `direct` works for soft targets; the provider modes route
 * the request through a scraping service that does TLS/JA3 impersonation
 * (curl_cffi-style) and/or a headless browser. `custom` lets the admin point at
 * their own curl_cffi / playwright / cloakbrowser microservice.
 */
export type FetchProvider =
  | "direct"
  | "scrapingbee"
  | "scraperapi"
  | "zenrows"
  | "custom";

export interface ParserFetchSettings {
  provider: FetchProvider;
  /**
   * For `custom`: a URL template. `{url}` is replaced with the URL-encoded
   * target and `{key}` with the API key. Example:
   *   https://my-curl-cffi.fly.dev/fetch?token={key}&url={url}&impersonate=chrome
   */
  endpoint: string;
  /** Ask the provider to render JS in a headless browser (slower, costs more). */
  renderJs: boolean;
  /** Browser fingerprint to impersonate — sent as User-Agent and to providers. */
  impersonate: string;
  /** Per-request timeout in milliseconds. */
  timeoutMs: number;
}

/** A single field-extraction override applied to the raw HTML. */
export interface FieldRule {
  /**
   * A JS regex (without flags) whose FIRST capture group is the value.
   * Applied to the raw HTML. Use for the rare field generic extraction misses.
   */
  regex?: string;
}

export type ParserRuleField =
  | "name"
  | "brand"
  | "price"
  | "currency"
  | "image"
  | "sizes"
  | "color"
  | "material"
  | "description";

/** A per-site recipe: matched by hostname, applies overrides on top of generics. */
export interface ParserSiteConfig {
  id: string;
  name: string;
  /** Bare hostname, e.g. "farfetch.com". Matched via hostname endsWith. */
  domain: string;
  enabled: boolean;
  /** Force a brand for every product from this site (e.g. a single-brand store). */
  brandOverride?: string;
  /** Force a category when the site's data is unreliable. */
  categoryOverride?: Category;
  /** Force a gender (e.g. a womenswear-only retailer). */
  genderOverride?: Gender;
  /** Per-field regex overrides, applied with highest precedence. */
  rules?: Partial<Record<ParserRuleField, FieldRule>>;
  /** Optional per-site fetch override (e.g. this site needs JS rendering). */
  fetch?: Partial<ParserFetchSettings>;
  notes?: string;
}

/** Raw string fields pulled out of a page before normalisation. */
export interface RawExtract {
  name?: string;
  brand?: string;
  price?: string;
  priceOriginal?: string;
  currency?: string;
  image?: string;
  images: string[];
  sizes: string[];
  color?: string;
  material?: string;
  description?: string;
  /** Which strategies contributed at least one field (diagnostics). */
  strategies: string[];
}

/** A fully normalised product ready for preview / import. */
export interface ParsedProduct {
  name: string;
  brand: string;
  category: Category;
  gender?: Gender;
  description: string;
  imageUrl: string;
  images: string[];
  colors: string[];
  sizes: string[];
  material: string;
  price: number;
  priceOriginal: number;
  currency: string;
  sourceUrl: string;
  /** Diagnostics for the admin UI. */
  strategies: string[];
  issues: string[];
  valid: boolean;
}

export const DEFAULT_FETCH_SETTINGS: ParserFetchSettings = {
  provider: "direct",
  endpoint: "",
  renderJs: false,
  impersonate: "chrome",
  timeoutMs: 20_000,
};
