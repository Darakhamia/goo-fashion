"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useLikes } from "@/lib/context/likes-context";
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
  const { likedOutfits, likedProducts } = useLikes();

  const isHero = pathname === "/";
  const showWhiteText = isHero && !scrolled;
  const totalLikes = likedOutfits.length + likedProducts.length;

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
    </header>
  );
}
