/**
 * Single source of truth for plan tiers and the features each one unlocks.
 *
 * Shared by:
 *   - /plans and /subscribe pages (marketing + demo checkout)
 *   - /api/generate-outfit and /api/stylist/chat (server-side gates)
 *   - auth-context + admin/users (user plan display)
 *
 * Free = signed-in user who has not subscribed. It is the default and is NOT
 * listed on the pricing page; we treat it as "no AI, nudge toward Basic".
 */

export type PlanId = "free" | "basic" | "pro" | "premium";

export type Feature =
  | "aiStylist"
  | "imageGeneration"
  | "saveOutfits"
  | "stylistMemory"
  | "exclusiveStyles";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  price: number;
  /** Ordered list of features this plan unlocks (includes all lower-tier features). */
  features: Feature[];
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    features: [],
  },
  basic: {
    id: "basic",
    name: "Basic",
    price: 10,
    features: ["aiStylist", "imageGeneration"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 25,
    features: ["aiStylist", "imageGeneration", "saveOutfits"],
  },
  premium: {
    id: "premium",
    name: "Premium",
    price: 45,
    features: [
      "aiStylist",
      "imageGeneration",
      "saveOutfits",
      "stylistMemory",
      "exclusiveStyles",
    ],
  },
};

/** Ordered from cheapest to most expensive, for UI + upgrade paths. */
export const PLAN_ORDER: PlanId[] = ["free", "basic", "pro", "premium"];

/** Plans visible on the public pricing page (Free is implicit). */
export const PAID_PLAN_IDS: PlanId[] = ["basic", "pro", "premium"];

/** Default plan assigned to every signed-in user who has not subscribed. */
export const DEFAULT_PLAN: PlanId = "free";

/**
 * Coerce an unknown value (e.g. Clerk publicMetadata.plan) into a valid PlanId.
 * Falls back to the default so a typo in the admin panel cannot brick a user.
 */
export function coercePlan(raw: unknown): PlanId {
  return raw === "basic" || raw === "pro" || raw === "premium" || raw === "free"
    ? raw
    : DEFAULT_PLAN;
}

export function planHasFeature(planId: PlanId, feature: Feature): boolean {
  return PLANS[planId].features.includes(feature);
}

/** Cheapest plan that unlocks the feature, or null if no plan does. */
export function minimumPlanFor(feature: Feature): PlanId | null {
  for (const id of PLAN_ORDER) {
    if (planHasFeature(id, feature)) return id;
  }
  return null;
}

/** Human-readable labels for 402 upgrade prompts. */
export const FEATURE_LABELS: Record<Feature, string> = {
  aiStylist: "AI Stylist",
  imageGeneration: "Outfit image generation",
  saveOutfits: "Saved outfits",
  stylistMemory: "Stylist memory",
  exclusiveStyles: "Exclusive styles",
};
