"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/lib/context/cart-context";
import { toCartItem } from "@/lib/cart-item";
import { track } from "@/lib/analytics/track";
import { isProductAvailable } from "@/lib/availability";
import type { OutfitItem } from "@/lib/types";

interface OutfitActionsProps {
  outfitId: string;
  items: OutfitItem[];
}

/**
 * The outfit's two actions: put the whole look in the bag, or share it.
 *
 * Saving lives on the photo now (`OutfitLikeButton`), the same place a piece is
 * saved from, so it is not repeated here.
 */
export default function OutfitActions({ outfitId, items }: OutfitActionsProps) {
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
    <div className="flex flex-col sm:flex-row gap-3 mb-12">
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
  );
}
