"use client";

import Link from "next/link";
import { useCart } from "@/lib/context/cart-context";
import { useCurrency } from "@/lib/context/currency-context";
import { CartRow, OpenAllPanel, cartTotalUsd, useCartStores } from "@/components/cart/CartPanel";

/**
 * The drawer's contents at full width: same rows, same "open all" step, room
 * for the whole list without scrolling a 400px panel.
 */
export default function CartPage() {
  const { cartItems, hydrated, removeFromCart, clearCart } = useCart();
  const { formatPrice, convertToUsd } = useCurrency();

  const rows = useCartStores(cartItems, hydrated);
  const count = cartItems.length;
  const total = cartTotalUsd(cartItems, convertToUsd);

  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="pt-12 md:pt-16 mb-10">
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
            Cart
          </p>
          <h1 className="text-4xl md:text-5xl font-black uppercase text-[var(--foreground)]">
            Your Bag
          </h1>
        </div>

        {/* The cart lives in localStorage, so the list is unknown until the
            provider has read it — showing the empty state first would tell a
            full cart it is empty. */}
        {!hydrated ? (
          <ul className="flex flex-col gap-2 max-w-[720px] pb-24">
            {[0, 1, 2].map(i => (
              <li key={i} className="h-[85px] rounded-xl border border-[var(--border)] bg-[var(--surface)] animate-pulse" />
            ))}
          </ul>
        ) : count === 0 ? (
          <div className="py-20 px-8 text-center bg-[var(--surface)] rounded-2xl border border-[var(--border)] mb-24">
            <p className="text-2xl font-bold text-[var(--foreground)] mb-2">Your cart is empty</p>
            <p className="text-sm text-[var(--foreground-muted)] mb-8">
              Build an outfit in the builder and add the look here, or pick pieces one by one.
            </p>
            <Link href="/browse"
              className="inline-block text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-4 rounded-xl hover:opacity-80 transition-opacity duration-200">
              Browse the catalog
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 pb-24 max-w-[1120px]">
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
                    Clear cart
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
