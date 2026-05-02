"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/context/auth-context";

const SUPER_ADMIN_ID = process.env.NEXT_PUBLIC_SUPER_ADMIN_USER_ID ?? "";
const NAV_ORDER_KEY = "goo-admin-nav-order";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  superAdminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
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
    href: "/admin/blog",
    label: "Blog",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 2H13V14L8 11.5L3 14V2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M6 5.5H10M6 8H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 13V3M2 13H14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M5 10L8 7L10 9L13 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
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
  {
    href: "/admin/email",
    label: "Email",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="4" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 5L8 9.5L14 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/admin/stockx",
    label: "StockX Import",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 11L5 5L8 9L11 5L14 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 13V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M6 11L8 13L10 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/admin/farfetch",
    label: "Farfetch Import",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 9.5V14.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M5.5 12H10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5M3.4 3.4L4.4 4.4M11.6 11.6L12.6 12.6M3.4 12.6L4.4 11.6M11.6 4.4L12.6 3.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/admin/activity",
    label: "Activity",
    superAdminOnly: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 8H5L6.5 4L9 12L10.5 8H14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
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
  "/admin/blog": "Blog",
  "/admin/analytics": "Analytics",
  "/admin/users": "Users",
  "/admin/brands": "Brands",
  "/admin/email": "Email",
  "/admin/stockx": "StockX Import",
  "/admin/farfetch": "Farfetch Import",
  "/admin/settings": "Settings",
  "/admin/activity": "Activity",
};

