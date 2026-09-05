/**
 * Fetch one URL and turn it into products — the single pipeline behind both the
 * "Parse URL" screen and the bulk crawler, so the two can never drift apart.
 *
 *   URL → fetch (pluggable anti-bot) → deterministic extract → AI fallback →
 *   normalise → ParsedProduct[]
 *
 * A page resolves into one of three shapes:
 *   - a single product (the common case: a PDP),
 *   - a listing whose cards carry full data (JSON-LD ItemList) — many products,
 *   - a listing that only carries links — `links` is filled so the caller can
 *     walk them.
 */
import { fetchHtml } from "./fetch";
import { extractProduct, partitionProducts, extractProductLinks } from "./extract";
import { normalizeExtract } from "./normalize";
import { fetchShopifyProduct } from "./shopify";
import { aiExtract, mergeAiIntoRaw, shouldUseAi } from "./ai-extract";
import { matchSiteConfig, effectiveFetchSettings } from "./configs";
import type {
  ParsedProduct,
  ParserAiSettings,
  ParserFetchSettings,
  ParserSiteConfig,
} from "./types";

export interface ParsePageDiagnostics {
  provider: string;
  status: number;
  htmlLength: number;
  finalUrl: string;
  matchedConfig: { id: string; name: string; domain: string } | null;
  strategies?: string[];
  /** Fields the AI pass contributed, if it ran. */
  aiFields?: string[];
  /** Why AI did not run / failed, when relevant. */
  aiError?: string;
}

export interface ParsePageResult {
  ok: boolean;
  products: ParsedProduct[];
  links: string[];
  isListing: boolean;
  error?: string;
  hint?: string;
  diagnostics: ParsePageDiagnostics;
}

export interface ParsePageOptions {
  fetchSettings: ParserFetchSettings;
  fetchApiKey: string;
  siteConfigs: ParserSiteConfig[];
  aiSettings: ParserAiSettings;
  /** Override the AI decision for this call (admin ticked/unticked the box). */
  useAi?: boolean;
}

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return "";
  }
}

/** Actionable guidance when the upstream blocks us. */
export function blockHint(status: number, provider: string): string | undefined {
  if (status === 403 || status === 401 || status === 429 || status === 503) {
    return provider === "direct"
      ? "The site blocked a direct fetch (anti-bot). Switch the provider to ScrapingBee/ScraperAPI/ZenRows or your own service in the Fetch & Anti-bot tab, and enable Render JS."
      : "The provider returned a block. Try enabling Render JS, or check the provider's credit/quota and that the API key is valid.";
  }
  return undefined;
}

export async function parsePage(url: string, opts: ParsePageOptions): Promise<ParsePageResult> {
  const matched = matchSiteConfig(url, opts.siteConfigs);
  const settings = effectiveFetchSettings(opts.fetchSettings, matched);

  // Shopify answers the same address with `.json` appended, and that answer is
  // better than the page in both directions: it carries every photo, every
  // variant and the colour and size options as data, and it is an API endpoint
  // rather than a page, so it is routinely served on a store whose HTML sits
  // behind an anti-bot challenge. Worth one request before spending one on
  // markup we would then have to mine. Any other store answers this with a 404
  // and the host is remembered, so the guess is paid for once per crawl.
  const shopify = await fetchShopifyProduct(url, settings, opts.fetchApiKey);
  if (shopify) {
    const product = normalizeExtract(shopify.raw, shopify.sourceUrl, matched);
    return {
      ok: true,
      products: product.name || product.imageUrl ? [product] : [],
      links: [],
      isListing: false,
      diagnostics: {
        provider: settings.provider,
        status: 200,
        htmlLength: shopify.bytes,
        finalUrl: shopify.jsonUrl,
        matchedConfig: matched ? { id: matched.id, name: matched.name, domain: matched.domain } : null,
        strategies: product.strategies,
      },
    };
  }

  const fetched = await fetchHtml(url, settings, opts.fetchApiKey);
  const pageUrl = fetched.finalUrl || url;

  const diagnostics: ParsePageDiagnostics = {
    provider: settings.provider,
    status: fetched.status,
    htmlLength: fetched.html.length,
    finalUrl: pageUrl,
    matchedConfig: matched ? { id: matched.id, name: matched.name, domain: matched.domain } : null,
  };

  if (!fetched.ok || !fetched.html) {
    return {
      ok: false,
      error: fetched.error ?? "Failed to fetch page",
      hint: blockHint(fetched.status, settings.provider),
      products: [],
      links: [],
      isListing: false,
      diagnostics,
    };
  }

  // Separate the page's own product(s) from embedded ItemList cards so a product
  // page with a "related products" carousel stays single.
  const { standaloneCount, standaloneItems, listItems } = partitionProducts(fetched.html);

  let aiFields: string[] | undefined;
  let aiError: string | undefined;

  /** Single-product path: deterministic extract, then AI for whatever is missing. */
  const single = async (): Promise<ParsedProduct[]> => {
    // pageUrl lets the extractor harvest the gallery out of the markup —
    // relative and protocol-relative image URLs need a base to resolve against.
    let raw = extractProduct(fetched.html, matched, pageUrl);

    const aiAllowed = opts.useAi ?? opts.aiSettings.enabled;
    const aiWanted = aiAllowed && (opts.aiSettings.mode === "always" || shouldUseAi(raw));
    if (aiWanted) {
      const result = await aiExtract(fetched.html, pageUrl);
      if (result.error) {
        aiError = result.error;
      } else {
        const merged = mergeAiIntoRaw(raw, result.fields);
        raw = merged.raw;
        aiFields = merged.used;
      }
    }

    const prod = normalizeExtract(raw, pageUrl, matched);
    return prod.name || prod.imageUrl ? [prod] : [];
  };

  let products: ParsedProduct[] = [];
  let isListing = false;

  if (standaloneCount === 1) {
    products = await single();
  } else {
    const items = standaloneCount >= 2 ? standaloneItems : listItems;
    if (items.length >= 2) {
      isListing = true;
      products = items.map((n) => {
        const purl = n.url ? resolveUrl(n.url, pageUrl) : "";
        const prod = normalizeExtract(n, purl || pageUrl, matched);
        // Keep each card's own source URL (empty → import inserts a fresh row
        // instead of all cards colliding on the listing URL).
        prod.sourceUrl = purl;
        return prod;
      });
    } else {
      products = await single();
    }
  }

  // When the page is a listing that didn't embed full product data, surface the
  // product links so the caller can walk them.
  let links: string[] = [];
  if (!isListing && (products.length === 0 || !products[0]?.price)) {
    links = extractProductLinks(fetched.html, pageUrl).filter((u) => u !== pageUrl);
    if (links.length >= 2 && products.length === 0) isListing = true;
  }

  const strategies = isListing ? ["json-ld"] : products[0]?.strategies ?? [];

  return {
    ok: true,
    products,
    links,
    isListing,
    diagnostics: { ...diagnostics, strategies, aiFields, aiError },
  };
}
