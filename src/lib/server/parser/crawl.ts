/**
 * Listing-page crawler: turn one pasted URL into a list of product URLs.
 *
 * The admin pastes whatever they have — a category page, a brand's "all
 * products" page, a single product — and this works out what to collect:
 *
 *   - a product page                → that one URL
 *   - a listing with embedded data  → the card URLs (JSON-LD ItemList)
 *   - a plain listing               → same-host anchors that look like products
 *
 * Pagination is followed by `rel="next"` and by anchors carrying a page
 * parameter, under both a page cap and a wall-clock budget, because this runs
 * inside a serverless function that will be killed at its `maxDuration`.
 */
import { fetchHtml } from "./fetch";
import { extractProductLinks } from "./extract";
import { matchSiteConfig, effectiveFetchSettings } from "./configs";
import type { ParserFetchSettings, ParserSiteConfig } from "./types";

export interface DiscoverOptions {
  fetchSettings: ParserFetchSettings;
  fetchApiKey: string;
  siteConfigs: ParserSiteConfig[];
  /** Max product URLs to return. */
  limit: number;
  /** Max listing pages to walk (1 = just the pasted page). */
  maxPages: number;
  /** Stop discovering after this many ms, whatever the page count. */
  budgetMs?: number;
}

export interface DiscoverResult {
  ok: boolean;
  urls: string[];
  pagesVisited: number;
  /** True when the start URL is itself a product page. */
  isSingleProduct: boolean;
  error?: string;
  hint?: string;
  status: number;
}

