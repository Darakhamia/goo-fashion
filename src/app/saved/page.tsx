"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useLikes } from "@/lib/context/likes-context";
import { useCurrency } from "@/lib/context/currency-context";
import { useCart } from "@/lib/context/cart-context";
import { toCartItem } from "@/lib/cart-item";
import { fetchProductsByIds } from "@/lib/products-by-ids";
import type { Outfit, Product } from "@/lib/types";
import { isProductAvailable } from "@/lib/availability";
import ProductCard from "@/components/product/ProductCard";
import { StatusDot, BagIcon, HeartIcon, PhoneEmpty } from "@/components/look/CardBits";
import { MyLooksPanel } from "@/components/look/MyLooksPanel";
import { loadLocalLooks } from "@/lib/looks-storage";

type View = "outfits" | "pieces" | "looks";

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
    <div className="group relative flex flex-col max-md:h-full rounded-2xl md:border md:border-[var(--border)] bg-[var(--surface)]">
      {/* Image — click opens the outfit page */}
      <Link href={outfitUrl} className="img-zoom block w-full relative overflow-hidden rounded-t-2xl aspect-[3/4]">
        {outfit.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={outfit.imageUrl} alt={outfit.name || "Saved outfit"} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid grid-cols-2 gap-px bg-white md:bg-gray-200">
            {outfit.items.slice(0, 4).map(({ product }) => (
              <div key={product.id} className="relative overflow-hidden bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-contain p-2" />
              </div>
            ))}
          </div>
        )}
        {/* Phones: a light pill, like every control on the photo (DESIGN_SYSTEM.md §12.6) */}
        <span className="absolute top-2.5 left-2.5 z-10 text-[11px] font-semibold bg-white/80 text-black px-[9px] py-1 rounded-full md:font-mono md:text-[8px] md:font-normal md:tracking-[0.18em] md:uppercase md:bg-black/55 md:text-white md:px-2 md:py-0.5 md:rounded-md backdrop-blur-sm">
          Outfit
        </span>
        <div className="absolute inset-0 bg-transparent group-hover:bg-[var(--fg-overlay-08)] transition-colors duration-500 z-10" />
      </Link>

      {/* Info */}
      <div className="px-3 pt-2.5 pb-3 md:px-4 md:pt-3.5 md:pb-4 flex flex-col max-md:flex-1">
        {/* The outfit's own name — the same one the catalogue and the outfit
            page show. It was already being passed to the share sheet and the
            image alt two lines up; only the visible title was a constant, so
            every liked outfit read "Saved outfit" no matter what it is called.
            The constant stays as a floor for an outfit with a blank name. */}
        <Link href={outfitUrl} className="text-[14px] md:text-[15px] font-semibold text-[var(--foreground)] truncate leading-snug hover:opacity-70 transition-opacity">
          {outfit.name || "Saved outfit"}
        </Link>
        <p className="text-[13px] text-[var(--foreground-muted)] mt-0.5 md:mt-1 truncate">
          {formatPrice(outfit.totalPriceMin)} total
        </p>
        <p className="flex items-center gap-1.5 text-[12px] md:text-[11px] text-[var(--foreground-subtle)] mt-0.5 truncate">
          <span className="shrink-0">{totalPieces} {totalPieces === 1 ? "piece" : "pieces"}</span>
          <span className="opacity-50">•</span>
          <StatusDot className={statusSegment.dot} />
          <span className="truncate">{statusSegment.label}</span>
        </p>

        {/* The card's one action — same responsive treatment as the look cards:
            shorter label and no bag icon on the narrow two-up phone cards. On a
            phone it is a soft pill: a grid of primaries would be a screen of
            accents (DESIGN_SYSTEM.md §12.1). */}
        <button
          onClick={handleAddToBag}
          disabled={availableCount === 0}
          className={`mt-2.5 md:mt-3 w-full h-11 md:h-10 rounded-full md:rounded-xl flex items-center justify-center gap-2 text-[13px] font-medium md:text-[11px] md:tracking-[0.1em] md:uppercase md:font-semibold transition-opacity disabled:opacity-30 disabled:cursor-default ${
            bagAdded
              ? "bg-[var(--foreground)] text-[var(--background)] md:bg-green-600 md:text-white"
              : "bg-[var(--fg-overlay-08)] text-[var(--foreground)] md:bg-[var(--foreground)] md:text-[var(--background)] md:hover:opacity-90"
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
function SavedInner() {
  const [view, setView] = useState<View>("pieces");
  const { likedOutfits, likedProducts, unseenOutfits, unseenProducts, markCategorySeen } = useLikes();
  // Seeded from the local cache so the tab can print a count before the panel
  // mounts; the panel replaces it with the reconciled number once it has one.
  const [looksCount, setLooksCount] = useState(0);
  const [allOutfits, setAllOutfits] = useState<Outfit[]>([]);
  // The liked pieces, as they are loaded — never the whole catalogue.
  const [likedProductData, setLikedProductData] = useState<Product[]>([]);
  // Ids already asked for, so unliking one doesn't refetch the rest.
  const requestedProductIds = useRef(new Set<string>());

  // The builder's "View" links and the save confirmation land here with
  // ?tab=looks to show the look just made. Read through useSearchParams rather
  // than window.location: those links can be clicked while this page is
  // already open, which changes the query without remounting anything.
  const tabParam = useSearchParams().get("tab");
  useEffect(() => {
    if (tabParam === "looks" || tabParam === "pieces" || tabParam === "outfits") {
      // Syncing a tab to the URL, the way browse/page.tsx syncs its filters.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView(tabParam);
    }
  }, [tabParam]);

  // Seed the looks count from the local cache so the tab carries a number
  // before the panel has mounted — the panel only exists on its own tab, and
  // it replaces this with the reconciled count as soon as it does.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLooksCount(loadLocalLooks().length);
  }, []);

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

  // Fetch just the liked pieces by id. Likes arrive asynchronously (and change
  // on sign-in), so this re-runs with them and asks only for ids it hasn't yet.
  useEffect(() => {
    const missing = likedProducts.filter((id) => !requestedProductIds.current.has(id));
    if (missing.length === 0) return;
    for (const id of missing) requestedProductIds.current.add(id);
    fetchProductsByIds(missing)
      .then((found) => {
        setLikedProductData((prev) => {
          const have = new Set(prev.map((p) => p.id));
          return [...prev, ...found.filter((p) => !have.has(p.id))];
        });
      })
      .catch(() => {
        // Let the next change of likes ask for these again.
        for (const id of missing) requestedProductIds.current.delete(id);
      });
  }, [likedProducts]);

  const savedOutfits = allOutfits.filter((o) => likedOutfits.includes(o.id));
  // Newest first, the order the full catalogue used to hand them over in.
  const savedProducts = likedProductData
    .filter((p) => likedProducts.includes(p.id))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  // Counts mirror what's actually rendered: a liked id whose product/outfit is
  // no longer in the catalog isn't shown, so it must not inflate the tab count.
  const tabs: { id: View; label: string; count: number; unseen: number }[] = [
    { id: "pieces", label: "Pieces", count: savedProducts.length, unseen: unseenProducts },
    { id: "outfits", label: "Outfits", count: savedOutfits.length, unseen: unseenOutfits },
    { id: "looks", label: "My looks", count: looksCount, unseen: 0 },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-3 md:px-12">
        <div className="px-1 pt-4 mb-3 md:px-0 md:pt-16 md:mb-10">
          <p className="hidden md:block text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
            Saved
          </p>
          {/* Desktop keeps the -0.015em the size rule gave text-4xl (§12.13, tracking trap). */}
          <h1 className="text-2xl font-semibold tracking-[-0.015em] md:text-5xl md:font-black md:uppercase text-[var(--foreground)]">
            Your likes
          </h1>
        </div>

        {/* Toggle. Phones: a three-up segmented control that fits 360px
            (DESIGN_SYSTEM.md §12.10) — 44px segments, the ring an inset shadow. */}
        <div className="grid grid-cols-3 h-11 mb-3 rounded-full bg-[var(--surface)] shadow-[inset_0_0_0_1px_var(--border)] md:flex md:gap-0 md:h-auto md:mb-10 md:w-fit md:max-w-full md:overflow-x-auto no-scrollbar md:p-1 md:border md:border-[var(--border)] md:shadow-none">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={`relative min-w-0 h-11 px-1 text-[14px] md:shrink-0 md:h-auto md:px-5 md:py-2 md:text-xs md:tracking-[0.12em] md:uppercase font-medium ${view === t.id ? "max-md:font-semibold" : ""} rounded-full z-10 transition-colors duration-200`}
              style={{ color: view === t.id ? "var(--background)" : "var(--foreground-muted)" }}
            >
              {view === t.id && (
                <motion.div
                  layoutId="saved-tab-pill"
                  className="absolute inset-[3px] md:inset-0 rounded-full bg-[var(--foreground)]"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  style={{ zIndex: -1 }}
                />
              )}
              {/* Phones: "Pieces 4"; desktop: "Pieces (4)". */}
              {t.label}<span className="max-md:ml-1 max-md:opacity-60"><span className="hidden md:inline"> (</span>{t.count}<span className="hidden md:inline">)</span></span>
              {t.unseen > 0 && (
                <span
                  className="ml-1.5 inline-flex items-center justify-center rounded-full font-bold align-middle min-w-[18px] h-[18px] text-[11px] md:min-w-4 md:h-4 md:text-[9px]"
                  style={{
                    padding: "0 4px", lineHeight: 1,
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
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 md:gap-4"
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
            <>
            <PhoneEmpty icon={<HeartIcon />} title="No saved outfits yet" text="Tap the heart on any outfit to save it here." href="/browse" action="Browse outfits" />
            <div className="hidden md:block py-20 px-8 text-center bg-[var(--surface)] rounded-2xl border border-[var(--border)]">
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
            </>
          )
        )}

        {/* ── My Looks (built by you) ── */}
        {view === "looks" && <MyLooksPanel onCountChange={setLooksCount} />}

        {/* ── Pieces (liked) ── */}
        {view === "pieces" && (
          savedProducts.length > 0 ? (
            <motion.div
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 md:gap-4"
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
            <>
            <PhoneEmpty icon={<HeartIcon />} title="No saved pieces yet" text="Tap the heart on any item to save it here." href="/browse?view=pieces" action="Browse pieces" />
            <div className="hidden md:block py-20 px-8 text-center bg-[var(--surface)] rounded-2xl border border-[var(--border)]">
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
            </>
          )
        )}

        </motion.div>
        </AnimatePresence>
        <div aria-hidden="true" className="h-8 md:hidden" />
      </div>
    </div>
  );
}

// ── Page (wrapped in Suspense for useSearchParams) ────────────────────────────

export default function SavedPage() {
  return (
    <Suspense>
      <SavedInner />
    </Suspense>
  );
}
