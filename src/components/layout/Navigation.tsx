"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useLikes } from "@/lib/context/likes-context";
import { useCart } from "@/lib/context/cart-context";
import { useCurrency, CURRENCIES } from "@/lib/context/currency-context";
import { SignedIn, SignedOut, useClerk } from "@clerk/nextjs";
import { useStylist } from "@/lib/context/stylist-context";
import { useTheme } from "@/lib/context/theme-context";
import { useScrollLock } from "@/lib/hooks/useScrollLock";

const navLinks = [
  { href: "/browse", label: "Browse" },
  { href: "/builder", label: "Builder" },
  { href: "/blog", label: "Journal" },
  { href: "/saved", label: "My Likes" },
];

export default function Navigation() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [currencySubmenu, setCurrencySubmenu] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const { isOpen: stylistOpen, toggle: toggleStylist } = useStylist();
  const { signOut } = useClerk();
  const cartDrawerRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const { unseenCount } = useLikes();
  const { theme, toggleTheme } = useTheme();
  const { cartItems, removeFromCart } = useCart();
  const { currency, setCurrency, formatPrice, convertToUsd } = useCurrency();
  const [aiTooltipVisible, setAiTooltipVisible] = useState(false);
  const [aiHover, setAiHover] = useState(false);
  const [cartHover, setCartHover] = useState(false);
  const [profileHover, setProfileHover] = useState(false);
  const aiButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("ai-tooltip-dismissed")) {
      const t = setTimeout(() => setAiTooltipVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const dismissAiTooltip = () => {
    setAiTooltipVisible(false);
    localStorage.setItem("ai-tooltip-dismissed", "1");
  };

  const isHero = pathname === "/";
  const isBuilder = pathname === "/builder";
  const showWhiteText = isHero && !scrolled && theme === "dark";

  const isDark = theme === "dark";
  const navBg = isDark ? "#0a0a0a" : "#ffffff";
  const navBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const navShadow = isDark ? "0 2px 20px rgba(0,0,0,0.4)" : "0 2px 20px rgba(0,0,0,0.08)";
  const navIconColor = isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)";
  const navIconColorHover = isDark ? "rgba(255,255,255,1)" : "rgba(0,0,0,0.9)";
  const navIconBorder = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)";
  const navIconBorderHover = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)";
  const navDivider = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const logoClass = isDark ? "text-white" : "text-black";
  const linkActiveClass = isDark ? "text-white" : "text-black";
  const linkMutedClass = isDark ? "text-white/40 hover:text-white/70" : "text-black/40 hover:text-black/70";
  const dotColor = isDark ? "white" : "black";
  const cartCount = cartItems.length;
  const cartTotalUsd = cartItems.reduce(
    (sum, item) => sum + convertToUsd(item.price, item.currency || "USD"),
    0,
  );

  // Lock background scroll while the cart drawer or logout modal is open
  useScrollLock(cartOpen || logoutConfirmOpen);

  // Close cart drawer on click/tap outside (pointerdown fires reliably on touch)
  useEffect(() => {
    if (!cartOpen) return;
    const handler = (e: PointerEvent) => {
      if (cartDrawerRef.current && !cartDrawerRef.current.contains(e.target as Node)) {
        setCartOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [cartOpen]);

  // Close profile dropdown on click/tap outside
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: PointerEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
        setCurrencySubmenu(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
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
    <header className={`sticky top-0 left-0 right-0 z-50 transition-all duration-300 ${isBuilder ? "hidden md:block" : ""}`}
      style={{ paddingTop: 10 }}>
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
      <nav
        className="h-14 flex items-center justify-between px-6"
        style={{
          background: navBg,
          borderRadius: 50,
          border: `1px solid ${navBorder}`,
          boxShadow: navShadow,
          transition: "background 0.3s, border-color 0.3s, box-shadow 0.3s",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{ fontFamily: "var(--font-poppins), sans-serif", fontWeight: 800 }}
          className={`text-[22px] tracking-[0.18em] hover:opacity-70 transition-opacity duration-200 shrink-0 ${logoClass}`}
        >
          GOO
        </Link>

        {/* Desktop Nav — centered links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className="relative flex flex-col items-center gap-1.5 pb-0.5"
              >
                <span className={`text-[11px] tracking-[0.14em] uppercase font-semibold transition-colors duration-200 ${
                  isActive ? linkActiveClass : linkMutedClass
                }`}>
                  {link.label}
                </span>
                {isActive && (
                  <span style={{
                    width: 4, height: 4, borderRadius: "50%",
                    background: dotColor, display: "block",
                    position: "absolute", bottom: -6,
                  }} />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right Actions */}
        <div className="hidden md:flex items-center shrink-0" style={{ gap: 4 }}>
          {/* AI Stylist — icon circle */}
          <div ref={aiButtonRef} className="relative">
            <button
              onClick={() => { toggleStylist(); dismissAiTooltip(); }}
              onMouseEnter={() => setAiHover(true)}
              onMouseLeave={() => setAiHover(false)}
              aria-label="Open AI Stylist"
              className={`flex items-center justify-center transition-all duration-200${aiTooltipVisible ? " ai-pulse" : ""}`}
              style={{
                width: 38, height: 38, borderRadius: "50%",
                border: `1px solid ${stylistOpen ? (isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)") : aiHover ? navIconBorderHover : navIconBorder}`,
                background: stylistOpen ? (isDark ? "white" : "black") : "transparent",
                color: stylistOpen ? (isDark ? "black" : "white") : aiHover ? navIconColorHover : navIconColor,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>AI</span>
            </button>

            {/* AI tooltip onboarding popup */}
            {aiTooltipVisible && (
              <div
                className="absolute top-full right-0 mt-2 z-50"
                style={{
                  width: 200,
                  background: isDark ? "#1a1a1a" : "#0A0A0A",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 14,
                  padding: "12px 14px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  animation: "fadeInDown 0.25s ease",
                }}
              >
                <button
                  onClick={dismissAiTooltip}
                  aria-label="Dismiss"
                  style={{
                    position: "absolute", top: 8, right: 8,
                    width: 18, height: 18,
                    background: "rgba(255,255,255,0.1)",
                    border: "none", borderRadius: "50%",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 10, lineHeight: 1,
                  }}
                >
                  ✕
                </button>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 4, paddingRight: 18 }}>
                  AI Stylist
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.45, margin: 0 }}>
                  Personal outfit picks and ideas powered by AI
                </p>
              </div>
            )}
          </div>

          {/* divider */}
          <div style={{ width: 1, height: 20, background: navDivider, margin: "0 8px" }} />

          {/* Cart */}
          <div className="relative">
            <button
              onClick={() => setCartOpen(true)}
              onMouseEnter={() => setCartHover(true)}
              onMouseLeave={() => setCartHover(false)}
              aria-label="Open cart"
              className="flex items-center justify-center transition-all duration-200"
              style={{
                width: 38, height: 38, borderRadius: "50%",
                border: `1px solid ${cartOpen ? (isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.35)") : cartHover ? navIconBorderHover : navIconBorder}`,
                background: cartOpen ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)") : "transparent",
                color: cartHover ? navIconColorHover : navIconColor,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 1h2l1.5 7.5h8l1.5-5.5H4" />
                <circle cx="6.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
                <circle cx="11.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
              </svg>
              {cartCount > 0 && (
                <span style={{
                  position: "absolute", top: 1, right: 1,
                  width: 15, height: 15,
                  background: isDark ? "white" : "black",
                  color: isDark ? "black" : "white",
                  borderRadius: "50%",
                  fontSize: 8, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  lineHeight: 1,
                }}>
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </button>
          </div>

          {/* divider */}
          <div style={{ width: 1, height: 20, background: navDivider, margin: "0 8px" }} />

          {/* Profile */}
          <SignedIn>
            <div ref={profileRef} className="relative">
              <button
                onClick={() => { setProfileOpen(v => !v); setCurrencySubmenu(false); }}
                onMouseEnter={() => setProfileHover(true)}
                onMouseLeave={() => setProfileHover(false)}
                aria-label="Profile menu"
                className="flex items-center justify-center transition-all duration-200"
                style={{
                  width: 38, height: 38, borderRadius: "50%",
                  border: `1px solid ${profileOpen ? (isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.35)") : profileHover ? navIconBorderHover : navIconBorder}`,
                  background: profileOpen ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)") : "transparent",
                  color: profileHover ? navIconColorHover : navIconColor,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M2.5 14C2.5 11.515 5.015 9.5 8 9.5s5.5 2.015 5.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                {unseenCount > 0 && (
                  <span style={{
                    position: "absolute", top: 1, right: 1,
                    width: 15, height: 15,
                    background: isDark ? "white" : "black",
                    color: isDark ? "black" : "white",
                    borderRadius: "50%",
                    fontSize: 8, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    lineHeight: 1,
                  }}>
                    {unseenCount > 9 ? "9+" : unseenCount}
                  </span>
                )}
              </button>

              {profileOpen && (
                <div className="absolute top-full right-0 mt-2 w-52 rounded-2xl border border-[var(--border)] bg-[var(--background)] z-50 overflow-hidden"
                  style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.28)" }}>

                  {/* Currency overlay — covers entire panel */}
                  {currencySubmenu && (
                    <div className="absolute inset-0 rounded-2xl bg-[var(--background)] z-10 overflow-hidden flex flex-col"
                      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.28)" }}>
                      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
                        <span className="text-[11px] tracking-[0.14em] uppercase font-black text-[var(--foreground)]">Currency</span>
                        <button onClick={() => setCurrencySubmenu(false)} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                      <div className="overflow-y-auto py-1">
                        {CURRENCIES.map((c) => (
                          <button key={c.code}
                            onClick={() => { setCurrency(c.code); setCurrencySubmenu(false); }}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-[12px] transition-colors hover:bg-[var(--surface)] ${currency === c.code ? "text-[var(--foreground)] font-bold" : "text-[var(--foreground)] opacity-55"}`}>
                            <span>{c.code}</span>
                            <span className="opacity-50 text-[11px]">{c.symbol}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

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
                      {unseenCount > 0 && (
                        <span className="text-[10px] font-semibold bg-[var(--foreground)] text-[var(--background)] rounded-full w-4 h-4 flex items-center justify-center">{unseenCount > 9 ? "9+" : unseenCount}</span>
                      )}
                    </Link>
                  </div>

                  <div className="border-t border-[var(--border)] py-1.5 relative">
                    {/* Currency — opens floating panel to the left */}
                    <button onClick={() => setCurrencySubmenu(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors">
                      <span className="flex items-center gap-3">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="8" cy="8" r="6" />
                          <path d="M10 6.1c-.4-.8-1.1-1.2-2-1.2-1.1 0-2 .6-2 1.5 0 .9.9 1.2 2 1.4 1.1.2 2 .6 2 1.5 0 .9-.9 1.5-2 1.5-.9 0-1.6-.4-2-1.2" />
                          <path d="M8 3.8v8.4" />
                        </svg>
                        Currency
                      </span>
                      <span className="flex items-center gap-1 text-[var(--foreground-muted)] text-[11px]">
                        {currency}
                        <svg width="8" height="8" viewBox="0 0 9 9" fill="none" className={`transition-transform duration-150 ${currencySubmenu ? "-rotate-90" : "rotate-90"}`}>
                          <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </button>
                    {currencySubmenu && (
                      <div className="absolute right-full top-0 mr-2 w-36 rounded-2xl border border-[var(--border)] bg-[var(--background)] overflow-hidden z-[60]"
                        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.28)" }}>
                        {CURRENCIES.map((c) => (
                          <button key={c.code}
                            onClick={() => { setCurrency(c.code); setCurrencySubmenu(false); }}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-[12px] transition-colors hover:bg-[var(--surface)] ${currency === c.code ? "text-[var(--foreground)] font-bold" : "text-[var(--foreground)] opacity-55"}`}>
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                      Settings
                    </Link>
                    <button onClick={() => { setProfileOpen(false); setLogoutConfirmOpen(true); }}
                      className="flex items-center gap-3 px-4 py-2.5 text-[12px] font-medium text-[var(--foreground)] opacity-60 hover:opacity-100 hover:bg-[var(--surface)] transition-all w-full text-left">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6" />
                      </svg>
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </SignedIn>
          <SignedOut>
            <Link href="/login"
              className={`text-[11px] tracking-[0.12em] uppercase font-medium transition-colors ${isDark ? "text-white/50 hover:text-white" : "text-black/50 hover:text-black"}`}>
              Sign in
            </Link>
          </SignedOut>
        </div>

        {/* Mobile: icon buttons */}
        <div className="md:hidden flex items-center gap-1">
          <button onClick={toggleStylist} aria-label="Open AI Stylist"
            className="flex items-center justify-center transition-all duration-200"
            style={{ width:36, height:36, borderRadius:"50%",
              border: `1px solid ${stylistOpen ? (isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)") : navIconBorder}`,
              background: stylistOpen ? (isDark ? "white" : "black") : "transparent",
              color: stylistOpen ? (isDark ? "black" : "white") : navIconColor }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>AI</span>
          </button>
          <div style={{ width:1, height:18, background: navDivider, margin:"0 2px" }} />
          {/* Cart — mobile (desktop cart lives in the md:flex block above) */}
          <button onClick={() => setCartOpen(true)} aria-label="Open cart"
            className="relative flex items-center justify-center transition-all duration-200"
            style={{ width:36, height:36, borderRadius:"50%", border:`1px solid ${navIconBorder}`,
              background:"transparent", color: navIconColor }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 1h2l1.5 7.5h8l1.5-5.5H4" />
              <circle cx="6.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
              <circle cx="11.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
            </svg>
            {cartCount > 0 && (
              <span style={{
                position: "absolute", top: 0, right: 0,
                width: 15, height: 15,
                background: isDark ? "white" : "black",
                color: isDark ? "black" : "white",
                borderRadius: "50%", fontSize: 8, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
              }}>
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </button>
          {/* Profile lives in the mobile bottom nav — keep the header lean.
              Signed-out users still get a Sign in entry point here. */}
          <SignedOut>
            <div style={{ width:1, height:18, background: navDivider, margin:"0 2px" }} />
            <Link href="/login"
              className={`text-[11px] tracking-[0.12em] uppercase font-medium transition-colors ${isDark ? "text-white/50 hover:text-white" : "text-black/50 hover:text-black"}`}>
              Sign in
            </Link>
          </SignedOut>
        </div>
      </nav>
      </div>
    </header>

      {/* Cart drawer */}
      {cartOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setCartOpen(false)} aria-hidden="true" />
          <div ref={cartDrawerRef}
            className="fixed top-3 right-3 bottom-3 left-3 w-auto sm:left-auto sm:w-full sm:max-w-[360px] z-50 bg-[var(--background)] rounded-2xl border border-[var(--border)] flex flex-col animate-slide-in-right overflow-hidden"
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
                      <Link href={`/product/${item.id}`} onClick={() => setCartOpen(false)} className="flex gap-3 flex-1 min-w-0 cursor-pointer">
                        <Image src={item.imageUrl} alt={item.name} width={52} height={66} className="w-[52px] h-[66px] shrink-0 bg-[var(--surface)] overflow-hidden rounded-lg object-cover" />
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-[12px] font-medium text-[var(--foreground)] leading-snug line-clamp-2">{item.name}</p>
                          <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-[var(--foreground-muted)] mt-0.5">{item.brand}</p>
                          <p className="font-mono text-[11px] text-[var(--foreground)] mt-1">{formatPrice(item.price, item.currency)}</p>
                        </div>
                      </Link>
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

      {/* Logout confirmation modal */}
      {logoutConfirmOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", background: "rgba(0,0,0,0.45)" }}
          onClick={() => setLogoutConfirmOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 20,
              padding: "28px 28px 24px",
              width: 300,
              boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
              animation: "fadeInDown 0.2s ease",
            }}
          >
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>
              Sign out?
            </p>
            <p style={{ fontSize: 13, color: "var(--foreground-muted)", marginBottom: 24, lineHeight: 1.5 }}>
              Are you sure you want to sign out of your account?
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setLogoutConfirmOpen(false)}
                style={{
                  flex: 1, height: 40, borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: "var(--fg-overlay-05)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                  cursor: "pointer",
                  transition: "opacity 0.15s",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => { setLogoutConfirmOpen(false); signOut({ redirectUrl: "/" }); }}
                style={{
                  flex: 1, height: 40, borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: "var(--foreground)",
                  border: "none",
                  color: "var(--background)",
                  cursor: "pointer",
                  transition: "opacity 0.15s",
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
