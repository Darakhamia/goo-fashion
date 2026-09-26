import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getProductById, getRelatedProducts, getOutfitsByProductId, getBrandLogos, getAllColorGroups } from "@/lib/data/db";
import ProductClient from "@/components/product/ProductClient";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, absoluteUrl, formatMetaPrice, productJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { cheapestOffer } from "@/lib/server/fx";

// ISR: a product page is served from cache and regenerated at most every five
// minutes, like the blog — it was rendered from the database on every visit.
export const revalidate = 300;

interface Props {
  params: Promise<{ id: string }>;
}

// generateMetadata and the page both need the product; one request reads it once.
const loadProduct = cache((id: string) => getProductById(id));

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

  const title = `${product.name} — ${product.brand} | GOO`;
  const description = product.description
    ? product.description.slice(0, 155)
    : `Shop ${product.name} by ${product.brand}. From ${formatMetaPrice(lowest.amount, lowest.currency)}.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/product/${id}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/product/${id}`,
      type: "website",
      // Fall back to the site-wide branded card when the product has no photo,
      // so shared links always render with an image.
      images: product.imageUrl
        ? [{ url: product.imageUrl, alt: product.name }]
        : [{ url: absoluteUrl("/opengraph-image"), alt: "GOO — AI Stylist" }],
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
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
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
