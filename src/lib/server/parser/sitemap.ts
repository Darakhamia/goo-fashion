/**
 * Reading a store's sitemap.
 *
 * A sitemap is the shop telling search engines what it sells, so it is the one
 * listing that is meant to be read by a machine — and the one a defended store
 * usually still serves, because blocking it costs a shop its Google traffic.
 *
 * Nothing here fetches. The extension pulls the documents down in the admin's
 * browser and posts them to the collect route; `plan-collection.ts` decides
 * which to ask for next and reads them with the helpers below.
 */

/**
 * Conventional locations, in the order they are worth trying. The first three
 * are the ones every platform ships; the rest are the names a store that does
 * not answer `/sitemap.xml` actually uses — Yoast and WooCommerce publish a
 * products-only file, WordPress core has its own index, and Magento puts the
 * whole thing one directory down.
 */
export const CANDIDATES = [
  "/sitemap.xml",
  "/sitemap_index.xml",
  "/sitemap_products_1.xml",
  "/product-sitemap.xml",
  "/wp-sitemap.xml",
  "/sitemap/sitemap-index.xml",
  "/sitemap1.xml",
];

export function locations(xml: string): string[] {
  const out: string[] = [];
  // `<loc>` holds a bare URL or a CDATA section; WordPress and Magento both
  // ship the latter, and reading only the bare form made their sitemaps look
  // empty rather than unreadable.
  const re = /<loc>\s*(?:<!\[CDATA\[\s*)?([^<\s\]]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1].replace(/&amp;/g, "&"));
  return out;
}

/**
 * The name a sitemap gives each page, where it gives one: Shopify writes the
 * product's title beside its photo (`<image:title>`) for every product it
 * lists. Keyed by `<loc>` as `locations` reads it.
 */
export function titles(xml: string): Map<string, string> {
  const out = new Map<string, string>();
  const entry = /<url>([\s\S]*?)<\/url>/gi;
  let m: RegExpExecArray | null;
  while ((m = entry.exec(xml))) {
    const loc = /<loc>\s*(?:<!\[CDATA\[\s*)?([^<\s\]]+)/i.exec(m[1])?.[1];
    const title = /<image:title>\s*(?:<!\[CDATA\[)?([^<\]]*)/i.exec(m[1])?.[1];
    if (!loc || !title?.trim()) continue;
    out.set(
      loc.replace(/&amp;/g, "&"),
      title
        .replace(/&#0*39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .trim(),
    );
  }
  return out;
}

/** An index lists sitemaps; a sitemap lists pages. They need different handling. */
export function isIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

/** Does this sitemap's own name say it lists products? */
export function namesProducts(url: string): boolean {
  return /product/i.test(url);
}

/**
 * A child sitemap worth opening: the ones named after products first, and never
 * the ones that certainly are not (blog posts, pages, collections).
 */
export function rankChild(url: string): number {
  const u = url.toLowerCase();
  if (/product/.test(u)) return 0;
  if (/(?:blog|article|page|collection|marketing)/.test(u)) return 2;
  return 1;
}
