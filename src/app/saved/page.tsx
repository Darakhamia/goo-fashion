"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useLikes } from "@/lib/context/likes-context";
import { useCurrency } from "@/lib/context/currency-context";
import { useCart } from "@/lib/context/cart-context";
import { toCartItem } from "@/lib/cart-item";
import { products as staticProducts } from "@/lib/data/products";
import type { Outfit } from "@/lib/types";
import { isProductAvailable } from "@/lib/availability";
import ProductCard from "@/components/product/ProductCard";
import { StatusDot, BagIcon } from "@/components/look/CardBits";

type View = "outfits" | "pieces";

// ── Liked outfit card (Outfits tab) ───────────────────────────────────────────
//
// Carries one action, like the look cards: image, name, price, "add to bag".
// Edit / Share / ⋯ are gone — everything they held lives on the outfit page the
// card already opens, which is where a card that is a *link* should send you.
function SavedOutfitCard({ outfit }: { outfit: Outfit }) {
  const { formatPrice } = useCurrency();
  const { addManyToCart } = useCart();
  const [bagAdded, setBagAdded] = useState(false);

  const totalPieces = outfit.items.length;
  const availableItems = outfit.items.filter((it) => isProductAvailable(it.product));
  const availableCount = availableItems.length;
  const partial = availableCount < totalPieces;

  const outfitUrl = `/outfit/${outfit.id}`;

  const handleAddToBag = () => {
    if (bagAdded) return;
    const items = availableItems.map(({ product }) => toCartItem(product));
    if (items.length === 0) return;
    addManyToCart(items);
    setBagAdded(true);
    setTimeout(() => setBagAdded(false), 2000);
  };

  const statusSegment = partial
    ? { label: `${availableCount}/${totalPieces} available`, dot: "bg-orange-400" }
    : { label: "Ready to shop", dot: "bg-green-500" };

  return (
    <div className="group relative flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      {/* Image — click opens the outfit page */}
      <Link href={outfitUrl} className="img-zoom block w-full relative overflow-hidden rounded-t-2xl aspect-[3/4]">
        {outfit.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={outfit.imageUrl} alt={outfit.name || "Saved outfit"} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid grid-cols-2 gap-px bg-gray-200">
            {outfit.items.slice(0, 4).map(({ product }) => (
              <div key={product.id} className="relative overflow-hidden bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-contain p-2" />
              </div>
            ))}
          </div>
        )}
        <span className="absolute top-2.5 left-2.5 z-10 font-mono text-[8px] tracking-[0.18em] uppercase bg-black/55 text-white px-2 py-0.5 rounded-md backdrop-blur-sm">
          Outfit
        </span>
        <div className="absolute inset-0 bg-transparent group-hover:bg-[var(--fg-overlay-08)] transition-colors duration-500 z-10" />
      </Link>

      {/* Info */}
      <div className="px-4 pt-3.5 pb-4 flex flex-col">
        {/* The outfit's own name — the same one the catalogue and the outfit
            page show. It was already being passed to the share sheet and the
            image alt two lines up; only the visible title was a constant, so
            every liked outfit read "Saved outfit" no matter what it is called.
            The constant stays as a floor for an outfit with a blank name. */}
        <Link href={outfitUrl} className="text-[15px] font-semibold text-[var(--foreground)] truncate leading-snug hover:opacity-70 transition-opacity">
          {outfit.name || "Saved outfit"}
        </Link>
        <p className="text-[13px] text-[var(--foreground-muted)] mt-1 truncate">
          {formatPrice(outfit.totalPriceMin)} total
        </p>
        <p className="flex items-center gap-1.5 text-[11px] text-[var(--foreground-subtle)] mt-0.5 truncate">
          <span className="shrink-0">{totalPieces} {totalPieces === 1 ? "piece" : "pieces"}</span>
          <span className="opacity-50">•</span>
          <StatusDot className={statusSegment.dot} />
          <span className="truncate">{statusSegment.label}</span>
        </p>

        {/* Primary action — same responsive treatment as the look cards:
            shorter label and no bag icon on the narrow two-up phone cards. */}
        <button
          onClick={handleAddToBag}
          disabled={availableCount === 0}
          className={`mt-3 w-full h-11 md:h-10 rounded-xl flex items-center justify-center gap-2 text-[11px] tracking-[0.1em] uppercase font-semibold transition-opacity disabled:opacity-30 disabled:cursor-default ${
            bagAdded
              ? "bg-green-600 text-white"
              : "bg-[var(--foreground)] text-[var(--background)] hover:opacity-90"
          }`}
        >
          {bagAdded ? (
            <>
              <span className="md:hidden">Added ✓</span>
              <span className="hidden md:inline">Added to bag ✓</span>
            </>
          ) : (
            <>
              <span className="md:hidden">{partial ? "Add available" : "Add to bag"}</span>
              <span className="hidden md:inline">{partial ? "Add available items" : "Add all to bag"}</span>
              <span className="hidden md:inline-flex"><BagIcon /></span>
            </>
          )}
        </button>

      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SavedPage() {
  const [view, setView] = useState<View>("pieces");
  const router = useRouter();
  const { likedOutfits, likedProducts, unseenOutfits, unseenProducts, markCategorySeen } = useLikes();
  const [allOutfits, setAllOutfits] = useState<Outfit[]>([]);
  const [allProducts, setAllProducts] = useState(staticProducts);

  // The looks a person builds now live on their profile. Every old link to them
  // pointed here with ?tab=looks — bookmarks, the builder's own "View" links,
  // the save confirmation — so carry those through instead of landing on a page
  // that no longer has the tab.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "looks") router.replace("/profile?tab=looks");
  }, [router]);

  // Opening a tab clears just that tab's "new items" badge. Re-runs as likes
  // load / change while the tab is open so anything seen here counts as seen.
  useEffect(() => {
    if (view === "pieces") markCategorySeen("products");
    else if (view === "outfits") markCategorySeen("outfits");
  }, [view, likedOutfits, likedProducts, markCategorySeen]);

  // Fetch outfits from API (includes DB outfits)
  useEffect(() => {
    fetch("/api/outfits")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setAllOutfits(d); })
      .catch(() => {});
  }, []);

  // Fetch full product list from API (includes Supabase products with UUID IDs)
  useEffect(() => {
    fetch("/api/products?raw=true")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setAllProducts(d); })
      .catch(() => {});
  }, []);

  const savedOutfits = allOutfits.filter((o) => likedOutfits.includes(o.id));
  const savedProducts = allProducts.filter((p) => likedProducts.includes(p.id));

  // Counts mirror what's actually rendered: a liked id whose product/outfit is
  // no longer in the catalog isn't shown, so it must not inflate the tab count.
  const tabs: { id: View; label: string; count: number; unseen: number }[] = [
    { id: "pieces", label: "Pieces", count: savedProducts.length, unseen: unseenProducts },
    { id: "outfits", label: "Outfits", count: savedOutfits.length, unseen: unseenOutfits },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="pt-12 md:pt-16 mb-10">
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
            Saved
          </p>
          <h1 className="text-4xl md:text-5xl font-black uppercase text-[var(--foreground)]">
            Your Likes
          </h1>
          {/* This page is now only what you liked. The looks you made yourself
              moved to the profile, and the people who used to open them here
              need to be told where they went. */}
          <p className="mt-4 text-sm text-[var(--foreground-muted)]">
            Looks you built live in{" "}
            <Link
              href="/profile?tab=looks"
              className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors underline underline-offset-4"
            >
              your profile
            </Link>
            .
          </p>
        </div>

        {/* Toggle */}
        <div className="flex gap-0 mb-10 w-fit max-w-full overflow-x-auto no-scrollbar bg-[var(--surface)] rounded-full p-1 border border-[var(--border)]">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className="relative shrink-0 px-5 py-2 text-xs tracking-[0.12em] uppercase font-medium rounded-full z-10 transition-colors duration-200"
              style={{ color: view === t.id ? "var(--background)" : "var(--foreground-muted)" }}
            >
              {view === t.id && (
                <motion.div
                  layoutId="saved-tab-pill"
                  className="absolute inset-0 rounded-full bg-[var(--foreground)]"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  style={{ zIndex: -1 }}
                />
              )}
              {t.label} ({t.count})
              {t.unseen > 0 && (
                <span
                  className="ml-1.5 inline-flex items-center justify-center rounded-full font-bold align-middle"
                  style={{
                    minWidth: 16, height: 16, padding: "0 4px", fontSize: 9, lineHeight: 1,
                    background: view === t.id ? "var(--background)" : "var(--foreground)",
                    color: view === t.id ? "var(--foreground)" : "var(--background)",
                  }}
                >
                  {t.unseen > 9 ? "9+" : t.unseen}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >

        {/* ── Outfits (liked) ── */}
        {view === "outfits" && (
          savedOutfits.length > 0 ? (
            <motion.div
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
              initial="hidden"
              animate="show"
            >
              {savedOutfits.map((outfit) => (
                <motion.div
                  key={outfit.id}
                  variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } }}
                >
                  <SavedOutfitCard outfit={outfit} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="py-20 px-8 text-center bg-[var(--surface)] rounded-2xl border border-[var(--border)]">
              <p className="text-2xl font-bold text-[var(--foreground)] mb-3">
                No saved outfits yet
              </p>
              <p className="text-sm text-[var(--foreground-muted)] mb-8">
                Tap the heart on any outfit to save it here.
              </p>
              <Link
                href="/browse"
                className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-3.5 rounded-xl hover:opacity-90 transition-opacity duration-200 inline-block"
              >
                Browse Outfits
              </Link>
            </div>
          )
        )}

        {/* ── Pieces (liked) ── */}
        {view === "pieces" && (
          savedProducts.length > 0 ? (
            <motion.div
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
              initial="hidden"
              animate="show"
            >
              {savedProducts.map((product) => (
                <motion.div
                  key={product.id}
                  className="rounded-xl bg-[var(--background)] hover:shadow-md transition-colors duration-200"
                  variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="py-20 px-8 text-center bg-[var(--surface)] rounded-2xl border border-[var(--border)]">
              <p className="text-2xl font-bold text-[var(--foreground)] mb-3">
                No saved pieces yet
              </p>
              <p className="text-sm text-[var(--foreground-muted)] mb-8">
                Tap the heart on any item to save it here.
              </p>
              <Link
                href="/browse?view=pieces"
                className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-3.5 rounded-xl hover:opacity-90 transition-opacity duration-200 inline-block"
              >
                Browse Pieces
              </Link>
            </div>
          )
        )}

        </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
