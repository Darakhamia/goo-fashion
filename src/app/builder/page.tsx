"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { products } from "@/lib/data/products";
import { Product } from "@/lib/types";

// ── Slot definitions ────────────────────────────────────────────────────────
type SlotId = "top" | "bottom" | "shoes" | "accessories";

const SLOTS: {
  id: SlotId;
  label: string;
  sub: string;
  categories: string[];
  icon: string;
}[] = [
  {
    id: "top",
    label: "Верх",
    sub: "Top",
    categories: ["tops", "knitwear", "outerwear"],
    icon: "M8 2C8 2 4 4 4 8H12C12 4 8 2 8 2Z M5 8H11V13H5Z",
  },
  {
    id: "bottom",
    label: "Низ",
    sub: "Bottom",
    categories: ["bottoms", "dresses"],
    icon: "M5 2H11L13 14H3L5 2Z",
  },
  {
    id: "shoes",
    label: "Обувь",
    sub: "Shoes",
    categories: ["footwear"],
    icon: "M2 11C2 11 5 10 8 10C10 10 13 11 14 11V13C14 13 10 14 8 14C6 14 2 13 2 13V11Z M8 10V7C8 7 9 4 12 4",
  },
  {
    id: "accessories",
    label: "Аксессуары",
    sub: "Accessories",
    categories: ["accessories"],
    icon: "M4 6H12V12C12 13.1 11.1 14 10 14H6C4.9 14 4 13.1 4 12V6Z M6 6V4C6 2.9 6.9 2 8 2C9.1 2 10 2.9 10 4V6",
  },
];

