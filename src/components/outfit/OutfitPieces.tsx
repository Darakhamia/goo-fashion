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
      <p className="text-[13px] md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium text-[var(--foreground-muted)] md:text-[var(--foreground-subtle)] mb-2.5 md:mb-6">
        Pieces in this outfit
      </p>

      <div className="space-y-2">
        {visible.map(({ product }) => (
          <Link
            key={product.id}
            href={`/product/${product.id}`}
            className="group flex items-center gap-3 md:gap-4 max-md:min-h-16 py-2 pl-2 pr-3 md:p-3 rounded-[14px] md:rounded-xl md:border md:border-[var(--border)] md:hover:border-[var(--foreground-muted)] md:hover:shadow-sm bg-[var(--surface)] md:bg-[var(--background)] md:hover:bg-[var(--surface)] transition-colors duration-200"
          >
            <div className="w-12 h-12 shrink-0 overflow-hidden relative bg-white md:bg-[var(--surface)] rounded-[10px] md:rounded-lg">
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                className="object-cover"
                sizes="48px"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="max-md:truncate text-[12px] md:text-[9px] md:tracking-[0.16em] md:uppercase text-[var(--foreground-muted)] md:text-[var(--foreground-subtle)] md:mb-0.5">
                {product.brand}
              </p>
              <p className="text-sm max-md:font-medium text-[var(--foreground)] truncate">{product.name}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm max-md:font-semibold text-[var(--foreground)]">
                From <Price amount={product.priceMin} />
              </p>
              <p className="text-[11px] md:text-[9px] text-[var(--foreground-muted)] md:text-[var(--foreground-subtle)] mt-0.5">
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
          className="mt-3 w-full flex items-center justify-center gap-2 h-11 md:h-auto md:py-3 rounded-full md:rounded-xl bg-[var(--fg-overlay-08)] md:bg-transparent md:border md:border-[var(--border)] text-[14px] md:text-[10px] md:tracking-[0.16em] md:uppercase font-medium text-[var(--foreground)] md:text-[var(--foreground-muted)] md:hover:text-[var(--foreground)] md:hover:border-[var(--foreground-muted)] transition-colors duration-200"
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
