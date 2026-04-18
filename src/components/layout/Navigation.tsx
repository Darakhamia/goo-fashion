"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useLikes } from "@/lib/context/likes-context";
import { useCart } from "@/lib/context/cart-context";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

const navLinks = [
  { href: "/stylist", label: "Stylist" },
  { href: "/browse", label: "Browse" },
  { href: "/builder", label: "Builder" },
  { href: "/plans", label: "Plans" },
];

export default function Navigation() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const cartDrawerRef = useRef<HTMLDivElement>(null);
  const { likedOutfits, likedProducts } = useLikes();
  const { cartItems, removeFromCart } = useCart();

  const isHero = pathname === "/";
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
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${headerBg}`}>
      <nav className="max-w-[1440px] mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className={`font-display text-2xl font-light tracking-[0.2em] hover:opacity-70 transition-opacity duration-200 ${logoColor}`}
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

          {/* Profile — Clerk */}
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
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "w-6 h-6",
                  userButtonTrigger: `transition-opacity hover:opacity-70 ${iconColor}`,
                },
              }}
            />
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

        {/* Mobile Menu Toggle */}
        <button
          className={`md:hidden transition-colors ${iconColor}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          {menuOpen ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 5H15M3 9H15M3 13H15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-[var(--background)] border-b border-[var(--border)] px-6 pb-8 pt-4">
          <div className="flex flex-col gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`text-sm tracking-[0.12em] uppercase font-medium transition-colors duration-200 ${
                  pathname === link.href
                    ? "text-[var(--foreground)]"
                    : "text-[var(--foreground-muted)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <SignedIn>
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className={`text-sm tracking-[0.12em] uppercase font-medium transition-colors duration-200 ${
                  pathname === "/profile"
                    ? "text-[var(--foreground)]"
                    : "text-[var(--foreground-muted)]"
                }`}
              >
                Profile
              </Link>
            </SignedIn>
            <div className="flex items-center gap-5 pt-2">
              <Link
                href="/saved"
                onClick={() => setMenuOpen(false)}
                className="relative text-[var(--foreground-muted)]"
                aria-label="Saved"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                </svg>
                {totalLikes > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[var(--foreground)] flex items-center justify-center">
                    <span className="text-[7px] font-medium text-[var(--background)]">
                      {totalLikes > 9 ? "9+" : totalLikes}
                    </span>
                  </span>
                )}
              </Link>
              <SignedIn>
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{ elements: { avatarBox: "w-6 h-6" } }}
                />
              </SignedIn>
              <SignedOut>
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="text-xs tracking-[0.12em] uppercase font-medium text-[var(--foreground-muted)]"
                >
                  Sign in
                </Link>
              </SignedOut>
            </div>
          </div>
        </div>
      )}

      {/* Cart drawer overlay */}
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
            className="fixed top-0 right-0 h-full w-full max-w-[360px] z-50 bg-[var(--background)] border-l border-[var(--border-strong)] flex flex-col animate-slide-in-right"
            style={{ boxShadow: "-20px 0 60px rgba(0,0,0,0.12)" }}
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
                    Build an outfit in the builder and click&nbsp;"Shop the Look" to add items here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {cartItems.map(item => (
                    <li key={item.id} className="flex gap-3 px-4 py-3 items-start">
                      {/* Thumbnail */}
                      <div className="w-[52px] h-[66px] shrink-0 bg-[var(--surface)] overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-[12px] font-medium text-[var(--foreground)] leading-snug line-clamp-2">
                          {item.name}
                        </p>
                        <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-[var(--foreground-muted)] mt-0.5">
                          {item.brand}
                        </p>
                        <p className="font-mono text-[11px] text-[var(--foreground)] mt-1">
                          ${item.price.toLocaleString()}
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
                  <p className="font-display text-[20px] font-light text-[var(--foreground)]">
                    ${cartTotal.toLocaleString()}
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
    </header>
  );
}
