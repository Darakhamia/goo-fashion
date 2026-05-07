"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useLikes } from "@/lib/context/likes-context";
import { useCart } from "@/lib/context/cart-context";
import { useCurrency, CURRENCIES } from "@/lib/context/currency-context";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { useStylist } from "@/lib/context/stylist-context";
import { useTheme } from "@/lib/context/theme-context";

const navLinks = [
  { href: "/browse", label: "Browse" },
  { href: "/builder", label: "Builder" },
  { href: "/blog", label: "Journal" },
  { href: "/plans", label: "Plans" },
];

export default function Navigation() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const { isOpen: stylistOpen, toggle: toggleStylist } = useStylist();
  const cartDrawerRef = useRef<HTMLDivElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);
  const { likedOutfits, likedProducts } = useLikes();
  const { theme, toggleTheme } = useTheme();
  const { cartItems, removeFromCart } = useCart();
  const { currency, setCurrency, formatPrice } = useCurrency();

  const isHero = pathname === "/";
  const isBuilder = pathname === "/builder";
  const showWhiteText = isHero && !scrolled;
  const totalLikes = likedOutfits.length + likedProducts.length;
  const cartCount = cartItems.length;
  const cartTotal = cartItems.reduce((sum, item) => sum + item.price, 0);

  // Close cart drawer on click outside
  useEffect(() => {
    if (!cartOpen) return;
    const handler = (e: MouseEvent) => {
      if (cartDrawerRef.current && !cartDrawerRef.current.contains(e.target as Node)) {
        setCartOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [cartOpen]);

  // Close currency dropdown on click outside
  useEffect(() => {
    if (!currencyOpen) return;
    const handler = (e: MouseEvent) => {
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) {
        setCurrencyOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [currencyOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const headerBg = scrolled
    ? "bg-[var(--bg-overlay-95)] backdrop-blur-sm border-b border-[var(--border)]"
    : isHero
    ? "bg-gradient-to-b from-black/60 via-black/20 to-transparent"
    : "bg-[var(--background)] border-b border-[var(--border)]";

  const logoColor = showWhiteText ? "text-white" : "text-[var(--foreground)]";
  const linkActive = showWhiteText ? "text-white" : "text-[var(--foreground)]";
  const linkMuted = showWhiteText
    ? "text-white/60 hover:text-white"
    : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]";
  const iconColor = showWhiteText
    ? "text-white/60 hover:text-white"
    : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]";

  return (
    <>
    <header className={`sticky top-0 left-0 right-0 z-50 transition-all duration-300 ${headerBg} ${isBuilder ? "hidden md:block" : ""}`}>
      <nav className="max-w-[1440px] mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className={`text-2xl font-black tracking-[0.2em] hover:opacity-70 transition-opacity duration-200 ${logoColor}`}
        >
          GOO
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-10">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-xs tracking-[0.12em] uppercase font-medium transition-colors duration-200 link-underline ${
                pathname === link.href ? linkActive : linkMuted
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-6">
          {/* Currency selector */}
          <div ref={currencyRef} className="relative">
            <button
              onClick={() => setCurrencyOpen((v) => !v)}
              className={`flex items-center gap-1 text-[10px] tracking-[0.14em] uppercase font-medium transition-colors duration-200 ${iconColor}`}
              aria-label="Select currency"
            >
              {currency}
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`transition-transform duration-150 ${currencyOpen ? "rotate-180" : ""}`}>
                <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {currencyOpen && (
              <div className="absolute top-full right-0 mt-2 w-36 rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-lg z-50 py-1.5 overflow-hidden">
                {CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => { setCurrency(c.code); setCurrencyOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:bg-[var(--surface)] rounded-lg mx-0 ${
                      currency === c.code
                        ? "text-[var(--foreground)]"
                        : "text-[var(--foreground-muted)]"
                    }`}
                  >
                    <span>{c.code}</span>
                    <span className="text-[var(--foreground-subtle)]">{c.symbol}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Cart */}
          <button
            onClick={() => setCartOpen(v => !v)}
            aria-label="Cart"
            className={`relative transition-colors duration-200 ${cartOpen ? (showWhiteText ? "text-white" : "text-[var(--foreground)]") : iconColor}`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 1h2l1.5 7.5h8l1.5-5.5H4" />
              <circle cx="6.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
              <circle cx="11.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[var(--foreground)] flex items-center justify-center">
                <span className={`text-[7px] font-medium ${showWhiteText ? "text-black" : "text-[var(--background)]"}`}>
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              </span>
            )}
          </button>

          {/* Saved */}
          <Link
            href="/saved"
            aria-label="Saved items"
            className={`relative transition-colors duration-200 ${iconColor}`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z"
                stroke="currentColor"
                strokeWidth="1.2"
                fill={pathname === "/saved" ? "currentColor" : "none"}
              />
            </svg>
            {totalLikes > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[var(--foreground)] flex items-center justify-center">
                <span className={`text-[7px] font-medium ${showWhiteText ? "text-black" : "text-[var(--background)]"}`}>
                  {totalLikes > 9 ? "9+" : totalLikes}
                </span>
              </span>
            )}
          </Link>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className={`transition-colors duration-200 ${iconColor}`}
          >
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="3" />
                <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M11.89 4.11l1.06-1.06M3.05 12.95l1.06-1.06" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7z" />
              </svg>
            )}
          </button>

          {/* Profile */}
          <SignedIn>
            <Link
              href="/profile"
              aria-label="Style profile"
              className={`transition-colors duration-200 ${pathname === "/profile" ? linkActive : iconColor}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M2.5 14C2.5 11.515 5.015 9.5 8 9.5s5.5 2.015 5.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </Link>
          </SignedIn>
          <SignedOut>
            <Link
              href="/login"
              className={`text-xs tracking-[0.12em] uppercase font-medium transition-colors duration-200 ${linkMuted}`}
            >
              Sign in
            </Link>
          </SignedOut>
        </div>

        {/* Mobile: AI Stylist + Cart */}
        <div className="md:hidden flex items-center gap-3">
          <button
            onClick={toggleStylist}
            aria-label="Open AI Stylist"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all duration-200 ${
              stylistOpen
                ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                : showWhiteText
                ? "bg-white/10 text-white border-white/30 hover:bg-white/20"
                : "bg-[var(--surface)] text-[var(--foreground-muted)] border-[var(--border)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 1.5L9.5 6H14L10.5 8.5L11.8 13L8 10.5L4.2 13L5.5 8.5L2 6H6.5L8 1.5Z" />
            </svg>
            <span className="text-[9px] tracking-[0.1em] uppercase font-medium leading-none">
              AI Stylist
            </span>
          </button>

          {/* Theme toggle — mobile */}
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className={`transition-colors duration-200 ${iconColor}`}
          >
            {theme === "dark" ? (
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="3" />
                <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M11.89 4.11l1.06-1.06M3.05 12.95l1.06-1.06" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => setCartOpen(v => !v)}
            aria-label="Cart"
            className={`relative transition-colors duration-200 ${cartOpen ? (showWhiteText ? "text-white" : "text-[var(--foreground)]") : iconColor}`}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 1h2l1.5 7.5h8l1.5-5.5H4" />
              <circle cx="6.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
              <circle cx="11.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[var(--foreground)] flex items-center justify-center">
                <span className={`text-[7px] font-medium ${showWhiteText ? "text-black" : "text-[var(--background)]"}`}>
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              </span>
            )}
          </button>
        </div>
      </nav>

    </header>

      {/* Cart drawer overlay — rendered outside <header> to avoid sticky stacking context issues */}
      {cartOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setCartOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div
            ref={cartDrawerRef}
            className="fixed top-3 right-3 bottom-3 w-full max-w-[360px] z-50 bg-[var(--background)] rounded-2xl border border-[var(--border)] flex flex-col animate-slide-in-right overflow-hidden"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
          >
            {/* Drawer header */}
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
              <div>
                <p className="text-[13px] font-medium text-[var(--foreground)]">Cart</p>
                <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] mt-0.5">
                  {cartCount === 0
                    ? "Empty"
                    : `${cartCount} ${cartCount === 1 ? "item" : "items"}`}
                </p>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors text-xl leading-none"
                aria-label="Close cart"
              >
                ×
              </button>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto">
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--border-strong)]">
                    <path d="M2 2h4l3 15h16l3-11H8" />
                    <circle cx="13" cy="27" r="2" />
                    <circle cx="23" cy="27" r="2" />
                  </svg>
                  <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">
                    Your cart is empty
                  </p>
                  <p className="text-[11px] text-[var(--foreground-subtle)] leading-relaxed">
                    Build an outfit in the builder and click&nbsp;&ldquo;Shop the Look&rdquo; to add items here.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-2 p-3">
                  {cartItems.map(item => (
                    <li key={item.id} className="flex gap-3 px-3 py-3 items-start rounded-xl border border-[var(--border)] bg-[var(--background)] hover:border-[var(--foreground-muted)] transition-all duration-200">
                      {/* Thumbnail — links to product page */}
                      <Link
                        href={`/product/${item.id}`}
                        onClick={() => setCartOpen(false)}
                        className="w-[52px] h-[66px] shrink-0 bg-[var(--surface)] overflow-hidden rounded-lg hover:opacity-80 transition-opacity"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </Link>
                      {/* Info */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <Link
                          href={`/product/${item.id}`}
                          onClick={() => setCartOpen(false)}
                          className="text-[12px] font-medium text-[var(--foreground)] leading-snug line-clamp-2 hover:underline block"
                        >
                          {item.name}
                        </Link>
                        <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-[var(--foreground-muted)] mt-0.5">
                          {item.brand}
                        </p>
                        <p className="font-mono text-[11px] text-[var(--foreground)] mt-1">
                          {formatPrice(item.price)}
                        </p>
                      </div>
                      {/* Remove */}
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="shrink-0 mt-0.5 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
                        aria-label={`Remove ${item.name}`}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            {cartItems.length > 0 && (
              <div className="shrink-0 border-t border-[var(--border)] px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">
                    Estimated total
                  </p>
                  <p className="text-[20px] font-bold text-[var(--foreground)]">
                    {formatPrice(cartTotal)}
                  </p>
                </div>
                <p className="font-mono text-[8px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] text-center">
                  Checkout coming soon · Links open in retailer sites
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
