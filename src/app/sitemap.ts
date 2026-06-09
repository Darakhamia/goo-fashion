import type { MetadataRoute } from "next";
import { getAllProducts, getAllOutfits, getAllBlogPosts } from "@/lib/data/db";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

/**
 * Safely parse an entity timestamp into a Date for <lastmod>, falling back to
 * `now` when the value is missing or unparseable.
 */
function toDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

/**
 * Single sitemap for ~317 URLs. If the catalog grows past ~10–20k URLs, split
 * the dynamic sections below into separate route segments
 * (e.g. app/sitemap/products/[n]/route.ts) and expose a sitemap index from
 * Next's `generateSitemaps()` — the per-section builders are already isolated.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Only include public, crawlable pages — no protected or robots-disallowed routes
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`,       lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${SITE_URL}/browse`, lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${SITE_URL}/blog`,   lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${SITE_URL}/plans`,  lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/about`,        lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/sitemap-page`, lastModified: now, changeFrequency: "weekly",  priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`,  lastModified: now, changeFrequency: "yearly",  priority: 0.2 },
  ];

  const [products, outfits, blogPosts] = await Promise.all([
    getAllProducts().catch(() => []),
    getAllOutfits().catch(() => []),
    getAllBlogPosts({ publishedOnly: true }).catch(() => []),
  ]);

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/product/${p.id}`,
    lastModified: toDate(p.createdAt, now),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const outfitRoutes: MetadataRoute.Sitemap = outfits.map((o) => ({
    url: `${SITE_URL}/outfit/${o.id}`,
    lastModified: toDate(o.createdAt, now),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const blogRoutes: MetadataRoute.Sitemap = blogPosts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: toDate(p.updatedAt, now),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...productRoutes, ...outfitRoutes, ...blogRoutes];
}
