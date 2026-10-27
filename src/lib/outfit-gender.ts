/**
 * Who an outfit is for: women, men, or both.
 *
 * Set when a look is saved (the builder), edited (My looks, the studio) or put
 * together by the AI, and stored with it (migration 032). An outfit saved
 * before that, or saved without a choice, is read from its pieces: women's
 * pieces make a women's outfit, men's a men's, and anything else — unisex
 * pieces, unmarked ones, or both — an outfit for everyone. So every outfit
 * has a gender to filter by without its row being rewritten (CEO, 2026-10-27).
 */
import type { Gender, Outfit } from "@/lib/types";

export const GENDERS: readonly Gender[] = ["women", "men", "unisex"];

/** "women", "men" or "unisex" from any spelling of them; null for anything else. */
export function normalizeGender(value: unknown): Gender | null {
  const v = String(value ?? "").trim().toLowerCase();
  return (GENDERS as readonly string[]).includes(v) ? (v as Gender) : null;
}

/** The gender a set of pieces adds up to. */
export function genderOfPieces(genders: readonly (Gender | null | undefined)[]): Gender {
  const marked = new Set(genders.filter((g): g is "women" | "men" => g === "women" || g === "men"));
  return marked.size === 1 ? [...marked][0] : "unisex";
}

/** An outfit's gender: its own when it has one, else its pieces'. */
export function outfitGenderOf(outfit: Pick<Outfit, "gender" | "items">): Gender {
  return outfit.gender ?? genderOfPieces(outfit.items.map((i) => i.product?.gender));
}

/**
 * Does an outfit belong under the gender a shopper picked? The same rule as
 * pieces in the catalogue: a unisex outfit belongs under each.
 */
export function matchesOutfitGender(outfit: Pick<Outfit, "gender" | "items">, wanted: Gender | null): boolean {
  if (!wanted) return true;
  const g = outfitGenderOf(outfit);
  return g === wanted || g === "unisex";
}

/** As a shopper reads it: "Women", "Men", "Unisex". */
export function genderLabel(gender: Gender): string {
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}
