"use client";

import { useState } from "react";
import Link from "next/link";
import { useLikes } from "@/lib/context/likes-context";
import { outfits } from "@/lib/data/outfits";
import { products } from "@/lib/data/products";
import OutfitCard from "@/components/outfit/OutfitCard";
import ProductCard from "@/components/product/ProductCard";

type View = "outfits" | "pieces";

export default function SavedPage() {
  const [view, setView] = useState<View>("outfits");
  const { likedOutfits, likedProducts } = useLikes();

  const savedOutfits = outfits.filter((o) => likedOutfits.includes(o.id));
  const savedProducts = products.filter((p) => likedProducts.includes(p.id));

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="pt-12 md:pt-16 mb-10">
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
            Saved
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)]">
            Your Likes
          </h1>
        </div>

        {/* Toggle */}
        <div className="flex gap-px bg-[var(--border)] mb-10 w-fit">
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
              {v === "outfits"
                ? `Outfits (${likedOutfits.length})`
                : `Pieces (${likedProducts.length})`}
            </button>
          ))}
        </div>

        {view === "outfits" ? (
          savedOutfits.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-px bg-[var(--border)]">
              {savedOutfits.map((outfit) => (
                <div key={outfit.id} className="bg-[var(--background)] p-3">
                  <OutfitCard outfit={outfit} />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-32 text-center">
              <p className="font-display text-2xl font-light text-[var(--foreground)] mb-3">
                No saved outfits yet
              </p>
              <p className="text-sm text-[var(--foreground-muted)] mb-8">
                Tap the heart on any outfit to save it here.
              </p>
              <Link
                href="/browse"
                className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-4 hover:opacity-80 transition-opacity duration-200"
              >
                Browse Outfits
              </Link>
            </div>
          )
        ) : savedProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-px bg-[var(--border)]">
            {savedProducts.map((product) => (
              <div key={product.id} className="bg-[var(--background)] p-3">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-32 text-center">
            <p className="font-display text-2xl font-light text-[var(--foreground)] mb-3">
              No saved pieces yet
            </p>
            <p className="text-sm text-[var(--foreground-muted)] mb-8">
              Tap the heart on any item to save it here.
            </p>
            <Link
              href="/browse?view=pieces"
              className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-4 hover:opacity-80 transition-opacity duration-200"
            >
              Browse Pieces
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
