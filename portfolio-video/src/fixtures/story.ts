// What happens on screen, built from the catalogue fixtures in ./products.
import type { Product, Retailer } from "@/lib/types";
import {
  aj14ForestGreen, aj1Royal, aj8Chrome, astonSneakers, combatStrikeBoots, croppedJacket,
  dailyPilotSunglasses, hamptonJean, leatherJacket, ninoJacket, pwWaterMoc, reversiblePuffer,
  stoneStreetBoot, trackJacket, y3UtilityVest, zutAlorsTee,
} from "./products";

/** Builder slots, as SLOTS in src/app/builder/page.tsx:30. */
export type SlotId = "outerwear" | "top" | "bottom" | "shoes" | "accessories" | "accessories2";
export const SLOTS: { id: SlotId; label: string }[] = [
  { id: "outerwear", label: "Outerwear" },
  { id: "top", label: "Top" },
  { id: "bottom", label: "Bottom" },
  { id: "shoes", label: "Shoes" },
  { id: "accessories", label: "Acc 1" },
  { id: "accessories2", label: "Acc 2" },
];

/** The look the builder assembles, in the order the pieces arrive. Total $1,740. */
export const LOOK: { slot: SlotId; product: Product }[] = [
  { slot: "outerwear", product: leatherJacket },
  { slot: "top", product: zutAlorsTee },
  { slot: "bottom", product: hamptonJean },
  { slot: "shoes", product: aj1Royal },
  { slot: "accessories", product: dailyPilotSunglasses },
];

/** Browse: the grid under each active filter chip. */
export const BROWSE_OUTERWEAR: Product[] = [leatherJacket, ninoJacket, y3UtilityVest, reversiblePuffer, trackJacket, croppedJacket];
export const BROWSE_FOOTWEAR: Product[] = [aj1Royal, stoneStreetBoot, pwWaterMoc, aj8Chrome, combatStrikeBoots, aj14ForestGreen];

/** Mobile builder: the catalogue strip under the board. */
export const MOBILE_STRIP: Product[] = [leatherJacket, zutAlorsTee, hamptonJean, aj1Royal, dailyPilotSunglasses, astonSneakers];

/**
 * The featured item's stores on the product page.
 *
 * ILLUSTRATIVE PRICES. In the live catalogue this item is sold by one store,
 * Goat, at $148 (the first row, real). The StockX and Farfetch rows are made up
 * for the "several stores" scene, in the seed catalogue's format
 * (src/lib/data/products.ts: 2–3 retailers per item). Owner-approved: D2 in
 * STORYBOARD.md. They exist only in this video.
 */
export const FEATURED = aj1Royal;
export const FEATURED_STORES: Retailer[] = [
  { name: "Goat", url: "#", price: 148.37, currency: "USD", availability: "in stock", isOfficial: false },
  { name: "StockX", url: "#", price: 162, currency: "USD", availability: "in stock", isOfficial: false }, // illustrative
  { name: "Farfetch", url: "#", price: 185, currency: "USD", availability: "low stock", isOfficial: false }, // illustrative
];

/** The scripted AI stylist exchange. No model is called. */
export const STYLIST = {
  greeting: "Hi! I'm your AI Stylist. Tell me what vibe you're going for, or pick a prompt below.",
  question: "What's trending?",
  reply: "Streetwear is leading right now: a relaxed leather jacket over denim, finished with the Air Jordan 1 'Royal'.",
  suggestions: [leatherJacket, aj1Royal] as Product[],
  quickReplies: ["Minimal looks", "What's trending?", "Under $500", "Complete an outfit"],
};
