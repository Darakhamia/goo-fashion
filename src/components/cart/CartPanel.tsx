"use client";

import Link from "next/link";
import Image from "@/components/ui/Image";
import { useEffect, useRef, useState } from "react";
import type { CartItem, CartRetailer } from "@/lib/context/cart-context";
import type { Product } from "@/lib/types";
import { toCartRetailers } from "@/lib/cart-item";
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

/** Readable name for a store, falling back to its domain when unnamed. */
function storeLabel(store: CartRetailer) {
  if (store.name?.trim()) return store.name.trim();
  try {
    return new URL(store.url).hostname.replace(/^www\./, "");
  } catch {
    return "Store";
  }
}

/**
 * The stores of one piece. A cart saved before stores were kept holds a single
 * `retailerUrl`, so that one still reads as a store rather than disappearing.
 */
export function storesOf(item: CartItem): CartRetailer[] {
  if (item.retailers?.length) return item.retailers;
  return item.retailerUrl ? [{ name: "", url: item.retailerUrl }] : [];
}

/** Where "open all" sends a piece: its first store, else its page here. */
function openAllTarget(item: CartItem) {
  return storesOf(item)[0]?.url ?? `/product/${item.id}`;
}

/**
 * Fills in the stores of pieces saved before the cart kept them — one request
 * for the whole cart, answered from the CDN for five minutes, so an existing
 * cart offers a choice of stores without being emptied and refilled first.
 *
 * `enabled` keeps the request tied to the cart actually being on screen: the
 * header mounts on every page, and a closed drawer has nothing to ask about.
 */
