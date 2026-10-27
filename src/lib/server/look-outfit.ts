/**
 * A builder look turned into a catalogue outfit: its pieces as outfit items,
 * priced from the catalogue, and the row written.
 *
 * Every look reaches the catalogue through the moderation queue: a shopper's
 * or an admin's from My looks, or one the AI put together, is published when
 * an admin approves it (api/looks/approve). An admin's own look used to skip
 * the queue; since 2026-10-27 it does not (CEO). Pricing and the row are here
 * so that one place decides them.
 */
import { supabase } from "@/lib/supabase";
import { getProductsByIds, OPTIONAL_OUTFIT_COLUMNS } from "@/lib/data/db";
import { toUsd } from "@/lib/server/fx";
import { writeRowDroppingUnknown } from "@/lib/server/write-row";
import { genderOfPieces } from "@/lib/outfit-gender";
import type { Gender } from "@/lib/types";

export interface LookPiece {
  productId?: string;
  variantId?: string | null;
}

export interface PricedLook {
  items: { product_id: string; role: "hero" | "secondary" | "accent" }[];
  totalPriceMin: number;
  totalPriceMax: number;
  /** Who the pieces add up to being for (lib/outfit-gender). */
  gender: Gender;
}

const ROLES = ["hero", "secondary", "accent"] as const;
const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * The look's pieces as outfit items (first = hero, second = secondary, the
 * rest accents) and its total in dollars.
 *
 * The price is the catalogue's, not the look's: a look's `totalPrice` comes
 * from the browser that saved it, and an outfit published on it would
 * advertise whatever number arrived. Summed in dollars, as the builder does.
 */
export async function priceLook(pieces: LookPiece[]): Promise<PricedLook | { error: string }> {
  const ids = pieces
    .map((p) => p.productId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const items = ids.map((id, i) => ({ product_id: id, role: ROLES[Math.min(i, 2)] }));

  const products = await getProductsByIds(ids);
  // getProductsByIds reports a failed read as an empty list. Publishing on that
  // would put the look in the catalogue at $0, so none found is an error here.
  if (ids.length > 0 && products.length === 0) {
    return {
      error:
        "None of this look's products could be read from the catalogue, so it cannot be priced. Try again; if it persists, its products may have been removed.",
    };
  }

  const inUsd = async (amount: number, currency: string) => (await toUsd(amount, currency || "USD"))?.usd ?? amount;
  let totalPriceMin = 0;
  let totalPriceMax = 0;
  for (const p of products) {
    totalPriceMin += await inUsd(p.priceMin, p.currency);
    totalPriceMax += await inUsd(p.priceMax, p.currency);
  }
  return {
    items,
    totalPriceMin: cents(totalPriceMin),
    totalPriceMax: cents(totalPriceMax),
    gender: genderOfPieces(products.map((p) => p.gender)),
  };
}

/**
 * Writes an outfit row and returns its id. `seasons` (migration 030) and
 * `source` are dropped on a database without them, and the outfit still lands.
 */
export async function insertOutfitRow(row: Record<string, unknown>): Promise<{ id: string } | { error: string }> {
  if (!supabase) return { error: "Database not configured" };
  const { data, error, dropped } = await writeRowDroppingUnknown<{ id: string }>(
    row,
    OPTIONAL_OUTFIT_COLUMNS,
    (payload) => supabase!.from("outfits").insert(payload).select("id").single(),
  );
  if (error || !data) return { error: error?.message ?? "Failed to create the outfit." };
  if (dropped.length) console.warn(`[outfits] stored without ${dropped.join(", ")} — a migration is pending`);
  return { id: data.id };
}
