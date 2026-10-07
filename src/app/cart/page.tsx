"use client";

import Link from "next/link";
import { useCart } from "@/lib/context/cart-context";
import { useCurrency } from "@/lib/context/currency-context";
import { BagCheckout, BagEmpty, BagRow, CartRow, OpenAllPanel, cartTotalUsd, useCartStores } from "@/components/cart/CartPanel";

/**
 * The drawer's contents at full width: same rows, same "open all" step, room
 * for the whole list without scrolling a 400px panel. Below md the page uses
 * the phone bag's rows and buy step on plaques (DESIGN_SYSTEM.md §12).
 */
export default function CartPage() {
  const { cartItems, hydrated, removeFromCart, clearCart } = useCart();
  const { formatPrice, convertToUsd } = useCurrency();

  const rows = useCartStores(cartItems, hydrated);
  const count = cartItems.length;
  const total = cartTotalUsd(cartItems, convertToUsd);

  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-3 md:px-12">
        <div className="px-1 pt-5 mb-4 md:px-0 md:pt-16 md:mb-10">
          <p className="hidden md:block text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
            Bag
          </p>
          {/* Desktop keeps the -0.015em the size rule gave text-4xl (§12.13, tracking trap). */}
          <h1 className="text-2xl font-semibold tracking-[-0.015em] md:text-5xl md:font-black md:uppercase text-[var(--foreground)]">
            Your bag
          </h1>
        </div>

        {/* The cart lives in localStorage, so the list is unknown until the
            provider has read it — showing the empty state first would tell a
            full cart it is empty. */}
        {!hydrated ? (
          <ul className="flex flex-col gap-2 max-w-[720px] pb-24">
            {[0, 1, 2].map(i => (
              <li key={i} className="h-[116px] md:h-[85px] rounded-2xl md:rounded-xl md:border md:border-[var(--border)] bg-[var(--surface)] animate-pulse" />
            ))}
          </ul>
        ) : count === 0 ? (
          <>
          {/* Phone: the empty state on a plaque (§12.12) */}
          <div className="md:hidden mb-8 rounded-2xl bg-[var(--surface)] px-6 py-12">
            <BagEmpty />
          </div>
          <div className="hidden md:block py-20 px-8 text-center bg-[var(--surface)] rounded-2xl border border-[var(--border)] mb-24">
            <p className="text-2xl font-bold text-[var(--foreground)] mb-2">Your bag is empty</p>
            <p className="text-sm text-[var(--foreground-muted)] mb-8">
              Build an outfit in the builder and add the look here, or pick pieces one by one.
            </p>
            <Link href="/browse"
              className="inline-block text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-4 rounded-xl hover:opacity-80 transition-opacity duration-200">
              Browse the catalog
            </Link>
          </div>
          </>
        ) : (
          <>
          {/* Phone: rows on one plaque, then the buy step on its own (§12.11) */}
          <div className="md:hidden flex flex-col gap-2.5 pb-8">
            <ul className="rounded-2xl bg-[var(--surface)] px-4">
              {rows.map(item => (
                <BagRow key={item.id} item={item} onRemove={removeFromCart} />
              ))}
            </ul>
            <div className="rounded-2xl bg-[var(--surface)] px-4 py-4">
              <BagCheckout items={rows} total={formatPrice(total)} />
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--foreground-muted)]">
                Each piece is bought on the brand&rsquo;s own store — prices and shipping are theirs.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/browse"
                className="flex-1 h-12 rounded-full bg-[var(--fg-overlay-08)] flex items-center justify-center text-[15px] font-medium text-[var(--foreground)]">
                Keep shopping
              </Link>
              <button onClick={clearCart}
                className="flex-1 h-12 rounded-full bg-[var(--fg-overlay-08)] flex items-center justify-center text-[15px] font-medium text-[var(--foreground)]">
                Clear bag
              </button>
            </div>
          </div>
          <div className="hidden md:grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 pb-24 max-w-[1120px]">
            <ul className="flex flex-col gap-2">
              {rows.map(item => (
                <CartRow key={item.id} item={item} onRemove={removeFromCart} />
              ))}
            </ul>

            <aside className="flex flex-col gap-4 h-fit lg:sticky lg:top-24">
              <OpenAllPanel items={rows} />

              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
                    Total ({count} {count === 1 ? "item" : "items"})
                  </p>
                  <p className="text-[22px] font-bold text-[var(--foreground)]">{formatPrice(total)}</p>
                </div>
                <p className="text-[11px] text-[var(--foreground-muted)] leading-relaxed mt-2">
                  Each piece is bought on the brand&rsquo;s own store — prices and shipping are theirs.
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <Link href="/browse"
                    className="flex-1 h-10 rounded-xl border border-[var(--border)] flex items-center justify-center gap-1.5 text-[12px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors">
                    Keep shopping
                  </Link>
                  <button onClick={clearCart}
                    className="flex-1 h-10 rounded-xl border border-[var(--border)] flex items-center justify-center gap-1.5 text-[12px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors">
                    Clear bag
                  </button>
                </div>
              </div>
            </aside>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
