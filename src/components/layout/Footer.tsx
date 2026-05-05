"use client";

import Link from "next/link";

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
    { label: "Sitemap",          href: "/sitemap-page" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-[var(--border)] mt-16 md:mt-32">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-10 md:py-24">

        {/* Mobile layout */}
        <div className="md:hidden">
          {/* Brand row */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <Link
                href="/"
                className="font-display text-2xl font-light tracking-[0.2em] text-[var(--foreground)] hover:opacity-70 transition-opacity duration-200"
              >
                GOO
              </Link>
              <p className="mt-2 text-xs text-[var(--foreground-muted)] leading-relaxed max-w-[180px]">
                Your personal AI stylist. Curated outfits, premium fashion.
              </p>
            </div>
          </div>

          {/* Links grid — 3 columns on mobile */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {Object.entries(footerLinks).map(([group, links]) => (
              <div key={group}>
                <p className="text-[9px] tracking-[0.16em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
                  {group}
                </p>
                <ul className="flex flex-col gap-2.5">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-xs text-[var(--foreground-muted)] active:text-[var(--foreground)] transition-colors duration-200"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom line */}
          <div className="pt-6 border-t border-[var(--border)] flex items-center justify-between">
            <p className="text-[10px] text-[var(--foreground-subtle)] tracking-[0.04em]">
              © {new Date().getFullYear()} GOO. All rights reserved.
            </p>
            <span className="text-[10px] text-[var(--foreground-subtle)] opacity-40">
              v{new Date().toISOString().slice(0, 10)}
            </span>
          </div>
        </div>

        {/* Desktop layout */}
        <div className="hidden md:block">
          <div className="grid grid-cols-5 gap-8">
            {/* Brand */}
            <div className="col-span-2">
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

            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}
