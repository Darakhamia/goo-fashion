// The product page on desktop, from src/components/product/ProductClient.tsx:
// breadcrumbs, the thumbnail rail and 3:4 main photo (:233-321), the info
// card (:323-512) and "Where to buy" (:513-660). Store rows are the app's desktop
// rows sorted by price, cheapest first with its "Best" badge; the logo is the
// app's own fallback monogram (RetailerLogo, :778), since the live logos come
// from the network. The cheapest row's highlight uses the row's hover classes.
import React from "react";
import { Img } from "remotion";
import type { Product, Retailer } from "@/lib/types";
import { photoBackdrop } from "@/lib/image";
import { formatPrice } from "../../shims/currency-context";

function RetailerLogo({ name }: { name: string }) {
  return (
    <div className="w-10 h-10 shrink-0 rounded-full bg-white border border-[var(--border)] flex items-center justify-center overflow-hidden">
      <span className="text-[11px] font-bold text-[var(--foreground-muted)] flex items-center justify-center w-full h-full">
        {name.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
}

export const PRODUCT_GEOMETRY = {
  /** Where the main photo sits in the page (CSS px), for the match cut. */
  /** md:grid-cols-[minmax(0,460px)_1fr], lg: 620px; the rail is md:w-16, lg:w-20. */
  columns: (width: number) => {
    const lg = width >= 1024;
    const left = lg ? 620 : 460;
    const rail = lg ? 80 : 64;
    return { lg, left, rail };
  },
  mainImage: (width: number) => {
    const { left, rail } = PRODUCT_GEOMETRY.columns(width);
    const w = left - rail - 12;
    return { x: 48 + rail + 12, y: 32 + 15 + 48, w, h: (w * 4) / 3 };
  },
};

export function ProductPage({
  width,
  product,
  stores,
  rowsIn,
  best,
  mainImage = 1,
  priceIn = 1,
}: {
  width: number;
  product: Product;
  stores: Retailer[];
  rowsIn: number[];
  best: number;
  mainImage?: number;
  priceIn?: number;
}) {
  const sorted = [...stores].sort((a, b) => a.price - b.price);
  const lowest = sorted[0]?.price ?? product.priceMin;
  const { lg, left, rail } = PRODUCT_GEOMETRY.columns(width);
  const thumb = lg ? "w-20 h-20" : "w-16 h-16";
  const crumbs = ["Home", "Browse", "Footwear", "Sneakers", "Men", "Multicolor", product.brand, product.name];
  return (
    <div style={{ width }} className="bg-[var(--background)] text-[var(--foreground)] px-12 pb-24">
      <nav className="pt-8 flex items-center gap-3 overflow-hidden whitespace-nowrap text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">
        {crumbs.map((c, i) => (
          <span key={i} className={`flex items-center gap-3 ${i === crumbs.length - 1 ? "min-w-0" : "shrink-0"}`}>
            {i > 0 && <span className="shrink-0">/</span>}
            <span className={i === crumbs.length - 1 ? "min-w-0 truncate text-[var(--foreground)]" : "shrink-0"}>{c}</span>
          </span>
        ))}
      </nav>

      <div className="mt-12 grid gap-10" style={{ gridTemplateColumns: `minmax(0,${left}px) minmax(0,1fr)` }}>
        {/* Gallery: thumbnail rail + main photo */}
        <div className="flex flex-row gap-3">
          <div className="relative shrink-0" style={{ width: rail }}>
            <div className="absolute inset-0 flex flex-col gap-2 overflow-hidden">
              {product.images.map((src, i) => (
                <div
                  key={src}
                  className={`relative ${thumb} shrink-0 rounded-lg overflow-hidden bg-white ${
                    i === 0 ? "opacity-100 ring-2 ring-[var(--foreground)] rounded-lg" : "opacity-50"
                  }`}
                  style={photoBackdrop(product.bgColor)}
                >
                  <Img src={src} alt="" className="absolute inset-0 w-full h-full object-contain" />
                </div>
              ))}
            </div>
          </div>
          <div
            className="flex-1 min-w-0 self-start rounded-2xl overflow-hidden border border-[var(--border)] bg-white"
            style={{ ...photoBackdrop(product.bgColor), opacity: mainImage }}
          >
            <div className="relative aspect-[3/4] overflow-hidden bg-white" style={photoBackdrop(product.bgColor)} data-match="to">
              <Img src={product.imageUrl} alt={`${product.name} by ${product.brand}`} className="absolute inset-0 w-full h-full object-contain" />
              {product.isNew && (
                <div className="absolute top-4 left-4">
                  <span className="text-[9px] tracking-[0.16em] uppercase font-medium bg-[var(--bg-overlay-90)] text-[var(--foreground)] rounded-full px-3 py-1.5 block">New</span>
                </div>
              )}
              <span className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-black/80 rounded-full">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="text-white">
                  <path
                    d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
                </svg>
              </span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] px-10 py-12 flex flex-col">
          <div className="mb-6">
            <p className="text-[10px] tracking-[0.2em] uppercase font-medium text-[var(--foreground-subtle)] mb-2">{product.brand}</p>
            <h1 className="text-4xl font-bold tracking-[-0.015em] text-[var(--foreground)] leading-tight">{product.name}</h1>
          </div>
          <div className="mb-8 pb-8 border-b border-[var(--border)]" style={{ opacity: priceIn }}>
            <p className="text-2xl font-bold text-[var(--foreground)]">From {formatPrice(lowest)}</p>
            <p className="text-xs text-[var(--foreground-muted)] mt-1">Price varies by retailer · All prices include tax</p>
          </div>
          {product.description && (
            <div className="mb-8">
              <p className="text-base text-[var(--foreground-muted)] leading-relaxed">{product.description}</p>
            </div>
          )}
          <div className="mb-8">
            <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-3">Available in</p>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((c) => (
                <span key={c} className="relative rounded-full px-4 py-1.5 text-xs border border-[var(--border)] text-[var(--foreground-muted)]">{c}</span>
              ))}
            </div>
          </div>

          {/* Where to buy */}
          <div id="where-to-buy" data-focus="where-to-buy">
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]">Where to buy</h2>
              <span className="shrink-0 text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] border border-[var(--border)] rounded-full px-2.5 py-1">
                {sorted.length} stores
              </span>
            </div>
            <div className="space-y-2">
              {sorted.map((r, i) => {
                const inT = rowsIn[i] ?? 1;
                const hi = i === 0 ? best : 0;
                return (
                  <div
                    key={r.name}
                    className="flex flex-row items-center gap-3 p-3.5 border rounded-xl"
                    style={{
                      opacity: inT,
                      transform: `translateY(${(1 - inT) * 14}px)`,
                      borderColor: hi > 0 ? `color-mix(in srgb, var(--border-strong) ${hi * 100}%, var(--border))` : "var(--border)",
                      background: hi > 0 ? `color-mix(in srgb, var(--surface) ${hi * 100}%, transparent)` : undefined,
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <RetailerLogo name={r.name} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-[var(--foreground)] truncate">{r.name}</p>
                          {i === 0 && (
                            <span
                              className="shrink-0 text-[8px] tracking-[0.14em] uppercase font-medium text-[var(--foreground)] bg-[var(--fg-overlay-08)] rounded-full px-2 py-0.5"
                              style={{ opacity: best, transform: `scale(${0.6 + 0.4 * best})`, display: "inline-block" }}
                            >
                              Best
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="self-stretch w-px bg-[var(--border)] shrink-0" />
                    <div className="flex items-center justify-end gap-4 shrink-0">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] tracking-[0.12em] uppercase text-[var(--foreground-muted)]">{r.availability}</span>
                          <span className={`w-1 h-1 rounded-full shrink-0 ${r.availability === "in stock" ? "bg-green-500" : "bg-amber-500"}`} />
                        </div>
                        <p className="text-base font-medium text-[var(--foreground)] mt-0.5">{formatPrice(r.price)}</p>
                      </div>
                      <span
                        className="shrink-0 flex items-center gap-1.5 rounded-full border text-xs px-3.5 py-2"
                        style={{
                          borderColor: hi > 0.5 ? "var(--foreground)" : "var(--border-strong)",
                          color: hi > 0.5 ? "var(--foreground)" : "var(--foreground-muted)",
                        }}
                      >
                        View on Store
                        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden>
                          <path d="M4 10L10 4M10 4H5M10 4V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[10px] text-[var(--foreground-subtle)]">Prices updated regularly. GOO is not responsible for pricing changes.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
