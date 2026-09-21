/**
 * The one scale prices are compared on.
 *
 * A product is *displayed* in the currency its store charges in — that is what
 * the shopper will actually pay, and converting it for display would misreport
 * the product. But comparing prices (a budget filter, a sort, the stylist's
 * "under $200") only means anything when both sides are on one scale, so every
 * comparison goes through here instead of reading `priceMin` directly.
 *
 * The fallback to `priceMin` covers rows imported before migration 019, which
 * have no recorded rate. Those rows were written as dollars by the old import
 * default, so treating them as dollars is exactly today's behaviour — no better,
 * but no worse, and they correct themselves the next time they are imported.
 * The same coalesce is written into the SQL retrieval functions, so server-side
 * and client-side filtering agree on what a price means.
 */
import type { Product } from "@/lib/types";

type PricedLike = Pick<Product, "priceMin" | "priceMax"> &
  Partial<Pick<Product, "priceMinUsd" | "priceMaxUsd">>;

/** A product's lowest price on the USD scale, for filtering and sorting. */
export function comparablePriceMin(p: PricedLike): number {
  return p.priceMinUsd ?? p.priceMin;
}

/** A product's highest price on the USD scale, for filtering and sorting. */
export function comparablePriceMax(p: PricedLike): number {
  return p.priceMaxUsd ?? p.priceMax;
}
