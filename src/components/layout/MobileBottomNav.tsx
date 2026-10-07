"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useLikes } from "@/lib/context/likes-context";

const TABS = [
  { href: "/browse", label: "Browse", d: "M17.5 11a6.5 6.5 0 1 1-13 0a6.5 6.5 0 1 1 13 0 M16 16l4 4" },
  { href: "/builder", label: "Builder", d: "M7 4L3 8v2.5L5.5 9V20h13V9l2.5 1.5V8l-4-4S15.5 6 12 6 7 4 7 4Z" },
  {
    href: "/blog",
    label: "Journal",
    d: "M5 5.5A2.5 2.5 0 0 1 7.5 3H19v14H7.5A2.5 2.5 0 0 0 5 19.5v-14Z M5 19.5A2.5 2.5 0 0 1 7.5 17H19v4H7.5A2.5 2.5 0 0 1 5 19.5Z M9 7.5h6M9 10.5h4",
  },
  { href: "/saved", label: "My likes", d: "M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z" },
  { href: "/profile", label: "Profile", d: "M16 8a4 4 0 1 1-8 0a4 4 0 1 1 8 0 M4.5 20.5c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5" },
];

/** Pages whose own buy bar stands where the tab bar would (DESIGN_SYSTEM.md §12.8). */
export const hasBuyBar = (pathname: string) =>
  pathname === "/subscribe" || ["/product/", "/outfit/", "/look/"].some((prefix) => pathname.startsWith(prefix));

/**
 * The phone tab bar: a thin floating capsule (DESIGN_SYSTEM.md §12.4). Every tab
 * is a 44px target; only the current one carries its label, sitting in a soft
 * pill that slides between tabs. Colours come from tokens, so the bar follows
 * the theme through the CSS cascade rather than through JS.
 */
export default function MobileBottomNav() {
  const pathname = usePathname();
  const { unseenCount } = useLikes();

  if (hasBuyBar(pathname)) return null;

  return (
    <div className="md:hidden fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+6px)] z-40">
      <nav
        aria-label="Main"
        className="h-[50px] px-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-overlay-92)] backdrop-blur-md flex items-center justify-between"
      >
        {TABS.map(({ href, label, d }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`relative h-11 rounded-full flex items-center justify-center transition-colors duration-200 ${
                active
                  ? "pl-3 pr-3.5 gap-[7px] text-[var(--foreground)]"
                  : "w-11 text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="bottomNavHighlight"
                  transition={{ type: "spring", stiffness: 500, damping: 42, mass: 0.8 }}
                  className="absolute inset-0 rounded-full bg-[var(--fg-overlay-08)]"
                />
              )}
              <span className="relative">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.7 : 1.3}
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={d} />
                </svg>
                {href === "/saved" && unseenCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-[var(--foreground)] text-[var(--background)] text-[9px] font-bold leading-4 text-center">
                    {unseenCount > 9 ? "9+" : unseenCount}
                  </span>
                )}
              </span>
              {active && <span className="relative text-[12px] font-semibold leading-none">{label}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
