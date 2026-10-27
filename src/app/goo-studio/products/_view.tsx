"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import type { CategoryGroup } from "@/lib/categories";
import type { Product } from "@/lib/types";

/*
 * Where the product list was (2026-10-23): its search, filters, sort, page,
 * the pages "Load more" added, how far it was scrolled, and the catalogue and
 * category tree it had loaded. The Products layout keeps it, and that layout
 * stays mounted while you go from the list to a product and back — so Back,
 * "← Products" and the sidebar's Products all reopen the list where you left
 * it, with its rows at once. Leaving Products for another section unmounts the
 * layout and forgets it: the list then opens from the top, as before.
 *
 * A reload keeps the place too (2026-10-27). As the page is left (pagehide, or
 * the tab hidden) the view goes to sessionStorage, all but the catalogue: a
 * thousand products would not fit there, and the rows load afresh anyway. A
 * page reloaded, or brought back by Back or Forward, at a Products address
 * opens the list where it was — the list itself or a product's page, then
 * "← Products". Per tab: a new tab, a link to Products or the address typed
 * again opens the list from the top.
 */

export type SortColumn = "name" | "brand" | "category" | "priceMin" | "createdAt";

export type ListView = {
  search: string;
  group: string;
  subcategory: string;
  brand: string;
  colorGroup: string;
  style: string;
  gender: string;
  missing: string;
  isNew: boolean | null;
  sortKey: SortColumn;
  sortDir: "asc" | "desc";
  /** DataTable's page and the pages "Load more" added after it. */
  page: number;
  extra: number;
  /** The admin scrolls <main>, not the window: the browser cannot restore it. */
  scrollTop: number;
  /** The last catalogue that loaded without an error. */
  products: Product[];
  /** The category tree the filters used: a fresh mount starts from the default. */
  tree: CategoryGroup[];
};

type Memory = {
  /** What the list last saved, or null when it has not been open here. */
  read: () => Partial<ListView> | null;
  save: (part: Partial<ListView>) => void;
  /**
   * The view a reload brought back, without the catalogue. The server draws
   * the list from the top, so the list takes it once hydrated.
   */
  reloaded: () => Partial<ListView> | null;
};

const KEY = "goo-admin-products-view";

function reloadedView(): Partial<ListView> | null {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type !== "reload" && nav?.type !== "back_forward") return null;
    // The page loaded here, not a section the tab went to after leaving Products.
    if (!new URL(nav.name).pathname.startsWith("/goo-studio/products")) return null;
    return JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Partial<ListView> | null;
  } catch {
    return null;
  }
}

const ListViewContext = createContext<Memory | null>(null);

/** In the Products layout, around the list and the product pages. */
export function ListViewMemory({ children }: { children: ReactNode }) {
  const view = useRef<Partial<ListView> | null>(null);
  const memory = useMemo<Memory>(
    () => ({
      read: () => view.current,
      save: (part) => {
        view.current = { ...view.current, ...part };
      },
      reloaded: reloadedView,
    }),
    [],
  );

  useLayoutEffect(() => {
    // A product's page reloaded: "← Products" opens the list the tab left.
    view.current ??= reloadedView();
    const store = () => {
      if (!view.current) return;
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ ...view.current, products: undefined }));
      } catch {
        // Storage full or blocked: a reload starts from the top, as before.
      }
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") store();
    };
    window.addEventListener("pagehide", store);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", store);
      document.removeEventListener("visibilitychange", onHidden);
      // Off to another section: the list is forgotten there too.
      try {
        sessionStorage.removeItem(KEY);
      } catch {}
    };
  }, []);

  return <ListViewContext.Provider value={memory}>{children}</ListViewContext.Provider>;
}

export function useListViewMemory(): Memory | null {
  return useContext(ListViewContext);
}
