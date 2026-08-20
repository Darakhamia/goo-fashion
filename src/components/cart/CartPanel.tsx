"use client";

import Link from "next/link";
import Image from "@/components/ui/Image";
import { useState } from "react";
import type { CartItem } from "@/lib/context/cart-context";
import { useCurrency } from "@/lib/context/currency-context";

/* Inline SVG only — the project ships no icon library (DESIGN_SYSTEM 5.3). */

export function ExternalLinkIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 2.5h4v4" />
      <path d="M13.5 2.5L7.5 8.5" />
      <path d="M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3" />
    </svg>
  );
}

export function CloseIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Sums a mixed-currency cart into USD, the base every price is converted from. */
export function cartTotalUsd(items: CartItem[], convert: (amount: number, source: string) => number) {
  return items.reduce((sum, item) => sum + convert(item.price, item.currency || "USD"), 0);
}

interface CartRowProps {
  item: CartItem;
  onRemove: (id: string) => void;
  /** Lets the drawer close itself when the row navigates to the product page. */
  onNavigate?: () => void;
}

/**
 * One line of the cart: photo, name, brand, price, and the two things a user
 * actually does with a piece — open the retailer page or take it out.
 *
 * The retailer link is the row's visible action; removal stays out of the way
 * until hover on desktop, and is always reachable on touch, where there is no
 * hover to reveal it.
 */
export function CartRow({ item, onRemove, onNavigate }: CartRowProps) {
  const { formatPrice } = useCurrency();

  return (
    <li className="group flex items-center gap-3 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] transition-colors duration-200">
      <Link href={`/product/${item.id}`} onClick={onNavigate} className="flex items-center gap-3 flex-1 min-w-0">
        {/* bg-white is the measured backdrop of a catalog cut-out, see DESIGN_SYSTEM 1 */}
        <div className="w-[60px] h-[60px] shrink-0 rounded-lg bg-white overflow-hidden">
          <Image src={item.imageUrl} alt={item.name} width={60} height={60}
            className="w-full h-full object-contain p-1" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-[var(--foreground)] leading-snug line-clamp-1">{item.name}</p>
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mt-1 truncate">{item.brand}</p>
          <p className="text-[13px] text-[var(--foreground)] mt-1.5">{formatPrice(item.price, item.currency)}</p>
        </div>
      </Link>

      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${item.name} from cart`}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--foreground-subtle)] hover:text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)] transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
        >
          <CloseIcon size={11} />
        </button>
        {item.retailerUrl && (
          <a
            href={item.retailerUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${item.name} on the official store`}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)] transition-all"
          >
            <ExternalLinkIcon />
          </a>
        )}
      </div>
    </li>
  );
}

/**
 * The buy step. Every piece is bought on its own store, so checkout is "open all
 * of them at once" rather than a basket we could charge for. One click opens a
 * tab per piece in the cart — nothing is left behind — while the status line
 * still says how many of those tabs are official store links.
 */
export function OpenAllPanel({ items }: { items: CartItem[] }) {
  const [popupBlocked, setPopupBlocked] = useState(false);
  const total = items.length;
  const linkedCount = items.filter((item) => item.retailerUrl).length;
  const fallbackCount = total - linkedCount;
  const allVerified = total > 0 && linkedCount === total;

  // Every piece in the cart gets a tab. One that carries an official store link
  // opens the store; one that does not opens its own page here, which is where
  // its retailers are listed — so the button never leaves a piece behind.
  const openAll = () => {
    let blocked = false;
    items.forEach((item) => {
      const href = item.retailerUrl ?? `/product/${item.id}`;
      const win = window.open(href, "_blank", "noopener,noreferrer");
      if (!win) blocked = true;
    });
    setPopupBlocked(blocked);
  };

  const status = linkedCount === 0
    ? "No store links yet"
    : allVerified
      ? "All links verified"
      : `${linkedCount} of ${total} links verified`;

  const caption = popupBlocked
    ? "Your browser blocked some tabs — allow pop-ups for this site to open them all."
    : allVerified
      ? `This will open ${total} official product ${total === 1 ? "page" : "pages"} in new tabs.`
      : `This will open ${total} tabs: ${linkedCount} official product ${linkedCount === 1 ? "page" : "pages"} and ${fallbackCount} ${fallbackCount === 1 ? "piece" : "pieces"} on GOO.`;

  return (
    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <p className="flex items-center gap-2 text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
        <span className={`w-1.5 h-1.5 rounded-full inline-block ${linkedCount > 0 ? "bg-emerald-500" : "bg-[var(--border-strong)]"}`} />
        {status}
      </p>
      <button
        onClick={openAll}
        disabled={total === 0}
        className="w-full h-11 md:h-10 rounded-xl flex items-center justify-center gap-2 text-[11px] tracking-[0.1em] uppercase font-semibold bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ExternalLinkIcon size={13} />
        Open all
        <span className="opacity-60">· {total} {total === 1 ? "item" : "items"}</span>
      </button>
      <p className="text-[11px] text-[var(--foreground-muted)] leading-relaxed text-center mt-2.5">{caption}</p>
    </div>
  );
}
