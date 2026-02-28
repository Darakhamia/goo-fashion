import { notFound } from "next/navigation";
import { getProductById, getAllProducts } from "@/lib/data/db";
import ProductClient from "@/components/product/ProductClient";

interface Props {
  params: Promise<{ id: string }>;
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
        />
      </div>
    </div>
  );
}
