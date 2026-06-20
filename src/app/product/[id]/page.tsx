import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductById, getAllProducts, getOutfitsByProductId, getBrandLogos } from "@/lib/data/db";
import ProductClient from "@/components/product/ProductClient";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, absoluteUrl, formatMetaPrice, productJsonLd, breadcrumbJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return {};

  const lowestPrice = product.retailers.length
    ? Math.min(...product.retailers.map((r) => r.price))
    : product.priceMin;

  const title = `${product.name} — ${product.brand} | GOO`;
  const description = product.description
    ? product.description.slice(0, 155)
    : `Shop ${product.name} by ${product.brand}. From ${formatMetaPrice(lowestPrice, product.currency)}.`;

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
  const product = await getProductById(id);
  if (!product) notFound();

  const variantIds = [product.id, ...(product.variants?.map((v) => v.id) ?? [])];

  const [allProducts, outfitsWithProduct, retailerLogos] = await Promise.all([
    getAllProducts(),
    getOutfitsByProductId(variantIds),
    getBrandLogos(),
  ]);
  const relatedProducts = allProducts
    .filter((p) => p.id !== product.id && p.category === product.category)
    .slice(0, 4);

  const lowestPrice = product.retailers.length
    ? Math.min(...product.retailers.map((r) => r.price))
    : product.priceMin;

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
          lowestPrice={lowestPrice}
          retailerLogos={retailerLogos}
        />
      </div>
    </div>
  );
}
