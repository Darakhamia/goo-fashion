"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/Image";
import Price from "@/components/ui/Price";
import type { OutfitItem } from "@/lib/types";

/** Rows shown before the list has to be opened. */
const COLLAPSED_COUNT = 3;

/**
 * The pieces that make up an outfit.
 *
 * A five- or six-piece look pushes everything under it off the screen, so only
 * the first three rows are shown and the rest sit behind a toggle. Below the
 * threshold there is nothing to hide and no toggle is rendered.
 */
export default function OutfitPieces({ items }: { items: OutfitItem[] }) {
  const [expanded, setExpanded] = useState(false);

  const collapsible = items.length > COLLAPSED_COUNT;
  const visible = collapsible && !expanded ? items.slice(0, COLLAPSED_COUNT) : items;
  const hiddenCount = items.length - COLLAPSED_COUNT;

  return (
    <div>
      <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-6">
        Pieces in this outfit
      </p>

      <div className="space-y-2">
        {visible.map(({ product }) => (
          <Link
            key={product.id}
            href={`/product/${product.id}`}
            className="group flex items-center gap-4 p-3 rounded-xl border border-[var(--border)] hover:border-[var(--foreground-muted)] hover:shadow-sm bg-[var(--background)] hover:bg-[var(--surface)] transition-all duration-200"
          >
            <div className="w-12 h-12 shrink-0 overflow-hidden relative bg-[var(--surface)] rounded-lg">
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                className="object-cover"
                sizes="48px"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-subtle)] mb-0.5">
                {product.brand}
              </p>
              <p className="text-sm text-[var(--foreground)] truncate">{product.name}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm text-[var(--foreground)]">
                From <Price amount={product.priceMin} />
              </p>
              <p className="text-[9px] text-[var(--foreground-subtle)] mt-0.5">
                {product.retailers.length} stores
              </p>
            </div>
          </Link>
        ))}
      </div>

      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[var(--border)] text-[10px] tracking-[0.16em] uppercase font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground-muted)] transition-colors duration-200"
        >
          {expanded ? "Show less" : `Show ${hiddenCount} more`}
          <svg
            width="11"
            height="11"
            viewBox="0 0 12 12"
            fill="none"
            className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
          >
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
