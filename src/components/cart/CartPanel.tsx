"use client";

import Link from "next/link";
import Image from "@/components/ui/Image";
import { useEffect, useRef, useState } from "react";
import type { CartItem, CartRetailer } from "@/lib/context/cart-context";
import type { Product } from "@/lib/types";
import { toCartRetailers } from "@/lib/cart-item";
import { useCurrency } from "@/lib/context/currency-context";
import { useOverlayPresence } from "@/lib/hooks/useOverlayPresence";

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

/** The phone row's store control: a soft pill, 34 px tall with a 44 px target. */
const PILL = "relative h-[34px] max-w-[160px] px-3 rounded-full bg-[var(--fg-overlay-08)] text-[var(--foreground)] text-[13px] flex items-center gap-1.5 after:absolute after:inset-x-0 after:-inset-y-[5px]";

interface StoreLinksProps {
  item: CartItem;
  /** `icon` — the desktop row's 32 px circle; `pill` — the phone row's soft pill. */
  variant: "icon" | "pill";
}

/**
 * Where a piece can be bought. A piece sold in several stores is not opened by
 * our guess: the button lists them and the buyer picks. One store means one
 * link and no menu in the way.
 */
function StoreLinks({ item, variant }: StoreLinksProps) {
  const { formatPrice } = useCurrency();
  const [storesOpen, setStoresOpen] = useState(false);
  const storesOv = useOverlayPresence(storesOpen);
  const [openUpwards, setOpenUpwards] = useState(false);
  const storesRef = useRef<HTMLDivElement>(null);
  const storeButtonRef = useRef<HTMLButtonElement>(null);

  const stores = storesOf(item);
  const pill = variant === "pill";

  useEffect(() => {
    if (!storesOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (storesRef.current && !storesRef.current.contains(e.target as Node)) setStoresOpen(false);
    };
    // Capture, and mark the key as used: the bag sheet around the menu closes
    // on Escape too, and one press should close only the menu.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setStoresOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [storesOpen]);

  // A row near the bottom of a drawer has no room below it, and the list it
  // sits in scrolls, so the menu would open into nothing.
  const toggleStores = () => {
    const box = storeButtonRef.current?.getBoundingClientRect();
    if (box) setOpenUpwards(box.bottom > window.innerHeight * 0.6);
    setStoresOpen((open) => !open);
  };

  if (stores.length === 1) {
    return pill ? (
      <a
        href={stores[0].url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${item.name} on ${storeLabel(stores[0])}`}
        className={PILL}
      >
        <span className="truncate">{storeLabel(stores[0])}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
          <path d="M8 16L16 8M9 8h7v7" />
        </svg>
      </a>
    ) : (
      <a
        href={stores[0].url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${item.name} on ${storeLabel(stores[0])}`}
        className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)] transition-colors"
      >
        <ExternalLinkIcon />
      </a>
    );
  }

  if (stores.length === 0) return null;

  return (
    <div ref={storesRef} className="relative">
      {pill ? (
        <button
          ref={storeButtonRef}
          onClick={toggleStores}
          aria-label={`Choose a store for ${item.name}`}
          aria-expanded={storesOpen}
          className={PILL}
        >
          {stores.length} stores
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            className={`shrink-0 transition-transform ${storesOpen ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      ) : (
        <button
          ref={storeButtonRef}
          onClick={toggleStores}
          aria-label={`Choose a store for ${item.name}`}
          aria-expanded={storesOpen}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
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
      )}

      {storesOv.rendered && (
        <div
          role="menu"
          onTransitionEnd={storesOv.onTransitionEnd}
          className={storesOv.cls(
            `ov-pop absolute right-0 z-30 ${pill ? "w-[240px] rounded-2xl" : "w-[210px] rounded-xl border border-[var(--border)]"} bg-[var(--background)] overflow-hidden ${
              openUpwards ? "ov-pop-up bottom-full mb-2" : "top-full mt-2"
            }`
          )}
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.28)" }}
        >
          <p className={pill
            ? "px-4 pt-3 pb-1 text-[13px] text-[var(--foreground-muted)]"
            : "px-3 pt-3 pb-2 text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]"}>
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
                  className={`flex items-center justify-between gap-3 ${pill ? "min-h-12 px-4 py-2" : "px-3 py-2.5"} hover:bg-[var(--fg-overlay-05)] transition-colors`}
                >
                  <span className="min-w-0">
                    <span className={`block ${pill ? "text-[15px]" : "text-[12px]"} font-medium text-[var(--foreground)] truncate`}>{storeLabel(store)}</span>
                    {store.isOfficial && (
                      <span className={pill
                        ? "block text-[12px] text-[var(--foreground-muted)]"
                        : "block text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-subtle)] mt-0.5"}>
                        Official
                      </span>
                    )}
                  </span>
                  {typeof store.price === "number" && (
                    <span className={`shrink-0 ${pill ? "text-[14px]" : "text-[12px]"} text-[var(--foreground-muted)]`}>
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
  );
}

interface CartRowProps {
  item: CartItem;
  onRemove: (id: string) => void;
  /** Lets the drawer close itself when the row navigates to the product page. */
  onNavigate?: () => void;
}

/**
 * One line of the bag on desktop: photo, name, brand, price, and the two things
 * a user actually does with a piece — go to a store that carries it, or take it
 * out. Removal stays out of the way until hover on desktop, and is always
 * reachable on touch, where there is no hover to reveal it.
 */
export function CartRow({ item, onRemove, onNavigate }: CartRowProps) {
  const { formatPrice } = useCurrency();

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
          aria-label={`Remove ${item.name} from bag`}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--foreground-subtle)] hover:text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)] transition-[color,background-color,border-color,opacity] opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
        >
          <CloseIcon size={11} />
        </button>

        <StoreLinks item={item} variant="icon" />
      </div>
    </li>
  );
}

/**
 * One line of the bag on a phone (mockup v2 «Б · Корзина»): a tall photo, brand
 * over name, the price, and the store as a pill under them. Rows are divided by
 * a hairline, not framed — the sheet or plaque around them is the frame.
 */
export function BagRow({ item, onRemove, onNavigate }: CartRowProps) {
  const { formatPrice } = useCurrency();

  return (
    <li className="flex gap-3 py-3 not-first:shadow-[inset_0_1px_0_var(--border)]">
      {/* The name below is the same link; this one is for the thumb, not the reader. */}
      <Link href={`/product/${item.id}`} onClick={onNavigate} tabIndex={-1} aria-hidden="true"
        className="w-[72px] h-[92px] shrink-0 rounded-xl bg-white overflow-hidden">
        <Image src={item.imageUrl} alt="" width={72} height={92}
          className="w-full h-full object-contain p-1" />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1.5">
          <Link href={`/product/${item.id}`} onClick={onNavigate} className="flex-1 min-w-0">
            <span className="block text-[12px] text-[var(--foreground-muted)] truncate">{item.brand}</span>
            <span className="block mt-px text-[15px] font-medium text-[var(--foreground)] truncate">{item.name}</span>
          </Link>
          <button
            onClick={() => onRemove(item.id)}
            aria-label={`Remove ${item.name} from bag`}
            className="-mt-2.5 -mr-2.5 w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-[var(--foreground-muted)]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          </button>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold text-[var(--foreground)]">{formatPrice(item.price, item.currency)}</span>
          <StoreLinks item={item} variant="pill" />
        </div>
      </div>
    </li>
  );
}

/** The empty bag on a phone (mockup v2 «Б · Корзина — пусто»); the page puts it on a plaque. */
export function BagEmpty({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="w-16 h-16 rounded-full bg-[var(--fg-overlay-08)] flex items-center justify-center text-[var(--foreground-muted)]">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8h12l-1 12H7L6 8Z" />
          <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
        </svg>
      </span>
      <h3 className="mt-[18px] text-[19px] font-semibold text-[var(--foreground)]">Your bag is empty</h3>
      <p className="mt-1.5 text-[14px] leading-normal text-[var(--foreground-muted)]">
        Build an outfit in the builder and add the look here, or pick pieces one by one.
      </p>
      <Link href="/browse" onClick={onNavigate}
        className="mt-[22px] h-[46px] px-[22px] rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center text-[15px] font-semibold">
        Browse the catalogue
      </Link>
    </div>
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
function useOpenAll(items: CartItem[]) {
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

  /** A refused piece, opened by hand, leaves the list. */
  const openedBlocked = (id: string) => setBlockedItems((rest) => rest.filter((x) => x.id !== id));

  return { count, linked, status, caption, hint, blockedItems, openAll, openedBlocked };
}

export function OpenAllPanel({ items }: { items: CartItem[] }) {
  const { count, linked, status, caption, hint, blockedItems, openAll, openedBlocked } = useOpenAll(items);

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
                onClick={() => openedBlocked(item.id)}
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

/**
 * The buy step on a phone (mockup v2 «Б · Корзина»): the total, one primary
 * pill that opens every store, and how many links are verified. Same "open all"
 * as the desktop panel, including the list of pieces the browser refused.
 */
export function BagCheckout({ items, total }: { items: CartItem[]; total: string }) {
  const { count, linked, status, caption, hint, blockedItems, openAll, openedBlocked } = useOpenAll(items);
  // Pieces without a store open on GOO, so the button only says "stores" when all have one.
  const noun = linked.length === count ? (count === 1 ? "store" : "stores") : (count === 1 ? "page" : "pages");
  const label = count === 1 ? `Open the ${noun}` : `Open all ${count} ${noun}`;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[14px] text-[var(--foreground-muted)]">Total</span>
        <span className="text-[18px] font-semibold text-[var(--foreground)]">{total}</span>
      </div>
      <button
        onClick={openAll}
        disabled={count === 0}
        className="mt-3 w-full h-12 rounded-full bg-[var(--foreground)] text-[var(--background)] text-[15px] font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {label}
      </button>
      <p className="mt-2 text-center text-[12px] leading-relaxed text-[var(--foreground-muted)]">
        {blockedItems.length > 0 ? caption : status}
      </p>

      {hint && (
        <p className="mt-2 text-center text-[13px] leading-relaxed text-[var(--foreground)]">
          To open all {count} at once, {hint} — then press the button again.
        </p>
      )}

      {blockedItems.length > 0 && (
        <ul className="flex flex-col gap-2 mt-3">
          {blockedItems.map((item) => (
            <li key={item.id}>
              <a
                href={openAllTarget(item)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => openedBlocked(item.id)}
                className="w-full h-11 px-4 rounded-full bg-[var(--fg-overlay-08)] flex items-center justify-between gap-2 text-[14px] font-medium text-[var(--foreground)]"
              >
                <span className="truncate">{item.name}</span>
                <ExternalLinkIcon size={13} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
