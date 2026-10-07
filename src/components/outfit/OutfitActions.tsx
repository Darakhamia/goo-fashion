"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/lib/context/cart-context";
import { toCartItem } from "@/lib/cart-item";
import { track } from "@/lib/analytics/track";
import { isProductAvailable } from "@/lib/availability";
import Price from "@/components/ui/Price";
import type { OutfitItem } from "@/lib/types";

interface OutfitActionsProps {
  outfitId: string;
  items: OutfitItem[];
  /** The look's price range, shown in the phone buy bar. */
  priceMin: number;
  priceMax: number;
}

/**
 * The outfit's two actions: put the whole look in the bag, or share it.
 *
 * Saving lives on the photo now (`OutfitLikeButton`), the same place a piece is
 * saved from, so it is not repeated here.
 *
 * Phones get the same two actions in the buy bar that stands where the tab bar
 * would (DESIGN_SYSTEM.md §12.8); the buttons in the page are desktop's.
 */
export default function OutfitActions({ outfitId, items, priceMin, priceMax }: OutfitActionsProps) {
  const { addManyToCart } = useCart();
  const [copied, setCopied] = useState(false);
  const [bagAdded, setBagAdded] = useState(false);

  useEffect(() => {
    track("outfit_view", { targetId: outfitId });
  }, [outfitId]);

  // Sold-out pieces are dropped rather than blocking the whole look — the
  // label says so, so the bag never quietly holds fewer pieces than promised.
  const availableItems = items.filter((it) => isProductAvailable(it.product));
  const partial = availableItems.length < items.length;

  const handleAddToBag = () => {
    if (bagAdded || availableItems.length === 0) return;
    addManyToCart(availableItems.map(({ product }) => toCartItem(product)));
    setBagAdded(true);
    setTimeout(() => setBagAdded(false), 2000);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ url });
      } catch {
        // User cancelled or error — do nothing
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
    <div className="md:hidden fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+6px)] z-40 h-16 rounded-3xl border border-[var(--border)] bg-[var(--surface-overlay-92)] backdrop-blur-md flex items-center gap-2 pl-[18px] pr-2.5">
      <div className="flex-1 min-w-0">
        <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
          <Price amount={priceMin} />–<Price amount={priceMax} />
        </p>
        <p className="text-[12px] text-[var(--foreground-muted)]">
          {items.length} {items.length === 1 ? "piece" : "pieces"}
        </p>
      </div>
      <button
        onClick={handleShare}
        aria-label={copied ? "Link copied" : "Share"}
        className="shrink-0 w-11 h-11 rounded-full bg-[var(--fg-overlay-08)] text-[var(--foreground)] flex items-center justify-center"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {copied ? <path d="M6 12.5l4 4 8-9" /> : <path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6" />}
        </svg>
      </button>
      <button
        onClick={handleAddToBag}
        disabled={availableItems.length === 0}
        className="shrink-0 h-11 px-5 rounded-full bg-[var(--foreground)] text-[var(--background)] text-[15px] font-semibold disabled:opacity-40"
      >
        {bagAdded
          ? "Added to bag"
          : availableItems.length === 0
            ? "Sold out"
            : partial
              ? `Add ${availableItems.length} to bag`
              : "Add all to bag"}
      </button>
    </div>

    <div className="hidden md:flex flex-col sm:flex-row gap-3 mb-12">
      <button
        onClick={handleAddToBag}
        disabled={availableItems.length === 0}
        className="text-xs tracking-[0.14em] uppercase font-medium px-8 py-4 rounded-full flex items-center justify-center gap-2 text-[var(--background)] bg-[var(--foreground)] hover:opacity-80 transition-opacity duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {bagAdded ? (
          <>
            <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
              <path d="M1 5L4.5 8.5L12 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Added to bag
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 1h2l1.5 7.5" />
              <path d="M4.5 8.5h8l1.5-5.5H4z" />
              <circle cx="6.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
              <circle cx="11.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
            </svg>
            {availableItems.length === 0
              ? "Sold out"
              : partial
                ? `Add ${availableItems.length} available`
                : `Add all ${items.length} to bag`}
          </>
        )}
      </button>
      <button
        onClick={handleShare}
        className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground)] border border-[var(--border)] px-8 py-4 rounded-full hover:border-[var(--border-strong)] transition-colors duration-200"
      >
        {copied ? "Link Copied!" : "Share"}
      </button>
    </div>
    </>
  );
}
