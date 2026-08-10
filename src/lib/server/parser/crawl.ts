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

  while (next && pagesVisited < maxPages && found.size < limit) {
    if (Date.now() - started > budgetMs) break;

    const pageUrl: string = next;
    visited.add(pageUrl);

    const matched = matchSiteConfig(pageUrl, opts.siteConfigs);
    const settings = effectiveFetchSettings(opts.fetchSettings, matched);
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
          status,
        };
      }
      break;
    }
    pagesVisited++;

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
    hint: urls.length === 0
      ? "No product links found on this page. If the store renders its grid with JavaScript, enable Render JS in the Fetch & Anti-bot tab, or paste a single product URL."
      : undefined,
  };
}
