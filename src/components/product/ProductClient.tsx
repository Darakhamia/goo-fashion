"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import type { Product, ProductSwatch } from "@/lib/types";
import { useCurrency } from "@/lib/context/currency-context";
import ProductCard from "./ProductCard";
import { StylistDrawer } from "@/components/stylist/StylistDrawer";
import { track } from "@/lib/analytics/track";

interface Props {
  product: Product;
  relatedProducts: Product[];
  lowestPrice: number;
  allProducts: Product[];
}

export default function ProductClient({ product, relatedProducts, lowestPrice, allProducts }: Props) {
  // Auto-select the first color that has dedicated images, so the gallery is
  // populated on first render without requiring the user to click a swatch.
  const { formatPrice } = useCurrency();
  const defaultColor = useMemo(() => {
    if (!product.colorImages) return null;
    return product.colors.find((c) => (product.colorImages![c]?.length ?? 0) > 0) ?? null;
  }, [product]);

  const [selectedColor, setSelectedColor] = useState<string | null>(defaultColor);
  const [activeIdx, setActiveIdx] = useState(0);
  const [imgVisible, setImgVisible] = useState(true);
  const [stylistOpen, setStylistOpen] = useState(false);

  useEffect(() => {
    track("product_view", { targetId: product.id });
  }, [product.id]);

  // Resolve which images to display
  const displayImages = useMemo(() => {
    if (selectedColor && product.colorImages?.[selectedColor]?.length) {
      return product.colorImages[selectedColor];
    }
    const imgs = (product.images ?? []).filter(Boolean);
    return imgs.length ? imgs : [product.imageUrl].filter(Boolean);
  }, [selectedColor, product]);

  // Fade-transition to a given index
  const goTo = (newIdx: number) => {
    setImgVisible(false);
    setTimeout(() => {
      setActiveIdx(newIdx);
      setImgVisible(true);
    }, 260);
  };

  // Reset to first image (with fade) when color changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImgVisible(false);
    const t = setTimeout(() => { setActiveIdx(0); setImgVisible(true); }, 260);
    return () => clearTimeout(t);
  }, [selectedColor]);

  const mainImage = displayImages[activeIdx] || product.imageUrl || "";

  return (
    <>
      {/* Breadcrumb */}
      <div className="pt-8 flex items-center gap-3 text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">
        <Link href="/" className="hover:text-[var(--foreground)] transition-colors duration-200">Home</Link>
        <span>/</span>
        <Link href="/browse" className="hover:text-[var(--foreground)] transition-colors duration-200">Browse</Link>
        <span>/</span>
        <span className="text-[var(--foreground)] capitalize">{product.category}</span>
        <span>/</span>
        <span className="text-[var(--foreground-muted)]">{product.name}</span>
      </div>

      {/* Main grid */}
      <div className="mt-8 md:mt-12 grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--border)]">

        {/* ── Left: Image gallery ── */}
        <div className="bg-[var(--background)]">
          {/* Main image */}
          <div className="relative aspect-[3/4] overflow-hidden bg-[var(--surface)]">
            {mainImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mainImage}
                alt={product.name}
                className="w-full h-full object-cover transition-opacity duration-[260ms] ease-in-out"
                style={{ opacity: imgVisible ? 1 : 0 }}
              />
            ) : (
              <div className="w-full h-full bg-[var(--surface)]" />
            )}
            {product.isNew && (
              <div className="absolute top-4 left-4">
                <span className="text-[9px] tracking-[0.16em] uppercase font-medium bg-[var(--bg-overlay-90)] backdrop-blur-sm text-[var(--foreground)] px-3 py-1.5 block">
                  New
                </span>
              </div>
            )}
          </div>

          {/* Thumbnail strip — only when there are multiple images */}
          {displayImages.length > 1 && (
            <div className="flex gap-px mt-px">
              {displayImages.map((img, i) => (
                <button
                  key={`${img}-${i}`}
                  onClick={() => goTo(i)}
                  className={`flex-1 aspect-square overflow-hidden transition-opacity duration-150 ${
                    i === activeIdx ? "opacity-100 ring-1 ring-inset ring-[var(--foreground)]" : "opacity-50 hover:opacity-80"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt={`${product.name} ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Product info ── */}
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
              From {formatPrice(lowestPrice)}
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

          {/* AI Stylist trigger */}
          <div className="mb-8">
            <button
              onClick={() => setStylistOpen(true)}
              className="flex items-center gap-3 w-full border border-[var(--border-strong)] px-4 py-3 hover:border-[var(--foreground)] transition-colors duration-150 group"
            >
              <div className="w-6 h-6 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center font-display text-[11px] font-medium italic shrink-0">
                G
              </div>
              <div className="text-left flex-1">
                <p className="text-[11px] font-medium text-[var(--foreground)]">Ask the Stylist</p>
                <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5">How to wear it, what goes with it, outfit ideas</p>
              </div>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[var(--foreground-subtle)] group-hover:text-[var(--foreground)] transition-colors shrink-0">
                <path d="M2 6H10M7 3L10 6L7 9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Material */}
          {product.material && (
            <div className="mb-8 pb-8 border-b border-[var(--border)]">
              <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-2">
                Material
              </p>
              <p className="text-sm text-[var(--foreground-muted)]">{product.material}</p>
            </div>
          )}

          {/* Variant color swatches — navigate to sibling product pages */}
          {product.variants && product.variants.length > 1 && (
            <div className="mb-6">
              <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-3">
                Color
                <span className="ml-2 normal-case text-[var(--foreground)]">
                  — {product.variants.find((v: ProductSwatch) => v.id === product.id)?.colorName ?? product.colors?.[0]}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((swatch: ProductSwatch) => {
                  const isCurrent = swatch.id === product.id;
                  return (
                    <Link
                      key={swatch.id}
                      href={`/product/${swatch.id}`}
                      title={swatch.colorName}
                      aria-label={`View in ${swatch.colorName}`}
                      className={`w-7 h-7 border-2 transition-colors duration-150 shrink-0 inline-block ${
                        isCurrent
                          ? "border-[var(--foreground)] scale-110 shadow-sm"
                          : "border-[var(--border)] hover:border-[var(--foreground-muted)]"
                      }`}
                      style={{ backgroundColor: swatch.colorHex, boxShadow: "inset 0 0 0 1.5px rgba(128,128,128,0.4)" }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Colors — only shown when there are no variant swatches */}
          {product.colors.length > 0 && !(product.variants && product.variants.length > 1) && (
            <div className="mb-8">
              <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-3">
                Available in
                {selectedColor && (
                  <span className="ml-2 normal-case text-[var(--foreground)]">— {selectedColor}</span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color) => {
                  const hasImages = !!(product.colorImages?.[color]?.length);
                  return (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`relative text-xs border px-3 py-1.5 transition-colors duration-200 ${
                        selectedColor === color
                          ? "border-[var(--foreground)] text-[var(--foreground)]"
                          : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {color}
                      {hasImages && (
                        <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[var(--foreground)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sizes */}
          {product.sizes.length > 0 && (
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
          )}

          {/* Where to buy */}
          {product.retailers.length > 0 && (
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
                {[...product.retailers]
                  .sort((a, b) => a.price - b.price)
                  .map((retailer, i) => (
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
                            {formatPrice(retailer.price)}
                          </p>
                          <p className={`text-[9px] tracking-[0.1em] mt-0.5 ${
                            retailer.availability === "in stock"
                              ? "text-[var(--foreground-subtle)]"
                              : retailer.availability === "low stock"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-[var(--foreground-subtle)] line-through"
                          }`}>
                            {retailer.availability}
                          </p>
                        </div>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                          className="text-[var(--foreground-subtle)] group-hover:text-[var(--foreground)] transition-colors duration-200">
                          <path d="M2 6H10M7 3L10 6L7 9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </a>
                  ))}
              </div>
              <p className="text-[10px] text-[var(--foreground-subtle)] mt-4">
                Prices updated regularly. GOO is not responsible for pricing changes.
              </p>
            </div>
          )}
        </div>
      </div>

      <StylistDrawer
        isOpen={stylistOpen}
        onClose={() => setStylistOpen(false)}
        surface="product"
        products={allProducts}
        focusProduct={product}
      />

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
    </>
  );
}
