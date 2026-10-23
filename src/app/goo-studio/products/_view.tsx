"use client";

import { createContext, useContext, useMemo, useRef } from "react";
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
 * layout and forgets it: the list then opens from the top, as before. Memory
 * only, per tab; a reload starts over.
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
};

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
    }),
    [],
  );
  return <ListViewContext.Provider value={memory}>{children}</ListViewContext.Provider>;
}

export function useListViewMemory(): Memory | null {
  return useContext(ListViewContext);
}
