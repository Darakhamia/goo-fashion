import type { Product } from "@/lib/types";

/**
 * Most ids one `/api/products?ids=` request resolves — MAX_IDS in
 * app/api/products/route.ts. Longer lists go in batches of this size.
 */
const IDS_PER_REQUEST = 24;

/**
 * Catalogue products by id, fetched from the browser through
 * `/api/products?ids=`: just the pieces a page shows (liked items, a look's
 * pieces) instead of the whole catalogue. Ungrouped, so a colour variant comes
 * back as itself. Ids no longer in the catalogue are simply absent.
 *
 * Rejects when any batch fails, so the caller can ask again later instead of
 * taking a partial answer for a complete one.
 */
export async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += IDS_PER_REQUEST) {
    batches.push(unique.slice(i, i + IDS_PER_REQUEST));
  }

  const results = await Promise.all(
    batches.map(async (batch) => {
      const res = await fetch(`/api/products?ids=${batch.map(encodeURIComponent).join(",")}`);
      if (!res.ok) throw new Error(`Could not load products (HTTP ${res.status})`);
      const data: unknown = await res.json();
      return Array.isArray(data) ? (data as Product[]) : [];
    }),
  );
  return results.flat();
}
