"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Outfit, Product, ProductSwatch } from "@/lib/types";
import { useCurrency } from "@/lib/context/currency-context";
import { useLikes } from "@/lib/context/likes-context";
import { useAuth } from "@/lib/context/auth-context";
import ProductCard from "./ProductCard";
import OutfitCard from "@/components/outfit/OutfitCard";
import dynamic from "next/dynamic";

// Both sit below the fold and fetch their own data — load them after the
// critical product UI instead of shipping them in the page bundle.
const PriceHistoryChart = dynamic(() => import("./PriceHistoryChart"), { ssr: false });
const ProductReviews = dynamic(() => import("./ProductReviews"), { ssr: false });
import { track } from "@/lib/analytics/track";
import { buildStylingNotes } from "@/lib/seo";

interface Props {
  product: Product;
  relatedProducts: Product[];
  outfitsWithProduct: Outfit[];
  lowestPrice: number;
  /** Lower-cased store name → logo URL, from the admin store library. */
  retailerLogos?: Record<string, string>;
}

export default function ProductClient({ product, relatedProducts, outfitsWithProduct, lowestPrice, retailerLogos = {} }: Props) {
  // Auto-select the first color that has dedicated images, so the gallery is
  // populated on first render without requiring the user to click a swatch.
  const { formatPrice } = useCurrency();
  const { isProductLiked, toggleProductLike } = useLikes();
  const { isLoggedIn, login } = useAuth();
  const liked = isProductLiked(product.id);

  const handleLike = () => {
    if (!isLoggedIn) { login("", ""); return; }
    toggleProductLike(product.id);
  };
  const defaultColor = useMemo(() => {
    if (!product.colorImages) return null;
    return product.colors.find((c) => (product.colorImages![c]?.length ?? 0) > 0) ?? null;
  }, [product]);

  const [selectedColor, setSelectedColor] = useState<string | null>(defaultColor);
  const [activeIdx, setActiveIdx] = useState(0);
  const [imgVisible, setImgVisible] = useState(true);

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

  // Unique, data-derived styling copy so the page isn't a thin duplicate of the
  // source catalog feed.
  const styling = useMemo(() => buildStylingNotes(product), [product]);

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
      <div className="mt-8 md:mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">

        {/* ── Left: Image gallery ── */}
        <div>
          {/* Main image */}
          <div className="rounded-2xl overflow-hidden border border-[var(--border)] bg-white">
            <div className="relative aspect-[3/4] overflow-hidden bg-white">
              {mainImage ? (
                <Image
                  src={mainImage}
                  alt={`${product.name} by ${product.brand}`}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-contain transition-opacity duration-[260ms] ease-in-out"
                  style={{ opacity: imgVisible ? 1 : 0 }}
                />
              ) : (
                <div className="w-full h-full bg-white" />
              )}
              {product.isNew && (
                <div className="absolute top-4 left-4">
                  <span className="text-[9px] tracking-[0.16em] uppercase font-medium bg-[var(--bg-overlay-90)] backdrop-blur-sm text-[var(--foreground)] rounded-full px-3 py-1.5 block">
                    New
                  </span>
                </div>
              )}

              {/* Like button */}
              <button
                onClick={handleLike}
                aria-label={!isLoggedIn ? "Sign in to save item" : liked ? "Unlike item" : "Like item"}
                className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-black/80 backdrop-blur-sm rounded-full transition-transform duration-150 hover:scale-110 active:scale-95"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="text-white">
                  <path
                    d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    fill={liked ? "currentColor" : "none"}
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Thumbnail strip — only when there are multiple images */}
          {displayImages.length > 1 && (
            <div className="flex gap-2 mt-3">
              {displayImages.map((img, i) => (
                <button
                  key={`${img}-${i}`}
                  onClick={() => goTo(i)}
                  className={`relative flex-1 aspect-square rounded-lg overflow-hidden bg-white transition-opacity duration-150 ${
                    i === activeIdx ? "opacity-100 ring-2 ring-[var(--foreground)] rounded-lg" : "opacity-50 hover:opacity-80"
                  }`}
                >
                  <Image src={img} alt={`${product.name} ${i + 1}`} fill sizes="120px" className="object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Product info ── */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] px-6 md:px-10 py-8 md:py-12 flex flex-col">

          {/* Brand + Name */}
          <div className="mb-6">
            <p className="text-[10px] tracking-[0.2em] uppercase font-medium text-[var(--foreground-subtle)] mb-2">
              {product.brand}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--foreground)] leading-tight">
              {product.name}
            </h1>
          </div>

          {/* Price */}
          <div className="mb-8 pb-8 border-b border-[var(--border)]">
            <p className="text-2xl font-bold text-[var(--foreground)]">
              From {formatPrice(lowestPrice, product.currency)}
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
                      className={`w-7 h-7 rounded-full transition-all duration-150 shrink-0 inline-block ${isCurrent ? "scale-110" : "hover:scale-105"}`}
                      style={{
                        backgroundColor: swatch.colorHex,
                        boxShadow: isCurrent
                          ? "0 0 0 2px #fff, 0 0 0 4px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.08)"
                          : "0 0 0 1.5px #fff, 0 0 0 3px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(0,0,0,0.08)",
                      }}
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
                      className={`relative rounded-full px-4 py-1.5 text-xs border transition-all duration-200 ${
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
                    className="text-xs text-[var(--foreground-muted)] border border-[var(--border)] rounded-lg w-11 h-11 flex items-center justify-center hover:border-[var(--foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] transition-all duration-200"
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

              <div className="space-y-2">
                {[...product.retailers]
                  .sort((a, b) => a.price - b.price)
                  .map((retailer, i) => {
                    let domain = "";
                    try { domain = new URL(retailer.url).hostname.replace("www.", ""); } catch {}
                    // Prefer the store logo from the admin library (matched by
                    // name); fall back to the site favicon, then to initials.
                    const libraryLogo = retailerLogos[retailer.name.trim().toLowerCase()] ?? null;
                    return (
                    <a
                      key={retailer.name}
                      href={retailer.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between gap-4 p-4 border border-[var(--border)] rounded-xl hover:shadow-sm hover:border-[var(--foreground-muted)] transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        {/* Retailer logo */}
                        <div className="w-10 h-10 shrink-0 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center overflow-hidden">
                          {libraryLogo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={libraryLogo}
                              alt={retailer.name}
                              width={40}
                              height={40}
                              className="w-full h-full object-contain p-1.5"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                                (e.currentTarget.nextSibling as HTMLElement | null)?.style && ((e.currentTarget.nextSibling as HTMLElement).style.display = "flex");
                              }}
                            />
                          ) : domain ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                              alt={retailer.name}
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                                (e.currentTarget.nextSibling as HTMLElement | null)?.style && ((e.currentTarget.nextSibling as HTMLElement).style.display = "flex");
                              }}
                            />
                          ) : null}
                          <span
                            className="text-[11px] font-bold text-[var(--foreground-muted)] hidden items-center justify-center w-full h-full"
                            style={{ display: "none" }}
                          >
                            {retailer.name.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-[var(--foreground)]">{retailer.name}</p>
                            {i === 0 && (
                              <span className="text-[8px] tracking-[0.14em] uppercase font-medium text-[var(--foreground)] bg-[var(--fg-overlay-08)] rounded-full px-2 py-0.5">
                                Best
                              </span>
                            )}
                          </div>
                          {retailer.isOfficial && (
                            <p className="text-[9px] tracking-[0.1em] text-[var(--foreground-subtle)] mt-0.5">
                              Official store
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        {retailer.rating != null && (
                          <div className="text-right hidden sm:block">
                            <div className="flex items-center gap-1 justify-end">
                              {[1,2,3,4,5].map((s) => (
                                <svg key={s} width="9" height="9" viewBox="0 0 12 12" fill={s <= Math.round(retailer.rating!) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" className="text-[var(--foreground-muted)]">
                                  <polygon points="6,1 7.5,4.5 11,4.8 8.5,7 9.3,10.5 6,8.7 2.7,10.5 3.5,7 1,4.8 4.5,4.5" />
                                </svg>
                              ))}
                            </div>
                            {retailer.reviewCount != null && (
                              <p className="text-[8px] text-[var(--foreground-subtle)] mt-0.5 text-right">{retailer.reviewCount.toLocaleString()} reviews</p>
                            )}
                          </div>
                        )}
                        <div className="text-right">
                          <p className="text-sm text-[var(--foreground)] font-medium">
                            {formatPrice(retailer.price, retailer.currency)}
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
                  );
                  })}
              </div>
              <p className="text-[10px] text-[var(--foreground-subtle)] mt-4">
                Prices updated regularly. GOO is not responsible for pricing changes.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* How to wear it — unique on-page styling copy */}
      <section className="mt-16 md:mt-20">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 md:px-10 py-8 md:py-10">
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
            How to wear it
          </p>
          <p className="text-sm md:text-base text-[var(--foreground-muted)] leading-relaxed max-w-2xl">
            {styling.text}
          </p>
          {styling.pairWith.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mr-1">
                Pairs with
              </span>
              {styling.pairWith.map((cat) => (
                <Link
                  key={cat}
                  href={`/browse?category=${cat}`}
                  className="text-[11px] capitalize border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground-muted)] rounded-full px-3 py-1.5 transition-colors duration-200"
                >
                  {cat}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Price history chart */}
      <PriceHistoryChart productId={product.id} />

      {/* User reviews */}
      <ProductReviews productId={product.id} />

      {/* Outfits featuring this item */}
      {outfitsWithProduct.length > 0 && (
        <section className="mt-20 md:mt-28 mb-4">
          <div className="mb-8">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
              Style it with
            </p>
            <h2 className="text-2xl md:text-3xl font-bold uppercase text-[var(--foreground)]">
              Outfits with this piece
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {outfitsWithProduct.slice(0, 4).map((outfit) => (
              <div key={outfit.id} className="rounded-xl bg-[var(--background)] hover:shadow-md transition-all duration-200">
                <OutfitCard outfit={outfit} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="mt-20 md:mt-28 mb-4">
          <div className="mb-8">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
              More {product.category}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold uppercase text-[var(--foreground)]">
              You may also like
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {relatedProducts.map((related) => (
              <div key={related.id} className="rounded-xl bg-[var(--background)] hover:shadow-md transition-all duration-200">
                <ProductCard product={related} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
