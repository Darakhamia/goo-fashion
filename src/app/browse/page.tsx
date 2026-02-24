"use client";

import { useState } from "react";
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

export default function BrowsePage() {
  const [view, setView] = useState<View>("outfits");
  const [occasionFilter, setOccasionFilter] = useState<OccasionFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  const filteredOutfits =
    occasionFilter === "all"
      ? outfits
      : outfits.filter((o) => o.occasion === occasionFilter);

  const filteredProducts =
    categoryFilter === "all"
      ? products
      : products.filter((p) => p.category === categoryFilter);

  const occasionFilters: OccasionFilter[] = [
    "all",
    "casual",
    "work",
    "evening",
    "formal",
    "weekend",
    "sport",
  ];

  const categoryFilters: CategoryFilter[] = [
    "all",
    "outerwear",
    "tops",
    "bottoms",
    "knitwear",
    "dresses",
    "footwear",
    "accessories",
  ];

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        {/* Header */}
        <div className="pt-12 md:pt-16 mb-10">
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
            Browse
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)]">
            The Edit
          </h1>
        </div>

        {/* View Toggle + Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-8 border-b border-[var(--border)]">
          {/* View Toggle */}
          <div className="flex gap-px bg-[var(--border)]">
            {(["outfits", "pieces"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-6 py-2.5 text-xs tracking-[0.12em] uppercase font-medium transition-colors duration-200 ${
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
          <div className="flex items-center gap-2 flex-wrap">
            {view === "outfits"
              ? occasionFilters.map((f) => (
                  <button
                    key={f}
                    onClick={() => setOccasionFilter(f)}
                    className={`text-[10px] tracking-[0.14em] uppercase px-4 py-2 border transition-colors duration-200 capitalize ${
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
                    className={`text-[10px] tracking-[0.14em] uppercase px-4 py-2 border transition-colors duration-200 capitalize ${
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
        <div className="mb-8">
          <p className="text-xs text-[var(--foreground-subtle)]">
            {view === "outfits" ? filteredOutfits.length : filteredProducts.length}{" "}
            {view === "outfits" ? "outfits" : "pieces"}
          </p>
        </div>

        {/* Grid */}
        {view === "outfits" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border)]">
            {filteredOutfits.map((outfit) => (
              <div key={outfit.id} className="bg-[var(--background)] p-4">
                <OutfitCard outfit={outfit} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border)]">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-[var(--background)] p-4">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {view === "outfits" && filteredOutfits.length === 0 && (
          <div className="py-24 text-center">
            <p className="font-display text-xl font-light text-[var(--foreground)] mb-2">
              No outfits found
            </p>
            <p className="text-sm text-[var(--foreground-muted)]">
              Try a different occasion filter
            </p>
          </div>
        )}

        {view === "pieces" && filteredProducts.length === 0 && (
          <div className="py-24 text-center">
            <p className="font-display text-xl font-light text-[var(--foreground)] mb-2">
              No pieces found
            </p>
            <p className="text-sm text-[var(--foreground-muted)]">
              Try a different category
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
