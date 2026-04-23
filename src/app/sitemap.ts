import type { MetadataRoute } from "next";
import { getAllProducts, getAllOutfits, getAllBlogPosts } from "@/lib/data/db";

export const revalidate = 3600;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://goo-fashion.com").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Only include public, crawlable pages — no protected or robots-disallowed routes
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`,       lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${SITE_URL}/browse`, lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${SITE_URL}/blog`,   lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${SITE_URL}/plans`,  lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/about`,  lastModified: now, changeFrequency: "monthly", priority: 0.5 },
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
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const outfitRoutes: MetadataRoute.Sitemap = outfits.map((o) => ({
    url: `${SITE_URL}/outfit/${o.id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const blogRoutes: MetadataRoute.Sitemap = blogPosts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...productRoutes, ...outfitRoutes, ...blogRoutes];
}
