"use client";

import Link from "next/link";

// Phones get shorter labels so each group fits on a line or two (DESIGN_SYSTEM.md §12.13).
const mobileLinks: { group: string; links: { label: string; href: string }[] }[] = [
  { group: "Platform", links: [
    { label: "Browse", href: "/browse" }, { label: "Builder", href: "/builder" }, { label: "Saved", href: "/saved" },
    { label: "Plans", href: "/plans" }, { label: "Profile", href: "/profile" },
  ] },
  { group: "Company", links: [{ label: "Journal", href: "/blog" }, { label: "About", href: "/about" }] },
  { group: "Legal", links: [
    { label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }, { label: "Cookies", href: "/cookie" },
    { label: "Refunds", href: "/refund" }, { label: "Sitemap", href: "/sitemap-page" },
  ] },
];

const footerLinks = {
  Platform: [
    { label: "Browse",     href: "/browse" },
    { label: "Builder",    href: "/builder" },
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
    { label: "Cookie Policy",    href: "/cookie" },
    { label: "Refund Policy",    href: "/refund" },
    { label: "Sitemap",          href: "/sitemap-page" },
  ],
};

export default function Footer() {
  return (
    <footer className="mt-8 md:mt-32 md:border-t md:border-[var(--border)] md:bg-[var(--surface)]">
      <div className="max-w-[1440px] mx-auto px-3 md:px-12 md:py-24">

        {/* Mobile layout: one plaque on the page, no full-width band (DESIGN_SYSTEM.md §12.13) */}
        <div className="md:hidden rounded-2xl bg-[var(--surface)] px-[18px] pt-5 pb-4">
          <Link
            href="/"
            style={{ fontFamily: "var(--font-poppins), sans-serif", fontWeight: 800 }}
            className="text-[17px] tracking-[0.16em] text-[var(--foreground)] hover:opacity-70 transition-opacity duration-200"
          >
            GOO
          </Link>
          <p className="mt-1.5 text-[13px] leading-snug text-[var(--foreground-muted)]">
            Your personal AI stylist. Curated outfits, premium fashion.
          </p>

          {mobileLinks.map(({ group, links }) => (
            <nav key={group} aria-label={group} className="mt-4">
              <p className="text-[12px] text-[var(--foreground-muted)]">{group}</p>
              <ul className="flex flex-wrap gap-x-[18px]">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="min-h-11 flex items-center text-[14px] text-[var(--foreground)]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-[12px] text-[var(--foreground-muted)]">
            <p>© {new Date().getFullYear()} GOO. All rights reserved.</p>
            <span className="opacity-60">v{new Date().toISOString().slice(0, 10)}</span>
          </div>
        </div>

        {/* Desktop layout */}
        <div className="hidden md:block">
          <div className="grid grid-cols-5 gap-8">
            {/* Brand */}
            <div className="col-span-2">
              <Link
                href="/"
                className="text-3xl font-black tracking-[0.2em] text-[var(--foreground)] hover:opacity-70 transition-opacity duration-200"
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
