"use client";

import { useState, useMemo } from "react";
import OutfitCard from "@/components/outfit/OutfitCard";
import ProductCard from "@/components/product/ProductCard";
import { outfits } from "@/lib/data/outfits";
import { products } from "@/lib/data/products";

type View = "outfits" | "pieces";
type OccasionFilter = "all" | "casual" | "work" | "evening" | "formal" | "weekend" | "sport";
type CategoryFilter =
  | "all"
  | "outerwear"
  | "tops"
  | "bottoms"
  | "footwear"
  | "accessories"
  | "dresses"
  | "knitwear";

const occasionFilters: OccasionFilter[] = ["all", "casual", "work", "evening", "formal", "weekend", "sport"];
const categoryFilters: CategoryFilter[] = ["all", "outerwear", "tops", "bottoms", "knitwear", "dresses", "footwear", "accessories"];

export default function BrowsePage() {
  const [view, setView] = useState<View>("outfits");
  const [occasionFilter, setOccasionFilter] = useState<OccasionFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOutfits = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return outfits
      .filter((o) => occasionFilter === "all" || o.occasion === occasionFilter)
      .filter(
        (o) =>
          !q ||
          o.name.toLowerCase().includes(q) ||
          o.occasion.toLowerCase().includes(q) ||
          o.styleKeywords.some((k) => k.toLowerCase().includes(q))
      );
  }, [occasionFilter, searchQuery]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return products
      .filter((p) => categoryFilter === "all" || p.category === categoryFilter)
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
  }, [categoryFilter, searchQuery]);

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        {/* Header */}
        <div className="pt-12 md:pt-16 mb-8">
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
            Browse
          </p>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)]">
              The Edit
            </h1>
            {/* Search */}
            <div className="relative md:w-72">
              <input
                type="text"
                placeholder="Search outfits, brands, styles…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-4 py-2.5 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors duration-200 pr-8"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </button>
              ) : (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] pointer-events-none">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* View Toggle + Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-[var(--border)]">
          {/* View Toggle */}
          <div className="flex gap-px bg-[var(--border)] shrink-0">
            {(["outfits", "pieces"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-5 py-2 text-xs tracking-[0.12em] uppercase font-medium transition-colors duration-200 ${
                  view === v
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "bg-[var(--background)] text-[var(--foreground-muted)] hover:bg-[var(--surface)]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {view === "outfits"
              ? occasionFilters.map((f) => (
                  <button
                    key={f}
                    onClick={() => setOccasionFilter(f)}
                    className={`text-[9px] tracking-[0.14em] uppercase px-3 py-1.5 border transition-colors duration-200 capitalize ${
                      occasionFilter === f
                        ? "border-[var(--foreground)] text-[var(--foreground)] bg-[var(--fg-overlay-05)]"
                        : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {f}
                  </button>
                ))
              : categoryFilters.map((f) => (
                  <button
                    key={f}
                    onClick={() => setCategoryFilter(f)}
                    className={`text-[9px] tracking-[0.14em] uppercase px-3 py-1.5 border transition-colors duration-200 capitalize ${
                      categoryFilter === f
                        ? "border-[var(--foreground)] text-[var(--foreground)] bg-[var(--fg-overlay-05)]"
                        : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {f}
                  </button>
                ))}
          </div>
        </div>

        {/* Count */}
        <div className="mb-6">
          <p className="text-xs text-[var(--foreground-subtle)]">
            {view === "outfits" ? filteredOutfits.length : filteredProducts.length}{" "}
            {view === "outfits" ? "outfits" : "pieces"}
            {searchQuery && <span className="ml-1">for &ldquo;{searchQuery}&rdquo;</span>}
          </p>
        </div>

        {/* Grid */}
        {view === "outfits" ? (
          filteredOutfits.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-px bg-[var(--border)]">
              {filteredOutfits.map((outfit) => (
                <div key={outfit.id} className="bg-[var(--background)] p-3">
                  <OutfitCard outfit={outfit} />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-24 text-center">
              <p className="font-display text-xl font-light text-[var(--foreground)] mb-2">No outfits found</p>
              <p className="text-sm text-[var(--foreground-muted)]">Try adjusting your search or filters</p>
            </div>
          )
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-px bg-[var(--border)]">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-[var(--background)] p-3">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-24 text-center">
            <p className="font-display text-xl font-light text-[var(--foreground)] mb-2">No pieces found</p>
            <p className="text-sm text-[var(--foreground-muted)]">Try adjusting your search or filters</p>
          </div>
        )}

        <div className="pb-16" />
      </div>
    </div>
  );
}
