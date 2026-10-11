import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getProductById, getRelatedProducts, getOutfitsByProductId, getBrandLogos, getAllColorGroups } from "@/lib/data/db";
import ProductClient from "@/components/product/ProductClient";
import JsonLd from "@/components/seo/JsonLd";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  breadcrumbJsonLd,
  formatMetaPrice,
  productJsonLd,
  productMetaDescription,
} from "@/lib/seo";
import { cheapestOffer } from "@/lib/server/fx";

// ISR: a product page is served from cache and regenerated at most every five
// minutes — it was rendered from the database on every visit.
export const revalidate = 300;

// `revalidate` alone caches nothing here: a dynamic segment with no
// generateStaticParams is rendered per request. An empty list prerenders no
// product at build time and caches each one on its first visit instead, which
// is also what lets revalidatePath(`/product/${id}`) in the product API
// refresh it after an edit.
export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [];
}

interface Props {
  params: Promise<{ id: string }>;
}

// generateMetadata and the page both need the product; one request reads it
// once. A failed read throws rather than reading as "no such product", so a
// database hiccup is not cached as a 404 for the next five minutes.
const loadProduct = cache((id: string) => getProductById(id, { throwOnError: true }));

// The page shows four of each.
const RELATED_COUNT = 4;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await loadProduct(id);
  if (!product) return {};

  const lowest = await cheapestOffer(product.retailers, {
    amount: product.priceMin,
    currency: product.currency,
  });

  // The brand only when the name doesn't already carry it ("adidas Originals
  // Gazelle" needs no "— adidas Originals" after it); the root layout's title
  // template adds the site name.
  const title = product.name.toLowerCase().includes(product.brand.toLowerCase())
    ? product.name
    : `${product.name} — ${product.brand}`;
  const description = productMetaDescription(product, formatMetaPrice(lowest.amount, lowest.currency));

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/product/${id}` },
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      url: `${SITE_URL}/product/${id}`,
      type: "website",
      // Fall back to the site-wide branded card when the product has no photo,
      // so shared links always render with an image.
      images: product.imageUrl
        ? [{ url: product.imageUrl, alt: product.name }]
        : [DEFAULT_OG_IMAGE],
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;
  const product = await loadProduct(id);
  if (!product) notFound();

  const variantIds = [product.id, ...(product.variants?.map((v) => v.id) ?? [])];

  // Narrow reads: a few products from the same category, and only the outfits
  // that contain this piece — not the whole catalogue and every outfit.
  const [relatedProducts, outfitsWithProduct, retailerLogos, colorGroups] = await Promise.all([
    getRelatedProducts(product, RELATED_COUNT),
    getOutfitsByProductId(variantIds, RELATED_COUNT),
    getBrandLogos(),
    // Fetched here rather than in the client so the colour breadcrumb is right
    // in the first paint: a label that arrives late would flicker in above the
    // fold, and it is a link a crawler should see.
    getAllColorGroups(),
  ]);

  // Each retailer's price is in that store's currency, so the cheapest is
  // chosen on one scale and shown in its own currency (see `cheapestOffer`).
  const lowest = await cheapestOffer(product.retailers, {
    amount: product.priceMin,
    currency: product.currency,
  });

  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Browse", url: absoluteUrl("/browse") },
    { name: product.category, url: absoluteUrl(`/browse?category=${product.category}`) },
    { name: product.name },
  ]);

  return (
    <div className="min-h-screen">
      <JsonLd data={[productJsonLd(product), breadcrumb]} />
      <div className="max-w-[1440px] mx-auto px-3 md:px-12">
        <ProductClient
          product={product}
          relatedProducts={relatedProducts}
          outfitsWithProduct={outfitsWithProduct}
          lowestPrice={lowest.amount}
          lowestPriceCurrency={lowest.currency}
          retailerLogos={retailerLogos}
          colorGroups={colorGroups}
        />
      </div>
    </div>
  );
}
