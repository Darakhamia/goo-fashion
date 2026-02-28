"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/context/auth-context";

const navItems = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.2" />
        <rect x="9" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.2" />
        <rect x="2" y="9" width="5" height="5" stroke="currentColor" strokeWidth="1.2" />
        <rect x="9" y="9" width="5" height="5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    href: "/admin/products",
    label: "Products",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 5L8 2L14 5V11L8 14L2 11V5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M8 2V14" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 5L14 11" stroke="currentColor" strokeWidth="1.2" />
        <path d="M14 5L2 11" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    href: "/admin/outfits",
    label: "Outfits",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M5 2L3 5H13L11 2H5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M3 5V13H13V5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M6 8H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M6 10.5H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M1 14C1 11.239 3.239 9 6 9C8.761 9 11 11.239 11 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M11 7C12.381 7 13.5 5.881 13.5 4.5C13.5 3.119 12.381 2 11 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M13 10C14.105 10.5 15 11.7 15 13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/admin/brands",
    label: "Brands",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4H14M2 8H10M2 12H7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
];

const darkVars: React.CSSProperties = {
  "--background": "#0A0A0A",
  "--surface": "#141414",
  "--foreground": "#F0EEE8",
  "--foreground-muted": "#888884",
  "--foreground-subtle": "#6E6E6A",
  "--border": "#222220",
  "--border-strong": "#3A3A38",
} as React.CSSProperties;

const pageTitles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/products": "Products",
  "/admin/outfits": "Outfits",
  "/admin/users": "Users",
  "/admin/brands": "Brands",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  const currentTitle = pageTitles[pathname] ?? "Admin";
  const initials = user?.name
    ? user.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2)
    : "AD";

  return (
    <div className="flex h-screen overflow-hidden" style={theme === "dark" ? darkVars : undefined}>
      {/* ── Sidebar ── */}
      <aside
        className={`flex-shrink-0 flex flex-col border-r border-[var(--border)] h-full transition-[width] duration-200 ease-in-out overflow-hidden ${
          collapsed ? "w-14" : "w-56"
        }`}
        style={{ background: "var(--background)" }}
      >
        {/* Logo row */}
        <div className="h-16 flex items-center border-b border-[var(--border)] flex-shrink-0">
          {!collapsed && (
            <Link
              href="/"
              className="flex items-center gap-2.5 pl-6 flex-1 min-w-0"
            >
              <span className="font-display text-xl tracking-[0.2em] uppercase text-[var(--foreground)] hover:opacity-60 transition-opacity">
                GOO
              </span>
              <span className="text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] border border-[var(--border)] px-1.5 py-0.5 leading-none">
                Admin
              </span>
            </Link>
          )}
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors flex-shrink-0 ${
              collapsed ? "w-14 h-16" : "w-10 h-16 mr-2"
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
            >
              <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 flex flex-col gap-0.5 overflow-hidden">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center transition-colors ${
                  collapsed
                    ? "justify-center px-0 mx-2 py-3"
                    : "gap-3 px-3 mx-2 py-2.5"
                } text-xs tracking-[0.1em] uppercase ${
                  isActive
                    ? "text-[var(--foreground)] bg-[var(--surface)]"
                    : "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
                }`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom controls */}
        <div className={`py-3 border-t border-[var(--border)] flex flex-col gap-0.5 flex-shrink-0 ${collapsed ? "" : "px-2"}`}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={collapsed ? (theme === "light" ? "Dark mode" : "Light mode") : undefined}
            className={`flex items-center transition-colors text-xs tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] w-full ${
              collapsed ? "justify-center py-3" : "gap-3 px-3 py-2.5"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              {theme === "light" ? (
                <path d="M13.5 10A6 6 0 016 2.5a6 6 0 100 11A6 6 0 0013.5 10z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              ) : (
                <>
                  <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5M3.4 3.4L4.5 4.5M11.5 11.5L12.6 12.6M3.4 12.6L4.5 11.5M11.5 4.5L12.6 3.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </>
              )}
            </svg>
            {!collapsed && (theme === "light" ? "Dark mode" : "Light mode")}
          </button>

          {/* Back to site */}
          <Link
            href="/"
            title={collapsed ? "Back to site" : undefined}
            className={`flex items-center transition-colors text-xs tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] ${
              collapsed ? "justify-center py-3" : "gap-3 px-3 py-2.5"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {!collapsed && "Back to site"}
          </Link>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: "var(--surface)" }}>
        {/* Top bar */}
        <div
          className="h-16 flex items-center justify-between px-8 border-b border-[var(--border)] flex-shrink-0"
          style={{ background: "var(--background)" }}
        >
          {/* Breadcrumb */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">Admin</span>
            <span className="text-[var(--border-strong)]">/</span>
            <span className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground)]">{currentTitle}</span>
          </div>

          {/* Admin user */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-[var(--foreground)] leading-none mb-0.5">{user?.name ?? "Admin"}</p>
              <p className="text-[10px] text-[var(--foreground-subtle)] leading-none">{user?.email ?? "admin@goo.com"}</p>
            </div>
            <div
              className="w-8 h-8 flex items-center justify-center border border-[var(--border-strong)] text-[10px] tracking-[0.1em] font-medium text-[var(--foreground)]"
              style={{ background: "var(--surface)" }}
            >
              {initials}
            </div>
          </div>
        </div>

        {/* Page content — full width, no max-w cap */}
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  );
}
