"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/context/auth-context";
import { motion, AnimatePresence } from "framer-motion";

const NAV_ORDER_KEY = "goo-admin-nav-order";
const ADMIN_THEME_KEY = "goo-admin-theme";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  superAdminOnly?: boolean;
  category: string;
};

const NAV_CATEGORIES = [
  { key: "overview", label: "Overview" },
  { key: "catalog", label: "Catalog" },
  { key: "content", label: "Content" },
  { key: "imports", label: "Imports" },
  { key: "users", label: "Users" },
  { key: "data", label: "Data" },
  { key: "system", label: "System" },
] as const;

const NAV_ITEMS: NavItem[] = [
  {
    href: "/goo-studio",
    label: "Dashboard",
    category: "overview",
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
    href: "/goo-studio/products",
    label: "Products",
    category: "catalog",
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
    href: "/goo-studio/outfits",
    label: "Outfits",
    category: "catalog",
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
    href: "/goo-studio/brands",
    label: "Brands",
    category: "catalog",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4H14M2 8H10M2 12H7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/goo-studio/retailers",
    label: "Retailers",
    category: "catalog",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2.5 6H13.5L12.8 13H3.2L2.5 6Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M5.5 6V4.5A2.5 2.5 0 0 1 10.5 4.5V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/goo-studio/audit",
    label: "Audit",
    category: "catalog",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M7 5V7.5M7 9.2V9.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/goo-studio/duplicates",
    label: "Duplicates",
    category: "catalog",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="4.5" width="7.5" height="9.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <path d="M6.5 4.5V2.5C6.5 2.2 6.7 2 7 2H13C13.3 2 13.5 2.2 13.5 2.5V10.5C13.5 10.8 13.3 11 13 11H9.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    href: "/goo-studio/categories",
    label: "Categories",
    category: "catalog",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 3.5H5.5M2 8H8M2 12.5H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M10.5 3.5H14M10.5 8V3.5M10.5 12.5V8M10.5 8H14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/goo-studio/blog",
    label: "Blog",
    category: "content",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 2H13V14L8 11.5L3 14V2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M6 5.5H10M6 8H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/goo-studio/analytics",
    label: "Analytics",
    category: "data",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 13V3M2 13H14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M5 10L8 7L10 9L13 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/goo-studio/subscriptions",
    label: "Subscriptions",
    category: "data",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 6.5H14" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4.5 10H7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/goo-studio/users",
    label: "Users",
    category: "users",
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
    href: "/goo-studio/waitlist",
    label: "Waitlist",
    category: "users",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h10M2 7h7M2 10h8M2 13h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="13" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M13 11v1.5l1 0.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/goo-studio/email",
    label: "Email",
    category: "users",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="4" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 5L8 9.5L14 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/goo-studio/brightdata",
    label: "Import",
    category: "imports",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 10V13H14V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 2V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M5 5L8 2L11 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/goo-studio/parser",
    label: "Parser",
    category: "imports",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5V4M8 12V14.5M1.5 8H4M12 8H14.5M3.5 3.5L5.2 5.2M10.8 10.8L12.5 12.5M3.5 12.5L5.2 10.8M10.8 5.2L12.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="8" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    href: "/goo-studio/settings",
    label: "Settings",
    category: "system",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5M3.4 3.4L4.4 4.4M11.6 11.6L12.6 12.6M3.4 12.6L4.4 11.6M11.6 4.4L12.6 3.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/goo-studio/prompts",
    label: "Prompts",
    category: "system",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4H14M2 7H10M2 10H12M2 13H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/goo-studio/activity",
    label: "Activity",
    category: "data",
    superAdminOnly: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 8H5L6.5 4L9 12L10.5 8H14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

/*
 * The admin theme is independent of the site theme on <html> (dark by
 * default), so the admin root carries a complete token set for either mode:
 *  - dark: the `.dark` class, which applies the full dark set from globals.css;
 *  - light: the light values of `:root` in globals.css, restated here because
 *    `:root` sits on <html> and is overridden there by `.dark`. Keep in sync.
 * Setting only a handful of dark colors used to leave the overlay tokens on
 * the site palette and made "Light mode" a no-op under a dark site theme.
 */
const LIGHT_TOKENS = {
  "--background": "#F4F2EE",
  "--surface": "#FFFFFF",
  "--foreground": "#0A0A0A",
  "--foreground-muted": "#6B6B6B",
  "--foreground-subtle": "#A8A8A8",
  "--border": "#E8E6E0",
  "--border-strong": "#C0BEB8",
  "--bg-overlay-90": "rgba(244, 242, 238, 0.90)",
  "--bg-overlay-95": "rgba(244, 242, 238, 0.95)",
  "--fg-overlay-05": "rgba(10, 10, 10, 0.05)",
  "--fg-overlay-08": "rgba(10, 10, 10, 0.08)",
  "--fg-on-dark-60": "rgba(244, 242, 238, 0.60)",
  "--fg-on-dark-70": "rgba(244, 242, 238, 0.70)",
  "--fg-on-dark-80": "rgba(244, 242, 238, 0.80)",
} as React.CSSProperties;

// Nested pages without a menu entry of their own; shown as a third breadcrumb
// segment under their parent menu item.
const SUBPAGE_TITLES: Record<string, string> = {
  "/goo-studio/parser/collect": "Collect",
};

/** Menu item a path belongs to: the longest href it equals or sits under. */
function navItemFor(pathname: string): NavItem | undefined {
  let match: NavItem | undefined;
  for (const item of NAV_ITEMS) {
    const hit =
      item.href === "/goo-studio"
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (hit && (!match || item.href.length > match.href.length)) match = item;
  }
  return match;
}

function saveNavOrder(order: string[] | null) {
  try {
    if (order) localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(order));
    else localStorage.removeItem(NAV_ORDER_KEY);
  } catch {
    // Storage blocked (private mode, quota): the order still applies until reload.
  }
}

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
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragHref = useRef<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAV_ORDER_KEY);
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ADMIN_THEME_KEY);
      if (saved === "dark" || saved === "light") setTheme(saved);
    } catch {}
  }, []);

  // Super-admin status comes from the server (SUPER_ADMIN_USER_ID), the same
  // check the Activity API applies, so the menu and the API cannot disagree.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((me: { isSuperAdmin?: boolean } | null) => {
        if (!cancelled) setIsSuperAdmin(me?.isSuperAdmin === true);
      })
      .catch(() => {
        // Keep the regular admin menu; super-admin APIs enforce access anyway.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!customizing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCustomizing(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [customizing]);

  const toggleTheme = () =>
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      try { localStorage.setItem(ADMIN_THEME_KEY, next); } catch {}
      return next;
    });

  const activeItem = navItemFor(pathname);
  const subpageTitle = SUBPAGE_TITLES[pathname];
  const initials = user?.name
    ? user.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2)
    : "";

  // Menu items in the saved order. The sidebar and the Customize dialog both
  // render them grouped by category (groups in fixed order), so reordering is
  // only meaningful within a group.
  const navItems = navOrder
    .map((href) => NAV_ITEMS.find((i) => i.href === href))
    .filter((i): i is NavItem => !!i && (!i.superAdminOnly || isSuperAdmin));

  const categoryOf = (href: string | null) =>
    NAV_ITEMS.find((i) => i.href === href)?.category;

  /** Moves `href` into the slot of `targetHref`; both must share a group. */
  const moveItem = (href: string, targetHref: string) => {
    if (href === targetHref || categoryOf(href) !== categoryOf(targetHref)) return;
    const to = navOrder.indexOf(targetHref);
    if (to === -1) return;
    const next = navOrder.filter((h) => h !== href);
    next.splice(to, 0, href);
    setNavOrder(next);
    saveNavOrder(next);
  };

  // The move happens on drop, so a drag released outside the list or
  // cancelled with Escape leaves the order as it was.
  const handleDrop = (e: React.DragEvent, targetHref: string) => {
    // Without this Firefox treats the dropped text/plain as a link to open.
    e.preventDefault();
    const from = dragHref.current;
    if (from) moveItem(from, targetHref);
  };

  const handleDragEnd = () => {
    dragHref.current = null;
    setDragOver(null);
  };

  const resetOrder = () => {
    setNavOrder(NAV_ITEMS.map((i) => i.href));
    saveNavOrder(null);
  };

  return (
    <div
      className={`flex h-screen overflow-hidden${theme === "dark" ? " dark" : ""}`}
      style={theme === "light" ? LIGHT_TOKENS : undefined}
    >
      {/* ── Sidebar ── */}
      <aside
        className={`flex-shrink-0 flex flex-col border-r border-[var(--border)] h-full transition-[width] duration-200 ease-in-out overflow-hidden ${
          collapsed ? "w-[60px]" : "w-56"
        }`}
        style={{ background: "var(--background)" }}
      >
        {/* Logo row */}
        <div className="h-16 flex items-center border-b border-[var(--border)] flex-shrink-0">
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="logo"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <Link
                  href="/"
                  className="flex items-center gap-2.5 pl-5 pr-2 flex-1 min-w-0 whitespace-nowrap"
                >
                  <span className="font-display text-xl tracking-[0.2em] uppercase text-[var(--foreground)] hover:opacity-60 transition-opacity">
                    GOO
                  </span>
                  <span className="text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] border border-[var(--border)] px-1.5 py-0.5 leading-none rounded-md">
                    Admin
                  </span>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors flex-shrink-0 rounded-lg hover:bg-[var(--surface)] ${
              collapsed ? "w-[60px] h-16" : "w-10 h-10 mr-1.5"
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
        <nav className="flex-1 py-3 flex flex-col overflow-y-auto overflow-x-hidden">
          {NAV_CATEGORIES.map((cat) => {
            const items = navItems.filter((i) => i.category === cat.key);
            if (items.length === 0) return null;
            return (
              <div key={cat.key} className="mb-1">
                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.div
                      key={`cat-${cat.key}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.1 }}
                      className="px-5 pt-3 pb-1"
                    >
                      <span className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)]">
                        {cat.label}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
                {collapsed && (
                  <div className="mx-3 my-1 border-t border-[var(--border)]" />
                )}
                <div className="flex flex-col gap-0.5 px-2">
                  {items.map((item) => {
                    const isActive = activeItem?.href === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`flex items-center transition-colors rounded-xl ${
                          collapsed
                            ? "justify-center px-0 py-3"
                            : "gap-3 px-3 py-2"
                        } text-xs tracking-[0.1em] uppercase ${
                          isActive
                            ? "text-[var(--foreground)] bg-[var(--surface)]"
                            : "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
                        }`}
                      >
                        <span className="flex-shrink-0">{item.icon}</span>
                        <AnimatePresence initial={false}>
                          {!collapsed && (
                            <motion.span
                              key={`label-${item.href}`}
                              initial={{ opacity: 0, width: 0 }}
                              animate={{ opacity: 1, width: "auto" }}
                              exit={{ opacity: 0, width: 0 }}
                              transition={{ duration: 0.12 }}
                              className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden whitespace-nowrap"
                            >
                              {item.label}
                              {item.superAdminOnly && (
                                <span className="text-[10px] tracking-[0.14em] uppercase px-1.5 py-0.5 bg-amber-400/15 text-amber-500 border border-amber-400/30 leading-none rounded-full">
                                  SA
                                </span>
                              )}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom controls */}
        <div className={`py-3 border-t border-[var(--border)] flex flex-col gap-0.5 flex-shrink-0 px-2`}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={collapsed ? (theme === "light" ? "Dark mode" : "Light mode") : undefined}
            className={`flex items-center transition-colors text-xs tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] rounded-xl w-full ${
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
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  key="theme-label"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.12 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  {theme === "light" ? "Dark mode" : "Light mode"}
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Customize */}
          <button
            onClick={() => setCustomizing(true)}
            title={collapsed ? "Customize menu" : undefined}
            className={`flex items-center transition-colors text-xs tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] rounded-xl w-full ${
              collapsed ? "justify-center py-3" : "gap-3 px-3 py-2.5"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4H14M2 8H14M2 12H14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M11 2L13 4L11 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  key="customize-label"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.12 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  Customize
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Back to site */}
          <Link
            href="/"
            title={collapsed ? "Back to site" : undefined}
            className={`flex items-center transition-colors text-xs tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] rounded-xl ${
              collapsed ? "justify-center py-3" : "gap-3 px-3 py-2.5"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  key="back-label"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.12 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  Back to site
                </motion.span>
              )}
            </AnimatePresence>
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
          <div className="flex items-center gap-2 min-w-0">
            {(["Admin", activeItem?.label, subpageTitle].filter(Boolean) as string[]).map((part, i, parts) => (
              <span key={i} className="flex items-center gap-2 min-w-0">
                {i > 0 && <span className="text-[var(--border-strong)]">/</span>}
                <span
                  className={`text-[10px] tracking-[0.18em] uppercase truncate ${
                    i === parts.length - 1 ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"
                  }`}
                >
                  {part}
                </span>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Nothing until the profile loads — no placeholder identity. */}
            {user && (
              <div className="text-right hidden sm:block">
                <div className="flex items-center justify-end gap-1.5 mb-0.5">
                  <p className="text-xs text-[var(--foreground)] leading-none">{user.name}</p>
                  {isSuperAdmin && (
                    <span className="text-[10px] tracking-[0.14em] uppercase px-1.5 py-0.5 bg-amber-400/15 text-amber-500 border border-amber-400/30 leading-none rounded-full">
                      Super Admin
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[var(--foreground-subtle)] leading-none">{user.email}</p>
              </div>
            )}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border text-[10px] tracking-[0.1em] font-medium text-[var(--foreground)] ${
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
      <AnimatePresence>
        {customizing && (
          <motion.div
            key="customize-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setCustomizing(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="customize-menu-title"
              className="relative w-80 max-h-full border border-[var(--border)] flex flex-col rounded-2xl overflow-hidden"
              style={{ background: "var(--background)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">Sidebar</p>
                  <h2 id="customize-menu-title" className="font-display text-base font-light text-[var(--foreground)]">Customize Menu</h2>
                </div>
                <button
                  onClick={() => setCustomizing(false)}
                  className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-1.5 rounded-lg hover:bg-[var(--surface)]"
                  aria-label="Close"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Hint */}
              <p className="px-5 pt-3 pb-1 text-[10px] text-[var(--foreground-subtle)] tracking-wide">
                Drag items or use the arrows to reorder them within a group. Changes save automatically.
              </p>

              {/* Grouped list — the sidebar keeps groups in a fixed order, so
                  items move only inside their own group. */}
              <div className="px-3 py-2 flex flex-col gap-3 overflow-y-auto select-none">
                {NAV_CATEGORIES.map((cat) => {
                  const items = navItems.filter((i) => i.category === cat.key);
                  if (items.length === 0) return null;
                  const sortable = items.length > 1;
                  return (
                    <div key={cat.key}>
                      <p className="px-2 pb-1 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)]">
                        {cat.label}
                      </p>
                      <ul className="flex flex-col gap-1">
                        {items.map((item, index) => {
                          const sameGroup = () => categoryOf(dragHref.current) === item.category;
                          return (
                            <li
                              key={item.href}
                              draggable={sortable}
                              onDragStart={(e) => {
                                dragHref.current = item.href;
                                // Firefox starts a drag only when data is set.
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("text/plain", item.href);
                              }}
                              onDragEnter={() => setDragOver(sameGroup() ? item.href : null)}
                              onDragOver={(e) => { if (sameGroup()) e.preventDefault(); }}
                              onDrop={(e) => handleDrop(e, item.href)}
                              onDragEnd={handleDragEnd}
                              className={`flex items-center gap-3 px-3 py-2 border rounded-xl transition-colors ${
                                sortable ? "cursor-grab active:cursor-grabbing" : ""
                              } ${
                                dragOver === item.href
                                  ? "border-[var(--foreground)] bg-[var(--surface)]"
                                  : "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)]"
                              }`}
                            >
                              <span className={sortable ? "text-[var(--foreground-subtle)]" : "text-[var(--foreground-subtle)] opacity-40"}>
                                <GripIcon />
                              </span>
                              <span className="text-[var(--foreground-muted)] flex-shrink-0">{item.icon}</span>
                              <span className="text-xs tracking-[0.1em] uppercase text-[var(--foreground)] flex-1 min-w-0 truncate">
                                {item.label}
                              </span>
                              {item.superAdminOnly && (
                                <span className="text-[10px] tracking-[0.14em] uppercase px-1.5 py-0.5 bg-amber-400/15 text-amber-500 border border-amber-400/30 leading-none rounded-full">
                                  SA
                                </span>
                              )}
                              {sortable && (
                                <span className="flex items-center flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => moveItem(item.href, items[index - 1].href)}
                                    disabled={index === 0}
                                    aria-label={`Move ${item.label} up`}
                                    className="p-1 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                      <path d="M3 7.5L6 4.5L9 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveItem(item.href, items[index + 1].href)}
                                    disabled={index === items.length - 1}
                                    aria-label={`Move ${item.label} down`}
                                    className="p-1 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </button>
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>

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
                  className="text-[10px] tracking-[0.14em] uppercase bg-[var(--foreground)] text-[var(--background)] px-5 py-2 hover:opacity-80 transition-opacity rounded-lg"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
