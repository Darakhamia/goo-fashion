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
  const [cartOpen, setCartOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [currencySubmenu, setCurrencySubmenu] = useState(false);
  const { isOpen: stylistOpen, toggle: toggleStylist } = useStylist();
  const cartDrawerRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const { likedOutfits, likedProducts } = useLikes();
  const { theme, toggleTheme } = useTheme();
  const { cartItems, removeFromCart } = useCart();
  const { currency, setCurrency, formatPrice, convertToUsd } = useCurrency();

  const isHero = pathname === "/";
  const isBuilder = pathname === "/builder";
  const showWhiteText = isHero && !scrolled && theme === "dark";
  const totalLikes = likedOutfits.length + likedProducts.length;
  const cartCount = cartItems.length;
  const cartTotalUsd = cartItems.reduce(
    (sum, item) => sum + convertToUsd(item.price, item.currency || "USD"),
    0,
  );

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

  // Close profile dropdown on click outside
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
        setCurrencySubmenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const headerBg = scrolled
    ? "bg-[var(--bg-overlay-95)] backdrop-blur-sm border-b border-[var(--border)]"
    : isHero
    ? theme === "dark"
      ? "bg-gradient-to-b from-black/60 via-black/20 to-transparent"
      : "bg-transparent"
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
          style={{ fontFamily: "var(--font-poppins), sans-serif", fontWeight: 700 }}
          className={`text-[26px] tracking-[0.22em] hover:opacity-70 transition-opacity duration-200 ${logoColor}`}
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

        {/* Right Actions — AI Stylist + Profile only */}
        <div className="hidden md:flex items-center gap-4">
          {/* AI Stylist */}
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
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 1.5L9.5 6H14L10.5 8.5L11.8 13L8 10.5L4.2 13L5.5 8.5L2 6H6.5L8 1.5Z" />
            </svg>
            <span className="text-[9px] tracking-[0.1em] uppercase font-medium leading-none">AI Stylist</span>
          </button>

          {/* Profile dropdown */}
          <SignedIn>
            <div ref={profileRef} className="relative">
              <button
                onClick={() => { setProfileOpen(v => !v); setCurrencySubmenu(false); }}
                aria-label="Profile menu"
                className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-200 ${
                  profileOpen
                    ? "border-[var(--foreground)] text-[var(--foreground)]"
                    : showWhiteText
                    ? "border-white/30 text-white/70 hover:border-white hover:text-white"
                    : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M2.5 14C2.5 11.515 5.015 9.5 8 9.5s5.5 2.015 5.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>

              {profileOpen && (
                <div className="absolute top-full right-0 mt-2 w-52 rounded-2xl border border-[var(--border)] bg-[var(--background)] z-50 overflow-hidden"
                  style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.28)" }}>

                  {/* Profile & Wishlist */}
                  <div className="py-1.5">
                    <Link href="/profile" onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M2.5 14C2.5 11.515 5.015 9.5 8 9.5s5.5 2.015 5.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                      My profile
                    </Link>
                    <Link href="/saved" onClick={() => setProfileOpen(false)}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors">
                      <span className="flex items-center gap-3">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z" stroke="currentColor" strokeWidth="1.2" />
                        </svg>
                        Wishlist
                      </span>
                      {totalLikes > 0 && (
                        <span className="text-[10px] font-semibold bg-[var(--foreground)] text-[var(--background)] rounded-full w-4 h-4 flex items-center justify-center">{totalLikes > 9 ? "9+" : totalLikes}</span>
                      )}
                    </Link>
                    <button onClick={() => { setCartOpen(true); setProfileOpen(false); }}
                      className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors">
                      <span className="flex items-center gap-3">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 1h2l1.5 7.5h8l1.5-5.5H4" />
                          <circle cx="6.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
                          <circle cx="11.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
                        </svg>
                        Cart
                      </span>
                      {cartCount > 0 && (
                        <span className="text-[10px] font-semibold bg-[var(--foreground)] text-[var(--background)] rounded-full w-4 h-4 flex items-center justify-center">{cartCount > 9 ? "9+" : cartCount}</span>
                      )}
                    </button>
                  </div>

                  <div className="border-t border-[var(--border)] py-1.5">
                    {/* Currency submenu */}
                    <button onClick={() => setCurrencySubmenu(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors">
                      <span className="flex items-center gap-3">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                          <circle cx="8" cy="8" r="6" />
                          <path d="M8 5v6M6 6.5h3a1 1 0 010 2H7a1 1 0 010 2h3.5" />
                        </svg>
                        Currency
                      </span>
                      <span className="flex items-center gap-1 text-[var(--foreground-muted)] text-[11px]">
                        {currency}
                        <svg width="8" height="8" viewBox="0 0 9 9" fill="none" className={`transition-transform duration-150 ${currencySubmenu ? "rotate-180" : ""}`}>
                          <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </button>
                    {currencySubmenu && (
                      <div className="mx-3 mb-1 rounded-xl border border-[var(--border)] overflow-hidden">
                        {CURRENCIES.map((c) => (
                          <button key={c.code}
                            onClick={() => { setCurrency(c.code); setCurrencySubmenu(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-[11px] transition-colors hover:bg-[var(--surface)] ${currency === c.code ? "text-[var(--foreground)] font-semibold" : "text-[var(--foreground-muted)]"}`}>
                            <span>{c.code}</span>
                            <span className="opacity-50">{c.symbol}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <button onClick={() => { toggleTheme(); }}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors">
                      <span className="flex items-center gap-3">
                        {theme === "dark" ? (
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="8" cy="8" r="3" />
                            <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M11.89 4.11l1.06-1.06M3.05 12.95l1.06-1.06" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7z" />
                          </svg>
                        )}
                        Theme
                      </span>
                      <span className="text-[var(--foreground-muted)] text-[11px] capitalize">{theme}</span>
                    </button>
                  </div>

                  <div className="border-t border-[var(--border)] py-1.5">
                    <Link href="/settings" onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="8" cy="8" r="2" />
                        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M11.54 4.46l1.41-1.41M3.05 12.95l1.41-1.41" />
                      </svg>
                      Settings
                    </Link>
                    <Link href="/logout" onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-[12px] font-medium text-[var(--foreground)] opacity-60 hover:opacity-100 hover:bg-[var(--surface)] transition-all">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6" />
                      </svg>
                      Log out
                    </Link>
                  </div>
                </div>
              )}
            </div>
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

        {/* Mobile: AI Stylist + Profile */}
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
            <span className="text-[9px] tracking-[0.1em] uppercase font-medium leading-none">AI Stylist</span>
          </button>
          <SignedIn>
            <Link href="/profile" aria-label="Profile"
              className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-200 ${
                pathname === "/profile"
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : showWhiteText
                  ? "border-white/30 text-white/70"
                  : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
              }`}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M2.5 14C2.5 11.515 5.015 9.5 8 9.5s5.5 2.015 5.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </Link>
          </SignedIn>
          <SignedOut>
            <Link href="/login" className={`text-xs tracking-[0.12em] uppercase font-medium transition-colors duration-200 ${linkMuted}`}>
              Sign in
            </Link>
          </SignedOut>
        </div>
      </nav>
    </header>

      {/* Cart drawer */}
      {cartOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setCartOpen(false)} aria-hidden="true" />
          <div ref={cartDrawerRef}
            className="fixed top-3 right-3 bottom-3 w-full max-w-[360px] z-50 bg-[var(--background)] rounded-2xl border border-[var(--border)] flex flex-col animate-slide-in-right overflow-hidden"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
              <div>
                <p className="text-[13px] font-medium text-[var(--foreground)]">Cart</p>
                <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] mt-0.5">
                  {cartCount === 0 ? "Empty" : `${cartCount} ${cartCount === 1 ? "item" : "items"}`}
                </p>
              </div>
              <button onClick={() => setCartOpen(false)} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors text-xl leading-none" aria-label="Close cart">×</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--border-strong)]">
                    <path d="M2 2h4l3 15h16l3-11H8" />
                    <circle cx="13" cy="27" r="2" />
                    <circle cx="23" cy="27" r="2" />
                  </svg>
                  <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">Your cart is empty</p>
                  <p className="text-[11px] text-[var(--foreground-subtle)] leading-relaxed">Build an outfit in the builder and click&nbsp;&ldquo;Shop the Look&rdquo; to add items here.</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-2 p-3">
                  {cartItems.map(item => (
                    <li key={item.id} className="flex gap-3 px-3 py-3 items-start rounded-xl border border-[var(--border)] bg-[var(--background)] hover:border-[var(--foreground-muted)] transition-all duration-200">
                      <Link href={`/product/${item.id}`} onClick={() => setCartOpen(false)} className="w-[52px] h-[66px] shrink-0 bg-[var(--surface)] overflow-hidden rounded-lg hover:opacity-80 transition-opacity">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      </Link>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <Link href={`/product/${item.id}`} onClick={() => setCartOpen(false)} className="text-[12px] font-medium text-[var(--foreground)] leading-snug line-clamp-2 hover:underline block">{item.name}</Link>
                        <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-[var(--foreground-muted)] mt-0.5">{item.brand}</p>
                        <p className="font-mono text-[11px] text-[var(--foreground)] mt-1">{formatPrice(item.price, item.currency)}</p>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="shrink-0 mt-0.5 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors" aria-label={`Remove ${item.name}`}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {cartItems.length > 0 && (
              <div className="shrink-0 border-t border-[var(--border)] px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">Estimated total</p>
                  <p className="text-[20px] font-bold text-[var(--foreground)]">{formatPrice(cartTotalUsd)}</p>
                </div>
                <p className="font-mono text-[8px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] text-center">Checkout coming soon · Links open in retailer sites</p>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
