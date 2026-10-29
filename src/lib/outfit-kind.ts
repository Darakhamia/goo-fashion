/**
 * Who put an outfit together: the AI outfit generator, or a person.
 *
 * Every outfit on the site is one or the other, and is marked so on its card
 * and its page (CEO, 2026-10-29). A person's outfit is built in the Builder and
 * reaches the site through Outfits → Pending — a shopper's and the studio's
 * alike — so the site calls it a community look. The AI's is the one the
 * generator assembled (`is_ai_generated`, set on approval when the look came
 * with `ai_meta`). The flag is the whole rule, not `source`: outfits published
 * before `source` was written carry none, and they are people's looks too.
 */
import type { Outfit } from "@/lib/types";

export type OutfitKind = "community" | "ai";

export const OUTFIT_KINDS: readonly OutfitKind[] = ["community", "ai"];

export function outfitKind(outfit: Pick<Outfit, "isAIGenerated">): OutfitKind {
  return outfit.isAIGenerated ? "ai" : "community";
}

/** As the site reads it. */
export function outfitKindLabel(kind: OutfitKind): string {
  return kind === "ai" ? "AI generated" : "Community";
}
