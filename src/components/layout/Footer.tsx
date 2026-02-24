import Link from "next/link";

const footerLinks = {
  Platform: [
    { label: "AI Stylist", href: "/stylist" },
    { label: "Browse", href: "/browse" },
    { label: "Plans", href: "/plans" },
    { label: "Profile", href: "/profile" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Careers", href: "/careers" },
    { label: "Press", href: "/press" },
    { label: "Blog", href: "/blog" },
  ],
  Legal: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Cookies", href: "/cookies" },
  ],
};

export default function Footer() {
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
          </div>
        </div>
      </div>
    </footer>
  );
}
