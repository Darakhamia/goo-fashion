import type { Product } from "@/lib/types";

/** A piece counts as unavailable only when we know it's sold out everywhere. */
export function isProductAvailable(product: Product | undefined): boolean {
  if (!product) return true; // unknown product — don't penalise while data loads
  if (!product.retailers || product.retailers.length === 0) return true;
  return product.retailers.some((r) => r.availability !== "sold out");
}
