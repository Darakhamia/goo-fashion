import { planPriceMinor, type PlanId } from "@/lib/plans";

/**
 * What a paid period costs and how long it lasts (migration 029).
 *
 * Every real plan is monthly at its price. The only other period is the test
 * subscription in goo-studio (BILLING.md, "Test subscription"): 10 UAH a day,
 * whatever the plan, so a renewal can be watched tomorrow instead of next
 * month. The amount follows from the interval, never from a stored number, so
 * a daily row cannot charge a plan's monthly price.
 */

export type BillingInterval = "1m" | "1d";

type PaidPlanId = Exclude<PlanId, "free">;

/** The test subscription's period, in monobank's own format. */
export const TEST_INTERVAL: BillingInterval = "1d";

/** The test subscription's charge: 10 UAH, in kopiykas. */
export const TEST_AMOUNT_MINOR = 1_000;

const HOUR_MS = 60 * 60 * 1000;

/** A stored or referenced interval; anything unknown, including its absence before 029, is monthly. */
export function coerceInterval(raw: unknown): BillingInterval {
  return raw === "1d" ? "1d" : "1m";
}

/** What one period costs, in kopiykas. */
export function periodAmountMinor(plan: PaidPlanId, interval: BillingInterval): number {
  return interval === "1d" ? TEST_AMOUNT_MINOR : planPriceMinor(plan);
}

/**
 * When a period that starts at `from` ends. A day is 23 hours here: the
 * renewal cron runs once a day at about the same time, and a full 24 hours
 * from the moment of the last charge would land a few seconds after the next
 * run, so the test would be charged every other day.
 */
export function periodEnd(from: Date, interval: BillingInterval): Date {
  const d = new Date(from);
  if (interval === "1d") {
    d.setTime(d.getTime() + 23 * HOUR_MS);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}
