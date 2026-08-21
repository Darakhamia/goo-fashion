import type { Product, Retailer } from "@/lib/types";
import type { CartRetailer } from "@/lib/context/cart-context";

/**
 * The stores a cart row offers, official first — that is the one "open all"
 * takes, and the order a chooser should read in.
 */
export function toCartRetailers(retailers: Retailer[] | undefined): CartRetailer[] {
  if (!retailers?.length) return [];
  return [...retailers]
    .sort((a, b) => Number(b.isOfficial) - Number(a.isOfficial) || a.price - b.price)
    .map((r) => ({
      name: r.name,
      url: r.url,
      price: r.price,
      currency: r.currency,
      isOfficial: r.isOfficial,
    }));
}

/** The store a piece opens by default: the official one, else the cheapest. */
export function preferredRetailerUrl(retailers: Retailer[] | undefined): string | null {
  return toCartRetailers(retailers)[0]?.url ?? null;
}

/** A whole product as the cart keeps it, stores included. */
export function toCartItem(product: Product, overrides: Partial<{ id: string; name: string; imageUrl: string; price: number }> = {}) {
  const stores = toCartRetailers(product.retailers);
  return {
    id: overrides.id ?? product.id,
    name: overrides.name ?? product.name,
    brand: product.brand,
    imageUrl: overrides.imageUrl ?? product.imageUrl,
    price: overrides.price ?? product.priceMin,
    currency: product.currency,
    retailerUrl: stores[0]?.url ?? null,
    retailers: stores,
  };
}
