/**
 * Product URLs from the store's sitemap.
 *
 * A sitemap is the shop telling search engines what it sells, so it is the one
 * listing that is meant to be read by a machine — and the one a defended store
 * usually still serves. `/sitemap.xml` answering 200 while the category page
 * answers 403 is the ordinary case, not a lucky one: blocking the sitemap costs
 * a shop its Google traffic, so nobody does it.
 *
 * That makes this the fallback for a blocked or empty crawl. It is also better
 * than the HTML walk where the HTML works at all: no pagination to follow, no
 * anchors to sift, and it lists the whole catalogue rather than the first few
 * pages of a grid.
 *
 * The whole run is bounded to a handful of requests, because it happens inside
 * a serverless function that is already spending its budget on the crawl that
 * failed: robots.txt, at most two sitemap candidates, and at most three child
 * sitemaps out of an index.
 */
import { fetchHtml } from "./fetch";
import { looksLikeProductPath } from "./extract";
import type { ParserFetchSettings } from "./types";

/** Conventional locations, in the order they are worth trying. */
const CANDIDATES = ["/sitemap.xml", "/sitemap_index.xml", "/sitemap_products_1.xml"];

/** Child sitemaps to open out of an index. */
const MAX_CHILDREN = 3;

/** Sitemap documents to fetch in total, robots.txt aside. */
const MAX_DOCUMENTS = 5;

function locations(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1].replace(/&amp;/g, "&"));
  return out;
}

/** An index lists sitemaps; a sitemap lists pages. They need different handling. */
function isIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

/**
 * A child sitemap worth opening: the ones named after products first, and never
 * the ones that certainly are not (blog posts, pages, collections).
 */
function rankChild(url: string): number {
  const u = url.toLowerCase();
  if (/product/.test(u)) return 0;
  if (/(?:blog|article|page|collection|marketing)/.test(u)) return 2;
  return 1;
}

async function getText(
  url: string,
  settings: ParserFetchSettings,
  apiKey: string,
): Promise<string | null> {
  const res = await fetchHtml(url, settings, apiKey);
  return res.ok && res.html ? res.html : null;
}

/** Sitemap URLs robots.txt points at — the store's own answer, before guessing. */
async function fromRobots(
  origin: string,
  settings: ParserFetchSettings,
  apiKey: string,
): Promise<string[]> {
  const txt = await getText(`${origin}/robots.txt`, settings, apiKey);
  if (!txt) return [];
  const out: string[] = [];
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*sitemap\s*:\s*(\S+)/i);
    if (m) out.push(m[1]);
  }
  return out;
}

export interface SitemapOptions {
  limit: number;
  /** Wall-clock stop, shared with the crawl that called us. */
  deadline?: number;
}

export interface SitemapResult {
  /** Product URLs found, in sitemap order. */
  urls: string[];
  /** Whether any sitemap could be read at all — the two failures differ. */
  readable: boolean;
  /**
   * How many URLs the sitemaps listed, product-shaped or not. A store whose
   * sitemap is readable but yields no products is a fixable path-test gap;
   * one whose sitemap is refused is not fixable from here at all, and the
   * admin should not have to guess which of the two they are looking at.
   */
  locsSeen: number;
}

/**
 * Product URLs for the store the given URL belongs to. Returns an empty list
 * when there is no readable sitemap — the caller keeps whatever it had.
 */
export async function discoverFromSitemap(
  startUrl: string,
  settings: ParserFetchSettings,
  apiKey: string,
  opts: SitemapOptions,
): Promise<SitemapResult> {
  const nothing: SitemapResult = { urls: [], readable: false, locsSeen: 0 };

  let origin: string;
  let host: string;
  try {
    const u = new URL(startUrl);
    origin = u.origin;
    host = u.hostname.replace(/^www\./, "");
  } catch {
    return nothing;
  }

  const expired = () => !!opts.deadline && Date.now() > opts.deadline;
  if (expired()) return nothing;

  const declared = await fromRobots(origin, settings, apiKey);
  const queue = [...declared, ...CANDIDATES.map((p) => `${origin}${p}`)];

  const found: string[] = [];
  const seen = new Set<string>();
  const opened = new Set<string>();
  let documents = 0;
  let children = 0;
  let readable = false;
  let locsSeen = 0;

  while (queue.length && documents < MAX_DOCUMENTS && found.length < opts.limit) {
    if (expired()) break;
    const url = queue.shift()!;
    if (opened.has(url)) continue;
    opened.add(url);

    // Only ever follow a sitemap on the store's own host — an index can name
    // anything, and a third-party URL there is not the shop's catalogue.
    try {
      if (new URL(url).hostname.replace(/^www\./, "") !== host) continue;
    } catch {
      continue;
    }

    const xml = await getText(url, settings, apiKey);
    documents++;
    if (!xml || !/<loc>/i.test(xml)) continue;
    readable = true;

    const locs = locations(xml);
    if (isIndex(xml)) {
      const next = locs
        .map((u) => ({ u, rank: rankChild(u) }))
        .filter((c) => c.rank < 2)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, Math.max(0, MAX_CHILDREN - children))
        .map((c) => c.u);
      children += next.length;
      // Children go to the front: an index carries no product URLs itself, and
      // the remaining candidates are guesses we no longer need.
      queue.unshift(...next);
      continue;
    }

    locsSeen += locs.length;
    for (const loc of locs) {
      let path: string;
      try {
        const u = new URL(loc);
        if (u.hostname.replace(/^www\./, "") !== host) continue;
        path = u.pathname;
      } catch {
        continue;
      }
      if (!looksLikeProductPath(path)) continue;
      const clean = loc.split("#")[0];
      if (seen.has(clean)) continue;
      seen.add(clean);
      found.push(clean);
      if (found.length >= opts.limit) break;
    }
  }

  return { urls: found, readable, locsSeen };
}
