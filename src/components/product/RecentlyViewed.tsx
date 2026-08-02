"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import { getRecentlyViewed } from "@/lib/recently-viewed";
import ProductCard from "./ProductCard";

interface Props {
  /** The product being viewed — it is in the history but not worth showing. */
  currentId: string;
}

/**
 * The items this browser opened before this one. Renders nothing at all until
 * there is something to show, so a first-time visitor sees no empty heading.
 */
export default function RecentlyViewed({ currentId }: Props) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const ids = getRecentlyViewed().filter((id) => id !== currentId);
    const controller = new AbortController();
    let cancelled = false;

    // Ids can outlive the products they point at — something delisted stays in
    // this browser's history forever — so the response drives the row, not the
    // stored list. An empty history resolves to an empty row rather than
    // returning early, which keeps every setProducts off the synchronous path
    // through the effect.
    const load: Promise<Product[]> =
      ids.length === 0
        ? Promise.resolve([])
        : fetch(`/api/products?ids=${ids.map(encodeURIComponent).join(",")}`, {
            signal: controller.signal,
          }).then((res) => (res.ok ? res.json() : []));

    load
      .then((data) => {
        if (!cancelled) setProducts(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        /* aborted or offline — leave the row out */
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentId]);

  if (products.length === 0) return null;

  return (
    <section className="mt-20 md:mt-28 mb-4">
      <div className="mb-8">
        <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
          Picked up where you left off
        </p>
        <h2 className="text-2xl md:text-3xl font-bold uppercase text-[var(--foreground)]">
          Recently viewed
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.slice(0, 4).map((product) => (
          <div
            key={product.id}
            className="rounded-xl bg-[var(--background)] hover:shadow-md transition-all duration-200"
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
