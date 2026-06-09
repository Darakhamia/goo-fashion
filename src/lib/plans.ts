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

/**
 * Daily AI Stylist message limits per plan. `null` = unlimited.
 * Single source of truth — used by the stylist chat + usage routes and the
 * admin dashboard so the numbers can never drift apart again.
 */
export const STYLIST_DAILY_LIMITS: Record<PlanId, number | null> = {
  free: 20,
  basic: 50,
  pro: 150,
  premium: null,
};

/**
 * ── Billing currency ────────────────────────────────────────────────────────
 *
 * monobank acquiring (Plata by mono) settles in Ukrainian hryvnia only — its
 * checkout cannot charge USD/EUR directly, so every real charge goes through in
 * UAH. The `price` field above stays as the historical USD reference used in a
 * few marketing strings; the numbers we actually bill are `PLAN_PRICE_UAH`.
 *
 * Amounts are major units (hryvnia). monobank wants minor units (kopiykas) on
 * the wire — use `planPriceMinor()` for that. Override per-plan via env
 * (MONOBANK_PRICE_BASIC / _PRO / _PREMIUM, in hryvnia) without touching code.
 */
export const BILLING_CCY = 980; // ISO 4217 numeric for UAH
export const BILLING_CCY_SYMBOL = "₴";

type PaidPlanId = "basic" | "pro" | "premium";

function envPrice(key: string, fallback: number): number {
  const raw = process.env[key];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Monthly price per paid plan, in hryvnia (major units). */
export const PLAN_PRICE_UAH: Record<PaidPlanId, number> = {
  basic: envPrice("MONOBANK_PRICE_BASIC", 399),
  pro: envPrice("MONOBANK_PRICE_PRO", 999),
  premium: envPrice("MONOBANK_PRICE_PREMIUM", 1799),
};

/** Price in kopiykas (minor units) — what monobank's API expects as `amount`. */
export function planPriceMinor(plan: PaidPlanId): number {
  return Math.round(PLAN_PRICE_UAH[plan] * 100);
}

/** Human label for UI, e.g. "399 ₴". */
export function planPriceLabel(plan: PlanId): string {
  if (plan === "free") return "0 ₴";
  return `${PLAN_PRICE_UAH[plan].toLocaleString("uk-UA")} ${BILLING_CCY_SYMBOL}`;
}

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
