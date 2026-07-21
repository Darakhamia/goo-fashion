"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useLikes } from "@/lib/context/likes-context";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { unseenCount } = useLikes();

  const tabs = [
    {
      href: "/builder",
      label: "Builder",
      icon: (active: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 4L3 8v2.5L5.5 9V20h13V9l2.5 1.5V8l-4-4S15.5 6 12 6 7 4 7 4Z"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
            fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0}
          />
        </svg>
      ),
    },
    {
      href: "/saved",
      label: "My Likes",
      icon: (active: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 20.5C12 20.5 2.5 14.5 2.5 8C2.5 5.015 4.985 2.5 8 2.5C9.93 2.5 11.64 3.515 12.6 5.05C13.56 3.515 15.27 2.5 17.2 2.5C20.215 2.5 22.7 4.985 22.7 8C22.7 14.5 12 20.5 12 20.5Z"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
            fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.85 : 0}
          />
        </svg>
      ),
    },
    {
      href: "/browse",
      label: "Browse",
      icon: (active: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7.5" stroke="currentColor" strokeWidth="1.3"
            fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.12 : 0} />
          <path d="M17 17l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      href: "/profile",
      label: "Profile",
      icon: (active: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.3"
            fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.18 : 0} />
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  // Floating pill — same vocabulary as the desktop header (rounded surface,
  // 1px border, theme-aware shadow, overlay background + blur) so the mobile
  // nav reads as a continuation of the site rather than a separate bar.
  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 pointer-events-none px-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
    >
      <nav
        className="glass-nav pointer-events-auto mx-auto max-w-md flex items-stretch h-14 rounded-full"
      >
        {tabs.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="group relative flex-1 flex flex-col items-center justify-center gap-1"
            >
              {/* Active icon sits in the same subtle highlight (fg overlay +
                  border) the desktop header's icon buttons use; it slides
                  between tabs with the spring the Browse toggle uses. */}
              <span className="relative flex items-center justify-center w-11 h-7 transition-transform duration-200 active:scale-90">
                {active && (
                  <motion.span
                    layoutId="bottomNavHighlight"
                    transition={{ type: "spring", stiffness: 500, damping: 42, mass: 0.8 }}
                    className="absolute inset-0 rounded-full bg-[var(--fg-overlay-08)] border border-[var(--border)]"
                  />
                )}
                <span className={`relative z-10 transition-colors duration-200 ${
                  active
                    ? "text-[var(--foreground)]"
                    : "text-[var(--foreground-muted)] group-hover:text-[var(--foreground)] group-active:text-[var(--foreground)]"
                }`}>
                  {icon(active)}
                </span>
                {href === "/saved" && unseenCount > 0 && (
                  <span
                    className="absolute z-20 flex items-center justify-center rounded-full bg-[var(--foreground)] text-[var(--background)] font-bold"
                    style={{ top: -2, right: 4, minWidth: 16, height: 16, padding: "0 4px", fontSize: 9, lineHeight: 1 }}
                  >
                    {unseenCount > 9 ? "9+" : unseenCount}
                  </span>
                )}
              </span>
              <span className={`font-mono text-[10px] tracking-[0.1em] uppercase leading-none transition-colors duration-200 ${
                active
                  ? "text-[var(--foreground)]"
                  : "text-[var(--foreground-subtle)] group-hover:text-[var(--foreground-muted)]"
              }`}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
