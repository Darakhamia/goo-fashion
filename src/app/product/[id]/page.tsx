import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductById, getAllProducts } from "@/lib/data/db";
import ProductClient from "@/components/product/ProductClient";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://goo-fashion.com").replace(/\/$/, "");

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
    : `Shop ${product.name} by ${product.brand}. From $${lowestPrice} ${product.currency}.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/product/${id}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/product/${id}`,
      type: "website",
      images: product.imageUrl ? [{ url: product.imageUrl, alt: product.name }] : [],
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();

  const allProducts = await getAllProducts();
  const relatedProducts = allProducts
    .filter((p) => p.id !== product.id && p.category === product.category)
    .slice(0, 4);

  const lowestPrice = product.retailers.length
    ? Math.min(...product.retailers.map((r) => r.price))
    : product.priceMin;

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <ProductClient
          product={product}
          relatedProducts={relatedProducts}
          lowestPrice={lowestPrice}
          allProducts={allProducts}
        />
      </div>
    </div>
  );
}
