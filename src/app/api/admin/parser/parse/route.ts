import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { fetchHtml } from "@/lib/server/parser/fetch";
import { extractProduct, partitionProducts, extractProductLinks } from "@/lib/server/parser/extract";
import { normalizeExtract } from "@/lib/server/parser/normalize";
import {
  getFetchSettings,
  getFetchApiKey,
  getSiteConfigs,
  matchSiteConfig,
  effectiveFetchSettings,
} from "@/lib/server/parser/configs";
import type { ParsedProduct } from "@/lib/server/parser/types";

export const maxDuration = 60;

function resolveUrl(href: string, base: string): string {
  try { return new URL(href, base).toString(); } catch { return ""; }
}

/** Actionable guidance when the upstream blocks us. */
function blockHint(status: number, provider: string): string | undefined {
  if (status === 403 || status === 401 || status === 429 || status === 503) {
    return provider === "direct"
      ? "The site blocked a direct fetch (anti-bot). Switch the provider to ScrapingBee/ScraperAPI/ZenRows or your own service in the Fetch & Anti-bot tab, and enable Render JS."
      : "The provider returned a block. Try enabling Render JS, or check the provider's credit/quota and that the API key is valid.";
  }
  return undefined;
}

// POST { url } — fetch a page and return either a single product or, for a
// listing/category page, every product it contains (plus discovered links).
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  const [baseSettings, keyInfo, configs] = await Promise.all([
    getFetchSettings(),
    getFetchApiKey(),
    getSiteConfigs(),
  ]);

  const matched = matchSiteConfig(url, configs);
  const settings = effectiveFetchSettings(baseSettings, matched);

  const fetched = await fetchHtml(url, settings, keyInfo.key);
  const pageUrl = fetched.finalUrl || url;

  const diagnostics = {
    provider: settings.provider,
    status: fetched.status,
    htmlLength: fetched.html.length,
    finalUrl: pageUrl,
    matchedConfig: matched ? { id: matched.id, name: matched.name, domain: matched.domain } : null,
  };

  if (!fetched.ok || !fetched.html) {
    return NextResponse.json({
      ok: false,
      error: fetched.error ?? "Failed to fetch page",
      hint: blockHint(fetched.status, settings.provider),
      products: [],
      links: [],
      isListing: false,
      diagnostics,
    });
  }

  // Separate the page's own product(s) from embedded ItemList cards so a
  // product page with a "related products" carousel stays single.
  const { standaloneCount, standaloneItems, listItems } = partitionProducts(fetched.html);

  const single = () => {
    const prod = normalizeExtract(extractProduct(fetched.html, matched), pageUrl, matched);
    return prod.name || prod.imageUrl ? [prod] : [];
  };

  let products: ParsedProduct[] = [];
  let isListing = false;

  if (standaloneCount === 1) {
    // A clear single product page (related lists ignored). Merge meta/microdata.
    products = single();
  } else {
    // No single main product → treat embedded products as a listing.
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
      products = single();
    }
  }

  // When the page is a listing that didn't embed full product data, surface the
  // product links so the admin can "parse each".
  let links: string[] = [];
  if (!isListing && (products.length === 0 || !products[0]?.price)) {
    links = extractProductLinks(fetched.html, pageUrl).filter((u) => u !== pageUrl);
    if (links.length >= 2 && products.length === 0) isListing = true;
  }

  const strategies = isListing ? ["json-ld"] : (products[0]?.strategies ?? []);

  return NextResponse.json({
    ok: true,
    products,
    links,
    isListing,
    diagnostics: { ...diagnostics, strategies },
  });
}
