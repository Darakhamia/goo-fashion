"use client";

import Link from "next/link";
import { useTheme } from "@/lib/context/theme-context";

const footerLinks = {
  Platform: [
    { label: "Browse",     href: "/browse" },
    { label: "Builder",    href: "/builder" },
    { label: "AI Stylist", href: "/stylist" },
    { label: "Saved",      href: "/saved" },
    { label: "Plans",      href: "/plans" },
    { label: "Profile",    href: "/profile" },
  ],
  Company: [
    { label: "Blog",       href: "/blog" },
    { label: "About",      href: "/about" },
  ],
  Legal: [
    { label: "Privacy Policy",   href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Sitemap",          href: "/sitemap.xml" },
  ],
};

export default function Footer() {
  const { theme, toggleTheme } = useTheme();

  return (
    <footer className="border-t border-[var(--border)] mt-32">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link
              href="/"
              className="font-display text-3xl font-light tracking-[0.2em] text-[var(--foreground)] hover:opacity-70 transition-opacity duration-200"
            >
              GOO
            </Link>
            <p className="mt-4 text-sm text-[var(--foreground-muted)] leading-relaxed max-w-xs">
              Your personal AI stylist. Curated outfits, premium fashion, one platform.
            </p>
            <p className="mt-8 text-xs text-[var(--foreground-subtle)] tracking-[0.06em]">
              © {new Date().getFullYear()} GOO. All rights reserved.
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-5">
                {group}
              </p>
              <ul className="flex flex-col gap-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-[var(--border)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="text-xs text-[var(--foreground-subtle)] tracking-[0.06em]">
            Aggregating fashion from 50+ brands worldwide.
          </p>
          <div className="flex items-center gap-6">
            <span className="text-xs text-[var(--foreground-subtle)]">
              Prices shown include all applicable taxes.
            </span>
            <span className="text-xs text-[var(--foreground-subtle)] opacity-40">
              v{new Date().toISOString().slice(0, 10)}
            </span>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="flex items-center gap-2 text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200 group"
            >
              {theme === "dark" ? (
                /* Sun icon */
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
                  <path
                    d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5M3.4 3.4L4.5 4.5M11.5 11.5L12.6 12.6M3.4 12.6L4.5 11.5M11.5 4.5L12.6 3.4"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                /* Moon icon */
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M13.5 10.5A6 6 0 015.5 2.5a6 6 0 108 8z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              <span className="text-[9px] tracking-[0.14em] uppercase">
                {theme === "dark" ? "Light" : "Dark"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
