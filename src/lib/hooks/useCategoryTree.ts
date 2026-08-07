"use client";

/**
 * The live category tree for client components.
 *
 * Renders start from the hardcoded default so the first paint matches what the
 * server sent, then swap to whatever the admin panel has saved once
 * `/api/categories` answers. The result is cached for the tab: browse, the
 * builder and the product page each call this and share one request.
 */
import { useEffect, useState } from "react";
import { DEFAULT_CATEGORY_GROUPS, type CategoryGroup } from "@/lib/categories";

let cached: CategoryGroup[] | null = null;
let inFlight: Promise<CategoryGroup[]> | null = null;

function fetchTree(): Promise<CategoryGroup[]> {
  if (cached) return Promise.resolve(cached);
  inFlight ??= fetch("/api/categories")
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      const groups = json?.groups;
      // Anything unexpected — an error page, an empty tree — leaves the
      // default in place rather than emptying the filter sidebar.
      cached = Array.isArray(groups) && groups.length ? (groups as CategoryGroup[]) : DEFAULT_CATEGORY_GROUPS;
      return cached;
    })
    .catch(() => DEFAULT_CATEGORY_GROUPS)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Drops the cache so the next mount refetches — used after an admin edit. */
export function invalidateCategoryTree() {
  cached = null;
}

export function useCategoryTree(): CategoryGroup[] {
  const [groups, setGroups] = useState<CategoryGroup[]>(DEFAULT_CATEGORY_GROUPS);

  useEffect(() => {
    let alive = true;
    fetchTree().then((tree) => {
      if (alive) setGroups(tree);
    });
    return () => {
      alive = false;
    };
  }, []);

  return groups;
}