export function useCartStores(items: CartItem[], enabled = true): CartItem[] {
  const [fetched, setFetched] = useState<Record<string, CartRetailer[]>>({});

  // `ids=` resolves at most 24, which is also more pieces than a cart holds.
  const missing = enabled
    ? items.filter((item) => !item.retailers && !(item.id in fetched)).map((item) => item.id).slice(0, 24)
    : [];
  const key = missing.join(",");

  useEffect(() => {
    if (!key) return;
    let alive = true;
    fetch(`/api/products?ids=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((products: Product[]) => {
        if (!alive || !Array.isArray(products)) return;
        // Every id asked for is recorded, found or not, so a piece the catalog
        // no longer carries is not re-requested on each render.
        const next: Record<string, CartRetailer[]> = {};
        for (const id of key.split(",")) next[id] = [];
        for (const product of products) next[product.id] = toCartRetailers(product.retailers);
        setFetched((prev) => ({ ...prev, ...next }));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [key]);

  return items.map((item) =>
    item.retailers || !fetched[item.id]?.length ? item : { ...item, retailers: fetched[item.id] },
  );
}

interface CartRowProps {
  item: CartItem;
  onRemove: (id: string) => void;
  /** Lets the drawer close itself when the row navigates to the product page. */
  onNavigate?: () => void;
}

/**
 * One line of the cart: photo, name, brand, price, and the two things a user
 * actually does with a piece — go to a store that carries it, or take it out.
 *
 * A piece sold in several stores is not opened by our guess: the button lists
 * them and the buyer picks. One store means one link and no menu in the way.
 * Removal stays out of the way until hover on desktop, and is always reachable
 * on touch, where there is no hover to reveal it.
 */
export function CartRow({ item, onRemove, onNavigate }: CartRowProps) {
  const { formatPrice } = useCurrency();
  const [storesOpen, setStoresOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const storesRef = useRef<HTMLDivElement>(null);
  const storeButtonRef = useRef<HTMLButtonElement>(null);

  const stores = storesOf(item);

  useEffect(() => {
    if (!storesOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (storesRef.current && !storesRef.current.contains(e.target as Node)) setStoresOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStoresOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [storesOpen]);

  // A row near the bottom of a drawer has no room below it, and the list it
  // sits in scrolls, so the menu would open into nothing.
  const toggleStores = () => {
    const box = storeButtonRef.current?.getBoundingClientRect();
    if (box) setOpenUpwards(box.bottom > window.innerHeight * 0.6);
    setStoresOpen((open) => !open);
  };

  return (
    <li className="group relative flex items-center gap-3 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] transition-colors duration-200">
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

        {stores.length === 1 && (
          <a
            href={stores[0].url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${item.name} on ${storeLabel(stores[0])}`}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)] transition-all"
          >
            <ExternalLinkIcon />
          </a>
        )}

        {stores.length > 1 && (
          <div ref={storesRef} className="relative">
            <button
              ref={storeButtonRef}
              onClick={toggleStores}
              aria-label={`Choose a store for ${item.name}`}
              aria-expanded={storesOpen}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                storesOpen
                  ? "text-[var(--foreground)] bg-[var(--fg-overlay-05)]"
                  : "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)]"
              }`}
            >
              <ExternalLinkIcon />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--foreground)] text-[var(--background)] text-[8px] font-bold flex items-center justify-center">
                {stores.length}
              </span>
            </button>

            {storesOpen && (
              <div
                role="menu"
                className={`absolute right-0 z-30 w-[210px] rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden animate-fade-in ${
                  openUpwards ? "bottom-full mb-2" : "top-full mt-2"
                }`}
                style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.28)" }}
              >
                <p className="px-3 pt-3 pb-2 text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
                  {stores.length} stores
                </p>
                <ul>
                  {stores.map((store) => (
                    <li key={store.url}>
                      <a
                        href={store.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        role="menuitem"
                        onClick={() => setStoresOpen(false)}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-[var(--fg-overlay-05)] transition-colors"
                      >
                        <span className="min-w-0">
                          <span className="block text-[12px] font-medium text-[var(--foreground)] truncate">{storeLabel(store)}</span>
                          {store.isOfficial && (
                            <span className="block text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-subtle)] mt-0.5">Official</span>
                          )}
                        </span>
                        {typeof store.price === "number" && (
                          <span className="shrink-0 text-[12px] text-[var(--foreground-muted)]">
                            {formatPrice(store.price, store.currency)}
                          </span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Where each browser hides the switch that lets a site open more than one tab.
 * Named exactly, because "allow pop-ups" is not a thing anyone finds by being
 * told to look for it.
 */
function allowPopupsHint() {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/Firefox\//.test(ua)) return "click Options in the bar Firefox shows at the top of the page and allow pop-ups for this site";
  if (/Edg\//.test(ua) || /Chrome\//.test(ua)) return "click the blocked-pop-ups icon at the right of the address bar and choose “Always allow”";
  if (/Safari\//.test(ua)) return "open Safari → Settings → Websites → Pop-up Windows and set this site to Allow";
  return "allow pop-ups for this site in your browser settings";
}

/**
 * The buy step. Every piece is bought on its own store, so checkout here is
 * "open all of them at once".
 *
 * Whether that happens is the browser's call, not ours. Measured in Chrome with
 * its pop-up blocker on: five links open one tab, and it makes no difference
 * whether they are opened by window.open, by window.open without a features
 * string, or by clicking synthesised anchors — one click is one gesture and the
 * gesture is worth one tab. With the site allowed to open pop-ups, the same
 * five links open five tabs. So there is nothing to work around in code: the
 * panel opens them all, and when the browser refuses it says which switch turns
 * this on, in that browser's own words.
 *
 * Until it is turned on, the refused pieces are listed as ordinary links: each
 * tap is its own gesture, which no blocker touches, and the list shrinks as
 * they are opened.
 */
export function OpenAllPanel({ items }: { items: CartItem[] }) {
  const [blockedItems, setBlockedItems] = useState<CartItem[]>([]);
  const [hint, setHint] = useState("");
  const linked = items.filter((item) => storesOf(item).length > 0);
  const count = items.length;
  const allVerified = linked.length > 0 && linked.length === count;

  const openAll = () => {
    const blocked: CartItem[] = [];
    items.forEach((item) => {
      // No features string: with one, Chrome opens pop-up *windows* rather than
      // tabs. `opener` is cleared by hand for what the string used to carry.
      const win = window.open(openAllTarget(item), "_blank");
      if (win) win.opener = null;
      else blocked.push(item);
    });
    setBlockedItems(blocked);
    setHint(blocked.length > 0 ? allowPopupsHint() : "");
  };

  const status = linked.length === 0
    ? "No store links yet"
    : allVerified
      ? "All links verified"
      : `${linked.length} of ${count} links verified`;

  const caption = blockedItems.length > 0
    ? `Your browser opened ${count - blockedItems.length} of ${count} tabs and blocked the rest — it allows a site one tab per click.`
    : linked.length === count
      ? `This will open ${count} official product ${count === 1 ? "page" : "pages"} in new tabs.`
      : `This will open ${count} tabs: ${linked.length} official product ${linked.length === 1 ? "page" : "pages"}, and ${count - linked.length} ${count - linked.length === 1 ? "piece" : "pieces"} on GOO.`;

  return (
    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <p className="flex items-center gap-2 text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
        <span className={`w-1.5 h-1.5 rounded-full inline-block ${linked.length > 0 ? "bg-emerald-500" : "bg-[var(--border-strong)]"}`} />
        {status}
      </p>
      <button
        onClick={openAll}
        disabled={count === 0}
        className="w-full h-11 md:h-10 rounded-xl flex items-center justify-center gap-2 text-[11px] tracking-[0.1em] uppercase font-semibold bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ExternalLinkIcon size={13} />
        Open all
        <span className="opacity-60">· {count} {count === 1 ? "item" : "items"}</span>
      </button>
      <p className="text-[11px] text-[var(--foreground-muted)] leading-relaxed text-center mt-2.5">{caption}</p>

      {hint && (
        <p className="text-[11px] text-[var(--foreground)] leading-relaxed text-center mt-2 px-1">
          To open all {count} at once, {hint} — then press Open all again.
        </p>
      )}

      {blockedItems.length > 0 && (
        <ul className="flex flex-col gap-1.5 mt-3">
          {blockedItems.map((item) => (
            <li key={item.id}>
              <a
                href={openAllTarget(item)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setBlockedItems((rest) => rest.filter((x) => x.id !== item.id))}
                className="w-full h-10 px-3 rounded-xl border border-[var(--border)] flex items-center justify-between gap-2 text-[12px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors"
              >
                <span className="truncate">{item.name}</span>
                <ExternalLinkIcon size={12} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
