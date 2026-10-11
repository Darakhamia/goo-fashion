import type { MetadataRoute } from "next";
import { getAllProducts, getAllOutfits, getAllBlogPosts } from "@/lib/data/db";
import { withTimeout } from "@/lib/server/with-timeout";
import { allLandings } from "@/lib/server/landing";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

/**
 * The "Last updated" date each legal page prints. Keep in step with the page:
 * a lastmod that changes without the page is what teaches Google to ignore it.
 */
const LEGAL_UPDATED: Record<string, string> = {
  "/privacy": "2026-09-26",
  "/terms": "2026-08-10",
  "/cookie": "2026-09-26",
  "/refund": "2026-08-10",
};

/** How many photos of a product the sitemap lists. */
const IMAGES_PER_PRODUCT = 5;

/** An entity timestamp as a Date for <lastmod>, or undefined when there is none. */
function toDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** The latest of some dates, or undefined when none is known. */
function latest(dates: (Date | undefined)[]): Date | undefined {
  const known = dates.filter((d): d is Date => Boolean(d));
  return known.length ? new Date(Math.max(...known.map((d) => d.getTime()))) : undefined;
}

/** Next writes sitemap image URLs into the XML as they are; `&` must be escaped. */
function xmlUrl(url: string): string {
  return url.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Single sitemap for a few hundred URLs. If the catalog grows past ~10–20k URLs, split
 * the dynamic sections below into separate route segments
 * (e.g. app/sitemap/products/[n]/route.ts) and expose a sitemap index from
 * Next's `generateSitemaps()` — the per-section builders are already isolated.
 *
 * <lastmod> is only ever a real date: when the entity last changed (migration
 * 027), or for a section page the newest change among what it lists. A page
 * with no such date gets none — a lastmod of "now" on every fetch is one Google
 * learns to ignore for the whole file.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Bounded, not just error-handled: this runs during `next build`, and a
  // database that goes quiet rather than failing would otherwise hang the deploy
  // until the platform's own timeout kills it. See lib/server/with-timeout.
  const [products, outfits, blogPosts, landings] = await Promise.all([
    withTimeout(getAllProducts(), [], "sitemap products"),
    withTimeout(getAllOutfits(), [], "sitemap outfits"),
    withTimeout(getAllBlogPosts({ publishedOnly: true }), [], "sitemap posts"),
    withTimeout(allLandings(), [], "sitemap landing pages"),
  ]);

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => {
    const photos = (p.images?.length ? p.images : p.imageUrl ? [p.imageUrl] : [])
      .filter((src) => /^https?:\/\//.test(src))
      .slice(0, IMAGES_PER_PRODUCT);
    return {
      url: `${SITE_URL}/product/${p.id}`,
      lastModified: toDate(p.updatedAt ?? p.createdAt),
      changeFrequency: "weekly",
      priority: 0.8,
      ...(photos.length ? { images: photos.map(xmlUrl) } : {}),
    };
  });

  const outfitRoutes: MetadataRoute.Sitemap = outfits.map((o) => ({
    url: `${SITE_URL}/outfit/${o.id}`,
    lastModified: toDate(o.updatedAt ?? o.createdAt),
    changeFrequency: "weekly",
    priority: 0.8,
    ...(o.imageUrl && /^https?:\/\//.test(o.imageUrl) ? { images: [xmlUrl(o.imageUrl)] } : {}),
  }));

  const blogRoutes: MetadataRoute.Sitemap = blogPosts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: toDate(p.updatedAt),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // Brand and category pages that have enough products to be indexed (SEO-17);
  // a page changes when one of its products does.
  const landingRoutes: MetadataRoute.Sitemap = landings
    .filter((l) => l.indexable)
    .map((l) => ({
      url: `${SITE_URL}${l.path}`,
      lastModified: latest(l.products.map((p) => toDate(p.updatedAt ?? p.createdAt))),
      changeFrequency: "weekly",
      priority: l.kind === "subcategory" ? 0.6 : 0.7,
    }));

  const newestProduct = latest(productRoutes.map((r) => r.lastModified as Date | undefined));
  const newestOutfit = latest(outfitRoutes.map((r) => r.lastModified as Date | undefined));
  const newestPost = latest(blogRoutes.map((r) => r.lastModified as Date | undefined));

  // Only public, crawlable pages — no protected, noindex or robots-disallowed routes
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: latest([newestOutfit, newestProduct]), changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/browse`, lastModified: latest([newestProduct, newestOutfit]), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/blog`, lastModified: newestPost, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/brands`, lastModified: newestProduct, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/plans`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/sitemap-page`, lastModified: latest([newestProduct, newestOutfit, newestPost]), changeFrequency: "weekly", priority: 0.3 },
    ...Object.entries(LEGAL_UPDATED).map(([path, date]) => ({
      url: `${SITE_URL}${path}`,
      lastModified: new Date(`${date}T00:00:00Z`),
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];

  return [...staticRoutes, ...landingRoutes, ...productRoutes, ...outfitRoutes, ...blogRoutes];
}
