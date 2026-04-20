import type { MetadataRoute } from "next";
import { getAllProducts, getAllOutfits } from "@/lib/data/db";

// Rebuild the sitemap every hour so new products/outfits surface without a full redeploy.
export const revalidate = 3600;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://goo-fashion.com").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`,          lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${SITE_URL}/browse`,    lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${SITE_URL}/stylist`,   lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/blog`,      lastModified: now, changeFrequency: "weekly",  priority: 0.6 },
    { url: `${SITE_URL}/plans`,     lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/subscribe`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  const [products, outfits] = await Promise.all([
    getAllProducts().catch(() => []),
    getAllOutfits().catch(() => []),
  ]);

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/product/${p.id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const outfitRoutes: MetadataRoute.Sitemap = outfits.map((o) => ({
    url: `${SITE_URL}/outfit/${o.id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...productRoutes, ...outfitRoutes];
}
