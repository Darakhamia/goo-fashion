// The browse page at a desktop width, from src/app/browse/BrowseClient.tsx:
// page header (:1328), toolbar (:1491), active filter chips (:1660, ActiveChip
// :82) and the product grid (:1843) of real ProductCards (vendored verbatim).
// Responsive classes are resolved to the md/sm branch the panel width shows;
// the open/closed state and the switch come from the scene, not useState.
import React from "react";
import ProductCard from "@/components/product/ProductCard";
import type { Product } from "@/lib/types";

export type CardState = { opacity: number; y: number; blur: number };

function ActiveChip({ label }: { label: string }) {
  // ActiveChip's md: branch.
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-transparent text-[9px] tracking-[0.10em] uppercase border border-[var(--foreground)] text-[var(--foreground)] px-2.5 py-1 capitalize">
      {label}
      <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
        <path d="M1 1L6 6M6 1L1 6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function Toolbar() {
  const pill = "flex items-center gap-2 text-[11px] tracking-[0.14em] uppercase font-bold border rounded-full px-5 py-2.5";
  return (
    <div className="pt-4 pb-4 border-b border-[var(--border)]">
      <div className="flex items-end gap-x-3 flex-nowrap">
        <div className="flex flex-col gap-3 shrink-0">
          <div className="flex gap-2 items-center">
            <span className={`shrink-0 ${pill} border-[var(--foreground-muted)] text-[var(--foreground)]`}>
              <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                <path d="M1 1.5H12M3 5H10M5 8.5H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Filter
              <span className="w-4 h-4 rounded-full bg-[var(--foreground)] text-[var(--background)] text-[8px] font-bold flex items-center justify-center">1</span>
            </span>
            <span className={`${pill} border-[var(--foreground-muted)] text-[var(--foreground)]`}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Search
            </span>
          </div>
          {/* Pieces/Outfits pill */}
          <div className="w-full relative flex border border-[var(--foreground-muted)] rounded-full overflow-hidden">
            <div className="absolute inset-y-0 w-1/2 bg-[var(--foreground)] rounded-full" />
            {["pieces", "outfits"].map((v) => (
              <span
                key={v}
                className="relative z-10 flex-1 py-2.5 text-[11px] tracking-[0.14em] uppercase font-bold whitespace-nowrap text-center"
                style={{ color: v === "pieces" ? "var(--background)" : "var(--foreground-muted)" }}
              >
                {v}
              </span>
            ))}
          </div>
        </div>
        <div className="relative shrink-0 ml-auto self-end">
          <span className={`${pill} border-[var(--foreground-muted)] text-[var(--foreground)]`}>
            <svg width="11" height="10" viewBox="0 0 11 10" fill="none">
              <path d="M1 1.5H10M2.5 5H8.5M4 8.5H7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Featured
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

export function BrowsePage({
  width,
  chips,
  grid,
  gridShift = { opacity: 1, y: 0 },
}: {
  width: number;
  /** Active filter chips, each with its own enter/exit state. */
  chips: { label: string; opacity: number; scale: number }[];
  grid: { product: Product; state: CardState }[];
  /** The whole grid's swap (AnimatePresence in the app: opacity + 8px). */
  gridShift?: { opacity: number; y: number };
}) {
  return (
    <div style={{ width }} className="bg-[var(--background)] text-[var(--foreground)]">
      <div className="px-12 pt-16">
        <div className="mb-8">
          <h1 className="text-8xl font-black uppercase text-[var(--foreground)] leading-none tracking-tight">Browse</h1>
          <p className="mt-3 text-sm font-medium text-[var(--foreground-muted)] max-w-xs leading-relaxed">
            Curated pieces from the world&apos;s most forward-thinking brands.
          </p>
          <div className="mt-6 border-t border-[var(--border)]" />
        </div>
      </div>
      <div className="px-10">
        <Toolbar />
        <div className="flex items-center gap-2 flex-wrap pt-4" style={{ minHeight: 38 }}>
          {chips.map((c) =>
            c.opacity > 0 ? (
              <div key={c.label} style={{ opacity: c.opacity, transform: `scale(${c.scale})` }}>
                <ActiveChip label={c.label} />
              </div>
            ) : null,
          )}
        </div>
        <div className="mt-10 pb-16" style={{ opacity: gridShift.opacity, transform: `translateY(${gridShift.y}px)` }}>
          <div className="grid grid-cols-3 gap-4">
            {grid.map(({ product, state }) => (
              <div
                key={product.id}
                style={{
                  opacity: state.opacity,
                  transform: `translateY(${state.y}px)`,
                  filter: state.blur > 0.05 ? `blur(${state.blur}px)` : undefined,
                }}
              >
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
