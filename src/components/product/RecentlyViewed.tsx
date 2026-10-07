"use client";

import { useEffect, useState } from "react";
import type { Outfit, Product } from "@/lib/types";
import { getRecentlyViewed, type ViewKind } from "@/lib/recently-viewed";
import ProductCard from "./ProductCard";
import OutfitCard from "@/components/outfit/OutfitCard";

interface Props {
  kind: ViewKind;
  /** The item being viewed — it is in the history but not worth showing. */
  currentId: string;
}

const ENDPOINT: Record<ViewKind, string> = {
  product: "/api/products",
  outfit: "/api/outfits",
};

/**
 * The items this browser opened before this one. Renders nothing at all until
 * there is something to show, so a first-time visitor sees no empty heading.
 */
export default function RecentlyViewed({ kind, currentId }: Props) {
  const [items, setItems] = useState<(Product | Outfit)[]>([]);

  useEffect(() => {
    const ids = getRecentlyViewed(kind).filter((id) => id !== currentId);
    const controller = new AbortController();
    let cancelled = false;

    // Ids can outlive what they point at — something delisted stays in this
    // browser's history forever — so the response drives the row, not the
    // stored list. An empty history resolves to an empty row rather than
    // returning early, which keeps every setItems off the synchronous path
    // through the effect.
    const load: Promise<(Product | Outfit)[]> =
      ids.length === 0
        ? Promise.resolve([])
        : fetch(`${ENDPOINT[kind]}?ids=${ids.map(encodeURIComponent).join(",")}`, {
            signal: controller.signal,
          }).then((res) => (res.ok ? res.json() : []));

    load
      .then((data) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        /* aborted or offline — leave the row out */
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [kind, currentId]);

  if (items.length === 0) return null;

  return (
    <section className="mt-10 md:mt-28 mb-4">
      {/* Phones: the section heading of DESIGN_SYSTEM.md §12 — a 13px label, a 20px title. */}
      <div className="mb-3 md:mb-8">
        <p className="text-[13px] md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium text-[var(--foreground-muted)] md:text-[var(--foreground-subtle)] mb-1 md:mb-3">
          Picked up where you left off
        </p>
        <h2 className="text-[20px] md:text-3xl font-semibold md:font-bold md:uppercase max-md:tracking-[-0.01em] text-[var(--foreground)]">
          Recently viewed
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-4">
        {items.slice(0, 4).map((item) => (
          <div
            key={item.id}
            className="rounded-xl bg-[var(--background)] hover:shadow-md transition-colors duration-200"
          >
            {kind === "product" ? (
              <ProductCard product={item as Product} />
            ) : (
              <OutfitCard outfit={item as Outfit} />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
