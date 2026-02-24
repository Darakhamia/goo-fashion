"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const navLinks = [
  { href: "/stylist", label: "Stylist" },
  { href: "/browse", label: "Browse" },
  { href: "/plans", label: "Plans" },
];

export default function Navigation() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[var(--background)]/95 backdrop-blur-sm border-b border-[var(--border)]"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-[1440px] mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="font-display text-2xl font-light tracking-[0.2em] text-[var(--foreground)] hover:opacity-70 transition-opacity duration-200"
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
                pathname === link.href
                  ? "text-[var(--foreground)]"
                  : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-6">
          {/* Search */}
          <button
            aria-label="Search"
            className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Saved */}
          <button
            aria-label="Saved items"
            className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
          </button>

          {/* Profile */}
          <Link
            href="/profile"
            aria-label="Profile"
            className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M2.5 14C2.5 11.515 5.01 9.5 8 9.5C10.99 9.5 13.5 11.515 13.5 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          {menuOpen ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 5H15M3 9H15M3 13H15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
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
            <div className="flex items-center gap-5 pt-2">
              <button aria-label="Search" className="text-[var(--foreground-muted)]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </button>
              <Link href="/profile" onClick={() => setMenuOpen(false)} className="text-[var(--foreground-muted)]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M2.5 14C2.5 11.515 5.01 9.5 8 9.5C10.99 9.5 13.5 11.515 13.5 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
