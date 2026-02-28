import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductById, getAllProducts } from "@/lib/data/db";
import ProductCard from "@/components/product/ProductCard";
import ProductGallery from "@/components/product/ProductGallery";

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
        {/* Breadcrumb */}
        <div className="pt-8 flex items-center gap-3 text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">
          <Link href="/" className="hover:text-[var(--foreground)] transition-colors duration-200">
            Home
          </Link>
          <span>/</span>
          <Link href="/browse" className="hover:text-[var(--foreground)] transition-colors duration-200">
            Browse
          </Link>
          <span>/</span>
          <span className="text-[var(--foreground)] capitalize">{product.category}</span>
          <span>/</span>
          <span className="text-[var(--foreground-muted)]">{product.name}</span>
        </div>

        {/* Main */}
        <div className="mt-8 md:mt-12 grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--border)]">
          {/* Left: Gallery (interactive: thumbnails + color switching) */}
          <div className="bg-[var(--background)]">
            <ProductGallery
              images={product.images?.length ? product.images : [product.imageUrl]}
              colors={product.colors ?? []}
              colorImages={product.colorImages}
              productName={product.name}
              isNew={product.isNew}
            />
          </div>

          {/* Right: Product Info */}
          <div className="bg-[var(--background)] px-6 md:px-10 py-8 md:py-12">
            {/* Brand + Name */}
            <div className="mb-6">
              <p className="text-[10px] tracking-[0.2em] uppercase font-medium text-[var(--foreground-subtle)] mb-2">
                {product.brand}
              </p>
              <h1 className="font-display text-3xl md:text-4xl font-light text-[var(--foreground)] leading-tight">
                {product.name}
              </h1>
            </div>

            {/* Price */}
            <div className="mb-8 pb-8 border-b border-[var(--border)]">
              <p className="font-display text-2xl font-light text-[var(--foreground)]">
                From ${lowestPrice.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                Price varies by retailer · All prices include tax
              </p>
            </div>

            {/* Description */}
            <div className="mb-8">
              <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Material */}
            <div className="mb-8 pb-8 border-b border-[var(--border)]">
              <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-2">
                Material
              </p>
              <p className="text-sm text-[var(--foreground-muted)]">{product.material}</p>
            </div>

            {/* Sizes */}
            <div className="mb-10 pb-8 border-b border-[var(--border)]">
              <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-3">
                Sizes
              </p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    className="text-xs text-[var(--foreground-muted)] border border-[var(--border)] w-10 h-10 flex items-center justify-center hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors duration-200"
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── PRICE COMPARISON ─── */}
            {/* Designed to feel editorial, not marketplace */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
                  Where to buy
                </p>
                <p className="text-[10px] text-[var(--foreground-subtle)]">
                  {product.retailers.length} stores
                </p>
              </div>

              <div className="space-y-px">
                {product.retailers
                  .sort((a, b) => a.price - b.price)
                  .map((retailer, i) => {
                    const isLowest = retailer.price === lowestPrice;
                    return (
                      <a
                        key={retailer.name}
                        href={retailer.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center justify-between gap-4 py-4 border-b border-[var(--border)] hover:bg-[var(--surface)] transition-colors duration-200 -mx-6 md:-mx-10 px-6 md:px-10"
                      >
                        <div className="flex items-center gap-3">
                          {i === 0 && (
                            <span className="text-[8px] tracking-[0.14em] uppercase font-medium text-[var(--foreground)] bg-[var(--fg-overlay-08)] px-2 py-1">
                              Best
                            </span>
                          )}
                          <div>
                            <p className="text-sm text-[var(--foreground)]">{retailer.name}</p>
                            {retailer.isOfficial && (
                              <p className="text-[9px] tracking-[0.1em] text-[var(--foreground-subtle)] mt-0.5">
                                Official store
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <p className="text-sm text-[var(--foreground)] font-medium">
                              ${retailer.price.toLocaleString()}
                            </p>
                            <p
                              className={`text-[9px] tracking-[0.1em] mt-0.5 ${
                                retailer.availability === "in stock"
                                  ? "text-[var(--foreground-subtle)]"
                                  : retailer.availability === "low stock"
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-[var(--foreground-subtle)] line-through"
                              }`}
                            >
                              {retailer.availability}
                            </p>
                          </div>
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            className="text-[var(--foreground-subtle)] group-hover:text-[var(--foreground)] transition-colors duration-200"
                          >
                            <path
                              d="M2 6H10M7 3L10 6L7 9"
                              stroke="currentColor"
                              strokeWidth="1.1"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </a>
                    );
                  })}
              </div>

              <p className="text-[10px] text-[var(--foreground-subtle)] mt-4">
                Prices updated regularly. GOO is not responsible for pricing changes.
              </p>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-20 md:mt-28 mb-4">
            <div className="mb-8">
              <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
                More {product.category}
              </p>
              <h2 className="font-display text-2xl md:text-3xl font-light text-[var(--foreground)]">
                You may also like
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border)]">
              {relatedProducts.map((related) => (
                <div key={related.id} className="bg-[var(--background)] p-4">
                  <ProductCard product={related} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