// ── Grip icon ──────────────────────────────────────────────────────────────
function GripIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
      <circle cx="4" cy="3" r="1" fill="currentColor" />
      <circle cx="8" cy="3" r="1" fill="currentColor" />
      <circle cx="4" cy="6" r="1" fill="currentColor" />
      <circle cx="8" cy="6" r="1" fill="currentColor" />
      <circle cx="4" cy="9" r="1" fill="currentColor" />
      <circle cx="8" cy="9" r="1" fill="currentColor" />
    </svg>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [collapsed, setCollapsed] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [navOrder, setNavOrder] = useState<string[]>(() =>
    NAV_ITEMS.map((i) => i.href)
  );
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragItem = useRef<number | null>(null);

  const pathname = usePathname();
  const { user } = useAuth();

  // Load saved order from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAV_ORDER_KEY);
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        // Merge: keep saved order, append any new items not in saved
        const known = new Set(parsed);
        const allHrefs = NAV_ITEMS.map((i) => i.href);
        const merged = [
          ...parsed.filter((h) => allHrefs.includes(h)),
          ...allHrefs.filter((h) => !known.has(h)),
        ];
        setNavOrder(merged);
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  const isSuperAdmin = !!user && !!SUPER_ADMIN_ID && user.id === SUPER_ADMIN_ID;

  const currentTitle = pageTitles[pathname] ?? "Admin";
  const initials = user?.name
    ? user.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2)
    : "AD";

  // Ordered + filtered nav items for the sidebar
  const orderedItems = navOrder
    .map((href) => NAV_ITEMS.find((i) => i.href === href))
    .filter((i): i is NavItem => !!i && (!i.superAdminOnly || isSuperAdmin));

  // Items visible in the customize modal (respects superAdminOnly)
  const customizableItems = navOrder
    .map((href) => NAV_ITEMS.find((i) => i.href === href))
    .filter((i): i is NavItem => !!i && (!i.superAdminOnly || isSuperAdmin));

  // ── Drag handlers ──────────────────────────────────────────────────────
  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    setDragOver(index);
  };

  const handleDragEnd = () => {
    const from = dragItem.current;
    const to = dragOver;
    dragItem.current = null;
    setDragOver(null);
    if (from === null || to === null || from === to) return;

    // Reorder within the full navOrder (including superAdminOnly items)
    const visibleHrefs = customizableItems.map((i) => i.href);
    const newVisible = [...visibleHrefs];
    const [removed] = newVisible.splice(from, 1);
    newVisible.splice(to, 0, removed);

    // Rebuild full order: replace visible positions with new order
    const hiddenItems = navOrder.filter((h) => !visibleHrefs.includes(h));
    const newOrder = [...newVisible, ...hiddenItems];
    setNavOrder(newOrder);
    localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(newOrder));
  };

  const resetOrder = () => {
    const defaultOrder = NAV_ITEMS.map((i) => i.href);
    setNavOrder(defaultOrder);
    localStorage.removeItem(NAV_ORDER_KEY);
  };

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
        <nav className="flex-1 py-4 flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
          {orderedItems.map((item) => {
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
                {!collapsed && (
                  <span className="flex items-center gap-2 flex-1 min-w-0">
                    {item.label}
                    {item.superAdminOnly && (
                      <span className="text-[7px] tracking-[0.14em] uppercase px-1 py-0.5 bg-amber-400/15 text-amber-500 border border-amber-400/30 leading-none">
                        SA
                      </span>
                    )}
                  </span>
                )}
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

          {/* Customize */}
          <button
            onClick={() => setCustomizing(true)}
            title={collapsed ? "Customize menu" : undefined}
            className={`flex items-center transition-colors text-xs tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] w-full ${
              collapsed ? "justify-center py-3" : "gap-3 px-3 py-2.5"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4H14M2 8H14M2 12H14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M11 2L13 4L11 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {!collapsed && "Customize"}
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
          <div className="flex items-center gap-2">
            <span className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">Admin</span>
            <span className="text-[var(--border-strong)]">/</span>
            <span className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground)]">{currentTitle}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="flex items-center justify-end gap-1.5 mb-0.5">
                <p className="text-xs text-[var(--foreground)] leading-none">{user?.name ?? "Admin"}</p>
                {isSuperAdmin && (
                  <span className="text-[7px] tracking-[0.14em] uppercase px-1.5 py-0.5 bg-amber-400/15 text-amber-500 border border-amber-400/30 leading-none">
                    Super Admin
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[var(--foreground-subtle)] leading-none">{user?.email ?? "admin@goo.com"}</p>
            </div>
            <div
              className={`w-8 h-8 flex items-center justify-center border text-[10px] tracking-[0.1em] font-medium text-[var(--foreground)] ${
                isSuperAdmin ? "border-amber-400/60" : "border-[var(--border-strong)]"
              }`}
              style={{ background: "var(--surface)" }}
            >
              {initials}
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>

      {/* ── Customize modal ── */}
      {customizing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setCustomizing(false)}
        >
          <div
            className="relative w-80 border border-[var(--border)] flex flex-col"
            style={{ background: "var(--background)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">Sidebar</p>
                <h2 className="font-display text-base font-light text-[var(--foreground)]">Customize Menu</h2>
              </div>
              <button
                onClick={() => setCustomizing(false)}
                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Hint */}
            <p className="px-5 pt-3 pb-1 text-[10px] text-[var(--foreground-subtle)] tracking-wide">
              Drag items to reorder. Changes save automatically.
            </p>

            {/* Draggable list */}
            <ul className="px-3 py-2 flex flex-col gap-1 select-none">
              {customizableItems.map((item, index) => (
                <li
                  key={item.href}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 px-3 py-2.5 border transition-colors cursor-grab active:cursor-grabbing ${
                    dragOver === index
                      ? "border-[var(--foreground)] bg-[var(--surface)]"
                      : "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)]"
                  }`}
                >
                  <span className="text-[var(--foreground-subtle)]">
                    <GripIcon />
                  </span>
                  <span className="text-[var(--foreground-muted)] flex-shrink-0">{item.icon}</span>
                  <span className="text-xs tracking-[0.1em] uppercase text-[var(--foreground)] flex-1">
                    {item.label}
                  </span>
                  {item.superAdminOnly && (
                    <span className="text-[7px] tracking-[0.14em] uppercase px-1 py-0.5 bg-amber-400/15 text-amber-500 border border-amber-400/30 leading-none">
                      SA
                    </span>
                  )}
                  {/* Drag position indicator */}
                  {dragOver === index && (
                    <span className="w-1 h-4 bg-[var(--foreground)] flex-shrink-0" />
                  )}
                </li>
              ))}
            </ul>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-between">
              <button
                onClick={resetOrder}
                className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
              >
                Reset to default
              </button>
              <button
                onClick={() => setCustomizing(false)}
                className="text-[10px] tracking-[0.14em] uppercase bg-[var(--foreground)] text-[var(--background)] px-5 py-2 hover:opacity-80 transition-opacity"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