// ── Slot icon SVG paths ──────────────────────────────────────────────────────
function SlotIcon({ id, size = 16 }: { id: SlotId; size?: number }) {
  const paths: Record<SlotId, React.ReactNode> = {
    top: (
      <>
        <path d="M6 2L2 5V7L4 6V14H12V6L14 7V5L10 2C10 2 9.5 4 8 4C6.5 4 6 2 6 2Z" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinejoin="round" />
      </>
    ),
    bottom: (
      <>
        <path d="M4 2H12L13 8H9L8 14H8H8L7 8H3L4 2Z" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinejoin="round" />
      </>
    ),
    shoes: (
      <>
        <path d="M2 11.5C2 11.5 4 10 7 10C9 10 10 11 11 11H13.5C13.5 11 14 11 14 12V13H2V11.5Z" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinejoin="round" />
        <path d="M7 10V7.5C7 7.5 7.5 5 10 5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </>
    ),
    accessories: (
      <>
        <rect x="3" y="6" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.1" fill="none" />
        <path d="M6 6V4.5C6 3.7 6.7 3 7.5 3H8.5C9.3 3 10 3.7 10 4.5V6" stroke="currentColor" strokeWidth="1.1" fill="none" />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      {paths[id]}
    </svg>
  );
}

// ── Empty slot placeholder ───────────────────────────────────────────────────
function EmptySlotCard({ slot }: { slot: typeof SLOTS[0] }) {
  return (
    <div className="aspect-[3/4] flex flex-col items-center justify-center border border-dashed border-[var(--border)] bg-[var(--surface)] gap-3">
      <div className="text-[var(--foreground-subtle)]">
        <SlotIcon id={slot.id} size={24} />
      </div>
      <div className="text-center">
        <p className="text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] font-medium">
          {slot.label}
        </p>
        <p className="text-[9px] text-[var(--foreground-subtle)] mt-0.5">{slot.sub}</p>
      </div>
    </div>
  );
}

// ── Product row in the left panel ────────────────────────────────────────────
function ProductRow({
  product,
  selected,
  onSelect,
}: {
  product: Product;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 group ${
        selected
          ? "bg-[var(--foreground)]"
          : "bg-transparent hover:bg-[var(--surface)]"
      }`}
    >
      {/* Thumbnail */}
      <div className="w-12 h-12 shrink-0 overflow-hidden bg-[var(--surface)]">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-[11px] font-medium leading-tight truncate ${
            selected ? "text-[var(--background)]" : "text-[var(--foreground)]"
          }`}
        >
          {product.name}
        </p>
        <p
          className={`text-[10px] mt-0.5 ${
            selected ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"
          }`}
        >
          {product.brand}
        </p>
      </div>

      {/* Price */}
      <div className="shrink-0 text-right">
        <p
          className={`text-[11px] font-medium ${
            selected ? "text-[var(--background)]" : "text-[var(--foreground)]"
          }`}
        >
          ${product.priceMin}
        </p>
        {selected && (
          <svg className="mt-0.5 ml-auto" width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ConstructorPage() {
  const [activeSlot, setActiveSlot] = useState<SlotId>("top");
  const [selection, setSelection] = useState<Partial<Record<SlotId, Product>>>({});
  const [saved, setSaved] = useState(false);

  // Filter products per active slot
  const slotProducts = useMemo(() => {
    const slot = SLOTS.find((s) => s.id === activeSlot)!;
    return products.filter((p) => slot.categories.includes(p.category));
  }, [activeSlot]);

  const totalPrice = useMemo(() => {
    return Object.values(selection).reduce((sum, p) => sum + (p?.priceMin ?? 0), 0);
  }, [selection]);

  const selectedCount = Object.values(selection).filter(Boolean).length;

  const selectProduct = (product: Product) => {
    setSelection((prev) => {
      const current = prev[activeSlot];
      // Toggle off if same product selected
      if (current?.id === product.id) {
        const next = { ...prev };
        delete next[activeSlot];
        return next;
      }
      return { ...prev, [activeSlot]: product };
    });
    setSaved(false);
  };

  const clearAll = () => {
    setSelection({});
    setSaved(false);
  };

  return (
    <div className="pt-16 min-h-screen flex flex-col">
      {/* ── Page header ── */}
      <div className="border-b border-[var(--border)] bg-[var(--background)]">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 h-12 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
              Constructor
            </p>
            {selectedCount > 0 && (
              <span className="text-[10px] tracking-[0.1em] text-[var(--foreground-muted)] animate-fade-in">
                {selectedCount} piece{selectedCount !== 1 ? "s" : ""} selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-5">
            {selectedCount > 0 && (
              <button
                onClick={clearAll}
                className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200 animate-fade-in"
              >
                Clear all
              </button>
            )}
            <Link
              href="/browse"
              className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200"
            >
              ← Browse
            </Link>
          </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex flex-1 max-w-[1440px] mx-auto w-full">

        {/* ── LEFT PANEL ── */}
        <aside className="w-[300px] lg:w-[340px] shrink-0 border-r border-[var(--border)] flex flex-col sticky top-[calc(4rem+3rem)] self-start max-h-[calc(100vh-7rem)] overflow-hidden">

          {/* Slot tabs */}
          <div className="border-b border-[var(--border)] p-3 grid grid-cols-4 gap-1">
            {SLOTS.map((slot) => {
              const isActive = activeSlot === slot.id;
              const hasPick = !!selection[slot.id];
              return (
                <button
                  key={slot.id}
                  onClick={() => setActiveSlot(slot.id)}
                  className={`relative flex flex-col items-center gap-1.5 py-3 px-1 transition-all duration-200 ${
                    isActive
                      ? "bg-[var(--foreground)] text-[var(--background)]"
                      : "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
                  }`}
                >
                  <SlotIcon id={slot.id} size={16} />
                  <span className="text-[9px] tracking-[0.08em] uppercase font-medium leading-none">
                    {slot.sub}
                  </span>
                  {/* Picked dot */}
                  {hasPick && (
                    <span
                      className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                        isActive ? "bg-[var(--background)]" : "bg-[var(--foreground)]"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Active slot label */}
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div>
              <p className="text-[10px] tracking-[0.14em] uppercase font-medium text-[var(--foreground-subtle)]">
                {SLOTS.find((s) => s.id === activeSlot)?.label}
              </p>
              <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">
                {slotProducts.length} items
              </p>
            </div>
            {selection[activeSlot] && (
              <button
                onClick={() => {
                  setSelection((prev) => {
                    const next = { ...prev };
                    delete next[activeSlot];
                    return next;
                  });
                }}
                className="text-[9px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
              >
                Remove
              </button>
            )}
          </div>

          {/* Product list */}
          <div className="flex-1 overflow-y-auto">
            {slotProducts.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-[var(--foreground-muted)]">
                  No items available for this category yet.
                </p>
                <Link
                  href="/browse"
                  className="text-xs text-[var(--foreground)] link-underline mt-2 inline-block"
                >
                  Browse all →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {slotProducts.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    selected={selection[activeSlot]?.id === product.id}
                    onSelect={() => selectProduct(product)}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* ── RIGHT PANEL ── */}
        <main className="flex-1 flex flex-col min-h-[calc(100vh-7rem)]">

          {/* Outfit grid */}
          <div className="flex-1 p-6 md:p-10">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-baseline justify-between mb-8">
                <div>
                  <h1 className="font-display text-3xl md:text-4xl font-light text-[var(--foreground)]">
                    Your Outfit
                  </h1>
                  <p className="text-xs text-[var(--foreground-muted)] mt-1">
                    {selectedCount === 0
                      ? "Select pieces from the panel to build your look."
                      : `${selectedCount} of 4 pieces chosen`}
                  </p>
                </div>
                {selectedCount > 0 && (
                  <p className="font-display text-2xl font-light text-[var(--foreground)] animate-fade-in">
                    ${totalPrice.toLocaleString()}
                  </p>
                )}
              </div>

              {/* 2×2 preview grid */}
              <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
                {SLOTS.map((slot) => {
                  const picked = selection[slot.id];
                  return (
                    <button
                      key={slot.id}
                      onClick={() => setActiveSlot(slot.id)}
                      className={`group relative block overflow-hidden bg-[var(--background)] transition-all duration-200 ${
                        activeSlot === slot.id ? "ring-2 ring-[var(--foreground)] ring-inset" : ""
                      }`}
                    >
                      {picked ? (
                        <div className="img-zoom aspect-[3/4]">
                          <img
                            src={picked.imageUrl}
                            alt={picked.name}
                            className="w-full h-full object-cover"
                          />
                          {/* Overlay on hover */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-end">
                            <div className="w-full p-3 translate-y-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                              <p className="text-[10px] tracking-[0.1em] uppercase font-medium text-white truncate">
                                {picked.brand}
                              </p>
                              <p className="text-xs text-white/80 truncate">{picked.name}</p>
                            </div>
                          </div>
                          {/* Slot label badge */}
                          <div className="absolute top-3 left-3">
                            <span className="text-[8px] tracking-[0.14em] uppercase font-medium bg-white/90 text-black px-2 py-1">
                              {slot.label}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <EmptySlotCard slot={slot} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Style tags */}
              {selectedCount > 0 && (
                <div className="mt-6 flex flex-wrap gap-2 animate-fade-up">
                  {Array.from(
                    new Set(
                      Object.values(selection)
                        .filter(Boolean)
                        .flatMap((p) => p!.styleKeywords)
                    )
                  ).map((kw) => (
                    <span
                      key={kw}
                      className="text-[9px] tracking-[0.12em] uppercase font-medium text-[var(--foreground-muted)] border border-[var(--border)] px-3 py-1"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Bottom action bar ── */}
          <div className="border-t border-[var(--border)] px-6 md:px-10 py-4 flex items-center justify-between bg-[var(--background)]">
            <div>
              {selectedCount > 0 ? (
                <div className="animate-fade-in">
                  <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)]">
                    Estimated total
                  </p>
                  <p className="font-display text-xl font-light text-[var(--foreground)] mt-0.5">
                    ${totalPrice.toLocaleString()}
                    <span className="text-xs font-sans text-[var(--foreground-muted)] ml-1">USD</span>
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[var(--foreground-muted)]">
                  No pieces selected yet
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {selectedCount >= 2 && (
                <button
                  onClick={() => setSaved(true)}
                  className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-6 py-3 hover:opacity-80 transition-opacity duration-200 animate-fade-in"
                >
                  {saved ? "Saved ✓" : "Save outfit"}
                </button>
              )}
              {selectedCount >= 1 && (
                <Link
                  href="/browse"
                  className="text-xs tracking-[0.12em] uppercase font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200 border border-[var(--border)] px-6 py-3 hover:border-[var(--border-strong)]"
                >
                  Find more →
                </Link>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
