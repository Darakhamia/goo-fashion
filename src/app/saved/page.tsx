"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLikes } from "@/lib/context/likes-context";
import { outfits } from "@/lib/data/outfits";
import { products as staticProducts } from "@/lib/data/products";
import OutfitCard from "@/components/outfit/OutfitCard";
import ProductCard from "@/components/product/ProductCard";

type View = "outfits" | "pieces" | "looks";

// ── Saved builder outfit type ─────────────────────────────────────────────────
interface SavedLook {
  id: string;
  savedAt: string;
  pieces: { slot: string; productId: string; imageUrl?: string; name?: string }[];
  totalPrice: number;
  styleKeywords: string[];
}

const SLOT_ORDER = ["top", "bottom", "shoes", "accessories"];

// ── Builder outfit card ───────────────────────────────────────────────────────
function LookCard({ look, onDelete }: { look: SavedLook; onDelete: () => void }) {
  const pieces = SLOT_ORDER.map((slot) => {
    const piece = look.pieces.find((p) => p.slot === slot);
    const product = piece ? staticProducts.find((p) => p.id === piece.productId) : null;
    const imageUrl = piece?.imageUrl ?? product?.imageUrl ?? null;
    const name = piece?.name ?? product?.name ?? slot;
    return { slot, imageUrl, name };
  });

  const builderUrl =
    "/builder?" +
    look.pieces
      .map((p) => `${p.slot}=${p.productId}`)
      .join("&");

  const date = new Date(look.savedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  return (
    <div className="bg-[var(--background)] flex flex-col group">
      {/* 2×2 thumbnail grid */}
      <Link href={builderUrl} className="block">
        <div className="grid grid-cols-2 grid-rows-2 aspect-square gap-px bg-[var(--border)]">
          {pieces.map(({ slot, imageUrl, name }) => (
            <div key={slot} className="overflow-hidden bg-[var(--surface)]">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[var(--border-strong)] text-xs">—</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </Link>

      {/* Footer */}
      <div className="p-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[var(--foreground)]">
            ${look.totalPrice.toLocaleString()}
          </p>
          {look.styleKeywords.length > 0 && (
            <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5 truncate">
              {look.styleKeywords.slice(0, 3).join(" · ")}
            </p>
          )}
          <p className="text-[9px] text-[var(--foreground-subtle)] mt-0.5">{date}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={builderUrl}
            className="text-[9px] tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Open →
          </Link>
          <button
            onClick={onDelete}
            title="Remove"
            className="text-[var(--foreground-subtle)] hover:text-red-500 transition-colors"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path d="M1 1L8 8M8 1L1 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SavedPage() {
  const [view, setView] = useState<View>("outfits");
  const { likedOutfits, likedProducts } = useLikes();
  const [myLooks, setMyLooks] = useState<SavedLook[]>([]);
  const [allProducts, setAllProducts] = useState(staticProducts);

  // Load builder-saved outfits from localStorage + respect ?tab= param
  useEffect(() => {
    try {
      const raw = localStorage.getItem("goo-saved-outfits");
      if (raw) setMyLooks(JSON.parse(raw));
    } catch {}
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "looks") setView("looks");
  }, []);

  // Fetch full product list from API (includes Supabase products with UUID IDs)
  useEffect(() => {
    fetch("/api/products?raw=true")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setAllProducts(d); })
      .catch(() => {});
  }, []);

  const deleteLook = (id: string) => {
    setMyLooks((prev) => {
      const next = prev.filter((l) => l.id !== id);
      try { localStorage.setItem("goo-saved-outfits", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const savedOutfits = outfits.filter((o) => likedOutfits.includes(o.id));
  const savedProducts = allProducts.filter((p) => likedProducts.includes(p.id));

  const tabs: { id: View; label: string; count: number }[] = [
    { id: "outfits", label: "Outfits", count: likedOutfits.length },
    { id: "pieces", label: "Pieces", count: likedProducts.length },
    { id: "looks", label: "My Looks", count: myLooks.length },
  ];

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
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={`px-6 py-2.5 text-xs tracking-[0.12em] uppercase font-medium transition-colors duration-200 ${
                view === t.id
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "bg-[var(--background)] text-[var(--foreground-muted)] hover:bg-[var(--surface)]"
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {/* ── Outfits (liked) ── */}
        {view === "outfits" && (
          savedOutfits.length > 0 ? (
            <div className="flex flex-wrap">
              {savedOutfits.map((outfit) => (
                <div key={outfit.id} className="w-1/2 md:w-1/4 lg:w-1/5 border-r border-b border-[var(--border)] bg-[var(--background)] p-3">
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
        )}

        {/* ── Pieces (liked) ── */}
        {view === "pieces" && (
          savedProducts.length > 0 ? (
            <div className="flex flex-wrap">
              {savedProducts.map((product) => (
                <div key={product.id} className="w-1/2 md:w-1/4 lg:w-1/5 border-r border-b border-[var(--border)] bg-[var(--background)] p-3">
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
          )
        )}

        {/* ── My Looks (builder-created) ── */}
        {view === "looks" && (
          myLooks.length > 0 ? (
            <div className="flex flex-wrap">
              {myLooks.map((look) => (
                <div key={look.id} className="w-1/2 md:w-1/3 lg:w-1/4 xl:w-1/5 border-r border-b border-[var(--border)]">
                  <LookCard look={look} onDelete={() => deleteLook(look.id)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-32 text-center">
              <p className="font-display text-2xl font-light text-[var(--foreground)] mb-3">
                No looks built yet
              </p>
              <p className="text-sm text-[var(--foreground-muted)] mb-8">
                Use the Builder to assemble outfits — hit Save and they appear here.
              </p>
              <Link
                href="/builder"
                className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-4 hover:opacity-80 transition-opacity duration-200"
              >
                Open Builder
              </Link>
            </div>
          )
        )}
      </div>
    </div>
  );
}