/** Find the next listing page: rel="next" first, then a page-numbered anchor. */
function findNextPage(html: string, currentUrl: string, visited: Set<string>): string | null {
  const abs = (href: string): string | null => {
    try {
      const u = new URL(href, currentUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      const s = u.toString();
      return visited.has(s) ? null : s;
    } catch {
      return null;
    }
  };

  // <link rel="next" href> / <a rel="next" href>
  const relNext = html.match(/<(?:link|a)\b[^>]*\brel=["'][^"']*\bnext\b[^"']*["'][^>]*\bhref=["']([^"']+)["']/i)
    ?? html.match(/<(?:link|a)\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["'][^"']*\bnext\b[^"']*["']/i);
  if (relNext) {
    const u = abs(relNext[1]);
    if (u) return u;
  }

  // Otherwise: the lowest unvisited page number greater than the current one.
  let currentPage = 1;
  try {
    const p = new URL(currentUrl).searchParams;
    currentPage = Number(p.get("page") ?? p.get("p") ?? p.get("pageNumber") ?? 1) || 1;
  } catch { /* keep 1 */ }

  const candidates: { url: string; page: number }[] = [];
  const anchorRe = /<a\b[^>]*\bhref=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html))) {
    const pageMatch = m[1].match(/[?&](?:page|p|pageNumber)=(\d+)/i);
    if (!pageMatch) continue;
    const page = Number(pageMatch[1]);
    if (!Number.isFinite(page) || page <= currentPage) continue;
    const u = abs(m[1]);
    if (u) candidates.push({ url: u, page });
  }
  candidates.sort((a, b) => a.page - b.page);
  return candidates[0]?.url ?? null;
}

/** Does the page look like a single product rather than a listing? */
function looksLikeProductPage(html: string): boolean {
  // A standalone schema.org Product with an offer is the strongest signal.
  return /"@type"\s*:\s*"Product"/i.test(html) && /"(?:offers|price)"\s*:/i.test(html);
}

/**
 * Interstitials that unmistakably replace a page with a block or a challenge —
 * Akamai, Cloudflare, Imperva. Any one of these means we never saw the catalog.
 */
const HARD_BLOCK_SIGNATURES = [
  /access denied/i,
  /you (?:have been|are) blocked/i,
  /just a moment\s*\.\.\./i,
  /attention required!/i,
  /checking your browser/i,
  /enable javascript and cookies to continue/i,
  /pardon our interruption/i,
  /_incapsula_resource/i,
  /errors\.edgesuite\.net/i,
  /reference\s*#\d+\.[\da-f]+/i,
  /are you a (?:robot|human)/i,
];

/**
 * Vendor names and captcha widgets that also sit on perfectly normal pages (a
 * newsletter box ships reCAPTCHA; DataDome tags every page it protects). These
 * only mean "blocked" on a page too small to be a real listing.
 */
const SOFT_BLOCK_SIGNATURES = [/perimeterx|px-captcha/i, /datadome/i, /\bcaptcha\b/i];

function countAnchors(html: string): number {
  return (html.match(/<a\b[^>]*\bhref=/gi) ?? []).length;
}

/**
 * Render JS is only ever forwarded to a scraping provider — in `direct` mode
 * the toggle is inert. Never send the admin to a switch that cannot help them.
 */
function renderAdvice(settings: ParserFetchSettings): string {
  if (settings.provider === "direct") {
    return "Set a scraping provider in the Fetch & Anti-bot tab and turn on Render JS.";
  }
  return settings.renderJs
    ? "Render JS is already on, so try a provider with stronger anti-bot bypass, or paste a single product URL."
    : "Turn on Render JS in the Fetch & Anti-bot tab.";
}

/**
 * Explain an empty listing in terms of what actually came back. The three cases
 * need three different fixes, and telling an admin on `direct` to "enable
 * Render JS" — the old blanket advice — points at a toggle that does nothing.
 */
function diagnoseEmptyListing(html: string, settings: ParserFetchSettings): string {
  const anchors = countAnchors(html);
  // A real listing page is a big document full of links. Anything far short of
  // that is either a challenge page or an unrendered shell.
  const thin = html.length < 20_000 || anchors < 10;

  const blocked =
    HARD_BLOCK_SIGNATURES.some((re) => re.test(html)) ||
    (thin && SOFT_BLOCK_SIGNATURES.some((re) => re.test(html)));

  if (blocked) {
    return settings.provider === "direct"
      ? "The store answered with an anti-bot check instead of the listing. A plain server request cannot get past it — set a scraping provider in the Fetch & Anti-bot tab."
      : "The store answered with an anti-bot check instead of the listing. Try a provider with stronger anti-bot bypass, or a different impersonation profile.";
  }

  if (thin) {
    return `The page loaded but carries almost no links (${anchors}), so this store builds its product grid in the browser. ${renderAdvice(settings)}`;
  }

  return `The page loaded with ${anchors} links, but none of them look like product pages. Paste a single product URL to import it directly.`;
}

/**
 * A failed fetch of the first page. Only add a hint where the status actually
 * tells us something — `error` already carries the status itself.
 */
function diagnoseFailedFetch(settings: ParserFetchSettings, status: number): string | undefined {
  if (status === 401 || status === 403 || status === 429) {
    return settings.provider === "direct"
      ? "The store refused the request outright — that is anti-bot, not a bad URL. Set a scraping provider in the Fetch & Anti-bot tab."
      : "The store refused the provider's request. Try a different impersonation profile, or a provider with stronger anti-bot bypass.";
  }
  if (status === 404) return "The store returned 404 — check the URL still opens in a browser.";
  if (status === 0) return "The request never completed. Raise the timeout in the Fetch & Anti-bot tab, or check the host is reachable.";
  return undefined;
}

export async function discoverProductUrls(
  startUrl: string,
  opts: DiscoverOptions,
): Promise<DiscoverResult> {
  const started = Date.now();
  const budgetMs = opts.budgetMs ?? 45_000;
  const limit = Math.max(1, Math.min(opts.limit, 500));
  const maxPages = Math.max(1, Math.min(opts.maxPages, 20));

  const found = new Set<string>();
  const visited = new Set<string>();
  let pagesVisited = 0;
  let status = 0;
  let next: string | null = startUrl;
  // Kept for the diagnosis below: an empty crawl is explained by what the FIRST
  // page came back as, under the fetch settings that page was actually fetched with.
  let firstHtml = "";
  let firstSettings: ParserFetchSettings = opts.fetchSettings;

  while (next && pagesVisited < maxPages && found.size < limit) {
    if (Date.now() - started > budgetMs) break;

    const pageUrl: string = next;
    visited.add(pageUrl);

    const matched = matchSiteConfig(pageUrl, opts.siteConfigs);
    const settings = effectiveFetchSettings(opts.fetchSettings, matched);
    if (pagesVisited === 0) firstSettings = settings;
    const fetched = await fetchHtml(pageUrl, settings, opts.fetchApiKey);
    status = fetched.status;

    if (!fetched.ok || !fetched.html) {
      // A failure on the first page is fatal; later pages just end the walk.
      if (pagesVisited === 0) {
        return {
          ok: false,
          urls: [],
          pagesVisited: 0,
          isSingleProduct: false,
          error: fetched.error ?? "Failed to fetch page",
          hint: diagnoseFailedFetch(settings, status),
          status,
        };
      }
      break;
    }
    pagesVisited++;
    if (pagesVisited === 1) firstHtml = fetched.html;

    const finalUrl = fetched.finalUrl || pageUrl;
    visited.add(finalUrl);

    // The pasted URL is itself a product page — nothing to crawl.
    if (pagesVisited === 1 && looksLikeProductPage(fetched.html)) {
      const links = extractProductLinks(fetched.html, finalUrl).filter((u) => u !== finalUrl);
      // A PDP embeds "related products"; if the page is a product, take it alone.
      if (links.length < 8) {
        return { ok: true, urls: [finalUrl], pagesVisited, isSingleProduct: true, status };
      }
    }

    for (const u of extractProductLinks(fetched.html, finalUrl)) {
      if (u === finalUrl) continue;
      found.add(u);
      if (found.size >= limit) break;
    }

    next = pagesVisited < maxPages ? findNextPage(fetched.html, finalUrl, visited) : null;
  }

  const urls = [...found].slice(0, limit);
  return {
    ok: true,
    urls,
    pagesVisited,
    isSingleProduct: false,
    status,
    hint: urls.length === 0 ? diagnoseEmptyListing(firstHtml, firstSettings) : undefined,
  };
}
